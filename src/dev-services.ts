import { access, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { peekProjectRoots, type ProjectRootInfo } from './project-roots.js';
import { readArrangement } from './desks/arrangement.js';
import { gitOut, revParse, worktreeOf } from './desks/git.js';
import { execFile } from './spawn-broker.js';
import { envWithoutGitLocation } from './tegami.js';

type Root = Pick<ProjectRootInfo, 'name' | 'dir'>;
export type DevServicesPreparation =
  | { status: 'skipped'; reason: string }
  | { status: 'synced'; source: string; target: string; revision: string };

const exists = (file: string): Promise<boolean> => access(file).then(() => true, () => false);

/** Runtime directories include deleted tracked entries so a pending deletion cannot
 * masquerade as an accepted removal. Documents/tests do not affect runtime placement. */
async function runtimePaths(source: string): Promise<string[]> {
  const names = new Set<string>();
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_') || await exists(path.join(source, entry.name, 'register.ts'))
      || await exists(path.join(source, entry.name, 'register.js'))) names.add(entry.name);
  }
  for (const file of (await gitOut(source, ['ls-files'])).split('\n')) {
    if (/^[^/]+\/register\.(ts|js)$/.test(file) || /^_[^/]+\//.test(file)) names.add(file.split('/')[0]);
  }
  return ['bin/dev-sync', 'RONIN_REPO', 'sockets-contract.ts', ...names];
}

/** Development placement only. Release updates retain their own artifact/store flow. */
export async function prepareDevServices(
  target: string,
  roots?: readonly Root[],
): Promise<DevServicesPreparation> {
  target = await realpath(target);
  // Releases can retain RONIN_REPO, but VERSION identifies their artifact ownership.
  if (await exists(path.join(target, 'VERSION'))) return { status: 'skipped', reason: 'installed release' };
  const registered = roots ?? await peekProjectRoots();
  const cowork = registered.find((root) => root.name === 'ronin_cowork');
  if (!cowork) return { status: 'skipped', reason: 'no registered Cowork development repository' };
  const arrangement = await readArrangement(cowork.name, cowork.dir);
  if (arrangement.mode !== 'reviewed') return { status: 'skipped', reason: 'Cowork has no reviewed working line' };
  const mounted = await worktreeOf(cowork.dir, arrangement.working);
  if (!mounted || await realpath(mounted.path) !== target) {
    return { status: 'skipped', reason: 'not the Cowork global working checkout' };
  }
  const services = registered.find((root) => root.name === 'ronin_services');
  if (!services) return { status: 'skipped', reason: 'no registered Services development repository' };
  const sourceArrangement = await readArrangement(services.name, services.dir);
  if (sourceArrangement.mode !== 'reviewed') throw new Error('Services development source has no reviewed working line.');
  const sourceTree = await worktreeOf(services.dir, sourceArrangement.working);
  if (!sourceTree) throw new Error(`Services working line ${sourceArrangement.working} has no mounted checkout.`);
  const source = await realpath(sourceTree.path);
  const paths = await runtimePaths(source);
  const revision = await revParse(source, 'HEAD');
  const workingRef = `refs/heads/${sourceArrangement.working}`;
  const checkSource = async () => {
    if (!revision || await revParse(source, workingRef) !== revision || await revParse(source, 'HEAD') !== revision
      || await gitOut(source, ['symbolic-ref', '--quiet', '--short', 'HEAD']) !== sourceArrangement.working) {
      throw new Error('Services working checkout changed during development preparation; start again from its accepted working tip.');
    }
    if (await gitOut(source, ['status', '--porcelain', '--untracked-files=all', '--', ...paths])) {
      throw new Error('Services development runtime has uncommitted changes; hand in and promote them before starting global dev.');
    }
  };
  await checkSource();
  await execFile(path.join(source, 'bin/dev-sync'), [target], {
    cwd: source, env: envWithoutGitLocation(), timeout: 60_000,
  });
  await checkSource();
  return { status: 'synced', source, target, revision };
}
