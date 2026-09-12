/* part of the ronin-cowork client — see js/README.md */
/** NEW AGENT — the sole drawn launch form. Session type decides which questions exist;
 * only a Cowork Agent has kind, template, mandate, and loadout. Defaults arrive through
 * `GET /api/launch-seed?team=` and land until the user's hand changes them. Routines use
 * Campaign → Team → Agent resolution; the resulting Worktrees capability is combined
 * later with the selected Project Root's independent permission. No desk key rides the
 * launch. */
import { request } from './request.js';
import { t } from './lexicon.js';
import { ask } from './ask.js';
import { finalizeTeamName, isValidTeamName, sanitizeTeamName } from './new-team-draft.js';
import {
  createStep, el, kindTiles, loadProviderCatalog, mandateWord, providerCatalog, readingRows, tagRow, templateTray, tierWord, wayTiles, bookShelves,
} from './form-steps.js';
import { closeWorkspaceTab, openWorkspaceTab, reserveWorkspaceTab } from './workspace.js';

const REACH = ['open', 'discuss', 'plan', 'execute'];
const RECRUIT = ['open', 'nobody', 'propose agents', 'staff agents'];
// absence of `code`: silence is not an instruction. Nothing validates the combination.
const OUTPUT = ['open', 'a plan', 'ideas', 'code', 'an artifact', 'the team', 'no code'];

/** A preload may name a template outside the form's default kind filter. Keep a compatible
 * current kind when possible; otherwise use the template's first declared kind. */
function templateEntryKind(current, template) {
  const kinds = Array.isArray(template?.kinds) ? template.kinds.filter(Boolean) : [];
  return kinds.includes(current) ? current : kinds[0] || current;
}

export function templateEntryPlan({ currentKind, kindTouched = false, templates = [], template = '' } = {}) {
  const row = templates.find((candidate) => candidate.name === template);
  if (!row) return { kind: currentKind, template: '' };
  const kind = templateEntryKind(currentKind, row);
  if (kindTouched && kind !== currentKind) return { kind: currentKind, template: '' };
  return { kind, template: row.name };
}

export function createNewAgentView(kit, { connect = null, embedded = false, team = null } = {}) {
  const { createSurface, createAction, createActionBar, createField, createNotice } = kit.primitives;

  const draft = {
    type: 'cowork_agent', template: '', templateName: '',
    name: '', kind: 'coding', kindTouched: false, provider: '', model: '', instructions: '',
    teamMode: typeof team === 'function' && team() ? 'existing' : 'new', team: typeof team === 'function' ? team() : '', newTeam: '', teamLead: false,
    reach: 'open', recruit: 'open', output: ['open'], launchMode: 'live_dangerously',
    books: [], root: '', repos: [], routineOverrides: {},
    expanded: {},
  };
  let seed = null;
  let templates = [];
  let sops = [];
  let ways = [];
  let teams = [];
  let roots = [];
  let snapshot = '';
  let busy = false;
  let loaded = false;
  let templateMode = false;
  const touched = { mandate: false, model: false, root: false, repos: false, books: false, launchMode: false };

  const start = createAction({
    label: t('forms.launch', 'Launch'),
    launch: true,
    size: 'compact',
    disabled: true,
    action: () => void doStart(),
  });
  const surface = createSurface({ label: t('new_agent.title', 'New Agent'), className: 'na-surface', actions: [start], header: !embedded });
  const notice = createNotice();
  if (embedded) {
    surface.content.classList.add('na-surface', 'launch-form-embed');
    const embedActions = el('div', 'launch-form-embed-actions');
    embedActions.append(start.el);
    surface.content.append(embedActions);
  }

  const isCowork = () => draft.type === 'cowork_agent';
  const hasAgent = () => draft.type !== 'terminal';
  const templateRow = () => templates.find((row) => row.name === draft.template) || null;
  const offered = () => (draft.kind === 'open' ? templates : templates.filter((row) => row.kinds.includes(draft.kind)));
  const chosenTeam = () => (draft.teamMode === 'existing' ? draft.team : draft.teamMode === 'new' ? finalizeTeamName(draft.newTeam) : '');

  // and "Make your own" is the manual door; a mode switch above the form said it twice.

  /* ---- 1 · Kind ---- */
  const stepKind = createStep({ n: 1, key: 'kind', title: t('kind', 'Kind') });
  const kindHost = el('div');
  function paintKinds() {
    kindHost.replaceChildren(kindTiles(draft.kind, (key) => {
      draft.kind = key;
      draft.kindTouched = true;
      if (draft.template && !offered().some((row) => row.name === draft.template)) { draft.template = ''; snapshot = ''; }
      paint();
    }));
  }
  stepKind.body.append(kindHost);

  /* ---- 2 · Session type ---- */
  const stepType = createStep({ n: 2, key: 'type', title: t('new_agent.session_type_step', 'Session type') });
  const typeHost = el('div', 'fs-pair');
  const templateHost = el('div', 'na-template-tray');
  const TYPES = () => [
    { key: 'cowork_agent', label: t('new_agent.type_cowork', 'Cowork Agent'), sub: t('new_agent.type_cowork_sub', 'Born into Ronin: the floor, its routines, its reading and its team.') },
    { key: 'bare_metal_agent', label: t('new_agent.type_bare', 'Bare-metal Agent'), sub: t('new_agent.type_bare_sub', 'The provider’s agent and nothing else — no floor, no routines, no reading.') },
    { key: 'terminal', label: t('new_agent.type_terminal', 'Terminal'), sub: t('new_agent.type_terminal_sub', 'A raw tmux pane. No agent is launched and nothing is sent to it.') },
  ];
  function paintTypes() {
    typeHost.replaceChildren();
    for (const type of TYPES()) {
      const box = el('button', 'fs-way');
      box.type = 'button';
      box.setAttribute('aria-pressed', String(draft.type === type.key));
      box.append(el('b', null, type.label), el('small', null, type.sub));
      box.addEventListener('click', () => {
        templateMode = false;
        draft.type = type.key;
        paint();
      });
      typeHost.append(box);
    }
  }
  stepType.body.append(typeHost, templateHost);

  /* ---- 3 · Name & instructions ---- */
  const stepTop = createStep({ n: 2, key: 'top', title: t('new_agent.agent_body', 'Agent') });
  const nameInput = el('input');
  nameInput.type = 'text';
  nameInput.autocapitalize = 'off';
  nameInput.autocomplete = 'off';
  nameInput.spellcheck = false;
  nameInput.required = true;
  nameInput.maxLength = 40;
  nameInput.placeholder = t('new_agent.name_placeholder', 'name');
  nameInput.addEventListener('input', () => {
    const clean = nameInput.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (clean !== nameInput.value) {
      const at = nameInput.selectionStart;
      nameInput.value = clean;
      nameInput.setSelectionRange(at, at);
    }
    draft.name = nameInput.value;
    paintFoot();
    paintActions(); // Start wakes on the first character of a name
  });
  const leanNote = el('p', 'na-omitted');
  function paintLeanNote() {
    leanNote.hidden = isCowork() || draft.type === 'terminal';
    if (leanNote.hidden) return;
    leanNote.textContent = t('new_agent.bare_note', 'A bare-metal Agent takes no kind, no mandate and no loadout.');
  }
  const topLeft = el('div', 'aa-col');
  const nameField = createField({ label: t('new_agent.name_required', 'Name · required'), control: nameInput }).el;
  nameField.classList.add('na-name-required');
  topLeft.append(nameField, leanNote);
  stepTop.body.append(topLeft);

  /* ---- Apply Template lives under the fourth session choice. ---- */
  function restoreTemplateDefaults() {
    const value = (field) => seed?.seeds?.[field]?.value;
    draft.instructions = '';
    instructionsInput.value = '';
    draft.books = Array.isArray(value('behaviours')) ? [...value('behaviours')] : [];
    for (const key of ['reach', 'recruit']) draft[key] = value(key) || 'open';
    draft.output = [value('output') || 'open'].flat().filter(Boolean);
    draft.teamMode = 'new'; draft.team = ''; draft.newTeam = '';
    touched.mandate = false; touched.books = false;
  }
  function applyTemplate(name) {
    draft.template = name;
    draft.expanded = {};
    // Make your own and every new template start from inherited defaults, never the last
    // template's answers. Name, kind and where are the owner's own answers and stay put.
    restoreTemplateDefaults();
    const row = templateRow();
    if (!row) { snapshot = ''; paint(); return; }
    draft.instructions = row.brief || '';
    instructionsInput.value = draft.instructions;
    // A template's output may still be a single word — the record wraps a legacy scalar,
    // and so does the form, rather than handing a string to code that expects a list.
    // The shelf hands back a parsed mandate — `{ reach, recruit, output[] }` or null when
    // the template is silent — so a silent one seeds nothing rather than seeding a guess.
    if (row.mandate) { draft.reach = row.mandate.reach; draft.recruit = row.mandate.recruit; draft.output = [row.mandate.output].flat().filter(Boolean); touched.mandate = true; }
    // `team_mode: 'new'` births the box into its own team (the Personal Assistant ruling).
    if (row.team_mode === 'new') { draft.teamMode = 'new'; }
    if (row.behaviours.length) { draft.books = [...row.behaviours]; touched.books = true; }
    snapshot = authored();
    paint();
  }
  const authored = () => JSON.stringify({
    instructions: draft.instructions, books: [...draft.books].sort(),
    mandate: [draft.reach, draft.recruit, ...draft.output],
  });
  const templateDirty = () => !!templateRow() && authored() !== snapshot;
  function paintTray() {
    templateHost.hidden = !templateMode;
    templateHost.replaceChildren();
    if (templateMode) templateHost.append(templateTray(offered(), draft.template, (name) => applyTemplate(name), { includeOwn: false }));
  }

  const instructionsInput = el('textarea');
  instructionsInput.classList.add('wk-field-control');
  instructionsInput.rows = 6;
  instructionsInput.autocapitalize = 'off';
  instructionsInput.spellcheck = false;
  instructionsInput.placeholder = t('add_agent.instruction_placeholder', 'what this Agent should do');
  instructionsInput.addEventListener('input', () => {
    draft.instructions = instructionsInput.value;
    paintFoot();
    // The save offer appears when a template goes dirty, and an instructions-only edit IS
    // dirt — it just never repainted the actions, so Save as template stayed hidden until
    // you happened to type a name too. (@template_shelves measured it.)
    paintActions();
  });
  const instructionsField = createField({ label: t('new_agent.instructions', 'Instructions'), control: instructionsInput }).el;
  stepTop.body.append(instructionsField);

  /* ---- The one question utility: Model, Mandate, Team, and Where it works. ---- */
  const providerRows = () => providerCatalog().rows
    .filter((row, index, all) => all.findIndex((other) => other.provider === row.provider) === index)
    .map((row) => {
      const unavailable = row.operational ? '' : row.off
        ? t('forms.reason_turned_off', 'turned off')
        : t('forms.reason_not_on_machine', 'not on this machine');
      return { v: row.provider, l: row.cli_label || row.provider_label || row.provider, off: unavailable || undefined };
    });
  const modelRows = (provider) => providerCatalog().rows.filter((row) => row.provider === provider).map((row) => {
    const machine = providerCatalog().machine.find((item) => item.id === row.cli);
    return {
      v: row.model, l: row.model, word: tierWord(row.tier), sub: row.cost || '',
      off: !row.operational
        ? t('forms.reason_not_on_machine', 'not on this machine')
        : row.model_list_current && row.listed === false
          ? t('forms.reason_not_listed', 'not listed by your {cli} {client_version}', { cli: row.cli_label || row.cli, client_version: machine?.version || '' }).trim()
          : undefined,
    };
  });
  const mandateRows = (values, glyphs) => values.map((v, index) => ({ v, l: mandateWord(v), glyph: glyphs[index] }));
  const teamValue = () => draft.teamMode === 'new' ? '__new__' : draft.teamMode === 'none' ? '__none__' : `team:${draft.team}`;
  const teamRows = () => [
    { v: '__new__', l: t('new_agent.team_new', 'A new team'), sub: t('new_agent.team_new_sub', 'Created first, then this Agent is born into it.') },
    ...teams.map((row) => ({ v: `team:${row.name}`, l: String(row.title ?? '').trim() || row.name, sub: row.name })),
    { v: '__none__', l: t('new_agent.team_none', 'No team — a rōnin'), sub: t('new_agent.team_none_sub', 'Ordinary, not a gap.') },
  ];
  const rootRows = () => roots.map((row) => ({ v: row.name, l: row.name, word: row.repo_profile?.worktrees === 'enabled' ? t('where.worktree', 'worktree') : t('where.checkout', 'checkout') }));
  const newTeamField = () => {
    const input = el('input'); input.type = 'text'; input.spellcheck = false; input.autocapitalize = 'off'; input.value = draft.newTeam;
    input.placeholder = t('new_agent.team_new_blank', 'Blank makes no team — the Agent is a rōnin.');
    input.addEventListener('input', () => {
      const caret = input.selectionStart; const clean = sanitizeTeamName(input.value);
      if (clean !== input.value) { input.value = clean; input.setSelectionRange(caret, caret); }
      draft.newTeam = input.value; paintFoot(); paintActions();
    });
    return input;
  };
  const questions = ask([
    { group: t('new_agent.model_package', 'Model'), fields: [
      { key: 'provider', label: t('forms.provider', 'Model provider'), blank: t('forms.default', 'Default'), options: providerRows },
      { key: 'model', label: t('forms.model', 'Model'), blank: t('forms.default', 'Default'), after: 'provider', options: (value) => modelRows(value.provider) },
    ] },
    { group: t('mandate', 'Mandate'), fields: [
      { key: 'reach', label: t('reach', 'Reach'), shape: 'square', options: mandateRows(REACH, ['○', '💬', '🗺', '⚙']) },
      { key: 'recruit', label: t('recruit', 'Recruit'), shape: 'square', options: mandateRows(RECRUIT, ['·', '👤', '💡', '👥']) },
      { key: 'output', label: t('output', 'Output'), shape: 'square', many: true, options: mandateRows(OUTPUT, ['·', '📝', '💭', '⌨', '📦', '👥', '🚫']) },
    ] },
    { group: t('squad', 'Team'), fields: [
      { key: 'team', label: t('squad', 'Team'), options: teamRows, row: (option) => option.v === '__new__' ? newTeamField() : null },
      { key: 'teamLead', label: t('team.lead', 'Team lead'), switch: [t('yes', 'Yes'), t('no', 'No')] },
    ] },
    { group: t('where.label', 'Where it works'), fields: [
      { key: 'root', label: t('where.born_in', 'Born in'), options: rootRows },
      { key: 'repos', label: t('where.additional', 'Additional workspaces'), many: true, after: 'root', options: (value) => rootRows().filter((row) => row.v !== value.root) },
    ] },
  ], {
    value: { provider: draft.provider, model: draft.model, reach: draft.reach, recruit: draft.recruit, output: draft.output, team: teamValue(), teamLead: draft.teamLead, root: draft.root, repos: draft.repos },
    className: 'na-questions',
    density: 'tight',
    onChange: (value, key) => {
      draft.provider = value.provider; draft.model = value.model; draft.reach = value.reach; draft.recruit = value.recruit; draft.output = value.output;
      draft.teamLead = value.teamLead; draft.root = value.root; draft.repos = value.repos.filter((name) => name !== value.root);
      if (key === 'provider' || key === 'model') touched.model = true;
      if (['reach', 'recruit', 'output'].includes(key)) touched.mandate = true;
      if (key === 'root') touched.root = true;
      if (key === 'repos') touched.repos = true;
      if (key === 'team') {
        draft.teamMode = value.team === '__new__' ? 'new' : value.team === '__none__' ? 'none' : 'existing';
        draft.team = value.team.startsWith('team:') ? value.team.slice(5) : '';
        touched.repos = false;
        const selected = teams.find((row) => row.name === draft.team);
        draft.repos = draft.teamMode === 'existing' ? [...(selected?.repos || [])].filter((name) => name !== draft.root) : [];
        void loadSeed();
      }
      paintFoot(); paintActions();
    },
  });
  const syncQuestions = () => {
    questions.set({ provider: draft.provider, model: draft.model, reach: draft.reach, recruit: draft.recruit, output: draft.output, team: teamValue(), teamLead: draft.teamLead, root: draft.root, repos: draft.repos || [] });
  };
  void loadProviderCatalog().then(() => questions.paint());

  /* ---- 7 · Loadout ---- */
  const stepLoadout = createStep({ n: 7, key: 'loadout', title: t('loadout', 'Tools and skills'), onToggle: () => toggle('loadout') });
  const routinesHead = el('p', 'fs-head', t('routines', 'Routines'));
  const worktreesMode = el('div', 'fs-worktrees-mode');
  const routinesHost = el('div');
  function paintRoutinePreview() {
    // Campaign → Team → Agent; Project Root applicability stays orthogonal.
    routinesHost.replaceChildren();
    const row = (label, prov, on, act = null) => {
      const line = el(act ? 'button' : 'div', 'fs-routine');
      if (act) { line.type = 'button'; line.addEventListener('click', act); }
      line.dataset.on = String(on);
      const words = el('div'); words.append(el('b', null, label));
      line.append(el('span', 'fs-mark', on ? '✓' : ''), words, el('span', 'fs-prov', prov));
      routinesHost.append(line);
    };
    row(t('new_team.floor', 'Cowork floor'), t('forms.always', 'always'), true);
    for (const routine of seed?.routines || []) {
      const overridden = Object.prototype.hasOwnProperty.call(draft.routineOverrides, routine.name);
      const on = overridden ? draft.routineOverrides[routine.name] : routine.on;
      const provenance = overridden ? t('forms.agent_override', 'agent overrides') : (routine.stated_by?.[0]?.layer || '');
      row(routine.name, provenance, on, () => {
        const next = !on;
        if (next === routine.on) delete draft.routineOverrides[routine.name];
        else draft.routineOverrides[routine.name] = next;
        paintRoutinePreview(); paintFolds(); paintFoot();
      });
    }
    const worktrees = (seed?.routines || []).find((routine) => routine.name === 'ronin_worktrees');
    const overridden = Object.prototype.hasOwnProperty.call(draft.routineOverrides, 'ronin_worktrees');
    const worktreesOn = overridden ? draft.routineOverrides.ronin_worktrees : worktrees?.on;
    worktreesMode.replaceChildren(
      el('b', null, t('new_agent.worktrees_mode', 'Agent work mode')),
      el('strong', null, worktreesOn ? t('new_agent.worktrees_on', 'Own worktree where the Workspace folder allows it')
        : t('new_agent.worktrees_off', 'Use the project checkout and its branches')),
      el('small', null, t('new_agent.worktrees_help', 'Worktrees give this Agent a separate working folder and branch, so its file changes do not collide with another Agent’s. They run only when both the Agent and repo have Worktrees on, and use the managed hand-in and Team-lead merge process.')),
    );
  }
  const LAUNCH_MODES = () => [
    { key: 'configured', label: t('launch_mode.configured', 'Model provider configuration'),
      sub: t('launch_mode.configured_sub', 'Ronin adds nothing to the command. The Agent starts with whatever its provider CLI already loads.') },
    { key: 'live_dangerously', label: t('launch_mode.live', 'Dangerously'),
      sub: t('launch_mode.live_sub', 'Ronin appends that provider’s own bypass flag, so the Agent does not stop to ask.') },
  ];
  const modeHost = el('div');
  const paintLaunchMode = () => {
    modeHost.replaceChildren(
      el('p', 'fs-head', t('launch_mode.head', 'launch mode')),
      wayTiles(LAUNCH_MODES(), draft.launchMode, (key) => { draft.launchMode = key; touched.launchMode = true; paintLaunchMode(); paintFoot(); }),
    );
  };
  const gbrainMode = () => ((seed?.routines || []).some((row) => row.name === 'gbrain' && row.on) ? 'connected' : 'disconnected');
  const shelvesHost = el('div');
  function paintShelves() {
    shelvesHost.replaceChildren(bookShelves([
      { head: t('new_agent.shelf_house', 'behaviours · the house'), prefix: 'sops', rows: sops },
      { head: t('new_agent.shelf_ways', 'behaviours · ways of working'), prefix: 'ways', rows: ways },
    ], draft.books, (address, on) => {
      draft.books = on ? [...draft.books, address] : draft.books.filter((book) => book !== address);
      touched.books = true;
      paintShelves();
      paintFoot();
    }));
  }
  stepLoadout.body.append(modeHost, routinesHead, worktreesMode, routinesHost, shelvesHost);

  /* ---- the plan: which steps exist for this type and door ---- */
  const steps = {
    kind: stepKind, type: stepType, top: stepTop, loadout: stepLoadout,
  };
  const plan = () => draft.type === 'cowork_agent' ? ['type', 'top', 'loadout'] : ['type', 'top'];
  const FOLDS = ['loadout'];
  function toggle(key) {
    if (draft.expanded[key]) delete draft.expanded[key];
    else draft.expanded[key] = true;
    paintFolds();
  }
  const meta = {
    loadout: () => t('new_agent.loadout_meta', '{routines} routines · {books} books', {
      routines: (seed?.routines || []).filter((row) => Object.prototype.hasOwnProperty.call(draft.routineOverrides, row.name) ? draft.routineOverrides[row.name] : row.on).length + 1, books: draft.books.length,
    }),
  };
  function paintFolds() {
    const templateFolded = isCowork() && !!templateRow();
    for (const key of FOLDS) {
      const folded = key === 'loadout' || templateFolded;
      steps[key].setCollapsed(folded && !draft.expanded[key], folded ? meta[key]() : '', folded);
    }
  }

  /* ---- Will be born ---- */
  const foot = el('div', 'ntf-foot');
  function bornRows() {
    const typeRow = TYPES().find((type) => type.key === draft.type);
    const rows = [
      [t('new_agent.session', 'session'), typeRow?.label || draft.type],
      [t('add_agent.name', 'name'), draft.name],
      [t('squad', 'Team'), draft.teamMode === 'none' || !chosenTeam() ? '' : chosenTeam() + (draft.teamMode === 'new' ? `  ${t('new_agent.created_first', '(created first)')}` : '')],
    ];
    if (isCowork()) {
      rows.push([t('mandate', 'Mandate'), `${draft.reach} · ${draft.recruit} · ${draft.output.join(', ')}`]);
    }
    rows.push([t('routines', 'Routines'), draft.type === 'terminal'
      ? el('em', null, t('new_agent.routines_terminal', 'agent: none — a pane'))
      : draft.type === 'bare_metal_agent'
        ? el('em', null, t('new_agent.routines_bare', 'no floor, no routines'))
        : tagRow([{ text: t('new_team.floor_tag', 'floor'), on: true }, ...(seed?.routines || []).filter((row) => Object.prototype.hasOwnProperty.call(draft.routineOverrides, row.name) ? draft.routineOverrides[row.name] : row.on).map((row) => ({ text: row.name, on: true }))])]);
    if (isCowork() && draft.books.length) rows.push([t('behaviours', 'Behaviours'), tagRow(draft.books.map((text) => ({ text, on: true })))]);
    rows.push([t('launch_mode.head', 'launch mode'), LAUNCH_MODES().find((row) => row.key === draft.launchMode)?.label || draft.launchMode]);
    rows.push([t('gbrain_mode.head', 'gbrain connection'), gbrainMode() === 'connected' ? t('gbrain_mode.connected', 'Connected') : t('gbrain_mode.disconnected', 'Disconnected')]);
    rows.push([t('add_agent.place', 'place'), draft.root]);
    if (hasAgent()) rows.push([t('forms.model', 'model'), draft.provider ? `${draft.provider}${draft.model ? ` / ${draft.model}` : ''}` : t('forms.default', 'default')]);
    return rows;
  }
  function paintFoot() {
    foot.replaceChildren(readingRows(bornRows()));
    foot.append(el('p', 'na-note', t('new_agent.blank_note', 'A blank field is an answer, not a gap.')));
  }

  /* ---- the conditional save ---- */
  const saveName = el('input', 'ntf-tmplname');
  saveName.type = 'text';
  saveName.spellcheck = false;
  saveName.autocapitalize = 'off';
  saveName.placeholder = t('new_team.save_name_placeholder', 'template name');
  saveName.addEventListener('input', () => {
    draft.templateName = saveName.value;
    save.setDisabled(!saveName.value.trim());
  });
  const save = createAction({ label: t('save_template', 'Save as template'), disabled: true, action: () => void doSave() });
  const actions = createActionBar({ label: t('add_agent.actions', 'Launch actions'), className: 'ntf-actions' });
  actions.el.append(saveName, save.el);
  function paintActions() {
    // The button says what the press will DO: with the name blank there is no team to
    // create, so it must not promise one.
    const ready = !!draft.name.trim();
    start.setDisabled(!ready);
    if (ready) start.el.dataset.kind = 'primary';
    else delete start.el.dataset.kind;
    const offer = isCowork() && (!templateRow() || templateDirty());
    saveName.hidden = !offer;
    save.el.hidden = !offer;
    save.el.textContent = !templateRow() ? t('save_template', 'Save as template') : t('new_team.save_as_new', 'Save as new template');
  }

  async function doStart() {
    if (busy) return;
    const launchTab = connect ? null : reserveWorkspaceTab();
    const name = draft.name.trim();
    busy = true;
    start.setDisabled(true);
    notice.set('info', t('add_agent.starting', 'Starting…'));
    // A NEW TEAM IS TWO IDEMPOTENT DOORS (§ 7.5): write the record, then launch into it.
    let team = chosenTeam();
    // An unnamed new team is no team, not a refusal — see the field's own sentence.
    if (draft.teamMode === 'new' && !team) team = '';
    if (draft.teamMode === 'new' && isCowork() && team) {
      if (!isValidTeamName(team)) {
        if (launchTab) closeWorkspaceTab(launchTab);
        busy = false;
        start.setDisabled(false);
        notice.set('failed', t('new_team.name_invalid', 'Lowercase letters, digits, _ and - only.'));
        return;
      }
      const made = await request('/api/team-rosters', {
        method: 'POST',
        json: { name: team },
      });
      if (!made.ok) {
        if (launchTab) closeWorkspaceTab(launchTab);
        busy = false;
        start.setDisabled(false);
        notice.set('failed', made.message);
        return;
      }
    }
    // ONLY THE § 7.4 BODY, by type — the route refuses the rest by name, and the desk is
    // never sent (the routine selection is the decision; the escape hatch stays unadvertised).
    const body = draft.type === 'terminal'
      ? { session_type: 'terminal', name, team, project_root: draft.root }
      : draft.type === 'bare_metal_agent'
        ? { session_type: 'bare_metal_agent', name, team, project_root: draft.root, instructions: draft.instructions.trim(), provider: draft.provider, model: draft.model }
        : {
          session_type: 'cowork_agent', name, team, project_root: draft.root,
          instructions: draft.instructions.trim(), provider: draft.provider, model: draft.model,
          team_lead: draft.teamLead,
          ...(touched.repos && Array.isArray(draft.repos) ? { repos: draft.repos } : {}),
          mandate: { reach: draft.reach, recruit: draft.recruit, output: draft.output },
          behaviours: [...draft.books],
          ...(Object.keys(draft.routineOverrides).length ? { routines: { ...draft.routineOverrides } } : {}),
          launch_mode: draft.launchMode,
          gbrain_mode: gbrainMode(),
          ...(draft.template ? { template: draft.template } : {}),
        };
    const result = await request('/api/launch', { method: 'POST', json: body });
    busy = false;
    start.setDisabled(false);
    if (!result.ok) {
      if (launchTab) closeWorkspaceTab(launchTab);
      notice.set('failed', result.message);
      return;
    }
    const born = result.data?.name || name;
    const deskNote = result.data?.receipt?.desk_note || '';
    if (deskNote) notice.set('warning', t('add_agent.started_note', 'Started {name} — {note}', { name: born, note: deskNote }));
    else notice.set('success', t('add_agent.started', 'Started {name}', { name: born }));
    if (connect) connect(born);
    else openWorkspaceTab(team ? 'team' : 'cowork', team, launchTab);
  }

  async function doSave() {
    const token = draft.templateName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (!token) return;
    // templates are two shelves with two doors. This form only ever reads or writes the
    // agent one — a cast belongs to a Team and means nothing to a single launch.
    const result = await request('/api/templates/agents', {
      method: 'POST',
      json: {
        name: token,
        label: draft.templateName.trim(),
        art: templateRow()?.art || '＋',
        blurb: draft.instructions.trim().slice(0, 120),
        kinds: draft.kind === 'open' ? ['coding', 'work', 'personal', 'household', 'social', 'school'] : [draft.kind],
        brief: draft.instructions.trim(),
        mandate: `${draft.reach} · ${draft.recruit} · ${draft.output.join(', ')}`,
        team_mode: draft.teamMode === 'new' ? 'new' : '',
        behaviours: draft.books,
        // THE SWITCHES A LOADOUT IS MEANT TO CARRY. `TemplateBoxSave` stores these
        // (@template_shelves measured `boxTail` writing all three) and this form was
        // sending only `behaviours`, so a saved Personal Assistant lost its gbrain.
        //
        // ONLY THE ONS, DELIBERATELY. A template "carries exactly the fields it carries;
        // everything unnamed stays as the level above landed it" (CASCADE § 1). This form
        // previews routines and never flips them (§ 5.1), so there is no OFF a person
        // chose here — sending every unresolved routine as `routines_off` would make a
        // saved loadout dictate the whole map instead of adding to it.
        routines_on: (seed?.routines || []).filter((row) => row.on).map((row) => row.name),
        routines_off: [],
      },
    });
    if (!result.ok) return notice.set('failed', result.message);
    notice.set('success', t('new_team.saved_template', 'Saved template {name}', { name: token }));
    templates = [...templates, result.data.template];
    draft.templateName = '';
    saveName.value = '';
    save.setDisabled(true);
    paintTray();
  }

  /** The level above answers — the team's when one is chosen, the campaign's otherwise —
   *  and lands only on fields no hand has touched. */
  async function loadSeed() {
    const team = draft.teamMode === 'existing' ? draft.team : '';
    const answer = await request(`/api/launch-seed${team ? `?team=${encodeURIComponent(team)}` : ''}`);
    if (!answer.ok) return;
    seed = answer.data || null;
    const value = (field) => seed?.seeds?.[field]?.value;
    // Blank means inherit the resolved provider/model. The launcher says Default until the
    // owner deliberately overrides either choice.
    if (!touched.root && value('project_root')) draft.root = value('project_root');
    if (!touched.repos) {
      const selected = draft.teamMode === 'existing' ? teams.find((row) => row.name === draft.team) : null;
      draft.repos = [...(selected?.repos || [])].filter((name) => name !== draft.root);
    }
    if (!touched.mandate) {
      for (const key of ['reach', 'recruit']) if (value(key)) draft[key] = value(key);
      if (value('output')) draft.output = [value('output')].flat().filter(Boolean);
    }
    if (!touched.books && Array.isArray(value('behaviours'))) draft.books = [...value('behaviours')];
    // The campaign's, or the team's if one is joined — an editable value like every other
    if (!touched.launchMode && value('launch_mode')) draft.launchMode = value('launch_mode');
    if (!draft.kindTouched && team && value('kind')) draft.kind = value('kind');
    syncQuestions();
    paintKinds();
    paintTray();
    paintShelves();
    paintRoutinePreview();
    paintFolds();
    paintFoot();
  }

  function paint() {
    const order = plan();
    for (const [key, step] of Object.entries(steps)) step.el.hidden = !order.includes(key);
    order.forEach((key, index) => steps[key].setNumber(index + 1));
    stepPayload.setNumber(order.length + 1);
    stepPayload.el.hidden = draft.type === 'terminal';
    stepTop.el.querySelector('h3').textContent = hasAgent() ? t('new_agent.agent_body', 'Agent') : t('new_agent.name_required_step', 'Name · required');
    questions.show(draft.type === 'terminal' ? ['root', 'repos'] : draft.type === 'bare_metal_agent' ? ['provider', 'model', 'root', 'repos'] : null);
    questions.el.hidden = false;
    instructionsField.hidden = !hasAgent();
    paintTypes();
    paintLeanNote();
    paintKinds();
    paintTray();
    syncQuestions();
    paintRoutinePreview();
    paintShelves();
    paintLaunchMode();
    paintFolds();
    paintActions();
    paintFoot();
  }

  // a band of its own rather than trailing off the end of a long form.
  let payloadOpen = false;
  const stepPayload = createStep({ n: 8, key: 'payload', title: t('forms.payload', 'Payload'), onToggle: () => {
    payloadOpen = !payloadOpen;
    stepPayload.setCollapsed(!payloadOpen, t('forms.payload_summary', 'Review what Launch will create'), true);
  } });
  stepPayload.body.append(foot, actions.el);
  stepPayload.setCollapsed(true, t('forms.payload_summary', 'Review what Launch will create'), true);
  stepTop.body.replaceChildren(nameField, questions.el, instructionsField);
  const form = el('div', 'ntf-form');
  form.append(stepType.el, stepTop.el, stepLoadout.el, stepPayload.el);
  // Save as template sits UNDER the reading, for the same reason as on New Team: the
  // reading is the packet, and the button saves the packet.
  surface.content.append(form, notice.el);

  const PA_BOOK = 'ways:personal_assistant';
  const seedPrompt = (prompt) => {
    if (!prompt) return;
    draft.instructions = prompt;
    instructionsInput.value = prompt;
    if (ways.some((row) => row.name === 'personal_assistant') && !draft.books.includes(PA_BOOK)) {
      draft.books = [...draft.books, PA_BOOK];
      touched.books = true;
    }
  };

  return {
    el: embedded ? surface.content : surface.el,
    enter: async (detail = {}) => {
      const entryTeam = typeof team === 'function' ? team() : team;
      if (entryTeam) { draft.teamMode = 'existing'; draft.team = entryTeam; }
      paint();
      const [tray, sopRows, wayRows, teamRows, rootRows] = await Promise.all([
        request('/api/templates/agents'),
        request('/api/sops'),
        request('/api/ways'),
        request('/api/team-rosters'),
        request('/api/project-roots/detail'),
      ]);
      templates = tray.ok && Array.isArray(tray.data) ? tray.data : [];
      sops = sopRows.ok && Array.isArray(sopRows.data) ? sopRows.data : [];
      ways = wayRows.ok && Array.isArray(wayRows.data) ? wayRows.data : [];
      teams = teamRows.ok && Array.isArray(teamRows.data) ? teamRows.data.filter((row) => row.state !== 'archived') : [];
      roots = rootRows.ok && Array.isArray(rootRows.data?.roots) ? rootRows.data.roots.filter((row) => !row.archived) : [];
      if (!loaded) { await loadSeed(); loaded = true; }
      if (typeof detail?.template === 'string' && detail.template) {
        const entry = templateEntryPlan({ currentKind: draft.kind, kindTouched: draft.kindTouched, templates, template: detail.template });
        draft.kind = entry.kind;
        if (entry.template) applyTemplate(entry.template);
      }
      seedPrompt(typeof detail?.prompt === 'string' ? detail.prompt.trim() : '');
      paint();
    },
  };
}

/** Form-only adapter for an existing work-surface detail region. */
export function createEmbeddedNewAgentView(kit, options = {}) {
  return createNewAgentView(kit, { ...options, embedded: true });
}
