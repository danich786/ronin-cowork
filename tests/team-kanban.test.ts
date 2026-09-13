import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const sessions = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-kanban-sessions-'));
process.env.RONIN_SESSION_DIR = sessions;
process.env.RONIN_TEAM_ROSTERS_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-kanban-rosters-'));
process.env.RONIN_PROJECT_ROOTS_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-kanban-roots-'));

const { deriveTeamKanban } = await import('../src/team-kanban.js');

const project = {
  id: 'alpha/1', title: 'Board read', objective: 'Return derived JSON.',
  stage: 'BUILDING' as const, exit: 'agent' as const, status: 'green' as const,
  ladder: [{ stage: 'BUILDING' as const }], evidence: ['commit abcdef1'],
};

await fs.mkdir(path.join(sessions, 'worker-key'), { recursive: true });
await fs.writeFile(path.join(sessions, 'worker-key', 'tegami.md'), `\`\`\`json\n${JSON.stringify({ projects: [project] })}\n\`\`\`\n`);

const handIn = {
  id: 'hi1', at: '', repo: 'repo', team: 'alpha', line: 'team/alpha/dev', session: 'worker',
  desk: 'team/alpha/worker', source_tip: '', expected_old: '', candidate: 'candidate1',
  result: 'accepted' as const, line_sha: 'candidate1', conflict_files: [], reason: '',
};
const promotion = {
  id: 'p1', kind: 'team_promotion' as const, team: 'alpha', at: '', created_at: '', updated_at: '',
  state: 'complete' as const, history: [], repos: [{ repo: 'repo', candidate: 'candidate1' }],
  proofs: [], advances: [], by: 'lead',
};

test('an empty Team has one useful, empty board answer', async () => {
  assert.deepEqual(await deriveTeamKanban('alpha', { rosterProjects: [], sessions: [], handIns: [], promotions: [] }), {
    team: 'alpha', projects: [],
  });
});

test('hand-in, promotion, and master containment derive Landing and Done without writes', async () => {
  const common = {
    rosterProjects: [], sessions: [{ name: 'worker', key: 'worker-key', tags: ['alpha'] }],
    handIns: [handIn], contains: async (_repo: string, ancestor: string, descendant: string) =>
      ancestor === descendant || (ancestor === 'abcdef1' && descendant === 'candidate1'),
  };
  const landed = await deriveTeamKanban('alpha', { ...common, promotions: [] });
  assert.deepEqual(landed?.projects[0], { ...project, holder: 'worker', stage: 'LANDING', exit: 'lead', status: 'green' });
  const promoted = await deriveTeamKanban('alpha', { ...common, promotions: [promotion] });
  assert.equal(promoted?.projects[0]?.exit, 'user');
  const done = await deriveTeamKanban('alpha', {
    ...common, promotions: [promotion], contains: async (_repo, ancestor, descendant) =>
      ancestor === descendant || (ancestor === 'abcdef1' && descendant === 'candidate1') || (ancestor === 'candidate1' && descendant === 'master'),
  });
  assert.equal(done?.projects[0]?.stage, 'DONE');
  assert.equal(done?.projects[0]?.exit, 'none');
});
