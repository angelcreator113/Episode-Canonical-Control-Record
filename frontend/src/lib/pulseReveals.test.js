/**
 * lib/pulseReveals withCityTeasers (Task 3034): in Lala's view a city's
 * first look is its teaser image, never its own; hidden shows none.
 */
import { describe, test, expect } from 'vitest';
import { withCityTeasers } from './pulseReveals';

const CITIES = [
  { key: 'dazzle_district', name: 'Dazzle', image_url: 'https://cdn/d.jpg', bubble_image_url: 'https://cdn/db.jpg' },
  { key: 'echo_park', name: 'Echo', image_url: 'https://cdn/e.jpg', bubble_image_url: 'https://cdn/eb.jpg' },
  { key: 'ascent_tower', name: 'Ascent', image_url: 'https://cdn/a.jpg' },
];

describe('withCityTeasers', () => {
  test('a teaser swaps in its teaser image (none without one); hidden removes; the rest unchanged', () => {
    const out = withCityTeasers(CITIES, {
      states: { 'city:dazzle_district': 'teaser', 'city_bubble:dazzle_district': 'teaser', 'city:echo_park': 'hidden' },
      teasers: { 'city:dazzle_district': 'https://cdn/teasers/d.jpg', 'city_bubble:dazzle_district': null },
    });
    expect(out[0]).toMatchObject({ image_url: 'https://cdn/teasers/d.jpg', bubble_image_url: null, name: 'Dazzle' });
    expect(out[1]).toMatchObject({ image_url: null, bubble_image_url: 'https://cdn/eb.jpg' });
    expect(out[2]).toEqual(CITIES[2]);
    expect(JSON.stringify(out)).not.toContain('https://cdn/d.jpg');
    expect(CITIES[0].image_url).toBe('https://cdn/d.jpg');
  });

  test('no states: the list as it is', () => {
    expect(withCityTeasers(CITIES)).toEqual(CITIES);
    expect(withCityTeasers(null)).toEqual([]);
  });
});
