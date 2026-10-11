/**
 * Producer Mode → Lala's Feed (Evoni's redesign, 2026-10-05: "bring the
 * feed back"). Pure helpers over the show's feed posts
 * (GET /api/v1/feed-posts?show_id=&status=). A post is a draft or live
 * (services/feedPostStatus.js); every draft goes live when Evoni approves it
 * (Requests on the Feed page; publishing an episode no longer does, Task #2749).
 */

export const FEED_VIEWS = [
  { key: 'queue', label: 'Queue' },
  // An episode's drafts wait for approval too (Evoni, 2026-10-11, Task
  // #2749); publishing the episode no longer puts them live.
  { key: 'scheduled', label: 'From episodes' },
  { key: 'live', label: 'Live' },
  { key: 'deleted', label: 'Deleted' },
];

/** The posts a view lists: Queue the wall's drafts waiting on approval, From episodes the episodes' drafts (waiting on approval too), Live the posted ones, Deleted the deleted ones. */
export function postsFor(view, drafts, live, deleted) {
  if (view === 'deleted') return deleted || [];
  if (view === 'live') return live || [];
  if (view === 'scheduled') return (drafts || []).filter((p) => p.episode_id);
  return (drafts || []).filter((p) => !p.episode_id);
}

/** Who posted it, as the card names them. */
export function posterName(post) {
  return post?.poster_display_name || post?.socialProfile?.display_name
    || (post?.poster_handle ? `@${String(post.poster_handle).replace(/^@/, '')}` : 'Lala');
}

/** Whether Lala wrote it herself (her handle, or no profile). */
export function isLalasPost(post) {
  return String(post?.poster_handle || '').replace(/^@/, '').toLowerCase() === 'lala';
}

/** Where a post came from: written by hand, or drafted. */
export function postOrigin(post) {
  if (!post?.ai_generated) return isLalasPost(post) ? 'Written by you' : 'Written by hand';
  return isLalasPost(post) ? 'Drafted in her voice' : 'Drafted from their profile and voice';
}

/** When a draft goes out: once approved, whether or not it came from an episode (Task #2749). */
export function goesLive(post, episodes = []) {
  if (post?.status === 'live') return null;
  if (!post?.episode_id) return 'Goes live when you approve it';
  const ep = episodes.find((e) => e.id === post.episode_id);
  return `From Episode ${ep?.episode_number ?? '?'} · goes live when you approve it`;
}

/** "2 hours ago" style, for What Lala sees. */
export function timeAgo(value, now = Date.now()) {
  const t = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(t)) return null;
  const mins = Math.max(0, Math.round((now - t) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
