/** A complete brief document (the work record's `brief` key, src/brief-build.ts) for tests. */
import type { BriefDocument } from '../../src/brief-build.js';

export function briefDoc(name: string, over: { pm?: boolean; team?: string; role?: BriefDocument['agent']['role'] } = {}): BriefDocument {
  return {
    session: { name, title: '', type: 'cowork', template: '', task: 'Do it' },
    user: {
      name: '', email: '', first_name: '', last_name: '', nickname: '', role: 'owner', organization: '', job_title: '',
      time_zone: '', language: '', planned_use: [], planned_use_other: '', technical_level: '', ai_experience: '', about: '',
      new_owner: false, account: '',
    },
    people: [],
    setting: { hosted: false, campaign: 'home_machine', workspace: '', instructions: '', integrations: [], available: [], mcp: [], api: [], pm: false, services: [] },
    agent: {
      role: over.role ?? 'coworker', team: over.team ?? '', lead: false, wipeboard: over.team ?? '', team_objective: '', team_integrations: [],
      reach: 'nobody', recruit: 'nobody', output: ['code'], provider: 'anthropic', model: 'm', harness: 'claude', launch_mode: 'configured',
    },
    work: { repos: [], where: [], repo_lines: '', folder_lines: '', desk: false, checkout: false },
    brief_settings: {
      user: { brief: { add: [], block: [], only: [] }, integrations: [] },
      campaign: { brief: { add: [], block: [], only: [] }, integrations: [], pm: over.pm === true },
      agent: { brief: { add: [], block: [], only: [] }, integrations: [] },
    },
  };
}

/** A work record holding that document, as birth leaves it. */
export async function seedBriefDoc(doc: BriefDocument): Promise<void> {
  const { seedTegami, writeBriefRecord } = await import('../../src/tegami.js');
  await seedTegami(doc.session.name);
  await writeBriefRecord(doc.session.name, doc);
}
