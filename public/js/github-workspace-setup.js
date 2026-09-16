/* Setup 2's GitHub authentication and clone handoff for the Workspace Folder surface. */
import { t } from './lexicon.js';
import { request } from './request.js';

const el = (tag, className = '', text = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

export function createGithubWorkspaceSetup({ environment, workspace = 'workspace2', onStateChange, onAuthenticated, onCloned } = {}) {
  const authBox = el('section', 'setup-github-workspace');
  const state = el('p', 'setup-fine setup-github-state');
  const actions = el('div', 'setup-github-actions');
  const connect = el('button', '', t('roots.github_connect', 'Connect GitHub')); connect.type = 'button';
  const remove = el('button', '', t('roots.github_remove_auth', 'Remove authentication')); remove.type = 'button';
  const terminal = el('div', 'setup-github-terminal'); terminal.hidden = true;
  const terminalActions = el('div', 'setup-github-terminal-actions'); terminalActions.hidden = true;
  const done = el('button', '', t('roots.github_done', 'Done')); done.type = 'button';
  const close = el('button', '', t('roots.github_close', 'Close')); close.type = 'button';
  actions.append(connect, remove); terminalActions.append(done, close);
  authBox.append(
    el('h2', '', t('roots.github_auth_heading', 'Authenticate GitHub')),
    el('p', '', t('roots.github_auth_lede', 'Connect your GitHub account in a temporary authentication window.')),
    state, actions, terminal, terminalActions,
  );

  const cloneBox = el('section', 'setup-github-workspace');
  const cloneState = el('p', 'setup-fine setup-github-state');
  const clone = el('div', 'setup-github-clone');
  const label = el('label', '', t('roots.github_repository', 'GitHub repository'));
  const repository = el('input'); repository.type = 'text'; repository.placeholder = 'owner/repository'; repository.autocapitalize = 'off'; repository.spellcheck = false;
  const cloneButton = el('button', '', t('roots.github_clone', 'Clone and add workspace')); cloneButton.type = 'button';
  const outcome = el('p', 'setup-fine'); outcome.setAttribute('role', 'status');
  label.append(repository); clone.append(label, cloneButton, outcome);
  cloneBox.append(
    el('h2', '', t('roots.github_clone_heading', 'Clone a repository')),
    el('p', '', t('roots.github_clone_lede', 'Clone a GitHub repository and add its folder as a Ronin workspace.')),
    cloneState, clone,
  );

  let authenticated = false;
  let account = '';
  let installed = true;
  let mounted = null;
  let watch = 0;
  let checking = false;
  let connecting = false;
  let removing = false;
  let cloning = false;
  let destroyed = false;
  let closing = null;
  let unmounting = false;

  const items = [{
    id: '\0github-auth', glyph: '⌘', label: t('roots.github_auth_stone', 'Authenticate GitHub'),
    state: '', className: 'setup-roots-github-stone',
    renderDetail: (host) => {
      host.append(authBox); void show();
      return () => { authBox.remove(); void teardown(true); };
    },
  }, {
    id: '\0github-clone', glyph: '+', label: t('roots.github_clone_stone', 'Clone a repository'),
    state: '', className: 'setup-roots-github-stone',
    renderDetail: (host) => { host.append(cloneBox); void show(); return () => cloneBox.remove(); },
  }];

  const stopWatch = () => { if (watch) window.clearInterval(watch); watch = 0; checking = false; };
  const unmount = () => {
    unmounting = true;
    mounted?.park?.();
    mounted?.destroy?.();
    mounted = null;
    unmounting = false;
    terminal.replaceChildren();
    terminal.hidden = true;
    terminalActions.hidden = true;
  };
  const paint = (github = {}) => {
    installed = github.installed !== false;
    authenticated = github.authenticated === true;
    account = github.account || '';
    state.textContent = !installed ? t('roots.github_missing', 'GitHub CLI is not installed.')
      : authenticated ? t('roots.github_connected', 'Connected to GitHub as {account}.', { account: account || 'your account' })
        : t('roots.github_not_connected', 'GitHub is not connected on this machine.');
    cloneState.textContent = authenticated
      ? t('roots.github_clone_ready', 'GitHub is connected. Enter the repository you want to clone.')
      : t('roots.github_clone_needs_auth', 'Authenticate GitHub first.');
    connect.hidden = authenticated || !installed;
    connect.disabled = connecting;
    remove.hidden = !authenticated || !installed;
    remove.disabled = removing;
    cloneButton.disabled = cloning || !authenticated || !repository.value.trim();
    items[0].state = authenticated
      ? t('roots.github_auth_connected_state', 'Connected{account}', { account: account ? ` · ${account}` : '' })
      : !installed ? t('roots.github_auth_unavailable_state', 'GitHub CLI unavailable') : t('roots.github_auth_state', 'Connect account');
    items[1].state = authenticated ? t('roots.github_clone_ready_state', 'Ready to clone') : t('roots.github_clone_state', 'Authenticate first');
    items[1].disabled = !authenticated;
    onStateChange?.();
  };
  const mountAttachment = (attachment) => {
    if (mounted || destroyed || attachment?.type !== 'session' || !attachment.key
      || typeof environment?.mountProviderSetupSession !== 'function') return false;
    terminal.hidden = false; terminalActions.hidden = false;
    mounted = environment.mountProviderSetupSession({
      host: terminal, provider: 'github', session: attachment.key, workspace,
      onClosed: () => {
        mounted = null; stopWatch(); terminal.hidden = true; terminalActions.hidden = true;
        if (!unmounting && !destroyed) void show();
      },
    });
    if (mounted && !watch) watch = window.setInterval(() => { void poll(); }, 1500);
    return Boolean(mounted);
  };
  const show = async () => {
    const result = await request('/api/setup/github', { cache: 'no-store' });
    if (result.ok) {
      paint(result.data);
      if (!result.data?.authenticated) mountAttachment(result.data?.attachment);
    } else state.textContent = result.message;
    return result;
  };
  const teardown = async (closeRemote = false) => {
    stopWatch(); unmount();
    if (!closeRemote || closing) return closing;
    closing = request('/api/setup/github/close', { method: 'POST' }).then((result) => {
      if (result.ok) paint(result.data); else if (!destroyed) state.textContent = result.message;
      return result;
    }).finally(() => { closing = null; });
    return closing;
  };
  const finishAuthentication = async (github) => {
    paint(github);
    await teardown(true);
    onAuthenticated?.();
  };
  const poll = async () => {
    if (checking || destroyed) return;
    checking = true;
    try {
      const result = await request('/api/setup/github', { cache: 'no-store' });
      if (result.ok && result.data?.authenticated) await finishAuthentication(result.data);
    } finally { checking = false; }
  };

  repository.addEventListener('input', () => paint({ installed, authenticated, account }));
  connect.addEventListener('click', async () => {
    if (connecting || mounted || destroyed) return;
    connecting = true; connect.disabled = true;
    try {
      const result = await request('/api/setup/github/login', { method: 'POST' });
      if (!result.ok) { state.textContent = result.message; return; }
      paint(result.data);
      mountAttachment(result.data?.attachment);
    } finally { connecting = false; connect.disabled = false; }
  });
  remove.addEventListener('click', async () => {
    if (removing || !authenticated || destroyed) return;
    removing = true; remove.disabled = true;
    state.textContent = t('roots.github_removing_auth', 'Removing GitHub authentication…');
    try {
      const result = await request('/api/setup/github/logout', { method: 'POST' });
      if (result.ok) paint(result.data); else state.textContent = result.message;
    } finally { removing = false; remove.disabled = false; }
  });
  done.addEventListener('click', async () => {
    const result = await show();
    if (!result.ok) return;
    if (!result.data?.authenticated) { state.textContent = t('roots.github_waiting', 'Finish GitHub authentication in the window first.'); return; }
    await finishAuthentication(result.data);
  });
  close.addEventListener('click', () => { void teardown(true); });
  cloneButton.addEventListener('click', async () => {
    if (cloning || !authenticated || !repository.value.trim()) return;
    cloning = true; cloneButton.disabled = true; outcome.textContent = t('roots.github_cloning', 'Cloning repository…');
    try {
      const result = await request('/api/setup/github/clone', { method: 'POST', json: { repository: repository.value.trim() } });
      outcome.textContent = result.ok
        ? t('roots.github_cloned', 'Added {name} as a workspace.', { name: result.data?.workspace?.name || repository.value.trim() })
        : result.message;
      if (result.ok) await onCloned?.(result.data?.workspace);
    } finally { cloning = false; cloneButton.disabled = !authenticated || !repository.value.trim(); }
  });

  paint({ installed: true, authenticated: false });
  return {
    items,
    show,
    destroy: () => { destroyed = true; void teardown(true); authBox.remove(); cloneBox.remove(); },
  };
}
