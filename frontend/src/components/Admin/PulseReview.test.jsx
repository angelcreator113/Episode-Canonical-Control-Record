/**
 * Admin › The Pulse › Review (Task 2925): the feed's director tools, moved
 * out of Lala's view. Lala's drafts (Release, Edit, Delete), posts from
 * episodes (Approve, Edit, Discard), comments waiting (Approve, Delete),
 * live posts (reactions, Use in a beat) and Deleted (Restore), with the
 * same API calls the wall made. The count is what waits for Evoni.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import PulseReview, { loadReviewCount } from './PulseReview';

const SHOW = 'show-1';
let drafts;
let live;
let deleted;
let pending;

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  drafts = [
    { id: 'd1', poster_handle: 'lala', poster_display_name: 'Lala', content_text: 'Not yet.', status: 'draft', episode_id: null, comments: [] },
    { id: 'd2', poster_handle: 'marcus.k', poster_display_name: 'Marcus', content_text: 'See you there.', status: 'draft', episode_id: 'ep-2', episode: { id: 'ep-2', episode_number: 2 }, comments: [] },
  ];
  live = [{ id: 'p1', poster_handle: 'rival', poster_display_name: 'The Rival', content_text: 'Some people peak early.', status: 'live', narrative_function: 'shade', episode_id: 'ep-1', story_order: 15, comments: [] }];
  deleted = [];
  pending = [{ id: 'c9', handle: 'rival', text: 'cute.', post: { poster_handle: 'lala' } }];
  vi.mocked(api.get).mockImplementation(async (url) => {
    const u = new URL(url, 'http://x');
    if (url.includes('/feed-posts/deleted')) return { data: { data: deleted } };
    if (url.includes('/comments/pending')) return { data: { data: pending } };
    if (url.includes('/feed-posts')) {
      const from = u.searchParams.get('from');
      const base = u.searchParams.get('status') === 'draft' ? drafts : live;
      const data = from === 'episode' ? base.filter((p) => p.episode_id) : from === 'wall' ? base.filter((p) => !p.episode_id) : base;
      return { data: { data, total: data.length } };
    }
    return { data: {} };
  });
  vi.mocked(api.put).mockImplementation(async (url, body) => {
    const post = drafts.find((p) => url.endsWith(p.id));
    Object.assign(post, body);
    if (body.status === 'live') { drafts = drafts.filter((p) => p !== post); live.unshift(post); }
    return { data: { data: post } };
  });
  vi.mocked(api.delete).mockImplementation(async (url) => {
    if (url.includes('/comments/')) { pending = pending.filter((c) => !url.endsWith(c.id)); return { data: { success: true } }; }
    const post = drafts.find((p) => url.endsWith(p.id));
    drafts = drafts.filter((p) => p !== post);
    deleted.unshift({ ...post, deleted_at: new Date().toISOString() });
    return { data: { success: true } };
  });
  vi.mocked(api.patch).mockImplementation(async (url) => { pending = pending.filter((c) => !url.endsWith(c.id)); return { data: {} }; });
  vi.mocked(api.post).mockImplementation(async (url) => {
    const m = url.match(/\/feed-posts\/(\w+)\/restore$/);
    const post = deleted.find((p) => p.id === m[1]);
    deleted = deleted.filter((p) => p !== post);
    drafts.unshift({ ...post, deleted_at: null });
    return { data: {} };
  });
});

const open = async (onCount = vi.fn()) => {
  render(<MemoryRouter><PulseReview showId={SHOW} onCount={onCount} /></MemoryRouter>);
  await screen.findByTestId('pulse-review');
  return onCount;
};
const section = (id) => within(screen.getByTestId(id));

describe('Admin › The Pulse › Review', () => {
  test('lists what waits, apart, and counts it', async () => {
    const onCount = await open();
    expect(onCount).toHaveBeenCalledWith(3); // 1 wall draft + 1 episode post + 1 comment
    expect(section('prv-wall-drafts').getByText(/Not yet\./)).toBeTruthy();
    expect(section('prv-episode-posts').getByText(/See you there\./)).toBeTruthy();
    expect(section('prv-episode-posts').getByRole('link', { name: 'Episode 2' }).getAttribute('href')).toBe('/episodes/ep-2');
    expect(section('prv-pending').getByTestId('prv-pending-comment').textContent).toContain("@rival “cute.” on @lala's post");
    const livePost = section('prv-live').getByTestId('sm-post');
    expect(livePost.textContent).toContain('shade');
    expect(within(livePost).getByRole('link', { name: 'Episode' }).getAttribute('href')).toBe('/episodes/ep-1');
    expect(within(livePost).getByRole('button', { name: 'Use in a beat' })).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith(`/api/v1/feed-posts?show_id=${SHOW}&status=draft&from=wall&with=comments&limit=50`);
    expect(api.get).toHaveBeenCalledWith(`/api/v1/feed-posts?show_id=${SHOW}&status=draft&from=episode&with=comments&limit=50`);
  });

  test("Lala's draft: Edit, then Release puts it live", async () => {
    const onCount = await open();
    const card = section('prv-wall-drafts').getByTestId('sm-post');
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    fireEvent.change(within(card).getByLabelText('Edit the draft'), { target: { value: 'Not yet. Soon.' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/d1', { content_text: 'Not yet. Soon.' }));
    await waitFor(() => expect(section('prv-wall-drafts').getByText(/Not yet\. Soon\./)).toBeTruthy());
    fireEvent.click(within(section('prv-wall-drafts').getByTestId('sm-post')).getByRole('button', { name: 'Release' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/d1', { status: 'live' }));
    await waitFor(() => expect(section('prv-live').getByText(/Not yet\. Soon\./)).toBeTruthy());
    expect(section('prv-wall-drafts').getByText(/No drafts/)).toBeTruthy();
    expect(onCount).toHaveBeenLastCalledWith(2);
  });

  test('an episode post: Approve puts it live; Discard keeps it under Deleted, and Restore brings it back', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    drafts.push({ id: 'd3', poster_handle: 'bestie', poster_display_name: 'Bestie', content_text: 'Wear the gold.', status: 'draft', episode_id: 'ep-2', episode: { episode_number: 2 }, comments: [] });
    await open();
    await waitFor(() => expect(section('prv-episode-posts').getAllByTestId('sm-request-post')).toHaveLength(2));
    fireEvent.click(within(section('prv-episode-posts').getAllByTestId('sm-request-post')[0]).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/d2', { status: 'live' }));
    await waitFor(() => expect(section('prv-episode-posts').getAllByTestId('sm-request-post')).toHaveLength(1));
    fireEvent.click(within(section('prv-episode-posts').getByTestId('sm-request-post')).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/feed-posts/d3'));
    await waitFor(() => expect(screen.getByText('Deleted (1)')).toBeTruthy());
    fireEvent.click(within(screen.getByTestId('prv-deleted')).getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/feed-posts/d3/restore'));
    await waitFor(() => expect(screen.getByText('Deleted (0)')).toBeTruthy());
  });

  test('a comment waiting: Approve and Delete', async () => {
    pending.push({ id: 'c10', handle: 'fan', text: 'Obsessed.', post: { poster_handle: 'lala' } });
    await open();
    const rows = () => section('prv-pending').getAllByTestId('prv-pending-comment');
    fireEvent.click(within(rows()[0]).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/v1/feed-posts/comments/c9', { status: 'live' }));
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.click(within(rows()[0]).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/feed-posts/comments/c10'));
    await waitFor(() => expect(section('prv-pending').getByText(/No comments waiting/)).toBeTruthy());
  });

  test('loadReviewCount adds drafts, episode posts and waiting comments', async () => {
    expect(await loadReviewCount(SHOW)).toBe(3);
  });

  test('says so when nothing can be read', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('down'));
    render(<MemoryRouter><PulseReview showId={SHOW} /></MemoryRouter>);
    expect((await screen.findByRole('alert')).textContent).toBe('Review could not be loaded.');
  });
});
