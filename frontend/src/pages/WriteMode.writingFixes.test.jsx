/**
 * WriteMode writing-tools fixes (2026-10-15).
 *
 * - The split reference view read GET /storyteller/chapters/:id, a route that
 *   does not exist, so it always said "Could not load reference chapter". It
 *   now takes the chapter from the book's chapters.
 * - A failed draft save was swallowed: the exit modal still said "Your draft
 *   is saved" and Save & Leave left anyway. A failed save now keeps the
 *   writer on the page and says so.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../utils/authedFetch', () => ({ authedFetch: vi.fn() }));

import apiClient from '../services/api';
import WriteMode from './WriteMode';

const BOOK = {
  id: 'b1', title: 'Book',
  chapters: [
    { id: 'c1', title: 'One', sort_order: 1, draft_prose: 'She opened the door.' },
    { id: 'c2', title: 'Two', sort_order: 2, draft_prose: 'The rain kept on.' },
  ],
};

const renderIt = () => render(
  <MemoryRouter initialEntries={['/chapter/b1/c1']}>
    <Routes>
      <Route path="/chapter/:bookId/:chapterId" element={<WriteMode />} />
      <Route path="/book/:bookId" element={<div>book page</div>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  window.matchMedia = window.matchMedia || ((query) => ({
    matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  }));
  Object.values(apiClient).forEach((fn) => fn.mockReset());
  vi.mocked(apiClient.get).mockImplementation(async (url) => (
    url === '/api/v1/storyteller/books/b1' ? { data: { book: BOOK } } : { data: [] }
  ));
  vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
  vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
});

describe('WriteMode: the reference chapter', () => {
  test('shows the other chapter from the book, with no per-chapter GET', async () => {
    const { container } = renderIt();
    const select = await waitFor(() => {
      const el = container.querySelector('.wm-reference-select');
      if (!el) throw new Error('no reference select yet');
      return el;
    });
    fireEvent.change(select, { target: { value: 'c2' } });
    await waitFor(() => expect(container.querySelector('.wm-reference-prose')?.textContent).toBe('The rain kept on.'));
    const gets = vi.mocked(apiClient.get).mock.calls.map(([u]) => u);
    expect(gets).not.toContain('/api/v1/storyteller/chapters/c2');
  });
});

describe('WriteMode: a failed save is not called saved', () => {
  test('Save & Leave stays on the page when the save fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(apiClient.post).mockImplementation(async (url) => {
      if (url.endsWith('/save-draft')) throw new Error('network down');
      return { data: {} };
    });
    const { container } = renderIt();
    const textarea = await waitFor(() => {
      const el = container.querySelector('textarea');
      if (!el) throw new Error('no editor yet');
      return el;
    });
    fireEvent.change(textarea, { target: { value: 'She opened the door. Then she left.' } });
    fireEvent.click(container.querySelector('.wm-back-btn'));
    expect(screen.getByText('Your latest changes will be saved before you leave.')).toBeTruthy();
    fireEvent.click(screen.getByText('Save & Leave'));
    await waitFor(() => expect(screen.getByText(/Draft not saved/)).toBeTruthy());
    expect(screen.queryByText('book page')).toBeNull();
  });

  test('Save & Leave leaves once the save succeeds', async () => {
    const { container } = renderIt();
    const textarea = await waitFor(() => {
      const el = container.querySelector('textarea');
      if (!el) throw new Error('no editor yet');
      return el;
    });
    fireEvent.change(textarea, { target: { value: 'She opened the door. Then she left.' } });
    fireEvent.click(container.querySelector('.wm-back-btn'));
    fireEvent.click(screen.getByText('Save & Leave'));
    await screen.findByText('book page');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/storyteller/chapters/c1/save-draft', { draft_prose: 'She opened the door. Then she left.' });
  });
});
