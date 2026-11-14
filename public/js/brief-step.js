/* part of the ronin-cowork client — see js/README.md */
/** WHAT AN AGENT IS TOLD (samurai_lab wip/BRIEF_MODEL.md §6, §8). One form for every layer:
 * the New Agent Behaviors step (layer 'agent') and the Campaign, Workspace and Team settings
 * pages. The browser works nothing out: the catalog (`GET /api/brief/catalog`) names the
 * files, and the server's answer (`POST /api/brief/preview` for an Agent, the `inherited` part
 * of `GET /api/brief/settings/:layer/:id` for a layer) says what comes from above and why.
 *
 *   value: { brief: { add: [{ name, depth }], block: [name], only: [name] }, integrations: [name], pm?: boolean }
 *   above: { integrations: { name: from }, pm: { on, from } }   — what the layers above give
 *   inPlay: [{ kind, name, title, depth, why: [conditional] }]  — Agent only, read-only
 *
 * Integrations and project management only add down the layers: what a layer above has on
 * shows on and locked with where it comes from. */
import { ask } from './ask.js';
import { t } from './lexicon.js';
import { el } from './form-steps.js';

export const emptyBriefValue = () => ({ brief: { add: [], block: [], only: [] }, integrations: [] });

/** A value as the server sent it, every list present. */
export function briefValue(raw = {}) {
  const brief = raw.brief || {};
  const list = (rows) => (Array.isArray(rows) ? [...rows] : []);
  return {
    brief: { add: list(brief.add).map((row) => ({ name: row.name, depth: row.depth === 'seed' ? 'seed' : 'full' })), block: list(brief.block), only: list(brief.only) },
    integrations: list(raw.integrations),
    ...(typeof raw.pm === 'boolean' ? { pm: raw.pm } : {}),
  };
}

/** The integrations there are: every `integration:<name>` a file's `when:` names (a bridge's own files are its record). */
export function integrationNames(catalog = []) {
  const names = new Set();
  for (const row of catalog) for (const need of String(row.when || '').split(',')) {
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
  })[need] || (need.startsWith('!') ? t('brief.why_not', 'not {what}', { what: whyWord(need.slice(1)) }) : need);
}
export const whyText = (why = []) => (why.length ? why.map(whyWord).join(' · ') : t('brief.why_every', 'every Agent'));

function depths() {
  return [{ v: 'seed', l: t('brief.depth_seed', 'Seed (one line)') }, { v: 'full', l: t('brief.depth_full', 'Full (whole text)') }];
}

/**
 * Draw the form into `host`. `layer` is 'agent' | 'campaign' | 'workspace' | 'team'. An Agent
 * gets Integrations, Optional and Comes with this Agent; a layer gets Integrations, Add, Block
 * and Only. `onChange(value)` hands back the layer's own value, never what it inherits.
 */
export function paintBriefForm(host, { layer = 'agent', catalog = [], value = emptyBriefValue(), above = {}, inPlay = [], onChange = () => {}, openBehaviours = null } = {}) {
  const own = briefValue(value);
  const inherited = Object.fromEntries(Object.entries(above.integrations || {}).filter(([, from]) => from && from !== layer));
  const pmAbove = above.pm?.on && above.pm.from && above.pm.from !== layer ? above.pm.from : '';
  const named = new Map(catalog.map((row) => [row.name, row]));
  const option = (row, extra = {}) => ({ v: row.name, l: row.title || row.name, sub: row.seed || '', ...(row.path ? { read: row.path } : {}), ...extra });
  const emit = () => onChange(briefValue(own));
  const parts = [];

  /* Integrations, with the project-management switch. */
  const names = [...new Set([...integrationNames(catalog), ...Object.keys(inherited), ...own.integrations])].sort();
  const integrations = ask([{ group: t('brief.integrations', 'Integrations'), fields: [{ key: 'integrations', label: t('brief.integrations', 'Integrations'), many: true, shape: 'tall', filter: false,
    options: names.map((name) => (inherited[name]
      ? { v: name, l: name, sub: t('brief.on_from', 'on from {layer}', { layer: layerWord(inherited[name]) }), disabled: true }
      : { v: name, l: name })) }] }],
  { value: { integrations: [...new Set([...Object.keys(inherited), ...own.integrations])] }, density: 'tight', exposed: true,
    onChange: (next) => { own.integrations = next.integrations.filter((name) => !inherited[name]); emit(); } });
  const pmWord = (on) => (pmAbove === 'jira' ? t('brief.pm_jira', 'On while Jira is on.')
    : pmAbove ? t('brief.on_from', 'on from {layer}', { layer: layerWord(pmAbove) })
      : on ? t('brief.pm_on', 'Work items: the item model, and the guidance for this Agent’s role.') : t('brief.pm_off', 'No work items guidance.'));
  const pmNote = el('p', 'na-behaviour-note', pmWord(!!pmAbove || own.pm === true));
  // Off is only an answer where nothing above has it on; absent then means off.
  const pm = ask([{ fields: [{ key: 'pm', label: t('brief.pm', 'Project management'), switch: [t('forms.on', 'On'), t('forms.off', 'Off')] }] }],
    { value: { pm: !!pmAbove || own.pm === true }, density: 'tight', onChange: (next) => { if (next.pm) own.pm = true; else delete own.pm; pmNote.textContent = pmWord(next.pm); emit(); } });
  if (pmAbove) pm.disable('pm', pmWord(true));
  const integrationSection = el('div', 'na-behaviour-section');
  integrationSection.append(el('p', 'na-behaviour-note', layer === 'agent'
    ? t('brief.integrations_help', 'On from the Campaign, Workspace or Team, plus any you turn on for this Agent.')
    : t('brief.integrations_help_layer', 'On here is on for everything below.')), integrations.el, pm.el, pmNote);
  parts.push(integrationSection);

  /* Add (an Agent's Optional): behaviours with a depth. */
  const depthOf = (name) => own.brief.add.find((row) => row.name === name)?.depth || 'full';
  const depthControl = (row) => {
    const select = el('select', 'wk-field-control');
    for (const depth of depths()) { const o = el('option', null, depth.l); o.value = depth.v; select.append(o); }
    select.value = depthOf(row.v);
    select.addEventListener('change', () => { const hit = own.brief.add.find((entry) => entry.name === row.v); if (hit) hit.depth = select.value; emit(); });
    return select;
  };
  const addable = catalog.filter((row) => row.kind === 'behaviour' && (row.depth === 'none' || layer !== 'agent' || own.brief.add.some((a) => a.name === row.name)));
  for (const entry of own.brief.add) if (!addable.some((row) => row.name === entry.name)) addable.push(named.get(entry.name) || { name: entry.name });
  const add = ask([{ group: layer === 'agent' ? t('behaviours.available', 'Optional') : t('brief.add', 'Add'), fields: [{ key: 'add', label: t('behaviours', 'Behaviors'), many: true, shape: 'tall', filter: false,
    row: depthControl,
    options: [...addable.map((row) => option(row)),
      ...(openBehaviours ? [{ v: '@customize', l: t('behaviours.customize', 'Customize Behaviors'), action: () => openBehaviours() }] : [])] }] }],
  { value: { add: own.brief.add.map((row) => row.name) }, density: 'tight', exposed: true,
    onChange: (next) => { own.brief.add = next.add.map((name) => ({ name, depth: depthOf(name) })); emit(); } });
  const addSection = el('div', 'na-behaviour-section');
  addSection.append(el('p', 'na-behaviour-note', layer === 'agent' ? t('brief.optional_help', 'Behaviors added for this Agent only.') : t('brief.add_help', 'Brought in for every Agent below, at this depth.')), add.el);
  parts.push(addSection);
  const destroyers = [integrations, pm, add];

  if (layer === 'agent') {
    /* Comes with this Agent: the server's answer, read-only. */
    const rows = inPlay.filter((row) => row.kind !== 'fact');
    const fixed = ask([{ group: t('behaviours.conditional', 'Comes with this Agent'), fields: [{ key: 'inPlay', label: t('behaviours', 'Behaviors'), many: true, shape: 'tall', filter: false,
      options: rows.map((row) => option(named.get(row.name) || row, { l: row.title || row.name, sub: whyText(row.why), disabled: true })) }] }],
    { value: { inPlay: rows.map((row) => row.name) }, className: 'na-behaviour-readonly', density: 'tight', exposed: true });
    const fixedSection = el('div', 'na-behaviour-section');
    fixedSection.append(el('p', 'na-behaviour-note', t('brief.comes_help', 'What this Agent will be told anyway, and why. Read-only.')), fixed.el);
    parts.push(fixedSection);
    destroyers.push(fixed);
  } else {
    /* Block and Only: names of facts, behaviours and tools. */
    const listField = (key, group, help) => {
      const rows = catalog.filter((row) => key === 'block' || row.kind !== 'tool' || own.brief.only.includes(row.name) || !row.serves);
      const picker = ask([{ group, fields: [{ key, label: group, many: true, shape: 'tall', options: rows.map((row) => option(row, { word: row.kind })) }] }],
        { value: { [key]: own.brief[key] }, density: 'tight', onChange: (next) => { own.brief[key] = [...next[key]]; emit(); } });
      const section = el('div', 'na-behaviour-section');
      section.append(el('p', 'na-behaviour-note', help), picker.el);
      parts.push(section); destroyers.push(picker);
    };
    listField('block', t('brief.block', 'Block'), t('brief.block_help', 'Never told to any Agent below.'));
    listField('only', t('brief.only', 'Only'), t('brief.only_help', 'When set, nothing else is told below; a behavior brings its tools.'));
  }
  host.replaceChildren(...parts);
  return { destroy: () => destroyers.forEach((part) => part.destroy()) };
}
