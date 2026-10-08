/**
 * EpisodeReview — Track 3 behavioral tests for migrated apiClient helpers.
 *
 * Since 2026-10-08 the page no longer lists the post-generation reviews: they
 * are the book's scenes, on the Story Dashboard, which Evaluate now feeds.
 * Its fetchUnacknowledgedReviews, acknowledgeReview and
 * requestPostGenerationReview (which sent a scene_id the route never read)
 * are gone.
 */

import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

import apiClient from '../services/api';
import * as page from './EpisodeReview';

const { fetchEpisodeForReview, default: EpisodeReview } = page;

describe('EpisodeReview — Track 3 helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('fetchEpisodeForReview calls apiClient.get on /episodes/:id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 'ep-1' } });
    await fetchEpisodeForReview('ep-1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1');
  });

  test('the review helpers are gone', () => {
    expect(Object.keys(page).sort()).toEqual(['default', 'fetchEpisodeForReview']);
  });
});

describe('EpisodeReview — the page', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test("shows the episode and no book reviews, and says where they are", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 'ep-1', title: 'Pilot' } });
    render(
      <MemoryRouter initialEntries={['/episodes/ep-1/review']}>
        <Routes><Route path="/episodes/:episodeId/review" element={<EpisodeReview />} /></Routes>
      </MemoryRouter>,
    );
    expect((await screen.findByText('Pilot')).tagName).toBe('STRONG');
    const note = screen.getByTestId('episode-review-empty');
    expect(note.textContent).toBe("Nothing to review here yet. The book's scene reviews are on the Story Dashboard.");
    expect(screen.getByRole('link', { name: 'Story Dashboard' }).getAttribute('href')).toBe('/universe/story-dashboard');
    expect(apiClient.get.mock.calls.map(([url]) => url)).toEqual(['/api/v1/episodes/ep-1']);
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
