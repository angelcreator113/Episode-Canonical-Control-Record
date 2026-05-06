/**
 * RecycleBin — Track 6 CP11 behavioral tests (file 1 of 17).
 *
 * 3 fetch sites migrated via 3 module-scope helpers. No cross-CP
 * duplication; all helpers fresh.
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
  listRecycleBinApi,
  restoreRecycleItemApi,
  permanentDeleteRecycleItemApi,
} from './RecycleBin';

describe('RecycleBin — Track 6 CP11 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listRecycleBinApi GET on /memories/recycle-bin returns response.data', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { books: [], chapters: [] } });
    const out = await listRecycleBinApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/memories/recycle-bin');
    expect(out).toEqual({ books: [], chapters: [] });
  });

  test('restoreRecycleItemApi POST on /memories/recycle-bin/restore', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await restoreRecycleItemApi('book', 'b-1');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/recycle-bin/restore',
      { type: 'book', id: 'b-1' },
    );
  });

  test('permanentDeleteRecycleItemApi DELETE on /memories/recycle-bin/:type/:id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await permanentDeleteRecycleItemApi('chapter', 'c-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/memories/recycle-bin/chapter/c-1');
  });

  describe('Error path propagation', () => {
    test('listRecycleBinApi rejection propagates (caller catches)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listRecycleBinApi()).rejects.toThrow('not authorized');
    });

    test('restoreRecycleItemApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('not found'));
      await expect(restoreRecycleItemApi('book', 'missing')).rejects.toThrow('not found');
    });

    test('permanentDeleteRecycleItemApi rejection propagates', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('forbidden'));
      await expect(permanentDeleteRecycleItemApi('book', 'b-1')).rejects.toThrow('forbidden');
    });
  });
});
