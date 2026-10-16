/**
 * Generate Posts on the character page (Character Consistency Engine step 4;
 * Evoni, 2026-10-16): drafts wait in Review, each load-bearing or ambient.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));
vi.mock('../components/CharacterDepthPanel', () => ({ default: () => null }));

import api from '../services/api';
import { GeneratePosts } from './CharacterProfilePage';

const page = (onDrafted = () => {}) => render(<MemoryRouter><GeneratePosts characterId="c1" onDrafted={onDrafted} /></MemoryRouter>);

describe('GeneratePosts', () => {
  beforeEach(() => { api.post.mockReset(); });

  test('drafts on request and lists each draft with its weight and a link to Review', async () => {
    api.post.mockResolvedValue({ data: { success: true, drafted: [
      { post: { id: 'p1', content_text: 'Counting down to the swap.' }, weight: 'load_bearing', why: 'Builds to her swap' },
      { post: { id: 'p2', content_text: 'Morning light.' }, weight: 'ambient', why: null },
    ], failed: [] } });
    const onDrafted = vi.fn();
    page(onDrafted);
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('What is happening (optional)'), { target: { value: 'The week before her swap' } });
    fireEvent.click(screen.getByText('Draft posts for Review'));
    const box = screen.getByTestId('ch-gen');
    expect(await within(box).findByText(/2 drafts waiting in Review/)).toBeTruthy();
    expect(within(box).getByText('Load-bearing')).toBeTruthy();
    expect(within(box).getByText('Builds to her swap')).toBeTruthy();
    expect(within(box).getByText('Ambient')).toBeTruthy();
    expect(within(box).getByText('Open Review').getAttribute('href')).toBe('/admin?tab=pulse&sub=review');
    expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c1/posts/generate', { count: 3, about: 'The week before her swap' });
    expect(onDrafted).toHaveBeenCalled();
  });

  test('shows the refusal (no Voice Profile)', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Maren has no Voice Profile yet. Build it in Admin › The Pulse › Voices.' } } });
    page();
    fireEvent.click(screen.getByText('Draft posts for Review'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/no Voice Profile/);
  });
});
