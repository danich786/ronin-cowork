import { WorkspaceKit } from './workspace-kit.js';
import { request } from './request.js';
import { t } from './lexicon.js';
import { ask } from './ask.js';
import { createStep } from './form-steps.js';

export const AGENT_COMPOSITION_TYPE = 'agent.composition';
const REACH = ['open', 'discuss', 'plan', 'execute'];
const RECRUIT = ['open', 'nobody', 'propose agents', 'staff agents'];
const OUTPUT = ['open', 'ideas', 'a plan', 'code', 'an artifact', 'the team'];
const ROLES = [
  { v: 'coworker', l: 'Coworker' }, { v: 'lead', l: 'Lead' },
  { v: 'epic_lead', l: 'Epic Lead' }, { v: 'coordinator', l: 'Coordinator' },
];
const el = (tag, cls = '', text = '') => { const node = document.createElement(tag); if (cls) node.className = cls; if (text) node.textContent = text; return node; };
const rows = (values) => values.map((value) => ({ v: value, l: value }));
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

/** Agent, Mandate and Behaviors in the launch forms' createStep + ERABI format. The host
 * owns the only configuration action, Send; closing the surface simply destroys this draft. */
export function createAgentCompositionReader(agent, { setState = () => {} } = {}) {
  const { createAction, createField, createNotice } = WorkspaceKit.primitives;
  const body = el('div', 'ac-body');
  const action = createAction({ label: t('agent_composition.send', 'Send'), kind: 'primary', size: 'compact' });
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
    body.replaceChildren(notice.el);
    const section = (key, title) => { const step = createStep({ key, title }); body.append(step.el); return step.body; };
    const agentSection = section('agent', t('agent_composition.agent', 'Agent'));
    const objective = el('textarea'); objective.rows = 3; objective.value = data.current.objective || '';
    const title = el('input'); title.type = 'text'; title.value = data.current.title || agent;
    for (const control of [objective, title]) control.addEventListener('input', refresh);
    const bornWorkspace = data.current.project_root || '';
    const bornQuestion = ask([{ group: t('agent_composition.born_workspace', 'Born workspace'), fields: [{
      key: 'born_workspace', label: t('agent_composition.born_workspace', 'Born workspace'), many: true, filter: false,
      options: bornWorkspace ? [{ v: bornWorkspace, l: bornWorkspace, off: t('agent_composition.born_fixed', 'where this Agent was born') }] : [],
    }] }], { value: { born_workspace: bornWorkspace ? [bornWorkspace] : [] }, density: 'tight', exposed: true });
    const agentQuestions = ask([
      { fields: [{ key: 'role', label: t('agent_composition.role', 'Role'), options: ROLES }] },
      { fields: [{ key: 'team', label: t('agent_composition.team', 'Team'), blank: t('agent_composition.no_team', 'No Team'), options: (data.available_teams || []).map((row) => ({ v: row.name, l: row.title || row.name, sub: row.objective })) }] },
    ], { value: { role: data.current.role, team: data.current.team }, density: 'tight', onChange: refresh });
    questions.push(bornQuestion, agentQuestions);
    agentSection.append(
      createField({ label: t('agent_composition.objective', 'Objective'), control: objective }).el,
      createField({ label: t('agent_composition.agent_title', 'Title'), control: title }).el,
      bornQuestion.el,
      agentQuestions.el,
    );
    const mandate = section('mandate', t('mandate', 'Mandate'));
    const mandateQuestion = ask([{ fields: [
      { key: 'reach', label: t('team_config.reach', 'Reach'), options: rows(REACH) },
      { key: 'recruit', label: t('team_config.recruit', 'Recruit'), options: rows(RECRUIT) },
      { key: 'output', label: t('team_config.output', 'Output'), many: true, options: rows(OUTPUT) },
    ] }], { value: data.current.mandate, density: 'tight', onChange: refresh }); questions.push(mandateQuestion);
    mandate.append(mandateQuestion.el);
    const behaviours = section('behaviours', t('behaviours', 'Behaviors'));
    const since = (row) => (row.since_birth ? t('agent_composition.since_birth', 'since birth') : '');
    // A conditional's reason; when the condition is the behaviour's own name, say only that it holds.
    const why = (row) => {
      if (row.scope === 'floor') return t('agent_composition.every_agent', 'every Cowork Agent');
      const reason = reasonWords(row.requires);
      return [reason === (row.label || row.name) ? t('agent_composition.holds_now', 'applies now') : reason, since(row)].filter(Boolean).join(' · ');
    };
    const fixed = (data.sends?.rows || []).filter((row) => row.scope !== 'selected');
    const hiddenBehaviours = new Set(['epic_agent', 'steerco_mgr', 'trello', 'perplexity', 'gbrain']);
    const optional = data.available_behaviours.filter((row) => !hiddenBehaviours.has(row.name));
    const fixedNames = fixed.map((row) => row.name);
    const selectedNames = data.current.behaviours.map((row) => row.name).filter((name) => optional.some((row) => row.name === name));
    const behaviourQuestion = ask([{ fields: [{
      key: 'behaviours', label: t('behaviours', 'Behaviors'), many: true, filter: false,
      options: [
        ...fixed.map((row) => ({ v: row.name, l: row.label || row.name, sub: row.blurb, word: why(row), disabled: true })),
        ...optional.map((row) => ({ v: row.name, l: row.label || row.name, sub: row.blurb })),
      ],
    }] }], { value: { behaviours: [...fixedNames, ...selectedNames] }, density: 'tight', exposed: true, onChange: refresh });
    questions.push(behaviourQuestion); behaviours.append(behaviourQuestion.el);
    if (data.sends?.error) behaviours.append(el('p', 'ac-status', data.sends.error));
    value = () => ({
      objective: objective.value.trim(), title: title.value.trim(), ...agentQuestions.value(),
      mandate: mandateQuestion.value(),
      behaviours: behaviourQuestion.value().behaviours.filter((name) => optional.some((row) => row.name === name)),
    });
    loaded = JSON.stringify(value()); refresh();
  };
  action.el.addEventListener('click', async () => {
    action.el.disabled = true; notice.set('info', t('agent_composition.updating', 'Updating…'));
    const sent = await request(`/api/sessions/${encodeURIComponent(agent)}/configuration`, { method: 'PUT', json: value() });
    if (!sent.ok) { notice.set('failed', sent.message); refresh(); return; }
    await load();
    notice.set('success', t('agent_composition.updated', 'The Agent has been sent its new brief.'));
  });
  return { el: body, action, show: load, destroy: () => { for (const question of questions) question.destroy(); questions = []; } };
}

export function createAgentCompositionSurface(agent) {
  const reader = createAgentCompositionReader(agent, { setState: (state, message) => surface.setState(state, message) });
  const surface = WorkspaceKit.primitives.createSurface({ label: t('agent_composition.title', 'Agent composition'), className: 'agent-composition', actions: [reader.action] });
  surface.content.append(reader.el);
  return { el: surface.el, show: reader.show, destroy: reader.destroy };
}
