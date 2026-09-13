export type WorktreesSetting = 'enabled' | 'disabled';

export type WorktreesApplicabilitySource = 'RONIN_REPO' | 'absent';

export interface WorktreesManagedCandidate {
  worktree: string;
  branch: string;
  line: string;
}

export interface WorktreesRepositoryInput {
  repo: string;
  project_root: string;
  checkout: string;
  worktrees: WorktreesSetting;
  applicability_source: WorktreesApplicabilitySource;
  branches: {
    working: string;
    stable: string;
  };
  managed?: WorktreesManagedCandidate;
}

export type WorktreesResolutionReason =
  | 'worktree_root'
  | 'checkout';

export interface ResolvedWorktreesRepository {
  repo: string;
  project_root: string;
  worktrees: WorktreesSetting;
  mode: 'managed' | 'direct';
  location: string;
  branches: {
    working: string;
    stable: string;
  };
  managed: WorktreesManagedCandidate | null;
  reason: WorktreesResolutionReason;
  provenance: {
    repository: WorktreesApplicabilitySource;
  };
}

export interface WorktreesResolution {
  repositories: ResolvedWorktreesRepository[];
}

export interface ResolveWorktreesInput {
  repositories: WorktreesRepositoryInput[];
}

export function resolveWorktrees(input: ResolveWorktreesInput): WorktreesResolution {
  return {
    repositories: input.repositories.map((repository) => {
      const managed = repository.worktrees === 'enabled';
      if (managed && !repository.managed) {
        throw new Error(`${repository.repo} is a worktree root, but no managed candidate was supplied.`);
      }
      return {
        repo: repository.repo,
        project_root: repository.project_root,
        worktrees: managed ? 'enabled' : 'disabled',
        mode: managed ? 'managed' : 'direct',
        location: managed ? repository.managed!.worktree : repository.checkout,
        branches: { ...repository.branches },
        managed: managed ? { ...repository.managed! } : null,
        reason: managed ? 'worktree_root' : 'checkout',
        provenance: {
          repository: repository.applicability_source,
        },
      };
    }),
  };
}
