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

// Temporary concept fixtures: the route replaces these as soon as Cut 3 is present.
const SAMPLE_PROJECTS = [
  { id: 'virtual-kanban/5', title: 'Cross-team summary', objective: 'One read lists every team with its ideas and projects in flight.', holder: 'lead', stage: 'IDEAS', exit: 'none', status: 'yellow' },
  { id: 'virtual-kanban/6', title: 'Trello adapter', objective: 'Push the board to a Trello board the owner attaches by API.', holder: 'lead', stage: 'IDEAS', exit: 'lead', status: 'green' },
  { id: 'virtual-kanban/9', title: 'Board route and read tool', objective: 'One JSON per team from the roster and every work record.', holder: 'roster_cut', stage: 'PLANNING', exit: 'user', status: 'green' },
  { id: 'virtual-kanban/7', title: 'Kanban tab', objective: 'Team commons renders the board as five columns.', holder: 'tab_cut', stage: 'BUILDING', exit: 'user', status: 'green' },
  { id: 'virtual-kanban/11', title: 'Tile shows projects', objective: 'The tile shows the project at the marker.', holder: 'letter_cut', stage: 'BUILDING', exit: 'none', status: 'red' },
  { id: 'virtual-kanban/12', title: 'Docs brought into line', objective: 'Work record docs teach projects, stages, exit and status.', holder: 'kanban_revive', stage: 'LANDING', exit: 'lead', status: 'green' },
  { id: 'virtual-kanban/1', title: 'Ladder buildout document', objective: 'Projects, five stages, and the Team Kanban.', holder: 'kanban_revive', stage: 'DONE', exit: 'none', status: 'green' },
];

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
  objective: String(value?.objective || value?.outcome || value?.o || ''),
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
  if (project.stage === 'BUILDING') return result(holder, `show approved${byNote}; hand in.`, `tejun-desk hand-in, then work-record project write ${n} --stage LANDING`);
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
  const board = node('div', 'tk-board');
  root.append(legend, notice, board);

  let team = '';
  let projects = [];
  let entered = false;
  let loading = null;
  let refreshTimer = 0;
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
      const cards = node('div', 'tk-cards');
      if (!columnProjects.length) cards.append(node('p', 'tk-empty', t('team_kanban.empty', 'nothing here')));
      for (const project of columnProjects) {
        const card = node('article', 'tk-card');
        card.draggable = true;
        card.dataset.project = project.id;
        if (project.stage !== 'DONE') card.dataset.status = project.status;
        card.append(node('strong', 'tk-title', project.title), node('p', 'tk-outcome', project.objective));
        const row = node('div', 'tk-card-row');
        const chip = chipFor(project);
        if (chip) row.append(node('span', `tk-chip ${chip.cls}`, chip.text));
        const owner = holderName(project);
        if (owner) {
          const open = node('button', 'tk-owner', `@${owner}`);
          open.type = 'button';
          open.title = t('team_kanban.open_owner', 'Open this Agent beside the commons');
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
        });
        card.addEventListener('dragend', () => {
          card.classList.remove('dragging'); board.classList.remove('dragging');
          for (const item of board.querySelectorAll('.tk-column')) item.classList.remove('over');
        });
        cards.append(card);
      }
      section.append(heading, cards);
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
    if (!team || loading) return loading;
    const requestedTeam = team;
    notice.textContent = t('team_kanban.loading', 'Loading Team Kanban…');
    loading = request(`/api/teams/${encodeURIComponent(requestedTeam)}/kanban`, { cache: 'no-store' });
    const result = await loading;
    loading = null;
    if (team !== requestedTeam) { if (entered) void refresh(); return; }
    if (result.ok && Array.isArray(result.data.projects)) {
      projects = result.data.projects.map(normalizedProject);
      notice.textContent = '';
    } else if (result.status === 404) {
      projects = SAMPLE_PROJECTS.map((project) => normalizedProject({ ...project, id: project.id.replace(/^virtual-kanban/, team) }));
      notice.textContent = t('team_kanban.sample', 'Showing concept data until this Team’s Kanban route is available.');
    } else {
      projects = [];
      notice.textContent = result.message || t('team_kanban.failed', 'Could not load this Team Kanban.');
    }
    render();
  };

  return {
    el: root,
    mount: () => {},
    enter: () => {
      entered = true;
      window.clearInterval(refreshTimer);
      refreshTimer = window.setInterval(() => void refresh(), 5000);
      void refresh();
    },
    leave: () => { entered = false; window.clearInterval(refreshTimer); refreshTimer = 0; },
    destroy: () => { entered = false; window.clearInterval(refreshTimer); refreshTimer = 0; },
    setTeam: (name) => {
      const next = String(name || '');
      if (team === next) return;
      team = next; projects = []; asked.clear(); render();
      if (entered) void refresh();
    },
    refresh,
  };
}
