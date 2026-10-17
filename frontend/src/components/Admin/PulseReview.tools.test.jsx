/**
 * Lala's drafts' toolbar (Evoni's Admin mock, 2026-10-17): search, a
 * filter, the order and list or grid; three drafts until "View all drafts".
 */
import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
import api from '../../services/api';
import PulseReview, { filterDrafts } from './PulseReview';

const day = (d) => new Date(2026, 9, d).toISOString();
const DRAFTS = [
  { id: 'a', poster_handle: 'lala', poster_display_name: 'Lala', content_text: 'silk-charmeuse against drywall', status: 'draft', posted_at: day(14), image_url: 'https://b/x.jpg', comments: [] },
  { id: 'b', poster_handle: 'lala', poster_display_name: 'Lala', content_text: 'pulling things from the racks', status: 'draft', posted_at: day(16), gate_json: { pass: false, flags: [] }, comments: [] },
  { id: 'c', poster_handle: 'lala', poster_display_name: 'Lala', content_text: 'echo park evenings', status: 'draft', posted_at: day(15), gate_json: { pass: true }, release_state: 'held', comments: [] },
  { id: 'd', poster_handle: 'lala', poster_display_name: 'Lala', content_text: 'a fourth one', status: 'draft', posted_at: day(10), comments: [] },
];

test('filterDrafts: search, filter and order', () => {
  expect(filterDrafts(DRAFTS).map((p) => p.id)).toEqual(['b', 'c', 'a', 'd']);
  expect(filterDrafts(DRAFTS, { sort: 'oldest' }).map((p) => p.id)).toEqual(['d', 'a', 'c', 'b']);
  expect(filterDrafts(DRAFTS, { query: 'RACKS' }).map((p) => p.id)).toEqual(['b']);
  expect(filterDrafts(DRAFTS, { filter: 'photo' }).map((p) => p.id)).toEqual(['a']);
  expect(filterDrafts(DRAFTS, { filter: 'engine' }).map((p) => p.id)).toEqual(['b', 'c']);
  expect(filterDrafts(DRAFTS, { filter: 'flagged' }).map((p) => p.id)).toEqual(['b']);
  expect(filterDrafts(DRAFTS, { filter: 'scheduled' }).map((p) => p.id)).toEqual(['c']);
});

describe("Lala's drafts", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.includes('status=draft&from=wall')) return { data: { data: DRAFTS, total: 4 } };
      if (url.includes('/feed-posts')) return { data: { data: [], total: 0 } };
      return { data: {} };
    });
  });

  test('three until "View all drafts"; a search shows every match; grid and list', async () => {
    render(<MemoryRouter><PulseReview showId="show-1" /></MemoryRouter>);
    const drafts = within(await screen.findByTestId('prv-wall-drafts'));
    expect(drafts.getAllByTestId('sm-post')).toHaveLength(3);
    fireEvent.click(drafts.getByRole('button', { name: /View all drafts \(4\)/ }));
    expect(drafts.getAllByTestId('sm-post')).toHaveLength(4);

    fireEvent.change(drafts.getByLabelText('Search drafts'), { target: { value: 'echo' } });
    expect(drafts.getAllByTestId('sm-post')).toHaveLength(1);
    fireEvent.change(drafts.getByLabelText('Search drafts'), { target: { value: 'nothing like this' } });
    expect(drafts.getByText('No drafts match.')).toBeTruthy();

    fireEvent.click(drafts.getByRole('button', { name: 'Grid' }));
    expect(drafts.getByRole('button', { name: 'Grid' }).getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('.prv-cards').className).toContain('is-grid');
  });

  test('a draft card: its picture, its tags, and the release panel', async () => {
    render(<MemoryRouter><PulseReview showId="show-1" /></MemoryRouter>);
    const drafts = within(await screen.findByTestId('prv-wall-drafts'));
    const card = drafts.getAllByTestId('sm-post').find((c) => c.textContent.includes('silk-charmeuse'));
    expect(card.querySelector('.prv-media img').getAttribute('src')).toBe('https://b/x.jpg');
    const side = within(card).getByRole('complementary', { name: 'Release' });
    expect(within(side).getByRole('button', { name: 'Release' })).toBeTruthy();
    expect(within(side).getByRole('button', { name: 'Schedule…' })).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Comment' })).toBeTruthy();
  });
});
