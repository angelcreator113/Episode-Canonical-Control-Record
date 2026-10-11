/**
 * Admin (Tasks #2913, #2914): one page with tabs — The Pulse (the Social
 * Director's home), Website, Show settings and Tools — selected by ?tab=,
 * The Pulse by default (docs/design/2026-10-the-pulse.md §1).
 */
import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import AdminPanel from './AdminPanel';

// One auth object for every render: AdminPanel's effects depend on `user`.
vi.mock('../contexts/AuthContext', () => {
  const auth = { user: { name: 'Evoni', email: 'e@x.dev', groups: ['admin'] }, isAuthenticated: true, loading: false };
  return { useAuth: () => auth };
});
vi.mock('./WebsiteAdmin', () => ({ default: () => <div data-testid="website-admin">Website page</div> }));
vi.mock('./ShowSettings', () => ({
  default: ({ showId, tabParam }) => <div data-testid="show-settings">settings for {showId} by {tabParam}</div>,
}));
let SHOWS = [];
vi.mock('../services/showService', () => ({ default: { getAllShows: vi.fn(async () => SHOWS) } }));

let lastSearch = '';
function SearchSpy() {
  lastSearch = useLocation().search;
  return null;
}
const renderAt = (url) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes><Route path="/admin" element={<><AdminPanel /><SearchSpy /></>} /></Routes>
  </MemoryRouter>,
);
const adminTabs = () => within(screen.getByRole('tablist', { name: 'Admin sections' }));
const tab = (name) => adminTabs().getByRole('tab', { name });

describe('Admin tabs', () => {
  beforeEach(() => { window.localStorage.clear(); SHOWS = []; });

  test('four tabs; The Pulse is the default', () => {
    renderAt('/admin');
    expect(adminTabs().getAllByRole('tab').map((t) => t.textContent)).toEqual(['The Pulse', 'Website', 'Show settings', 'Tools']);
    expect(tab('The Pulse').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('admin-pulse')).toBeTruthy();
    expect(screen.getByText('Open The Pulse').getAttribute('href')).toBe('/pulse');
    expect(screen.queryByText('Admin tools')).toBeNull();
  });

  test('?tab=website shows the Website page', () => {
    renderAt('/admin?tab=website');
    expect(tab('Website').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('website-admin')).toBeTruthy();
  });

  test('Tools holds the admin tools index and the roles table', () => {
    renderAt('/admin?tab=tools');
    expect(screen.getByText('Admin tools')).toBeTruthy();
    expect(screen.getByText('AI Costs')).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
  });

  test('an unknown ?tab= falls back to The Pulse; clicking a tab sets ?tab=', () => {
    renderAt('/admin?tab=nope');
    expect(tab('The Pulse').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(tab('Tools'));
    expect(lastSearch).toBe('?tab=tools');
    expect(screen.getByText('Admin tools')).toBeTruthy();
  });

  test('Show settings opens the ?show= show, its own tab as ?sub=', async () => {
    SHOWS = [{ id: 's1', name: 'One' }, { id: 's2', name: 'Two' }];
    renderAt('/admin?tab=show-settings&show=s2');
    expect((await screen.findByTestId('show-settings')).textContent).toBe('settings for s2 by sub');
    fireEvent.change(screen.getByTestId('admin-show-select'), { target: { value: 's1' } });
    await waitFor(() => expect(screen.getByTestId('show-settings').textContent).toBe('settings for s1 by sub'));
    expect(new URLSearchParams(lastSearch).get('show')).toBe('s1');
  });

  test('Show settings: the only show opens; several and none remembered ask which', async () => {
    SHOWS = [{ id: 'only', name: 'Only' }];
    const { unmount } = renderAt('/admin?tab=show-settings');
    expect((await screen.findByTestId('show-settings')).textContent).toBe('settings for only by sub');
    unmount();

    SHOWS = [{ id: 's1', name: 'One' }, { id: 's2', name: 'Two' }];
    renderAt('/admin?tab=show-settings');
    await screen.findByTestId('admin-show-pick');
    fireEvent.click(screen.getByText('Two'));
    expect((await screen.findByTestId('show-settings')).textContent).toBe('settings for s2 by sub');
  });
});
