/**
 * A deliverable's task on the Run Sheet has no toggle (Evoni, 2026-10-26):
 * it is done when the deliverable is submitted in the deal's deliverables.
 * A click sends nothing; goals still tick.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EpisodeTodoPage from './EpisodeTodoPage';

const SOCIAL = [
  { slot: 'meet_stylist', label: 'Meet the stylist', task_source: 'goal', timing: 'during', completed: false },
  { slot: 'deliverable_d1', label: 'One reel in the coat', task_source: 'brand_deliverable', owed_to: 'brand', deliverable_id: 'd1', required: true, timing: 'during', completed: false },
];

describe('Run Sheet: a deliverable completes when it is submitted', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes/ep-1/todo') return { data: { data: { show_id: 'show-1', tasks: [], completion: { total: 0, completed: 0 } } } };
      if (url === '/api/v1/episodes/ep-1/todo/social') return { data: { social_tasks: SOCIAL } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, social_tasks: [{ ...SOCIAL[0], completed: true }, SOCIAL[1]] } });
  });

  const renderPage = () => render(
    <MemoryRouter initialEntries={['/episodes/ep-1/todo']}>
      <Routes>
        <Route path="/episodes/:episodeId/todo" element={<EpisodeTodoPage />} />
      </Routes>
    </MemoryRouter>
  );

  test("the deliverable's row says how it completes and a click sends nothing", async () => {
    renderPage();
    expect(await screen.findByText('One reel in the coat')).toBeTruthy();
    const row = screen.getByTestId('social-task-deliverable_d1');
    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('social-task-derived-deliverable_d1').textContent).toMatch(/submitted in the deal/);
    fireEvent.click(row);
    expect(api.post).not.toHaveBeenCalled();
  });

  test('a goal still ticks', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('social-task-meet_stylist'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/episodes/ep-1/todo/complete-social/meet_stylist', { completed: true }));
    expect(screen.getByTestId('social-task-meet_stylist').getAttribute('aria-disabled')).toBeNull();
  });
});
