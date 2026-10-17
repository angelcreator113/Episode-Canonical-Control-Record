/**
 * Admin › The Pulse at a glance (Evoni's Admin mock, 2026-10-17): the four
 * numbers across the top, Needs your attention and Recent activity. One
 * read per show; summarize() is pure so the cards can be tested apart.
 *
 *   stats      scheduled (drafts with a release time) and how many go out
 *              today, drafts waiting (Lala's and episodes'), comments to
 *              review, and Lala's followers with her last accepted change
 *   attention  each kind of thing waiting, with the Review section it opens
 *   activity   the latest live posts and the scheduled drafts, newest first
 *   reviewCount  the same count as Review's tab (loadReviewCount)
 */
import api from '../services/api';
import { draftsIn } from '../components/Admin/PulseDmsWaiting';
import { FOLLOWER_CAUSES } from '../components/Admin/PulseEpisodeFollowers';

const list = (r) => (Array.isArray(r?.data?.data) ? r.data.data : []);
const totalOf = (r) => r?.data?.total ?? list(r).length;

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Lala's followers now, and her last accepted change as a percentage of the count before it. */
export function growthStat(growth) {
  const line = Array.isArray(growth?.line) ? growth.line.filter((r) => Number.isFinite(r.count)) : [];
  const last = line[line.length - 1];
  if (!last) return null;
  const before = last.count - (last.change || 0);
  const pct = last.cause === 'start' || before <= 0 ? null : Math.round(((last.change || 0) / before) * 1000) / 10;
  return { count: last.count, change: last.cause === 'start' ? 0 : (last.change || 0), pct, label: last.label || null };
}

/** Pure: the raw reads (any may be null) to stats, attention, activity and the Review count. */
export function summarize(raw, now = new Date()) {
  const wall = list(raw.wall);
  const episode = list(raw.episode);
  const drafts = [...wall, ...episode];
  const scheduled = drafts.filter((p) => p.release_state === 'scheduled' && p.release_at);
  const today = scheduled.filter((p) => sameDay(new Date(p.release_at), now)).length;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const dueTomorrow = scheduled.filter((p) => sameDay(new Date(p.release_at), tomorrow)).length;
  const draftTotal = totalOf(raw.wall) + totalOf(raw.episode);
  const comments = list(raw.pending).length;
  const numbers = raw.numbers?.data?.total ?? (Array.isArray(raw.numbers?.data?.numbers) ? raw.numbers.data.numbers.length : 0);
  const followers = Array.isArray(raw.followers?.data?.proposed) ? raw.followers.data.proposed.filter((p) => FOLLOWER_CAUSES.includes(p.cause)).length : 0;
  const closeness = raw.closeness?.data?.total ?? (Array.isArray(raw.closeness?.data?.changes) ? raw.closeness.data.changes.length : 0);
  const dms = draftsIn(raw.dms?.data?.threads);
  const flagged = drafts.filter((p) => p.gate_json && p.gate_json.pass === false).length;

  const attention = [
    { key: 'drafts', count: draftTotal, title: `${draftTotal} draft${draftTotal === 1 ? '' : 's'} to release`, hint: "Lala's drafts and posts from episodes.", section: 'prv-wall-drafts' },
    { key: 'flagged', count: flagged, title: `${flagged} engine draft${flagged === 1 ? '' : 's'} flagged`, hint: 'The quality gate held them: read why before releasing.', section: 'prv-wall-drafts' },
    { key: 'comments', count: comments, title: `${comments} comment${comments === 1 ? '' : 's'} to review`, hint: 'Drafted reactions wait until approved.', section: 'prv-pending' },
    { key: 'tomorrow', count: dueTomorrow, title: `${dueTomorrow} post${dueTomorrow === 1 ? '' : 's'} scheduled tomorrow`, hint: 'Check the timing while you can still move them.', section: 'prv-wall-drafts' },
    { key: 'numbers', count: numbers, title: `${numbers} post number${numbers === 1 ? '' : 's'} waiting`, hint: 'Likes and shares to accept or adjust.', section: 'prv-numbers' },
    { key: 'followers', count: followers, title: `${followers} follower change${followers === 1 ? '' : 's'}`, hint: 'From episodes, posts and events.', section: 'prv-episode-followers' },
    { key: 'closeness', count: closeness, title: `${closeness} closeness change${closeness === 1 ? '' : 's'}`, hint: 'Changes involving Lala, and large ones.', section: 'prv-closeness' },
    { key: 'dms', count: dms, title: `${dms} DM${dms === 1 ? '' : 's'} waiting`, hint: 'Drafted messages to approve, edit or reject.', section: 'prv-dms' },
  ].filter((a) => a.count > 0);

  const activity = [
    ...list(raw.live).map((p) => ({ key: `live-${p.id}`, kind: 'live', at: p.updated_at || p.posted_at || p.created_at, post: p })),
    ...scheduled.map((p) => ({ key: `sched-${p.id}`, kind: 'scheduled', at: p.updated_at || p.created_at || p.release_at, post: p })),
  ].filter((a) => a.at && !Number.isNaN(new Date(a.at).getTime()))
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 5);

  return {
    stats: { scheduled: scheduled.length, today, drafts: draftTotal, comments, growth: growthStat(raw.growth?.data) },
    attention,
    activity,
    reviewCount: draftTotal + comments + numbers + followers + closeness + dms,
  };
}

/** Reads everything summarize() needs for one show. A read that fails counts as empty. */
export async function loadPulseSummary(showId, now = new Date()) {
  const id = encodeURIComponent(showId);
  const safe = (path, label) => api.get(path).catch((err) => {
    console.error(`[PulseSummary] ${label} could not be read:`, err?.response?.status || err?.message);
    return null;
  });
  const [wall, episode, pending, numbers, followers, closeness, dms, growth, live] = await Promise.all([
    safe(`/api/v1/feed-posts?show_id=${id}&status=draft&from=wall&limit=50`, 'drafts'),
    safe(`/api/v1/feed-posts?show_id=${id}&status=draft&from=episode&limit=50`, 'episode posts'),
    safe(`/api/v1/feed-posts/comments/pending?show_id=${id}`, 'comments'),
    safe(`/api/v1/pulse-numbers?show_id=${id}&status=proposed`, 'numbers'),
    safe(`/api/v1/pulse-followers?show_id=${id}`, 'follower changes'),
    safe(`/api/v1/pulse-closeness?show_id=${id}&status=proposed`, 'closeness changes'),
    safe(`/api/v1/pulse-dms?show_id=${id}`, 'DMs'),
    safe(`/api/v1/pulse-followers/growth?show_id=${id}`, 'growth'),
    safe(`/api/v1/feed-posts?show_id=${id}&status=live&limit=5`, 'live posts'),
  ]);
  return summarize({ wall, episode, pending, numbers, followers, closeness, dms, growth, live }, now);
}
