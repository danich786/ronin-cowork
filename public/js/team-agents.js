/* part of the ronin-cowork client — see js/README.md */
import { t } from './lexicon.js';
import { createStep, dialRow, el, mandateWord, providerModelPair } from './form-steps.js';
import { finalizeTeamName, sanitizeTeamName } from './new-team-draft.js';

const REACH = ['open', 'discuss', 'plan', 'execute'];
const RECRUIT = ['open', 'nobody', 'propose agents', 'staff agents'];
const OUTPUT = ['open', 'a plan', 'ideas', 'code', 'an artifact', 'the team', 'no code'];
let rowId = 0;

/** A fresh mini-form. Every field starts ordinary; marking a lead is the owner's hand. */
export const agentRow = () => ({
  name: '', assignment: '', lead: false,
  provider: '', model: '', reach: 'open', recruit: 'open', output: ['open'],
  routinesOn: [], routinesOff: [], mandateOpen: '',
});

export function agentPicks(rows) {
  return rows
    .filter((row) => finalizeTeamName(row.name))
    .map((row) => ({
      name: finalizeTeamName(row.name),
      instructions: row.assignment.trim(),
      mandate: { reach: row.reach, recruit: row.recruit, output: [...row.output] },
      team_lead: !!row.lead,
      ...(row.provider ? { provider: row.provider } : {}),
      ...(row.model ? { model: row.model } : {}),
      routines_on: [...(row.routinesOn || [])],
      routines_off: [...(row.routinesOff || [])],
    }));
}

export function createAgentRows({ n, key, rows, changed, onToggle }) {
  const step = createStep({ n, key, title: t('new_team.agents', 'Agents'), onToggle });
  const host = el('div');
  const field = (label, control) => {
    const wrap = el('label', 'ntf-agent-field');
    wrap.append(el('span', 'ntf-agent-label', label), control);
    return wrap;
  };

  function paint() {
    host.replaceChildren();
    const add = el('button', 'fs-door ntf-agent-add', t('new_team.agent_add', '＋ Add Agent'));
    add.type = 'button';
    add.addEventListener('click', () => { rows().push(agentRow()); paint(); changed(); });
    host.append(add);

    rows().forEach((row, index) => {
      const id = `new-team-agent-${++rowId}`;
      const box = el('fieldset', 'ntf-agent');
      const legend = el('legend', 'ntf-agent-legend', t('new_team.agent_number', 'Agent {n}', { n: index + 1 }));

      const lead = el('button', 'ntf-agent-lead', row.lead ? t('new_team.team_lead', 'Team Lead') : t('new_team.make_team_lead', 'Make Team Lead'));
      lead.type = 'button';
      lead.setAttribute('aria-pressed', String(row.lead));
      lead.addEventListener('click', () => {
        const next = !row.lead;
        for (const other of rows()) other.lead = false;
        row.lead = next;
        paint(); changed();
      });
      const drop = el('button', 'ntf-agent-drop', '✕');
      drop.type = 'button';
      drop.setAttribute('aria-label', t('new_team.agent_drop_named', 'Remove {name}', { name: row.name || t('new_team.unnamed_agent', 'unnamed Agent') }));
      drop.addEventListener('click', () => { rows().splice(index, 1); paint(); changed(); });
      const actions = el('div', 'ntf-agent-actions'); actions.append(lead, drop);

      const name = el('input', 'ntf-agent-name');
      name.type = 'text'; name.spellcheck = false; name.autocapitalize = 'off';
      name.value = row.name; name.placeholder = t('new_team.agent_name', 'name'); name.id = `${id}-name`;
      name.addEventListener('input', () => {
        const at = name.selectionStart;
        const clean = sanitizeTeamName(name.value);
        if (clean !== name.value) { name.value = clean; name.setSelectionRange(at, at); }
        row.name = name.value; changed();
      });
      const assignment = el('textarea', 'ntf-agent-what');
      assignment.rows = 3; assignment.value = row.assignment;
      assignment.placeholder = t('new_team.agent_assignment', 'what this Agent does'); assignment.id = `${id}-assignment`;
      assignment.addEventListener('input', () => { row.assignment = assignment.value; changed(); });

      const mandate = el('div', 'ntf-agent-mandate');
      mandate.append(el('span', 'ntf-agent-label', t('mandate', 'Mandate')));
      const summaries = el('div', 'ntf-agent-mandate-summaries');
      for (const [axis, label] of [['reach', t('reach', 'Reach')], ['recruit', t('recruit', 'Recruit')], ['output', t('output', 'Output')]]) {
        const value = axis === 'output' ? row.output[0] : row[axis];
        const button = el('button', 'fs-door', `${label} · ${mandateWord(value)}`);
        button.type = 'button';
        button.setAttribute('aria-expanded', String(row.mandateOpen === axis));
        button.setAttribute('aria-controls', `${id}-${axis}`);
        button.addEventListener('click', () => { row.mandateOpen = row.mandateOpen === axis ? '' : axis; paint(); });
        summaries.append(button);
      }
      mandate.append(summaries);
      for (const [axis, label, values] of [['reach', t('reach', 'Reach'), REACH], ['recruit', t('recruit', 'Recruit'), RECRUIT], ['output', t('output', 'Output'), OUTPUT]]) {
        const choices = el('div', 'ntf-agent-mandate-choices');
        choices.id = `${id}-${axis}`; choices.hidden = row.mandateOpen !== axis;
        if (!choices.hidden) choices.append(dialRow(label, values, axis === 'output' ? row.output[0] : row[axis], (value) => {
          if (axis === 'output') row.output = [value]; else row[axis] = value;
          row.mandateOpen = ''; paint(); changed();
        }));
        mandate.append(choices);
      }

      const pair = providerModelPair(
        () => ({ provider: row.provider, model: row.model }),
        (provider, model) => { row.provider = provider; row.model = model; changed(); },
        (label, control) => field(label, control),
      );
      box.append(legend, actions, field(t('new_team.agent_name', 'Name'), name), field(t('new_team.agent_assignment_label', 'Instructions'), assignment), mandate, pair.el);
      host.append(box);
    });
  }

  step.body.append(host);
  return { step, paint };
}
