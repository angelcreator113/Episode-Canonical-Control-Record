/**
 * WriteMode — Track 6 CP3 behavioral tests.
 *
 * 31 of 33 fetch sites migrated via 17 module-scope helpers, organised by
 * cluster: storyteller (books/chapters/lines), memories (AI generation),
 * character-registry. The 2 remaining sites are documented streaming-SSE
 * exceptions (WriteMode.jsx:980, :1145) per fix plan v2.10 §4.6.
 *
 * Helpers are exported with the Api suffix (Pattern F prophylactic) so they
 * never collide with component-local handler names like saveDraft, handleContinue,
 * handleDeepen, handleNudge, generateSynopsis, generateTransition,
 * commitAddChapter, commitTocRename, saveTocSections, saveContextField,
 * approveLine, rejectLine, saveLineEdit, loadReferenceChapter, loadReviewLines.
 *
 * Spot-tests one helper per cluster + signature variations (PUT vs POST vs
 * GET vs DELETE) + error-path propagation.
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

// Component dependencies stubbed to keep the helper test load fast and
// focused; we only exercise the module-scope network helpers.
vi.mock('../components/LoadingSkeleton', () => ({ default: () => null }));
vi.mock('../components/WriteModeAIWriter', () => ({ default: () => null }));
vi.mock('../components/ScenesPanel', () => ({ default: () => null }));
vi.mock('../components/BookStructurePanel', () => ({ default: () => null }));
vi.mock('../components/MemoryBankView', () => ({ default: () => null }));
vi.mock('../components/LalaSceneDetection', () => ({ default: () => null }));
vi.mock('../components/ExportPanel', () => ({ default: () => null }));
vi.mock('../components/NarrativeIntelligence', () => ({ default: () => null }));
vi.mock('../components/ContinuityGuard', () => ({ ContinuityGuard: () => null }));
vi.mock('../components/MemoryConfirmation', () => ({
  MemoryCard: () => null,
  MEMORY_STYLES: {},
}));

import apiClient from '../services/api';
import {
  // Storyteller — books / chapters / lines
  getBookApi,
  getChapterApi,
  updateChapterApi,
  createChapterApi,
  saveDraftApi,
  importChapterApi,
  submitEmotionalImpactApi,
  updateLineApi,
  deleteLineApi,
  // Memories (AI generation)
  storyEditApi,
  storyContinueApi,
  storyDeepenApi,
  storyNudgeApi,
  chapterSynopsisApi,
  sceneTransitionApi,
  voiceToStoryApi,
  // Character registry
  listRegistriesApi,
  getRegistryApi,
} from './WriteMode';

describe('WriteMode — Track 6 CP3 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  describe('Storyteller — books / chapters', () => {
    test('getBookApi GET on /storyteller/books/:bookId', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { book: { chapters: [] } } });
      await getBookApi('book-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/storyteller/books/book-1');
    });

    test('getChapterApi GET on /storyteller/chapters/:chapterId', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { chapter: {} } });
      await getChapterApi('ch-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/storyteller/chapters/ch-1');
    });

    test('updateChapterApi PUT on /storyteller/chapters/:chapterId with payload', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
      await updateChapterApi('ch-1', { title: 'New Title' });
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/storyteller/chapters/ch-1',
        { title: 'New Title' },
      );
    });

    test('updateChapterApi handles partial payload (sort_order only)', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
      await updateChapterApi('ch-1', { sort_order: 3 });
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/storyteller/chapters/ch-1',
        { sort_order: 3 },
      );
    });

    test('createChapterApi POST on /storyteller/books/:bookId/chapters', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { chapter: { id: 'new-ch' } } });
      await createChapterApi('book-1', { title: 'Chapter 4', chapter_number: 4, sort_order: 4 });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/storyteller/books/book-1/chapters',
        { title: 'Chapter 4', chapter_number: 4, sort_order: 4 },
      );
    });

    test('saveDraftApi POST on /storyteller/chapters/:chapterId/save-draft', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await saveDraftApi('ch-1', { draft_prose: 'hello world' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/storyteller/chapters/ch-1/save-draft',
        { draft_prose: 'hello world' },
      );
    });

    test('importChapterApi POST on /storyteller/chapters/:chapterId/import', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await importChapterApi('ch-1', { raw_text: 'LINE 1\nopening', mode: 'replace' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/storyteller/chapters/ch-1/import',
        { raw_text: 'LINE 1\nopening', mode: 'replace' },
      );
    });

    test('submitEmotionalImpactApi POST on /storyteller/chapters/:chapterId/emotional-impact', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await submitEmotionalImpactApi('ch-1', { prose: 'p', character_id: 'c-1' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/storyteller/chapters/ch-1/emotional-impact',
        { prose: 'p', character_id: 'c-1' },
      );
    });
  });

  describe('Storyteller — lines', () => {
    test('updateLineApi PUT on /storyteller/lines/:lineId with status payload', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
      await updateLineApi('line-1', { status: 'approved' });
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/storyteller/lines/line-1',
        { status: 'approved' },
      );
    });

    test('updateLineApi handles edit payload (text + content + status)', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
      await updateLineApi('line-1', { text: 't', content: 't', status: 'edited' });
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/storyteller/lines/line-1',
        { text: 't', content: 't', status: 'edited' },
      );
    });

    test('deleteLineApi DELETE on /storyteller/lines/:lineId', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
      await deleteLineApi('line-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/storyteller/lines/line-1');
    });
  });

  describe('Memories — AI generation', () => {
    test('storyEditApi POST on /memories/story-edit', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { prose: 'rewritten' } });
      await storyEditApi({ current_prose: 'p', edit_note: 'rewrite' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/memories/story-edit',
        { current_prose: 'p', edit_note: 'rewrite' },
      );
    });

    test('storyContinueApi POST on /memories/story-continue (non-streaming)', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { prose: 'next scene' } });
      await storyContinueApi({ current_prose: 'p', stream: false });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/memories/story-continue',
        { current_prose: 'p', stream: false },
      );
    });

    test('storyDeepenApi POST on /memories/story-deepen', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { prose: 'deepened' } });
      await storyDeepenApi({ current_prose: 'p' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/memories/story-deepen',
        { current_prose: 'p' },
      );
    });

    test('storyNudgeApi POST on /memories/story-nudge', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { nudge: 'try this' } });
      await storyNudgeApi({ current_prose: 'p' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/memories/story-nudge',
        { current_prose: 'p' },
      );
    });

    test('chapterSynopsisApi POST on /memories/chapter-synopsis', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { synopsis: 's' } });
      await chapterSynopsisApi({ prose: 'p', chapter_title: 't' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/memories/chapter-synopsis',
        { prose: 'p', chapter_title: 't' },
      );
    });

    test('sceneTransitionApi POST on /memories/scene-transition', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { transition: 't' } });
      await sceneTransitionApi({ scene_a_end: 'a', scene_b_start: 'b' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/memories/scene-transition',
        { scene_a_end: 'a', scene_b_start: 'b' },
      );
    });

    test('voiceToStoryApi (helper exists for future non-streaming use; site at WriteMode.jsx:980 stays raw fetch per streaming exception)', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await voiceToStoryApi({ spoken: 'hello', stream: false });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/memories/voice-to-story',
        { spoken: 'hello', stream: false },
      );
    });
  });

  describe('Character registry', () => {
    test('listRegistriesApi GET on /character-registry/registries', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { registries: [] } });
      await listRegistriesApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/character-registry/registries');
    });

    test('getRegistryApi GET on /character-registry/registries/:registryId', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { registry: {} } });
      await getRegistryApi('reg-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/character-registry/registries/reg-1');
    });
  });

  describe('Error path propagation', () => {
    test('getBookApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
      await expect(getBookApi('missing')).rejects.toThrow('not found');
    });

    test('saveDraftApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('rate limited'));
      await expect(saveDraftApi('ch-1', { draft_prose: 'p' })).rejects.toThrow('rate limited');
    });

    test('storyDeepenApi rejection exposes response.status for UX hint', async () => {
      const httpErr = new Error('server error');
      httpErr.response = { status: 503, data: { error: 'busy' } };
      vi.mocked(apiClient.post).mockRejectedValue(httpErr);
      await expect(storyDeepenApi({})).rejects.toMatchObject({
        response: { status: 503 },
      });
    });

    test('updateLineApi rejection propagates', async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error('forbidden'));
      await expect(updateLineApi('line-1', { status: 'approved' })).rejects.toThrow('forbidden');
    });

    test('deleteLineApi rejection propagates', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('conflict'));
      await expect(deleteLineApi('line-1')).rejects.toThrow('conflict');
    });
  });
});
