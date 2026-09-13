/* One Workspace folders surface assembly, parameterized by its Workbench job. */
import { WorkspaceKit } from './workspace-kit.js';
import { buildProjectRoots } from './projectroots.js';
import { choice } from './campaign-desk.js';
import { request } from './request.js';
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
  worktreesDefault = false,
  onShow = () => {},
} = {}) {
  const surface = WorkspaceKit.primitives.createSurface({
    label: t('cowork.tab_roots', 'Workspace folders'),
    className: worktreesDefault ? 'cv-surface' : 'setup-surface',
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

  let showWorktreesDefault = () => {};
  if (worktreesDefault) {
    const host = el('div', 'cv-body cv-worktrees-default');
    surface.content.append(host);
    const paint = (current) => host.replaceChildren(choice(
      t('campaign_view.new_project_worktrees', 'Worktrees for new workspace folders'),
      [{ value: 'managed', label: t('campaign_view.new_project_worktrees_yes', 'Allow Ronin Worktrees') }, { value: 'none', label: t('campaign_view.new_project_worktrees_no', 'Use the checkout') }],
      current,
      t('campaign_view.new_project_worktrees_help', 'New repository folders use this default. Worktrees run only when both the folder and the Agent allow them.'),
      async (value) => {
        const result = await request('/api/machine-settings', { method: 'PATCH', json: { family: 'desks', value: { new_project: value } } });
        paint(result.ok ? value : current);
      },
    ));
    showWorktreesDefault = () => void request('/api/machine-settings').then((result) => {
      paint(result.ok && result.data?.set?.desks?.new_project === 'none' ? 'none' : 'managed');
    });
  }

  return {
    el: surface.el,
    show: () => {
      room.enter();
      showWorktreesDefault();
      onShow();
    },
  };
}
