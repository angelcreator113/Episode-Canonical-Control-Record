/**
 * The Dream Cities' Pulse fields (Task #2920): saving changes one city in
 * the DREAM_CITIES override and keeps every other city and field.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import api from '../services/api';
import { DREAM_CITIES } from '../data/dreamCities';
import { mergeCity, paletteOf, saveCity, SPEC_PALETTES } from './pulseCities';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

describe('mergeCity', () => {
  const list = [
    { key: 'dazzle_district', name: 'Dazzle District', color: '#d4789a', lightColor: '#fdf2f6', custom_note: 'kept' },
    { key: 'echo_park', name: 'Echo Park', color: '#c9a84c', image_url: 'https://cdn/echo.jpg' },
  ];

  test('changes one city; the others and unknown fields are kept', () => {
    const next = mergeCity(list, 'dazzle_district', { image_url: 'https://cdn/d.jpg', image_alt: 'Runway at night' });
    expect(next[0]).toEqual({ ...list[0], image_url: 'https://cdn/d.jpg', image_alt: 'Runway at night' });
    expect(next[1]).toBe(list[1]);
  });

  test('a palette moves `color` to its first colour and leaves lightColor alone', () => {
    const next = mergeCity(list, 'dazzle_district', { palette: ['#B76E79', '#F2EDE4'] });
    expect(next[0]).toMatchObject({ palette: ['#B76E79', '#F2EDE4'], color: '#B76E79', lightColor: '#fdf2f6' });
  });

  test('an unknown city is an error, not a silent no-op', () => {
    expect(() => mergeCity(list, 'nowhere', { image_url: 'x' })).toThrow(/not in the Dream Cities list/);
  });
});

describe('paletteOf', () => {
  test('a saved palette, else the spec palette, else the one colour', () => {
    expect(paletteOf({ key: 'echo_park', palette: ['#111111'] })).toEqual(['#111111']);
    expect(paletteOf({ key: 'echo_park', color: '#c9a84c' })).toEqual(SPEC_PALETTES.echo_park);
    expect(paletteOf({ key: 'somewhere_new', color: '#123456' })).toEqual(['#123456']);
  });
});

describe('saveCity', () => {
  test('with no override yet, saves the built-in list with the one change', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    vi.mocked(api.put).mockResolvedValue({ data: { saved: true } });
    const next = await saveCity('radiance_row', { bubble_image_url: 'https://cdn/r.jpg' });
    expect(api.get).toHaveBeenCalledWith('/api/v1/page-content/world_infrastructure');
    const [url, body] = vi.mocked(api.put).mock.calls[0];
    expect(url).toBe('/api/v1/page-content/world_infrastructure/DREAM_CITIES');
    expect(body.data).toHaveLength(DREAM_CITIES.length);
    expect(body.data.find((c) => c.key === 'radiance_row').bubble_image_url).toBe('https://cdn/r.jpg');
    expect(body.data.find((c) => c.key === 'dazzle_district')).toEqual(DREAM_CITIES.find((c) => c.key === 'dazzle_district'));
    expect(next).toEqual(body.data);
  });

  test('with an override, merges onto the saved list, not the built-in one', async () => {
    const saved = DREAM_CITIES.map((c) => (c.key === 'echo_park' ? { ...c, subtitle: 'Edited in World', palette: ['#7B4FC9'] } : c));
    vi.mocked(api.get).mockResolvedValue({ data: { DREAM_CITIES: saved, UNIVERSITIES: [] } });
    vi.mocked(api.put).mockResolvedValue({ data: { saved: true } });
    await saveCity('echo_park', { image_url: 'https://cdn/e.jpg' });
    const echo = vi.mocked(api.put).mock.calls[0][1].data.find((c) => c.key === 'echo_park');
    expect(echo).toMatchObject({ subtitle: 'Edited in World', palette: ['#7B4FC9'], image_url: 'https://cdn/e.jpg' });
  });
});
