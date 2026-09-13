import { normalizeProject, type Project } from './projects.js';
import { readTeamRoster, writeTeamRoster } from './team-rosters.js';

export type IdeaEdit = Partial<Pick<Project, 'title' | 'objective' | 'exit' | 'status' | 'ladder' | 'evidence'>>;

const projectId = (team: string, stated: string): string => {
  const value = stated.trim();
  return value.includes('/') ? value : `${team}/${value}`;
};

export async function writeTeamIdea(team: string, statedId: string | undefined, edit: IdeaEdit): Promise<{
  created: boolean;
  project: Project;
}> {
  const roster = await readTeamRoster(team);
  if (!roster) throw new Error(`Team "${team}" has no roster.`);
  const created = !statedId;
  const id = statedId ? projectId(team, statedId) : `${team}/${roster.next_project_id}`;
  if (!id.startsWith(`${team}/`)) throw new Error(`Project "${id}" does not belong to Team "${team}".`);
  const at = roster.projects.findIndex((project) => project.id === id);
  if (created && at !== -1) throw new Error(`Project "${id}" already exists.`);
  if (!created && at === -1) throw new Error(`Project "${id}" is not an idea in Team "${team}".`);
  const prior = at === -1 ? {
    id,
    title: '',
    objective: '',
    stage: 'IDEAS' as const,
    exit: 'lead' as const,
    status: 'yellow' as const,
    ladder: [{ stage: 'IDEAS' as const }],
    evidence: [],
  } : roster.projects[at];
  const project = normalizeProject({ ...prior, ...edit, id, stage: 'IDEAS' });
  if (!project) throw new Error('An idea needs a title and the complete project shape.');
  const projects = [...roster.projects];
  if (at === -1) projects.push(project); else projects[at] = project;
  await writeTeamRoster(team, {
    projects,
    ...(created ? { next_project_id: roster.next_project_id + 1 } : {}),
  });
  return { created, project };
}

export async function removeTeamIdea(team: string, statedId: string): Promise<Project> {
  const roster = await readTeamRoster(team);
  if (!roster) throw new Error(`Team "${team}" has no roster.`);
  const id = projectId(team, statedId);
  const project = roster.projects.find((entry) => entry.id === id);
  if (!project) throw new Error(`Project "${id}" is not an idea in Team "${team}".`);
  await writeTeamRoster(team, { projects: roster.projects.filter((entry) => entry.id !== id) });
  return project;
}

export async function restoreTeamIdea(team: string, value: Project): Promise<Project> {
  const roster = await readTeamRoster(team);
  if (!roster) throw new Error(`Team "${team}" has no roster.`);
  if (roster.projects.some((entry) => entry.id === value.id)) throw new Error(`Project "${value.id}" already exists in the roster.`);
  const project = normalizeProject({ ...value, stage: 'IDEAS' });
  if (!project || !project.id.startsWith(`${team}/`)) throw new Error(`Project does not belong to Team "${team}".`);
  await writeTeamRoster(team, { projects: [...roster.projects, project] });
  return project;
}
