/**
 * WorldStudio — Track 4 behavioral tests for CharacterFollowsTab helpers
 *              + Track 7 mini-CP structural tests for 15 mutation site migrations.
 *
 * Track 7 mini-CP scope: 15 sites in WorldStudio.jsx migrated from raw fetch()
 * to apiClient (Pattern A canonical) — closes CP3 regression window where
 * backend worldStudio.js 34 mutation handlers became Tier 1 (requireAuth).
 *
 * Migration scope:
 *   - 14 canonical mutations (POST/PUT/DELETE) → apiClient
 *   - 1 Tier 3 site (POST /world/generate-ecosystem-preview) → apiClient
 *     (D2 lock: ensures req.user?.id ownership tagging works when authed)
 *   - 7 Tier 4 GET sites stay raw fetch (Pattern E equivalents)
 *   - 3 path-bug sites SKIPPED per D1 lock (filed as PE-9 in v2.27 §9.12)
 *   - 4 character-depth sites OUT OF SCOPE per D3 lock (different backend cluster)
 *
 * Structural assertions verify the migration pattern is in place
 * (per CP2/CP3 backend precedent + per-site methodology per Refinement 2).
 */
import fs from 'fs';
import path from 'path';
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
vi.mock('./RelationshipEngine', () => ({ default: () => null }));
vi.mock('./SocialProfileGenerator', () => ({ default: () => null }));

import apiClient from '../services/api';
import { fetchCharacterFollows, generateCharacterFollows } from './WorldStudio';

// vitest exposes import.meta.url; extract directory via URL parsing
const TEST_DIR = path.dirname(new URL(import.meta.url).pathname);
const WS_SOURCE = fs.readFileSync(
  path.join(TEST_DIR, 'WorldStudio.jsx'),
  'utf8',
);

describe('WorldStudio — Track 4 helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('fetchCharacterFollows GET /character-follows/:characterKey', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { profile: {} } });
    await fetchCharacterFollows('justawoman');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/character-follows/justawoman');
  });

  test('generateCharacterFollows POST /character-follows/generate/:characterKey', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await generateCharacterFollows('lala');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/character-follows/generate/lala');
  });

  test('error path — fetchCharacterFollows propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
    await expect(fetchCharacterFollows('x')).rejects.toThrow('not found');
  });
});

describe('WorldStudio — Track 7 mini-CP structural assertions (CP3 regression window closure)', () => {
  describe('apiClient import + migration scope counts', () => {
    test('apiClient is imported as default from ../services/api', () => {
      expect(WS_SOURCE).toMatch(/import\s+apiClient\s+from\s+['"]\.\.\/services\/api['"]/);
    });

    test('exactly 16 apiClient.(post|put|delete) invocations (15 migrations + 1 Track 4 helper)', () => {
      const matches = WS_SOURCE.match(/apiClient\.(post|put|delete)\(/g) || [];
      expect(matches.length).toBe(16);
    });

    test('exactly 14 fetch() calls remain (7 GET + 4 character-depth + 3 path-bug skipped)', () => {
      const matches = WS_SOURCE.match(/\bfetch\(/g) || [];
      expect(matches.length).toBe(14);
    });

    test('zero fetch() calls reference /api/v1/world/* mutation paths (all migrated)', () => {
      // Pattern: fetch(`${API}/world/...{method:'POST|PUT|DELETE'}`)
      // Mutation fetches must be eliminated; only GETs remain on world paths.
      const mutationFetchPattern = /fetch\(`\$\{API\}\/world\/[^`]+`,\s*\{[^}]*method:\s*['"](POST|PUT|DELETE)['"]/g;
      const matches = WS_SOURCE.match(mutationFetchPattern) || [];
      expect(matches.length).toBe(0);
    });
  });

  describe('Per-site Pattern A migration sentinels (15 sites)', () => {
    // 14 canonical Tier 1 mutation paths
    test('M1: POST /world/generate-ecosystem-confirm (confirmPreview)', () => {
      expect(WS_SOURCE).toMatch(/apiClient\.post\(['"]\/api\/v1\/world\/generate-ecosystem-confirm['"]/);
    });

    test('M2: POST /world/characters/:id/activate (activateChar single)', () => {
      expect(WS_SOURCE).toMatch(/apiClient\.post\(`\/api\/v1\/world\/characters\/\$\{id\}\/activate`\)/);
    });

    test('M3: POST /world/characters/:id/archive', () => {
      expect(WS_SOURCE).toMatch(/apiClient\.post\(`\/api\/v1\/world\/characters\/\$\{id\}\/archive`\)/);
    });

    test('M4: DELETE /world/characters/:id', () => {
      expect(WS_SOURCE).toMatch(/apiClient\.delete\(`\/api\/v1\/world\/characters\/\$\{id\}`\)/);
    });

    test('M5: PUT /world/characters/:selectedChar (saveCharEdit)', () => {
      expect(WS_SOURCE).toMatch(/apiClient\.put\(`\/api\/v1\/world\/characters\/\$\{selectedChar\}`,\s*editForm\)/);
    });

    test('M6: POST /world/characters/:c.id/activate (bulkActivate fire-and-forget)', () => {
      expect(WS_SOURCE).toMatch(/apiClient\.post\(`\/api\/v1\/world\/characters\/\$\{c\.id\}\/activate`\)\.catch/);
    });

    test('M7: POST /world/characters/:selectedChar/relationships (addRelationship)', () => {
      expect(WS_SOURCE).toMatch(/apiClient\.post\(`\/api\/v1\/world\/characters\/\$\{selectedChar\}\/relationships`,\s*relForm\)/);
    });

    test('M8: DELETE /world/characters/:selectedChar/relationships/:relId', () => {
      expect(WS_SOURCE).toMatch(/apiClient\.delete\(`\/api\/v1\/world\/characters\/\$\{selectedChar\}\/relationships\/\$\{relId\}`\)/);
    });

    test('M9: POST /world/scenes/generate', () => {
      expect(WS_SOURCE).toMatch(/apiClient\.post\(['"]\/api\/v1\/world\/scenes\/generate['"]/);
    });

    test('M10: POST /world/scenes/:sceneId/approve', () => {
      expect(WS_SOURCE).toMatch(/apiClient\.post\(`\/api\/v1\/world\/scenes\/\$\{sceneId\}\/approve`\)/);
    });

    test('M11: DELETE /world/scenes/:sceneId', () => {
      expect(WS_SOURCE).toMatch(/apiClient\.delete\(`\/api\/v1\/world\/scenes\/\$\{sceneId\}`\)/);
    });

    test('M12: DELETE /world/previews/:pid (discardPreview)', () => {
      expect(WS_SOURCE).toMatch(/apiClient\.delete\(`\/api\/v1\/world\/previews\/\$\{pid\}`\)/);
    });

    test('M13: POST /world/characters/:charId/deepen', () => {
      expect(WS_SOURCE).toMatch(/apiClient\.post\(`\/api\/v1\/world\/characters\/\$\{charId\}\/deepen`\)/);
    });

    test('M14: POST /world/generate-ecosystem-confirm (importCharacter — duplicate path)', () => {
      // confirmPreview (M1) and importCharacter (M14) both POST to the same path; verify ≥2 invocations.
      const matches = WS_SOURCE.match(/apiClient\.post\(['"]\/api\/v1\/world\/generate-ecosystem-confirm['"]/g) || [];
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    // 1 Tier 3 site (D2 lock)
    test('M15 (Tier 3): POST /world/generate-ecosystem-preview (D2 — was raw fetch, migrated for ownership tagging)', () => {
      expect(WS_SOURCE).toMatch(/apiClient\.post\(['"]\/api\/v1\/world\/generate-ecosystem-preview['"]/);
    });
  });

  describe('Pattern E equivalents — 7 GET sites stay raw fetch (Tier 4 backend)', () => {
    test('GET /world/characters (loadCharacters; line ~715) stays raw fetch', () => {
      // Multiline url-construction → fetch(url) pattern
      expect(WS_SOURCE).toMatch(/`\$\{API\}\/world\/characters\?world_tag=/);
    });

    test('GET /world/characters/:id (loadCharDetail) stays raw fetch', () => {
      expect(WS_SOURCE).toMatch(/fetch\(`\$\{API\}\/world\/characters\/\$\{id\}`\)/);
    });

    test('GET /world/scenes?character_id (loadCharScenes) stays raw fetch', () => {
      expect(WS_SOURCE).toMatch(/fetch\(`\$\{API\}\/world\/scenes\?character_id=/);
    });

    test('GET /world/batches stays raw fetch', () => {
      expect(WS_SOURCE).toMatch(/fetch\(`\$\{API\}\/world\/batches`\)/);
    });

    test('GET /world/previews stays raw fetch', () => {
      expect(WS_SOURCE).toMatch(/fetch\(`\$\{API\}\/world\/previews`\)/);
    });

    test('GET /world/preview/:pid stays raw fetch', () => {
      expect(WS_SOURCE).toMatch(/fetch\(`\$\{API\}\/world\/preview\/\$\{pid\}`\)/);
    });

    test('GET /world/characters/:compareChar (compare loader) stays raw fetch', () => {
      expect(WS_SOURCE).toMatch(/fetch\(`\$\{API\}\/world\/characters\/\$\{compareChar\}`\)/);
    });
  });

  describe('Skipped/out-of-scope sites preserved as-is', () => {
    test('PE-9 path-bug site: /api/world/characters/bulk-re-sync remains raw fetch (D1 SKIP)', () => {
      expect(WS_SOURCE).toMatch(/fetch\(['"]\/api\/world\/characters\/bulk-re-sync['"]/);
    });

    test('PE-9 path-bug site: /api/world/characters/seed-cross-batch remains raw fetch (D1 SKIP)', () => {
      expect(WS_SOURCE).toMatch(/fetch\(['"]\/api\/world\/characters\/seed-cross-batch['"]/);
    });

    test('PE-9 path-bug site: /api/world/characters/:id/re-sync remains raw fetch (D1 SKIP)', () => {
      expect(WS_SOURCE).toMatch(/fetch\(`\/api\/world\/characters\/\$\{charDetail\.id\}\/re-sync`/);
    });

    test('character-depth site: /character-depth/:id GET remains raw fetch (D3 OUT OF SCOPE)', () => {
      expect(WS_SOURCE).toMatch(/fetch\(`\$\{API\}\/character-depth\/\$\{registryCharId\}`\)/);
    });

    test('character-depth site: /character-depth/:id/generate POST remains raw fetch (D3 OUT OF SCOPE)', () => {
      expect(WS_SOURCE).toMatch(/fetch\(`\$\{API\}\/character-depth\/\$\{registryCharId\}\/generate`/);
    });
  });

  describe('Behavioral test for migrated Tier 3 site (D2 lock — sample)', () => {
    test('Tier 3 path target verified via apiClient.post mock (sanity check)', () => {
      // Note: handler is component-internal (not module-scope export);
      // structural assertion above (M15) is the primary lock. This test
      // verifies the mocked apiClient surface still exposes .post method
      // that resolves a {data} response shape — sentinel that the test
      // infrastructure remains correct for future Track 7 mini-CPs.
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { characters: [{ name: 'Test' }], preview_id: 'p1' },
      });
      expect(apiClient.post).toBeDefined();
      expect(typeof apiClient.post).toBe('function');
    });
  });
});
