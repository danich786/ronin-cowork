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
  // A conditional's reason names it ("Team lead"); "since birth" marks one a resend would add.
  const tag = (row, reason = '') => ({
    text: [reason || row.label || row.name, row.since_birth ? t('agent_composition.since_birth', 'since birth') : ''].filter(Boolean).join(' · '),
    on: row.since_birth,
  });
  const none = t('agent_composition.none', 'None');
  return readingRows([
    [t('agent_composition.always', 'Always'), tagRow(rows.filter((row) => row.scope === 'floor').map((row) => tag(row)), none)],
    [t('agent_composition.because', 'Because'), tagRow(rows.filter((row) => row.scope === 'conditional').map((row) => tag(row, reasonWords(row.requires))), none)],
    [t('agent_composition.chosen', 'Chosen'), tagRow(rows.filter((row) => row.scope === 'selected').map((row) => tag(row)), none)],
  ]);
}
function behaviourList(items) {
  return items?.length ? items.map((row) => row.name).join(', ') : t('agent_composition.none', 'None');
}

/**
 * THE ONE COMPOSITION BODY (owner, 2026-10-20): the composition tile and an opened Commons
 * roster row paint it alike, as the kit's unnumbered sections (createStep) in the launch
 * forms' format — Brief (what it was born with, read only), Mandate (the effective facts,
 * Save beside them), Behaviors (the current list; the picker and Add on one row).
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
    // Rebuilt from today's files the way birth builds it; the Agent is told once to read it.
    const resend = el('button', 'wk-action', t('agent_composition.resend_brief', 'Resend birth brief')); resend.type = 'button'; const resendStatus = el('p', 'ac-status');
    resend.addEventListener('click', async () => { resend.disabled = true; const sent = await request(`/api/sessions/${encodeURIComponent(agent)}/composition/brief`, { method: 'POST', json: {} }); resend.disabled = false; resendStatus.textContent = sent.ok ? t('agent_composition.brief_queued', 'Birth brief rebuilt; the Agent is told to read it.') : sent.message; });
    brief.append(resend, resendStatus);
    const mandate = section('mandate', t('mandate', 'Mandate'));
    const form = el('form', 'ac-mandate');
    const question = ask([{ fields: [
      { key: 'reach', label: t('team_config.reach', 'Reach'), options: rows(REACH) },
      { key: 'recruit', label: t('team_config.recruit', 'Recruit'), options: rows(RECRUIT) },
      { key: 'output', label: t('team_config.output', 'Output'), many: true, options: rows(OUTPUT) },
    ] }], { value: data.current.mandate, density: 'tight' }); questions.push(question);
    const save = el('button', 'wk-action', t('forms.save', 'Save')); save.type = 'submit'; const status = el('p', 'ac-status');
    form.append(question.el, save); mandate.append(form, status);
    form.addEventListener('submit', async (event) => { event.preventDefault(); save.disabled = true; const changed = await request(`/api/sessions/${encodeURIComponent(agent)}/composition/mandate`, { method: 'PUT', json: question.value() }); save.disabled = false; status.textContent = changed.ok ? t('agent_composition.mandate_saved', 'Work record updated; notice queued.') : changed.message; if (changed.ok) void load(); });
    const behaviours = section('behaviours', t('behaviours', 'Behaviors'));
    // Every behaviour a resend would send (Always, Because, Chosen); only Chosen is editable.
    behaviours.append(data.sends?.rows ? sendsRows(data.sends.rows) : el('p', 'ac-list', behaviourList(data.current.behaviours)));
    if (data.sends?.error) behaviours.append(el('p', 'ac-status', data.sends.error));
    const available = data.available_behaviours.filter((row) => !data.current.behaviours.some((item) => item.name === row.name));
    if (available.length) {
      const picker = ask([{ fields: [{ key: 'name', label: t('agent_composition.add_behavior', 'Add Behavior'), options: available.map((row) => ({ v: row.name, l: row.label || row.name, sub: row.blurb, read: row.path })) }] }], { value: { name: available[0].name }, density: 'tight' }); questions.push(picker);
      const add = el('button', 'wk-action', t('forms.add', 'Add')); add.type = 'button'; const addStatus = el('p', 'ac-status');
      add.addEventListener('click', async () => { add.disabled = true; const changed = await request(`/api/sessions/${encodeURIComponent(agent)}/composition/behaviours`, { method: 'POST', json: picker.value() }); add.disabled = false; addStatus.textContent = changed.ok ? t('agent_composition.behavior_queued', 'Teaching queued for the Agent.') : changed.message; if (changed.ok) void load(); });
      const row = el('div', 'ac-add'); row.append(picker.el, add); behaviours.append(row, addStatus);
    }
    else behaviours.append(el('p', 'ac-line', t('agent_composition.no_additions', 'No further optional Behaviors are available.')));
  };
  return { el: body, show: load, destroy: () => { for (const question of questions) question.destroy(); questions = []; } };
}

export function createAgentCompositionSurface(agent) {
  const surface = WorkspaceKit.primitives.createSurface({ label: t('agent_composition.title', 'Agent composition'), className: 'agent-composition' });
  const reader = createAgentCompositionReader(agent, { setState: surface.setState });
  surface.content.append(reader.el);
  return { el: surface.el, show: reader.show, destroy: reader.destroy };
}
