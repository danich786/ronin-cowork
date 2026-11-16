/**
 * ONE LAUNCH MECHANISM, TWO CALLERS — the owner's architectural invariant, 2026-08-22.
 *
 * Commons' ＋ New form and the agent-invoked `forkit` macro are two callers of exactly one
 * launch mechanism. Both submit the same session_launch_spec and traverse the same
 * validation, project-root defaulting, role/task/model cascade, Build Brief compilation,
 * tmux birth, agent start and recording hooks.
 *
 * Forkit may add only fork-specific INPUTS and aftercare: the handoff document, team
 * inheritance, and the understanding-gate prompt. It may not implement session creation,
 * model resolution, reading compilation or CLI startup itself — and it used to implement
 * all four, with `tmux new-session` + `run-command claude` + `wait-ready`, which is how a
 * fork arrived with no letter, no role and no Build Brief at all.
 *
 * WHAT IS ASSERTED. `resolveForm` is the mechanism: every caller reaches it through
 * `POST /api/launch`, and everything downstream of it — the tags, the letter,
 * the counting — is the route's single body of code. So parity is proven where the two
 * callers could possibly diverge: hand it equivalent specs and the RESOLVED launch and
 * the READING LIST must be identical, field for field. A second launch path would have to
 * reproduce this table to pass, which is the point.
 *
 * No tmux, no socket: every store is redirected per the env contract in src/resources.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-parity-test-'));
const listed = (ids: string[]) => ({ read_at: '2026-09-18T00:00:00Z', by: 'test', rows: ids.map((id) => ({ id, name: id })) });
const providers = { measured_at: '2026-09-18T00:00:00Z', installed: ['claude', 'codex'], signed_in: ['claude', 'codex'], operational: ['claude', 'codex'], activated_count: 2, paths: {}, versions: {}, latest: {}, off: [], refreshed_at: '', models: {
  claude: listed(['claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5', 'claude-haiku-4-5-20251001']),
  codex: listed(['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5']),
} };
const catalogs = path.join(temp, 'catalogs');
await fs.mkdir(catalogs, { recursive: true });
// The owner's own root list. `dir` is the temp root itself so nothing reaches a real
// checkout, and a SECOND root exists so "the top active one" is a real choice rather
// than the only answer.
await fs.writeFile(
  path.join(catalogs, 'PROJECT_ROOTS.md'),
  [
    '# PROJECT_ROOTS — yours',
    '',
    '## alpha',
    `- **dir:** ${temp}`,
    '- **remit:** the first root, and therefore the default',
    '',
    '## beta',
    `- **dir:** ${temp}`,
    '- **remit:** the second, chosen only when named',
    '',
  ].join('\n'),
);
process.env.RONIN_CATALOGS_DIR = catalogs;
process.env.RONIN_SESSION_BOOT_DIR = path.join(temp, 'shelf');
process.env.RONIN_SESSION_BOOT_CACHE_DIR = path.join(temp, 'generated');
process.env.RONIN_CONFIG_DIR = path.join(temp, 'config');
// The owner's own session default, because since 2026-08-29 it is the ONLY thing under an
// explicit pick — no role axis biases the model, so a launch that names
// nothing must land here for both callers alike.
await fs.mkdir(path.join(temp, 'config'), { recursive: true });
await fs.writeFile(
  path.join(temp, 'config', 'machine_settings.json'),
  JSON.stringify({
    agents: { sessions: { default: { provider: 'anthropic', model: 'claude-fable-5-1' } } },
    campaigns: {
      home_machine: {
        title: 'Ronin Home',
        state: 'active',
        providers,
        config: { installations: {}, defaults: {} },
      },
    },
  }),
);
process.env.RONIN_LEDGER_DIR = path.join(temp, 'ledger');
process.env.RONIN_WORKSPACES_DIR = path.join(temp, 'workspaces');
process.env.RONIN_HOUSE_DIR = path.join(temp, 'house');

// A book on each core level, so the reading list has something to be identical ABOUT.
for (const [level, name, book] of [
  ['all', '', 'ALL_BOOK.md'],
  ['root', 'alpha', 'ROOT_BOOK.md'],
] as const) {
  const dir = path.join(temp, 'shelf', level, name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, book), `# ${book}`);
}

// A team roster, so the team layer has context to contribute; two more launched in Workspaces.
process.env.RONIN_TEAM_ROSTERS_DIR = path.join(temp, 'team_rosters');
await fs.mkdir(path.join(temp, 'team_rosters'), { recursive: true });
await fs.writeFile(
  path.join(temp, 'team_rosters', 'scratchteam.md'),
  [
    '# scratchteam', '', '- **objective:** prove the parity',
    '- **agent_defaults:** {"provider":"","model":"","reach":"discuss","recruit":"nobody","output":"ideas","launch_mode":"configured"}',
    '- **state:** active', '',
  ].join('\n'),
);
for (const [team, workspace] of [['wsteam', 'alpha'], ['wildteam', 'wild']]) {
  await fs.writeFile(path.join(temp, 'team_rosters', `${team}.md`), `# ${team}\n\n- **workspace:** ${workspace}\n- **state:** active\n`);
}

const { saveWorkspace, roninHouse } = await import('../src/workspaces.js');
for (const [name, launch_mode] of [['alpha', 'configured'], ['wild', 'live_dangerously']] as const) {
  await saveWorkspace({ name, campaign_id: 'home_machine', title: name, objective: '', instructions: '', repos: [], folders: [], launch_mode });
}

const { resolveForm, resolveFacts, resolveBriefFor } = await import('../src/spawn.js');
const { mikaLaunchBody } = await import('../src/routes/launch.js');
type SpawnForm = import('../src/spawn.js').SpawnForm;

/** What the ＋ New form posts: the axes, the picks, and the owner's words. */
const commonsForm = (over: Partial<SpawnForm> = {}): SpawnForm => ({
  campaign_id: 'home_machine',
  prompt: 'Work out the shape of the thing.',
  ...over,
});

/**
 * What `forkit` posts. The SAME body plus its own inputs — a handoff prompt and a team
 * tag — and nothing else. If this ever needs a field the form does not have, that is a
 * second launch implementation growing, and this test is where it shows up.
 */
const forkitForm = (over: Partial<SpawnForm> = {}): SpawnForm =>
  commonsForm({ team: 'scratchteam', ...over });

/** Everything the mechanism decides. A caller may pick these; it may never compute them. */
const mechanism = (r: Awaited<ReturnType<typeof resolveForm>>) => ({
  workspace: r.workspace,
  dir: r.dir,
  cmd: r.cmd,
  agent: r.agent,
  capExempt: r.capExempt,
  launchAgent: r.launchAgent,
});

/*
 * The compiled reading list, by filename — the Build Brief's `Read first:` line.
 *
 * The sentence ends at a period followed by whitespace, NOT at the first period: every
 * entry is a path ending `.md`, so `[^.]+` stopped inside the first filename and the list
 * read as one truncated book.
 */
const reading = (brief: string): string[] =>
  (brief.match(/Read first: ([\s\S]*?)\.(?:\s|$)/)?.[1] ?? '')
    .split(', ')
    .map((f) => path.basename(f.trim()))
    .filter(Boolean)
    .sort();

test('the brief names the Team and its wipeboard as a fact; the prompt carries only the read line and the task', async () => {
  const agent = await resolveForm(forkitForm(), new Set());
  const facts = agent.composed!.doc;
  assert.equal(facts.agent.team, 'scratchteam');
  assert.equal(facts.agent.wipeboard, 'scratchteam');
  assert.doesNotMatch(agent.brief, /Team membership|Reach:|Designation:/);
  assert.match(agent.brief, /^Read first: <packet>\.$/m);
  assert.match(agent.brief, /Your task:\nWork out the shape of the thing\./);
});

test('equivalent specs from Commons and forkit resolve to the same launch', async () => {
  const fromCommons = await resolveForm(commonsForm(), new Set());
  const fromForkit = await resolveForm(forkitForm({ prompt: commonsForm().prompt }), new Set());
  assert.deepEqual(mechanism(fromForkit), mechanism(fromCommons));
});

test('session_type is the only birth-path key', async () => {
  const cowork = await resolveForm(commonsForm({ session_type: 'cowork_agent' }), new Set());
  assert.equal(cowork.session_type, 'cowork_agent');
  assert.equal(cowork.agent, true);
  assert.ok(cowork.brief, 'a cowork Agent receives the Ronin launch prompt');
  assert.match(cowork.composed!.text, /— end of packet for /, 'and a generated brief');

  const terminal = await resolveForm(commonsForm({ session_type: 'terminal' }), new Set());
  assert.equal(terminal.session_type, 'terminal');
  assert.equal(terminal.agent, false);
  assert.equal(terminal.brief, '');
  assert.equal(terminal.composed, null);
});

test('bare_metal_agent resolves a real CLI without Ronin birth machinery', async () => {
  const bare = await resolveForm(commonsForm({
    session_type: 'bare_metal_agent',
    name: 'bare-proof',
    provider: 'anthropic',
    team: 'scratchteam',
  }), new Set());
  assert.equal(bare.session_type, 'bare_metal_agent');
  assert.equal(bare.agent, true);
  assert.ok(bare.cmd, 'the provider CLI is resolved');
  assert.doesNotMatch(bare.cmd, /dangerously/, 'bare metal uses Native unless Dangerously is explicitly selected');
  assert.equal(bare.cmd, 'claude', 'no model selection is the Agent CLI’s Native command');
  assert.equal(bare.launch_mode, 'configured');
  assert.ok(bare.launchAgent, 'the launched provider is stamped');
  assert.equal(bare.brief, '', 'Ronin composes no brief');
  assert.equal(bare.composed, null, 'Ronin builds no brief');
  assert.deepEqual(bare.tags, ['scratchteam'], 'Team is only an addressing tag');
  assert.equal(bare.team_objective, '', 'the Team roster does not resolve into the launch');
});

test("forkit's own inputs change its words and nothing about the mechanism", async () => {
  const plain = await resolveForm(commonsForm(), new Set());
  const forked = await resolveForm(
    forkitForm({ prompt: 'Read wip/handoffs/TOPIC.md. Then report back, in your own words.' }),
    new Set(),
  );
  // The handoff prompt and the team are INPUTS. They must reach the brief and the tags…
  assert.match(forked.brief, /wip\/handoffs\/TOPIC\.md/);
  assert.equal(forked.composed!.doc.agent.team, 'scratchteam');
  assert.equal(forked.composed!.doc.agent.team_objective, 'prove the parity', "the roster's objective is on the record");
  assert.deepEqual(forked.tags, ['scratchteam']);
  assert.deepEqual(plain.tags, []);
  // …and must not move a single thing the mechanism decides except the team itself.
  assert.deepEqual({ ...mechanism(forked) }, { ...mechanism(plain) });
});

test('where an Agent starts is the mechanism\'s — Ronin house, Workspace or not', async () => {
  const commons = await resolveForm(commonsForm(), new Set());
  assert.equal(commons.workspace, '');
  assert.equal(commons.dir, roninHouse());
  const inWorkspace = await resolveForm(commonsForm({ team: 'wsteam' }), new Set());
  assert.equal(inWorkspace.workspace, 'alpha', "the roster's Workspace is the Agent's");
  assert.equal(inWorkspace.dir, roninHouse());
});

test('the model cascade is the mechanism\'s: blank inherits, explicit wins, identically', async () => {
  // BLANK — the OWNER'S session default answers, for both callers. It used to be the
  // task's `model:` bias; that field and its resolution path were removed on 2026-08-29,
  // so a definition can no longer put itself between the owner and their own default.
  const commons = await resolveForm(commonsForm({ cmd: undefined }), new Set());
  const forkit = await resolveForm(forkitForm({ cmd: undefined }), new Set());
  assert.equal(forkit.cmd, commons.cmd);
  assert.match(commons.cmd, /fable/, 'the configured session default answers, not the role');

  // EXPLICIT — the owner named one, and it beats every layer. Same input, same answer.
  const pick = 'claude --model claude-haiku-4-5-20251001';
  const c2 = await resolveForm(commonsForm({ cmd: pick }), new Set());
  const f2 = await resolveForm(forkitForm({ cmd: pick }), new Set());
  assert.ok(c2.cmd.startsWith(pick), `explicit pick must lead the cmd, got "${c2.cmd}"`);
  assert.equal(f2.cmd, c2.cmd, 'and both callers get the identical resolved command');
});


test('the Workspace\'s Mode selects the Agent document\'s Native or Dangerously command', async () => {
  const configured = await resolveForm(commonsForm({ provider: 'anthropic', model: 'claude-opus-5' }), new Set());
  assert.equal(configured.cmd, 'claude --model claude-opus-5');
  assert.equal(configured.launch_mode, 'configured');
  assert.equal(configured.stated_by.launch_mode[0]?.layer, 'campaign', 'an Agent without a Workspace takes the Campaign default');

  const dangerous = await resolveForm(commonsForm({ team: 'wildteam', provider: 'anthropic', model: 'claude-opus-5' }), new Set());
  assert.equal(dangerous.cmd, 'claude --model claude-opus-5 --dangerously-skip-permissions');
  assert.equal(dangerous.launch_mode, 'live_dangerously');

  const undeclared = await resolveForm(commonsForm({ team: 'wildteam', cmd: 'custom-agent' }), new Set());
  assert.equal(undeclared.cmd, 'custom-agent', 'a provider with no Dangerously command launches Native');
  assert.equal(undeclared.launch_mode, 'configured');
});


test('mandate defaults are complete, Team seeds them, and the explicit launch wins', async () => {
  const stock = await resolveForm(commonsForm(), new Set());
  assert.deepEqual(stock.mandate, { reach: 'plan', recruit: 'propose agents', output: ['open'] });

  const seeded = await resolveForm(forkitForm(), new Set());
  assert.deepEqual(seeded.mandate, { reach: 'discuss', recruit: 'nobody', output: ['ideas'] });

  const explicit = await resolveForm(forkitForm({
    mandate: { reach: 'execute', recruit: 'staff agents', output: 'the team' },
  }), new Set());
  assert.deepEqual(explicit.mandate, { reach: 'execute', recruit: 'staff agents', output: ['the team'] });
  assert.deepEqual(explicit.stated_by.mandate, [{ layer: 'launch', source: 'launch request' }]);
});

test('a ronin launch is legal, and so is a launch onto a tag-only team', async () => {
  // No team at all — a ronin — is an ordinary launch.
  const ronin = await resolveForm(commonsForm(), new Set());
  assert.equal(ronin.team, '');
  // A team the durable half has never heard of is an ordinary team (owner, 2026-08-26):
  // the session is born tagged onto it, told it is tag-only, and inherits no roster.
  const tagOnly = await resolveForm(commonsForm({ team: 'ghosts' }), new Set());
  assert.equal(tagOnly.team, 'ghosts');
  assert.ok(tagOnly.tags.includes('ghosts'), 'born tagged onto it');
  assert.equal(tagOnly.composed!.doc.agent.wipeboard, 'ghosts', 'its wipeboard is its name');
  // The name is still the tag, so it obeys the tag's spelling.
  await assert.rejects(() => resolveForm(commonsForm({ team: 'Ghosts!' }), new Set()), /team name/);
});

test('stated_by carries the settled launch, Team, and Campaign layers', async () => {
  const explicit = await resolveForm(commonsForm({
    name: 'attribution-proof',
    cmd: 'claude --model claude-haiku-4-5-20251001',
  }), new Set());
  for (const key of ['name', 'cmd']) {
    assert.deepEqual(explicit.stated_by[key], [{ layer: 'launch', source: 'launch request' }], key);
  }

  const inherited = await resolveForm(commonsForm({ team: 'wsteam' }), new Set());
  assert.equal(inherited.stated_by.workspace[0]?.layer, 'team_roster');

  const campaign = await resolveForm(commonsForm(), new Set());
});


test('server resolution returns profile and durable Team context without browser reconstruction', async () => {
  const resolved = await resolveForm(forkitForm(), new Set());
  assert.equal(resolved.launch_mode, 'configured');
  assert.equal(resolved.team_objective, 'prove the parity');
  assert.equal(resolved.team_branch, '');
  assert.equal(resolved.team_wipeboard, 'scratchteam');
  assert.equal(resolved.team_state, 'active');
  assert.equal(resolved.stated_by.team_objective[0]?.layer, 'team_roster');
});

test('the mandate is a fact on the record, inherited from the Team, never in the prompt', async () => {
  const inherited = await resolveForm(forkitForm(), new Set());
  const agent = inherited.composed!.doc.agent;
  assert.deepEqual([agent.reach, agent.recruit, agent.output], ['discuss', 'nobody', ['ideas']]);
  assert.doesNotMatch(inherited.brief, /Reach|Recruit|Output/);
});

test('an ordinary assisted launch starts an agent with the full brief', async () => {
  const r = await resolveForm(commonsForm(), new Set());
  assert.equal(r.agent, true, 'an ordinary launch starts a CLI');
  assert.ok(r.cmd, 'and has a command to start');
  assert.ok(r.launchAgent, 'and stamps which CLI it started');
  assert.ok(r.dir, 'a session is always born somewhere');
  assert.match(r.brief, /Read first:/, 'the prompt carries the read line');
  const told = r.composed!.resolved.behaviours.map((row) => row.name);
  for (const name of ['base-agent', 'cowork-agent', 'write-it-down']) assert.ok(told.includes(name), name);
});

test('team_lead is explicit and brings its conditional behaviour at birth', async () => {
  const names = (r: Awaited<ReturnType<typeof resolveForm>>) => r.composed!.resolved.behaviours.map((row) => row.name);
  const lead = await resolveForm(commonsForm({ team: 'builders', team_lead: true }), new Set());
  assert.ok(names(lead).includes('team-lead'));
  const ordinary = await resolveForm(commonsForm({ team: 'builders', team_lead: false }), new Set());
  assert.ok(!names(ordinary).includes('team-lead'));
});

test('an explicit Role brings its behaviour, project management switched on', async () => {
  const names = (r: Awaited<ReturnType<typeof resolveForm>>) => r.composed!.resolved.behaviours.map((row) => row.name);
  const epic = await resolveForm(commonsForm({ role: 'epic_lead', pm: true }), new Set());
  assert.ok(names(epic).includes('pm-epic-lead'));
  assert.ok(names(epic).includes('project-management'), 'the item model with it');
  const coordinator = await resolveForm(commonsForm({ role: 'coordinator', pm: true }), new Set());
  assert.ok(names(coordinator).includes('pm-traffic-control'));
  const off = await resolveForm(commonsForm({ role: 'coordinator' }), new Set());
  assert.ok(!names(off).some((name) => name.startsWith('pm') || name === 'project-management'), 'switched off: no item behaviours');
  assert.ok(!off.composed!.resolved.behaviours.some((row) => row.tools.some((tool) => tool.name === 'work-item')), 'and no item seed');
});

test('Mika house mechanics resolve explicitly', async () => {
  const mika = await resolveForm({
    house_seat: 'mika',
    name: 'mika_agent',
    prompt: 'Help me with Ronin.',
  }, new Set());
  assert.equal(mika.name, 'mika_agent');
  assert.equal(mika.dir, roninHouse());
  assert.equal(mika.capExempt, true);
  assert.equal(mika.ack, false);
  assert.equal(mika.opening, '{prompt}', 'nothing is typed at her beyond the request itself');
  // The launch prefixes "You are the Mika Assist." — with the posture that is the whole typed intro: two sentences.
  assert.match(mika.brief, /^You are the Mika Assist\. You explain and operate Ronin only[^.]*\.\n/);
  assert.equal((mika.brief.split('\n')[0].match(/\. /g) || []).length, 1, 'two sentences typed; the rules live in her birth brief');
  assert.match(mika.brief, /You are the Mika Assist/);
  const names = mika.composed!.resolved.behaviours.map((row) => row.name);
  assert.ok(['base-agent', 'mika'].every((name) => names.includes(name)), 'her brief: the base brief and hers');
  assert.ok(!['cowork-agent', 'write-it-down', 'mandates'].some((name) => names.includes(name)), 'no cowork briefs for a house Agent');
  assert.equal(mika.stated_by.capExempt[0]?.layer, 'house');
  const door = mikaLaunchBody({});
  assert.deepEqual(door.mandate, { reach: 'discuss', recruit: 'nobody', output: ['ideas'] }, 'she discusses, recruits nobody, hands back ideas');
});

test('a name alone resolves the ordinary Cowork Agent birth', async () => {
  // Last because resolving the initial Campaign legitimately exercises its one-time
  // compatibility write; earlier parity cases intentionally measure the pre-write fixture.
  const born = await resolveForm({ name: 'name_only' });
  assert.equal(born.session_type, 'cowork_agent');
  assert.equal(born.name, 'name_only');
  assert.equal(born.dir, roninHouse(), 'an Agent without a Workspace starts in Ronin house');
  assert.ok(born.installations.length > 0, 'the receipt source carries every installation');
  assert.ok(!born.installations.some((installation) => installation.name === 'cowork_agent'), 'the Cowork Agent is not an installation switch');
  assert.deepEqual(born.mandate, { reach: 'plan', recruit: 'propose agents', output: ['open'] });
});

test('kind and the Agent\'s own add list resolve at birth', async () => {
  const born = await resolveForm(commonsForm({
    kind: 'coding',
    brief: { add: [{ name: 'team-work' }, { name: 'not-there' }], block: [], only: [] },
    mandate: { reach: 'plan', recruit: 'nobody', output: ['a plan', 'ideas'] },
  }), new Set());
  assert.equal(born.kind, 'coding');
  const told = born.composed!.resolved.behaviours;
  assert.deepEqual(told.find((row) => row.name === 'team-work')?.why, ['add:agent']);
  assert.ok(!told.some((row) => row.name === 'not-there'), 'a name with no file is told nothing');
  assert.deepEqual(born.ignored, []);
  assert.equal(born.stated_by.kind[0]?.layer, 'launch');
  assert.equal(born.stated_by.brief_settings[0]?.layer, 'launch');
});

test('a selected template names unchanged preset values without reapplying edited ones', async () => {
  const preset = await resolveForm(commonsForm({
    template: 'office_manager',
    prompt: 'Be my office manager — handle the daily grind: inbox, calendar, paperwork.',
    mandate: { reach: 'execute', recruit: 'nobody', output: 'open' },
  }), new Set());
  assert.deepEqual(preset.stated_by.template, [{ layer: 'template', source: 'office_manager' }]);
  assert.equal(preset.stated_by.brief[0]?.layer, 'template');
  assert.deepEqual(preset.stated_by.mandate, [{ layer: 'template', source: 'office_manager' }]);

  const edited = await resolveForm(commonsForm({
    template: 'office_manager',
    prompt: 'Handle only the calendar.',
    mandate: { reach: 'plan', recruit: 'nobody', output: 'an artifact' },
  }), new Set());
  assert.equal(edited.stated_by.brief[0]?.layer, 'launch');
  assert.deepEqual(edited.stated_by.mandate, [{ layer: 'launch', source: 'launch request' }]);

  const missing = await resolveForm(commonsForm({ template: 'not_there' }), new Set());
  assert.deepEqual(missing.ignored, ['template[not_there]']);
  assert.equal(missing.stated_by.template[0]?.layer, 'system');
});

// UPDATE (owner, 2026-10-24): a running Agent's brief is rebuilt from the facts alone, never
// through the launch. What they give must be what birth gave.
test('the facts alone give the brief birth gave', async () => {
  const form = forkitForm({ session_type: 'cowork_agent', name: 'parity_reading' });
  const whole = await resolveForm(form, new Set());
  const again = await resolveBriefFor(form, await resolveFacts(form, new Set()), {
    provider: whole.identity?.provider, model: whole.identity?.model, harness: whole.identity?.cli, launch_mode: whole.launch_mode,
  });
  assert.equal(again!.text, whole.composed!.text);
});

test('every Cowork Agent is seeded with Integrations, with nothing selected', async () => {
  const agent = await resolveForm(commonsForm({ session_type: 'cowork_agent', name: 'integrations-proof' }), new Set());
  if (process.env.RONIN_PACKET_PROOF) await fs.writeFile(process.env.RONIN_PACKET_PROOF, agent.composed!.text);
  assert.match(agent.composed!.text, /^### Integrations\n.+ \(`integrations`\)$/m);
});
