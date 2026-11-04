/**
 * AdminOnly: the admin tools (CFO, AI Costs, Site Organizer, Design Agent,
 * Decision Analytics, Recycle Bin, Amber) show a non-admin "Admins only"
 * instead of the page; an admin (Cognito `admin` group, any case) sees it.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const auth = { user: null, loading: false };
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

import AdminOnly from './AdminOnly';

const renderGate = () => render(
  <MemoryRouter>
    <AdminOnly><div data-testid="tool">tool</div></AdminOnly>
  </MemoryRouter>,
);

describe('AdminOnly', () => {
  beforeEach(() => { auth.user = null; auth.loading = false; });

  test('a signed-in non-admin sees "Admins only", not the tool', () => {
    auth.user = { email: 'u@example.com', groups: ['editor'] };
    renderGate();
    expect(screen.getByTestId('admin-only').textContent).toContain('Admins only');
    expect(screen.queryByTestId('tool')).toBeNull();
  });

  test('a user with no groups sees "Admins only"', () => {
    auth.user = { email: 'u@example.com' };
    renderGate();
    expect(screen.getByTestId('admin-only')).toBeTruthy();
    expect(screen.queryByTestId('tool')).toBeNull();
  });

  test('an admin sees the tool (group name is case-insensitive)', () => {
    auth.user = { email: 'a@example.com', groups: ['ADMIN'] };
    renderGate();
    expect(screen.getByTestId('tool')).toBeTruthy();
    expect(screen.queryByTestId('admin-only')).toBeNull();
  });

  test('while auth is loading, nothing is shown', () => {
    auth.loading = true;
    renderGate();
    expect(screen.queryByTestId('tool')).toBeNull();
    expect(screen.queryByTestId('admin-only')).toBeNull();
  });
});
