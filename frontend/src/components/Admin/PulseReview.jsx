/**
 * Admin › The Pulse › Review (Task 2925; The Pulse spec §1, §4 Review): the
 * feed's director tools, out of Lala's view. Everything waiting for Evoni,
 * for one show:
 *   Lala's drafts        posts shared from The Pulse: Release, Edit, Delete
 *   Posts from episodes  drafted inside an episode: Approve, Edit, Discard
 *   Comments waiting     drafted reactions: Approve, Delete
 *   Numbers waiting      proposed likes and shares that wait for Evoni:
 *                        Accept, Adjust, Make it viral, Make it flop
 *                        (PulseNumbersWaiting, Task 2954)
 *   Follower changes     each proposed follower change, from an episode's
 *                        result, a post or an event deliverable (Task
 *                        3086): Accept, Adjust (PulseEpisodeFollowers,
 *                        Task 2956)
 *   Closeness waiting    closeness changes involving Lala, or large:
 *                        Accept, Adjust, Reject (PulseClosenessWaiting,
 *                        Task 2983)
 *   DMs waiting          each drafted DM message: Approve, Edit, Reject
 *                        (PulseDmsWaiting, Task 2985)
 *   Conversations        start a DM conversation; draft the next message
 *   Live posts           comments and "Draft reactions", "Use in a beat"
 *   Events               the events of unpublished episodes, each with
 *                        when it is revealed on The Pulse (Task 2940)
 *   Deleted              kept (soft delete): Restore
 * Every post card also carries its reveal (RevealPicker, Task 2940).
 * Drafts arrive here through the quality gate (services/pulseGate.js, Task 2969).
 * Styles: PulseReviewPost.css.
 */
import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { PostCard, RequestPost } from './PulseReviewPost';
import RevealPicker from './RevealPicker';
import PulseNumbersWaiting from './PulseNumbersWaiting';
import PulseClosenessWaiting from './PulseClosenessWaiting';
import PulseDmsWaiting, { DmThread, StartConversation, draftsIn } from './PulseDmsWaiting';
import PulseEpisodeFollowers, { FOLLOWER_CAUSES } from './PulseEpisodeFollowers';
import { atHandle } from '../../pages/feed/feedConstants';

const LIMIT = 50;
const list = (r) => (Array.isArray(r?.data?.data) ? r.data.data : []);

const numbersTotal = (r) => r?.data?.total ?? (Array.isArray(r?.data?.numbers) ? r.data.numbers.length : 0);
const closenessTotal = (r) => r?.data?.total ?? (Array.isArray(r?.data?.changes) ? r.data.changes.length : 0);
/** The proposed follower changes Review decides, from GET /pulse-followers (Task 3086: episodes, posts, events). */
const episodeChanges = (r) => (Array.isArray(r?.data?.proposed) ? r.data.proposed.filter((p) => FOLLOWER_CAUSES.includes(p.cause)) : []);

/** The count of things waiting for Evoni: drafts, episode posts, comments, numbers, episode follower changes, closeness changes and DM drafts. */
export async function loadReviewCount(showId) {
  const id = encodeURIComponent(showId);
  const [wall, episode, pending, numbers, followers, closeness, dms] = await Promise.all([
    api.get(`/api/v1/feed-posts?show_id=${id}&status=draft&from=wall&limit=1`),
    api.get(`/api/v1/feed-posts?show_id=${id}&status=draft&from=episode&limit=1`),
    api.get(`/api/v1/feed-posts/comments/pending?show_id=${id}`),
    api.get(`/api/v1/pulse-numbers?show_id=${id}&status=proposed`),
    api.get(`/api/v1/pulse-followers?show_id=${id}`),
    api.get(`/api/v1/pulse-closeness?show_id=${id}&status=proposed`).catch((err) => {
      console.error('[PulseReview] closeness changes could not be counted:', err.response?.status || err.message);
      return null;
    }),
    api.get(`/api/v1/pulse-dms?show_id=${id}`).catch((err) => {
      console.error('[PulseReview] DMs could not be counted:', err.response?.status || err.message);
      return null;
    }),
  ]);
  return (wall.data?.total ?? 0) + (episode.data?.total ?? 0) + list(pending).length + numbersTotal(numbers) + episodeChanges(followers).length
    + closenessTotal(closeness) + draftsIn(dms?.data?.threads);
}

function PendingComment({ comment, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const act = async (label, call) => {
    setBusy(true); setError(null);
    try { await call(); onChange?.(); }
    catch (err) { console.error(`[PulseReview] ${label} failed:`, err.response?.status || err.message); setError(err.response?.data?.error || `${label} failed.`); }
    finally { setBusy(false); }
  };
  return (
    <li className="prv-pending" data-testid="prv-pending-comment">
      <span><b>{atHandle(comment.handle)}</b> “{comment.text}”{comment.post?.poster_handle ? <span className="prv-muted"> on {atHandle(comment.post.poster_handle)}'s post</span> : null}</span>
      <span className="prv-actions">
        <button type="button" className="prv-btn" disabled={busy}
          onClick={() => act('Approve', () => api.patch(`/api/v1/feed-posts/comments/${comment.id}`, { status: 'live' }))}>Approve</button>
        <button type="button" className="prv-link-btn" disabled={busy}
          onClick={() => act('Delete', () => api.delete(`/api/v1/feed-posts/comments/${comment.id}`))}>Delete</button>
      </span>
      {error && <p className="prv-error" role="alert">{error}</p>}
    </li>
  );
}

function Section({ title, count, testId, empty, children }) {
  return (
    <section className="prv-section" aria-label={title} data-testid={testId}>
      <h3 className="prv-section-title">{title}{count !== undefined && <span className="prv-count"> ({count})</span>}</h3>
      {count === 0 ? <p className="prv-muted">{empty}</p> : children}
    </section>
  );
}

export default function PulseReview({ showId, onCount }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const id = encodeURIComponent(showId);
    const safe = async (p, label) => {
      try { return await p; } catch (err) { console.error(`[PulseReview] ${label} could not be read:`, err.response?.status || err.message); return null; }
    };
    const [wall, episode, pending, live, deleted, side, numbers, followers, closeness, dms] = await Promise.all([
      safe(api.get(`/api/v1/feed-posts?show_id=${id}&status=draft&from=wall&with=comments&limit=${LIMIT}`), 'drafts'),
      safe(api.get(`/api/v1/feed-posts?show_id=${id}&status=draft&from=episode&with=comments&limit=${LIMIT}`), 'episode posts'),
      safe(api.get(`/api/v1/feed-posts/comments/pending?show_id=${id}`), 'comments'),
      safe(api.get(`/api/v1/feed-posts?show_id=${id}&status=live&with=comments&limit=20`), 'live posts'),
      safe(api.get(`/api/v1/feed-posts/deleted?show_id=${id}&limit=200`), 'deleted posts'),
      safe(api.get(`/api/v1/social-profiles/lala/sidebar?show_id=${id}`), 'events'),
      safe(api.get(`/api/v1/pulse-numbers?show_id=${id}&status=proposed`), 'numbers'),
      safe(api.get(`/api/v1/pulse-followers?show_id=${id}`), 'episode followers'),
      safe(api.get(`/api/v1/pulse-closeness?show_id=${id}&status=proposed`), 'closeness changes'),
      safe(api.get(`/api/v1/pulse-dms?show_id=${id}`), 'DMs'),
    ]);
    if (!wall && !episode && !pending && !live && !deleted) {
      setError('Review could not be loaded.');
      return;
    }
    setError(null);
    const next = {
      wall: { posts: list(wall), total: wall?.data?.total ?? list(wall).length },
      episode: { posts: list(episode), total: episode?.data?.total ?? list(episode).length },
      pending: list(pending),
      live: list(live),
      deleted: list(deleted),
      events: Array.isArray(side?.data?.data?.upcoming) ? side.data.data.upcoming : [],
      numbers: { rows: Array.isArray(numbers?.data?.numbers) ? numbers.data.numbers : [], total: numbersTotal(numbers) },
      followers: episodeChanges(followers),
      closeness: { rows: Array.isArray(closeness?.data?.changes) ? closeness.data.changes : [], total: closenessTotal(closeness) },
      dms: Array.isArray(dms?.data?.threads) ? dms.data.threads : [],
    };
    setData(next);
    onCount?.(next.wall.total + next.episode.total + next.pending.length + next.numbers.total + next.followers.length + next.closeness.total + draftsIn(next.dms));
  }, [showId, onCount]);

  useEffect(() => { load(); }, [load]);

  if (error) return <p className="prv-error" role="alert">{error}</p>;
  if (!data) return <p className="prv-muted">Loading Review…</p>;

  return (
    <div className="prv-review" data-testid="pulse-review">
      <Section title="Lala's drafts" count={data.wall.total} testId="prv-wall-drafts"
        empty="No drafts. What Lala shares on The Pulse waits here until you release it.">
        {data.wall.posts.map((p) => <PostCard key={p.id} post={p} showId={showId} onChange={load} />)}
        {data.wall.total > data.wall.posts.length && <p className="prv-muted">Showing {data.wall.posts.length} of {data.wall.total}.</p>}
      </Section>
      <Section title="Posts from episodes" count={data.episode.total} testId="prv-episode-posts"
        empty="No episode posts waiting. Posts an episode drafts wait here until approved.">
        {data.episode.posts.map((p) => <RequestPost key={p.id} post={p} onChange={load} />)}
        {data.episode.total > data.episode.posts.length && <p className="prv-muted">Showing {data.episode.posts.length} of {data.episode.total}.</p>}
      </Section>
      <Section title="Comments waiting" count={data.pending.length} testId="prv-pending"
        empty="No comments waiting. Drafted reactions wait here until approved.">
        <ul className="prv-plain">{data.pending.map((c) => <PendingComment key={c.id} comment={c} onChange={load} />)}</ul>
      </Section>
      <Section title="Numbers waiting" count={data.numbers.total} testId="prv-numbers"
        empty="No numbers waiting. Lala's posts, posts about her and unusual numbers wait here when they go live.">
        <PulseNumbersWaiting numbers={data.numbers.rows} total={data.numbers.total} onChange={load} />
      </Section>
      <Section title="Follower changes" count={data.followers.length} testId="prv-episode-followers"
        empty="No follower changes waiting. A completed episode, a post's locked numbers or an approved deliverable proposes one here.">
        <PulseEpisodeFollowers rows={data.followers} onChange={load} />
      </Section>
      <Section title="Closeness waiting" count={data.closeness.total} testId="prv-closeness"
        empty="No closeness changes waiting. Changes involving Lala, and large ones, wait here.">
        <PulseClosenessWaiting changes={data.closeness.rows} total={data.closeness.total} onChange={load} />
      </Section>
      <Section title="DMs waiting" count={draftsIn(data.dms)} testId="prv-dms"
        empty="No DMs waiting. Every message drafted in a conversation waits here.">
        <PulseDmsWaiting threads={data.dms} onChange={load} />
      </Section>
      <Section title="Conversations" testId="prv-conversations">
        <p className="prv-muted">Lala's DMs, drafted in voice through the posting engine. Start one, or draft the next message of one that is quiet.</p>
        <StartConversation showId={showId} onStarted={load} />
        <ul className="prv-plain">
          {data.dms.filter((t) => !t.messages.some((m) => m.status === 'draft')).map((t) => <DmThread key={t.id} thread={t} onChange={load} />)}
        </ul>
      </Section>
      <Section title="Live posts" testId="prv-live">
        <p className="prv-muted">Draft reactions, delete a comment, or show a post at an episode beat.</p>
        {data.live.length === 0 && <p className="prv-muted">Nothing live yet.</p>}
        {data.live.map((p) => <PostCard key={p.id} post={p} showId={showId} onChange={load} />)}
      </Section>
      <Section title="Events" count={data.events.length} testId="prv-events"
        empty="No events of unpublished episodes. An event shows here once an episode is made from it.">
        <p className="prv-muted">When each event is revealed on The Pulse; before then it shows as a first look, or not at all.</p>
        <ul className="prv-plain">
          {data.events.map((ev) => (
            <li key={ev.id} className="prv-event" data-testid="prv-event">
              <b>{ev.name}</b>{ev.episode?.number != null && <span className="prv-muted"> · Ep {ev.episode.number}</span>}
              <RevealPicker type="event" id={ev.id} eventId={ev.id} label={ev.name} />
            </li>
          ))}
        </ul>
      </Section>
      <details className="prv-deleted" data-testid="prv-deleted">
        <summary>Deleted ({data.deleted.length})</summary>
        {data.deleted.length === 0 && <p className="prv-muted">No deleted posts. A deleted post is kept here and can be restored.</p>}
        {data.deleted.map((p) => <PostCard key={p.id} post={p} showId={showId} onChange={load} />)}
      </details>
    </div>
  );
}
