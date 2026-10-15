/**
 * Generate All Formats says which formats failed (2026-10-15). A failed
 * format was swallowed and the toast counted only the successes.
 */
import React from 'react';
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import StoriesPage from './StoriesPage';
import { rememberShow } from '../utils/activeShow';

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach((fn) => fn.mockReset());
  rememberShow('show-a');
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/shows') return { data: { success: true, data: [{ id: 'show-a', name: 'Show' }] } };
    if (url.includes('/stories')) return { data: { data: [{ id: 's1', episode_id: 'ep-1', title: 'Episode One', format: 'recap', status: 'draft' }] } };
    return { data: { data: [] } };
  });
});

test('a failed format is named, not silently dropped', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(api.post).mockImplementation(async (_url, { format }) => {
    if (format === 'snippet') throw new Error('rate limited');
    return { data: {} };
  });
  render(<MemoryRouter initialEntries={['/stories']}><StoriesPage /></MemoryRouter>);
  fireEvent.click(await screen.findByText('✦ Generate All Formats'));
  expect(await screen.findByText('3 of 4 stories generated. Failed: snippet')).toBeTruthy();
});
