/**
 * Episode Money Phase B, MB5 and Q10 (Evoni, 2026-10-01;
 * EVENT_EPISODE_FLOW.md §8(gg)): "The episode Overview gets a Money card
 * (M1): actual net so far, projected net, and how many lines are still
 * planned or pending." "the Overview's ledger list is replaced by the Money
 * card with a "See all in Money →" link; the Money tab is the one full view."
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

const EPISODE = { id: 'ep-1', show_id: 'show-1', title: 'Gala Night', episode_number: 9 };
const MONEY_URL = '/api/v1/world/show-1/episodes/ep-1/money';
const LEDGER_TX = [
  { id: 't1', type: 'income', category: 'appearance_fee', amount: 450, description: 'Appearance fee for "Velour Night"' },
  { id: 't2', type: 'expense', category: 'event_cost', amount: 60, description: 'Car for "Velour Night"' },
];

function renderWith(projection) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === MONEY_URL) return { data: { data: { projection } } };
    if (url.startsWith('/api/v1/world/show-1/financial-ledger')) return { data: { data: { transactions: LEDGER_TX } } };
    return { data: {} };
  });
  return render(<MemoryRouter><EpisodeOverviewTab episode={EPISODE} show={{ id: 'show-1' }} onUpdate={vi.fn()} /></MemoryRouter>);
}

describe('EpisodeOverviewTab Money card (§8(gg) MB5, Q10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEpisodeEvents).mockResolvedValue({ events: [] });
  });

  test('shows the actual net so far, the projected net and the open lines, with a link to Money', async () => {
    renderWith({ posted_net: 390, projected_net: 610, open_count: 3, conditional: [{ tier: 'slay', amount: 200 }] });

    const card = await screen.findByTestId('episode-money-card');
    expect(await within(card).findByText('+610')).toBeTruthy();
    expect(within(screen.getByTestId('episode-money-card-actual')).getByText('+390')).toBeTruthy();
    expect(screen.getByTestId('episode-money-card-open').textContent).toBe('3 lines are still planned or pending.');
    expect(screen.getByTestId('episode-money-card-conditional').textContent).toBe('+ up to 200 if SLAY');
    const link = within(card).getByRole('link', { name: 'See all in Money →' });
    expect(link.getAttribute('href')).toBe('/episodes/ep-1?tab=money');
    expect(api.get).toHaveBeenCalledWith(MONEY_URL);
  });

  test('the ledger list is gone: its rows are not listed on the Overview (Q10)', async () => {
    renderWith({ posted_net: 390, projected_net: 390, open_count: 0, conditional: [] });

    await screen.findByText('No lines are still planned or pending.');
    expect(screen.queryByText('💰 Episode Financials')).toBeNull();
    expect(screen.queryByText('Car for "Velour Night"')).toBeNull();
  });

  test('one open line reads in the singular', async () => {
    renderWith({ posted_net: 0, projected_net: -60, open_count: 1, conditional: [] });
    expect(await screen.findByText('1 line is still planned or pending.')).toBeTruthy();
  });
});
