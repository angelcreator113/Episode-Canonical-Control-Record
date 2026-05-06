/**
 * ScenesPanel — CP15 (addChapterLineApi CP12 SceneInterview cross-CP dup, 2-fold).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import { generateBookScenesApi, addChapterLineApi } from './ScenesPanel';

describe('ScenesPanel — Track 6 CP15', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('generateBookScenesApi GET on /memories/books/:id/scenes', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { scenes: [] } });
    await generateBookScenesApi('b-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/memories/books/b-1/scenes');
  });

  test('addChapterLineApi POST on /storyteller/chapters/:id/lines (CP12 dup, 2-fold)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { line: { id: 'l-1' } } });
    const payload = { text: '[SCENE]', source_tags: ['scene_suggestion'] };
    await addChapterLineApi('c-1', payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/storyteller/chapters/c-1/lines', payload);
  });

  test('rejection exposes response.data.error for UX', async () => {
    const httpErr = new Error('rate');
    httpErr.response = { status: 429, data: { error: 'too many' } };
    vi.mocked(apiClient.post).mockRejectedValue(httpErr);
    await expect(addChapterLineApi('c-1', {})).rejects.toMatchObject({
      response: { data: { error: 'too many' } },
    });
  });
});
