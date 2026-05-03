/**
 * BookStructurePanel — Track 3 behavioral tests for migrated apiClient helpers.
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
  loadBook,
  saveBookMetadata,
  saveChapterMetadata,
} from './BookStructurePanel';

describe('BookStructurePanel — Track 3 helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('loadBook calls apiClient.get with /storyteller/books/:id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { book: { id: 'b1' } } });
    const r = await loadBook('b1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/storyteller/books/b1');
    expect(r.data.book.id).toBe('b1');
  });

  test('saveBookMetadata calls apiClient.put with payload', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    await saveBookMetadata('b1', { author_name: 'X', front_matter: {} });
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/storyteller/books/b1',
      { author_name: 'X', front_matter: {} }
    );
  });

  test('saveChapterMetadata calls apiClient.put on chapter URL', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    await saveChapterMetadata('ch-9', { chapter_type: 'epilogue' });
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/storyteller/chapters/ch-9',
      { chapter_type: 'epilogue' }
    );
  });

  test('error path — saveBookMetadata propagates rejection', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(new Error('conflict'));
    await expect(saveBookMetadata('b1', {})).rejects.toThrow('conflict');
  });
});
