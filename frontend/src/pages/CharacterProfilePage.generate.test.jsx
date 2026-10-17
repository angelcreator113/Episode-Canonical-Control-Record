/**
 * Generate Posts on the character page (Character Consistency Engine step 4;
 * Evoni, 2026-10-16): drafts wait in Review, each load-bearing or ambient;
 * ideas from their own story fill "What is happening" (2026-10-17).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));
vi.mock('../components/CharacterDepthPanel', () => ({ default: () => null }));

import api from '../services/api';
import { GeneratePosts } from './CharacterProfilePage';

const page = (onDrafted = () => {}) => render(<MemoryRouter><GeneratePosts characterId="c1" onDrafted={onDrafted} /></MemoryRouter>);

describe('GeneratePosts', () => {
  beforeEach(() => {
    api.post.mockReset();
    api.get.mockReset();
    api.get.mockResolvedValue({ data: { success: true, ready: true, blocker: null, ideas: [] } });
  });

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

  test('ideas from their story fill "What is happening" with one tap', async () => {
    api.get.mockResolvedValue({ data: { success: true, ready: true, blocker: null, ideas: [
      { key: 'event:e1', label: 'Before Linen Swap', about: 'The days before Linen Swap, which Maren is hosting.' },
      { key: 'status', label: 'Breaking the silence', about: "Maren's first post after going dark." },
      { key: 'ordinary', label: 'An ordinary day', about: '' },
    ] } });
    api.post.mockResolvedValue({ data: { success: true, drafted: [], failed: [] } });
    page();
    expect(api.get).toHaveBeenCalledWith('/api/v1/cast/characters/c1/posts/ideas');
    expect(await screen.findByText('Not sure what to say? Pick one:')).toBeTruthy();
    fireEvent.click(screen.getByText('Breaking the silence'));
    const box = screen.getByLabelText('What is happening (optional)');
    expect(box.value).toBe("Maren's first post after going dark.");
    expect(screen.getByText('Breaking the silence').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByText('An ordinary day'));
    expect(box.value).toBe('');
    fireEvent.click(screen.getByText('Before Linen Swap'));
    fireEvent.click(screen.getByText('Draft posts for Review'));
    await screen.findByText(/0 drafts waiting in Review/);
    expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c1/posts/generate', { count: 3, about: 'The days before Linen Swap, which Maren is hosting.' });
  });

  test('says up front when they cannot post yet, and the button waits', async () => {
    api.get.mockResolvedValue({ data: { success: true, ready: false, blocker: 'Maren has no Voice Profile yet. Build it in Admin › The Pulse › Voices, then come back.', ideas: [] } });
    page();
    expect((await screen.findByRole('alert')).textContent).toMatch(/no Voice Profile/);
    expect(screen.getByText('Draft posts for Review').disabled).toBe(true);
  });

  test('Make Active, then Build their voice, right here; then drafting is open', async () => {
    api.get
      .mockResolvedValueOnce({ data: { success: true, ready: false, next: 'make_active', blocker: 'Maren has no Voice Profile yet, and one is built only from the Active stage. Make them Active, then build it.', ideas: [] } })
      .mockResolvedValueOnce({ data: { success: true, ready: false, next: 'build_voice', blocker: 'Maren has no Voice Profile yet: their posts are written in it. Build it here.', ideas: [] } })
      .mockResolvedValue({ data: { success: true, ready: true, next: null, blocker: null, ideas: [] } });
    api.put = vi.fn().mockResolvedValue({ data: { success: true } });
    api.post.mockResolvedValue({ data: { success: true } });
    page();
    fireEvent.click(await screen.findByText('Make Active'));
    expect(await screen.findByText('Build their voice')).toBeTruthy();
    expect(api.put).toHaveBeenCalledWith('/api/v1/character-registry/characters/c1', { depth_level: 'active' });
    expect(screen.getByText('Draft posts for Review').disabled).toBe(true);
    fireEvent.click(screen.getByText('Build their voice'));
    await waitFor(() => expect(screen.getByText('Draft posts for Review').disabled).toBe(false));
    expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-voices/c1/build');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('shows the refusal (no Voice Profile)', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Maren has no Voice Profile yet. Build it in Admin › The Pulse › Voices.' } } });
    page();
    fireEvent.click(screen.getByText('Draft posts for Review'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/no Voice Profile/);
  });
});
