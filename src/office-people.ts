/**
 * WHO IS IN THE OFFICE — the person behind a browser request, on an office_unit (KAN-478).
 *
 * In a hosted office every browser request arrives through the office's guard, which sets
 * `X-Forwarded-Email` (the verified sign-in email, lower-case) and replaces any copy the
 * browser sent; the unit's Ronin port is reachable only from the guard, so the header is
 * trusted. No header is a local caller inside the unit: an Agent or a shell.
 *
 * Roles come from `members.json` in the `office_unit` store, beside office_record.json, which
 * the kohai writes on assignment and on every membership change:
 *   {"members":[{"email":"a@x.com","role":"owner"},{"email":"b@y.com","role":"member"}],"at":"…"}
 * A role is a string (owner, member; later ones are new values). An entry may also carry the
 * person's `name` and `organization` from the Business Lounge (later facts are new keys); each is
 * read when present. An email not in the file has no role and no details. The file is re-read when it changes (a watch on the store, never a timer).
 * Self-hosted (no office record) there is never a person: the header is not ours to trust.
 */
import type { IncomingMessage } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { storeDir } from './resources.js';
import { readOfficeRecord } from './office-record.js';
import { watchStore } from './ws/events.js';

/** The Lounge's "About you" keys (Shiwake w570), each optional; the keys only grow. */
export interface PersonFacts {
  name?: string; organization?: string;
  first_name?: string; last_name?: string; nickname?: string; job_title?: string;
  /** IANA, e.g. Europe/London. */
  time_zone?: string; language?: string;
  /** coding, planning, launching, research, writing, marketing, operations, data, other. */
  planned_use?: string[]; planned_use_other?: string;
  /** non_technical, some, developer. */
  technical_level?: string;
  /** new, some, daily. */
  ai_experience?: string;
  /** Up to 500 characters, the person's own words. */
  about?: string;
}
export interface Person extends PersonFacts { email: string; role: string | null }
type Details = Omit<Person, 'email'>;

export const membersFile = (): string => path.join(storeDir('office_unit'), 'members.json');

let hosted = false;
let members = new Map<string, Details>();

const fact = (v: unknown, max = 120): string | undefined =>
  typeof v === 'string' && v.replace(/[\r\n\t]/g, ' ').trim() ? v.replace(/[\r\n\t]/g, ' ').trim().slice(0, max) : undefined;
const TEXT_KEYS = ['name', 'organization', 'first_name', 'last_name', 'nickname', 'job_title', 'time_zone', 'language', 'planned_use_other', 'technical_level', 'ai_experience'] as const;

/** members.json's people by email; a file that is absent or will not read is nobody. */
export async function loadMembers(): Promise<void> {
  const next = new Map<string, Details>();
  try {
    const raw = JSON.parse(await fs.readFile(membersFile(), 'utf8')) as { members?: unknown };
    for (const m of Array.isArray(raw?.members) ? raw.members : []) {
      const entry = (m ?? {}) as Record<string, unknown>;
      const { email, role } = entry;
      if (typeof email !== 'string' || typeof role !== 'string') continue;
      const d: Details = { role };
      for (const key of TEXT_KEYS) { const v = fact(entry[key]); if (v) d[key] = v; }
      const about = fact(entry.about, 500);
      if (about) d.about = about;
      const uses = (Array.isArray(entry.planned_use) ? entry.planned_use : [entry.planned_use]).map((v) => fact(v, 32)).filter((v): v is string => !!v);
      if (uses.length) d.planned_use = uses;
      next.set(email.trim().toLowerCase(), d);
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.warn(`[office-people] members.json: ${(e as Error).message}`);
  }
  members = next;
}

/** At start: in an office_unit, read the members and follow the file. Returns the unwatch. */
export async function startOfficePeople(): Promise<() => void> {
  hosted = (await readOfficeRecord()).hosting === 'office_unit';
  if (!hosted) return () => {};
  await loadMembers();
  return watchStore(storeDir('office_unit'), (file) => { if (path.basename(file) === 'members.json') void loadMembers(); });
}

/** The person a browser request or socket upgrade belongs to, or null for a local caller. */
export function person(req: IncomingMessage): Person | null {
  if (!hosted) return null;
  const header = req.headers['x-forwarded-email'];
  const email = (Array.isArray(header) ? header[0] : header)?.trim().toLowerCase();
  return email ? { email, role: null, ...members.get(email) } : null;
}

/** The role an email holds now, after any change to members.json. */
export const roleOf = (email: string): string | null => members.get(email)?.role ?? null;

/** How a person is named to an Agent: "Ann Lee <a@x.com>, owner, X Ltd"; name, role, organization only when known. */
export const personLabel = (p: Person): string =>
  [p.name ? `${p.name} <${p.email}>` : p.email, p.role, p.organization].filter(Boolean).join(', ');

/** What an Agent calls a person: nickname, else first name, else name, else email. */
export const callName = (p: Person): string => p.nickname || p.first_name || p.name || p.email;

/** One person by email, with what the Lounge holds; null when not in the office. */
export const personByEmail = (email: string): Person | null => {
  const d = members.get(email.trim().toLowerCase());
  return d ? { email: email.trim().toLowerCase(), ...d } : null;
};

/** The office's whole list, for the brief's facts (docs/architecture/brief.md, The work record is the source of truth); empty self-hosted. */
export const officePeople = (): Person[] => hosted
  ? [...members].map(([email, details]) => ({ email, ...details }))
  : [];

/** Whether this Ronin is an office on an office park. */
export const isHostedOffice = (): boolean => hosted;
