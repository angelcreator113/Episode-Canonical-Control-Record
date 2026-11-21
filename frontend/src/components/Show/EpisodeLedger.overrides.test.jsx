/**
 * An override recorded on an old estimate, on the Episode Ledger (Evoni,
 * 2026-11-13): it is history. Completion never applied one, so the tile
 * says so in words instead of showing a bare count with an up arrow.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeLedger from './EpisodeLedger';

const OVERRIDE = { type: 'tier_change', tier_from: 'safe', tier_to: 'slay', reason_code: 'HOUSE_FAVOR' };
const EPISODES = [
  { id: 'ep-1', episode_number: 1, title: 'Overridden Estimate', status: 'draft', evaluation_status: 'computed', evaluation_json: { tier_final: 'slay', score: 40, overrides: [OVERRIDE] } },
  { id: 'ep-2', episode_number: 2, title: 'Plain Result', status: 'published', evaluation_status: 'accepted', evaluation_json: { tier_final: 'pass', score: 78, outfit_match: 20, overrides: [] } },
];

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { episodes: EPISODES } };
    if (url === '/api/v1/shows/show-1/financial-summary') return { data: { by_episode: [] } };
    return { data: {} };
  });
  vi.mocked(api.post).mockResolvedValue({ data: {} });
});

describe('the ledger\'s overrides tile', () => {
  test('says the overrides are historical and were not applied to completion', async () => {
    render(<MemoryRouter><EpisodeLedger showId="show-1" api={api} episodes={EPISODES} events={[]} /></MemoryRouter>);
    fireEvent.click(await screen.findByText('Overridden Estimate'));
    const tile = within(screen.getByTestId('ledger-row-ep-1')).getByTestId('ledger-overrides');
    expect(tile.textContent).toBe('Estimate overrides1Historical: not applied to completion');
    expect(tile.textContent).not.toContain('⬆️');
  });

  test('no tile where there is no override', async () => {
    render(<MemoryRouter><EpisodeLedger showId="show-1" api={api} episodes={EPISODES} events={[]} /></MemoryRouter>);
    fireEvent.click(await screen.findByText('Plain Result'));
    expect(within(screen.getByTestId('ledger-row-ep-2')).queryByTestId('ledger-overrides')).toBeNull();
  });
});
