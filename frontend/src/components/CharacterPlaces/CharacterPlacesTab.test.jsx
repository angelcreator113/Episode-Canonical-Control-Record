/**
 * Evoni, 2026-10-17: a Places tab on a character's profile: their home,
 * closet and place of work as scene sets (picked, or made from uploaded
 * photos), and the events they host with each event's photos.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../EventPackage/EventLookImage', () => ({ default: ({ eventId }) => <div data-testid={`event-photos-${eventId}`} /> }));

import api from '../../services/api';
import CharacterPlacesTab from './CharacterPlacesTab';

const sable = { id: 'c-1', display_name: 'Sable Okonkwo-Reyes', feed_profile_id: 7 };
let places;
let hosted;
const renderIt = (character = sable) => render(<MemoryRouter><CharacterPlacesTab character={character} /></MemoryRouter>);

describe('CharacterPlacesTab', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    places = [{ role: 'work', scene_set_id: 'set-1', scene_set_name: "STUDIO BY SABLE's Studio", image_url: 'https://x/studio.jpg', everyday: true }];
    hosted = [{ id: 'ev-1', show_id: 'show-1', name: 'Wearable Experiments', role: 'host', event_date: '2026-11-02' }, { id: 'ev-2', show_id: 'show-1', name: 'Brunch', role: 'guest' }];
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/cast/characters/c-1/places') return { data: { success: true, show_id: 'show-1', places } };
      if (url === '/api/v1/cast/characters/c-1/appearances') return { data: { success: true, events: hosted } };
      if (url === '/api/v1/scene-sets') return { data: { success: true, data: [{ id: 'set-2', name: 'Loft' }] } };
      if (url === '/api/v1/world/show-1/events') return { data: { success: true, events: [{ id: 'ev-1', name: 'Wearable Experiments' }, { id: 'ev-3', name: 'Gala' }] } };
      return { data: {} };
    });
  });

  test('home, closet and place of work, the venue set linked as the place of work', async () => {
    renderIt();
    const work = await screen.findByTestId('places-role-work');
    expect(within(work).getByText("STUDIO BY SABLE's Studio")).toBeTruthy();
    expect(within(work).getByText('Everyday look')).toBeTruthy();
    expect(within(screen.getByTestId('places-role-home')).getByText('No home yet.')).toBeTruthy();
    expect(screen.getByTestId('places-role-closet')).toBeTruthy();
  });

  test('pick a set links it in its role', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    renderIt();
    fireEvent.click(await screen.findByTestId('place-pick-home'));
    const select = screen.getByTestId('place-pick-select-home');
    await waitFor(() => expect(within(select).getByText('Loft')).toBeTruthy());
    fireEvent.change(select, { target: { value: 'set-2' } });
    fireEvent.click(screen.getByTestId('place-pick-save-home'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/shows/show-1/character-places', { character_id: 'c-1', scene_set_id: 'set-2', role: 'home' }));
  });

  test('upload photos makes a scene set from the photo and links it', async () => {
    vi.mocked(api.post).mockImplementation(async (url) => (url === '/api/v1/scene-sets' ? { data: { success: true, data: { id: 'set-new' } } } : { data: { success: true } }));
    renderIt();
    await screen.findByTestId('places-role-closet');
    const file = new File(['img'], 'closet.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('place-upload-input-closet'), { target: { files: [file] } });
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/shows/show-1/character-places', { character_id: 'c-1', scene_set_id: 'set-new', role: 'closet' }));
    expect(vi.mocked(api.post).mock.calls[0]).toEqual(['/api/v1/scene-sets', { name: "Sable Okonkwo-Reyes's Closet", scene_type: 'CLOSET', show_id: 'show-1' }]);
    expect(vi.mocked(api.post).mock.calls[1][0]).toBe('/api/v1/scene-sets/set-new/upload-base');
  });

  test('hosted events only, each with its photos; add one, or stop hosting', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    renderIt();
    expect(await screen.findByTestId('hosted-event-ev-1')).toBeTruthy();
    expect(screen.getByTestId('event-photos-ev-1')).toBeTruthy();
    expect(screen.queryByTestId('hosted-event-ev-2')).toBeNull();

    fireEvent.click(screen.getByTestId('hosted-event-add'));
    const select = screen.getByTestId('hosted-event-select');
    await waitFor(() => expect(within(select).getByText('Gala')).toBeTruthy());
    expect(within(select).queryByText('Wearable Experiments')).toBeNull();
    fireEvent.change(select, { target: { value: 'ev-3' } });
    fireEvent.click(screen.getByTestId('hosted-event-add-save'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c-1/hosted-events', { event_id: 'ev-3' }));

    fireEvent.click(screen.getByTestId('hosted-event-stop-ev-1'));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/cast/characters/c-1/hosted-events/ev-1'));
  });

  test('without a feed profile, hosting says what it needs', async () => {
    renderIt({ ...sable, feed_profile_id: null });
    expect((await screen.findByTestId('places-hosted-events')).textContent).toMatch(/needs a feed profile/);
  });

  // Fifth audit.
  test('a failed photo upload deletes the set it made', async () => {
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === '/api/v1/scene-sets') return { data: { success: true, data: { id: 'set-new' } } };
      if (url.endsWith('/upload-base')) throw { response: { data: { error: 'not a readable image' } } };
      return { data: { success: true } };
    });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    renderIt();
    await screen.findByTestId('places-role-home');
    fireEvent.change(screen.getByTestId('place-upload-input-home'), { target: { files: [new File(['x'], 'h.heic', { type: 'image/heic' })] } });
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/scene-sets/set-new'));
    expect((await screen.findByTestId('places-note')).textContent).toMatch(/not a readable image/);
    expect(vi.mocked(api.post).mock.calls.map((c) => c[0])).not.toContain('/api/v1/shows/show-1/character-places');
  });

  test('a set already one of their places is shown but not offered; an event another host has is not offered', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/cast/characters/c-1/places') return { data: { success: true, show_id: 'show-1', places } };
      if (url === '/api/v1/cast/characters/c-1/appearances') return { data: { success: true, events: [] } };
      if (url === '/api/v1/scene-sets') return { data: { success: true, data: [{ id: 'set-1', name: 'Studio' }, { id: 'set-2', name: 'Loft' }] } };
      if (url === '/api/v1/world/show-1/events') return { data: { success: true, events: [{ id: 'ev-5', name: 'Launch', host_brand: 'Maison Belle' }, { id: 'ev-6', name: 'Brunch', source_profile_id: 99 }, { id: 'ev-7', name: 'Gala' }] } };
      return { data: {} };
    });
    renderIt();
    fireEvent.click(await screen.findByTestId('place-pick-home'));
    const studio = await within(screen.getByTestId('place-pick-select-home')).findByText(/Studio/);
    expect(studio.textContent).toBe('Studio (their place of work)');
    expect(studio.disabled).toBe(true);
    fireEvent.click(await screen.findByTestId('hosted-event-add'));
    const select = screen.getByTestId('hosted-event-select');
    await waitFor(() => expect(within(select).getByText(/Launch/)).toBeTruthy());
    expect(within(select).getByText('Launch (hosted by Maison Belle)').disabled).toBe(true);
    expect(within(select).getByText('Brunch (hosted by someone else)').disabled).toBe(true);
    expect(within(select).getByText('Gala').disabled).toBe(false);
  });
});
