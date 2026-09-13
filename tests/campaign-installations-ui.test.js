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
  assert.match(source, /group: t\('campaign_view\.available', 'Available'\)/);
  assert.match(source, /shape: 'square', expanded: true/);
  assert.match(source, /page\?\.el\.querySelector\('\.setup-surface-body'\) \|\| host/);
  assert.match(source, /v: 'off'.*campaign_view\.off/);
  assert.match(source, /v: 'on'.*campaign_view\.on/);
  assert.match(source, /v: 'all'.*campaign_view\.shape_all/);
  assert.match(source, /installation\.effect === 'provider'/);
  assert.match(source, /saveCampaign\(row\.id, \{ config: \{ installations, defaults \} \}\)/);
  assert.doesNotMatch(source, /switch:/);
  assert.match(source, /stoneSurface\.select\('ronin_services'\)/);
  assert.match(source, /Ronin Services required/);
  assert.match(source, /name === 'trello' \|\| name === 'perplexity'/);
  assert.match(source, /values\.ronin_services === true.*installed\?\.services\?\.parts/);
  assert.doesNotMatch(source, /servicesSell|installBlock|cv-choice|type = 'checkbox'|Available to Teams and Agents/);
});

test('provider Off, On, and All project onto installation and Campaign behaviour defaults', async () => {
  const { applyFeatureProviderState, featureProviderState } = await import('../public/js/feature-provider-installation.js');
  const gbrain = { name: 'gbrain', provides: ['gbrain'] };
  const base = { provider: 'openai', behaviours: ['ronin_host', 'gbrain'] };

  assert.equal(featureProviderState(gbrain, { gbrain: false }, base.behaviours), 'off');
  assert.equal(featureProviderState(gbrain, { gbrain: true }, ['ronin_host']), 'on');
  assert.equal(featureProviderState(gbrain, { gbrain: true }, base.behaviours), 'all');
  assert.deepEqual(applyFeatureProviderState(gbrain, 'off', { gbrain: true }, base), {
    installations: { gbrain: false }, defaults: { provider: 'openai', behaviours: ['ronin_host'] },
  });
  assert.deepEqual(applyFeatureProviderState(gbrain, 'on', { gbrain: false }, base), {
    installations: { gbrain: true }, defaults: { provider: 'openai', behaviours: ['ronin_host'] },
  });
  assert.deepEqual(applyFeatureProviderState(gbrain, 'all', { gbrain: false }, { ...base, behaviours: ['ronin_host'] }), {
    installations: { gbrain: true }, defaults: { provider: 'openai', behaviours: ['ronin_host', 'gbrain'] },
  });
});

test('the Campaign imports the exact exported Setup page builders', async () => {
  const setup = await readFile(new URL('../public/js/setup-surfaces.js', import.meta.url), 'utf8');
  assert.match(setup, /export function createServicesSurface\(context\)/);
  assert.match(setup, /export function createGbrainSurface\(context\)/);
});
