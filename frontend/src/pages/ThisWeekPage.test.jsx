/**
 * "This week's episode" (Evoni, 2026-10-15): one episode through episode,
 * short story, beat 11 piece and chapter, opening on the first episode that
 * still owes something.
 */
import React from 'react';
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
import api from '../services/api';
import ThisWeekPage, { episodeToOpen } from './ThisWeekPage';
import { rememberShow } from '../utils/activeShow';

const EP1 = { id: 'e1', episode_number: 1, title: 'The Gala', status: 'published', short_story: { id: 'st1', status: 'draft', word_count: 2400, has_beat11: true }, chapter: { id: 'c1', title: 'One', written: true } };
const EP2 = { id: 'e2', episode_number: 2, title: 'The Brunch', status: 'draft', short_story: null, chapter: null };
let ledger;

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach((fn) => fn.mockReset());
  rememberShow('s1');
  ledger = { show_id: 's1', episodes: [EP1, EP2], owed: { short_stories: 1, beat11: 0, chapters: 1 }, transfer: null };
  vi.mocked(api.get).mockImplementation(async (url, opts) => {
    if (url === '/api/v1/shows') return { data: { success: true, data: [{ id: 's1', name: 'Styling Adventures' }] } };
    if (url === '/api/v1/storyteller/books') return { data: { books: opts?.params?.show_id ? [] : [{ id: 'b1', title: 'Before Lala' }] } };
    if (url === '/api/v1/book-from-show/books/b1/ledger') return { data: ledger };
    if (url.endsWith('/beat11-excerpt')) return { data: { excerpt: null } };
    throw new Error(`unexpected ${url}`);
  });
});

const renderIt = () => render(
  <MemoryRouter initialEntries={['/this-week']}>
    <Routes>
      <Route path="/this-week" element={<ThisWeekPage />} />
      <Route path="/chapter/:bookId/:chapterId" element={<div>write mode</div>} />
    </Routes>
  </MemoryRouter>,
);

test('opens on the first episode that still owes something', () => {
  expect(episodeToOpen([EP1, EP2]).id).toBe('e2');
  expect(episodeToOpen([EP1]).id).toBe('e1');
  expect(episodeToOpen([])).toBeNull();
});

test('walks the episode: the book with no show is used, episode 2 opens, its steps say what is owed', async () => {
  renderIt();
  expect(await screen.findByText('The episode: The Brunch')).toBeTruthy();
  expect(screen.getByText('Write the short story')).toBeTruthy();
  expect(screen.getByText('Write the short story first.')).toBeTruthy();
  expect(screen.getByText('Start the chapter')).toBeTruthy();
  expect(screen.getByText(/The book owes 1 short story, 0 beat 11 pieces and 1 chapter\. The consciousness transfer is not placed yet\./)).toBeTruthy();
});

test('writes the short story, then shows the beat 11 step for it', async () => {
  vi.mocked(api.post).mockImplementation(async () => {
    ledger = { ...ledger, episodes: [EP1, { ...EP2, short_story: { id: 'st2', status: 'draft', word_count: 2100, has_beat11: false } }] };
    return { data: { success: true } };
  });
  renderIt();
  fireEvent.click(await screen.findByText('Write the short story'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/s1/episodes/e2/generate-story', { format: 'short_story' }, { timeout: 180000 }));
  expect(await screen.findByText('Cut the beat 11 piece')).toBeTruthy();
  expect(screen.getByText('Read it on Stories')).toBeTruthy();
});

test('starts the chapter tied to the episode and opens it in Write Mode', async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { chapter: { id: 'c2' } } });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
  renderIt();
  fireEvent.click(await screen.findByText('Start the chapter'));
  await screen.findByText('write mode');
  expect(api.post).toHaveBeenCalledWith('/api/v1/storyteller/books/b1/chapters', { title: 'Episode 2: The Brunch' });
  expect(api.put).toHaveBeenCalledWith('/api/v1/book-from-show/chapters/c2/episode', { episode_id: 'e2' });
});

test('a failure is shown', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(api.post).mockRejectedValue({ response: { data: { error: 'AI rate limit exceeded' } } });
  renderIt();
  fireEvent.click(await screen.findByText('Write the short story'));
  expect((await screen.findByRole('alert')).textContent).toBe('AI rate limit exceeded');
});

test('the app mounts it and the sidebar links it', () => {
  const app = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8');
  expect(app).toMatch(/<Route path="\/this-week" element=\{<ThisWeekPage \/>\} \/>/);
  const sidebar = readFileSync(resolve(process.cwd(), 'src/components/layout/Sidebar.jsx'), 'utf8');
  expect(sidebar).toMatch(/label: "This week's episode", route: '\/this-week'/);
});
