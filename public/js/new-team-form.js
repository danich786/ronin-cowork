/* part of the ronin-cowork client — see js/README.md */
import { request } from './request.js';
import { t } from './lexicon.js';
import { ask } from './ask.js';
import { ruledRows } from './glyphs.js';
import { finalizeTeamName, isValidTeamName, sanitizeTeamName } from './new-team-draft.js';
import { conflictingAgentNames } from './new-team-check.js';
import { agentPicks, agentRow, createAgentRows } from './team-agents.js';
import { launchTeamAgents } from './team-loader.js';
import {
  createStep, el, mandateWord, providerCatalog, readingRows, tagRow, templateTray, tierWord,
} from './form-steps.js';
import { closeWorkspaceTab, openWorkspaceTab, reserveWorkspaceTab, seedReservedWorkspaceTab } from './workspace.js';

const REACH = ['open', 'discuss', 'plan', 'execute'];
const RECRUIT = ['open', 'nobody', 'propose agents', 'staff agents'];
const OUTPUT = ['open', 'a plan', 'ideas', 'code', 'an artifact', 'the team', 'no code'];
const DIALS = ['user', 'read', 'write'];
const KINDS = ['coding', 'work', 'personal', 'household', 'social', 'school'];

export function createNewTeamFormView(kit, { created = null, embedded = false } = {}) {
  const { createSurface, createAction, createActionBar, createField, createNotice } = kit.primitives;

  const draft = {
    template: '', templateName: '', title: '',
    name: '', kind: 'open', objective: '',
    root: '', repos: [], branches: {},
    provider: '', model: '', reach: 'open', recruit: 'open', output: ['open'],
    dial: 'write',
    routines: {}, books: [], launchMode: 'live_dangerously',
    // The Agents this Team is raised with; the lead is a mark on one of them, not a seat.
    agents: [],
    expanded: {},
  };
  let seed = null;          // the campaign's answers, once the door has spoken
  let seedRoutines = {};    // the map as it landed — provenance's baseline
  let handRoutines = new Set();
  let templates = [];
  let routineRows = [];
  let ways = [];
  let roots = [];
  let snapshot = '';        // what the applied template wrote, for the dirty test
  let busy = false;
  let loaded = false;
  let templateOpen = false;

  const raise = createAction({
    label: t('forms.launch', 'Launch'),
    launch: true,
    size: 'compact',
    disabled: true,
    action: () => void doRaise(),
  });
  const surface = createSurface({ label: t('new_team.title', 'New Team'), className: 'ntf-surface', actions: [raise], header: !embedded });
  const notice = createNotice();
  if (embedded) {
    surface.content.classList.add('ntf-surface', 'launch-form-embed');
    const embedActions = el('div', 'launch-form-embed-actions');
    embedActions.append(raise.el);
    surface.content.append(embedActions);
  }

  // and "Make your own" is the manual door; a mode switch above the form was a second way
  // to say the same thing.

  const templateRow = () => templates.find((row) => row.name === draft.template) || null;
  const offered = () => (draft.kind === 'open' ? templates : templates.filter((row) => row.kinds.includes(draft.kind)));
  const routineOn = (name) => draft.routines[name] === true;
  const onNames = () => routineRows.filter((row) => routineOn(row.name)).map((row) => row.name);
  const providerRows = () => providerCatalog().rows
    .filter((row, at, all) => all.findIndex((other) => other.provider === row.provider) === at)
    .map((row) => {
      const unavailable = row.operational ? '' : row.off
        ? t('forms.reason_turned_off', 'turned off')
        : t('forms.reason_not_on_machine', 'not on this machine');
      return { v: row.provider, l: row.cli_label || row.provider_label || row.provider, off: unavailable || undefined };
    });
  const modelRows = (provider) => providerCatalog().rows.filter((row) => row.provider === provider).map((row) => ({
    v: row.model, l: row.model, word: tierWord(row.tier), sub: row.cost || '',
    off: !row.operational
      ? (row.off ? t('forms.reason_turned_off', 'turned off') : t('forms.reason_not_on_machine', 'not on this machine'))
      : row.model_list_current && row.listed === false
        ? t('forms.reason_not_listed', 'not listed by your {cli} {client_version}', {
          cli: row.cli_label || row.cli, client_version: row.model_list?.client_version || row.model_list_installed || '',
        })
        : undefined,
  }));

  /** What a template authors, as one string — the dirty test compares against it. */
  const authored = () => JSON.stringify({
    objective: draft.objective, books: [...draft.books].sort(), routines: draft.routines,
    mandate: [draft.reach, draft.recruit, ...draft.output], agents: draft.agents,
  });

  function applyTemplate(name) {
    draft.template = name;
    draft.expanded = {};
    const row = templateRow();
    // then you go back to make your own, it leaves the template entries there… it should
    // clear the entries below"). Back to the campaign's own answers, not to nothing — the
    // seeded defaults are what an untouched form holds. Your name, title, kind and place
    // are yours and are left alone.
    if (!row) {
      draft.objective = '';
      objectiveInput.value = '';
      draft.books = [];
      draft.routines = { ...seedRoutines };
      draft.agents = [];
      for (const key of ['reach', 'recruit']) draft[key] = seed?.seeds?.[key]?.value || 'open';
      draft.output = [seed?.seeds?.output?.value || 'open'].flat().filter(Boolean);
      snapshot = '';
      paint();
      return;
    }
    if (row.objective) { draft.objective = row.objective; objectiveInput.value = row.objective; }
    if (row.behaviours.length) draft.books = [...row.behaviours];
    for (const on of row.routines_on) if (on in draft.routines) draft.routines[on] = true;
    for (const off of row.routines_off) if (off in draft.routines) draft.routines[off] = false;
    if (row.mandate) { draft.reach = row.mandate.reach; draft.recruit = row.mandate.recruit; draft.output = [row.mandate.output].flat().filter(Boolean); }
    // carries `agents[]` in exactly the ruled wire shape `agentPicks()` produces, so it
    // reads straight into the editor — instructions becomes the row's assignment and
    // team_lead its mark, which is the same translation `agentPicks` does on the way out.
    // The old lead_brief/lead_mandate pair is gone: a lead is one marked row.
    draft.agents = (Array.isArray(row.agents) ? row.agents : []).map((pick) => ({
      ...agentRow(),
      name: pick.name || '',
      assignment: pick.instructions || '',
      lead: pick.team_lead === true,
      provider: pick.provider || '',
      model: pick.model || '',
      routinesOn: Array.isArray(pick.routines_on) ? [...pick.routines_on] : [],
      routinesOff: Array.isArray(pick.routines_off) ? [...pick.routines_off] : [],
      ...(pick.mandate ? {
        reach: pick.mandate.reach,
        recruit: pick.mandate.recruit,
        output: [pick.mandate.output].flat().filter(Boolean),
      } : {}),
    }));
    snapshot = authored();
    paint();
  }
  const templateDirty = () => !!templateRow() && authored() !== snapshot;

  /* ---- step 1 · Templates are optional; Kind exists only inside this choice. ---- */
  const stepTemplate = createStep({ n: 1, key: 'template', title: t('new_team.templates_optional', 'Templates · optional'), onToggle: () => {
    templateOpen = !templateOpen;
    paintFolds();
  } });
  const kindHost = el('div');
  const trayHost = el('div');
  stepTemplate.body.append(kindHost, trayHost);
  function paintTray() {
    trayHost.replaceChildren(templateTray(offered(), draft.template, (name) => applyTemplate(name), { includeOwn: false }));
  }
  const kindQuestions = ask([{ group: t('kind', 'Kind'), fields: [{
    key: 'kind', label: t('kind', 'Kind'), shape: 'square',
    options: ruledRows('kind', ['open', ...KINDS], (key) => t(`kind.${key}`, key === 'open' ? 'Open' : key)),
  }] }], {
    value: { kind: draft.kind },
    className: 'ntf-kind-questions',
    onChange: (value) => {
      draft.kind = value.kind;
      if (draft.template && !offered().some((row) => row.name === draft.template)) { draft.template = ''; snapshot = ''; }
      paintTray(); paintFoot(); paintActions();
    },
  });
  function paintKinds() {
    kindQuestions.set('kind', draft.kind);
    kindHost.replaceChildren(kindQuestions.el);
  }
  /* ---- step 2 · Name & instructions ---- */
  const stepTop = createStep({ n: 2, key: 'top', title: t('new_team.name_instructions', 'Name & instructions') });
  const nameInput = el('input');
  nameInput.type = 'text';
  nameInput.autocapitalize = 'off';
  nameInput.autocomplete = 'off';
  nameInput.spellcheck = false;
  nameInput.placeholder = t('new_team.name_placeholder', 'lowercase, digits, - _');
  nameInput.addEventListener('input', () => {
    const caret = nameInput.selectionStart;
    const clean = sanitizeTeamName(nameInput.value);
    if (clean !== nameInput.value) {
      nameInput.value = clean;
      nameInput.setSelectionRange(caret, caret);
    }
    draft.name = nameInput.value;
    paintName();
    paintTitle();
    paintFoot();
    paintActions(); // Launch wakes on the first character of a name
  });
  // Settle the name when the owner leaves the field: a trailing separator is legal to
  // TYPE and wrong to CREATE (new-team-draft.js has the whole argument).
  nameInput.addEventListener('blur', () => {
    const settled = finalizeTeamName(nameInput.value);
    if (settled !== nameInput.value) nameInput.value = settled;
    draft.name = settled;
    paintName();
    paintTitle();
    paintFoot();
  });
  // No spelling rule under the field: the input enforces it as you type, so a sentence
  const nameField = createField({ label: t('new_team.name', 'Team name'), control: nameInput });
  // auto-populated. Then someone could change if they wanted."). Same rule as every other
  // seeded value on these forms: the default lands, the hand has the last word.
  let titleTouched = false;
  const titleInput = el('input');
  titleInput.type = 'text';
  titleInput.spellcheck = false;
  titleInput.addEventListener('input', () => { draft.title = titleInput.value; titleTouched = true; paintFoot(); });
  const titleField = createField({ label: t('new_team.readable', 'Title'), control: titleInput });
  const derivedTitle = () => finalizeTeamName(draft.name).split(/[_-]+/).filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
  const paintTitle = () => {
    if (!titleTouched) draft.title = derivedTitle();
    if (titleInput.value !== draft.title) titleInput.value = draft.title;
  };
  const topPair = el('div', 'fs-pair');
  topPair.append(nameField.el, titleField.el);
  const paintName = () => {
    const settled = finalizeTeamName(draft.name);
    if (!settled) return nameField.setValidation('', '');
    if (!isValidTeamName(settled)) return nameField.setValidation('invalid', t('new_team.name_invalid', 'Lowercase letters, digits, _ and - only.'));
    nameField.setValidation('valid', '');
  };
  stepTop.body.append(topPair);

  /* ---- step 3 · Objective ---- */
  const objectiveInput = el('textarea');
  objectiveInput.rows = 3;
  objectiveInput.placeholder = t('new_team.objective_placeholder', 'what this team is for');
  objectiveInput.addEventListener('input', () => { draft.objective = objectiveInput.value; paintFoot(); });
  stepTop.body.append(createField({ label: t('new_team.instructions', 'Team instructions'), control: objectiveInput }).el);

  /* ---- step 4 · Where ---- */
  const stepWhere = createStep({ n: 5, key: 'where', title: t('new_team.who_where', 'Who and where') });
  const rootRows = (additional = false) => roots.filter((row) => !additional || row.repo !== false).map((row) => ({
    v: row.name, l: row.name,
    word: row.repo_profile?.worktrees === 'enabled' ? t('where.worktree', 'worktree') : t('where.checkout', 'checkout'),
  }));
  const branchField = (option) => {
    const input = el('input', 'wk-field-control'); input.type = 'text'; input.spellcheck = false;
    input.value = draft.branches[option.v] || ''; input.placeholder = t('where.branch', 'Branch');
    input.addEventListener('input', () => {
      const branch = input.value.trim();
      if (branch) draft.branches[option.v] = branch; else delete draft.branches[option.v];
      paintFoot();
    });
    return input;
  };
  const whereQuestions = ask([
    { group: t('new_agent.model_package', 'Model'), fields: [
      { key: 'provider', label: t('forms.provider', 'Model provider'), blank: t('forms.default', 'Default'), options: providerRows },
      { key: 'model', label: t('forms.model', 'Model'), blank: t('forms.default', 'Default'), after: 'provider', options: (value) => modelRows(value.provider) },
    ] },
    { group: t('where.label', 'Where it works'), fields: [
      { key: 'root', label: t('where.born_in', 'Born in'), blank: t('new_team.root_default', 'The box’s default'), options: () => rootRows() },
      { key: 'repos', label: t('where.additional', 'Additional workspaces'), many: true, after: 'root',
        options: (value) => rootRows(true).filter((row) => row.v !== value.root), row: branchField },
    ] },
  ], {
    value: { provider: draft.provider, model: draft.model, root: draft.root, repos: draft.repos },
    className: 'ntf-where-questions',
    density: 'tight',
    onChange: (value) => {
      draft.provider = value.provider; draft.model = value.model; draft.root = value.root;
      draft.repos = value.repos.filter((name) => name !== value.root);
      for (const name of Object.keys(draft.branches)) if (!draft.repos.includes(name)) delete draft.branches[name];
      paintFoot();
    },
  });
  stepWhere.body.append(whereQuestions.el);
  function paintRoots() {
    whereQuestions.set('provider', draft.provider); whereQuestions.set('model', draft.model);
    whereQuestions.set('root', draft.root); whereQuestions.set('repos', draft.repos);
  }
  const whereSummary = () => t('where.summary', 'born in {root} · {repos}', {
    root: draft.root || t('team_config.default', 'Default'),
    repos: draft.repos.length ? t('where.roots', 'also in {list}', { list: draft.repos.join(', ') })
      : t('where.none', 'no auto desk'),
  });

  /* ---- step 5 · Team kit ---- */
  const stepKit = createStep({ n: 6, key: 'kit', title: t('team_kit', 'Shared toolkit') });
  // agent to inherit from its team. It's going to be very agent-specific anyway, and I
  // think open is the only natural thing." Reach, recruit and output stay `open` in the
  // record and are asked once, on the Agent, where they mean something.
  //
  // NO CONTROL DIAL EITHER: "I want to kill it visually, even if the plumbing is still
  // there." The record keeps its field; the form stops offering it.
  // confuse a user because they have no idea what that is"). He is right, and it is worse
  // than confusing: it names the provider CLI's approval mode, every launch-table cell
  // already carries `--dangerously-bypass-approvals-and-sandbox` hardcoded, and nothing
  // in `src/spawn.ts` reads the field to change a command. It is stored and attributed
  // and delivered nowhere. Raised with the lead; the record keeps its default.
  /* Launch mode is an agent default like the model: it lands in the next Agent form and
     the hand has the last word. js/new-agent.js carries the whole argument. */
  const LAUNCH_MODES = () => [
    { key: 'configured', label: t('launch_mode.configured', 'Model provider configuration'),
      sub: t('launch_mode.configured_sub', 'Ronin adds nothing to the command. The Agent starts with whatever its provider CLI already loads.') },
    { key: 'live_dangerously', label: t('launch_mode.live', 'Dangerously'),
      sub: t('launch_mode.live_sub', 'Ronin appends that provider’s own bypass flag, so the Agent does not stop to ask.') },
  ];
  const worktreesMode = el('div', 'fs-worktrees-mode');
  const kitHost = el('div');
  let kitQuestions = null;
  let kitSignature = '';
  const routineProvenance = (name) => {
    const on = routineOn(name);
    return handRoutines.has(name)
      ? (on ? t('forms.team_on', 'team turns on') : t('forms.team_off', 'team turns off'))
      : (on ? t('forms.campaign_on', 'campaign on') : t('forms.campaign_off', 'campaign off'));
  };
  function paintKitQuestions() {
    worktreesMode.replaceChildren();
    const signature = JSON.stringify([routineRows.map((row) => row.name), ways.map((row) => row.name), [...handRoutines]]);
    if (signature !== kitSignature) {
      kitQuestions?.destroy();
      const shelfRows = (rows) => rows.map((row) => ({ v: row.name, l: row.label || row.name, sub: row.blurb || '' }));
      kitQuestions = ask([
        { group: t('launch_mode.head', 'Launch mode'), fields: [{
          key: 'launchMode', label: t('launch_mode.head', 'Launch mode'),
          options: LAUNCH_MODES().map((row) => ({ v: row.key, l: row.label, sub: row.sub })),
        }] },
        { group: t('routines', 'Routines'), fields: routineRows.map((routine) => ({
          key: `routine:${routine.name}`, label: routine.label || routine.name,
          switch: [t('on', 'On'), t('off', 'Off')], word: routineProvenance(routine.name),
        })) },
        { group: t('behaviours', 'Behaviours'), fields: [{
          key: 'books', label: t('behaviours', 'Behaviours'), many: true, options: shelfRows(ways),
        }] },
      ], {
        value: {
          launchMode: draft.launchMode,
          ...Object.fromEntries(routineRows.map((row) => [`routine:${row.name}`, routineOn(row.name)])),
          books: [...draft.books],
        },
        className: 'ntf-kit-questions',
        density: 'tight',
        onChange: (value, key) => {
          draft.launchMode = value.launchMode;
          if (key.startsWith('routine:')) {
            const name = key.slice(8); draft.routines[name] = value[key];
            if (draft.routines[name] === (seedRoutines[name] === true)) handRoutines.delete(name); else handRoutines.add(name);
            kitSignature = '';
          }
          draft.books = [...value.books];
          paintKitQuestions(); whereQuestions.paint(); paintFoot();
        },
      });
      kitSignature = signature;
      kitHost.replaceChildren(kitQuestions.el);
    }
    kitQuestions.set('launchMode', draft.launchMode);
    for (const routine of routineRows) kitQuestions.set(`routine:${routine.name}`, routineOn(routine.name));
    kitQuestions.set('books', [...draft.books]);
  }
  stepKit.body.append(worktreesMode, kitHost);

  /* ---- step 6 · Team lead ---- */
  /* ---- step 4 · the team's own agents (js/team-agents.js) ---- */
  const agents = createAgentRows({
    n: 3, key: 'lead',
    rows: () => draft.agents,
    createAction, createActionBar,
    changed: () => paintFoot(),
    onToggle: () => toggle('lead'),
  });
  const stepLead = agents.step;

  /* ---- the collapse rules: a template's answers fold; the header opens them ---- */
  const FOLDS = ['lead'];
  const steps = { template: stepTemplate, top: stepTop, lead: stepLead, defaults: null, where: stepWhere, kit: stepKit };
  function toggle(key) {
    if (draft.expanded[key]) delete draft.expanded[key];
    else draft.expanded[key] = true;
    paintFolds();
  }
  // template first offered all fifteen tiles and then quietly dropped the pick when a
  // later kind excluded it. New Agent already asked in this order; the two forms agree.
  // One list, read by the form's numbering AND by the Launch selector's outline.
  const plan = () => ['template', 'top', 'lead', 'defaults', 'where', 'kit'];
  const meta = {
    lead: () => t('new_team.agents_meta', '{n} agents', { n: draft.agents.length }),
  };
  function paintFolds() {
    stepTemplate.setCollapsed(!templateOpen, templateOpen ? '' : t('new_team.apply_template', 'Apply Template'), true);
    for (const key of FOLDS) {
      const folded = !!templateRow();
      steps[key].setCollapsed(folded && !draft.expanded[key], folded ? meta[key]() : '', folded);
    }
  }

  /* ---- Will be raised — the reading, and what an Agent born here inherits ---- */
  const foot = el('div', 'ntf-foot');
  function paintFoot() {
    const name = finalizeTeamName(draft.name);
    foot.replaceChildren();
    foot.append(readingRows([
      [t('add_agent.team', 'team'), name],
      [t('team.objective', 'Objective'), draft.objective],
      [t('add_agent.place', 'place'), whereSummary()],
      [t('new_team.agents', 'Agents'), draft.agents.some((row) => row.name)
        ? tagRow(draft.agents.filter((row) => row.name).map((row) => ({ text: row.lead ? `人 ${row.name}` : row.name, on: true })))
        : ''],
      [t('new_team.members', 'members'), (() => { const em = el('em', null, t('new_team.members_note', 'derived from live tags — never stored here')); return em; })()],
    ]));
    foot.append(el('p', 'fs-head', t('new_team.inherits', 'an agent born here inherits')));
    foot.append(readingRows([
      [t('kind', 'Kind'), draft.kind],
      [t('routines', 'Routines'), tagRow([{ text: t('new_team.floor_tag', 'floor'), on: true }, ...onNames().map((text) => ({ text, on: true }))])],
      [t('behaviours', 'Behaviours'), draft.books.length ? tagRow(draft.books.map((text) => ({ text, on: true }))) : ''],
      [t('forms.model', 'model'), draft.provider ? `${draft.provider}${draft.model ? ` / ${draft.model}` : ''}` : t('forms.default', 'default')],
      [t('launch_mode.head', 'launch mode'), LAUNCH_MODES().find((row) => row.key === draft.launchMode)?.label || draft.launchMode],
      [t('mandate', 'Mandate'), `${draft.reach} · ${draft.recruit} · ${draft.output.join(', ')}`],
      [t('add_agent.still_asked', 'still asked'), tagRow([
        t('session_type', 'Session type'), t('add_agent.name', 'name'), t('add_agent.instruction', 'instruction'),
        ...(draft.provider ? [] : [t('forms.model', 'model')]),
      ])],
    ]));
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
  // that block as a configuration that you want to use over."
  const saveRow = createActionBar({ label: t('new_team.team_actions', 'Team actions'), className: 'ntf-actions' });
  saveRow.el.append(saveName, save.el);
  // save template not at the bottom with the blurb that is the packet"). The reading IS
  // the thing being saved — what this Team amounts to — so the button that saves it sits
  // beneath it, not inside one of the steps that feeds it. Mounted at the surface below.
  function paintActions() {
    // keyword everywhere for starting a new team and starting a new agent." Grey while
    // there is no name, kaki — the house's go colour — the moment there is one.
    const ready = !!finalizeTeamName(draft.name);
    raise.setDisabled(!ready);
    if (ready) raise.el.dataset.kind = 'primary';
    else delete raise.el.dataset.kind;
    const own = !templateRow();
    const dirty = templateDirty();
    saveName.hidden = !(own || dirty);
    save.el.hidden = saveName.hidden;
    save.el.textContent = own ? t('save_template', 'Save as template') : t('new_team.save_as_new', 'Save as new template');
  }

  const rosterBody = (name) => ({
    name,
    title: draft.title.trim(),
    kind: draft.kind,
    objective: draft.objective.trim(),
    project_root: draft.root,
    repos: draft.repos,
    branches: draft.branches,
    features: (seed?.features || []).filter((row) => row.on).map((row) => row.name),
    behaviours: { books: [...draft.books] },
    agent_defaults: {
      provider: draft.provider, model: draft.model,
      reach: draft.reach, recruit: draft.recruit, output: draft.output,
      dial: draft.dial, launch_mode: draft.launchMode,
    },
  });

  async function doRaise() {
    const name = finalizeTeamName(draft.name);
    if (busy || !isValidTeamName(name)) {
      if (!busy) notice.set('failed', t('new_team.name_invalid', 'Lowercase letters, digits, _ and - only.'));
      return;
    }
    const launchTab = reserveWorkspaceTab();
    busy = true;
    raise.setDisabled(true);
    const picks = agentPicks(draft.agents);
    // CHECK BEFORE THE FIRST WRITE. The launch door rightly refuses an explicit name
    // collision, but discovering one after POST /api/team-rosters leaves a Team with only
    // part of the cast. The form knows the whole proposed cast, so its gate checks both
    // the live set and duplicates inside the form before it creates anything.
    if (picks.length) {
      notice.set('info', t('new_team.checking_names', 'Checking Agent names…'));
      const live = await request('/api/sessions', { cache: 'no-store' });
      if (!live.ok) {
        closeWorkspaceTab(launchTab);
        busy = false;
        raise.setDisabled(false);
        return notice.set('failed', t('new_team.name_check_failed', 'Agent names could not be checked, so nothing was created. {reason}', {
          reason: live.message,
        }));
      }
      const conflicts = conflictingAgentNames(picks, Array.isArray(live.data) ? live.data : []);
      if (conflicts.length) {
        closeWorkspaceTab(launchTab);
        busy = false;
        raise.setDisabled(false);
        return notice.set('failed', t('new_team.agent_name_taken', 'Nothing was created. Choose another name for: {names}.', {
          names: conflicts.join(', '),
        }));
      }
    }
    notice.set('info', t('new_team.raising', 'Raising the team…'));
    // THE LOADER OWNS THE CAST (@team_loader, agreed on the board): one call creates the
    // record and, only if that succeeded, sends every picked row through the launch door.
    //
    // `agentPicks` is where the screen's words become the route's: a row says assignment
    // and lead, the wire says instructions and team_lead (lead's P0 ruling).
    // THE CANONICAL ROSTER DOOR STAYS HERE and is the duplicate-submit gate: only the
    // request that creates the Team reaches the staffing handoff, so pressing Raise twice
    // cannot birth the cast twice (@team_loader's refinement, taken).
    const made = await request('/api/team-rosters', { method: 'POST', json: rosterBody(name) });
    if (!made.ok) {
      closeWorkspaceTab(launchTab);
      busy = false;
      raise.setDisabled(false);
      return notice.set('failed', made.message);
    }
    // Then the cast, through the loader: births are awaited in order because every one
    // updates this Team's membership record. `agentPicks` is where the screen's words
    // become the route's — a row says assignment and lead, the wire says instructions
    // and team_lead.
    const outcomes = await launchTeamAgents(request, name, picks);
    const refused = outcomes.filter(({ result }) => !result?.ok);
    busy = false;
    raise.setDisabled(false);
    if (refused.length) {
      const born = outcomes.filter(({ result }) => result?.ok).map(({ row }) => row.name);
      notice.set('failed', t('new_team.staffing_failed', 'Team created. Launched {launched} of {total} Agents: {born}. Failed: {names}. The Team is open; add the failed Agents there.', {
        launched: born.length,
        failed: refused.length,
        total: outcomes.length,
        born: born.length ? born.join(', ') : t('forms.none', 'none'),
        names: refused.map(({ row }) => row.name).join(', '),
      }));
      seedReservedWorkspaceTab(launchTab, 'team', { tabName: '' });
      openWorkspaceTab('team', name, launchTab);
      return;
    }
    notice.set('', '');
    reset();
    await created?.(name);
    // The reserved tab cloned the opener's sessionStorage when it was opened. A Team tab
    // name belongs to that older tab, not to the Team born here; clear it so the new page
    // falls back to the roster title (and ultimately the Team name).
    seedReservedWorkspaceTab(launchTab, 'team', { tabName: '' });
    openWorkspaceTab('team', name, launchTab);
  }

  async function doSave() {
    const token = draft.templateName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (!token) return;
    const routinesOn = routineRows.filter((row) => routineOn(row.name) && seedRoutines[row.name] !== true).map((row) => row.name);
    const routinesOff = routineRows.filter((row) => !routineOn(row.name) && seedRoutines[row.name] === true).map((row) => row.name);
    // THE TEAM SHELF: a cast, not a loadout. Save-as-new only, per shelf.
    const result = await request('/api/templates/teams', {
      method: 'POST',
      json: {
        name: token,
        label: draft.templateName.trim(),
        art: templateRow()?.art || '＋',
        blurb: draft.objective.trim().slice(0, 120),
        kinds: draft.kind === 'open' ? KINDS : [draft.kind],
        objective: draft.objective.trim(),
        mandate: `${draft.reach} · ${draft.recruit} · ${draft.output.join(', ')}`,
        behaviours: draft.books,
        routines_on: routinesOn,
        routines_off: routinesOff,
        // The same rows the loader launches — one shape, produced in one place.
        agents: agentPicks(draft.agents),
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

  function reset() {
    draft.template = '';
    draft.name = '';
    draft.objective = '';
    draft.repos = []; draft.branches = {};
    draft.books = [];
    draft.agents = [];
    draft.expanded = {};
    snapshot = '';
    handRoutines = new Set();
    nameInput.value = '';
    titleInput.value = '';
    titleTouched = false;
    objectiveInput.value = '';
    applySeed();
    paint();
  }

  /** The campaign's answers LAND — once, whole, before any hand has touched the form. */
  function applySeed() {
    if (!seed) return;
    const value = (field) => seed.seeds?.[field]?.value;
    draft.root = value('project_root') || '';
    draft.provider = value('provider') || '';
    draft.model = value('model') || '';
    for (const key of ['reach', 'recruit', 'dial']) {
      if (value(key)) draft[key] = value(key);
    }
    if (value('output')) draft.output = [value('output')].flat().filter(Boolean);
    // § 7.2 is { provider, model, reach, recruit, output, dial, launch_mode }. Named on its
    // own because the seed's key is snake and the draft's is camel — folding it into the
    // loop above would have written `draft.launch_mode` and seeded nothing, forever.
    if (value('launch_mode')) draft.launchMode = value('launch_mode');
    draft.books = Array.isArray(value('behaviours')) ? [...value('behaviours')] : [];
    seedRoutines = Object.fromEntries((seed.routines || []).map((row) => [row.name, row.on]));
    draft.routines = { ...seedRoutines };
    paintRoots();
  }

  function paint() {
    plan().forEach((key, index) => steps[key].setNumber(index + 1));
    stepPayload.setNumber(plan().length + 1);
    stepDefaults.setCollapsed(!defaultsOpen, t('new_team.defaults_summary', 'Settings inherited by Agents launched in this Team'), true);
    for (const key of ['where', 'kit']) steps[key].el.hidden = !defaultsOpen;
    stepPayload.setCollapsed(!payloadOpen, t('forms.payload_summary', 'Review what Launch will create'), true);
    paintTray();
    paintKinds();
    paintName();
    paintRoots();
    agents.paint();
    paintKitQuestions();
    paintFolds();
    paintActions();
    paintFoot();
  }

  const form = el('div', 'ntf-form');
  // ONE BAND OVER EVERYTHING THAT IS A DEFAULT, and it folds them all away together: a
  // Team can be raised without ever opening it, which is the point of saying so here
  // rather than repeating "this is a default, not a constraint" on each field below.
  let defaultsOpen = false;
  const stepDefaults = createStep({ n: 5, key: 'defaults', title: t('new_team.agent_defaults', 'Agent defaults'), onToggle: () => {
    defaultsOpen = !defaultsOpen;
    paint();
  } });
  steps.defaults = stepDefaults;
  // The final review stays folded until asked for and explains what opening it reveals.
  let payloadOpen = false;
  const stepPayload = createStep({ n: 8, key: 'payload', title: t('forms.payload', 'Payload'), onToggle: () => {
    payloadOpen = !payloadOpen;
    stepPayload.setCollapsed(!payloadOpen, t('forms.payload_summary', 'Review what Launch will create'), true);
  } });
  stepPayload.body.append(foot, saveRow.el);
  stepPayload.setCollapsed(true, t('forms.payload_summary', 'Review what Launch will create'), true);
  form.append(stepTemplate.el, stepTop.el, stepLead.el, stepDefaults.el, stepWhere.el, stepKit.el, stepPayload.el);
  surface.content.append(form, notice.el);

  return {
    el: embedded ? surface.content : surface.el,
    enter: async (detail = {}) => {
      paint();
      const [seeded, tray, catalog, rootRows, wayRows] = await Promise.all([
        request('/api/launch-seed'),
        request('/api/templates/teams'),
        request('/api/routines'),
        request('/api/project-roots'),
        request('/api/ways'),
      ]);
      ways = wayRows.ok && Array.isArray(wayRows.data) ? wayRows.data : [];
      templates = tray.ok && Array.isArray(tray.data) ? tray.data : [];
      routineRows = catalog.ok && Array.isArray(catalog.data) ? catalog.data : [];
      roots = rootRows.ok && Array.isArray(rootRows.data) ? rootRows.data : [];
      if (seeded.ok) seed = seeded.data;
      // The seed lands only while the form is untouched — re-entering an open draft
      // must not overwrite the owner's hand.
      if (!loaded) { applySeed(); loaded = true; }
      if (typeof detail?.template === 'string' && detail.template) applyTemplate(detail.template);
      if (typeof detail?.prompt === 'string' && detail.prompt.trim()) {
        draft.objective = detail.prompt.trim();
        objectiveInput.value = draft.objective;
      }
      paint();
    },
  };
}

/** Form-only adapter for an existing work-surface detail region. */
export function createEmbeddedNewTeamFormView(kit, options = {}) {
  return createNewTeamFormView(kit, { ...options, embedded: true });
}
