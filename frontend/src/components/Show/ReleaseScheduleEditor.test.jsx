/**
 * The release schedule editor (Evoni, 2026-10-25): set it from the Sunday
 * 10:00 suggestion, change it any time with a preview of what moves, start
 * or stop releasing, pause it without losing it.
 */
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ReleaseScheduleEditor from './ReleaseScheduleEditor';

const SCHEDULE = { day: 'sun', time: '10:00', cadence: 'weekly', first_release: '2026-11-01', paused: false, tz_offset: 240, tz: 'America/New_York' };

function makeRs(view, over = {}) {
  return {
    view,
    error: null,
    save: vi.fn(async () => view),
    preview: vi.fn(async () => ({ moves: [] })),
    setEpisodeDate: vi.fn(),
    ...over,
  };
}

describe('ReleaseScheduleEditor', () => {
  beforeEach(() => vi.restoreAllMocks());

  test('with none, it suggests Sunday 10:00 and saves it', async () => {
    const rs = makeRs({ schedule: null, state: 'unset', suggestion: { day: 'sun', time: '10:00', cadence: 'weekly', first_release: null, paused: false }, episodes: [] }, {
      preview: vi.fn(async () => ({ moves: [{ episode_id: 'e1', episode_number: 1, from: null, to: { date: '2026-10-25', time: '10:00' } }] })),
    });
    render(<ReleaseScheduleEditor rs={rs} />);
    expect(screen.getByText('No release schedule yet')).toBeTruthy();
    fireEvent.click(screen.getByTestId('release-schedule-edit'));
    expect(screen.getByTestId('release-schedule-day').value).toBe('sun');
    expect(screen.getByTestId('release-schedule-time').value).toBe('10:00');
    expect(screen.getByText('Not releasing yet: dates are previews and nothing warns.')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('release-schedule-preview').textContent).toContain('E1 gets Sun, Oct 25 · 10:00 AM'));
    fireEvent.change(screen.getByTestId('release-schedule-first'), { target: { value: '2026-11-01' } });
    fireEvent.click(screen.getByTestId('release-schedule-save'));
    await waitFor(() => expect(rs.save).toHaveBeenCalledWith({ day: 'sun', time: '10:00', cadence: 'weekly', first_release: '2026-11-01', paused: false, platforms: ['youtube'], seasons: {} }));
    await waitFor(() => expect(screen.queryByTestId('release-schedule-form')).toBeNull());
  });

  test('a change shows what moves before it is saved; hand-set dates stay', async () => {
    const rs = makeRs({ schedule: SCHEDULE, state: 'active', episodes: [] }, {
      preview: vi.fn(async () => ({ moves: [{ episode_id: 'e3', episode_number: 3, from: { date: '2026-11-15', time: '10:00' }, to: { date: '2026-11-14', time: '09:30' } }] })),
    });
    render(<ReleaseScheduleEditor rs={rs} />);
    expect(screen.getByTestId('release-schedule-sentence').textContent).toBe('Releases on YouTube every Sunday at 10:00 AM');
    expect(screen.getByTestId('release-schedule-start').textContent).toBe('Starts releasing Sun, Nov 1');
    fireEvent.click(screen.getByTestId('release-schedule-edit'));
    expect(screen.queryByTestId('release-schedule-preview')).toBeNull();
    expect(screen.getByTestId('release-schedule-save').disabled).toBe(true);
    fireEvent.change(screen.getByTestId('release-schedule-day'), { target: { value: 'sat' } });
    fireEvent.change(screen.getByTestId('release-schedule-time'), { target: { value: '09:30' } });
    const preview = await screen.findByTestId('release-schedule-preview');
    await waitFor(() => expect(preview.textContent).toContain('E3 moves from Sun, Nov 15 · 10:00 AM to Sat, Nov 14 · 9:30 AM'));
    expect(preview.textContent).toContain('Dates you set by hand stay where they are.');
    expect(rs.preview).toHaveBeenLastCalledWith(expect.objectContaining({ day: 'sat', time: '09:30' }));
    fireEvent.click(screen.getByTestId('release-schedule-save'));
    await waitFor(() => expect(rs.save).toHaveBeenCalledWith(expect.objectContaining({ day: 'sat', time: '09:30', first_release: '2026-11-01' })));
  });

  test('"Not releasing yet" clears the first release date', async () => {
    const rs = makeRs({ schedule: SCHEDULE, state: 'active', episodes: [] });
    render(<ReleaseScheduleEditor rs={rs} />);
    fireEvent.click(screen.getByTestId('release-schedule-edit'));
    fireEvent.click(screen.getByTestId('release-schedule-not-yet'));
    expect(screen.getByTestId('release-schedule-first').value).toBe('');
    fireEvent.click(screen.getByTestId('release-schedule-save'));
    await waitFor(() => expect(rs.save).toHaveBeenCalledWith(expect.objectContaining({ first_release: null })));
  });

  test('pause keeps the schedule; a paused one resumes', async () => {
    const rs = makeRs({ schedule: SCHEDULE, state: 'active', episodes: [] });
    const { rerender } = render(<ReleaseScheduleEditor rs={rs} />);
    fireEvent.click(screen.getByTestId('release-schedule-pause'));
    await waitFor(() => expect(rs.save).toHaveBeenCalledWith({ day: 'sun', time: '10:00', cadence: 'weekly', first_release: '2026-11-01', paused: true, platforms: ['youtube'], seasons: {} }));

    const paused = makeRs({ schedule: { ...SCHEDULE, paused: true }, state: 'paused', episodes: [] });
    rerender(<ReleaseScheduleEditor rs={paused} />);
    expect(screen.getByTestId('release-schedule-start').textContent).toBe('Paused: no schedule dates until you resume it');
    expect(screen.getByTestId('release-schedule-sentence').textContent).toBe('Releases on YouTube every Sunday at 10:00 AM');
    fireEvent.click(screen.getByTestId('release-schedule-pause'));
    await waitFor(() => expect(paused.save).toHaveBeenCalledWith(expect.objectContaining({ paused: false })));
  });

  test('a refused save says why and keeps the form', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const rs = makeRs({ schedule: SCHEDULE, state: 'active', episodes: [] }, {
      save: vi.fn(async () => { const e = new Error('x'); e.response = { data: { error: 'time: "HH:MM", 24-hour.' } }; throw e; }),
    });
    render(<ReleaseScheduleEditor rs={rs} />);
    fireEvent.click(screen.getByTestId('release-schedule-edit'));
    fireEvent.change(screen.getByTestId('release-schedule-day'), { target: { value: 'mon' } });
    fireEvent.click(screen.getByTestId('release-schedule-save'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('time: "HH:MM", 24-hour.');
    expect(screen.getByTestId('release-schedule-form')).toBeTruthy();
  });
  // Two seasons (Evoni, 2026-10-25, before Season 2): each its own start.
  const TWO = [
    { season_number: 1, state: 'active', first_release: '2026-11-01', own_start: false, slots: {} },
    { season_number: 2, state: 'preview', first_release: null, own_start: false, slots: {} },
  ];
  test('two seasons: a start per season, saved under seasons; one season shows none', async () => {
    const rs = makeRs({ schedule: { ...SCHEDULE, seasons: {} }, state: 'active', seasons: TWO, episodes: [] });
    render(<ReleaseScheduleEditor rs={rs} />);
    expect(screen.getByTestId('release-schedule-seasons').textContent).toBe('Season 1: starts Sun, Nov 1Season 2: not releasing yet');
    fireEvent.click(screen.getByTestId('release-schedule-edit'));
    expect(screen.getByText('Season 1 starts releasing')).toBeTruthy();
    expect(screen.getByTestId('release-schedule-season-2').textContent).toContain('Not releasing yet: its dates are previews');
    expect(screen.getByTestId('release-schedule-season-note').textContent).toMatch(/Season 2 starts again at Episode 1/);
    fireEvent.change(screen.getByTestId('release-schedule-season-first-2'), { target: { value: '2027-03-01' } });
    expect(screen.getByTestId('release-schedule-season-2').textContent).toContain('Its Episode 1 goes out on the first Sunday from Mon, Mar 1.');
    fireEvent.click(screen.getByTestId('release-schedule-save'));
    await waitFor(() => expect(rs.save).toHaveBeenCalledWith(expect.objectContaining({ first_release: '2026-11-01', seasons: { 2: { first_release: '2027-03-01' } } })));
  });

  test("clearing a later season's start drops it (not releasing yet)", async () => {
    const rs = makeRs({ schedule: { ...SCHEDULE, seasons: { 2: { first_release: '2027-03-01' } } }, state: 'active', seasons: TWO, episodes: [] });
    render(<ReleaseScheduleEditor rs={rs} />);
    fireEvent.click(screen.getByTestId('release-schedule-edit'));
    expect(screen.getByTestId('release-schedule-season-first-2').value).toBe('2027-03-01');
    fireEvent.change(screen.getByTestId('release-schedule-season-first-2'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('release-schedule-save'));
    await waitFor(() => expect(rs.save).toHaveBeenCalledWith(expect.objectContaining({ seasons: {} })));
  });

  test('one season: no per-season field', () => {
    const rs = makeRs({ schedule: SCHEDULE, state: 'active', seasons: [TWO[0]], episodes: [] });
    render(<ReleaseScheduleEditor rs={rs} />);
    fireEvent.click(screen.getByTestId('release-schedule-edit'));
    expect(screen.getByText('Starts releasing')).toBeTruthy();
    expect(screen.queryByTestId('release-schedule-season-2')).toBeNull();
    expect(screen.queryByTestId('release-schedule-seasons')).toBeNull();
  });
});
