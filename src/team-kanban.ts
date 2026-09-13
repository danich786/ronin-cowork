import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from './spawn-broker.js';
import { acceptedLinesForTeam, receiptsForLine } from './desks/receipts.js';
import { peekProjectRoots } from './project-roots.js';
import { normalizeProject, type Project } from './projects.js';
import { listReceipts, type PromotionReceipt } from './promotion/receipts.js';
import { RIREKI_DIR } from './session-dir.js';
import { listArchives } from './session-archive.js';
import { readTeamRoster } from './team-rosters.js';
import { listSessions } from './tmux.js';
import type { HandInReceipt } from './desks/schema.js';

export interface KanbanProject extends Project { holder: string }
export interface TeamKanban { team: string; projects: KanbanProject[] }

function blockOf(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  try {
    const value = JSON.parse(candidate) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}

export async function projectsAtSessionKey(key: string, name = key): Promise<Project[]> {
  const text = await readFile(path.join(RIREKI_DIR, key, 'tegami.md'), 'utf8').catch(() => '');
  const block = blockOf(text);
  const raw = block?.projects;
  const authored = Array.isArray(raw) ? raw.map(normalizeProject).filter((p): p is Project => p !== null) : [];
  if (authored.length || !Array.isArray(block?.ladder) || !block.ladder.length) return authored;
  const legs = block.ladder.flatMap((value): { title: string; done: boolean }[] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const rung = value as Record<string, unknown>;
    if (typeof rung.gate === 'string') return [{ title: rung.gate, done: rung.status === 'DONE' }];
    if (!Array.isArray(rung.legs)) return [];
    return rung.legs.flatMap((entry): { title: string; done: boolean }[] => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
      const leg = entry as Record<string, unknown>;
      const title = String(leg.title ?? leg.leg ?? '').trim();
      return title ? [{ title, done: leg.status === 'DONE' }] : [];
    });
  });
  const objective = String(block.objective ?? '');
  return [{
    id: `legacy:${name}`, title: objective || 'Work record', objective,
    stage: 'BUILDING', exit: block.ladder.some((value) => value && typeof value === 'object' && !Array.isArray(value) && typeof (value as Record<string, unknown>).gate === 'string') ? 'user' : 'none',
    status: 'yellow', ladder: [{ stage: 'BUILDING', ...(legs.length ? { legs } : {}) }], evidence: [],
  }];
}

const evidenceCommits = (project: Project): string[] => project.evidence.flatMap((line) => {
  const found = line.match(/\b[0-9a-f]{7,40}\b/ig);
  return found ?? [];
});

export interface KanbanEvidence {
  handIns: HandInReceipt[];
  promotions: PromotionReceipt[];
  contains(repo: string, ancestor: string, descendant: string): Promise<boolean>;
}

async function stageFromEvidence(project: Project, holder: string, evidence: KanbanEvidence): Promise<Project> {
  if (project.stage === 'IDEAS' || project.stage === 'PLANNING') return project;
  const commits = evidenceCommits(project);
  const accepted = evidence.handIns.filter((r) => r.result === 'accepted' && r.session === holder);
  let landed: HandInReceipt | undefined;
  for (const receipt of accepted.slice().reverse()) {
    if (commits.length && (await Promise.all(commits.map((sha) => evidence.contains(receipt.repo, sha, receipt.candidate)))).some(Boolean)) {
      landed = receipt; break;
    }
  }
  if (!landed) return project;
  let promoted = false;
  for (const receipt of evidence.promotions.filter((r) => r.state === 'complete' && r.kind === 'team_promotion')) {
    for (const repo of receipt.repos.filter((entry) => entry.repo === landed!.repo)) {
      if (await evidence.contains(repo.repo, landed.candidate, repo.candidate)) { promoted = true; break; }
    }
    if (promoted) break;
  }
  if (await evidence.contains(landed.repo, landed.candidate, 'master')) {
    return { ...project, stage: 'DONE', exit: 'none', status: 'green' };
  }
  return { ...project, stage: 'LANDING', exit: promoted ? 'user' : 'lead', status: 'green' };
}

export async function deriveTeamKanban(team: string, inputs?: {
  rosterProjects?: Project[];
  sessions?: Array<{ name: string; key: string; tags: string[] }>;
  handIns?: HandInReceipt[];
  promotions?: PromotionReceipt[];
  contains?: KanbanEvidence['contains'];
}): Promise<TeamKanban | null> {
  const roster = await readTeamRoster(team);
  if (!roster && inputs?.rosterProjects === undefined) return null;
  const sessions = inputs?.sessions ?? [
    ...(await listSessions()).map(({ name, key, tags }) => ({ name, key, tags })),
    ...(await listArchives()).map(({ name, key, tags }) => ({ name, key, tags })),
  ];
  const roots = await peekProjectRoots();
  const rootOf = (repo: string) => roots.find((root) => root.name === repo)?.dir || repo;
  const contains = inputs?.contains ?? (async (repo: string, ancestor: string, descendant: string) => {
    try {
      await execFile('git', ['-C', rootOf(repo), 'merge-base', '--is-ancestor', ancestor, descendant], { timeout: 2_000 });
      return true;
    } catch { return false; }
  });
  let handIns = inputs?.handIns;
  if (!handIns) {
    handIns = [];
    for (const line of await acceptedLinesForTeam(team)) handIns.push(...await receiptsForLine(line.repo, line.line));
  }
  const evidence: KanbanEvidence = { handIns, promotions: inputs?.promotions ?? await listReceipts(team), contains };
  const projects: KanbanProject[] = (inputs?.rosterProjects ?? roster?.projects ?? []).map((project) => ({ ...project, holder: 'lead' }));
  const keys = new Set<string>();
  for (const session of sessions) {
    if (!session.tags.includes(team) || keys.has(session.key)) continue;
    keys.add(session.key);
    for (const project of await projectsAtSessionKey(session.key, session.name)) {
      projects.push({ ...(await stageFromEvidence(project, session.name, evidence)), holder: session.name });
    }
  }
  return { team, projects };
}
