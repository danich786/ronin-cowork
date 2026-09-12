/* part of the ronin-cowork client — see js/README.md */
/** Campaign Agent defaults. These values seed the next form; they never edit a live Agent. */
import { t } from './lexicon.js';
import { saveCampaign } from './campaigns.js';
import { WorkspaceKit } from './workspace-kit.js';
import { loadProviderCatalog, providerCatalog, modelAvailabilityFact } from './form-steps.js';
import { ask } from './ask.js';
import { ruledRows } from './glyphs.js';

const el = (tag, cls, text) => { const out = document.createElement(tag); if (cls) out.className = cls; if (text != null) out.textContent = String(text); return out; };
const bucket = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const list = (value) => Array.isArray(value) ? value : [];
// The Campaign is the TOP of this cascade — campaign → team → launch — so the stock value
// has to be settable somewhere, and this card is that somewhere.
const CHOICES = Object.freeze({ reach: ['open', 'discuss', 'plan', 'execute'], recruit: ['open', 'nobody', 'propose agents', 'staff agents'], output: ['open', 'a plan', 'ideas', 'code', 'an artifact', 'the team', 'no code'], dial: ['user', 'read', 'write'], launch_mode: ['configured', 'live_dangerously'] });
const optionLabel = (value) => ({
  open: t('campaign_view.option_open', 'Open'), discuss: t('campaign_view.option_discuss', 'Discuss'), plan: t('campaign_view.option_plan', 'Plan'), execute: t('campaign_view.option_execute', 'Execute'),
  nobody: t('campaign_view.option_nobody', 'Nobody'), 'propose agents': t('campaign_view.option_propose', 'Propose Agents'), 'staff agents': t('campaign_view.option_staff', 'Staff Agents'),
  'a plan': t('campaign_view.option_a_plan', 'A plan'), ideas: t('campaign_view.option_ideas', 'Ideas'), code: t('campaign_view.option_code', 'Code'), 'an artifact': t('campaign_view.option_artifact', 'An artifact'), 'the team': t('campaign_view.option_team', 'The Team'), 'no code': t('campaign_view.option_no_code', 'No code'),
  user: t('campaign_view.option_user', 'You only'), read: t('campaign_view.option_read', 'Read'), write: t('campaign_view.option_write', 'Read and write'),
  configured: t('launch_mode.configured', 'Model provider configuration'), live_dangerously: t('launch_mode.live', 'Dangerously'),
})[value] || value;

const labeled = (form, label, control, help = '') => {
  const row = el('label', 'cv-default-field'); row.append(el('span', 'cv-default-label', label), control);
  if (help) row.append(el('small', 'cv-from', help)); form.append(row); return control;
};
export function createAgentDefaultsSurface(campaign) {
  const { createSurface, createNotice } = WorkspaceKit.primitives;
  const surface = createSurface({ label: t('campaign_view.agent_defaults', 'Agent defaults'), className: 'cv-surface' });
  const body = el('div', 'cv-body'); surface.content.append(body);

  function paint() {
    const row = campaign(); body.replaceChildren();
    if (!row) return surface.setState('empty', t('campaign_view.none_selected', 'No Campaign selected.'));
    surface.setState(null, '');
    const current = bucket(row.config?.agent_defaults);
    const form = el('form', 'cv-defaults-form');
    const notice = createNotice();
    body.append(el('p', 'cv-note', t('campaign_view.defaults_help', 'These defaults land in the next Team or Agent form that opens. They remain editable there; nothing live changes.')));
    const catalog = providerCatalog().rows;
    const providers = catalog.filter((row, index) => catalog.findIndex((other) => other.provider === row.provider) === index);
    const reason = (providerRow) => providerRow.off
      ? t('forms.reason_turned_off', 'turned off')
      : providerRow.listed === false && providerRow.model_list_current
        ? t('forms.reason_not_listed', 'not listed by your {cli} {client_version}', { cli: providerRow.cli_label || providerRow.cli, client_version: providerRow.model_list?.client_version || '' })
        : t('forms.reason_not_on_machine', 'not on this machine');
    let picked = {
      provider: String(current.provider || ''), model: String(current.model || ''),
      reach: current.reach || CHOICES.reach[0], recruit: current.recruit || CHOICES.recruit[0],
      output: list(current.output), dial: current.dial || CHOICES.dial[0], launch_mode: current.launch_mode || CHOICES.launch_mode[0],
    };
    const questions = ask([
      { group: t('new_agent.model_package', 'Model'), fields: [
        { key: 'provider', label: t('campaign_view.col_provider', 'Provider'), blank: t('campaign_view.provider_default', 'Default provider'), options: providers.map((row) => ({ v: row.provider, l: row.provider_label, off: row.operational ? '' : reason(row) })) },
        { key: 'model', label: t('campaign_view.col_model', 'Preferred model'), blank: t('campaign_view.model_default', 'Default model'), after: 'provider', options: (value) => catalog.filter((row) => row.provider === value.provider).map((row) => ({ v: row.model, l: row.model, word: row.tier, sub: modelAvailabilityFact(row), off: row.operational && row.listed !== false ? '' : reason(row) })) },
      ] },
      { group: t('mandate', 'Mandate'), fields: [
        { key: 'reach', label: t('campaign_view.default_reach', 'Reach'), shape: 'square', options: ruledRows('reach', CHOICES.reach, optionLabel) },
        { key: 'recruit', label: t('campaign_view.default_recruit', 'Recruit'), shape: 'square', options: ruledRows('recruit', CHOICES.recruit, optionLabel) },
        { key: 'output', label: t('campaign_view.default_output', 'Output'), shape: 'square', many: true, options: ruledRows('output', CHOICES.output, optionLabel) },
      ] },
      { group: t('campaign_view.defaults_runtime', 'Runtime'), fields: [
        { key: 'dial', label: t('campaign_view.default_dial', 'Control'), shape: 'square', options: ruledRows('dial', CHOICES.dial, optionLabel) },
        { key: 'launch_mode', label: t('launch_mode.head', 'Launch mode'), options: [
          { v: 'configured', l: optionLabel('configured'), sub: t('launch_mode.configured_sub', 'Ronin adds nothing to the command. The Agent starts with whatever its provider CLI already loads.') },
          { v: 'live_dangerously', l: optionLabel('live_dangerously'), sub: t('launch_mode.live_sub', 'Ronin appends that provider’s own bypass flag, so the Agent does not stop to ask.') },
        ] },
      ] },
    ], { value: picked, onChange: (value) => { picked = value; } });
    form.append(questions.el);
    const behaviours = el('textarea', 'cv-input'); behaviours.value = list(current.behaviours).join('\n');
    labeled(form, t('campaign_view.default_behaviours', 'Behaviours'), behaviours, t('campaign_view.behaviours_help', 'One shelf:name book per line.'));
    const actions = el('div', 'cv-default-actions');
    const save = el('button', 'cv-save', t('panels.save', 'Save')); save.type = 'submit'; actions.append(notice.el, save); form.append(actions); body.append(form);
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); save.disabled = true; notice.set('info', t('campaign.saving', 'saving…'));
      const next = { ...current, ...picked, behaviours: behaviours.value.split('\n').map((value) => value.trim()).filter(Boolean) };
      const result = await saveCampaign(row.id, { config: { agent_defaults: next } });
      notice.set(result.ok ? 'success' : 'failed', result.ok ? t('settei.saved', 'saved') : result.message); save.disabled = false;
      if (result.ok) paint();
    });
  }

  return { el: surface.el, enter: () => void loadProviderCatalog().then(paint) };
}

export function defaultsSummary(campaign) {
  const defaults = bucket(campaign?.config?.agent_defaults);
  const model = [defaults.provider, defaults.model].filter(Boolean).join(' · ') || t('campaign_view.provider_default', 'Default provider');
  return t('campaign_view.defaults_summary', '{model} · {reach} · {dial}', { model, reach: defaults.reach || 'open', dial: defaults.dial || 'write' });
}
