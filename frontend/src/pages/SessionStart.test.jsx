/**
 * SessionStart — Track 6 CP7 behavioral tests (file 2 of 10).
 *
 * 1 fetch site migrated via 1 module-scope helper. Pre-migration content-type
 * defensive check eliminated (apiClient handles JSON parsing automatically;
 * axios throws on parse failure — surrounding catch handles).
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
import { getSessionBriefApi } from './SessionStart';

describe('SessionStart — Track 6 CP7 module-scope helper', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getSessionBriefApi GET on /session/brief', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { activeChapter: null } });
    await getSessionBriefApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/session/brief');
  });

  test('getSessionBriefApi rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(getSessionBriefApi()).rejects.toThrow('not authorized');
  });
});
