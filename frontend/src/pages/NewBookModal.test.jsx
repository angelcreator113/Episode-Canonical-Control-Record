/**
 * NewBookModal — Track 6 CP10 behavioral tests (file 3 of 8).
 *
 * 4 fetch sites migrated via 3 module-scope helpers — getUniverseApi covers
 * 2 sites (initial load + onSeriesChange callback). File-local per Track 6
 * convention; no cross-CP overlap.
 */

import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

import apiClient from '../services/api';
import {
  listAllSeriesApi,
  getUniverseApi,
  createBookApi,
} from './NewBookModal';

describe('NewBookModal — Track 6 CP10 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listAllSeriesApi GET on /universe/series (no query)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { series: [] } });
    await listAllSeriesApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/universe/series');
  });

  test('getUniverseApi GET on /universe/:id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { universe: {} } });
    await getUniverseApi('u-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/universe/u-1');
  });

  test('createBookApi POST on /storyteller/books', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { book: { id: 'b-1' } } });
    const payload = {
      show_id: 'show-1',
      series_id: 's-1',
      title: 'Book 1',
      description: null,
      primary_pov: 'first_person',
      era_name: null,
      timeline_position: 'Pre-Show',
      canon_status: 'draft',
    };
    await createBookApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/storyteller/books', payload);
  });

  describe('Error path propagation', () => {
    test('listAllSeriesApi rejection propagates (caller .catch null)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listAllSeriesApi()).rejects.toThrow('not authorized');
    });

    test('createBookApi exposes response.data.error for UX', async () => {
      const httpErr = new Error('validation');
      httpErr.response = { status: 400, data: { error: 'title required' } };
      vi.mocked(apiClient.post).mockRejectedValue(httpErr);
      await expect(createBookApi({})).rejects.toMatchObject({
        response: { data: { error: 'title required' } },
      });
    });

    test('getUniverseApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
      await expect(getUniverseApi('missing')).rejects.toThrow('not found');
    });
  });
});
