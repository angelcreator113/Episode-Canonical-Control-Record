/**
 * The Career Checklist is a view of the episode's one task list (T2,
 * §8(bb); Task #2294): it loads the saved list, labels each item's source,
 * and Generate shows the saved list the server returns.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeTodoList from './EpisodeTodoList';

const WARDROBE = {
  status: 'generated',
  tasks: [{ slot: 'dress', label: 'The dress', required: true, completed: false }],
  completion: { total: 1, completed: 0, all_required_done: false },
};
const SAVED = [
  { slot: 'deliverable_d-1', label: 'Arrive before the toast', deliverable_id: 'd-1', owed_to: 'host', task_source: 'host_requirement', required: true },
  { slot: 'deliverable_d-2', label: 'One reel in the coat', deliverable_id: 'd-2', owed_to: 'brand', task_source: 'brand_deliverable', required: true },
  { slot: 'grwm', label: 'Get Ready With Me', task_source: 'goal', required: false },
  { slot: 'career_social_post', label: 'Post before midnight', task_source: 'optional', required: false, generated_by: 'career' },
];

const row = (label) => screen.getByText(label).parentElement.parentElement;
const sourceOf = (label) => within(row(label)).getByTestId('task-source').textContent;

describe('Career Checklist: a view of the one task list (T2)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes/ep-1/todo') return { data: { data: WARDROBE } };
      if (url === '/api/v1/episodes/ep-1/todo/social') return { data: { success: true, social_tasks: SAVED } };
      return { data: {} };
    });
  });

  test('on load it shows the saved list, every item with its source', async () => {
    render(<EpisodeTodoList episodeId="ep-1" showId="show-1" />);
    fireEvent.click(await screen.findByText('💼 Career Checklist'));

    expect(await screen.findByText('Arrive before the toast')).toBeTruthy();
    expect(screen.queryByText('Generate Career Checklist')).toBeNull();
    expect(sourceOf('Arrive before the toast')).toBe('Host requirement');
    expect(sourceOf('One reel in the coat')).toBe('Brand deliverable');
    expect(sourceOf('Get Ready With Me')).toBe('Goal');
    expect(sourceOf('Post before midnight')).toBe('Optional idea');
    expect(screen.getByText(/4 tasks on the episode's list/)).toBeTruthy();
  });

  test('the saved checklist image comes back with the list (T4, Task #2300)', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes/ep-1/todo') return { data: { data: WARDROBE } };
      if (url === '/api/v1/episodes/ep-1/todo/social') {
        return { data: { success: true, social_tasks: SAVED, career_asset_url: 'https://cdn/career.png' } };
      }
      return { data: {} };
    });
    render(<EpisodeTodoList episodeId="ep-1" showId="show-1" />);
    fireEvent.click(await screen.findByText('💼 Career Checklist'));
    fireEvent.click(await screen.findByText('Preview Overlay'));
    expect(screen.getByAltText('Career list').getAttribute('src')).toBe('https://cdn/career.png');
  });

  test('with nothing saved it offers Generate; the result is the saved list', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes/ep-1/todo') return { data: { data: WARDROBE } };
      if (url === '/api/v1/episodes/ep-1/todo/social') return { data: { success: true, social_tasks: [] } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { tasks: SAVED, assetUrl: null } } });
    render(<EpisodeTodoList episodeId="ep-1" showId="show-1" />);
    fireEvent.click(await screen.findByText('💼 Career Checklist'));

    fireEvent.click(await screen.findByText('Generate Career Checklist'));
    expect(await screen.findByText('One reel in the coat')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/api/v1/episodes/ep-1/todo/generate-career', { showId: 'show-1' });
    expect(sourceOf('One reel in the coat')).toBe('Brand deliverable');
  });
});
