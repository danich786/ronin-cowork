/**
 * THE ONE BRIEF ROUTE (KAN-605; docs/architecture/brief.md, The work record is the source of truth).
 * The work record's `brief` document is the session's only authority. `buildBrief` is a pure
 * function of it plus the catalogs. The Configuration edits the document and calls the same builder.
 * Live layers, receipts, snapshots and dynamic work-record keys are never read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const isolated = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-brief-route-'));
process.env.RONIN_DATA_ROOT = path.join(isolated, 'data');
process.env.RONIN_USER_ROOT = path.join(isolated, 'user');
process.env.HOME = path.join(isolated, 'home');
process.env.RONIN_SESSION_DIR = path.join(isolated, 'sessions');
delete process.env.RONIN_SOCKET;
delete process.env.TMUX;
process.env.TMUX_TMPDIR = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-brief-route-tmux-'));

const { buildBrief } = await import('../src/brief-build.js');
const { configureBrief, editBrief, projectManagementOn } = await import('../src/agent-configuration.js');
const { readCatalogs } = await import('../src/catalog.js');
const { userBriefFile } = await import('../src/brief-settings.js');
const { readBriefRecord, writeObjective } = await import('../src/tegami.js');
const { storeDir } = await import('../src/resources.js');
const { sessionDir } = await import('../src/session-dir.js');
const { AGENT_BRIEF } = await import('../src/birth-brief.js');
const { briefDoc, seedBriefDoc } = await import('./helpers/brief-doc.js');

const src = (file: string) => fs.readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
const queued = async (name: string): Promise<string[]> => {
  const dir = storeDir('message_queue');
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  const rows = await Promise.all(files.map(async (f) => JSON.parse(await fs.readFile(path.join(dir, f), 'utf8')) as { target: string; text: string }));
  return rows.filter((row) => row.target === name).map((row) => row.text);
};

test('the builder is pure: the same document and catalogs give the same brief, synchronously', async () => {
  const catalog = await readCatalogs();
  const doc = briefDoc('pure', { pm: true });
  const one = buildBrief(doc, catalog);
  assert.ok(!(one instanceof Promise), 'no I/O: it returns the brief, not a promise');
  assert.equal(buildBrief(structuredClone(doc), catalog).text, one.text);
  assert.equal(one.doc.setting.pm, true, 'pm worked out from the layers on the document');
  assert.ok(one.resolved.behaviours.some((row) => row.name === 'project-management'));
  assert.equal(buildBrief(briefDoc('pure'), catalog).doc.setting.pm, false);
});

test('Configuration edits the document and renders through the same builder; live layers are never read', async () => {
  const name = 'route_agent';
  const born = briefDoc(name);
  await seedBriefDoc(born);
  // A default changed since birth: the user layer now turns project management on.
  await fs.mkdir(path.dirname(userBriefFile()), { recursive: true });
  await fs.writeFile(userBriefFile(), JSON.stringify({ pm: true, brief: { add: [{ name: 'syncthing', depth: 'full' }] } }));

  const edit = { mandate: { reach: 'plan', recruit: 'nobody', output: ['code'] } };
  const result = await configureBrief(name, edit);
  const after = await readBriefRecord(name);
  assert.equal(after.agent.reach, 'plan', 'the edit is on the document');
  assert.equal(after.setting.pm, false, 'the changed default did not reach the live Agent');
  assert.equal(after.brief_settings.user?.pm, undefined, 'the user layer is the one written at birth');
  const expected = buildBrief(editBrief(born, edit), await readCatalogs());
  assert.equal(await fs.readFile(path.join(sessionDir(name), AGENT_BRIEF), 'utf8'), expected.text, 'the brief is the builder over the edited document');
  assert.equal(result.sent, true);
  const told = await queued(name);
  assert.equal(told.length, 1, 'one message: the difference');
  assert.match(told[0], /Your brief changed/);
  assert.doesNotMatch(told[0], /Syncthing/, 'nothing from the live layers');

  // The same Send again: nothing differs, nothing is sent.
  assert.equal((await configureBrief(name, edit)).sent, false);
  assert.equal((await queued(name)).length, 1);
});

test('dynamic work-record fields never touch the brief document', async () => {
  const name = 'dynamic_agent';
  await seedBriefDoc(briefDoc(name, { pm: true }));
  const before = await readBriefRecord(name);
  await writeObjective(name, 'A new objective', 'owner');
  assert.deepEqual(await readBriefRecord(name), before);
  await assert.rejects(fs.readFile(path.join(sessionDir(name), AGENT_BRIEF), 'utf8'), 'no rebuild on the objective');
  assert.equal(await projectManagementOn(name), true, 'project management is read from the document');
  assert.equal(await projectManagementOn('nobody_here'), false);
});

test('one route: only birth and configureBrief write the document; only the builder renders', async () => {
  const files = ['agent-configuration.ts', 'agent-composition.ts', 'routes/launch.ts', 'routes/sessions-api.ts', 'routes/brief-api.ts', 'spawn.ts', 'commands/desk.ts', 'work-items.ts', 'tegami.ts', 'brief-build.ts'];
  const text = Object.fromEntries(await Promise.all(files.map(async (f) => [f, await src(f)])));
  for (const [file, body] of Object.entries(text)) {
    assert.doesNotMatch(body, /brief-told\.json|composition-brief\.json|composition-role\.json|currentBrief|configuredBrief|refreshBrief|briefSnapshot/, `${file}: no reconstruction or snapshot path`);
    if (file !== 'brief-build.ts') assert.doesNotMatch(body, /\b(renderBrief|resolveBrief)\(/, `${file}: renders only through buildBrief`);
  }
  const writers = Object.entries(text).filter(([, body]) => /writeBriefRecord\(/.test(body)).map(([file]) => file).sort();
  assert.deepEqual(writers, ['agent-configuration.ts', 'routes/launch.ts', 'tegami.ts']);
  const configuration = text['agent-configuration.ts'];
  const route = configuration.slice(configuration.indexOf('export async function configureBrief'), configuration.indexOf('type ConfigurationUpdate'));
  assert.doesNotMatch(route, /readUserLayer|campaignLayer|briefLayers|readCampaign|birth-receipt|getTags|getLeads|listSessions/, 'configureBrief reads no live layer, receipt or tag');
});
