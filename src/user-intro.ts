import fs from 'node:fs/promises';
import path from 'node:path';
import { storeDir } from './resources.js';

const target = () => process.env.RONIN_USER_INTRO_FILE?.trim()
  || path.join(storeDir('ways'), 'floor', 'user intro.md');

const clean = (value: unknown): string => typeof value === 'string'
  ? value.trim().replace(/\r\n?/g, '\n').slice(0, 600)
  : '';

export async function readUserIntro(): Promise<{ intro: string; file: string }> {
  const file = target();
  try {
    const markdown = await fs.readFile(file, 'utf8');
    return { intro: markdown.split(/^## About the user\s*$/im)[1]?.trim() || '', file };
  } catch {
    return { intro: '', file };
  }
}

export async function writeUserIntro(value: unknown): Promise<{ intro: string; file: string }> {
  const intro = clean(value);
  if (!intro) throw new Error('Write a short introduction before saving.');
  const file = target();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  const markdown = `# User intro\n\n- **label:** User intro\n- **blurb:** A short local introduction to the person the Agent is helping.\n- **installation:** —\n- **scope:** floor\n\n## About the user\n\n${intro}\n`;
  await fs.writeFile(tmp, markdown, { mode: 0o600 });
  await fs.rename(tmp, file);
  return { intro, file };
}
