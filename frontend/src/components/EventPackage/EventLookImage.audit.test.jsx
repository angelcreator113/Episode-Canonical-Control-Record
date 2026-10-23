/**
 * EventLookImage — the refresh cap, a page refresh failing after a write,
 * the set chooser's Cancel and a change of event.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import EventLookImage, { REFRESH_FAILED_MESSAGE } from './EventLookImage';

const SET = { id: 'set-1', name: 'Glasshouse Hall', base_still_url: 'https://x/approved.jpg', generation_status: 'complete' };
const BRIEF = {
  version: 1, scene_set_id: 'set-1', event_id: 'ev-1', angle: 'WIDE', mode: 'event_dressing',
  lines: [{ layer: 'place', key: 'identity', label: 'Place', text: 'Glasshouse Hall.', source: 'venue', essential: true }],
  rules: [], missing: [], overrides: {},
};
const base = (eventId) => `/api/v1/world/show-1/events/${eventId}/look`;

let looks; // by event id
const ui = (props) => (
  <MemoryRouter>
    <EventLookImage showId="show-1" eventId="ev-1" pollMs={5} canGenerate {...props} />
  </MemoryRouter>
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  looks = {
    'ev-1': { scene_set: SET, approved_base: { scene_set_id: 'set-1', image_url: 'https://x/approved.jpg' }, look: null },
    'ev-2': { scene_set: SET, approved_base: null, look: { status: 'complete', image_url: 'https://x/ev2.jpg' } },
  };
  vi.mocked(api.get).mockImplementation(async (url) => {
    const id = Object.keys(looks).find((k) => url === base(k));
    return id ? { data: { success: true, data: looks[id] } } : { data: {} };
  });
  vi.mocked(api.post).mockImplementation(async (url) => {
    if (url === `${base('ev-1')}/brief`) return { data: { success: true, data: { step: 'look', scene_set: { id: 'set-1', name: 'Glasshouse Hall' }, brief: BRIEF, estimate: { usd: 0.04, priced: true } } } };
    if (url === `${base('ev-1')}/generate`) {
      looks['ev-1'] = { ...looks['ev-1'], look: { id: 'look-1', status: 'generating' } };
      return { data: { success: true, data: { step: 'look' } } };
    }
    return { data: {} };
  });
});

describe('EventLookImage audit fixes', () => {
  test('the refresh cap reached while the server still says generating: no endless spinner, "Still running" with Check again', async () => {
    looks['ev-1'] = { ...looks['ev-1'], look: { id: 'look-1', status: 'generating' } };
    render(ui({ pollMax: 3 }));
    expect(await screen.findByTestId('event-look-generating')).toBeTruthy();
    expect(await screen.findByTestId('event-look-timed-out')).toBeTruthy();
    expect(screen.queryByTestId('event-look-generating')).toBeNull();

    looks['ev-1'] = { ...looks['ev-1'], look: { id: 'look-1', status: 'complete', image_url: 'https://x/look.jpg' } };
    fireEvent.click(screen.getByTestId('event-look-check-again'));
    expect((await screen.findByTestId('event-look-thumb')).getAttribute('src')).toBe('https://x/look.jpg');
    expect(screen.queryByTestId('event-look-timed-out')).toBeNull();
  });

  test('a generate that succeeds while the page refresh fails reads as a refresh failure, never as a failed generate', async () => {
    const onToast = vi.fn();
    const onSaved = vi.fn().mockRejectedValue(new Error('reload failed'));
    render(ui({ onToast, onSaved }));
    fireEvent.click(await screen.findByTestId('generate-this-look'));
    await screen.findByTestId('scene-brief-confirm');
    fireEvent.click(screen.getByTestId('sbc-confirm'));
    expect(await screen.findByTestId('event-look-generating')).toBeTruthy();
    expect(onToast).toHaveBeenCalledWith(REFRESH_FAILED_MESSAGE, 'error');
    expect(onToast.mock.calls.some(([m]) => /Could not generate/.test(m))).toBe(false);
    expect(vi.mocked(api.post).mock.calls.filter(([u]) => u === `${base('ev-1')}/generate`)).toHaveLength(1);
  });

  test('an upload that succeeds while the page refresh fails says so, not "Could not upload"', async () => {
    const onToast = vi.fn();
    const onSaved = vi.fn().mockRejectedValue(new Error('reload failed'));
    render(ui({ onToast, onSaved }));
    const input = await screen.findByTestId('upload-this-look-input');
    fireEvent.change(input, { target: { files: [new File(['x'], 'look.png', { type: 'image/png' })] } });
    await waitFor(() => expect(onToast).toHaveBeenCalledWith(REFRESH_FAILED_MESSAGE, 'error'));
    expect(onToast.mock.calls.some(([m]) => /Could not upload/.test(m))).toBe(false);
  });

  test('the set chooser has Cancel: nothing chosen, and the waiting upload is dropped', async () => {
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === `${base('ev-1')}/upload`) {
        const err = new Error('choose'); err.response = { data: { code: 'CHOOSE_SET', options: [{ id: 'set-a', name: 'Hall A' }, { id: 'set-b', name: 'Hall B' }] } };
        throw err;
      }
      return { data: {} };
    });
    render(ui({}));
    const input = await screen.findByTestId('upload-this-look-input');
    fireEvent.change(input, { target: { files: [new File(['x'], 'look.png', { type: 'image/png' })] } });
    expect(await screen.findByTestId('event-look-choose')).toBeTruthy();
    fireEvent.click(screen.getByTestId('event-look-choose-cancel'));
    expect(screen.queryByTestId('event-look-choose')).toBeNull();

    // Generate after Cancel asks for the brief with no set carried over.
    vi.mocked(api.post).mockImplementation(async () => ({ data: { success: true, data: { step: 'awaiting_approval' } } }));
    fireEvent.click(screen.getByTestId('generate-this-look'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${base('ev-1')}/brief`, {}));
    expect(vi.mocked(api.post).mock.calls.filter(([u]) => u.endsWith('/upload'))).toHaveLength(1);
  });

  test('a new eventId starts fresh: the old event\'s state is not shown or announced on the new one', async () => {
    const onToast = vi.fn();
    looks['ev-1'] = { ...looks['ev-1'], look: { id: 'look-1', status: 'generating' } };
    const { rerender } = render(ui({ onToast }));
    expect(await screen.findByTestId('event-look-generating')).toBeTruthy();
    rerender(ui({ onToast, eventId: 'ev-2' }));
    expect((await screen.findByTestId('event-look-thumb')).getAttribute('src')).toBe('https://x/ev2.jpg');
    // ev-1's run "finishing" into ev-2's complete look would have toasted.
    expect(onToast).not.toHaveBeenCalledWith('The look is ready');
    expect(screen.queryByTestId('event-look-generating')).toBeNull();
  });
});
