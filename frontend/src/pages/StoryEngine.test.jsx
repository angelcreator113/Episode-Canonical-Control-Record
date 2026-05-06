/**
 * StoryEngine — Track 6 CP9 behavioral tests (file 3 of 8).
 *
 * 5 fetch sites migrated via 5 module-scope helpers across 3 endpoint
 * families: /story-health, /memories, /amber. readStoryApi configured
 * with responseType: 'blob' for ElevenLabs audio.
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

vi.mock('../components/StoryReviewPanel', () => ({ default: () => null }));
vi.mock('../components/WriteModeAIWriter', () => ({ default: () => null }));
vi.mock('../hooks/useStoryEngine', () => ({ default: () => ({}) }));
vi.mock('../hooks/useKeyboardShortcuts', () => ({ default: () => {} }));
vi.mock('./StoryNavigator', () => ({ default: () => null }));
vi.mock('./StoryInspector', () => ({ default: () => null }));
vi.mock('./ArcGenerationStatus', () => ({ default: () => null }));
vi.mock('./storyEngineConstants', () => ({
  API_BASE: '/api/v1',
  PHASE_COLORS: {},
  PHASE_LABELS: {},
  TYPE_ICONS: {},
  WORLD_LABELS: {},
  getReadingTime: () => 0,
}));

import apiClient from '../services/api';
import {
  getTherapySuggestionsApi,
  aiWriterActionApi,
  readStoryApi,
  getEvalStoriesApi,
  getThreadsForStoryApi,
} from './StoryEngine';

describe('StoryEngine — Track 6 CP9 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getTherapySuggestionsApi GET on /story-health/therapy-suggestions/:characterKey', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { suggestions: [] } });
    await getTherapySuggestionsApi('lala');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/story-health/therapy-suggestions/lala');
  });

  test('aiWriterActionApi POST on /memories/ai-writer-action', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { content: 'generated' } });
    const payload = { story_number: 1, action: 'continue', length: 'short' };
    await aiWriterActionApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/memories/ai-writer-action', payload);
  });

  test('readStoryApi POST on /amber/read-story with responseType: blob', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: new Blob(['audio-bytes']) });
    await readStoryApi({ text: 'story prose...' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/amber/read-story',
      { text: 'story prose...' },
      { responseType: 'blob' },
    );
  });

  test('getEvalStoriesApi GET on /memories/eval-stories/:id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { evaluation: { overall_score: 0.8 } } });
    await getEvalStoriesApi('s-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/memories/eval-stories/s-1');
  });

  test('getThreadsForStoryApi GET with character_key encoded query', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { threads: [] } });
    await getThreadsForStoryApi(7, 'lala');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/story-health/threads-for-story/7?character_key=lala',
    );
  });

  test('getThreadsForStoryApi encodes special characters in character_key', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { threads: [] } });
    await getThreadsForStoryApi(7, 'just a woman');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/story-health/threads-for-story/7?character_key=just%20a%20woman',
    );
  });

  test('getTherapySuggestionsApi rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(getTherapySuggestionsApi('x')).rejects.toThrow('not authorized');
  });

  test('readStoryApi rejection propagates (caller falls through to browser TTS)', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('elevenlabs unavailable'));
    await expect(readStoryApi({ text: 'x' })).rejects.toThrow('elevenlabs unavailable');
  });

  test('aiWriterActionApi rejection propagates', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('busy'));
    await expect(aiWriterActionApi({})).rejects.toThrow('busy');
  });
});
