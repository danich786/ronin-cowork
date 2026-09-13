export const PROJECT_STAGES = ['IDEAS', 'PLANNING', 'BUILDING', 'LANDING', 'DONE'] as const;
export const PROJECT_EXITS = ['none', 'agent', 'lead', 'user'] as const;
export const PROJECT_STATUSES = ['green', 'yellow', 'red'] as const;

export type ProjectStage = typeof PROJECT_STAGES[number];
export type ProjectExit = typeof PROJECT_EXITS[number];
export type ProjectStatus = typeof PROJECT_STATUSES[number];

export interface ProjectLeg {
  title: string;
  done?: boolean;
}

export interface ProjectLadderStage {
  stage: ProjectStage;
  legs?: ProjectLeg[];
}

/** A project has no owner: the record containing it is its holder. */
export interface Project {
  id: string;
  title: string;
  objective: string;
  stage: ProjectStage;
  exit: ProjectExit;
  status: ProjectStatus;
  ladder: ProjectLadderStage[];
  evidence: string[];
}

function member<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

/**
 * Turn an untrusted stored value into the one project shape. Invalid values are absent;
 * callers that write decide how to disclose that failure, while readers stay total.
 */
export function normalizeProject(value: unknown): Project | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (typeof raw.title !== 'string' || !raw.title.trim()) return null;
  if (typeof raw.objective !== 'string') return null;
  if (!member(PROJECT_STAGES, raw.stage)) return null;
  if (!member(PROJECT_EXITS, raw.exit)) return null;
  if (!member(PROJECT_STATUSES, raw.status)) return null;
  if (!Array.isArray(raw.ladder) || !Array.isArray(raw.evidence)) return null;

  const ladder: ProjectLadderStage[] = [];
  for (const value of raw.ladder) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const rung = value as Record<string, unknown>;
    if (!member(PROJECT_STAGES, rung.stage)) return null;
    const out: ProjectLadderStage = { stage: rung.stage };
    if (rung.legs !== undefined) {
      if (!Array.isArray(rung.legs)) return null;
      const legs: ProjectLeg[] = [];
      for (const value of rung.legs) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const leg = value as Record<string, unknown>;
        if (typeof leg.title !== 'string' || !leg.title.trim()) return null;
        if (leg.done !== undefined && typeof leg.done !== 'boolean') return null;
        legs.push({ title: leg.title, ...(leg.done === undefined ? {} : { done: leg.done }) });
      }
      out.legs = legs;
    }
    ladder.push(out);
  }

  if (!raw.evidence.every((item): item is string => typeof item === 'string')) return null;
  return {
    id: raw.id,
    title: raw.title,
    objective: raw.objective,
    stage: raw.stage,
    exit: raw.exit,
    status: raw.status,
    ladder,
    evidence: [...raw.evidence],
  };
}

export const normaliseProject = normalizeProject;
