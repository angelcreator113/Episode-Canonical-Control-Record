/**
 * EpisodeTodoPage — Track 6 CP7 behavioral tests (file 7 of 10).
 *
 * 6 fetch sites migrated via 6 module-scope helpers. Promise.all + .catch
 * fallback semantics preserved at call site.
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
  getEpisodeTodoApi,
  getEpisodeTodoSocialApi,
  getEpisodeApi,
  listShowEventsApi,
  completeTodoSlotApi,
  completeSocialTodoSlotApi,
} from './EpisodeTodoPage';

describe('EpisodeTodoPage — Track 6 CP7 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getEpisodeTodoApi GET on /episodes/:episodeId/todo', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: {} } });
    await getEpisodeTodoApi('ep-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/todo');
  });

  test('getEpisodeTodoSocialApi GET on /episodes/:episodeId/todo/social', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { social_tasks: [] } });
    await getEpisodeTodoSocialApi('ep-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/todo/social');
  });

  test('getEpisodeApi GET on /episodes/:episodeId', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { episode: {} } });
    await getEpisodeApi('ep-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1');
  });

  test('listShowEventsApi GET on /world/:showId/events', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [] } });
    await listShowEventsApi('show-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/show-1/events');
  });

  test('completeTodoSlotApi POST on /episodes/:episodeId/todo/complete/:slot', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, tasks: [], completion: 0 } });
    await completeTodoSlotApi('ep-1', 'slot-3', { completed: true });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/episodes/ep-1/todo/complete/slot-3',
      { completed: true },
    );
  });

  test('completeSocialTodoSlotApi POST on /episodes/:episodeId/todo/complete-social/:slot', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, social_tasks: [] } });
    await completeSocialTodoSlotApi('ep-1', 'slot-2', { completed: false });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/episodes/ep-1/todo/complete-social/slot-2',
      { completed: false },
    );
  });

  test('getEpisodeTodoApi rejection propagates (caller must .catch fallback)', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
    await expect(getEpisodeTodoApi('missing')).rejects.toThrow('not found');
  });

  test('completeTodoSlotApi rejection propagates', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('forbidden'));
    await expect(completeTodoSlotApi('ep-1', 's-1', {})).rejects.toThrow('forbidden');
  });
});
