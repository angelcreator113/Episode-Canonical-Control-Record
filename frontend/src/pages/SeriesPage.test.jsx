/**
 * SeriesPage — Track 6 CP5 behavioral tests (file 3 of 3 in CP5 batch).
 *
 * 8 fetch sites migrated via 7 module-scope helpers across 3 resource
 * families (/universe/series, /storyteller/books, /shows). listShowsApi
 * intentionally duplicated locally from CP2 SceneSetsTab.jsx per Track 6
 * file-local convention.
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
  // Series (universe namespace)
  listSeriesApi,
  createSeriesApi,
  updateSeriesApi,
  deleteSeriesApi,
  // Books (storyteller namespace)
  listBooksApi,
  updateBookApi,
  // Shows (duplicated from CP2)
  listShowsApi,
} from './SeriesPage';

describe('SeriesPage — Track 6 CP5 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  describe('Series (universe namespace)', () => {
    test('listSeriesApi GET on /universe/series with universe_id query', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { series: [] } });
      await listSeriesApi('universe-1');
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/universe/series?universe_id=universe-1',
      );
    });

    test('createSeriesApi POST on /universe/series', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { series: { id: 'new' } } });
      const payload = {
        universe_id: 'u-1',
        name: 'New Series',
        description: 'desc',
        order_index: 0,
      };
      await createSeriesApi(payload);
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/universe/series', payload);
    });

    test('updateSeriesApi PUT on /universe/series/:id (linkShow shape)', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
      await updateSeriesApi('s-1', { show_id: 'show-1' });
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/universe/series/s-1',
        { show_id: 'show-1' },
      );
    });

    test('updateSeriesApi PUT with show_id null (unlink)', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
      await updateSeriesApi('s-1', { show_id: null });
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/universe/series/s-1',
        { show_id: null },
      );
    });

    test('deleteSeriesApi DELETE on /universe/series/:id', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
      await deleteSeriesApi('s-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/universe/series/s-1');
    });
  });

  describe('Books (storyteller namespace)', () => {
    test('listBooksApi GET on /storyteller/books', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { books: [] } });
      await listBooksApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/storyteller/books');
    });

    test('updateBookApi PUT on /storyteller/books/:id (assignToSeries shape)', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
      await updateBookApi('b-1', { series_id: 's-1' });
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/storyteller/books/b-1',
        { series_id: 's-1' },
      );
    });

    test('updateBookApi PUT with era_name (saveEra shape)', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
      await updateBookApi('b-1', { era_name: 'Pre-Lala' });
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/storyteller/books/b-1',
        { era_name: 'Pre-Lala' },
      );
    });
  });

  describe('Shows (duplicated from CP2)', () => {
    test('listShowsApi GET on /shows', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
      await listShowsApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/shows');
    });
  });

  describe('Error path propagation', () => {
    test('listSeriesApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listSeriesApi('u-1')).rejects.toThrow('not authorized');
    });

    test('createSeriesApi exposes response.data.error for UX surface', async () => {
      const httpErr = new Error('validation');
      httpErr.response = { status: 400, data: { error: 'name required' } };
      vi.mocked(apiClient.post).mockRejectedValue(httpErr);
      await expect(createSeriesApi({})).rejects.toMatchObject({
        response: { data: { error: 'name required' } },
      });
    });

    test('deleteSeriesApi rejection propagates', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('forbidden'));
      await expect(deleteSeriesApi('s-1')).rejects.toThrow('forbidden');
    });
  });
});
