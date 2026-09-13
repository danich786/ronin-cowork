/* Editable reading of one complete durable team_roster. Membership is intentionally absent. */
import { t } from './lexicon.js';
import { request } from './request.js';
import { createWhereItWorks } from './where-it-works.js';
import { loadProviderCatalog, providerModelPair } from './form-steps.js';

const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text != null) node.textContent = String(text); return node; };
const bucket = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const list = (value) => Array.isArray(value) ? value : [];
const lines = (value) => value.split('\n').map((entry) => entry.trim()).filter(Boolean);

const field = (form, label, name, value, kind = 'input', help = '') => {
  const row = el('label', 'tw-config-field'); row.append(el('span', null, label));
  const input = document.createElement(kind); input.classList.add('wk-field-control'); input.name = name; input.value = value || ''; row.append(input);
  if (help) row.append(el('small', null, help)); form.append(row); return input;
};
const select = (form, label, name, values, value) => {
  const input = el('select', 'wk-field-control'); input.name = name;
  for (const item of values) input.add(new Option(item.label, item.value)); input.value = value; const row = el('label', 'tw-config-field'); row.append(el('span', null, label), input); form.append(row); return input;
};
const reading = (form, label, value, empty) => { const row = el('div', 'tw-config-reading'); row.append(el('span', null, label), el('output', null, value || empty)); form.append(row); };
const valueLabel = (value, tr) => ({
  open: tr('campaign_view.option_open', 'Open'), discuss: tr('campaign_view.option_discuss', 'Discuss'), plan: tr('campaign_view.option_plan', 'Plan'), execute: tr('campaign_view.option_execute', 'Execute'), nobody: tr('campaign_view.option_nobody', 'Nobody'),
  'propose agents': tr('campaign_view.option_propose', 'Propose Agents'), 'staff agents': tr('campaign_view.option_staff', 'Staff Agents'), 'a plan': tr('campaign_view.option_a_plan', 'A plan'), ideas: tr('campaign_view.option_ideas', 'Ideas'), code: tr('campaign_view.option_code', 'Code'), 'an artifact': tr('campaign_view.option_artifact', 'An artifact'), 'the team': tr('campaign_view.option_team', 'The Team'),
  user: tr('campaign_view.option_user', 'You only'), read: tr('campaign_view.option_read', 'Read'), write: tr('campaign_view.option_write', 'Read and write'),
  coding: tr('team_config.kind_coding', 'Coding'), work: tr('team_config.kind_work', 'Work'), personal: tr('team_config.kind_personal', 'Personal'), household: tr('team_config.kind_household', 'Household'), social: tr('team_config.kind_social', 'Social'), school: tr('team_config.kind_school', 'School'),
})[value] || value;
const optionRows = (values, tr) => values.map((value) => ({ value, label: value ? valueLabel(value, tr) : tr('team_config.default', 'Default') }));

export function renderTeamConfiguration(host, roster, optionsArg = {}) {
  host.replaceChildren();
  if (!roster?.durable) { host.append(el('p', 'tw-config-empty', t('team_config.no_roster', 'This Team has no saved record.'))); return; }
  const loading = el('p', 'tw-config-empty', t('team_config.loading', 'Loading Team Configuration…')); host.append(loading);

  // The form is painted even into a host that is not in the document: the caller renders
  // only on real change now, so a commons waiting off-screen must receive its form here —
  // nothing will render it again when it is placed. A superseded render's host is a
  // discarded node; painting it is invisible and cheap.
  void Promise.all([request(`/api/launch-seed?team=${encodeURIComponent(roster.name)}`), request('/api/ways'), loadProviderCatalog(), request('/api/project-roots/detail')]).then(([seedResult, wayResult, , rootResult]) => {
    const seed = seedResult.ok ? seedResult.data : null;
    const ways = wayResult.ok && Array.isArray(wayResult.data) ? wayResult.data : [];
    const roots = rootResult.ok && Array.isArray(rootResult.data?.roots) ? rootResult.data.roots.filter((root) => !root.archived) : [];
    const defaults = bucket(roster.agent_defaults); const behaviour = bucket(roster.behaviours);
    const form = el('form', 'tw-config-form'); reading(form, t('team_config.cowork_id', 'Team ID'), roster.name, t('settei.none_set', '— none set —'));
    const title = field(form, t('team_config.title', 'Readable title'), 'title', roster.title);
    // WHERE IT WORKS — the shared control (js/where-it-works.js); the key above it like every field.
    const whereField = el('div', 'tw-config-field'); whereField.append(el('span', null, t('where.label', 'Where it works')));
    const where = createWhereItWorks({ roots, root: roster.project_root, repos: list(roster.repos), branches: bucket(roster.branches), rootDefaultLabel: t('team_config.default', 'Default') });
    whereField.append(where.el); form.append(whereField);
    const kind = select(form, t('team_config.kind', 'Kind'), 'kind', optionRows(['open', 'coding', 'work', 'personal', 'household', 'social', 'school'], t), roster.kind);
    const objective = field(form, t('team_config.objective', 'Purpose'), 'objective', roster.objective, 'textarea');
    const references = field(form, t('team_config.references', 'References'), 'references', list(roster.references).join('\n'), 'textarea', t('team_config.references_help', 'One URL or note per line.'));

    const choices = (legend, rows, selected, required = []) => {
      const set = el('fieldset', 'tw-config-wide tw-choices'); set.append(el('legend', null, legend));
      const inputs = new Map(); const requiredInputs = new Map();
      for (const item of rows) {
        const row = el('label', 'tw-choice'); const input = el('input'); input.type = 'checkbox'; input.checked = selected.includes(item.name);
        inputs.set(item.name, input); const words = el('span'); words.append(el('b', null, item.label || item.name), el('small', null, item.blurb || ''));
        const requiredInput = el('input'); requiredInput.type = 'checkbox'; requiredInput.checked = required.includes(item.name); requiredInput.title = t('team_config.required', 'Required for each new Agent');
        requiredInput.addEventListener('change', () => { if (requiredInput.checked) input.checked = true; });
        if (legend === t('behaviours', 'Behaviours')) {
          requiredInputs.set(item.name, requiredInput);
          const requiredMark = el('span', 'tw-required'); requiredMark.append(requiredInput, t('team_config.required_short', 'Required'));
          row.append(input, words, requiredMark);
        } else row.append(input, words);
        set.append(row);
      }
      form.append(set); return { inputs, requiredInputs };
    };
    const available = (seed?.features || []).filter((row) => (seed?.available || []).includes(row.name));
    const featureChoices = choices(t('features', 'Features'), available, list(roster.features));
    const behaviourChoices = choices(t('behaviours', 'Behaviours'), ways, list(behaviour.selected), list(behaviour.required));

    // THE ONE PICKER (form-steps.js) in this form's own field rows: the Team's provider
    // and model, either standing alone; the Campaign's answer when both are Default.
    const picked = { provider: defaults.provider || '', model: defaults.model || '' };
    const pair = providerModelPair(
      () => picked,
      (provider, model) => { picked.provider = provider; picked.model = model; },
      (label, control) => { const row = el('label', 'tw-config-field'); row.append(el('span', null, label), control); return row; },
      { classes: 'wk-field-control', blank: { provider: t('team_config.default', 'Default'), model: t('team_config.default', 'Default') }, labels: { provider: t('team_config.provider', 'Provider'), model: t('team_config.model', 'Model') } },
    );
    form.append(pair.el);
    const reach = select(form, t('team_config.reach', 'Reach'), 'reach', optionRows(['open', 'discuss', 'plan', 'execute'], t), defaults.reach || 'open');
    const recruit = select(form, t('team_config.recruit', 'Recruit'), 'recruit', optionRows(['open', 'nobody', 'propose agents', 'staff agents'], t), defaults.recruit || 'open');
    const output = select(form, t('team_config.output', 'Output'), 'output', optionRows(['open', 'a plan', 'ideas', 'code', 'an artifact', 'the team'], t), defaults.output || 'open');
    const dial = select(form, t('team_config.dial', 'Control'), 'dial', optionRows(['user', 'read', 'write'], t), defaults.dial || 'write');
    // Measured by @dangerous_mode before their record lands: this card built agent_defaults
    // FRESH rather than spreading what it read, so a save here would have dropped a Team's
    // configured launch mode back to stock without saying so. The ruled display words are
    // the owner's own — "Model provider configuration" and "Dangerously".
    const launchMode = select(form, t('launch_mode.head', 'launch mode'), 'launch_mode', [
      { value: 'configured', label: t('launch_mode.configured', 'Model provider configuration') },
      { value: 'live_dangerously', label: t('launch_mode.live', 'Dangerously') },
    ], defaults.launch_mode || 'live_dangerously');
    form.append(el('p', 'tw-config-note tw-config-wide', t('team_config.next_form', 'These defaults land in the next Agent form that opens. Nothing live changes.')));

    const actions = el('div', 'tw-config-actions'); const status = el('span', 'tw-config-status');
    const saveAction = optionsArg.createAction?.({ label: t('panels.save', 'Save'), size: 'compact' }); const save = saveAction?.el || el('button', null, t('panels.save', 'Save')); save.type = 'submit'; actions.append(status, save); form.append(actions); host.replaceChildren(form);
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (saveAction) saveAction.setDisabled(true); else save.disabled = true; status.textContent = t('team_config.saving', 'Saving…');
      const saved = await request(`/api/team-rosters/${encodeURIComponent(roster.name)}`, { method: 'PUT', json: {
        title: title.value, kind: kind.value, objective: objective.value, project_root: where.root, repos: where.repos(), branches: where.branches(), references: lines(references.value),
        features: [...featureChoices.inputs].filter(([, input]) => input.checked).map(([name]) => name),
        behaviours: {
          selected: [...behaviourChoices.inputs].filter(([, input]) => input.checked).map(([name]) => name),
          required: [...behaviourChoices.requiredInputs].filter(([, input]) => input.checked).map(([name]) => name),
        },
        // Spread what was read so a key this card does not draw is carried rather than
        // dropped — but NOT `permissions`, which is ruled out of agent_defaults entirely;
        // spreading it would rewrite a retired field on every save. (Caught by capturing
        // the PUT body while driving: the spread was faithfully carrying it forward.)
        agent_defaults: { ...defaults, permissions: undefined, provider: picked.provider, model: picked.model, reach: reach.value, recruit: recruit.value, output: output.value, dial: dial.value, launch_mode: launchMode.value },
      } });
      status.textContent = saved.ok ? t('team_config.saved', 'Saved') : saved.message; if (saveAction) saveAction.setDisabled(false); else save.disabled = false; if (saved.ok) optionsArg.onSaved?.(saved.data.roster);
    });
  });
}
