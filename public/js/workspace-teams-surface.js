/* part of the ronin-cowork client — see js/README.md */
/**
 * THE TEAMS AND BOARDS IN A WORKSPACE FOLDER — the Workspace tenant's WS1 (samurai_lab
 * PATTERNS.md, Workspace folder: "Workspace tenant: Teams and boards in it", Phalanx C/D).
 *
 *   Stones        the Teams whose folders include this one, name only.
 *   Bars          each Team's boards, title only (who-rows.js, the same mapping as Who).
 *   Team pressed  the thin open: name, objective, and one door, Launch.
 *   Bar pressed   the fork's expand: a board's objective and its items by title; an item's
 *                 description, status and holder.
 *
 * Reading: the collection push for `root=<folder>` (collection-reading.js); the browser
 * filters and joins nothing.
 */
import { WorkspaceKit } from './workspace-kit.js';
import { createCollectionPhalanx } from './collection-phalanx.js';
import { readingKey, subscribeCollection } from './collection-reading.js';
import { whoRows } from './who-rows.js';
import { holderName } from './work-readings.js';
import { stageLabel } from './team-kanban.js';
import { t } from './lexicon.js';

export const WORKSPACE_TEAMS_TYPE = 'workspace.teams';
const el = (tag, cls = '', text = '') => { const out = document.createElement(tag); if (cls) out.className = cls; if (text) out.textContent = text; return out; };

/** `folder()` is read at each show, so one surface follows its tenant's param; `openTeam(name)` launches the Team's tab. */
export function createWorkspaceTeamsSurface({ folder, openTeam = () => {} }) {
  const { createSurface, createAction } = WorkspaceKit.primitives;
  const surface = createSurface({ label: t('workspace.teams', 'Teams and boards'), className: 'who-surface' });

  const renderDetail = (item, host) => {
    if (item.kind !== 'team') return;
    const box = el('div', 'who-open');
    const head = el('div', 'who-open-head');
    const launch = createAction({ label: '', launch: true, size: 'compact', title: t('league.launch_team', 'Launch'), action: () => openTeam(item.id) });
    launch.el.setAttribute('aria-label', launch.el.title);
    head.append(el('h2', '', item.label), launch.el);
    box.append(head);
    if (item.team.objective) box.append(el('p', 'who-open-objective', item.team.objective));
    host.append(box);
  };
  const lines = (host, rows) => { for (const [label, text] of rows) { const line = el('div', 'cph-expand-line'); line.append(el('b', '', label), document.createTextNode(text)); host.append(line); } };
  const itemRead = (row) => [
    [t('collection.description', 'Description'), row.objective || t('collection.none', 'None')],
    [t('collection.status', 'Status'), stageLabel(row.stage)],
    [t('collection.holder', 'Holder'), holderName(row.holder) || t('collection.nobody', 'nobody')],
  ];
  const expand = (item, host) => {
    if (item.kind === 'item') { lines(host, itemRead(item.item)); return; }
    if (item.kind !== 'board') return;
    lines(host, [[t('collection.objective', 'Objective'), item.board.objective || t('collection.none', 'None')]]);
    const titles = el('div', 'cph-expand-items');
    for (const row of item.board.stages.flatMap((stage) => stage.items)) titles.append(el('span', 'cph-expand-item', row.title));
    if (!titles.childElementCount) titles.append(el('span', 'who-open-none', t('collection.board_empty', 'Nothing under this board yet.')));
    host.append(titles);
  };
  const phalanx = createCollectionPhalanx({ className: 'who-phalanx', items: [], renderDetail, expand });
  phalanx.mount(surface.content);

  let shown = '';
  const paint = (reading) => {
    const next = whoRows(reading || {}, { under: 'boards' });
    const signature = JSON.stringify(next);
    if (signature === shown) return;
    shown = signature;
    phalanx.setItems(next);
    surface.setState(next.length ? null : 'empty', next.length ? '' : t('workspace.no_teams', 'No Team works in this folder.'));
  };
  let stop = null;
  let heard = ''; // the key subscribed to: a changed folder resubscribes, the same one does not
  const listen = () => {
    const wanted = { root: [folder()] };
    const key = readingKey('collection', wanted);
    if (stop && key === heard) return;
    stop?.();
    heard = key; shown = '';
    stop = subscribeCollection(wanted, paint);
  };
  const quiet = () => { stop?.(); stop = null; heard = ''; };
  return {
    el: surface.el,
    show: listen,
    leave: quiet,
    destroy: () => { quiet(); phalanx.destroy(); },
  };
}
