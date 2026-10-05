import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import LalaFeedTab from './LalaFeedTab';

const DRAFTS = [
  { id: 'd1', poster_handle: 'lala', poster_display_name: 'Lala', content_text: 'Gold heels or the ones I can walk in?', status: 'draft' },
  { id: 'd2', poster_handle: 'stable', content_text: 'Our pump, her design.', status: 'draft', episode_id: 'e1', ai_generated: true, narrative_function: 'brand_moment' },
];
const LIVE = [{ id: 'l1', poster_handle: 'mayaxo', content_text: 'Wait, she sewed that??', status: 'live', posted_at: new Date(Date.now() - 2 * 3600e3).toISOString() }];
const DELETED = [{ id: 'x1', poster_handle: 'lala', poster_display_name: 'Lala', content_text: 'Never mind.', status: 'draft', deleted_at: new Date(Date.now() - 3 * 3600e3).toISOString() }];
const episodes = [{ id: 'e1', episode_number: 1 }];
const wrap = (props = {}) => render(<MemoryRouter><LalaFeedTab showId="show-1" episodes={episodes} {...props} /></MemoryRouter>);

describe("Lala's Feed tab", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockClear());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.includes('status=draft')) return { data: { data: DRAFTS } };
      if (url.includes('status=live')) return { data: { data: LIVE } };
      if (url.startsWith('/api/v1/feed-posts/deleted')) return { data: { data: DELETED } };
      return { data: {} };
    });
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.mocked(api.delete).mockResolvedValue({ data: {} });
  });

  test('the queue lists drafts waiting on approval, with counts on each view; what Lala sees lists live posts', async () => {
    const onCountChanged = vi.fn();
    wrap({ onCountChanged });
    const card = await screen.findByTestId('feed-post-d1');
    expect(card.textContent).toContain('Written by you');
    expect(card.textContent).toContain('Goes live when you approve it');
    expect(screen.queryByTestId('feed-post-d2')).toBeNull();
    expect(screen.getByTestId('feed-view-queue').textContent).toBe('Queue1');
    expect(screen.getByTestId('feed-view-scheduled').textContent).toBe('Scheduled1');
    expect(onCountChanged).toHaveBeenCalledWith(1);
    const sees = screen.getByTestId('feed-lala-sees');
    expect(sees.textContent).toContain('Wait, she sewed that??');
    expect(sees.textContent).toContain('2 hours ago');
    expect(within(sees).getByText('Open the full page').getAttribute('href')).toBe('/feed?layer=lalaverse');
  });

  test('Approve posts a draft live now, and the feed reloads', async () => {
    wrap();
    fireEvent.click(await screen.findByTestId('feed-approve-d1'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/d1', expect.objectContaining({ status: 'live', posted_at: expect.any(String) })));
    expect(await screen.findByText("Lala's post is live.")).toBeTruthy();
    expect(api.get.mock.calls.filter(([u]) => u.includes('status=draft')).length).toBeGreaterThanOrEqual(2);
  });

  test('Scheduled shows the episode drafts; Edit saves the text', async () => {
    wrap();
    await screen.findByTestId('feed-post-d1');
    fireEvent.click(screen.getByTestId('feed-view-scheduled'));
    const card = screen.getByTestId('feed-post-d2');
    expect(card.textContent).toContain('Episode 1');
    expect(card.textContent).toContain('Goes live with Episode 1');
    expect(card.textContent).toContain('Drafted from their profile and voice');
    expect(within(card).getByTestId('feed-approve-d2').textContent).toBe('Post now');
    fireEvent.click(within(card).getByText('Edit'));
    fireEvent.change(within(card).getByLabelText("Edit @stable's post"), { target: { value: 'Our pump. Her design.' } });
    fireEvent.click(within(card).getByText('Save'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/d2', { content_text: 'Our pump. Her design.' }));
  });

  test('Delete asks first', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    wrap();
    const card = await screen.findByTestId('feed-post-d1');
    fireEvent.click(within(card).getByText('Delete'));
    expect(api.delete).not.toHaveBeenCalled();
    fireEvent.click(within(card).getByText('Delete'));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/feed-posts/d1'));
    confirm.mockRestore();
  });

  test('Post as Lala writes a post, live or as a draft', async () => {
    wrap();
    fireEvent.click(await screen.findByTestId('feed-post-as-lala'));
    const composer = screen.getByTestId('feed-composer');
    fireEvent.change(within(composer).getByLabelText("What's Lala posting?"), { target: { value: 'Studio day.' } });
    fireEvent.click(within(composer).getByText('Save as a draft'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/feed-posts', {
      show_id: 'show-1', content_text: 'Studio day.', poster_handle: 'lala', poster_display_name: 'Lala', status: 'draft',
    }));
    expect(await screen.findByText('Saved to the queue.')).toBeTruthy();
  });

  test('a live post has no edit or approve', async () => {
    wrap();
    await screen.findByTestId('feed-post-d1');
    fireEvent.click(screen.getByTestId('feed-view-live'));
    const card = screen.getByTestId('feed-post-l1');
    expect(within(card).queryByText('Edit')).toBeNull();
    expect(within(card).queryByTestId('feed-approve-l1')).toBeNull();
    expect(card.textContent).toContain('Posted 2 hours ago');
  });

  test('Deleted lists deleted posts with when; Restore brings one back', async () => {
    wrap();
    await screen.findByTestId('feed-post-d1');
    expect(api.get).toHaveBeenCalledWith('/api/v1/feed-posts/deleted?show_id=show-1&limit=50');
    expect(screen.getByTestId('feed-view-deleted').textContent).toBe('Deleted1');
    fireEvent.click(screen.getByTestId('feed-view-deleted'));
    const card = screen.getByTestId('feed-post-x1');
    expect(card.textContent).toContain('Deleted draft');
    expect(card.textContent).toContain('Deleted 3 hours ago');
    expect(within(card).queryByText('Edit')).toBeNull();
    fireEvent.click(within(card).getByTestId('feed-restore-x1'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/feed-posts/x1/restore'));
    expect(await screen.findByText("Lala's post is back.")).toBeTruthy();
  });

  test('Redraft in their voice rewrites a draft, says whose voice, and can be undone', async () => {
    vi.mocked(api.post).mockImplementation(async (url) => (url.endsWith('/redraft')
      ? { data: { data: { id: 'd2' }, previous_text: 'Our pump, her design.', voice: 'stable' } }
      : { data: {} }));
    wrap();
    await screen.findByTestId('feed-post-d1');
    fireEvent.click(screen.getByTestId('feed-view-scheduled'));
    fireEvent.click(screen.getByTestId('feed-redraft-d2'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/feed-posts/d2/redraft', {}));
    expect(await screen.findByText("Redrafted in @stable's voice.")).toBeTruthy();
    fireEvent.click(screen.getByTestId('feed-redraft-undo'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/d2', { content_text: 'Our pump, her design.' }));
    expect(await screen.findByText('The redraft is undone.')).toBeTruthy();
    expect(screen.queryByTestId('feed-redraft-undo')).toBeNull();
  });
});
