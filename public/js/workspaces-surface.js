/* part of the ronin-cowork client — see js/README.md */
/**
 * THE WORKSPACES WORKBENCH'S SURFACES (owner, 2026-10-19; PATTERNS.md Home). Home's Workspaces
 * door opens the Workspaces workbench; its surfaces are its own, apart from Settings' Workspace
 * Folders surface, and draw with the same drawing (projectroots.js createRootDrawing: a folder's
 * stone, its page, the add form) over the same read, one per workbench (`createRootsReading`,
 * /api/project-roots/detail, every surface hearing it).
 *   WS1 `createFolderStones`: Phalanx A/B stones of folders, only folders — the three admin
 *   stones are selector cards here. A stone pressed opens the folder's page beside the rail; a
 *   stone dragged into a workspace places the folder there whole (`createFolder`), no rail.
 *   The selector lists one card per folder (`folderOffers`) and three dotted cards: Add a
 *   workspace (`createFolderNew`, the add form; the folder it adds takes its workspace), GitHub
 *   CLI and Clone a repository (`createFolderGithub`, `createFolderClone`: the boxes
 *   github-workspace-setup.js draws for Setup; a clone's folder takes the workspace too).
 */
import { WorkspaceKit } from './workspace-kit.js';
import { el } from './form-steps.js';
import { createPhalanx } from './phalanx.js';
import { request } from './request.js';
import { createRootDrawing, NEW, rootStone } from './projectroots.js';
import { SURFACE_DRAG } from './workbench.js';
import { WORKBENCH_TYPES } from './workbench-catalog.js';
import { t } from './lexicon.js';

/** The one read of the folders for a workbench: every surface on it paints from this and hears it. */
export function createRootsReading() {
  let roots = [];
  let problem = '';
  const listeners = new Set();
  return {
    roots: () => roots,
    problem: () => problem,
    read: async () => {
      const result = await request('/api/project-roots/detail', { cache: 'no-store' });
      problem = result.ok ? '' : t('roots.read_failed', 'could not read the catalog — {message}', { message: result.message });
      if (result.ok) roots = Array.isArray(result.data?.roots) ? result.data.roots : [];
      for (const listener of listeners) listener();
      return result;
    },
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
  };
}

/** The selector's cards: one per folder, title over its measured state. */
export const folderOffers = (reading) => reading.roots().map((root) => { const stone = rootStone(root); return { key: stone.id, label: stone.label, summary: stone.state }; });

const byArchived = (roots) => [...roots].sort((a, b) => (a.archived ? 1 : 0) - (b.archived ? 1 : 0));
const draggable = (stone) => ({
  ...stone,
  draggable: true,
  events: { dragstart: (event) => {
    event.dataTransfer.setData(SURFACE_DRAG, JSON.stringify({ type: WORKBENCH_TYPES.folder, detail: { key: stone.id } }));
    event.dataTransfer.setData('text/plain', stone.label);
    event.dataTransfer.effectAllowed = 'copy';
  } },
});
const status = () => { const line = el('div', 'pr-status'); line.setAttribute('role', 'status'); return line; };
const sayInto = (line) => (message, bad) => { line.replaceChildren(); if (!message) return; const p = el('div', `pr-empty${bad ? ' bad' : ''}`, message); line.append(p); };

/** WS1: the stones of folders; the pressed one's page beside the rail. */
export function createFolderStones({ reading, campaignId, workbench }) {
  const { createSurface } = WorkspaceKit.primitives;
  const out = createSurface({ label: t('cowork.tab_roots', 'Workspace folders'), className: 'setup-surface workspaces-stones' });
  const messages = status();
  let stones = null;
  const drawing = createRootDrawing({
    stones: true, campaignId,
    refresh: () => reading.read(), render: () => stones.refreshDetail(), say: sayInto(messages),
    select: (id) => stones.select(id), refreshDetail: () => stones.refreshDetail(),
    focusStone: (id) => [...stones.el.querySelectorAll('[data-sws-id]')].find((button) => button.dataset.swsId === id)?.focus(),
    focusForm: () => stones.el.querySelector('.pr-detail .pr-form input:not([disabled])')?.focus(),
    report: (node) => messages.prepend(node),
  });
  stones = createPhalanx({
    className: 'setup-roots-stones',
    onSelectionChange: (id) => { if (id !== drawing.editing()) drawing.edit(null); },
    renderDetail: (item, host) => {
      host.scrollTop = 0;
      const root = reading.roots().find((entry) => entry.name === item.id);
      if (root) host.append(drawing.detail(root));
    },
  });
  stones.mount(out.content, { before: [messages] });
  const paint = () => {
    sayInto(messages)(reading.problem(), true);
    const roots = byArchived(reading.roots());
    if (!roots.length && !reading.problem()) sayInto(messages)(t('roots.empty', 'No workspace folders yet. Choose or create the first one above.'));
    stones.setItems(roots.map((root) => draggable(rootStone(root))));
    workbench?.refreshSelector?.();
  };
  const stop = reading.subscribe(paint);
  return {
    el: out.el,
    show: () => { void reading.read(); },
    destroy: () => { stop(); stones.destroy(); },
  };
}

/** A workspace of its own for one folder: its page, the whole workspace, no rail. */
export function createFolder(key, { reading, campaignId }) {
  const { createSurface, setSurfaceState } = WorkspaceKit.primitives;
  const out = createSurface({ label: key, className: 'setup-surface workspaces-folder' });
  const messages = status();
  const page = el('div', 'workspaces-folder-page');
  out.content.append(messages, page);
  const drawing = createRootDrawing({
    stones: true, campaignId,
    refresh: () => reading.read(), render: () => paint(), say: sayInto(messages),
    select: () => {}, refreshDetail: () => paint(), focusStone: () => {},
    focusForm: () => page.querySelector('.pr-detail .pr-form input:not([disabled])')?.focus(),
    report: (node) => messages.prepend(node),
  });
  const paint = () => {
    const root = reading.roots().find((entry) => entry.name === key);
    page.replaceChildren();
    if (!root) { setSurfaceState(out.el, 'empty', reading.problem() || t('roots.folder_gone', 'This folder is no longer in the catalog.')); return; }
    setSurfaceState(out.el, null, '');
    out.header.title.textContent = root.title || root.name;
    page.append(drawing.detail(root));
  };
  const stop = reading.subscribe(paint);
  return {
    el: out.el,
    show: () => { if (reading.roots().length) paint(); else void reading.read(); },
    destroy: stop,
  };
}

/** Add a workspace: the add form in a workspace of its own; the folder it adds takes the workspace. */
export function createFolderNew({ reading, campaignId, placeFolder }) {
  const { createSurface } = WorkspaceKit.primitives;
  const out = createSurface({ label: t('roots.add_stone', 'Add a workspace'), className: 'setup-surface workspaces-new' });
  const messages = status();
  const page = el('div', 'workspaces-new-page');
  out.content.append(messages, page);
  const drawing = createRootDrawing({
    stones: true, campaignId,
    refresh: () => reading.read(), render: () => paint(), say: sayInto(messages),
    select: (name) => { if (name) placeFolder(name); else paint(); }, refreshDetail: () => paint(), focusStone: () => {},
    focusForm: () => page.querySelector('.pr-form input:not([disabled])')?.focus(),
    report: (node) => messages.prepend(node),
  });
  const paint = () => { drawing.edit(NEW); page.replaceChildren(drawing.addCard()); };
  return { el: out.el, show: paint, destroy: () => {} };
}

/** GitHub CLI and Clone a repository: Setup's two boxes, each a workspace of its own. */
const githubBox = (label, className, item) => {
  const { createSurface } = WorkspaceKit.primitives;
  const out = createSurface({ label, className: `setup-surface ${className}` });
  let dispose = null;
  return {
    el: out.el,
    show: () => { dispose?.(); dispose = item.renderDetail(out.content) || null; },
    destroy: () => { dispose?.(); dispose = null; },
  };
};
export const createFolderGithub = (github) => githubBox(t('roots.github_auth_stone', 'GitHub CLI'), 'workspaces-github', github.items[0]);
export const createFolderClone = (github) => githubBox(t('roots.github_clone_stone', 'Clone a repository'), 'workspaces-clone', github.items[1]);
