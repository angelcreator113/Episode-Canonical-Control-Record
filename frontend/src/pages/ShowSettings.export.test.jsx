/**
 * ShowSettings "Export JSON" carries every episode and wardrobe piece (the
 * audit's "Pagination and totals are inconsistent", part 3). It read
 * `episodes` from the episodes API, which answers `data`, so an export held
 * no episodes; and it stopped at the first 200 episodes and 500 pieces.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import ShowSettings from './ShowSettings';

const SHOW_ID = 'show-1';
const rows = (prefix, from, n) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${from + i}` }));

describe('ShowSettings: Export JSON', () => {
  let exported;
  beforeEach(() => {
    exported = null;
    vi.mocked(api.get).mockImplementation(async (url) => {
      const q = new URL(url, 'http://x').searchParams;
      const page = Number(q.get('page') || 1);
      if (url.startsWith('/api/v1/episodes?')) {
        // 150 episodes, 100 a page.
        return { data: { data: page === 1 ? rows('ep', 0, 100) : rows('ep', 100, 50), pagination: { total: 150 } } };
      }
      if (url.startsWith('/api/v1/wardrobe?')) {
        // 260 pieces, 200 a page.
        return { data: { data: page === 1 ? rows('w', 0, 200) : rows('w', 200, 60), pagination: { total: 260 } } };
      }
      if (url.endsWith('/events')) return { data: { events: [{ id: 'ev-1' }] } };
      if (url.endsWith('/goals')) return { data: { goals: [] } };
      return { data: { show: { id: SHOW_ID, title: 'Styling Adventures' } } };
    });
    // jsdom's Blob cannot be read back, so keep what the export put in it.
    vi.stubGlobal('Blob', class { constructor(parts) { exported = parts.join(''); } });
    global.URL.createObjectURL = vi.fn(() => 'blob:x');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  test('the export holds every episode and every wardrobe piece', async () => {
    render(
      <MemoryRouter initialEntries={[`/shows/${SHOW_ID}/settings?tab=advanced`]}>
        <Routes><Route path="/shows/:id/settings" element={<ShowSettings />} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Export JSON/ }));
    await waitFor(() => expect(exported).not.toBeNull());
    const payload = JSON.parse(exported);
    expect(payload.episodes).toHaveLength(150);
    expect(payload.wardrobe).toHaveLength(260);
    expect(payload.events).toHaveLength(1);
  });
});
