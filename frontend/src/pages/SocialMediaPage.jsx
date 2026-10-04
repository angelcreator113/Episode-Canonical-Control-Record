import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import useActiveShow from '../hooks/useActiveShow';
import TabOrientation from '../components/TabOrientation';
import './SocialMediaPage.css';

const SocialProfileGenerator = lazy(() => import('./SocialProfileGenerator'));

/**
 * Social Media (2026-10-04, the Feed project, step 1): the sidebar's
 * social page. Posts is the default view and shows the stored posts
 * (feed_posts: what the characters said, with likes and comments) for
 * the active show; People embeds the profile generator unchanged (the
 * old /feed page). The Episode's own Lala's Phone tab is untouched.
 *
 * Deep links: ?tab=posts|people; the old ?layer= and ?profile= links
 * (with no ?tab=) open People, as they always did.
 */
export const TABS = [
  { key: 'posts', label: 'Posts', desc: 'What the characters said' },
  { key: 'people', label: 'People', desc: 'Who exists in her social world' },
];

export const FUNCTIONS = ['reaction', 'bts', 'flex', 'shade', 'support', 'comparison', 'gossip', 'brand_content', 'callback'];
const PAGE = 50;

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

/**
 * Reactions (the Feed project, step 4): the post's comments as records.
 * Live ones are the feed; drafts wait for approval. "Draft reactions" asks
 * the drafter for comments from the characters connected to the poster
 * (pre-ticked; untick to pick who reacts), in their own voices.
 */
export function Reactions({ post }) {
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
    try { await fn(); if (okNote) setNote(okNote); await load(); }
    catch (err) { setNote(err.response?.data?.error || err.message); }
    finally { setBusy(false); }
  };
  const draft = () => act(async () => {
    const ids = [...(picked || [])];
    const r = await api.post(`/api/v1/feed-posts/${post.id}/comments/draft`, ids.length ? { reactor_ids: ids } : {});
    return r;
  }, 'Reactions drafted. Approve the ones that are canon.');
  const approve = (c) => act(() => api.patch(`/api/v1/feed-posts/comments/${c.id}`, { status: 'live' }));
  const remove = (c) => act(() => api.delete(`/api/v1/feed-posts/comments/${c.id}`));
  const toggle = (id) => setPicked((prev) => { const next = new Set(prev || []); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  if (comments === null) return <p className="sm-reactions-note">Loading reactions…</p>;
  const live = comments.filter((c) => c.status === 'live');
  const drafts = comments.filter((c) => c.status === 'draft');
  return (
    <div className="sm-reactions" data-testid="sm-reactions">
      {live.length > 0 && (
        <ul className="sm-comments" data-testid="sm-live-comments">
          {live.map((c) => <li key={c.id}><b>@{c.handle}</b> {c.text} <button type="button" className="sm-mini" onClick={() => remove(c)} disabled={busy} title="Live comments are never edited, only deleted">delete</button></li>)}
        </ul>
      )}
      {drafts.length > 0 && (
        <ul className="sm-comments sm-drafts" data-testid="sm-draft-comments">
          {drafts.map((c) => (
            <li key={c.id}>
              <span className="sm-tag sm-draft">draft</span> <b>@{c.handle}</b> {c.text}
              {c.voice_note && <em className="sm-voice"> · {c.voice_note}</em>}
              <button type="button" className="sm-mini sm-approve" onClick={() => approve(c)} disabled={busy}>approve</button>
              <button type="button" className="sm-mini" onClick={() => remove(c)} disabled={busy}>delete</button>
            </li>
          ))}
        </ul>
      )}
      {live.length === 0 && drafts.length === 0 && <p className="sm-reactions-note">No reactions yet.</p>}
      <div className="sm-reactors">
        {reactors.length > 0 && (
          <span className="sm-reactors-pick" role="group" aria-label="Who reacts">
            {reactors.map((r) => (
              <label key={r.id}><input type="checkbox" checked={picked?.has(r.id) ?? true} onChange={() => toggle(r.id)} /> @{r.handle}{r.relationship ? ` (${r.relationship.replace(/_/g, ' ')})` : ''}</label>
            ))}
          </span>
        )}
        <button type="button" className="sm-draft-btn" onClick={draft} disabled={busy}>
          {busy ? 'Working…' : 'Draft reactions'}
        </button>
      </div>
      {note && <p className="sm-reactions-note" role="status">{note}</p>}
    </div>
  );
}

export function PostCard({ post }) {
  const who = posterOf(post);
  const comments = Array.isArray(post.sample_comments) ? post.sample_comments : [];
  const when = post.posted_at ? new Date(post.posted_at).toLocaleString() : null;
  const [open, setOpen] = useState(false);
  return (
    <article className="sm-post" data-testid="sm-post">
      <header className="sm-post-head">
        <div className="sm-post-avatar" aria-hidden="true">{who.name.slice(0, 1).toUpperCase()}</div>
        <div className="sm-post-who">
          <strong>{who.name}</strong>
          <span className="sm-post-meta">
            {who.handle && `@${who.handle}`}{who.platform && ` · ${who.platform}`}{post.post_type && post.post_type !== 'post' && ` · ${post.post_type}`}
          </span>
        </div>
        {post.status === 'draft' && <span className="sm-tag sm-draft" title="Goes live when its episode is published">draft</span>}
        {post.narrative_function && <span className={`sm-tag sm-tag-${post.narrative_function}`}>{post.narrative_function.replace(/_/g, ' ')}</span>}
      </header>
      {post.content_text && <p className="sm-post-text">{post.content_text}</p>}
      {post.image_url
        ? <img className="sm-post-image" src={post.image_url} alt={post.image_description || ''} />
        : post.image_description && <p className="sm-post-image-desc">🖼 {post.image_description}</p>}
      <footer className="sm-post-foot">
        <span>♥ {post.likes ?? 0}</span>
        <span>💬 {post.comments_count ?? comments.length}</span>
        {post.shares > 0 && <span>↗ {post.shares}</span>}
        {post.is_viral && <span className="sm-viral">viral</span>}
        {when && <time dateTime={post.posted_at}>{when}</time>}
        {post.episode_id && <Link to={`/episodes/${post.episode_id}`} className="sm-post-episode">Episode →</Link>}
        <button type="button" className="sm-mini sm-reactions-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? 'Hide reactions' : 'Reactions'}
        </button>
      </footer>
      {!open && comments.length > 0 && (
        <ul className="sm-comments">
          {comments.slice(0, 4).map((c, i) => (
            <li key={i}>{typeof c === 'string' ? c : (c.text || c.comment || JSON.stringify(c))}</li>
          ))}
        </ul>
      )}
      {open && <Reactions post={post} />}
    </article>
  );
}

function PostsView({ show, showLoaded }) {
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [fn, setFn] = useState('all');
  // Live posts are the feed; drafts wait for their episode to be published.
  const [status, setStatus] = useState('live');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (offset = 0) => {
    if (!show?.id) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ show_id: show.id, status, limit: String(PAGE), offset: String(offset) });
      if (fn !== 'all') qs.set('narrative_function', fn);
      const r = await api.get(`/api/v1/feed-posts?${qs}`);
      const page = r.data?.data || [];
      setPosts((prev) => (offset === 0 ? page : [...prev, ...page]));
      setTotal(r.data?.total ?? page.length);
      setHasMore(Boolean(r.data?.hasMore));
    } catch (err) {
      console.error('[SocialMedia] posts load failed:', err.response?.status || err.message);
      setError(err.response?.data?.error || 'The posts could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [show?.id, fn, status]);

  useEffect(() => { load(0); }, [load]);

  if (showLoaded && !show) {
    return <p className="sm-empty" data-testid="sm-no-show">Pick a show first. Posts belong to a show.</p>;
  }

  const q = search.trim().toLowerCase();
  const visible = q
    ? posts.filter((p) => (p.content_text || '').toLowerCase().includes(q) || posterOf(p).name.toLowerCase().includes(q) || posterOf(p).handle.toLowerCase().includes(q))
    : posts;

  return (
    <div className="sm-posts">
      <div className="sm-toolbar">
        <div className="sm-chips" role="group" aria-label="Live or drafts">
          <button type="button" className={`sm-chip ${status === 'live' ? 'active' : ''}`} onClick={() => setStatus('live')}>Live</button>
          <button type="button" className={`sm-chip ${status === 'draft' ? 'active' : ''}`} onClick={() => setStatus('draft')}>Drafts</button>
        </div>
        <div className="sm-chips" role="group" aria-label="Filter by what the post does">
          {['all', ...FUNCTIONS].map((k) => (
            <button key={k} type="button" className={`sm-chip ${fn === k ? 'active' : ''}`} onClick={() => setFn(k)}>
              {k === 'all' ? 'All' : k.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <input className="sm-search" type="search" aria-label="Search posts" placeholder="Search posts…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {show?.id && <Link className="sm-link" to={`/shows/${show.id}/feed-timeline`}>Timeline &amp; generation →</Link>}
      </div>
      <p className="sm-count" data-testid="sm-count">
        {loading && posts.length === 0 ? 'Loading posts…' : `${total} post${total === 1 ? '' : 's'}${show?.name ? ` · ${show.name}` : ''}`}
      </p>
      {error && <p className="sm-error" role="alert">{error}</p>}
      {!loading && !error && posts.length === 0 && (
        <div className="sm-empty" data-testid="sm-empty">
          <p>{status === 'draft' ? 'No drafts. A draft is a post written inside an episode that is not published yet.' : 'No posts yet for this show.'}</p>
          <p>Posts are generated from an episode (its Feed tab, or the timeline page) and from the Feed scheduler. Each one is what a character said, once, with its likes and comments.</p>
        </div>
      )}
      {visible.map((p) => <PostCard key={p.id} post={p} />)}
      {hasMore && !loading && (
        <button type="button" className="sm-more" onClick={() => load(posts.length)}>Load more</button>
      )}
    </div>
  );
}

export default function SocialMediaPage() {
  const [params, setParams] = useSearchParams();
  const tab = tabFromParams(params);
  const { show, loaded } = useActiveShow();
  const layer = params.get('layer');

  const switchTab = (key) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('tab', key);
    return next;
  });

  return (
    <div className="sm-page">
      <header className="sm-header">
        <h1>Social Media</h1>
        <p className="sm-sub">Lala&apos;s social world: what was said, and who said it.</p>
      </header>
      <nav className="sm-tabs" role="tablist" aria-label="Social Media sections">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`sm-tab ${tab === t.key ? 'active' : ''}`} onClick={() => switchTab(t.key)}>
            <span>{t.label}</span>
            <small>{t.desc}</small>
          </button>
        ))}
      </nav>
      {tab === 'posts' && (
        <>
          <TabOrientation
            id="social-media-posts"
            title="Posts"
            what="Every stored post, newest first: what a character said, once, with its likes and comments."
            reads="The phone's Feed Posts zone draws these live; the episode script writer reads the ones tied to its episode."
            doHere="Read the feed as the audience would. Generate posts from an episode on its timeline page."
          />
          <PostsView show={show} showLoaded={loaded} />
        </>
      )}
      {tab === 'people' && (
        <Suspense fallback={<p className="sm-empty">Loading people…</p>}>
          <SocialProfileGenerator embedded defaultFeedLayer={layer === 'lalaverse' ? 'lalaverse' : undefined} />
        </Suspense>
      )}
    </div>
  );
}
