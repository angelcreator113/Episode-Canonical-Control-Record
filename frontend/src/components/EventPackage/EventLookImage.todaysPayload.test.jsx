/**
 * Generation B1, D3 (Evoni, 2026-11-23): "Ensure B1 does not introduce a
 * regression into the current Event look panel."
 *
 * The look read today sends scene_set as { id, name, base_still_url,
 * generation_status, error }, with `error` only when the set is failed, and
 * no failed_at or generated_at (that read is B2's). With that payload the
 * panel renders what it rendered before B1, for a base generating, failed
 * with its reason, complete, and absent. This file imports nothing B1 added,
 * so it runs the same against the component as it was before B1.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import EventLookImage from './EventLookImage';

const BASE = '/api/v1/world/show-1/events/ev-1/look';
// Exactly the fields venueLookImageService.eventLook sends for the set.
const set = (fields) => ({ id: 'set-1', name: 'Glasshouse Hall', base_still_url: null, generation_status: 'pending', error: null, ...fields });
const payload = (sceneSet) => ({ scene_set: sceneSet, approved_base: null, look: null, venue_changed: false, editable: true });

let lookState;
const renderIt = () => {
  const onToast = vi.fn();
  render(
    <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
      <EventLookImage showId="show-1" eventId="ev-1" onToast={onToast} onSaved={vi.fn()} pollMs={5} canGenerate />
    </MemoryRouter>,
  );
  return { onToast };
};
const shown = (id) => screen.queryByTestId(id);

describe("EventLookImage with today's look read", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => (url === BASE ? { data: { success: true, data: lookState } } : { data: {} }));
  });

  test('a base generating: "Generating", no error line', async () => {
    lookState = payload(set({ generation_status: 'generating' }));
    renderIt();
    expect(await screen.findByTestId('event-look-generating')).toBeTruthy();
    expect(shown('event-look-base-failed')).toBeNull();
    expect(shown('event-look-awaiting')).toBeNull();
  });

  test('a base failed with its reason: the reason, on opening and as a toast when a run ends', async () => {
    lookState = payload(set({ generation_status: 'failed', error: 'Timed out: no image after 10 minutes' }));
    renderIt();
    expect((await screen.findByTestId('event-look-base-failed')).textContent).toBe('The base could not be generated: Timed out: no image after 10 minutes.');
    expect(shown('event-look-generating')).toBeNull();
  });

  test('a run that ends failed, and a failed base with no reason', async () => {
    lookState = payload(set({ generation_status: 'generating' }));
    const { onToast } = renderIt();
    await screen.findByTestId('event-look-generating');
    lookState = payload(set({ generation_status: 'failed' }));
    expect((await screen.findByTestId('event-look-base-failed')).textContent).toBe('The base could not be generated.');
    expect(onToast).toHaveBeenCalledWith('The base could not be generated', 'error');
    expect(onToast).not.toHaveBeenCalledWith('The base is ready: approve it in Scene Sets');
  });

  test('a base complete: it waits for approval, with no error line; a run that ends complete says it is ready', async () => {
    lookState = payload(set({ generation_status: 'generating' }));
    const { onToast } = renderIt();
    await screen.findByTestId('event-look-generating');
    lookState = payload(set({ base_still_url: 'https://x/base.jpg', generation_status: 'complete' }));
    expect(await screen.findByTestId('event-look-awaiting')).toBeTruthy();
    expect(shown('event-look-base-failed')).toBeNull();
    expect(shown('event-look-generating')).toBeNull();
    expect(onToast).toHaveBeenCalledWith('The base is ready: approve it in Scene Sets');
    expect(onToast).toHaveBeenCalledTimes(1);
  });

  test('a complete set that carries an error text but no failed_at (nothing today sends one): still no error line', async () => {
    lookState = payload(set({ base_still_url: 'https://x/base.jpg', generation_status: 'complete', error: 'an old reason' }));
    renderIt();
    expect(await screen.findByTestId('event-look-awaiting')).toBeTruthy();
    expect(shown('event-look-base-failed')).toBeNull();
  });

  test('no base, and no set at all: no status line, no error line', async () => {
    lookState = payload(set({}));
    const first = renderIt();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(BASE));
    await screen.findByTestId('event-look-image');
    for (const id of ['event-look-base-failed', 'event-look-generating', 'event-look-awaiting', 'event-look-failed', 'event-look-load-failed']) expect(shown(id)).toBeNull();
    expect(first.onToast).not.toHaveBeenCalled();
  });

  test('no set at all', async () => {
    lookState = { scene_set: null, look: null, approved_base: null, editable: true };
    const { onToast } = renderIt();
    await screen.findByTestId('event-look-image');
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(BASE));
    for (const id of ['event-look-base-failed', 'event-look-generating', 'event-look-awaiting', 'event-look-failed']) expect(shown(id)).toBeNull();
    expect(onToast).not.toHaveBeenCalled();
  });
});
