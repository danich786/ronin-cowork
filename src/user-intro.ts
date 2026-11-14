/** THE USER INTRO — the user's own text about themself, a fact told in full
 * (docs/architecture/brief.md, The stock files): `~/ronin/facts/user-intro.md`, replacing the stock file by name. One writer. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCatalogFile } from './catalog.js';
import { storeDir } from './resources.js';

export const userIntroFile = (): string => process.env.RONIN_USER_INTRO_FILE?.trim()
  || path.join(storeDir('facts'), 'user-intro.md');

/** The user intro fact: the user's own text, told in full. */
export const userIntroFact = (intro: string): string =>
  `# User intro\n- **order:** 30\n\n${intro.trim()}\n`;

const clean = (value: unknown): string => typeof value === 'string'
  ? value.trim().replace(/\r\n?/g, '\n').slice(0, 600)
  : '';

export async function readUserIntro(): Promise<{ intro: string; file: string }> {
  const file = userIntroFile();
  try {
    return { intro: parseCatalogFile('facts', 'user-intro', await fs.readFile(file, 'utf8')).body, file };
  } catch {
    return { intro: '', file };
  }
}

/** Write the intro; blank removes the user's file (the stock one stands). */
export async function saveUserIntro(intro: string): Promise<void> {
  const file = userIntroFile();
  if (!intro.trim()) {
    await fs.rm(file, { force: true });
    return;
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, userIntroFact(intro), { mode: 0o600 });
  await fs.rename(tmp, file);
}

export async function writeUserIntro(value: unknown): Promise<{ intro: string; file: string }> {
  const intro = clean(value);
  if (!intro) throw new Error('Write a short introduction before saving.');
  await saveUserIntro(intro);
  return { intro, file: userIntroFile() };
}
