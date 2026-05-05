/**
 * WorldFoundation — Track 6 CP8 behavioral tests (file 10 of 10).
 *
 * 7 fetch sites migrated via 8 module-scope helpers (one site uses 2 helpers
 * conditionally per the method-branching split pattern). HARDEST file in CP8:
 *   - Multipart upload (uploadMapApi) — second F-AUTH-1 multipart site
 *     after CP7 PdfIngestZone; pattern per v2.14 §9.11
 *   - Method-branching split (createLocationApi + updateLocationApi) — call
 *     site does the conditional, mirrors CP6 TemplateDesigner pattern
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

vi.mock('../hooks/usePageData', () => ({ default: () => ({ data: {}, updateItem: vi.fn(), addItem: vi.fn(), removeItem: vi.fn(), saving: false }) }));
vi.mock('../components/EditItemModal', () => ({
  EditItemModal: () => null,
  PageEditContext: { Provider: ({ children }) => children },
  EditableList: () => null,
  usePageEdit: () => ({ editing: false, setEditing: vi.fn() }),
}));
vi.mock('../components/PushToBrain', () => ({ default: () => null }));
vi.mock('../components/DreamMap', () => ({ default: () => null }));
vi.mock('../data/dreamCities', () => ({
  DREAM_CITIES: [],
  UNIVERSITIES: [],
  CORPORATIONS: [],
  WORLD_LAYERS: [],
}));

import apiClient from '../services/api';
import {
  listLocationsApi,
  createLocationApi,
  updateLocationApi,
  deleteLocationApi,
  seedInfrastructureApi,
  getProfileCompositionApi,
  getMapApi,
  uploadMapApi,
} from './WorldFoundation';

describe('WorldFoundation — Track 6 CP8 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  describe('Locations CRUD (method-branching split)', () => {
    test('listLocationsApi GET on /world/locations', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { locations: [] } });
      await listLocationsApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/locations');
    });

    test('createLocationApi POST on /world/locations (when no editId)', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      const payload = { name: 'New Venue', location_type: 'venue' };
      await createLocationApi(payload);
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/world/locations', payload);
    });

    test('updateLocationApi PUT on /world/locations/:id (when editId set)', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
      const payload = { name: 'Updated' };
      await updateLocationApi('loc-1', payload);
      expect(apiClient.put).toHaveBeenCalledWith('/api/v1/world/locations/loc-1', payload);
    });

    test('deleteLocationApi DELETE on /world/locations/:id', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
      await deleteLocationApi('loc-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/world/locations/loc-1');
    });
  });

  describe('Seed + analytics + map GETs', () => {
    test('seedInfrastructureApi POST on /world/locations/seed-infrastructure (no body)', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { created: 5 } });
      await seedInfrastructureApi();
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/world/locations/seed-infrastructure');
    });

    test('getProfileCompositionApi GET with feed_layer query', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { cities: {} } });
      await getProfileCompositionApi('lalaverse');
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/social-profiles/analytics/composition?feed_layer=lalaverse',
      );
    });

    test('getMapApi GET on /world/map', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { url: 'https://...' } });
      await getMapApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/map');
    });
  });

  describe('Multipart upload (CP7 PdfIngestZone pattern reused)', () => {
    test('uploadMapApi POST on /world/map/upload with FormData payload', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, url: 'https://...' } });
      const fd = new FormData();
      fd.append('image', new Blob(['png-bytes'], { type: 'image/png' }));
      await uploadMapApi(fd);
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/world/map/upload', fd);
    });

    test('uploadMapApi exposes response.data.error for upload UX', async () => {
      const httpErr = new Error('payload too large');
      httpErr.response = { status: 413, data: { error: 'image too big' } };
      vi.mocked(apiClient.post).mockRejectedValue(httpErr);
      await expect(uploadMapApi(new FormData())).rejects.toMatchObject({
        response: { data: { error: 'image too big' } },
      });
    });
  });

  describe('Error path propagation', () => {
    test('listLocationsApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listLocationsApi()).rejects.toThrow('not authorized');
    });

    test('createLocationApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('validation'));
      await expect(createLocationApi({})).rejects.toThrow('validation');
    });

    test('updateLocationApi rejection propagates', async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error('conflict'));
      await expect(updateLocationApi('loc-1', {})).rejects.toThrow('conflict');
    });
  });
});
