/* One Workspace folders surface assembly, parameterized by its Workbench job. */
import { WorkspaceKit } from './workspace-kit.js';
import { buildProjectRoots } from './projectroots.js';
import { t } from './lexicon.js';

const el = (tag, cls = '') => {
  const out = document.createElement(tag);
  if (cls) out.className = cls;
  return out;
};

/**
 * Setup and Campaign show the same collection, but ask different questions of it.
 * Setup presents keep-or-ignore stones. Campaign keeps the established scoped list and
 * the default for future repositories. Those are options on one surface, not two copies.
 */
export function createWorkspaceFoldersSurface({
  campaignId,
  connected,
  presentation = '',
  onShow = () => {},
} = {}) {
  const surface = WorkspaceKit.primitives.createSurface({
    label: t('cowork.tab_roots', 'Workspace folders'),
    className: 'setup-surface',
  });
  const rootHost = presentation === 'stones'
    ? surface.content
    : el('div', 'desk-pane desk-proj show');
  if (rootHost !== surface.content) surface.content.append(rootHost);

  const room = buildProjectRoots(
    rootHost,
    () => connected?.(rootHost) ?? rootHost.isConnected,
    () => campaignId?.() || '',
    presentation ? { presentation } : {},
  );

  return {
    el: surface.el,
    show: () => {
      room.enter();
      onShow();
    },
  };
}
