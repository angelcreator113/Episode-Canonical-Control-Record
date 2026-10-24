/**
 * Season Plan › What the season knows (planner PR 3, 2026-10-24): the
 * latest approved What changed record and the open follow-ups, in a fold.
 */
import { vi, describe, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import SeasonKnows, { knowsSummary } from './SeasonKnows';

const KNOWS = {
  record: {
    episode_number: 3, title: 'The Gala', what_happened: 'Lala wins the room; Marcus watches Jade.',
    relationships: [{ a_name: 'Lala', b_name: 'Marcus', type: 'love_interest', stage_after: 'flirting', is_romantic: true }],
    threads: [{ title: 'Who leaked it', note: null }],
  },
  follow_ups: [{ id: 'f1', text: 'Thank Jade for the dress', due_hint: 'soon', episode_number: 3 }],
};

describe('What the season knows', () => {
  test('a fold with the record and the follow-ups the AI reads', async () => {
    const api = { get: vi.fn(async () => ({ data: KNOWS })) };
    render(<SeasonKnows showId="s1" api={api} />);
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/s1/season/knows');
    const card = screen.getByTestId('season-knows');
    expect(card.tagName).toBe('DETAILS');
    expect(await within(card).findByText('Episode 3 · 1 follow-up')).toBeTruthy();
    const record = screen.getByTestId('season-knows-record');
    expect(within(record).getByText('Last approved: Episode 3, “The Gala”')).toBeTruthy();
    expect(within(record).getByText('Lala wins the room; Marcus watches Jade.')).toBeTruthy();
    expect(within(record).getByText('Lala and Marcus: love interest, now flirting')).toBeTruthy();
    expect(within(record).getByText(/Who leaked it/)).toBeTruthy();
    expect(within(screen.getByTestId('season-knows-follow-ups')).getByText('Thank Jade for the dress')).toBeTruthy();
  });

  test('nothing yet says when it fills; a failed read says so', async () => {
    const api = { get: vi.fn(async () => ({ data: { record: null, follow_ups: [] } })) };
    const { unmount } = render(<SeasonKnows showId="s1" api={api} />);
    expect(await screen.findByText(/Once an episode's What changed record is approved/)).toBeTruthy();
    expect(screen.getByText('nothing yet')).toBeTruthy();
    unmount();
    const failing = { get: vi.fn(async () => { throw new Error('Network Error'); }) };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SeasonKnows showId="s1" api={failing} />);
    expect(await screen.findByText(/It did not load \(Network Error\)/)).toBeTruthy();
    expect(knowsSummary({ record: null, follow_ups: [{}, {}] })).toBe('2 follow-ups');
  });
});
