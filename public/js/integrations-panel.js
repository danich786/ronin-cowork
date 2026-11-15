/* part of the ronin-cowork client — see js/README.md */
/**
 * THE INTEGRATIONS PANEL (KAN-339; KAN-513) — every integration in one frame, each the same way
 * whether Ronin has a bridge for it or not: the bridges (behaviours with `when: integration:<name>`)
 * and any name a Workspace uses, each with the Workspaces using it, whether its Services part
 * runs, and the secrets saved under `<name>-` (names only). Keys are saved by an Agent's
 * `secret ask`, never here. A name with a panel of its own (Jira's) shows that panel inside the
 * frame, as it works on its own. Over /api/integrations (src/routes/integrations-api.ts).
 */
import { WorkspaceKit } from './workspace-kit.js';
import { t } from './lexicon.js';
import { request } from './request.js';
import { el } from './form-steps.js';
import { createPhalanx } from './phalanx.js';

const PART = {
  running: () => t('integrations.part_running', 'running'),
  parked: () => t('integrations.part_parked', 'on this machine, not running (Services › Ronin Services)'),
};

/** How many have keys saved, across the list, in one line. */
export function integrationsLine(rows) {
  if (!rows.length) return t('integrations.none_listed', 'No integrations yet: a bridge file or a Workspace adds one.');
  const keyed = rows.filter((row) => row.secrets.length);
  if (!keyed.length) return t('integrations.nothing_saved', '{n} integrations; no keys saved yet. An Agent asks for one with secret ask <name>-<key>.', { n: rows.length });
  return t('integrations.saved_n', '{n} of {all} have keys saved: {names}.', { n: keyed.length, all: rows.length, names: keyed.map((row) => row.label).join(', ') });
}

/** `campaign()` is the selected Campaign; `panels[name]()` builds an integration's own panel ({el, enter}). */
export function createIntegrationsPanel(campaign, { panels = {}, embedded = false } = {}) {
  const { createSurface, createAction } = WorkspaceKit.primitives;
  const refresh = createAction({ label: t('integrations.refresh', 'Refresh'), size: 'compact', action: () => void load() });
  const surface = embedded ? null : createSurface({ label: t('integrations.title', 'Integrations'), className: 'setup-surface integrations-surface', actions: [refresh] });
  const host = embedded ? el('section', 'integrations-embedded') : surface.content;
  if (embedded) host.append(el('h3', 'integrations-heading', t('integrations.title', 'Integrations')));
  const line = el('p', 'setup-lede integrations-line');
  line.setAttribute('role', 'status');
  let rows = [];

  const id = () => campaign()?.id || '';
  const stateWord = (row) => (row.secrets.length ? t('integrations.keys_n', '{n} saved', { n: row.secrets.length })
    : panels[row.name] ? t('integrations.own_panel', 'Own panel') : t('integrations.no_keys', 'No keys'));
  const itemFor = (row) => ({ id: row.name, label: row.label, state: stateWord(row), attrs: { 'data-keyed': String(row.secrets.length > 0) } });

  const fact = (dl, label, value) => { const item = el('div', 'setup-gbrain-answer'); item.append(el('dt', '', label), el('dd', '', value)); dl.append(item); };

  function facts(row) {
    const dl = el('dl', 'setup-gbrain-answers integrations-facts');
    if (row.blurb) fact(dl, t('integrations.what', 'What it is'), row.blurb);
    fact(dl, t('integrations.bridge', 'Bridge'), row.bridge || t('integrations.no_bridge', 'none: Agents use its own CLI or API'));
    if (row.part) fact(dl, t('integrations.part', 'Services part'), `${row.name} · ${PART[row.part]()}`);
    fact(dl, t('integrations.secrets', 'Keys saved'), row.secrets.join(', ')
      || (panels[row.name] ? t('integrations.in_own_panel', 'set in its own panel, below')
        : t('integrations.no_secrets', 'none: an Agent asks with secret ask {name}-<key>', { name: row.name })));
    fact(dl, t('integrations.workspaces', 'Workspaces using it'), row.workspaces.join(', ') || t('integrations.no_workspaces', 'none yet: add it on a Workspace'));
    return dl;
  }

  function renderDetail(item, detail) {
    const row = rows.find((one) => one.name === item.id);
    if (!row) return () => {};
    detail.append(facts(row));
    const own = panels[row.name] ? panels[row.name]() : null;
    if (own) { detail.append(own.el); void (own.enter ?? own.show)?.(); }
    return () => own?.destroy?.();
  }

  // In Settings, stones and the detail beside them; inside Setup's Installations, one fold per
  // integration under Ronin Services (a phalanx seats only in a surface's own content).
  const stones = embedded ? null : createPhalanx({ items: [], className: 'integrations-stones', renderDetail });
  const folds = embedded ? el('div', 'integrations-folds') : null;
  const open = new Set();
  let cleanups = [];
  if (stones) stones.mount(host, { before: [line] });
  else host.append(line, folds);
  const paintFolds = () => {
    for (const done of cleanups) done();
    cleanups = [];
    folds.replaceChildren(...rows.map((row) => {
      const fold = el('details', 'integrations-fold');
      fold.dataset.keyed = String(row.secrets.length > 0);
      fold.open = open.has(row.name);
      fold.append(el('summary', '', `${row.label} · ${stateWord(row)}`));
      const body = el('div', 'integrations-fold-body');
      fold.append(body);
      fold.addEventListener('toggle', () => { if (fold.open) open.add(row.name); else open.delete(row.name); });
      cleanups.push(renderDetail({ id: row.name }, body));
      return fold;
    }));
  };

  async function load() {
    refresh.setDisabled(true);
    const result = await request(`/api/integrations?campaign_id=${encodeURIComponent(id())}`, { cache: 'no-store' });
    refresh.setDisabled(false);
    if (!result.ok) { line.textContent = t('integrations.read_failed', 'The integrations could not be read: {error}', { error: result.message }); return; }
    rows = Array.isArray(result.data.integrations) ? result.data.integrations : [];
    line.textContent = integrationsLine(rows);
    if (!stones) { paintFolds(); return; }
    stones.setItems(rows.map(itemFor));
  }

  return { el: embedded ? host : surface.el, enter: () => load(), destroy: () => { stones?.destroy(); for (const done of cleanups) done(); } };
}
