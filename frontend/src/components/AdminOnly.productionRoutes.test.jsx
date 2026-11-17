/**
 * The new-episode starter and the event package are an ADMIN's screens
 * (Evoni, 2026-11-15). Their routes sit inside the existing AdminOnly
 * wrapper: an ADMIN sees the page; a viewer, an editor or an account with
 * no group sees "Admins only" and the page is never mounted, so it makes no
 * request. A signed-out visitor is not on these routes at all: they are in
 * the signed-in route table only, and the shell sends a signed-out visitor
 * to the landing page.
 *
 * AdminOnly explains; it does not protect. What each request may do is the
 * server's to decide.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const auth = { user: null, loading: false };
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

import AdminOnly from './AdminOnly';

const APP = fs.readFileSync(path.join(__dirname, '../App.jsx'), 'utf8');
const mounted = vi.fn();
function Page({ name }) { mounted(name); return <div data-testid="page">{name}</div>; }

// The two routes as App.jsx declares them, with stand-in pages.
const renderAt = (url) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/shows/:showId/new-episode" element={<AdminOnly><Page name="starter" /></AdminOnly>} />
      <Route path="/shows/:showId/events/:eventId" element={<AdminOnly><Page name="event package" /></AdminOnly>} />
    </Routes>
  </MemoryRouter>,
);
const URLS = { starter: '/shows/s1/new-episode', 'event package': '/shows/s1/events/e1' };

describe('the production screens are inside AdminOnly', () => {
  beforeEach(() => { auth.user = null; auth.loading = false; mounted.mockClear(); });

  test('App.jsx wraps both routes in AdminOnly, and only in the signed-in route table', () => {
    expect(APP).toMatch(/<Route path="\/shows\/:showId\/new-episode" element=\{<AdminOnly><NewEpisodeStarter \/><\/AdminOnly>\} \/>/);
    expect(APP).toMatch(/<Route path="\/shows\/:showId\/events\/:eventId" element=\{<AdminOnly><EventPackagePage \/><\/AdminOnly>\} \/>/);
    // One declaration each: no second, unwrapped route to the same page.
    expect(APP.match(/<NewEpisodeStarter \/>/g)).toHaveLength(1);
    expect(APP.match(/<EventPackagePage \/>/g)).toHaveLength(1);
    // The signed-out route table ends at its catch-all, before either route.
    const signedOut = APP.slice(APP.indexOf('if (!isAuthenticated) {'), APP.indexOf('<Route path="*" element={<Navigate to="/" replace />} />'));
    expect(signedOut.length).toBeGreaterThan(0);
    expect(signedOut).not.toMatch(/new-episode|events\/:eventId/);
  });

  test.each(Object.entries(URLS))('an ADMIN opens the %s', (name, url) => {
    auth.user = { email: 'a@example.com', groups: ['admin'] };
    renderAt(url);
    expect(screen.getByTestId('page').textContent).toBe(name);
    expect(screen.queryByTestId('admin-only')).toBeNull();
  });

  const others = [
    ['a viewer', { email: 'v@example.com', groups: ['viewer'] }],
    ['an editor', { email: 'e@example.com', groups: ['editor'] }],
    ['an account in no group', { email: 'n@example.com' }],
    ['a look-alike group', { email: 'x@example.com', groups: ['administrator', 'admins', 'ADMIN '] }],
  ];
  for (const [who, user] of others) {
    test.each(Object.entries(URLS))(`${who} is told "Admins only" at the %s, and the page is never mounted`, (_name, url) => {
      auth.user = user;
      renderAt(url);
      expect(screen.getByTestId('admin-only').textContent).toContain('Admins only');
      expect(screen.queryByTestId('page')).toBeNull();
      expect(mounted).not.toHaveBeenCalled();
    });
  }

  test('while the sign-in is still being read, nothing shows: neither the page nor the refusal', () => {
    auth.loading = true;
    auth.user = { email: 'e@example.com', groups: ['editor'] };
    renderAt(URLS.starter);
    expect(screen.queryByTestId('page')).toBeNull();
    expect(screen.queryByTestId('admin-only')).toBeNull();
    expect(mounted).not.toHaveBeenCalled();
  });
});
