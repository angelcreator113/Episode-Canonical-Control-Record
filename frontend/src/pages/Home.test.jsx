/**
 * Home — Track 6 CP7 behavioral tests (file 1 of 10 in CP7 long-tail batch 1).
 *
 * 1 fetch site migrated via 1 module-scope helper. listRegistriesApi
 * duplicated locally from CP3 WriteMode + CP6 CharacterTherapy per v2.12
 * §9.11 file-local convention (~3 LOC duplication).
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
import { listRegistriesApi } from './Home';

describe('Home — Track 6 CP7 module-scope helper', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listRegistriesApi GET on /character-registry/registries', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { registries: [] } });
    await listRegistriesApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/character-registry/registries');
  });

  test('listRegistriesApi rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(listRegistriesApi()).rejects.toThrow('not authorized');
  });
});
