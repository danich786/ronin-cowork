import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { conditionalBehaviourPath, resolveConditionalBehaviours } from '../src/behaviours.js';
import { teamLeadAcknowledgement } from '../src/routes/sessions-api.js';

test('Team lead is one ordinary conditional Behavior selected only by the explicit designation', async () => {
  const lead = await resolveConditionalBehaviours({ arrangement: 'none', team: true, lead: true, project_management: false });
  assert.equal(lead.filter((row) => row.book === 'team-lead').length, 1);
  assert.ok(!(
    await resolveConditionalBehaviours({ arrangement: 'none', team: true, lead: false, project_management: false })
  ).some((row) => row.book === 'team-lead'));
  assert.ok(!(
    await resolveConditionalBehaviours({ arrangement: 'none', team: false, lead: true, project_management: false })
  ).some((row) => row.book === 'team-lead'));
});

test('Project management is one conditional Behavior selected only by the Campaign switch', async () => {
  const facts = { arrangement: 'none', team: false, lead: false } as const;
  assert.equal((await resolveConditionalBehaviours({ ...facts, project_management: true })).filter((row) => row.book === 'project-management').length, 1);
  assert.ok(!(await resolveConditionalBehaviours({ ...facts, project_management: false })).some((row) => row.book === 'project-management'));
});

test('a later lead designation acknowledges the change with the resolved reading assignment', async () => {
  const reading = await conditionalBehaviourPath('team-lead');
  assert.equal(path.basename(reading ?? ''), 'team-lead.md');
  const message = teamLeadAcknowledgement(['builders'], reading);
  assert.match(message, /now the team_lead of "builders"/);
  assert.match(message, /Reading assignment: read .*conditional\/team-lead\.md now for what a Team lead does\./);
});
