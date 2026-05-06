/**
 * RelationshipEngine/WebView — CP15.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../../services/api';
import { getRelationshipMapApi } from './WebView';

describe('WebView — Track 6 CP15', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getRelationshipMapApi GET on /memories/relationship-map', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { nodes: [], edges: [] } });
    await getRelationshipMapApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/memories/relationship-map');
  });

  test('rejection propagates (caller setErr)', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(getRelationshipMapApi()).rejects.toThrow('not authorized');
  });
});
