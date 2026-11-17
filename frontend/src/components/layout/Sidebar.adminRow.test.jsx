/**
 * The Sidebar's Admin row (Evoni, 2026-11-13): offered to an admin only.
 * The route and its APIs refuse anyone else; this is the navigation not
 * pointing them at it.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(async () => ({ data: { data: [] } })), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
let user;
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user, logout: vi.fn() }) }));

import Sidebar from './Sidebar';

const renderSidebar = () => render(<MemoryRouter initialEntries={['/']}><Sidebar isOpen onClose={() => {}} /></MemoryRouter>);
const adminRow = () => screen.queryAllByRole('link').find((a) => a.getAttribute('href') === '/admin');

describe('Sidebar: the Admin row', () => {
  beforeEach(() => { window.localStorage.clear(); vi.spyOn(console, 'error').mockImplementation(() => {}); });

  test('an admin sees it', () => {
    user = { name: 'Evoni', email: 'e@x.dev', groups: ['ADMIN'] };
    renderSidebar();
    expect(adminRow()).toBeTruthy();
  });

  test.each([['an editor', { name: 'Ed', email: 'ed@x.dev', groups: ['editor'] }], ['a user with no groups', { name: 'No', email: 'n@x.dev' }]])('%s does not; Search and Settings stay', (_n, u) => {
    user = u;
    renderSidebar();
    expect(adminRow()).toBeUndefined();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/search');
    expect(hrefs).toContain('/settings');
  });
});
