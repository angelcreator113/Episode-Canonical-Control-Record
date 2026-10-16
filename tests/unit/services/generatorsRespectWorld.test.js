'use strict';

/**
 * Generators respect the world (Evoni, 2026-10-16: "yes do A"; docs/CANON.md).
 * JustAWoman's world is ours; Lala's is the LalaVerse, where nobody knows
 * JustAWoman exists and Lala does not know she was made.
 */
const fs = require('fs');
const path = require('path');

jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })));

const { worldLineFor } = require('../../../src/services/characterGenerationService');
const { buildGenerationPrompt } = require('../../../src/routes/socialProfileRoutes');
const { pulsePromptRules } = require('../../../src/utils/pulsePlatform');
const { protagonistFor, LALA, JUSTAWOMAN } = require('../../../src/utils/protagonistContexts');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', '..', ...p), 'utf8');

describe('inner life is written in the character\'s own world', () => {
  test('a Book 1 character is in our world, not the LalaVerse', () => {
    const line = worldLineFor({ world: 'book-1' });
    expect(line).toMatch(/JustAWoman's world, our real world/);
    expect(line).toMatch(/does not live in it/);
  });
  test('a LalaVerse character is in the LalaVerse, where JustAWoman is never named', () => {
    const line = worldLineFor({ world: 'lalaverse' });
    expect(line).toMatch(/the LalaVerse, Lala's world/);
    expect(line).toMatch(/never name JustAWoman/);
  });
  test('with no world saved, the feed profile\'s layer decides; with neither, no world is assumed', () => {
    expect(worldLineFor({}, { feed_layer: 'real_world' })).toMatch(/our real world/);
    expect(worldLineFor({}, { feed_layer: 'lalaverse' })).toMatch(/the LalaVerse/);
    expect(worldLineFor({})).toMatch(/World: not set/);
  });
  test('the hard-coded "World: LalaVerse" line is gone from generateMissingInterior', () => {
    const src = read('src', 'services', 'characterGenerationService.js');
    const fn = src.slice(src.indexOf('async function generateMissingInterior'), src.indexOf('// SOCIAL PRESENCE DECISION'));
    expect(fn).toMatch(/worldLineFor\(character, feedProfile\)/);
    expect(fn).not.toMatch(/'World: LalaVerse/);
  });
});

describe('feed profiles are generated in their own world', () => {
  test('a LalaVerse profile is built around Lala with LalaVerse examples', () => {
    const p = buildGenerationPrompt('@x', 'pulse', 'night creator', null, null, 'lalaverse');
    expect(p).toMatch(/online world that Lala — the protagonist/);
    // The Pulse rules name the real apps once, to say they do not exist.
    const body = p.replace(/THE PULSE \(LalaVerse rule\):[\s\S]*?Never name them\./, '');
    expect(body).not.toMatch(/JustAWoman —|Houston|Fashion Nova|OnlyFans|AdSense|Marcus Rivera|TikTok/);
    expect(p).toMatch(/Dazzle District/);
    expect(p).toMatch(/Never name JustAWoman/);
  });
  test('a real-world profile is built around JustAWoman with real-world examples', () => {
    const p = buildGenerationPrompt('@x', 'instagram', 'mom creator', null, null, 'real_world');
    expect(p).toMatch(/online world that JustAWoman — the protagonist/);
    expect(p).toMatch(/Houston, TX/);
    expect(p).not.toMatch(/Dazzle District/);
  });
  test('a bulk job\'s context of only { feed_layer } no longer prints "undefined"', () => {
    const p = buildGenerationPrompt('@x', 'pulse', 'vibe', { feed_layer: 'lalaverse' }, null, 'lalaverse');
    expect(p).not.toMatch(/undefined/);
    expect(p).toMatch(/Lala — the protagonist/);
  });
  test('protagonistFor keeps a named context and falls back by layer', () => {
    expect(protagonistFor('lalaverse', { name: 'Nia Vale' }).name).toBe('Nia Vale');
    expect(protagonistFor('lalaverse', { feed_layer: 'lalaverse' })).toBe(LALA);
    expect(protagonistFor('real_world')).toBe(JUSTAWOMAN);
    expect(LALA.wound).not.toMatch(/built|JustAWoman/);
  });
  test('the scheduler uses the shared protagonists, not "she was built"', () => {
    const src = read('src', 'services', 'feedScheduler.js');
    expect(src).toMatch(/protagonistFor\(layer\)/);
    expect(src).not.toMatch(/She does not know she was built/);
  });
  test('bulk generation has the same room as /generate', () => {
    expect(read('src', 'routes', 'socialProfileBulkRoutes.js')).not.toMatch(/max_tokens: 3000/);
  });
});

describe('The Pulse rules and episode posts', () => {
  test('every LalaVerse prompt carries "never name JustAWoman"', () => {
    expect(pulsePromptRules('lalaverse')).toMatch(/Never name JustAWoman, and never say Lala was built/);
    expect(pulsePromptRules('real_world')).toBe('');
  });
  test('episode posts come from LalaVerse profiles only', () => {
    const src = read('src', 'services', 'feedPostGeneratorService.js');
    expect(src).toMatch(/feed_layer: 'lalaverse'/);
  });
});

describe('a crossed character does not take JustAWoman\'s cost as their wound', () => {
  test('Cross no longer maps what_it_costs_her or parasocial_function into core_*', () => {
    const src = read('src', 'routes', 'socialProfileRoutes.js');
    expect(src).not.toMatch(/core_wound: profile\.what_it_costs_her/);
    expect(src).not.toMatch(/core_desire: profile\.parasocial_function/);
    expect(src).toMatch(/What it costs her: \$\{profile\.what_it_costs_her\}/);
    expect(src.match(/writer_notes: crossedWriterNotes\(profile\)/g)).toHaveLength(2); // Cross and its preview
  });
});
