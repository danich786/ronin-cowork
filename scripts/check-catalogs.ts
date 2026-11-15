import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STOCK_DIR } from '../src/resources.js';
import { CATALOG_KINDS, parseCatalogFile, type CatalogFile } from '../src/catalog.js';
import {
  findDefinition,
  listAgentTemplates,
  listInstallations,
  listTeamTemplates,
  type DefinitionKind,
  type TemplateBox,
} from '../src/resource-adapters.js';
import { listDeskProfiles } from '../src/desk-profiles.js';
import { listLexicons } from '../src/lexicon-catalog.js';
import { parseProviderCatalog, STOCK_CATALOG_MD } from '../src/model-providers.js';
import { SHIPPED_MODEL_INFO, type ModelInfoFile } from '../src/model-info.js';
import { AGENTS } from '../src/agents.js';
import { readAgentLaunches, renderLaunch } from '../src/agent-launches.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
let warns = 0;
const fail = (msg: string) => {
  console.error(`  FAIL  ${msg}`);
  fails++;
};
const warn = (msg: string) => {
  console.warn(`  warn  ${msg}`);
  warns++;
};

/** THE BRIEF CATALOG (docs/architecture/brief.md, The files and their header): every stock fact,
 * behaviour and tool file parses, ids are one namespace, and serves:/with: name real behaviours. */
async function stockCatalog(): Promise<CatalogFile[]> {
  const files: CatalogFile[] = [];
  for (const kind of CATALOG_KINDS) {
    const dir = path.join(STOCK_DIR, kind);
    for (const entry of (await readdir(dir)).filter((f) => f.endsWith('.md') && f !== 'README.md').sort()) {
      const file = path.join(dir, entry);
      const text = await readFile(file, 'utf8');
      const name = entry.replace(/\.md$/, '');
      const row = parseCatalogFile(kind, name, text);
      const at = `${kind}/${entry}`;
      if (!/^\s*#\s+\S/.test(text)) fail(`${at}: starts with no \`# Title\``);
      if (kind === 'facts' && !row.line && !row.body) fail(`${at}: a fact with no \`line:\` and no text`);
      if (kind !== 'facts' && !row.seed) fail(`${at}: no \`seed:\` — the one line an Agent is told`);
      files.push({ ...row, file, origin: 'stock', shadowed: false });
    }
  }
  const byName = new Map<string, CatalogFile>();
  for (const row of files) {
    const was = byName.get(row.name);
    if (was) fail(`${row.kind}/${row.name}.md: id "${row.name}" is also ${was.kind}/${row.name}.md — ids are one namespace`);
    else byName.set(row.name, row);
  }
  const behaviour = (name: string) => byName.get(name)?.kind === 'behaviours';
  for (const row of files) {
    for (const name of row.serves) if (!behaviour(name)) fail(`${row.kind}/${row.name}.md: serves "${name}", which is no behaviour file`);
    for (const name of row.with) if (!behaviour(name)) fail(`${row.kind}/${row.name}.md: with "${name}", which is no behaviour file`);
  }
  return files;
}

async function deadLinks(file: string): Promise<void> {
  const raw = await readFile(path.join(STOCK_DIR, file), 'utf8');
  const re = /(?:^|[\s(`])((?:docs|reading-list|co-working|ronin_catalogs|ronin_library|hostside|scripts|bin)\/[A-Za-z0-9_./-]*[A-Za-z0-9_-])/gm;
  const seen = new Set<string>();
  for (const m of raw.matchAll(re)) {
    const p = m[1];
    if (seen.has(p)) continue;
    seen.add(p);
    try {
      await stat(path.join(REPO, p));
    } catch {
      warn(`${file}: names ${p} — not in this install`);
    }
  }
}

async function surfacingDefinitions(
  kind: DefinitionKind,
  served: () => Promise<{ name: string }[]>,
): Promise<void> {
  let files: string[] = [];
  try {
    files = await readdir(path.join(STOCK_DIR, kind));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  const want = files
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((f) => f.replace(/\.md$/, ''));
  const got = new Set((await served()).map((e) => e.name));
  for (const name of want) {
    if (!got.has(name)) {
      fail(
        `${kind}/${name}.md: does not surface from its reader — ` +
          `malformed (no \`- **key:** value\` lines), or hidden by a user file on this box`,
      );
    }
  }
}

async function templateBoxResolves(
  at: string,
  box: TemplateBox,
  behaviours: Set<string>,
): Promise<void> {
  if (!box.blurb.trim()) fail(`${at}: missing blurb`);
  if (!box.art.trim()) fail(`${at}: missing art`);
  if (!box.kinds.length) fail(`${at}: names no valid kinds — nothing brings it forward`);
  for (const name of box.behaviours) if (!behaviours.has(name)) fail(`${at}: behaviour "${name}" is no behaviour file`);
}

async function templatesResolve(behaviours: Set<string>): Promise<void> {
  const DEAD = ['lead_brief', 'lead_mandate'];
  for (const template of (await listAgentTemplates()).filter((x) => x.origin === 'stock')) {
    const at = `templates/agents/${template.name}.md`;
    await templateBoxResolves(at, template, behaviours);
    const def = await findDefinition('templates/agents', template.name);
    if (def?.has('mandate') && !template.mandate) fail(`${at}: mandate is not \`reach · recruit · output\``);
    if (!template.brief.trim()) fail(`${at}: an agent template seeds a brief`);
    for (const key of ['objective', ...DEAD]) {
      if (def?.has(key)) fail(`${at}: \`${key}:\` is a team answer — it does not belong on the agent shelf`);
    }
  }
  for (const template of (await listTeamTemplates()).filter((x) => x.origin === 'stock')) {
    const at = `templates/teams/${template.name}.md`;
    await templateBoxResolves(at, template, behaviours);
    const def = await findDefinition('templates/teams', template.name);
    if (!template.objective.trim()) fail(`${at}: a team template states its objective`);
    for (const key of ['brief', 'team_mode', ...DEAD]) {
      if (def?.has(key)) fail(`${at}: \`${key}:\` does not belong on the team shelf`);
    }
    if (template.agents.length < 2) fail(`${at}: a cast is several agents — ${template.agents.length} row(s) found`);
    if (template.agents.filter((row) => row.team_lead).length !== 1) {
      fail(`${at}: exactly one cast row is marked \`team_lead: yes\``);
    }
    const seen = new Set<string>();
    for (const row of template.agents) {
      if (seen.has(row.name)) fail(`${at}: two cast rows are both called "${row.name}"`);
      seen.add(row.name);
      if (!row.instructions.trim()) fail(`${at}: cast row "${row.name}" has no instructions`);
    }
  }
}

const FILES = ['PROJECT_ROOTS.md', 'MODEL_PROVIDERS.md'];

await surfacingDefinitions('desk_profiles', listDeskProfiles);
await surfacingDefinitions('lexicons', listLexicons);
await surfacingDefinitions('services', listInstallations);
const briefCatalog = await stockCatalog();
await surfacingDefinitions('templates/agents', listAgentTemplates);
await surfacingDefinitions('templates/teams', listTeamTemplates);
await templatesResolve(new Set(briefCatalog.filter((row) => row.kind === 'behaviours').map((row) => row.name)));

// The SHIPPED file, explicitly: `readProviderCatalog()` lays the owner's copy over it, and a
// verify that judged the owner's sections would guard the wrong file on a box with a copy.
const stockCatalogRaw = await readFile(STOCK_CATALOG_MD, 'utf8');
const catalog = parseProviderCatalog(stockCatalogRaw);
if (catalog.length === 0) fail('MODEL_PROVIDERS.md: the provider catalog yields no providers');
{
  const shipped = JSON.parse(await readFile(SHIPPED_MODEL_INFO, 'utf8')) as ModelInfoFile;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(shipped.fetched_at ?? '')) fail('MODEL_INFO.json: the shipped snapshot carries no fetched_at');
  const providers = new Set<string>();
  const clis = new Set<string>();
  for (const entry of catalog) {
    const at = `MODEL_PROVIDERS.md: ${entry.label}`;
    if (providers.has(entry.provider)) fail(`${at}: provider id "${entry.provider}" is used by two sections`);
    providers.add(entry.provider);
    if (entry.models_dev && !shipped.providers?.[entry.models_dev]) fail(`${at}: models_dev "${entry.models_dev}" is not in the shipped MODEL_INFO.json`);
    // A coming-soon section is display inventory, not a launch promise.
    if (!entry.launchable) continue;
    if (clis.has(entry.cli)) fail(`${at}: cli "${entry.cli}" is served by two sections`);
    clis.add(entry.cli);
    const agent = AGENTS.find((row) => row.id === entry.cli);
    if (!agent) { fail(`${at}: cli "${entry.cli}" is not in src/agents.ts`); continue; }
    let launches;
    try { launches = await readAgentLaunches(entry.cli); }
    catch (error) { fail(`${at}: ${(error as Error).message}`); continue; }
    if (launches.native[0] !== agent.cmd) fail(`${at}: Native does not start with the registered CLI "${agent.cmd}"`);
    const argv = renderLaunch(launches.model, { provider: entry.provider, model: 'probe-model' });
    if (argv[0] !== agent.cmd) fail(`${at}: Model launch does not start with the ${entry.cli} CLI "${agent.cmd}"`);
    if (!argv.includes('probe-model')) fail(`${at}: Model launch does not name the model it is given`);
  }
}

for (const f of FILES) await deadLinks(f);

if (fails) {
  console.error(`check-catalogs: ${fails} failure(s), ${warns} dead link(s)`);
  process.exit(1);
}
console.log(`check-catalogs: ok — every stock entry surfaces${warns ? `; ${warns} dead link(s) awaiting ronin_library material` : ''}`);
