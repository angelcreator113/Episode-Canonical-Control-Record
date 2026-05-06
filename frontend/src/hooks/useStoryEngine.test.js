/**
 * useStoryEngine — Track 3 behavioral tests for migrated apiClient helpers.
 *
 * Covers persistStory + deleteStoryFromDb. The pre-flight noted that the
 * previous local authHeaders(extra={}) supported header merging, but no
 * caller actually passed an extra object — drift confirmed dead, dropped
 * cleanly during migration.
 *
 * Track 6 CP12 tests appended below per v2.15 §9.11 existing-test-file
 * amendment convention. CP12 added 12 new module-scope helpers covering
 * 13 BUG-class fetch sites + 1 Pattern G locked streaming site at
 * line 358 (/memories/generate-story-tasks-stream). The 3 Track 3
 * assertions on persistStory + deleteStoryFromDb remain valid:
 * apiClient import unchanged, helpers preserved verbatim, no behavioral
 * regression. CP12 helpers compose cleanly alongside Track 3 helpers.
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
  persistStory,
  deleteStoryFromDb,
  getStoryEngineCharactersApi,
  listStoriesForCharacterApi,
  getStoryEngineTasksApi,
  generateNextChapterApi,
  extractStoryMemoriesApi,
  updateStoryEngineRegistryApi,
  generateTextureLayerApi,
  updateArcTrackingApi,
  checkSceneEligibilityApi,
  checkStoryConsistencyApi,
  addStoryEngineCharacterApi,
} from './useStoryEngine';

const SOURCE = readFileSync(
  resolve(process.cwd(), 'src/hooks/useStoryEngine.js'),
  'utf8',
);

describe('useStoryEngine — Track 3 helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('persistStory calls apiClient.post with /stories + payload', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { story: { id: 'st-1' } } });
    const payload = {
      character_key: 'justawoman',
      story_number: 7,
      title: 'A Story',
      text: 'Once upon...',
      status: 'draft',
    };
    const r = await persistStory(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/stories', payload);
    expect(r.data.story.id).toBe('st-1');
  });

  test('deleteStoryFromDb calls apiClient.delete on /stories/:dbId', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await deleteStoryFromDb('db-99');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/stories/db-99');
  });

  test('error path — persistStory propagates rejection', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('500'));
    await expect(persistStory({})).rejects.toThrow('500');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Track 6 CP12 tests — 12 new helpers covering 13 BUG-class sites.
// 1 Pattern G locked streaming site at line 358 (allowlist 5 → 6).
// ──────────────────────────────────────────────────────────────────────────

describe('useStoryEngine — Track 6 CP12 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  // ── Loaders ─────────────────────────────────────────────────────────────

  test('getStoryEngineCharactersApi GET on /memories/story-engine-characters', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { worlds: {} } });
    const out = await getStoryEngineCharactersApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/memories/story-engine-characters');
    expect(out).toEqual({ worlds: {} });
  });

  test('listStoriesForCharacterApi GET on /stories/character/:char (3-fold cross-CP dup)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { stories: [] } });
    await listStoriesForCharacterApi('justawoman');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/stories/character/justawoman');
  });

  test('getStoryEngineTasksApi GET on /memories/story-engine-tasks/:char', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { cached: true, tasks: [] } });
    await getStoryEngineTasksApi('lala');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/memories/story-engine-tasks/lala');
  });

  // ── Single-shot writers ─────────────────────────────────────────────────

  test('generateNextChapterApi POST on /memories/generate-next-chapter (covers sites 5 + 11)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { chapter: {}, allTasks: [], chapterNumber: 3 },
    });
    const out = await generateNextChapterApi({ characterKey: 'justawoman' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/generate-next-chapter',
      { characterKey: 'justawoman' },
    );
    expect(out.chapterNumber).toBe(3);
  });

  test('checkStoryConsistencyApi POST on /memories/check-story-consistency', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { conflicts: [] } });
    await checkStoryConsistencyApi({
      characterKey: 'justawoman',
      editedStoryNumber: 1,
      editedStoryText: 'text',
      existingStories: [],
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/check-story-consistency',
      {
        characterKey: 'justawoman',
        editedStoryNumber: 1,
        editedStoryText: 'text',
        existingStories: [],
      },
    );
  });

  test('addStoryEngineCharacterApi POST on /memories/story-engine-add-character', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { already_existed: false } });
    await addStoryEngineCharacterApi({
      character_name: 'Skye',
      character_role: 'support',
      world: 'book-1',
      story_number: 5,
      story_title: 'Title',
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/story-engine-add-character',
      {
        character_name: 'Skye',
        character_role: 'support',
        world: 'book-1',
        story_number: 5,
        story_title: 'Title',
      },
    );
  });

  // ── handleApprove cluster (sites 6-10 — semantic preservation) ──────────

  test('extractStoryMemoriesApi POST on /memories/extract-story-memories (Path E dedup from Track 3 §9.12)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { pain_points: [{}] } });
    const out = await extractStoryMemoriesApi({
      characterId: 'c-1',
      characterKey: 'justawoman',
      storyNumber: 1,
      storyTitle: 'X',
      storyText: 'Y',
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/extract-story-memories',
      {
        characterId: 'c-1',
        characterKey: 'justawoman',
        storyNumber: 1,
        storyTitle: 'X',
        storyText: 'Y',
      },
    );
    expect(out.pain_points).toHaveLength(1);
  });

  test('updateStoryEngineRegistryApi POST on /memories/story-engine-update-registry (fire-and-forget)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { updated: true, summary: 'ok' } });
    await updateStoryEngineRegistryApi({
      characterKey: 'lala',
      storyNumber: 2,
      storyTitle: 'T',
      storyText: 'X',
      extractedMemories: null,
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/story-engine-update-registry',
      {
        characterKey: 'lala',
        storyNumber: 2,
        storyTitle: 'T',
        storyText: 'X',
        extractedMemories: null,
      },
    );
  });

  test('generateTextureLayerApi POST on /texture-layer/generate (fire-and-forget)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { texture: { id: 't-1' } } });
    await generateTextureLayerApi({
      story: { story_number: 1, title: 'X', text: 'Y', phase: 'p', story_type: 't' },
      character_key: 'lala',
      characters_present: [],
      registry_id: null,
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/texture-layer/generate',
      expect.objectContaining({ character_key: 'lala' }),
    );
  });

  test('updateArcTrackingApi POST on /arc-tracking/update (fire-and-forget, no body read)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await updateArcTrackingApi({
      character_key: 'lala',
      story_number: 1,
      story_type: 't',
      phase: 'p',
      phone_appeared: false,
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/arc-tracking/update',
      {
        character_key: 'lala',
        story_number: 1,
        story_type: 't',
        phase: 'p',
        phone_appeared: false,
      },
    );
  });

  test('checkSceneEligibilityApi POST on /world/scenes/check-eligibility (conditional fire-and-forget)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { eligible: true } });
    const out = await checkSceneEligibilityApi({
      story_id: 'db-1',
      character_key: 'lala',
      story_text: 'X',
      story_type: 't',
      story_number: 1,
      characters_present: [],
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/world/scenes/check-eligibility',
      expect.objectContaining({ story_id: 'db-1' }),
    );
    expect(out.eligible).toBe(true);
  });

  // ── Error path propagation ─────────────────────────────────────────────

  describe('Error path propagation', () => {
    test('getStoryEngineCharactersApi rejection propagates (caller falls back to FALLBACK_CHARACTERS)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(getStoryEngineCharactersApi()).rejects.toThrow('not authorized');
    });

    test('listStoriesForCharacterApi rejection propagates (caller swallows in load-from-DB block)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listStoriesForCharacterApi('x')).rejects.toThrow('not authorized');
    });

    test('getStoryEngineTasksApi rejection propagates (caller swallows → setTasks([]))', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(getStoryEngineTasksApi('x')).rejects.toThrow('not authorized');
    });

    test('generateNextChapterApi rejection exposes response.data.error for UX message', async () => {
      const httpErr = new Error('rate limited');
      httpErr.response = { status: 429, data: { error: 'too many requests' } };
      vi.mocked(apiClient.post).mockRejectedValue(httpErr);
      await expect(generateNextChapterApi({})).rejects.toMatchObject({
        response: { data: { error: 'too many requests' } },
      });
    });

    test('extractStoryMemoriesApi rejection propagates (caller catches → null in Promise.all)', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('not authorized'));
      await expect(extractStoryMemoriesApi({})).rejects.toThrow('not authorized');
    });

    test('updateStoryEngineRegistryApi rejection propagates (caller catches → toast)', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('forbidden'));
      await expect(updateStoryEngineRegistryApi({})).rejects.toThrow('forbidden');
    });

    test('checkStoryConsistencyApi rejection propagates (caller logs)', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('not authorized'));
      await expect(checkStoryConsistencyApi({})).rejects.toThrow('not authorized');
    });

    test('addStoryEngineCharacterApi rejection propagates (caller catches → toast)', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('forbidden'));
      await expect(addStoryEngineCharacterApi({})).rejects.toThrow('forbidden');
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Structural assertions for the LOCKED Pattern G site (line ~358 streaming
// kickoff + reader). Pattern G locked-exception count: 5 → 6 after CP12.
// Allowlist: BookEditor:58, WriteMode:1000, WriteMode:1191,
// WriteModeAIWriter:281, AppAssistant:239, useStoryEngine:358 (NEW).
// ──────────────────────────────────────────────────────────────────────────

describe('useStoryEngine — Pattern G locked streaming site', () => {
  test('source still contains raw fetch on /memories/generate-story-tasks-stream', () => {
    expect(SOURCE).toMatch(/await fetch\([^)]*generate-story-tasks-stream/);
  });

  test('source still calls res.body.getReader() (SSE stream consumption)', () => {
    expect(SOURCE).toMatch(/res\.body\.getReader\(\)/);
  });

  test('source has Pattern G locked-exception comment block', () => {
    expect(SOURCE).toMatch(/PATTERN G LOCKED EXCEPTION/);
    expect(SOURCE).toMatch(/§9\.11/);
  });

  test('source imports apiClient (BUG sites migrated)', () => {
    expect(SOURCE).toMatch(/import\s+apiClient\s+from\s+['"]\.\.\/services\/api['"]/);
  });

  test('source no longer contains raw fetch on /memories/story-engine-characters (CP12 migration)', () => {
    expect(SOURCE).not.toMatch(/await fetch\([^)]*memories\/story-engine-characters/);
  });

  test('source no longer contains raw fetch on /memories/extract-story-memories (handleApprove migration)', () => {
    expect(SOURCE).not.toMatch(/fetch\([^)]*extract-story-memories/);
  });

  test('source no longer contains raw fetch on /texture-layer/generate (handleApprove migration)', () => {
    expect(SOURCE).not.toMatch(/fetch\([^)]*texture-layer\/generate/);
  });

  test('source no longer contains raw fetch on /arc-tracking/update (handleApprove migration)', () => {
    expect(SOURCE).not.toMatch(/fetch\([^)]*arc-tracking\/update/);
  });

  test('source no longer contains raw fetch on /world/scenes/check-eligibility (handleApprove migration)', () => {
    expect(SOURCE).not.toMatch(/fetch\([^)]*world\/scenes\/check-eligibility/);
  });
});
