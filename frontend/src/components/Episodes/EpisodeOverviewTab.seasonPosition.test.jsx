/**
 * Season Arc A5 (Evoni, 2026-10-01; EVENT_EPISODE_FLOW.md §8(ff)): "The
 * Overview shows its season position and purpose", from the season context
 * snapshotted at Start Episode, shown "S1 · E7" (Q3); the show-wide episode
 * count stays internal.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../../services/episodeEventsApi', () => ({ getEpisodeEvents: vi.fn() }));
vi.mock('../episode/SceneSuggestionReview', () => ({ default: () => null }));
vi.mock('../episode/TimelinePlacementsSection', () => ({ default: () => null }));

import api from '../../services/api';
import { getEpisodeEvents } from '../../services/episodeEventsApi';
import EpisodeOverviewTab from './EpisodeOverviewTab';

const BASE = { id: 'ep-1', show_id: 'show-1', title: 'Gala Night', episode_number: 9 };

function renderWith(episode) {
  return render(<MemoryRouter><EpisodeOverviewTab episode={episode} show={{ id: 'show-1' }} onUpdate={vi.fn()} /></MemoryRouter>);
}

describe('EpisodeOverviewTab season position (§8(ff) A5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    vi.mocked(getEpisodeEvents).mockResolvedValue({ events: [] });
  });

  test('shows the season label, phase and story purpose, not the show-wide number', () => {
    renderWith({
      ...BASE,
      season_context: {
        label: 'S1 · E5', slot_number: 5, season_number: 1,
        phase: { number: 1, title: 'Foundation' },
        story_purpose: 'Lala is tested by her first paid invite.',
      },
    });

    const card = screen.getByTestId('season-position');
    expect(within(card).getByText('S1 · E5')).toBeTruthy();
    expect(within(card).getByText(/Phase 1: Foundation/)).toBeTruthy();
    expect(within(card).getByText('Lala is tested by her first paid invite.')).toBeTruthy();
    expect(card.textContent).not.toMatch(/Episode 9/);
  });

  test('says when the slot has no story purpose yet', () => {
    renderWith({ ...BASE, season_context: { label: 'S1 · E1', slot_number: 1, phase: { number: 1, title: 'Foundation' } } });
    expect(within(screen.getByTestId('season-position')).getByText('No story purpose set for this slot yet.')).toBeTruthy();
  });

  test('an episode with no season context points to the roadmap', () => {
    renderWith(BASE);
    expect(screen.getByTestId('season-position').textContent).toMatch(/Not in a season slot yet/);
  });

  test('no longer loads the show episode list just to count it', () => {
    renderWith(BASE);
    const lists = vi.mocked(api.get).mock.calls.filter(([url]) => url.startsWith('/api/v1/episodes?show_id='));
    expect(lists).toEqual([]);
  });
});
