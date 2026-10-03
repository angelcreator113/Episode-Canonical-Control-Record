/**
 * The LalaVerse overview opens on the active show (audit CTX-01,
 * 2026-10-03): with several shows and none active it asks which, and reads
 * nothing until one is chosen; it never takes the first show returned.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import UniversePage from './UniversePage';
import { rememberShow, rememberedShowId } from '../utils/activeShow';

const SHOWS = [{ id: 'show-a', name: 'Another Show' }, { id: 'show-b', name: 'Styling Adventures', description: 'The show.' }];
const showReads = () => vi.mocked(api.get).mock.calls.map(([u]) => u).filter((u) => /show-[ab]/.test(u));
const renderIt = () => render(<MemoryRouter initialEntries={['/universe']}><UniversePage /></MemoryRouter>);

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => (
    url === '/api/v1/shows' ? { data: { success: true, data: SHOWS } } : { data: { data: [], events: [], registries: [], books: [] } }
  ));
});

describe('UniversePage: the active show', () => {
  test('several shows and none active: asks which, reads nothing, then opens the chosen one', async () => {
    renderIt();
    const chooser = await screen.findByTestId('show-chooser');
    expect(chooser.textContent).toContain('Another Show');
    expect(chooser.textContent).toContain('Styling Adventures');
    expect(showReads()).toEqual([]);

    fireEvent.click(screen.getByTestId('show-chooser-show-b'));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Styling Adventures'));
    expect(showReads().every((u) => u.includes('show-b'))).toBe(true);
    expect(showReads().length).toBeGreaterThan(0);
    expect(rememberedShowId()).toBe('show-b');
    expect(screen.queryByTestId('show-chooser')).toBeNull();
  });

  test('the remembered show opens without asking', async () => {
    rememberShow('show-b');
    renderIt();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Styling Adventures'));
    expect(screen.queryByTestId('show-chooser')).toBeNull();
    expect(showReads().some((u) => u.includes('show-a'))).toBe(false);
  });

  test('a failed shows read says so instead of describing nothing', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows') throw Object.assign(new Error('boom'), { response: { status: 500 } });
      return { data: {} };
    });
    renderIt();
    expect((await screen.findByRole('alert')).textContent).toContain('The shows could not be loaded');
    spy.mockRestore();
  });
});
