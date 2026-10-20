import { t } from './lexicon.js';
import { request } from './request.js';

const el = (tag, cls = '', text = '') => {
  const node = document.createElement(tag);
  node.className = cls;
  node.textContent = text;
  return node;
};
const field = (label, control, description = '') => {
  const wrap = el('label', 'rc-field');
  wrap.append(el('span', 'rc-field-label', label), control);
  if (description) wrap.append(el('small', 'rc-field-help', description));
  return wrap;
};
const badge = (text, tone = '') => {
  const node = el('span', 'rc-badge', text);
  if (tone) node.dataset.tone = tone;
  return node;
};
const displayTime = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export function createTeamChannels() {
  const root = el('section', 'ronin-channels');
  const overview = el('header', 'rc-overview');
  const overviewCopy = el('div', 'rc-overview-copy');
  overviewCopy.append(
    el('h2', '', t('channels.heading', 'Shared channels')),
    el('p', '', t('channels.intro', 'Connect a Team conversation to Slack, then choose which Agents can read, receive notices, and reply.')),
  );
  const connector = el('div', 'rc-connector');
  const connectorDot = el('span', 'rc-connector-dot');
  const connectorWords = el('span', 'rc-connector-words');
  connector.append(connectorDot, connectorWords);
  overview.append(overviewCopy, connector);

  const status = el('p', 'rc-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;

  const channelBar = el('div', 'rc-channel-bar');
  const select = el('select', 'rc-control');
  select.setAttribute('aria-label', t('channels.select', 'Ronin channel'));
  const channelChoice = field(t('channels.current', 'Current channel'), select);
  const createPanel = el('details', 'rc-create-panel');
  const createSummary = el('summary', '', t('channels.new', 'New Ronin channel'));
  const create = el('form', 'rc-create-form');
  const name = el('input', 'rc-control');
  name.required = true;
  name.maxLength = 64;
  name.placeholder = t('channels.id_example', 'for example: chat-with-ronin');
  name.setAttribute('aria-label', t('channels.id', 'New channel ID'));
  const title = el('input', 'rc-control');
  title.required = true;
  title.maxLength = 160;
  title.placeholder = t('channels.title_example', 'for example: Customer support');
  title.setAttribute('aria-label', t('channels.title', 'Channel title'));
  const button = (text, type = 'button', cls = '') => {
    const node = el('button', `cc-btn ${cls}`.trim(), text);
    node.type = type;
    return node;
  };
  const createButton = button(t('channels.create', 'Create channel'), 'submit', 'rc-primary');
  create.append(
    field(t('channels.title_label', 'Display name'), title, t('channels.title_help', 'The friendly name people see in Ronin.')),
    field(t('channels.id_label', 'Ronin channel ID'), name, t('channels.id_help', 'Not the Slack ID. Use lowercase letters, numbers, hyphens, or underscores. Agents use this in commands.')),
    createButton,
  );
  createPanel.append(createSummary, create);
  channelBar.append(channelChoice, createPanel);

  const empty = el('div', 'rc-empty');
  empty.append(el('h3', '', t('channels.empty_title', 'Create the Team’s first channel')), el('p', '', t('channels.empty_help', 'A Ronin channel keeps shared history and Agent subscriptions. Connecting Slack is optional.')));

  const detail = el('div', 'rc-detail');
  const detailHead = el('header', 'rc-detail-head');
  const detailIdentity = el('div', 'rc-detail-identity');
  const channelTitle = el('h2');
  const channelMeta = el('div', 'rc-badges');
  detailIdentity.append(channelTitle, channelMeta);
  const archive = button(t('channels.archive', 'Archive channel'), 'button', 'rc-secondary');
  detailHead.append(detailIdentity, archive);

  const settings = el('div', 'rc-settings');
  const bindingCard = el('section', 'rc-card');
  const bindingHead = el('div', 'rc-card-head');
  bindingHead.append(el('h3', '', t('channels.slack_connection', 'Slack connection')), el('p', '', t('channels.slack_help', 'Messages flow both ways only after this Ronin channel is connected to a Slack channel.')));
  const bindingLabel = el('div', 'rc-current-binding');
  const binding = el('form', 'rc-binding-form');
  const slackId = el('input', 'rc-control');
  slackId.placeholder = t('channels.slack_id_example', 'C0123456789');
  slackId.setAttribute('aria-label', t('channels.slack_id', 'Slack channel ID (C… or G…)'));
  const connect = button(t('channels.connect', 'Connect Slack'), 'submit', 'rc-primary');
  const disconnect = button(t('channels.disconnect', 'Disconnect Slack'), 'button', 'rc-secondary');
  binding.append(field(t('channels.slack_id_label', 'Slack channel ID'), slackId, t('channels.slack_id_help', 'Find it at the end of the Slack channel URL.')), connect, disconnect);
  bindingCard.append(bindingHead, bindingLabel, binding);

  const accessCard = el('section', 'rc-card');
  const accessHead = el('div', 'rc-card-head');
  accessHead.append(el('h3', '', t('channels.agent_access', 'Agent access')), el('p', '', t('channels.agent_help', 'Subscribe Agents individually. Reading, notifications, and permission to reply are separate choices.')));
  const subscribers = el('div', 'rc-subscribers');
  const subscribe = el('form', 'rc-subscribe-form');
  const agent = el('select', 'rc-control');
  agent.setAttribute('aria-label', t('channels.agent', 'Team Agent'));
  const check = (text, help) => {
    const input = el('input');
    input.type = 'checkbox';
    const words = el('span', 'rc-check-words');
    words.append(el('strong', '', text), el('small', '', help));
    const label = el('label', 'rc-check');
    label.prepend(input, words);
    return { input, label };
  };
  const writable = check(t('channels.write_short', 'Can reply'), t('channels.write_help', 'Allows explicit posts to Slack.'));
  writable.label.classList.add('rc-can-reply');
  writable.input.setAttribute('aria-label', t('channels.write', 'Allow replies to external chat'));
  const notify = check(t('channels.notify_short', 'Notify'), t('channels.notify_help', 'Sends a pointer through Messages.'));
  notify.label.classList.add('rc-can-notify');
  notify.input.setAttribute('aria-label', t('channels.notify', 'Notify about new messages'));
  notify.input.checked = true;
  subscribe.append(field(t('channels.agent', 'Team Agent'), agent), writable.label, notify.label, button(t('channels.subscribe', 'Save subscription'), 'submit', 'rc-primary'));
  accessCard.append(accessHead, subscribers, subscribe);
  settings.append(bindingCard, accessCard);

  const conversation = el('section', 'rc-conversation');
  const conversationHead = el('header', 'rc-conversation-head');
  const conversationWords = el('div');
  const messagesTitle = el('h3', '', t('channels.messages', 'Conversation'));
  const messageCount = el('p', 'rc-message-count');
  conversationWords.append(messagesTitle, messageCount);
  conversationHead.append(conversationWords, el('p', 'rc-conversation-note', t('channels.explicit', 'Only explicit posts are sent to Slack. Agent terminal output stays private.')));
  const thread = el('div', 'rc-thread');
  thread.setAttribute('aria-label', t('channels.messages', 'Channel messages'));
  const threadEmpty = el('div', 'rc-thread-empty');
  threadEmpty.append(el('h4', '', t('channels.no_messages', 'No messages yet')), el('p', '', t('channels.no_messages_help', 'Post here or send a message in the connected Slack channel.')));
  const composer = el('form', 'rc-composer');
  const say = el('textarea', 'rc-control');
  say.maxLength = 12000;
  say.required = true;
  say.placeholder = t('channels.say', 'Write a message…');
  say.setAttribute('aria-label', t('channels.say_long', 'Post to this channel and its connected external chat'));
  const composerFoot = el('div', 'rc-composer-foot');
  const reply = el('select', 'rc-control');
  reply.setAttribute('aria-label', t('channels.reply', 'Reply to message'));
  const send = button(t('channels.send', 'Send'), 'submit', 'rc-primary');
  composerFoot.append(field(t('channels.reply_label', 'Post as'), reply), send);
  composer.append(field(t('channels.compose', 'Send a message'), say), composerFoot);
  conversation.append(conversationHead, thread, composer);

  detail.append(detailHead, settings, conversation);
  root.append(overview, status, channelBar, empty, detail);
  let team = '', current = '', entered = false, timer, epoch = 0, inFlight = false;
  let channel = null, slack = {}, rows = [], signature = '', subscriberSignature = '';
  let pendingPost = null, sending = false;
  detail.hidden = true;
  empty.hidden = true;
  const endpoint = () => `/api/channels/${encodeURIComponent(current)}`;
  const report = (message = '', tone = 'error', automatic = false) => {
    status.textContent = message;
    status.hidden = !message;
    status.dataset.tone = tone;
    status.dataset.automatic = String(automatic);
  };
  const requestMessage = result => result.kind === 'network'
    ? t('channels.reconnecting', 'Connection interrupted. Ronin will retry automatically.')
    : result.message;
  const renderConnector = () => {
    const connected = Boolean(slack.configured && slack.connected);
    connector.dataset.state = connected ? 'connected' : slack.configured ? 'disconnected' : 'unconfigured';
    connectorWords.replaceChildren(
      el('strong', '', connected ? t('channels.slack_connected', 'Slack connected') : slack.configured ? t('channels.slack_disconnected', 'Slack disconnected') : t('channels.slack_unconfigured', 'Slack not configured')),
      el('small', '', connected ? `${t('channels.workspace', 'Workspace')} ${slack.workspace || ''}` : slack.error || t('channels.setup_short', 'Complete the server setup to connect Slack.')),
    );
  };
  const syncPermissionForm = () => {
    const subscription = channel?.subscriptions?.find(item => item.session === agent.value);
    writable.input.checked = Boolean(subscription?.write);
    notify.input.checked = subscription ? Boolean(subscription.notify) : true;
  };
  const refresh = async () => {
    if (!entered || !team || inFlight) return;
    inFlight = true;
    const version = epoch;
    try {
      const result = await request(`/api/channels?team=${encodeURIComponent(team)}`);
      if (version !== epoch || !entered) return;
      if (!result.ok) { report(requestMessage(result), 'error', true); return; }
      if (status.dataset.automatic === 'true') report();
      rows = result.data.channels || [];
      slack = result.data.connector || {};
      renderConnector();
      if (!rows.some(c => c.id === current)) current = rows[0]?.id || '';
      select.replaceChildren(...rows.map(c => new Option(`${c.title} · ${c.id}`, c.id)));
      select.value = current;
      channelChoice.hidden = !rows.length;
      empty.hidden = Boolean(rows.length);
      if (!rows.length) createPanel.open = true;
      if (!current) { detail.hidden = true; return; }
      const id = current;
      const resultDetail = await request(endpoint());
      if (version !== epoch || id !== current || !entered) return;
      if (!resultDetail.ok) { report(requestMessage(resultDetail), 'error', true); return; }
      if (status.dataset.automatic === 'true') report();
      channel = resultDetail.data;
      detail.hidden = false;
      channelTitle.textContent = channel.title;
      channelMeta.replaceChildren(badge(channel.id), badge(channel.archived ? t('channels.archived', 'Archived') : t('channels.active', 'Active'), channel.archived ? 'warning' : 'success'));
      if (channel.binding) channelMeta.append(badge(t('channels.slack_linked', 'Slack linked'), 'success'));
      bindingLabel.replaceChildren();
      if (channel.binding) {
        bindingLabel.append(badge(t('channels.connected', 'Connected'), 'success'), el('span', '', `${t('channels.workspace', 'Workspace')} ${channel.binding.workspace}`), el('span', '', `${t('channels.slack_channel', 'Slack channel')} ${channel.binding.conversation}`));
        slackId.value = channel.binding.conversation;
      } else {
        bindingLabel.append(badge(t('channels.local_badge', 'Local only')), el('span', '', t('channels.local', 'No external chat is connected. Messages remain inside Ronin.')));
      }
      connect.disabled = !slack.configured || !slack.workspace || channel.archived;
      disconnect.disabled = !channel.binding;
      connect.hidden = Boolean(channel.binding);
      disconnect.hidden = !channel.binding;
      slackId.disabled = Boolean(channel.binding);
      archive.textContent = channel.archived ? t('channels.restore', 'Restore channel') : t('channels.archive', 'Archive channel');
      send.disabled = sending || channel.archived;
      say.disabled = channel.archived;
      const nextSubs = JSON.stringify(channel.subscriptions);
      if (subscriberSignature !== nextSubs) {
        subscriberSignature = nextSubs;
        subscribers.replaceChildren();
        if (!channel.subscriptions.length) subscribers.append(el('p', 'rc-muted', t('channels.no_agents', 'No Agents subscribed yet.')));
        for (const sub of channel.subscriptions) {
          const row = el('div', 'rc-subscriber');
          const identity = el('div', 'rc-subscriber-identity');
          identity.append(el('strong', '', sub.session), badge(sub.write ? t('channels.writer', 'Can reply') : t('channels.reader', 'Read only')), badge(sub.notify ? t('channels.notified', 'Notifications on') : t('channels.quiet', 'Notifications off')));
          const remove = button(t('channels.unsubscribe', 'Unsubscribe'), 'button', 'rc-link-button');
          remove.addEventListener('click', () => void act(`${endpoint()}/subscriptions/${encodeURIComponent(sub.session)}`, { method: 'DELETE' }));
          row.append(identity, remove);
          subscribers.append(row);
        }
        syncPermissionForm();
      }
      const messages = channel.messages || [];
      messageCount.textContent = messages.length === 1 ? t('channels.one_message', '1 message') : `${messages.length} ${t('channels.message_count', 'messages')}`;
      const nextSignature = JSON.stringify(messages);
      if (signature !== nextSignature) {
        signature = nextSignature;
        const previousReply = reply.value;
        reply.replaceChildren(new Option(t('channels.new_message', 'New message'), ''));
        thread.replaceChildren();
        if (!messages.length) thread.append(threadEmpty);
        for (const message of messages) {
          const inbound = message.direction === 'inbound';
          const article = el('article', `rc-message ${inbound ? 'inbound' : 'outbound'}`);
          const head = el('header', 'rc-message-head');
          const author = inbound ? message.author.replace(/^slack:/, `${t('channels.slack_person', 'Slack user')} `) : message.author.replace(/^agent:/, '');
          head.append(el('strong', '', author), badge(inbound ? t('channels.from_slack', 'From Slack') : t('channels.from_ronin', 'From Ronin'), inbound ? '' : 'accent'), el('time', '', displayTime(message.at)));
          const body = el('p', 'rc-message-text', message.text);
          article.append(head, body);
          if (message.thread) article.append(el('p', 'rc-thread-label', t('channels.thread_reply', 'Thread reply')));
          const delivery = message.delivery;
          if (delivery) article.append(badge(delivery === 'sent' ? t('channels.sent', 'Sent') : delivery, delivery === 'sent' ? 'success' : delivery === 'failed' || delivery === 'uncertain' ? 'warning' : ''));
          if (message.reason) article.append(el('p', 'rc-delivery-reason', message.reason));
          if (message.externalId) reply.add(new Option(`${author}: ${message.text.slice(0, 60)}`, message.id));
          if (['failed', 'uncertain', 'queued'].includes(delivery)) {
            const actions = el('div', 'rc-message-actions');
            const retry = button(delivery === 'uncertain' ? t('channels.retry_uncertain', 'Retry (may duplicate; check Slack first)') : t('channels.retry', 'Retry delivery'));
            retry.addEventListener('click', () => void act(`${endpoint()}/messages/${message.id}/resolve`, { method: 'POST', json: { retry: true } }));
            const dismiss = button(t('channels.dismiss', 'Dismiss outbound delivery'));
            dismiss.addEventListener('click', () => void act(`${endpoint()}/messages/${message.id}/resolve`, { method: 'POST', json: { retry: false } }));
            actions.append(retry, dismiss);
            article.append(actions);
          }
          thread.append(article);
        }
        if ([...reply.options].some(o => o.value === previousReply)) reply.value = previousReply;
      }
    } finally { inFlight = false; }
  };
  const act = async (url, options) => {
    const version = epoch;
    const result = await request(url, options);
    if (version !== epoch) return false;
    report(result.ok ? '' : requestMessage(result), result.ok ? 'success' : 'error');
    if (result.ok) await refresh();
    return result.ok;
  };
  let nameEdited = false;
  const slug = value => value.toLowerCase().trim().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  title.addEventListener('input', () => {
    if (!nameEdited) name.value = slug(title.value);
  });
  name.addEventListener('input', () => { nameEdited = Boolean(name.value); });
  create.addEventListener('submit', async event => {
    event.preventDefault();
    const id = name.value;
    if (/^[CG][A-Z0-9]+$/.test(id)) {
      report(t('channels.slack_id_mistake', 'That looks like a Slack channel ID. Choose a Ronin ID such as chat-with-ronin; connect Slack after creating it.'), 'error');
      name.focus();
      return;
    }
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id)) {
      report(t('channels.id_invalid', 'Use 1–64 lowercase letters, numbers, hyphens, or underscores for the Ronin channel ID.'), 'error');
      name.focus();
      return;
    }
    createButton.disabled = true;
    const ok = await act('/api/channels', { method: 'POST', json: { id, team, title: title.value } });
    createButton.disabled = false;
    if (ok) {
      current = id; name.value = ''; title.value = ''; nameEdited = false; signature = ''; subscriberSignature = ''; createPanel.open = false;
      await refresh();
    }
  });
  select.addEventListener('change', () => {
    epoch++; current = select.value; channel = null; signature = ''; subscriberSignature = '';
    detail.hidden = true; say.value = ''; pendingPost = null; report();
    void refresh();
  });
  binding.addEventListener('submit', event => {
    event.preventDefault();
    void act(`${endpoint()}/binding`, { method: 'PUT', json: { binding: { provider: 'slack', workspace: slack.workspace, conversation: slackId.value.trim() } } });
  });
  disconnect.addEventListener('click', () => void act(`${endpoint()}/binding`, { method: 'PUT', json: { binding: null } }));
  archive.addEventListener('click', () => void act(`${endpoint()}/archive`, { method: 'PUT', json: { archived: !channel.archived } }));
  subscribe.addEventListener('submit', event => {
    event.preventDefault();
    if (agent.value) void act(`${endpoint()}/subscriptions/${encodeURIComponent(agent.value)}`, { method: 'PUT', json: { write: writable.input.checked, notify: notify.input.checked } });
  });
  agent.addEventListener('change', syncPermissionForm);
  composer.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || send.disabled || !say.value.trim()) return;
    const text = say.value, replyTo = reply.value || undefined;
    const key = JSON.stringify([current, text, replyTo]);
    if (pendingPost?.key !== key) pendingPost = { key, requestId: crypto.randomUUID() };
    sending = true; send.disabled = true;
    const version = epoch;
    const ok = await act(`${endpoint()}/messages`, { method: 'POST', json: { text, replyTo, requestId: pendingPost.requestId } });
    sending = false;
    send.disabled = Boolean(channel?.archived);
    if (version !== epoch) return;
    if (ok && say.value === text) { say.value = ''; pendingPost = null; reply.value = ''; }
  });
  return {
    el: root, mount() {},
    setTeam(next, members = []) {
      const selected = agent.value;
      agent.replaceChildren(...members.map(member => new Option(member, member)));
      if (members.includes(selected)) agent.value = selected;
      syncPermissionForm();
      if (team === next) return;
      epoch++; team = next; current = ''; channel = null; signature = ''; subscriberSignature = '';
      detail.hidden = true; empty.hidden = true; say.value = ''; pendingPost = null; report();
      void refresh();
    },
    enter() { entered = true; void refresh(); clearInterval(timer); timer = setInterval(() => void refresh(), 2000); },
    leave() { entered = false; epoch++; clearInterval(timer); },
    destroy() { entered = false; epoch++; clearInterval(timer); },
  };
}
