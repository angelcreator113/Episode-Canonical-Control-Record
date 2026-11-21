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
import PulseRecaps, { RecapCard, imageStateWords, moved, weekShort } from './PulseRecaps';

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

// The recap image rule (2026-11-15): a picture's standing and its rights, for an ADMIN.
describe("a post's picture: its standing and rights", () => {
  const CATEGORIES = [
    { key: 'original', label: 'Original photograph — owned or controlled', cleared: true, note: false },
    { key: 'licensed', label: 'Licensed image — permission held', cleared: true, note: true },
    { key: 'retailer', label: 'Retailer image — permission held', cleared: true, note: true },
    { key: 'ai_cleared', label: 'AI-generated image — cleared for public use', cleared: true, note: true },
    { key: 'unknown', label: 'Unknown / not cleared', cleared: false, note: false },
  ];
  const rights = (parts) => ({
    source_url: 'https://studio.example/a.png', library: { id: 'a1', status: 'approved', visibility: 'public', source: 'post', usage_rights: null },
    rights: null, cleared: false, ready: false, public_now: false, copy: null, revocation: null, why: ['no_rights_declared'], ...parts,
  });
  const withRights = (recap, ...list) => ({ ...recap, posts: recap.posts.map((p, i) => (list[i] ? { ...p, image_rights: list[i] } : p)) });
  const card = (recap, categories = CATEGORIES) => render(<MemoryRouter><ul><RecapCard recap={recap} rightsCategories={categories} onChange={vi.fn()} /></ul></MemoryRouter>);

  test('a post with no picture, or a read without the review (not an ADMIN), shows no rights controls', () => {
    const { unmount } = card(DRAFT);
    expect(screen.queryByTestId('pulse-recap-rights')).toBeNull();
    unmount();
    card(withRights(DRAFT, rights({})), null);
    expect(screen.queryByTestId('pulse-recap-rights')).toBeNull();
  });

  test('shows the library standing, the rights and the free-text usage note as context; the five categories are offered', () => {
    card(withRights(DRAFT, rights({ library: { id: 'a1', status: 'approved', visibility: 'public', source: 'post', usage_rights: 'ours, all uses' } })));
    const box = screen.getByTestId('pulse-recap-rights');
    expect(within(box).getByTestId('pulse-recap-rights-state').textContent).toBe('Picture: not on the recap page (text only): no rights are declared.');
    expect(box.textContent).toContain('Library: approved, public. Rights: not declared.');
    expect(box.textContent).toContain('Usage note on file (context only, not a clearance): ours, all uses');
    const select = within(box).getByLabelText("Rights for Big's picture");
    expect([...select.options].map((o) => o.textContent)).toEqual(['Not declared', ...CATEGORIES.map((c) => c.label)]);
    expect(within(box).getByRole('button', { name: "Save rights for Big's picture" }).disabled).toBe(true);   // nothing picked
  });

  test('saving a category sends it; a note goes only with licensed, retailer or AI-cleared', async () => {
    const onChange = vi.fn();
    render(<MemoryRouter><ul><RecapCard recap={withRights(DRAFT, rights({}))} rightsCategories={CATEGORIES} onChange={onChange} /></ul></MemoryRouter>);
    const box = screen.getByTestId('pulse-recap-rights');
    const select = within(box).getByLabelText("Rights for Big's picture");
    fireEvent.change(select, { target: { value: 'original' } });
    expect(within(box).queryByLabelText(/Private note/)).toBeNull();
    fireEvent.click(within(box).getByRole('button', { name: "Save rights for Big's picture" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-recaps/r1/posts/p1/image-rights', { category: 'original' }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());

    fireEvent.change(select, { target: { value: 'retailer' } });
    const note = within(box).getByLabelText(/Private note for Big's picture/);
    expect(note.maxLength).toBe(500);
    fireEvent.change(note, { target: { value: ' permission email, 3 Nov ' } });
    fireEvent.click(within(box).getByRole('button', { name: "Save rights for Big's picture" }));
    await waitFor(() => expect(api.put).toHaveBeenLastCalledWith('/api/v1/pulse-recaps/r1/posts/p1/image-rights', { category: 'retailer', note: 'permission email, 3 Nov' }));
  });

  test('a picture with no library record: saving asks for one to be made, and says it starts as a private draft', async () => {
    card(withRights(DRAFT, rights({ library: null, why: ['no_library_record'] })));
    const box = screen.getByTestId('pulse-recap-rights');
    expect(box.textContent).toContain('Library: no record of this picture.');
    expect(box.textContent).toContain('as a private draft (no file is copied)');
    fireEvent.change(within(box).getByLabelText("Rights for Big's picture"), { target: { value: 'unknown' } });
    fireEvent.click(within(box).getByRole('button', { name: "Save rights for Big's picture" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-recaps/r1/posts/p1/image-rights', { category: 'unknown', create: true }));
  });

  test('public now; cleared and waiting for a publish; and a refusal shows', async () => {
    vi.mocked(api.put).mockRejectedValue({ response: { status: 400, data: { error: 'category must be one of original, licensed, retailer, ai_cleared, unknown.' } } });
    const original = { category: 'original', label: CATEGORIES[0].label, note: null, declared_by: 'evoni@x.dev', declared_at: '2026-11-15T00:00:00.000Z' };
    card(withRights(DRAFT,
      rights({ rights: original, cleared: true, ready: true, public_now: true, copy: { key: 'site-public/recaps/r1/a.jpg', url: 'https://cdn.test/site-public/recaps/r1/a.jpg' }, why: [] }),
      rights({ rights: original, cleared: true, ready: true, why: [] })));
    const [first, second] = screen.getAllByTestId('pulse-recap-rights');
    expect(within(first).getByTestId('pulse-recap-rights-state').textContent).toBe('Picture: public on the recap page.');
    expect(within(first).queryByTestId('pulse-recap-revocation')).toBeNull();
    expect(within(second).getByTestId('pulse-recap-rights-state').textContent).toBe('Picture: cleared. It is copied to the public site the next time this recap is published.');
    expect(within(first).getByLabelText("Rights for Big's picture").value).toBe('original');
    fireEvent.change(within(first).getByLabelText("Rights for Big's picture"), { target: { value: 'unknown' } });
    fireEvent.click(within(first).getByRole('button', { name: "Save rights for Big's picture" }));
    expect((await within(first).findByRole('alert')).textContent).toMatch(/^category must be one of/);
  });

  test('a copy that may no longer be served is "revocation pending" with its key and address, and is never called revoked', () => {
    const copy = { key: 'site-public/recaps/r0/old.jpg', url: 'https://cdn.test/site-public/recaps/r0/old.jpg' };
    card({
      ...withRights(PUBLISHED, rights({
        library: { id: 'a1', status: 'approved', visibility: 'private', source: 'post', usage_rights: null },
        rights: { category: 'original', label: CATEGORIES[0].label, note: null }, cleared: true, copy, revocation: 'pending', why: ['not_public'],
      })),
      pending_revocations: [{ post_id: 'p2', ...copy }],
    });
    const box = screen.getByTestId('pulse-recap-rights');
    expect(within(box).getByTestId('pulse-recap-rights-state').textContent).toBe('Picture: not on the recap page (text only): its library record is not public.');
    const pending = within(box).getByTestId('pulse-recap-revocation').textContent;
    expect(pending).toContain('Revocation pending');
    expect(pending).toContain(copy.url);
    expect(pending).toContain(`key ${copy.key}`);
    expect(pending).toContain('still in the public bucket');
    expect(screen.getByTestId('pulse-recap-pending').textContent).toContain(copy.url);
    expect(screen.getByTestId('pulse-recap-card').textContent).not.toMatch(/revoked/i);
  });

  test('a dropped recap shows the standing, read-only; the Recaps tab passes the categories it was sent', async () => {
    const { unmount } = card(withRights({ ...DROPPED, posts: [BIG] }, rights({})));
    expect(screen.getByTestId('pulse-recap-rights-state')).toBeTruthy();
    expect(screen.queryByLabelText("Rights for Big's picture")).toBeNull();
    unmount();
    vi.mocked(api.get).mockResolvedValue({ data: { recaps: [withRights(DRAFT, rights({}))], rights_categories: CATEGORIES } });
    renderIt();
    expect((await screen.findByLabelText("Rights for Big's picture")).options).toHaveLength(6);
  });
});

describe('imageStateWords', () => {
  test('names an unknown reason as it is, and no reason as none', () => {
    expect(imageStateWords({ why: ['something_new'] })).toBe('Picture: not on the recap page (text only): something_new.');
    expect(imageStateWords({ why: [] })).toBe('Picture: not on the recap page (text only).');
  });
});
