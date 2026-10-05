/**
 * Producer Mode names its show: GET /shows/:id answers { success, data },
 * and the show's name is `name` (it read `title` off the envelope, so the
 * header always said "Show", and the wardrobe's "Require all slots" never
 * saw the saved setting). The show card names the show and switches show
 * keeping the section; the pill tabs and sub-tabs mark the section.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';
import { rememberedShowId } from '../utils/activeShow';

const SHOWS = [
  { id: 'show-1', name: 'Styling Adventures', metadata: { required_slots: ['outfit', 'shoes', 'jewelry', 'accessories', 'fragrance'] } },
  { id: 'show-2', name: 'Another Show', metadata: {} },
];
let path;
function Where() { path = `${useLocation().pathname}${useLocation().search}`; return null; }
const renderAt = (url) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes><Route path="/shows/:id/world" element={<><WorldAdmin /><Where /></>} /></Routes>
  </MemoryRouter>,
);

describe('WorldAdmin: which show, which section', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows') return { data: { success: true, data: SHOWS } };
      const one = SHOWS.find((s) => url === `/api/v1/shows/${s.id}`);
      if (one) return { data: { success: true, data: one } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  test('the show card names the show, the tabs mark the section; the show becomes the active show', async () => {
    renderAt('/shows/show-1/world?tab=scene-sets');
    await waitFor(() => expect(screen.getByTestId('wa-show-name').textContent).toBe('Styling Adventures'));
    await waitFor(() => expect(document.querySelector('.wa-tab[aria-current="page"] .wa-tab-label')?.textContent).toBe('Assets'));
    expect(document.querySelector('.wa-subtab[aria-current="page"]')?.textContent).toBe('Scene Sets');
    expect(screen.getByRole('link', { name: 'Edit show' }).getAttribute('href')).toBe('/shows/show-1/edit');
    expect(rememberedShowId()).toBe('show-1');
  });

  test('the switcher opens the other show on the same section', async () => {
    renderAt('/shows/show-1/world?tab=scene-sets');
    const select = await screen.findByLabelText('Show');
    await waitFor(() => expect(select.querySelectorAll('option')).toHaveLength(2));
    fireEvent.change(select, { target: { value: 'show-2' } });
    await waitFor(() => expect(path).toBe('/shows/show-2/world?tab=scene-sets'));
    await waitFor(() => expect(screen.getByTestId('wa-show-name').textContent).toBe('Another Show'));
  });

  test('the wardrobe\'s "Require all slots" reads the saved setting', async () => {
    renderAt('/shows/show-1/world?tab=wardrobe-items');
    expect(await screen.findByRole('button', { name: '✓ All slots required' })).toBeTruthy();
  });
});
