import { describe, test, expect } from 'vitest';
import { inCity, venueLine, cityPlaces, placeCounts, citySchools, cityCompanies } from './dreamCityExplorer';
import { DREAM_CITIES, UNIVERSITIES, CORPORATIONS } from '../data/dreamCities';

const ECHO = DREAM_CITIES.find((c) => c.key === 'echo_park');

describe('the city explorer helpers', () => {
  test('a free-text city names the DREAM city by its name or key, any case', () => {
    expect(inCity('Echo Park', ECHO)).toBe(true);
    expect(inCity(' echo   park ', ECHO)).toBe(true);
    expect(inCity('echo_park', ECHO)).toBe(true);
    expect(inCity('Echo Parkway', ECHO)).toBe(false);
    expect(inCity('', ECHO)).toBe(false);
  });

  test('a venue says which events use it, else what it is', () => {
    expect(venueLine({ events: [{ name: 'Wearable Experiments Studio Session' }] })).toBe('Used by Wearable Experiments Studio Session');
    expect(venueLine({ events: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] })).toBe('Used by A and 2 other events');
    expect(venueLine({ venue_type: 'rooftop', district: 'Neon Strip', events: [] })).toBe('rooftop · Neon Strip · no events here yet');
    expect(venueLine({})).toBe('No events here yet');
  });

  test('a city\'s places are its locations but the city row, venues and busy ones first', () => {
    const locations = [
      { id: 1, name: 'Echo Park', location_type: 'city', city: 'Echo Park' },
      { id: 2, name: 'Loft', location_type: 'property', city: 'Echo Park' },
      { id: 3, name: "STUDIO BY SABLE's Studio", location_type: 'venue', city: 'echo park', events: [{ id: 'e', name: 'Session' }] },
      { id: 4, name: 'Bar', location_type: 'venue', city: 'Echo Park' },
      { id: 5, name: 'Elsewhere', location_type: 'venue', city: 'Dazzle District' },
    ];
    expect(cityPlaces(locations, ECHO).map((p) => p.name)).toEqual(["STUDIO BY SABLE's Studio", 'Bar', 'Loft']);
    expect(placeCounts(locations, DREAM_CITIES)).toMatchObject({ echo_park: 3, dazzle_district: 1, radiance_row: 0 });
  });

  test('schools come by city; companies with no city are counted, never guessed', () => {
    const dazzle = DREAM_CITIES.find((c) => c.key === 'dazzle_district');
    expect(citySchools(UNIVERSITIES, dazzle).map((u) => u.name)).toEqual(['The Dazzle Academy']);
    expect(citySchools(UNIVERSITIES, ECHO)).toEqual([]);
    expect(cityCompanies(CORPORATIONS, dazzle)).toEqual({ here: [], unplaced: CORPORATIONS });
    expect(cityCompanies([{ name: 'Nova Studios', city: 'Echo Park' }, { name: 'X' }], ECHO)).toEqual({ here: [{ name: 'Nova Studios', city: 'Echo Park' }], unplaced: [{ name: 'X' }] });
  });
});
