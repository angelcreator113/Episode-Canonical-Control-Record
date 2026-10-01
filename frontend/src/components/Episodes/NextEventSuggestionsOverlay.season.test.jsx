/**
 * Season Arc A4 and Q8 (Evoni, 2026-10-01; EVENT_EPISODE_FLOW.md §8(ff)): the
 * suggestions say which slot they are for, and a repeat "warns, never blocks".
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import NextEventSuggestionsOverlay from './NextEventSuggestionsOverlay';

const DATA = {
  state: { coins: 1000, reputation: 3, brand_trust: 3, influence: 3, stress: 2, career_tier: 2 },
  thresholds: { coins_pressure: 250, coins_critical: 100 },
  candidate_count: 1,
  season: { next_slot: { label: 'S1 · E2', story_purpose: 'Lala needs a paycheck', desired_pressure: 'High' }, narrative_debt: [] },
  suggestions: [{
    event: { id: 'ev-2', name: 'Another gala', prestige: 3 }, score: 4, affordable: true,
    reasons: [
      { kind: 'boost', text: 'Fits the planned pressure (High)' },
      { kind: 'warn', text: 'Repeats the format "gala" (S1 · E1)' },
    ],
  }],
};

describe('NextEventSuggestionsOverlay and the season (§8(ff) A4, Q8)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockResolvedValue({ data: { data: DATA } });
  });

  test('names the slot and its intention, and shows a repeat as a warning', async () => {
    render(<MemoryRouter><NextEventSuggestionsOverlay episode={{ id: 'ep-1', episode_number: 1 }} showId="show-1" onClose={vi.fn()} /></MemoryRouter>);

    const header = await screen.findByTestId('suggestions-next-slot');
    expect(header.textContent).toBe('For S1 · E2: Lala needs a paycheck · planned pressure High');
    const warn = screen.getByText('Repeats the format "gala" (S1 · E1)');
    expect(warn.previousSibling.textContent).toBe('!');
    expect(screen.getByText('✦ Create Episode')).toBeTruthy(); // never blocks
  });
});
