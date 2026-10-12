/**
 * The audience's pick on the Style Page (Task 3007): the poll about this
 * episode or its event; a closed one names the winner with its count and
 * links Use this look to the look builder with its pieces; a tie offers
 * each; no votes, no pieces, an open poll and no poll each read right.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../../services/episodeEventsApi', () => ({ getEpisodeAnchorEvent: vi.fn(() => Promise.resolve({ id: 'ev-1' })) }));

import api from '../../services/api';
import StyleAudiencePick, { pollFor, winnersOf, lookBuilderLink } from './StyleAudiencePick';

const EP = { id: 'ep-1', show_id: 'show-1' };
const option = (id, label, votes, ids = []) => ({ id, label, votes, wardrobe_ids: ids });
const poll = (parts) => ({ id: 'p', question: 'Pink or black?', status: 'closed', episode_id: null, world_event_id: 'ev-1', total: 0, options: [], ...parts });

const renderIt = () => render(<MemoryRouter><StyleAudiencePick episode={EP} /></MemoryRouter>);
const serve = (polls) => vi.mocked(api.get).mockResolvedValue({ data: { success: true, polls } });

beforeEach(() => vi.mocked(api.get).mockReset());

describe('helpers', () => {
  test("pollFor keeps this episode's or event's polls: the latest closed, else an open one; never a draft", () => {
    const polls = [
      poll({ id: 'other', world_event_id: 'ev-9' }),
      poll({ id: 'draft', status: 'draft' }),
      poll({ id: 'open', status: 'open' }),
      poll({ id: 'closed', episode_id: 'ep-1', world_event_id: null }),
    ];
    expect(pollFor(polls, 'ep-1', 'ev-1').id).toBe('closed');
    expect(pollFor(polls.slice(0, 3), 'ep-1', 'ev-1').id).toBe('open');
    expect(pollFor(polls.slice(0, 2), 'ep-1', 'ev-1')).toBeNull();
  });
  test('winnersOf: the top option, every one on a tie, none with no votes', () => {
    expect(winnersOf(poll({ options: [option('a', 'A', 3), option('b', 'B', 1)] })).map((o) => o.id)).toEqual(['a']);
    expect(winnersOf(poll({ options: [option('a', 'A', 2), option('b', 'B', 2)] })).map((o) => o.id)).toEqual(['a', 'b']);
    expect(winnersOf(poll({ options: [option('a', 'A', 0)] }))).toEqual([]);
  });
  test('lookBuilderLink opens the closet on this episode with the pieces', () => {
    expect(lookBuilderLink('show-1', 'ep-1', ['w1', 'w2'])).toBe('/shows/show-1/world?tab=wardrobe-items&look_episode=ep-1&look_pieces=w1,w2');
  });
});

describe('on the Style Page', () => {
  test('a closed poll names the pick and its count; Use this look opens the look builder with its pieces', async () => {
    serve([poll({ total: 5, options: [option('a', 'The pink set', 3, ['w1', 'w2']), option('b', 'The black dress', 2, ['w3'])] })]);
    renderIt();
    const box = await screen.findByTestId('esp2-audience');
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-polls?show_id=show-1');
    expect(box.textContent).toContain('The audience picked The pink set (3 of 5 votes).');
    expect(screen.getByRole('link', { name: 'Use this look' }).getAttribute('href'))
      .toBe('/shows/show-1/world?tab=wardrobe-items&look_episode=ep-1&look_pieces=w1,w2');
    expect(box.textContent).toContain("Nothing changes until you save there");
  });

  test('a tie offers each; an option with no pieces says so', async () => {
    serve([poll({ total: 4, options: [option('a', 'Pink', 2, ['w1']), option('b', 'Black', 2)] })]);
    renderIt();
    const box = await screen.findByTestId('esp2-audience');
    expect(box.textContent).toContain('A tie: Pink and Black (2 votes each, of 4).');
    expect(screen.getByRole('link', { name: 'Use this look: Pink' })).toBeTruthy();
    expect(box.textContent).toContain('Black has no pieces attached.');
  });

  test('no votes, an open poll, and no poll', async () => {
    serve([poll({ total: 0, options: [option('a', 'Pink', 0, ['w1'])] })]);
    const first = renderIt();
    expect((await screen.findByTestId('esp2-audience')).textContent).toBe('“Pink or black?” closed with no votes.');
    first.unmount();
    serve([poll({ status: 'open', total: 7, options: [option('a', 'Pink', 4, ['w1'])] })]);
    const second = renderIt();
    expect((await screen.findByTestId('esp2-audience')).textContent).toBe('Poll open: 7 votes so far on “Pink or black?”.');
    expect(screen.queryByRole('link')).toBeNull();
    second.unmount();
    serve([]);
    const { container } = renderIt();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3));
    expect(container.innerHTML).toBe('');
  });
});
