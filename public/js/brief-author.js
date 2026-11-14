/* part of the ronin-cowork client — see js/README.md */
/** WRITE YOUR OWN (BRIEF_MODEL §3, §8): a behaviour, a tool for a command the user has, a bridge
 * (a behaviour in play when its integration is on, with the tools that serve it, in one Save),
 * or the user's own version of a stock file. A plain form; the browser composes the file's
 * header and writes it to the user's store through /api/brief/files. Nothing is checked
 * against the machine: a tool names a command, and the file is written (no guards). */
import { request } from './request.js';
import { ask } from './ask.js';
import { t } from './lexicon.js';
import { el } from './form-steps.js';
import { WorkspaceKit } from './workspace-kit.js';

const FIELDS = ['seed', 'line', 'when', 'depth', 'serves', 'order'];
const list = (text) => String(text || '').split(',').map((part) => part.trim()).filter(Boolean);
const slug = (text) => String(text || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** A file's header and text: `# Title`, then `- **field:** value` lines, a blank line, the text.
 *  Header lines this form does not draw (`hidden:` …) are kept as they are. */
export function parseFile(text = '') {
  const lines = String(text).split('\n');
  const out = { title: '', seed: '', line: '', when: [], depth: '', serves: [], order: '', extra: [], body: '' };
  let at = 0;
  if (/^#\s+/.test(lines[0] || '')) { out.title = lines[0].replace(/^#\s+/, '').trim(); at = 1; }
  for (; at < lines.length; at++) {
    const match = lines[at].match(/^- \*\*([a-z_]+):\*\*\s?(.*)$/);
    if (!match) break;
    const [, key, value] = match;
    if (key === 'when' || key === 'serves') out[key] = list(value);
    else if (FIELDS.includes(key)) out[key] = value.trim();
    else out.extra.push(lines[at]);
  }
  out.body = lines.slice(at).join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
  return out;
}

/** The file text for a parsed shape. */
export function fileText(file) {
  const head = [`# ${file.title || 'Untitled'}`];
  if (file.line) head.push(`- **line:** ${file.line}`);
  else head.push(`- **seed:** ${file.seed || ''}`);
  head.push(`- **when:** ${(file.when || []).join(', ')}`.trimEnd());
  if (file.depth) head.push(`- **depth:** ${file.depth}`);
  if (file.serves?.length) head.push(`- **serves:** ${file.serves.join(', ')}`);
  head.push(`- **order:** ${file.order || 50}`);
  head.push(...(file.extra || []));
  return `${head.join('\n')}\n\n${(file.body || '').trim()}\n`;
}

/** Write one file: a new one, the user's own version of a stock one, or an update to theirs. */
async function writeFile(scope, name, text, existing = null) {
  if (!existing) return request('/api/brief/files', { method: 'POST', json: { kind: scope, name, text } });
  if (existing.origin !== 'user') return request('/api/brief/files', { method: 'POST', json: { kind: scope, name, text, shadow: true } });
  return request(`/api/brief/files/${encodeURIComponent(scope)}/${encodeURIComponent(name)}`, { method: 'PUT', json: { text, revision: existing.revision } });
}

function depths() {
  return [
  { v: 'none', l: t('author.depth_none', 'When added'), sub: t('author.depth_none_sub', 'Told only where a Campaign, Workspace, Team or Agent adds it.') },
  { v: 'seed', l: t('author.depth_seed', 'Seed'), sub: t('author.depth_seed_sub', 'Its one line, and where to read more.') },
  { v: 'full', l: t('author.depth_full', 'Full'), sub: t('author.depth_full_sub', 'The whole text, from the start.') },
  ];
}

/**
 * The form. `mode` is 'behaviour' | 'tool' | 'bridge' | 'fact'; `existing` the file as read
 * (`{ name, scope, text, origin, revision }`) when editing or making a version of one.
 * `onDone(key)` after a save, with the `scope:name` to select; `onCancel()`.
 */
export function createAuthorForm({ mode = 'behaviour', existing = null, catalog = [], conditionals = [], onDone = () => {}, onCancel = () => {} } = {}) {
  const { createField, createAction } = WorkspaceKit.primitives;
  const root = el('div', 'bh-editor brief-author');
  const parsed = parseFile(existing?.text || '');
  const asks = [];
  const input = (value = '', placeholder = '') => { const i = el('input'); i.type = 'text'; i.value = value; i.placeholder = placeholder; i.spellcheck = false; return i; };
  const area = (value = '', rows = 10) => { const a = el('textarea'); a.value = value; a.rows = rows; return a; };
  const field = (label, control, help = '') => { const f = createField({ label, control }).el; if (help) f.append(el('p', 'na-behaviour-note', help)); root.append(f); return control; };
  const picker = (key, label, options, value, many = true) => {
    const one = ask([{ group: label, fields: [{ key, label, many, shape: 'tall', options }] }], { value: { [key]: value }, density: 'tight' });
    asks.push(one); root.append(one.el); return one;
  };
  const behaviours = catalog.filter((row) => row.kind === 'behaviour').map((row) => ({ v: row.name, l: row.title || row.name, sub: row.seed || '' }));
  const whenRows = conditionals.map((name) => ({ v: name, l: name }));

  const isTool = mode === 'tool';
  const isBridge = mode === 'bridge';
  const isFact = mode === 'fact';
  const name = existing ? null : input('', isTool ? t('author.command_placeholder', 'the command, e.g. deploy-site') : t('author.name_placeholder', 'lowercase, digits, -'));
  const integration = isBridge ? input('', t('author.integration_placeholder', 'e.g. netlify')) : null;
  if (isBridge) field(t('author.integration', 'Integration'), integration, t('author.integration_help', 'Its behavior is told to an Agent while this integration is on for it.'));
  if (name && !isBridge) field(isTool ? t('author.command', 'Command') : t('author.name', 'Name'), name,
    isTool ? t('author.command_help', 'A command you have, on the PATH or in ~/ronin/tools. Ronin writes what Agents are told about it; the command stays yours.') : '');
  const title = field(t('author.title', 'Title'), input(parsed.title));
  const seed = isFact ? null : field(t('author.seed', 'Seed'), input(parsed.seed), isTool ? t('author.seed_tool_help', 'Its one job, in one line.') : t('author.seed_help', 'One line that stands on its own: what this guidance is for.'));
  const factLine = isFact ? field(t('author.line', 'Line'), input(parsed.line), t('author.line_help', 'The line the brief prints, with values in braces: User: {user.name}.')) : null;
  const when = !isTool && !isBridge ? picker('when', t('author.when', 'When it is in play'), whenRows, parsed.when) : null;
  if (when) root.append(el('p', 'na-behaviour-note', t('author.when_help', 'All chosen must hold. None chosen: every Agent.')));
  const depth = !isFact ? picker('depth', t('author.depth', 'Depth'), depths(), parsed.depth || (isTool ? 'seed' : 'none'), false) : null;
  const serves = isTool ? picker('serves', t('author.serves', 'Serves'), behaviours, parsed.serves) : null;
  if (serves) root.append(el('p', 'na-behaviour-note', t('author.serves_help', 'Told under these behaviors. None: under Other tools.')));
  const body = field(isTool ? t('author.tool_text', 'What --help does not say') : t('author.text', 'Text'), area(parsed.body, isTool ? 5 : 10));

  /* A bridge's tools: new tool files, each a command and its one job, serving the bridge. */
  const tools = [];
  const toolsHost = el('div', 'brief-author-tools');
  if (isBridge) {
    root.append(el('h4', 'brief-author-head', t('author.bridge_tools', 'Its tools')));
    const addTool = () => {
      const row = el('div', 'brief-author-tool');
      const command = input('', t('author.command_placeholder', 'the command, e.g. deploy-site'));
      const job = input('', t('author.seed_tool_help', 'Its one job, in one line.'));
      row.append(command, job); toolsHost.append(row); tools.push({ command, job });
    };
    const more = createAction({ label: t('author.add_tool', 'Add a tool'), size: 'compact', action: addTool });
    addTool();
    root.append(toolsHost, more.el);
  }

  const status = el('p', 'bh-status'); status.setAttribute('role', 'status');
  const saveLabel = !existing ? t('author.create', 'Create') : existing.origin === 'user' ? t('forms.save', 'Save') : t('behaviours.save_mine', 'Save my version');
  const save = createAction({ label: saveLabel, size: 'compact', action: () => void doSave() });
  const cancel = createAction({ label: t('forms.cancel', 'Cancel'), size: 'compact', action: () => onCancel() });
  const actions = el('div', 'bh-actions'); actions.append(save.el, cancel.el, status);
  root.append(actions);

  const shape = () => ({
    ...parsed, title: title.value.trim(), seed: seed?.value.trim() || '', line: factLine?.value.trim() || '',
    when: when ? [...when.value().when] : parsed.when, depth: depth ? depth.value().depth : '',
    serves: serves ? [...serves.value().serves] : parsed.serves, body: body.value,
  });
  async function doSave() {
    status.textContent = ''; delete status.dataset.bad;
    const fail = (message) => { status.textContent = message; status.dataset.bad = 'true'; };
    const scope = existing?.scope || (isTool ? 'tools' : isFact ? 'facts' : 'behaviours');
    if (isBridge) {
      const service = slug(integration.value);
      if (!service) return fail(t('author.integration_needed', 'Name the integration.'));
      const bridge = `${service}-bridge`;
      const made = await writeFile('behaviours', bridge, fileText({ ...shape(), title: title.value.trim() || `${service} bridge`, when: [`integration:${service}`] }));
      if (!made.ok) return fail(made.message);
      for (const tool of tools) {
        const command = tool.command.value.trim();
        if (!command) continue;
        const written = await writeFile('tools', command, fileText({ title: command, seed: tool.job.value.trim(), when: [], depth: 'seed', serves: [bridge], body: '' }));
        if (!written.ok) return fail(`${command}: ${written.message}`);
      }
      return onDone(`behaviours:${bridge}`);
    }
    const target = existing?.name || (isTool ? name.value.trim() : slug(name.value || title.value));
    if (!target) return fail(isTool ? t('author.command_needed', 'Name the command.') : t('author.name_needed', 'Give it a name.'));
    const result = await writeFile(scope, target, fileText(shape()), existing);
    if (!result.ok) return fail(result.message);
    onDone(`${scope}:${target}`);
  }
  return { el: root, destroy: () => asks.forEach((one) => one.destroy()) };
}
