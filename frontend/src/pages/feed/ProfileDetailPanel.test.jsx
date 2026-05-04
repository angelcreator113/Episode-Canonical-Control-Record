/**
 * ProfileDetailPanel — Track 3 Stage 2 behavioral tests.
 */

import { vi, describe, beforeEach, test, expect } from 'vitest';

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
