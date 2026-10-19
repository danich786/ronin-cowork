/* part of the ronin-cowork client — see js/README.md */
/**
 * THE TEAMS WORKBENCH'S TWO SURFACES (owner, 2026-10-19; PATTERNS.md Home and Team rows).
 * Home's Teams door opens the Teams workbench in the same tab; its WS1 is `createTeamsSurface`:
 * Phalanx A/B stones of Teams, name only, under two questions (ask.js) — Workspace, many-of,
 * blank All, narrows the stones to the Teams in those workspace folders; Show, many-of, Theme
 * on by default, says what each stone carries under its name: Theme, the roster objective;
 * State, the status of the Team's board (no board, nothing); Agents; Items. A stone pressed
 * calls `onOpen(name)`; the destination places the Team's read in WS2, `createTeamReadSurface`:
 * Theme, State, Agents, with Launch in its header. The 人 mark in the stone's corner, and
 * Launch, open the Team page in a new tab.
 *
 * Reading: the teams push, each roster row carrying its board and items (teams-api.ts),
 * through the Team projection (team-controller.js) with the sessions push for Agents. The
 * browser requests nothing; a write shows itself when the rosters are pushed again.
 * teams-surface-rows.js is the pure mapping. Both surfaces keep the ordinary contract
 * ({ el, show, destroy }); destroy lifts the subscription.
 */
import { WorkspaceKit } from './workspace-kit.js';
import { el } from './form-steps.js';
import { createPhalanx } from './phalanx.js';
import { ask } from './ask.js';
import { membersOfTeam, subscribe, teamsFromState } from './team-controller.js';
import { openWorkspaceTab } from './workspace.js';
import { teamsRows, workspaces } from './teams-surface-rows.js';
import { t } from './lexicon.js';

const SHOW = ['theme', 'state', 'agents', 'items'];
const launch = (team) => openWorkspaceTab('team', team);
const rosters = () => teamsFromState().filter((team) => team.durable);
const words = () => ({ theme: t('teams_surface.theme', 'Theme'), state: t('teams_surface.state', 'State'), agents: t('league.agents', 'Agents'), items: t('teams_surface.items', 'Items') });
const rowOf = (id) => teamsRows(rosters(), membersOfTeam).find((entry) => entry.id === id);

/** WS1: the stones of Teams under the Workspace and Show questions. A stone pressed calls `onOpen(name)`. */
export function createTeamsSurface({ onOpen = () => {} } = {}) {
  const { createSurface, ninMark } = WorkspaceKit.primitives;
  const word = words();
  let roots = []; // the workspaces chosen
  let show = ['theme']; // what Show picks

  const mark = (team) => {
    const node = ninMark('wk-launch-mark teams-launch');
    node.removeAttribute('aria-hidden');
    node.setAttribute('role', 'link');
    node.setAttribute('aria-label', t('teams_surface.launch', 'Launch'));
    node.addEventListener('click', (event) => { event.stopPropagation(); launch(team); });
    return node;
  };
  const joined = (value) => Array.isArray(value) ? value.join(', ') : value;
  // Under the name: Theme in the stone's second line; State, Agents and Items in its state
  // line, each as "Word: value", a blank value left out (no board: no State).
  const underLine = (row) => SHOW.slice(1).filter((key) => show.includes(key))
    .map((key) => [word[key], joined(row[key])]).filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`).join(' · ');

  const surface = createSurface({ label: t('campaign.coworks', 'Teams'), className: 'teams-surface' });
  const filter = ask([{ fields: [
    { key: 'root', label: t('teams_surface.workspace', 'Workspace'), blank: t('teams_surface.all', 'All'), many: true, options: [] },
    { key: 'show', label: t('teams_surface.show', 'Show'), many: true, options: SHOW.map((key) => ({ v: key, l: word[key] })) },
  ] }], { value: { root: roots, show }, density: 'tight', onChange: ({ root: nextRoots, show: nextShow }) => {
    roots = (nextRoots || []).map(String);
    show = (nextShow || []).map(String);
    paint();
  } });
  const stones = createPhalanx({ className: 'teams-stones' });
  stones.mount(surface.content, { before: [filter.el] });

  /* ---------- the reading: the Team projection, painted on every publish ---------- */
  const paint = () => {
    filter.options('root', workspaces(rosters()).map((name) => ({ v: name, l: name })));
    stones.setItems(teamsRows(rosters(), membersOfTeam, { roots }).map((row) => ({
      id: row.id,
      label: row.label,
      marker: mark(row.id),
      secondary: show.includes('theme') ? row.theme : '',
      state: underLine(row),
      action: () => onOpen(row.id),
    })));
  };
  const stop = subscribe(paint);
  return { el: surface.el, show: paint, destroy: () => { stop(); filter.destroy(); stones.destroy(); } };
}

/** WS2: the Team's read — Theme, State, Agents — with Launch in its header. */
export function createTeamReadSurface(name) {
  const { createSurface, createAction } = WorkspaceKit.primitives;
  const word = words();
  const launchAct = createAction({ label: t('teams_surface.launch', 'Launch'), size: 'compact', action: () => launch(name) });
  const surface = createSurface({ label: rowOf(name)?.label || name, className: 'teams-read', actions: [launchAct] });
  const lines = el('div', 'teams-read-lines');
  surface.content.append(lines);
  const paint = () => {
    const row = rowOf(name);
    if (!row) return;
    surface.header.title.textContent = row.label;
    lines.replaceChildren(...[[word.theme, row.theme], [word.state, row.state], [word.agents, row.agents.join(', ')]].map(([label, text]) => {
      const line = el('div', 'teams-read-line');
      line.append(el('b', '', label), document.createTextNode(text));
      return line;
    }));
  };
  const stop = subscribe(paint);
  return { el: surface.el, show: paint, destroy: stop };
}
