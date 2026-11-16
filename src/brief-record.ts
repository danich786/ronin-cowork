/**
 * THE BRIEF RECORD — every value a brief depends on (docs/architecture/brief.md, The work record is the source of truth). The brief is
 * this record plus the catalog files, nothing else. `when:` conditionals (src/conditionals.ts)
 * and fact `line:` placeholders read it by path (`user.name`, `agent.role`).
 */
import type { LaunchMode } from './agent-defaults.js';
import type { Depth } from './catalog.js';

export type SessionType = 'cowork' | 'bare' | 'mika';
export type AgentRole = 'coworker' | 'lead' | 'epic_lead' | 'coordinator';

/** One layer's brief settings (docs/architecture/brief.md, Layers and brief settings): what it adds (at a depth), blocks and screens to. */
export interface BriefSettings {
  add: Array<{ name: string; depth?: Depth }>;
  block: string[];
  only: string[];
  /** Integrations on above that this layer turns off, for itself and below (narrowing). */
  integrations_off?: string[];
}

export type OfficePerson = Omit<import('./office-people.js').Person, 'role'> & { role: string };

export interface BriefRecord {
  session: { name: string; title: string; type: SessionType; template: string; task: string };
  user: {
    name: string;
    email: string;
    first_name: string;
    last_name: string;
    nickname: string;
    role: string;
    organization: string;
    job_title: string;
    time_zone: string;
    language: string;
    /** coding, planning, launching, research, writing, marketing, operations, data, other. */
    planned_use: string[];
    planned_use_other: string;
    /** non_technical, some, developer. */
    technical_level: string;
    /** new, some, daily. */
    ai_experience: string;
    /** The person's own words, up to 500 characters. */
    about: string;
    new_owner: boolean;
    account: string;
  };
  /** Hosted: the office's owner and members. Self-hosted: none. */
  people: OfficePerson[];
  setting: {
    hosted: boolean;
    campaign: string;
    workspace: string;
    /** The Workspace's own instructions text. */
    instructions: string;
    /** Integrations on for this Agent: the union down the layers, less what a layer turns off. */
    integrations: string[];
    /** The MCP servers on for this Agent, each with its record's description (behaviours/mcp.md). */
    mcp: Array<{ name: string; description: string }>;
    /** Project management on for this Agent: any layer on, or Jira on. */
    pm: boolean;
    /** Ronin Services parts running. */
    services: string[];
  };
  agent: {
    role: AgentRole;
    team: string;
    lead: boolean;
    wipeboard: string;
    team_objective: string;
    /** A Team lead's: the integrations on for its Team (the layers down to the Team, without the Agent's own); [] otherwise. */
    team_integrations: string[];
    reach: string;
    recruit: string;
    output: string[];
    provider: string;
    model: string;
    harness: string;
    launch_mode: LaunchMode;
  };
  work: {
    repos: string[];
    /** Each repo and how it is held. */
    where: Array<{ repo: string; held: 'desk' | 'checkout' }>;
    /** One line per repo: where it is and how to open it. */
    repo_lines: string;
    /** One line per Workspace Folder: its name, path and note. */
    folder_lines: string;
    desk: boolean;
    checkout: boolean;
  };
}

/** How a record value reads in a fact line. The words are the brief's (BRIEF_WORDING). */
const WORDS: Record<string, (r: BriefRecord) => string> = {
  'session.type': (r) => ({ cowork: 'Cowork Agent', bare: 'bare metal Agent', mika: 'Mika' })[r.session.type],
  'setting.hosting': (r) => r.setting.hosted ? 'hosted' : 'self-hosted',
  'setting.integrations': (r) => r.setting.integrations.join(', ') || 'none',
  'setting.mcp_lines': (r) => r.setting.mcp.map((one) => `\n- ${one.name}: ${one.description}`).join(''),
  'setting.pm': (r) => r.setting.pm ? 'on' : 'off',
  'setting.services': (r) => r.setting.services.includes('ronin_services') ? 'Ronin Services running' : '',
  people: (r) => r.people.map((p) => `${[p.role, p.nickname || p.first_name || p.name || p.email].filter(Boolean).join(' ')}${p.organization ? `, ${p.organization}` : ''}`).join('; '),
  'work.where': (r) => r.work.where.map((w) => `${w.repo} (${w.held})`).join(', '),
  'agent.role': (r) => r.agent.role.replace(/_/g, ' '),
  'user.call_name': (r) => r.user.nickname || r.user.first_name || r.user.name || r.user.email,
  'user.technical_level': (r) => ({ non_technical: 'not technical', some: 'some technical', developer: 'developer' } as Record<string, string>)[r.user.technical_level] ?? '',
  'user.ai_experience': (r) => ({ new: 'new to AI', some: 'some AI', daily: 'uses AI daily' } as Record<string, string>)[r.user.ai_experience] ?? '',
  'user.planned_use': (r) => r.user.planned_use.map((use) => use === 'other' ? r.user.planned_use_other || '' : use).filter(Boolean).join(', '),
};

/** A value on the record by dotted path, as a fact line prints it; '' when absent. */
export function recordValue(record: BriefRecord, at: string): string {
  const word = WORDS[at];
  if (word) return word(record);
  let value: unknown = record;
  for (const part of at.split('.')) {
    if (!value || typeof value !== 'object') return '';
    value = (value as Record<string, unknown>)[part];
  }
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (typeof value === 'boolean') return value ? 'yes' : '';
  return value === undefined || value === null ? '' : String(value);
}
