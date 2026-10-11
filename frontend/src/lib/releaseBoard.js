/**
 * Producer Mode → Release → Next release (Evoni's redesign, 2026-10-05):
 * the next episode out the door and what it still needs, the feed posts
 * that go out with it, the release calendar and how released episodes went.
 * Pure helpers over the show's episodes, one episode's full row
 * (GET /episodes/:id), its feed posts (GET /feed-posts/episode/:id) and the
 * stat history (GET /world/:showId/history).
 *
 * What the data does not hold, the board does not claim: there is no stored
 * "final cut done" flag (an episode's status stands in for it), feed posts
 * are only draft or live (drafts go live when the episode is published), and
 * a held payout is not recorded.
 */
import { rowDeltas, episodeTier } from './castContinuity';

export const isReleased = (ep) => ep?.status === 'published';
const isArchived = (ep) => ep?.status === 'archived';
const byNumber = (a, b) => (Number(a.episode_number) || 0) - (Number(b.episode_number) || 0);

/** The episode to release next: the lowest-numbered one not yet published or archived. */
export function nextRelease(episodes) {
  return [...(episodes || [])].filter((e) => !isReleased(e) && !isArchived(e)).sort(byNumber)[0] || null;
}

// The platforms' entries in the episode's distribution; the style sheet sent
// there (Task #2878) is not platform copy or a schedule.
const platformEntries = (ep) => Object.entries(ep?.distribution_metadata || {})
  .filter(([key]) => key !== 'style_sheet').map(([, value]) => value);

/** When the episode goes live: its air date, else the earliest platform schedule in its distribution. */
export function goLive(ep) {
  if (ep?.air_date) return ep.air_date;
  const times = platformEntries(ep)
    .map((p) => p?.scheduled_time).filter(Boolean).sort();
  return times[0] || null;
}

/** "Oct 20, 2026" for a date, with the time when there is one. A day is read as that calendar day wherever the viewer is. */
export function formatWhen(value) {
  if (!value) return null;
  const raw = String(value);
  // A bare date, or a date saved as UTC midnight (air_date's DATE column from a date picker), is a day.
  const day = /^(\d{4})-(\d{2})-(\d{2})(T00:00:00(\.0+)?(Z|\+00:?00))?$/.exec(raw);
  const d = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...(day ? {} : { hour: 'numeric', minute: '2-digit' }) });
}

const titleApproved = (ep) => Boolean(ep?.title_approved_at) && ep?.title_approved_value === ep?.title;
const copyWritten = (ep) => platformEntries(ep)
  .some((p) => p && (p.title || p.description || p.caption));

/**
 * The next release's checklist: [{ key, label, state: 'ready'|'progress'|'todo', text }].
 * posts is the episode's feed posts, or null while they load.
 */
export function readiness(ep, posts) {
  const status = ep?.status || 'draft';
  const cut = status === 'published' || status === 'in_review'
    ? { state: 'ready', text: status === 'in_review' ? 'In review' : 'Released' }
    : status === 'in_build' ? { state: 'progress', text: 'In the edit' } : { state: 'todo', text: 'Not started' };
  const title = titleApproved(ep);
  const copy = copyWritten(ep);
  const words = title && copy ? { state: 'ready', text: 'Title approved · copy written' }
    : title ? { state: 'progress', text: 'Title approved · no copy yet' }
      : copy ? { state: 'progress', text: 'Copy written · title not approved' }
        : { state: 'todo', text: 'Not started' };
  let feed;
  if (posts == null) feed = { state: 'todo', text: 'Loading…' };
  else if (!posts.length) feed = { state: 'todo', text: 'None yet' };
  else {
    const live = posts.filter((p) => p.status === 'live').length;
    const drafts = posts.length - live;
    feed = { state: 'ready', text: [drafts && `${drafts} draft${drafts === 1 ? '' : 's'}`, live && `${live} live`].filter(Boolean).join(' · ') };
  }
  const when = goLive(ep);
  return [
    { key: 'cut', label: 'Final cut', ...cut },
    { key: 'thumbnail', label: 'Thumbnail', ...(ep?.thumbnail_url ? { state: 'ready', text: 'Ready' } : { state: 'todo', text: 'Missing' }) },
    { key: 'copy', label: 'Title & copy', ...words },
    { key: 'feed', label: 'Feed posts', ...feed },
    { key: 'schedule', label: 'Schedule', ...(when ? { state: 'ready', text: formatWhen(when) } : { state: 'todo', text: 'Not set' }) },
  ];
}

/** When a feed post goes out, from its timeline position. */
export const POST_TIMING = {
  before_episode: 'Before the episode',
  during_episode: 'During the episode',
  after_episode: 'Right after the episode',
  next_day: 'Next day',
  week_later: 'A week later',
};

/** The episodes ahead, in order, each with its date and where it stands. */
export function releaseCalendar(episodes, limit = 4) {
  return [...(episodes || [])].filter((e) => !isReleased(e) && !isArchived(e)).sort(byNumber).slice(0, limit)
    .map((ep) => {
      const when = goLive(ep);
      const state = when ? 'Scheduled' : ['in_build', 'in_review'].includes(ep.status) ? 'In production' : ep.status === 'scripted' ? 'Scripted' : 'No date yet';
      return { ep, when, state };
    });
}

/** Released episodes, newest first, with their tier and what each did to Lala. */
export function releasedResults(episodes, history = [], limit = 5) {
  return [...(episodes || [])].filter(isReleased).sort((a, b) => byNumber(b, a)).slice(0, limit)
    .map((ep) => {
      const rows = (history || []).filter((h) => h.episode_id === ep.id);
      const totals = {};
      for (const row of rows) for (const [k, v] of rowDeltas(row)) totals[k] = (totals[k] || 0) + v;
      const { coins = 0, ...stats } = totals;
      return { ep, tier: episodeTier(ep), coins, stats: Object.entries(stats) };
    });
}
