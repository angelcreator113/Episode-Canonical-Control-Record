/**
 * Feature a guest by clicking their name in the Full Guest List: click to
 * feature, click again to unfeature, at most five, while the package is
 * editable; once Start Episode locks it the names are plain text and say so.
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

const renderPage = () => render(
  <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
    <Routes><Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  usedInEpisode = null;
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === EVENT_URL) {
      return { data: { success: true, event: stored, sourceProfile: null, startedFromProfile: null, sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode } };
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

  test('a locked package shows the names as plain text and says featured attendees are locked', async () => {
    stored = eventWith(guests([1]), { used_in_episode_id: 'ep-9' });
    usedInEpisode = { id: 'ep-9', episode_number: 4, title: 'Velour' };
    renderPage();
    const list = await openList();
    expect(within(list).queryAllByRole('button')).toHaveLength(0);
    expect(list.textContent).toContain('guest2');
    expect(list.textContent).toContain('Featured');
    expect(screen.getByTestId('guest-list-locked').textContent).toBe('Featured attendees are locked with the package (Episode 4).');
  });
});
