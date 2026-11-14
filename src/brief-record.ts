/**
 * THE BRIEF RECORD — every value a brief depends on (wip/BRIEF_MODEL.md §5). The brief is
 * this record plus the catalog files, nothing else. `when:` conditionals (src/conditionals.ts)
 * and fact `line:` placeholders read it by path (`user.name`, `agent.role`).
 */
import type { Mandate, LaunchMode } from './agent-defaults.js';
import type { Depth } from './catalog.js';

export type SessionType = 'cowork' | 'bare' | 'mika';
export type AgentRole = 'coworker' | 'lead' | 'epic_lead' | 'coordinator';

/** One layer's brief settings (§6): what it adds (at a depth), blocks and screens to. */
export interface BriefSettings {
  add: Array<{ name: string; depth?: Depth }>;
  block: string[];
  only: string[];
}

export interface OfficePerson { email: string; role: string; name?: string; organization?: string }

export interface BriefRecord {
  session: { name: string; title: string; type: SessionType; template: string; task: string };
  user: {
    name: string;
    role: string;
    new_owner: boolean;
    experience: string;
    account: string;
    intro: string;
  };
  /** Hosted: the office's owner and members. Self-hosted: none. */
  people: OfficePerson[];
  setting: {
    hosted: boolean;
    campaign: string;
    workspace: string;
    repos: string[];
    folders: string[];
    /** Integrations on for this Agent: the union down the layers. */
    integrations: string[];
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
    mandate: Mandate;
    provider: string;
    model: string;
    harness: string;
    launch_mode: LaunchMode;
  };
  work: { desk: boolean; checkout: boolean };
}

/** A value on the record by dotted path; '' when absent. Lists join with ', '. */
export function recordValue(record: BriefRecord, at: string): string {
  let value: unknown = record;
  for (const part of at.split('.')) {
    if (!value || typeof value !== 'object') return '';
    value = (value as Record<string, unknown>)[part];
  }
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (typeof value === 'boolean') return value ? 'yes' : '';
  return value === undefined || value === null ? '' : String(value);
}
