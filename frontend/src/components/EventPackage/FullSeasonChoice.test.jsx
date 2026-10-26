/**
 * A full season's new events become specials (Evoni, 2026-10-26: "Yes placed
 * events should be seen as full, they should have both options, no limit";
 * FullSeasonChoice, lib/seasonFull, WillBeSpecial): the Event page's "Will be
 * a special" with both options, the swap and its outcome, the no-date case,
 * the Start Episode note, a special's Move it / story position / Swap /
 * Season 2 / Remove, the started note, the migration note, and the Events
 * tab's chip.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import FullSeasonChoice from './FullSeasonChoice';
import SeasonPlacePanel from './SeasonPlacePanel';
import { WillBeSpecial } from '../Show/SeasonSpecials';
import { gapText, placeReason, swapOutcome, hasStoryDate, seasonIsFull } from '../../lib/seasonFull';

const option = (n, over = {}) => ({
  slot_id: `s${n}`, slot_number: n, event: { id: `w${n}`, name: `Week ${n} event`, date: `2026-03-${String(n).padStart(2, '0')}` },
  can_swap: true, reason: null, becomes: { after: n, label: `Special · after E${n}`, release: { date: '2026-12-02', time: '10:00' } }, ...over,
});
const CHOICE = {
  ready: true, full: true, where: 'none', slot_count: 24, open_slots: 0, season_number: 1, part: { number: 1, title: 'Foundation', episode_end: 8 },
  event: { id: 'ev', name: 'Midnight Gala', event_date: '2026-03-27', has_date: true, started: false },
  special: null,
  special_place: { after: 4, label: 'Special · after E4', by: 'date', skipped_released: 0, release: { date: '2026-11-25', time: '10:00', from: 'midweek' } },
  swap: {
    suggested_slot_id: 's5',
    options: [option(2, { can_swap: false, reason: 'E2 has started: it is locked to its episode.', becomes: null }), option(4), option(5),
      option(11, { can_swap: false, reason: 'E11 is Part 2 of a two-parter: a swap would split it. Undo the two-parter on the Roadmap first, or pick another episode.', becomes: null })],
  },
  next_season: null,
  start_note: 'The season is full: Start Episode makes it Special · after E4, unless you choose here first.',
};
const CONTEXT = { in_slot: false, in_special: false, season_full: true, specials_ready: true, season_number: 1 };
const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const answer = (data) => vi.mocked(api.get).mockResolvedValue({ data: { success: true, data } });

beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()); });

describe('FullSeasonChoice: Will be a special', () => {
  test('both options: Make it a special between E4 and E5 with its date, or Swap it into E5 (nearest)', async () => {
    answer(CHOICE);
    wrap(<FullSeasonChoice showId="show" eventId="ev" context={CONTEXT} />);
    expect((await screen.findByTestId('fsc-will-be')).textContent).toMatch(/Will be a special/);
    const make = screen.getByTestId('fsc-option-special');
    expect(make.textContent).toMatch(/Special · after E4 · between E4 and E5/);
    expect(make.textContent).toMatch(/Releases Wed, Nov 25 · 10:00 AM on YouTube/);
    expect(screen.getByTestId('fsc-place-reason').textContent).toMatch(/its date comes just after E4's event/);
    expect(screen.getByTestId('fsc-swap-slot').value).toBe('s5');
    expect(screen.getByTestId('fsc-swap').textContent).toMatch(/Swap it into E5/);
    expect(screen.getByTestId('fsc-swap-outcome').textContent).toBe('“Week 5 event” becomes Special · after E5, Wed, Dec 2 · 10:00 AM.');
    expect(screen.getByTestId('fsc-start-note').textContent).toMatch(/Start Episode makes it Special · after E4/);
    expect(screen.queryByTestId('fsc-next-season')).toBeNull();
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/show/season/full/events/ev');
  });

  test('a started slot and a two-parter cannot be swapped into, in plain words', async () => {
    answer(CHOICE);
    wrap(<FullSeasonChoice showId="show" eventId="ev" context={CONTEXT} />);
    const select = await screen.findByTestId('fsc-swap-slot');
    expect([...select.options].filter((o) => o.disabled).map((o) => o.value)).toEqual(['s2', 's11']);
    fireEvent.change(select, { target: { value: 's11' } });
    expect(screen.getByTestId('fsc-swap-outcome').textContent).toMatch(/E11 is Part 2 of a two-parter: a swap would split it/);
    expect(screen.getByTestId('fsc-swap').disabled).toBe(true);
  });

  test('Make it a special and Swap send the choice, reload the page and say what happened; the swap can be undone', async () => {
    answer(CHOICE);
    const reload = vi.fn(async () => {});
    const setToast = vi.fn();
    vi.mocked(api.post).mockImplementation(async (url) => (url.endsWith('/swap')
      ? { data: { data: { slot_id: 's5', slot_number: 5, replaced: { id: 'w5', name: 'Week 5 event', special: { label: 'Special · after E5' } } } } }
      : { data: { data: { label: 'Special · after E4' } } }));
    wrap(<FullSeasonChoice showId="show" eventId="ev" context={CONTEXT} reload={reload} setToast={setToast} />);
    fireEvent.click(await screen.findByTestId('fsc-make'));
    await waitFor(() => expect(setToast).toHaveBeenCalledWith('Made it Special · after E4.', undefined));
    expect(api.post).toHaveBeenCalledWith('/api/v1/world/show/season/full/events/ev/special');
    expect(reload).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('fsc-swap'));
    await waitFor(() => expect(setToast).toHaveBeenCalledTimes(2));
    expect(api.post).toHaveBeenCalledWith('/api/v1/world/show/season/full/events/ev/swap', { slot_id: 's5' });
    const [text, opts] = setToast.mock.calls[1];
    expect(text).toBe('Swapped into E5. “Week 5 event” is now Special · after E5.');
    await opts.undo();
    expect(api.post).toHaveBeenLastCalledWith('/api/v1/world/show/season/full/events/w5/swap', { slot_id: 's5' });
  });

  test('no date yet: after the part in progress, "place it when you know"', async () => {
    answer({ ...CHOICE, event: { ...CHOICE.event, event_date: null, has_date: false }, special_place: { ...CHOICE.special_place, after: 8, label: 'Special · after E8', by: 'no_date' } });
    wrap(<FullSeasonChoice showId="show" eventId="ev" context={CONTEXT} />);
    expect((await screen.findByTestId('fsc-place-reason')).textContent)
      .toBe('No date yet: place it when you know. For now it follows E8, the last episode of Part 1: Foundation.');
  });

  test('a special: Move it, Move it to its story position once it has a date, Swap, Season 2, Remove', async () => {
    answer({
      ...CHOICE, where: 'special', start_note: null,
      special: { id: 'sp1', kind: 'bonus', label: 'Special · after E8', after_slot_number: 8, started: false, done: false, release: { date: '2026-12-23', time: '10:00' } },
      at_story_position: false,
      next_season: { arc_id: 'a2', season_number: 2, title: 'Season 2', open_slot_number: 1 },
    });
    vi.mocked(api.post).mockResolvedValue({ data: { data: { label: 'Special · after E4' } } });
    vi.mocked(api.patch).mockResolvedValue({ data: { data: {} } });
    vi.mocked(api.delete).mockResolvedValue({ data: { data: {} } });
    wrap(<FullSeasonChoice showId="show" eventId="ev" context={{ ...CONTEXT, in_special: true }} />);
    expect((await screen.findByTestId('fsc-story-offer')).textContent).toMatch(/Its date puts it between E4 and E5 \(Special · after E4, Wed, Nov 25 · 10:00 AM\)/);
    fireEvent.click(screen.getByTestId('fsc-to-story'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show/season/specials/sp1/story-position'));
    fireEvent.change(screen.getByTestId('fsc-move-after'), { target: { value: '12' } });
    fireEvent.click(screen.getByTestId('fsc-move'));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/v1/world/show/season/specials/sp1', { after_slot_number: 12 }));
    fireEvent.click(screen.getByTestId('fsc-next-season'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show/season/full/events/ev/next-season'));
    fireEvent.click(screen.getByTestId('fsc-remove'));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/world/show/season/specials/sp1'));
    expect(screen.getByTestId('fsc-swap')).toBeTruthy();
  });

  test('started by Start Episode on a full season: it says so, and the episode can still move', async () => {
    answer({ ...CHOICE, where: 'special', start_note: null, event: { ...CHOICE.event, started: true }, at_story_position: true,
      special: { id: 'sp1', kind: 'bonus', label: 'Special · after E4', after_slot_number: 4, started: true, done: false, release: { date: '2026-11-25', time: '10:00' } } });
    wrap(<FullSeasonChoice showId="show" eventId="ev" context={{ ...CONTEXT, in_special: true }} />);
    expect((await screen.findByTestId('fsc-started-note')).textContent).toMatch(/Started as Special · after E4: the season was full/);
    expect(screen.queryByTestId('fsc-remove')).toBeNull();
    expect(screen.getByTestId('fsc-move')).toBeTruthy();
    expect(screen.getByTestId('fsc-swap')).toBeTruthy();
  });

  test('before the specials\' migration: it says so plainly and asks nothing of the server', () => {
    wrap(<FullSeasonChoice showId="show" eventId="ev" context={{ ...CONTEXT, specials_ready: false }} />);
    expect(screen.getByTestId('fsc-needs-migration').textContent).toMatch(/Special episodes need their migration first/);
    expect(api.get).not.toHaveBeenCalled();
  });

  test('the season panel shows the choice for a full season, and the old line otherwise', async () => {
    answer(CHOICE);
    const { unmount } = wrap(<SeasonPlacePanel place={{ context: CONTEXT, coverage: {} }} showId="show" eventId="ev" />);
    expect(await screen.findByTestId('fsc-will-be')).toBeTruthy();
    expect(screen.queryByTestId('season-unplaced')).toBeNull();
    unmount();
    wrap(<SeasonPlacePanel place={{ context: { in_slot: false, season_full: false, next_open: { label: 'S1 · E9' } }, coverage: {} }} showId="show" eventId="ev" />);
    expect(screen.getByTestId('season-unplaced').textContent).toMatch(/next open slot is S1 · E9/);
  });
});

describe('the Events tab: Will be a special', () => {
  test('Make it a special from the list, or open it to swap', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { label: 'Special · after E4' } } });
    const onChanged = vi.fn(async () => {});
    const setToast = vi.fn();
    wrap(<WillBeSpecial api={api} showId="show" event={{ id: 'ev', name: 'Midnight Gala' }} from="events:unplaced" onChanged={onChanged} setToast={setToast} />);
    expect(screen.getByTestId('sspec-will-ev').textContent).toMatch(/Will be a special/);
    expect(screen.getByTestId('sspec-will-swap-ev').getAttribute('href')).toBe('/shows/show/events/ev?from=events:unplaced');
    fireEvent.click(screen.getByTestId('sspec-will-make-ev'));
    await waitFor(() => expect(setToast).toHaveBeenCalledWith('“Midnight Gala” is Special · after E4.'));
    expect(onChanged).toHaveBeenCalled();
  });
  test('before the migration: the chip says specials need it', () => {
    wrap(<WillBeSpecial api={api} showId="show" event={{ id: 'ev', name: 'X' }} ready={false} />);
    expect(screen.getByTestId('sspec-will-ev').textContent).toBe('Season full · specials need their migration first');
    expect(screen.queryByTestId('sspec-will-make-ev')).toBeNull();
  });
});

describe('lib/seasonFull words', () => {
  test('gaps, reasons, outcomes, dates', () => {
    expect(gapText(0)).toBe('before E1');
    expect(gapText(4)).toBe('between E4 and E5');
    expect(gapText(24, 24)).toBe('after E24, the last weekly episode');
    expect(placeReason({ by: 'date', after: 6, skipped_released: 2 })).toMatch(/already released, so it takes the first gap still to come/);
    expect(swapOutcome({ can_swap: true, slot_number: 7, event: null })).toBe('E7 has no event: it simply takes this one.');
    expect(hasStoryDate('2026-03-27')).toBe(true);
    expect(hasStoryDate('Friday, March 15th')).toBe(false);
    expect(seasonIsFull({ season_full: true })).toBe(true);
    expect(seasonIsFull(null)).toBe(false);
  });
});
