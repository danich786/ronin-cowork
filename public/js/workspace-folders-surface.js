/* One Workspace folders surface assembly, parameterized by its Workbench job. */
import { WorkspaceKit } from './workspace-kit.js';
import { buildProjectRoots } from './projectroots.js';
import { t } from './lexicon.js';
import { request } from './request.js';

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
  environment = null,
  workspace = 'workspace2',
} = {}) {
  const surface = WorkspaceKit.primitives.createSurface({
    label: t('cowork.tab_roots', 'Workspace folders'),
    className: 'setup-surface',
  });
  const rootHost = presentation === 'stones'
    ? surface.content
    : el('div', 'desk-pane desk-proj show');
  if (rootHost !== surface.content) surface.content.append(rootHost);

  let room = null;
  const onboarding = presentation === 'stones' ? githubWorkspaceSetup(environment, workspace, () => room?.enter()) : null;
  room = buildProjectRoots(
    rootHost,
    () => connected?.(rootHost) ?? rootHost.isConnected,
    () => campaignId?.() || '',
    presentation ? { presentation, before: onboarding ? [onboarding.el] : [] } : {},
  );

  return {
    el: surface.el,
    show: () => {
      void onboarding?.show();
      room.enter();
      onShow();
    },
  };
}

function githubWorkspaceSetup(environment, workspace, onCloned) {
  const box = el('section', 'setup-github-workspace');
  const heading = document.createElement('h2'); heading.textContent = t('roots.github_heading', 'Bring your GitHub repository');
  const lede = document.createElement('p'); lede.textContent = t('roots.github_lede', 'Connect GitHub, then clone your repository into a Ronin workspace folder.');
  const state = document.createElement('p'); state.className = 'setup-fine setup-github-state';
  const actions = document.createElement('div'); actions.className = 'setup-github-actions';
  const connect = document.createElement('button'); connect.type = 'button'; connect.textContent = t('roots.github_connect', 'Connect GitHub');
  const check = document.createElement('button'); check.type = 'button'; check.textContent = t('roots.github_check', 'Check connection');
  actions.append(connect, check);
  const clone = document.createElement('div'); clone.className = 'setup-github-clone';
  const label = document.createElement('label'); label.textContent = t('roots.github_repository', 'GitHub repository');
  const repository = document.createElement('input'); repository.type = 'text'; repository.placeholder = 'owner/repository'; repository.autocapitalize = 'off'; repository.spellcheck = false;
  label.append(repository);
  const cloneButton = document.createElement('button'); cloneButton.type = 'button'; cloneButton.textContent = t('roots.github_clone', 'Clone and add workspace');
  const outcome = document.createElement('p'); outcome.className = 'setup-fine'; outcome.setAttribute('role', 'status');
  clone.append(label, cloneButton, outcome);
  const terminal = document.createElement('div'); terminal.className = 'setup-github-terminal'; terminal.hidden = true;
  box.append(heading, lede, state, actions, terminal, clone);
  let authenticated = false;
  const paint = (github = {}) => {
    authenticated = github.authenticated === true;
    state.textContent = !github.installed ? t('roots.github_missing', 'GitHub CLI is not installed.')
      : authenticated ? t('roots.github_connected', 'Connected to GitHub as {account}.', { account: github.account || 'your account' })
        : t('roots.github_not_connected', 'GitHub is not connected on this machine.');
    connect.hidden = authenticated || github.installed === false;
    cloneButton.disabled = !authenticated || !repository.value.trim();
  };
  const show = async () => { const result = await request('/api/setup/github', { cache: 'no-store' }); if (result.ok) paint(result.data); };
  repository.addEventListener('input', () => { cloneButton.disabled = !authenticated || !repository.value.trim(); });
  check.addEventListener('click', () => { void show(); });
  connect.addEventListener('click', async () => {
    const result = await request('/api/setup/github/login', { method: 'POST' });
    if (!result.ok) { outcome.textContent = result.message; return; }
    paint(result.data);
    if (result.data?.attachment?.key && environment?.mountProviderSetupSession) {
      terminal.hidden = false;
      environment.mountProviderSetupSession({ host: terminal, provider: 'github', session: result.data.attachment.key, workspace });
    }
  });
  cloneButton.addEventListener('click', async () => {
    cloneButton.disabled = true; outcome.textContent = t('roots.github_cloning', 'Cloning repository…');
    const result = await request('/api/setup/github/clone', { method: 'POST', json: { repository: repository.value.trim() } });
    outcome.textContent = result.ok
      ? t('roots.github_cloned', 'Added {name} as a workspace.', { name: result.data?.workspace?.name || repository.value.trim() })
      : result.message;
    if (result.ok) onCloned?.();
    cloneButton.disabled = !authenticated || !repository.value.trim();
  });
  return { el: box, show };
}
