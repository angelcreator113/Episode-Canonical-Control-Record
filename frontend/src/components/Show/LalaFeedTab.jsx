/**
 * Producer Mode → Lala's Feed (Evoni's redesign, 2026-10-05: "bring the
 * feed back"; the Sidebar's Social Media page stays). Queue: drafts waiting
 * on approval; Scheduled: drafts going out with an episode's release; Live:
 * what is posted; Deleted: what was deleted, to restore. Approve posts a
 * draft now; Edit, Redraft in their voice (with an undo) and Delete work on
 * drafts only (a live post is locked, services/feedPostStatus.js; a live
 * post can still be deleted from the full page). Post as Lala writes a post
 * by hand. Beside it, what Lala sees on her feed right now.
 * Props: showId, episodes, onCountChanged(drafts waiting) for the tab pill.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import api from '../../services/api';
import { FEED_VIEWS, postsFor, posterName, postOrigin, goesLive, timeAgo } from '../../lib/lalaFeed';

const initial = (name) => String(name || '?').replace(/^@/, '').charAt(0).toUpperCase();

function PostCard({ post, episodes, busy, onApprove, onSave, onDelete, onRedraft, onRestore }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(post.content_text || '');
  useEffect(() => { if (!editing) setText(post.content_text || ''); }, [post.content_text, editing]);
  const deleted = Boolean(post.deleted_at);
  const draft = post.status !== 'live';
  const ep = episodes.find((e) => e.id === post.episode_id);
  const name = posterName(post);
  return (
    <li className="wa-lf-post" data-testid={`feed-post-${post.id}`}>
      <div className="wa-lf-post-head">
        <span className="wa-lf-avatar" aria-hidden="true">{initial(name)}</span>
        <span className="wa-lf-who"><strong>{name}</strong><span>{postOrigin(post)}</span></span>
        <span className={`wa-lf-status ${deleted ? 'deleted' : draft ? 'draft' : 'live'}`}>{deleted ? `Deleted ${draft ? 'draft' : 'post'}` : draft ? 'Draft' : 'Live'}</span>
      </div>
      {editing ? (
        <textarea className="wa-lf-edit" aria-label={`Edit ${name}'s post`} value={text} onChange={(e) => setText(e.target.value)} rows={3} />
      ) : (
        <p className="wa-lf-text">{post.content_text}</p>
      )}
      {(ep || post.narrative_function || post.post_type === 'relationship') && (
        <ul className="wa-lf-chips">
          {ep && <li>Episode {ep.episode_number ?? '?'}</li>}
          {ep && draft && <li>Goes with the release</li>}
          {post.narrative_function && <li>{String(post.narrative_function).replace(/_/g, ' ')}</li>}
        </ul>
      )}
      <div className="wa-lf-actions">
        {deleted && (
          <button type="button" className="wa-lf-secondary" disabled={busy} onClick={() => onRestore(post)} data-testid={`feed-restore-${post.id}`}>Restore</button>
        )}
        {!deleted && draft && !editing && (
          <>
            <button type="button" className="wa-lf-primary" disabled={busy} onClick={() => onApprove(post)} data-testid={`feed-approve-${post.id}`}>
              {post.episode_id ? 'Post now' : 'Approve'}
            </button>
            <button type="button" className="wa-lf-secondary" disabled={busy} onClick={() => setEditing(true)}>Edit</button>
            <button type="button" className="wa-lf-link-btn" disabled={busy} onClick={() => onRedraft(post)} data-testid={`feed-redraft-${post.id}`}>
              {busy ? 'Redrafting…' : 'Redraft in their voice'}
            </button>
            <button type="button" className="wa-lf-quiet" disabled={busy} onClick={() => onDelete(post)}>Delete</button>
          </>
        )}
        {editing && (
          <>
            <button type="button" className="wa-lf-primary" disabled={busy || !text.trim()} onClick={async () => { if (await onSave(post, text.trim())) setEditing(false); }}>Save</button>
            <button type="button" className="wa-lf-secondary" disabled={busy} onClick={() => { setText(post.content_text || ''); setEditing(false); }}>Cancel</button>
          </>
        )}
        <span className="wa-lf-when">{deleted ? `Deleted ${timeAgo(post.deleted_at) || ''}`.trim() : draft ? goesLive(post, episodes) : `Posted ${timeAgo(post.posted_at) || ''}`.trim()}</span>
      </div>
    </li>
  );
}

function Composer({ showId, onPosted, onClose }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const send = async (status) => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/v1/feed-posts', { show_id: showId, content_text: text.trim(), poster_handle: 'lala', poster_display_name: 'Lala', status });
      setText('');
      onPosted(status);
    } catch (err) {
      console.error('[LalaFeedTab] post failed:', err);
      setError(err.response?.data?.error || 'The post could not be saved.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="wa-lf-composer" data-testid="feed-composer" aria-label="Post as Lala">
      <textarea aria-label="What's Lala posting?" placeholder="What's on Lala's mind?" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
      {error && <p className="wa-lf-error" role="alert">{error}</p>}
      <div className="wa-lf-actions">
        <button type="button" className="wa-lf-primary" disabled={busy || !text.trim()} onClick={() => send('live')}>Post now</button>
        <button type="button" className="wa-lf-secondary" disabled={busy || !text.trim()} onClick={() => send('draft')}>Save as a draft</button>
        <button type="button" className="wa-lf-quiet" disabled={busy} onClick={onClose}>Cancel</button>
      </div>
    </section>
  );
}

export default function LalaFeedTab({ showId, episodes = [], onCountChanged }) {
  const [view, setView] = useState('queue');
  const [drafts, setDrafts] = useState(null);
  const [live, setLive] = useState(null);
  const [deletedPosts, setDeletedPosts] = useState(null);
  // The last redraft, so it can be undone: { post, previous }.
  const [undo, setUndo] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    const get = (status, limit) => api.get(`/api/v1/feed-posts?show_id=${encodeURIComponent(showId)}&status=${status}&limit=${limit}`)
      .then((r) => r.data?.data || [])
      .catch((err) => { console.error(`[LalaFeedTab] ${status} posts load failed:`, err); return []; });
    const [d, l, x] = await Promise.all([
      get('draft', 100), get('live', 30),
      api.get(`/api/v1/feed-posts/deleted?show_id=${encodeURIComponent(showId)}&limit=50`)
        .then((r) => r.data?.data || [])
        .catch((err) => { console.error('[LalaFeedTab] deleted posts load failed:', err); return []; }),
    ]);
    setDrafts(d);
    setLive(l);
    setDeletedPosts(x);
    onCountChanged?.(d.filter((p) => !p.episode_id).length);
  }, [showId, onCountChanged]);
  useEffect(() => { load(); }, [load]);

  const act = async (post, fn, done) => {
    setBusyId(post.id);
    setMessage(null);
    setUndo(null);
    try {
      await fn();
      setMessage({ ok: true, text: done });
      await load();
      return true;
    } catch (err) {
      console.error('[LalaFeedTab] post update failed:', err);
      setMessage({ ok: false, text: err.response?.data?.error || 'That did not save.' });
      return false;
    } finally {
      setBusyId(null);
    }
  };
  const approve = (post) => act(post, () => api.put(`/api/v1/feed-posts/${post.id}`, { status: 'live', posted_at: new Date().toISOString() }), `${posterName(post)}'s post is live.`);
  const save = (post, text) => act(post, () => api.put(`/api/v1/feed-posts/${post.id}`, { content_text: text }), 'Draft saved.');
  const restore = (post) => act(post, () => api.post(`/api/v1/feed-posts/${post.id}/restore`), `${posterName(post)}'s post is back.`);
  // The redraft replaces the draft's text; Undo puts the old text back.
  const redraft = async (post) => {
    let previous = null;
    let voice = null;
    const ok = await act(post, async () => {
      const r = await api.post(`/api/v1/feed-posts/${post.id}/redraft`, {});
      previous = r.data?.previous_text ?? post.content_text;
      voice = r.data?.voice;
    }, 'Redrafted.');
    if (ok) {
      setMessage({ ok: true, text: `Redrafted in ${voice ? `@${voice}'s` : `${posterName(post)}'s`} voice.` });
      setUndo({ post, previous });
    }
  };
  const undoRedraft = async () => {
    const { post, previous } = undo;
    await act(post, () => api.put(`/api/v1/feed-posts/${post.id}`, { content_text: previous }), 'The redraft is undone.');
  };
  const remove = (post) => {
    if (!window.confirm(`Delete ${posterName(post)}'s draft?`)) return false;
    return act(post, () => api.delete(`/api/v1/feed-posts/${post.id}`), 'Draft deleted.');
  };

  const shown = postsFor(view, drafts, live, deletedPosts);
  const counts = { queue: postsFor('queue', drafts, live).length, scheduled: postsFor('scheduled', drafts, live).length, live: (live || []).length, deleted: (deletedPosts || []).length };
  const heading = { queue: 'Waiting for your approval', scheduled: 'Going out with a release', live: 'On her feed', deleted: 'Deleted posts' }[view];

  return (
    <div className="wa-lf" data-testid="lala-feed">
      <div className="wa-lf-head">
        <h2>Lala&apos;s Feed</h2>
        <div className="wa-lf-views" role="group" aria-label="Which posts">
          {FEED_VIEWS.map((v) => (
            <button key={v.key} type="button" className={`wa-lf-view${view === v.key ? ' active' : ''}`} aria-pressed={view === v.key}
              data-testid={`feed-view-${v.key}`} onClick={() => setView(v.key)}>
              {v.label}{drafts != null && <span className="wa-lf-count">{counts[v.key]}</span>}
            </button>
          ))}
        </div>
        <button type="button" className="wa-lf-post-btn" onClick={() => setComposing(true)} data-testid="feed-post-as-lala">
          <Plus size={16} aria-hidden="true" /> Post as Lala
        </button>
      </div>

      <div className="wa-lf-body">
        <div className="wa-lf-main">
          {composing && <Composer showId={showId} onClose={() => setComposing(false)}
            onPosted={async (status) => { setComposing(false); setMessage({ ok: true, text: status === 'live' ? 'Posted to her feed.' : 'Saved to the queue.' }); await load(); }} />}
          {message && (
            <p className={`wa-lf-message${message.ok ? '' : ' bad'}`} role="status">
              {message.text}
              {undo && <button type="button" className="wa-lf-link-btn" onClick={undoRedraft} data-testid="feed-redraft-undo">Undo</button>}
            </p>
          )}
          <h3 className="wa-lf-section">{heading} {drafts != null && <span>{shown.length} {view === 'live' || view === 'deleted' ? `post${shown.length === 1 ? '' : 's'}` : `draft${shown.length === 1 ? '' : 's'}`}</span>}</h3>
          {drafts == null ? <p className="wa-lf-empty">Loading the feed…</p> : shown.length === 0 ? (
            <p className="wa-lf-empty">
              {{ queue: 'Nothing waiting for approval.', scheduled: 'No drafts going out with an episode. An episode\'s feed posts are made on its feed timeline.', live: 'Nothing posted yet.', deleted: 'Nothing deleted.' }[view]}
            </p>
          ) : (
            <ul className="wa-lf-list">
              {shown.map((p) => (
                <PostCard key={p.id} post={p} episodes={episodes} busy={busyId === p.id} onApprove={approve} onSave={save} onDelete={remove} onRedraft={redraft} onRestore={restore} />
              ))}
            </ul>
          )}
        </div>

        <aside className="wa-lf-side" data-testid="feed-lala-sees">
          <span className="wa-lf-eyebrow">What Lala sees right now</span>
          <div className="wa-lf-phone">
            <div className="wa-lf-phone-bar">lalaverse</div>
            {(live || []).slice(0, 3).map((p) => (
              <div key={p.id} className="wa-lf-phone-post">
                <span className="wa-lf-avatar small" aria-hidden="true">{initial(posterName(p))}</span>
                <span>
                  <strong>{posterName(p)}</strong> {p.content_text}
                  {timeAgo(p.posted_at) && <small>{timeAgo(p.posted_at)}</small>}
                </span>
              </div>
            ))}
            {live && !live.length && <p className="wa-lf-empty pad">Her feed is quiet.</p>}
          </div>
          <Link className="wa-lf-link" to="/feed?layer=lalaverse">Open the full page</Link>
        </aside>
      </div>
    </div>
  );
}
