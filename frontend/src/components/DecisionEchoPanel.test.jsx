/**
 * DecisionEchoPanel — CP15 (plantEchoApi).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import { plantEchoApi } from './DecisionEchoPanel';

describe('DecisionEchoPanel — Track 6 CP15', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('plantEchoApi POST on /storyteller/echoes', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    const payload = { book_id: 'b-1', source_line_id: 'l-1', target_chapter_id: 'c-2', note: 'echo' };
    await plantEchoApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/storyteller/echoes', payload);
  });

  test('rejection propagates (caller logs)', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('forbidden'));
    await expect(plantEchoApi({})).rejects.toThrow('forbidden');
  });
});
