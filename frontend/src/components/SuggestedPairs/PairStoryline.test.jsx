/**
 * A storyline from a kept pair (idea 4, PR 3, 2026-10-17): opening asks for
 * one suggestion (once), shows the title and premise to edit and who can
 * post; Start makes the storyline on The Pulse with Evoni's edits and links
 * to its beats; a refusal shows why.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { post: vi.fn() } }));

import api from '../../services/api';
import PairStoryline from './PairStoryline';

const SEED = {
  title: 'Who Called It First', premise: '@bea posts a serum verdict; @tess says she said it first.',
  pair: { relationship_id: 7, type: 'rival', a: { id: 1, handle: 'bea' }, b: { id: 2, handle: 'tess' } },
  can_post: ['@bea'], note: '@tess cannot post in this show yet.',
};
const open = (props = {}) => render(<MemoryRouter><PairStoryline relationshipId={7} showId="show-1" onClose={() => {}} {...props} /></MemoryRouter>);

beforeEach(() => api.post.mockReset());

describe('PairStoryline', () => {
  test('asks once, shows the seed and who can post', async () => {
    api.post.mockResolvedValue({ data: SEED });
    open();
    expect(await screen.findByDisplayValue('Who Called It First')).toBeTruthy();
    expect(screen.getByText('A storyline for @bea and @tess')).toBeTruthy();
    expect(screen.getByText('Can post in this show now: @bea. @tess cannot post in this show yet.')).toBeTruthy();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/api/v1/feed-relationships/7/storyline-seed', { show_id: 'show-1' });
  });

  test('Start makes the storyline with Evoni\'s edits and links to its beats', async () => {
    api.post.mockResolvedValueOnce({ data: SEED }).mockResolvedValueOnce({ data: { storyline: { id: 's1', title: 'Credit Where Due' } } });
    open();
    fireEvent.change(await screen.findByDisplayValue('Who Called It First'), { target: { value: 'Credit Where Due' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start this storyline' }));
    await screen.findByText(/Started “Credit Where Due”/);
    expect(api.post).toHaveBeenLastCalledWith('/api/v1/pulse-storylines', { show_id: 'show-1', title: 'Credit Where Due', premise: SEED.premise });
    expect(screen.getByRole('link', { name: 'Plan its beats on The Pulse' }).getAttribute('href')).toBe('/admin?tab=pulse&sub=storylines');
  });

  test('a refusal shows why', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { error: 'Lala\'s relationships follow the show\'s story, so they are not seeded here.' } } });
    open();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/not seeded here/)).toBeTruthy();
  });

  test('with no show it asks nothing', () => {
    open({ showId: null });
    expect(screen.getByText(/Choose a show first/)).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });
});
