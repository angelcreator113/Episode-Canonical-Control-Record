/**
 * The shorter Overview (Evoni, 2026-10-22: "how can we improve the episode
 * page layout", Shorter Overview): the next step and the four tiles on one
 * row, then a Story column and a Style column. The cards that were the tabs
 * over again (Locations, Script, Quick tools, the button bar) are gone.
 *
 * Evoni's Overview layout list (2026-10-22): three tiles, the checklist count
 * and Suggest Scenes in the next-step card; the allowed outcomes in the
 * brief; no Video UI overlays (Production › Overlays); on a phone, a Story |
 * Style switch.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
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
    expect(within(screen.getByTestId('overview-next-step')).getByRole('button', { name: /Suggest Scenes/ })).toBeTruthy();
    expect(within(screen.getByTestId('overview-tiles')).queryByTestId('overview-tile-checklist')).toBeNull();
    expect(screen.queryByText('Video UI overlays')).toBeNull();
    for (const gone of ['Locations', 'Script Writer', 'Producer Mode', 'Scene Plan', 'Edit Details', 'Quick tools']) {
      expect(screen.queryByText(gone)).toBeNull();
    }
  });

  test('on a phone, Story | Style shows one column at a time', async () => {
    render(<MemoryRouter><EpisodeOverviewTab episode={EPISODE} show={{ id: 'show-1' }} onUpdate={vi.fn()} onOpenTab={vi.fn()} /></MemoryRouter>);
    const story = await screen.findByTestId('overview-story');
    const columns = story.parentElement;
    const toggle = screen.getByRole('group', { name: 'Show' });
    expect(columns.dataset.phoneCol).toBe('story');
    expect(within(toggle).getByRole('button', { name: 'Story' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(toggle).getByRole('button', { name: 'Style' }));
    expect(columns.dataset.phoneCol).toBe('style');
    expect(within(toggle).getByRole('button', { name: 'Style' }).getAttribute('aria-pressed')).toBe('true');
    // The stylesheet hides the other column only at phone width.
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const css = readFileSync(resolve(__dirname, 'EpisodeOverviewSections.css'), 'utf8');
    expect(css).toMatch(/@media \(max-width: 768px\) \{[^@]*\.eov-columns\[data-phone-col="story"\] > \.eov-col\[data-col="style"\]/);
  });

  test('the allowed outcomes sit in the story brief, beside Designed intent', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/episode-brief/ep-1'
      ? { data: { data: { episode_id: 'ep-1', allowed_outcomes: ['slay', 'pass', 'safe', 'fail'] } } }
      : { data: {} }));
    render(<MemoryRouter><EpisodeOverviewTab episode={EPISODE} show={{ id: 'show-1' }} onUpdate={vi.fn()} onOpenTab={vi.fn()} /></MemoryRouter>);
    const outcomes = await screen.findByTestId('overview-allowed-outcomes');
    expect(screen.getByTestId('overview-story-brief').contains(outcomes)).toBe(true);
    expect(within(outcomes).getAllByRole('button')).toHaveLength(4);
  });
});
