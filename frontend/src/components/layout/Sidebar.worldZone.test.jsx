/**
 * The Sidebar's WORLD zone after the LalaVerse hub (2026-10-04). The Show
 * Bible row is gone (Evoni, 2026-10-04): the Bible is the hub's Bible tab,
 * and LalaVerse is the active row on every hub tab, the Bible tab included.
 * Evoni, 2026-10-19: Characters and Relationships sit under LalaVerse,
 * before The Pulse; Brands & companies is the hub's Brands tab; Lala's
 * Phone and "This week's episode" left the sidebar.
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
  test('LalaVerse, Characters, Relationships, then The Pulse; no Show Bible or Brands row', () => {
    renderAt('/');
    expect(row('LalaVerse').getAttribute('href')).toBe('/universe');
    expect(row('Characters').getAttribute('href')).toBe('/character-registry?view=world');
    expect(row('Relationships').getAttribute('href')).toBe('/relationships');
    expect(row('The Pulse').getAttribute('href')).toBe('/pulse');
    // The rows in that order, one after another.
    const order = ['LalaVerse', 'Characters', 'Relationships', 'The Pulse'].map((l) => row(l));
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    // Characters and Relationships are in the WORLD zone, not WRITE.
    const world = row('LalaVerse').closest('.ps-zone');
    expect(row('Characters').closest('.ps-zone')).toBe(world);
    expect(row('Relationships').closest('.ps-zone')).toBe(world);
    for (const gone of ['Show Bible', 'World Dashboard', 'World Foundation', 'Social Systems', 'Culture & Events', 'Brands & companies']) {
      expect(screen.queryByText(gone)).toBeNull();
    }
    expect(document.querySelector('a[href="/universe?tab=bible"]')).toBeNull();
  });

  test("no Lala's Phone row and no This week's episode row", () => {
    renderAt('/stories');
    expect(screen.queryByText("Lala's Phone")).toBeNull();
    expect(screen.queryByText("This week's episode")).toBeNull();
    expect(document.querySelector('a[href="/phone-hub"]')).toBeNull();
    expect(document.querySelector('a[href="/this-week"]')).toBeNull();
    expect(document.querySelector('a[href="/brands"]')).toBeNull();
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
