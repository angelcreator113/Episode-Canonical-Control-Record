/**
 * The Roadmap's specials (SeasonSpecials; Evoni, 2026-10-26): + Add a
 * special, the bonus suggestion's Make it / Not now, the two-parter row,
 * the special card's own day, the migration note, the slot card's part
 * label, and the Release tab's specials with their suggested day.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SpecialsBar, SpecialCard } from './SeasonSpecials';
import { SlotCard } from './SeasonPageRoadmap';
import SpecialReleaseDates from './SpecialReleaseDates';
import { DISMISS_STORAGE_KEY } from '../../lib/seasonSpecials';

const slot = (n, over = {}) => ({ id: `s${n}`, slot_number: n, phase: Math.ceil(n / 8), state: 'needs_event', locked: false, episode: null, event: null, two_part: null, intention: {}, ...over });
const roadmap = (extra = {}) => {
  const slots = Array.from({ length: 24 }, (_, i) => slot(i + 1, i + 1 === 8 ? { event: { id: 'ev1', name: 'The Rooftop Gala' }, state: 'event_ready' } : {}));
  return {
    season_number: 1, specials_ready: true, available_events: [{ id: 'ev2', name: 'Pop-up' }], specials: [], two_parters: [],
    phases: [1, 2, 3].map((p) => ({ phase: p, title: `Part ${p}`, episode_start: p * 8 - 7, episode_end: p * 8, slots: slots.filter((s) => s.phase === p) })),
    ...extra,
  };
};
const sundays = Object.fromEntries(Array.from({ length: 24 }, (_, i) => [String(i + 1), { date: new Date(Date.UTC(2026, 10, 1 + i * 7)).toISOString().slice(0, 10), time: '10:00', source: 'schedule' }]));
const release = { state: 'active', schedule: { day: 'sun', time: '10:00' }, slots: sundays, seasons: [{ season_number: 1, slots: sundays }], episodes: [], specials: [] };
const EVENTS = [{ id: 'ev1', name: 'The Rooftop Gala', event_date: '2026-12-16', prestige: 9 }, { id: 'ev2', name: 'Pop-up', event_date: null }];
const actions = (over = {}) => ({ busy: false, error: null, add: vi.fn(async () => ({ id: 'n' })), update: vi.fn(async () => true), remove: vi.fn(async () => true), makeTwoParter: vi.fn(), undoTwoParter: vi.fn(), startPartTwo: vi.fn(), ...over });
const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => { try { window.localStorage.removeItem(DISMISS_STORAGE_KEY); } catch (err) { console.warn(err); } });

describe('SpecialsBar', () => {
  test('before the migration it says so and adds nothing', () => {
    wrap(<SpecialsBar roadmap={roadmap({ specials_ready: false })} events={EVENTS} release={release} specials={actions()} />);
    expect(screen.getByTestId('sspec-needs-migration').textContent).toMatch(/need their migration first/);
    expect(screen.getByTestId('sspec-add').disabled).toBe(true);
    expect(screen.queryByTestId(/sspec-suggest-/)).toBeNull();
  });

  test('+ Add a special: a stand-alone holiday special with a title, after E12, on its own day', async () => {
    const specials = actions();
    wrap(<SpecialsBar roadmap={roadmap()} events={EVENTS} release={release} specials={specials} />);
    fireEvent.click(screen.getByTestId('sspec-add'));
    fireEvent.click(screen.getByTestId('sspec-kind-special'));
    fireEvent.change(screen.getByTestId('sspec-after'), { target: { value: '12' } });
    fireEvent.change(screen.getByTestId('sspec-title'), { target: { value: 'Holiday at the Penthouse' } });
    fireEvent.click(screen.getByTestId('sspec-use-suggested'));
    fireEvent.click(screen.getByTestId('sspec-save'));
    await waitFor(() => expect(specials.add).toHaveBeenCalled());
    expect(specials.add.mock.calls[0][0]).toEqual({
      kind: 'special', after_slot_number: 12, event_id: null, special_type: 'holiday', title: 'Holiday at the Penthouse',
      release_date: '2027-01-20', release_time: '10:00',
    });
  });

  test('a bonus episode needs its event', () => {
    wrap(<SpecialsBar roadmap={roadmap()} events={EVENTS} release={release} specials={actions()} />);
    fireEvent.click(screen.getByTestId('sspec-add'));
    expect(screen.getByTestId('sspec-save').disabled).toBe(true);
    fireEvent.change(screen.getByTestId('sspec-event'), { target: { value: 'ev2' } });
    expect(screen.getByTestId('sspec-save').disabled).toBe(false);
  });

  test('the suggestion: Make it opens the form with the event, after E7, on the nearest Wednesday; Not now hides it', async () => {
    const specials = actions();
    wrap(<SpecialsBar roadmap={roadmap()} events={EVENTS} release={release} specials={specials} />);
    const card = screen.getByTestId('sspec-suggest-ev1');
    expect(card.textContent).toMatch(/Make “The Rooftop Gala” a bonus episode\?/);
    expect(card.textContent).toMatch(/no weekly release is near it .* stakes are high \(prestige 9\)\. It would sit after E7, leaving E8 open\./);
    fireEvent.click(within(card).getByTestId('sspec-suggest-make-ev1'));
    expect(screen.getByTestId('sspec-event').value).toBe('ev1');
    expect(screen.getByTestId('sspec-after').value).toBe('7');
    expect(screen.getByTestId('sspec-date').value).toBe('2026-12-16');
    fireEvent.click(screen.getByTestId('sspec-save'));
    await waitFor(() => expect(specials.add).toHaveBeenCalledWith(expect.objectContaining({ kind: 'bonus', after_slot_number: 7, event_id: 'ev1', release_date: '2026-12-16', release_time: '10:00' })));
  });

  test('Not now hides the suggestion (remembered in this browser)', () => {
    const { unmount } = wrap(<SpecialsBar roadmap={roadmap()} events={EVENTS} release={release} specials={actions()} />);
    fireEvent.click(screen.getByTestId('sspec-suggest-not-now-ev1'));
    expect(screen.queryByTestId('sspec-suggest-ev1')).toBeNull();
    unmount();
    wrap(<SpecialsBar roadmap={roadmap()} events={EVENTS} release={release} specials={actions()} />);
    expect(screen.queryByTestId('sspec-suggest-ev1')).toBeNull();
  });

  test('a two-parter row: Start Part 2 and Undo', () => {
    const specials = actions();
    const tp = { id: 'tp1', event: { id: 'g', name: 'The Finale Gala' }, part_one: { slot_number: 12, label: 'E12 · Part 1/2', episode: { id: 'e1' } }, part_two: { slot_number: 13, label: 'E13 · Part 2/2', episode: null }, can_start_part_two: true, can_undo: true };
    wrap(<SpecialsBar roadmap={roadmap({ two_parters: [tp] })} events={[]} release={release} specials={specials} />);
    expect(screen.getByTestId('sspec-two-tp1').textContent).toMatch(/E12 · Part 1\/2 started → E13 · Part 2\/2\. The event completes with Part 2\./);
    fireEvent.click(screen.getByTestId('sspec-two-start-tp1'));
    expect(specials.startPartTwo).toHaveBeenCalledWith('tp1');
    fireEvent.click(screen.getByTestId('sspec-two-undo-tp1'));
    expect(specials.undoTwoParter).toHaveBeenCalledWith('tp1');
  });
});

describe('SpecialCard and SlotCard', () => {
  const BONUS = { id: 'sp1', kind: 'bonus', label: 'Special · after E7', title: 'Midweek Rooftop', after_slot_number: 7, phase: 1, state: 'event_ready', event: { id: 'ev9', name: 'Midweek Rooftop' }, episode: null, release: { date: '2026-12-16', time: '18:00' } };
  test('a bonus card shows its label and its own day, and opens its editor', async () => {
    const specials = actions();
    wrap(<SpecialCard special={BONUS} release={null} specials={specials} showId="show-1" />);
    expect(screen.getByTestId('sspec-when-sp1').textContent).toBe('Wed, Dec 16 · 6:00 PM');
    expect(screen.getByTestId('sspec-card-sp1').textContent).toMatch(/^Special · after E7/);
    fireEvent.click(screen.getByRole('button', { name: /Special · after E7: Midweek Rooftop/ }));
    fireEvent.change(screen.getByTestId('sspec-editor-date-sp1'), { target: { value: '2026-12-17' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(specials.update).toHaveBeenCalledWith('sp1', { title: 'Midweek Rooftop', release_date: '2026-12-17', release_time: '18:00' }));
  });
  test('a slot in a two-parter reads its part, and its menu offers Start Part 2', () => {
    const startPartTwo = vi.fn();
    const s13 = slot(13, { state: 'event_ready', event: { id: 'g', name: 'Gala' }, two_part: { id: 'tp1', part: 2, of: 2, other_slot_number: 12, label: 'E13 · Part 2/2' } });
    wrap(<SlotCard slot={s13} showId="show-1" onOpen={vi.fn()} onIntention={vi.fn()} twoPart={{ startPartTwo, undo: vi.fn() }} />);
    expect(screen.getByTestId('szn-slot-13').textContent).toMatch(/^E13 · Part 2\/2/);
    fireEvent.click(screen.getByTestId('szn-slot-menu-13'));
    fireEvent.click(screen.getByTestId('szn-slot-part-two-13'));
    expect(startPartTwo).toHaveBeenCalled();
  });
  test('a slot with an event offers Make it a two-parter', () => {
    const make = vi.fn();
    wrap(<SlotCard slot={slot(12, { event: { id: 'g', name: 'Gala' }, state: 'event_ready' })} showId="show-1" onOpen={vi.fn()} onIntention={vi.fn()} twoPart={{ canMake: true, make }} />);
    fireEvent.click(screen.getByTestId('szn-slot-menu-12'));
    expect(screen.getByTestId('szn-slot-two-part-12').textContent).toBe('Make it a two-parter (Part 2 in E13)');
    fireEvent.click(screen.getByTestId('szn-slot-two-part-12'));
    expect(make).toHaveBeenCalled();
  });
});

describe('SpecialReleaseDates (the Release tab)', () => {
  test('each special on its own day; one without a date takes its suggestion in one click', async () => {
    const api = { patch: vi.fn(async () => ({ data: { success: true } })) };
    const rs = {
      reload: vi.fn(async () => {}),
      view: { specials: [
        { special_id: 'sp1', title: 'Midweek Rooftop', date: '2026-12-16', time: '18:00', due: 'soon', days_until: 2, special: { label: 'Special · after E7' }, suggested: null },
        { special_id: 'sp2', title: 'Holiday at the Penthouse', date: null, time: null, due: null, special: { label: 'Holiday special' }, suggested: { date: '2026-12-23', time: '10:00' } },
      ] },
    };
    wrap(<SpecialReleaseDates rs={rs} api={api} showId="show-1" />);
    expect(screen.getByTestId('srel-when-sp1').textContent).toBe('Wed, Dec 16 · 6:00 PM · YouTube');
    expect(screen.getByTestId('srel-row-sp1').textContent).toMatch(/Special · after E7 releases in 2 days\./);
    expect(screen.getByTestId('srel-when-sp2').textContent).toBe('No date yet · YouTube');
    fireEvent.click(screen.getByTestId('srel-use-sp2'));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/v1/world/show-1/season/specials/sp2', { release_date: '2026-12-23', release_time: '10:00' }));
    expect(rs.reload).toHaveBeenCalled();
  });
  test('nothing without specials', () => {
    const { container } = wrap(<SpecialReleaseDates rs={{ view: { specials: [] } }} api={{}} showId="show-1" />);
    expect(container.textContent).toBe('');
  });
});
