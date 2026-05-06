/**
 * CharacterDilemmaEngine — CP15 (therapy dilemma family).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import { listTherapyDilemmasApi, buildDilemmaProfileApi } from './CharacterDilemmaEngine';

describe('CharacterDilemmaEngine — Track 6 CP15', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listTherapyDilemmasApi GET on /therapy/dilemmas with character_id+count', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, dilemmas: [] } });
    await listTherapyDilemmasApi('c-1', 5);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/therapy/dilemmas?character_id=c-1&count=5');
  });

  test('buildDilemmaProfileApi POST on /therapy/dilemma-profile', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, profile: {} } });
    const payload = { character_id: 'c-1', character_name: 'Lala', wound: '', choices: [] };
    await buildDilemmaProfileApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/therapy/dilemma-profile', payload);
  });

  test('rejection propagates (caller falls back to local profile)', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('not authorized'));
    await expect(buildDilemmaProfileApi({})).rejects.toThrow('not authorized');
  });
});
