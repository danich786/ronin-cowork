import { Channels } from './channels.js';
import { SlackChannel } from './slack-channel.js';
import { storeDir } from './resources.js';
import { listSessions } from './tmux.js';
import { enqueueMessage } from './message-queue.js';
import { tmux } from './tmux-client.js';
import { readTeamRoster } from './team-rosters.js';
import { registerChannels } from './routes/channels-api.js';
import type { Express } from 'express';
import { readFile, stat } from 'node:fs/promises';
import type { SlackStatus } from './slack-channel.js';

export function channelRuntime(app: Express) {
  const channels = new Channels(storeDir('channels'), {
    sessions: listSessions,
    notify: async (name, key, text) => { await enqueueMessage(name, text, 'channel_notice', 'Channel', key); },
  });
  let slack: SlackChannel | undefined;
  let status: SlackStatus = { configured: false, connected: false };
  registerChannels(app, channels, {
    status: () => status,
    resolveSession: async (name, pane) => {
      if (!name && /^%\d+$/.test(pane)) {
        name = (await tmux.run(['display-message', '-p', '-t', pane, '#{session_name}'])).trim();
      }
      return (await listSessions()).find(s => s.name === name);
    },
    teamExists: async team => Boolean(await readTeamRoster(team)) || (await listSessions()).some(s => s.tags.includes(team)),
  });
  let timer: NodeJS.Timeout | undefined;
  return {
    async start() {
      await channels.recover();
      // Only the path is in the process environment. Tokens never enter Agent envs.
      const file = process.env.RONIN_SLACK_CREDENTIALS_FILE;
      if (file) {
        try {
          const info = await stat(file);
          if (!info.isFile() || (info.mode & 0o077)) throw new Error('Credentials require mode 0600.');
          const value = JSON.parse(await readFile(file, 'utf8'));
          if (typeof value.bot !== 'string' || !value.bot.startsWith('xoxb-')
            || typeof value.app !== 'string' || !value.app.startsWith('xapp-')) throw new Error('Invalid token types.');
          slack = new SlackChannel(channels, { bot: value.bot, app: value.app });
          status = slack.status;
          channels.adapters.set('slack', slack);
          slack.start();
        } catch {
          status.error = 'Could not load Slack credentials. Check the JSON file, token types, and mode 0600.';
        }
      }
      timer = setInterval(() => {
        void channels.pump().catch(() => console.warn('[channels] Delivery sweep failed; retained work will be retried.'));
      }, 2000);
      timer.unref();
    },
    stop() { clearInterval(timer); slack?.stop(); },
  };
}
