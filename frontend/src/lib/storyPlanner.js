/**
 * Story Clock's day planner (Evoni's Story Clock mock, 2026-10-17): Lala's
 * day in time slots, by the clock time posts go out (the release clock,
 * services/postRelease), not story time. Her day runs 6 AM to 6 AM, so Late
 * Night is after midnight. A post's time is its release time while it waits
 * and the time it was posted once live.
 *
 *   SLOTS                    the ten slots, Morning to Late Night
 *   dayWindow(day)           [start, end) of a 'YYYY-MM-DD' day
 *   slotOf(date)             the slot a time falls in
 *   slotStart(day, slot)     the slot's first minute on that day
 *   whenOf(post)             release_at, else posted_at, as a Date (or null)
 *   statusOf(post)           'live' | 'scheduled' | 'held' | 'draft'
 *   bySlot(posts)            { slotKey: [posts in time order] }
 *   plannerApi               the reads and saves (savePost does a whole edit)
 */
import api from '../services/api';
import { photosFormData } from './composerPhotos';

export const SLOTS = [
  { key: 'morning', hour: 6, label: 'Morning', about: 'Waking up, getting ready, the first look of the day.' },
  { key: 'on-the-go', hour: 8, label: 'On the Go', about: 'Coffee, the commute, out the door.' },
  { key: 'studio', hour: 10, label: 'Work / Studio', about: 'Studio work, fittings, content, creative process.' },
  { key: 'lunch', hour: 12, label: 'Lunch', about: 'A break, a meeting, who she eats with.' },
  { key: 'shopping', hour: 14, label: 'Shopping', about: 'Finds, fittings and hauls.' },
  { key: 'wellness', hour: 16, label: 'Wellness', about: 'Movement, rest and resets.' },
  { key: 'evening', hour: 18, label: 'Evening', about: 'Golden hour, plans and outfits for the night.' },
  { key: 'nightlife', hour: 20, label: 'Nightlife', about: 'Events, dinners and going out.' },
  { key: 'wind-down', hour: 22, label: 'Wind Down', about: 'Getting home, thoughts from the day.' },
  { key: 'late-night', hour: 0, label: 'Late Night', about: 'After midnight: the quiet, honest posts.' },
];
export const DAY_START_HOUR = 6;

export const STATUS_LABELS = { live: 'Posted', scheduled: 'Scheduled', held: 'Held', draft: 'Draft' };

const pad = (n) => String(n).padStart(2, '0');
/** 'YYYY-MM-DD' of a Date, in local time. */
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** 'HH:MM' of a Date, in local time. */
export const timeKey = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const parseDay = (day) => {
  const [y, m, d] = String(day).split('-').map(Number);
  return new Date(y, m - 1, d);
};
/** The day a moment belongs to: before 6 AM is the day before. */
export const plannerDayOf = (date) => dayKey(new Date(date.getTime() - DAY_START_HOUR * 3600e3));
export const addDays = (day, n) => { const d = parseDay(day); d.setDate(d.getDate() + n); return dayKey(d); };

export function dayWindow(day) {
  const start = parseDay(day);
  start.setHours(DAY_START_HOUR, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return [start, end];
}

export function slotOf(date) {
  const h = date.getHours();
  if (h < DAY_START_HOUR) return SLOTS[SLOTS.length - 1];
  return SLOTS[Math.min(SLOTS.length - 2, Math.floor((h - DAY_START_HOUR) / 2))];
}

export function slotStart(day, slot) {
  const d = parseDay(day);
  if (slot.hour < DAY_START_HOUR) d.setDate(d.getDate() + 1);
  d.setHours(slot.hour, 0, 0, 0);
  return d;
}

export const slotTime = (slot) => {
  const h = slot.hour % 12 || 12;
  return `${h}:00 ${slot.hour < 12 ? 'AM' : 'PM'}`;
};
export const clockLabel = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export function whenOf(post) {
  const at = post?.release_at || (post?.status === 'live' ? post?.posted_at : null);
  const d = at ? new Date(at) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

export function statusOf(post) {
  if (post?.status === 'live') return 'live';
  if (post?.release_state === 'scheduled') return 'scheduled';
  if (post?.release_state === 'held') return 'held';
  return 'draft';
}

export function bySlot(posts) {
  const out = Object.fromEntries(SLOTS.map((s) => [s.key, []]));
  for (const p of posts || []) {
    const when = whenOf(p);
    if (when) out[slotOf(when).key].push(p);
  }
  for (const key of Object.keys(out)) out[key].sort((a, b) => whenOf(a) - whenOf(b));
  return out;
}

/** The slot to open: the current one on today, else the first with posts, else Morning. */
export function firstSlot(day, grouped, now = new Date()) {
  if (plannerDayOf(now) === day) return slotOf(now).key;
  return (SLOTS.find((s) => grouped[s.key]?.length) || SLOTS[0]).key;
}

/** A post as the editor's form. */
export function formOf(post, day, slot) {
  const when = whenOf(post) || slotStart(day, slot);
  return {
    content_text: post?.content_text || '',
    character: post ? (post.social_profile_id ? String(post.social_profile_id) : (post.poster_handle || 'lala')) : 'lala',
    date: dayKey(when),
    time: timeKey(when),
    status: post ? statusOf(post) : 'scheduled',
    tags: Array.isArray(post?.tags) ? post.tags : [],
  };
}

const sameTags = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);

export const plannerApi = {
  day: (showId, day) => {
    const [from, to] = dayWindow(day);
    return api.get(`/api/v1/feed-posts?show_id=${encodeURIComponent(showId)}&status=all&limit=100&day_from=${encodeURIComponent(from.toISOString())}&day_to=${encodeURIComponent(to.toISOString())}`)
      .then((r) => (Array.isArray(r.data?.data) ? r.data.data : []));
  },
  /** Who can post: Lala, then the posting characters (Voices). */
  characters: (showId) => api.get(`/api/v1/pulse-voices?show_id=${encodeURIComponent(showId)}`).then((r) => {
    const rows = [...(r.data?.characters || []), ...(r.data?.not_met || [])];
    const out = [{ value: 'lala', handle: 'lala', name: 'Lala', profileId: null, portrait: null }];
    for (const c of rows) {
      if (!c.handle || out.some((o) => o.handle === c.handle)) continue;
      out.push({ value: String(c.social_profile_id), handle: c.handle, name: c.display_name || c.handle, profileId: c.social_profile_id, portrait: c.portrait_url || null });
    }
    return out;
  }),
  remove: (id) => api.delete(`/api/v1/feed-posts/${id}`),

  /**
   * One edit, in order: create (as a draft) or save the words and tags, add
   * the photo, then set when it goes out: scheduled at the date and time,
   * held, an ordinary draft, or posted now. A live post keeps its words and
   * time; only its tags change. Returns the post's id. A time that breaks
   * the story order throws with `problems` and `postId`; `anyway` sends it.
   */
  async savePost({ showId, post, form, characters = [], photo = null, anyway = false }) {
    let id = post?.id;
    const live = post?.status === 'live';
    if (!id) {
      const who = characters.find((c) => c.value === form.character) || { handle: 'lala', name: 'Lala', profileId: null };
      const res = await api.post('/api/v1/feed-posts', {
        show_id: showId, content_text: form.content_text.trim(), status: 'draft', tags: form.tags,
        poster_handle: who.handle, poster_display_name: who.name, social_profile_id: who.profileId || null, poster_platform: 'lalaverse',
      });
      id = res.data?.data?.id;
      if (!id) throw new Error('The post was not saved.');
    } else {
      if (!live && form.content_text.trim() !== (post.content_text || '').trim()) {
        await api.put(`/api/v1/feed-posts/${id}`, { content_text: form.content_text.trim() });
      }
      if (!sameTags(form.tags, post.tags)) await api.put(`/api/v1/feed-posts/${id}/tags`, { tags: form.tags });
    }
    if (live) return id;
    if (photo) await api.post(`/api/v1/feed-posts/${id}/photos`, photosFormData([photo]));
    const at = new Date(`${form.date}T${form.time}`);
    if (form.status === 'scheduled') {
      if (Number.isNaN(at.getTime())) throw new Error('Pick a date and a time.');
      try {
        await api.put(`/api/v1/feed-posts/${id}/release-time`, { mode: 'schedule', at: at.toISOString(), tz_offset: new Date().getTimezoneOffset(), anyway });
      } catch (err) {
        // A time that breaks the story order (services/postRelease): its
        // problems, and the post's id so "Schedule anyway" saves it, not a copy.
        const problems = err?.response?.status === 409 ? err.response.data?.problems : null;
        if (Array.isArray(problems) && problems.length) {
          const refused = new Error(err.response.data?.error || 'This time breaks the story order.');
          refused.problems = problems;
          refused.postId = id;
          throw refused;
        }
        throw err;
      }
    } else if (form.status === 'held') {
      if (post?.release_state !== 'held') await api.put(`/api/v1/feed-posts/${id}/release-time`, { mode: 'hold' });
    } else if (form.status === 'draft') {
      if (post?.release_state) await api.put(`/api/v1/feed-posts/${id}/release-time`, { mode: 'clear' });
    } else if (form.status === 'live') {
      await api.put(`/api/v1/feed-posts/${id}`, { status: 'live' });
    }
    return id;
  },
};
