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
  Btn: () => null, Spinner: () => null,
  useToast: () => ({ toasts: [], show: () => {} }),
  API: '/api/v1',
  T: {}, TENSION: {},
  cname: () => '', initials: () => '', roleColor: () => '', roleLabel: () => '',
}));

import apiClient from '../services/api';
import {
  fetchCast,
  restoreRelationship,
  mergeSeeds,
  deepLinkState,
  confirmRelationship,
  dismissRelationship,
  deleteRelationship,
  generateRelationships,
  createRelationship,
  generateFamilyRelationships,
  updateRelationshipFamilyRole,
  updateRelationshipFields,
  confirmAllSeeds,
  setSeedState,
  addSeeds,
  fetchPulseSuggestions,
} from './RelationshipEngine';

describe('RelationshipEngine — Track 3 helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  // One read for the whole page (2026-10-23): the cast across registries.
  test('fetchCast GET on /relationships/cast', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
    await fetchCast();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/relationships/cast');
  });

  test('restoreRelationship POST on /relationships/:id/restore (Undo)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await restoreRelationship('rel-3');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/rel-3/restore');
  });

  test('confirmRelationship POST on /relationships/confirm/:id', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await confirmRelationship('cand-1');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/confirm/cand-1');
  });

  // The server has DELETE /dismiss/:id and PUT for both edits (Task #3119).
  test('dismissRelationship DELETE on /relationships/dismiss/:id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await dismissRelationship('cand-2');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/relationships/dismiss/cand-2');
    expect(apiClient.post).not.toHaveBeenCalled();
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

  test('updateRelationshipFamilyRole PUT on /relationships/:id/family', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    await updateRelationshipFamilyRole('rel-7', { role: 'mother' });
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/relationships/rel-7/family',
      { role: 'mother' }
    );
  });

  test('updateRelationshipFields PUT on /relationships/:id', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    await updateRelationshipFields('rel-7', { weight: 0.8 });
    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/relationships/rel-7',
      { weight: 0.8 }
    );
  });

  // The seeds contract (2026-10-24): confirm with edits, confirm all,
  // Keep as idea / Bring back, dismiss with a reason, seeds from elsewhere.
  test('confirmRelationship with fields POSTs them as the body', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await confirmRelationship('cand-1', { relationship_type: 'rival' });
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/confirm/cand-1', { relationship_type: 'rival' });
  });

  test('confirmAllSeeds POST on /relationships/confirm-all with the ids', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await confirmAllSeeds(['a', 'b']);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/confirm-all', { ids: ['a', 'b'] });
  });

  test('setSeedState POST on /relationships/:id/seed-state', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await setSeedState('cand-3', 'kept');
    await setSeedState('cand-3', null);
    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/api/v1/relationships/cand-3/seed-state', { state: 'kept' });
    expect(apiClient.post).toHaveBeenNthCalledWith(2, '/api/v1/relationships/cand-3/seed-state', { state: null });
  });

  test('dismissRelationship with a reason sends it as the DELETE body', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await dismissRelationship('cand-2', { reason: 'too_soon', note: 'after ep 5' });
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/relationships/dismiss/cand-2', { data: { reason: 'too_soon', note: 'after ep 5' } });
  });

  test('addSeeds POST on /relationships/seeds; fetchPulseSuggestions GET on the Pulse suggestions', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
    await addSeeds('pulse', [{ character_id_a: 'a', character_id_b: 'b', relationship_type: 'rival' }]);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/seeds', { source: 'pulse', seeds: [{ character_id_a: 'a', character_id_b: 'b', relationship_type: 'rival' }] });
    await fetchPulseSuggestions();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/feed-relationships/suggestions');
  });

  test('error path — confirmRelationship rejection propagates', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('not found'));
    await expect(confirmRelationship('cand-x')).rejects.toThrow('not found');
  });

});

describe('RelationshipEngine — seeds and deep links (2026-10-23)', () => {
  test('new seeds join the pending list, newest first, each once', () => {
    expect(mergeSeeds([{ id: 'a' }, { id: 'b' }], [{ id: 'c' }, { id: 'a', fresh: true }]))
      .toEqual([{ id: 'c' }, { id: 'a', fresh: true }, { id: 'b' }]);
    expect(mergeSeeds([{ id: 'a' }], [])).toEqual([{ id: 'a' }]);
  });

  test('?char= selects that person, ?rel= opens that relationship, ?tab= picks a tab; unknown ids do nothing', () => {
    const chars = [{ id: 'c-1' }, { id: 'c-2' }];
    const rels = [{ id: 'r-1' }];
    expect(deepLinkState('?char=c-2', { chars, rels })).toEqual({ selChar: chars[1] });
    expect(deepLinkState('?rel=r-1', { chars, rels })).toEqual({ selRel: rels[0], panel: true });
    expect(deepLinkState('?char=c-1&tab=web', { chars, rels })).toEqual({ selChar: chars[0], tab: 'web' });
    expect(deepLinkState('?char=nobody&rel=none&tab=bogus', { chars, rels })).toBeNull();
    expect(deepLinkState('', { chars, rels })).toBeNull();
  });
});
