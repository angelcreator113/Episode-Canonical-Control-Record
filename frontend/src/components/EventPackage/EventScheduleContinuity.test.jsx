/**
 * Schedule & continuity in the Event Package (continuity PR 1; Evoni,
 * 2026-11-13): warnings only, three optional values saved through the event
 * PUT, and no attendance controls yet.
 */
import { vi, describe, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EventScheduleContinuity from './EventScheduleContinuity';
import EventFieldHints from './EventFieldHints';

const SCHEDULE = { day: '2026-03-14', start_time: '19:00', end_time: '22:00', end_day: '2026-03-14', ends_another_day: false, end_suggested: false, offset_minutes: 0, offset_set: false, provisional: false, verifiable: true, problems: [] };
const ECHO = { venue_id: 'v1', city: 'Echo Park', dream: true };
const part = (over = {}) => ({ schedule: SCHEDULE, conflicts: [], unchecked: 0, lines: [], place: ECHO, ...over });
const conflict = (over = {}) => ({
  person: { key: 'profile:7', id: 7, name: 'Ama Velour', role: 'host', other_role: 'host' },
  other: { id: 'ev-2', name: 'Second Hosting', day: '2026-03-14', start_time: '20:00', end_time: '21:00', end_day: '2026-03-14' },
  kind: 'overlap', severity: 'host', minutes: 60, provisional: false,
  text: 'Ama Velour is hosting Second Hosting (20:00–21:00) at the same time: 1 h overlap.', ...over,
});

function renderIt({ schedule = part(), event = { id: 'ev-1', canon_consequences: { automation: { guest_profiles: [{ profile_id: 3 }] } } }, used = false, putEvent = vi.fn(async () => ({})) } = {}) {
  const load = vi.fn(async () => {});
  const setToast = vi.fn();
  render(<MemoryRouter><EventScheduleContinuity showId="show-1" flow={schedule ? { schedule } : {}} event={event} used={used} putEvent={putEvent} load={load} setToast={setToast} /></MemoryRouter>);
  return { putEvent, load, setToast };
}

describe('Schedule & continuity', () => {
  test('a server that does not send a schedule: nothing is shown', () => {
    renderIt({ schedule: null });
    expect(screen.queryByTestId('schedule-continuity')).toBeNull();
  });

  test('a clean event: when it runs, and one line that no one is in two places', () => {
    renderIt();
    expect(screen.getByTestId('schedule-when').textContent).toBe('Sat, Mar 14 · 19:00 – 22:00');
    expect(screen.getByTestId('schedule-clear').textContent).toBe('No one at this event is in two places.');
    expect(screen.queryByTestId('schedule-conflicts')).toBeNull();
  });

  test('conflicts: each with its chip, the server\'s words and a link to the other event; hosts are marked apart from guests', () => {
    renderIt({ schedule: part({ conflicts: [
      conflict(),
      conflict({ person: { key: 'lala', id: null, name: 'Lala', role: 'lala', level: 'committed', other_level: 'invited' }, severity: 'lala', text: 'Lala is invited to Second Hosting (20:00–21:00) at the same time: 1 h overlap.' }),
      conflict({ person: { key: 'profile:3', id: 3, name: 'Nia Cole', role: 'guest', other_role: 'guest' }, severity: 'guest', kind: 'travel', other: { id: 'ev-3', name: 'Late Dinner' }, text: 'Nia Cole is at Late Dinner (22:30–00:30) with 30 min between them; getting there is taken as 45 min.' }),
      conflict({ person: { key: 'profile:4', id: 4, name: 'Kofi', role: 'guest', other_role: 'guest' }, severity: 'guest', kind: 'unverified', other: { id: 'ev-4', name: 'Somewhere' }, text: 'Kofi is also at Somewhere around then, and a time could not be read, so an overlap cannot be ruled out.' }),
    ] }) });
    const rows = within(screen.getByTestId('schedule-conflicts')).getAllByRole('listitem');
    expect(rows.map((r) => r.querySelector('.esc-chip').textContent)).toEqual(['Host conflict', 'Lala', 'Guest', "Can't verify"]);
    expect(rows[0].textContent).toContain('Ama Velour is hosting Second Hosting (20:00–21:00) at the same time: 1 h overlap.');
    expect(within(rows[0]).getByRole('link', { name: 'Open Second Hosting' }).getAttribute('href')).toBe('/shows/show-1/events/ev-2');
    expect(rows[2].textContent).toContain('getting there is taken as 45 min');
    expect(screen.queryByTestId('schedule-clear')).toBeNull();
  });

  test('conflicts that depend on a suggested date are counted in one line, not listed', () => {
    renderIt({ schedule: part({ schedule: { ...SCHEDULE, provisional: true }, conflicts: [conflict({ provisional: true }), conflict({ provisional: true, other: { id: 'ev-9', name: 'Pop-up' } })] }) });
    expect(screen.getByTestId('schedule-provisional').textContent).toBe('suggested date');
    expect(screen.getByTestId('schedule-provisional-count').textContent).toBe('2 possible overlaps depend on a suggested date: Second Hosting, Pop-up.');
    expect(screen.queryByTestId('schedule-conflicts')).toBeNull();
  });

  test('what could not be read is said, and it is never called clear', () => {
    renderIt({ schedule: part({
      schedule: { ...SCHEDULE, start_time: null, end_time: null, verifiable: false, problems: [{ code: 'time_unreadable', field: 'time', text: 'Its start time "9 PM" is not a 24-hour time, so its timing cannot be checked.' }] },
      lines: [{ kind: 'verify', field: 'date', text: 'Its start time "9 PM" is not a 24-hour time, so its timing cannot be checked.' }],
      unchecked: 2,
    }) });
    expect(screen.getByTestId('schedule-when').textContent).toBe('When it runs is not known yet.');
    expect(screen.getByTestId('schedule-verify').textContent).toContain('is not a 24-hour time');
    expect(screen.getByTestId('schedule-unchecked').textContent).toContain('2 other events share someone with this one but have no readable date');
    expect(screen.queryByTestId('schedule-clear')).toBeNull();
  });

  test('no end time yet: the three-hour end is offered as a suggestion, and one tap saves only that', async () => {
    const { putEvent, load } = renderIt({ schedule: part({ schedule: { ...SCHEDULE, end_suggested: true } }) });
    expect(screen.getByTestId('schedule-suggested').textContent).toBe('suggested end');
    fireEvent.click(screen.getByTestId('schedule-use-suggested'));
    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(putEvent.mock.calls).toEqual([[{ canon_consequences: { automation: { event_end_time: '22:00' } } }]]);
  });

  test('editing: an end time and an optional end date are saved into automation; an empty one is removed; no offset is asked in a DREAM city', async () => {
    const { putEvent } = renderIt({ event: { id: 'ev-1', canon_consequences: { automation: { event_end_time: '22:00' } } } });
    fireEvent.click(screen.getByTestId('schedule-edit'));
    expect(screen.getByTestId('schedule-end-time').value).toBe('22:00');
    expect(screen.queryByTestId('schedule-offset-hours')).toBeNull();
    fireEvent.change(screen.getByTestId('schedule-end-time'), { target: { value: '16:00' } });
    fireEvent.change(screen.getByTestId('schedule-end-date'), { target: { value: '2026-03-17' } });
    fireEvent.click(screen.getByTestId('schedule-save'));
    await waitFor(() => expect(putEvent).toHaveBeenCalledTimes(1));
    expect(putEvent.mock.calls[0][0]).toEqual({ canon_consequences: { automation: { event_end_time: '16:00', event_end_date: '2026-03-17' } } });
  });

  test('a venue outside the DREAM cities: the missing offset is said, and it is saved in minutes', async () => {
    const { putEvent, setToast } = renderIt({ schedule: part({ place: { venue_id: 'v9', city: 'Paris', dream: false } }) });
    expect(screen.getByTestId('schedule-offset-missing').textContent).toContain('Paris is outside the DREAM cities and no time offset is saved');
    fireEvent.click(screen.getByTestId('schedule-edit'));
    fireEvent.change(screen.getByTestId('schedule-offset-hours'), { target: { value: '20' } });
    fireEvent.click(screen.getByTestId('schedule-save'));
    expect(setToast).toHaveBeenCalledWith('The offset is a number of hours between −12 and 14');
    expect(putEvent).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('schedule-offset-hours'), { target: { value: '5.5' } });
    fireEvent.click(screen.getByTestId('schedule-save'));
    await waitFor(() => expect(putEvent).toHaveBeenCalledTimes(1));
    expect(putEvent.mock.calls[0][0]).toEqual({ canon_consequences: { automation: { event_end_time: null, event_end_date: null, utc_offset_minutes: 330 } } });
  });

  test('an event that started its episode is read-only here, as its other basics are', () => {
    renderIt({ used: true, schedule: part({ schedule: { ...SCHEDULE, end_suggested: true } }) });
    expect(screen.queryByTestId('schedule-edit')).toBeNull();
    expect(screen.queryByTestId('schedule-use-suggested')).toBeNull();
  });

  test('it offers no attendance controls, approvals or blocks', () => {
    renderIt({ schedule: part({ conflicts: [conflict()] }) });
    const block = screen.getByTestId('schedule-continuity');
    expect(within(block).queryAllByRole('button').map((b) => b.textContent.trim())).toEqual(['End time']);
    expect(block.textContent).not.toMatch(/approve|invited|confirmed|declined|cancelled/i);
  });

  test('a failed save says why and leaves the form open', async () => {
    const putEvent = vi.fn(async () => { throw Object.assign(new Error('nope'), { response: { data: { error: 'The event could not be saved.' } } }); });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { setToast } = renderIt({ putEvent });
    fireEvent.click(screen.getByTestId('schedule-edit'));
    fireEvent.change(screen.getByTestId('schedule-end-time'), { target: { value: '23:00' } });
    fireEvent.click(screen.getByTestId('schedule-save'));
    await waitFor(() => expect(setToast).toHaveBeenCalledWith('The event could not be saved.'));
    expect(screen.getByTestId('schedule-form')).toBeTruthy();
  });
});

describe('the field hints beside the date and the guests', () => {
  const clashes = { lines: [{ kind: 'day', field: 'date', text: 'Gallery Late is on the same day.' }, { kind: 'guest', field: 'guests', text: 'Nia Cole is also at Gallery Late that day.' }] };
  const hints = (flow, fields) => render(<EventFieldHints flow={flow} fields={fields} used={false} putEvent={vi.fn()} load={vi.fn()} setToast={vi.fn()} />);

  test('without a schedule from the server, the same-day warnings show as before', () => {
    hints({ clashes, defaults: [] }, ['guests']);
    expect(screen.getByTestId('clash-guest').textContent).toContain('Nia Cole is also at Gallery Late that day.');
  });

  test('with one, the date-only warnings are not repeated: the schedule block says who is in two places', () => {
    hints({ clashes, defaults: [], schedule: part() }, ['guests']);
    expect(screen.queryByTestId('clash-guest')).toBeNull();
  });
});
