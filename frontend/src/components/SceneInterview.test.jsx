/**
 * SceneInterview — Track 6 CP11 behavioral tests (file 12 of 17).
 *
 * 3 fetch sites migrated via 3 helpers. updateChapterApi is a CP3
 * WriteMode + CP10 StoryPlanner cross-CP duplicate per v2.12 §9.11
 * (3-fold cross-CP existence). The other two are fresh.
 *
 * Note: generateBrief preserves user-friendly messaging for HTTP
 * 529/overloaded responses by inspecting err.response.data.error
 * after the apiClient migration.
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
  sceneInterviewApi,
  updateChapterApi,
  addChapterLineApi,
} from './SceneInterview';

describe('SceneInterview — Track 6 CP11 file-local helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('sceneInterviewApi POST on /memories/scene-interview returns full axios response', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { brief: { theme: 'longing' } } });
    const out = await sceneInterviewApi({ book_id: 'b-1', chapter_id: 'c-1' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/scene-interview',
      { book_id: 'b-1', chapter_id: 'c-1' },
    );
    expect(out.data.brief.theme).toBe('longing');
  });

  test('updateChapterApi PUT on /storyteller/chapters/:id (3-fold cross-CP dup)', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    await updateChapterApi('c-1', { theme: 'longing', scene_goal: 'reconcile' });
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/storyteller/chapters/c-1',
      { theme: 'longing', scene_goal: 'reconcile' },
    );
  });

  test('addChapterLineApi POST on /storyteller/chapters/:id/lines returns response.data', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { line: { id: 'l-1' } } });
    const out = await addChapterLineApi('c-1', { text: 'Once upon a time', group_label: 'opening', status: 'pending' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/storyteller/chapters/c-1/lines',
      { text: 'Once upon a time', group_label: 'opening', status: 'pending' },
    );
    expect(out.line.id).toBe('l-1');
  });

  describe('Error path propagation', () => {
    test('sceneInterviewApi rejection exposes response.data.error for 529 detection', async () => {
      const httpErr = new Error('overloaded');
      httpErr.response = { status: 529, data: { error: 'Anthropic Overloaded' } };
      vi.mocked(apiClient.post).mockRejectedValue(httpErr);
      await expect(sceneInterviewApi({})).rejects.toMatchObject({
        response: { data: { error: 'Anthropic Overloaded' } },
      });
    });

    test('updateChapterApi rejection propagates', async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error('forbidden'));
      await expect(updateChapterApi('c-1', {})).rejects.toThrow('forbidden');
    });

    test('addChapterLineApi rejection propagates (caller logs)', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('not found'));
      await expect(addChapterLineApi('missing', {})).rejects.toThrow('not found');
    });
  });
});
