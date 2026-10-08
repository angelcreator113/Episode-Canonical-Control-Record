/**
 * World Studio's Demographics panel names a registry character's city:
 * one of the five DREAM cities, or outside the LalaVerse. It knew only the
 * old five (Nova Prime, Velour City, ...), so a DREAM city showed as its
 * raw key ("echo_park").
 */
import { vi, describe, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));
vi.mock('./RelationshipEngine', () => ({ default: () => null }));
vi.mock('./SocialProfileGenerator', () => ({ default: () => null }));

import { CITY_LABELS } from './WorldStudio';
import { DREAM_CITIES } from '../data/dreamCities';

describe('WorldStudio — registry city labels', () => {
  test('each DREAM city by its name, and outside the LalaVerse', () => {
    for (const city of DREAM_CITIES) expect(CITY_LABELS[city.key]).toBe(city.name);
    expect(CITY_LABELS.echo_park).toBe('Echo Park');
    expect(CITY_LABELS.outside_lalaverse).toBe('Outside LalaVerse');
    expect(CITY_LABELS.unknown).toBe('Unknown');
  });

  test('no old city', () => {
    for (const old of ['nova_prime', 'velour_city', 'the_drift', 'solenne', 'cascade_row']) {
      expect(CITY_LABELS).not.toHaveProperty(old);
    }
  });
});
