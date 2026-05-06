/**
 * WorldLocations — Track 6 CP11 behavioral tests (file 7 of 17).
 *
 * 4 fetch sites migrated via 5 helpers. 4-of-4 sites duplicate
 * CP8 WorldFoundation helpers per v2.12 §9.11 file-local convention.
 * Combined-axis branching split (method+URL same conditional) on
 * saveLocation per v2.13 + v2.17 §9.11 — first F-AUTH-1 instance:
 * call site does single ternary on editId, picking createLocationApi
 * (POST /locations) vs updateLocationApi (PUT /locations/:id).
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
  listLocationsApi,
  seedInfrastructureApi,
  createLocationApi,
  updateLocationApi,
  deleteLocationApi,
} from './WorldLocations';

describe('WorldLocations — Track 6 CP11 file-local helpers (CP8 WorldFoundation dups)', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listLocationsApi GET on /world/locations', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { locations: [] } });
    await listLocationsApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/locations');
  });

  test('seedInfrastructureApi POST on /world/locations/seed-infrastructure (no body)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { created: 12 } });
    const out = await seedInfrastructureApi();
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/world/locations/seed-infrastructure');
    expect(out).toEqual({ created: 12 });
  });

  test('createLocationApi POST on /world/locations (combined-axis branch — POST + base URL)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    const payload = { name: 'Le Marais', location_type: 'venue', venue_type: 'restaurant' };
    await createLocationApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/world/locations', payload);
  });

  test('updateLocationApi PUT on /world/locations/:id (combined-axis branch — PUT + variable URL)', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    await updateLocationApi('loc-1', { name: 'Updated' });
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/world/locations/loc-1', { name: 'Updated' });
  });

  test('deleteLocationApi DELETE on /world/locations/:id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await deleteLocationApi('loc-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/world/locations/loc-1');
  });

  describe('Combined-axis branching site behavior', () => {
    test('editId truthy → updateLocationApi (PUT/:id)', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
      const editId = 'loc-7';
      const payload = { name: 'X' };
      // call-site shape (saveLocation): editId ? updateLocationApi(editId, payload) : createLocationApi(payload)
      await (editId ? updateLocationApi(editId, payload) : createLocationApi(payload));
      expect(apiClient.put).toHaveBeenCalledWith('/api/v1/world/locations/loc-7', payload);
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    test('editId falsy → createLocationApi (POST/base)', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      const editId = null;
      const payload = { name: 'New' };
      await (editId ? updateLocationApi(editId, payload) : createLocationApi(payload));
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/world/locations', payload);
      expect(apiClient.put).not.toHaveBeenCalled();
    });
  });

  describe('Error path propagation', () => {
    test('listLocationsApi rejection propagates (caller logs)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listLocationsApi()).rejects.toThrow('not authorized');
    });

    test('updateLocationApi rejection propagates', async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error('not found'));
      await expect(updateLocationApi('missing', {})).rejects.toThrow('not found');
    });

    test('deleteLocationApi rejection propagates', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('forbidden'));
      await expect(deleteLocationApi('loc-1')).rejects.toThrow('forbidden');
    });
  });
});
