import WebSocket from 'ws';
import { Channels, DeliveryError, type Binding, type ChannelAdapter, type ChannelMessage } from './channels.js';

type SlackReply = { ok: boolean; error?: string; team_id?: string; user_id?: string; url?: string; ts?: string; channel?: { is_member?: boolean } };
export type SlackStatus = { configured: boolean; connected: boolean; workspace?: string; error?: string };
/** Provider boundary: normalized messages enter Channels; only explicit posts leave it. */
export class SlackChannel implements ChannelAdapter {
  readonly provider = 'slack';
  readonly status: SlackStatus;
  private workspace = '';
  private botUser = '';
  private socket?: WebSocket;
  private timer?: NodeJS.Timeout;
  private heartbeat?: NodeJS.Timeout;
  private stopped = true;
  private failures = 0;
  constructor(
    private readonly channels: Channels,
    private readonly tokens: { bot: string; app: string },
    private readonly api = 'https://slack.com/api/',
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.status = { configured: Boolean(tokens.bot && tokens.app), connected: false };
  }
  private async call(method: string, body: object = {}, app = false, verb: 'GET' | 'POST' = 'POST'): Promise<SlackReply> {
    let response: Response;
    try {
      const url = new URL(method, this.api);
      if (verb === 'GET') for (const [key, value] of Object.entries(body)) url.searchParams.set(key, String(value));
      response = await this.fetcher(url, {
        method: verb,
        headers: { authorization: `Bearer ${app ? this.tokens.app : this.tokens.bot}`, 'content-type': 'application/json' },
        ...(verb === 'POST' ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000), redirect: 'error',
      });
    } catch { throw new DeliveryError('Slack connection failed; delivery outcome may be unknown.', undefined, true); }
    if (response.status === 429) {
      const seconds = Number(response.headers.get('retry-after'));
      throw new DeliveryError('Slack rate limit; retry scheduled.', Number.isFinite(seconds) ? Math.max(1, Math.min(seconds, 3600)) : 60);
    }
    if (!response.ok) throw new DeliveryError(`Slack HTTP ${response.status}.`, undefined, true);
    let result: SlackReply;
    try { result = await response.json() as SlackReply; }
    catch { throw new DeliveryError('Invalid Slack response; delivery outcome unknown.', undefined, true); }
    if (!result.ok) {
      const code = /^[a-z_]+$/.test(result.error ?? '') ? result.error : 'api_error';
      throw new DeliveryError(`Slack: ${code}.`);
    }
    return result;
  }
  async identify() {
    if (!this.status.configured) throw new DeliveryError('Configure the Slack bot and app tokens on the server.');
    const result = await this.call('auth.test');
    if (!result.team_id || !result.user_id) throw new DeliveryError('Slack did not return a workspace identity.');
    this.workspace = result.team_id;
    this.botUser = result.user_id;
    this.status.workspace = this.workspace;
    return this.workspace;
  }
  async validate(binding: Binding) {
    if (!this.workspace) await this.identify();
    if (binding.provider !== 'slack' || binding.workspace !== this.workspace || !/^[CG][A-Z0-9]+$/.test(binding.conversation)) {
      throw new DeliveryError('Use a channel ID from the configured Slack workspace.');
    }
    const result = await this.call('conversations.info', { channel: binding.conversation }, false, 'GET');
    if (!result.channel?.is_member) throw new DeliveryError('Invite the Slack bot to that channel first.');
  }
  async send(binding: Binding, message: ChannelMessage) {
    if (!this.workspace) await this.identify();
    if (binding.workspace !== this.workspace) throw new DeliveryError('Slack workspace differs from the saved binding.');
    const result = await this.call('chat.postMessage', {
      channel: binding.conversation, text: `${message.author}\n${message.text}`,
      client_msg_id: message.id, ...(message.thread ? { thread_ts: message.thread } : {}),
      mrkdwn: false, parse: 'none', unfurl_links: false, unfurl_media: false,
    });
    if (!result.ts) throw new DeliveryError('Slack accepted the request without a message ID.', undefined, true);
    return { id: result.ts, thread: message.thread };
  }
  /** Resolve only after persistence, so Socket Mode can safely acknowledge the envelope. */
  async receive(envelope: unknown) {
    const value = envelope as { type?: string; payload?: { team_id?: string; event?: Record<string, unknown> } };
    if (value?.type !== 'events_api' || value.payload?.team_id !== this.workspace) return;
    const event = value.payload.event;
    if (!event || event.type !== 'message' || event.bot_id || event.user === this.botUser
      || (event.subtype && event.subtype !== 'file_share') || typeof event.ts !== 'string'
      || typeof event.channel !== 'string' || typeof event.user !== 'string') return;
    const text = typeof event.text === 'string' ? event.text : '';
    const files = Array.isArray(event.files) ? event.files as Array<{ name?: string; permalink?: string }> : [];
    const attachments = files.map(f => `${f.name || 'Slack file'}: ${f.permalink || '(open in Slack)'}`).join('\n');
    const combined = [text, attachments].filter(Boolean).join('\n');
    if (!combined.trim()) return;
    await this.channels.ingest(
      { provider: 'slack', workspace: this.workspace, conversation: event.channel },
      event.ts, `slack:${event.user}`, combined.slice(0, 11950) + (combined.length > 11950 ? '\n[truncated; open Slack for full content]' : ''),
      typeof event.thread_ts === 'string' ? event.thread_ts : undefined,
    );
  }
  start() {
    if (!this.stopped || !this.status.configured) return;
    this.stopped = false;
    void this.connect();
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearInterval(this.heartbeat);
    this.socket?.terminate();
    this.socket = undefined;
    this.status.connected = false;
  }
  private retry() {
    if (this.stopped || this.timer) return;
    const wait = Math.min(60000, 1000 * 2 ** Math.min(this.failures++, 6));
    this.timer = setTimeout(() => { this.timer = undefined; void this.connect(); }, wait);
    this.timer.unref();
  }
  private async connect() {
    try {
      await this.identify();
      const result = await this.call('apps.connections.open', {}, true);
      if (this.stopped) return;
      if (!result.url) throw new Error('Missing WebSocket URL.');
      const url = new URL(result.url);
      if (this.api === 'https://slack.com/api/' && (url.protocol !== 'wss:' || !url.hostname.endsWith('.slack.com'))) {
        throw new Error('Invalid Slack WebSocket URL.');
      }
      const socket = new WebSocket(url, { handshakeTimeout: 15000 });
      this.socket = socket;
      let alive = true;
      socket.on('pong', () => { alive = true; });
      socket.on('open', () => {
        if (this.stopped) { socket.terminate(); return; }
        this.status.connected = true;
        this.status.error = undefined;
        this.failures = 0;
        clearInterval(this.heartbeat);
        this.heartbeat = setInterval(() => {
          if (!alive) { socket.terminate(); return; }
          alive = false;
          socket.ping();
        }, 30000);
        this.heartbeat.unref();
      });
      socket.on('message', data => {
        void (async () => {
          const envelope = JSON.parse(data.toString());
          if (envelope.type === 'disconnect') { socket.close(); return; }
          await this.receive(envelope);
          if (typeof envelope.envelope_id === 'string' && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ envelope_id: envelope.envelope_id }));
          }
        })().catch(() => {
          this.status.error = 'Could not persist a Slack event; envelope not acknowledged.';
          socket.close(); // Slack can retry; event IDs are deduplicated by the channel store.
        });
      });
      socket.on('error', () => { this.status.error = 'Slack socket connection failed.'; });
      socket.on('close', () => {
        clearInterval(this.heartbeat);
        this.status.connected = false;
        this.retry();
      });
    } catch {
      this.status.error = 'Slack connection failed. Check tokens, scopes, and network access.';
      this.status.connected = false;
      this.retry();
    }
  }
}
