/**
 * The character production screens are an ADMIN's (character privacy, Evoni,
 * 2026-11-16): the registry, a character's page, the relationship engine, the
 * feed relationship map and the pressure dashboard. Their reads answer 403 to
 * anyone else, so their routes sit inside the existing AdminOnly wrapper: an
 * ADMIN sees the page; a viewer, an editor or an account with no group sees
 * "Admins only" and the page is never mounted, so it makes no request and
 * shows no empty cast, zero count or "Forbidden". A signed-out visitor is not
 * on these routes at all.
 *
 * AdminOnly explains; it does not protect. The server decides each request.
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

// route path, the page App.jsx renders there, a URL to open
const SCREENS = [
  ['/character-registry', 'CharacterRegistryPage', '/character-registry'],
  ['/character/:id', 'CharacterProfile', '/character/c1'],
  ['/relationships', 'RelationshipEngine', '/relationships'],
  ['/pressure', 'NarrativePressureDashboard', '/pressure'],
  ['/feed-relationships', 'FeedRelationshipMap', '/feed-relationships'],
];

const renderAt = (url) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      {SCREENS.map(([route, page]) => <Route key={route} path={route} element={<AdminOnly><Page name={page} /></AdminOnly>} />)}
    </Routes>
  </MemoryRouter>,
);

describe('the character production screens are inside AdminOnly', () => {
  beforeEach(() => { auth.user = null; auth.loading = false; mounted.mockClear(); });

  test.each(SCREENS)('App.jsx wraps %s in AdminOnly, once, and only in the signed-in route table', (route, page) => {
    const escaped = route.replace(/[/:]/g, (c) => (c === '/' ? '\\/' : c));
    expect(APP).toMatch(new RegExp(`<Route path="${escaped}" element=\\{<AdminOnly><${page} \\/><\\/AdminOnly>\\} \\/>`));
    // One route to the page: no second, unwrapped one.
    expect(APP.match(new RegExp(`<${page} \\/>`, 'g'))).toHaveLength(1);
    const signedOut = APP.slice(APP.indexOf('if (!isAuthenticated) {'), APP.indexOf('<Route path="*" element={<Navigate to="/" replace />} />'));
    expect(signedOut.length).toBeGreaterThan(0);
    expect(signedOut).not.toContain(`path="${route}"`);
  });

  test.each(SCREENS)('an ADMIN opens %s', (route, page, url) => {
    auth.user = { email: 'a@example.com', groups: ['admin'] };
    renderAt(url);
    expect(screen.getByTestId('page').textContent).toBe(page);
    expect(screen.queryByTestId('admin-only')).toBeNull();
  });

  const NOT_ADMIN = [
    ['a viewer', { email: 'v@example.com', groups: ['viewer'] }],
    ['an editor', { email: 'e@example.com', groups: ['editor'] }],
    ['an account with no group', { email: 'n@example.com', groups: [] }],
  ];
  describe.each(NOT_ADMIN)('%s', (who, user) => {
    test.each(SCREENS)('sees "Admins only" at %s, and the page is never mounted', (route, page, url) => {
      auth.user = user;
      renderAt(url);
      expect(screen.getByTestId('admin-only').textContent).toMatch(/Admins only/);
      expect(screen.queryByTestId('page')).toBeNull();
      expect(mounted).not.toHaveBeenCalled();
      // Nothing that reads as an error or as missing data.
      expect(document.body.textContent).not.toMatch(/Forbidden|Loading|0 characters/);
    });
  });

  test('while the session is still being read, nothing is shown and nothing is mounted', () => {
    auth.loading = true;
    renderAt('/character-registry');
    expect(screen.queryByTestId('page')).toBeNull();
    expect(screen.queryByTestId('admin-only')).toBeNull();
    expect(mounted).not.toHaveBeenCalled();
  });
});
