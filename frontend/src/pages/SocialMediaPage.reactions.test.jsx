/**
 * Reactions on a post (the Feed project, step 4, 2026-10-04): live
 * comments and drafts as records, who reacts pre-ticked from the
 * poster's connections, Draft reactions for approval, approve and delete.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../services/api';
import { PostCard } from './SocialMediaPage';

const POST = { id: 'p-1', poster_handle: 'lala', poster_display_name: 'Lala', content_text: 'Gala tonight.', likes: 3, comments_count: 1, status: 'live', sample_comments: ['legacy string'] };
let comments;
const REACTORS = [{ id: 2, handle: 'rival', relationship: 'rival' }, { id: 4, handle: 'fan', relationship: null }];

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  comments = [
    { id: 'c-1', handle: 'bestie', text: 'Iconic.', status: 'live' },
    { id: 'c-2', handle: 'rival', text: 'Bold for a Tuesday.', status: 'draft', voice_note: 'rival of the poster' },
  ];
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.endsWith('/comments/reactors')) return { data: { data: REACTORS } };
    if (url.includes('/comments')) return { data: { data: comments } };
    return { data: {} };
  });
  vi.mocked(api.patch).mockImplementation(async (url, body) => { const c = comments.find((x) => url.endsWith(x.id)); Object.assign(c, body); return { data: { data: c } }; });
  vi.mocked(api.delete).mockImplementation(async (url) => { comments = comments.filter((x) => !url.endsWith(x.id)); return { data: { success: true } }; });
  vi.mocked(api.post).mockImplementation(async () => { comments.push({ id: 'c-3', handle: 'fan', text: 'Obsessed.', status: 'draft' }); return { data: { data: [], count: 1 } }; });
});

const open = async () => {
  render(<MemoryRouter><PostCard post={POST} /></MemoryRouter>);
  expect(screen.getByText('legacy string')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Reactions' }));
  await screen.findByTestId('sm-reactions');
};

describe('Reactions', () => {
  test('shows live comments and drafts as records, and who reacts, pre-ticked', async () => {
    await open();
    expect(screen.getByTestId('sm-live-comments').textContent).toContain('@bestie Iconic.');
    expect(screen.getByTestId('sm-draft-comments').textContent).toContain('@rival Bold for a Tuesday.');
    expect(screen.getByTestId('sm-draft-comments').textContent).toContain('rival of the poster');
    expect(screen.queryByText('legacy string')).toBeNull();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    expect(boxes.every((b) => b.checked)).toBe(true);
    expect(api.get).toHaveBeenCalledWith('/api/v1/feed-posts/p-1/comments?status=all');
  });

  test('approve sets a draft live; delete removes; Draft reactions sends the ticked reactors', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'approve' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/v1/feed-posts/comments/c-2', { status: 'live' }));
    await waitFor(() => expect(screen.getByTestId('sm-live-comments').textContent).toContain('@rival'));
    expect(screen.queryByTestId('sm-draft-comments')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'delete' })[0]);
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/feed-posts/comments/c-1'));

    fireEvent.click(screen.getByLabelText(/@fan/));
    fireEvent.click(screen.getByRole('button', { name: 'Draft reactions' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/feed-posts/p-1/comments/draft', { reactor_ids: [2] }));
    await waitFor(() => expect(screen.getByTestId('sm-draft-comments').textContent).toContain('@fan Obsessed.'));
    expect(screen.getByRole('status').textContent).toContain('Reactions drafted');
  });
});
