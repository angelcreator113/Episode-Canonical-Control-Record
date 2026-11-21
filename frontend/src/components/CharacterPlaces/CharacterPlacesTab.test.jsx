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

  // The profile audit, 2026-10-19: the page's own appearances, not a second request.
  test('with the page\'s appearances given, the hosted events read from them', async () => {
    render(<MemoryRouter><CharacterPlacesTab character={sable} appearances={{ events: hosted }} /></MemoryRouter>);
    await screen.findByTestId('places-role-work');
    await waitFor(() => expect(screen.getByText('Wearable Experiments')).toBeTruthy());
    expect(api.get).not.toHaveBeenCalledWith('/api/v1/cast/characters/c-1/appearances');
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
    // A summary until asked for; an event's photos open on their own.
    expect((await screen.findByTestId('hosted-events-summary')).textContent).toBe('Wearable Experiments');
    expect(screen.queryByTestId('hosted-event-ev-1')).toBeNull();
    fireEvent.click(screen.getByTestId('hosted-events-toggle'));
    expect(screen.getByTestId('hosted-event-ev-1')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Wearable Experiments' }).getAttribute('href')).toBe('/shows/show-1/events/ev-1');
    expect(screen.queryByTestId('event-photos-ev-1')).toBeNull();
    fireEvent.click(screen.getByTestId('hosted-event-photos-toggle-ev-1'));
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
    expect((await screen.findByTestId('places-hosted-events')).textContent).toMatch(/needs a Pulse profile/);
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

  test('a set already one of their places is shown but not offered; an event another creator hosts is not offered; a brand\'s is co-hosted', async () => {
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
    expect(within(select).getByText('Launch (co-host with Maison Belle)').disabled).toBe(false);
    expect(within(select).getByText('Brunch (hosted by someone else)').disabled).toBe(true);
    expect(within(select).getByText('Gala').disabled).toBe(false);
    // 2026-10-17 ("something is wrong with the drop down"): it says why.
    expect(screen.getByTestId('hosted-event-note').textContent).toBe("1 more event is hosted by another creator, so it is listed but can't be chosen. A brand's event they co-host with the brand.");
  });

  test('when every event already has a host, it says so and what to do', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/cast/characters/c-1/places') return { data: { success: true, show_id: 'show-1', places } };
      if (url === '/api/v1/cast/characters/c-1/appearances') return { data: { success: true, events: [] } };
      if (url === '/api/v1/world/show-1/events') return { data: { success: true, events: [{ id: 'ev-5', name: 'Launch', source_profile_id: 99 }] } };
      return { data: {} };
    });
    renderIt();
    fireEvent.click(await screen.findByTestId('hosted-event-add'));
    expect((await screen.findByTestId('hosted-event-note')).textContent).toMatch(/^Every event already has a host \(1 hosted by another creator\)/);
  });

  // Evoni, 2026-10-17: "when I'm uploading a scene and then I'm uploading the
  // angles that go with this scene, it is being uploaded as a whole completely
  // different set ... when I'm trying to add angles to events, I'm not able to
  // upload any images".
  describe('photos and angles go into one set', () => {
    const file = (n) => new File(['x'], n, { type: 'image/jpeg' });
    const routeGets = (extra = {}) => vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/cast/characters/c-1/places') return { data: { success: true, show_id: 'show-1', places } };
      if (url === '/api/v1/cast/characters/c-1/appearances') return { data: { success: true, events: extra.events || [] } };
      if (url === '/api/v1/scene-sets/set-1') return { data: { success: true, data: { id: 'set-1', name: 'Studio', angles: [{ id: 'g1', angle_label: 'WIDE', angle_name: 'Wide', still_image_url: 'https://x/w.jpg' }] } } };
      if (url === '/api/v1/scene-sets/set-ev') return { data: { success: true, data: { id: 'set-ev', name: 'Gala photos', angles: [] } } };
      return { data: {} };
    });
    const posts = () => vi.mocked(api.post).mock.calls.map((c) => c[0]);
    // Views, descriptions and event photos are closed until asked for (2026-11-21).
    const openMore = async (role, setId) => {
      fireEvent.click(await screen.findByTestId(`place-more-${role}-${setId}`));
      return screen.findByTestId(`set-angles-${setId}`);
    };
    const openEvent = async (eventId) => {
      fireEvent.click(await screen.findByTestId('hosted-events-toggle'));
      fireEvent.click(screen.getByTestId(`hosted-event-photos-toggle-${eventId}`));
      return screen.findByTestId(`event-photos-angles-${eventId}`);
    };

    test('several photos make one set: the first its main photo, the others its angles', async () => {
      routeGets();
      vi.mocked(api.post).mockImplementation(async (url) => {
        if (url === '/api/v1/scene-sets') return { data: { success: true, data: { id: 'set-new' } } };
        if (url === '/api/v1/scene-sets/set-new/angles') return { data: { success: true, data: { id: `ang-${posts().length}` } } };
        return { data: { success: true } };
      });
      renderIt();
      await screen.findByTestId('places-role-home');
      fireEvent.change(screen.getByTestId('place-upload-input-home'), { target: { files: [file('room.jpg'), file('desk.jpg'), file('window.jpg')] } });
      await waitFor(() => expect(posts()).toContain('/api/v1/shows/show-1/character-places'));
      expect(posts().filter((u) => u === '/api/v1/scene-sets')).toHaveLength(1);
      expect(vi.mocked(api.post).mock.calls.find((c) => c[0] === '/api/v1/scene-sets/set-new/upload-base')[1].get('image').name).toBe('room.jpg');
      expect(posts().filter((u) => u === '/api/v1/scene-sets/set-new/angles')).toHaveLength(2);
      expect(posts().filter((u) => /\/scene-sets\/set-new\/angles\/ang-\d+\/upload$/.test(u))).toHaveLength(2);
      expect((await screen.findByTestId('places-note')).textContent).toMatch(/with 2 angles/);
    });

    test("a place's angles show, and Add angles adds to that same set", async () => {
      routeGets();
      vi.mocked(api.post).mockImplementation(async (url) => (url === '/api/v1/scene-sets/set-1/angles'
        ? { data: { success: true, data: { id: 'ang-9' } } } : { data: { success: true } }));
      renderIt();
      const grid = await openMore('work', 'set-1');
      expect(grid.textContent).toMatch(/Angles · 1/);
      fireEvent.change(screen.getByTestId('set-angles-input-set-1'), { target: { files: [file('mirror.jpg')] } });
      await waitFor(() => expect(posts()).toContain('/api/v1/scene-sets/set-1/angles/ang-9/upload'));
      expect(posts()).not.toContain('/api/v1/scene-sets');
    });

    test("a hosted event's photos are its place dressed for it: one set, linked as its event version", async () => {
      routeGets({ events: [{ id: 'ev-1', show_id: 'show-1', name: 'Gala', role: 'host', scene_set_id: 'set-1', scene_set_name: 'Studio', scene_set_version_of: null }] });
      vi.mocked(api.post).mockImplementation(async (url) => {
        if (url === '/api/v1/scene-sets') return { data: { success: true, data: { id: 'set-ev' } } };
        if (url === '/api/v1/scene-sets/set-ev/angles') return { data: { success: true, data: { id: 'ang-1' } } };
        return { data: { success: true } };
      });
      vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
      renderIt();
      expect((await openEvent('ev-1')).textContent).toMatch(/Studio dressed for this event/);
      fireEvent.change(screen.getByTestId('event-photos-input-ev-1'), { target: { files: [file('stage.jpg'), file('bar.jpg')] } });
      await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/scene-sets/set-ev/version', { everyday_set_id: 'set-1', event_id: 'ev-1' }));
      expect(vi.mocked(api.post).mock.calls[0]).toEqual(['/api/v1/scene-sets', { name: 'Gala photos', scene_type: 'EVENT_LOCATION', show_id: 'show-1' }]);
      expect(posts()).toContain('/api/v1/scene-sets/set-ev/angles/ang-1/upload');
    });

    // Sixth audit (2026-10-17).
    test('Add angles sends a free label; a photo that does not upload takes its empty angle with it; one note says both', async () => {
      routeGets();
      vi.mocked(api.post).mockImplementation(async (url) => {
        if (url === '/api/v1/scene-sets/set-1/angles') return { data: { success: true, data: { id: `ang-${posts().length}` } } };
        if (/ang-\d+\/upload$/.test(url) && vi.mocked(api.post).mock.calls.at(-1)[1].get('images').name === 'big.jpg') throw new Error('413');
        return { data: { success: true } };
      });
      vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
      renderIt();
      await openMore('work', 'set-1');
      fireEvent.change(screen.getByTestId('set-angles-input-set-1'), { target: { files: [file('wide.jpg'), file('big.jpg')] } });
      await waitFor(() => expect(api.delete).toHaveBeenCalledTimes(1));
      const labels = vi.mocked(api.post).mock.calls.filter((c) => c[0] === '/api/v1/scene-sets/set-1/angles').map((c) => c[1].angle_label);
      expect(labels[0]).toBe('WIDE_2');
      expect(api.delete.mock.calls[0][0]).toMatch(/^\/api\/v1\/scene-sets\/set-1\/angles\/ang-\d+$/);
      const note = (await screen.findByTestId('places-note')).textContent;
      expect(note).toMatch(/Added 1 angle to Studio; could not add big\.jpg/);
    });

    test('a photo over 10 MB is not sent', async () => {
      routeGets();
      renderIt();
      await openMore('work', 'set-1');
      const huge = file('huge.jpg');
      Object.defineProperty(huge, 'size', { value: 11 * 1024 * 1024 });
      fireEvent.change(screen.getByTestId('set-angles-input-set-1'), { target: { files: [huge] } });
      expect((await screen.findByTestId('places-note')).textContent).toMatch(/could not add huge\.jpg \(over 10 MB\)/i);
      expect(api.post).not.toHaveBeenCalled();
    });

    test("an event's place is linked before its photos go up: a refusal uploads nothing; a failed main photo undoes the link", async () => {
      routeGets({ events: [{ id: 'ev-1', show_id: 'show-1', name: 'Gala', role: 'host', scene_set_id: 'set-1', scene_set_name: 'Studio', scene_set_version_of: null }] });
      vi.mocked(api.post).mockImplementation(async (url) => (url === '/api/v1/scene-sets' ? { data: { success: true, data: { id: 'set-ev' } } } : { data: { success: true } }));
      vi.mocked(api.put).mockRejectedValueOnce({ response: { data: { error: "Its episode is accepted: the event's place is locked." } } });
      vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
      renderIt();
      await openEvent('ev-1');
      fireEvent.change(screen.getByTestId('event-photos-input-ev-1'), { target: { files: [file('stage.jpg')] } });
      expect((await screen.findByTestId('places-note')).textContent).toMatch(/place is locked/);
      expect(posts()).not.toContain('/api/v1/scene-sets/set-ev/upload-base');
      expect(api.delete).toHaveBeenCalledWith('/api/v1/scene-sets/set-ev');

      vi.mocked(api.put).mockReset().mockResolvedValue({ data: { success: true } });
      vi.mocked(api.post).mockImplementation(async (url) => {
        if (url === '/api/v1/scene-sets') return { data: { success: true, data: { id: 'set-ev2' } } };
        if (url.endsWith('/upload-base')) throw { response: { data: { error: 'not a readable image' } } };
        return { data: { success: true } };
      });
      fireEvent.change(screen.getByTestId('event-photos-input-ev-1'), { target: { files: [file('junk.jpg')] } });
      await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/scene-sets/set-ev2'));
      expect(vi.mocked(api.put).mock.calls.map((c) => c[1])).toEqual([
        { everyday_set_id: 'set-1', event_id: 'ev-1' }, { everyday_set_id: null, return_event: true },
      ]);
    });

    test("the lead's home that is also her closet: two cards, their own ids, angles added on one show on both", async () => {
      places = [
        { role: 'home', scene_set_id: 'set-1', scene_set_name: 'Studio', image_url: null },
        { role: 'closet', scene_set_id: 'set-1', scene_set_name: 'Studio', image_url: null },
      ];
      routeGets();
      vi.mocked(api.post).mockImplementation(async (url) => (url === '/api/v1/scene-sets/set-1/angles'
        ? { data: { success: true, data: { id: 'ang-1' } } } : { data: { success: true } }));
      renderIt();
      fireEvent.click(await screen.findByTestId('place-more-home-set-1'));
      fireEvent.click(screen.getByTestId('place-more-closet-set-1'));
      await waitFor(() => expect(screen.getAllByTestId('set-angles-set-1')).toHaveLength(2));
      expect(screen.getByTestId('place-describe-home-set-1')).toBeTruthy();
      expect(screen.getByTestId('place-describe-closet-set-1')).toBeTruthy();
      const reads = () => vi.mocked(api.get).mock.calls.filter((c) => c[0] === '/api/v1/scene-sets/set-1').length;
      const before = reads();
      fireEvent.change(screen.getAllByTestId('set-angles-input-set-1')[0], { target: { files: [file('mirror.jpg')] } });
      await waitFor(() => expect(reads()).toBeGreaterThanOrEqual(before + 2));
    });

    test("an event with its own photos shows them with Add angles; one held nowhere says where to choose its place", async () => {
      routeGets({ events: [
        { id: 'ev-1', show_id: 'show-1', name: 'Gala', role: 'host', scene_set_id: 'set-ev', scene_set_name: 'Gala photos', scene_set_version_of: 'set-1' },
        { id: 'ev-2', show_id: 'show-1', name: 'Brunch', role: 'host', scene_set_id: null },
      ] });
      renderIt();
      await openEvent('ev-1');
      fireEvent.click(screen.getByTestId('hosted-event-photos-toggle-ev-2'));
      expect(await screen.findByTestId('set-angles-set-ev')).toBeTruthy();
      expect(screen.queryByTestId('event-photos-upload-ev-1')).toBeNull();
      expect(screen.getByTestId('event-photos-no-place-ev-2').textContent).toMatch(/Choose where it is held/);
    });
  });
  // Evoni, 2026-11-21: Life & Locations. Each role is one compact row; what
  // is under a place opens when asked for; "Other places" is here too.
  describe('Life & Locations', () => {
    const empty = () => vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/cast/characters/c-1/places') return { data: { success: true, show_id: 'show-1', places } };
      if (url === '/api/v1/cast/characters/c-1/appearances') return { data: { success: true, events: [] } };
      // Every scene type is offered as another place: a café, a venue, a studio.
      if (url === '/api/v1/scene-sets') return { data: { success: true, data: [
        { id: 'set-1', name: 'Studio', scene_type: 'OTHER' }, { id: 'set-cafe', name: 'Café Lune', scene_type: 'EVENT_LOCATION' },
        { id: 'set-loft', name: 'Loft', scene_type: 'HOME_BASE' }, { id: 'set-park', name: 'Park', scene_type: 'TRANSITION' },
      ] } };
      return { data: {} };
    });

    test('every role is one row; an empty one says so beside its two buttons; nothing under a place is read until opened', async () => {
      empty();
      renderIt();
      const other = await screen.findByTestId('places-role-other');
      expect(within(other).getByText('No other places yet.')).toBeTruthy();
      expect(within(other).getByTestId('place-pick-other')).toBeTruthy();
      expect(within(other).getByTestId('place-upload-other')).toBeTruthy();
      expect(['home', 'closet', 'work', 'other'].map((r) => screen.getByTestId(`places-role-${r}`).querySelector('h3').textContent.trim()))
        .toEqual(['Home', 'Closet', 'Place of work', 'Other places']);
      expect((await screen.findByTestId('places-hosted-events')).textContent).toMatch(/They host no events yet\./);
      expect(screen.queryByTestId('hosted-events-toggle')).toBeNull();
      const more = screen.getByTestId('place-more-work-set-1');
      expect(more.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByTestId('set-angles-set-1')).toBeNull();
      expect(screen.queryByTestId('place-describe-work-set-1')).toBeNull();
      expect(api.get).not.toHaveBeenCalledWith('/api/v1/scene-sets/set-1');
      fireEvent.click(more);
      expect(more.getAttribute('aria-expanded')).toBe('true');
      expect(document.getElementById(more.getAttribute('aria-controls'))).toBeTruthy();
      expect(await screen.findByTestId('place-describe-work-set-1')).toBeTruthy();
    });

    test('another place: a set of any scene type, linked as role other with its name', async () => {
      empty();
      vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
      renderIt();
      fireEvent.click(await screen.findByTestId('place-pick-other'));
      const select = screen.getByTestId('place-pick-select-other');
      await waitFor(() => expect(within(select).getByText('Café Lune')).toBeTruthy());
      expect(within(select).getByText('Café Lune').disabled).toBe(false);
      expect(within(select).getByText('Loft').disabled).toBe(false);
      expect(within(select).getByText('Park').disabled).toBe(false);
      expect(within(select).getByText('Studio (their place of work)').disabled).toBe(true);
      const name = screen.getByTestId('place-name-other');
      expect(name.getAttribute('maxlength')).toBe('80');
      fireEvent.change(name, { target: { value: '  Morning café ' } });
      fireEvent.change(select, { target: { value: 'set-cafe' } });
      fireEvent.click(screen.getByTestId('place-pick-save-other'));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/shows/show-1/character-places',
        { character_id: 'c-1', scene_set_id: 'set-cafe', role: 'other', label: 'Morning café' }));
      expect((await screen.findByTestId('places-note')).textContent).toBe('Morning café added');
    });

    test('another place with no name sends none; no other role ever sends one', async () => {
      empty();
      vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
      renderIt();
      fireEvent.click(await screen.findByTestId('place-pick-other'));
      const select = screen.getByTestId('place-pick-select-other');
      await waitFor(() => expect(within(select).getByText('Park')).toBeTruthy());
      fireEvent.change(select, { target: { value: 'set-park' } });
      fireEvent.click(screen.getByTestId('place-pick-save-other'));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/shows/show-1/character-places', { character_id: 'c-1', scene_set_id: 'set-park', role: 'other' }));
      expect(screen.queryByTestId('place-name-home')).toBeNull();
      fireEvent.click(screen.getByTestId('place-pick-home'));
      expect(screen.queryByTestId('place-name-home')).toBeNull();
    });

    test('another place from photos: named first, one set made, linked as other with that name', async () => {
      empty();
      vi.mocked(api.post).mockImplementation(async (url) => (url === '/api/v1/scene-sets' ? { data: { success: true, data: { id: 'set-new' } } } : { data: { success: true } }));
      renderIt();
      fireEvent.click(await screen.findByTestId('place-upload-other'));
      fireEvent.change(screen.getByTestId('place-name-other'), { target: { value: 'Pottery studio' } });
      expect(screen.getByTestId('place-upload-choose-other')).toBeTruthy();
      fireEvent.change(screen.getByTestId('place-upload-input-other'), { target: { files: [new File(['img'], 'kiln.jpg', { type: 'image/jpeg' })] } });
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/shows/show-1/character-places',
        { character_id: 'c-1', scene_set_id: 'set-new', role: 'other', label: 'Pottery studio' }));
      expect(vi.mocked(api.post).mock.calls[0]).toEqual(['/api/v1/scene-sets', { name: "Sable Okonkwo-Reyes's Pottery studio", scene_type: 'OTHER', show_id: 'show-1' }]);
      expect((await screen.findByTestId('places-note')).textContent).toBe('Pottery studio made from your photos');
    });

    test('an other place linked before (from Scene Sets) shows with its name, or its set\'s when it has none, and can be unlinked', async () => {
      places = [
        { role: 'other', label: 'Rehearsal room', scene_set_id: 'set-7', scene_set_name: 'Warehouse B', image_url: 'https://x/w.jpg' },
        { role: 'other', label: null, scene_set_id: 'set-8', scene_set_name: 'Rooftop', image_url: null },
      ];
      empty();
      vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
      renderIt();
      const other = await screen.findByTestId('places-role-other');
      expect(within(other).getByTestId('place-label-set-7').textContent).toBe('Rehearsal room');
      expect(within(other).getByAltText('Rehearsal room: Warehouse B')).toBeTruthy();
      expect(within(other).getByText('Rooftop')).toBeTruthy();
      expect(within(other).queryByTestId('place-label-set-8')).toBeNull();
      expect(within(other).queryByText('No other places yet.')).toBeNull();
      // More than one, so another can still be added.
      expect(within(other).getByTestId('place-pick-other')).toBeTruthy();
      fireEvent.click(within(other).getByRole('button', { name: 'Unlink Warehouse B' }));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/shows/show-1/character-places/unlink', { character_id: 'c-1', scene_set_id: 'set-7', role: 'other' }));
    });

    test('Share to The Pulse is on the place it shares: only with a Pulse profile and a picture', async () => {
      places = [
        { role: 'home', scene_set_id: 'set-1', scene_set_name: 'Loft', image_url: 'https://x/l.jpg' },
        { role: 'closet', scene_set_id: 'set-2', scene_set_name: 'Closet', image_url: null },
      ];
      empty();
      vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
      renderIt();
      fireEvent.click(await screen.findByTestId('place-share-home-set-1'));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c-1/places/share', { scene_set_id: 'set-1' }));
      const note = await screen.findByTestId('places-note');
      expect(note.textContent).toBe("A draft of their home is waiting in The Pulse's Review. Open Review");
      expect(within(note).getByRole('link', { name: 'Open Review' }).getAttribute('href')).toBe('/admin?tab=pulse&sub=review');
      expect(screen.queryByTestId('place-share-closet-set-2')).toBeNull();
    });

    test('with no Pulse profile no place is shared, and the tab says why', async () => {
      places = [{ role: 'home', scene_set_id: 'set-1', scene_set_name: 'Loft', image_url: 'https://x/l.jpg' }];
      empty();
      renderIt({ ...sable, feed_profile_id: null });
      expect(await screen.findByText('Sharing a place on The Pulse needs a Pulse profile.')).toBeTruthy();
      expect(screen.queryByTestId('place-share-home-set-1')).toBeNull();
    });
  });
});
