/**
 * Story Clock's day planner (Evoni's mock, 2026-10-17): the day runs 6 AM to
 * 6 AM in ten slots; a post's time is its release time, or when it was
 * posted; savePost does a whole edit in order.
 */
import { vi, describe, test, expect, beforeEach } from 'vitest';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../services/api';
import {
  SLOTS, addDays, bySlot, dayWindow, firstSlot, formOf, plannerApi, plannerDayOf, slotOf, slotStart, slotTime, statusOf, whenOf,
} from './storyPlanner';

const at = (d, h, m = 0) => new Date(2026, 9, d, h, m);

describe('the day and its slots', () => {
  test('a day is 6 AM to 6 AM; before 6 AM is the day before', () => {
    const [from, to] = dayWindow('2026-10-16');
    expect([from.getDate(), from.getHours(), to.getDate(), to.getHours()]).toEqual([16, 6, 17, 6]);
    expect(plannerDayOf(at(17, 2))).toBe('2026-10-16');
    expect(plannerDayOf(at(17, 6))).toBe('2026-10-17');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });

  test('ten slots, each time in one', () => {
    expect(SLOTS.map(slotTime)).toEqual(['6:00 AM', '8:00 AM', '10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '6:00 PM', '8:00 PM', '10:00 PM', '12:00 AM']);
    expect(slotOf(at(16, 10, 20)).label).toBe('Work / Studio');
    expect(slotOf(at(16, 23, 59)).label).toBe('Wind Down');
    expect(slotOf(at(17, 1)).label).toBe('Late Night');
    expect(slotStart('2026-10-16', SLOTS[9]).getDate()).toBe(17);
  });

  test("a post's time and status", () => {
    expect(whenOf({ status: 'draft', release_at: at(16, 10).toISOString() }).getHours()).toBe(10);
    expect(whenOf({ status: 'live', posted_at: at(16, 12).toISOString() }).getHours()).toBe(12);
    expect(whenOf({ status: 'draft', posted_at: at(16, 12).toISOString() })).toBeNull();
    expect(['live', 'scheduled', 'held', 'draft'].map((s) => statusOf(s === 'live' ? { status: 'live' } : { status: 'draft', release_state: s === 'draft' ? null : s })))
      .toEqual(['live', 'scheduled', 'held', 'draft']);
  });

  test('bySlot groups in time order; firstSlot is now on today, else the first with posts', () => {
    const posts = [
      { id: 'b', status: 'draft', release_state: 'scheduled', release_at: at(16, 10, 20).toISOString() },
      { id: 'a', status: 'live', posted_at: at(16, 10, 0).toISOString() },
      { id: 'c', status: 'draft', release_at: at(16, 18).toISOString() },
    ];
    const g = bySlot(posts);
    expect(g.studio.map((p) => p.id)).toEqual(['a', 'b']);
    expect(g.evening.map((p) => p.id)).toEqual(['c']);
    expect(firstSlot('2026-10-16', g, at(20, 9))).toBe('studio');
    expect(firstSlot('2026-10-16', g, at(16, 15))).toBe('shopping');
    expect(firstSlot('2026-10-16', bySlot([]), at(20, 9))).toBe('morning');
  });

  test("formOf: a new post starts at the slot's time, scheduled, as Lala", () => {
    expect(formOf(null, '2026-10-16', SLOTS[2])).toEqual({ content_text: '', character: 'lala', date: '2026-10-16', time: '10:00', status: 'scheduled', tags: [] });
    expect(formOf({ id: 'p', status: 'draft', release_state: 'held', social_profile_id: 7, content_text: 'x', tags: ['BTS'] }, '2026-10-16', SLOTS[0]))
      .toMatchObject({ character: '7', status: 'held', tags: ['BTS'], time: '06:00' });
  });
});

describe('plannerApi', () => {
  beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()); });

  test("day reads every post going out in the day's window", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 'p' }] } });
    expect(await plannerApi.day('show 1', '2026-10-16')).toEqual([{ id: 'p' }]);
    const [from, to] = dayWindow('2026-10-16');
    expect(api.get).toHaveBeenCalledWith(`/api/v1/feed-posts?show_id=show%201&status=all&limit=100&day_from=${encodeURIComponent(from.toISOString())}&day_to=${encodeURIComponent(to.toISOString())}`);
  });

  test('characters: Lala first, then the posting characters, once each', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { characters: [{ handle: 'lala', social_profile_id: 1, display_name: 'Lala' }, { handle: 'sable', social_profile_id: 7, display_name: 'Sable' }], not_met: [{ handle: 'tasha', social_profile_id: 9, display_name: 'Tasha' }] } });
    expect((await plannerApi.characters('s1')).map((c) => [c.value, c.name])).toEqual([['lala', 'Lala'], ['7', 'Sable'], ['9', 'Tasha']]);
  });

  test('a new post: created as a draft with its tags and poster, then scheduled', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'new' } } });
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    const form = { content_text: ' notes, coffee ', character: '7', date: '2026-10-16', time: '10:20', status: 'scheduled', tags: ['Notes'] };
    const id = await plannerApi.savePost({ showId: 's1', post: null, form, characters: [{ value: '7', handle: 'sable', name: 'Sable', profileId: 7 }] });
    expect(id).toBe('new');
    expect(api.post).toHaveBeenCalledWith('/api/v1/feed-posts', expect.objectContaining({ show_id: 's1', content_text: 'notes, coffee', status: 'draft', tags: ['Notes'], poster_handle: 'sable', social_profile_id: 7 }));
    expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/new/release-time', { mode: 'schedule', at: new Date('2026-10-16T10:20').toISOString() });
  });

  test('an existing draft: only what changed is saved; draft clears its release time; post now goes live', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    const post = { id: 'p', status: 'draft', release_state: 'scheduled', content_text: 'a', tags: ['A'] };
    await plannerApi.savePost({ showId: 's1', post, form: { content_text: 'a', tags: ['A'], status: 'draft', date: '', time: '' } });
    expect(vi.mocked(api.put).mock.calls).toEqual([['/api/v1/feed-posts/p/release-time', { mode: 'clear' }]]);
    vi.mocked(api.put).mockClear();
    await plannerApi.savePost({ showId: 's1', post, form: { content_text: 'b', tags: ['A', 'B'], status: 'live', date: '', time: '' } });
    expect(vi.mocked(api.put).mock.calls).toEqual([
      ['/api/v1/feed-posts/p', { content_text: 'b' }],
      ['/api/v1/feed-posts/p/tags', { tags: ['A', 'B'] }],
      ['/api/v1/feed-posts/p', { status: 'live' }],
    ]);
  });

  test('a live post: only its tags', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    await plannerApi.savePost({ showId: 's1', post: { id: 'p', status: 'live', content_text: 'a', tags: [] }, form: { content_text: 'changed', tags: ['Lunch'], status: 'live', date: '', time: '' } });
    expect(vi.mocked(api.put).mock.calls).toEqual([['/api/v1/feed-posts/p/tags', { tags: ['Lunch'] }]]);
  });
});
