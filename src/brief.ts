/**
 * THE BRIEF (wip/BRIEF_MODEL.md §7): one packet, generated top to bottom from the brief record
 * and the catalog files. Facts; the behaviours in play, each at its depth with its tools under
 * it; Other tools; the one `--help` line; the end line. Nothing else is in it.
 */
import { recordValue, type BriefRecord } from './brief-record.js';
import type { InPlay, Resolved } from './brief-settings.js';

import { packetEndLine as briefEndLine } from './birth-brief.js';
export const HELP_LINE = 'Every tool is a command on your PATH; `<tool> --help` gives its syntax.';

/**
 * A fact's `line:` with the record's values. `{a.b}` is the value; `{, a.b}` prints its lead
 * text only when the value is set; `{a.b?yes|no}` prints one text or the other.
 */
export function fillLine(line: string, record: BriefRecord): string {
  let placeholders = 0, filled = 0;
  const text = line.replace(/\{([^{}]*)\}/g, (_all, inner: string) => {
    const choice = /^([a-z_]+(?:\.[a-z_]+)*)\?([^|]*)\|?(.*)$/.exec(inner);
    if (choice) { placeholders++; filled++; return recordValue(record, choice[1]) ? choice[2] : choice[3]; }
    const m = /^(.*?)([a-z_]+(?:\.[a-z_]+)*)$/s.exec(inner);
    if (!m) return `{${inner}}`;
    const value = recordValue(record, m[2]);
    placeholders++;
    if (value) filled++;
    return value ? `${m[1]}${value}` : '';
  }).trim();
  return placeholders && !filled ? '' : text;
}

const strip = (text: string): string => text.replace(/<!--[^]*?-->/g, '').trim();
/** A file's own headings sit under the brief's `###`: each goes down two levels (at most six). */
const nested = (text: string): string => strip(text).replace(/^(#{1,6})(?=\s)/gm, (marks) => '#'.repeat(Math.min(6, marks.length + 2)));

function factLines(row: InPlay, record: BriefRecord): string[] {
  const raw = strip(row.file.body);
  const body = raw.split('\n').map((line) => /\{[^{}]*\}/.test(line) ? fillLine(line, record) : line).join('\n').trim();
  const hasBody = !!body && !!strip(body.replace(/^#+.*$/gm, ''));
  if (row.file.line) {
    const line = fillLine(row.file.line, record);
    if (!line) return [];
    return hasBody ? [`- ${line}`, '', body, ''] : [`- ${line}`];
  }
  return hasBody ? ['', `### ${row.title}`, body, ''] : [];
}

const toolLine = (row: InPlay): string => `- \`${row.title}\`${row.file.seed ? `: ${row.file.seed}` : ''}`;

function toolLines(row: InPlay): string[] {
  if (row.depth !== 'full') return [toolLine(row)];
  return [toolLine(row), '', nested(row.file.body), ''];
}

/** The seed of a behaviour: its one line, and where to read the rest. */
const seedText = (row: InPlay): string =>
  `${row.file.seed ? `${row.file.seed} ` : ''}More: \`ronin-help ${row.name}\`.`;

export function renderBrief(name: string, record: BriefRecord, resolved: Resolved): string {
  const out: string[] = [`# Brief — ${name}`, ''];
  if (resolved.facts.length) {
    out.push('## Facts');
    for (const row of resolved.facts) out.push(...factLines(row, record));
    out.push('');
  }
  if (resolved.behaviours.length) {
    out.push('## Behaviours', '');
    for (const row of resolved.behaviours) {
      out.push(`### ${row.title}`, row.depth === 'full' ? nested(row.file.body) : seedText(row));
      if (row.tools.length) out.push('Tools:', ...row.tools.flatMap(toolLines));
      out.push('');
    }
  }
  if (resolved.other.length) out.push('## Other tools', ...resolved.other.flatMap(toolLines), '');
  out.push(HELP_LINE, '', briefEndLine(name), '');
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** What an Agent was last told, kept beside its packet so an update sends only the difference. */
export interface BriefSnapshot {
  facts: Record<string, string>;
  told: Record<string, { kind: string; depth: string; title: string }>;
}

const toldRows = (r: Resolved): InPlay[] => [...r.behaviours.flatMap((row) => [row, ...row.tools]), ...r.other];

export function briefSnapshot(resolved: Resolved, record: BriefRecord): BriefSnapshot {
  return {
    facts: Object.fromEntries(resolved.facts.map((row) => [row.name, factLines(row, record).join('\n').trim()])),
    told: Object.fromEntries(toldRows(resolved).map((row) => [row.name, { kind: row.kind, depth: row.depth, title: row.title }])),
  };
}

/**
 * WHAT CHANGED since the snapshot, for an update (§7): the facts that changed, and the
 * behaviours and tools that came into play (at their depth) or left it. '' when nothing did.
 */
export function briefChanges(before: BriefSnapshot, resolved: Resolved, record: BriefRecord): string {
  const after = briefSnapshot(resolved, record);
  const lines: string[] = [];
  const facts = Object.entries(after.facts).filter(([name, text]) => text && before.facts[name] !== text).map(([, text]) => text);
  if (facts.length) lines.push(...facts, '');
  for (const row of toldRows(resolved)) {
    const was = before.told[row.name];
    if (was && was.depth === row.depth) continue;
    if (row.kind === 'tools') lines.push(...toolLines(row));
    else lines.push(`### ${row.title}`, row.depth === 'full' ? nested(row.file.body) : seedText(row), '');
  }
  const left = Object.keys(before.told).filter((name) => !after.told[name]);
  if (left.length) lines.push(`No longer in your brief: ${left.map((name) => before.told[name].title).join(', ')}.`);
  return lines.join('\n').trim();
}
