/**
 * The Sidebar has no Producer Mode row (Evoni, 2026-10-05): opening a show
 * is Producer Mode (/shows/:id redirects there), so Shows is the one way
 * in, and its list puts the active show (utils/activeShow) first.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Evoni', email: 'e@x.dev' }, logout: vi.fn() }) }));

import api from '../../services/api';
import Sidebar from './Sidebar';
import { rememberShow } from '../../utils/activeShow';

const SHOWS = [{ id: 'show-a', name: 'Another Show' }, { id: 'show-b', name: 'Styling Adventures' }];
const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><Sidebar isOpen onClose={() => {}} /></MemoryRouter>);
const listed = () => [...document.querySelectorAll('.ps-subnav-item')].map((a) => a.textContent);

describe('Sidebar: no Producer Mode row; Shows leads with the active show', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockImplementation(async (url) => (url.endsWith('/shows') ? { data: { data: SHOWS } } : { data: {} }));
  });

  test('there is no Producer Mode row', async () => {
    renderAt('/');
    await screen.findByText('Shows');
    expect(screen.queryByText('Producer Mode')).toBeNull();
  });

  test('on a show\'s page, that show heads the Shows list and opens its workspace', async () => {
    renderAt('/shows/show-b/world');
    await waitFor(() => expect(listed().length).toBe(2));
    expect(listed()[0]).toContain('Styling Adventures');
    expect(document.querySelector('.ps-subnav-item').getAttribute('href')).toBe('/shows/show-b');
  });

  test('elsewhere, the show last opened heads the list', async () => {
    rememberShow('show-b');
    renderAt('/');
    fireEvent.click(await screen.findByText('Shows'));
    await waitFor(() => expect(listed().length).toBe(2));
    expect(listed()[0]).toContain('Styling Adventures');
  });
});
