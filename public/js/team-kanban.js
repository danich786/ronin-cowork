/* part of the ronin-cowork client — see js/README.md */
import { request } from './request.js';
import { t } from './lexicon.js';

const COLUMNS = [
  { key: 'IDEAS', label: 'Ideas' },
  { key: 'PLANNING', label: 'Planning' },
  { key: 'BUILDING', label: 'Building' },
  { key: 'LANDING', label: 'Landing' },
  { key: 'DONE', label: 'Done' },
];
const INDEX = Object.fromEntries(COLUMNS.map((column, index) => [column.key, index]));

const node = (tag, cls, text) => {
  const out = document.createElement(tag);
  if (cls) out.className = cls;
  if (text != null) out.textContent = String(text);
  return out;
};
const stageLabel = (key) => COLUMNS[INDEX[key]]?.label || key;
const normalizedProject = (value) => ({
  ...value,
  id: String(value?.id || ''),
  title: String(value?.title || value?.id || 'Untitled project'),
  objective: String(value?.objective || ''),
  holder: String(value?.holder || 'lead'),
  stage: INDEX[value?.stage] == null ? 'IDEAS' : value.stage,
  exit: String(value?.exit || 'none'),
  status: ['green', 'yellow', 'red'].includes(value?.status) ? value.status : 'yellow',
});

const chipFor = (project) => {
  if (project.stage === 'DONE') return null;
  if (project.status === 'green') return { cls: 'green', text: project.exit === 'none' ? 'ready' : `ready: ${project.exit}` };
  if (project.status === 'red') return { cls: 'red', text: 'blocked' };
  return null;
};

export function definedTargets(project) {
  const targets = new Set();
  if (project.stage === 'DONE') return targets;
  if (project.status === 'green' && COLUMNS[INDEX[project.stage] + 1]) targets.add(COLUMNS[INDEX[project.stage] + 1].key);
  if (project.stage === 'PLANNING') targets.add('IDEAS');
  return targets;
}

const meaningLine = (move) => move.text.split('meaning: ')[1]?.split('\n')[0] || '';

/** The exact one-message write path described by the Team Kanban concept. */
export function moveMessage(project, toStage, leadName, now = new Date()) {
  const fromIndex = INDEX[project.stage];
  const toIndex = INDEX[toStage];
  const forward = toIndex === fromIndex + 1;
  const holder = project.holder === 'lead' ? leadName : project.holder;
  const n = project.id.split('/').at(-1);
  const at = now.toISOString().slice(0, 16) + 'Z';
  const head = `from @kanban (the Team Kanban, moved by the user at ${at}):`;
  const line = `MOVE ${project.id} "${project.title}" from ${stageLabel(project.stage)} (${project.status}, exit: ${project.exit}) to ${stageLabel(toStage)}`;
  const byNote = project.exit !== 'user' && project.exit !== 'none' ? ` (exit named the ${project.exit}; the user dragged it)` : '';
  const result = (target, meaning, next) => ({ target, text: `${head}\n${line}\n  meaning: ${meaning}\n  next: ${next}` });

  if (project.stage === 'PLANNING' && toStage === 'IDEAS') {
    return result(leadName, 'return it to Ideas; the house moves it back to the roster.', `work-record project return ${n}   (end @${project.holder} if this was its only project)`);
  }
  if (!forward) return { target: holder, text: `${head}\n${line}\n  meaning: no defined move; delivered as a plain request.` };
  if (project.status !== 'green') {
    return result(holder, `a request to move on, not an approval; the card is ${project.status === 'red' ? 'blocked' : 'being worked'}.`, 'your call — say why not, or set it green when it is ready.');
  }
  if (project.stage === 'IDEAS') return result(leadName, 'engage — the user wants this started.', `assign it to an Agent, or raise one for it (project ${n} lands in that Agent's work record)`);
  if (project.stage === 'PLANNING') return result(holder, `the plan is agreed${byNote}; build.`, `work-record project write ${n} --stage BUILDING`);
  if (project.stage === 'BUILDING') return result(holder, `show approved${byNote}; hand in.`, `worktree-desk hand-in, then work-record project write ${n} --stage LANDING`);
  if (project.stage === 'LANDING') {
    const release = project.exit === 'user';
    return result(leadName, `${release ? 'release — merge the dev → master pull request' : 'promote'}${byNote}.`, release ? 'open or merge the pull request' : `bin/ronin-promote ${project.id.split('/')[0]}`);
  }
  return { target: holder, text: `${head}\n${line}\n  meaning: delivered as a plain request.` };
}

export function createTeamKanban(options = {}) {
  const root = node('div', 'tk-kanban');
  const legend = node('div', 'tk-legend');
  for (const [status, label] of [['green', 'ready to move'], ['yellow', 'working'], ['red', 'blocked']]) {
    const item = node('span'); item.append(node('i', `tk-dot ${status}`), document.createTextNode(label)); legend.append(item);
  }
  const notice = node('p', 'tk-notice');
  notice.setAttribute('role', 'status');
  const topline = node('div', 'tk-topline');
  topline.append(notice, legend);
  const board = node('div', 'tk-board');
  root.append(topline, board);

  let team = '';
  let projects = [];
  let entered = false;
  let loading = null;
  let refreshTimer = 0;
  let seat = null;
  let visibility = null;
  const asked = new Map(); // id -> { stage, target }; never written to the project record
  const leadName = () => String(options.lead?.() || '');
  const holderName = (project) => project.holder === 'lead' ? leadName() : project.holder;

  const render = () => {
    board.replaceChildren();
    for (const column of COLUMNS) {
      const columnProjects = projects.filter((project) => project.stage === column.key);
      const section = node('section', 'tk-column');
      section.dataset.stage = column.key;
      const heading = node('h3');
      heading.append(document.createTextNode(column.label), node('span', 'tk-count', columnProjects.length));
      const hint = node('p', 'tk-drop-hint');
      const cards = node('div', 'tk-cards');
      if (!columnProjects.length) cards.append(node('p', 'tk-empty', t('team_kanban.empty', 'nothing here')));
      for (const project of columnProjects) {
        const card = node('article', 'wk-card tk-card');
        card.draggable = true;
        card.dataset.project = project.id;
        if (project.stage !== 'DONE') card.dataset.status = project.status;
        card.append(node('h4', 'wk-card-heading tk-title', project.title), node('p', 'wk-card-summary tk-outcome', project.objective));
        const row = node('div', 'wk-card-meta tk-card-row');
        const chip = chipFor(project);
        if (chip) row.append(node('span', `tk-chip ${chip.cls}`, chip.text));
        const owner = holderName(project);
        if (owner) {
          const open = node('button', 'tk-owner', `@${owner}`);
          open.type = 'button';
          open.addEventListener('click', () => options.openOwner?.(owner));
          row.append(open);
        }
        const pending = asked.get(project.id);
        if (pending?.stage === project.stage) row.append(node('span', 'tk-chip asked', `asked @${pending.target}`));
        else if (pending) asked.delete(project.id);
        card.append(row);
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
        if (project && project.stage !== column.key) void sendMove(project, column.key);
      });
      board.append(section);
    }
  };

  const sendMove = async (project, toStage) => {
    const move = moveMessage(project, toStage, leadName());
    if (!move.target) { notice.textContent = t('team_kanban.no_target', 'This project has no live holder to ask.'); return; }
    notice.textContent = t('team_kanban.sending', 'Sending move request to @{name}…', { name: move.target });
    const result = await request('/api/messages', { method: 'POST', json: { target: move.target, text: move.text } });
    if (!result.ok) { notice.textContent = result.message; return; }
    asked.set(project.id, { stage: project.stage, target: move.target });
    notice.textContent = result.data.delivered
      ? t('team_kanban.delivered', 'Move request delivered to @{name}. The card moves when its record moves.', { name: move.target })
      : t('team_kanban.queued', 'Move request queued for @{name}. The card moves when its record moves.', { name: move.target });
    render();
  };

  const refresh = async () => {
    if (!team || loading || (seat && seat.hidden)) return loading;
    const requestedTeam = team;
    notice.textContent = t('team_kanban.loading', 'Loading Team Kanban…');
    loading = request(`/api/teams/${encodeURIComponent(requestedTeam)}/kanban`, { cache: 'no-store' });
    const result = await loading;
    loading = null;
    if (team !== requestedTeam) { if (entered) void refresh(); return; }
    if (result.ok && Array.isArray(result.data.projects)) {
      projects = result.data.projects.map(normalizedProject);
      notice.textContent = '';
    } else {
      notice.textContent = result.message || t('team_kanban.failed', 'Could not load this Team Kanban.');
    }
    render();
  };

  return {
    el: root,
    mount: (host) => {
      seat = host;
      visibility?.disconnect();
      visibility = new MutationObserver(() => { if (entered && !seat.hidden) void refresh(); });
      visibility.observe(seat, { attributes: true, attributeFilter: ['hidden'] });
    },
    enter: () => {
      entered = true;
      window.clearInterval(refreshTimer);
      refreshTimer = window.setInterval(() => void refresh(), 5000);
      void refresh();
    },
    leave: () => { entered = false; window.clearInterval(refreshTimer); refreshTimer = 0; },
    destroy: () => { entered = false; window.clearInterval(refreshTimer); refreshTimer = 0; visibility?.disconnect(); visibility = null; },
    setTeam: (name) => {
      const next = String(name || '');
      if (team === next) return;
      team = next; projects = []; asked.clear(); render();
      if (entered) void refresh();
    },
    refresh,
  };
}
