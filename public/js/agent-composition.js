import { WorkspaceKit } from './workspace-kit.js';
import { request } from './request.js';
import { t } from './lexicon.js';
import { ask } from './ask.js';
import { createStep, readingRows, tagRow } from './form-steps.js';

export const AGENT_COMPOSITION_TYPE = 'agent.composition';
const REACH = ['open', 'discuss', 'plan', 'execute'];
const RECRUIT = ['open', 'nobody', 'propose agents', 'staff agents'];
const OUTPUT = ['open', 'ideas', 'a plan', 'code', 'an artifact', 'the team'];
const el = (tag, cls = '', text = '') => { const node = document.createElement(tag); if (cls) node.className = cls; if (text) node.textContent = text; return node; };
const rows = (values) => values.map((value) => ({ v: value, l: value }));
function mandateLine(value) {
  return value ? [value.reach, value.recruit, ...(value.output || [])].filter(Boolean).join(' · ') : t('agent_composition.birth_unavailable', 'Unavailable in this legacy birth receipt');
}
// The few words a conditional behaviour gives as its reason; lead implies team.
function reasonWords(requires) {
  const words = {
    'arrangement:managed': t('agent_composition.because_managed', 'Managed worktree'),
    'arrangement:checkout': t('agent_composition.because_checkout', 'Shared checkout'),
    team: t('agent_composition.because_team', 'On a Team'),
    lead: t('agent_composition.because_lead', 'Team lead'),
    project_management: t('agent_composition.because_project_management', 'Project management on'),
  };
  return requires.filter((need) => !(need === 'team' && requires.includes('lead'))).map((need) => words[need] || need).join(' · ');
}
function sendsRows(rows) {
  // A conditional's reason names it ("Team lead"); "since birth" marks one the Agent was not born with.
  const tag = (row, reason = '') => ({
    text: [reason || row.label || row.name, row.since_birth ? t('agent_composition.since_birth', 'since birth') : ''].filter(Boolean).join(' · '),
    on: row.since_birth,
  });
  const none = t('agent_composition.none', 'None');
  return readingRows([
    [t('agent_composition.always', 'Always'), tagRow(rows.filter((row) => row.scope === 'floor').map((row) => tag(row)), none)],
    [t('agent_composition.because', 'Because'), tagRow(rows.filter((row) => row.scope === 'conditional').map((row) => tag(row, reasonWords(row.requires))), none)],
  ]);
}
function behaviourList(items) {
  return items?.length ? items.map((row) => row.name).join(', ') : t('agent_composition.none', 'None');
}

/**
 * THE ONE COMPOSITION BODY (owner, 2026-10-20): the composition tile and an opened Commons
 * roster row paint it alike, as the kit's unnumbered sections (createStep) in the launch
 * forms' format — Brief (what it was born with, read only), Mandate, Behaviors (Always and
 * Because as the brief carries them; Chosen as ticks) — and one act, UPDATE (owner,
 * 2026-10-24): disabled until something changed; pressed, Ronin writes the configuration,
 * builds the Agent a new brief and tells it once to read it. Its answer stays in the kit's notice.
 */
export function createAgentCompositionReader(agent, { setState = () => {} } = {}) {
  const body = el('div', 'ac-body');
  let questions = [];
  const load = async () => {
    for (const question of questions) question.destroy(); questions = [];
    body.replaceChildren(el('p', 'ac-status', t('forms.loading', 'Loading…')));
    const result = await request(`/api/sessions/${encodeURIComponent(agent)}/composition`, { cache: 'no-store' });
    if (!result.ok) return setState('failed', result.message);
    setState(null, ''); render(result.data);
  };
  const render = (data) => {
    body.replaceChildren();
    const section = (key, title) => { const step = createStep({ key, title }); body.append(step.el); return step.body; };
    const brief = section('brief', t('agent_composition.brief', 'Brief'));
    brief.append(
      el('pre', 'ac-brief', data.birth.brief || t('agent_composition.no_brief', 'No saved brief.')),
      el('p', 'ac-line', t('agent_composition.born_with', 'Born with {mandate} · {behaviours}', { mandate: mandateLine(data.birth.mandate), behaviours: behaviourList(data.birth.behaviours) })),
    );
    let refresh = () => {};
    const mandate = section('mandate', t('mandate', 'Mandate'));
    const mandateQuestion = ask([{ fields: [
      { key: 'reach', label: t('team_config.reach', 'Reach'), options: rows(REACH) },
      { key: 'recruit', label: t('team_config.recruit', 'Recruit'), options: rows(RECRUIT) },
      { key: 'output', label: t('team_config.output', 'Output'), many: true, options: rows(OUTPUT) },
    ] }], { value: data.current.mandate, density: 'tight', onChange: () => refresh() }); questions.push(mandateQuestion);
    mandate.append(mandateQuestion.el);
    const behaviours = section('behaviours', t('behaviours', 'Behaviors'));
    // Always and Because as the brief carries them; Chosen is the ticks, the whole list Update writes.
    if (data.sends?.rows) behaviours.append(sendsRows(data.sends.rows));
    if (data.sends?.error) behaviours.append(el('p', 'ac-status', data.sends.error));
    const chosenNow = data.current.behaviours.map((row) => row.name).filter((name) => data.available_behaviours.some((row) => row.name === name));
    const chosenQuestion = ask([{ fields: [{ key: 'behaviours', label: t('agent_composition.chosen', 'Chosen'), many: true, options: data.available_behaviours.map((row) => ({ v: row.name, l: row.label || row.name, sub: row.blurb, read: row.path })) }] }], { value: { behaviours: chosenNow }, density: 'tight', onChange: () => refresh() }); questions.push(chosenQuestion);
    behaviours.append(chosenQuestion.el);
    // UPDATE: the one act over the whole body.
    const update = el('button', 'wk-action', t('agent_composition.update', 'Update')); update.type = 'button';
    const notice = WorkspaceKit.primitives.createNotice();
    const value = () => ({ mandate: mandateQuestion.value(), behaviours: chosenQuestion.value().behaviours || [] });
    let loaded = JSON.stringify(value());
    refresh = () => { update.disabled = JSON.stringify(value()) === loaded; };
    refresh();
    update.addEventListener('click', async () => {
      update.disabled = true; notice.set('info', t('agent_composition.updating', 'Updating…'));
      const sent = await request(`/api/sessions/${encodeURIComponent(agent)}/configuration`, { method: 'PUT', json: value() });
      if (!sent.ok) { notice.set('failed', sent.message); refresh(); return; }
      loaded = JSON.stringify(value()); refresh();
      notice.set('success', t('agent_composition.updated', 'Configuration updated; the Agent is told to read its new brief.'));
    });
    const act = el('div', 'ac-update'); act.append(update, notice.el); body.append(act);
  };
  return { el: body, show: load, destroy: () => { for (const question of questions) question.destroy(); questions = []; } };
}

export function createAgentCompositionSurface(agent) {
  const surface = WorkspaceKit.primitives.createSurface({ label: t('agent_composition.title', 'Agent composition'), className: 'agent-composition' });
  const reader = createAgentCompositionReader(agent, { setState: surface.setState });
  surface.content.append(reader.el);
  return { el: surface.el, show: reader.show, destroy: reader.destroy };
}
