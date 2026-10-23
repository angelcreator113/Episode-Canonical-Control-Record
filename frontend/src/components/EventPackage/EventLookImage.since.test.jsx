/**
 * EventLookImage — "Still running since 14:02" (Evoni, 2026-10-23): the
 * look's start is the server's (its generating row's updated_at); a base's
 * is recorded when this section's Confirm starts it, and kept in
 * sessionStorage by event so a reload keeps it.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import EventLookImage, { readRunStart } from './EventLookImage';
import { formatClockTime } from '../../utils/eventDate';

const SET = { id: 'set-1', name: 'Glasshouse Hall', base_still_url: null, generation_status: null };
const BRIEF = {
  version: 1, scene_set_id: 'set-1', event_id: 'ev-1', angle: 'WIDE', mode: 'base',
  lines: [{ layer: 'place', key: 'identity', label: 'Place', text: 'Glasshouse Hall.', source: 'venue', essential: true }],
  rules: [], missing: [], overrides: {},
};
const LOOK_URL = '/api/v1/world/show-1/events/ev-1/look';
let state;
const ui = (props) => (
  <MemoryRouter>
    <EventLookImage showId="show-1" eventId="ev-1" pollMs={5} canGenerate {...props} />
  </MemoryRouter>
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  window.sessionStorage.clear();
  state = { scene_set: SET, approved_base: null, look: null };
  vi.mocked(api.get).mockImplementation(async (url) => (url === LOOK_URL ? { data: { success: true, data: state } } : { data: {} }));
});

describe('EventLookImage: "Still running since …"', () => {
  test('a look past the refresh cap names the start the server gives (its generating row\'s updated_at), in local 24-hour time', async () => {
    const started = '2026-10-23T14:02:37.000Z';
    state = { ...state, look: { id: 'look-1', status: 'generating', updated_at: started } };
    render(ui({ pollMax: 2 }));
    const note = await screen.findByTestId('event-look-timed-out');
    const expected = formatClockTime(started);
    expect(expected).toMatch(/^\d\d:\d\d$/);
    expect(note.textContent).toContain(`Still running since ${expected}`);
    expect(screen.getByTestId('event-look-started').getAttribute('dateTime')).toBe(started);
  });

  test('a base started by Confirm: the start is recorded (sessionStorage), survives a remount, and is forgotten when the run ends', async () => {
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === `${LOOK_URL}/brief`) return { data: { success: true, data: { step: 'base', scene_set: { id: 'set-1', name: 'Glasshouse Hall' }, brief: BRIEF, estimate: { usd: 0.04, priced: true } } } };
      if (url === `${LOOK_URL}/generate`) {
        state = { ...state, scene_set: { ...SET, generation_status: 'generating' } };
        return { data: { success: true, data: { step: 'base' } } };
      }
      return { data: {} };
    });
    const before = Date.now();
    const { unmount } = render(ui({ pollMax: 2 }));
    fireEvent.click(await screen.findByTestId('generate-this-look'));
    await screen.findByTestId('scene-brief-confirm');
    fireEvent.click(screen.getByTestId('sbc-confirm'));
    const note = await screen.findByTestId('event-look-timed-out');
    const at = readRunStart('ev-1');
    expect(at).toBeGreaterThanOrEqual(before);
    expect(note.textContent).toContain(`Still running since ${formatClockTime(at)}`);
    unmount();

    // A reload: the server still says generating; the recorded start is read back.
    render(ui({ pollMax: 2 }));
    expect((await screen.findByTestId('event-look-timed-out')).textContent).toContain(`since ${formatClockTime(at)}`);

    state = { ...state, scene_set: { ...SET, base_still_url: 'https://x/base.jpg', generation_status: 'complete' } };
    fireEvent.click(screen.getByTestId('event-look-check-again'));
    await waitFor(() => expect(screen.queryByTestId('event-look-timed-out')).toBeNull());
    await waitFor(() => expect(readRunStart('ev-1')).toBeNull());
  });

  test('no start known (a base running before this tab saw it): the note names no time', async () => {
    state = { ...state, scene_set: { ...SET, generation_status: 'generating' } };
    render(ui({ pollMax: 2 }));
    const note = await screen.findByTestId('event-look-timed-out');
    expect(note.textContent).toMatch(/^Still running: this is taking longer than usual\./);
    expect(screen.queryByTestId('event-look-started')).toBeNull();
  });

  test('sessionStorage that throws: logged, and the note still shows', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    state = { ...state, scene_set: { ...SET, generation_status: 'generating' } };
    render(ui({ pollMax: 2 }));
    expect(await screen.findByTestId('event-look-timed-out')).toBeTruthy();
    expect(err.mock.calls.some(([m]) => /run start read failed/.test(String(m)))).toBe(true);
    spy.mockRestore();
    err.mockRestore();
  });
});
