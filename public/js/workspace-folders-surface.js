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
 * Setup and Settings show the same collection through the same keep-or-ignore stones.
 * Campaign scope remains an input to that one surface, not a second presentation.
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
    presentation ? { presentation, extraItems: onboarding?.items || [] } : {},
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
  const authBox = el('section', 'setup-github-workspace');
  const authHeading = document.createElement('h2'); authHeading.textContent = t('roots.github_auth_heading', 'Authenticate GitHub');
  const authLede = document.createElement('p'); authLede.textContent = t('roots.github_auth_lede', 'Connect your GitHub account in a temporary authentication window.');
  const state = document.createElement('p'); state.className = 'setup-fine setup-github-state';
  const actions = document.createElement('div'); actions.className = 'setup-github-actions';
  const connect = document.createElement('button'); connect.type = 'button'; connect.textContent = t('roots.github_connect', 'Connect GitHub');
  const check = document.createElement('button'); check.type = 'button'; check.textContent = t('roots.github_check', 'Check connection');
  actions.append(connect, check);
  const cloneBox = el('section', 'setup-github-workspace');
  const cloneHeading = document.createElement('h2'); cloneHeading.textContent = t('roots.github_clone_heading', 'Clone a repository');
  const cloneLede = document.createElement('p'); cloneLede.textContent = t('roots.github_clone_lede', 'Clone a GitHub repository and add its folder as a Ronin workspace.');
  const cloneState = document.createElement('p'); cloneState.className = 'setup-fine setup-github-state';
  const clone = document.createElement('div'); clone.className = 'setup-github-clone';
  const label = document.createElement('label'); label.textContent = t('roots.github_repository', 'GitHub repository');
  const repository = document.createElement('input'); repository.type = 'text'; repository.placeholder = 'owner/repository'; repository.autocapitalize = 'off'; repository.spellcheck = false;
  label.append(repository);
  const cloneButton = document.createElement('button'); cloneButton.type = 'button'; cloneButton.textContent = t('roots.github_clone', 'Clone and add workspace');
  const outcome = document.createElement('p'); outcome.className = 'setup-fine'; outcome.setAttribute('role', 'status');
  clone.append(label, cloneButton, outcome);
  const terminal = document.createElement('div'); terminal.className = 'setup-github-terminal'; terminal.hidden = true;
  const terminalActions = document.createElement('div'); terminalActions.className = 'setup-github-terminal-actions'; terminalActions.hidden = true;
  const done = document.createElement('button'); done.type = 'button'; done.textContent = t('roots.github_done', 'Done');
  const close = document.createElement('button'); close.type = 'button'; close.textContent = t('roots.github_close', 'Close');
  terminalActions.append(done, close);
  authBox.append(authHeading, authLede, state, actions, terminal, terminalActions);
  cloneBox.append(cloneHeading, cloneLede, cloneState, clone);
  let authenticated = false;
  let mounted = null;
  let authenticationWatch = 0;
  const stopWatching = () => { if (authenticationWatch) window.clearInterval(authenticationWatch); authenticationWatch = 0; };
  const dismissLogin = async () => {
    stopWatching();
    mounted?.park?.();
    mounted?.destroy?.();
    mounted = null;
    terminal.hidden = true;
    terminalActions.hidden = true;
    const result = await request('/api/setup/github/close', { method: 'POST' });
    if (result.ok) paint(result.data);
    else state.textContent = result.message;
  };
  const paint = (github = {}) => {
    authenticated = github.authenticated === true;
    state.textContent = !github.installed ? t('roots.github_missing', 'GitHub CLI is not installed.')
      : authenticated ? t('roots.github_connected', 'Connected to GitHub as {account}.', { account: github.account || 'your account' })
        : t('roots.github_not_connected', 'GitHub is not connected on this machine.');
    cloneState.textContent = authenticated
      ? t('roots.github_clone_ready', 'GitHub is connected. Enter the repository you want to clone.')
      : t('roots.github_clone_needs_auth', 'Authenticate GitHub first.');
    connect.hidden = authenticated || github.installed === false;
    cloneButton.disabled = !authenticated || !repository.value.trim();
  };
  const show = async () => { const result = await request('/api/setup/github', { cache: 'no-store' }); if (result.ok) paint(result.data); };
  repository.addEventListener('input', () => { cloneButton.disabled = !authenticated || !repository.value.trim(); });
  check.addEventListener('click', () => { void show(); });
  connect.addEventListener('click', async () => {
    const result = await request('/api/setup/github/login', { method: 'POST' });
    if (!result.ok) { state.textContent = result.message; return; }
    paint(result.data);
    if (result.data?.attachment?.key && environment?.mountProviderSetupSession) {
      terminal.hidden = false;
      terminalActions.hidden = false;
      mounted?.destroy?.();
      mounted = environment.mountProviderSetupSession({
        host: terminal,
        provider: 'github',
        session: result.data.attachment.key,
        workspace,
        onClosed: () => { terminal.hidden = true; terminalActions.hidden = true; void show(); },
      });
      stopWatching();
      authenticationWatch = window.setInterval(async () => {
        const status = await request('/api/setup/github', { cache: 'no-store' });
        if (status.ok && status.data?.authenticated) await dismissLogin();
      }, 1500);
    }
  });
  done.addEventListener('click', async () => {
    const result = await request('/api/setup/github', { cache: 'no-store' });
    if (!result.ok) { state.textContent = result.message; return; }
    if (!result.data?.authenticated) { state.textContent = t('roots.github_waiting', 'Finish GitHub authentication in the window first.'); return; }
    await dismissLogin();
  });
  close.addEventListener('click', () => { void dismissLogin(); });
  cloneButton.addEventListener('click', async () => {
    cloneButton.disabled = true; outcome.textContent = t('roots.github_cloning', 'Cloning repository…');
    const result = await request('/api/setup/github/clone', { method: 'POST', json: { repository: repository.value.trim() } });
    outcome.textContent = result.ok
      ? t('roots.github_cloned', 'Added {name} as a workspace.', { name: result.data?.workspace?.name || repository.value.trim() })
      : result.message;
    if (result.ok) onCloned?.();
    cloneButton.disabled = !authenticated || !repository.value.trim();
  });
  return {
    items: [{
      id: '\0github-auth', glyph: '⌘', label: t('roots.github_auth_stone', 'Authenticate GitHub'),
      state: t('roots.github_auth_state', 'Connect account'), className: 'setup-roots-github-stone',
      renderDetail: (host) => { host.append(authBox); void show(); return () => authBox.remove(); },
    }, {
      id: '\0github-clone', glyph: '+', label: t('roots.github_clone_stone', 'Clone a repository'),
      state: t('roots.github_clone_state', 'Add from GitHub'), className: 'setup-roots-github-stone',
      renderDetail: (host) => { host.append(cloneBox); void show(); return () => cloneBox.remove(); },
    }],
    show,
  };
}
