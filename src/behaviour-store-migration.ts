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
  const target = path.join(storeDir('ways'), 'selected');
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
