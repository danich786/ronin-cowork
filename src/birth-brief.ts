import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** The compiled brief's filename in each session folder: named for what it is, to whoever opens it. */
export const BIRTH_BRIEF = 'AGENT_BIRTH_BRIEF.md';

/**
 * THE ONE-READ BUDGET. A newborn is handed one path and reads it with its own CLI's file
 * tool, and every supported CLI caps what one read delivers: Codex ~10k tokens of shell
 * output, Claude Code 30,000 chars of shell output and 25,000 tokens per Read — and both
 * models open a file in a first window of about 250 lines. Measured 2026-09-04 (Codex
 * 0.151.0, Claude Code 2.1.260) after a 121 KB packet cost a session its instructions.
 * The compiled packet must fit the smallest of those, so one read is the whole packet;
 * `tests/session-boot.test.ts` holds the real stock shelf to it. Bytes are the hard cap.
 * Lines are the habit: the fullest stock birth compiles to ~350 lines with the Routine
 * contracts inside the first 250, and the ceiling stops the next shelf addition from
 * quietly pushing them out again.
 */
export const PACKET_BUDGET = { bytes: 30_000, lines: 380 } as const;

/** The packet's last line. A newborn that can quote it has seen the whole packet. */
export function packetEndLine(session: string): string {
  return `— end of packet for ${session} —`;
}

/** What the brief and the birth receipt say about a compiled packet. */
export interface PacketReport {
  path: string;
  bytes: number;
  lines: number;
  sections: number;
  terminator: string;
  over_budget: boolean;
}

export async function describePacket(briefPath: string, session: string): Promise<PacketReport> {
  const text = await readFile(briefPath, 'utf8');
  const bytes = Buffer.byteLength(text, 'utf8');
  const lines = text.split('\n').length;
  return {
    path: briefPath,
    bytes,
    lines,
    sections: (text.match(/^## /gm) ?? []).length,
    terminator: packetEndLine(session),
    over_budget: bytes > PACKET_BUDGET.bytes || lines > PACKET_BUDGET.lines,
  };
}

/**
 * THE READING PROTOCOL, in the brief. One sentence the newborn can verify: how long the
 * packet is, that one read delivers it, and the line it ends with. An over-budget packet
 * says so and asks for parts — the compiler has already warned the operator log.
 */
export function readFirstSentence(packet: PacketReport): string {
  const kb = Math.max(1, Math.round(packet.bytes / 1024));
  const head = `Read first: ${packet.path} — ${packet.lines} lines, ${kb} KB, ${packet.over_budget ? 'over the one-read budget: read it in parts, in order, until you reach' : 'one read; it ends with'} the line "${packet.terminator}".`;
  return `${head} Do not act before you have seen that line.`;
}

/** Write a generated brief (src/brief.ts) as the session's packet; warns when over the one-read budget. */
export async function writeBriefPacketAt(dir: string, text: string, session: string): Promise<string> {
  const size = { bytes: Buffer.byteLength(text, 'utf8'), lines: text.split('\n').length };
  if (size.bytes > PACKET_BUDGET.bytes || size.lines > PACKET_BUDGET.lines) {
    console.warn(`[birth] ${session}: the brief is ${size.bytes} bytes / ${size.lines} lines, over the one-read budget of ${PACKET_BUDGET.bytes} / ${PACKET_BUDGET.lines}; a single read will not deliver it whole.`);
  }
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, BIRTH_BRIEF);
  const temp = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, text, 'utf8');
  await rename(temp, target);
  return target;
}
