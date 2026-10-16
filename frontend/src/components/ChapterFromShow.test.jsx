/**
 * Write Mode's "From the show" (Evoni, 2026-10-15; docs/CANON.md): tie the
 * chapter to its episode, write it from the episode as a preview, check it
 * against the short story, and see what the book still owes.
 */
import React from 'react';
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
import apiClient from '../services/api';
import ChapterFromShow from './ChapterFromShow';

const LEDGER = {
  show_id: 's1',
  episodes: [
    { id: 'e1', episode_number: 1, title: 'The Gala', short_story: { id: 'st1', has_beat11: true }, chapter: { id: 'c1', written: true } },
    { id: 'e2', episode_number: 2, title: 'The Brunch', short_story: null, chapter: null },
  ],
  owed: { short_stories: 1, beat11: 0, chapters: 1 },
};

let linked;
beforeEach(() => {
  window.localStorage.clear();
  Object.values(apiClient).forEach((fn) => fn.mockReset());
  linked = { episode: null, short_story: null };
  vi.mocked(apiClient.get).mockImplementation(async (url) => {
    if (url.endsWith('/ledger')) return { data: LEDGER };
    if (url.endsWith('/episode')) return { data: linked };
    throw new Error(`unexpected ${url}`);
  });
  vi.mocked(apiClient.put).mockImplementation(async (_url, body) => {
    linked = body.episode_id ? { episode: { id: body.episode_id, episode_number: 1, title: 'The Gala' }, short_story: { id: 'st1' } } : { episode: null, short_story: null };
    return { data: { success: true } };
  });
});

const renderIt = (props = {}) => render(<ChapterFromShow bookId="b1" chapterId="c9" prose="I watched the lights go out." onPreview={vi.fn()} {...props} />);

test('lists the episodes with what each has, and what the book owes', async () => {
  renderIt();
  const select = await screen.findByLabelText('From the show');
  expect([...select.options].map((o) => o.textContent)).toEqual([
    'Not tied to an episode',
    'Episode 1: The Gala · short story ✓ · chapter written',
    'Episode 2: The Brunch · no short story · no chapter',
  ]);
  fireEvent.click(screen.getByText(/The book owes: 1 short story, 0 beat 11 pieces, 1 chapter/));
  expect(screen.getByText('Ep 2: The Brunch')).toBeTruthy();
});

test('ties the chapter to an episode, then writes it as a preview', async () => {
  const onPreview = vi.fn();
  vi.mocked(apiClient.post).mockResolvedValue({ data: { prose: 'The night of the gala…' } });
  renderIt({ onPreview });
  fireEvent.change(await screen.findByLabelText('From the show'), { target: { value: 'e1' } });
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/api/v1/book-from-show/chapters/c9/episode', { episode_id: 'e1' }));
  fireEvent.click(await screen.findByText('Write this chapter from the episode'));
  await waitFor(() => expect(onPreview).toHaveBeenCalledWith('The night of the gala…'));
  expect(apiClient.post).toHaveBeenCalledWith('/api/v1/book-from-show/chapters/c9/write-from-episode', {}, { timeout: 180000 });
});

test('checks the draft against the short story and shows each contradiction', async () => {
  linked = { episode: { id: 'e1', episode_number: 1, title: 'The Gala' }, short_story: { id: 'st1' } };
  vi.mocked(apiClient.post).mockResolvedValue({ data: { issues: [{ chapter_says: 'the lights stayed on', story_says: 'the lights went out', why: 'Blackout.' }] } });
  renderIt();
  fireEvent.click(await screen.findByText('Check against the short story'));
  expect(await screen.findByText('the lights stayed on', { exact: false })).toBeTruthy();
  expect(apiClient.post).toHaveBeenCalledWith('/api/v1/book-from-show/chapters/c9/check-against-story', { prose: 'I watched the lights go out.' }, { timeout: 120000 });
});

test('a failure is shown, not swallowed', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  linked = { episode: { id: 'e1', episode_number: 1, title: 'The Gala' }, short_story: null };
  vi.mocked(apiClient.post).mockRejectedValue({ response: { data: { error: 'AI rate limit exceeded' } } });
  renderIt();
  fireEvent.click(await screen.findByText('Write this chapter from the episode'));
  expect((await screen.findByRole('alert')).textContent).toBe('AI rate limit exceeded');
  expect(screen.getByText(/no short story yet/)).toBeTruthy();
});
