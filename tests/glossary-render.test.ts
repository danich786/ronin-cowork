import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderGlossary } from '../src/birth-readme.js';
import { activeDeskProfileName, listDeskProfiles } from '../src/desk-profiles.js';
import { resolveLexicon } from '../src/lexicon-catalog.js';

const TEMPLATE = [
  '<!-- RENDERED_FOR:START -->',
  '> template note',
  '<!-- RENDERED_FOR:END -->',
  '| `wipeboard` | **wipeboard**<!--g:glossary.wipeboard--> | one line |',
  '| team (`@ronin-tags`) | **Team**<!--g:glossary.team--> | one line |',
].join('\n');

test('stock birth words agree with the UI lexicon when no desk profile is selected', async () => {
  const [glossary, floor] = await Promise.all([
    readFile(new URL('../KOTOBA_GLOSSARY.md', import.meta.url), 'utf8'),
    readFile(new URL('../ronin_catalogs/lexicons/professional_en.md', import.meta.url), 'utf8'),
  ]);
  const words = new Map([...floor.matchAll(/^- \*\*([^*]+):\*\* (.*)$/gm)]
    .map((match) => [match[1], match[2]]));
  const cells = [...glossary.matchAll(/\*\*([^*\n]+)\*\*<!--g:([\w.-]+)-->/g)];
  assert.ok(cells.length > 0, 'the shipped glossary has keyed stock words');
  for (const [, word, key] of cells) {
    assert.equal(word, words.get(key), `${key}: the stock fallback and displayed word must agree`);
  }
});

test('the glossary renders its keyed cells from the desk words and drops the markers', async () => {
  const profileName = await activeDeskProfileName();
  const profile = profileName ? (await listDeskProfiles()).find((row) => row.name === profileName) : undefined;
  const words = profile?.lexicon ? (await resolveLexicon(profile.lexicon))?.words || {} : {};
  const out = await renderGlossary(TEMPLATE);
  assert.ok(!out.includes('<!--g:'), 'markers are dropped');
  assert.ok(out.includes(`| **${words['glossary.wipeboard'] || 'wipeboard'}** |`), 'wipeboard uses the effective desk word');
  assert.ok(out.includes(`| **${words['glossary.team'] || 'Team'}** |`), 'Team uses the effective desk word');
  assert.ok(!out.includes('> template note'), 'the header slot is rewritten');
  assert.ok(/Rendered for/.test(out), 'the header says what it was rendered for');
});
