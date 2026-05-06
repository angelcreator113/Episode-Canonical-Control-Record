/**
 * LayoutEditor — Track 6 CP11 behavioral tests (file 11 of 17).
 *
 * 3 fetch sites migrated via 3 helpers. getCompositionApi is a CP6
 * TemplateDesigner cross-CP duplicate per v2.12 §9.11; the other
 * two are fresh.
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
  getCompositionApi,
  saveCompositionDraftApi,
  applyCompositionDraftApi,
} from './LayoutEditor';

describe('LayoutEditor — Track 6 CP11 file-local helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getCompositionApi GET on /compositions/:id (CP6 dup)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { id: 'c-1' } } });
    await getCompositionApi('c-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/compositions/c-1');
  });

  test('saveCompositionDraftApi POST on /compositions/:id/save-draft with draft_overrides wrapper', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    const overrides = { roles: { logo: { xPct: 10, yPct: 5 } } };
    await saveCompositionDraftApi('c-1', overrides);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/compositions/c-1/save-draft',
      { draft_overrides: overrides },
    );
  });

  test('applyCompositionDraftApi POST on /compositions/:id/apply-draft with regenerate_formats', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await applyCompositionDraftApi('c-1', ['YOUTUBE', 'TIKTOK']);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/compositions/c-1/apply-draft',
      { regenerate_formats: ['YOUTUBE', 'TIKTOK'] },
    );
  });

  describe('Error path propagation', () => {
    test('getCompositionApi rejection propagates (caller logs)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
      await expect(getCompositionApi('missing')).rejects.toThrow('not found');
    });

    test('saveCompositionDraftApi rejection propagates (caller alerts)', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('forbidden'));
      await expect(saveCompositionDraftApi('c-1', {})).rejects.toThrow('forbidden');
    });

    test('applyCompositionDraftApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('queue full'));
      await expect(applyCompositionDraftApi('c-1', [])).rejects.toThrow('queue full');
    });
  });
});
