/**
 * StoryThreadTracker — Track 6 CP5 behavioral tests (file 1 of 3 in CP5 batch).
 *
 * 11 fetch sites migrated via 11 module-scope helpers covering /storyteller/*
 * (threads CRUD, memories pending/confirm/reject, continuity issues, voice
 * signals/rules). File-local helpers per Track 6 convention.
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
  // Threads
  listThreadsApi,
  listDanglingThreadsApi,
  createThreadApi,
  updateThreadApi,
  deleteThreadApi,
  // Memories
  listPendingMemoriesApi,
  confirmMemoryApi,
  rejectMemoryApi,
  // Continuity / voice
  listContinuityIssuesApi,
  listVoiceSignalsApi,
  listVoiceRulesApi,
} from './StoryThreadTracker';

describe('StoryThreadTracker — Track 6 CP5 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  describe('Threads', () => {
    test('listThreadsApi GET on /storyteller/threads', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { threads: [] } });
      await listThreadsApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/storyteller/threads');
    });

    test('listDanglingThreadsApi GET on /storyteller/threads/dangling', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { threads: [] } });
      await listDanglingThreadsApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/storyteller/threads/dangling');
    });

    test('createThreadApi POST on /storyteller/threads', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      const payload = { thread_name: 'Mystery box', description: 'TBD', thread_type: 'mystery' };
      await createThreadApi(payload);
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/storyteller/threads', payload);
    });

    test('updateThreadApi PATCH on /storyteller/threads/:id', async () => {
      vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
      await updateThreadApi('t-1', { status: 'resolved' });
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/storyteller/threads/t-1',
        { status: 'resolved' },
      );
    });

    test('deleteThreadApi DELETE on /storyteller/threads/:id', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
      await deleteThreadApi('t-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/storyteller/threads/t-1');
    });
  });

  describe('Memories', () => {
    test('listPendingMemoriesApi GET on /storyteller/memories/pending', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { memories: [] } });
      await listPendingMemoriesApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/storyteller/memories/pending');
    });

    test('confirmMemoryApi PATCH on /storyteller/memories/:id/confirm (no body)', async () => {
      vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
      await confirmMemoryApi('m-1');
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/storyteller/memories/m-1/confirm',
      );
    });

    test('rejectMemoryApi PATCH on /storyteller/memories/:id/reject (no body)', async () => {
      vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
      await rejectMemoryApi('m-1');
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/storyteller/memories/m-1/reject',
      );
    });
  });

  describe('Continuity / voice', () => {
    test('listContinuityIssuesApi GET on /storyteller/continuity/issues', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { issues: [] } });
      await listContinuityIssuesApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/storyteller/continuity/issues');
    });

    test('listVoiceSignalsApi GET on /storyteller/voice-signals', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { signals: [] } });
      await listVoiceSignalsApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/storyteller/voice-signals');
    });

    test('listVoiceRulesApi GET on /storyteller/voice-rules', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { rules: [] } });
      await listVoiceRulesApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/storyteller/voice-rules');
    });
  });

  describe('Error path propagation', () => {
    test('listThreadsApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listThreadsApi()).rejects.toThrow('not authorized');
    });

    test('createThreadApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('validation'));
      await expect(createThreadApi({})).rejects.toThrow('validation');
    });

    test('confirmMemoryApi rejection propagates', async () => {
      vi.mocked(apiClient.patch).mockRejectedValue(new Error('forbidden'));
      await expect(confirmMemoryApi('m-1')).rejects.toThrow('forbidden');
    });
  });
});
