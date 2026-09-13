/* Editable reading of one complete durable team_roster. Membership is intentionally absent.
 * Two parts (owner, 2026-09-13): the Team's own facts — Team ID, Title and Kind on one head
 * line, then Purpose — and, under them, NEW AGENT DEFAULTS: Where it works, Model, Mandate
 * and Runtime, what the next Agent starts from, never the Team's own behaviour. Features and
 * behaviours are not asked here. Every question is asked through ERABI (ask.js) at the commons'
 * loose density; the text entries (title, purpose) are the kit's — the utility takes no foreign DOM. */
import { t } from './lexicon.js';
import { request } from './request.js';
import { ask } from './ask.js';
import { ruledRows } from './glyphs.js';
import { loadProviderCatalog, mandateWord, modelAvailabilityFact, providerCatalog, tierWord } from './form-steps.js';

const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text != null) node.textContent = String(text); return node; };
const bucket = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const list = (value) => Array.isArray(value) ? value : [];

const field = (form, label, name, value, kind = 'input', help = '') => {
  const row = el('label', 'tw-config-field'); row.append(el('span', null, label));
  const input = document.createElement(kind); input.classList.add('wk-field-control'); input.name = name; input.value = value || ''; row.append(input);
  if (help) row.append(el('small', null, help)); form.append(row); return input;
};
const reading = (form, label, value, empty) => { const row = el('div', 'tw-config-reading'); row.append(el('span', null, label), el('output', null, value || empty)); form.append(row); };
const kindWord = (value) => ({
  open: t('campaign_view.option_open', 'Open'), coding: t('team_config.kind_coding', 'Coding'), work: t('team_config.kind_work', 'Work'), personal: t('team_config.kind_personal', 'Personal'),
  household: t('team_config.kind_household', 'Household'), social: t('team_config.kind_social', 'Social'), school: t('team_config.kind_school', 'School'),
})[value] || value;
const REACH = ['open', 'discuss', 'plan', 'execute'];
const RECRUIT = ['open', 'nobody', 'propose agents', 'staff agents'];
const OUTPUT = ['open', 'a plan', 'ideas', 'code', 'an artifact', 'the team'];

/** The provider and model rows as every ask() consumer reads them: the one catalog, reasons only. */
const reason = (row) => (row.off
  ? t('forms.reason_turned_off', 'turned off')
  : row.listed === false && row.model_list_current
    ? t('forms.reason_not_listed', 'not listed by your {cli} {client_version}', { cli: row.cli_label || row.cli, client_version: row.model_list?.client_version || '' })
    : t('forms.reason_not_on_machine', 'not on this machine'));
const providerRows = () => {
  const rows = providerCatalog().rows;
  return rows.filter((row, index) => rows.findIndex((other) => other.provider === row.provider) === index)
    .map((row) => ({ v: row.provider, l: row.provider_label || row.provider, off: row.operational ? '' : reason(row) }));
};
const modelRows = (provider) => providerCatalog().rows.filter((row) => row.provider === provider)
  .map((row) => ({ v: row.model, l: row.model, word: tierWord(row.tier), sub: modelAvailabilityFact(row) || row.cost || '', off: row.operational && row.listed !== false ? '' : reason(row) }));

export function renderTeamConfiguration(host, roster, optionsArg = {}) {
  host.replaceChildren();
  if (!roster?.durable) { host.append(el('p', 'tw-config-empty', t('team_config.no_roster', 'This Team has no saved record.'))); return; }
  const loading = el('p', 'tw-config-empty', t('team_config.loading', 'Loading Team Configuration…')); host.append(loading);

  // The form is painted even into a host that is not in the document: the caller renders
  // only on real change now, so a commons waiting off-screen must receive its form here —
  // nothing will render it again when it is placed. A superseded render's host is a
  // discarded node; painting it is invisible and cheap.
  void Promise.all([loadProviderCatalog(), request('/api/project-roots/detail')]).then(([, rootResult]) => {
    const roots = rootResult.ok && Array.isArray(rootResult.data?.roots) ? rootResult.data.roots.filter((root) => !root.archived) : [];
    const defaults = bucket(roster.agent_defaults);
    const form = el('form', 'tw-config-form');

    /* ---- the Team's own facts: one head line (ID · Title · Kind), then Purpose ---- */
    const head = el('div', 'tw-config-head'); reading(head, t('team_config.cowork_id', 'Team ID'), roster.name, t('settei.none_set', '— none set —'));
    const title = field(head, t('team_config.title', 'Title'), 'title', roster.title);
    const kind = ask([{ group: t('team_config.kind', 'Kind'), fields: [
      { key: 'kind', label: t('team_config.kind', 'Kind'), shape: 'square', options: ruledRows('kind', ['open', 'coding', 'work', 'personal', 'household', 'social', 'school'], kindWord) },
    ] }], { value: { kind: roster.kind || 'open' }, trayHost: head });
    head.append(kind.el); form.append(head);
    const objective = field(form, t('team_config.objective', 'Purpose'), 'objective', roster.objective, 'textarea');

    /* ---- New Agent defaults: everything below Purpose is what the next Agent starts from, never the Team's own behaviour ---- */
    const section = el('section', 'tw-config-section');
    section.append(el('h4', 'tw-config-section-head', t('team_config.agent_defaults', 'New Agent defaults')));
    section.append(el('p', 'tw-config-note', t('team_config.next_form', 'What each new Agent on this Team starts from. Nothing live changes.')));
    const branches = { ...bucket(roster.branches) };
    const rootWasDesk = list(roster.repos).includes(roster.project_root); // a birthplace that is also a desk stays one
    const worktrees = (name) => roots.find((root) => root.name === name)?.repo_profile?.worktrees === 'enabled';
    const rootRows = () => roots.map((root) => ({ v: root.name, l: root.title || root.name, word: worktrees(root.name) ? t('where.worktree', 'worktree') : t('where.checkout', 'checkout') }));
    const branchLine = (option) => {
      if (worktrees(option.v)) return null; // worktree or checkout follows the Workspace Folder; only a checkout names a branch
      const input = el('input'); input.type = 'text'; input.spellcheck = false; input.value = branches[option.v] || '';
      input.placeholder = t('where.col_branch', 'Branch');
      input.addEventListener('input', () => { branches[option.v] = input.value.trim(); });
      return input;
    };
    const launchModes = [
      { v: 'configured', l: t('launch_mode.configured', 'Model provider configuration'), sub: t('launch_mode.configured_sub', 'Ronin adds nothing to the command. The Agent starts with whatever its provider CLI already loads.') },
      { v: 'live_dangerously', l: t('launch_mode.live', 'Dangerously'), sub: t('launch_mode.live_sub', 'Ronin appends that provider’s own bypass flag, so the Agent does not stop to ask.') },
    ];
    const defaultsRow = el('div', 'tw-config-wide');
    const agentDefaults = ask([
      { group: t('where.label', 'Where it works'), fields: [
        { key: 'root', label: t('where.born_in', 'Born in'), blank: t('team_config.default', 'Default'), options: rootRows },
        { key: 'repos', label: t('where.additional', 'Additional workspaces'), many: true, after: 'root', options: (value) => rootRows().filter((row) => row.v !== value.root), row: branchLine },
      ] },
      { group: t('new_agent.model_package', 'Model'), fields: [
        { key: 'provider', label: t('team_config.provider', 'Provider'), blank: t('team_config.default', 'Default'), options: providerRows },
        { key: 'model', label: t('team_config.model', 'Model'), blank: t('team_config.default', 'Default'), after: 'provider', options: (value) => modelRows(value.provider) },
      ] },
      { group: t('mandate', 'Mandate'), fields: [
        { key: 'reach', label: t('team_config.reach', 'Reach'), options: REACH.map((v) => ({ v, l: mandateWord(v) })) },
        { key: 'recruit', label: t('team_config.recruit', 'Recruit'), options: RECRUIT.map((v) => ({ v, l: mandateWord(v) })) },
        { key: 'output', label: t('team_config.output', 'Output'), many: true, options: OUTPUT.map((v) => ({ v, l: mandateWord(v) })) },
      ] },
      { group: t('team_config.runtime', 'Runtime'), fields: [
        { key: 'launch_mode', label: t('launch_mode.head', 'launch mode'), options: launchModes },
      ] },
    ], { value: {
      root: roster.project_root || '', repos: list(roster.repos).filter((name) => name !== roster.project_root),
      provider: defaults.provider || '', model: defaults.model || '',
      reach: defaults.reach || 'open', recruit: defaults.recruit || 'open', output: [defaults.output || 'open'].flat().filter(Boolean),
      launch_mode: defaults.launch_mode || 'configured',
    }, trayHost: defaultsRow });
    defaultsRow.append(agentDefaults.el); section.append(defaultsRow); form.append(section);

    const actions = el('div', 'tw-config-actions'); const status = el('span', 'tw-config-status');
    const saveAction = optionsArg.createAction?.({ label: t('panels.save', 'Save'), size: 'compact' }); const save = saveAction?.el || el('button', null, t('panels.save', 'Save')); save.type = 'submit'; actions.append(status, save); form.append(actions); host.replaceChildren(form);
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (saveAction) saveAction.setDisabled(true); else save.disabled = true; status.textContent = t('team_config.saving', 'Saving…');
      const picked = agentDefaults.value();
      const repos = rootWasDesk && picked.root && picked.root === roster.project_root ? [picked.root, ...picked.repos.filter((name) => name !== picked.root)] : picked.repos.filter((name) => name !== picked.root);
      // Features and behaviours are not asked here (owner, 2026-09-13): the keys are not sent, so the store carries them as they are.
      const saved = await request(`/api/team-rosters/${encodeURIComponent(roster.name)}`, { method: 'PUT', json: {
        title: title.value, kind: kind.value().kind, objective: objective.value, project_root: picked.root, repos,
        branches: Object.fromEntries(repos.filter((name) => !worktrees(name) && branches[name]).map((name) => [name, branches[name]])),
        // Spread what was read so a key this card does not draw is carried rather than
        // dropped — but NOT `permissions`, which is ruled out of agent_defaults entirely;
        // spreading it would rewrite a retired field on every save.
        agent_defaults: { ...defaults, permissions: undefined, provider: picked.provider, model: picked.model, reach: picked.reach, recruit: picked.recruit, output: picked.output, dial: 'write', launch_mode: picked.launch_mode },
      } });
      status.textContent = saved.ok ? t('team_config.saved', 'Saved') : saved.message; if (saveAction) saveAction.setDisabled(false); else save.disabled = false; if (saved.ok) optionsArg.onSaved?.(saved.data.roster);
    });
  });
}
