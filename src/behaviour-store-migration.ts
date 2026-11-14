import { chmod, mkdir, readdir, readFile, rename, rmdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { rootDir, storeDir } from './resources.js';

export interface BehaviourStoreMigration {
  moved: string[];
  deduplicated: string[];
}

function asBehaviour(name: string, text: string): string {
  if (/^-\s+\*\*[\w.-]+:\*\*/m.test(text)) return text;
  const label = text.match(/^#\s+(.+)$/m)?.[1]?.trim() || name.replace(/[-_]+/g, ' ');
  const blurb = text.split(/\n\s*\n/)
    .map((part) => part.replace(/^#.*$/gm, '').replace(/^>\s?/gm, '').replace(/\s+/g, ' ').trim())
    .find(Boolean) || 'Owner procedure migrated into the Behavior shelf.';
  const metadata = `- **label:** ${label}\n- **blurb:** ${blurb.slice(0, 200)}\n- **scope:** selected\n- **installation:** —\n- **order:** 900\n`;
  const heading = /^#.*$/m.exec(text);
  if (!heading?.index && heading) {
    const end = text.indexOf('\n', heading.index);
    return end < 0 ? `${text}\n\n${metadata}` : `${text.slice(0, end + 1)}\n${metadata}${text.slice(end + 1)}`;
  }
  return `# ${label}\n\n${metadata}\n${text}`;
}

/** One-way cutover from the retired SOP store into the Behavior store. */
export async function migrateSopsToBehaviours(): Promise<BehaviourStoreMigration> {
  const old = process.env.RONIN_SOPS_DIR?.trim() || path.join(rootDir('user'), 'sops');
  const target = path.join(rootDir('user'), 'ways', 'selected');
  const done: BehaviourStoreMigration = { moved: [], deduplicated: [] };
  const entries = await readdir(old, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('.'));
  if (!files.length) return done;
  await mkdir(target, { recursive: true });
  for (const entry of files) {
    const from = path.join(old, entry.name);
    const to = path.join(target, entry.name);
    const legacy = await readFile(from);
    const migrated = Buffer.from(asBehaviour(entry.name.replace(/\.md$/, ''), legacy.toString('utf8')));
    const existing = await readFile(to).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (existing !== null) {
      if (!existing.equals(migrated)) {
        throw new Error(`Behavior migration collision for ${entry.name}: both the retired sops store and ways store contain different owner files; reconcile them before Ronin starts.`);
      }
      await unlink(from);
      done.deduplicated.push(entry.name);
      continue;
    }
    const temporary = `${to}.migrating-${process.pid}`;
    const mode = (await stat(from)).mode;
    await writeFile(temporary, migrated);
    await chmod(temporary, mode);
    await rename(temporary, to);
    await unlink(from);
    done.moved.push(entry.name);
  }
  await rmdir(old).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY') throw error;
  });
  return done;
}

// ── The ways store → behaviours and facts (wip/BRIEF_MODEL.md §3, §9), once at start ──

const OLD_WHEN: Record<string, string> = {
  'arrangement:managed': 'desk', 'arrangement:checkout': 'checkout', new_owner: 'new-owner',
  cowork: 'cowork', team: 'team', lead: 'lead',
};
const DEPTH_OF_SCOPE: Record<string, string> = { floor: 'full', conditional: 'full', selected: 'none', sought: 'seed' };

const firstSentence = (text: string): string => {
  const paragraph = text.replace(/<!--[^]*?-->/g, '').split(/\n\s*\n/).map((part) => part.trim())
    .find((part) => part && !/^(#|>|\||[-*] |\d+\. |```)/.test(part)) ?? '';
  return (paragraph.replace(/\s+/g, ' ').match(/^.*?[.!?](?=\s|$)/)?.[0] ?? paragraph.replace(/\s+/g, ' ')).trim();
};

/** An old behaviour file (label, blurb, scope, requires) in the §3 header. `when` adds conditionals. */
export function asCatalogBehaviour(name: string, text: string, scope: string, extraWhen: string[] = []): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const key = (k: string): string => lines.find((l) => new RegExp(`^-\\s*\\*\\*${k}:\\*\\*`, 'i').test(l.trim()))
    ?.replace(new RegExp(`^\\s*-\\s*\\*\\*${k}:\\*\\*\\s*`, 'i'), '').trim() ?? '';
  const title = lines.find((l) => /^#\s+/.test(l))?.replace(/^#\s+/, '').trim() || key('label') || name.replace(/[-_]+/g, ' ');
  const body = lines.filter((l, i) => !/^-\s*\*\*[\w.-]+:\*\*/.test(l.trim()) && !(i === lines.findIndex((x) => /^#\s+/.test(x)))).join('\n').trim();
  const when = [
    ...key('requires').split(',').map((w) => w.trim()).filter(Boolean).flatMap((w) => OLD_WHEN[w] ? [OLD_WHEN[w]] : w.startsWith('role:') ? [w] : []),
    ...extraWhen,
  ];
  const seed = key('seed') || key('blurb') || firstSentence(body) || title;
  const header = [
    `# ${title}`,
    `- **seed:** ${seed}`,
    ...(when.length ? [`- **when:** ${when.join(', ')}`] : []),
    `- **depth:** ${key('depth') || DEPTH_OF_SCOPE[scope] || 'seed'}`,
    ...(key('order') ? [`- **order:** ${key('order')}`] : []),
  ];
  return `${header.join('\n')}\n\n${body}\n`;
}

async function moveInto(to: string, content: Buffer, from: string, done: BehaviourStoreMigration, label: string): Promise<void> {
  const existing = await readFile(to).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (existing !== null && !existing.equals(content)) {
    throw new Error(`Behaviour store move collision for ${label}: ${from} and ${to} differ; reconcile them before Ronin starts.`);
  }
  if (existing === null) {
    await mkdir(path.dirname(to), { recursive: true });
    const temporary = `${to}.migrating-${process.pid}`;
    await writeFile(temporary, content);
    await chmod(temporary, (await stat(from)).mode);
    await rename(temporary, to);
    done.moved.push(label);
  } else done.deduplicated.push(label);
  await unlink(from);
}

async function walkMarkdown(dir: string, prefix = ''): Promise<Array<{ file: string; relative: string }>> {
  const entries = await readdir(dir, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const out: Array<{ file: string; relative: string }> = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const file = path.join(dir, entry.name);
    const relative = prefix ? path.join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) out.push(...await walkMarkdown(file, relative));
    else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') out.push({ file, relative });
  }
  return out;
}

async function removeEmpty(dir: string): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (entry.isDirectory()) await removeEmpty(path.join(dir, entry.name));
  }
  await rmdir(dir).catch(() => {});
}

/**
 * One-way: `~/ronin/ways/<scope>/*.md` into the flat `~/ronin/behaviours/`, in the §3 header
 * (the user intro into `~/ronin/facts/user-intro.md`), and the user's Workspace shelf files
 * `~/ronin/session_boot/root/<ws>/*.md` into behaviours with `when: workspace:<ws>`.
 * Symlinks on the shelf were the shelf's own pointers and are dropped.
 */
export async function migrateWaysToBehaviours(): Promise<BehaviourStoreMigration> {
  const done: BehaviourStoreMigration = { moved: [], deduplicated: [] };
  const ways = path.join(rootDir('user'), 'ways');
  const behaviours = storeDir('behaviours');
  for (const { file, relative } of await walkMarkdown(ways)) {
    const scope = relative.split(path.sep)[0] ?? '';
    const name = path.basename(relative, '.md').replace(/[\s_]+/g, '-').toLowerCase();
    const text = await readFile(file, 'utf8');
    if (name === 'user-intro') {
      const intro = text.split(/^## About the user\s*$/im)[1]?.trim() ?? '';
      await moveInto(path.join(storeDir('facts'), 'user-intro.md'), Buffer.from(userIntroFact(intro)), file, done, relative);
      continue;
    }
    await moveInto(path.join(behaviours, `${name}.md`), Buffer.from(asCatalogBehaviour(name, text, scope)), file, done, relative);
  }
  await removeEmpty(ways);
  const root = path.join(storeDir('session_boot'), 'root');
  for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory()) continue;
    const ws = entry.name;
    for (const shelf of await readdir(path.join(root, ws), { withFileTypes: true }).catch(() => [])) {
      const from = path.join(root, ws, shelf.name);
      if (shelf.isSymbolicLink()) { await unlink(from); continue; }
      if (!shelf.isFile() || !shelf.name.endsWith('.md') || shelf.name === 'README.md') continue;
      const name = `${ws}-${path.basename(shelf.name, '.md')}`.replace(/[\s_]+/g, '-').toLowerCase();
      const text = await readFile(from, 'utf8');
      await moveInto(path.join(behaviours, `${name}.md`), Buffer.from(asCatalogBehaviour(name, text, 'sought', [`workspace:${ws}`])), from, done, `session_boot/root/${ws}/${shelf.name}`);
    }
  }
  await removeEmpty(root);
  return done;
}

/** The user intro fact: the user's own text, told in full. */
export const userIntroFact = (intro: string): string =>
  `# User intro\n- **order:** 20\n\n${intro.trim()}\n`;
