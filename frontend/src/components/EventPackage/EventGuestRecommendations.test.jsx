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
});
