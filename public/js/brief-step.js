/* part of the ronin-cowork client — see js/README.md */
/** WHAT AN AGENT IS TOLD (docs/architecture/brief.md, Layers and brief settings; Where it is set in the UI). One form for every layer:
 * the New Agent Behaviors step (layer 'agent') and the Campaign, Workspace and Team settings
 * pages. The browser works nothing out: the catalog (`GET /api/brief/catalog`) names the
 * files, and the server's answer (`POST /api/brief/preview` for an Agent, the `inherited` part
 * of `GET /api/brief/settings/:layer/:id` for a layer) says what comes from above and why.
 *
 *   value: { brief: { add: [{ name, depth }], block: [name], only: [name] }, integrations: [name], pm?: boolean }
 *   above: { integrations: { name: from }, pm: { on, from } }   — what the layers above give
 *   inPlay: [{ kind: facts|behaviours|tools, name, title, depth, why: [conditional] }]  — Agent only, read-only
 *
 * Integrations and project management only add down the layers: what a layer above has on
 * shows on and locked with where it comes from. */
import { ask } from './ask.js';
import { t } from './lexicon.js';
import { el } from './form-steps.js';
import { request } from './request.js';
import { workbenchLaunchUrl, workbenchLink } from './workspace.js';

/** The files folder a catalog kind lives in: fact → facts (the preview already says it plural). */
export const scopeOf = (kind = '') => (String(kind).endsWith('s') ? String(kind) : `${kind}s`);

export const emptyBriefValue = () => ({ brief: { add: [], block: [], only: [] }, integrations: [] });

/** A value as the server sent it, every list present. */
export function briefValue(raw = {}) {
  const brief = raw.brief || {};
  const list = (rows) => (Array.isArray(rows) ? [...rows] : []);
  return {
    brief: { add: list(brief.add).map((row) => ({ name: row.name, depth: row.depth === 'seed' ? 'seed' : 'full' })), block: list(brief.block), only: list(brief.only),
      ...(list(brief.integrations_off).length ? { integrations_off: list(brief.integrations_off) } : {}) },
    integrations: list(raw.integrations),
    ...(typeof raw.pm === 'boolean' ? { pm: raw.pm } : {}),
  };
}

/** The integrations there are: every `integration:<name>` a file's `when:` names (a bridge's own files are its record). */
export function integrationNames(catalog = []) {
  const names = new Set();
  for (const row of catalog) for (const need of [].concat(row.when || []).flatMap((w) => String(w).split(','))) {
    const match = need.trim().match(/^integration:(.+)$/);
    if (match) names.add(match[1]);
  }
  return [...names].sort();
}

const layerWord = (from) => ({
  campaign: t('brief.from_campaign', 'Campaign'), workspace: t('brief.from_workspace', 'Workspace'),
  team: t('brief.from_team', 'Team'), user: t('brief.from_user', 'your settings'),
})[from] || from;

/** One `why` entry in words. */
function whyWord(need) {
  const text = String(need); const at = text.indexOf(':');
  const head = at < 0 ? text : text.slice(0, at); const rest = at < 0 ? '' : text.slice(at + 1);
  if (head === 'add') return t('brief.why_added', 'added by the {layer}', { layer: layerWord(rest) });
  if (head === 'integration') return t('brief.why_integration', '{name} on', { name: rest });
  if (head === 'role') return t('brief.why_role', '{role} role', { role: rest.replaceAll('_', ' ') });
  if (head === 'service') return t('brief.why_service', '{name} running', { name: rest });
  if (head === 'workspace') return t('brief.why_workspace', 'in {name}', { name: rest });
  return ({
    cowork: t('brief.why_cowork', 'every Cowork Agent'), lead: t('brief.why_lead', 'Team lead'), team: t('brief.why_team', 'on a Team'),
    desk: t('brief.why_desk', 'at a desk'), checkout: t('brief.why_checkout', 'in a checkout'), pm: t('brief.why_pm', 'project management on'),
    hosted: t('brief.why_hosted', 'hosted office'), 'new-owner': t('brief.why_new_owner', 'new owner'), owner: t('brief.why_owner', 'the owner'), member: t('brief.why_member', 'a member'),
  })[need] || (need.startsWith('!service:') ? t('brief.why_service_off', '{name} not running', { name: need.slice(9) })
    : need.startsWith('!') ? t('brief.why_not', 'not {what}', { what: whyWord(need.slice(1)) }) : need);
}
export const whyText = (why = []) => (why.length ? why.map(whyWord).join(' · ') : t('brief.why_every', 'every Agent'));


/** Links to the layer pages above, for "Set on": the Campaign's desk settings, the Team's
 *  configuration, the Workspaces page. A plain press opens it in place; a modified one, a tab. */
export function layerLinks({ team = '', open = {} } = {}) {
  const specs = {
    campaign: { destination: 'campaign', mode: 'replace', state: { count: 2, selected: 'workspace1', seats: { workspace1: 'campaign.defaults', workspace2: 'setup.launch-own' } } },
    team: team ? { destination: 'team', param: team, mode: 'replace', state: { count: 2, selected: 'workspace1', seats: { workspace1: { type: 'team.commons', tab: 'team-configuration' } } } } : null,
    workspace: { destination: 'workspaces', mode: 'replace' },
  };
  return (from, label) => {
    const spec = specs[from];
    if (!spec) return null;
    const link = workbenchLink(el('a', null, label), spec);
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (open[from]) open[from](); else location.assign(workbenchLaunchUrl(spec));
    });
    return link;
  };
}

/**
 * Draw the form into `host`. `layer` is 'agent' | 'campaign' | 'workspace' | 'team'. An Agent
 * gets Integrations, Optional and Comes with this Agent; a layer gets Integrations, Add, Block
 * and Only. `onChange(value)` hands back the layer's own value, never what it inherits.
 */
export function paintBriefForm(host, { layer = 'agent', catalog = [], value = emptyBriefValue(), above = {}, inPlay = null, onChange = () => {}, openBehaviours = null, showIntegrations = true, linkFor = null } = {}) {
  const own = briefValue(value);
  const inherited = Object.fromEntries(Object.entries(above.integrations || {}).filter(([, from]) => from && from !== layer));
  // Narrowing: off above holds here; this layer may turn off what is on above, for itself and below.
  const offAbove = Object.fromEntries(Object.entries(above.off || {}).filter(([, from]) => from && from !== layer));
  const ownOff = [...(own.brief.integrations_off || [])];
  const pmAbove = above.pm?.on && above.pm.from && above.pm.from !== layer ? above.pm.from : '';
  const named = new Map(catalog.map((row) => [row.name, row]));
  // View opens the file in the Behaviors surface (behaviour-surface.js), where the user can read or make their own version.
  const option = (row, extra = {}) => ({ v: row.name, l: row.title || row.name, sub: row.seed || '', ...(row.kind ? { view: { name: row.name, scope: scopeOf(row.kind) } } : {}), ...extra });
  const emit = () => onChange(briefValue(own));
  const parts = [];
  const destroyers = [];
  // Each group: its heading, its help line right under it, then its stones (asked with no group of their own).
  const section = (title, help = '') => {
    const box = el('div', 'na-behaviour-section');
    box.append(el('div', 'ask-group-head', title));
    if (help) box.append(el('p', 'na-behaviour-note', help));
    parts.push(box);
    return box;
  };
  // What is in play here already, from the server: a behaviour the layer itself adds is not "already".
  const played = new Map((inPlay || []).filter((row) => !(row.why || []).length || !row.why.every((need) => need === `add:${layer}`)).map((row) => [row.name, row]));

  /* Integrations, each card saying plainly whether it is on; then project management. */
  const names = [...new Set([...integrationNames(catalog), ...Object.keys(inherited), ...Object.keys(offAbove), ...ownOff, ...own.integrations])].sort();
  const fromAbove = (name) => !!inherited[name] || ownOff.includes(name);
  const intBox = showIntegrations
    ? section(t('brief.integrations', 'Integrations'), layer === 'agent'
      ? t('brief.integrations_help', 'On from the Campaign, Workspace or Team, plus any you turn on for this Agent; turn one off for this Agent alone.')
      : t('brief.integrations_help_layer', 'On or off here holds for everything below.'))
    : section(t('brief.pm', 'Project management'));
  if (showIntegrations) {
    const integrations = ask([{ fields: [{ key: 'integrations', label: t('brief.integrations', 'Integrations'), many: true, shape: 'rect', filter: false,
      options: (now) => names.map((name) => {
        const on = (now.integrations || []).includes(name);
        if (offAbove[name]) return { v: name, l: name, word: t('brief.off_from_word', 'Off, from the {layer}', { layer: layerWord(offAbove[name]) }), disabled: true };
        if (inherited[name]) return { v: name, l: name, word: on ? t('brief.on_from_word', 'On, from the {layer}', { layer: layerWord(inherited[name]) }) : t('brief.off_here', 'Off here and below') };
        if (ownOff.includes(name)) return { v: name, l: name, word: on ? t('brief.on', 'On') : t('brief.off_here', 'Off here and below') };
        return { v: name, l: name, word: on ? t('brief.on', 'On') : t('brief.off', 'Off') };
      }) }] }],
    { value: { integrations: [...new Set([...Object.keys(inherited).filter((name) => !ownOff.includes(name)), ...own.integrations])] }, density: 'tight', exposed: true,
      onChange: (next) => {
        const chosen = new Set(next.integrations);
        own.integrations = next.integrations.filter((name) => !fromAbove(name) && !offAbove[name]);
        const off = [...new Set([...Object.keys(inherited), ...ownOff])].filter((name) => !chosen.has(name));
        if (off.length) own.brief.integrations_off = off; else delete own.brief.integrations_off;
        emit();
      } });
    intBox.append(integrations.el);
    destroyers.push(integrations);
  }
  const pmWord = (on) => (pmAbove === 'jira' ? t('brief.pm_jira', 'On while Jira is on.')
    : pmAbove ? t('brief.on_from_word', 'On, from the {layer}', { layer: layerWord(pmAbove) })
      : on ? (layer === 'agent' ? t('brief.pm_on', 'Work items: the item model, and the guidance for this Agent’s role.') : t('brief.pm_on_layer', 'Work items for every Agent below: the item model, and the guidance for each role.'))
        : t('brief.pm_off', 'No work items guidance.'));
  const pmNote = el('span', 'na-behaviour-note', pmWord(!!pmAbove || own.pm === true));
  // Off is only an answer where nothing above has it on; absent then means off. The switch is its track; its words stand beside it.
  const pm = ask([{ fields: [{ key: 'pm', label: t('brief.pm', 'Project management'), compact: true, switch: [t('forms.on', 'On'), t('forms.off', 'Off')] }] }],
    { value: { pm: !!pmAbove || own.pm === true }, density: 'tight', onChange: (next) => { if (next.pm) own.pm = true; else delete own.pm; pmNote.textContent = pmWord(next.pm); emit(); } });
  if (pmAbove) pm.disable('pm', pmWord(true));
  destroyers.push(pm);
  const pmRow = el('div', 'brief-pm-row');
  if (showIntegrations) pmRow.append(el('span', 'brief-pm-name', t('brief.pm', 'Project management')));
  pmRow.append(pm.el, pmNote);
  intBox.append(pmRow);
  // Where what is inherited is set: one line, each place a link to its page when the host can open it.
  const sources = [...new Set([...Object.values(inherited), ...(pmAbove && pmAbove !== 'jira' ? [pmAbove] : [])])];
  if (sources.length) {
    const setOn = el('p', 'na-behaviour-note brief-set-on', `${t('brief.set_on', 'Set on')}: `);
    sources.forEach((from, index) => { if (index) setOn.append(' · '); setOn.append(linkFor?.(from, layerWord(from)) || layerWord(from)); });
    intBox.append(setOn);
  }

  /* Add (an Agent's Optional): each card says its state — its depth when chosen; when already in play, why and how deep. */
  const depthOf = (name) => own.brief.add.find((row) => row.name === name)?.depth || 'full';
  const depthWord = (depth) => (depth === 'seed' ? t('brief.depth_seed', 'Seed') : t('brief.depth_full', 'Full'));
  // An added behaviour's depth: the forms' own switch, Full or Seed (one line).
  const depthAsks = [];
  const depthControl = (row) => {
    const depth = ask([{ fields: [{ key: 'full', label: t('brief.depth', 'Depth'), switch: [t('brief.depth_full', 'Full'), t('brief.depth_seed', 'Seed')] }] }],
      { value: { full: depthOf(row.v) === 'full' }, density: 'tight', onChange: (next) => {
        const hit = own.brief.add.find((entry) => entry.name === row.v); if (hit) hit.depth = next.full ? 'full' : 'seed'; emit();
      } });
    depthAsks.push(depth);
    return depth.el;
  };
  // What an add can change: an optional behaviour (depth none) brought in, or a seed raised to full.
  // A mandate value is chosen on the Mandate menus, never added here.
  const addable = catalog.filter((row) => row.kind === 'behaviour' && !row.mandate && (row.depth !== 'full' || own.brief.add.some((a) => a.name === row.name)));
  for (const entry of own.brief.add) if (!addable.some((row) => row.name === entry.name)) addable.push(named.get(entry.name) || { name: entry.name });
  const addRow = (row, now) => {
    if ((now.add || []).includes(row.name)) return option(row, { word: depthWord(depthOf(row.name)) });
    const there = played.get(row.name);
    if (!there) return option(row);
    // Already told here: shown as it is; only a seed can be raised (to Full).
    const state = `${whyText(there.why)} · ${depthWord(there.depth)}`;
    return option(row, { word: state, ...(there.depth === 'full' ? { disabled: true } : {}) });
  };
  const addBox = section(layer === 'agent' ? t('behaviours.available', 'Optional') : t('brief.add', 'Add'),
    layer === 'agent' ? t('brief.optional_help', 'Behaviors added for this Agent only. One already told can be raised to Full.') : t('brief.add_help', 'Brought in for every Agent below, at this depth.'));
  const add = ask([{ fields: [{ key: 'add', label: t('behaviours', 'Behaviors'), many: true, shape: 'rect', filter: false,
    row: depthControl,
    options: (now) => [...addable.map((row) => addRow(row, now)),
      ...(openBehaviours ? [{ v: '@customize', l: t('behaviours.customize', 'Customize Behaviors'), action: () => openBehaviours() }] : [])] }] }],
  { value: { add: own.brief.add.map((row) => row.name) }, density: 'tight', exposed: true,
    onChange: (next) => { own.brief.add = next.add.map((name) => ({ name, depth: depthOf(name) })); emit(); } });
  addBox.append(add.el);
  destroyers.push(add, { destroy: () => depthAsks.forEach((one) => one.destroy()) });

  /* What an Agent here is told: the server's answer, read-only — the Agent's own form, and any page that asks. */
  const told = () => {
    // A behaviour brings its tools; facts are the brief's own; what this Agent adds itself is under Optional.
    const mine = (row) => layer === 'agent' && (row.why || []).length > 0 && row.why.every((need) => need === 'add:agent');
    const rows = (inPlay || []).filter((row) => (row.kind === 'behaviours' || row.kind === 'behaviour') && !mine(row));
    const box = section(layer === 'agent' ? t('brief.comes', 'Comes with this Agent') : t('brief.told_here', 'An Agent here is told'), layer === 'agent'
      ? t('brief.comes_help', 'What this Agent will be told anyway, and why. Read-only.')
      : t('brief.told_here_help', 'What a new Agent here is told, and why, as saved. Read-only.'));
    // The why is each stone's second line, always shown; the seed reads in the caption.
    const fixed = ask([{ fields: [{ key: 'inPlay', label: t('behaviours', 'Behaviors'), many: true, shape: 'rect', filter: false,
      options: rows.map((row) => option(named.get(row.name) || row, { l: row.title || row.name, word: whyText(row.why), disabled: true })) }] }],
    { value: { inPlay: rows.map((row) => row.name) }, className: 'na-behaviour-readonly', density: 'tight', exposed: true });
    box.append(fixed.el);
    destroyers.push(fixed);
  };

  if (layer === 'agent') {
    told();
  } else {
    /* Block and Only: names of facts, behaviours and tools. */
    const listField = (key, title, help) => {
      const rows = catalog.filter((row) => key === 'block' || row.kind !== 'tool' || own.brief.only.includes(row.name) || !row.serves);
      const box = section(title, help);
      const picker = ask([{ fields: [{ key, label: t('brief.names', 'Names'), many: true, shape: 'tall', options: rows.map((row) => option(row, { word: row.kind })) }] }],
        { value: { [key]: own.brief[key] }, density: 'tight', onChange: (next) => { own.brief[key] = [...next[key]]; emit(); } });
      box.append(picker.el); destroyers.push(picker);
    };
    listField('block', t('brief.block', 'Block'), t('brief.block_help', 'Never told to any Agent below.'));
    listField('only', t('brief.only', 'Only'), t('brief.only_help', 'When set, nothing else is told below; a behavior brings its tools.'));
    if (inPlay) told();
  }
  host.replaceChildren(...parts);
  return { destroy: () => destroyers.forEach((part) => part.destroy()) };
}

/**
 * One layer's settings as a panel with its own Save: the Campaign, Workspace and Team pages
 * mount it (`GET`/`PUT /api/brief/settings/:layer/:id`). A save reaches Agents born after it;
 * a live Agent's brief doesn't move.
 */
export function createBriefSettingsPanel({ layer, id = '', campaignId = '', createAction = null, ownSave = true, showIntegrations = true, onChange = () => {}, preview = null, linkFor = null } = {}) {
  const root = el('div', 'brief-settings');
  const formHost = el('div', 'na-behaviour-sections');
  const actions = el('div', 'brief-settings-actions');
  const status = el('span', 'brief-settings-status');
  const saveAction = createAction?.({ label: t('panels.save', 'Save'), size: 'compact', action: () => void save() });
  const saveButton = saveAction?.el || el('button', null, t('panels.save', 'Save'));
  if (!saveAction) { saveButton.type = 'button'; saveButton.addEventListener('click', () => void save()); }
  actions.append(status, saveButton);
  root.append(formHost);
  if (ownSave) root.append(actions); // else the page's own Save calls save()
  const url = () => `/api/brief/settings/${encodeURIComponent(layer)}/${encodeURIComponent(id || '-')}${campaignId ? `?campaign_id=${encodeURIComponent(campaignId)}` : ''}`;
  let catalog = []; let value = emptyBriefValue(); let above = {}; let form = null; let inPlay = null;
  const paint = () => {
    form?.destroy();
    form = paintBriefForm(formHost, { layer, catalog, value, above, showIntegrations, inPlay, linkFor, onChange: (next) => { value = next; status.textContent = ''; onChange(next); } });
  };
  // `preview` is what an Agent here is: { campaign_id } | { workspace } | { team } (POST /api/brief/preview).
  const readTold = async () => {
    if (!preview) return;
    const result = await request('/api/brief/preview', { method: 'POST', json: preview });
    if (result.ok) { inPlay = result.data?.in_play || []; paint(); }
  };
  const answer = (data = {}) => { value = briefValue(data); above = data.inherited || {}; paint(); void readTold(); };
  async function save() {
    status.textContent = t('team_config.saving', 'Saving…');
    const body = { ...value, pm: typeof value.pm === 'boolean' ? value.pm : null };
    const result = await request(url(), { method: 'PUT', json: body });
    status.textContent = result.ok ? t('team_config.saved', 'Saved') : result.message;
    if (result.ok) answer(result.data);
    return result;
  }
  return {
    el: root,
    enter: async () => {
      const [cat, settings] = await Promise.all([request('/api/brief/catalog'), request(url(), { cache: 'no-store' })]);
      catalog = cat.ok && Array.isArray(cat.data) ? cat.data : [];
      if (!settings.ok) { status.textContent = settings.message; return; }
      answer(settings.data);
    },
    save,
    value: () => value,
    destroy: () => form?.destroy(),
  };
}
