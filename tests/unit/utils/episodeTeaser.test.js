/**
 * Viewer teaser helpers (Task #2386; P12, P13).
 */
const {
  TEASER_HOOK_CHARS, TEASER_MAX_CHARS, TEASER_INSTRUCTION, SYNOPSIS_INSTRUCTION,
  normalizeTeaser, teaserHook, teaserStateOf,
} = require('../../../src/utils/episodeTeaser');

describe('normalizeTeaser', () => {
  test('trims, collapses whitespace and strips wrapping quotes', () => {
    expect(normalizeTeaser('  One   invitation.\n\nTwo  rules.  ')).toBe('One invitation. Two rules.');
    expect(normalizeTeaser('"Who sent the invitation?"')).toBe('Who sent the invitation?');
    expect(normalizeTeaser('“Who sent it?”')).toBe('Who sent it?');
  });

  test('non-strings and empty text are null (no teaser)', () => {
    for (const v of [undefined, null, 42, {}, [], '', '   ', '""']) expect(normalizeTeaser(v)).toBeNull();
  });

  test('caps at TEASER_MAX_CHARS on a word boundary', () => {
    const long = 'word '.repeat(200);
    const out = normalizeTeaser(long);
    expect(out.length).toBeLessThanOrEqual(TEASER_MAX_CHARS);
    expect(out.endsWith('word')).toBe(true);
  });

  test('a teaser that only restates the event description is dropped (P12: separate from it)', () => {
    const desc = 'Join us at the Maison Rue launch.  Champagne at eight.';
    expect(normalizeTeaser('join us at the Maison Rue launch. Champagne at eight.', { eventDescription: desc })).toBeNull();
    expect(normalizeTeaser('Someone at Maison Rue knows her name.', { eventDescription: desc })).toBe('Someone at Maison Rue knows her name.');
  });
});

describe('teaserHook', () => {
  test('is the first 150 characters', () => {
    expect(TEASER_HOOK_CHARS).toBe(150);
    const t = 'a'.repeat(160);
    expect(teaserHook(t)).toHaveLength(150);
    expect(teaserHook('short')).toBe('short');
    expect(teaserHook(null)).toBe('');
  });
});

describe('teaserStateOf (doctrine rule 14)', () => {
  test('missing, auto_drafted, edited, set', () => {
    expect(teaserStateOf({})).toBe('missing');
    expect(teaserStateOf({ teaser: '  ', teaser_drafted: 'x' })).toBe('missing');
    expect(teaserStateOf({ teaser: 'Who is she?', teaser_drafted: 'Who is she?' })).toBe('auto_drafted');
    expect(teaserStateOf({ teaser: 'Who is he?', teaser_drafted: 'Who is she?' })).toBe('edited');
    expect(teaserStateOf({ teaser: 'Who is she?', teaser_drafted: null })).toBe('set');
  });
});

describe('prompt instructions', () => {
  test('the teaser rule: mystery, hook in the first 150 characters, from concept and description, never the outcome', () => {
    expect(TEASER_INSTRUCTION).toMatch(/Mystery-driven/);
    expect(TEASER_INSTRUCTION).toMatch(/first 150 characters/);
    expect(TEASER_INSTRUCTION).toMatch(/EVENT CONCEPT and EVENT DESCRIPTION/);
    expect(TEASER_INSTRUCTION).toMatch(/Never reveal the outcome/);
    expect(TEASER_INSTRUCTION).not.toMatch(/"/);
  });

  test('the description is an internal synopsis, not YouTube copy (P13)', () => {
    expect(SYNOPSIS_INSTRUCTION).toMatch(/Internal synopsis/);
    expect(SYNOPSIS_INSTRUCTION).toMatch(/never shown to viewers/);
    expect(SYNOPSIS_INSTRUCTION).not.toMatch(/YouTube/);
    expect(SYNOPSIS_INSTRUCTION).not.toMatch(/"/);
  });
});
