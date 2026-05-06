/**
 * usePageData — Track 6 CP11 behavioral tests (file 6 of 17).
 *
 * 3 fetch sites migrated via 3 module-scope helpers exported from
 * the hook file. Hook-module-scope helper pattern (v2.16 §9.11
 * lock — second instance after CP9). The hook itself uses these
 * helpers internally; tests here cover the helpers directly.
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
  getPageContentApi,
  putPageContentKeyApi,
  deletePageContentKeyApi,
} from './usePageData';

describe('usePageData — Track 6 CP11 hook-module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getPageContentApi GET on /page-content/:name (URI-encoded)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { CELEBRITY_HIERARCHY: [] } });
    await getPageContentApi('cultural calendar');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/page-content/cultural%20calendar');
  });

  test('putPageContentKeyApi PUT on /page-content/:name/:key with data wrapper', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    await putPageContentKeyApi('cultural_calendar', 'FASHION_TIERS', [{ id: 1 }]);
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/page-content/cultural_calendar/FASHION_TIERS',
      { data: [{ id: 1 }] },
    );
  });

  test('putPageContentKeyApi URI-encodes special chars in name + key', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    await putPageContentKeyApi('a/b', 'KEY/X', []);
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/page-content/a%2Fb/KEY%2FX',
      { data: [] },
    );
  });

  test('deletePageContentKeyApi DELETE on /page-content/:name/:key', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await deletePageContentKeyApi('cultural_calendar', 'FASHION_TIERS');
    expect(apiClient.delete).toHaveBeenCalledWith(
      '/api/v1/page-content/cultural_calendar/FASHION_TIERS',
    );
  });

  describe('Error path propagation', () => {
    test('getPageContentApi rejection propagates (caller swallows)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(getPageContentApi('p')).rejects.toThrow('not authorized');
    });

    test('putPageContentKeyApi rejection propagates', async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error('forbidden'));
      await expect(putPageContentKeyApi('p', 'k', [])).rejects.toThrow('forbidden');
    });

    test('deletePageContentKeyApi rejection propagates', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('not found'));
      await expect(deletePageContentKeyApi('p', 'k')).rejects.toThrow('not found');
    });
  });
});
