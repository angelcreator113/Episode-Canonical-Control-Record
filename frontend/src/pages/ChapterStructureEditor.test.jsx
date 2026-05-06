/**
 * ChapterStructureEditor — CP15 (cross-CP heavy: getBookApi 3-fold + updateChapterApi 4-fold).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import { getBookApi, updateChapterApi } from './ChapterStructureEditor';

describe('ChapterStructureEditor — Track 6 CP15', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getBookApi GET on /storyteller/books/:bookId (3-fold cross-CP)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { book: { id: 'b-1', chapters: [] } } });
    await getBookApi('b-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/storyteller/books/b-1');
  });

  test('updateChapterApi PUT on /storyteller/chapters/:id (4-fold cross-CP)', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    await updateChapterApi('c-1', { sections: [] });
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/storyteller/chapters/c-1', { sections: [] });
  });

  test('rejection propagates (caller logs)', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(new Error('save failed'));
    await expect(updateChapterApi('c-1', {})).rejects.toThrow('save failed');
  });
});
