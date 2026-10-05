/**
 * Producer Mode → Lala's Feed (Evoni's redesign, 2026-10-05: "bring the
 * feed back"). Pure helpers over the show's feed posts
 * (GET /api/v1/feed-posts?show_id=&status=). A post is a draft or live
 * (services/feedPostStatus.js); a draft tied to an episode goes live when
 * that episode is published, any other draft when Evoni approves it.
 */

export const FEED_VIEWS = [
  { key: 'queue', label: 'Queue' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'live', label: 'Live' },
];

/** The posts a view lists: Queue the drafts waiting on approval, Scheduled the drafts going out with an episode, Live the posted ones. */
export function postsFor(view, drafts, live) {
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

/** When a draft goes out: with its episode, or once approved. */
export function goesLive(post, episodes = []) {
  if (post?.status === 'live') return null;
  if (!post?.episode_id) return 'Goes live when you approve it';
  const ep = episodes.find((e) => e.id === post.episode_id);
  return `Goes live with Episode ${ep?.episode_number ?? '?'}`;
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
