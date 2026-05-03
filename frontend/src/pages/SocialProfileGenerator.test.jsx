/**
 * SocialProfileGenerator — Track 3 Stage 2 behavioral tests.
 *
 * 38 sites migrated via 12 module-scope helpers covering the user-facing
 * operation per feature cluster (profile CRUD, bulk job lifecycle, scheduler,
 * analytics, templates, approval). Spot-tests one helper per cluster.
 *
 * Helper-name disambiguation: Api-suffixed exports avoid shadowing the
 * component-local handler functions (finalizeProfile, crossProfile,
 * editProfile, regenerateProfile, generateProfile, exportProfiles,
 * approveProfile, rejectProfileCrossing, runBulkAction, deleteTemplate,
 * previewAutoSparks).
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

vi.mock('../components/FeedBulkImport', () => ({ default: () => null }));
vi.mock('./feed/ProfileCard', () => ({ default: () => null }));
vi.mock('./feed/ProfileDetailPanel', () => ({
  DetailPanel: () => null,
  FeedStatePicker: () => null,
}));
vi.mock('./feed/FeedEnhancements', () => ({
  ProfileComparison: () => null,
  LalaReactions: () => null,
  FeedTimeline: () => null,
  RelationshipWeb: () => null,
}));
vi.mock('./feed/FeedViews', () => ({ default: () => null }));

import apiClient from '../services/api';
import {
  // Listing
  fetchProfiles,
  fetchProfileDetail,
  fetchJustAWomanProfile,
  // Lifecycle (Api-suffix)
  generateProfileApi,
  finalizeProfileApi,
  crossProfileApi,
  editProfileApi,
  deleteProfileById,
  regenerateProfileApi,
  fetchCrossingPreview,
  fetchSceneContext,
  approveProfileApi,
  rejectProfileCrossingApi,
  // Bulk
  fetchBulkJob,
  cancelBulkJob,
  runBulkActionApi,
  // Export / stats / analytics
  exportProfilesApi,
  fetchFollowEngineStats,
  fetchAnalyticsComposition,
  fetchMomentsTimeline,
  fetchRelationshipSuggestions,
  acceptRelationshipSuggestion,
  // Templates
  fetchTemplates,
  saveTemplate,
  deleteTemplateApi,
  // Scheduler
  fetchSchedulerStatus,
  triggerSchedulerAction,
  runSchedulerNow,
  fillOneSchedulerLayer,
  updateSchedulerConfig,
  triggerAutoGenerateJob,
  previewAutoSparksApi,
} from './SocialProfileGenerator';

describe('SocialProfileGenerator — Track 3 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  describe('Profile listing', () => {
    test('fetchProfiles GET on /social-profiles?<qs>', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { profiles: [] } });
      const qs = new URLSearchParams({ status: 'finalized' });
      await fetchProfiles(qs);
      expect(apiClient.get).toHaveBeenCalledWith(`/api/v1/social-profiles?${qs}`);
    });

    test('fetchProfileDetail GET on /social-profiles/:id', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { profile: { id: 'p-1' } } });
      await fetchProfileDetail('p-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/social-profiles/p-1');
    });

    test('fetchJustAWomanProfile GET on lalaverse search', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { profiles: [] } });
      await fetchJustAWomanProfile();
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/social-profiles?feed_layer=lalaverse&search=justawoman&limit=1'
      );
    });
  });

  describe('Profile lifecycle', () => {
    test('generateProfileApi POST on /generate', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { profile: {} } });
      await generateProfileApi({ handle: 'x', vibe_sentence: 'y' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/social-profiles/generate',
        { handle: 'x', vibe_sentence: 'y' }
      );
    });

    test('finalizeProfileApi POST on /:id/finalize', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await finalizeProfileApi('p-1');
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/social-profiles/p-1/finalize');
    });

    test('crossProfileApi POST on /:id/cross with empty body', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await crossProfileApi('p-1');
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/social-profiles/p-1/cross', {});
    });

    test('editProfileApi PUT on /:id with updates', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
      await editProfileApi('p-1', { handle: 'new' });
      expect(apiClient.put).toHaveBeenCalledWith('/api/v1/social-profiles/p-1', { handle: 'new' });
    });

    test('deleteProfileById DELETE on /:id', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
      await deleteProfileById('p-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/social-profiles/p-1');
    });

    test('regenerateProfileApi POST on /:id/regenerate', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await regenerateProfileApi('p-1', { foo: 1 });
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/social-profiles/p-1/regenerate', { foo: 1 });
    });

    test('fetchCrossingPreview POST on /:id/crossing-preview', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await fetchCrossingPreview('p-1');
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/social-profiles/p-1/crossing-preview');
    });

    test('fetchSceneContext GET on /:id/scene-context', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
      await fetchSceneContext('p-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/social-profiles/p-1/scene-context');
    });

    test('approveProfileApi POST on /:id/approve with notes', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await approveProfileApi('p-1', 'looks good');
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/social-profiles/p-1/approve',
        { approval_notes: 'looks good' }
      );
    });

    test('rejectProfileCrossingApi POST on /:id/reject-crossing with reason', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await rejectProfileCrossingApi('p-1', 'wrong vibe');
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/social-profiles/p-1/reject-crossing',
        { rejection_reason: 'wrong vibe' }
      );
    });
  });

  describe('Bulk job lifecycle', () => {
    test('fetchBulkJob GET on /bulk/jobs/:id', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
      await fetchBulkJob('job-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/social-profiles/bulk/jobs/job-1');
    });

    test('cancelBulkJob POST on /bulk/jobs/:id/cancel', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await cancelBulkJob('job-1');
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/social-profiles/bulk/jobs/job-1/cancel');
    });

    test('runBulkActionApi POST on /:endpoint with ids array', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await runBulkActionApi('finalize-all', ['p-1', 'p-2']);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/social-profiles/finalize-all',
        { ids: ['p-1', 'p-2'] }
      );
    });
  });

  describe('Export', () => {
    test('exportProfilesApi GET with default JSON responseType', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
      const qs = new URLSearchParams({ format: 'json' });
      await exportProfilesApi(qs);
      expect(apiClient.get).toHaveBeenCalledWith(
        `/api/v1/social-profiles/export?${qs}`,
        { responseType: 'json' }
      );
    });

    test('exportProfilesApi GET with blob responseType for CSV', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: new Blob(['csv,data']) });
      const qs = new URLSearchParams({ format: 'csv' });
      await exportProfilesApi(qs, 'blob');
      expect(apiClient.get).toHaveBeenCalledWith(
        `/api/v1/social-profiles/export?${qs}`,
        { responseType: 'blob' }
      );
    });
  });

  describe('Stats / analytics / suggestions', () => {
    test('fetchFollowEngineStats GET', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
      await fetchFollowEngineStats();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/social-profiles/follow-engine/stats');
    });

    test('fetchAnalyticsComposition GET with feed_layer', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
      await fetchAnalyticsComposition('lalaverse');
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/social-profiles/analytics/composition?feed_layer=lalaverse'
      );
    });

    test('fetchMomentsTimeline GET with feed_layer + limit', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
      await fetchMomentsTimeline('real_world');
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/social-profiles/moments/timeline?feed_layer=real_world&limit=50'
      );
    });

    test('fetchRelationshipSuggestions GET', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
      await fetchRelationshipSuggestions('lalaverse');
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/social-profiles/relationships/suggestions?feed_layer=lalaverse&limit=20'
      );
    });

    test('acceptRelationshipSuggestion POST', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await acceptRelationshipSuggestion({ source_id: 's1', target_id: 't1' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/social-profiles/relationships/suggestions/accept',
        { source_id: 's1', target_id: 't1' }
      );
    });
  });

  describe('Templates', () => {
    test('fetchTemplates GET', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
      await fetchTemplates();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/social-profiles/templates');
    });

    test('saveTemplate POST with payload', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await saveTemplate({ profile_id: 'p-1', name: 'My Template' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/social-profiles/templates',
        { profile_id: 'p-1', name: 'My Template' }
      );
    });

    test('deleteTemplateApi DELETE on /templates/:id', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
      await deleteTemplateApi('tpl-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/social-profiles/templates/tpl-1');
    });
  });

  describe('Scheduler', () => {
    test('fetchSchedulerStatus GET', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
      await fetchSchedulerStatus();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/feed-scheduler/status');
    });

    test('triggerSchedulerAction POST on /:action', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await triggerSchedulerAction('start');
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/feed-scheduler/start');
    });

    test('runSchedulerNow POST on /run-now', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await runSchedulerNow();
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/feed-scheduler/run-now');
    });

    test('fillOneSchedulerLayer POST with feed_layer', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await fillOneSchedulerLayer('lalaverse');
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/feed-scheduler/fill-one',
        { feed_layer: 'lalaverse' }
      );
    });

    test('updateSchedulerConfig PUT', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
      await updateSchedulerConfig({ enabled: true });
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/feed-scheduler/config',
        { enabled: true }
      );
    });

    test('triggerAutoGenerateJob POST', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { job_id: 'j-1' } });
      await triggerAutoGenerateJob({ feed_layer: 'lalaverse', count: 5 });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/feed-scheduler/auto-generate-job',
        { feed_layer: 'lalaverse', count: 5 }
      );
    });

    test('previewAutoSparksApi POST', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { sparks: [] } });
      await previewAutoSparksApi({ feed_layer: 'lalaverse', count: 3 });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/feed-scheduler/preview-sparks',
        { feed_layer: 'lalaverse', count: 3 }
      );
    });
  });

  describe('Error propagation', () => {
    test('finalizeProfileApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('not finalizable'));
      await expect(finalizeProfileApi('p-x')).rejects.toThrow('not finalizable');
    });

    test('exportProfilesApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('export failed'));
      await expect(exportProfilesApi(new URLSearchParams())).rejects.toThrow('export failed');
    });
  });
});
