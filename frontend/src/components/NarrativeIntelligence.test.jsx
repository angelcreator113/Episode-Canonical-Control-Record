/**
 * NarrativeIntelligence — Track 6 CP9 behavioral tests (file 7 of 8).
 *
 * 5 fetch sites migrated via 4 module-scope helpers — addChapterLineApi
 * covers 2 sites (single-line accept + per-line in intimate-scene loop).
 *
 * v2.15 §9.11 existing-test-file note: NarrativeIntelligence is mocked in
 * CP3 WriteMode.test.jsx as `{ default: () => null }` (default-export-only
 * suppression). New named exports here do NOT conflict because WriteMode
 * imports only the default — verified during CP9 surface analysis.
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
  listWorldCharactersByBookApi,
  requestNarrativeIntelligenceApi,
  generateIntimateSceneApi,
  addChapterLineApi,
} from './NarrativeIntelligence';

describe('NarrativeIntelligence — Track 6 CP9 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listWorldCharactersByBookApi GET on /world/characters?book_id=:id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { characters: [] } });
    await listWorldCharactersByBookApi('book-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/characters?book_id=book-1');
  });

  test('requestNarrativeIntelligenceApi POST on /memories/narrative-intelligence', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { suggestion: {} } });
    const payload = {
      book_id: 'b-1',
      chapter_id: 'ch-1',
      chapter_brief: { title: 'Ch 1' },
      recent_lines: ['line 1', 'line 2'],
      line_count: 10,
      characters: [],
    };
    await requestNarrativeIntelligenceApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/narrative-intelligence',
      payload,
    );
  });

  test('generateIntimateSceneApi POST on /memories/generate-intimate-scene', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { lines: [] } });
    const payload = {
      chapter_id: 'ch-1',
      character_id: 'c-1',
      scene_type: 'charged_moment',
      career_stage: 'mid_career',
      recent_lines: [],
      chapter_brief: {},
    };
    await generateIntimateSceneApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/memories/generate-intimate-scene',
      payload,
    );
  });

  test('addChapterLineApi POST on /storyteller/chapters/:chapterId/lines (single-accept)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { line: {} } });
    const payload = {
      text: 'suggested line',
      source_tags: ['narrative_intelligence'],
      group_label: 'AI suggestion after line 5',
      status: 'pending',
    };
    await addChapterLineApi('ch-1', payload);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/storyteller/chapters/ch-1/lines',
      payload,
    );
  });

  test('addChapterLineApi POST inside intimate-scene loop (per-line)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { line: {} } });
    const payload = {
      text: 'generated line',
      source_tags: ['intimate_scene', 'David'],
      group_label: 'Intimate scene — David',
      status: 'pending',
    };
    await addChapterLineApi('ch-1', payload);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/storyteller/chapters/ch-1/lines',
      payload,
    );
  });

  describe('Error path propagation', () => {
    test('listWorldCharactersByBookApi rejection propagates (caller swallows)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listWorldCharactersByBookApi('b-1')).rejects.toThrow('not authorized');
    });

    test('requestNarrativeIntelligenceApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('busy'));
      await expect(requestNarrativeIntelligenceApi({})).rejects.toThrow('busy');
    });

    test('addChapterLineApi rejection propagates (caller console.error)', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('forbidden'));
      await expect(addChapterLineApi('ch-1', {})).rejects.toThrow('forbidden');
    });
  });
});
