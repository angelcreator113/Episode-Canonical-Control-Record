/**
 * The Goals tab with Evoni's real 21 goals (2026-10-25: "This is very
 * confusing I don't know what I am to do. How should I attach them to the
 * right event at the right time? And should some episodes have multiple"):
 * one card per ladder with Up next, one primary with Make primary, Pick its
 * event (and moving an event already picked for another goal), Also helps,
 * the performance advice, the background rows, one projection per ladder,
 * and Tidy my goals.
 */
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CareerGoals from './CareerGoals';
import { HER_GOALS } from '../../lib/herGoals.fixture';

const SHOW = 'show-1';
const mover = (n, gain, pinned = false) => ({ event_id: `ev-${n}`, name: `Event ${n}`, slot_id: `s${n}`, slot_number: n, code: `E${n}`, phase: 1, via: pinned ? 'pinned' : 'fit', pinned, gain });
const COVERAGE = {
  success: true,
  season: { season_number: 1 },
  goals: HER_GOALS.filter((g) => g.status === 'active').map((g) => ({
    id: g.id, title: g.title, target_metric: g.target_metric, movers: [], main_events: [], also_helps: [],
    covered: ['g-starter', 'g-brandgirl', 'g-firstimp'].includes(g.id),
    ...(g.id === 'g-starter' ? { also_helps: [mover(2, 300), mover(3, 450), mover(4, 500), mover(5, 600), mover(8, 800), mover(11, 250)] } : {}),
  })),
  ladders: [{
    id: 'coins', metric: 'coins', kind: 'event', projection: {
      metric: 'coins', current: 294, gain: 7750, projected: 8044, counted: 12,
      clears: [{ title: 'Starter Fund' }, { title: 'The Money Talk' }, { title: 'Closet Upgrade' }], next: { title: 'Financial Independence', short: 1956 },
    },
  }],
  parts: [{ phase: 1, title: 'Foundation', gaps: [{ goal_id: 'g-firstimp', title: 'First Impressions' }, { goal_id: 'g-money', title: 'The Money Talk' }] }],
  slots: [],
  event: null,
};
const PICK = {
  success: true, goal: { id: 'g-starter' }, events: [],
  pick: [
    { id: 'ev-8', name: 'The Honey Table', via: 'fit', pinned: false, gain: 800, slot: { code: 'E8', slot_number: 8 }, reason: 'Pays 800 coins', main_goal: null },
    { id: 'ev-5', name: 'Fashion Mystery Box', via: 'fit', pinned: false, gain: 600, slot: { code: 'E5', slot_number: 5 }, reason: 'Pays 600 coins', main_goal: { goal_id: 'g-brandgirl', title: 'Brand Girl Era' } },
  ],
};

function makeApi() {
  return {
    get: vi.fn(async (url) => {
      if (url.includes('/season/goal-coverage')) return { data: COVERAGE };
      if (url.includes('/season/goals/g-starter/events')) return { data: PICK };
      throw new Error(`unexpected GET ${url}`);
    }),
    put: vi.fn(async () => ({ data: { success: true } })),
    post: vi.fn(),
    delete: vi.fn(async () => ({ data: { success: true } })),
  };
}
const renderTab = (api, onChanged = vi.fn()) => render(
  <MemoryRouter><CareerGoals showId={SHOW} api={api} goals={HER_GOALS} onChanged={onChanged} /></MemoryRouter>,
);

describe('her Goals tab', () => {
  let api;
  beforeEach(() => { api = makeApi(); window.localStorage.clear(); });

  test('seven ladders, each showing only the goal being worked on, the rest folded Up next; one primary', async () => {
    renderTab(api);
    expect(screen.getByTestId('cg-counts').textContent).toBe('9 active · 12 up next · 1 complete');
    const primary = screen.getByTestId('cg-type-primary');
    expect(within(primary).getAllByRole('article')).toHaveLength(1);
    expect(within(primary).getByText('First Impressions')).toBeTruthy();
    expect(within(primary).getByTestId('cg-season-goal').textContent).toContain('Season goal: Legacy (10)');
    const secondary = screen.getByTestId('cg-type-secondary');
    expect(within(secondary).getAllByRole('article').map((a) => a.getAttribute('data-testid'))).toEqual([
      'cg-ladder-brand_trust', 'cg-ladder-coins', 'cg-ladder-influence', 'cg-ladder-portfolio_strength', 'cg-ladder-followers',
    ]);
    expect(screen.getByTestId('cg-upnext-coins').querySelector('summary').textContent)
      .toBe('Up next: The Money Talk 2,000 → Closet Upgrade 5,000 → Financial Independence 10,000 → The Perfect Collection 25,000');
    // A rung up next is not a card of its own.
    expect(screen.queryByTestId('cg-ladder-g-money')).toBeNull();
    expect(screen.queryByTestId('gc-goal-g-money')).toBeNull();
  });

  test('extra primaries show a quiet Make primary, which swaps through the update route', async () => {
    const onChanged = vi.fn();
    renderTab(api, onChanged);
    fireEvent.click(screen.getByTestId('cg-make-primary-g-maison'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/goals/g-maison', { type: 'primary', swap_primary: true }));
    expect(await screen.findByTestId('cg-note')).toHaveProperty('textContent', 'The Maison Belle Contract is now the primary goal.');
    expect(onChanged).toHaveBeenCalled();
  });

  test('one projection per ladder, not per goal', async () => {
    renderTab(api);
    const proj = await screen.findByTestId('cg-proj-coins');
    expect(proj.textContent).toBe('8,044 coins expected by season end — clears Starter Fund, The Money Talk and Closet Upgrade; Financial Independence next (1,956 short)');
    expect(screen.getAllByText(/expected by season end/)).toHaveLength(1);
  });

  test('Pick its event offers the best events; one already picked for another goal asks to move it', async () => {
    renderTab(api);
    expect((await screen.findByTestId('gc-also-g-starter')).textContent).toBe('Also helps: E2, E3 +4');
    fireEvent.click(screen.getByTestId('gc-pick-btn-g-starter'));
    const pick = await screen.findByTestId('gc-pick-g-starter');
    const rows = await within(pick).findAllByTestId('gc-pick-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('E8The Honey TablePays 800 coins');
    expect(within(rows[1]).getByTestId('gc-taken-ev-5').textContent).toBe('Already the event for Brand Girl Era');
    fireEvent.click(within(rows[0]).getByRole('button', { name: /Pick/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/season/events/ev-8/goals/g-starter/pin'));
    fireEvent.click(within(rows[1]).getByRole('button', { name: /Move it here/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/season/events/ev-5/goals/g-starter/pin?move=1'));
  });

  test('a stale pick refused with MAIN_GOAL_TAKEN asks, and the second tap moves it', async () => {
    api.put = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('409'), { response: { status: 409, data: { code: 'MAIN_GOAL_TAKEN', error: 'x', main_goal: { title: 'The Money Talk' } } } }))
      .mockResolvedValue({ data: { success: true } });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderTab(api);
    fireEvent.click(await screen.findByTestId('gc-pick-btn-g-starter'));
    const rows = await within(await screen.findByTestId('gc-pick-g-starter')).findAllByTestId('gc-pick-row');
    fireEvent.click(within(rows[0]).getByRole('button', { name: /Pick/ }));
    expect((await screen.findByTestId('gc-taken-ev-8')).textContent).toBe('Already the event for The Money Talk');
    fireEvent.click(within(rows[0]).getByRole('button', { name: /Move it here/ }));
    await waitFor(() => expect(api.put).toHaveBeenLastCalledWith('/api/v1/world/show-1/season/events/ev-8/goals/g-starter/pin?move=1'));
  });

  test('a performance goal says what moves it and where, with no Find events; background goals are compact rows', async () => {
    renderTab(api);
    const followers = screen.getByTestId('cg-ladder-followers');
    expect(within(followers).getByTestId('gc-advice-g-5k').textContent).toContain('Moved by Pulse posts, deliverables and episode results.');
    expect(within(followers).getByRole('link', { name: /Open Release/ }).getAttribute('href')).toBe('/shows/show-1/world?tab=release');
    expect(within(followers).queryByTestId('gc-pick-btn-g-5k')).toBeNull();
    expect(screen.queryByText('Nothing this season moves this goal')).toBeNull();
    const bg = screen.getByTestId('cg-type-passive');
    expect(within(bg).getAllByRole('listitem').map((li) => li.getAttribute('data-testid'))).toEqual(['cg-goal-g-pressure', 'cg-goal-g-consistent', 'cg-goal-g-stress']);
    expect(within(bg).getByTestId('cg-goal-g-stress').textContent).toContain('Stress ≤ 3 · now 2 · passive');
    expect(within(bg).queryByRole('status')).toBeNull();
  });

  test('part warnings name only goals being worked on of a stat events move', async () => {
    renderTab(api);
    const gaps = await screen.findByTestId('gc-part-gaps');
    expect(gaps.textContent).toBe('Part 1 · Foundation: nothing moves First Impressions');
  });

  test('Tidy my goals: nothing changes until accepted; accept archives, skip hides and is remembered', async () => {
    const onChanged = vi.fn();
    const { unmount } = renderTab(api, onChanged);
    fireEvent.click(screen.getByTestId('cg-tidy-open'));
    const panel = screen.getByTestId('cg-tidy');
    expect(api.put).not.toHaveBeenCalled();
    expect(within(panel).getByTestId('cg-tidy-ladders').textContent).toContain('Coins: Starter Fund 500 → The Money Talk 2,000');
    fireEvent.click(within(panel).getByRole('button', { name: 'Accept: Merge The Pressure of Influence into Manage Stress' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/goals/g-pressure', { status: 'abandoned' }));
    expect(api.delete).not.toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalled();
    fireEvent.click(within(panel).getByRole('button', { name: 'Skip: Move Survive the Flop to passive' }));
    expect(within(panel).queryByText('Move Survive the Flop to passive')).toBeNull();
    expect(api.put).toHaveBeenCalledTimes(1);
    unmount();
    renderTab(api);
    expect(screen.getByTestId('cg-tidy-open').textContent).toContain('Tidy my goals (5)');
  });
});
