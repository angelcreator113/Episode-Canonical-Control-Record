/**
 * The feed's director tools (Task 2925; The Pulse spec §1: nothing behind
 * the curtain appears in Lala's view). Admin › The Pulse › Review uses them;
 * pages/SocialMediaPage only re-exports them for older imports.
 *
 * Reactions   a post's comments as records: live and drafts, approve and
 *             delete, "Draft reactions" with the reactor picker.
 * BeatPicker  show a post at an episode beat (docs/FEED_POSTS.md rule 5).
 * PostCard    a post with its story label, episode link and narrative
 *             function; Release/Edit/Delete for a draft, Restore when deleted.
 * RequestPost a post an episode drafted, waiting for approval.
 *
 * Styles: PulseReviewPost.css (prv-*). Test hooks keep their sm-* names.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import api from '../../services/api';
import { BEATS, beatName } from '../../lib/canonicalBeats';
import { postOrder, storyLabel } from '../../lib/storyClock';
import { posterOf, whenLabel, initial, toneOf } from '../../lib/pulsePosts';
import RevealPicker from './RevealPicker';
import { atHandle } from '../../pages/feed/feedConstants';
import { PinAsExample } from './PulseVoices';
import './PulseReviewPost.css';

const Tile = ({ name, size = 'sm', tone = 'c' }) => <span className={`prv-tile prv-tile-${size} prv-tone-${tone}`} aria-hidden="true">{initial(name)}</span>;

/**
 * Reactions (the Feed project, step 4): the post's comments as records.
 * Live ones are the feed; drafts wait for approval. "Draft reactions" asks
 * the drafter for comments from the characters connected to the poster
 * (pre-ticked; untick to pick who reacts), in their own voices.
 */
export function Reactions({ post, onChange }) {
  const [comments, setComments] = useState(null);
  const [reactors, setReactors] = useState([]);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const load = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([
        api.get(`/api/v1/feed-posts/${post.id}/comments?status=all`),
        api.get(`/api/v1/feed-posts/${post.id}/comments/reactors`).catch(() => ({ data: { data: [] } })),
      ]);
      setComments(c.data?.data || []);
      const list = r.data?.data || [];
      setReactors(list);
      setPicked((prev) => prev ?? new Set(list.map((x) => x.id)));
    } catch (err) {
      console.error('[SocialMedia] reactions load failed:', err.response?.status || err.message);
      setNote(err.response?.data?.error || 'The reactions could not be loaded.');
    }
  }, [post.id]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, okNote) => {
    setBusy(true); setNote(null);
    try { await fn(); if (okNote) setNote(okNote); await load(); onChange?.(); }
    catch (err) { setNote(err.response?.data?.error || err.message); }
    finally { setBusy(false); }
  };
  const draft = () => act(async () => {
    const ids = [...(picked || [])];
    return api.post(`/api/v1/feed-posts/${post.id}/comments/draft`, ids.length ? { reactor_ids: ids } : {});
  }, 'Reactions drafted. Approve the ones that are canon.');
  const approve = (c) => act(() => api.patch(`/api/v1/feed-posts/comments/${c.id}`, { status: 'live' }));
  const remove = (c) => act(() => api.delete(`/api/v1/feed-posts/comments/${c.id}`));
  const toggle = (id) => setPicked((prev) => { const next = new Set(prev || []); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  if (comments === null) return <p className="prv-note">Loading reactions…</p>;
  const live = comments.filter((c) => c.status === 'live');
  const drafts = comments.filter((c) => c.status === 'draft');
  return (
    <div className="prv-reactions" data-testid="sm-reactions">
      {live.length > 0 && (
        <ul className="prv-comments" data-testid="sm-live-comments">
          {live.map((c) => <li key={c.id}><Tile name={c.handle} tone={toneOf(c.handle)} /><span><b>{c.display_name || c.handle}</b> {c.text}</span> <button type="button" className="prv-mini" onClick={() => remove(c)} disabled={busy} title="Live comments are never edited, only deleted">delete</button></li>)}
        </ul>
      )}
      {drafts.length > 0 && (
        <ul className="prv-comments prv-drafts" data-testid="sm-draft-comments">
          {drafts.map((c) => (
            <li key={c.id}>
              <Tile name={c.handle} tone={toneOf(c.handle)} />
              <span><span className="prv-badge">draft</span> <b>{atHandle(c.handle)}</b> {c.text}{c.voice_note && <em className="prv-voice"> · {c.voice_note}</em>}</span>
              <button type="button" className="prv-mini prv-approve" onClick={() => approve(c)} disabled={busy}>approve</button>
              <button type="button" className="prv-mini" onClick={() => remove(c)} disabled={busy}>delete</button>
            </li>
          ))}
        </ul>
      )}
      {live.length === 0 && drafts.length === 0 && <p className="prv-note">No comments yet.</p>}
      <div className="prv-reactors">
        {reactors.length > 0 && (
          <span className="prv-reactors-pick" role="group" aria-label="Who reacts">
            {reactors.map((r) => (
              <label key={r.id}><input type="checkbox" checked={picked?.has(r.id) ?? true} onChange={() => toggle(r.id)} /> {atHandle(r.handle)}{r.relationship ? ` (${r.relationship.replace(/_/g, ' ')})` : ''}</label>
            ))}
          </span>
        )}
        <button type="button" className="prv-btn" onClick={draft} disabled={busy}>{busy ? 'Working…' : 'Draft reactions'}</button>
      </div>
      {note && <p className="prv-note" role="status">{note}</p>}
    </div>
  );
}

/**
 * Put this post at a beat (2026-10-04): the episode's phone moment at that
 * beat points at the post, so the episode draws it live
 * (docs/FEED_POSTS.md rule 5). A draft can only go in its own episode.
 */
export function BeatPicker({ post, showId }) {
  const [episodes, setEpisodes] = useState(null);
  const [beats, setBeats] = useState([]);
  const [episodeId, setEpisodeId] = useState(post.episode_id || '');
  const [beat, setBeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const load = useCallback(async () => {
    try {
      const [e, p] = await Promise.all([
        api.get(`/api/v1/episodes?show_id=${showId}&limit=100&sort=episode_number:ASC`),
        api.get(`/api/v1/feed-posts/post/${post.id}`),
      ]);
      setEpisodes(e.data?.data || []);
      setBeats(p.data?.data?.beats || []);
    } catch (err) {
      console.error('[SocialMedia] beat picker load failed:', err.response?.status || err.message);
      setNote(err.response?.data?.error || 'The episodes could not be loaded.');
      setEpisodes([]);
    }
  }, [post.id, showId]);
  useEffect(() => { load(); }, [load]);

  const put = async () => {
    if (!episodeId || !beat) return;
    setBusy(true); setNote(null);
    try {
      const r = await api.post(`/api/v1/feed-enhanced/${showId}/moments/${episodeId}/beat`, { beat_number: Number(beat), feed_post_id: post.id });
      setNote(r.data?.created === false ? 'Already shown at that beat.' : `Shown at beat ${beat}, ${beatName(beat)}.`);
      await load();
    } catch (err) { setNote(err.response?.data?.error || err.message); }
    finally { setBusy(false); }
  };

  const epLabel = (e) => `Ep ${e.episode_number ?? '?'}${e.title ? ` · ${e.title}` : ''}`;
  const choices = (episodes || []).filter((e) => post.status !== 'draft' || String(e.id) === String(post.episode_id));
  return (
    <div className="prv-beat" data-testid="sm-beat-picker">
      {beats.length > 0 && (
        <p className="prv-note" data-testid="sm-beats-used">Shown at: {beats.map((b) => `Ep ${b.episode_number ?? '?'} · beat ${b.beat_number} ${beatName(b.beat_number)}`).join('; ')}</p>
      )}
      {episodes === null ? <p className="prv-note">Loading episodes…</p> : (
        <div className="prv-reactors">
          <select aria-label="Episode" value={episodeId} onChange={(e) => setEpisodeId(e.target.value)} disabled={post.status === 'draft'} className="prv-composer-select prv-beat-select">
            <option value="">Episode…</option>
            {choices.map((e) => <option key={e.id} value={e.id}>{epLabel(e)}</option>)}
          </select>
          <select aria-label="Beat" value={beat} onChange={(e) => setBeat(e.target.value)} className="prv-composer-select prv-beat-select">
            <option value="">Beat…</option>
            <optgroup label="On Lala's Phone">
              {BEATS.filter((b) => b.phone).map((b) => <option key={b.number} value={b.number}>{b.number}. {b.name}</option>)}
            </optgroup>
            <optgroup label="Other beats">
              {BEATS.filter((b) => !b.phone).map((b) => <option key={b.number} value={b.number}>{b.number}. {b.name}</option>)}
            </optgroup>
          </select>
          <button type="button" className="prv-btn" onClick={put} disabled={busy || !episodeId || !beat}>{busy ? 'Working…' : 'Show at this beat'}</button>
        </div>
      )}
      {post.status === 'draft' && <p className="prv-note">A draft can only be shown in its own episode.</p>}
      {note && <p className="prv-note" role="status">{note}</p>}
    </div>
  );
}

/** One wall item: "Name did a thing." with its comments under it. */
/**
 * Release time, the second clock (Character Consistency Engine step 6c;
 * Evoni, 2026-10-16: "yes publish/schedule/hold"; services/postRelease). A
 * draft's story time stays as stamped; this is when the audience sees it.
 * Release publishes now; Schedule picks a date and time (the release timer
 * publishes it then); Hold keeps it until released. Shows the current state.
 */
const releaseWhen = (at) => new Date(at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
/** A datetime-local value an hour from now, as a starting point. */
const localInput = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const inAnHour = () => localInput(new Date(Date.now() + 60 * 60 * 1000));

// Schedule… opens with the time the story suggests (Evoni, 2026-10-17:
// "doesn't the system know a better time ... and then I can just make
// adjustments"; services/postRelease suggestReleaseTime), and why; she
// schedules it as it is or changes it first. A time that breaks the story
// order (a load-bearing post after its episode airs, a reply before its
// post, a post before its reveal) says what it breaks, and waits for
// "Schedule anyway".
export const tzOffset = () => new Date().getTimezoneOffset();
export { localInput };

export function StoryProblems({ problems, testId = 'prv-release-problems' }) {
  if (!problems?.length) return null;
  return (
    // Spans: it sits inside a card's action line (a <p>).
    <span className="prv-release-problems" data-testid={testId}>
      {problems.map((p) => <span key={p} className="prv-release-problem">{p}</span>)}
    </span>
  );
}

export function ReleaseTime({ post, busy, act }) {
  const [picking, setPicking] = useState(false);
  const [when, setWhen] = useState(inAnHour);
  const [why, setWhy] = useState(null);
  const [problems, setProblems] = useState([]);
  const [refused, setRefused] = useState(false);
  const pick = async () => {
    setPicking(true);
    setWhy(null);
    setProblems([]);
    setRefused(false);
    try {
      const res = await api.get(`/api/v1/feed-posts/${post.id}/release-time/suggest?tz_offset=${tzOffset()}`);
      if (res.data?.at) {
        setWhen(localInput(new Date(res.data.at)));
        setWhy(res.data.why || null);
        setProblems(Array.isArray(res.data.problems) ? res.data.problems : []);
      }
    } catch (err) {
      console.error('[PulseReviewPost] no suggested time:', err.response?.status || err.message);
    }
  };
  const setTime = (body, label) => act(label, () => api.put(`/api/v1/feed-posts/${post.id}/release-time`, body));
  const schedule = (anyway) => act('Schedule', async () => {
    try {
      await api.put(`/api/v1/feed-posts/${post.id}/release-time`, { mode: 'schedule', at: new Date(when).toISOString(), tz_offset: tzOffset(), anyway });
      setPicking(false);
    } catch (err) {
      const found = err.response?.status === 409 ? err.response?.data?.problems : null;
      if (!Array.isArray(found) || !found.length) throw err;
      console.error('[PulseReviewPost] the time breaks the story order:', found.length);
      setProblems(found);
      setRefused(true);
    }
  });
  const state = post.release_state;
  return (
    <span className="prv-release" data-testid="prv-release">
      {state === 'scheduled' && post.release_at && <span className="prv-badge">Scheduled for {releaseWhen(post.release_at)}</span>}
      {state === 'held' && <span className="prv-badge">Held</span>}
      {picking ? (
        <>
          <input type="datetime-local" aria-label="Release on" value={when}
            onChange={(e) => { setWhen(e.target.value); setWhy(null); setProblems([]); setRefused(false); }} />
          {why && <span className="prv-muted" data-testid="prv-release-why">Suggested: {why}</span>}
          <StoryProblems problems={problems} />
          <button type="button" className="prv-btn" disabled={busy || !when} onClick={() => schedule(false)}>Schedule</button>
          {refused && <button type="button" className="prv-link-btn" disabled={busy || !when} onClick={() => schedule(true)}>Schedule anyway</button>}
          <button type="button" className="prv-link-btn" onClick={() => setPicking(false)}>Cancel</button>
        </>
      ) : (
        <>
          <button type="button" className="prv-link-btn" disabled={busy} onClick={pick}>{state === 'scheduled' ? 'Reschedule' : 'Schedule…'}</button>
          {state !== 'held' && <button type="button" className="prv-link-btn" disabled={busy} onClick={() => setTime({ mode: 'hold' }, 'Hold')}>Hold</button>}
          {state && <button type="button" className="prv-link-btn" disabled={busy} onClick={() => setTime({ mode: 'clear' }, 'Clear the release time')}>{state === 'held' ? 'Stop holding' : 'Unschedule'}</button>}
        </>
      )}
    </span>
  );
}

export function PostCard({ post, onChange, showId }) {
  const who = posterOf(post);
  const [open, setOpen] = useState(false);
  const [beatOpen, setBeatOpen] = useState(false);
  // A draft is edited, released or deleted here; a deleted post is restored
  // (2026-10-11). A live post has no edit button (2009 rule, feedPostStatus).
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(post.content_text || '');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const isDeleted = !!post.deleted_at;
  const isDraft = post.status === 'draft' && !isDeleted;
  const act = async (label, call) => {
    setBusy(true); setActionError(null);
    try { await call(); setEditing(false); onChange?.(); }
    catch (err) { console.error(`[SocialMedia] ${label} failed:`, err.response?.status || err.message); setActionError(err.response?.data?.error || `${label} failed.`); }
    finally { setBusy(false); }
  };
  const release = () => act('Release', () => api.put(`/api/v1/feed-posts/${post.id}`, { status: 'live' }));
  const saveEdit = () => act('Save', () => api.put(`/api/v1/feed-posts/${post.id}`, { content_text: text.trim() }));
  const remove = () => { if (window.confirm('Delete this draft? It is kept under Deleted and can be restored.')) act('Delete', () => api.delete(`/api/v1/feed-posts/${post.id}`)); };
  const restore = () => act('Restore', () => api.post(`/api/v1/feed-posts/${post.id}/restore`));
  const records = Array.isArray(post.comments) ? post.comments : [];
  const legacy = records.length === 0 && Array.isArray(post.sample_comments) ? post.sample_comments : [];
  const likes = post.likes ?? 0;
  const commentsN = post.comments_count ?? records.length;
  const story = storyLabel(postOrder(post));
  const reveals = !isDeleted && (
    <div className="prv-item-reveals">
      <RevealPicker type="post" id={post.id} eventId={post.event_id || null} label={`${who.name}'s post`} imageUrl={post.image_url || null} />
      {post.image_url && <RevealPicker type="image" kind="post_photo" id={post.id} eventId={post.event_id || null} label={`the photo on ${who.name}'s post`} imageUrl={post.image_url} />}
    </div>
  );
  const hasSide = (isDraft || isDeleted) && !editing;
  return (
    <article className={`prv-item${post.image_url ? ' has-media' : ''}${hasSide ? ' has-side' : ''}`} data-testid="sm-post">
      {post.image_url && (
        <div className="prv-media">
          <img className="prv-item-image" src={post.image_url} alt={post.image_description || ''} />
        </div>
      )}
      <div className="prv-item-body">
        <p className="prv-item-head">
          <Tile name={who.name} size="md" tone={who.handle === 'lala' ? 'l' : toneOf(who.handle)} />
          <b className="prv-name">{who.name}</b>
          <span className="prv-item-when">
            {whenLabel(post.posted_at) || 'undated'}
            {story && <> · <span className="prv-story" title="Story time: when this happens in Lala's world">{story}</span></>}
          </span>
        </p>
        {editing ? (
          <div className="prv-edit">
            <textarea aria-label="Edit the draft" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
            <span className="prv-actions">
              <button type="button" className="prv-btn" disabled={busy || !text.trim() || text.trim() === post.content_text} onClick={saveEdit}>Save</button>
              <button type="button" className="prv-link-btn" onClick={() => { setEditing(false); setText(post.content_text || ''); }}>Cancel</button>
            </span>
          </div>
        ) : (
        <p className="prv-item-text">
          {post.content_text}
          {post.image_description && !post.image_url && <span className="prv-album"> [photo: {post.image_description}]</span>}
        </p>
        )}
        <p className="prv-item-meta prv-tags">
          {isDeleted && <span className="prv-badge">deleted</span>}
          {post.status === 'draft' && <span className="prv-badge">draft</span>}
          {post.narrative_function && <span className="prv-tag prv-fn">{post.narrative_function.replace(/_/g, ' ')}</span>}
          <button type="button" className="prv-tag" onClick={() => setOpen((v) => !v)} aria-expanded={open}>Comment</button>
          {showId && <button type="button" className="prv-tag" onClick={() => setBeatOpen((v) => !v)} aria-expanded={beatOpen}>Use in a beat</button>}
          {post.post_weight && <span className="prv-tag prv-fn" title={post.post_weight_why || (post.post_weight === 'ambient' ? 'Flavor: can sit at any beat' : '')}>{post.post_weight === 'load_bearing' ? 'load-bearing' : 'ambient'}</span>}
          {post.episode_id && <Link className="prv-tag" to={`/episodes/${post.episode_id}`}>Episode</Link>}
        </p>
        {!isDeleted && post.social_profile_id && post.content_text && <p className="prv-item-pin"><PinAsExample postId={post.id} /></p>}
        {actionError && <p className="prv-error" role="alert">{actionError}</p>}
        {(likes > 0 || commentsN > 0) && (
          <p className="prv-item-likes">
            {likes > 0 && <span>[{likes}] like this.</span>}{likes > 0 && commentsN > 0 && ' '}
            {commentsN > 0 && <span>{commentsN} comment{commentsN === 1 ? '' : 's'}</span>}
          </p>
        )}
        {!open && records.length > 0 && (
          <ul className="prv-comments">
            {records.slice(0, 3).map((c) => <li key={c.id}><Tile name={c.handle} tone={toneOf(c.handle)} /><span><b>{c.display_name || c.handle}</b> {c.text}{c.posted_at && <small> {whenLabel(c.posted_at)}</small>}</span></li>)}
          </ul>
        )}
        {!open && legacy.length > 0 && (
          <ul className="prv-comments prv-legacy">
            {legacy.slice(0, 3).map((c, i) => <li key={i}><Tile name="?" /><span>{typeof c === 'string' ? c : (c.text || c.comment || '')}</span></li>)}
          </ul>
        )}
        {open && <Reactions post={post} onChange={onChange} />}
        {beatOpen && showId && <BeatPicker post={post} showId={showId} />}
        {!hasSide && reveals}
      </div>
      {hasSide && (
        <aside className="prv-item-side" aria-label="Release">
          {isDraft && <GateResult gate={post.gate_json} />}
          <div className="prv-side-actions" data-testid="sm-post-actions">
            {isDraft && <>
              <button type="button" className="prv-btn prv-release-btn" disabled={busy} onClick={release}><Send size={16} aria-hidden="true" />{post.release_state ? 'Release now' : 'Release'}</button>
              <ReleaseTime post={post} busy={busy} act={act} />
              <button type="button" className="prv-link-btn" disabled={busy} onClick={() => setEditing(true)}>Edit</button>
              <button type="button" className="prv-link-btn prv-danger" disabled={busy} onClick={remove}>Delete</button>
            </>}
            {isDeleted && <button type="button" className="prv-btn" disabled={busy} onClick={restore}>Restore</button>}
          </div>
          {reveals}
        </aside>
      )}
    </article>
  );
}

const REVIEW_LABELS = { lala: "Lala's post", about_lala: 'About Lala', reveals_story: 'Reveals story', gate: 'Flagged by the gate', dm: 'DM', storyline_payoff: "A storyline's payoff", on_request: "Asked for on their page", event_draft: "Its episode isn't complete yet", brand_deal: 'A brand deal announcement', schedule: 'No release time could be found' };
const FLAG_LABELS = {
  banned_phrase: 'AI-sounding phrase', private_state: 'Quotes private feelings', unrevealed_character: 'Names someone Lala has not met',
  unrevealed_event: 'Names a hidden event', future_event: 'Names a later event', voice: 'Off voice',
  doesnt_know: "Names an event they couldn't know about yet",
  off_lane: "Off what they're known for",
};

/**
 * The quality gate's result on an engine draft (Task 2969,
 * services/pulseGate.js): the voice score, why it waits for Evoni, and
 * each flag with its detail. Nothing for posts the engine did not draft.
 */
export function GateResult({ gate }) {
  if (!gate || typeof gate !== 'object') return null;
  const review = Array.isArray(gate.review) ? gate.review : [];
  const flags = Array.isArray(gate.flags) ? gate.flags : [];
  return (
    <div className={gate.pass ? 'prv-gate prv-gate-pass' : 'prv-gate prv-gate-flagged'} data-testid="prv-gate">
      <p className="prv-gate-line">
        <b>Engine draft</b>
        {typeof gate.voice === 'number' && <> · voice {Math.round(gate.voice * 100)}%</>}
        {review.length > 0 && <> · waiting: {review.map((r) => REVIEW_LABELS[r] || r).join(', ')}</>}
      </p>
      {flags.length > 0 && (
        <ul className="prv-gate-flags">
          {flags.map((f, i) => <li key={`${f.code}-${i}`}>{FLAG_LABELS[f.code] || f.code}{f.detail ? `: ${f.detail}` : ''}</li>)}
        </ul>
      )}
    </div>
  );
}

/**
 * A post an episode drafted, waiting for approval in Requests (Evoni,
 * 2026-10-11: nothing reaches the Wall until approved): who, the words and
 * the episode, with Approve (it goes live), Edit and Discard (kept under
 * Deleted).
 */
export function RequestPost({ post, onChange }) {
  const who = posterOf(post);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(post.content_text || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const act = async (label, call) => {
    setBusy(true); setError(null);
    try { await call(); setEditing(false); onChange?.(); }
    catch (err) { console.error(`[SocialMedia] ${label} failed:`, err.response?.status || err.message); setError(err.response?.data?.error || `${label} failed.`); }
    finally { setBusy(false); }
  };
  const episodeNumber = post.episode?.episode_number;
  return (
    <div className="prv-request" data-testid="sm-request-post">
      <p className="prv-request-text"><b>{who.name}</b> {editing ? null : post.content_text}</p>
      {editing && <textarea aria-label="Edit the post" rows={3} value={text} onChange={(e) => setText(e.target.value)} />}
      <GateResult gate={post.gate_json} />
      <p className="prv-muted">{post.episode_id ? <Link to={`/episodes/${post.episode_id}`}>{episodeNumber != null ? `Episode ${episodeNumber}` : 'Its episode'}</Link> : null}</p>
      <p className="prv-actions">
        {editing ? (
          <>
            <button type="button" className="prv-btn" disabled={busy || !text.trim() || text.trim() === post.content_text}
              onClick={() => act('Save', () => api.put(`/api/v1/feed-posts/${post.id}`, { content_text: text.trim() }))}>Save</button>
            <button type="button" className="prv-link-btn" onClick={() => { setEditing(false); setText(post.content_text || ''); }}>Cancel</button>
          </>
        ) : (
          <>
            <button type="button" className="prv-btn" disabled={busy} onClick={() => act('Approve', () => api.put(`/api/v1/feed-posts/${post.id}`, { status: 'live' }))}>{post.release_state ? 'Approve and publish now' : 'Approve'}</button>
            <ReleaseTime post={post} busy={busy} act={act} />
            <button type="button" className="prv-link-btn" disabled={busy} onClick={() => setEditing(true)}>Edit</button>
            <button type="button" className="prv-link-btn" disabled={busy}
              onClick={() => { if (window.confirm('Discard this post? It is kept under Deleted and can be restored.')) act('Discard', () => api.delete(`/api/v1/feed-posts/${post.id}`)); }}>Discard</button>
          </>
        )}
      </p>
      {error && <p className="prv-error" role="alert">{error}</p>}
    </div>
  );
}
