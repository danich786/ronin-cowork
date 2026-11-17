import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * A file an Agent links in Chat, as it wrote it: `~/…` is this machine's home, a full path is
 * itself, and a path relative to where it works is found in the first of `bases` that holds it
 * (its desks, then its working folder, then the Workspace folders). Null when none does.
 */
export function resolveFileLink(link: string, bases: string[], home = os.homedir()): string | null {
  const p = String(link ?? '').trim();
  if (!p) return null;
  if (p === '~' || p.startsWith('~/')) return path.join(home, p.slice(1));
  if (path.isAbsolute(p)) return p;
  for (const base of bases) {
    if (!base) continue;
    const file = path.resolve(base, p);
    if (fs.existsSync(file)) return file;
  }
  return null;
}
