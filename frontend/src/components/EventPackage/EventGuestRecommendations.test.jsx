/**
 * EventGuestRecommendations — recommended featured attendees (Evoni,
 * 2026-10-03, episode creation step 5): ranked from the Feed, Feature saves
 * through the page, and a failed Feed says so with Retry.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
import api from '../../services/api';
import EventGuestRecommendations from './EventGuestRecommendations';

const FEED = '/api/v1/social-profiles?feed_layer=lalaverse&sort=score&limit=40';
const PROFILES = [
  { id: 3, handle: 'dana', display_name: 'Dana', lala_relationship: 'direct', lala_relevance_score: 5 },
  { id: 4, handle: 'eve', display_name: 'Eve', lala_relationship: 'competitive', lala_relevance_score: 4 },
];

const renderRecs = (props = {}) => {
  const onFeature = vi.fn();
  render(<EventGuestRecommendations guests={[]} slots={3} onFeature={onFeature} saving={false} {...props} />);
  return { onFeature };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EventGuestRecommendations', () => {
  test('recommends from the Feed, each with a role and why; Feature hands the pick to the page', async () => {
    api.get.mockResolvedValue({ data: { profiles: PROFILES } });
    const { onFeature } = renderRecs();
    const dana = await screen.findByTestId('guest-rec-3');
    expect(api.get).toHaveBeenCalledWith(FEED);
    expect(dana.textContent).toContain('Dana');
    expect(dana.textContent).toContain('not invited yet');
    fireEvent.click(dana.querySelector('[data-testid="guest-rec-feature"]'));
    expect(onFeature).toHaveBeenCalledWith(expect.objectContaining({ profile_id: 3 }));
  });

  test('a failed Feed says so in one line with Retry, which loads again', async () => {
    api.get.mockRejectedValueOnce(new Error('network'));
    renderRecs();
    expect((await screen.findByTestId('guest-recs-failed')).textContent).toMatch(/Couldn.t load recommendations/);
    api.get.mockResolvedValue({ data: { profiles: PROFILES } });
    fireEvent.click(screen.getByTestId('guest-recs-retry'));
    expect(await screen.findByTestId('guest-recs')).toBeTruthy();
    expect(screen.queryByTestId('guest-recs-failed')).toBeNull();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  test('no slots left: nothing shown', async () => {
    api.get.mockResolvedValue({ data: { profiles: PROFILES } });
    renderRecs({ slots: 0 });
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByTestId('guest-recs')).toBeNull();
  });
  test('each recommendation lists the facts behind it from the profiles read; the organizer is read for her district; none when the data has none', async () => {
    const feed = [
      { id: 3, handle: 'dana', display_name: 'Dana', lala_relationship: 'direct', lala_relevance_score: 5, city: 'dazzle_district', follower_tier: 'mega', followers: [{ character_key: 'lala' }] },
      { id: 4, handle: 'eve', display_name: 'Eve', lala_relationship: 'competitive', lala_relevance_score: 4, follower_tier: 'micro', current_trajectory: 'plateauing' },
    ];
    api.get.mockImplementation(async (url) => {
      if (url === FEED) return { data: { profiles: feed } };
      if (url === '/api/v1/social-profiles/9') return { data: { profile: { id: 9, display_name: 'Host', city: 'dazzle_district' } } };
      return { data: { profile: null } };
    });
    renderRecs({ organizerProfileId: 9, guests: [{ profile_id: 3, relationship: 'collab' }] });
    const dana = await screen.findByTestId('guest-rec-3');
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/social-profiles/9'));
    const reasons = dana.querySelector('[data-testid="guest-rec-reasons"]');
    expect([...reasons.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'Collaborated with the organizer', 'Same district as the organizer', 'Lala follows her',
    ]);
    expect(reasons.getAttribute('aria-label')).toBe('Why Dana');
    // Eve: nothing in the data supports a reason, so none is shown.
    expect(screen.getByTestId('guest-rec-4').querySelector('[data-testid="guest-rec-reasons"]')).toBeNull();
  });
});
