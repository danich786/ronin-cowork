/* part of the ronin-cowork client — see js/README.md */
import { t } from './lexicon.js';
import { createStep, dialRow, dialRowMulti, el, loadProviderCatalog, mandateWord, modelWord, providerCatalog } from './form-steps.js';
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

/** The New Agent picker shape, with ntf-only selectors. */
function providerStones(row) {
  const host = el('div', 'ntf-agent-model-picker');
  const paint = () => {
    const catalog = providerCatalog().rows;
    const providers = catalog.filter((item, index) => catalog.findIndex((other) => other.provider === item.provider) === index);
    const group = (label, choices, selected, choose) => {
      const wrap = el('div', 'ntf-agent-stone-group'); wrap.setAttribute('role', 'group'); wrap.setAttribute('aria-label', label);
      wrap.append(el('p', 'fs-head', label)); const tray = el('div', 'ntf-agent-stones');
      for (const choice of choices) {
        const button = el('button', 'ntf-agent-stone'); button.type = 'button';
        button.setAttribute('aria-pressed', String(choice.key === selected));
        button.append(el('b', null, choice.label)); button.disabled = choice.off === true;
        button.addEventListener('click', () => { choose(choice.key); paint(); }); tray.append(button);
      }
      wrap.append(tray); return wrap;
    };
    const providerRows = providers.map((item) => ({ key: item.provider, label: item.provider_label || item.provider, off: item.off }));
    const modelRows = catalog.filter((item) => item.provider === row.provider).map((item) => ({ key: item.model, label: modelWord(item), off: item.off }));
    host.replaceChildren(group(t('forms.provider', 'Model provider'), providerRows, row.provider, (provider) => { row.provider = provider; row.model = ''; }));
    if (row.provider) host.append(group(t('forms.model', 'Model'), modelRows, row.model, (model) => { row.model = model; }));
  };
  if (!providerCatalog().loaded) void loadProviderCatalog().then(paint);
  paint(); return host;
}

export function createAgentRows({ n, key, rows, changed, onToggle }) {
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
    const lead = el('label', 'ntf-agent-lead-choice'); const leadInput = el('input');
    leadInput.type = 'checkbox'; leadInput.checked = row.lead;
    leadInput.addEventListener('change', () => { row.lead = leadInput.checked; });
    lead.append(leadInput, el('span', null, t('add_agent.make_team_lead', 'Make Team Lead')));
    const name = el('input', 'ntf-agent-name'); name.type = 'text'; name.spellcheck = false; name.autocapitalize = 'off'; name.value = row.name; name.id = `${id}-name`;
    const assignment = el('textarea', 'ntf-agent-what'); assignment.rows = 3; assignment.value = row.assignment; assignment.id = `${id}-assignment`;
    const confirm = el('button', 'wk-button primary');
    name.addEventListener('input', () => {
      const at = name.selectionStart; const clean = sanitizeTeamName(name.value);
      if (clean !== name.value) { name.value = clean; name.setSelectionRange(at, at); }
      row.name = name.value; confirm.disabled = !finalizeTeamName(row.name);
    });
    assignment.addEventListener('input', () => { row.assignment = assignment.value; });

    const mandate = el('div', 'ntf-agent-mandate'); mandate.append(el('p', 'fs-head', t('mandate', 'Mandate')));
    const part = (axis, label, content, summary) => {
      const wrap = el('div', 'ntf-agent-mandate-part'); const toggle = el('button', 'ntf-agent-mandate-toggle'); toggle.type = 'button';
      toggle.setAttribute('aria-expanded', String(row.mandateOpen === axis)); toggle.setAttribute('aria-controls', `${id}-${axis}`);
      toggle.append(el('b', null, label), el('span', null, summary));
      toggle.addEventListener('click', () => { row.mandateOpen = row.mandateOpen === axis ? '' : axis; paint(); }); wrap.append(toggle);
      if (row.mandateOpen === axis) { content.id = `${id}-${axis}`; wrap.append(content); } return wrap;
    };
    mandate.append(
      part('reach', t('reach', 'Reach'), dialRow('', REACH, row.reach, (value) => { row.reach = value; paint(); }), mandateWord(row.reach)),
      part('recruit', t('recruit', 'Recruit'), dialRow('', RECRUIT, row.recruit, (value) => { row.recruit = value; paint(); }), mandateWord(row.recruit)),
      part('output', t('output', 'Output'), dialRowMulti('', OUTPUT, row.output, (value, on) => {
        row.output = on ? [...row.output, value] : row.output.filter((entry) => entry !== value); paint();
      }), row.output.map(mandateWord).join(', ')),
    );
    const buttons = el('div', 'ntf-agent-editor-actions'); const cancel = el('button', 'wk-button');
    cancel.type = 'button'; cancel.textContent = t('cancel', 'Cancel'); cancel.addEventListener('click', () => { editor = null; paint(); });
    confirm.type = 'button'; confirm.textContent = index < 0 ? t('new_team.agent_add_confirm', 'Add') : t('save', 'Save');
    confirm.disabled = !finalizeTeamName(row.name);
    confirm.addEventListener('click', () => {
      if (!finalizeTeamName(row.name)) return;
      if (row.lead) for (const other of rows()) other.lead = false;
      const saved = copyRow(row); saved.mandateOpen = '';
      if (index < 0) rows().push(saved); else rows()[index] = saved;
      editor = null; changed(); paint();
    });
    buttons.append(cancel, confirm);
    box.append(lead, field(t('new_team.agent_name', 'Name'), name), field(t('new_team.agent_assignment_label', 'Instructions'), assignment), mandate, providerStones(row), buttons);
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
