/* part of the ronin-cowork client — see js/README.md */
import { request } from './request.js';
import { t } from './lexicon.js';
import { appendProjectReading } from './project-reading.js';

const COLUMNS = [
  { key: 'IDEA', label: 'Idea', worker: 'lead' },
  { key: 'PLAN', label: 'Plan', worker: 'Agent with the owner' },
  { key: 'BUILD', label: 'Build', worker: 'Agent' },
  { key: 'REVIEW', label: 'Review', worker: 'lead' },
  { key: 'LAND', label: 'Land', worker: 'lead, then user' },
  { key: 'DONE', label: 'Done', worker: '' },
];
export { COLUMNS as PROJECT_STAGES };
const INDEX = Object.fromEntries(COLUMNS.map((column, index) => [column.key, index]));
let nextHeaderId = 0;
export const KANBAN_NOT_INSTALLED = 'Unavailable.';
export const KANBAN_CAMPAIGN_OFF = 'Unavailable.';

export const taskManagerScope = (value = {}) => {
  const kind = ['team', 'agent'].includes(value.kind) ? value.kind : 'team';
  const teams = [...new Set((typeof value.teams === 'function' ? value.teams() : value.teams || [value.team]).map(String).filter(Boolean))];
  return { kind, teams, agent: kind === 'agent' ? String(value.agent || '') : '' };
};
/** Rows are the team reading's items (GET /api/work-items?team=); the Agent scope keeps
 * the items that Agent holds. */
export const projectsForScope = (rows, scope) => {
  const seen = new Set();
  return rows.map(normalizedProject)
    .filter((project) => (!scope.agent || project.holder === `agent:${scope.agent}`) && !seen.has(project.id) && seen.add(project.id));
};

export function kanbanAvailability(installed) {
  const capabilities = installed?.services?.capabilities;
  const available = capabilities?.desired?.task_manager === true && Array.isArray(capabilities.running) && capabilities.running.includes('task_manager');
  return { available, message: available ? '' : KANBAN_CAMPAIGN_OFF };
}

const node = (tag, cls, text) => {
  const out = document.createElement(tag);
  if (cls) out.className = cls;
  if (text != null) out.textContent = String(text);
  return out;
};
export const stageLabel = (key) => COLUMNS[INDEX[key]]?.label || key;
/** The item's comments, after the evidence lines older trails carry (a comment replaced them). */
export const commentsOf = (value) => [
  ...(Array.isArray(value?.trail) ? value.trail.filter((line) => line?.op === 'evidence').map((line) => String(line.note || '')) : []),
  ...(Array.isArray(value?.comments) ? value.comments.map((comment) => String(comment?.text || '')) : []),
];
const normalizedProject = (value) => ({
  ...value,
  id: String(value?.id || ''),
  title: String(value?.title || value?.id || 'Untitled work item'),
  objective: String(value?.objective || ''),
  comments: commentsOf(value),
  holder: String(value?.holder || ''),
  status: INDEX[value?.status] == null ? 'IDEA' : value.status,
  flagged: value?.flagged === true,
  parent: value?.parent ? String(value.parent) : '',
});

/** Jira's flag: an impediment, marked the same way on every surface. */
export const FLAG_MARK = '⚑';

export function definedTargets(project) {
  const targets = new Set();
  if (project.status === 'DONE') return targets;
  if (COLUMNS[INDEX[project.status] + 1]) targets.add(COLUMNS[INDEX[project.status] + 1].key);
  if (project.status === 'PLAN') targets.add('IDEA');
  return targets;
}

const meaningLine = (move) => move.text.split('meaning: ')[1]?.split('\n')[0] || '';

/** Who works an item now: its Agent, or the lead when the Team holds it; nobody when parked. */
export const holderOf = (project, leadName) => project.holder.startsWith('agent:') ? project.holder.slice(6)
  : project.holder.startsWith('team:') ? leadName : '';

/** One work item as one line: title, who holds it, and a status bar (a segment per column,
 * filled to its status, the current one marked, red when flagged). */
export function itemLine(value, { holder = '', stage = false } = {}) {
  const item = normalizedProject(value);
  const line = node('div', 'tk-line');
  if (stage) line.classList.add('tk-line-worded');
  line.dataset.item = item.id;
  line.append(node('span', 'tk-line-title', item.title));
  const bar = node('span', 'tk-stage-bar');
  bar.title = [stageLabel(item.status), item.flagged ? 'flagged' : ''].filter(Boolean).join(' · ');
  bar.setAttribute('aria-label', bar.title);
  COLUMNS.forEach((column, index) => {
    const segment = node('i', index < INDEX[item.status] ? 'past' : index === INDEX[item.status] ? `now${item.flagged ? ' flagged' : ''}` : '');
    segment.title = column.label;
    bar.append(segment);
  });
  // `stage: true` says the status in a word beside the bar (the Team profile asked for it).
  line.append(node('span', 'tk-line-holder', holder ? `@${holder}` : ''), ...(stage ? [node('span', 'tk-line-stage', stageLabel(item.status))] : []), bar);
  return line;
}

/** The exact one-message write path described by the Team Kanban concept. */
export function moveMessage(project, toStage, leadName, now = new Date()) {
  const fromIndex = INDEX[project.status];
  const toIndex = INDEX[toStage];
  const forward = toIndex === fromIndex + 1;
  const holder = holderOf(project, leadName) || leadName;
  const id = project.id;
  const at = now.toISOString().slice(0, 16) + 'Z';
  const head = `from @kanban (the Team Task Manager, moved by the user at ${at}):`;
  const line = `MOVE ${id} "${project.title}" from ${stageLabel(project.status)}${project.flagged ? ' (flagged)' : ''} to ${stageLabel(toStage)}`;
  const result = (target, meaning, next) => ({ target, text: `${head}\n${line}\n  meaning: ${meaning}\n  next: ${next}` });

  if (project.status === 'PLAN' && toStage === 'IDEA') {
    return result(leadName, 'return it to Idea; the Team holds it again.', `item transition ${id} IDEA, then item assign ${id} team:${project.team || '<team>'}`);
  }
  if (!forward) return { target: holder, text: `${head}\n${line}\n  meaning: no defined move; delivered as a plain request.` };
  if (project.flagged) {
    return result(holder, 'a request to move on, not an approval; the card is flagged.', `your call — say what stops it, or item edit ${id} --flagged false when it is clear.`);
  }
  if (project.status === 'IDEA') return result(leadName, 'engage — the user wants this started.', `item assign ${id} <session>, or raise an Agent for it`);
  if (project.status === 'PLAN') return result(holder, 'the plan is agreed; build.', `item transition ${id} BUILD`);
  if (project.status === 'BUILD') return result(holder, 'show approved; ready it for review.', `item transition ${id} REVIEW`);
  if (project.status === 'REVIEW') return result(holder, 'review passed; hand in.', `worktree-desk hand-in <repo> --item ${id}   (the hand-in moves it to Land)`);
  if (project.status === 'LAND') return result(leadName, 'promote.', `bin/ronin-promote ${project.team || '<team>'}   (the promotion moves it to Done)`);
  return { target: holder, text: `${head}\n${line}\n  meaning: delivered as a plain request.` };
}

export function createTeamKanban(options = {}) {
  const root = node('div', 'tk-kanban');
  const header = node('div', 'tk-header');
  const headerRow = node('div', 'tk-header-row');
  const beta = node('strong', 'tk-beta', t('team_kanban.beta', 'Beta'));
  const headerToggle = node('button', 'tk-header-toggle');
  headerToggle.type = 'button';
  const headerMessage = node('p', 'tk-header-message', t('team_kanban.beta_message', 'Task Manager is in beta. Follow work items from ideas to done using Tools and the Work Record. We’re making it easier for Agents to keep them current without forcing upkeep.'));
  headerMessage.id = `tk-header-message-${++nextHeaderId}`;
  headerToggle.setAttribute('aria-controls', headerMessage.id);
  headerRow.append(beta, headerToggle);
  header.append(headerRow, headerMessage);
  const setHeaderExpanded = (expanded) => {
    header.dataset.expanded = String(expanded);
    headerToggle.setAttribute('aria-expanded', String(expanded));
    headerToggle.textContent = expanded
      ? t('team_kanban.header_collapse', 'Collapse')
      : t('team_kanban.header_expand', 'Expand');
    headerMessage.hidden = !expanded;
  };
  headerToggle.addEventListener('click', () => setHeaderExpanded(header.dataset.expanded !== 'true'));
  setHeaderExpanded(true);
  const legend = node('div', 'tk-legend');
  const flagLegend = node('span'); flagLegend.append(node('i', 'tk-dot flagged'), document.createTextNode(t('team_kanban.flagged', 'flagged'))); legend.append(flagLegend);
  const notice = node('p', 'tk-notice');
  notice.setAttribute('role', 'status');
  const controls = node('div', 'tk-controls');
  const refreshButton = node('button', 'tk-refresh', '↻');
  refreshButton.type = 'button';
  refreshButton.setAttribute('aria-label', 'Refresh Task Manager');
  const foldButton = node('button', 'tw-agent-density tk-fold');
  foldButton.type = 'button';
  const foldLines = node('span', 'tw-agent-density-lines');
  foldLines.append(node('i'), node('i'));
  foldButton.append(foldLines);
  controls.append(refreshButton, foldButton);
  const topline = node('div', 'tk-topline');
  topline.append(controls, notice, legend);
  const board = node('div', 'tk-board');
  root.append(header, topline, board);

  let team = '';
  let scope = options.scope || {};
  let view = options.view || 'overview';
  let viewKey = String(options.detail?.stage || options.detail?.project || '');
  let projects = [];
  let entered = false;
  let loading = null;
  let seat = null;
  let availability = { available: false, message: KANBAN_NOT_INSTALLED };
  let allOpen = false;
  const openCards = new Set();
  const asked = new Map(); // id -> { stage, target }; never written to the work item
  const leadName = (project) => String(options.lead?.(project) || '');
  const holderName = (project) => holderOf(project, leadName(project));
  const effectiveScope = () => scope.kind === 'team' && team ? taskManagerScope({ kind: 'team', team }) : taskManagerScope(scope);
  const navigate = (nextView, key = '') => {
    const detail = { scope: effectiveScope(), ...(nextView === 'status' ? { stage: key } : { project: key }) };
    if (nextView !== 'overview' && options.openSurface?.(nextView, detail)) return;
    view = nextView; viewKey = key; render();
  };

  const paintFold = () => {
    foldButton.dataset.lines = allOpen ? 'one' : 'two';
    foldButton.setAttribute('aria-pressed', String(allOpen));
    foldButton.setAttribute('aria-label', allOpen ? 'Show card titles only' : 'Show full cards');
  };

  const render = () => {
    board.replaceChildren();
    topline.hidden = !availability.available;
    if (!availability.available) {
      board.append(node('p', 'tk-unavailable', KANBAN_NOT_INSTALLED));
      return;
    }
    if (view === 'project') {
      const project = projects.find((item) => item.id === viewKey);
      const detail = node('article', 'tk-project-detail');
      const back = node('button', 'tk-back', t('team_kanban.back', 'Back to Task Manager')); back.type = 'button'; back.addEventListener('click', () => navigate('overview'));
      detail.append(back);
      if (!project) detail.append(node('p', 'tk-empty', t('team_kanban.project_missing', 'This work item is not in the current scope.')));
      else {
        appendProjectReading(detail, project, { holder: holderName(project), stage: stageLabel(project.status), prefix: 'tk' });
      }
      board.append(detail); return;
    }
    const shownColumns = view === 'status' ? COLUMNS.filter((column) => column.key === viewKey) : COLUMNS;
    if (view === 'status') {
      const back = node('button', 'tk-back', t('team_kanban.back', 'Back to Task Manager')); back.type = 'button'; back.addEventListener('click', () => navigate('overview')); board.append(back);
    }
    for (const column of shownColumns) {
      const columnProjects = projects.filter((project) => project.status === column.key);
      const section = node('section', 'tk-column');
      section.dataset.stage = column.key;
      const heading = node('h3');
      const statusOpen = node('button', 'tk-column-open', column.label); statusOpen.type = 'button'; statusOpen.addEventListener('click', () => navigate('status', column.key));
      heading.append(statusOpen);
      if (column.worker) heading.append(node('span', 'tk-column-worker', column.worker));
      const hint = node('p', 'tk-drop-hint');
      const cards = node('div', 'tk-cards');
      if (!columnProjects.length) cards.append(node('p', 'tk-empty', t('team_kanban.empty', 'nothing here')));
      for (const project of columnProjects) {
        const card = node('article', 'wk-card tk-card');
        card.draggable = true;
        card.dataset.project = project.id;
        const isOpen = allOpen || openCards.has(project.id);
        card.classList.toggle('open', isOpen);
        if (project.flagged) card.dataset.flagged = 'true';
        const toggle = node('button', 'tk-card-toggle');
        toggle.type = 'button';
        toggle.setAttribute('aria-expanded', String(isOpen));
        toggle.append(node('span', 'wk-card-heading tk-title', project.title));
        card.append(toggle);
        const details = node('div', 'tk-details');
        details.append(node('p', 'wk-card-summary tk-outcome', project.objective));
        if (project.comments.length) details.append(node('p', 'tk-comments', project.comments.join(' · ')));
        const row = node('div', 'wk-card-meta tk-card-row');
        if (project.flagged) row.append(node('span', 'tk-flag', `${FLAG_MARK} ${t('team_kanban.flagged', 'flagged')}`));
        const owner = holderName(project);
        if (owner) {
          const open = node('button', 'tk-owner', `@${owner}`);
          open.type = 'button';
          open.addEventListener('click', (event) => { event.stopPropagation(); options.openOwner?.(owner); });
          row.append(open);
        }
        const pending = asked.get(project.id);
        if (pending?.stage === project.status) row.append(node('span', 'tk-asked', `asked @${pending.target}`));
        else if (pending) asked.delete(project.id);
        const openProject = node('button', 'tk-project-open', t('team_kanban.open_project', 'Open work item'));
        openProject.type = 'button'; openProject.addEventListener('click', () => navigate('project', project.id)); row.append(openProject);
        card.append(details, row);
        const toggleOpen = () => {
          if (openCards.has(project.id)) openCards.delete(project.id);
          else openCards.add(project.id);
          allOpen = projects.length > 0 && projects.every((item) => openCards.has(item.id));
          paintFold(); render();
        };
        toggle.addEventListener('click', toggleOpen);
        card.addEventListener('click', (event) => {
          if (!event.target.closest('button')) navigate('project', project.id);
        });
        card.addEventListener('dragstart', (event) => {
          event.dataTransfer?.setData('text/plain', project.id);
          card.classList.add('dragging'); board.classList.add('dragging');
          const targets = definedTargets(project);
          for (const target of board.querySelectorAll('.tk-column')) {
            const defined = targets.has(target.dataset.stage);
            target.classList.toggle('means', defined);
            target.querySelector('.tk-drop-hint').textContent = defined
              ? `drop here: ${meaningLine(moveMessage(project, target.dataset.stage, leadName()))}`
              : '';
          }
        });
        card.addEventListener('dragend', () => {
          card.classList.remove('dragging'); board.classList.remove('dragging');
          for (const item of board.querySelectorAll('.tk-column')) {
            item.classList.remove('means', 'over');
            item.querySelector('.tk-drop-hint').textContent = '';
          }
        });
        cards.append(card);
      }
      section.append(heading, hint, cards);
      section.addEventListener('dragover', (event) => { event.preventDefault(); section.classList.add('over'); });
      section.addEventListener('dragleave', () => section.classList.remove('over'));
      section.addEventListener('drop', (event) => {
        event.preventDefault(); section.classList.remove('over');
        const id = event.dataTransfer?.getData('text/plain') || '';
        const project = projects.find((item) => item.id === id);
        if (project && project.status !== column.key) void sendMove(project, column.key);
      });
      board.append(section);
    }
  };

  const sendMove = async (project, toStage) => {
    const move = moveMessage(project, toStage, leadName(project));
    if (!move.target) { notice.textContent = t('team_kanban.no_target', 'This work item has no live holder to ask.'); return; }
    notice.textContent = t('team_kanban.sending', 'Sending move request to @{name}…', { name: move.target });
    const result = await request('/api/messages', { method: 'POST', json: { target: move.target, text: move.text } });
    if (!result.ok) {
      notice.textContent = t('team_kanban.send_failed', 'The move request could not be sent.');
      return;
    }
    asked.set(project.id, { stage: project.status, target: move.target });
    notice.textContent = result.data.delivered
      ? t('team_kanban.delivered', 'Move request delivered to @{name}. The card moves when its record moves.', { name: move.target })
      : t('team_kanban.queued', 'Move request queued for @{name}. The card moves when its record moves.', { name: move.target });
    render();
  };

  const refresh = async () => {
    if (!effectiveScope().teams.length || loading || (seat && seat.hidden)) return loading;
    if (!availability.available) {
      projects = [];
      notice.textContent = availability.message;
      render();
      return;
    }
    const requestedScope = effectiveScope();
    notice.textContent = t('team_kanban.loading', 'Loading Task Manager…');
    loading = Promise.all(requestedScope.teams.map((name) => request(`/api/work-items?team=${encodeURIComponent(name)}`, { cache: 'no-store' })));
    const results = await loading;
    loading = null;
    if (JSON.stringify(effectiveScope()) !== JSON.stringify(requestedScope)) { if (entered) void refresh(); return; }
    const failures = results.filter((result) => !result.ok);
    if (!failures.length) {
      projects = projectsForScope(results.flatMap((result, index) => (Array.isArray(result.data.items) ? result.data.items : [])
        .map((project) => ({ ...project, team: String(result.data.team || requestedScope.teams[index] || '') }))), requestedScope);
      notice.textContent = '';
    } else {
      notice.textContent = t('team_kanban.failed', 'Could not load Task Manager.');
    }
    render();
  };

  refreshButton.addEventListener('click', () => void refresh());
  foldButton.addEventListener('click', () => {
    allOpen = !allOpen;
    openCards.clear();
    if (allOpen) for (const project of projects) openCards.add(project.id);
    paintFold(); render();
  });
  paintFold();

  return {
    el: root,
    mount: (host) => { seat = host; },
    enter: () => {
      entered = true;
      void refresh();
    },
    leave: () => { entered = false; },
    destroy: () => { entered = false; },
    setTeam: (name) => {
      if (taskManagerScope(scope).kind !== 'team') return;
      const next = String(name || '');
      if (team === next) return;
      team = next; projects = []; asked.clear(); openCards.clear(); allOpen = false; paintFold(); render();
      if (entered) void refresh();
    },
    setScope: (next) => { scope = next || {}; team = ''; projects = []; if (entered) void refresh(); },
    setAvailability: (next) => {
      availability = next?.available === true
        ? { available: true, message: '' }
        : { available: false, message: String(next?.message || KANBAN_NOT_INSTALLED) };
      if (!availability.available) { projects = []; notice.textContent = availability.message; render(); }
      if (entered && availability.available) void refresh();
    },
    refresh,
  };
}
