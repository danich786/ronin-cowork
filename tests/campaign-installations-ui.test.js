import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Campaign Installations is the shared stone surface: Ronin Services, then the integrations', async () => {
  const source = await readFile(new URL('../public/js/campaign-installations.js', import.meta.url), 'utf8');
  const campaign = await readFile(new URL('../public/js/campaign-view.js', import.meta.url), 'utf8');
  assert.match(source, /createPhalanx/);
  assert.match(source, /const INSTALLATION_ORDER = \['ronin_services'\];/);
  assert.match(source, /createIntegrationsPanel\(campaign, \{ panels: context\.integrationPanels \|\| \{\}, embedded: true \}\)/);
  assert.match(source, /createStatusMarker\(installation\.maturity\)/);
  assert.doesNotMatch(source, /INSTALLATION_STATUS/);
  assert.match(source, /context\.createInstallationSurface\?\.\(installation\.id, sharedContext\)/);
  assert.match(campaign, /createInstallationSurface: \(id, shared\) => id === 'ronin_services' \? createServicesSurface\(shared\) : null/);
  assert.match(source, /key: 'available'.*switch: \[t\('campaign_view\.on', 'On'\), t\('campaign_view\.off', 'Off'\)\]/);
  assert.match(source, /key: 'defaultForAll'.*switch: \[t\('campaign_view\.on', 'On'\), t\('campaign_view\.off', 'Off'\)\]/);
  assert.match(source, /turn Available on first/);
  assert.match(source, /control\.disabled = off/);
  assert.match(source, /availableControl\.disabled = Boolean\(reason\)/);
  assert.match(source, /installationControls: controls/);
  assert.match(source, /installation\.effect === 'provider'/);
  assert.match(source, /saveCampaign\(row\.id, \{ config: \{ installations \} \}\)/);
  // Default for all Agents puts the part's behaviours on the Campaign's brief add list (docs/architecture/brief.md, Layers and brief settings).
  assert.match(source, /request\(url, \{ method: 'PUT', json: \{ brief: \{ \.\.\.brief, add \} \} \}\)/);
  assert.doesNotMatch(source, /config: \{ defaults \}/);
  assert.doesNotMatch(source, /shape: 'square'|shape_all|answer === 'all'/);
  // A collection surface opens showing its collection: forcing Ronin Services open put the
  // surface straight into operation mode, which is the one view the header zone is not in.
  assert.doesNotMatch(source, /stoneSurface\.select\('ronin_services'\)/);
  assert.doesNotMatch(source, /trello|perplexity/);
  assert.doesNotMatch(source, /servicesSell|installBlock|cv-choice|type = 'checkbox'|Available to Teams and Agents/);
});

test('the Campaign imports the exact exported Setup page builders', async () => {
  const setup = await readFile(new URL('../public/js/setup-surfaces.js', import.meta.url), 'utf8');
  assert.match(setup, /export function createServicesSurface\(context\)/);
  for (const id of ['task_manager', 'terminal_transcript', 'usage_stats', 'local_weights']) {
    assert.match(setup, new RegExp(`id: '${id}',[^}]+status: 'beta'`));
  }
  assert.match(setup, /id: 'voice_hotwords',[^}]+status: 'comingSoon'/);
});
