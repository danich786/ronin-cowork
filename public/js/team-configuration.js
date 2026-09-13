/* Editable reading of one complete durable team_roster. Membership is intentionally absent.
 * Every question here is asked through ERABI (ask.js): Where it works, Kind, the Routines
 * switches, the required-behaviours switch, and the Agent defaults (Model · Mandate · Runtime).
 * Loose density: this is a commons page where the questions are the subject. */
import { t } from './lexicon.js';
import { request } from './request.js';
import { ask } from './ask.js';
import { ruledRows } from './glyphs.js';
import { loadProviderCatalog, mandateWord, modelAvailabilityFact, providerCatalog, tierWord } from './form-steps.js';

const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text != null) node.textContent = String(text); return node; };
const bucket = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const list = (value) => Array.isArray(value) ? value : [];
const lines = (value) => value.split('\n').map((entry) => entry.trim()).filter(Boolean);

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
const DIAL = ['user', 'read', 'write'];

export function completeTeamRoutineMap(catalog, stored) {
  const current = bucket(stored);
  return Object.fromEntries(catalog.map((routine) => [routine.name, current[routine.name] === true]));
}

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
  void Promise.all([request('/api/routines'), loadProviderCatalog(), request('/api/project-roots/detail')]).then(([routineResult, , rootResult]) => {
    const routines = routineResult.ok && Array.isArray(routineResult.data) ? routineResult.data : [];
    const roots = rootResult.ok && Array.isArray(rootResult.data?.roots) ? rootResult.data.roots.filter((root) => !root.archived) : [];
    const defaults = bucket(roster.agent_defaults); const behaviour = bucket(roster.behaviours);
    const form = el('form', 'tw-config-form'); reading(form, t('team_config.cowork_id', 'Team ID'), roster.name, t('settei.none_set', '— none set —'));
    const title = field(form, t('team_config.title', 'Readable title'), 'title', roster.title);

    /* ---- Routines: the Team's own on/off map, as switches; read live by Where it works ---- */
    const routineMap = completeTeamRoutineMap(routines, roster.routines);
    const worktreesOn = () => routineMap.ronin_worktrees === true;

    /* ---- Where it works: born in, then the additional workspaces, with a branch line per checkout when worktrees are off ---- */
    const branches = { ...bucket(roster.branches) };
    const rootWasDesk = list(roster.repos).includes(roster.project_root); // a birthplace that is also a desk stays one
    const rootRows = () => roots.map((root) => ({ v: root.name, l: root.name, word: root.repo_profile?.worktrees === 'enabled' ? t('where.worktree', 'worktree') : t('where.checkout', 'checkout') }));
    const branchLine = (option) => {
      if (worktreesOn()) return null;
      const input = el('input'); input.type = 'text'; input.spellcheck = false; input.value = branches[option.v] || '';
      input.placeholder = t('where.col_branch', 'Branch');
      input.addEventListener('input', () => { branches[option.v] = input.value.trim(); });
      return input;
    };
    const where = ask([{ group: t('where.label', 'Where it works'), fields: [
      { key: 'root', label: t('where.born_in', 'Born in'), blank: t('team_config.default', 'Default'), options: rootRows },
      { key: 'repos', label: t('where.additional', 'Additional workspaces'), many: true, after: 'root', options: (value) => rootRows().filter((row) => row.v !== value.root), row: branchLine },
    ] }], { value: { root: roster.project_root || '', repos: list(roster.repos).filter((name) => name !== roster.project_root) } });
    form.append(where.el);

    /* ---- Kind ---- */
    const kind = ask([{ group: t('team_config.kind', 'Kind'), fields: [
      { key: 'kind', label: t('team_config.kind', 'Kind'), shape: 'square', options: ruledRows('kind', ['open', 'coding', 'work', 'personal', 'household', 'social', 'school'], kindWord) },
    ] }], { value: { kind: roster.kind || 'open' } });
    form.append(kind.el);
    const objective = field(form, t('team_config.objective', 'Purpose'), 'objective', roster.objective, 'textarea');
    const references = field(form, t('team_config.references', 'References'), 'references', list(roster.references).join('\n'), 'textarea', t('team_config.references_help', 'One URL or note per line.'));

    // THE KIT AS SELECTED, kept beside the editable map below: what an Agent born here is
    // equipped with, in one line, in the catalog's own owner-facing labels. The floor is not
    // a switch and is not listed; with nothing on above it, the honest answer is the floor alone.
    const kitReading = el('output');
    const paintKit = () => { const on = routines.filter((routine) => routineMap[routine.name]).map((routine) => routine.label || routine.name); kitReading.textContent = on.length ? on.join(' · ') : t('team_config.kit_floor_alone', 'the floor alone — no Routine is on'); };
    const kitRow = el('div', 'tw-config-reading tw-config-wide'); kitRow.append(el('span', null, t('team_kit', 'Shared toolkit')), kitReading); form.append(kitRow); paintKit();
    const worktreesMode = el('div', 'tw-worktrees-mode');
    const paintWorktreesMode = () => {
      worktreesMode.replaceChildren(
        el('b', null, t('team_config.worktrees_mode', 'Agent work mode')),
        el('strong', null, worktreesOn() ? t('team_config.worktrees_on', 'Own worktree where the Workspace folder allows it') : t('team_config.worktrees_off', 'Use the project checkout and its branches')),
        el('small', null, t('team_config.worktrees_help', 'Worktrees give each Agent a separate working folder and branch, so their file changes do not collide. They run only when both the Agent and repo have Worktrees on, and use the managed hand-in and Team-lead merge process.')),
      );
    };
    const routineAsk = ask([{ group: t('team_config.routines', 'Routines'), fields: routines.map((routine) => ({
      key: routine.name, label: routine.label || routine.name, switch: [t('on', 'On'), t('off', 'Off')],
    })) }], {
      value: { ...routineMap },
      onChange: (value, key) => { routineMap[key] = value[key] === true; paintKit(); paintWorktreesMode(); },
    });
    const routineBlock = el('div', 'tw-config-wide tw-routines-block');
    routineBlock.append(el('p', 'tw-config-note', t('team_config.routines_help', 'This complete on/off map is the Team’s own and is inherited by new Agents. It replaces the Campaign defaults; existing Agents do not change.')), routineAsk.el, worktreesMode);
    paintWorktreesMode();
    form.append(routineBlock);

    /* ---- Behaviours ---- */
    const behaviours = field(form, t('team_config.behaviours', 'Behaviours'), 'behaviours', list(behaviour.books).join('\n'), 'textarea', t('team_config.behaviours_help', 'One shelf:name book per line.'));
    const required = ask([{ group: t('team_config.required', 'Require these behaviours for each new Agent'), fields: [{ key: 'required', label: t('team_config.required_short', 'Required'), switch: [t('yes', 'Yes'), t('no', 'No')] }] }], { value: { required: behaviour.required === true } });
    form.append(required.el);

    /* ---- Agent defaults: Model · Mandate · Runtime ---- */
    const launchModes = [
      { v: 'configured', l: t('launch_mode.configured', 'Model provider configuration'), sub: t('launch_mode.configured_sub', 'Ronin adds nothing to the command. The Agent starts with whatever its provider CLI already loads.') },
      { v: 'live_dangerously', l: t('launch_mode.live', 'Dangerously'), sub: t('launch_mode.live_sub', 'Ronin appends that provider’s own bypass flag, so the Agent does not stop to ask.') },
    ];
    const agentDefaults = ask([
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
        { key: 'dial', label: t('team_config.dial', 'Control'), shape: 'square', options: ruledRows('dial', DIAL, mandateWord) },
        { key: 'launch_mode', label: t('launch_mode.head', 'launch mode'), options: launchModes },
      ] },
    ], { value: {
      provider: defaults.provider || '', model: defaults.model || '',
      reach: defaults.reach || 'open', recruit: defaults.recruit || 'open', output: [defaults.output || 'open'].flat().filter(Boolean),
      dial: defaults.dial || 'write', launch_mode: defaults.launch_mode || 'live_dangerously',
    } });
    form.append(agentDefaults.el);
    form.append(el('p', 'tw-config-note tw-config-wide', t('team_config.next_form', 'These defaults land in the next Agent form that opens. Nothing live changes.')));

    const actions = el('div', 'tw-config-actions'); const status = el('span', 'tw-config-status');
    const saveAction = optionsArg.createAction?.({ label: t('panels.save', 'Save'), size: 'compact' }); const save = saveAction?.el || el('button', null, t('panels.save', 'Save')); save.type = 'submit'; actions.append(status, save); form.append(actions); host.replaceChildren(form);
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (saveAction) saveAction.setDisabled(true); else save.disabled = true; status.textContent = t('team_config.saving', 'Saving…');
      const place = where.value(); const picked = agentDefaults.value();
      const repos = rootWasDesk && place.root && place.root === roster.project_root ? [place.root, ...place.repos.filter((name) => name !== place.root)] : place.repos.filter((name) => name !== place.root);
      const saved = await request(`/api/team-rosters/${encodeURIComponent(roster.name)}`, { method: 'PUT', json: {
        title: title.value, kind: kind.value().kind, objective: objective.value, project_root: place.root, repos,
        branches: worktreesOn() ? {} : Object.fromEntries(repos.filter((name) => branches[name]).map((name) => [name, branches[name]])), references: lines(references.value),
        routines: { ...routineMap }, behaviours: { books: lines(behaviours.value), required: required.value().required === true },
        // Spread what was read so a key this card does not draw is carried rather than
        // dropped — but NOT `permissions`, which is ruled out of agent_defaults entirely;
        // spreading it would rewrite a retired field on every save.
        agent_defaults: { ...defaults, permissions: undefined, provider: picked.provider, model: picked.model, reach: picked.reach, recruit: picked.recruit, output: picked.output, dial: picked.dial, launch_mode: picked.launch_mode },
      } });
      status.textContent = saved.ok ? t('team_config.saved', 'Saved') : saved.message; if (saveAction) saveAction.setDisabled(false); else save.disabled = false; if (saved.ok) optionsArg.onSaved?.(saved.data.roster);
    });
  });
}
