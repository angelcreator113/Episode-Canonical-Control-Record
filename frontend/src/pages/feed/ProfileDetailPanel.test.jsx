/**
 * ProfileDetailPanel — Track 3 Stage 2 behavioral tests.
 */

import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

import apiClient from '../../services/api';
import {
  updateProfileState,
  removeFollower,
  addFollower,
  DetailPanel,
} from './ProfileDetailPanel';

describe('ProfileDetailPanel — Track 3 helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('updateProfileState calls apiClient.patch with current_state payload', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
    await updateProfileState('p-1', 'rising');
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/api/v1/social-profiles/p-1',
      { current_state: 'rising' }
    );
  });

  test('removeFollower calls apiClient.delete on /followers/:char', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await removeFollower('p-1', 'lala');
    expect(apiClient.delete).toHaveBeenCalledWith(
      '/api/v1/social-profiles/p-1/followers/lala'
    );
  });

  test('addFollower calls apiClient.post with character payload', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { follower: {} } });
    await addFollower('p-1', { character_key: 'lala', character_name: 'Lala' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/social-profiles/p-1/followers',
      { character_key: 'lala', character_name: 'Lala' }
    );
  });

  test('error path — updateProfileState rejection propagates', async () => {
    vi.mocked(apiClient.patch).mockRejectedValue(new Error('not found'));
    await expect(updateProfileState('p-x', 'rising')).rejects.toThrow('not found');
  });
});

// Task #1793 — the Scene and Crossing tabs' loading states rendered an
// undefined Spinner (ReferenceError in production since the panel was
// extracted from SocialProfileGenerator, 289b1503d).
describe('DetailPanel — loading states render', () => {
  const renderPanel = (detailTab, profile = { id: 'p-1', handle: 'mika', status: 'finalized', followers: [] }) =>
    render(
      <DetailPanel
        profile={profile} fp={{}} detailTab={detailTab} setDetailTab={vi.fn()}
        sceneContext={null} setSceneContext={vi.fn()} onLoadSceneContext={vi.fn()} onCopySceneContext={vi.fn()}
        crossingPreview={null} setCrossingPreview={vi.fn()} onLoadCrossingPreview={vi.fn()}
        onClose={vi.fn()} onFinalize={vi.fn()} onCross={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()}
        onRefresh={vi.fn()} onRegenerate={vi.fn()} regenerating={false}
        onApprove={vi.fn()} onRejectCrossing={vi.fn()} onSaveAsTemplate={vi.fn()} onReactions={vi.fn()}
      />
    );

  test('Scene tab with no scene context loaded', () => {
    renderPanel('scene');
    expect(screen.getByText(/Loading scene context/)).toBeTruthy();
  });

  test('Crossing tab with no preview for an uncrossed profile', () => {
    renderPanel('crossing');
    expect(screen.getByText(/Loading crossing preview/)).toBeTruthy();
  });
});
