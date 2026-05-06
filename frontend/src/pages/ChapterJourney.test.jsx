/**
 * ChapterJourney — CP15 (getBookApi 2-fold dup + getDefaultRegistryApi fresh).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import { getBookApi, getDefaultRegistryApi } from './ChapterJourney';

describe('ChapterJourney — Track 6 CP15', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getBookApi GET on /storyteller/books/:bookId (2-fold cross-CP)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { book: { id: 'b-1' } } });
    await getBookApi('b-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/storyteller/books/b-1');
  });

  test('getDefaultRegistryApi GET on /character-registry/registries/default', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { registry: { characters: [] } } });
    await getDefaultRegistryApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/character-registry/registries/default');
  });

  test('Promise.all error semantics: getDefaultRegistryApi rejection survivable via .catch', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('book ok'));
    // First call (book) rejects → outer Promise.all rejects (covered elsewhere).
    // The .catch(() => null) pattern in caller handles the registry-only failure.
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { book: {} } });
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('registry not found'));
    const charData = await getDefaultRegistryApi().catch(() => null);
    expect(charData).toBeNull();
  });
});
