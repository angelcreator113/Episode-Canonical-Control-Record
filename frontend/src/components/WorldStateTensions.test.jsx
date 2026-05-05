/**
 * WorldStateTensions — Track 6 CP8 behavioral tests (file 8 of 10).
 *
 * 7 fetch sites migrated via 7 module-scope helpers ALL duplicated locally
 * from CP7 WorldDashboard.jsx per v2.12 §9.11 file-local convention.
 * ~21 LOC duplication preserves test-per-file isolation.
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
  listSnapshotsApi,
  listTimelineApi,
  getTensionScannerApi,
  createSnapshotApi,
  createTimelineEventApi,
  deleteTimelineEventApi,
  createTensionProposalApi,
} from './WorldStateTensions';

describe('WorldStateTensions — Track 6 CP8 module-scope helpers (CP7 duplicates)', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listSnapshotsApi GET on /world/state/snapshots', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { snapshots: [] } });
    await listSnapshotsApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/state/snapshots');
  });

  test('listTimelineApi GET on /world/state/timeline', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [] } });
    await listTimelineApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/state/timeline');
  });

  test('getTensionScannerApi GET on /world/tension-scanner', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { pairs: [] } });
    await getTensionScannerApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/world/tension-scanner');
  });

  test('createSnapshotApi POST on /world/state/snapshots', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    const payload = { snapshot_label: 'mid-act', world_facts: ['f1'], active_threads: ['t1'] };
    await createSnapshotApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/world/state/snapshots', payload);
  });

  test('createTimelineEventApi POST on /world/state/timeline', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    const payload = { event_name: 'launch', event_description: '...', event_type: 'plot', impact_level: 'major', story_date: '' };
    await createTimelineEventApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/world/state/timeline', payload);
  });

  test('deleteTimelineEventApi DELETE on /world/state/timeline/:id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await deleteTimelineEventApi('e-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/world/state/timeline/e-1');
  });

  test('createTensionProposalApi POST on /world/create-tension-proposal', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { proposal: {} } });
    await createTensionProposalApi({ char_a_id: 'a', char_b_id: 'b' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/world/create-tension-proposal',
      { char_a_id: 'a', char_b_id: 'b' },
    );
  });

  test('listSnapshotsApi rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(listSnapshotsApi()).rejects.toThrow('not authorized');
  });

  test('createTensionProposalApi rejection propagates', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('busy'));
    await expect(createTensionProposalApi({})).rejects.toThrow('busy');
  });
});
