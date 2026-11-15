import { readFile } from 'node:fs/promises';

export interface AgentLaunches {
  native: string[];
  model: string[];
  nativeDangerously: string[];
  modelDangerously: string[];
  resume: string[];
  /** A copy of the conversation as a new one, under this launch's own settings (its provider
   *  included, which a resume of some CLIs refuses to change); [] when the CLI has none. */
  fork: string[];
  newSessionId: string[];
  isolation?: { env: string; home: string; private?: string | string[]; shared?: string[]; provision?: 'hermes-setup' };
  transcript?: { format: string; root: string; pattern: string; idPath?: string; childPath?: string };
  /** How the brief reaches a new Agent: in its argv (`positional` or a flag form), as its first
   *  message once its screen reads ready (`message`: a CLI with no prompt-and-stay-open flag),
   *  or not at all (`none`: parked in brief.md). */
  initial: 'positional' | 'none' | 'message' | string[];
}

const field = (text: string, name: string): string =>
  text.split('\n').find((line) => line.startsWith(`- **${name}:** `))?.split('** ')[1]?.trim() ?? '';

const argv = (text: string, name: string): string[] => {
  const raw = field(text, name);
  if (!raw || raw === '—') return [];
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error(`Invalid ${name} JSON in Agent document.`); }
  if (!Array.isArray(value) || value.some((part) => typeof part !== 'string' || !part)) {
    throw new Error(`Invalid ${name} argv in Agent document.`);
  }
  return value as string[];
};

/** Launch grammar is executable documentation: one auditable file per Agent CLI. */
export async function readAgentLaunches(cli: string): Promise<AgentLaunches> {
  if (!/^[a-z][a-z0-9_-]*$/.test(cli)) throw new Error(`Invalid Agent CLI id "${cli}".`);
  const text = await readFile(new URL(`../docs/agents/${cli}.md`, import.meta.url), 'utf8');
  const initial = field(text, 'launch_initial');
  const isolation = field(text, 'launch_isolation');
  const transcript = field(text, 'transcript_journal');
  const launches: AgentLaunches = {
    ...(isolation && isolation !== '—' ? { isolation: JSON.parse(isolation) } : {}),
    ...(transcript && transcript !== '—' ? { transcript: JSON.parse(transcript) } : {}),
    native: argv(text, 'launch_native'),
    model: argv(text, 'launch_model'),
    nativeDangerously: argv(text, 'launch_native_dangerously'),
    modelDangerously: argv(text, 'launch_model_dangerously'),
    resume: argv(text, 'launch_resume'),
    fork: argv(text, 'launch_fork'),
    newSessionId: argv(text, 'launch_new_session_id'),
    initial: initial.startsWith('[') ? argv(text, 'launch_initial') : initial === 'none' ? 'none' : initial === 'message' ? 'message' : 'positional',
  };
  if (!launches.native.length || launches.native[0] !== cli) {
    throw new Error(`docs/agents/${cli}.md must declare launch_native beginning with ${cli}.`);
  }
  return launches;
}

export const renderLaunch = (template: readonly string[], values: Record<string, string> = {}): string[] =>
  template.map((part) => part.replace(/\{([a-z_]+)\}/g, (_match, key: string) => values[key] ?? `{${key}}`));

export const commandText = (argv: readonly string[]): string => argv.join(' ');
