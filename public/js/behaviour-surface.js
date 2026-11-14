/* Behaviors — the user's own layer (BRIEF_MODEL §3, §6, §8): their brief settings for every Agent,
 * and every fact, behaviour and tool file to read, or to replace with their own version by name.
 * Over /api/brief/catalog, /api/brief/settings/user and /api/brief/files. */
import { request } from './request.js';
import { createPhalanx } from './phalanx.js';
import { addProvMark } from './provenance.js';
import { WorkspaceKit } from './workspace-kit.js';
import { t } from './lexicon.js';
import { renderMarkdownDocument } from './markdown-reader.js';
import { createBriefSettingsPanel, scopeOf } from './brief-step.js';

export const BEHAVIOUR_SURFACE_TYPE = 'campaign.behaviours';
const node = (tag, cls = '', text = '') => { const out = document.createElement(tag); if (cls) out.className = cls; if (text) out.textContent = text; return out; };
const keyOf = (row) => `${row.scope}:${row.name}`;
const STARTER = '# My behavior\n- **seed:** One line: what this guidance is for.\n- **when:**\n- **depth:** none\n\nThe guidance the Agent is told.\n';

function groupOf(scope) {
  return ({ facts: t('brief.facts', 'Facts'), behaviours: t('behaviours', 'Behaviors'), tools: t('brief.tools', 'Tools') })[scope] || scope;
}

function viewer(row, host, afterSave) {
  let active = true;
  const heading = node('h2', 'bh-title', row.title || row.name || t('behaviours.new', 'New Behavior'));
  addProvMark(heading, row);
  const summary = node('p', 'bh-summary', row.seed || row.line || '');
  const meta = node('p', 'bh-meta', [groupOf(row.scope), row.origin === 'user' ? t('behaviours.yours', 'Yours') : row.origin ? t('behaviours.stock', 'Ronin') : ''].filter(Boolean).join(' · '));
  const status = node('p', 'bh-status'); status.setAttribute('role', 'status');
  const readingHost = node('div', 'bh-reading');
  const actions = node('div', 'bh-actions');
  host.append(heading, summary, meta, actions, status, readingHost);
  // The whole file is edited as it is: its header (seed, when, depth, order) and its text.
  const edit = (file = null) => {
    const name = node('label', 'bh-field', t('behaviours.name', 'Name'));
    const nameInput = node('input'); nameInput.value = row.name || ''; nameInput.readOnly = Boolean(file); name.append(nameInput);
    const textField = node('label', 'bh-field', t('behaviours.guidance', 'Guidance'));
    const body = node('textarea'); body.value = file?.text || STARTER; body.rows = 16; textField.append(body);
    const message = node('p', 'bh-status'); message.setAttribute('role', 'status');
    const save = node('button', 'wk-action', !file ? t('behaviours.create', 'Create Behavior') : file.origin === 'user' ? t('forms.save', 'Save') : t('behaviours.save_mine', 'Save my version'));
    const cancel = node('button', 'wk-action', t('forms.cancel', 'Cancel'));
    for (const button of [save, cancel]) { button.type = 'button'; button.dataset.endsEdit = ''; }
    const form = node('div', 'bh-editor');
    form.append(name, textField, save, cancel, message);
    readingHost.replaceChildren(form);
    actions.replaceChildren();
    cancel.addEventListener('click', () => { readingHost.replaceChildren(file ? renderMarkdownDocument(file.text) : ''); showActions(file); });
    save.addEventListener('click', async () => {
      const target = file ? row.name : nameInput.value.trim();
      const result = !file
        ? await request('/api/brief/files', { method: 'POST', json: { kind: row.scope, name: target, text: body.value } })
        : file.origin === 'stock'
          ? await request('/api/brief/files', { method: 'POST', json: { kind: row.scope, name: target, text: body.value, shadow: true } })
          : await request(`/api/brief/files/${encodeURIComponent(row.scope)}/${encodeURIComponent(target)}`, { method: 'PUT', json: { text: body.value, revision: file.revision } });
      if (!active) return;
      if (!result.ok) { message.textContent = result.message; message.dataset.bad = 'true'; return; }
      window.dispatchEvent(new Event('ronin:behaviours-changed'));
      afterSave(`${row.scope}:${target}`);
    });
  };
  const showActions = (file) => {
    const button = node('button', 'wk-action', t('behaviours.edit', 'Edit'));
    button.type = 'button'; button.addEventListener('click', () => edit(file)); actions.replaceChildren(button);
  };
  if (row.new) { edit(); return () => { active = false; }; }
  status.textContent = t('docs.loading', 'loading…');
  void (async () => {
    const result = await request(`/api/brief/files/${encodeURIComponent(row.scope)}/${encodeURIComponent(row.name)}`, { cache: 'no-store' });
    if (!active) return;
    if (!result.ok) { status.textContent = result.message; status.dataset.bad = 'true'; return; }
    status.textContent = '';
    readingHost.replaceChildren(renderMarkdownDocument(result.data?.text || ''));
    showActions(result.data);
  })();
  return () => { active = false; };
}

function createBehaviourSurface(initial = {}) {
  const surface = WorkspaceKit.primitives.createSurface({ label: t('behaviours.title', 'Behaviors'), className: 'behaviour-surface' });
  let rows = [];
  const stones = createPhalanx({ className: 'behaviour-stones', renderDetail: (item, host) => viewer(item.row, host, refresh) });
  const intro = node('div', 'sws-intro');
  intro.append(node('h2', '', t('behaviours.title', 'Behaviors')), node('p', '', t('brief.user_help', 'What every Agent you start is told. Open any file to read it, or save your own version: yours replaces Ronin’s by name and survives updates.')));
  const settings = createBriefSettingsPanel({ layer: 'user', id: 'me', createAction: WorkspaceKit.primitives.createAction });
  const add = node('button', 'wk-action', t('behaviours.new', 'New Behavior'));
  add.type = 'button'; add.addEventListener('click', () => stones.openDetail({ row: { scope: 'behaviours', new: true } }, { returnFocus: add }));
  intro.append(settings.el, add);
  stones.mount(surface.content, { before: [intro] });
  const items = () => ['behaviours', 'facts', 'tools'].flatMap((scope) => rows.filter((row) => row.scope === scope))
    .map((row) => ({ id: keyOf(row), label: row.title || row.name, group: groupOf(row.scope), secondary: row.seed || row.line || '', state: row.origin === 'user' ? t('behaviours.yours', 'Yours') : '', row }));
  async function refresh(select = '') {
    surface.setState('loading', t('customize.reading', 'reading…'));
    const result = await request('/api/brief/catalog', { cache: 'no-store' });
    if (!result.ok || !Array.isArray(result.data)) { surface.setState('failed', result.message || t('customize.not_a_list', 'the route did not answer with a list')); return; }
    rows = result.data.map((row) => ({ ...row, scope: scopeOf(row.kind) })); stones.setItems(items()); surface.setState(null, '');
    const wanted = select || (initial.scope && initial.name ? `${scopeOf(initial.scope)}:${initial.name}` : '');
    if (wanted) stones.select(wanted);
  }
  return {
    el: surface.el,
    show: (detail = {}) => { if (detail.scope && detail.name) initial = detail; void refresh(); },
    enter: () => { void settings.enter(); void refresh(); },
    destroy: () => { settings.destroy(); stones.destroy(); },
  };
}

export function registerBehaviourSurface() {
  const { library } = WorkspaceKit.workbench;
  if (!library.has(BEHAVIOUR_SURFACE_TYPE)) library.register({
    type: BEHAVIOUR_SURFACE_TYPE,
    header: 'surface',
    label: () => t('behaviours.title', 'Behaviors'),
    summary: () => t('brief.card_summary', 'What every Agent is told: facts, behaviors and tools, and your own versions of them.'),
    create: ({ detail }) => createBehaviourSurface(detail),
  });
}
