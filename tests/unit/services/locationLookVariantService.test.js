/**
 * The prompts of a venue's time and season variants (2026-10-15;
 * docs/VENUE_EVERYDAY_AND_EVENT_LOOKS_PLAN.md step 2): the place and the
 * view stay as the reference shows them; a time changes only the light, a
 * season only the outside.
 */
const { variantPrompt, KINDS, LookVariantError } = require('../../../src/services/locationLookVariantService');
const { TIME_LIGHT, SEASON_TEXT, BRIEF_RULES } = require('../../../src/services/sceneBriefService');

describe('variantPrompt', () => {
  test('a time leads with its light and keeps the place and the view', () => {
    const p = variantPrompt('time', 'evening');
    expect(p.startsWith(TIME_LIGHT.evening)).toBe(true);
    expect(p).toMatch(/same place and the same view as the reference image, exactly/);
    expect(p).toMatch(/Only the light and the time of day change/);
    for (const rule of BRIEF_RULES) expect(p).toContain(rule);
  });

  test('a season leads with the season and changes only the outside', () => {
    const p = variantPrompt('season', 'winter');
    expect(p.startsWith(SEASON_TEXT.winter)).toBe(true);
    expect(p).toMatch(/Only the season changes outside: the trees, plants, ground, sky and weather show winter\./);
    expect(p).not.toMatch(/lamps are lit/);
  });

  test('every slot has a prompt; anything else is refused', () => {
    for (const [kind, values] of Object.entries(KINDS)) for (const v of values) expect(variantPrompt(kind, v)).toBeTruthy();
    expect(KINDS.time).toEqual(['morning', 'afternoon', 'golden_hour', 'evening', 'night']);
    expect(KINDS.season).toEqual(['spring', 'summer', 'fall', 'winter']);
    expect(() => variantPrompt('weather', 'rain')).toThrow(LookVariantError);
    expect(() => variantPrompt('time', 'noon')).toThrow(/time must be one of/);
  });
});
