/**
 * SocialImport — Track 6 CP9 behavioral tests (file 2 of 8).
 *
 * 5 fetch sites migrated via 5 module-scope helpers on /stories/social/*.
 * listCharacterSocialApi duplicated locally per v2.12 §9.11 (CP8 NovelAssembler
 * has it).
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
  importSocialApi,
  listCharacterSocialApi,
  updateSocialItemApi,
  detectLalaApi,
  deleteSocialItemApi,
} from './SocialImport';

describe('SocialImport — Track 6 CP9 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('importSocialApi POST on /stories/social/import', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, import: {} } });
    const payload = { character_key: 'lala', platform: 'tiktok', raw_content: '...' };
    await importSocialApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/stories/social/import', payload);
  });

  test('listCharacterSocialApi GET on /stories/social/character/:charKey (CP8 dup)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { imports: [] } });
    await listCharacterSocialApi('lala');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/stories/social/character/lala');
  });

  test('updateSocialItemApi PATCH on /stories/social/:id', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
    await updateSocialItemApi('s-1', { canon_status: 'canon' });
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/api/v1/stories/social/s-1',
      { canon_status: 'canon' },
    );
  });

  test('detectLalaApi POST on /stories/social/:id/detect-lala (no body)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, import: {} } });
    await detectLalaApi('s-1');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/stories/social/s-1/detect-lala');
  });

  test('deleteSocialItemApi DELETE on /stories/social/:id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await deleteSocialItemApi('s-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/stories/social/s-1');
  });

  describe('Error path propagation', () => {
    test('importSocialApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('not authorized'));
      await expect(importSocialApi({})).rejects.toThrow('not authorized');
    });

    test('importSocialApi exposes response.data.error for UX surface', async () => {
      const httpErr = new Error('validation');
      httpErr.response = { status: 400, data: { error: 'platform required' } };
      vi.mocked(apiClient.post).mockRejectedValue(httpErr);
      await expect(importSocialApi({})).rejects.toMatchObject({
        response: { data: { error: 'platform required' } },
      });
    });

    test('detectLalaApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('busy'));
      await expect(detectLalaApi('s-1')).rejects.toThrow('busy');
    });
  });
});
