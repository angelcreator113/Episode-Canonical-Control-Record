/**
 * Suggested pairs on the Relationship Map (idea 4, PR 2, 2026-10-17):
 * Suggest finds new pairs; each shows both creators, a kind and why;
 * Keep makes the relationship (with Evoni's changes) and refreshes the map;
 * Dismiss clears it for good.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import api from '../../services/api';
import SuggestedPairs from './SuggestedPairs';

const PAIR = {
  key: '1-2', a: 1, b: 2, type: 'rival', why: 'Both call the next trend first.', source: 'suggest',
  profile_a: { id: 1, handle: 'bea', society_archetype: 'The Beauty Oracle', content_category: 'skincare' },
  profile_b: { id: 2, handle: 'tess', society_archetype: 'The Trendsetter', content_category: 'skincare' },
};
const BASE = '/api/v1/feed-relationships/suggestions';

beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));

describe('SuggestedPairs', () => {
  test('shows the count; Suggest finds new pairs and opens the list', async () => {
    api.get.mockResolvedValueOnce({ data: { pairs: [] } }).mockResolvedValue({ data: { pairs: [PAIR] } });
    api.post.mockResolvedValue({ data: { added: [PAIR] } });
    render(<SuggestedPairs />);
    expect(await screen.findByRole('button', { name: 'Suggested pairs (0)' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Suggest pairs' }));
    await screen.findByText('1 new pair to look at.');
    expect(api.post).toHaveBeenCalledWith(BASE, {});
    expect(screen.getByText('@bea')).toBeTruthy();
    expect(screen.getByText(/both skincare/)).toBeTruthy();
  });

  test('keep sends Evoni\'s kind and line, and refreshes the map', async () => {
    const onKept = vi.fn();
    api.get.mockResolvedValueOnce({ data: { pairs: [PAIR] } }).mockResolvedValue({ data: { pairs: [] } });
    api.post.mockResolvedValue({ data: { success: true } });
    render(<SuggestedPairs onKept={onKept} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suggested pairs (1)' }));
    fireEvent.change(screen.getByLabelText('Kind for @bea and @tess'), { target: { value: 'collab' } });
    fireEvent.change(screen.getByLabelText('Why for @bea and @tess'), { target: { value: 'They co-host a live.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    await waitFor(() => expect(onKept).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith(`${BASE}/1-2/keep`, { type: 'collab', why: 'They co-host a live.' });
    expect(screen.getByText('Kept: @bea and @tess are now on the map.')).toBeTruthy();
  });

  test('dismiss clears a pair for good', async () => {
    api.get.mockResolvedValueOnce({ data: { pairs: [PAIR] } }).mockResolvedValue({ data: { pairs: [] } });
    api.post.mockResolvedValue({ data: { success: true } });
    render(<SuggestedPairs />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suggested pairs (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await screen.findByText('Dismissed. That pair will not be suggested again.');
    expect(api.post).toHaveBeenCalledWith(`${BASE}/1-2/dismiss`);
  });
});
