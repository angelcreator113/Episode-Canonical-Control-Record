/**
 * Goals line up with the events that move them (Evoni, 2026-10-25: "a, b
 * and c, with pinning, show me first"): the Goals tab's Moved by, the
 * on-track line, "Nothing this season moves this goal" with Find events and
 * its pins, the per-part warning, the slot card's "Moves:" chip and the
 * Event Package's chips and pin control.
 */
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import CareerGoals from './CareerGoals';
import { SlotCard } from './SeasonPageRoadmap';
import { MovesChips, GoalPartWarnings } from './GoalCoverage';
import EventGoalPins from '../EventPackage/EventGoalPins';
import { projectionText, projectionVerdict, partGapText, slotGoalsMap } from '../../lib/goalCoverage';
import { contrast, readToken } from '../../styles/contrast';

const SHOW = 'show-1';
const GOALS = [
  { id: 'g-coins', title: 'Save 3,000 coins', type: 'primary', status: 'active', target_metric: 'coins', current_value: 600, target_value: 3000 },
  { id: 'g-trust', title: 'Earn brand trust', type: 'secondary', status: 'active', target_metric: 'brand_trust', current_value: 2, target_value: 6 },
];
const COVERAGE = {
  success: true,
  season: { season_number: 1 },
  goals: [
    {
      id: 'g-coins', title: 'Save 3,000 coins', target_metric: 'coins',
      movers: [
        { event_id: 'ev-3', name: 'Paid runway', slot_id: 's3', slot_number: 3, code: 'E3', phase: 1, via: 'fit', pinned: false, gain: 1500 },
        { event_id: 'ev-11', name: 'Beauty deal', slot_id: 's11', slot_number: 11, code: 'E11', phase: 2, via: 'pinned', pinned: true, gain: 900 },
      ],
      projection: { label: 'Coins', current: 600, gain: 2400, projected: 3000, target: 3000, counted: 2, on_track: true, short: 0 },
      gap_phases: [3],
    },
    {
      id: 'g-trust', title: 'Earn brand trust', target_metric: 'brand_trust', movers: [],
      projection: { label: 'Brand Trust', current: 2, gain: 0, projected: 2, target: 6, counted: 0, on_track: false, short: 4 },
      gap_phases: [1, 2, 3],
    },
  ],
  parts: [
    { phase: 1, title: 'Foundation', gaps: [{ goal_id: 'g-trust', title: 'Earn brand trust' }] },
    { phase: 2, title: 'Rise', gaps: [] },
    { phase: 3, title: 'Crown', gaps: [{ goal_id: 'g-coins', title: 'Save 3,000 coins' }, { goal_id: 'g-trust', title: 'Earn brand trust' }] },
  ],
  slots: [{ slot_id: 's3', slot_number: 3, event_id: 'ev-3', goals: [{ goal_id: 'g-coins', title: 'Save 3,000 coins', via: 'fit' }] }],
  event: null,
};
const FIND = {
  success: true,
  goal: { id: 'g-trust', title: 'Earn brand trust' },
  events: [
    { id: 'ev-dinner', name: 'Brand dinner', via: 'fit', pinned: false, gain: 3, slot: null, reason: '+3 brand trust reward' },
    { id: 'ev-3', name: 'Paid runway', via: null, pinned: false, gain: 0, slot: { code: 'E3', slot_number: 3 }, reason: 'Nothing in it moves this goal; pin it if it does' },
  ],
};

function makeApi(overrides = {}) {
  return {
    get: vi.fn(async (url) => {
      if (url.includes('/season/goal-coverage')) return { data: overrides.coverage || COVERAGE };
      if (url.includes('/season/goals/g-trust/events')) return { data: overrides.find || FIND };
      throw new Error(`unexpected GET ${url}`);
    }),
    put: vi.fn(async () => ({ data: { success: true } })),
    post: vi.fn(),
    delete: vi.fn(async () => ({ data: { success: true } })),
  };
}

const renderGoals = (api) => render(
  <MemoryRouter><CareerGoals showId={SHOW} api={api} goals={GOALS} onChanged={vi.fn()} /></MemoryRouter>,
);

describe('the wording', () => {
  test('projectionText, projectionVerdict and partGapText', () => {
    expect(projectionText(COVERAGE.goals[0].projection)).toBe('Coins: 600 + 2,400 = 3,000 of 3,000');
    expect(projectionVerdict(COVERAGE.goals[0].projection)).toBe('On track');
    expect(projectionVerdict({ counted: 1, on_track: false, short: 400 })).toBe('400 short');
    expect(projectionText(COVERAGE.goals[1].projection)).toBe('Brand Trust: 2 of 6 · no expected reward counted yet');
    expect(projectionVerdict(COVERAGE.goals[1].projection)).toBeNull();
    expect(projectionText(null)).toBeNull();
    expect(partGapText({ gaps: [{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }, { title: 'E' }] })).toBe('nothing moves A, B, C +2 more');
    expect(partGapText({ gaps: [] })).toBeNull();
    expect(slotGoalsMap(COVERAGE).s3.map((g) => g.title)).toEqual(['Save 3,000 coins']);
  });
});

describe('the Goals tab', () => {
  let api;
  beforeEach(() => { api = makeApi(); });

  test('Moved by names each event with its episode code, and the on-track line', async () => {
    renderGoals(api);
    const moved = await screen.findByTestId('gc-moved-g-coins');
    expect(moved.textContent).toBe('Moved by: E3Paid runway, E11Beauty deal');
    expect(within(moved).getByRole('link', { name: 'E3 Paid runway' }).getAttribute('href')).toBe('/shows/show-1/events/ev-3');
    expect(screen.getByTestId('gc-proj-g-coins').textContent).toBe('Coins: 600 + 2,400 = 3,000 of 3,000 · On track');
    expect(within(moved).getByRole('link', { name: 'E11 Beauty deal (pinned)' })).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/show-1/season/goal-coverage');
  });

  test('a pinned mover unpins from Moved by, and the coverage reloads', async () => {
    renderGoals(api);
    fireEvent.click(await screen.findByRole('button', { name: 'Unpin Beauty deal from Save 3,000 coins' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/world/show-1/season/events/ev-11/goals/g-coins/pin'));
    await waitFor(() => expect(api.get.mock.calls.filter(([u]) => u.includes('goal-coverage')).length).toBe(2));
    // A fit mover has no unpin.
    expect(screen.queryByRole('button', { name: /Unpin Paid runway/ })).toBeNull();
  });

  test('nothing moves it: the line, Find events lists the best fits with Pin, Open and Place it', async () => {
    renderGoals(api);
    expect((await screen.findByTestId('gc-none-g-trust')).textContent).toBe('Nothing this season moves this goal');
    fireEvent.click(screen.getByTestId('gc-find-btn-g-trust'));
    const find = await screen.findByTestId('gc-find-g-trust');
    const rows = await within(find).findAllByTestId('gc-find-row');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Brand dinnerNot placed · +3 brand trust reward'),
      expect.stringContaining('E3Paid runwayNothing in it moves this goal; pin it if it does'),
    ]);
    expect(within(rows[0]).getByTestId('gc-place-ev-dinner').getAttribute('href')).toBe('/shows/show-1/season?tab=events');
    expect(within(rows[1]).queryByText('Place it')).toBeNull();
    fireEvent.click(within(rows[0]).getByTestId('gc-pin-ev-dinner'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/season/events/ev-dinner/goals/g-trust/pin'));
    await waitFor(() => expect(api.get.mock.calls.filter(([u]) => u.includes('/goals/g-trust/events')).length).toBe(2));
  });

  test('an already pinned event in Find events unpins', async () => {
    api = makeApi({ find: { ...FIND, events: [{ ...FIND.events[0], via: 'pinned', pinned: true, reason: 'Pinned to this goal' }] } });
    renderGoals(api);
    fireEvent.click(await screen.findByTestId('gc-find-btn-g-trust'));
    const pin = await screen.findByTestId('gc-pin-ev-dinner');
    expect(pin.textContent).toBe('Unpin');
    expect(pin.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(pin);
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/world/show-1/season/events/ev-dinner/goals/g-trust/pin'));
  });

  test('the per-part warning: one line per part with a gap, none for a covered part', async () => {
    renderGoals(api);
    const gaps = await screen.findByTestId('gc-part-gaps');
    expect(within(gaps).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Part 1 · Foundation: nothing moves Earn brand trust',
      'Part 3 · Crown: nothing moves Save 3,000 coins, Earn brand trust',
    ]);
    expect(screen.queryByTestId('gc-part-gap-2')).toBeNull();
  });

  test('a failed coverage read says so and the goals still show', async () => {
    api.get = vi.fn(async () => { throw new Error('offline'); });
    renderGoals(api);
    expect((await screen.findByTestId('cg-coverage-error')).textContent).toContain('offline');
    expect(screen.getByTestId('cg-goal-g-coins')).toBeTruthy();
    expect(screen.queryByTestId('gc-goal-g-coins')).toBeNull();
  });

  test('no gaps, no warning', () => {
    const { container } = render(<GoalPartWarnings parts={[{ phase: 1, gaps: [] }]} />);
    expect(container.textContent).toBe('');
  });
});

describe('the "Moves:" chip', () => {
  const SLOT = { id: 's3', slot_number: 3, phase: 1, state: 'event_ready', event: { id: 'ev-3', name: 'Paid runway' }, intention: {} };

  test('on a slot card', () => {
    render(<MemoryRouter><SlotCard slot={SLOT} showId={SHOW} onOpen={vi.fn()} onIntention={vi.fn()} moves={slotGoalsMap(COVERAGE).s3} /></MemoryRouter>);
    expect(screen.getByTestId('szn-slot-moves-3').textContent).toBe('Moves: Save 3,000 coins');
  });

  test('none without goals; past the first, the rest fold into +N', () => {
    render(<MemoryRouter><SlotCard slot={SLOT} showId={SHOW} onOpen={vi.fn()} onIntention={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByTestId('szn-slot-moves-3')).toBeNull();
    render(<MovesChips goals={[{ goal_id: 'a', title: 'A' }, { goal_id: 'b', title: 'B' }, { goal_id: 'c', title: 'C' }]} testId="chips" />);
    expect(screen.getByTestId('chips').textContent).toBe('Moves: A+2');
    render(<MovesChips goals={[{ goal_id: 'a', title: 'A' }, { goal_id: 'b', title: 'B' }, { goal_id: 'c', title: 'C' }]} max={2} testId="chips2" />);
    expect(screen.getByTestId('chips2').textContent).toBe('Moves: A, B+1');
    expect(screen.getByTestId('chips').getAttribute('aria-label')).toBe('Moves: A, B, C');
  });
});

describe('the Event Package: what this event moves, and pinning it', () => {
  const EVENT = {
    id: 'ev-11', name: 'Beauty deal', pinned_goal_ids: ['g-trust'], slot: { code: 'E11' },
    moves: [{ goal_id: 'g-coins', title: 'Save 3,000 coins', via: 'fit', pinned: false }, { goal_id: 'g-trust', title: 'Earn brand trust', via: 'pinned', pinned: true }],
    goals: [
      { goal_id: 'g-coins', title: 'Save 3,000 coins', via: 'fit', pinned: false },
      { goal_id: 'g-trust', title: 'Earn brand trust', via: 'pinned', pinned: true },
      { goal_id: 'g-rep', title: 'Reach reputation 8', via: null, pinned: false },
    ],
  };

  test('the chips, an unpin on the pinned one, and Pin to a goal', async () => {
    const api = makeApi({ coverage: { ...COVERAGE, event: EVENT } });
    render(<EventGoalPins api={api} showId={SHOW} eventId="ev-11" />);
    expect((await screen.findByTestId('event-goal-pins')).textContent).toContain('Moves:');
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/show-1/season/goal-coverage?event_id=ev-11');
    expect(screen.getByTestId('egp-chip-g-coins').textContent).toBe('Save 3,000 coins');
    expect(screen.queryByTestId('egp-unpin-g-coins')).toBeNull();
    fireEvent.click(screen.getByTestId('egp-unpin-g-trust'));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/world/show-1/season/events/ev-11/goals/g-trust/pin'));
    const select = screen.getByTestId('egp-pin-select');
    expect([...select.options].map((o) => o.textContent)).toEqual(['Pin to a goal…', 'Save 3,000 coins', 'Reach reputation 8']);
    fireEvent.change(select, { target: { value: 'g-rep' } });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/season/events/ev-11/goals/g-rep/pin'));
    await waitFor(() => expect(api.get.mock.calls.length).toBe(3));
  });

  test('moves nothing yet: says so; hidden with no season or no goals', async () => {
    const api = makeApi({ coverage: { ...COVERAGE, event: { ...EVENT, moves: [], goals: EVENT.goals.map((g) => ({ ...g, via: null, pinned: false })) } } });
    render(<EventGoalPins api={api} showId={SHOW} eventId="ev-11" />);
    expect((await screen.findByTestId('egp-none')).textContent).toBe('no goal yet');
    const none = makeApi({ coverage: { ...COVERAGE, season: null, event: null } });
    const { container } = render(<EventGoalPins api={none} showId={SHOW} eventId="ev-x" />);
    await waitFor(() => expect(none.get).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});

describe('styles', () => {
  const strip = (f) => readFileSync(resolve(__dirname, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  test('tokens only: the Season page\'s --sp-* here, the app\'s design tokens on the Event Package', () => {
    const gc = strip('GoalCoverage.css');
    const egp = strip('../EventPackage/EventGoalPins.css');
    for (const css of [gc, egp]) {
      expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(css).not.toMatch(/rgba?\(/i);
    }
    expect(gc).not.toMatch(/var\(--lala-/);
    expect(egp).not.toMatch(/var\(--sp-/);
  });
  test('the Event Package chips read 4.5:1', () => {
    const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
    const t = (name) => readToken([tokens], name);
    expect(contrast(t('--lala-lavender-text'), t('--lala-lavender-soft'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--lala-lavender-text'), t('--surface-card'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--lala-ink-muted'), t('--surface-card'))).toBeGreaterThanOrEqual(4.5);
  });
});
