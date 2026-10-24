import { WorkspaceKit } from './workspace-kit.js';
import { request } from './request.js';
import { t } from './lexicon.js';
import { ask } from './ask.js';
import { createStep, readingRows } from './form-steps.js';

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
function behaviourList(items) {
  return items?.length ? items.map((row) => row.name).join(', ') : t('agent_composition.none', 'None');
}
// A behaviour as the launch forms list it: the label, a few words under it, its page to read.
const behaviourRow = (row, sub, disabled = false) => ({ v: row.name, l: row.label || row.name, sub, read: row.path, disabled });

/**
 * THE ONE COMPOSITION BODY (owner, 2026-10-20): the composition tile and an opened Commons
 * roster row paint it alike, as the kit's unnumbered sections (createStep) in the launch
 * forms' format — Brief (the packet's path and what it was born with, read only), Mandate (the
 * stones), Behaviors (the New Agent form's lists: Always and Because read only, Chosen as ticks).
 * UPDATE (owner, 2026-10-24) is the body's one act: the host puts `action` in its one action
 * row as the primary; it wakes when something changed; pressed, Ronin writes the configuration,
 * builds the Agent a new brief and tells it once to read it; its answer stays in the kit's notice.
 */
export function createAgentCompositionReader(agent, { setState = () => {} } = {}) {
  const { createAction, createNotice } = WorkspaceKit.primitives;
  const body = el('div', 'ac-body');
  const action = createAction({ label: t('agent_composition.update', 'Update'), kind: 'primary' });
  const notice = createNotice();
  action.el.disabled = true;
  let questions = [];
  let value = () => null;
  let loaded = '';
  const refresh = () => { action.el.disabled = JSON.stringify(value()) === loaded; };
  const load = async () => {
    for (const question of questions) question.destroy(); questions = [];
    action.el.disabled = true; notice.set();
    body.replaceChildren(el('p', 'ac-status', t('forms.loading', 'Loading…')));
    const result = await request(`/api/sessions/${encodeURIComponent(agent)}/composition`, { cache: 'no-store' });
    if (!result.ok) return setState('failed', result.message);
    setState(null, ''); render(result.data);
  };
  const render = (data) => {
    body.replaceChildren();
    const section = (key, title) => { const step = createStep({ key, title }); body.append(step.el); return step.body; };
    const brief = section('brief', t('agent_composition.brief', 'Brief'));
    brief.append(readingRows([
      [t('agent_composition.path', 'Path'), data.readme || ''],
      [t('agent_composition.born_with_key', 'Born with'), `${mandateLine(data.birth.mandate)} · ${behaviourList(data.birth.behaviours)}`],
    ]));
    const mandate = section('mandate', t('mandate', 'Mandate'));
    const mandateQuestion = ask([{ fields: [
      { key: 'reach', label: t('team_config.reach', 'Reach'), options: rows(REACH) },
      { key: 'recruit', label: t('team_config.recruit', 'Recruit'), options: rows(RECRUIT) },
      { key: 'output', label: t('team_config.output', 'Output'), many: true, options: rows(OUTPUT) },
    ] }], { value: data.current.mandate, density: 'tight', onChange: refresh }); questions.push(mandateQuestion);
    mandate.append(mandateQuestion.el);
    const behaviours = section('behaviours', t('behaviours', 'Behaviors'));
    // The New Agent form's lists (new-agent.js paintShelves), as rows: Always and Because read only, Chosen the ticks.
    const sends = data.sends?.rows || [];
    const since = (row) => (row.since_birth ? t('agent_composition.since_birth', 'since birth') : '');
    const readonly = (label, key, list, sub) => ask([{ group: label, fields: [{ key, label, many: true, options: list.map((row) => behaviourRow(row, sub(row), true)) }] }], { value: { [key]: [] }, className: 'na-behaviour-readonly', density: 'tight', exposed: true });
    const always = readonly(t('agent_composition.always', 'Always'), 'always', sends.filter((row) => row.scope === 'floor'), (row) => row.blurb || '');
    const because = readonly(t('agent_composition.because', 'Because'), 'because', sends.filter((row) => row.scope === 'conditional'), (row) => [reasonWords(row.requires), since(row)].filter(Boolean).join(' · '));
    const chosenNow = data.current.behaviours.map((row) => row.name).filter((name) => data.available_behaviours.some((row) => row.name === name));
    const chosen = ask([{ group: t('agent_composition.chosen', 'Chosen'), fields: [{ key: 'behaviours', label: t('agent_composition.chosen', 'Chosen'), many: true, options: data.available_behaviours.map((row) => behaviourRow(row, row.blurb || '')) }] }], { value: { behaviours: chosenNow }, density: 'tight', exposed: true, onChange: refresh });
    questions.push(always, because, chosen);
    const lists = el('div', 'na-behaviour-sections'); lists.append(always.el, because.el, chosen.el); behaviours.append(lists);
    if (data.sends?.error) behaviours.append(el('p', 'ac-status', data.sends.error));
    body.append(notice.el);
    value = () => ({ mandate: mandateQuestion.value(), behaviours: chosen.value().behaviours || [] });
    loaded = JSON.stringify(value()); refresh();
  };
  action.el.addEventListener('click', async () => {
    action.el.disabled = true; notice.set('info', t('agent_composition.updating', 'Updating…'));
    const sent = await request(`/api/sessions/${encodeURIComponent(agent)}/configuration`, { method: 'PUT', json: value() });
    if (!sent.ok) { notice.set('failed', sent.message); refresh(); return; }
    loaded = JSON.stringify(value()); refresh();
    notice.set('success', t('agent_composition.updated', 'Configuration updated; the Agent is told to read its new brief.'));
  });
  return { el: body, action, show: load, destroy: () => { for (const question of questions) question.destroy(); questions = []; } };
}

export function createAgentCompositionSurface(agent) {
  const reader = createAgentCompositionReader(agent, { setState: (state, message) => surface.setState(state, message) });
  const surface = WorkspaceKit.primitives.createSurface({ label: t('agent_composition.title', 'Agent composition'), className: 'agent-composition', actions: [reader.action] });
  surface.content.append(reader.el);
  return { el: surface.el, show: reader.show, destroy: reader.destroy };
}
