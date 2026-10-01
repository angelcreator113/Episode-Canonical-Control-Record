/**
 * Production → Money: Episode Money, Phase A (§8(aa) M1–M5; Task #2278) and
 * Phase B build PR 1 (§8(gg) MB1–MB3 and Evoni's answers, 2026-10-01): one
 * list of money lines with their states, and the projection.
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

const LINES = [
  { key: 'appearance_fee|ev-1', label: 'Appearance fee', kind: 'income', amount: 450, signed: 450, state: 'posted', trigger: 'at Complete', payer: { who: 'brand', name: 'Maison Belle' } },
  { key: 'deal_bonus|ev-1|slay', label: 'Bonus (SLAY)', kind: 'income', amount: 200, signed: 200, state: 'planned', trigger: 'if SLAY', conditional: true, tier: 'slay', payer: { who: 'brand', name: 'Maison Belle' } },
  { key: 'content_fee|d-1', label: 'Content fee: One reel', kind: 'income', amount: 120, signed: 120, state: 'pending', trigger: 'on approval', payer: { who: 'brand', name: 'Maison Belle' } },
  { key: 'event_cost|c-1', label: 'Car', kind: 'expense', amount: 60, signed: -60, state: 'planned', trigger: 'at Complete', payer: { who: 'lala', name: 'Lala' } },
  { key: 'covered|c-2', label: 'Ticket', kind: 'expense', amount: 0, signed: 0, covered: true, covered_amount: 40, state: 'covered', trigger: null, payer: { who: 'host', name: 'Nia Vale' } },
];

const money = (over = {}) => ({
  episode_id: 'ep-1',
  show_id: 'show-1',
  balance: 1600,
  rows: [],
  net: 360,
  event: { id: 'ev-1', name: 'Velour Night' },
  expected: [],
  lines: LINES,
  unplanned: [
    { id: 'r9', date: '2026-09-29T10:00:00Z', category: 'wardrobe_purchase', description: 'Purchase: Gold Gown', amount: 90, signed: -90 },
  ],
  projection: {
    posted_net: 360, pending_net: 120, planned_net: -60, projected_net: 420,
    actual_balance: 1600, projected_balance: 1660,
    conditional: [{ tier: 'slay', amount: 200, label: 'Bonus (SLAY)' }],
    open_count: 3,
  },
  ...over,
});

describe('EpisodeMoneyTab', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });

  test('shows the actual balance, the projected balance after the episode and the projected net (MB3)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: money() } });
    render(<EpisodeMoneyTab episode={EPISODE} showId="show-1" />);

    expect(await screen.findByText('1,600 🪙')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/show-1/episodes/ep-1/money');
    expect(within(screen.getByTestId('em-projected-balance')).getByText('1,660 🪙')).toBeTruthy();
    const net = screen.getByTestId('em-net');
    expect(within(net).getByText('+420')).toBeTruthy();
    expect(net.textContent).toContain('Posted so far: +360.');
  });

  test('a conditional bonus is shown beside the net as "+ up to X if SLAY", never counted (Q3)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: money() } });
    render(<EpisodeMoneyTab episode={EPISODE} showId="show-1" />);

    const chips = await screen.findByTestId('em-conditional');
    expect(chips.textContent).toBe('+ up to 200 if SLAY');
    expect(within(screen.getByTestId('em-net')).getByText('+420')).toBeTruthy(); // not 620
  });

  test('each line shows its state, trigger, payer and amount; covered and unplanned lines are marked (MB1, MB2)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: money() } });
    render(<EpisodeMoneyTab episode={EPISODE} showId="show-1" />);

    const fee = await screen.findByTestId('em-line-content_fee|d-1');
    expect(fee.textContent).toContain('Content fee: One reel');
    expect(fee.textContent).toContain('Pending');
    expect(fee.textContent).toContain('on approval');
    expect(fee.textContent).toContain('Paid by Maison Belle');
    expect(fee.textContent).toContain('+120');

    const car = screen.getByTestId('em-line-event_cost|c-1');
    expect(car.textContent).toContain('Planned');
    expect(car.textContent).toContain('Lala pays');
    expect(car.textContent).toContain('−60');

    expect(screen.getByTestId('em-line-appearance_fee|ev-1').textContent).toContain('Posted');
    const ticket = screen.getByTestId('em-line-covered|c-2');
    expect(ticket.textContent).toContain('Covered by Nia Vale (40)');
    expect(screen.getByTestId('em-unplanned-r9').textContent).toContain('Posted, not planned');
  });

  test('empty states in plain words', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: money({ event: null, lines: [], unplanned: [], projection: { ...money().projection, conditional: [] } }) },
    });
    render(<EpisodeMoneyTab episode={EPISODE} showId="show-1" />);

    expect(await screen.findByText('This episode has no source event, and nothing has posted.')).toBeTruthy();
    expect(screen.queryByTestId('em-conditional')).toBeNull();
  });

  test('a failed load says so', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockRejectedValue(new Error('boom'));
    render(<EpisodeMoneyTab episode={EPISODE} showId="show-1" />);

    expect(await screen.findByText(/Couldn't load this episode's money/)).toBeTruthy();
  });
});
