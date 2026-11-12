/**
 * The Sidebar's show list when it doesn't load (Evoni, 2026-11-12): it says
 * so with Retry, and does not say "No shows yet". A read that succeeds with
 * no shows keeps "No shows yet".
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Evoni', email: 'e@x.dev' }, logout: vi.fn() }) }));

import api from '../../services/api';
import Sidebar from './Sidebar';

const SHOWS = [{ id: 'show-a', name: 'Styling Adventures' }];
const showsAnswer = (answer) => vi.mocked(api.get).mockImplementation(async (url) => {
  if (!url.endsWith('/shows')) return { data: {} };
  if (answer === 'fail') throw new Error('Network Error');
  return { data: { data: answer } };
});
// On a show's page the Shows list is open.
const renderOpen = () => render(<MemoryRouter initialEntries={['/shows/show-a/world']}><Sidebar isOpen onClose={() => {}} /></MemoryRouter>);

describe('Sidebar: a failed shows read is not "No shows yet"', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('the read fails: it says so with Retry; Retry then lists the shows', async () => {
    showsAnswer('fail');
    renderOpen();
    const failed = await screen.findByTestId('sidebar-shows-failed');
    expect(failed.textContent).toContain("Couldn't load shows.");
    expect(screen.queryByText('No shows yet')).toBeNull();

    showsAnswer(SHOWS);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect([...document.querySelectorAll('.ps-subnav-item')].map((a) => a.textContent).join(' ')).toContain('Styling Adventures'));
    expect(screen.queryByTestId('sidebar-shows-failed')).toBeNull();
  });

  test('a read that succeeds with no shows: "No shows yet", unchanged', async () => {
    showsAnswer([]);
    renderOpen();
    expect(await screen.findByText('No shows yet')).toBeTruthy();
    expect(screen.queryByTestId('sidebar-shows-failed')).toBeNull();
  });
});
