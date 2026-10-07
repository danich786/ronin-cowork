/* part of the ronin-cowork client — see js/README.md */
/**
 * THE DOCS AND REPOS OF A WORKSPACE FOLDER — the Workspace tenant's WS2 (samurai_lab
 * PATTERNS.md, Workspace folder: "Workspace tenant: docs and repos", Rows). Two lists of
 * one-line rows (itemLine, title only): the folder's registered docs and plans, and the
 * repos its Teams list. Both come resolved on the collection push for `root=<folder>`
 * (src/collection-read.ts); the browser joins nothing.
 */
import { WorkspaceKit } from './workspace-kit.js';
import { readingKey, subscribeCollection } from './collection-reading.js';
import { itemLine } from './team-kanban.js';
import { t } from './lexicon.js';

export const WORKSPACE_DOCS_TYPE = 'workspace.docs';
const el = (tag, cls = '', text = '') => { const out = document.createElement(tag); if (cls) out.className = cls; if (text) out.textContent = text; return out; };

/** `folder()` is read at each show, so one surface follows its tenant's param. */
export function createWorkspaceDocsSurface({ folder }) {
  const { createSurface } = WorkspaceKit.primitives;
  const surface = createSurface({ label: t('workspace.docs', 'Docs and repos'), className: 'workspace-docs' });
  const list = (title, names) => {
    const box = el('div', 'who-open-list');
    box.append(el('b', 'who-open-label', title));
    if (!names.length) box.append(el('span', 'who-open-none', t('collection.none', 'None')));
    for (const name of names) box.append(itemLine({ id: name, title: name }, { bar: false }));
    return box;
  };
  const paint = (reading) => {
    const root = (reading?.roots || []).find((row) => row.name === folder());
    surface.content.replaceChildren(list(t('workspace.docs_list', 'Docs'), root?.docs || []), list(t('workspace.repos_list', 'Repos'), root?.repos || []));
  };
  let stop = null;
  let heard = ''; // the key subscribed to: a changed folder resubscribes, the same one does not
  const listen = () => {
    const wanted = { root: [folder()] };
    const key = readingKey('collection', wanted);
    if (stop && key === heard) return;
    stop?.();
    heard = key;
    stop = subscribeCollection(wanted, paint);
  };
  const quiet = () => { stop?.(); stop = null; heard = ''; };
  return { el: surface.el, show: listen, leave: quiet, destroy: quiet };
}
