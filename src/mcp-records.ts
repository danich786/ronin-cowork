/**
 * THE MCP SERVER RECORDS, as the brief reads them (docs/architecture/integrations.md, The MCP
 * server record; Who has it; What Agents are told). One file per server in the owner's store,
 * `~/ronin/catalogs/integrations/<name>.md`, written by `mcp add` (the Services part `mcp`). A
 * record with a `reach:` is an MCP server. The brief reads only the name, the description and
 * the Campaigns it is offered to; it never calls a server.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { entryValue, isKeyLine, storeDir } from './resources.js';

export interface McpRecord { name: string; label: string; description: string; campaigns: string[] }

const NAME = /^[a-z0-9][a-z0-9-]*$/;

export const mcpRecordsDir = (): string => path.join(storeDir('catalogs'), 'integrations');

export function parseMcpRecord(name: string, text: string): McpRecord | null {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const header = lines.filter(isKeyLine);
  if (!entryValue(header, 'reach')) return null;
  const label = /^#\s+(.+?)\s*$/m.exec(text)?.[1] ?? name;
  return {
    name,
    label,
    description: entryValue(header, 'description') || label,
    campaigns: entryValue(header, 'campaigns').split(',').map((one) => one.trim()).filter(Boolean),
  };
}

/** Every MCP server record in the owner's store, by name. */
export async function readMcpRecords(): Promise<McpRecord[]> {
  const files = await readdir(mcpRecordsDir()).catch(() => [] as string[]);
  const rows = await Promise.all(files.filter((file) => file.endsWith('.md') && NAME.test(file.slice(0, -3))).map(async (file) =>
    parseMcpRecord(file.slice(0, -3), await readFile(path.join(mcpRecordsDir(), file), 'utf8').catch(() => ''))));
  return rows.filter((row): row is McpRecord => !!row).sort((a, b) => a.name.localeCompare(b.name));
}

/** Offered is on: blank `campaigns:` is every Campaign. */
export const offeredTo = (record: McpRecord, campaign: string): boolean =>
  !record.campaigns.length || record.campaigns.includes(campaign);
