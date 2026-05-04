/**
 * RelationshipEngine — Track 3 behavioral tests for migrated apiClient helpers.
 *
 * 11 helpers cover the 12 Path-C call sites (the tree-load path uses two
 * helpers in parallel). One happy + one error test per shape category;
 * mechanical migrations don't need exhaustive per-helper coverage.
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

vi.mock('../components/RelationshipEngine', () => ({
  WebView: () => null, TreeView: () => null, FamilyView: () => null,
  CandidateView: () => null, ListView: () => null,
  Inspector: () => null, AddModal: () => null, GenModal: () => null,
  Btn: () => null, LFBtn: () => null, Spinner: () => null,
  useToast: () => ({ toasts: [], show: () => {} }),
  API: '/api/v1',
  T: {}, LAYER: {}, TENSION: {},
  cname: () => '', clayer: () => '', initials: () => '', roleColor: () => '',
}));

import apiClient from '../services/api';
import {
  fetchRelationshipTree,
  fetchPendingRelationships,
  fetchFamilyTree,
  confirmRelationship,
  dismissRelationship,
  deleteRelationship,
  generateRelationships,
  createRelationship,
  generateFamilyRelationships,
  updateRelationshipFamilyRole,
  updateRelationshipFields,
} from './RelationshipEngine';

describe('RelationshipEngine — Track 3 helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('fetchRelationshipTree GET on /relationships/tree/:regId', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
    await fetchRelationshipTree('reg-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/relationships/tree/reg-1');
  });

  test('fetchPendingRelationships GET on /relationships/pending', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { candidates: [] } });
    await fetchPendingRelationships();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/relationships/pending');
  });

  test('fetchFamilyTree GET on /relationships/family-tree/:regId', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
    await fetchFamilyTree('reg-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/relationships/family-tree/reg-1');
  });

  test('confirmRelationship POST on /relationships/confirm/:id', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await confirmRelationship('cand-1');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/confirm/cand-1');
  });

  test('dismissRelationship POST on /relationships/dismiss/:id', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await dismissRelationship('cand-2');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/dismiss/cand-2');
  });

  test('deleteRelationship DELETE on /relationships/:id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await deleteRelationship('rel-3');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/relationships/rel-3');
  });

  test('generateRelationships POST with payload', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { candidates: [] } });
    await generateRelationships({ registry_id: 'r1', focus_character_id: 'c1' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/relationships/generate',
      { registry_id: 'r1', focus_character_id: 'c1' }
    );
  });

  test('createRelationship POST with payload on /relationships', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await createRelationship({ a: 'x', b: 'y', registry_id: 'r1' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/relationships',
      { a: 'x', b: 'y', registry_id: 'r1' }
    );
  });

  test('generateFamilyRelationships POST on /relationships/generate-family', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await generateFamilyRelationships({ registry_id: 'r1' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/relationships/generate-family',
      { registry_id: 'r1' }
    );
  });

  test('updateRelationshipFamilyRole PATCH on /relationships/:id/family', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
    await updateRelationshipFamilyRole('rel-7', { role: 'mother' });
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/api/v1/relationships/rel-7/family',
      { role: 'mother' }
    );
  });

  test('updateRelationshipFields PATCH on /relationships/:id', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
    await updateRelationshipFields('rel-7', { weight: 0.8 });
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/api/v1/relationships/rel-7',
      { weight: 0.8 }
    );
  });

  test('error path — confirmRelationship rejection propagates', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('not found'));
    await expect(confirmRelationship('cand-x')).rejects.toThrow('not found');
  });
});
