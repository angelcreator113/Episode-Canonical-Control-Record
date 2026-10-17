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
    const p = variantPrompt('time', 'night');
    expect(p.startsWith(TIME_LIGHT.night)).toBe(true);
    expect(p).toMatch(/same place and the same view as the reference image, exactly/);
    expect(p).toMatch(/Only the light and the time of day change/);
    for (const rule of BRIEF_RULES) expect(p).toContain(rule);
  });

  test('a season leads with the season and changes only the outside', () => {
    const p = variantPrompt('season', 'winter');
    expect(p.startsWith(SEASON_TEXT.winter)).toBe(true);
    expect(p).toMatch(/Only the weather changes outside: the trees, plants, ground, sky and weather show winter\./);
    expect(p).not.toMatch(/lamps are lit/);
  });

  // Evoni, 2026-10-17: the seasons became Weather, Winter and Rain.
  test('rain leads with the rain and changes only the outside', () => {
    const p = variantPrompt('season', 'rain');
    expect(p.startsWith(SEASON_TEXT.rain)).toBe(true);
    expect(p).toMatch(/show rain falling, with wet ground and reflections\./);
  });

  test('every slot has a prompt; anything else is refused', () => {
    for (const [kind, values] of Object.entries(KINDS)) for (const v of values) expect(variantPrompt(kind, v)).toBeTruthy();
    // Evoni, 2026-10-17: Afternoon, Evening, Spring, Summer and Fall are no
    // longer offered (hidden, not deleted); Rain is new.
    expect(KINDS.time).toEqual(['morning', 'golden_hour', 'night']);
    expect(KINDS.season).toEqual(['winter', 'rain']);
    expect(() => variantPrompt('time', 'afternoon')).toThrow(/time must be one of morning, golden_hour, night/);
    expect(() => variantPrompt('season', 'spring')).toThrow(/season must be one of winter, rain/);
    expect(() => variantPrompt('weather', 'rain')).toThrow(LookVariantError);
    expect(() => variantPrompt('time', 'noon')).toThrow(/time must be one of/);
  });
});
