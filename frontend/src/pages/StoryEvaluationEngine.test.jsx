/**
 * StoryEvaluationEngine — Track 3 tests for the apiPost/apiGet helper-internal
 * migration. Both helpers preserve the timeout-aware contract; auth + Content-Type
 * now provided by the apiClient request interceptor.
 *
 * These helpers are not exported (internal to StoryEvaluationEngine.jsx). To test
 * them, this file exercises the migration through structural inspection and a
 * separate behavioral test using a copy of the helpers' shape.
 *
 * Track 6 CP10 behavioral tests appended below per v2.15 §9.11
 * existing-test-file amendment convention. The 5 module-scope helpers added
 * by CP10 do not invalidate the existing structural assertions: apiClient
 * import is still present, no authHeaders helper, internal apiPost/apiGet
 * wrappers unchanged.
 */

import { vi, describe, beforeEach, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// CP10 mock — hoisted by vitest, applies to the dynamic-import call
// inside the CP10 describe block below. The Track 3 structural tests
// don't import the source module, so this mock is benign for them.
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

const SOURCE = readFileSync(
  resolve(process.cwd(), 'src/pages/StoryEvaluationEngine.jsx'),
  'utf8'
);

describe('StoryEvaluationEngine — Track 3 helper-internal migration', () => {
  test('source no longer defines authHeaders helper', () => {
    expect(SOURCE).not.toMatch(/^function authHeaders\(/m);
    expect(SOURCE).not.toMatch(/^const authHeaders\s*=/m);
  });

  test('source imports apiClient', () => {
    expect(SOURCE).toMatch(/import\s+apiClient\s+from\s+['"]\.\.\/services\/api['"]/);
  });

  test('apiPost wraps apiClient.post and preserves timeout option', () => {
    expect(SOURCE).toMatch(/async function apiPost/);
    expect(SOURCE).toMatch(/apiClient\.post\([^,]+,\s*body,\s*\{\s*timeout:\s*timeoutMs\s*\}\)/);
  });

  test('apiGet wraps apiClient.get and preserves timeout option', () => {
    expect(SOURCE).toMatch(/async function apiGet/);
    expect(SOURCE).toMatch(/apiClient\.get\([^,]+,\s*\{\s*timeout:\s*timeoutMs\s*\}\)/);
  });

  test('timeout error contract preserved (ECONNABORTED → "Request timed out")', () => {
    expect(SOURCE).toMatch(/ECONNABORTED|AbortError/);
    expect(SOURCE).toMatch(/Request timed out/);
  });

  test('no surviving fetch+authHeaders pattern', () => {
    expect(SOURCE).not.toMatch(/headers:\s*authHeaders\(\)/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Track 6 CP10 helper tests (appended per v2.15 §9.11 existing-test-file
// amendment convention).
// ──────────────────────────────────────────────────────────────────────────

describe('StoryEvaluationEngine — Track 6 CP10 module-scope helpers', () => {
  let apiClient;
  let getWorldContextSummaryApi, listRegistriesApi, getCharacterSceneContextApi;
  let listBooksApi, getBookApi, listAllChaptersApi;

  beforeEach(async () => {
    const apiMod = await import('../services/api');
    apiClient = apiMod.default;
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());

    const seeMod = await import('./StoryEvaluationEngine');
    getWorldContextSummaryApi = seeMod.getWorldContextSummaryApi;
    listRegistriesApi = seeMod.listRegistriesApi;
    getCharacterSceneContextApi = seeMod.getCharacterSceneContextApi;
    listBooksApi = seeMod.listBooksApi;
    getBookApi = seeMod.getBookApi;
    listAllChaptersApi = seeMod.listAllChaptersApi;
  });

  test('getWorldContextSummaryApi GET on /world/context-summary', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
    await getWorldContextSummaryApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/context-summary');
  });

  test('listRegistriesApi GET on /character-registry/registries (6-fold cross-CP dup)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, registries: [] } });
    await listRegistriesApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/character-registry/registries');
  });

  test('getCharacterSceneContextApi GET with charKey + registryId encoded', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true } });
    await getCharacterSceneContextApi('lala', 'reg-1');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/character-registry/characters/scene-context/lala?registry_id=reg-1',
    );
  });

  test('getCharacterSceneContextApi encodes special characters', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true } });
    await getCharacterSceneContextApi('just a woman', 'reg/1');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/character-registry/characters/scene-context/just%20a%20woman?registry_id=reg%2F1',
    );
  });

  test('listBooksApi GET on /storyteller/books (CP5 dup)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { books: [] } });
    await listBooksApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/storyteller/books');
  });

  test('getBookApi GET on /storyteller/books/:bookId (CP3 dup, variable-URL bookId branch)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { book: {} } });
    await getBookApi('book-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/storyteller/books/book-1');
  });

  test('listAllChaptersApi GET on /storyteller/chapters (variable-URL no-bookId branch)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { chapters: [] } });
    await listAllChaptersApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/storyteller/chapters');
  });

  describe('Error path propagation', () => {
    test('getWorldContextSummaryApi rejection propagates (caller .catch null)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(getWorldContextSummaryApi()).rejects.toThrow('not authorized');
    });

    test('listRegistriesApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('forbidden'));
      await expect(listRegistriesApi()).rejects.toThrow('forbidden');
    });

    test('getCharacterSceneContextApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
      await expect(getCharacterSceneContextApi('x', 'r')).rejects.toThrow('not found');
    });
  });
});
