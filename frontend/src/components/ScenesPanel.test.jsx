/**
 * ScenesPanel — Track 3 behavioral tests for migrated apiClient helpers.
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
  updateChapterSections,
  planScenesForChapter,
  fetchBookSceneSuggestions,
} from './ScenesPanel';

describe('ScenesPanel — Track 3 helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('updateChapterSections calls apiClient.put with sections payload', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    const sections = [{ id: 's1', type: 'h3', content: 'Scene A' }];
    await updateChapterSections('ch-1', sections);
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/storyteller/chapters/ch-1',
      { sections }
    );
  });

  test('planScenesForChapter calls apiClient.post with full payload', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { suggestions: [] } });
    const payload = { book_id: 'b1', chapter_id: 'ch-1', chapter_title: 'Open' };
    await planScenesForChapter(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/memories/scene-planner', payload);
  });

  test('fetchBookSceneSuggestions calls apiClient.get on book scenes URL', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { scenes: [] } });
    await fetchBookSceneSuggestions('b1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/memories/books/b1/scenes');
  });

  test('error path — updateChapterSections propagates rejection', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(new Error('save failed'));
    await expect(updateChapterSections('ch-1', [])).rejects.toThrow('save failed');
  });
});
