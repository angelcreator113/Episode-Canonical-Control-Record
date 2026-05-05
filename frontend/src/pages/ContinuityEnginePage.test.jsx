/**
 * ContinuityEnginePage — Track 6 CP6 behavioral tests (file 3 of 4).
 *
 * 10 fetch sites migrated via 10 module-scope helpers covering /continuity/*
 * (timelines CRUD, characters, beats, conflicts, seed-demo). Pure CP4-zone
 * idiom — `if (!res.ok) return` blocks collapsed because apiClient
 * interceptor throws on non-2xx and surrounding try/catch routes errors.
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
  // Timelines
  listTimelinesApi,
  getTimelineApi,
  listConflictsApi,
  createTimelineApi,
  // Characters
  addTimelineCharacterApi,
  deleteContinuityCharacterApi,
  // Beats
  addBeatApi,
  updateBeatApi,
  deleteBeatApi,
  // Demo seeding
  seedDemoApi,
} from './ContinuityEnginePage';

describe('ContinuityEnginePage — Track 6 CP6 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  describe('Timelines', () => {
    test('listTimelinesApi GET on /continuity/timelines without showId', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { timelines: [] } });
      await listTimelinesApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/continuity/timelines');
    });

    test('listTimelinesApi GET with showId query param', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { timelines: [] } });
      await listTimelinesApi('show-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/continuity/timelines?show_id=show-1');
    });

    test('getTimelineApi GET on /continuity/timelines/:id', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { timeline: {} } });
      await getTimelineApi('t-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/continuity/timelines/t-1');
    });

    test('listConflictsApi GET on /continuity/timelines/:id/conflicts', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { conflicts: [] } });
      await listConflictsApi('t-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/continuity/timelines/t-1/conflicts');
    });

    test('createTimelineApi POST on /continuity/timelines', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { timeline: { id: 't-1' } } });
      await createTimelineApi({ title: 'Main', description: '...', show_id: 'show-1' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/continuity/timelines',
        { title: 'Main', description: '...', show_id: 'show-1' },
      );
    });
  });

  describe('Characters', () => {
    test('addTimelineCharacterApi POST on /continuity/timelines/:id/characters', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { character: {} } });
      await addTimelineCharacterApi('t-1', { name: 'Lala' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/continuity/timelines/t-1/characters',
        { name: 'Lala' },
      );
    });

    test('deleteContinuityCharacterApi DELETE on /continuity/characters/:charId', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
      await deleteContinuityCharacterApi('c-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/continuity/characters/c-1');
    });
  });

  describe('Beats', () => {
    test('addBeatApi POST on /continuity/timelines/:id/beats', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { beat: {} } });
      await addBeatApi('t-1', { title: 'opening', sort_order: 0 });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/continuity/timelines/t-1/beats',
        { title: 'opening', sort_order: 0 },
      );
    });

    test('updateBeatApi PUT on /continuity/beats/:beatId', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ data: { beat: {} } });
      await updateBeatApi('b-1', { title: 'revised' });
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/continuity/beats/b-1',
        { title: 'revised' },
      );
    });

    test('deleteBeatApi DELETE on /continuity/beats/:beatId', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
      await deleteBeatApi('b-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/continuity/beats/b-1');
    });
  });

  describe('Demo seeding', () => {
    test('seedDemoApi POST on /continuity/timelines/:id/seed-demo (no body)', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await seedDemoApi('t-1');
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/continuity/timelines/t-1/seed-demo');
    });
  });

  describe('Error path propagation', () => {
    test('listTimelinesApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listTimelinesApi()).rejects.toThrow('not authorized');
    });

    test('createTimelineApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('validation'));
      await expect(createTimelineApi({})).rejects.toThrow('validation');
    });

    test('deleteBeatApi rejection propagates', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('forbidden'));
      await expect(deleteBeatApi('b-1')).rejects.toThrow('forbidden');
    });
  });
});
