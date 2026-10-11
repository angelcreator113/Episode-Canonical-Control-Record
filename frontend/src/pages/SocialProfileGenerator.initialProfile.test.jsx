/**
 * A link to one Feed profile (Task #2761: a friend on the Feed page opens
 * World Studio's Feed tab with ?profile=) opens that profile, read in full,
 * once.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));
vi.mock('../components/FeedBulkImport', () => ({ default: () => null }));
vi.mock('./feed/ProfileCard', () => ({ default: () => null }));
vi.mock('./feed/ProfileDetailPanel', () => ({
  DetailPanel: ({ profile }) => <div data-testid="detail">{profile?.handle}</div>,
  FeedStatePicker: () => null,
}));
vi.mock('./feed/FeedEnhancements', () => ({
  ProfileComparison: () => null, LalaReactions: () => null, FeedTimeline: () => null, RelationshipWeb: () => null,
}));
vi.mock('./feed/FeedViews', () => ({ default: () => null }));

import apiClient from '../services/api';
import SocialProfileGenerator from './SocialProfileGenerator';

beforeEach(() => {
  Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  vi.mocked(apiClient.get).mockImplementation(async (url) => (url === '/api/v1/social-profiles/9' ? { data: { profile: { id: 9, handle: 'marcus.k' } } } : { data: {} }));
});

describe('SocialProfileGenerator initialProfileId', () => {
  test('opens the linked profile', async () => {
    render(<MemoryRouter><SocialProfileGenerator embedded defaultFeedLayer="lalaverse" initialProfileId="9" /></MemoryRouter>);
    expect((await screen.findByTestId('detail')).textContent).toBe('marcus.k');
    expect(vi.mocked(apiClient.get).mock.calls.filter((c) => c[0] === '/api/v1/social-profiles/9')).toHaveLength(1);
  });

  test('no link: no profile is opened', async () => {
    render(<MemoryRouter><SocialProfileGenerator embedded defaultFeedLayer="lalaverse" /></MemoryRouter>);
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(screen.queryByTestId('detail')).toBeNull();
  });
});
