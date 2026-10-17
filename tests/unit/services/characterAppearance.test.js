'use strict';

/**
 * Appearance, the pure parts: the stored shape and the portrait prompt.
 */
const { normalizeAppearance, appearanceLines, portraitPrompt, AppearanceError } = require('../../../src/services/characterAppearance');

describe('normalizeAppearance', () => {
  test('keeps what is written, trimmed; palette as a short list; who and when', () => {
    const out = normalizeAppearance({ summary: '  Tall,  still ', hair: '', palette: 'oat, ink,, bone', unknown: 'x', why: 'Because.' }, { by: 'evoni' });
    expect(out).toMatchObject({ summary: 'Tall, still', palette: ['oat', 'ink', 'bone'], why: 'Because.', set_by: 'evoni' });
    expect(out.hair).toBeUndefined();
    expect(out.unknown).toBeUndefined();
  });

  test('nothing written is an error', () => {
    expect(() => normalizeAppearance({ summary: ' ' })).toThrow(AppearanceError);
  });
});

describe('appearanceLines and portraitPrompt', () => {
  const look = { summary: 'Tall, still', face: 'Sharp', palette: ['oat', 'ink'], going_out: 'A linen column dress', never_wears: 'Logos' };

  test('lines in order, labelled', () => {
    expect(appearanceLines(look)).toBe('- at a glance: Tall, still\n- face: Sharp\n- palette: oat, ink\n- going out: A linen column dress\n- never seen in: Logos');
    expect(appearanceLines(null)).toBe('');
  });

  test('the portrait is an original fictional person, with no text or brands', () => {
    const p = portraitPrompt(look, 'Maren');
    expect(p).toMatch(/^Photorealistic editorial portrait photograph of Maren, an original fictional person/);
    expect(p).toContain('Wearing: A linen column dress');
    expect(p).toContain('Colour palette: oat, ink');
    expect(p).toContain('No text, no letters, no logos, no brand names');
  });
});
