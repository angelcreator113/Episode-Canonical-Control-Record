/**
 * A to-do read that fails is not "no list yet" (Evoni, 2026-11-12): it says
 * so and offers Retry, and never Generate. A read that succeeds with no list
 * keeps the empty state and its Generate button as they were.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import EpisodeTodoList from './EpisodeTodoList';

const failing = () => Promise.reject(Object.assign(new Error('Network Error'), { response: { status: 500 } }));

describe('EpisodeTodoList: a failed read is not an empty list', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('the read fails: it says so with Retry, and Generate is not offered', async () => {
    vi.mocked(api.get).mockImplementation(failing);
    render(<EpisodeTodoList episodeId="ep-1" showId="show-1" />);
    expect((await screen.findByTestId('todo-load-failed')).textContent).toContain("Couldn't load this episode's to-do lists. Nothing was changed.");
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.queryByText('No to-do lists yet')).toBeNull();
    expect(screen.queryByRole('button', { name: /Generate/ })).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  });

  test('Retry reads again; a read that then succeeds with no list shows the empty state and its Generate, as before', async () => {
    vi.mocked(api.get).mockImplementation(failing);
    render(<EpisodeTodoList episodeId="ep-1" showId="show-1" />);
    await screen.findByTestId('todo-load-failed');
    vi.mocked(api.get).mockImplementation(async (url) => (url.endsWith('/todo') ? { data: { data: null } } : { data: {} }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No to-do lists yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generate Wardrobe Shopping List' })).toBeTruthy();
    expect(screen.queryByTestId('todo-load-failed')).toBeNull();
  });

  test('a first read that succeeds with no list: the empty state, unchanged', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url.endsWith('/todo') ? { data: { data: null } } : { data: {} }));
    render(<EpisodeTodoList episodeId="ep-1" showId="show-1" />);
    expect(await screen.findByText('No to-do lists yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generate Wardrobe Shopping List' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});
