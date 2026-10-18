/**
 * Short story canon (stage D): each short story with what it adds; accept
 * or dismiss; a contradiction can only be noted; over-budget secrets say
 * so; a story can be read again; nothing shows with no short story.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import api from '../../services/api';
import EpisodeStoryCanon from './EpisodeStoryCanon';

const P = (id, kind, more) => ({ id, story_id: 'st1', kind, status: 'pending', ...more });
const STORY = (proposals, more = {}) => ({ id: 'st1', title: 'The Gala', created_at: '2026-10-17T20:00:00Z', word_count: 2400, reviewed_at: '2026-10-17T20:01:00Z', proposals, ...more });
const PROPS = [
  P('p1', 'secret', { text: 'She sold the ring', what: 'revealed', how: 'The pawnshop', permission: 'hint', over_budget: true }),
  P('p2', 'fact', { text: 'The ring went to a pawnshop on Ninth' }),
  P('p3', 'thread', { thread_id: null, title: 'Will Lala find out?', note: '' }),
  P('p4', 'contradiction', { text: 'Lala left alone in the episode' }),
];
const DATA = (stories, pending = 3) => ({ data: { stories, pending } });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockResolvedValue(DATA([STORY(PROPS)]));
});

describe('Short story canon', () => {
  test('each kind, the over-budget warning, and how many to decide', async () => {
    render(<EpisodeStoryCanon episodeId="ep-1" />);
    const ring = within(await screen.findByTestId('esr-prop-p1'));
    expect(api.get).toHaveBeenCalledWith('/api/v1/book-from-show/episodes/ep-1/canon');
    expect(ring.getByText(/Goes past what a short story may do with this secret \(hint only\)/)).toBeTruthy();
    expect(screen.getByText('3 to decide')).toBeTruthy();
    expect(within(screen.getByTestId('esr-prop-p3')).getByText('Opens:')).toBeTruthy();
    const flag = within(screen.getByTestId('esr-prop-p4'));
    expect(flag.queryByRole('button', { name: /Accept/ })).toBeNull();
    expect(flag.getByRole('button', { name: /Noted/ })).toBeTruthy();
  });

  test('accept and dismiss', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce(DATA([STORY([{ ...PROPS[0], status: 'accepted' }, ...PROPS.slice(1)])], 2))
      .mockResolvedValueOnce(DATA([STORY([{ ...PROPS[0], status: 'accepted' }, { ...PROPS[1], status: 'dismissed' }, ...PROPS.slice(2)])], 1));
    render(<EpisodeStoryCanon episodeId="ep-1" />);
    fireEvent.click(within(await screen.findByTestId('esr-prop-p1')).getByRole('button', { name: /Accept/ }));
    await waitFor(() => expect(within(screen.getByTestId('esr-prop-p1')).getByText('Canon')).toBeTruthy());
    expect(api.post).toHaveBeenCalledWith('/api/v1/book-from-show/canon/p1/accept');
    fireEvent.click(within(screen.getByTestId('esr-prop-p2')).getByRole('button', { name: /Dismiss/ }));
    await waitFor(() => expect(within(screen.getByTestId('esr-prop-p2')).getByText('Not canon')).toBeTruthy());
    expect(api.post).toHaveBeenLastCalledWith('/api/v1/book-from-show/canon/p2/dismiss');
    expect(screen.getByText('1 to decide')).toBeTruthy();
  });

  test('not checked yet: check it', async () => {
    vi.mocked(api.get).mockResolvedValue(DATA([STORY([], { reviewed_at: null })], 0));
    vi.mocked(api.post).mockResolvedValue(DATA([STORY(PROPS)]));
    render(<EpisodeStoryCanon episodeId="ep-1" />);
    expect(await screen.findByText('Not checked yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Check this story/ }));
    expect(await screen.findByTestId('esr-prop-p2')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/api/v1/book-from-show/stories/st1/canon/review', {}, { timeout: 180000 });
  });

  test('checked and nothing added says so; a failure says so', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockResolvedValue(DATA([STORY([])], 0));
    vi.mocked(api.post).mockRejectedValue({ response: { data: { error: 'The story has no text yet.' } } });
    render(<EpisodeStoryCanon episodeId="ep-1" />);
    expect(await screen.findByText(/It adds nothing to canon/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Read it again/ }));
    expect(await screen.findByText('The story has no text yet.')).toBeTruthy();
  });

  test('no short story yet: nothing shows; a new one reloads it', async () => {
    vi.mocked(api.get).mockResolvedValue(DATA([], 0));
    const { container, rerender } = render(<EpisodeStoryCanon episodeId="ep-1" refreshKey={0} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    expect(container.textContent).toBe('');
    vi.mocked(api.get).mockResolvedValue(DATA([STORY([], { reviewed_at: null })], 0));
    rerender(<EpisodeStoryCanon episodeId="ep-1" refreshKey={1} />);
    expect(await screen.findByTestId('esr-story-st1')).toBeTruthy();
  });
});
