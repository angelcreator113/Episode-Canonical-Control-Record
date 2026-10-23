/**
 * The shorter Overview (Evoni, 2026-10-22: "how can we improve the episode
 * page layout", Shorter Overview): the next step and the four tiles on one
 * row, then a Story column and a Style column. The cards that were the tabs
 * over again (Locations, Script, Quick tools, the button bar) are gone;
 * Suggest Scenes, the Overview's own, stays at the foot of Story.
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
vi.mock('../episode/TimelinePlacementsSection', () => ({ default: () => <p>Video UI overlays</p> }));

import api from '../../services/api';
import { getEpisodeEvents } from '../../services/episodeEventsApi';
import EpisodeOverviewTab from './EpisodeOverviewTab';

const EPISODE = { id: 'ep-1', show_id: 'show-1', title: 'Gala Night', episode_number: 9 };

describe('the shorter Overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    vi.mocked(getEpisodeEvents).mockResolvedValue({ events: [] });
  });

  test('the next step and the tiles on top, then Story and Style; no repeated cards', async () => {
    render(<MemoryRouter><EpisodeOverviewTab episode={EPISODE} show={{ id: 'show-1' }} onUpdate={vi.fn()} onOpenTab={vi.fn()} /></MemoryRouter>);
    const story = await screen.findByTestId('overview-story');
    const style = screen.getByTestId('overview-style');
    const top = screen.getByTestId('overview-next-step').parentElement;
    expect(top.className).toBe('eov-top');
    expect(within(top).getByTestId('overview-tiles')).toBeTruthy();
    expect(within(story).getByRole('heading', { level: 2, name: 'Story' })).toBeTruthy();
    expect(within(style).getByRole('heading', { level: 2, name: 'Style' })).toBeTruthy();
    expect(within(style).getByTestId('episode-style-board')).toBeTruthy();
    expect(within(story).getByRole('button', { name: /Suggest Scenes/ })).toBeTruthy();
    expect(within(story).getByText('Video UI overlays')).toBeTruthy();
    for (const gone of ['Locations', 'Script Writer', 'Producer Mode', 'Scene Plan', 'Edit Details', 'Quick tools']) {
      expect(screen.queryByText(gone)).toBeNull();
    }
  });
});
