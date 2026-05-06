/**
 * StoryPlanner — Track 6 CP10 behavioral tests (file 6 of 8).
 *
 * 7 fetch sites migrated via 3 module-scope helpers — updateChapterApi
 * reused 5× within file (high helper-reuse). updateChapterApi +
 * createChapterApi duplicated locally per v2.12 §9.11 (CP3 WriteMode has
 * both).
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
  proposeStoryOutlineApi,
  updateChapterApi,
  createChapterApi,
} from './StoryPlanner';

describe('StoryPlanner — Track 6 CP10 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('proposeStoryOutlineApi POST on /memories/story-outline', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { outline: {} } });
    const payload = {
      book_id: 'b-1',
      book_title: 'Book 1',
      book_description: 'desc',
      character_name: 'Lala',
      existing_chapters: [],
      instructions: '',
      mode: 'full',
      target_chapter_id: null,
      num_parts: 3,
      num_chapters: 12,
    };
    await proposeStoryOutlineApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/story-outline',
      payload,
    );
  });

  test('updateChapterApi PUT on /storyteller/chapters/:id (CP3 dup, 5 reuses)', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    await updateChapterApi('ch-1', { sections: [] });
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/storyteller/chapters/ch-1',
      { sections: [] },
    );
  });

  test('updateChapterApi PUT with chapter metadata (updateChapterMeta shape)', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    await updateChapterApi('ch-1', { chapter_type: 'finale', scene_goal: 'climax' });
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/storyteller/chapters/ch-1',
      { chapter_type: 'finale', scene_goal: 'climax' },
    );
  });

  test('createChapterApi POST on /storyteller/books/:bookId/chapters (CP3 dup)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    const payload = {
      title: 'New Chapter',
      chapter_number: 3,
      chapter_type: 'chapter',
      part_number: 1,
      part_title: 'Part 1',
      scene_goal: '',
      sections: [],
    };
    await createChapterApi('b-1', payload);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/storyteller/books/b-1/chapters',
      payload,
    );
  });

  describe('Error path propagation', () => {
    test('proposeStoryOutlineApi exposes response.data.error for UX', async () => {
      const httpErr = new Error('rate limited');
      httpErr.response = { status: 429, data: { error: 'too many outlines' } };
      vi.mocked(apiClient.post).mockRejectedValue(httpErr);
      await expect(proposeStoryOutlineApi({})).rejects.toMatchObject({
        response: { data: { error: 'too many outlines' } },
      });
    });

    test('updateChapterApi rejection propagates', async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error('forbidden'));
      await expect(updateChapterApi('ch-1', {})).rejects.toThrow('forbidden');
    });

    test('createChapterApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('validation'));
      await expect(createChapterApi('b-1', {})).rejects.toThrow('validation');
    });
  });
});
