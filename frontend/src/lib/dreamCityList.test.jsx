/**
 * One DREAM city list (2026-10-18): a page that shows a city shows the
 * saved list's words and colour over the built-in city, by key, keeping
 * the page's own fields; with nothing saved, or a failed read, the
 * built-in list.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import api from '../services/api';
import { DREAM_CITIES } from '../data/dreamCities';
import { withSaved, useDreamCities, forgetSavedCities } from './dreamCityList';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

beforeEach(() => { vi.clearAllMocks(); forgetSavedCities(); });

describe('withSaved', () => {
  test('a saved city lays its fields over the built-in one; the page\'s own fields stay', () => {
    const base = [{ key: 'echo_park', name: 'Echo Park', color: '#c9a84c', x: 52 }, { key: 'radiance_row', name: 'Radiance Row', color: '#a889c8' }];
    const out = withSaved(base, [{ key: 'echo_park', color: '#7B4FC9', energy: 'Loud.' }, { key: 'nowhere', name: 'x' }]);
    expect(out).toEqual([{ key: 'echo_park', name: 'Echo Park', color: '#7B4FC9', energy: 'Loud.', x: 52 }, base[1]]);
    expect(withSaved(base, null)).toBe(base);
  });
});

describe('useDreamCities', () => {
  test('the built-in list, then the saved one once read', async () => {
    api.get.mockResolvedValueOnce({ data: { DREAM_CITIES: [{ key: 'echo_park', energy: 'Karaoke capital.' }] } });
    const { result } = renderHook(() => useDreamCities());
    expect(result.current).toBe(DREAM_CITIES);
    await waitFor(() => expect(result.current.find((c) => c.key === 'echo_park').energy).toBe('Karaoke capital.'));
    expect(api.get).toHaveBeenCalledWith('/api/v1/page-content/world_infrastructure');
  });

  test('a failed read is logged and leaves the built-in list', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.get.mockRejectedValueOnce(new Error('down'));
    const { result } = renderHook(() => useDreamCities());
    await waitFor(() => expect(err).toHaveBeenCalled());
    expect(result.current).toBe(DREAM_CITIES);
    err.mockRestore();
  });
});
