/**
 * A post's location (Task 3090): the picker's values, the fields it sends,
 * venues grouped by city, and the post's place label.
 */
import { describe, test, expect } from 'vitest';
import { placeBody, placeGroups, placeOfPost, placeValue } from './pulsePlaces';

describe('pulsePlaces', () => {
  test('the picker sends a city, a venue, or nothing', () => {
    expect(placeBody(placeValue('city', 'echo_park'))).toEqual({ place_city: 'echo_park' });
    expect(placeBody(placeValue('venue', 'a-b-c'))).toEqual({ place_location_id: 'a-b-c' });
    expect(placeBody('')).toEqual({});
    expect(placeBody('city:')).toEqual({});
    expect(placeBody('planet:mars')).toEqual({});
  });

  test('venues group by Dream City in order; a venue with no city comes last', () => {
    const groups = placeGroups({ venues: [
      { id: '1', name: 'Velvet Room', city: 'echo_park' },
      { id: '2', name: 'Atelier', city: 'dazzle_district' },
      { id: '3', name: 'Somewhere', city: null },
    ] });
    expect(groups.map((g) => [g.name, g.venues.map((v) => v.name)])).toEqual([
      ['Dazzle District', ['Atelier']], ['Echo Park', ['Velvet Room']], ['Other venues', ['Somewhere']],
    ]);
    expect(placeGroups(null)).toEqual([]);
  });

  test("a post's place: its tag, else its poster's city, else null", () => {
    expect(placeOfPost({ place: { city: 'echo_park', name: 'Velvet Room' } })).toEqual({ key: 'echo_park', label: 'Velvet Room · Echo Park' });
    expect(placeOfPost({ place: { city: 'radiance_row', city_name: 'Radiance Row', name: null }, socialProfile: { city: 'echo_park' } }))
      .toEqual({ key: 'radiance_row', label: 'Radiance Row' });
    expect(placeOfPost({ place: { city: null, name: 'Somewhere' } })).toEqual({ key: null, label: 'Somewhere' });
    expect(placeOfPost({ socialProfile: { city: 'maverick_harbor' } })).toEqual({ key: 'maverick_harbor', label: 'Maverick Harbor' });
    expect(placeOfPost({ socialProfile: { city: 'nowhere' } })).toBeNull();
  });
});
