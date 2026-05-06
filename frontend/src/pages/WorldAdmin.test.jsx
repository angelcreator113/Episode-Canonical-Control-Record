/**
 * WorldAdmin — Track 6 CP13 behavioral tests.
 *
 * 11 fetch sites total. 11 migrated via 11 module-scope helpers.
 * 0 Pattern G locked (admin page shape — no streaming).
 *
 * Cross-CP duplications per v2.12 §9.11:
 *   - listEpisodeTodoSocialApi (CP9 EpisodeTodoPage + CP13 = 2-fold)
 *   - listWorldEventsApi (service-module precedence — 7+ component consumers)
 *   - listShowWardrobeApi (wardrobeService.js + 7-component precedence inversion v2.16)
 *   - updateWardrobeItemApi (wardrobeService.js precedence inversion v2.16)
 *
 * NEW v2.20 §9.11 candidate at bulkWardrobeOpApi: Data-driven URL pass-
 * through. Single helper for config-array-dispatch where method/payload/
 * headers are uniform and URLs are file-internal. Tests parameterize over
 * the 4 endpoint variants in the config array (lines 5539-5542 of source).
 *
 * Multipart helper uploadWardrobeApi per v2.14 — FormData passed directly
 * to api.post; services/api.js interceptor strips JSON Content-Type.
 *
 * File-local convention: this file uses `api.` import style (line 22 of
 * source) — tests use the same default-export mock.
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

import api from '../services/api';
import {
  listEpisodeTodoSocialApi,
  listWorldEventsApi,
  listShowWardrobeApi,
  updateWardrobeItemApi,
  promoteWardrobePrimaryVariantApi,
  sendWardrobeToPhoneApi,
  regenerateWardrobeProductShotApi,
  getWardrobeUsageApi,
  bulkWardrobeOpApi,
  uploadWardrobeApi,
  createOutfitSetApi,
} from './WorldAdmin';

describe('WorldAdmin — Track 6 CP13 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
  });

  // ── Cross-CP dups ───────────────────────────────────────────────────────

  test('listEpisodeTodoSocialApi GET on /episodes/:id/todo/social (CP9 dup, 2-fold)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { social_tasks: [] } });
    const out = await listEpisodeTodoSocialApi('ep-1');
    expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/todo/social');
    expect(out).toEqual({ social_tasks: [] });
  });

  test('listWorldEventsApi GET on /world/:show/events (service-module precedence)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { events: [] } });
    await listWorldEventsApi('s-1');
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/s-1/events');
  });

  test('listShowWardrobeApi GET on /shows/:show/wardrobe (wardrobeService precedence inversion)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
    await listShowWardrobeApi('s-1');
    expect(api.get).toHaveBeenCalledWith('/api/v1/shows/s-1/wardrobe');
  });

  test('updateWardrobeItemApi PUT on /wardrobe/:id (wardrobeService precedence inversion)', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    await updateWardrobeItemApi('w-1', { is_favorite: true });
    expect(api.put).toHaveBeenCalledWith('/api/v1/wardrobe/w-1', { is_favorite: true });
  });

  // ── Fresh wardrobe-detail helpers ───────────────────────────────────────

  test('promoteWardrobePrimaryVariantApi PATCH on /wardrobe/:id/primary-variant', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    await promoteWardrobePrimaryVariantApi('w-1', 'pink');
    expect(api.patch).toHaveBeenCalledWith(
      '/api/v1/wardrobe/w-1/primary-variant',
      { variant: 'pink' },
    );
  });

  test('sendWardrobeToPhoneApi POST on /wardrobe/:id/send-to-phone', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { name: 'Phone Screen' } } });
    const out = await sendWardrobeToPhoneApi('w-1', { variant: 'pink', showId: 's-1' });
    expect(api.post).toHaveBeenCalledWith(
      '/api/v1/wardrobe/w-1/send-to-phone',
      { variant: 'pink', showId: 's-1' },
    );
    expect(out.data.name).toBe('Phone Screen');
  });

  test('regenerateWardrobeProductShotApi POST on /wardrobe/:id/regenerate-product-shot (no body)', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { s3_url_regenerated: 'https://...' } } });
    await regenerateWardrobeProductShotApi('w-1');
    expect(api.post).toHaveBeenCalledWith('/api/v1/wardrobe/w-1/regenerate-product-shot');
  });

  test('getWardrobeUsageApi GET on /wardrobe/:id/usage', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { episodes: [] } } });
    await getWardrobeUsageApi('w-1');
    expect(api.get).toHaveBeenCalledWith('/api/v1/wardrobe/w-1/usage');
  });

  // ── Site 11: createOutfitSetApi ─────────────────────────────────────────

  test('createOutfitSetApi POST on /outfit-sets', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    const payload = { name: 'Set A', character: 'Lala', items: [], show_id: 's-1' };
    await createOutfitSetApi(payload);
    expect(api.post).toHaveBeenCalledWith('/api/v1/outfit-sets', payload);
  });

  // ── Site 6: Option B Data-driven URL pass-through (parameterized) ──────

  describe('bulkWardrobeOpApi — v2.20 §9.11 Data-driven URL pass-through', () => {
    // The 4 variants enumerated in WorldAdmin.jsx config array (lines 5539-5542).
    // Verify each variant dispatches correctly through the single helper.
    const variants = [
      {
        label: '✨ AI-enhance first 20',
        endpoint: '/api/v1/wardrobe/bulk/enhance',
        body: { itemIds: ['w-1', 'w-2'] },
      },
      {
        label: '🔍 AI-analyze first 20',
        endpoint: '/api/v1/wardrobe/bulk/analyze',
        body: { itemIds: ['w-1', 'w-2'], autoApply: true },
      },
      {
        label: '🖼 Regenerate missing thumbnails',
        endpoint: '/api/v1/wardrobe/bulk/regenerate-thumbnails',
        body: { limit: 50 },
      },
      {
        label: '💰 Sync coin costs',
        endpoint: '/api/v1/wardrobe/bulk/sync-coin-costs?show_id=s-1',
        body: {},
      },
    ];

    test.each(variants)(
      'dispatches "$label" via bulkWardrobeOpApi(endpoint=$endpoint)',
      async ({ endpoint, body }) => {
        vi.mocked(api.post).mockResolvedValue({ data: { data: { succeeded: [], failed: [] } } });
        await bulkWardrobeOpApi(endpoint, body);
        expect(api.post).toHaveBeenCalledWith(endpoint, body);
      },
    );

    test('returns response.data (unwrapped) for downstream succ/fail tally', async () => {
      vi.mocked(api.post).mockResolvedValue({
        data: { data: { succeeded: [{ id: 'w-1' }], failed: [] } },
      });
      const out = await bulkWardrobeOpApi('/api/v1/wardrobe/bulk/enhance', { itemIds: ['w-1'] });
      expect(out.data.succeeded).toHaveLength(1);
    });
  });

  // ── Site 10: Multipart upload (v2.14) ──────────────────────────────────

  describe('uploadWardrobeApi — v2.14 §9.11 multipart pattern', () => {
    test('passes FormData directly to api.post (no manual Content-Type)', async () => {
      vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'w-new' } } });
      const fd = new FormData();
      fd.append('name', 'Silk Top');
      fd.append('clothingCategory', 'top');
      fd.append('showId', 's-1');
      const out = await uploadWardrobeApi(fd);
      expect(api.post).toHaveBeenCalledWith('/api/v1/wardrobe', fd);
      // Verify the second argument IS the FormData instance — NOT a serialized
      // object. Interceptor at services/api.js:21-26 handles Content-Type.
      const callArgs = vi.mocked(api.post).mock.calls[0];
      expect(callArgs[1]).toBeInstanceOf(FormData);
      expect(out.data.id).toBe('w-new');
    });

    test('does NOT pass any third-arg config (interceptor handles Content-Type)', async () => {
      vi.mocked(api.post).mockResolvedValue({ data: {} });
      const fd = new FormData();
      await uploadWardrobeApi(fd);
      const callArgs = vi.mocked(api.post).mock.calls[0];
      expect(callArgs).toHaveLength(2); // url + formData only
    });
  });

  // ── Error path propagation ─────────────────────────────────────────────

  describe('Error path propagation', () => {
    test('listEpisodeTodoSocialApi rejection propagates (caller .catch → empty)', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('not authorized'));
      await expect(listEpisodeTodoSocialApi('ep-1')).rejects.toThrow('not authorized');
    });

    test('promoteWardrobePrimaryVariantApi rejection exposes response.data.error', async () => {
      const httpErr = new Error('forbidden');
      httpErr.response = { status: 403, data: { error: 'admin only' } };
      vi.mocked(api.patch).mockRejectedValue(httpErr);
      await expect(promoteWardrobePrimaryVariantApi('w-1', 'pink')).rejects.toMatchObject({
        response: { data: { error: 'admin only' } },
      });
    });

    test('sendWardrobeToPhoneApi rejection exposes response.data.message preferentially', async () => {
      const httpErr = new Error('conflict');
      httpErr.response = { status: 409, data: { message: 'phone occupied', error: 'fallback' } };
      vi.mocked(api.post).mockRejectedValue(httpErr);
      await expect(sendWardrobeToPhoneApi('w-1', {})).rejects.toMatchObject({
        response: { data: { message: 'phone occupied' } },
      });
    });

    test('uploadWardrobeApi rejection propagates (caller alerts via response.data.error)', async () => {
      const httpErr = new Error('413');
      httpErr.response = { status: 413, data: { error: 'file too large' } };
      vi.mocked(api.post).mockRejectedValue(httpErr);
      await expect(uploadWardrobeApi(new FormData())).rejects.toMatchObject({
        response: { data: { error: 'file too large' } },
      });
    });

    test('createOutfitSetApi rejection propagates', async () => {
      vi.mocked(api.post).mockRejectedValue(new Error('validation'));
      await expect(createOutfitSetApi({})).rejects.toThrow('validation');
    });

    test('bulkWardrobeOpApi rejection propagates with operation-specific error', async () => {
      const httpErr = new Error('bulk failed');
      httpErr.response = { status: 500, data: { error: 'server overload' } };
      vi.mocked(api.post).mockRejectedValue(httpErr);
      await expect(
        bulkWardrobeOpApi('/api/v1/wardrobe/bulk/enhance', {}),
      ).rejects.toMatchObject({
        response: { data: { error: 'server overload' } },
      });
    });
  });
});
