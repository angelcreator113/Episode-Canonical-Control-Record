/**
 * FranchiseBrain — Track 6 CP4 behavioral tests.
 *
 * 18 fetch sites migrated via 11 module-scope helpers covering
 * /franchise-brain/* (entries CRUD + state-transitions, documents,
 * amber-activity, ingest-document, guard). Closes F34 from audit
 * handoff v8 (unauthenticated franchise-brain mutations).
 *
 * Helpers are exported with the Api suffix (Pattern F prophylactic) so they
 * never collide with component-local handler names like handleCreate,
 * activateEntry, archiveEntry, deleteEntry, unarchiveEntry, saveEdit,
 * handleIngest, handleExtract, handleGuard, loadCounts, loadSourceCounts,
 * loadBrainDocs, loadAmberActivity, bulkActivate.
 *
 * Spot-tests one helper per cluster + signature variations (GET with/without
 * query string, PATCH no-body state-transition vs PATCH with body, POST
 * with body) + error-path propagation.
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

vi.mock('./PdfIngestZone', () => ({ default: () => null }));

import apiClient from '../services/api';
import {
  // Entries
  listEntriesApi,
  createEntryApi,
  updateEntryApi,
  deleteEntryApi,
  activateEntryApi,
  archiveEntryApi,
  unarchiveEntryApi,
  // Documents / activity
  listDocumentsApi,
  getAmberActivityApi,
  // Action endpoints
  ingestDocumentApi,
  guardApi,
} from './FranchiseBrain';

describe('FranchiseBrain — Track 6 CP4 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  describe('Entries listing', () => {
    test('listEntriesApi GET without query string hits bare /entries', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { entries: [] } });
      await listEntriesApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/franchise-brain/entries');
    });

    test('listEntriesApi GET with query string (single filter)', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { entries: [], count: 0 } });
      await listEntriesApi('status=active');
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/franchise-brain/entries?status=active',
      );
    });

    test('listEntriesApi GET with multiple filters via URLSearchParams shape', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { entries: [] } });
      const params = new URLSearchParams({ category: 'franchise_law' }).toString();
      await listEntriesApi(params);
      expect(apiClient.get).toHaveBeenCalledWith(
        `/api/v1/franchise-brain/entries?${params}`,
      );
    });

    test('listEntriesApi GET with limit=5000 (loadSourceCounts pattern)', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { entries: [] } });
      await listEntriesApi('limit=5000');
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/franchise-brain/entries?limit=5000',
      );
    });
  });

  describe('Entries CRUD', () => {
    test('createEntryApi POST on /entries with form payload', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { entry: { id: 'e-1' } } });
      const form = {
        title: 'Lala leaves Echo Park',
        content: 'She walks out at dawn.',
        category: 'narrative',
        severity: 'important',
        always_inject: false,
      };
      await createEntryApi(form);
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/franchise-brain/entries', form);
    });

    test('updateEntryApi PATCH on /entries/:id with edit payload', async () => {
      vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
      await updateEntryApi('e-1', { title: 'Updated title' });
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/franchise-brain/entries/e-1',
        { title: 'Updated title' },
      );
    });

    test('deleteEntryApi DELETE on /entries/:id', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
      await deleteEntryApi('e-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/franchise-brain/entries/e-1');
    });
  });

  describe('Entry state transitions', () => {
    test('activateEntryApi PATCH on /entries/:id/activate (no body)', async () => {
      vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
      await activateEntryApi('e-1');
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/franchise-brain/entries/e-1/activate',
      );
    });

    test('archiveEntryApi PATCH on /entries/:id/archive (no body)', async () => {
      vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
      await archiveEntryApi('e-1');
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/franchise-brain/entries/e-1/archive',
      );
    });

    test('unarchiveEntryApi PATCH on /entries/:id/unarchive (no body)', async () => {
      vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
      await unarchiveEntryApi('e-1');
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/franchise-brain/entries/e-1/unarchive',
      );
    });
  });

  describe('Documents / activity', () => {
    test('listDocumentsApi GET on /documents', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { documents: [] } });
      await listDocumentsApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/franchise-brain/documents');
    });

    test('getAmberActivityApi GET on /amber-activity', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
      await getAmberActivityApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/franchise-brain/amber-activity');
    });
  });

  describe('Action endpoints', () => {
    test('ingestDocumentApi POST on /ingest-document with document_text', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { entries_created: 7 } });
      await ingestDocumentApi({ document_text: 'long pasted manuscript' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/franchise-brain/ingest-document',
        { document_text: 'long pasted manuscript' },
      );
    });

    test('ingestDocumentApi POST with chat_extract source (handleExtract pattern)', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { entries_created: 3 } });
      await ingestDocumentApi({ document_text: 'chat log', source: 'chat_extract' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/franchise-brain/ingest-document',
        { document_text: 'chat log', source: 'chat_extract' },
      );
    });

    test('guardApi POST on /guard with scene payload', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { violations: [] } });
      const payload = {
        scene_brief: 'Lala on rooftop',
        characters_in_scene: ['Lala', 'Amber'],
        scene_type: 'climax',
        tone: 'tense',
      };
      await guardApi(payload);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/franchise-brain/guard',
        payload,
      );
    });
  });

  describe('Error path propagation', () => {
    test('listEntriesApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listEntriesApi('status=active')).rejects.toThrow('not authorized');
    });

    test('createEntryApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('validation'));
      await expect(createEntryApi({})).rejects.toThrow('validation');
    });

    test('deleteEntryApi rejection propagates', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('forbidden'));
      await expect(deleteEntryApi('e-1')).rejects.toThrow('forbidden');
    });

    test('activateEntryApi rejection propagates (used in single + bulk)', async () => {
      vi.mocked(apiClient.patch).mockRejectedValue(new Error('conflict'));
      await expect(activateEntryApi('e-1')).rejects.toThrow('conflict');
    });

    test('guardApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('server error'));
      await expect(guardApi({})).rejects.toThrow('server error');
    });
  });
});
