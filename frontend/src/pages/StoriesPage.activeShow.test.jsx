/**
 * Stories opens on the active show (audit CTX-01, 2026-10-03): with several
 * shows and none active it asks which; it never loads the first show's
 * stories unasked.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import StoriesPage from './StoriesPage';
import { rememberShow } from '../utils/activeShow';

const SHOWS = [{ id: 'show-a', name: 'Another Show' }, { id: 'show-b', name: 'Styling Adventures' }];
const storyReads = () => vi.mocked(api.get).mock.calls.map(([u]) => u).filter((u) => u.includes('/stories'));
const renderIt = () => render(<MemoryRouter initialEntries={['/stories']}><StoriesPage /></MemoryRouter>);

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => (
    url === '/api/v1/shows' ? { data: { success: true, data: SHOWS } } : { data: { data: [] } }
  ));
});

describe('StoriesPage: the active show', () => {
  test('several shows and none active: asks which, then loads that show\'s stories', async () => {
    renderIt();
    await screen.findByTestId('show-chooser');
    expect(storyReads()).toEqual([]);
    fireEvent.click(screen.getByTestId('show-chooser-show-b'));
    await waitFor(() => expect(storyReads()).toEqual(['/api/v1/world/show-b/stories?limit=100']));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Styling Adventures');
  });

  test('the remembered show loads without asking', async () => {
    rememberShow('show-a');
    renderIt();
    await waitFor(() => expect(storyReads()).toEqual(['/api/v1/world/show-a/stories?limit=100']));
    expect(screen.queryByTestId('show-chooser')).toBeNull();
  });
});
