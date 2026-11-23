/**
 * Generation B1 (Evoni, 2026-11-23): a base that was generated and not saved
 * (the Place locked meanwhile, or the base was approved meanwhile) keeps the
 * status it had; its last error is newer than its last saved base. The look
 * panel does not call that "ready": it shows the recorded reason, as it does
 * for a failed base. A base that really finished still reads as ready.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import EventLookImage, { baseNotSaved } from './EventLookImage';

const BASE = '/api/v1/world/show-1/events/ev-1/look';
const SET = { id: 'set-1', name: 'Glasshouse Hall', base_still_url: 'https://x/old-base.jpg', generation_status: 'complete' };
const REASON = "This event's episode is accepted: its Place is locked The image was generated but it was not saved. Generating it again costs again.";
const NOT_SAVED = { ...SET, error: REASON, failed_at: '2026-11-23T10:05:00.000+00:00', generated_at: '2026-11-20T09:00:00.000Z' };

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

describe('baseNotSaved', () => {
  test('true when the last error is newer than the last saved base, and the set is neither generating nor failed', () => {
    expect(baseNotSaved(NOT_SAVED)).toBe(true);
    expect(baseNotSaved({ ...NOT_SAVED, generation_status: 'pending', generated_at: undefined })).toBe(true);
  });
  test('false for a base saved since, a set with no recorded error, and a set that is generating or failed', () => {
    expect(baseNotSaved({ ...NOT_SAVED, generated_at: '2026-11-23T10:06:00.000Z' })).toBe(false);
    expect(baseNotSaved(SET)).toBe(false);
    expect(baseNotSaved({ ...SET, error: REASON })).toBe(false);
    expect(baseNotSaved({ ...NOT_SAVED, generation_status: 'generating' })).toBe(false);
    expect(baseNotSaved({ ...NOT_SAVED, generation_status: 'failed' })).toBe(false);
    expect(baseNotSaved({ ...NOT_SAVED, failed_at: 'not a date' })).toBe(false);
    expect(baseNotSaved(null)).toBe(false);
  });
});

describe('EventLookImage: a base generated and not saved', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => (url === BASE ? { data: { success: true, data: lookState } } : { data: {} }));
  });

  test('a run that ends complete with a newer recorded error: the reason is shown and toasted, never "The base is ready"', async () => {
    lookState = { scene_set: { ...SET, generation_status: 'generating' }, approved_base: null, look: null };
    const { onToast } = renderIt();
    await screen.findByTestId('event-look-generating');
    lookState = { scene_set: NOT_SAVED, approved_base: null, look: null };
    expect((await screen.findByTestId('event-look-base-failed')).textContent).toBe(`The base could not be generated: ${REASON}.`);
    expect(onToast).toHaveBeenCalledWith(`The base could not be generated: ${REASON}`, 'error');
    expect(onToast).not.toHaveBeenCalledWith('The base is ready: approve it in Scene Sets');
  });

  test('a run that really finished: "The base is ready", and no error line', async () => {
    lookState = { scene_set: { ...SET, generation_status: 'generating' }, approved_base: null, look: null };
    const { onToast } = renderIt();
    await screen.findByTestId('event-look-generating');
    // An older recorded error, and a base generated after it.
    lookState = { scene_set: { ...NOT_SAVED, generated_at: '2026-11-23T10:06:00.000Z' }, approved_base: null, look: null };
    expect(await screen.findByTestId('event-look-awaiting')).toBeTruthy();
    expect(onToast).toHaveBeenCalledWith('The base is ready: approve it in Scene Sets');
    expect(screen.queryByTestId('event-look-base-failed')).toBeNull();
  });

  test('opened on a set whose last run was not saved: the reason is shown', async () => {
    lookState = { scene_set: { ...NOT_SAVED, base_still_url: null, generation_status: 'pending', generated_at: undefined }, approved_base: null, look: null };
    renderIt();
    expect((await screen.findByTestId('event-look-base-failed')).textContent).toBe(`The base could not be generated: ${REASON}.`);
  });
});

// Generation B2: the look read now sends these fields (venueLookImageService
// eventLook): error for a failed base or one generated and not saved,
// not_saved, failed_at, and generated_at as the base's last save (generated
// or uploaded).
describe('EventLookImage with the look read as B2 sends it', () => {
  const FAILED_AT = '2026-11-23T10:05:00.000Z';
  const sent = (fields) => ({ id: 'set-1', name: 'Glasshouse Hall', base_still_url: null, generation_status: 'pending', error: null, not_saved: false, failed_at: null, generated_at: null, ...fields });
  const read = (set) => ({ scene_set: set, approved_base: null, look: null, venue_changed: false, editable: true });
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => (url === BASE ? { data: { success: true, data: lookState } } : { data: {} }));
  });

  test('a base generated and not saved: the recorded reason is shown, and toasted when the run ends; never "The base is ready"', async () => {
    lookState = read(sent({ generation_status: 'generating' }));
    const { onToast } = renderIt();
    await screen.findByTestId('event-look-generating');
    lookState = read(sent({ error: REASON, not_saved: true, failed_at: FAILED_AT }));
    expect((await screen.findByTestId('event-look-base-failed')).textContent).toBe(`The base could not be generated: ${REASON}.`);
    expect(onToast).toHaveBeenCalledWith(`The base could not be generated: ${REASON}`, 'error');
    expect(onToast).not.toHaveBeenCalledWith('The base is ready: approve it in Scene Sets');
  });

  test('a base uploaded (or generated) after an older not-saved run: the read clears it, and the panel shows the base waiting, with no error line', async () => {
    lookState = read(sent({ error: REASON, not_saved: true, failed_at: FAILED_AT }));
    const view = renderIt();
    await screen.findByTestId('event-look-base-failed');
    view.unmount?.();
    // What the read sends after the upload: failed_at still on record, older than the last save; no error.
    lookState = read(sent({ base_still_url: 'https://x/uploaded.jpg', generation_status: 'complete', failed_at: FAILED_AT, generated_at: '2026-11-23T11:00:00.000Z' }));
    renderIt();
    expect((await screen.findAllByTestId('event-look-awaiting')).length).toBeGreaterThan(0);
    expect(baseNotSaved(lookState.scene_set)).toBe(false);
  });

  test('a failed base is as before; a base never refused shows no error line', async () => {
    lookState = read(sent({ generation_status: 'failed', error: 'Timed out: no image after 15 minutes', failed_at: FAILED_AT }));
    renderIt();
    expect((await screen.findByTestId('event-look-base-failed')).textContent).toBe('The base could not be generated: Timed out: no image after 15 minutes.');
    expect(baseNotSaved(lookState.scene_set)).toBe(false);
    expect(baseNotSaved(sent({ base_still_url: 'https://x/b.jpg', generation_status: 'complete', generated_at: '2026-11-23T09:00:00.000Z' }))).toBe(false);
  });
});
