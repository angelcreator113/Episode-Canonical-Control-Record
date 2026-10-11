/**
 * Admin (Task #2913): one page with tabs — The Pulse (the Social
 * Director's home), Website and Tools — selected by ?tab=, The Pulse by
 * default (docs/design/2026-10-the-pulse.md §1).
 */
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import AdminPanel from './AdminPanel';

// One auth object for every render: AdminPanel's effects depend on `user`.
vi.mock('../contexts/AuthContext', () => {
  const auth = { user: { name: 'Evoni', email: 'e@x.dev', groups: ['admin'] }, isAuthenticated: true, loading: false };
  return { useAuth: () => auth };
});
vi.mock('./WebsiteAdmin', () => ({ default: () => <div data-testid="website-admin">Website page</div> }));

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
const tab = (name) => screen.getByRole('tab', { name });

describe('Admin tabs', () => {
  test('three tabs; The Pulse is the default', () => {
    renderAt('/admin');
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['The Pulse', 'Website', 'Tools']);
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
});
