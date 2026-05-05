/**
 * PushToBrain — Track 4 behavioral tests.
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
import { pushToBrain } from './PushToBrain';

describe('PushToBrain — Track 4 helper', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('pushToBrain POSTs page name + page data to franchise-brain endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { entries_created: 5, message: '5 entries created' },
    });
    const result = await pushToBrain('episodes', { foo: 'bar' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/franchise-brain/push-from-page',
      { page_name: 'episodes', page_data: { foo: 'bar' } }
    );
    expect(result.data.entries_created).toBe(5);
  });

  test('error path — rejection propagates', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('rate limited'));
    await expect(pushToBrain('x', {})).rejects.toThrow('rate limited');
  });
});
