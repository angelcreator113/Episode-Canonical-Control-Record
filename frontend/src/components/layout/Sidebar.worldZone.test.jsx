/**
 * The Sidebar's WORLD zone after the LalaVerse hub (2026-10-04): two rows
 * (LalaVerse, Social Media). The Show Bible row is gone (Evoni, 2026-10-04):
 * the Bible is the hub's Bible tab, and LalaVerse is the active row on every
 * hub tab, the Bible tab included.
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
  test('two rows: LalaVerse and Social Media; no Show Bible row', () => {
    renderAt('/');
    expect(row('LalaVerse').getAttribute('href')).toBe('/universe');
    expect(row('Social Media').getAttribute('href')).toBe('/feed');
    for (const gone of ['Show Bible', 'World Dashboard', 'World Foundation', 'Social Systems', 'Culture & Events']) {
      expect(screen.queryByText(gone)).toBeNull();
    }
    expect(document.querySelector('a[href="/universe?tab=bible"]')).toBeNull();
  });

  test('on the Bible tab LalaVerse is the active row', () => {
    renderAt('/universe?tab=bible');
    expect(row('LalaVerse').className).toContain('ps-nav-item-active');
  });

  test('on another hub tab LalaVerse is the active row', () => {
    renderAt('/universe?tab=world');
    expect(row('LalaVerse').className).toContain('ps-nav-item-active');
  });
});
