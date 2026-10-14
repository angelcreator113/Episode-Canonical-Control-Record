/**
 * Feature a guest by clicking their name in the Full Guest List: click to
 * feature, click again to unfeature, at most five, while the package is
 * editable. After Start Episode they stay editable until the episode is
 * accepted (Evoni, 2026-10-09), like the scene set; then the names are
 * plain text and say so.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

const EVENT_URL = '/api/v1/world/show-1/events/ev-1';
const guests = (featured = []) => Array.from({ length: 7 }, (_, i) => ({
  profile_id: `p${i}`, handle: `guest${i + 1}`, featured: featured.includes(i),
}));
const eventWith = (list, extra = {}) => ({
  id: 'ev-1', show_id: 'show-1', name: 'Velour Awards Night', event_type: 'invite', prestige: 6,
  updated_at: '2026-09-25T10:00:00.000Z',
  canon_consequences: { automation: { guest_profiles: list } },
  ...extra,
});

let stored;
let usedInEpisode;
let placeLocked;

const renderPage = (path = '/shows/show-1/events/ev-1') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  usedInEpisode = null;
  placeLocked = false;
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === EVENT_URL) {
      return { data: { success: true, event: stored, sourceProfile: null, startedFromProfile: null, sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode, placeLocked } };
    }
    return { data: { success: true, deliverables: [], locked: false } };
  });
  vi.mocked(api.put).mockImplementation(async (url, body) => {
    stored = { ...stored, ...body, updated_at: '2026-09-25T10:05:00.000Z' };
    return { data: { success: true, event: stored } };
  });
});

const openList = async () => {
  fireEvent.click(await screen.findByText('Show Full Guest List (7)'));
  return document.getElementById('epp-guest-list');
};
const savedGuests = (n) => vi.mocked(api.put).mock.calls[n][1].canon_consequences.automation.guest_profiles;

describe('feature a guest by clicking their name', () => {
  test('clicking a name features them, the count updates; clicking again removes them', async () => {
    stored = eventWith(guests());
    renderPage();
    const list = await openList();
    const name = within(list).getByRole('button', { name: /guest3/ });
    expect(name.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(name);
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(savedGuests(0).map((g) => g.featured)).toEqual([false, false, true, false, false, false, false]);
    await screen.findByText('Featured Attendees (1/5)');

    const featured = within(document.getElementById('epp-guest-list')).getByRole('button', { name: /guest3/ });
    expect(featured.getAttribute('aria-pressed')).toBe('true');
    expect(featured.textContent).toContain('Featured');
    fireEvent.click(featured);
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
    expect(savedGuests(1).every((g) => !g.featured)).toBe(true);
    await screen.findByText('Featured Attendees (0/5)');
  });

  test('at five, the other names are disabled and say why; a featured name can still be removed', async () => {
    stored = eventWith(guests([0, 1, 2, 3, 4]));
    renderPage();
    const list = await openList();
    expect(screen.getByText('Featured Attendees (5/5)')).toBeTruthy();
    expect(screen.getByTestId('guest-list-full').textContent).toContain('5 of 5 featured');
    expect(within(list).getByRole('button', { name: /guest6/ }).disabled).toBe(true);
    const first = within(list).getByRole('button', { name: /guest1/ });
    expect(first.disabled).toBe(false);
    fireEvent.click(within(list).getByRole('button', { name: /guest6/ }));
    expect(api.put).not.toHaveBeenCalled();
  });

  test('after Start Episode, a draft episode can still feature a guest', async () => {
    stored = eventWith(guests([1]), { used_in_episode_id: 'ep-9' });
    usedInEpisode = { id: 'ep-9', episode_number: 4, title: 'Velour' };
    renderPage();
    const list = await openList();
    expect(screen.queryByTestId('guest-list-locked')).toBeNull();
    fireEvent.click(within(list).getByRole('button', { name: /guest4/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(savedGuests(0).map((g) => g.featured)).toEqual([false, true, false, true, false, false, false]);
  });

  test("the episode's link lands on People with the guest list open", async () => {
    stored = eventWith(guests(), { used_in_episode_id: 'ep-9' });
    usedInEpisode = { id: 'ep-9', episode_number: 4, title: 'Velour' };
    renderPage('/shows/show-1/events/ev-1#epp-sec-people');
    await screen.findByText('Hide Full Guest List (7)');
    expect(within(document.getElementById('epp-guest-list')).getAllByRole('button').length).toBeGreaterThan(0);
  });

  test('once the episode is accepted, the names are plain text and say featured attendees are locked', async () => {
    stored = eventWith(guests([1]), { used_in_episode_id: 'ep-9' });
    usedInEpisode = { id: 'ep-9', episode_number: 4, title: 'Velour' };
    placeLocked = true;
    renderPage();
    const list = await openList();
    expect(within(list).queryAllByRole('button')).toHaveLength(0);
    expect(list.textContent).toContain('guest2');
    expect(list.textContent).toContain('Featured');
    expect(screen.getByTestId('guest-list-locked').textContent).toBe('Featured attendees are locked: Episode 4 is accepted.');
  });
});

// Task #3138: Add from Feed is where Featured Attendees are chosen. A name
// already on the guest list was a disabled row and the handler refused it,
// so picking an invited guest there never featured them.
describe('Add from Feed features an invited guest', () => {
  const feed = (profiles) => {
    const base = vi.mocked(api.get).getMockImplementation();
    vi.mocked(api.get).mockImplementation(async (url) => (
      url.startsWith('/api/v1/social-profiles?') ? { data: { profiles } } : base(url)
    ));
  };
  const openFeed = async () => {
    fireEvent.click(await screen.findByRole('button', { name: /Add from Feed/ }));
  };

  test('picking an invited guest features them in place; the guest list is not added to', async () => {
    stored = eventWith(guests([0]));
    feed([{ id: 'p2', handle: 'guest3', display_name: 'Guest Three' }, { id: 'p0', handle: 'guest1', display_name: 'Guest One' }]);
    renderPage();
    await openFeed();
    const invited = await screen.findByTestId('guest-feed-result-p2');
    expect(invited.disabled).toBe(false);
    expect(invited.textContent).toContain('Invited · pick to feature');
    const featured = screen.getByTestId('guest-feed-result-p0');
    expect(featured.disabled).toBe(true);
    expect(featured.textContent).toContain('Featured');

    fireEvent.click(invited);
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const saved = savedGuests(0);
    expect(saved).toHaveLength(7);
    expect(saved.map((g) => g.featured)).toEqual([true, false, true, false, false, false, false]);
    await screen.findByText('Featured Attendees (2/5)');
  });

  test('a creator not on the list is added and featured, as before', async () => {
    stored = eventWith(guests());
    feed([{ id: 'p99', handle: 'newface', display_name: 'New Face' }]);
    renderPage();
    await openFeed();
    fireEvent.click(await screen.findByTestId('guest-feed-result-p99'));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const saved = savedGuests(0);
    expect(saved).toHaveLength(8);
    expect(saved[7]).toMatchObject({ profile_id: 'p99', display_name: 'New Face', featured: true });
  });

  test('at five featured, picking an invited guest says why and saves nothing', async () => {
    stored = eventWith(guests([0, 1, 2, 3, 4]));
    feed([{ id: 'p5', handle: 'guest6', display_name: 'Guest Six' }]);
    renderPage();
    await openFeed();
    fireEvent.click(await screen.findByTestId('guest-feed-result-p5'));
    expect(await screen.findByText('Only 5 guests can be featured at once — remove one first.')).toBeTruthy();
    expect(api.put).not.toHaveBeenCalled();
  });
});
