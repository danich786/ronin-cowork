/* part of the ronin-cowork client — see js/README.md */
/** Campaign Team and Agent defaults. These values seed the next form; they never edit a live Team or Agent. */
import { t } from './lexicon.js';
import { saveCampaign } from './campaigns.js';
import { WorkspaceKit } from './workspace-kit.js';
import { ask } from './ask.js';
import { createBriefSettingsPanel } from './brief-step.js';

const el = (tag, cls, text) => { const out = document.createElement(tag); if (cls) out.className = cls; if (text != null) out.textContent = String(text); return out; };
const bucket = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const list = (value) => Array.isArray(value) ? value : [];
// The Campaign is the TOP of this cascade — campaign → team → launch — so the stock value
// has to be settable somewhere, and this card is that somewhere.
const CHOICES = Object.freeze({ reach: ['open', 'discuss', 'plan', 'execute'], recruit: ['open', 'nobody', 'propose agents', 'staff agents'], output: ['open', 'a plan', 'ideas', 'code', 'an artifact', 'the team', 'no code'], launch_mode: ['configured', 'live_dangerously'] });
const optionLabel = (value) => ({
  open: t('campaign_view.option_open', 'Open'), discuss: t('campaign_view.option_discuss', 'Discuss'), plan: t('campaign_view.option_plan', 'Plan'), execute: t('campaign_view.option_execute', 'Execute'),
  nobody: t('campaign_view.option_nobody', 'Nobody'), 'propose agents': t('campaign_view.option_propose', 'Propose Agents'), 'staff agents': t('campaign_view.option_staff', 'Staff Agents'),
  'a plan': t('campaign_view.option_a_plan', 'A plan'), ideas: t('campaign_view.option_ideas', 'Ideas'), code: t('campaign_view.option_code', 'Code'), 'an artifact': t('campaign_view.option_artifact', 'An artifact'), 'the team': t('campaign_view.option_team', 'The Team'), 'no code': t('campaign_view.option_no_code', 'No code'),
  configured: t('launch_mode.configured', 'Native'), live_dangerously: t('launch_mode.live', 'Dangerously'),
})[value] || value;

export function createAgentDefaultsSurface(campaign) {
  const { createSurface, createNotice } = WorkspaceKit.primitives;
  const surface = createSurface({ label: t('campaign_view.defaults', 'Defaults'), className: 'cv-surface' });
  const body = el('div', 'cv-body'); surface.content.append(body);
  let edited = null;

  function paint() {
    const row = campaign(); body.replaceChildren();
    if (!row) return surface.setState('empty', t('campaign_view.none_selected', 'No Campaign selected.'));
    surface.setState(null, '');
    const current = bucket(row.config?.defaults);
    const form = el('form', 'cv-defaults-form');
    const questionsRow = el('div', 'cv-default-field');
    const notice = createNotice();
    body.append(el('p', 'cv-note', t('campaign_view.defaults_help', 'These defaults land in the next Team or Agent form that opens. They remain editable there; nothing live changes.')));
    body.append(el('p', 'cv-note', t('campaign_view.defaults_models', 'Models are set in Models > Defaults.')));
    let picked = edited || {
      reach: current.reach || CHOICES.reach[0], recruit: current.recruit || CHOICES.recruit[0],
      output: list(current.output), launch_mode: current.launch_mode || CHOICES.launch_mode[0],
    };
    const questions = ask([
      { group: t('mandate', 'Mandate'), fields: [
        { key: 'reach', label: t('campaign_view.default_reach', 'Reach'), options: CHOICES.reach.map((value) => ({ v: value, l: optionLabel(value) })) },
        { key: 'recruit', label: t('campaign_view.default_recruit', 'Recruit'), options: CHOICES.recruit.map((value) => ({ v: value, l: optionLabel(value) })) },
        { key: 'output', label: t('campaign_view.default_output', 'Output'), many: true, options: CHOICES.output.map((value) => ({ v: value, l: optionLabel(value) })) },
      ] },
      { group: t('campaign_view.defaults_runtime', 'Runtime'), fields: [
        { key: 'launch_mode', label: t('launch_mode.head', 'Launch mode'), options: [
          { v: 'configured', l: optionLabel('configured'), sub: t('launch_mode.configured_sub', 'Do not override the provider CLI’s approval behavior. Model selection is separate.') },
          { v: 'live_dangerously', l: optionLabel('live_dangerously'), sub: t('launch_mode.live_sub', 'Use that provider CLI’s own approval-bypass launch.') },
        ] },
      ] },
    ], { value: picked, trayHost: questionsRow, onChange: (value) => { picked = value; edited = value; } });
    questionsRow.append(questions.el); form.append(questionsRow);
    const actions = el('div', 'cv-default-actions');
    const save = el('button', 'cv-save', t('panels.save', 'Save')); save.type = 'submit'; actions.append(notice.el, save); form.append(actions); body.append(form);
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); save.disabled = true; notice.set('info', t('campaign.saving', 'saving…'));
      const { behaviours: _gone, ...kept } = current; // the Campaign's behaviours are its brief settings now (below)
      const next = { ...kept, ...picked };
      const result = await saveCampaign(row.id, { config: { defaults: next } });
      notice.set(result.ok ? 'success' : 'failed', result.ok ? t('settei.saved', 'saved') : result.message); save.disabled = false;
      if (result.ok) { edited = null; paint(); }
    });
    /* What every Agent in this Campaign is told: its brief settings, saved on their own because they reach live Agents. */
    const brief = createBriefSettingsPanel({ layer: 'campaign', id: row.id, campaignId: row.id, createAction: WorkspaceKit.primitives.createAction });
    body.append(el('h3', 'cv-brief-head', t('behaviours', 'Behaviors')), el('p', 'cv-note', t('campaign_view.brief_help', 'What every Agent in this Campaign is told. Agents already working are sent the change.')), brief.el);
    void brief.enter();
  }

  return { el: surface.el, enter: () => paint() };
}

export function defaultsSummary(campaign) {
  const defaults = bucket(campaign?.config?.defaults);
  return t('campaign_view.defaults_reach', 'Reach {reach}', { reach: defaults.reach || 'open' });
}
