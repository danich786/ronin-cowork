/**
 * "GIVE ME ANTHROPIC" — a launch may name a provider without naming a model.
 *
 * Owner's ruling, 2026-08-29: *"if you start a session and you say, give me Anthropic,
 * but our default is OpenAI, it will give you Anthropic's default model."* Before this
 * there was no such thing as a provider's default. The install had exactly one default,
 * `agents.sessions.default`, which names a provider AND a model together — so a launch
 * could name a MODEL (and get its provider by implication) or a whole COMMAND, but had
 * no way to say "whichever model I prefer from this vendor". Naming the vendor meant
 * naming one of its models, which is the thing the owner did not want to have to know.
 *
 * So ⚙ Configuration grows one row per provider the launch table carries, landing at
 * `agents.sessions.by_provider.<provider>`, and `resolveForm` reads it for a launch that
 * names a provider and no model. This file is that path, end to end.
 *
 * The shipped provider catalog is used deliberately (`ronin_catalogs/MODEL_PROVIDERS.md`):
 * "anthropic's default row" has to mean the real catalog, or the fallback is untested.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-provider-test-'));
const listed = (ids: string[]) => ({ read_at: '2026-09-18T00:00:00Z', by: 'test', rows: ids.map((id) => ({ id, name: id })) });
const providers = { measured_at: '2026-09-18T00:00:00Z', installed: ['claude', 'codex'], signed_in: ['claude', 'codex'], operational: ['claude', 'codex'], activated_count: 2, paths: {}, versions: {}, latest: {}, off: [], refreshed_at: '', models: {
  claude: listed(['claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5', 'claude-haiku-4-5-20251001']),
  codex: listed(['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5']),
} };
const catalogs = path.join(temp, 'catalogs');
await fs.mkdir(catalogs, { recursive: true });
await fs.writeFile(
  path.join(catalogs, 'PROJECT_ROOTS.md'),
  ['# PROJECT_ROOTS — yours', '', '## alpha', `- **dir:** ${temp}`, '- **remit:** the only root', ''].join('\n'),
);
process.env.RONIN_CATALOGS_DIR = catalogs;
process.env.RONIN_SESSION_BOOT_DIR = path.join(temp, 'shelf');
process.env.RONIN_SESSION_BOOT_CACHE_DIR = path.join(temp, 'generated');
process.env.RONIN_CONFIG_DIR = path.join(temp, 'config');
process.env.RONIN_LEDGER_DIR = path.join(temp, 'ledger');
process.env.RONIN_TEAM_ROSTERS_DIR = path.join(temp, 'team_rosters');
await fs.mkdir(path.join(temp, 'config'), { recursive: true });

/** The whole `agents` section as the owner's file would hold it, and, when given, the setup section beside it. */
async function agents(sessions: Record<string, unknown>, setup?: Record<string, unknown>): Promise<void> {
  await fs.writeFile(path.join(temp, 'config', 'machine_settings.json'), JSON.stringify({ agents: { sessions }, campaigns: { home_machine: { title: 'Ronin Home', state: 'active', providers, config: {} } }, ...(setup ? { setup } : {}) }));
}

const { resolveForm } = await import('../src/spawn.js');
type SpawnForm = import('../src/spawn.js').SpawnForm;

const launch = (over: Partial<SpawnForm> = {}): SpawnForm => ({
  project_root: 'alpha',
  prompt: 'Cut the leg in the plan doc.',
  ...over,
});

test('the three ways an agent may ask, against one configuration', async () => {
  // Owner, 2026-08-29 — the agent-facing door has exactly three entry points, and the
  // first is saying nothing. An agent must pass only as much as the owner actually said;
  // inventing the next field down is the agent deciding something left open. Each case is
  // proven on its own below — this states them together, because the CONTRACT is that
  // they are three answers to one question and it is the shape that must not drift.
  await agents({
    default: { provider: 'openai', model: 'gpt-5.6-sol' },
    by_provider: { anthropic: 'claude-fable-5-1', openai: 'gpt-5.6-terra' },
  });
  //  "give me an agent to do XYZ"  -> the install default, vendor and model both
  const lazy = await resolveForm(launch(), new Set());
  assert.ok(lazy.cmd.startsWith('codex --model gpt-5.6-sol'), `lazy: got "${lazy.cmd}"`);
  //  "give me an Anthropic agent"  -> that vendor's preferred model
  const vendor = await resolveForm(launch({ provider: 'anthropic' }), new Set());
  assert.ok(vendor.cmd.startsWith('claude --model claude-fable-5-1'), `vendor: got "${vendor.cmd}"`);
  //  "open a fable five session"   -> that model
  const named = await resolveForm(launch({ model: 'claude-opus-5' }), new Set());
  assert.ok(named.cmd.startsWith('claude --model claude-opus-5'), `named: got "${named.cmd}"`);
  // Three different commands from three different asks — if any two of these ever agree,
  // one layer has started answering a question it was not asked.
  assert.equal(new Set([lazy.cmd, vendor.cmd, named.cmd]).size, 3);
});

test('Models > Defaults: a Team lead takes the lead model, an Agent the Agent model, and a Desk pair no longer outranks them', async () => {
  // Owner, 2026-10-21: one record (agents.sessions) says what Default means; `lead` is the
  // Team lead's, blank = the Agent's. A Desk pair left in a Campaign is not read at launch.
  await agents({
    default: { provider: 'openai', model: 'gpt-5.6-sol' },
    lead: { provider: 'anthropic', model: 'claude-opus-5' },
    by_provider: { anthropic: 'claude-fable-5-1', openai: 'gpt-5.6-terra' },
  });
  const file = path.join(temp, 'config', 'machine_settings.json');
  const document = JSON.parse(await fs.readFile(file, 'utf8'));
  document.campaigns = { work: { title: 'Work', providers, config: { defaults: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' } } } };
  await fs.writeFile(file, JSON.stringify(document));
  const agent = await resolveForm(launch({ campaign_id: 'work' }), new Set());
  assert.ok(agent.cmd.startsWith('codex --model gpt-5.6-sol'), agent.cmd);
  const lead = await resolveForm(launch({ campaign_id: 'work', team: 'crew', team_lead: true }), new Set());
  assert.ok(lead.cmd.startsWith('claude --model claude-opus-5'), lead.cmd);
  const member = await resolveForm(launch({ campaign_id: 'work', team: 'crew' }), new Set());
  assert.ok(member.cmd.startsWith('codex --model gpt-5.6-sol'), member.cmd);
  const explicit = await resolveForm(launch({ campaign_id: 'work', team: 'crew', team_lead: true, model: 'gpt-5.6-terra' }), new Set());
  assert.ok(explicit.cmd.startsWith('codex --model gpt-5.6-terra'), explicit.cmd);
  // No lead model set: the lead gets the Agent model.
  await agents({ default: { provider: 'openai', model: 'gpt-5.6-sol' } });
  const unset = await resolveForm(launch({ team: 'crew', team_lead: true }), new Set());
  assert.ok(unset.cmd.startsWith('codex --model gpt-5.6-sol'), unset.cmd);
});

test('a Desk pair saved before Models > Defaults moves to agents.sessions.default once, and leaves the Desk', async () => {
  const { moveDeskModelDefault } = await import('../src/campaign-scope.js');
  await agents({ default: { provider: 'openai', model: 'gpt-5.6-sol' }, lead: { provider: 'openai', model: 'gpt-5.5' } });
  const file = path.join(temp, 'config', 'machine_settings.json');
  const document = JSON.parse(await fs.readFile(file, 'utf8'));
  document.campaigns.home_machine.config = { defaults: { provider: 'anthropic', model: 'claude-opus-5', reach: 'execute' } };
  await fs.writeFile(file, JSON.stringify(document));
  assert.equal(await moveDeskModelDefault(), 'home_machine');
  const after = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.deepEqual(after.agents.sessions.default, { provider: 'anthropic', model: 'claude-opus-5' }, 'the pair that was in force');
  assert.deepEqual(after.agents.sessions.lead, { provider: 'openai', model: 'gpt-5.5' }, 'the rest of the record stays');
  assert.equal(after.campaigns.home_machine.config.defaults.model, '', 'cleared on the Desk');
  assert.equal(after.campaigns.home_machine.config.defaults.reach, 'execute', 'the Desk keeps its other defaults');
  assert.equal(await moveDeskModelDefault(), '', 'once');
});

test("the owner's scenario: default is OpenAI, the launch says anthropic, and it gets anthropic's preferred model", async () => {
  await agents({
    default: { provider: 'openai', model: 'gpt-5.6-sol' },
    by_provider: { anthropic: 'claude-fable-5-1', openai: 'gpt-5.6-terra' },
  });
  const r = await resolveForm(launch({ provider: 'anthropic' }), new Set());
  assert.ok(r.cmd.startsWith('claude --model claude-fable-5-1'), `expected anthropic's preference, got "${r.cmd}"`);
  // The install default is NOT what answered — that is the whole point of the ruling.
  assert.doesNotMatch(r.cmd, /codex|gpt-5\.6-sol/, 'naming a provider must beat the install default');
  // And it is attributed to the owner's configuration, not to this file's fallbacks:
  // the provider was the launch's word, the model was ⚙'s.
  assert.deepEqual(r.stated_by.cmd, [{ layer: 'system', source: '⚙ Configuration (agents.sessions)' }]);
});

test('a saved CLI model name passes through unchanged', async () => {
  await agents({ default: { provider: 'openai', model: 'gpt-5.6-sol' }, by_provider: { anthropic: 'fable' } });
  const r = await resolveForm(launch({ provider: 'anthropic' }), new Set());
  assert.ok(r.cmd.startsWith('claude --model fable'), r.cmd);
});

test('a provider with no preference set delegates the model to that provider CLI', async () => {
  await agents({ default: { provider: 'openai', model: 'gpt-5.6-terra' }, by_provider: {} });
  // Native is what makes the setting optional without Ronin guessing account entitlement.
  const r = await resolveForm(launch({ provider: 'anthropic' }), new Set());
  assert.equal(r.cmd, 'claude', `expected the provider-native launch, got "${r.cmd}"`);
  // Nobody stated the model, so it reads as the system's answer, not the owner's.
  assert.deepEqual(r.stated_by.cmd, [{ layer: 'system', source: 'src/spawn.ts' }]);
  // An explicit null is the same as absent: the owner cleared the row, they did not
  // express a preference.
  await agents({ default: { provider: 'openai', model: 'gpt-5.6-terra' }, by_provider: { anthropic: null } });
  const cleared = await resolveForm(launch({ provider: 'anthropic' }), new Set());
  assert.equal(cleared.cmd, 'claude', `cleared must fall back too, got "${cleared.cmd}"`);
});

test('naming no provider still lands on the install default — the general default is untouched', async () => {
  await agents({
    default: { provider: 'openai', model: 'gpt-5.6-sol' },
    by_provider: { anthropic: 'claude-fable-5-1', openai: 'gpt-5.6-terra' },
  });
  const r = await resolveForm(launch(), new Set());
  // NOT openai's per-provider preference (`gpt-5.6-terra`): a launch that named nothing
  // gets the one general default, exactly as before. The per-provider map answers a
  // question this launch did not ask.
  assert.ok(r.cmd.startsWith('codex --model gpt-5.6-sol'), `expected the general default, got "${r.cmd}"`);
});

test('a provider narrows an explicit model rather than competing with it', async () => {
  await agents({ default: { provider: 'openai', model: 'gpt-5.6-sol' }, by_provider: { anthropic: 'claude-fable-5-1' } });
  // Both named: the model is passed unchanged to the named provider.
  const r = await resolveForm(launch({ provider: 'anthropic', model: 'claude-haiku-4-5-20251001' }), new Set());
  assert.ok(r.cmd.startsWith('claude --model claude-haiku-4-5-20251001'), `expected the named pair, got "${r.cmd}"`);
  assert.deepEqual(r.stated_by.cmd, [{ layer: 'launch', source: 'launch request' }]);
  const unlisted = await resolveForm(launch({ provider: 'anthropic', model: 'future-claude-name' }), new Set());
  assert.ok(unlisted.cmd.startsWith('claude --model future-claude-name'), unlisted.cmd);
});

test('an unknown provider is refused by name, and a provider beside a cmd is a contradiction', async () => {
  await agents({ default: { provider: 'openai', model: 'gpt-5.6-sol' }, by_provider: {} });
  await assert.rejects(
    () => resolveForm(launch({ provider: 'mistral' }), new Set()),
    (e: Error) => /Unknown provider "mistral"/.test(e.message) && /anthropic/.test(e.message),
  );
  // A cmd already says whose CLI it runs, so naming a provider too is somebody asserting
  // two answers — refused rather than ranked, exactly as `model` + `cmd` is.
  await assert.rejects(
    () => resolveForm(launch({ provider: 'anthropic', cmd: 'codex --model gpt-5.6-sol' }), new Set()),
    /provider OR a cmd/,
  );
});

test('a provider the owner turned off launches nothing new, in its own words; one never activated still launches into its own sign-in', async () => {
  await agents({ default: { provider: 'openai', model: 'gpt-5.6-sol' }, by_provider: {} }, { providers: { codex: { activated_at: '2026-09-05T00:00:00.000Z', off_at: '2026-09-09T10:00:00.000Z' } } });
  await assert.rejects(
    () => resolveForm(launch({ provider: 'openai', model: 'gpt-5.6-terra' }), new Set()),
    (e: Error) => /Codex is turned off on this machine/.test(e.message) && /your sign-in is kept/.test(e.message) && !/Unknown model/.test(e.message),
  );
  await assert.rejects(() => resolveForm(launch(), new Set()), /turned off/, 'the install default rides the same refusal when its provider is off');
  // Never activated is not off: no off_at, nothing recorded, no file — it launches, and the CLI asks to sign in in the tile.
  await agents({ default: { provider: 'openai', model: 'gpt-5.6-sol' }, by_provider: {} }, { providers: {} });
  const r = await resolveForm(launch({ provider: 'anthropic', model: 'claude-haiku-4-5-20251001' }), new Set());
  assert.ok(r.cmd.startsWith('claude --model claude-haiku-4-5-20251001'));
});

test('a terminal takes no provider resolution at all', async () => {
  await agents({ default: { provider: 'openai', model: 'gpt-5.6-sol' }, by_provider: { anthropic: 'claude-fable-5-1' } });
  const r = await resolveForm(launch({ session_type: 'terminal', provider: 'anthropic' }), new Set());
  assert.equal(r.agent, false);
  assert.equal(r.cmd, '', 'a terminal launches nothing, whatever provider was named');
});
