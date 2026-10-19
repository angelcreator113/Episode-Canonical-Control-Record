/**
 * /this-week (Evoni, 2026-10-19): the book's steps live on each episode's
 * Results › Story now (components/Episodes/EpisodeBookSteps); the old route
 * opens the episode that still owes something there.
 */
import React from 'react';
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
import api from '../services/api';
import ThisWeekPage, { storyTabPath } from './ThisWeekPage';
import { rememberShow } from '../utils/activeShow';

const EP1 = { id: 'e1', episode_number: 1, title: 'The Gala', short_story: { id: 'st1', has_beat11: true }, chapter: { id: 'c1', written: true } };
const EP2 = { id: 'e2', episode_number: 2, title: 'The Brunch', short_story: null, chapter: null };
let ledger;
let books;

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach((fn) => fn.mockReset());
  rememberShow('s1');
  ledger = { show_id: 's1', episodes: [EP1, EP2], owed: {}, transfer: null };
  books = [{ id: 'b1', title: 'Before Lala' }];
  vi.mocked(api.get).mockImplementation(async (url, opts) => {
    if (url === '/api/v1/shows') return { data: { success: true, data: [{ id: 's1', name: 'Styling Adventures' }] } };
    if (url === '/api/v1/storyteller/books') return { data: { books: opts?.params?.show_id ? [] : books } };
    if (url === '/api/v1/book-from-show/books/b1/ledger') return { data: ledger };
    throw new Error(`unexpected ${url}`);
  });
});

function Where() {
  const loc = useLocation();
  return <p>at {loc.pathname}{loc.search}</p>;
}

const renderIt = () => render(
  <MemoryRouter initialEntries={['/this-week']}>
    <Routes>
      <Route path="/this-week" element={<ThisWeekPage />} />
      <Route path="/episodes/:id" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

test("opens the episode that still owes something on its Results › Story", async () => {
  expect(storyTabPath('e2')).toBe('/episodes/e2?tab=story');
  renderIt();
  expect(await screen.findByText('at /episodes/e2?tab=story')).toBeTruthy();
});

test('no episodes yet says so', async () => {
  ledger = { ...ledger, episodes: [] };
  renderIt();
  expect(await screen.findByText('This show has no episodes yet.')).toBeTruthy();
});

test('no book yet says so', async () => {
  books = [];
  renderIt();
  expect(await screen.findByText('No book yet. Make one in the Universe, then come back.')).toBeTruthy();
});

test('the app still mounts /this-week, and the sidebar no longer lists it', () => {
  const app = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8');
  expect(app).toMatch(/<Route path="\/this-week" element=\{<ThisWeekPage \/>\} \/>/);
  const sidebar = readFileSync(resolve(process.cwd(), 'src/components/layout/Sidebar.jsx'), 'utf8');
  expect(sidebar).not.toMatch(/route: '\/this-week'/);
});
