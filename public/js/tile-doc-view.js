/* part of the ronin-cowork client — see js/README.md */
import { buildDocs } from './docs.js';
import { t } from './lexicon.js';

/** The shared document editor, scoped to and painted over one Agent tile. */
export function buildTileDocView(tile) {
  const root = document.createElement('div');
  root.className = 'home-docs tile-doc-view';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'tile-doc-close';
  close.textContent = '×';
  close.title = t('docs.close_agent', 'Close documents and return to this Agent');
  root.append(close);

  const docs = buildDocs(root, (name) => name === tile.session);
  const leave = () => {
    if (!tile.surfaceHost.is('docs')) return true;
    if (docs.leave()) {
      docs.close();
      tile.syncSurface(false);
      return true;
    }
    return false;
  };
  close.addEventListener('click', leave);
  return {
    el: root,
    async open(path) {
      tile.surfaceHost.select('docs');
      docs.enter();
      await docs.open(path);
    },
    close: leave,
    isOpen: () => tile.surfaceHost.is('docs'),
    dispose: () => docs.close(),
  };
}

/**
 * Docs over a chat that has no tile around it (Irasshai's): the same editor, painted over its
 * `.tile-body` as the Docs surface; × hands the chat back. One per body, reused.
 */
export function openDocOver(body, path) {
  if (!body) return;
  let view = body.querySelector(':scope > .tile-doc-view');
  if (!view) {
    view = document.createElement('div');
    view.className = 'home-docs tile-doc-view';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'tile-doc-close';
    close.textContent = '×';
    close.title = t('docs.close_chat', 'Close documents and return to Chat');
    view.append(close);
    view.docs = buildDocs(view, () => false);
    close.addEventListener('click', () => {
      if (!view.docs.leave()) return;
      view.docs.close();
      body.dataset.surface = view.back;
    });
    body.append(view);
  }
  if (body.dataset.surface !== 'docs') view.back = body.dataset.surface;
  body.dataset.surface = 'docs';
  view.docs.enter();
  void view.docs.open(path);
}
