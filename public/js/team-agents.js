/* part of the ronin-cowork client — see js/README.md */
import { t } from './lexicon.js';
import { ask } from './ask.js';
import { createStep, el, mandateWord, modelWord, providerCatalog } from './form-steps.js';
import { finalizeTeamName, sanitizeTeamName } from './new-team-draft.js';

const REACH = ['open', 'discuss', 'plan', 'execute'];
const RECRUIT = ['open', 'nobody', 'propose agents', 'staff agents'];
const OUTPUT = ['open', 'a plan', 'ideas', 'code', 'an artifact', 'the team', 'no code'];
let rowId = 0;

export const agentRow = () => ({
  name: '', assignment: '', lead: false, provider: '', model: '',
  reach: 'open', recruit: 'open', output: ['open'],
  routinesOn: [], routinesOff: [], mandateOpen: '',
});
const copyRow = (row) => ({ ...agentRow(), ...row, output: [...(row.output || ['open'])] });

export function agentPicks(rows) {
  return rows.filter((row) => finalizeTeamName(row.name)).map((row) => ({
    name: finalizeTeamName(row.name), instructions: row.assignment.trim(),
    mandate: { reach: row.reach, recruit: row.recruit, output: [...row.output] },
    team_lead: !!row.lead,
    ...(row.provider ? { provider: row.provider } : {}),
    ...(row.model ? { model: row.model } : {}),
    routines_on: [...(row.routinesOn || [])], routines_off: [...(row.routinesOff || [])],
  }));
}

export function createAgentRows({ n, key, rows, changed, onToggle, createAction, createActionBar }) {
  const step = createStep({ n, key, title: t('new_team.agents', 'Agents'), onToggle });
  const host = el('div'); let editor = null;
  const field = (label, control) => {
    const wrap = el('label', 'ntf-agent-field');
    wrap.append(el('span', 'ntf-agent-label', label), control); return wrap;
  };
  const openEditor = (row = agentRow(), index = -1) => { editor = { row: copyRow(row), index }; paint(); };

  function paintEditor() {
    const { row, index } = editor; const id = `new-team-agent-${++rowId}`;
    const box = el('fieldset', 'ntf-agent ntf-agent-editor');
    box.append(el('legend', 'ntf-agent-legend', index < 0 ? t('new_team.agent_add_title', 'Add Agent') : t('new_team.agent_edit_title', 'Edit Agent')));
    const name = el('input', 'ntf-agent-name'); name.type = 'text'; name.spellcheck = false; name.autocapitalize = 'off'; name.value = row.name; name.id = `${id}-name`;
    const assignment = el('textarea', 'ntf-agent-what'); assignment.rows = 3; assignment.value = row.assignment; assignment.id = `${id}-assignment`;
    const cancel = createAction({ label: t('cancel', 'Cancel'), size: 'compact', action: () => { editor = null; paint(); } });
    const confirm = createAction({ label: index < 0 ? t('new_team.agent_add_confirm', 'Add') : t('save', 'Save'), kind: 'primary', size: 'compact' });
    const actions = createActionBar({ label: t('new_team.agent_editor_actions', 'Agent actions'), actions: [cancel, confirm], className: 'ntf-agent-editor-actions' });
    name.addEventListener('input', () => {
      const at = name.selectionStart; const clean = sanitizeTeamName(name.value);
      if (clean !== name.value) { name.value = clean; name.setSelectionRange(at, at); }
      row.name = name.value; confirm.setDisabled(!finalizeTeamName(row.name));
    });
    assignment.addEventListener('input', () => { row.assignment = assignment.value; });

    const providerRows = () => providerCatalog().rows
      .filter((item, at, all) => all.findIndex((other) => other.provider === item.provider) === at)
      .map((item) => ({ v: item.provider, l: item.cli_label || item.provider_label || item.provider, off: item.operational ? undefined : item.off || t('forms.provider_off', 'not on this machine') }));
    const modelRows = (provider) => providerCatalog().rows.filter((item) => item.provider === provider).map((item) => ({
      v: item.model, l: item.model, word: modelWord(item).split(' · ').at(-1), sub: item.cost || '',
      off: item.operational ? undefined : t('forms.provider_off', 'not on this machine'),
    }));
    const ruled = (values, glyphs) => values.map((v, at) => ({ v, l: mandateWord(v), glyph: glyphs[at] }));
    const questions = ask([
      { group: t('new_agent.model_package', 'Model'), fields: [
        { key: 'provider', label: t('forms.provider', 'Model provider'), blank: t('forms.default', 'Default'), options: providerRows },
        { key: 'model', label: t('forms.model', 'Model'), blank: t('forms.default', 'Default'), after: 'provider', options: (value) => modelRows(value.provider) },
      ] },
      { group: t('mandate', 'Mandate'), fields: [
        { key: 'reach', label: t('reach', 'Reach'), shape: 'square', options: ruled(REACH, ['○', '言', '図', '動']) },
        { key: 'recruit', label: t('recruit', 'Recruit'), shape: 'square', options: ruled(RECRUIT, ['○', '一', '提', '人']) },
        { key: 'output', label: t('output', 'Output'), shape: 'square', many: true, options: ruled(OUTPUT, ['○', '図', '灯', '符', '物', '人', '∅']) },
      ] },
      { group: t('squad', 'Team'), fields: [
        { key: 'lead', label: t('team.lead', 'Team lead'), switch: [t('yes', 'Yes'), t('no', 'No')], word: '人' },
      ] },
    ], {
      value: row,
      className: 'ntf-agent-questions',
      onChange: (value) => {
        row.provider = value.provider; row.model = value.model;
        row.reach = value.reach; row.recruit = value.recruit; row.output = value.output; row.lead = value.lead;
      },
    });
    confirm.setDisabled(!finalizeTeamName(row.name));
    confirm.el.addEventListener('click', () => {
      if (!finalizeTeamName(row.name)) return;
      if (row.lead) for (const other of rows()) other.lead = false;
      const saved = copyRow(row); saved.mandateOpen = '';
      if (index < 0) rows().push(saved); else rows()[index] = saved;
      editor = null; changed(); paint();
    });
    box.append(actions.el, field(t('new_team.agent_name', 'Name'), name), field(t('new_team.agent_assignment_label', 'Instructions'), assignment), questions.el);
    return box;
  }

  function paint() {
    host.replaceChildren();
    rows().forEach((row, index) => {
      const card = el('div', 'ntf-agent-row'); const words = el('div', 'ntf-agent-row-words');
      words.append(el('b', null, row.name || t('new_team.unnamed_agent', 'unnamed Agent')));
      if (row.lead) words.append(el('span', 'ntf-agent-row-lead', t('new_team.team_lead', 'Team Lead')));
      const details = [row.assignment, `${mandateWord(row.reach)} · ${mandateWord(row.recruit)} · ${row.output.map(mandateWord).join(', ')}`, [row.provider, row.model].filter(Boolean).join(' · ')].filter(Boolean);
      words.append(el('small', null, details.join(' — ')));
      const actions = el('div', 'ntf-agent-row-actions'); const edit = el('button', 'ntf-agent-edit', t('edit', 'Edit')); edit.type = 'button'; edit.addEventListener('click', () => openEditor(row, index));
      const drop = el('button', 'ntf-agent-drop', '✕'); drop.type = 'button';
      drop.setAttribute('aria-label', t('new_team.agent_drop_named', 'Remove {name}', { name: row.name || t('new_team.unnamed_agent', 'unnamed Agent') }));
      drop.addEventListener('click', () => { rows().splice(index, 1); changed(); paint(); });
      actions.append(edit, drop); card.append(words, actions); host.append(card);
    });
    if (editor) host.append(paintEditor());
    else {
      const add = el('button', 'fs-door ntf-agent-add', t('new_team.agent_add', '＋ Add Agent')); add.type = 'button';
      add.addEventListener('click', () => openEditor()); host.append(add);
    }
  }
  step.body.append(host); return { step, paint };
}
