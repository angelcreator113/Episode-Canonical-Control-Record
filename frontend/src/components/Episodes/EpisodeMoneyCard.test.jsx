/**
 * The Overview's Money card (§8(gg) MB5): its load failure and its link.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../../services/api';
import EpisodeMoneyCard from './EpisodeMoneyCard';

describe('EpisodeMoneyCard', () => {
  beforeEach(() => { vi.mocked(api.get).mockReset(); });

  test('a failed load says so and keeps the link', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockRejectedValue(new Error('down'));
    render(<MemoryRouter><EpisodeMoneyCard showId="show-1" episodeId="ep-1" /></MemoryRouter>);

    expect(await screen.findByText("Couldn't load this episode's money.")).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See all in Money →' })).toBeTruthy();
  });

  test('no show, no card', () => {
    const { container } = render(<MemoryRouter><EpisodeMoneyCard showId={null} episodeId="ep-1" /></MemoryRouter>);
    expect(container.innerHTML).toBe('');
    expect(api.get).not.toHaveBeenCalled();
  });
});
