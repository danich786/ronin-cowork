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
 * A stone per Team, the name only, under two questions (owner, 2026-10-20; ask.js): Workspace,
 * many-of, blank All, narrows the stones to the Teams in those workspace folders; Show, many-of,
 * Theme on by default, says what hangs under each stone as the phalanx's own branch rows
 * (phalanx.js, `branches: 'column'`): Theme, the roster objective, one row; State, the status of
 * the Team's board (no board, no row), one row; each Agent a row, the lead first; each Item a
 * row. The rows are teams-surface-rows.js over the pushed rosters (each with its `board` and
 * `items`, teams-api.ts) and the Team projection's members. The 人 mark in a stone's corner
 * opens the Team page in a new tab. The stone's detail is the Team profile the card opened
 * (`teamDetail`, the cowork view's one renderer), the level's detail when the stone is pressed
 * and a branch row's; dragged, the stone places that profile in another workspace.
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
  // What Show picks, as the branch rows under the stone: one per value, its kind in the state line.
  // Nothing picked: no rows carry items and the stones rest in the ordinary grid, a press selecting.
  const branch = (team, kind, value, n = 0) => ({ id: `${team}:${kind}:${n}`, label: value, state: word[kind], team });
  const under = (row) => [
    ...(show.includes('theme') && row.theme ? [branch(row.id, 'theme', row.theme)] : []),
    ...(show.includes('state') && row.state ? [branch(row.id, 'state', row.state)] : []),
    ...(show.includes('agents') ? row.agents.map((name, n) => branch(row.id, 'agents', name, n)) : []),
    ...(show.includes('items') ? row.items.map((title, n) => branch(row.id, 'items', title, n)) : []),
  ];
  const items = () => {
    const rows = new Map(teamsRows(teamsFromState(), membersOfTeam, { roots }).map((row) => [row.id, row]));
    return orderCoworkTeams(teamsFromState(), {
      helperName: RONIN_HELPERS,
      noTeam: { name: UNASSIGNED, title: t('league.ronin', 'Ronin: no team'), objective: '' },
    }).filter((team) => rows.has(team.name)).map((team) => {
      const name = String(team.title ?? '').trim() || team.name;
      return {
        id: team.name, label: name, marker: mark(team.name), ...(show.length ? { items: under(rows.get(team.name)) } : {}),
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
    const view = teamDetail?.(item.team || item.id);
    if (view) host.append(view.el);
  };
  const stones = createPhalanx({ className: 'team-roster-phalanx', items: [], renderDetail, branches: 'column' });
  stones.mount(surface.content, { before: [filter.el] });
  // A push that moves nothing a stone shows leaves the grid and an open detail alone, so
  // an edit in progress in the Team's configuration keeps its focus.
  let shown = null;
  const paint = () => {
    filter.options('root', workspaces(teamsFromState()).map((root) => ({ v: root, l: root })));
    const next = items();
    const signature = JSON.stringify(next.map(({ id, label: name, items: under }) => [id, name, under]));
    if (signature !== shown) { shown = signature; stones.setItems(next); }
  };
  const stop = subscribe(paint);
  return {
    el: surface.el,
    render: paint,
    destroy: () => { stop?.(); filter.destroy(); stones.destroy(); },
  };
}
