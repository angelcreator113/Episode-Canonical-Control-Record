/**
 * Composition Library reads the real index (audit TRUTH-04, 2026-10-03):
 * the same compositions CompositionDetail opens, by their real ids, with
 * an honest empty state, a failed read with Retry, and Delete that
 * deletes. No sample records, favorites or tags.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import CompositionLibrary, { compositionTitle, compositionEpisode } from './CompositionLibrary';

const COMPS = [
  { id: 'c-1', name: 'Gala night', description: 'Lala centre, gold text', status: 'approved', current_version: 3, is_primary: true, updated_at: '2026-10-01T10:00:00Z',
    episode: { id: 'ep-1', title: 'Velvet Hour', episode_number: 6, show: { name: 'Styling Adventures' } },
    outputs: [{ id: 'o1', format: 'youtube', status: 'READY', image_url: 'https://x/o1.jpg' }, { id: 'o2', format: 'instagram', status: 'FAILED', image_url: null }] },
  { id: 'c-2', name: null, status: 'draft', current_version: 1, is_primary: false, updated_at: '2026-09-20T10:00:00Z',
    episode: { id: 'ep-2', title: 'Capsule Wardrobe', episode_number: 5 }, outputs: [] },
];
const renderIt = () => render(
  <MemoryRouter initialEntries={['/library']}>
    <Routes>
      <Route path="/library" element={<CompositionLibrary />} />
      <Route path="/compositions/:id" element={<div data-testid="composition-detail">detail</div>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('CompositionLibrary', () => {
  test('lists the real compositions by their real ids; Open opens the detail', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { status: 'SUCCESS', data: COMPS, count: 2 } });
    renderIt();
    expect((await screen.findByTestId('composition-count')).textContent).toBe('2 compositions');
    expect(api.get).toHaveBeenCalledWith('/api/v1/compositions');
    const gala = screen.getByTestId('composition-c-1');
    expect(gala.textContent).toContain('Gala night');
    expect(gala.textContent).toContain('Ep. 6: Velvet Hour · Styling Adventures');
    expect(gala.textContent).toContain('1 of 2 outputs ready');
    expect(gala.textContent).toContain('APPROVED · v3');
    expect(gala.querySelector('img').getAttribute('src')).toBe('https://x/o1.jpg');
    const untitled = screen.getByTestId('composition-c-2');
    expect(untitled.textContent).toContain('Capsule Wardrobe');
    expect(untitled.textContent).toContain('No outputs yet');
    expect(screen.queryByText(/Standard Intro Layout|Used in 12 episodes/)).toBeNull();

    fireEvent.click(within(gala).getByRole('button', { name: 'Open' }));
    expect(await screen.findByTestId('composition-detail')).toBeTruthy();
  });

  test('Primary shows only the primary ones; search matches name, description and episode', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: COMPS } });
    renderIt();
    await screen.findByTestId('composition-c-2');
    fireEvent.click(screen.getByRole('button', { name: '⭐ Primary' }));
    expect(screen.queryByTestId('composition-c-2')).toBeNull();
    expect(screen.getByTestId('composition-c-1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'All Compositions' }));
    fireEvent.change(screen.getByLabelText('Search compositions'), { target: { value: 'capsule' } });
    expect(screen.queryByTestId('composition-c-1')).toBeNull();
    expect(screen.getByTestId('composition-c-2')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search compositions'), { target: { value: 'nothing here' } });
    expect(screen.getByTestId('composition-empty').textContent).toContain('No compositions match');
  });

  test('none saved is an honest empty state; a failed read is an error with Retry', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { response: { status: 500, data: { error: 'Failed to get compositions', message: 'db down' } } }))
      .mockResolvedValueOnce({ data: { data: [] } });
    renderIt();
    const failed = await screen.findByTestId('composition-load-failed');
    expect(failed.textContent).toContain('Could not load the compositions. Failed to get compositions');
    expect(screen.queryByTestId('composition-empty')).toBeNull();
    fireEvent.click(within(failed).getByRole('button', { name: 'Retry' }));
    expect((await screen.findByTestId('composition-empty')).textContent).toContain('No compositions yet');
  });

  test('Delete deletes the record and removes the card', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: COMPS } });
    vi.mocked(api.delete).mockResolvedValue({ data: { status: 'SUCCESS' } });
    renderIt();
    const untitled = await screen.findByTestId('composition-c-2');
    fireEvent.click(within(untitled).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByTestId('composition-c-2')).toBeNull());
    expect(api.delete).toHaveBeenCalledWith('/api/v1/compositions/c-2');
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  test('titles and episode lines come from the record', () => {
    expect(compositionTitle({ name: 'A' })).toBe('A');
    expect(compositionTitle({ episode: { title: 'Ep title' } })).toBe('Ep title');
    expect(compositionTitle({})).toBe('Untitled composition');
    expect(compositionEpisode({ episode: { episode_number: 3, title: 'T', show: { name: 'S' } } })).toBe('Ep. 3: T · S');
    expect(compositionEpisode({})).toBeNull();
  });
});
