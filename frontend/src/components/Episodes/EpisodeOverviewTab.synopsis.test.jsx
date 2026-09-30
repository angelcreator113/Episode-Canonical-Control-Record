/**
 * P13 (Task #2386): the episode description is the internal synopsis. The
 * Overview labels it "Synopsis (internal)", saves it as `description` (the
 * old `logline` key was dropped by the PUT whitelist), and shows the viewer
 * teaser card alongside it.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

const EPISODE = {
  id: 'ep-1', show_id: 'show-1', title: 'Gala Night',
  description: 'Lala arrives late and the coat splits.',
  teaser: 'One invitation. One coat.', teaser_drafted: 'One invitation. One coat.',
};

describe('EpisodeOverviewTab synopsis and teaser (P12, P13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    vi.mocked(getEpisodeEvents).mockResolvedValue({ events: [] });
  });

  test('the description reads as the internal synopsis and the teaser card is shown', () => {
    render(<MemoryRouter><EpisodeOverviewTab episode={EPISODE} show={{ id: 'show-1' }} onUpdate={vi.fn()} /></MemoryRouter>);
    expect(screen.getByTestId('episode-synopsis').textContent).toBe('Synopsis (internal)Lala arrives late and the coat splits.');
    expect(screen.getByTestId('episode-teaser-state').textContent.trim()).toBe('Auto-drafted · from event');
  });

  test('editing saves the synopsis as description', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<MemoryRouter><EpisodeOverviewTab episode={EPISODE} show={{ id: 'show-1' }} onUpdate={onUpdate} /></MemoryRouter>);

    fireEvent.click(screen.getByText('✏️ Edit'));
    expect(screen.getByText('Synopsis (internal)')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('Lala arrives late and the coat splits.'), { target: { value: 'New synopsis.' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    const payload = onUpdate.mock.calls[0][0];
    expect(payload.description).toBe('New synopsis.');
    expect(payload).not.toHaveProperty('logline');
  });
});
