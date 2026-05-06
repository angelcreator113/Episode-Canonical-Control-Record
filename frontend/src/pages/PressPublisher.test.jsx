/**
 * PressPublisher — Track 6 CP11 behavioral + structural tests
 * (file 9 of 17 — first F-AUTH-1 mixed PUBLIC+BUG instance).
 *
 * 4 sites total. 3 BUG-class POSTs migrated via 4 helpers
 * (URL-branching split per v2.17 §9.11 — generatePressPostApi +
 * generatePressSceneApi). 1 LOCKED PUBLIC GET retained as raw
 * fetch with 9-line PUBLIC comment block (line 93 / load) per
 * inventory v2 §4.2 — `press.js` is on the LOCKED PUBLIC list.
 *
 * Structural assertion preserves discipline: line-93 raw fetch
 * MUST remain post-migration. Parallel to CP10 SEE structural
 * amendment (v2.17 §9.11 structural-test-file precedent).
 */

import { vi, describe, beforeEach, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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
  seedPressCharactersApi,
  generatePressPostApi,
  generatePressSceneApi,
  advanceCareerApi,
} from './PressPublisher';

const SOURCE = readFileSync(
  resolve(process.cwd(), 'src/pages/PressPublisher.jsx'),
  'utf8',
);

describe('PressPublisher — Track 6 CP11 BUG-class helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('seedPressCharactersApi POST on /press/seed-characters (no body)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await seedPressCharactersApi();
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/press/seed-characters');
  });

  test('generatePressPostApi POST on /press/generate-post with slug body', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { content: 'Lorem' } });
    const out = await generatePressPostApi('lala-coverage');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/press/generate-post',
      { slug: 'lala-coverage' },
    );
    expect(out.content).toBe('Lorem');
  });

  test('generatePressSceneApi POST on /press/generate-scene with slug body (URL-branch sibling)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { scene: 'A scene' } });
    await generatePressSceneApi('lala-coverage');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/press/generate-scene',
      { slug: 'lala-coverage' },
    );
  });

  test('advanceCareerApi POST on /press/advance-career', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await advanceCareerApi('lala-coverage');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/press/advance-career',
      { slug: 'lala-coverage' },
    );
  });

  describe('URL-branching split site behavior (line 124)', () => {
    test('type === "post" → generatePressPostApi', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      const type = 'post';
      const slug = 'lala-coverage';
      // call-site shape: type === 'post' ? generatePressPostApi(slug) : generatePressSceneApi(slug)
      await (type === 'post' ? generatePressPostApi(slug) : generatePressSceneApi(slug));
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/press/generate-post', { slug });
    });

    test('type === "scene" → generatePressSceneApi', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      const type = 'scene';
      const slug = 'lala-coverage';
      await (type === 'post' ? generatePressPostApi(slug) : generatePressSceneApi(slug));
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/press/generate-scene', { slug });
    });
  });

  describe('Error path propagation', () => {
    test('seedPressCharactersApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('forbidden'));
      await expect(seedPressCharactersApi()).rejects.toThrow('forbidden');
    });

    test('generatePressPostApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('rate limited'));
      await expect(generatePressPostApi('x')).rejects.toThrow('rate limited');
    });

    test('advanceCareerApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('not allowed'));
      await expect(advanceCareerApi('x')).rejects.toThrow('not allowed');
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Structural assertions for the LOCKED PUBLIC site (line 93 — load).
// First F-AUTH-1 mixed PUBLIC+BUG instance: per-site adjudication retains
// the raw fetch and flags it with a 9-line PUBLIC comment block.
// ──────────────────────────────────────────────────────────────────────────

describe('PressPublisher — LOCKED PUBLIC site retention (mixed PUBLIC+BUG)', () => {
  test('source still contains raw fetch on /press/characters (LOCKED PUBLIC)', () => {
    expect(SOURCE).toMatch(/await fetch\(`\$\{API\}\/press\/characters`\)/);
  });

  test('source has LOCKED PUBLIC comment block referencing inventory v2 §4.2', () => {
    expect(SOURCE).toMatch(/LOCKED PUBLIC/);
    expect(SOURCE).toMatch(/inventory v2 §4\.2|degradeOnInfraFailure|F-Auth-3/);
  });

  test('source imports apiClient (BUG-class sites migrated)', () => {
    expect(SOURCE).toMatch(/import\s+apiClient\s+from\s+['"]\.\.\/services\/api['"]/);
  });

  test('source no longer contains BUG-class fetch on /press/seed-characters', () => {
    expect(SOURCE).not.toMatch(/fetch\([^)]*\/press\/seed-characters[^)]*method:\s*['"]POST/);
  });

  test('source no longer contains BUG-class fetch on /press/advance-career', () => {
    expect(SOURCE).not.toMatch(/fetch\([^)]*\/press\/advance-career/);
  });
});
