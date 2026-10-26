/**
 * My Little List ♡ on the client (Evoni, 2026-10-26; Phase 2). The phone
 * reads only GET /episodes/:id/my-little-list (services/myLittleListService):
 * what Lala knows at that beat and line, in her words, each item exactly
 * { key, title, note, done, can_check, can_edit, can_remove }. The producer's
 * wording panel reads /review?all=1 and writes PUT /review/:key; the phone
 * never calls those (they carry production labels).
 */
import api from '../services/api';

export const APP_NAME = 'My Little List ♡';

const base = (episodeId) => `/api/v1/episodes/${encodeURIComponent(episodeId)}/my-little-list`;
const position = (beat, line) => {
  const q = new URLSearchParams();
  if (Number.isInteger(beat) && beat >= 1 && beat <= 14) q.set('beat', String(beat));
  if (Number.isInteger(line) && line >= 0) q.set('line', String(line));
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const listUrl = (episodeId, beat = null, line = null) => `${base(episodeId)}${position(beat, line)}`;
export const reviewUrl = (episodeId, beat = null, line = null) => {
  const p = position(beat, line);
  return `${base(episodeId)}/review${p ? `${p}&all=1` : '?all=1'}`;
};

/** The phone's list: { app, items, progress }. */
export async function fetchList(episodeId, beat = null, line = null) {
  const res = await api.get(listUrl(episodeId, beat, line));
  return { app: res.data?.app || APP_NAME, items: res.data?.items || [], progress: res.data?.progress || { done: 0, total: 0 } };
}

const at = (beat, line) => ({
  ...(Number.isInteger(beat) ? { beat } : {}),
  ...(Number.isInteger(line) ? { line } : {}),
});

export const tickItem = (episodeId, key, done, beat, line) => api.patch(`${base(episodeId)}/items/${key}`, { done, ...at(beat, line) });
export const editItem = (episodeId, key, title, beat, line) => api.patch(`${base(episodeId)}/items/${key}`, { title, ...at(beat, line) });
export const addReminder = (episodeId, title, reveal = null) => api.post(`${base(episodeId)}/items`, { title, ...(reveal ? { reveal } : {}) });
export const removeItem = (episodeId, key, beat, line) => api.delete(`${base(episodeId)}/items/${key}${position(beat, line)}`);

/** The producer's view: every item, its wording, when it shows and why not. */
export async function fetchReview(episodeId, beat = null, line = null) {
  const res = await api.get(reviewUrl(episodeId, beat, line));
  return { items: res.data?.items || [], issues: res.data?.issues || [] };
}
export const setWords = (episodeId, key, words) => api.put(`${base(episodeId)}/review/${key}`, words);

/** A progress line's share, 0-100. */
export const progressPercent = ({ done = 0, total = 0 } = {}) => (total > 0 ? Math.round((done / total) * 100) : 0);

/** The server's reason for a refused change, in plain words. */
export function refusalText(err) {
  const code = err?.response?.data?.code;
  if (code === 'COMPLETION_FROM_GAMEPLAY') return 'That one ticks itself as she plays.';
  if (code === 'PERSONAL_LIST_MIGRATION_PENDING') return 'Her list can be read, but saving waits for its update to go live.';
  if (code === 'LIST_ITEM_NOT_FOUND') return 'That item isn’t on her list at this point.';
  return err?.response?.data?.error || err?.message || 'That didn’t save.';
}

// Why an item doesn't show yet, for the producer.
export const REASON_LABELS = {
  not_known_yet: 'Not known yet',
  needs_wording: 'Needs your wording',
  spoiler: 'Names something she doesn’t know',
  duplicate_wording: 'Same words as another item',
  no_reveal_rule: 'No rule says when it shows',
};

/** "Shows from beat 5, line 3" / "from the start" / "at the end of beat 5". */
export function showsAtText(showsAt) {
  if (!showsAt) return 'Never, as things stand';
  if (showsAt.beat === 0) return 'From the start';
  if (showsAt.line === null || showsAt.line === undefined) return `At the end of beat ${showsAt.beat}`;
  return `From beat ${showsAt.beat}, line ${showsAt.line + 1}`;
}
