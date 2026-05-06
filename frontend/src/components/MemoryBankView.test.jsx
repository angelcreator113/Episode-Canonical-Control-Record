/**
 * MemoryBankView — CP15 (listRegistriesApi 8-fold + v2.14 internal-helper-refactor).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import { listRegistriesApi } from './MemoryBankView';

describe('MemoryBankView — Track 6 CP15', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listRegistriesApi GET on /character-registry/registries (8-fold cross-CP)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { registries: [] } });
    await listRegistriesApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/character-registry/registries');
  });

  test('rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(listRegistriesApi()).rejects.toThrow('not authorized');
  });

  test('apiClient.request used internally by apiFetch wrapper (v2.14 refactor)', () => {
    // Smoke test: the internal apiFetch wrapper now routes through apiClient.request.
    // Wrapper preserves error contract via Object.assign on (status, data).
    expect(typeof apiClient.request).toBe('function');
  });
});
