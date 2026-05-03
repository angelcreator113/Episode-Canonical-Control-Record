/**
 * StoryPlannerConversational — Track 2.5 behavioral tests.
 *
 * Tests the 4 extracted apiClient helpers (Track 2-A migration). The 5th site
 * (chapter update on the else branch) shares updateChapterViaPlanner with the
 * if-branch update — single helper, single test.
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
  sendStoryPlannerChat,
  updateBookViaPlanner,
  createChapterViaPlanner,
  updateChapterViaPlanner,
} from './StoryPlannerConversational';

describe('StoryPlannerConversational — apiClient helper behavioral tests', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  describe('sendStoryPlannerChat — chat send POST', () => {
    test('happy path — apiClient.post called with /memories/story-planner-chat + payload', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { reply: 'sounds good' } });

      const payload = {
        message: 'Hi',
        history: [],
        book: { id: 'b1', title: 'Book' },
        plan: {},
        characters: [],
        approvalStatus: { pending: 0, approved: 0, items: [] },
        healthReport: { issues: [], counts: {} },
      };

      const res = await sendStoryPlannerChat(payload);

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/memories/story-planner-chat',
        payload
      );
      expect(res.data.reply).toBe('sounds good');
    });

    test('error path — rejection propagates', async () => {
      const err = new Error('LLM timeout');
      vi.mocked(apiClient.post).mockRejectedValue(err);
      await expect(sendStoryPlannerChat({})).rejects.toBe(err);
    });
  });

  describe('updateBookViaPlanner — book PUT', () => {
    test('happy path — apiClient.put called with book URL + updates', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ data: {} });

      await updateBookViaPlanner('book-7', { title: 'New Title', theme: 'romance' });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/storyteller/books/book-7',
        { title: 'New Title', theme: 'romance' }
      );
    });
  });

  describe('createChapterViaPlanner — new chapter POST', () => {
    test('happy path — apiClient.post called with chapters URL + payload', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { chapter: { id: 'ch-new' } },
      });

      const res = await createChapterViaPlanner('book-7', {
        title: 'Chapter 3',
        chapter_number: 3,
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/storyteller/books/book-7/chapters',
        { title: 'Chapter 3', chapter_number: 3 }
      );
      expect(res.data.chapter.id).toBe('ch-new');
    });
  });

  describe('updateChapterViaPlanner — existing chapter PUT (covers both branches)', () => {
    test('happy path — apiClient.put called with chapter URL + body', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ data: {} });

      const body = {
        title: 'Renamed',
        scene_goal: 'protagonist confronts antagonist',
        chapter_notes: 'big moment',
      };

      await updateChapterViaPlanner('ch-3', body);

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/storyteller/chapters/ch-3',
        body
      );
    });

    test('error path — rejection propagates', async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error('not found'));
      await expect(updateChapterViaPlanner('ch-x', {})).rejects.toThrow('not found');
    });
  });
});
