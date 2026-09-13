import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Campaign Installations is the shared stone surface with the Setup Services and gbrain pages', async () => {
  const source = await readFile(new URL('../public/js/campaign-installations.js', import.meta.url), 'utf8');
  assert.match(source, /createStoneWorkSurface/);
  assert.match(source, /\['ronin_services', 'gbrain', 'trello', 'perplexity'\]/);
  assert.match(source, /createServicesSurface\(sharedContext\)/);
  assert.match(source, /createGbrainSurface\(sharedContext\)/);
  assert.match(source, /const question = ask\(/);
  assert.match(source, /switch: \[t\('campaign_view\.on'.*t\('campaign_view\.off'/);
  assert.match(source, /if \(installation\.id !== 'ronin_services'\) choice\(installation, host\)/);
  assert.match(source, /stoneSurface\.select\('ronin_services'\)/);
  assert.match(source, /Ronin Services required/);
  assert.match(source, /name === 'trello' \|\| name === 'perplexity'/);
  assert.match(source, /values\.ronin_services === true.*installed\?\.services\?\.parts/);
  assert.doesNotMatch(source, /servicesSell|installBlock|cv-choice|type = 'checkbox'|Available to Teams and Agents/);
});

test('the Campaign imports the exact exported Setup page builders', async () => {
  const setup = await readFile(new URL('../public/js/setup-surfaces.js', import.meta.url), 'utf8');
  assert.match(setup, /export function createServicesSurface\(context\)/);
  assert.match(setup, /export function createGbrainSurface\(context\)/);
});
