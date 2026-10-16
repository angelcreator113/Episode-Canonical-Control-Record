/**
 * Beat 11 (Event Outcome) plays an animated piece of the episode's short
 * story (Evoni, 2026-10-15; docs/CANON.md). The piece cut on the Stories page
 * shows on the Scene Planner's beat 11, marked for animation.
 */
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../services/api';
import ScenePlannerPage from './ScenePlannerPage';

const beat = (n) => ({ id: `p${n}`, beat_number: n, beat_name: `Beat ${n}`, locked: false, location: { role: 'event', kinds: [], image: null } });
let piece;

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  piece = { text: 'The lights went out at nine.', why: 'Who took the necklace?' };
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episode-brief/ep-1') return { data: { data: { status: 'draft' } } };
    if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: [beat(10), beat(11)] } };
    if (url === '/api/v1/book-from-show/episodes/ep-1/beat11') return { data: { excerpt: piece } };
    return { data: {} };
  });
});

const renderPage = () => render(
  <MemoryRouter initialEntries={['/episodes/ep-1/plan']}>
    <Routes><Route path="/episodes/:episodeId/plan" element={<ScenePlannerPage />} /></Routes>
  </MemoryRouter>,
);

test("beat 11 shows the short story's piece, for animation; no other beat does", async () => {
  renderPage();
  const block = await screen.findByTestId('beat11-piece');
  expect(block.textContent).toContain('From the short story · for animation');
  expect(block.textContent).toContain('The lights went out at nine.');
  expect(block.textContent).toContain('Leaves them asking: Who took the necklace?');
  expect(screen.getByTestId('beat-card-11').contains(block)).toBe(true);
  expect(screen.getAllByTestId('beat11-piece')).toHaveLength(1);
});

test('no piece yet: beat 11 is as before', async () => {
  piece = null;
  renderPage();
  await screen.findByTestId('beat-card-11');
  expect(screen.queryByTestId('beat11-piece')).toBeNull();
});
