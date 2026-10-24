/**
 * "Use career plan" on the Career Checklist (2026-10-24): the event's
 * approved career plan's "This event" goals added to the episode's task
 * list within the goal limit; what did not fit is named; a refusal is said.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeTodoList from './EpisodeTodoList';

const WARDROBE = { status: 'generated', tasks: [], completion: { total: 0, completed: 0, all_required_done: false } };
const SAVED = [{ slot: 'grwm', label: 'Get Ready With Me', task_source: 'goal', required: false }];

describe('Career Checklist: Use career plan', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes/ep-1/todo') return { data: { data: WARDROBE } };
      if (url === '/api/v1/episodes/ep-1/todo/social') return { data: { success: true, social_tasks: SAVED } };
      return { data: {} };
    });
  });

  test('adds the plan\'s goals, shows them, and names the lines over the limit', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true, data: {
      added: 1, removed: 0, not_added: ['Post a story'],
      social_tasks: [...SAVED, { slot: 'plan_a', label: 'Pitch the Sable team', task_source: 'goal', required: false }],
    } } });
    render(<EpisodeTodoList episodeId="ep-1" showId="show-1" />);
    fireEvent.click(await screen.findByText('💼 Career Checklist'));
    await screen.findByText('Get Ready With Me');
    fireEvent.click(screen.getByTestId('etl-use-career-plan'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/episodes/ep-1/todo/use-career-plan'));
    const result = await screen.findByTestId('etl-use-career-plan-result');
    expect(result.textContent).toContain('From the career plan: 1 goal added.');
    expect(result.textContent).toContain('not added: "Post a story"');
    expect(await screen.findByText('Pitch the Sable team')).toBeTruthy();
  });

  test('a draft plan: the refusal is said', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { error: 'Approve the career plan in the Event Package before using it in the episode.' } } });
    render(<EpisodeTodoList episodeId="ep-1" showId="show-1" />);
    fireEvent.click(await screen.findByText('💼 Career Checklist'));
    await screen.findByText('Get Ready With Me');
    fireEvent.click(screen.getByTestId('etl-use-career-plan'));
    expect((await screen.findByTestId('etl-use-career-plan-result')).textContent).toContain('Approve the career plan');
  });
});
