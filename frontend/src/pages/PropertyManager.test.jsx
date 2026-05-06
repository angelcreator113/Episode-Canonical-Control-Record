/**
 * PropertyManager — Track 6 CP11 behavioral tests (file 2 of 17).
 *
 * 3 fetch sites migrated via 3 module-scope helpers. No cross-CP
 * duplication; all helpers fresh.
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
  listPropertiesApi,
  createPropertyApi,
  addPropertyRoomApi,
} from './PropertyManager';

describe('PropertyManager — Track 6 CP11 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listPropertiesApi GET on /properties returns response.data', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
    const out = await listPropertiesApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/properties');
    expect(out).toEqual({ data: [] });
  });

  test('createPropertyApi POST on /properties with payload', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });
    const payload = { name: "Lala's Penthouse", property_type: 'penthouse', style_preset_id: 'modern-glam' };
    await createPropertyApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/properties', payload);
  });

  test('addPropertyRoomApi POST on /properties/:id/rooms', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });
    await addPropertyRoomApi('p-1', { name: 'Master Bedroom', template_id: 'bedroom-master-rectangular' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/properties/p-1/rooms',
      { name: 'Master Bedroom', template_id: 'bedroom-master-rectangular' },
    );
  });

  describe('Error path propagation', () => {
    test('listPropertiesApi rejection propagates (caller catches → empty)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listPropertiesApi()).rejects.toThrow('not authorized');
    });

    test('createPropertyApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('validation'));
      await expect(createPropertyApi({})).rejects.toThrow('validation');
    });

    test('addPropertyRoomApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('not found'));
      await expect(addPropertyRoomApi('missing', {})).rejects.toThrow('not found');
    });
  });
});
