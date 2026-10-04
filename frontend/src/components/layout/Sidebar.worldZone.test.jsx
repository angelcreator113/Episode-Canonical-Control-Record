/**
 * The Sidebar's WORLD zone after the LalaVerse hub (2026-10-04): three rows
 * (LalaVerse, Show Bible, Social Media); the Show Bible row deep-links to the
 * hub's Bible tab and is the active row there, while the LalaVerse row is
 * active on the hub's other tabs and yields to Show Bible on its own.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(async () => ({ data: { success: true, data: [] } })), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Evoni', email: 'e@x.dev' }, logout: vi.fn() }) }));

import Sidebar from './Sidebar';

const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><Sidebar isOpen onClose={() => {}} /></MemoryRouter>);
const row = (label) => screen.getByText(label).closest('a');

beforeEach(() => { window.localStorage.clear(); });

describe('Sidebar: the WORLD zone', () => {
  test('three rows; Show Bible deep-links to the hub tab', () => {
    renderAt('/');
    expect(row('LalaVerse').getAttribute('href')).toBe('/universe');
    expect(row('Show Bible').getAttribute('href')).toBe('/universe?tab=bible');
    expect(row('Social Media').getAttribute('href')).toBe('/feed');
    for (const gone of ['World Dashboard', 'World Foundation', 'Social Systems', 'Culture & Events']) {
      expect(screen.queryByText(gone)).toBeNull();
    }
  });

  test('on the Bible tab the Show Bible row is active and LalaVerse is not', () => {
    renderAt('/universe?tab=bible');
    expect(row('Show Bible').className).toContain('ps-nav-item-active');
    expect(row('LalaVerse').className).not.toContain('ps-nav-item-active');
  });

  test('on another hub tab LalaVerse is active and Show Bible is not', () => {
    renderAt('/universe?tab=world');
    expect(row('LalaVerse').className).toContain('ps-nav-item-active');
    expect(row('Show Bible').className).not.toContain('ps-nav-item-active');
  });
});
