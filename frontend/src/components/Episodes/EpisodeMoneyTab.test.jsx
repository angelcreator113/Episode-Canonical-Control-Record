/**
 * Production → Money: Episode Money, Phase A (§8(aa) M1–M5; Task #2278) and
 * Phase B build PR 1 (§8(gg) MB1–MB3 and Evoni's answers, 2026-10-01): one
 * list of money lines with their states, and the projection.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeMoneyTab from './EpisodeMoneyTab';

const EPISODE = { id: 'ep-1', show_id: 'show-1' };
const renderTab = () => render(<MemoryRouter><EpisodeMoneyTab episode={EPISODE} showId="show-1" /></MemoryRouter>);

const LINES = [
  { key: 'appearance_fee|ev-1', category: 'appearance_fee', label: 'Appearance fee', kind: 'income', amount: 450, signed: 450, state: 'posted', trigger: 'at Complete', payer: { who: 'brand', name: 'Maison Belle' } },
  { key: 'deal_bonus|ev-1|slay', category: 'deal_bonus', label: 'Bonus (SLAY)', kind: 'income', amount: 200, signed: 200, state: 'planned', trigger: 'if SLAY', conditional: true, tier: 'slay', payer: { who: 'brand', name: 'Maison Belle' } },
  { key: 'content_fee|d-1', category: 'content_fee', label: 'Content fee: One reel', kind: 'income', amount: 120, signed: 120, state: 'pending', trigger: 'on approval', payer: { who: 'brand', name: 'Maison Belle' } },
  { key: 'event_cost|c-1', category: 'event_cost', label: 'Car', kind: 'expense', amount: 60, signed: -60, state: 'planned', trigger: 'at Complete', payer: { who: 'lala', name: 'Lala' } },
  { key: 'covered|c-2', category: 'event_cost', label: 'Ticket', kind: 'expense', amount: 0, signed: 0, covered: true, covered_amount: 40, state: 'covered', trigger: null, payer: { who: 'host', name: 'Nia Vale' } },
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

  test('Earns, Spends and the Net estimate; the net is the projected net, with her balance before and after (MB3)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: money() } });
    renderTab();

    const earns = await screen.findByTestId('em-earns');
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/show-1/episodes/ep-1/money');
    expect(within(earns).getByText('+570')).toBeTruthy();
    expect(earns.textContent).toContain('2 lines: Appearance fee and Content fee: One reel');
    const spends = screen.getByTestId('em-spends');
    expect(within(spends).getByText('−150')).toBeTruthy();
    expect(spends.textContent).toContain('Car and Purchase: Gold Gown; Ticket is comped');
    const net = screen.getByTestId('em-net');
    expect(within(net).getByText('+420')).toBeTruthy();
    expect(net.textContent).toContain('Adds up exactly the lines below');
    expect(screen.getByTestId('em-projected-balance').textContent).toBe('Lala has 1,600 · 1,660 after this episode');
  });

  test('a conditional bonus is shown beside the net as "+ up to X if SLAY", never counted (Q3)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: money() } });
    renderTab();

    const chips = await screen.findByTestId('em-conditional');
    expect(chips.textContent).toBe('+ up to 200 if SLAY');
    expect(within(screen.getByTestId('em-net')).getByText('+420')).toBeTruthy(); // not 620
    const bonus = screen.getByTestId('em-line-deal_bonus|ev-1|slay');
    expect(bonus.textContent).toContain('up to +200');
    expect(bonus.textContent).toContain('If SLAY');
  });

  test('every line says where it comes from, when, what it adds and its state; comped and unplanned lines are marked (MB1, MB2)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: money() } });
    renderTab();

    const fee = await screen.findByTestId('em-line-content_fee|d-1');
    expect(fee.textContent).toContain('Content fee: One reel');
    expect(fee.textContent).toContain('Deal · Paid content · Paid by Maison Belle');
    expect(fee.textContent).toContain('On approval');
    expect(fee.textContent).toContain('+120');
    expect(fee.textContent).toContain('Pending');

    const car = screen.getByTestId('em-line-event_cost|c-1');
    expect(car.textContent).toContain('Event cost · Lala pays');
    expect(car.textContent).toContain('At Complete');
    expect(car.textContent).toContain('−60');
    expect(car.textContent).toContain('Planned');

    expect(screen.getByTestId('em-line-appearance_fee|ev-1').textContent).toContain('Posted');
    const ticket = screen.getByTestId('em-line-covered|c-2');
    expect(ticket.textContent).toContain('Event cost · comped by Nia Vale');
    expect(ticket.textContent).toContain('Comped 40');
    const gown = screen.getByTestId('em-unplanned-r9');
    expect(gown.textContent).toContain('Wardrobe · bought');
    expect(gown.textContent).toContain('Posted, not planned');
  });

  test('the deal terms note says they can be reopened while the episode is a draft, with a link to the event', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: money({ spending: null }) } });
    renderTab();

    const terms = await screen.findByTestId('em-terms');
    expect(terms.textContent).toContain('The episode is still a draft, so they can be reopened.');
    expect(within(terms).getByRole('link', { name: 'Open terms in the event' }).getAttribute('href')).toBe('/shows/show-1/events/ev-1#epp-sec-deal');
  });

  test('money warnings show first, with the shortfall, and block nothing (MB4)', async () => {
    const warnings = [{ code: 'COSTS_EXCEED_BALANCE', shortfall: 50, message: 'Event spending (150) is more than Lala has (100): 50 short before any income arrives.' }];
    vi.mocked(api.get).mockResolvedValue({ data: { data: money({ warnings }) } });
    renderTab();

    const banner = await screen.findByTestId('em-warnings');
    expect(banner.getAttribute('role')).toBe('alert');
    expect(banner.textContent).toContain('50 short before any income arrives');
    expect(banner.textContent).toContain('nothing is blocked here');
  });

  test('no warnings, no banner', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: money({ warnings: [] }) } });
    renderTab();
    await screen.findByTestId('em-lines');
    expect(screen.queryByTestId('em-warnings')).toBeNull();
  });

  test('after Complete, the reconciliation compares each line with the plan saved at Start Episode (MB6)', async () => {
    const reconciliation = {
      basis: 'start_episode',
      planned_at: '2026-10-01T18:00:00.000Z',
      highlighted: 3,
      totals: { planned_net: 360, posted_net: 280, difference: -80 },
      rows: [
        { key: 'appearance_fee|ev-1', label: 'Appearance fee', planned: 450, posted: 450, difference: 0, status: 'as_planned' },
        { key: 'deal_bonus|ev-1|slay', category: 'deal_bonus', label: 'Bonus (SLAY)', planned: 0, planned_conditional: 200, posted: null, difference: null, status: 'not_earned', conditional: true },
        { key: 'event_spending|s-1', label: 'Champagne × 3', planned: -30, posted: -45, difference: -15, status: 'changed',
          draft_change: { from: { quantity: 2, unit_price: 15 }, to: { quantity: 3, unit_price: 15 } } },
        { key: 'content_fee|d-1', category: 'content_fee', label: 'Content fee: One reel', planned: 120, posted: null, difference: null, status: 'outstanding', pending: true },
      ],
    };
    vi.mocked(api.get).mockResolvedValue({ data: { data: money({ reconciliation }) } });
    renderTab();

    const section = await screen.findByTestId('em-reconciliation');
    expect(section.textContent).toContain('Each line as planned at Start Episode');
    expect(section.textContent).toContain('3 differences highlighted.');
    const bonus = screen.getByTestId('em-recon-deal_bonus|ev-1|slay');
    expect(bonus.textContent).toContain('Not earned');
    expect(bonus.textContent).toContain('Planned +200 if earned');
    expect(bonus.className).toContain('em-recon-diff');
    const champagne = screen.getByTestId('em-recon-event_spending|s-1');
    expect(champagne.textContent).toContain('Changed');
    expect(champagne.textContent).toContain('Difference −15');
    expect(champagne.textContent).toContain('Changed from its draft: 2 × 15 → 3 × 15');
    expect(screen.getByTestId('em-recon-content_fee|d-1').textContent).toContain('Outstanding · pending');
    expect(screen.getByTestId('em-recon-appearance_fee|ev-1').className).not.toContain('em-recon-diff');
    expect(screen.getByTestId('em-recon-totals').textContent).toBe('Planned net +360 · posted net +280 · difference −80');
  });

  test('with no saved plan the reconciliation says it compares with the plan as it stands; before Complete there is none', async () => {
    const reconciliation = { basis: 'current', planned_at: null, highlighted: 0, totals: { planned_net: 0, posted_net: 0, difference: 0 }, rows: [] };
    vi.mocked(api.get).mockResolvedValue({ data: { data: money({ reconciliation }) } });
    const { unmount } = renderTab();
    expect((await screen.findByTestId('em-reconciliation')).textContent).toContain('No plan was saved at Start Episode for this episode');
    unmount();

    vi.mocked(api.get).mockResolvedValue({ data: { data: money({ reconciliation: null }) } });
    renderTab();
    await screen.findByTestId('em-lines');
    expect(screen.queryByTestId('em-reconciliation')).toBeNull();
  });

  test('empty states in plain words', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: money({ event: null, lines: [], unplanned: [], projection: { ...money().projection, conditional: [] } }) },
    });
    renderTab();

    expect(await screen.findByText('This episode has no source event, and nothing has posted.')).toBeTruthy();
    expect(screen.queryByTestId('em-conditional')).toBeNull();
  });

  test('a failed load says so', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockRejectedValue(new Error('boom'));
    renderTab();

    expect(await screen.findByText(/Couldn't load this episode's money/)).toBeTruthy();
  });

  // Evoni, 2026-10-07: a refresh that fails after a change used to be silent.
  test('a change saved but not refreshed says the numbers may be out of date, with Refresh', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: money({ spending: { lines: [], total: 0, editable: true } }) } });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    renderTab();
    fireEvent.click(await screen.findByTestId('em-spending-add'));
    fireEvent.change(screen.getByTestId('em-spending-label'), { target: { value: 'Photo booth' } });
    fireEvent.change(screen.getByTestId('em-spending-quantity'), { target: { value: '1' } });
    fireEvent.change(screen.getByTestId('em-spending-unit-price'), { target: { value: '75' } });
    vi.mocked(api.get).mockRejectedValueOnce(new Error('network'));
    fireEvent.click(screen.getByTestId('em-spending-save'));
    expect((await screen.findByTestId('em-stale')).textContent).toMatch(/couldn't refresh/);
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: money({ spending: { lines: [], total: 0, editable: true } }) } });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await screen.findByText('Every line in the estimate');
    await vi.waitFor(() => expect(screen.queryByTestId('em-stale')).toBeNull());
  });
});
