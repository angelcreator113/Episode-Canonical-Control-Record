/**
 * Event Package audit fixes (Evoni, 2026-10-23: "fix all of them").
 *
 * A reload after the first load keeps the page on screen and shows a
 * Retry banner when it fails; Enter on an empty Basics field saves nothing;
 * Start Episode waits for the money check, and a failed check becomes a
 * warning; Escape closes the open dialog; toasts are announced; a failed
 * locations load in the venue picker can be retried.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

const EVENT_URL = '/api/v1/world/show-1/events/ev-1';
const PREVIEW_URL = '/api/v1/world/show-1/events/ev-1/money-preview';
const LOCATIONS_URL = '/api/v1/world/locations';

// Every gate item set, so Start Episode shows.
const GATED_EVENT = {
  id: 'ev-1',
  show_id: 'show-1',
  name: 'Velour Awards Night',
  event_type: 'invite',
  prestige: 6,
  category: 'arts_entertainment',
  format: 'gala',
  event_date: '2026-11-09',
  host_brand: 'Velour',
  venue_location_id: 'loc-1',
  invitation_asset_id: 'asset-inv-1',
  scene_set_id: 'set-1',
  outfit_set_id: 'outfit-1',
  event_time: '19:00',
  dress_code: 'Black tie',
  narrative_stakes: 'Her first red carpet',
  cost_coins: 250,
  updated_at: '2026-09-25T10:00:00.000Z',
  canon_consequences: { automation: { guest_profiles: [{ id: 'g1', featured: true }] } },
};

let stored;
let eventGet; // how the event GET answers: (callIndex) => response
let previewGet;
let locationsGet;

function payload() {
  return {
    success: true, event: stored, sourceProfile: null, startedFromProfile: null,
    sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode: null,
  };
}

// A finished section starts folded (2026-10-23); its Edit opens it.
function openSection(anchor) {
  const fold = screen.queryByTestId(`fold-${anchor}`);
  if (fold && fold.getAttribute('aria-expanded') === 'false') fireEvent.click(fold);
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
      <Routes>
        <Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('EventPackagePage audit fixes', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    stored = JSON.parse(JSON.stringify(GATED_EVENT));
    let eventCalls = 0;
    eventGet = async () => ({ data: payload() });
    previewGet = async () => ({ data: { success: true, data: { balance: 900, warnings: [], lines: [] } } });
    locationsGet = async () => ({ data: { success: true, locations: [] } });
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === EVENT_URL) { eventCalls += 1; return eventGet(eventCalls); }
      if (url === PREVIEW_URL) return previewGet();
      if (url === LOCATIONS_URL) return locationsGet();
      return { data: { success: true, deliverables: [], locked: false } };
    });
    vi.mocked(api.put).mockImplementation(async (url, body) => {
      if (url !== EVENT_URL) return { data: { success: true } };
      const { expected_updated_at: _v, ...fields } = body;
      stored = { ...stored, ...fields, updated_at: '2026-09-25T10:05:00.000Z' };
      return { data: { success: true, event: stored } };
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('a failed reload keeps the page on screen and offers Retry', async () => {
    // The save is refused as stale, so the page reloads; that reload fails,
    // and Retry then succeeds.
    eventGet = async (n) => {
      if (n === 2) throw Object.assign(new Error('Network Error'), { response: { data: { error: 'Server unavailable' } } });
      return { data: payload() };
    };
    vi.mocked(api.put).mockRejectedValue(Object.assign(new Error('stale'), {
      response: { status: 409, data: { code: 'EVENT_CHANGED', error: 'Someone changed this event.' } },
    }));

    renderPage();
    await screen.findByTestId('basics-dressCode');
    openSection('identity');
    fireEvent.click(within(screen.getByTestId('basics-dressCode')).getByRole('button', { name: 'Edit' }));
    // Edited in its row now (2026-10-23), not in a dialog.
    const editor = await screen.findByRole('group', { name: 'Dress code' });
    fireEvent.change(within(editor).getByRole('textbox'), { target: { value: 'Cocktail' } });
    fireEvent.click(within(editor).getByRole('button', { name: /save/i }));

    const banner = await screen.findByTestId('refresh-error');
    expect(banner.textContent).toContain('Server unavailable');
    // Still the page, not the full-page spinner or error.
    expect(screen.getByTestId('package-hero')).toBeTruthy();

    fireEvent.click(within(banner).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByTestId('refresh-error')).toBeNull());
    expect(screen.getByTestId('package-hero')).toBeTruthy();
  });

  test('Enter on an empty Basics field saves nothing', async () => {
    renderPage();
    await screen.findByTestId('basics-dressCode');
    openSection('identity');
    fireEvent.click(within(screen.getByTestId('basics-dressCode')).getByRole('button', { name: 'Edit' }));
    const editor = await screen.findByRole('group', { name: 'Dress code' });
    const input = within(editor).getByRole('textbox');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await new Promise((r) => setTimeout(r, 20));
    expect(api.put).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Dress code' })).toBeTruthy();

    // A value saves on Enter.
    fireEvent.change(input, { target: { value: 'Cocktail' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(EVENT_URL, expect.objectContaining({ dress_code: 'Cocktail' })));
  });

  test('Start Episode waits for the money check', async () => {
    let release;
    previewGet = () => new Promise((resolve) => {
      release = () => resolve({ data: { success: true, data: { balance: 900, warnings: [], lines: [] } } });
    });
    renderPage();
    const start = await screen.findByTestId('start-episode');
    expect(start.disabled).toBe(true);
    expect(start.textContent).toContain('Checking money');

    release();
    await waitFor(() => expect(screen.getByTestId('start-episode').disabled).toBe(false));
    expect(screen.getByTestId('start-episode').textContent).toContain('Start Episode');
  });

  test('a failed money check opens Start Episode with a warning', async () => {
    previewGet = async () => { throw new Error('preview down'); };
    renderPage();
    await waitFor(() => expect(screen.getByTestId('start-episode').disabled).toBe(false));
    fireEvent.click(screen.getByTestId('start-episode'));
    const confirm = await screen.findByTestId('start-confirm');
    expect(confirm.textContent).toContain('money couldn’t be checked');
  });

  test('Escape closes the open dialog', async () => {
    renderPage();
    await screen.findByTestId('package-hero');
    fireEvent.click(screen.getAllByRole('button', { name: /change venue|choose venue/i })[0]);
    expect(await screen.findByRole('dialog', { name: 'Choose venue' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Choose venue' })).toBeNull());
  });

  test('toasts render inside a polite live region', async () => {
    renderPage();
    await screen.findByTestId('package-hero');
    const live = document.querySelector('.epp-toast-live');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.getAttribute('role')).toBe('status');
  });

  test('a failed locations load in the venue picker shows Try again, which reloads', async () => {
    let calls = 0;
    locationsGet = async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error('boom'), { response: { data: { error: 'Locations offline' } } });
      return { data: { success: true, locations: [{ id: 'loc-2', name: 'The Atrium', venue_type: 'ballroom', city: 'Velour City' }] } };
    };
    renderPage();
    await screen.findByTestId('package-hero');
    fireEvent.click(screen.getAllByRole('button', { name: /change venue|choose venue/i })[0]);
    const err = await screen.findByTestId('venue-locations-error');
    expect(err.textContent).toContain('Locations offline');

    fireEvent.click(within(err).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('The Atrium')).toBeTruthy();
    expect(calls).toBe(2);
  });
});
