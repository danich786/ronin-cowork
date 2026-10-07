/* part of the ronin-cowork client — see js/README.md */
/**
 * THE TEAM COMMONS as one surface: Roster, Docs, Wipeboard, Messages, Cron jobs and
 * Configuration behind a tab strip, painting itself from the store. Lifted as a copy from
 * cowork-view.js for the Team tenant on the tenant frame (team-view.js); cowork-view.js
 * keeps its own until it goes. Configuration is not a tab here: it is an item on this
 * surface's メ opening the full overlay (team-view.js, configuration-overlay.js; owner,
 * 2026-10-07). The next row is tabs → rows.
 */
import { WorkspaceKit } from './workspace-kit.js';
import { membersOfTeam, subscribe as subscribeTeams, teamByName } from './team-controller.js';
import { store } from './store.js';
import { createTeamWipeboard } from './team-wipeboard.js';
import { createTeamJikan } from './team-jikan.js';
import { buildMessageQueue } from './message-queue.js';
import { buildDocs } from './docs.js';
import { buildTeamMembers, configSignature, currentWorkStep } from './team-members.js';
import { stanceLabel } from './home.js';
import { t } from './lexicon.js';

const el = (tag, cls, text) => {
  const out = document.createElement(tag);
  if (cls) out.className = cls;
  if (text != null) out.textContent = String(text);
  return out;
};

/** A member's readings off its home row: the work step, the stance, the gauge, the model. */
export function readingsOf(row = {}) {
  const current = currentWorkStep(row.tegami);
  const ctx = row.ctx != null ? `⛽ ${row.ctx}%` : '';
  return {
    step: current.label,
    description: current.text,
    model: (row.model || '').toLowerCase(),
    status: stanceLabel(row.stance),
    ctx,
    lines: [current.text, stanceLabel(row.stance), ctx, (row.model || '').toLowerCase()].filter(Boolean),
  };
}

/**
 * `team()` names the Team; `context()` the view context the tab strip mounts with. The
 * roster rows call back `onSelect` (the composition reader), `onOpen` (the Agent's
 * workbench), `onAddLead` (New Agent as lead) and `onClose` (retire).
 */
export function createTeamCommonsSurface({ team, context, idPrefix = 'workspace1', onSelect = () => {}, onOpen = () => {}, onAddLead = () => {}, onClose = () => {} }) {
  const { createTabbedSurface } = WorkspaceKit.primitives;
  let channels = null;
  const wipeboard = createTeamWipeboard();
  const jikan = createTeamJikan({
    onCount: ({ scheduled, paused }) => channels?.setBadge('cron-jobs', `${scheduled} / ${paused}`,
      t('workspace.tab_cron_count', '{scheduled} scheduled, {paused} paused', { scheduled, paused })),
  });
  const docsPane = el('div', 'home-docs tw-docs');
  const docs = buildDocs(docsPane, (name) => membersOfTeam(team()).some((m) => m.name === name), () => teamByName(team())?.repos || []);
  const docsService = { el: docsPane, mount: () => {}, enter: () => { docs.enter(); }, leave: () => { docs.close(); }, destroy: () => { docs.close(); } };
  const roster = el('div', 'tw-config tw-roster');
  const messages = el('div', 'tw-messages');
  const service = (node) => ({ el: node, mount: () => {}, enter: () => {}, leave: () => {}, destroy: () => {} });
  // THE COUNT IS THE SIGNAL: what is waiting is a number; attention colours the tab.
  let retainedCount = 0;
  let chooseQueueOnOpen = false;
  const paintMessageAttention = () => {
    if (!channels) return;
    channels.setBadge('agent-message-queue', retainedCount || '',
      retainedCount ? t('workspace.tab_messages_waiting', '{count} waiting to enter a live session', { count: retainedCount }) : '');
    channels.setAttention('agent-message-queue', retainedCount > 0);
    if (chooseQueueOnOpen) {
      if (retainedCount > 0) channels.select('agent-message-queue');
      chooseQueueOnOpen = false;
    }
  };
  const messageQueue = buildMessageQueue(messages, (count) => { retainedCount = count; paintMessageAttention(); });
  channels = createTabbedSurface({
    label: t('team.commons', 'Commons'),
    tabs: [
      { id: 'roster', label: t('workspace.tab_roster', 'Roster'), panel: service(roster) },
      { id: 'docs', label: t('workspace.tab_docs', 'Docs'), panel: docsService },
      { id: 'wipeboard', label: t('workspace.tab_wipeboard', 'Wipeboard'), panel: wipeboard },
      // The queue listens while the Commons is on screen, not only while its own tab is.
      { id: 'agent-message-queue', label: t('workspace.tab_agent_message_queue', 'Messages'), panel: messages, watch: () => { messageQueue.enter(); return messageQueue.leave; } },
      { id: 'cron-jobs', label: t('workspace.tab_cron_jobs', 'Cron jobs'), panel: jikan },
    ],
    selected: 'roster',
    onSelect: () => { chooseQueueOnOpen = false; },
  });
  paintMessageAttention();

  /* ---------- painting from the store ---------- */
  let rows = new Map(); // name -> the store's home row
  let entered = false;
  let mounted = false;
  let seenConfig = '';
  const readings = (member) => readingsOf(rows.get(member.name));
  // THE ROSTER IS DRAWN ONLY WHEN IT MOVED: the member rows follow the pushed readings.
  const renderRoster = () => {
    const name = team();
    const members = membersOfTeam(name);
    const signature = configSignature(name) + JSON.stringify(members.map((member) => readings(member).lines));
    if (signature === seenConfig) return;
    seenConfig = signature;
    const changed = () => { channels.setState(); paint(); };
    roster.replaceChildren(buildTeamMembers(name, {
      onChanged: changed,
      onFailed: (message) => channels.setState('failed', message),
      idPrefix, reading: readings, onSelect, onOpen, onAddLead, onClose,
    }));
  };
  const paint = () => {
    const name = team();
    if (!name) return;
    const record = teamByName(name);
    // THE BOARD IS ASSUMED: the roster's wipeboard id, or the Team's own name.
    wipeboard.setBoard((record.durable && record.wipeboard) || name);
    jikan.setTeam(name, membersOfTeam(name).map((m) => m.name));
    renderRoster();
  };
  const stopRows = store.subscribe('home', (list) => { rows = new Map((list || []).map((row) => [row.name, row])); if (entered) paint(); });
  const stopTeams = subscribeTeams(() => { if (entered) paint(); });

  return {
    el: channels.el,
    show: (detail = {}) => {
      const ctx = context?.();
      if (!mounted && ctx) { channels.mount(ctx); mounted = true; }
      entered = true;
      seenConfig = ''; // a fresh entry always paints the roster once
      if (!detail.doc && !detail.tab) { chooseQueueOnOpen = true; if (retainedCount > 0) paintMessageAttention(); }
      channels.enter(ctx);
      paint();
      if (detail.doc) { channels.select('docs'); void docs.open(detail.doc); } else if (detail.tab) channels.select(detail.tab);
    },
    leave: () => { entered = false; channels.leave(); },
    destroy: () => { entered = false; stopRows(); stopTeams(); channels.destroy(); },
  };
}
