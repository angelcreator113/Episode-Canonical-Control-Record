/**
 * Results → Evaluation and Results → Story (the Results redesign,
 * 2026-10-08): what they show, and Story's generate buttons say what
 * happened without editing the page by hand.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import { EpisodeResultsEvaluation, EpisodeResultsStory } from './EpisodeResultsPages';

const EVAL = {
  tier_final: 'pass', score: 78, narrative_lines: { short: 'Lala held her own.' },
  breakdown: { outfit_match: { value: 22, detail: 'Black tie' }, financials: { value: -4, detail: 'Over budget' } },
  stat_deltas: { coins: 150, stress: 2 },
  social_task_bonuses: { detail: { total: 3, completed: 2, completion_rate: 67 } },
  financial_summary: { total_income: 300, total_expenses: 160 },
};
const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => Object.values(api).forEach((fn) => fn?.mockReset?.()));

describe('Results → Evaluation', () => {
  test('not evaluated: says so', () => {
    renderIn(<EpisodeResultsEvaluation episode={{ id: 'ep-1' }} />);
    expect(screen.getByTestId('results-evaluation-empty').textContent).toContain('Not evaluated yet');
  });

  test('the verdict, the breakdown, stat changes and the money', () => {
    renderIn(<EpisodeResultsEvaluation episode={{ id: 'ep-1', evaluation_json: JSON.stringify(EVAL) }} />);
    const page = screen.getByTestId('results-evaluation');
    expect(page.textContent).toContain('Pass');
    expect(page.textContent).toContain('78/100');
    expect(page.textContent).toContain('Lala held her own.');
    expect(within(page).getByText('outfit match').closest('li').textContent).toContain('+22');
    expect(within(page).getByText('financials').closest('li').textContent).toContain('-4');
    // Stress going up is bad; coins going up is good.
    expect(within(page).getByText('Stress').closest('.ers-delta').className).toContain('is-bad');
    expect(within(page).getByText('Coins').closest('.ers-delta').className).toContain('is-good');
    expect(page.textContent).toContain('2/3');
    expect(within(page).getByText('Net').closest('li').textContent).toContain('+140');
  });

  test('evaluation JSON that does not parse reads as not evaluated', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderIn(<EpisodeResultsEvaluation episode={{ id: 'ep-1', evaluation_json: '{nope' }} />);
    expect(screen.getByTestId('results-evaluation-empty')).toBeTruthy();
  });
});

describe('Results → Story', () => {
  test('a format generates, says it is writing, then that it is done', async () => {
    let resolve;
    vi.mocked(api.post).mockImplementation(() => new Promise((r) => { resolve = r; }));
    renderIn(<EpisodeResultsStory episode={{ id: 'ep-1', show_id: 'show-1' }} />);
    fireEvent.click(screen.getByTestId('results-story-snippet'));
    expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/episodes/ep-1/generate-story', { format: 'snippet' });
    expect(screen.getByTestId('results-story-snippet').textContent).toContain('Writing…');
    expect(screen.getByTestId('results-story-recap').disabled).toBe(true);
    resolve({ data: { success: true } });
    await waitFor(() => expect(screen.getByTestId('results-story-snippet').textContent).toContain('Done · in Stories'));
    expect(screen.getByTestId('results-story-recap').disabled).toBe(false);
  });

  test('a failure says so and can be tried again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.post).mockRejectedValue({ response: { data: { error: 'Budget reached' } } });
    renderIn(<EpisodeResultsStory episode={{ id: 'ep-1', show_id: 'show-1' }} />);
    fireEvent.click(screen.getByTestId('results-story-recap'));
    await screen.findByText('Budget reached');
    expect(screen.getByTestId('results-story-recap').textContent).toContain('Failed · try again');
  });

  test('the Stories Library is a link', () => {
    renderIn(<EpisodeResultsStory episode={{ id: 'ep-1', show_id: 'show-1' }} />);
    expect(screen.getByRole('link', { name: /Open Stories Library/ }).getAttribute('href')).toBe('/stories');
  });
});
