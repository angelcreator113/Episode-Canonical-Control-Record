/**
 * Deliverables that check themselves (Evoni, 2026-10-19): a deal's lines,
 * the posts that count, Link a post from the suggestions, and the compact
 * line on the Opportunities tab. Also: a post's "Counts toward a deal".
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import DeliverableProgress from './DeliverableProgress';
import PostDeal from './PostDeal';

const progress = (over = {}) => ({
  success: true, event_id: 'e1', countable: 2, done: 1, all_done: false, done_at: null,
  deliverables: [
    { id: 'd1', countable: true, done: false, line: 'Pulse stories: 2 of 3', posts: [{ id: 'p1', handle: 'lala', text: 'getting ready', status: 'live', counts: true }] },
    { id: 'd2', countable: true, done: true, line: 'Pulse video: 1 of 1', posts: [] },
    { id: 'd3', countable: false, done: false, line: null, posts: [] },
  ],
  ...over,
});

describe('DeliverableProgress', () => {
  beforeEach(() => { api.get.mockReset(); api.post.mockReset(); api.delete.mockReset(); });

  test('shows each line with the posts that count; Link a post links a suggestion', async () => {
    api.get.mockResolvedValueOnce({ data: progress() });
    render(<DeliverableProgress eventId="e1" />);
    const box = await screen.findByTestId('dp-progress');
    expect(api.get).toHaveBeenCalledWith('/api/v1/deliverable-progress/events/e1');
    expect(box.textContent).toContain('On The Pulse: 1 of 2 done');
    expect(box.textContent).toContain('Pulse stories: 2 of 3');
    expect(box.textContent).toContain('@lala');

    api.get.mockResolvedValueOnce({ data: { posts: [{ id: 'p9', handle: 'lala', text: 'in Velour tonight', status: 'live' }] } });
    fireEvent.click(within(screen.getByTestId('dp-item-d1')).getByRole('button', { name: /Link a post/ }));
    const list = await screen.findByTestId('dp-suggest-d1');
    api.post.mockResolvedValueOnce({ data: progress({ all_done: true, done: 2 }) });
    fireEvent.click(within(list).getByRole('button', { name: 'Link' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/deliverable-progress/deliverables/d1/posts', { post_id: 'p9' }));
    expect(await screen.findByText('Deliverables done')).toBeTruthy();
  });

  test('unlinking a post stops it counting', async () => {
    api.get.mockResolvedValueOnce({ data: progress() });
    render(<DeliverableProgress eventId="e1" />);
    await screen.findByTestId('dp-progress');
    api.delete.mockResolvedValueOnce({ data: progress() });
    fireEvent.click(screen.getByRole('button', { name: 'Stop counting this post' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/deliverable-progress/deliverables/d1/posts/p1'));
  });

  test('compact: the lines for a deal, or "Deliverables done"', async () => {
    api.get.mockResolvedValueOnce({ data: progress() });
    const { unmount } = render(<DeliverableProgress opportunityId="o1" compact />);
    expect((await screen.findByTestId('dp-compact')).textContent).toContain('Pulse stories: 2 of 3');
    expect(api.get).toHaveBeenCalledWith('/api/v1/deliverable-progress/opportunities/o1');
    unmount();
    api.get.mockResolvedValueOnce({ data: progress({ all_done: true }) });
    render(<DeliverableProgress opportunityId="o1" compact />);
    expect((await screen.findByTestId('dp-compact')).textContent.trim()).toBe('Deliverables done');
  });

  test('nothing to show when no deliverable goes out as a post', async () => {
    api.get.mockResolvedValueOnce({ data: progress({ deliverables: [{ id: 'd3', countable: false, posts: [] }] }) });
    const { container } = render(<DeliverableProgress eventId="e1" />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});

describe('PostDeal', () => {
  beforeEach(() => { api.get.mockReset(); api.post.mockReset(); api.delete.mockReset(); });

  test('links a post to an open deliverable of its format, then shows what it counts toward', async () => {
    api.get.mockResolvedValueOnce({ data: { counts_toward: null, open: [{ deliverable_id: 'd1', name: 'Velour cover · Pulse stories', line: 'Pulse stories: 2 of 3' }] } });
    render(<PostDeal postId="p9" />);
    const select = await screen.findByLabelText('Counts toward a deal');
    fireEvent.change(select, { target: { value: 'd1' } });
    api.post.mockResolvedValueOnce({ data: {} });
    api.get.mockResolvedValueOnce({ data: { counts_toward: { deliverable_id: 'd1', name: 'Velour cover · Pulse stories' }, open: [] } });
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/deliverable-progress/deliverables/d1/posts', { post_id: 'p9' }));
    expect((await screen.findByTestId('post-deal')).textContent).toContain('Counts toward Velour cover · Pulse stories');
  });

  test('hidden when the post could count toward nothing', async () => {
    api.get.mockResolvedValueOnce({ data: { counts_toward: null, open: [] } });
    const { container } = render(<PostDeal postId="p9" />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});
