/**
 * "Their story" on the character page (Evoni, 2026-10-16): their Pulse
 * posts, and the short stories and chapters they are in.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));
vi.mock('../components/CharacterDepthPanel', () => ({ default: () => null }));

import api from '../services/api';
import { TheirStory, getStoryTrailApi } from './CharacterProfilePage';

const renderCard = () => render(<MemoryRouter><TheirStory character={{ id: 'c1' }} /></MemoryRouter>);

describe('TheirStory', () => {
  beforeEach(() => { api.get.mockReset(); });

  test('getStoryTrailApi GETs /cast/characters/:id/story-trail', async () => {
    api.get.mockResolvedValue({ data: {} });
    await getStoryTrailApi('c9');
    expect(api.get).toHaveBeenCalledWith('/api/v1/cast/characters/c9/story-trail');
  });

  test('shows posts with counts, stories and chapters with their links', async () => {
    api.get.mockResolvedValue({ data: {
      posts: [{ id: 1, text: 'Front row again.', status: 'published', episode_number: 3 }, { id: 2, text: 'Soon.', status: 'draft', episode_number: null }],
      post_counts: { live: 4, draft: 1 },
      stories: [{ id: 's1', title: 'Gala night', format: 'short_story', status: 'draft', show_id: 'sh1', episode_number: 3 }],
      chapters: [{ id: 'ch1', book_id: 'b1', title: 'The offer', chapter_number: 1, book_title: 'Before Lala', written: false }],
    } });
    renderCard();
    const card = await screen.findByTestId('ch-story');
    expect(await within(card).findByText('Front row again.')).toBeTruthy();
    expect(within(card).getByText('4 posted, 1 draft')).toBeTruthy();
    expect(within(card).getByText('Episode 3')).toBeTruthy();
    expect(within(card).getByText('Draft')).toBeTruthy();
    expect(within(card).getByRole('link', { name: 'Gala night' }).getAttribute('href')).toBe('/stories?show=sh1');
    expect(within(card).getByText('Short story · Episode 3 · draft')).toBeTruthy();
    expect(within(card).getByRole('link', { name: 'The offer' }).getAttribute('href')).toBe('/chapter/b1/ch1');
    expect(within(card).getByText('Before Lala · not written yet')).toBeTruthy();
  });

  test('empty trail says so', async () => {
    api.get.mockResolvedValue({ data: { posts: [], stories: [], chapters: [], post_counts: { live: 0, draft: 0 } } });
    renderCard();
    expect(await screen.findByText('Nothing yet: no Pulse posts, stories or chapters.')).toBeTruthy();
  });

  test('a failed load shows the error on screen', async () => {
    const err = Object.assign(new Error('boom'), { response: { data: { error: 'Character not found' } } });
    api.get.mockRejectedValue(err);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderCard();
    expect((await screen.findByRole('alert')).textContent).toBe('Character not found');
  });
});
