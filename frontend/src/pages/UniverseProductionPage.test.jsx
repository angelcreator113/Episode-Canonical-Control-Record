/**
 * /universe/production opens the active show's Producer Mode (audit IA-01,
 * 2026-10-03): Episodes → Production for the remembered or only show, a
 * choice with several and none active, the shows list with none, and a
 * failed read says so. It renders no dashboard of its own.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../services/api';
import UniverseProductionPage, { showProductionPath } from './UniverseProductionPage';
import { rememberShow } from '../utils/activeShow';

const SHOWS = [{ id: 'show-a', name: 'Another Show' }, { id: 'show-b', name: 'Styling Adventures' }];
const Where = () => { const l = useLocation(); return <div data-testid="where">{l.pathname}{l.search}</div>; };
const renderIt = () => render(
  <MemoryRouter initialEntries={['/universe/production']}>
    <Routes>
      <Route path="/universe/production" element={<UniverseProductionPage />} />
      <Route path="/shows/:id/world" element={<Where />} />
      <Route path="/shows" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(api.get).mockReset();
  vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: SHOWS } });
});

describe('/universe/production', () => {
  test('the remembered show opens on Episodes → Production', async () => {
    rememberShow('show-b');
    renderIt();
    expect((await screen.findByTestId('where')).textContent).toBe('/shows/show-b/world?tab=episodes-production');
    expect(showProductionPath('show-b')).toBe('/shows/show-b/world?tab=episodes-production');
  });

  test('several shows and none active: asks which, then opens it', async () => {
    renderIt();
    await screen.findByTestId('show-chooser');
    fireEvent.click(screen.getByTestId('show-chooser-show-a'));
    expect((await screen.findByTestId('where')).textContent).toBe('/shows/show-a/world?tab=episodes-production');
  });

  test('no shows: the shows list', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
    renderIt();
    expect((await screen.findByTestId('where')).textContent).toBe('/shows');
  });

  test('a failed shows read: an alert, no redirect', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 500 } }));
    renderIt();
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByTestId('where')).toBeNull();
    expect(screen.queryByTestId('show-chooser')).toBeNull();
    spy.mockRestore();
  });
});
