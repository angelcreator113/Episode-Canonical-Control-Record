/**
 * The LalaVerse hub (2026-10-04): the world pages are its tabs. `?tab=`
 * opens a tab, `?sub=` the page's own tab; the Overview keeps the show's
 * world at a glance and has lost its jump buttons (the tabs and the
 * Sidebar are the doorways); an embedded page shows no page heading of
 * its own, since the tab is the heading.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import UniversePage, { HUB_TABS } from './UniversePage';
import { rememberShow } from '../utils/activeShow';

const SHOWS = [{ id: 'show-b', name: 'Styling Adventures', description: 'The show.' }];
const renderAt = (url) => render(<MemoryRouter initialEntries={[url]}><UniversePage /></MemoryRouter>);

beforeEach(() => {
  window.localStorage.clear();
  rememberShow('show-b');
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => (
    url === '/api/v1/shows' ? { data: { success: true, data: SHOWS } } : { data: { data: [], events: [], registries: [], books: [], locations: [] } }
  ));
});

describe('UniversePage: the LalaVerse hub', () => {
  test('five tabs, Overview first, with the show at a glance and no jump buttons', async () => {
    renderAt('/universe');
    expect(HUB_TABS.map((t) => t.key)).toEqual(['overview', 'world', 'society', 'culture', 'state']);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['OverviewThe world at a glance', 'WorldMap, locations', 'SocietyArchetypes, legends, trends', 'CultureCalendar, awards, history', 'StateSetup, snapshots, tensions']);
    expect(tabs[0].getAttribute('aria-current')).toBe('page');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Styling Adventures'));
    for (const label of ['Producer Mode', 'Show Dashboard', 'Show Bible', 'World Dashboard']) {
      expect(screen.queryByRole('button', { name: new RegExp(label) })).toBeNull();
    }
  });

  test('?tab=world mounts the World page embedded: its sub-tabs, no page heading', async () => {
    renderAt('/universe?tab=world');
    expect(screen.getByRole('tab', { name: /^World/ }).getAttribute('aria-current')).toBe('page');
    await screen.findByText('The Map');
    expect(screen.getByText('Locations')).toBeTruthy();
    expect(screen.getByText('The Loop')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  test('?tab=culture&sub=history opens Culture on its History sub-tab', async () => {
    renderAt('/universe?tab=culture&sub=history');
    expect(screen.getByRole('tab', { name: /^Culture/ }).getAttribute('aria-current')).toBe('page');
    await screen.findByText('History');
    expect(screen.queryByText('Culture & Events', { selector: 'h1' })).toBeNull();
  });

  test('clicking a tab switches the page and the URL', async () => {
    renderAt('/universe');
    fireEvent.click(screen.getByRole('tab', { name: /^Society/ }));
    await screen.findByText('Archetypes');
    expect(screen.getByRole('tab', { name: /^Society/ }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('tab', { name: /^Overview/ }).getAttribute('aria-current')).toBeNull();
  });

  test('an unknown ?tab= falls back to Overview', async () => {
    renderAt('/universe?tab=nope');
    expect(screen.getByRole('tab', { name: /^Overview/ }).getAttribute('aria-current')).toBe('page');
  });
});
