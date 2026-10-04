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
  test('six tabs, Overview first, with the show at a glance and no jump buttons', async () => {
    renderAt('/universe');
    expect(HUB_TABS.map((t) => t.key)).toEqual(['overview', 'bible', 'world', 'society', 'culture', 'state']);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['OverviewThe world at a glance', 'Show BibleCanon, decisions, guard', 'WorldMap, locations', 'SocietyArchetypes, legends, trends', 'CultureCalendar, awards, history', 'StateSnapshots, timeline, tensions']);
    expect(tabs[0].getAttribute('aria-current')).toBe('page');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Styling Adventures'));
    for (const label of ['Producer Mode', 'Show Dashboard', 'Show Bible', 'World Dashboard']) {
      expect(screen.queryByRole('button', { name: new RegExp(`^${label}$`) })).toBeNull();
    }
    // The world's setup progress is the Overview's (it was World Dashboard's first tab).
    // The Overview loads its stats after the show resolves; wait for the steps themselves.
    expect(await screen.findAllByRole('button', { name: /^Step \d: / })).toHaveLength(7);
    expect(screen.getByTestId('world-setup-count')).toBeTruthy();
  });

  test('the Overview stays on its loader until the stats are in for the show, then renders once', async () => {
    let releaseStats;
    const held = new Promise((r) => { releaseStats = r; });
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows') return { data: { success: true, data: SHOWS } };
      if (url.startsWith('/api/v1/episodes')) { await held; }
      return { data: { data: [], events: [], registries: [], books: [], locations: [] } };
    });
    renderAt('/universe');
    await screen.findByText('Loading LalaVerse...');
    // The shows are in and the stats are not: no content, no setup section yet.
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.queryByTestId('world-setup-count')).toBeNull();
    releaseStats();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Styling Adventures'));
    expect(await screen.findAllByRole('button', { name: /^Step \d: / })).toHaveLength(7);
    // ...and it stays: no second loader after the content.
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText('Loading LalaVerse...')).toBeNull();
    expect(screen.getByTestId('world-setup-count')).toBeTruthy();
  });

  test('the State tab holds World State and Tensions only; setup is gone from it', async () => {
    renderAt('/universe?tab=state');
    await screen.findByText('World State');
    expect(screen.getByText('Tensions')).toBeTruthy();
    expect(screen.queryByText('Setup Progress')).toBeNull();
    expect(screen.queryByTestId('world-setup-count')).toBeNull();
  });

  test('?tab=bible&sub=decisions opens the Show Bible on Decisions, no page heading; its tabs write ?sub= and keep the hub tab', async () => {
    renderAt('/universe?tab=bible&sub=decisions');
    expect(screen.getByRole('tab', { name: /^Show Bible/ }).getAttribute('aria-current')).toBe('page');
    const decisions = await screen.findByRole('button', { name: /Decisions/ });
    expect(decisions.style.fontWeight).toBe('700');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Guard/ }));
    expect(screen.getByRole('button', { name: /Guard/ }).style.fontWeight).toBe('700');
    // The hub tab survives the page's own tab switch.
    expect(screen.getByRole('tab', { name: /^Show Bible/ }).getAttribute('aria-current')).toBe('page');
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
