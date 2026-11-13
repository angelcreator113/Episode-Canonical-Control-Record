/**
 * Admin (Tasks #2913, #2914; reorganized by Evoni, 2026-11-13): one page
 * with four tabs — Overview (the default), The Pulse, Website & Show
 * Settings, Security & Access — selected by ?tab=. Every key that existed
 * before still opens what it opened: pulse, website, show-settings, tools.
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
vi.mock('../components/Admin/RateLimitRefusals', () => ({ default: () => <div data-testid="rate-limit-refusals" /> }));
vi.mock('../components/Admin/AdminOverview', () => ({ default: () => <div data-testid="admin-overview" /> }));
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

  test('four tabs; Overview is the default', () => {
    renderAt('/admin');
    expect(adminTabs().getAllByRole('tab').map((t) => t.textContent)).toEqual(['Overview', 'The Pulse', 'Website & Show Settings', 'Security & Access']);
    expect(tab('Overview').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('admin-overview')).toBeTruthy();
    expect(screen.queryByTestId('admin-pulse')).toBeNull();
  });

  test('?tab=pulse still opens The Pulse, its tools as they were', () => {
    renderAt('/admin?tab=pulse&sub=review');
    expect(tab('The Pulse').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('admin-pulse')).toBeTruthy();
    expect(screen.getByText('Open The Pulse').getAttribute('href')).toBe('/pulse');
    expect(lastSearch).toBe('?tab=pulse&sub=review');
  });

  test('?tab=website still shows the Website page, under Website & Show Settings', () => {
    renderAt('/admin?tab=website');
    expect(tab('Website & Show Settings').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('website-admin')).toBeTruthy();
    expect(screen.queryByTestId('show-settings')).toBeNull();
    const sw = within(screen.getByRole('group', { name: 'Website and show settings' }));
    expect(sw.getByRole('button', { name: 'Website' }).getAttribute('aria-pressed')).toBe('true');
    // The other section is one press away, on its own key: nothing is merged.
    fireEvent.click(sw.getByRole('button', { name: 'Show settings' }));
    expect(lastSearch).toBe('?tab=show-settings');
    expect(screen.queryByTestId('website-admin')).toBeNull();
  });

  test('Security & Access: the Audit Log link, the refusals, the tools, and roles said as Cognito\'s; no users table', () => {
    renderAt('/admin?tab=security');
    expect(tab('Security & Access').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('admin-audit-link').getAttribute('href')).toBe('/admin/audit');
    expect(screen.getByText('Admin tools')).toBeTruthy();
    expect(screen.getByText('AI Costs')).toBeTruthy();
    expect(screen.getByTestId('rate-limit-refusals')).toBeTruthy();
    expect(screen.getByTestId('admin-roles-note').textContent).toContain('Amazon Cognito');
    expect(screen.getByTestId('admin-roles-note').textContent).toContain('in: admin');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  test('the old ?tab=tools link opens Security & Access', () => {
    renderAt('/admin?tab=tools');
    expect(tab('Security & Access').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Admin tools')).toBeTruthy();
    expect(lastSearch).toBe('?tab=tools');
  });

  test('an unknown ?tab= falls back to Overview; clicking a tab sets ?tab=', () => {
    renderAt('/admin?tab=nope');
    expect(tab('Overview').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(tab('Security & Access'));
    expect(lastSearch).toBe('?tab=security');
    fireEvent.click(tab('Website & Show Settings'));
    expect(lastSearch).toBe('?tab=website');
    fireEvent.click(tab('The Pulse'));
    expect(lastSearch).toBe('?tab=pulse');
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
