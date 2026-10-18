/* part of the ronin-cowork client — see js/README.md */
/**
 * THE TEAMS OVERLAY (owner, 2026-10-18; PATTERNS.md Home and Team rows). Home's Teams door
 * lays it over Home: a full overlay (work-details.js) holding Phalanx A/B stones of Teams,
 * name only. Two questions at its top (ask.js): Workspace, many-of, blank All, narrows the
 * stones to the Teams in those workspace folders; Show, many-of, Theme on by default, says
 * what each stone carries under its name — Theme, the roster objective; State, the status of
 * the Team's board (no board, nothing); Agents; Items. A stone pressed lays the Team's read
 * over this overlay: Theme, State, Agents, and Launch. The 人 mark in the stone's corner, and
 * Launch, open the Team page in a new tab.
 *
 * Reading: the teams push, each roster row carrying its board and items (teams-api.ts),
 * through the Team projection (team-controller.js) with the sessions push for Agents. The
 * browser requests nothing; a write shows itself when the rosters are pushed again.
 * teams-overlay-rows.js is the pure mapping. `openTeamsOver(host)` is the one door, the seam
 * Home calls; it returns nothing and Close lifts the subscription with the layer.
 */
import { WorkspaceKit } from './workspace-kit.js';
import { el } from './form-steps.js';
import { fullOverlay } from './work-details.js';
import { createPhalanx } from './phalanx.js';
import { ask } from './ask.js';
import { membersOfTeam, subscribe, teamsFromState } from './team-controller.js';
import { openWorkspaceTab } from './workspace.js';
import { teamsOverlayRows, workspaces } from './teams-overlay-rows.js';
import { t } from './lexicon.js';

const SHOW = ['theme', 'state', 'agents', 'items'];
const launch = (team) => openWorkspaceTab('team', team);
const rosters = () => teamsFromState().filter((team) => team.durable);

/** Lay the Teams overlay over `host` (Home's element). */
export function openTeamsOver(host) {
  const { createAction, ninMark } = WorkspaceKit.primitives;
  const words = { theme: t('teams_overlay.theme', 'Theme'), state: t('teams_overlay.state', 'State'), agents: t('league.agents', 'Agents'), items: t('teams_overlay.items', 'Items') };
  let roots = []; // the workspaces chosen
  let show = ['theme']; // what Show picks
  let filter = null;
  let stop = () => {};
  let readOpen = () => {}; // repaints the Team's read while one is over the overlay

  const mark = (team) => {
    const node = ninMark('wk-launch-mark teams-overlay-launch');
    node.removeAttribute('aria-hidden');
    node.setAttribute('role', 'link');
    node.setAttribute('aria-label', t('teams_overlay.launch', 'Launch'));
    node.addEventListener('click', (event) => { event.stopPropagation(); launch(team); });
    return node;
  };
  const joined = (value) => Array.isArray(value) ? value.join(', ') : value;
  // Under the name: Theme in the stone's second line; State, Agents and Items in its state
  // line, each as "Word: value", a blank value left out (no board: no State).
  const underLine = (row) => SHOW.slice(1).filter((key) => show.includes(key))
    .map((key) => [words[key], joined(row[key])]).filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`).join(' · ');

  fullOverlay(host, (layer, through) => {
    layer.classList.add('teams-overlay');
    const head = el('div', 'league-team-detail-head');
    const tools = el('div', 'wk-surface-header-actions');
    tools.append(...through);
    head.append(el('h2', '', t('campaign.coworks', 'Teams')), tools);
    filter = ask([{ fields: [
      { key: 'root', label: t('teams_overlay.workspace', 'Workspace'), blank: t('teams_overlay.all', 'All'), many: true, options: [] },
      { key: 'show', label: t('teams_overlay.show', 'Show'), many: true, options: SHOW.map((key) => ({ v: key, l: words[key] })) },
    ] }], { value: { root: roots, show }, density: 'tight', onChange: ({ root: nextRoots, show: nextShow }) => {
      roots = (nextRoots || []).map(String);
      show = (nextShow || []).map(String);
      paint();
    } });
    const stones = createPhalanx({ className: 'teams-overlay-stones' });
    const body = el('div', 'sws-host');
    body.append(filter.el, stones.el);
    layer.append(head, body);

    /* ---------- a stone pressed: the Team's read over this overlay ---------- */
    const openTeam = (id) => {
      const lines = el('div', 'teams-overlay-lines');
      const paintRead = () => {
        const row = teamsOverlayRows(rosters(), membersOfTeam).find((entry) => entry.id === id);
        lines.replaceChildren(...[[words.theme, row.theme], [words.state, row.state], [words.agents, row.agents.join(', ')]].map(([label, text]) => {
          const line = el('div', 'teams-overlay-line');
          line.append(el('b', '', label), document.createTextNode(text));
          return line;
        }));
      };
      fullOverlay(layer, (read, throughRead) => {
        read.classList.add('teams-overlay-read');
        const readHead = el('div', 'league-team-detail-head');
        const readTools = el('div', 'wk-surface-header-actions');
        readTools.append(createAction({ label: t('teams_overlay.launch', 'Launch'), size: 'compact', action: () => launch(id) }).el, ...throughRead);
        readHead.append(el('h2', '', teamsOverlayRows(rosters(), membersOfTeam).find((entry) => entry.id === id).label), readTools);
        read.append(readHead, lines);
        readOpen = paintRead;
        paintRead();
      }, { closed: () => { readOpen = () => {}; } });
    };

    /* ---------- the reading: the Team projection, painted on every publish ---------- */
    const paint = () => {
      filter.options('root', workspaces(rosters()).map((name) => ({ v: name, l: name })));
      stones.setItems(teamsOverlayRows(rosters(), membersOfTeam, { roots }).map((row) => ({
        id: row.id,
        label: row.label,
        marker: mark(row.id),
        secondary: show.includes('theme') ? row.theme : '',
        state: underLine(row),
        action: () => openTeam(row.id),
      })));
      readOpen();
    };
    stop = subscribe(paint);
    paint();
  }, { closed: () => { stop(); filter.destroy(); } });
}
