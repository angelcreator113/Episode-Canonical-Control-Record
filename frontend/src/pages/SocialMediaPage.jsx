import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import useActiveShow from '../hooks/useActiveShow';
import { RELATIONSHIP_POST_TYPE, STATUSES, relationshipText, latestStatus } from '../lib/feedRelationship';
import { BEATS, beatName } from '../lib/canonicalBeats';
import './SocialMediaPage.css';

const SocialProfileGenerator = lazy(() => import('./SocialProfileGenerator'));

/**
 * Social Media (the Feed project; redesigned 2026-10-04 to Evoni's mock:
 * a 2009 profile-and-wall, "lalaverse" on a purple banner). Posts is
 * Lala's wall: her profile on the left, the wall in the middle (status,
 * "What's on your mind?", the live posts with their comments), requests,
 * upcoming events and people she may know on the right. People embeds
 * the profile generator unchanged (the old /feed page). The Episode's
 * own Lala's Phone tab is untouched.
 *
 * Deep links: ?tab=posts|people; the old ?layer= and ?profile= links
 * (with no ?tab=) open People, as they always did.
 */
export const TABS = [
  { key: 'posts', label: 'Home' },
  { key: 'people', label: 'Friends' },
];
/** "[Day], [time]" for the 2009 sidebar: "Mon, Oct 6, 2:33am". */
export function eventWhen(ts) {
  if (!ts) return '[Day], [time]';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '[Day], [time]';
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '')}`;
}
const WALL_TABS = [
  { key: 'wall', label: 'Wall' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'events', label: 'Events' },
];
const PAGE = 50;
const CITY_NAMES = { nova_prime: 'Nova Prime', velour_city: 'Velour City', the_drift: 'The Drift', solenne: 'Solenne', cascade_row: 'Cascade Row', dazzle_district: 'Dazzle District', radiance_row: 'Radiance Row', echo_park: 'Echo Park', ascent_tower: 'Ascent Tower', maverick_harbor: 'Maverick Harbor' };

export function tabFromParams(params) {
  const tab = params.get('tab');
  if (tab && TABS.some((t) => t.key === tab)) return tab;
  if (params.get('layer') || params.get('profile')) return 'people';
  return 'posts';
}

export const posterOf = (post) => {
  const p = post.socialProfile || {};
  return {
    name: post.poster_display_name || p.display_name || post.poster_handle || p.handle || 'Unknown',
    handle: post.poster_handle || p.handle || '',
    platform: post.poster_platform || p.platform || '',
  };
};

/** "Just now", "Today at 4:10pm", "Yesterday at 11:42pm", "Tuesday at 9:02am", else the date. */
export function whenLabel(ts, now = new Date()) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const mins = Math.round((now - d) / 60000);
  if (mins >= 0 && mins < 2) return 'Just now';
  if (mins >= 0 && mins < 60) return `${mins} minutes ago`;
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '');
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(now) - day(d)) / 86400000);
  if (days === 0) return `Today at ${time}`;
  if (days === 1) return `Yesterday at ${time}`;
  if (days > 1 && days < 7) return `${d.toLocaleDateString([], { weekday: 'long' })} at ${time}`;
  return d.toLocaleDateString();
}

const initial = (name) => ((name || '').match(/[\p{L}\p{N}]/u) || ['?'])[0].toUpperCase();
const Tile = ({ name, size = 'sm', tone = 'c' }) => <span className={`sm-tile sm-tile-${size} sm-tone-${tone}`} aria-hidden="true">{initial(name)}</span>;
const toneOf = (handle) => ['c', 'd', 'e', 'f'][(handle || '').length % 4];

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

  if (comments === null) return <p className="sm-note">Loading reactions…</p>;
  const live = comments.filter((c) => c.status === 'live');
  const drafts = comments.filter((c) => c.status === 'draft');
  return (
    <div className="sm-reactions" data-testid="sm-reactions">
      {live.length > 0 && (
        <ul className="sm-comments" data-testid="sm-live-comments">
          {live.map((c) => <li key={c.id}><Tile name={c.handle} tone={toneOf(c.handle)} /><span><b>{c.display_name || c.handle}</b> {c.text}</span> <button type="button" className="sm-mini" onClick={() => remove(c)} disabled={busy} title="Live comments are never edited, only deleted">delete</button></li>)}
        </ul>
      )}
      {drafts.length > 0 && (
        <ul className="sm-comments sm-drafts" data-testid="sm-draft-comments">
          {drafts.map((c) => (
            <li key={c.id}>
              <Tile name={c.handle} tone={toneOf(c.handle)} />
              <span><span className="sm-badge">draft</span> <b>@{c.handle}</b> {c.text}{c.voice_note && <em className="sm-voice"> · {c.voice_note}</em>}</span>
              <button type="button" className="sm-mini sm-approve" onClick={() => approve(c)} disabled={busy}>approve</button>
              <button type="button" className="sm-mini" onClick={() => remove(c)} disabled={busy}>delete</button>
            </li>
          ))}
        </ul>
      )}
      {live.length === 0 && drafts.length === 0 && <p className="sm-note">No comments yet.</p>}
      <div className="sm-reactors">
        {reactors.length > 0 && (
          <span className="sm-reactors-pick" role="group" aria-label="Who reacts">
            {reactors.map((r) => (
              <label key={r.id}><input type="checkbox" checked={picked?.has(r.id) ?? true} onChange={() => toggle(r.id)} /> @{r.handle}{r.relationship ? ` (${r.relationship.replace(/_/g, ' ')})` : ''}</label>
            ))}
          </span>
        )}
        <button type="button" className="sm-btn" onClick={draft} disabled={busy}>{busy ? 'Working…' : 'Draft reactions'}</button>
      </div>
      {note && <p className="sm-note" role="status">{note}</p>}
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
    <div className="sm-beat" data-testid="sm-beat-picker">
      {beats.length > 0 && (
        <p className="sm-note" data-testid="sm-beats-used">Shown at: {beats.map((b) => `Ep ${b.episode_number ?? '?'} · beat ${b.beat_number} ${beatName(b.beat_number)}`).join('; ')}</p>
      )}
      {episodes === null ? <p className="sm-note">Loading episodes…</p> : (
        <div className="sm-reactors">
          <select aria-label="Episode" value={episodeId} onChange={(e) => setEpisodeId(e.target.value)} disabled={post.status === 'draft'} className="sm-composer-select sm-beat-select">
            <option value="">Episode…</option>
            {choices.map((e) => <option key={e.id} value={e.id}>{epLabel(e)}</option>)}
          </select>
          <select aria-label="Beat" value={beat} onChange={(e) => setBeat(e.target.value)} className="sm-composer-select sm-beat-select">
            <option value="">Beat…</option>
            <optgroup label="On Lala's Phone">
              {BEATS.filter((b) => b.phone).map((b) => <option key={b.number} value={b.number}>{b.number}. {b.name}</option>)}
            </optgroup>
            <optgroup label="Other beats">
              {BEATS.filter((b) => !b.phone).map((b) => <option key={b.number} value={b.number}>{b.number}. {b.name}</option>)}
            </optgroup>
          </select>
          <button type="button" className="sm-btn" onClick={put} disabled={busy || !episodeId || !beat}>{busy ? 'Working…' : 'Show at this beat'}</button>
        </div>
      )}
      {post.status === 'draft' && <p className="sm-note">A draft can only be shown in its own episode.</p>}
      {note && <p className="sm-note" role="status">{note}</p>}
    </div>
  );
}

/** One wall item: "Name did a thing." with its comments under it. */
export function PostCard({ post, onChange, showId }) {
  const who = posterOf(post);
  const [open, setOpen] = useState(false);
  const [beatOpen, setBeatOpen] = useState(false);
  const records = Array.isArray(post.comments) ? post.comments : [];
  const legacy = records.length === 0 && Array.isArray(post.sample_comments) ? post.sample_comments : [];
  const likes = post.likes ?? 0;
  const commentsN = post.comments_count ?? records.length;
  return (
    <article className="sm-item" data-testid="sm-post">
      <Tile name={who.name} size="md" tone={who.handle === 'lala' ? 'l' : toneOf(who.handle)} />
      <div className="sm-item-body">
        <p className="sm-item-text">
          <b className="sm-name">{who.name}</b>{' '}
          {post.content_text}
          {post.image_description && !post.image_url && <span className="sm-album"> [photo: {post.image_description}]</span>}
        </p>
        {post.image_url && <img className="sm-item-image" src={post.image_url} alt={post.image_description || ''} />}
        <p className="sm-item-meta">
          {post.status === 'draft' && <><span className="sm-badge">draft</span> · </>}
          <span>{whenLabel(post.posted_at) || 'undated'}</span>
          {' · '}<button type="button" className="sm-link-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>Comment</button>
          {showId && <>{' · '}<button type="button" className="sm-link-btn" onClick={() => setBeatOpen((v) => !v)} aria-expanded={beatOpen}>Use in a beat</button></>}
          {post.narrative_function && <> · <span className="sm-fn">{post.narrative_function.replace(/_/g, ' ')}</span></>}
          {post.episode_id && <> · <Link to={`/episodes/${post.episode_id}`}>Episode</Link></>}
        </p>
        {(likes > 0 || commentsN > 0) && (
          <p className="sm-item-likes">
            {likes > 0 && <span>[{likes}] like this.</span>}{likes > 0 && commentsN > 0 && ' '}
            {commentsN > 0 && <span>{commentsN} comment{commentsN === 1 ? '' : 's'}</span>}
          </p>
        )}
        {!open && records.length > 0 && (
          <ul className="sm-comments">
            {records.slice(0, 3).map((c) => <li key={c.id}><Tile name={c.handle} tone={toneOf(c.handle)} /><span><b>{c.display_name || c.handle}</b> {c.text}{c.posted_at && <small> {whenLabel(c.posted_at)}</small>}</span></li>)}
          </ul>
        )}
        {!open && legacy.length > 0 && (
          <ul className="sm-comments sm-legacy">
            {legacy.slice(0, 3).map((c, i) => <li key={i}><Tile name="?" /><span>{typeof c === 'string' ? c : (c.text || c.comment || '')}</span></li>)}
          </ul>
        )}
        {open && <Reactions post={post} onChange={onChange} />}
        {beatOpen && showId && <BeatPicker post={post} showId={showId} />}
      </div>
    </article>
  );
}

function Box({ title, action, children, testId }) {
  return (
    <section className="sm-box" data-testid={testId}>
      <h3 className="sm-box-title">{title}{action && <span className="sm-box-action">{action}</span>}</h3>
      {children}
    </section>
  );
}

function Wall({ show, showLoaded, search, tabRequest, onInbox }) {
  const [owner, setOwner] = useState(null);
  const [friends, setFriends] = useState({ list: [], total: 0 });
  const [events, setEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [draftsTotal, setDraftsTotal] = useState(0);
  const [pending, setPending] = useState([]);
  const [wallTab, setWallTab] = useState('wall');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draftText, setDraftText] = useState('');
  // What the composer shares: a status update, or a relationship change
  // (a post too, docs/FEED_POSTS.md rule 8).
  const [kind, setKind] = useState('update');
  const [friendId, setFriendId] = useState('');
  const [sharing, setSharing] = useState(false);

  const loadPosts = useCallback(async (offset = 0, status = wallTab === 'drafts' ? 'draft' : 'live') => {
    if (!show?.id) return;
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({ show_id: show.id, status, with: 'comments', limit: String(PAGE), offset: String(offset) });
      const r = await api.get(`/api/v1/feed-posts?${qs}`);
      const page = r.data?.data || [];
      setPosts((prev) => (offset === 0 ? page : [...prev, ...page]));
      setTotal(r.data?.total ?? page.length);
      setHasMore(Boolean(r.data?.hasMore));
    } catch (err) {
      console.error('[SocialMedia] posts load failed:', err.response?.status || err.message);
      setError(err.response?.data?.error || 'The wall could not be loaded.');
    } finally { setLoading(false); }
  }, [show?.id, wallTab]);

  const loadSides = useCallback(async () => {
    if (!show?.id) return;
    const safe = async (p, fallback) => { try { return await p; } catch (err) { console.error('[SocialMedia] side load failed:', err.response?.status || err.message); return fallback; } };
    const [who, ppl, ev, drafts, pend] = await Promise.all([
      safe(api.get('/api/v1/social-profiles?feed_layer=lalaverse&search=lala&limit=5'), null),
      safe(api.get('/api/v1/social-profiles?feed_layer=lalaverse&limit=12'), null),
      safe(api.get(`/api/v1/calendar/events?series_id=${show.id}`), null),
      safe(api.get(`/api/v1/feed-posts?show_id=${show.id}&status=draft&limit=1`), null),
      safe(api.get(`/api/v1/feed-posts/comments/pending?show_id=${show.id}`), null),
    ]);
    const candidates = who?.data?.profiles || [];
    setOwner(candidates.find((p) => /^lala$/i.test(p.handle || '') || /^lala\b/i.test(p.display_name || '')) || candidates[0] || null);
    const list = (ppl?.data?.profiles || []).filter((p) => !p.is_justawoman_record);
    setFriends({ list, total: ppl?.data?.pagination?.total ?? ppl?.data?.total ?? list.length });
    const all = Array.isArray(ev?.data?.events) ? ev.data.events : [];
    const now = Date.now();
    const upcoming = all.filter((e) => !e.start_datetime || new Date(e.start_datetime).getTime() >= now - 86400000);
    setEvents((upcoming.length ? upcoming : all).slice(0, 3));
    setDraftsTotal(drafts?.data?.total ?? 0);
    setPending(pend?.data?.data || []);
  }, [show?.id]);

  useEffect(() => { loadPosts(0); }, [loadPosts]);
  useEffect(() => { loadSides(); }, [loadSides]);
  useEffect(() => { if (tabRequest?.tab) setWallTab(tabRequest.tab); }, [tabRequest]);
  useEffect(() => { onInbox?.(draftsTotal + pending.length); }, [draftsTotal, pending.length, onInbox]);

  const ownerName = owner?.display_name || owner?.creator_name || 'Lala';
  const ownerHandle = owner?.handle || 'lala';
  const status = useMemo(() => posts.find((p) => wallTab === 'wall' && (p.poster_handle || p.socialProfile?.handle) === ownerHandle) || null, [posts, ownerHandle, wallTab]);

  const friendPicked = friends.list.find((p) => String(p.id) === String(friendId));
  const composed = kind === 'update' ? draftText.trim()
    : kind === 'status' ? relationshipText({ kind: 'status', status: draftText })
      : relationshipText({ kind: 'friends', withName: friendPicked ? (friendPicked.display_name || friendPicked.handle) : '' });
  const share = async () => {
    if (!composed || !show?.id) return;
    setSharing(true); setError(null);
    try {
      await api.post('/api/v1/feed-posts', {
        show_id: show.id, content_text: composed, poster_handle: ownerHandle,
        poster_display_name: ownerName, social_profile_id: owner?.id || null, poster_platform: 'lalaverse', status: 'live',
        ...(kind === 'update' ? {} : { post_type: RELATIONSHIP_POST_TYPE }),
      });
      setDraftText(''); setFriendId(''); setKind('update');
      if (wallTab !== 'wall') setWallTab('wall'); else await loadPosts(0, 'live');
    } catch (err) { setError(err.response?.data?.error || 'The post could not be shared.'); }
    finally { setSharing(false); }
  };

  if (showLoaded && !show) return <p className="sm-empty" data-testid="sm-no-show">Pick a show first. The wall belongs to a show.</p>;

  const q = search.trim().toLowerCase();
  const visible = q ? posts.filter((p) => (p.content_text || '').toLowerCase().includes(q) || posterOf(p).name.toLowerCase().includes(q) || posterOf(p).handle.toLowerCase().includes(q)) : posts;
  const friendTiles = friends.list.filter((p) => p.handle !== ownerHandle).slice(0, 6);
  const mayKnow = friends.list.filter((p) => p.handle !== ownerHandle).slice(6, 8);
  const peopleLink = (p) => `/feed?tab=people&layer=lalaverse${p?.id ? `&profile=${p.id}` : ''}`;

  return (
    <div className="sm-wall">
      <aside className="sm-left">
        <Tile name={ownerName} size="xl" tone="l" />
        <Link className="sm-small-link" to={peopleLink(owner)}>Edit My Profile</Link>
        <Box title="Information" testId="sm-info">
          <dl className="sm-dl">
            <dt>Current City</dt><dd>{owner?.city ? CITY_NAMES[owner.city] || owner.city : (owner?.geographic_base || '[City]')}</dd>
            <dt>Relationship Status</dt><dd data-testid="sm-rel-status">{latestStatus(posts, ownerHandle) || owner?.relationship_status || '[Status]'}</dd>
            <dt>Works at</dt><dd>{owner?.content_category ? owner.content_category.replace(/_/g, ' ') : 'Styling, everywhere'}</dd>
            {owner?.follower_count_approx && <><dt>Followers</dt><dd>{owner.follower_count_approx}</dd></>}
          </dl>
        </Box>
        <Box title="Friends" action={<Link to="/feed?tab=people&layer=lalaverse">See all</Link>} testId="sm-friends">
          <p className="sm-muted">[{friends.total}] friends</p>
          <div className="sm-friend-grid">
            {friendTiles.map((p) => (
              <Link key={p.id} to={peopleLink(p)} className="sm-friend"><Tile name={p.display_name || p.handle} size="lg" tone={toneOf(p.handle)} /><span>{p.display_name || p.handle}</span></Link>
            ))}
            {friendTiles.length === 0 && <p className="sm-muted">No friends yet. Generate profiles under Friends.</p>}
          </div>
        </Box>
      </aside>

      <main className="sm-center">
        <h1 className="sm-owner">{ownerName}</h1>
        <p className="sm-status" data-testid="sm-status">
          {status ? <>{status.content_text} <small>{whenLabel(status.posted_at)}</small></> : <em>has not posted yet.</em>}
        </p>
        <nav className="sm-wall-tabs" role="tablist" aria-label="Wall sections">
          {WALL_TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={wallTab === t.key} className={wallTab === t.key ? 'active' : ''} onClick={() => setWallTab(t.key)}>
              {t.label}{t.key === 'drafts' && draftsTotal > 0 ? ` (${draftsTotal})` : ''}
            </button>
          ))}
        </nav>

        {wallTab !== 'events' && (
          <form className="sm-composer" onSubmit={(e) => { e.preventDefault(); share(); }}>
            <label htmlFor="sm-composer-text" className="sm-composer-label">
              {kind === 'update' ? <>What&apos;s on your mind?</> : kind === 'status' ? 'Relationship status' : 'Now friends with'}
            </label>
            {kind === 'friends' ? (
              <select id="sm-composer-text" className="sm-composer-select" value={friendId} onChange={(e) => setFriendId(e.target.value)}>
                <option value="">Pick a friend…</option>
                {friends.list.filter((p) => p.handle !== ownerHandle).map((p) => <option key={p.id} value={p.id}>{p.display_name || p.handle}</option>)}
              </select>
            ) : (
              <>
                <textarea id="sm-composer-text" rows={kind === 'status' ? 1 : 2} value={draftText} onChange={(e) => setDraftText(e.target.value)} placeholder={kind === 'status' ? "It's complicated" : ''} />
                {kind === 'status' && <p className="sm-muted">{STATUSES.map((s) => <button key={s} type="button" className="sm-mini sm-status-pick" onClick={() => setDraftText(s)}>{s}</button>)}</p>}
              </>
            )}
            <div className="sm-composer-row">
              <span className="sm-composer-kinds" role="group" aria-label="What to share">
                <label><input type="radio" name="sm-kind" checked={kind === 'update'} onChange={() => setKind('update')} /> Status</label>
                <label><input type="radio" name="sm-kind" checked={kind === 'status'} onChange={() => setKind('status')} /> Relationship</label>
                <label><input type="radio" name="sm-kind" checked={kind === 'friends'} onChange={() => setKind('friends')} /> Friends</label>
              </span>
              <span className="sm-muted">Posts as {ownerName}, live on the feed.</span>
              <button type="submit" className="sm-btn" disabled={sharing || !composed}>{sharing ? 'Sharing…' : 'Share'}</button>
            </div>
          </form>
        )}

        {error && <p className="sm-error" role="alert">{error}</p>}
        <p className="sm-count" data-testid="sm-count">
          {loading && posts.length === 0 ? 'Loading the wall…' : wallTab === 'events' ? `${events.length} upcoming event${events.length === 1 ? '' : 's'}` : `${total} ${wallTab === 'drafts' ? 'draft' : 'post'}${total === 1 ? '' : 's'}${show?.name ? ` · ${show.name}` : ''}`}
        </p>

        {wallTab === 'events' ? (
          <ul className="sm-events" data-testid="sm-events">
            {events.map((e) => <li key={e.id}><b>{e.title}</b><br /><span className="sm-muted">{[e.location_name || e.lalaverse_district, eventWhen(e.start_datetime)].filter(Boolean).join(' · ')}</span></li>)}
            {events.length === 0 && <li className="sm-muted">No upcoming events. Plan one under LalaVerse › Culture.</li>}
          </ul>
        ) : (
          <>
            {!loading && !error && posts.length === 0 && (
              <div className="sm-empty" data-testid="sm-empty">
                {wallTab === 'drafts'
                  ? <p>No drafts. A draft is a post written inside an episode that is not published yet.</p>
                  : <><p>Nothing on the wall yet.</p><p>Share something above, or generate posts from an episode. Each one is what a character said, once, with its likes and comments.</p></>}
              </div>
            )}
            {visible.map((p) => <PostCard key={p.id} post={p} showId={show?.id} onChange={() => { loadPosts(0); loadSides(); }} />)}
            {hasMore && !loading && <button type="button" className="sm-btn sm-more" onClick={() => loadPosts(posts.length)}>Older posts</button>}
          </>
        )}
      </main>

      <aside className="sm-right">
        <Box title="Requests" testId="sm-requests">
          <ul className="sm-plain">
            <li><button type="button" className="sm-link-btn" onClick={() => setWallTab('drafts')}>{draftsTotal} draft post{draftsTotal === 1 ? '' : 's'}</button></li>
            <li>{pending.length} reaction{pending.length === 1 ? '' : 's'} to approve</li>
          </ul>
          {pending.slice(0, 3).map((c) => <p key={c.id} className="sm-muted sm-pending">@{c.handle}: “{c.text}”{c.post?.poster_handle ? ` on @${c.post.poster_handle}'s post` : ''}</p>)}
        </Box>
        <Box title="Upcoming Events" testId="sm-upcoming">
          {events.slice(0, 2).map((e) => <p key={e.id} className="sm-event"><b>{e.title}</b><br /><span className="sm-muted">{e.location_name || e.lalaverse_district || ''}</span><br /><span className="sm-muted">{eventWhen(e.start_datetime)}</span></p>)}
          {events.length === 0 && <p className="sm-muted">None planned.</p>}
        </Box>
        <Box title="People You May Know" testId="sm-may-know">
          {mayKnow.map((p) => <p key={p.id} className="sm-person"><Tile name={p.display_name || p.handle} tone={toneOf(p.handle)} /><span><b>{p.display_name || p.handle}</b><br /><Link to={peopleLink(p)}>Add as friend</Link></span></p>)}
          {mayKnow.length === 0 && <p className="sm-muted">Everyone here already knows Lala.</p>}
        </Box>
      </aside>
    </div>
  );
}

export default function SocialMediaPage() {
  const [params, setParams] = useSearchParams();
  const tab = tabFromParams(params);
  const { show, loaded } = useActiveShow();
  const layer = params.get('layer');
  const [search, setSearch] = useState('');
  const [inbox, setInbox] = useState(0);
  const [tabRequest, setTabRequest] = useState(null);

  const switchTab = (key) => setParams((prev) => { const next = new URLSearchParams(prev); next.set('tab', key); return next; });
  const openInbox = () => { if (tab !== 'posts') switchTab('posts'); setTabRequest({ tab: 'drafts', at: Date.now() }); };

  return (
    <div className="sm-page">
      <header className="sm-banner">
        <span className="sm-wordmark">lalaverse</span>
        <nav className="sm-nav" role="tablist" aria-label="Social Media sections">
          <button type="button" role="tab" aria-selected={tab === 'posts'} className={tab === 'posts' ? 'active' : ''} onClick={() => switchTab('posts')}>Home</button>
          <button type="button" role="tab" aria-selected={tab === 'posts'} className={tab === 'posts' ? 'active' : ''} onClick={() => { switchTab('posts'); setTabRequest({ tab: 'wall', at: Date.now() }); }}>Profile</button>
          <button type="button" role="tab" aria-selected={tab === 'people'} className={tab === 'people' ? 'active' : ''} onClick={() => switchTab('people')}>Friends</button>
          <button type="button" className="sm-inbox" onClick={openInbox} title="Draft posts and reactions waiting for approval">Inbox{inbox > 0 ? ` (${inbox})` : ''}</button>
        </nav>
        {tab === 'posts' && <input className="sm-search" type="search" aria-label="Search posts" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />}
        <span className="sm-banner-right">Social Media</span>
      </header>
      {tab === 'posts' && <Wall show={show} showLoaded={loaded} search={search} tabRequest={tabRequest} onInbox={setInbox} />}
      {tab === 'people' && (
        <Suspense fallback={<p className="sm-empty">Loading people…</p>}>
          <SocialProfileGenerator embedded defaultFeedLayer={layer === 'lalaverse' ? 'lalaverse' : undefined} />
        </Suspense>
      )}
      <footer className="sm-footer">
        lalaverse · one post, one place · <Link to="/feed?tab=people&layer=lalaverse">People</Link>{show?.id && <> · <Link to={`/shows/${show.id}/feed-timeline`}>Timeline &amp; generation</Link></>}
      </footer>
    </div>
  );
}
