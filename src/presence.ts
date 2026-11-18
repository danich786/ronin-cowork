/**
 * OFFICE PRESENCE — whether anyone is in the office (KAN-476), and in a hosted office who (KAN-478).
 *
 * `GET /api/health` carries `presence: { browsers, last_input_at, people, agents }`. `browsers` is the
 * number of connected /events sockets; `last_input_at` is when a person last did something: the
 * last non-GET /api request from a browser, or null since this process started. Agents' tools
 * reach the server on the operator socket and are not people, so they never stamp it. On an
 * office_park the kohai reads it every 30 s.
 *
 * `people` is one entry per email with a connected /events socket, `{ email, role, last_input_at }`,
 * the email being the guard's X-Forwarded-Email on the socket's upgrade and the role from
 * members.json (src/office-people.ts). Self-hosted, or with no header, it is []. In memory only:
 * no body, no keystrokes.
 *
 * `agents` is `{ live, archived }` (KAN-624): `live` the tmux sessions running an Agent now,
 * `archived` the archives still restorable (src/session-archive.ts, younger than ARCHIVE_DAYS).
 * Counted on each health call from tmux and the archive folder; self-hosted the same.
 *
 * Beside it, `machine: { swap_used_mb, mem_available_mb }`: the swap in use and MemAvailable,
 * whole MB, taken from the reading the
 * Services machine service already publishes once a minute (the held {t:'memory'}); null before
 * that reading exists, with watching off, or without Services. No read of its own.
 */
import type { IncomingMessage } from 'node:http';
import type express from 'express';
import type { WebSocket } from 'ws';
import { isOperatorPeer } from './operator-socket.js';
import { browserCount, heldMessage } from './ws/events.js';
import { person, roleOf } from './office-people.js';
import { listSessions } from './tmux.js';
import { expiredArchives, listArchives, type ArchivedSession } from './session-archive.js';

let lastInputAt: string | null = null;
const personInputAt = new Map<string, string>();
const sockets = new Map<WebSocket, string>();

export function stampInput(req: express.Request, _res: express.Response, next: express.NextFunction): void {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !isOperatorPeer(req)) {
    lastInputAt = new Date().toISOString();
    const who = person(req);
    if (who) personInputAt.set(who.email, lastInputAt);
  }
  next();
}

/** An /events socket: who opened it, from its upgrade request, until it closes. */
export function joinPresence(ws: WebSocket, req: IncomingMessage): void {
  const who = person(req);
  if (!who) return;
  sockets.set(ws, who.email);
  const drop = () => { sockets.delete(ws); };
  ws.on('close', drop);
  ws.on('error', drop);
}

/** `presence.agents`: Agents running now (tmux sessions with an Agent) and archives still restorable. */
export async function agentCounts(
  sessions: () => Promise<{ agent: string }[]> = listSessions,
  archives: () => Promise<ArchivedSession[]> = listArchives,
): Promise<{ live: number; archived: number }> {
  const [live, archived] = await Promise.all([sessions(), archives()]);
  const expired = new Set(expiredArchives(archived));
  return { live: live.filter((s) => s.agent).length, archived: archived.filter((a) => !expired.has(a)).length };
}

/** `machine.{swap_used_mb, mem_available_mb}`: from the Services machine reading held as {t:'memory'}, or null before it is there. */
export function machine(memory = heldMessage('memory')): { swap_used_mb: number | null; mem_available_mb: number | null } {
  const reading = memory?.reading as { swap?: { used_mb?: unknown }; mem?: { available_mb?: unknown } } | undefined;
  const used = reading?.swap?.used_mb;
  const available = reading?.mem?.available_mb;
  return {
    swap_used_mb: typeof used === 'number' ? used : null,
    mem_available_mb: typeof available === 'number' ? Math.round(available) : null,
  };
}

export const presence = () => ({
  browsers: browserCount(),
  last_input_at: lastInputAt,
  people: [...new Set(sockets.values())].map((email) => ({ email, role: roleOf(email), last_input_at: personInputAt.get(email) ?? null })),
});
