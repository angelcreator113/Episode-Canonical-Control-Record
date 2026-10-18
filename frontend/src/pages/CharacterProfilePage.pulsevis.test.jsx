/**
 * On The Pulse (Evoni, 2026-10-18: "when a character has a voice and even
 * makes post they are not showing up on the pulse"): the Voice & Feed card
 * that says why their posts are or aren't there. Whether Lala has met them
 * is not a reason ("they should still be building themselves on the pulse").
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));

import api from '../services/api';
import { OnThePulse } from './CharacterProfilePage';

const inRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('On The Pulse', () => {
  beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));

  test('live, waiting in Review (linked), scheduled and held, with the reasons', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {
      success: true, profile: { id: 7, handle: 'maren' }, show_id: 's1', live_count: 1, draft_count: 2,
      scheduled: [{ id: 'p1', release_at: '2026-10-20T15:00:00Z' }], held_count: 1, other_shows: [], no_voice: true,
      reasons: ['Maren has no Voice Profile yet, so nothing drafts posts for them automatically.', '2 posts are waiting in Review; a draft shows on The Pulse once you approve it.'],
    } });
    inRouter(<OnThePulse character={{ id: 'c1', display_name: 'Maren' }} />);
    const card = await screen.findByTestId('on-the-pulse');
    expect(api.get).toHaveBeenCalledWith('/api/v1/cast/characters/c1/pulse-visibility');
    expect(card.textContent).toContain('1 live');
    expect(card.textContent).toContain('2 waiting in Review');
    expect(card.textContent).toContain('1 scheduled');
    expect(card.textContent).toContain('1 held');
    expect(screen.getByRole('link', { name: 'Review' }).getAttribute('href')).toBe('/admin?tab=pulse&sub=review');
    expect(card.textContent).toContain('no Voice Profile');
    expect(card.textContent).not.toMatch(/meet Lala|knows of/);
  });

  test('nothing in the way: their live posts show', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, profile: { id: 7 }, show_id: 's1', live_count: 4, draft_count: 0, scheduled: [], held_count: 0, other_shows: [], no_voice: false, reasons: [] } });
    inRouter(<OnThePulse character={{ id: 'c1' }} />);
    expect((await screen.findByTestId('on-the-pulse')).textContent).toContain('Their live posts show on The Pulse.');
  });
});
