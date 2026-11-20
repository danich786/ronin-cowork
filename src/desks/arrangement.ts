import { listWorkspaces, saveWorkspace, soleWorkspaceRepo, workspaceFolders, type HeldFolder } from '../workspaces.js';
import type { RepoArrangement } from './schema.js';

/**
 * A REPOSITORY'S SETTINGS LIVE ON ITS WORKSPACE ROW (owner, 2026-11-20; KAN-728): Worktrees or
 * checkout, the working and stable branch. Desks and promotion read them here; nothing else holds them.
 */
export const rowArrangement = (r: HeldFolder): RepoArrangement => {
  const reviewed = r.repo && r.mode === 'reviewed';
  const stable = r.stable || 'main';
  const working = reviewed ? r.working || 'dev' : stable;
  return {
    repo: r.name, dir: r.dir, mode: reviewed ? 'reviewed' : 'direct', working, stable,
    desks: reviewed && r.desks === 'managed' ? 'managed' : 'none',
    publish: reviewed ? [working, stable] : [stable], source: r.repo ? 'workspace' : 'absent',
  };
};

export async function arrangementOf(root: string, folders?: HeldFolder[]): Promise<RepoArrangement> {
  const all = folders ?? (await workspaceFolders());
  const named = (name: string | null) => all.find((x) => x.name === name);
  const r = named(root) ?? named(await soleWorkspaceRepo(root));
  if (!r) throw new Error(`no Workspace folder named '${root}'; folders: ${all.map((x) => x.name).join(', ') || 'none'}`);
  return rowArrangement(r);
}

/** Writes the settings onto the repo's row; saveWorkspace carries them to every Workspace holding it. */
export async function setRepoSettings(name: string, settings: { mode?: unknown; working?: unknown; stable?: unknown; desks?: unknown }): Promise<RepoArrangement> {
  const held = (await workspaceFolders()).find((f) => f.name === name && f.repo);
  const w = held && (await listWorkspaces(held.campaign_id)).find((one) => one.name === held.workspace);
  const row = w?.repos.find((r) => r.name === name);
  if (!w || !row) throw new Error(`no Workspace repository named '${name}'`);
  Object.assign(row, Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== undefined)));
  await saveWorkspace(w);
  return arrangementOf(name);
}

export const desksManaged = (a: RepoArrangement): boolean => a.mode === 'reviewed' && a.desks === 'managed';
