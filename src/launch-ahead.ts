/**
 * SET AHEAD AT LAUNCH (KAN-616): the questions a CLI asks before its first turn that have a
 * known answer are answered in its own files before it starts, and the hook that raises the
 * asking flag (ronin_bin/ronin-asking, src/asking.ts) is put in place. Each CLI's launch doc
 * (docs/agents/claude.md, codex.md) says what is set. Login is not: the owner signs in in the
 * terminal. Returns the argv the CLI is given after its executable.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from './resources.js';

const readText = (file: string) => readFile(file, 'utf8').catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return ''; throw e; });

/** Claude: the folder is trusted in ~/.claude.json, and the hooks ride --settings. */
async function claude(cwd: string): Promise<string[]> {
  const file = path.join(process.env.CLAUDE_CONFIG_DIR || homedir(), '.claude.json');
  const text = await readText(file);
  const state = text ? JSON.parse(text) : {};
  const projects = state.projects ??= {};
  if (projects[cwd]?.hasTrustDialogAccepted !== true) {
    projects[cwd] = { ...projects[cwd], hasTrustDialogAccepted: true };
    // Whole or not at all: running Claudes read this file too.
    await writeFile(`${file}.ronin`, JSON.stringify(state, null, 2));
    await rename(`${file}.ronin`, file);
  }
  return ['--settings', path.join(REPO_ROOT, 'hostside', 'claude-asking.json')];
}

// Codex trusts a hook against a hash it computes from the hook; these are its own, recorded
// from codex-cli 0.169.0's /hooks for the entries below. A Codex that hashes differently
// shows "Hooks need review" again: record the new ones (docs/agents/codex.md).
const CODEX_HOOKS: Record<string, [string, string]> = {
  PermissionRequest: ['permission_request', 'sha256:3390373f51bcd1a64ed909cb01577ded007d243294d284779c86e0c2b3edfe6b'],
  PreToolUse: ['pre_tool_use', 'sha256:68508134e6c222cb8639a99823315f7dc71795253abfb8411e39ba689e37f7ac'],
  PostToolUse: ['post_tool_use', 'sha256:c5d4d9acb5d5e2710692d3f28e6970a61baf79c4ed2380abba4b03821672990e'],
  UserPromptSubmit: ['user_prompt_submit', 'sha256:f8cf3db180cfcb6edf56a068c8708dfc0efa35841f7c5fb4f189dd2b0d8c8af0'],
  Stop: ['stop', 'sha256:7cbedd8b65ee646978075bcf87d0afc3a39f3e28b4614b2616f3426516e9c714'],
};

/** One `key = value` in a TOML text, left alone when the key is already there. Line-wise, so
 * the owner's file keeps its layout; Codex itself edits the file the same way. */
export function tomlEnsure(text: string, table: string | null, key: string, value: string): string {
  const line = `${key} = ${value}`;
  const lines = text.split('\n');
  const isKey = (l: string) => l.trimStart().startsWith(`${key} `) || l.trimStart().startsWith(`${key}=`);
  const isHeader = (l: string) => l.trimStart().startsWith('[');
  if (table === null) {
    const top = lines.findIndex(isHeader);
    if (lines.slice(0, top < 0 ? undefined : top).some(isKey)) return text;
    return `${line}\n${text}`;
  }
  const at = lines.findIndex((l) => l.trim() === `[${table}]`);
  if (at < 0) return `${text.replace(/\n*$/, '')}\n\n[${table}]\n${line}\n`;
  const next = lines.findIndex((l, i) => i > at && isHeader(l));
  if (lines.slice(at + 1, next < 0 ? undefined : next).some(isKey)) return text;
  lines.splice(at + 1, 0, line);
  return lines.join('\n');
}

/** Codex: in its home's config.toml, the folder trusted, no update check, the warnings off,
 * and the hooks in its home's hooks.json trusted. */
async function codex(cwd: string, home: string): Promise<string[]> {
  const hooks = path.join(home, 'hooks.json');
  const entry = [{ hooks: [{ type: 'command', command: 'ronin-asking' }] }];
  await mkdir(home, { recursive: true });
  await writeFile(hooks, JSON.stringify({ hooks: Object.fromEntries(Object.keys(CODEX_HOOKS).map((e) => [e, entry])) }, null, 2) + '\n');
  const config = path.join(home, 'config.toml'); // the owner's own, linked into this home
  let text = await readText(config);
  const before = text;
  text = tomlEnsure(text, null, 'check_for_update_on_startup', 'false');
  text = tomlEnsure(text, 'notice', 'hide_full_access_warning', 'true');
  text = tomlEnsure(text, 'notice', 'hide_rate_limit_model_nudge', 'true');
  text = tomlEnsure(text, `projects.${JSON.stringify(cwd)}`, 'trust_level', '"trusted"');
  for (const [event, hash] of Object.values(CODEX_HOOKS)) {
    text = tomlEnsure(text, `hooks.state.${JSON.stringify(`${hooks}:${event}:0:0`)}`, 'trusted_hash', JSON.stringify(hash));
  }
  if (text !== before) await writeFile(config, text);
  return [];
}

export async function setAhead(cli: string, cwd: string, home: string | undefined): Promise<string[]> {
  if (cli === 'claude') return claude(cwd);
  if (cli === 'codex' && home) return codex(cwd, home);
  return [];
}
