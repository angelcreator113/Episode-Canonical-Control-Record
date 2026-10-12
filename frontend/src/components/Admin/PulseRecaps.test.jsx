/**
 * Admin › The Pulse › Recaps (Task 3009): build last week's recap; each
 * recap's status, title, intro and posts; reorder, take out, add from the
 * week; Save, then Publish (only when saved); Unpublish, Drop; a dropped
 * recap is read-only; none yet and a failed read.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import api from '../../services/api';
import PulseRecaps, { RecapCard, moved, weekShort } from './PulseRecaps';

const post = (id, name, likes) => ({ id, poster_handle: name.toLowerCase(), poster_display_name: name, content_text: `${name} says hi`, likes, comments_count: 1 });
const BIG = post('p1', 'Big', 900);
const MID = post('p2', 'Mid', 300);
const NEW = post('p3', 'New', 10);
const DRAFT = { id: 'r1', week_start: '2026-09-28', status: 'draft', title: 'The Pulse, week of 28 September', intro: null, posts: [BIG, MID], post_ids: ['p1', 'p2'] };
const PUBLISHED = { id: 'r0', week_start: '2026-09-21', status: 'published', title: 'An old week', intro: 'Hello', posts: [MID], post_ids: ['p2'] };
const DROPPED = { id: 'r9', week_start: '2026-09-14', status: 'dropped', title: 'Dropped week', intro: null, posts: [], post_ids: [] };

const renderIt = () => render(<MemoryRouter><PulseRecaps showId="show-1" /></MemoryRouter>);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation((url) => (url.includes('/candidates')
    ? Promise.resolve({ data: { posts: [BIG, MID, NEW] } })
    : Promise.resolve({ data: { recaps: [DRAFT, PUBLISHED, DROPPED] } })));
  vi.mocked(api.post).mockResolvedValue({ data: { success: true, created: true } });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
});

describe('helpers', () => {
  test('moved swaps a neighbour and keeps the ends', () => {
    expect(moved(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moved(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });
  test('weekShort', () => expect(weekShort('2026-09-28')).toMatch(/^28 Sep/));
});

describe('the Recaps tab', () => {
  test('lists each week with its status and posts; a published one links to the site; a dropped one is read-only', async () => {
    renderIt();
    const [draft, published, dropped] = await screen.findAllByTestId('pulse-recap-card');
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-recaps?show_id=show-1');
    expect(within(draft).getByText('Draft')).toBeTruthy();
    expect(within(draft).getAllByTestId('pulse-recap-post').map((li) => li.querySelector('b').textContent)).toEqual(['Big', 'Mid']);
    expect(within(published).getByRole('link', { name: 'See it on the site' }).getAttribute('href')).toBe('/pulse-recap/r0');
    expect(within(published).getByRole('button', { name: 'Unpublish' })).toBeTruthy();
    expect(within(dropped).getByLabelText('Title').disabled).toBe(true);
    expect(within(dropped).queryByRole('button', { name: 'Save' })).toBeNull();
  });

  test('reorder, take out and add from the week, then Save sends them; Publish waits for the save', async () => {
    renderIt();
    const [draft] = await screen.findAllByTestId('pulse-recap-card');
    const publish = within(draft).getByRole('button', { name: 'Publish' });
    expect(publish.disabled).toBe(false);
    fireEvent.click(within(draft).getByRole('button', { name: "Move Mid's post up" }));
    expect(publish.disabled).toBe(true);
    fireEvent.click(within(draft).getByRole('button', { name: "Take Big's post out" }));
    fireEvent.click(within(draft).getByRole('button', { name: 'Add from this week' }));
    const extra = await within(draft).findByTestId('pulse-recap-candidates');
    expect(within(extra).getAllByRole('listitem').map((li) => li.querySelector('b').textContent)).toEqual(['Big', 'New']);
    fireEvent.click(within(extra).getAllByRole('button', { name: 'Add' })[1]);
    fireEvent.change(within(draft).getByLabelText('Intro'), { target: { value: 'What a week.' } });
    fireEvent.click(within(draft).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-recaps/r1', {
      title: 'The Pulse, week of 28 September', intro: 'What a week.', post_ids: ['p2', 'p3'],
    }));
  });

  test('an edit stays until the recap is reloaded, and a reloaded recap replaces it', () => {
    const card = (recap) => <MemoryRouter><ul><RecapCard recap={recap} /></ul></MemoryRouter>;
    const { rerender } = render(card(DRAFT));
    const order = () => screen.getAllByTestId('pulse-recap-post').map((li) => li.querySelector('b').textContent);
    fireEvent.click(screen.getByRole('button', { name: "Move Mid's post up" }));
    expect(order()).toEqual(['Mid', 'Big']);
    rerender(card(DRAFT));
    expect(order()).toEqual(['Mid', 'Big']);
    rerender(card({ ...DRAFT, title: 'Saved title', posts: [MID, BIG, NEW] }));
    expect(order()).toEqual(['Mid', 'Big', 'New']);
    expect(screen.getByLabelText('Title').value).toBe('Saved title');
    expect(screen.getByRole('button', { name: 'Publish' }).disabled).toBe(false);
  });

  test('Publish, Unpublish and Drop call the API; a refusal shows', async () => {
    vi.mocked(api.post).mockImplementation((url) => (url.endsWith('/drop')
      ? Promise.reject({ response: { status: 409, data: { error: 'Unpublish it first.' } } })
      : Promise.resolve({ data: { success: true } })));
    renderIt();
    const [draft, published] = await screen.findAllByTestId('pulse-recap-card');
    fireEvent.click(within(draft).getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-recaps/r1/publish', {}));
    fireEvent.click(within(published).getByRole('button', { name: 'Unpublish' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-recaps/r0/unpublish', {}));
    fireEvent.click(within(draft).getByRole('button', { name: 'Drop' }));
    expect((await within(draft).findByRole('alert')).textContent).toBe('Unpublish it first.');
  });

  test("Build last week's recap says whether it was new; none yet and a failed read", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { recaps: [] } });
    const { unmount } = renderIt();
    expect((await screen.findByTestId('pulse-recap-empty')).textContent).toBe('No recaps yet.');
    fireEvent.click(screen.getByRole('button', { name: "Build last week's recap" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-recaps/build', { show_id: 'show-1' }));
    expect((await screen.findByRole('status')).textContent).toBe("Last week's recap is drafted.");
    unmount();
    vi.mocked(api.get).mockRejectedValue({ response: { status: 500 } });
    renderIt();
    expect((await screen.findByRole('alert')).textContent).toBe('The recaps could not be loaded.');
  });
});
