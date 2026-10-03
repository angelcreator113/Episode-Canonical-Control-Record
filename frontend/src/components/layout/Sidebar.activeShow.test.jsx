/**
 * Producer Mode in the Sidebar opens the active show (utils/activeShow), not
 * the first show the API returns; with several shows and none active, it
 * opens the shows list to choose one.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Evoni', email: 'e@x.dev' }, logout: vi.fn() }) }));

import api from '../../services/api';
import Sidebar from './Sidebar';
import { rememberShow } from '../../utils/activeShow';

const SHOWS = [{ id: 'show-a', name: 'Another Show' }, { id: 'show-b', name: 'Styling Adventures' }];
const producer = () => screen.getAllByRole('link').find((a) => a.textContent.includes('Producer Mode'));
const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><Sidebar isOpen onClose={() => {}} /></MemoryRouter>);

describe('Sidebar: Producer Mode opens the active show', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockImplementation(async (url) => (url.endsWith('/shows') ? { data: { data: SHOWS } } : { data: {} }));
  });

  test('on a show\'s page, that show', async () => {
    renderAt('/shows/show-b');
    await waitFor(() => expect(producer()).toBeTruthy());
    expect(producer().getAttribute('href')).toBe('/shows/show-b/world?tab=overview');
    expect(producer().textContent).toContain('Styling Adventures');
  });

  test('elsewhere, the show last opened, not the first one returned', async () => {
    rememberShow('show-b');
    renderAt('/');
    await waitFor(() => expect(producer()).toBeTruthy());
    expect(producer().getAttribute('href')).toBe('/shows/show-b/world?tab=overview');
  });

  test('several shows and none active: the shows list, to choose one', async () => {
    renderAt('/');
    await waitFor(() => expect(producer()).toBeTruthy());
    expect(producer().getAttribute('href')).toBe('/shows');
    expect(producer().textContent).toContain('Choose a show');
  });
});
