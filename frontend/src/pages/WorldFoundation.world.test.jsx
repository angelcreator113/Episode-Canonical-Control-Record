/**
 * The World tab after the per-tab fix (2026-10-04): two sub-tabs (The Map,
 * Locations); the Loop, how the world's layers connect, is a fold-out intro
 * above the map instead of a third tab of explanatory text, and a ?sub=loop
 * link lands on the map; the Locations tab is the doorway to the Property
 * Manager, which had none.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(async () => ({ data: { data: {}, locations: [], events: [] } })), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import WorldFoundation from './WorldFoundation';

const renderAt = (url) => render(<MemoryRouter initialEntries={[url]}><WorldFoundation embedded /></MemoryRouter>);

beforeEach(() => { window.localStorage.clear(); });

describe('World tab', () => {
  test('two sub-tabs; the Loop is a fold-out above the map, closed until opened', async () => {
    window.history.pushState({}, '', '/universe?tab=world');
    renderAt('/universe?tab=world');
    expect(screen.getByText('The Map')).toBeTruthy();
    expect(screen.getByText('Locations')).toBeTruthy();
    expect(screen.queryByText('The Loop')).toBeNull();
    const loop = screen.getByTestId('world-loop');
    expect(loop.tagName).toBe('DETAILS');
    expect(loop.open).toBe(false);
    expect(loop.textContent).toContain('How the world connects: the Loop');
    expect(loop.textContent).toContain('THE LOOP');
    fireEvent.click(screen.getByText('How the world connects: the Loop'));
    expect(loop.open).toBe(true);
  });

  test('in the hub the illustrated map is the city picker; not the old city, school and company cards', () => {
    window.history.pushState({}, '', '/universe?tab=world');
    renderAt('/universe?tab=world');
    const explorer = screen.getByTestId('dream-city-explorer');
    // One map: the illustrated map is the explorer's picker, no drawn bubbles above it.
    expect(explorer.querySelector('[data-zone="dazzle_district"]')).toBeTruthy();
    expect(explorer.querySelector('.dce-bubble')).toBeNull();
    expect(screen.getAllByText('Edit Positions')).toHaveLength(1);
    expect(screen.queryByText('DREAM CITIES')).toBeNull();
    expect(screen.queryByText('UNIVERSITIES')).toBeNull();
    expect(screen.queryByText('CORPORATIONS')).toBeNull();
    expect(screen.getByText('Upload Map Image')).toBeTruthy();
  });

  test('a ?sub=loop link lands on the map', () => {
    window.history.pushState({}, '', '/universe?tab=world&sub=loop');
    renderAt('/universe?tab=world&sub=loop');
    expect(screen.getByTestId('world-loop')).toBeTruthy();
    expect(screen.queryByText('Search locations...')).toBeNull();
  });

  test('the Locations tab is the doorway to the Property Manager', () => {
    window.history.pushState({}, '', '/universe?tab=world&sub=locations');
    renderAt('/universe?tab=world&sub=locations');
    const link = screen.getByRole('link', { name: 'Properties & rooms →' });
    expect(link.getAttribute('href')).toBe('/property-manager');
    expect(screen.getByPlaceholderText('Search locations...')).toBeTruthy();
  });

  test('a location\'s city is one of the five DREAM cities, chosen from a list (wiring map, fix-list item 18)', () => {
    window.history.pushState({}, '', '/universe?tab=world&sub=locations');
    renderAt('/universe?tab=world&sub=locations');
    fireEvent.click(screen.getByRole('button', { name: '+ Add Location' }));
    const city = screen.getByRole('combobox', { name: 'City' });
    expect([...city.options].map((o) => o.textContent)).toEqual(['No city', 'Dazzle District', 'Radiance Row', 'Echo Park', 'Ascent Tower', 'Maverick Harbor']);
    fireEvent.change(city, { target: { value: 'Echo Park' } });
    expect(city.value).toBe('Echo Park');
    expect(screen.queryByPlaceholderText('City (e.g. Dazzle District)')).toBeNull();
  });

  // Evoni, 2026-10-18: "I'm not able to edit these" (on a phone, Edit opened
  // the form far above the card).
  test('Edit opens the form in the card itself, filled in; a studio says what it is used for', async () => {
    const studio = { id: 'loc-9', name: "STUDIO BY SABLE's Studio", location_type: 'venue', venue_type: 'other', city: 'Echo Park',
      description: 'Where they create.', residents: [{ handle: 'sable', display_name: 'STUDIO BY SABLE' }], sceneSets: [{}, {}, {}] };
    vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/world/locations' ? { data: { locations: [studio] } } : { data: { data: {}, locations: [], events: [] } }));
    window.history.pushState({}, '', '/universe?tab=world&sub=locations');
    renderAt('/universe?tab=world&sub=locations');
    expect((await screen.findByTestId('location-uses-loc-9')).textContent).toMatch(/^Home base of this creator: their pin on the phone map/);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const card = screen.getByTestId('location-edit-loc-9');
    expect(within(card).getByText('Edit Location')).toBeTruthy();
    expect(within(card).getByPlaceholderText('Name *').value).toBe("STUDIO BY SABLE's Studio");
    expect(within(card).getByRole('combobox', { name: 'City' }).value).toBe('Echo Park');
    fireEvent.click(within(card).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('location-edit-loc-9')).toBeNull();
    expect(screen.getByText("STUDIO BY SABLE's Studio")).toBeTruthy();
  });

  // Evoni, 2026-10-18: "yes start the sensory details on the location form".
  test('the form edits a place\'s senses: filled in from what is saved, blanks left out on save, other keys kept', async () => {
    const club = { id: 'loc-3', name: 'Club Neon', location_type: 'venue', venue_type: 'club', city: 'Echo Park',
      sensory_details: { sight: 'Violet lasers', from_story: 'A story said it was loud' } };
    vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/world/locations' ? { data: { locations: [club] } } : { data: { data: {}, locations: [], events: [] } }));
    vi.mocked(api.put).mockResolvedValue({ data: { location: club } });
    window.history.pushState({}, '', '/universe?tab=world&sub=locations');
    renderAt('/universe?tab=world&sub=locations');
    await screen.findByText('Club Neon');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const card = screen.getByTestId('location-edit-loc-3');
    expect(within(card).getByTestId('location-senses').open).toBe(true);
    expect(within(card).getByLabelText('Sight').value).toBe('Violet lasers');
    expect(within(card).getByLabelText('Smell').value).toBe('');
    fireEvent.change(within(card).getByLabelText('Sound'), { target: { value: '  Bass through the floor ' } });
    fireEvent.change(within(card).getByLabelText('Smell'), { target: { value: '   ' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Update' }));
    await vi.waitFor(() => expect(api.put).toHaveBeenCalled());
    const [url, body] = vi.mocked(api.put).mock.calls[0];
    expect(url).toContain('/world/locations/loc-3');
    expect(body.sensory_details).toEqual({ sight: 'Violet lasers', sound: 'Bass through the floor', from_story: 'A story said it was loud' });
  });

  test('a new location\'s senses start closed and empty', async () => {
    window.history.pushState({}, '', '/universe?tab=world&sub=locations');
    renderAt('/universe?tab=world&sub=locations');
    fireEvent.click(await screen.findByRole('button', { name: '+ Add Location' }));
    const senses = screen.getByTestId('location-senses');
    expect(senses.open).toBe(false);
    expect(within(senses).getByLabelText('Atmosphere').value).toBe('');
  });
});

// Evoni, 2026-11-22: deleting a location is an admin's, and a location
// anything still uses is refused with what uses it. The page shows the
// server's sentence instead of "Delete failed".
describe('Locations tab: deleting a location', () => {
  const club = { id: 'loc-7', name: 'Club Neon', location_type: 'venue', venue_type: 'club', city: 'Echo Park' };
  const refusal = (status, data) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } });
  const open = async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/world/locations' ? { data: { locations: [club] } } : { data: { data: {}, locations: [], events: [] } }));
    window.history.pushState({}, '', '/universe?tab=world&sub=locations');
    renderAt('/universe?tab=world&sub=locations');
    await screen.findByText('Club Neon');
  };

  beforeEach(() => {
    vi.mocked(api.delete).mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.confirm = vi.fn(() => true);
    globalThis.confirm = window.confirm;
  });

  test('it asks first, and does not call the server when the answer is no', async () => {
    window.confirm.mockReturnValue(false);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Del' }));
    expect(window.confirm).toHaveBeenCalledWith('Delete this location?');
    expect(api.delete).not.toHaveBeenCalled();
    expect(screen.queryByTestId('world-foundation-toast')).toBeNull();
  });

  test('deleted: it says so and reads the list again', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: { deleted: true } });
    await open();
    const reads = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/api/v1/world/locations').length;
    fireEvent.click(screen.getByRole('button', { name: 'Del' }));
    const toast = await screen.findByTestId('world-foundation-toast');
    expect(api.delete).toHaveBeenCalledWith('/api/v1/world/locations/loc-7');
    expect(toast.textContent).toBe('Deleted');
    expect(toast.getAttribute('role')).toBe('status');
    await vi.waitFor(() => expect(vi.mocked(api.get).mock.calls.filter(([url]) => url === '/api/v1/world/locations').length).toBe(reads + 1));
  });

  test('refused for someone who is not an admin (403): the admin-only sentence, not the middleware\'s wording', async () => {
    vi.mocked(api.delete).mockRejectedValue(refusal(403, { error: 'Forbidden', message: 'User must be in one of these groups: ADMIN', code: 'AUTH_GROUP_REQUIRED' }));
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Del' }));
    const toast = await screen.findByRole('alert');
    expect(toast.textContent).toBe('Only an admin can add, change or delete a location.');
    expect(toast.textContent).not.toMatch(/Forbidden|User must be/);
    expect(screen.getByText('Club Neon')).toBeTruthy();
  });

  test('refused because it is in use (409): the server\'s sentence, which names what uses it', async () => {
    vi.mocked(api.delete).mockRejectedValue(refusal(409, {
      success: false, code: 'LOCATION_IN_USE', uses: { scene_sets: 2, events: 1, child_locations: 0 },
      error: 'Club Neon is used by 2 scene sets and 1 event. Nothing was deleted.',
    }));
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Del' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Club Neon is used by 2 scene sets and 1 event. Nothing was deleted.');
    expect(screen.getByText('Club Neon')).toBeTruthy();
  });

  test('refused because its Place is locked (409): the server\'s sentence, which names the events', async () => {
    vi.mocked(api.delete).mockRejectedValue(refusal(409, {
      success: false, code: 'PLACE_LOCKED', locked_events: [{ id: 'e1', name: 'Neon Gala' }],
      error: 'Neon Gala is held here and its episode is accepted: the place is locked, so this location stays. Nothing was deleted.',
    }));
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Del' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Neon Gala is held here .* Nothing was deleted\.$/);
  });

  test('a 409 that carries no sentence: one is made from its uses, or from its locked events', async () => {
    vi.mocked(api.delete).mockRejectedValue(refusal(409, { code: 'LOCATION_IN_USE', uses: { scene_sets: 2, feed_posts: 1, events: 0 } }));
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Del' }));
    expect((await screen.findByRole('alert')).textContent).toBe('This location is in use (scene sets 2, feed posts 1). Nothing was deleted.');
  });

  test('the message is kept inside a phone\'s width: the toast is no wider than the screen less its margins, and long words wrap', async () => {
    vi.mocked(api.delete).mockRejectedValue(refusal(409, { error: 'Club Neon is used by 2 scene sets. Nothing was deleted.' }));
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Del' }));
    const toast = await screen.findByRole('alert');
    expect(toast.style.maxWidth).toBe('calc(100vw - 48px)');
    expect(toast.style.overflowWrap).toBe('anywhere');
  });

  test('any other failure: the page\'s plain message', async () => {
    vi.mocked(api.delete).mockRejectedValue(new Error('Network Error'));
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Del' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Delete failed');
  });
});
