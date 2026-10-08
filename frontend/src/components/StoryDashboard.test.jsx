/**
 * StoryDashboard — Track 6 CP10 behavioral tests (file 7 of 8).
 *
 * 6 fetch sites migrated via 6 module-scope helpers. URL composition
 * preserved verbatim per v2.16 §9.11 — API='' empty default; resulting
 * URLs are relative paths (no /api/v1 prefix). apiClient.baseURL is also ''.
 * If pre-existing bug, surfaced for Step 3 audit. Tests assert the exact
 * relative URL strings apiClient receives.
 *
 * listFlaggedGrowthApi duplicated locally per v2.12 §9.11 (CP8 StoryProposer
 * has it).
 */

import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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
import StoryDashboard, {
  postArcStageApi,
  listRegistryCharactersApi,
  listSceneProposalsApi,
  listUnacknowledgedReviewsApi,
  listFlaggedGrowthApi,
  acknowledgeReviewApi,
} from './StoryDashboard';

describe('StoryDashboard — Track 6 CP10 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  // URL strings preserve API='' empty default + ${API}/... template;
  // tests assert the exact relative-path string apiClient receives.

  test('postArcStageApi POST on /memories/arc-stage (relative path)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await postArcStageApi({ book_id: 'b-1' });
    expect(apiClient.post).toHaveBeenCalledWith('/memories/arc-stage', { book_id: 'b-1' });
  });

  test('listRegistryCharactersApi GET on /character-registry/:id/characters (relative)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { characters: [] } });
    await listRegistryCharactersApi('reg-1');
    expect(apiClient.get).toHaveBeenCalledWith('/character-registry/reg-1/characters');
  });

  test('listSceneProposalsApi GET with book_id + limit query (relative)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { proposals: [] } });
    await listSceneProposalsApi('b-1', 8);
    expect(apiClient.get).toHaveBeenCalledWith('/memories/scene-proposals?book_id=b-1&limit=8');
  });

  test('listUnacknowledgedReviewsApi GET on /reviews/unacknowledged (relative)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { reviews: [] } });
    await listUnacknowledgedReviewsApi();
    expect(apiClient.get).toHaveBeenCalledWith('/reviews/unacknowledged');
  });

  test('listFlaggedGrowthApi GET (CP8 dup, relative)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { flags: [] } });
    await listFlaggedGrowthApi();
    expect(apiClient.get).toHaveBeenCalledWith('/memories/character-growth/flagged');
  });

  test('acknowledgeReviewApi POST on /reviews/:id/acknowledge (no body, relative)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await acknowledgeReviewApi('r-1');
    expect(apiClient.post).toHaveBeenCalledWith('/reviews/r-1/acknowledge');
  });

  describe('Error path propagation', () => {
    test('postArcStageApi rejection propagates (caller swallows)', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('not authorized'));
      await expect(postArcStageApi({})).rejects.toThrow('not authorized');
    });

    test('listRegistryCharactersApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
      await expect(listRegistryCharactersApi('missing')).rejects.toThrow('not found');
    });

    test('acknowledgeReviewApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('forbidden'));
      await expect(acknowledgeReviewApi('r-1')).rejects.toThrow('forbidden');
    });
  });
});

// Since 2026-10-08 Evaluate runs the post-generation review, and
// GET /reviews/unacknowledged names each review's story: its title, and its
// chapter and book once written back.
describe('StoryDashboard — each failed review names its story', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('the story, its chapter once written back, and Acknowledge', async () => {
    const violation = (law) => ({ law_violated: law, offending_line: 'A line.', why_it_violates: 'Why.' });
    const reviews = [
      { id: 7, passed: false, violations: [violation('Lala does not know her origin')],
        story: { id: 's-1', title: 'The Studio at Dawn', book_id: 'b-1', chapter_id: 'c-3', chapter_title: 'Chapter Three' } },
      { id: 8, passed: false, violations: [violation('David is never the obstacle')],
        story: { id: 's-2', title: 'Late Edit', book_id: null, chapter_id: null, chapter_title: null } },
      { id: 9, passed: true, violations: [], story: { id: 's-3', title: 'A Clean Scene' } },
    ];
    vi.mocked(apiClient.get).mockImplementation(async (url) => (
      url.endsWith('/reviews/unacknowledged') ? { data: { reviews, count: 3 } } : { data: { flags: [] } }));
    vi.mocked(apiClient.post).mockResolvedValue({ data: { ok: true } });
    render(<MemoryRouter><StoryDashboard /></MemoryRouter>);

    const stories = await screen.findAllByTestId('review-story');
    expect(stories).toHaveLength(2);
    expect(within(stories[0]).getByText('The Studio at Dawn')).toBeTruthy();
    expect(within(stories[0]).getByRole('link', { name: 'Open “Chapter Three” →' }).getAttribute('href')).toBe('/write/b-1/c-3');
    expect(within(stories[1]).getByText('Late Edit')).toBeTruthy();
    expect(stories[1].textContent).toContain('Not written back yet');
    expect(within(stories[1]).getByRole('link', { name: 'Story Evaluation →' }).getAttribute('href')).toBe('/story-evaluation');
    // A review that passed is not listed.
    expect(screen.queryByText('A Clean Scene')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Acknowledge & Move On' })[0]);
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(expect.stringMatching(/\/reviews\/7\/acknowledge$/)));
    await waitFor(() => expect(screen.getAllByTestId('review-story')).toHaveLength(1));
    expect(screen.queryByText('The Studio at Dawn')).toBeNull();
  });
});
