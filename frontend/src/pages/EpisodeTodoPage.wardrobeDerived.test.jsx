/**
 * T7 (§8(bb); Task #2307): the Run Sheet's wardrobe rows show what Lala's
 * outfit fills and have no toggle; a click sends nothing.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EpisodeTodoPage from './EpisodeTodoPage';

const TODO = {
  show_id: 'show-1',
  tasks: [
    { slot: 'dress', label: 'Outfit for the Gala', required: true, completed: true },
    { slot: 'shoes', label: 'Shoes', required: true, completed: false },
  ],
  completion: { total: 2, completed: 1 },
};

describe('Run Sheet: wardrobe completion comes from the outfit (T7)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes/ep-1/todo') return { data: { data: TODO } };
      if (url === '/api/v1/episodes/ep-1/todo/social') return { data: { social_tasks: [] } };
      return { data: {} };
    });
  });

  test('rows show the outfit state and a click sends nothing', async () => {
    render(
      <MemoryRouter initialEntries={['/episodes/ep-1/todo']}>
        <Routes>
          <Route path="/episodes/:episodeId/todo" element={<EpisodeTodoPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Outfit for the Gala')).toBeTruthy();
    expect(screen.getByTestId('wardrobe-completion-note').textContent).toMatch(/Filled from Lala's outfit/);
    expect(screen.getByLabelText('Filled by the outfit')).toBeTruthy();
    expect(screen.getByLabelText('Not filled yet')).toBeTruthy();

    fireEvent.click(screen.getByTestId('wardrobe-task-shoes'));
    fireEvent.click(screen.getByText('Shoes'));
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Not filled yet')).toBeTruthy();
  });
});
