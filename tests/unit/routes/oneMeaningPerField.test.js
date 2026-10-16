'use strict';

/**
 * One meaning per field (Evoni, 2026-10-16: "yes do ... C").
 */
const fs = require('fs');
const path = require('path');

jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })));

const { SECTION_SCHEMAS } = require('../../../src/utils/characterSectionSchemas');
const { deepNote, dimension } = require('../../../src/utils/deepProfile');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', '..', ...p), 'utf8');

describe('every section generator asks for the same fields with the same meaning', () => {
  test('characterRegistry.js has no section schema of its own', () => {
    const src = read('src', 'routes', 'characterRegistry.js');
    expect(src.match(/const sectionSchemas = SECTION_SCHEMAS;/g)).toHaveLength(2); // backfill-sections, backfill-all
    for (const sec of ['career_status', 'aesthetic_dna', 'voice_signature', 'story_presence', 'relationships_map']) {
      expect(src).toContain(`schema: SECTION_SCHEMAS.${sec},`); // generate-section
    }
    expect(src).not.toMatch(/"catchphrases": "their tell/);
    expect(src).not.toMatch(/"public_recognition": "who or what opposes them/);
  });

  test('catchphrases is a phrase they say; the tell is its own field', () => {
    const vs = JSON.parse(SECTION_SCHEMAS.voice_signature);
    expect(vs.catchphrases).toMatch(/a phrase they actually say/);
    expect(vs.tell).toMatch(/lying or hiding/);
  });

  test('public_recognition is awareness; unresolved_threads is what is unresolved', () => {
    expect(JSON.parse(SECTION_SCHEMAS.career_status).public_recognition).toMatch(/public awareness/);
    expect(JSON.parse(SECTION_SCHEMAS.story_presence).unresolved_threads).toMatch(/still unresolved/);
  });

  test('every schema is valid JSON', () => {
    for (const s of Object.values(SECTION_SCHEMAS)) expect(() => JSON.parse(s)).not.toThrow();
  });
});

describe('the deep profile reads the same in either shape', () => {
  const older = { class_and_money: { money_wound: 'Never enough', current_class: 'middle' } };
  const v2 = { class_money: 'She counts every dollar twice.' };

  test('deepNote takes the older note, or the v2 text', () => {
    expect(deepNote(older, 'class_money', 'money_wound')).toBe('Never enough');
    expect(deepNote(v2, 'class_money', 'money_wound')).toBe('She counts every dollar twice.');
    expect(deepNote({}, 'class_money', 'money_wound')).toBeNull();
    expect(deepNote(null, 'class_money', 'money_wound')).toBeNull();
    expect(dimension(v2, 'class_money')).toBe('She counts every dollar twice.');
  });

  test('Story Evaluation now hears a v2 deep profile', () => {
    jest.isolateModules(() => {
      const { buildDynamicDeepHints } = require('../../../src/routes/storyEvaluationRoutes');
      const hints = buildDynamicDeepHints([{ display_name: 'Nia Vale', deep_profile: v2 }], 'voice_b');
      expect(hints).toMatch(/Nia Vale: money wound: "She counts every dollar twice\."/);
      const old = buildDynamicDeepHints([{ display_name: 'David', deep_profile: older }], 'voice_b');
      expect(old).toMatch(/David: money wound: "Never enough"/);
    });
  });
});
