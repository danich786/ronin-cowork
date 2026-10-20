/* The Cowork workbench's one reading of every Team: a Phalanx stone per Team. */
import { membersOfTeam, subscribe, teamsFromState, UNASSIGNED } from './team-controller.js';
import { WorkspaceKit } from './workspace-kit.js';
import { t } from './lexicon.js';
import { createPhalanx } from './phalanx.js';
import { ask } from './ask.js';
import { orderCoworkTeams } from './cowork-workbench-contract.js';
import { RONIN_HELPERS } from './roster-groups.js';
import { SURFACE_DRAG } from './workbench.js';
import { WORKBENCH_TYPES } from './workbench-catalog.js';
import { openWorkspaceTab } from './workspace.js';
import { teamsRows, workspaces } from './teams-surface-rows.js';

const SHOW = ['theme', 'state', 'agents', 'items'];
const words = () => ({ theme: t('teams_surface.theme', 'Theme'), state: t('teams_surface.state', 'State'), agents: t('league.agents', 'Agents'), items: t('teams_surface.items', 'Items') });

/**
 * A stone per Team under two questions (owner, 2026-10-20; ask.js): Workspace, many-of, blank
 * All, narrows the stones to the Teams in those workspace folders; Show, many-of, Theme on by
 * default, says what each stone carries under its name — Theme, the roster objective, in its
 * second line; State, the status of the Team's board (no board, nothing), Agents and Items in
 * its state line, each "Word: value". The rows are teams-surface-rows.js over the pushed
 * rosters (each with its `board` and `items`, teams-api.ts) and the Team projection's members.
 * The 人 mark in a stone's corner opens the Team page in a new tab. The stone's detail is the
 * Team profile the card opened (`teamDetail`, the cowork view's one renderer); dragged, the
 * stone places that profile in another workspace.
 */
export function createTeamRosterSurface({ teamDetail } = {}) {
  const { createSurface, ninMark } = WorkspaceKit.primitives;
  const label = t('campaign.coworks', 'Teams');
  const word = words();
  let roots = []; // the workspaces chosen
  let show = ['theme']; // what Show picks
  const surface = createSurface({ label, className: 'team-roster-surface' });
  const filter = ask([{ fields: [
    { key: 'root', label: t('teams_surface.workspace', 'Workspace'), blank: t('teams_surface.all', 'All'), many: true, options: [] },
    { key: 'show', label: t('teams_surface.show', 'Show'), many: true, options: SHOW.map((key) => ({ v: key, l: word[key] })) },
  ] }], { value: { root: roots, show }, density: 'tight', onChange: ({ root: nextRoots, show: nextShow }) => {
    roots = (nextRoots || []).map(String);
    show = (nextShow || []).map(String);
    paint();
  } });
  const mark = (team) => {
    const node = ninMark('wk-launch-mark teams-launch');
    node.removeAttribute('aria-hidden');
    node.setAttribute('role', 'link');
    node.setAttribute('aria-label', t('teams_surface.launch', 'Launch'));
    node.addEventListener('click', (event) => { event.stopPropagation(); openWorkspaceTab('team', team); });
    return node;
  };
  const joined = (value) => Array.isArray(value) ? value.join(', ') : value;
  const underLine = (row) => SHOW.slice(1).filter((key) => show.includes(key))
    .map((key) => [word[key], joined(row[key])]).filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`).join(' · ');
  const items = () => {
    const rows = new Map(teamsRows(teamsFromState(), membersOfTeam, { roots }).map((row) => [row.id, row]));
    return orderCoworkTeams(teamsFromState(), {
      helperName: RONIN_HELPERS,
      noTeam: { name: UNASSIGNED, title: t('league.ronin', 'Ronin: no team'), objective: '' },
    }).filter((team) => rows.has(team.name)).map((team) => {
      const row = rows.get(team.name);
      const name = String(team.title ?? '').trim() || team.name;
      return {
        id: team.name, label: name, marker: mark(team.name),
        secondary: show.includes('theme') ? row.theme : '',
        state: underLine(row),
        draggable: true,
        events: { dragstart: (event) => {
          event.dataTransfer.setData(SURFACE_DRAG, JSON.stringify({ type: WORKBENCH_TYPES.team, detail: { key: team.name } }));
          event.dataTransfer.setData('text/plain', name);
          event.dataTransfer.effectAllowed = 'copy';
        } },
      };
    });
  };
  const renderDetail = (item, host) => {
    const view = teamDetail?.(item.id);
    if (view) host.append(view.el);
  };
  const stones = createPhalanx({ className: 'team-roster-phalanx', items: [], renderDetail });
  stones.mount(surface.content, { before: [filter.el] });
  // A push that moves nothing a stone shows leaves the grid and an open detail alone, so
  // an edit in progress in the Team's configuration keeps its focus.
  let shown = null;
  const paint = () => {
    filter.options('root', workspaces(teamsFromState()).map((root) => ({ v: root, l: root })));
    const next = items();
    const signature = JSON.stringify(next.map(({ id, label: name, secondary, state }) => [id, name, secondary, state]));
    if (signature !== shown) { shown = signature; stones.setItems(next); }
  };
  const stop = subscribe(paint);
  return {
    el: surface.el,
    render: paint,
    destroy: () => { stop?.(); filter.destroy(); stones.destroy(); },
  };
}
