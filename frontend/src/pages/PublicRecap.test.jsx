/**
 * The weekly Pulse recap on the public website (Task 3009): /pulse-recap
 * shows the latest published recap with its posts, earlier weeks to open
 * and a share link; /pulse-recap/:id one week; none yet, not found and a
 * failed read each say so. Plain fetches of the public endpoints only.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
import api from '../services/api';
import PublicRecap, { PUBLIC_RECAPS_URL, weekLabel } from './PublicRecap';

const LIST = [{ id: 'r2', title: 'The gala week', week_start: '2026-09-28' }, { id: 'r1', title: 'A quiet week', week_start: '2026-09-21' }];
const ONE = (id, title) => ({ recap: { id, title, intro: 'Here is what everyone said.', week_start: id === 'r2' ? '2026-09-28' : '2026-09-21', posts: [
  { poster_handle: 'marcus.k', poster_display_name: 'Marcus', content_text: 'the gala though', likes: 12400, comments_count: 31, moment: 'During Ep 1' },
] } });
const reply = (status, body) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
let fetchMock;

const renderAt = (url) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes><Route path="/pulse-recap" element={<PublicRecap />} /><Route path="/pulse-recap/:id" element={<PublicRecap />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  fetchMock = vi.fn((url) => {
    if (url === PUBLIC_RECAPS_URL) return reply(200, { recaps: LIST });
    if (url === `${PUBLIC_RECAPS_URL}/r2`) return reply(200, ONE('r2', 'The gala week'));
    if (url === `${PUBLIC_RECAPS_URL}/r1`) return reply(200, ONE('r1', 'A quiet week'));
    return reply(404, { error: 'Recap not found' });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('the public recap page', () => {
  test('weekLabel', () => expect(weekLabel('2026-09-28')).toBe('Week of 28 September 2026'));

  test('the latest published recap: title, week, intro, posts as The Pulse shows them; earlier weeks; no app API', async () => {
    renderAt('/pulse-recap');
    expect(await screen.findByRole('heading', { level: 1, name: 'The gala week' })).toBeTruthy();
    expect(screen.getByText('Week of 28 September 2026')).toBeTruthy();
    expect(screen.getByText('Here is what everyone said.')).toBeTruthy();
    const [p] = screen.getAllByTestId('site-recap-post');
    expect(p.textContent).toContain('Marcus');
    expect(p.textContent).toContain('the gala though');
    expect(p.textContent).toContain('12,400 likes · 31 comments');
    expect(p.textContent).toContain('During Ep 1');
    expect(screen.getByRole('link', { name: 'A quiet week' }).getAttribute('href')).toBe('/pulse-recap/r1');
    expect(screen.queryByRole('link', { name: 'The gala week' })).toBeNull();
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([PUBLIC_RECAPS_URL, `${PUBLIC_RECAPS_URL}/r2`]);
    expect(api.get).not.toHaveBeenCalled();
  });

  test('one week by its link; Share copies the address', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderAt('/pulse-recap/r1');
    expect(await screen.findByRole('heading', { level: 1, name: 'A quiet week' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Share this recap' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/pulse-recap/r1`));
    expect((await screen.findByRole('status')).textContent).toBe('Link copied.');
  });

  test('none yet, not found, and a failed read', async () => {
    fetchMock.mockImplementation(() => reply(200, { recaps: [] }));
    const first = renderAt('/pulse-recap');
    expect(await screen.findByRole('heading', { level: 1, name: 'No recap yet.' })).toBeTruthy();
    first.unmount();
    fetchMock.mockImplementation((url) => (url === PUBLIC_RECAPS_URL ? reply(200, { recaps: LIST }) : reply(404, {})));
    const second = renderAt('/pulse-recap/nope');
    expect(await screen.findByRole('heading', { level: 1, name: 'That recap is not here.' })).toBeTruthy();
    second.unmount();
    fetchMock.mockImplementation(() => reply(500, {}));
    renderAt('/pulse-recap');
    expect(await screen.findByRole('heading', { level: 1, name: 'The recap could not be loaded.' })).toBeTruthy();
  });
});
