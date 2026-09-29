/**
 * Production → Money (Episode Money, Phase A; §8(aa) M1–M5; Task #2278).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeMoneyTab from './EpisodeMoneyTab';

const EPISODE = { id: 'ep-1', show_id: 'show-1' };

const money = (over = {}) => ({
  episode_id: 'ep-1',
  show_id: 'show-1',
  balance: 1600,
  rows: [
    { id: 'r1', date: '2026-09-29T10:00:00Z', category: 'wardrobe_purchase', description: 'Wardrobe purchase: Gold Gown', type: 'expense', amount: 300, signed: -300 },
    { id: 'r2', date: '2026-09-29T11:00:00Z', category: 'event_payment', description: 'Payment', type: 'income', amount: 200, signed: 200 },
  ],
  net: -100,
  event: { id: 'ev-1', name: 'Money Gala' },
  expected: [{ kind: 'income', label: 'Event payment', amount: 500, source: 'terms' }],
  ...over,
});

describe('EpisodeMoneyTab', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });

  test('reads the episode money endpoint and shows the balance, posted rows and net', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: money() } });
    render(<EpisodeMoneyTab episode={EPISODE} showId="show-1" />);

    expect(await screen.findByText('1,600 🪙')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/show-1/episodes/ep-1/money');
    expect(within(screen.getByTestId('em-net')).getByText('−100')).toBeTruthy();
    expect(screen.getByText('Wardrobe purchase: Gold Gown')).toBeTruthy();
    expect(screen.getByText('−300')).toBeTruthy();
    expect(screen.getByText('+200')).toBeTruthy();
  });

  test('expected lines are labelled expected and are not in the net or the balance (M2)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: money() } });
    render(<EpisodeMoneyTab episode={EPISODE} showId="show-1" />);

    expect(await screen.findByText('Event payment')).toBeTruthy();
    expect(screen.getByText('+500')).toBeTruthy();
    expect(screen.getByText(/Expected lines are\s+not posted and are not in the balance or the net/)).toBeTruthy();
    // The net and the balance are the server's, untouched by the +500.
    expect(within(screen.getByTestId('em-net')).getByText('−100')).toBeTruthy();
    expect(within(screen.getByTestId('em-balance')).getByText('1,600 🪙')).toBeTruthy();
  });

  test('empty states in plain words', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: money({ rows: [], net: 0, event: null, expected: [] }) } });
    render(<EpisodeMoneyTab episode={EPISODE} showId="show-1" />);

    expect(await screen.findByText('Nothing has posted for this episode yet.')).toBeTruthy();
    expect(screen.getByText('This episode has no source event, so nothing is expected.')).toBeTruthy();
  });

  test('a failed load says so', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockRejectedValue(new Error('boom'));
    render(<EpisodeMoneyTab episode={EPISODE} showId="show-1" />);

    expect(await screen.findByText(/Couldn't load this episode's money/)).toBeTruthy();
  });
});
