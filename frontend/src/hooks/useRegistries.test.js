/**
 * useRegistries — Track 6 CP15 behavioral tests.
 * 1 site migrated. listRegistriesApi reaches 7-fold cross-CP existence
 * (Path A continued per v2.12 §9.11; ceiling-revisit deferred per v2.22).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import { listRegistriesApi } from './useRegistries';

describe('useRegistries — Track 6 CP15 hook-module helper', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listRegistriesApi GET on /character-registry/registries (7-fold cross-CP)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { registries: [] } });
    await listRegistriesApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/character-registry/registries');
  });

  test('rejection propagates (caller setError)', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(listRegistriesApi()).rejects.toThrow('not authorized');
  });
});
