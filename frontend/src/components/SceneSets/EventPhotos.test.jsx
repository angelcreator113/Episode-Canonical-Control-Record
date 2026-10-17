/**
 * Evoni, 2026-10-17: an event's look at a place, from another set's photos,
 * chosen on the event's card under the everyday look; "Stop using these
 * photos" brings the event back to the everyday place.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import { UsePhotosFromSet, EventPhotosSet } from './EventPhotos';

const set = { id: 'set-1', name: 'Studio', show_id: 'show-1' };
const event = { id: 'ev-1', name: 'Wearable Experiments' };

describe('EventPhotos', () => {
  beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));

  test('use photos from another set: the event takes that set as its look at this place', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { everyday_sets: [{ id: 'set-9', name: 'Studio, gala night' }], events: [] } } });
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    const onToast = vi.fn();
    const onSaved = vi.fn();
    render(<MemoryRouter><UsePhotosFromSet set={set} event={event} onToast={onToast} onSaved={onSaved} /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('event-photos-use-ev-1'));
    expect(vi.mocked(api.get).mock.calls[0][0]).toBe('/api/v1/scene-sets/set-1/version-options');
    fireEvent.change(await screen.findByTestId('event-photos-set-ev-1'), { target: { value: 'set-9' } });
    fireEvent.click(screen.getByTestId('event-photos-save-ev-1'));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(vi.mocked(api.put).mock.calls[0]).toEqual(['/api/v1/scene-sets/set-9/version', { everyday_set_id: 'set-1', event_id: 'ev-1' }]);
    expect(onToast).toHaveBeenCalledWith("Studio, gala night is now Wearable Experiments's photos");
  });

  test('a refused link says why and keeps the form open', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { everyday_sets: [{ id: 'set-9', name: 'Gala night' }] } } });
    vi.mocked(api.put).mockRejectedValue({ response: { data: { error: '"Gala night" is used by Brunch: an event version is for one event' } } });
    render(<MemoryRouter><UsePhotosFromSet set={set} event={event} /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('event-photos-use-ev-1'));
    fireEvent.change(await screen.findByTestId('event-photos-set-ev-1'), { target: { value: 'set-9' } });
    fireEvent.click(screen.getByTestId('event-photos-save-ev-1'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/used by Brunch/);
    expect(screen.getByTestId('event-photos-form-ev-1')).toBeTruthy();
  });

  test('stop using these photos brings the event back to the everyday place', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    const onToast = vi.fn();
    render(<MemoryRouter><EventPhotosSet photosSet={{ id: 'set-9', name: 'Gala night' }} showId="show-1" event={event} onToast={onToast} /></MemoryRouter>);
    expect(screen.getByTestId('event-photos-open-set-9').textContent).toBe('Gala night');
    fireEvent.click(screen.getByTestId('event-photos-stop-set-9'));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Wearable Experiments uses the everyday place again'));
    expect(vi.mocked(api.put).mock.calls[0]).toEqual(['/api/v1/scene-sets/set-9/version', { everyday_set_id: null, return_event: true }]);
  });

  test("on the event's own set it names the everyday place", () => {
    render(<MemoryRouter><EventPhotosSet photosSet={{ id: 'set-9', name: 'Gala night' }} showId="show-1" everyday={{ id: 'set-1', name: 'Studio' }} event={event} /></MemoryRouter>);
    expect(screen.getByTestId('event-photos-set-row-set-9').textContent).toMatch(/These are the photos for Wearable Experiments at Studio\./);
    expect(screen.getByTestId('event-photos-everyday-set-9').getAttribute('href')).toContain('set-1');
  });
});
