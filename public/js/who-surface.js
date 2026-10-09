/* part of the ronin-cowork client — see js/README.md */
/**
 * WHO: YOUR TEAMS — the Teams door of the collections workbench, built to the direction
 * doc (samurai_lab/wip/buildouts/COLLECTIONS_DIRECTION.md, owner 2026-10-04): find work,
 * add work, reassign work; detail, configuration and editing live on a workbench, never here.
 *
 *   Head          the door's name.
 *   Questions     Workspace (any number; none is all) and Under each Team: Boards or Agents.
 *   Stones        Teams, name only.
 *   Bars          boards or Agents under each Team, title only.
 *   Team pressed  the thin open beside the rail: objective, Agents with 人 on the lead, boards
 *                 by name, and one door, Launch, which opens the Team's tab.
 *   Bar pressed   its read opens in a partial overlay hung off the bar (partial-overlay.js;
 *                 owner 2026-10-07, replacing the expand in place), one format:
 *                 an Agent — its role, what it is working on now, the items it holds;
 *                 a board — its objective and its items by title, each a press to its own
 *                 description, status and holder, and one door, Open, which lays that board's
 *                 Trello view over this surface; an item — description, status, holder.
 *   Drag          a board onto another Team; an Agent onto another Team, which moves it there
 *                 (owner, 2026-10-07). The Add new question (Board or Agent) beside Under each
 *                 Team: its stone dragged onto a Team stone opens a partial overlay with that
 *                 form for the Team — owner, 2026-10-08.
 *
 * Reading: the collection push (collection-reading.js), wanted with the chosen workspaces
 * (root=); the browser requests, filters and joins nothing (owner, 2026-10-09: one reading per
 * tenant). `whoRows` (who-rows.js) is the pure mapping.
 */
import { WorkspaceKit } from './workspace-kit.js';
import { createCollectionPhalanx } from './collection-phalanx.js';
import { membersOfTeam, moveTeamMembership, subscribe } from './team-controller.js';
import { subscribe as subscribeStore } from './store.js';
import { carryItem } from './team-drag.js';
import { carried, carries, carry } from './collection-drag.js';
import { itemsHeldBy, whoMove, whoRows } from './who-rows.js';
import { agentTitle, currentWorkStep } from './team-members.js';
import { stanceLabel } from './home.js';
import { holderName } from './work-readings.js';
import { stageLabel } from './team-kanban.js';
import { ask } from './ask.js';
import { request } from './request.js';
import { readingKey, subscribeCollection } from './collection-reading.js';
import { t } from './lexicon.js';
import { openPartialOverlay } from './partial-overlay.js';
import { NEW_BOARD, draftItem, fullOverlay } from './work-details.js';
import { createEmbeddedNewAgentView } from './new-agent.js';

export const WHO_TYPE = 'collection.who';
const el = (tag, cls = '', text = '') => { const out = document.createElement(tag); if (cls) out.className = cls; if (text) out.textContent = text; return out; };

/** `openTeam(name)` opens the Team's tab; `openBoard(board, host)` lays that board's Trello view over `host` (board-overlay.js). */
export function createWhoSurface({ openTeam = () => {}, openBoard = () => {} } = {}) {
  const { createSurface, createAction } = WorkspaceKit.primitives;
  const surface = createSurface({ label: t('collection.who', 'Who: Your Teams'), className: 'who-surface' });

  // The two questions: the workspaces (any number; none is all), and what stacks under each Team.
  let chosen = [];
  let under = 'boards';
  const filter = ask([{ fields: [
    { key: 'root', label: t('collection.workspace', 'Workspace'), blank: t('collection.all', 'All'), many: true, options: [] },
    { key: 'under', label: t('collection.under_each_team', 'Under each Team'), options: [
      { v: 'boards', l: t('collection.under_boards', 'Boards') }, { v: 'agents', l: t('collection.under_agents', 'Agents') },
    ] },
    // Add new: Board or Agent (owner, 2026-10-08); the stone drags onto a Team stone and that
    // one's form opens there. What it adds is its own answer, never Under each Team's.
    { key: 'add', label: t('collection.add_new', 'Drag new onto a Team'), options: [
      { v: 'board', l: t('collection.add_board', 'Board') }, { v: 'agent', l: t('collection.add_agent', 'Agent') },
    ] },
  ] }], { value: { root: [], under, add: 'board' }, density: 'tight', onChange: ({ root: nextRoots, under: nextUnder, add: nextAdd }) => {
    const next = (nextRoots || []).map(String);
    const rootsMoved = next.join('\n') !== chosen.join('\n');
    chosen = next; under = nextUnder === 'agents' ? 'agents' : 'boards'; adding = nextAdd === 'agent' ? 'agent' : 'board';
    if (rootsMoved) listen(); else if (last) paint(last);
  } });
  let adding = 'board';

  // THE ADD STONE drags (owner, 2026-10-08): the Add new question's own stone, made draggable
  // as the pointer lands on it (the ask repaints its stones, so the mark is put on at the
  // press), carries what to add; dropped on a Team stone it opens that one's form there.
  const addStone = (node) => node?.closest?.('[data-ask-key="add"]');
  filter.el.addEventListener('pointerdown', (event) => { const stone = addStone(event.target); if (stone) stone.draggable = true; });
  filter.el.addEventListener('dragstart', (event) => { if (addStone(event.target)) carry(event.dataTransfer, { kind: 'add', what: adding }, 'copy'); });
  // Agent (owner, 2026-10-08): the existing New Agent form, Team answered, in a FULL OVERLAY
  // over Who; Launch creates the Agent and the overlay closes; nothing opens, the Agent appears
  // under its Team by the push. Board: the draft form in a partial overlay over the Team.
  const newAgentOver = (team) => {
    let layer = null;
    const view = createEmbeddedNewAgentView(WorkspaceKit, { team: () => team.id, connect: async () => {}, consumed: () => { layer?.remove(); view.destroy?.(); } });
    layer = fullOverlay(surface.content, (host, through) => {
      const head = el('div', 'league-team-detail-head');
      const tools = el('div', 'wk-surface-header-actions'); tools.append(...through);
      head.append(el('h2', '', t('collection.new_agent_for', 'New Agent for {team}', { team: String(team.label || team.id) })), tools);
      host.append(head, view.el);
      void view.enter({ team: team.id });
    }, { closed: () => view.destroy?.() });
  };
  const addTo = (team, anchor, what) => {
    const name = String(team.label || team.id);
    if (what === 'agent') { newAgentOver(team); return; }
    openPartialOverlay(surface.content, { anchor,
      title: t('collection.add_board_to', 'New board for {team}', { team: name }),
      draw: (body, { lift }) => {
        draftItem(body, { heading: '', parent: NEW_BOARD, team: team.id, boards: last?.boards || [], save: async (fields) => {
          const made = await request('/api/work-items', { method: 'POST', json: fields });
          if (!made.ok) return made.message;
          lift(); return '';
        } });
      } });
  };

  let rows = new Map(); // session name -> the store's home row (stance, work record)
  const nowOf = (name) => { const row = rows.get(name) || {}; const step = currentWorkStep(row.tegami); return [step.text, stanceLabel(row.stance)].filter(Boolean).join(' · '); };
  // `now` is read when a bar is pressed, never carried in the rows: a status tick must not repaint the stones.
  const members = (name) => membersOfTeam(name).map((member) => ({ name: member.name, title: agentTitle(member), lead: Boolean(member.team_lead) }));

  /* ---------- the thin open: a Team pressed ----------
   * Name with Launch beside it, the objective, then its Agents and its boards as the same
   * bars the stacks use: each a press to its read in place, the one format everywhere. */
  const bar = (row) => {
    const button = el('button', `sws-stone ${row.className || ''}`.trim()); button.type = 'button';
    button.dataset.cphDepth = '1'; button.dataset.swsId = String(row.id);
    button.append(el('b', 'sws-label', row.label));
    button.addEventListener('click', () => press(row, button));
    return button;
  };
  const list = (title, rows) => {
    const box = el('div', 'who-open-list');
    box.append(el('b', 'who-open-label', title));
    if (!rows.length) box.append(el('span', 'who-open-none', t('collection.none', 'None')));
    for (const row of rows) box.append(bar(row));
    return box;
  };
  const renderDetail = (item, host) => {
    if (item.kind !== 'team') return;
    const box = el('div', 'who-open');
    const head = el('div', 'who-open-head');
    const launch = createAction({ label: '', launch: true, size: 'compact', title: t('league.launch_team', 'Launch'), action: () => openTeam(item.id) });
    launch.el.setAttribute('aria-label', launch.el.title);
    head.append(el('h2', '', item.label), launch.el);
    box.append(head);
    if (item.team.objective) box.append(el('p', 'who-open-objective', item.team.objective));
    const teams = last?.teams || [];
    const boards = (last?.boards || []).filter((board) => board.teams.includes(item.id));
    const rowsFor = whoRows({ teams: teams.filter((team) => team.name === item.id), boards }, { under: 'agents', membersOf: members })[0]?.items || [];
    const boardRows = whoRows({ teams: teams.filter((team) => team.name === item.id), boards }, { under: 'boards', membersOf: members })[0]?.items || [];
    box.append(list(t('league.agents', 'Agents'), rowsFor), list(t('collection.boards', 'Boards'), boardRows));
    host.append(box);
  };

  /* ---------- a bar pressed: its read in a partial overlay hung off the bar ----------
   * Owner, 2026-10-07: this replaced the expand in place. One format for Agent, board and
   * item; a board's Open sits inside it. The bar reads pressed while its window is up. */
  const read1 = (host, lines) => { for (const [label, text] of lines) { if (!text) continue; const line = el('div', 'cph-read-line'); line.append(el('b', '', label), document.createTextNode(text)); host.append(line); } };
  const press = (item, bar) => {
    bar.setAttribute('aria-pressed', 'true');
    openPartialOverlay(surface.content, { anchor: bar, title: item.label, draw: (body, { lift }) => readOf(item, body, lift), onClose: () => bar.setAttribute('aria-pressed', 'false') });
  };
  const readOf = (item, host, lift = () => {}) => {
    if (item.kind === 'agent') {
      const member = { ...(members(item.team).find((row) => row.name === item.agent.name) || item.agent), now: nowOf(item.agent.name) };
      const held = itemsHeldBy(last?.boards?.filter((board) => board.teams.includes(item.team)) || [], member.name);
      read1(host, [
        [t('collection.role', 'Role'), member.lead ? t('league.team_lead', 'Team Lead') : t('league.agent', 'Agent')],
        [t('collection.now', 'Now'), member.now || t('collection.idle', 'nothing recorded')],
        [t('collection.holds', 'Holds'), held.map((row) => row.title).join(' · ') || t('collection.none', 'None')],
      ]);
      return;
    }
    if (item.kind === 'board') {
      read1(host, [[t('collection.objective', 'Objective'), item.board.objective || t('collection.none', 'None')]]);
      const items = item.board.stages.flatMap((stage) => stage.items);
      const titles = el('div', 'cph-read-items');
      for (const row of items) {
        const line = el('button', 'cph-read-item'); line.type = 'button'; line.textContent = row.title;
        line.draggable = true; line.addEventListener('dragstart', (event) => carryItem(event.dataTransfer, row)); // onto a tile: the item's reference
        line.setAttribute('aria-expanded', 'false');
        const more = el('div', 'cph-read-more'); more.hidden = true;
        read1(more, [[t('collection.description', 'Description'), row.objective || t('collection.none', 'None')], [t('collection.status', 'Status'), stageLabel(row.stage)], [t('collection.holder', 'Holder'), holderName(row.holder) || t('collection.nobody', 'nobody')]]);
        line.addEventListener('click', () => { more.hidden = !more.hidden; line.setAttribute('aria-expanded', String(!more.hidden)); });
        titles.append(line, more);
      }
      if (!items.length) titles.append(el('span', 'who-open-none', t('collection.board_empty', 'Nothing under this board yet.')));
      host.append(titles);
      const open = createAction({ label: t('collection.open', 'Open'), size: 'compact', action: () => { lift(); openBoard(item.board, surface.content); } });
      host.append(open.el);
      return;
    }
    if (item.kind === 'item') {
      read1(host, [[t('collection.description', 'Description'), item.item.objective || t('collection.none', 'None')], [t('collection.status', 'Status'), stageLabel(item.item.stage)], [t('collection.holder', 'Holder'), holderName(item.item.holder) || t('collection.nobody', 'nobody')]]);
    }
  };
  const phalanx = createCollectionPhalanx({ className: 'who-phalanx', items: [], renderDetail, press });
  phalanx.mount(surface.content, { before: [filter.el] });

  /* ---------- the drops on a Team stone: a board (from Who's bars or What's stones, the one payload,
   * collection-drag.js), an Agent, or the Add block; whoMove says what each means ---------- */
  const wire = (teams) => teams.map((team) => ({
    ...team,
    events: {
      dragover: (event) => { if (!carries(event)) return; event.preventDefault(); event.currentTarget.classList.add('cph-over'); },
      dragleave: (event) => event.currentTarget.classList.remove('cph-over'),
      drop: async (event) => {
        event.preventDefault(); event.stopPropagation(); event.currentTarget.classList.remove('cph-over');
        const moved = carried(event);
        const move = whoMove(moved, team);
        if (move === 'add') { addTo(team, event.currentTarget, moved.what); return; }
        if (!move) return;
        // One write each: a board is assigned; an Agent leaves the Team it was under and joins this one.
        const result = move === 'join'
          ? await moveTeamMembership(moved.id, moved.team, team.id)
          : await request(`/api/work-items/${encodeURIComponent(moved.id)}/assign`, { method: 'POST', json: { team: team.id } });
        if (!result.ok) surface.setState('failed', result.message || '');
      },
    },
    items: (team.items || []).map((row) => row.kind === 'board' ? {
      ...row, draggable: true,
      events: { dragstart: (event) => { carry(event.dataTransfer, { kind: 'board', id: row.id, team: team.id }); carryItem(event.dataTransfer, { id: row.id, title: row.label }); } },
    } : row.kind === 'agent' ? {
      // An Agent bar drags onto another Team stone and moves there (owner, 2026-10-07).
      ...row, draggable: true,
      events: { dragstart: (event) => carry(event.dataTransfer, { kind: 'agent', id: row.agent.name, team: team.id }) },
    } : row),
  }));

  /* ---------- the reading: the collection push, wanted with the chosen workspaces ---------- */
  let shown = '';
  let last = null; // the reading last painted
  let roots = null; // every folder, from the first unfiltered reading, so a filter keeps offering them all
  const paint = (data) => {
    last = data;
    const next = whoRows(data, { under, membersOf: members });
    const signature = JSON.stringify(next);
    if (signature === shown) return;
    shown = signature;
    phalanx.setItems(wire(next));
    filter.options('root', (data.roots || []).map((row) => ({ v: row.name, l: row.name })));
  };
  let stop = null;
  let heard = ''; // the key subscribed to, so a changed answer resubscribes and the same one does not
  let entered = false;
  const listen = () => {
    if (!entered) return;
    const wanted = { root: chosen };
    const key = readingKey('collection', wanted);
    if (stop && key === heard) return;
    stop?.();
    heard = key;
    stop = subscribeCollection(wanted, (reading) => {
      surface.setState();
      const data = reading || {};
      if (!chosen.length || !roots) roots = data.roots || [];
      paint({ ...data, roots });
    });
  };
  const quiet = () => { stop?.(); stop = null; heard = ''; };
  // A roster change repaints the rows from the reading last pushed (the members under each Team).
  const stopTeams = subscribe(() => { if (entered && last) { shown = ''; paint(last); } });
  const stopRows = subscribeStore('home', (list) => { rows = new Map((list || []).map((row) => [row.name, row])); });
  return {
    el: surface.el,
    show: () => { entered = true; listen(); },
    leave: () => { entered = false; quiet(); },
    destroy: () => { entered = false; quiet(); stopTeams?.(); stopRows?.(); filter.destroy?.(); phalanx.destroy(); },
  };
}
