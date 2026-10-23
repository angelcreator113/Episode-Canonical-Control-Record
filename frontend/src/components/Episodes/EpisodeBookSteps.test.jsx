/**
 * The book follows the show, on an episode's Results › Story (Evoni,
 * 2026-10-19; it was "This week's episode", Evoni, 2026-10-15): one path,
 * in order (Evoni, 2026-10-22 layout list): the story record, the short
 * story, the canon check, the beat 11 piece and the chapter, then "Plan the
 * next chapters" folded at the bottom.
 */
import React from 'react';
import { vi, beforeEach, describe, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
import api from '../../services/api';
import EpisodeBookSteps, { episodeToOpen, PlanChapters } from './EpisodeBookSteps';
import { EpisodeResultsStory } from './EpisodeResultsPages';

const EP1 = { id: 'e1', episode_number: 1, title: 'The Gala', status: 'published', short_story: { id: 'st1', status: 'draft', word_count: 2400, has_beat11: true }, chapter: { id: 'c1', title: 'One', written: true } };
const EP2 = { id: 'e2', episode_number: 2, title: 'The Brunch', status: 'draft', short_story: null, chapter: null };
let ledger;
let record;
let canon;
let books;

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach((fn) => fn.mockReset());
  ledger = { show_id: 's1', episodes: [EP1, EP2], owed: { short_stories: 1, beat11: 0, chapters: 1 }, transfer: null };
  record = null;
  canon = { stories: [], pending: 0 };
  books = [{ id: 'b1', title: 'Before Lala' }];
  vi.mocked(api.get).mockImplementation(async (url, opts) => {
    if (url === '/api/v1/storyteller/books') return { data: { books: opts?.params?.show_id ? [] : books } };
    if (url === '/api/v1/book-from-show/books/b1/ledger') return { data: ledger };
    if (url.endsWith('/beat11-excerpt')) return { data: { excerpt: null } };
    if (url.endsWith('/record')) return { data: { record, cast: [], threads: [] } };
    if (url.endsWith('/canon')) return { data: canon };
    throw new Error(`unexpected ${url}`);
  });
});

const renderIt = (episode = { id: 'e2', show_id: 's1' }) => render(
  <MemoryRouter initialEntries={['/episodes/e2?tab=story']}>
    <Routes>
      <Route path="/episodes/:id" element={<EpisodeBookSteps episode={episode} />} />
      <Route path="/chapter/:bookId/:chapterId" element={<div>write mode</div>} />
    </Routes>
  </MemoryRouter>,
);

test('the episode that still owes something is the one /this-week opens', () => {
  expect(episodeToOpen([EP1, EP2]).id).toBe('e2');
  expect(episodeToOpen([EP1]).id).toBe('e1');
  expect(episodeToOpen([])).toBeNull();
});

test('walks this episode: the book with no show is used, its steps say what is owed', async () => {
  renderIt();
  expect(await screen.findByText('Start the chapter')).toBeTruthy();
  // One path, in the order the work happens.
  const steps = screen.getAllByRole('listitem').filter((li) => li.dataset.testid?.startsWith('tw-step-'));
  expect(steps.map((li) => li.dataset.testid)).toEqual(['tw-step-record', 'tw-step-story', 'tw-step-canon', 'tw-step-beat11', 'tw-step-chapter']);
  expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent).slice(0, 5))
    .toEqual(['What changed', 'The short story', 'The canon check', 'The beat 11 piece', 'The chapter']);
  expect(screen.getByText('Write the short story')).toBeTruthy();
  expect(screen.getAllByText('Write the short story first.')).toHaveLength(2);
  expect(screen.getByRole('link', { name: 'Scene Planner' }).getAttribute('href')).toBe('/episodes/e2/plan');
  // The plan is for the whole book: folded at the bottom, with what the book owes.
  const fold = screen.getByTestId('tw-plan-fold');
  expect(fold.open).toBe(false);
  expect(within(fold.querySelector('summary')).getByText(/The book owes 1 short story, 0 beat 11 pieces and 1 chapter\. The consciousness transfer is not placed yet\./)).toBeTruthy();
  // No episode picker: the tab is the episode.
  expect(screen.queryByLabelText('Episode')).toBeNull();
});

test('another episode shows its own steps', async () => {
  renderIt({ id: 'e1', show_id: 's1' });
  expect(await screen.findByText('Open in Write Mode')).toBeTruthy();
  expect(screen.getByText('Read it on Stories')).toBeTruthy();
});

test('writes the short story, then shows the beat 11 step for it', async () => {
  vi.mocked(api.post).mockImplementation(async () => {
    ledger = { ...ledger, episodes: [EP1, { ...EP2, short_story: { id: 'st2', status: 'draft', word_count: 2100, has_beat11: false } }] };
    return { data: { success: true } };
  });
  renderIt();
  fireEvent.click(await screen.findByText('Write the short story'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/s1/episodes/e2/generate-story', { format: 'short_story' }, { timeout: 180000 }));
  expect(await screen.findByText('Cut the beat 11 piece')).toBeTruthy();
  expect(screen.getByText('Read it on Stories')).toBeTruthy();
});

test('starts the chapter tied to the episode and opens it in Write Mode', async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { chapter: { id: 'c2' } } });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
  renderIt();
  fireEvent.click(await screen.findByText('Start the chapter'));
  await screen.findByText('write mode');
  expect(api.post).toHaveBeenCalledWith('/api/v1/storyteller/books/b1/chapters', { title: 'Episode 2: The Brunch' });
  expect(api.put).toHaveBeenCalledWith('/api/v1/book-from-show/chapters/c2/episode', { episode_id: 'e2' });
});

test('a failure is shown', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(api.post).mockRejectedValue({ response: { data: { error: 'AI rate limit exceeded' } } });
  renderIt();
  fireEvent.click(await screen.findByText('Write the short story'));
  expect((await screen.findByRole('alert')).textContent).toBe('AI rate limit exceeded');
});

test("an episode missing from the book's list says so", async () => {
  renderIt({ id: 'e9', show_id: 's1' });
  expect(await screen.findByText("This episode is not in the book's list of episodes yet.")).toBeTruthy();
  // The plan still shows: it plans across episodes.
  expect(screen.getByTestId('tw-plan-fold').textContent).toContain('Plan the next chapters');
});

test('Results › Story: the path, the other formats as a row under it, the plan folded last', async () => {
  render(<MemoryRouter><EpisodeResultsStory episode={{ id: 'e2', show_id: 's1' }} /></MemoryRouter>);
  const path = await screen.findByRole('list', { name: 'From the episode to the book' });
  // The short story is written in one place only: step 2.
  expect(await screen.findAllByText('Write the short story')).toHaveLength(1);
  expect(screen.queryByTestId('results-story-short_story')).toBeNull();
  const more = screen.getByRole('heading', { name: 'More ways to tell it' });
  expect(path.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(['social_fiction', 'snippet', 'recap'].every((f) => screen.getByTestId(`results-story-${f}`))).toBe(true);
  const fold = await screen.findByTestId('tw-plan-fold');
  expect(more.compareDocumentPosition(fold) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('the next step is the only highlighted one; a done step folds and opens on tap', async () => {
  record = { status: 'approved', what_happened: 'She found the look.', characters: [], secrets: [], threads: [] };
  renderIt();
  const story = await screen.findByTestId('tw-step-story');
  const first = screen.getByTestId('tw-step-record');
  await waitFor(() => expect(first.className).toContain('is-done'));
  expect(story.className).toContain('is-next');
  expect(document.querySelectorAll('.tw-step.is-next')).toHaveLength(1);
  expect(screen.getByText('Write the short story').className).toContain('is-primary');
  expect(screen.getByText('Start the chapter').className).not.toContain('is-primary');
  // The approved record folds to its title; Open shows it again.
  const body = first.querySelector('.tw-step-body');
  expect(body.hidden).toBe(true);
  fireEvent.click(within(first).getByRole('button', { name: 'Open' }));
  expect(body.hidden).toBe(false);
  expect(within(first).getByDisplayValue('She found the look.')).toBeTruthy();
});

test('Save in What changed keeps the step open, so what it wrote shows', async () => {
  record = { status: 'draft', what_happened: 'x', characters: [], secrets: [], threads: [], relationships: [], follow_ups: [], goals: [], twists: [], applied: {} };
  vi.mocked(api.post).mockImplementation(async (url) => (url.endsWith('/record/approve')
    ? { data: { record: { ...record, status: 'approved' }, cast: [], threads: [], result: { written: [{ kind: 'thread', text: 'New thread: Who?' }], skipped: [] } } }
    : { data: {} }));
  renderIt();
  const first = await screen.findByTestId('tw-step-record');
  fireEvent.click(await within(first).findByTestId('wc-save'));
  expect(await within(first).findByText('New thread: Who?')).toBeTruthy();
  await waitFor(() => expect(first.className).toContain('is-done'));
  expect(first.querySelector('.tw-step-body').hidden).toBe(false);
});

test('a draft record is the next step and says Draft', async () => {
  record = { status: 'draft', what_happened: 'x', characters: [], secrets: [], threads: [] };
  renderIt();
  const first = await screen.findByTestId('tw-step-record');
  await waitFor(() => expect(within(first).getByText('Draft')).toBeTruthy());
  expect(first.className).toContain('is-next');
});

test('the canon check says what is left to decide, on the newest story when the book has none', async () => {
  books = [];
  canon = { stories: [
    { id: 'old', title: 'First', reviewed_at: '2026-10-20', proposals: [] },
    { id: 'new', title: 'Second', reviewed_at: '2026-10-21', proposals: [{ id: 'p1', kind: 'fact', text: 'She kept the ticket.', status: 'pending' }] },
  ], pending: 1 };
  renderIt();
  const step = await screen.findByTestId('tw-step-canon');
  await waitFor(() => expect(within(step).getByText('1 to decide')).toBeTruthy());
  expect(screen.getByTestId('tw-step-story').className).toContain('is-done');
  expect(screen.getByText('No book yet. Make one in the Universe, then come back.')).toBeTruthy();
  // The beat 11 piece reads the newest story.
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/book-from-show/stories/new/beat11-excerpt'));
});

test('with no book the short story is still written here, and canon reloads for it', async () => {
  books = [];
  vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
  renderIt();
  fireEvent.click(await screen.findByText('Write the short story'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/s1/episodes/e2/generate-story', { format: 'short_story' }, { timeout: 180000 }));
  await waitFor(() => expect(vi.mocked(api.get).mock.calls.filter(([u]) => u.endsWith('/e2/canon'))).toHaveLength(2));
});

test('each step keeps one line; the "?" opens the rest', async () => {
  renderIt();
  const first = await screen.findByTestId('tw-step-record');
  const why = within(first).getByRole('button', { name: 'About What changed' });
  const text = document.getElementById(why.getAttribute('aria-controls'));
  expect(text.hidden).toBe(true);
  fireEvent.click(why);
  expect(text.hidden).toBe(false);
  expect(text.textContent).toContain('its secrets move on with the audience');
});

test('the sidebar no longer lists "This week\'s episode" or sends "Structure" back to Stories', () => {
  const sidebar = readFileSync(resolve(process.cwd(), 'src/components/layout/Sidebar.jsx'), 'utf8');
  expect(sidebar).not.toMatch(/label: "This week's episode"/);
  expect(sidebar).not.toMatch(/label: 'Structure', route: '\/story-engine'/);
});

describe('Plan the next chapters', () => {
  const PLAN = [
    { episode_id: 'e2', episode_number: 2, episode_title: 'The Brunch', chapter_id: null, title: 'Mimosas at Noon', scene_goal: 'She plays it safe.', emotional_state_start: 'tired', emotional_state_end: 'restless', chapter_notes: 'Zion spills juice.', bleed: false },
    { episode_id: 'e3', episode_number: 3, episode_title: 'The Gala', chapter_id: 'c3', title: 'Velvet', scene_goal: 'x', emotional_state_start: '', emotional_state_end: '', chapter_notes: 'y', bleed: true },
  ];

  test('plans, lets her edit and pick, then adds the picked ones to the book', async () => {
    const onApplied = vi.fn();
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url.endsWith('/plan')) return { data: { plan: PLAN } };
      if (url.endsWith('/plan/apply')) return { data: { created: 1, filled: 0, chapters: ['c9'] } };
      throw new Error(url);
    });
    render(<PlanChapters bookId="b1" showId="s1" onApplied={onApplied} />);
    fireEvent.click(screen.getByText('Plan'));
    const title = await screen.findByLabelText('Chapter title for episode 2');
    expect(screen.getByText(/Episode 3: The Gala \(has a chapter: fills its empty plan only\) · the Lala bleed/)).toBeTruthy();
    fireEvent.change(title, { target: { value: 'Noon, Again' } });
    fireEvent.click(screen.getAllByRole('checkbox')[1]);   // leave episode 3 out
    fireEvent.click(screen.getByText('Add 1 to the book'));
    await screen.findByText('1 chapter added.');
    expect(api.post).toHaveBeenCalledWith('/api/v1/book-from-show/books/b1/plan', { show_id: 's1', count: 4 }, { timeout: 180000 });
    const [, applied] = vi.mocked(api.post).mock.calls.find(([u]) => u.endsWith('/plan/apply'));
    expect(applied.items.map((i) => [i.episode_id, i.title])).toEqual([['e2', 'Noon, Again']]);
    expect(onApplied).toHaveBeenCalled();
  });

  test('nothing to plan says so; a failure is shown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.post).mockResolvedValueOnce({ data: { plan: [], message: 'Every episode has its chapter.' } });
    render(<PlanChapters bookId="b1" showId="s1" />);
    fireEvent.click(screen.getByText('Plan'));
    expect(await screen.findByText('Every episode has its chapter.')).toBeTruthy();
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { error: 'AI rate limit exceeded' } } });
    fireEvent.click(screen.getByText('Plan'));
    expect((await screen.findByRole('alert')).textContent).toBe('AI rate limit exceeded');
  });
});
