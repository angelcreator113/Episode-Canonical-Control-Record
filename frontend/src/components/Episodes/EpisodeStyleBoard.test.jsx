/**
 * The Overview's Episode Style board (Evoni's mock, 2026-10-16): each card
 * reads the event, the locked outfit, the money plan or the Lookbook.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import EpisodeStyleBoard, { slotsFrom, styleGoals, BOARD_SLOTS } from './EpisodeStyleBoard';

const EVENT = {
  id: 'ev-1', name: 'Velour Society Garden Soirée', host: 'Velour', venue_name: 'Radiance Row',
  event_date: 'Oct 18', event_time: '9 PM', dress_code: 'Garden glamour',
  dress_code_keywords: ['florals', 'satin'], rewards: { reputation: 3, brand_trust: 2, influence: 0, coins: 50 },
  canon_consequences: { automation: { guest_profiles: [{ display_name: 'Marisol Vega' }, { handle: 'slowsift' }] } },
};
const LOOKBOOK = {
  tagline: 'Soft power in satin', mood_words: ['dreamy', 'bold'], palette: [{ hex: '#ff99cc' }, { hex: '#c9a84c' }, { hex: '#ffffff' }, { hex: '#222222' }, { hex: '#e0b0ff' }],
  nails_name: 'Rose chrome', hair_name: 'Glass waves', beauty_notes: { lips: 'Berry gloss' },
  images: { hero: [{ id: 'h1', image_url: 'https://x/hero.jpg' }], inspo: [{ id: 'i1', image_url: 'https://x/i1.jpg' }], nails: [] },
};
const OUTFIT = [
  { id: 'w1', name: 'Silk slip dress', clothing_category: 'dress', thumbnail_url: 'https://x/dress.jpg' },
  { id: 'w2', name: 'Strappy heels', clothing_category: 'shoes' },
];
const MONEY = { projection: { projected_balance: 2239, open_count: 0 }, look: { pieces: 2 } };

const renderBoard = (props = {}) => {
  const onOpenTab = vi.fn();
  render(<EpisodeStyleBoard episode={{ id: 'ep-1', title: 'Garden Party' }} source={{ event: EVENT }}
    linkedEvents={[{ id: 'ev-1', invitation_url: 'https://x/inv.jpg', sceneSet: { base_still_url: 'https://x/venue.jpg' } }]}
    outfit={OUTFIT} money={MONEY} onOpenTab={onOpenTab} {...props} />);
  return onOpenTab;
};

describe('EpisodeStyleBoard', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockResolvedValue({ data: { data: LOOKBOOK } });
  });

  test('the event card names the event, venue, date, host, attendees and dress code (the episode is in the header)', async () => {
    renderBoard();
    const card = screen.getByTestId('esb-event');
    expect(card.textContent).not.toContain('Garden Party');
    for (const text of ['Velour Society Garden Soirée', 'Radiance Row', 'Oct 18 · 9 PM', 'Velour', '2 · Marisol Vega, @slowsift', 'Garden glamour']) {
      expect(card.textContent).toContain(text);
    }
    expect(within(card).getByRole('img').getAttribute('src')).toBe('https://x/inv.jpg');
    expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/lookbook');
  });

  test('dress code keywords come from the event; rewards and quick tools are not repeated here', () => {
    renderBoard();
    expect(screen.getByTestId('esb-dress').textContent).toContain('florals');
    // The shorter Overview (Evoni, 2026-10-22 layout list): rewards are in
    // the Stakes band, coins after the episode in the tiles, and the quick
    // tools were the tabs over again.
    expect(screen.queryByTestId('esb-rewards')).toBeNull();
    expect(screen.queryByTestId('esb-tools')).toBeNull();
  });

  test('wardrobe slots fill from the locked outfit and the Lookbook nails; body and shoes are required', async () => {
    renderBoard();
    const card = screen.getByTestId('esb-slots');
    expect(card.textContent).toContain('2 / 2 required');
    expect(within(card).getByRole('button', { name: 'Body: Silk slip dress, required' })).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Bag: empty' })).toBeTruthy();
    await waitFor(() => expect(within(card).getByRole('button', { name: 'Nails: Rose chrome' })).toBeTruthy());
  });

  test('goals check the outfit and the Lookbook; the notes show its tagline and words', async () => {
    renderBoard();
    await waitFor(() => expect(screen.getByTestId('esb-goals').textContent).toContain('6 / 6'));
    const notes = screen.getByTestId('esb-notes');
    expect(notes.textContent).toContain('Soft power in satin');
    expect(notes.textContent).toContain('Berry gloss');
  });

  test('empty cards say so and open the tab where the thing is made', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { images: {} } } });
    const onOpenTab = renderBoard({ source: null, linkedEvents: [], outfit: [], money: null });
    expect(screen.getByTestId('esb-event').textContent).toContain('No event linked to this episode yet');
    expect(screen.getByTestId('esb-slots').textContent).toContain('0 / 2 required');
    expect(screen.getByTestId('esb-look').textContent).toContain('No look locked yet');
    fireEvent.click(within(screen.getByTestId('esb-slots')).getByRole('button', { name: 'Body: empty, required' }));
    expect(onOpenTab).toHaveBeenCalledWith('wardrobe');
    await waitFor(() => expect(screen.getByTestId('esb-mood').textContent).toContain('No look photos yet'));
    fireEvent.click(screen.getByRole('button', { name: /Add images/ }));
    expect(onOpenTab).toHaveBeenCalledWith('lookbook');
  });

  test('a Lookbook that cannot be read leaves the board standing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockRejectedValue(new Error('down'));
    renderBoard();
    await waitFor(() => expect(screen.getByTestId('esb-mood').textContent).toContain('No look photos yet'));
    expect(screen.getByTestId('esb-event')).toBeTruthy();
  });
});

describe('slotsFrom / styleGoals', () => {
  test('seven slots in order; the first piece of a slot wins', () => {
    expect(BOARD_SLOTS.map((s) => s.label)).toEqual(['Body', 'Shoes', 'Bag', 'Jewelry', 'Hair', 'Perfume', 'Nails']);
    const slots = slotsFrom(OUTFIT, null);
    expect(slots.filter((s) => s.filled).map((s) => s.key)).toEqual(['body', 'shoes']);
    expect(styleGoals(slots, null).filter((g) => g.done).map((g) => g.key)).toEqual(['body', 'shoes']);
  });
});
