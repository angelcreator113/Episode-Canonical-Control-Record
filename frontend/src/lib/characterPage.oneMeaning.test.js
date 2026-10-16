/**
 * One meaning per field on the character page (Evoni, 2026-10-16): one city,
 * and "never says" from either deep-profile shape.
 */
import { describe, test, expect } from 'vitest';
import { cityOf, voiceOf } from './characterPage';

describe('cityOf', () => {
  test('the feed city, else the character\'s own', () => {
    expect(cityOf({}, { city: 'echo_park' })).toEqual({ label: 'Echo Park', differs: null });
    expect(cityOf({ current_city: 'radiance_row' }, null)).toEqual({ label: 'Radiance Row', differs: null });
    expect(cityOf({}, null)).toEqual({ label: null, differs: null });
  });
  test('names both when they disagree', () => {
    expect(cityOf({ current_city: 'radiance_row' }, { city: 'echo_park' }))
      .toEqual({ label: 'Echo Park', differs: { feed: 'Echo Park', own: 'Radiance Row' } });
    expect(cityOf({ current_city: 'echo_park' }, { city: 'echo_park' }).differs).toBeNull();
  });
  test("'outside_lalaverse' is not a city", () => {
    expect(cityOf({ current_city: 'outside_lalaverse' }, { city: 'echo_park' })).toEqual({ label: 'Echo Park', differs: null });
    expect(cityOf({ current_city: 'outside_lalaverse' }, null).label).toBeNull();
  });
});

describe('voiceOf never says', () => {
  test('from the older note', () => {
    const v = voiceOf({ deep_profile: { speech_and_silence: { what_they_never_say_directly: 'I am scared.' } } }, null);
    expect(v.neverSays).toBe('I am scared.');
  });
  test('from the v2 speech text', () => {
    const v = voiceOf({ deep_profile: { speech_silence: 'She never says she is tired.' } }, null);
    expect(v.neverSays).toBe('She never says she is tired.');
  });
});
