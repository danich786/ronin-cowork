import test from 'node:test';
import assert from 'node:assert/strict';
import { moveMessage } from '../public/js/team-kanban.js';

const project = (values = {}) => ({
  id: 'virtual-kanban/7', title: 'Kanban tab', objective: 'Render it.', holder: 'tab_cut',
  stage: 'BUILDING', exit: 'user', status: 'green', ...values,
});
const NOW = new Date('2026-09-13T13:02:00.000Z');

test('a green forward drop tells the holder the defined move without moving data', () => {
  const move = moveMessage(project(), 'LANDING', 'kanban_revive', NOW);
  assert.equal(move.target, 'tab_cut');
  assert.match(move.text, /^from @kanban \(the Team Kanban, moved by the user at 2026-09-13T13:02Z\):/);
  assert.match(move.text, /MOVE virtual-kanban\/7 "Kanban tab" from Building \(green, exit: user\) to Landing/);
  assert.match(move.text, /meaning: show approved; hand in\./);
  assert.match(move.text, /next: tejun-desk hand-in, then work-record project write 7 --stage LANDING/);
});

test('lead moves resolve to the live lead session and non-green drops remain requests', () => {
  assert.equal(moveMessage(project({ holder: 'lead', stage: 'IDEAS', exit: 'lead' }), 'PLANNING', 'kanban_revive', NOW).target, 'kanban_revive');
  const blocked = moveMessage(project({ status: 'red' }), 'LANDING', 'kanban_revive', NOW);
  assert.equal(blocked.target, 'tab_cut');
  assert.match(blocked.text, /a request to move on, not an approval; the card is blocked/);
});

test('Planning back to Ideas and Landing forward are sent to the lead', () => {
  const returned = moveMessage(project({ stage: 'PLANNING', status: 'yellow' }), 'IDEAS', 'kanban_revive', NOW);
  assert.equal(returned.target, 'kanban_revive');
  assert.match(returned.text, /return it to Ideas/);
  const promoted = moveMessage(project({ stage: 'LANDING', exit: 'lead' }), 'DONE', 'kanban_revive', NOW);
  assert.equal(promoted.target, 'kanban_revive');
  assert.match(promoted.text, /meaning: promote/);
});
