/**
 * Story Clock's day planner (Evoni's mock, 2026-10-17): the slots with their
 * counts, the chosen slot's posts and Later today, the editor, and Add story.
 */
import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../services/api';
import PulseStoryPlanner from './PulseStoryPlanner';
import PulseStoryClock from './PulseStoryClock';
import { PulseRevealProvider } from './PulseRevealContext';

const at = (h, m = 0) => new Date(2026, 9, 16, h, m).toISOString();
let posts;

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  posts = [
    { id: 'p1', status: 'draft', release_state: 'scheduled', release_at: at(10), poster_display_name: 'Lala', poster_handle: 'lala', content_text: 'a quiet kind of focus today.', tags: ['Studio', 'BTS'] },
    { id: 'p2', status: 'draft', release_at: null, release_state: null, poster_display_name: 'Lala', content_text: 'not on the planner' },
    { id: 'p3', status: 'live', posted_at: at(12), poster_display_name: 'Lala', content_text: 'meeting with the team.', tags: [] },
  ];
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.startsWith('/api/v1/feed-posts?')) return { data: { data: posts } };
    if (url.startsWith('/api/v1/pulse-voices')) return { data: { characters: [{ handle: 'sable', social_profile_id: 7, display_name: 'Sable' }] } };
    return { data: {} };
  });
  vi.mocked(api.put).mockResolvedValue({ data: {} });
  vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'new' } } });
});

const renderPlanner = () => render(<MemoryRouter><PulseStoryPlanner showId="show-1" day="2026-10-16" /></MemoryRouter>);

describe('the day planner', () => {
  test('each slot counts its posts; the first with posts opens; later posts follow', async () => {
    renderPlanner();
    await waitFor(() => expect(screen.getByTestId('sp-slot-studio').textContent).toContain('1 post'));
    expect(screen.getByTestId('sp-slot-lunch').textContent).toContain('1 post');
    expect(screen.getByTestId('sp-slot-morning').textContent).toContain('0 posts');
    expect(screen.getByRole('heading', { name: '10:00 AM · Work / Studio' })).toBeTruthy();
    const slot = within(screen.getByTestId('sp-slot-posts'));
    expect(slot.getByText('a quiet kind of focus today.')).toBeTruthy();
    expect(slot.getByText('Scheduled')).toBeTruthy();
    expect(slot.getByText('BTS')).toBeTruthy();
    expect(within(screen.getByTestId('sp-later')).getByText('Posted')).toBeTruthy();
    expect(screen.queryByText('not on the planner')).toBeNull();
    fireEvent.click(screen.getByTestId('sp-slot-lunch'));
    expect(screen.getByRole('heading', { name: '12:00 PM · Lunch' })).toBeTruthy();
  });

  test('editing a draft: words, tags and a new time are saved', async () => {
    renderPlanner();
    await screen.findByTestId('sp-slot-posts');
    fireEvent.click(within(screen.getByTestId('sp-slot-posts')).getByRole('button', { name: "Edit Lala's post" }));
    const editor = within(screen.getByTestId('sp-editor'));
    expect(editor.getByLabelText('Caption').value).toBe('a quiet kind of focus today.');
    fireEvent.change(editor.getByLabelText('Caption'), { target: { value: 'this dress is almost there.' } });
    fireEvent.click(editor.getByRole('button', { name: 'Remove the tag BTS' }));
    fireEvent.change(editor.getByLabelText('Add a tag'), { target: { value: 'Design Process' } });
    fireEvent.keyDown(editor.getByLabelText('Add a tag'), { key: 'Enter' });
    fireEvent.change(editor.getByLabelText('Time'), { target: { value: '10:20' } });
    fireEvent.click(editor.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/p1/release-time', expect.objectContaining({ mode: 'schedule', at: new Date('2026-10-16T10:20').toISOString(), anyway: false })));
    expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/p1', { content_text: 'this dress is almost there.' });
    expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/p1/tags', { tags: ['Studio', 'Design Process'] });
    await waitFor(() => expect(screen.queryByTestId('sp-editor')).toBeNull());
  });

  test('a posted story keeps its words and time', async () => {
    renderPlanner();
    fireEvent.click(await screen.findByTestId('sp-slot-lunch'));
    fireEvent.click(within(screen.getByTestId('sp-slot-posts')).getByRole('button', { name: "Edit Lala's post" }));
    const editor = within(screen.getByTestId('sp-editor'));
    expect(editor.getByLabelText('Caption').readOnly).toBe(true);
    expect(editor.getByLabelText('Time').disabled).toBe(true);
    expect(editor.getByText(/Tags can still change/)).toBeTruthy();
  });

  test('adding to a slot: a new story at its time, posted by the chosen character', async () => {
    renderPlanner();
    fireEvent.click(await screen.findByTestId('sp-add-to-slot'));
    const editor = within(screen.getByTestId('sp-editor'));
    expect(editor.getByLabelText('Time').value).toBe('10:00');
    await waitFor(() => expect(editor.getByRole('option', { name: 'Sable' })).toBeTruthy());
    fireEvent.change(editor.getByLabelText('Character'), { target: { value: '7' } });
    fireEvent.change(editor.getByLabelText('Caption'), { target: { value: 'notes, coffee, and a lot of ideas.' } });
    fireEvent.click(editor.getByRole('button', { name: 'Add story' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/feed-posts', expect.objectContaining({ poster_handle: 'sable', content_text: 'notes, coffee, and a lot of ideas.', status: 'draft' })));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/new/release-time', expect.objectContaining({ mode: 'schedule' })));
  });
});

test('a time that breaks the story order: its problems, then Schedule anyway, without a second post', async () => {
  vi.mocked(api.put).mockImplementation(async (url, body) => {
    if (url.endsWith('/release-time') && !body.anyway) throw { response: { status: 409, data: { error: 'This time breaks the story order.', problems: ['Before its episode airs'] } } };
    return { data: {} };
  });
  renderPlanner();
  fireEvent.click(await screen.findByTestId('sp-add-to-slot'));
  const editor = within(screen.getByTestId('sp-editor'));
  fireEvent.change(editor.getByLabelText('Caption'), { target: { value: 'too early' } });
  fireEvent.click(editor.getByRole('button', { name: 'Add story' }));
  expect((await editor.findByTestId('sp-problems')).textContent).toContain('Before its episode airs');
  fireEvent.click(editor.getByRole('button', { name: 'Schedule anyway' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/new/release-time', expect.objectContaining({ anyway: true })));
  expect(api.post).toHaveBeenCalledTimes(1);
});

describe('Story Clock', () => {
  test('the planner first, with the day and Add story; the story-moment preview is the second view', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.startsWith('/api/v1/episodes')) return { data: { data: [] } };
      if (url.startsWith('/api/v1/feed-posts?')) return { data: { data: [] } };
      return { data: {} };
    });
    render(<MemoryRouter><PulseRevealProvider showId="show-1"><PulseStoryClock now={new Date(2026, 9, 16, 9)} /></PulseRevealProvider></MemoryRouter>);
    expect(await screen.findByTestId('sp-planner')).toBeTruthy();
    expect(screen.getByTestId('sc-day').textContent).toBe('Fri, Oct 16, 2026');
    fireEvent.click(screen.getByRole('button', { name: 'The day after' }));
    expect(screen.getByTestId('sc-day').textContent).toBe('Sat, Oct 17, 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByTestId('sc-day').textContent).toBe('Fri, Oct 16, 2026');
    fireEvent.click(screen.getByTestId('sc-add'));
    expect(await screen.findByTestId('sp-editor')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'The Pulse at a story moment' }));
    expect(await screen.findByTestId('pulse-clock')).toBeTruthy();
    expect(screen.queryByTestId('sp-planner')).toBeNull();
  });
});
