/**
 * Admin › The Pulse › Recaps (Task #3009; The Pulse spec §11 "Weekly Pulse
 * recap"; docs/reads/2026-10-12-pulse-public-extras-read.md §4). Over
 * /api/v1/pulse-recaps (#3008):
 *   Build last week's recap (a draft with the week's top posts; a week that
 *   has one keeps it)
 *   RecapCard  each week's recap: its status; the title and intro; its posts
 *              as The Pulse shows them now, to move up or down or take out,
 *              and the week's other posts to add; Save; Publish, Unpublish,
 *              Drop. A published recap is on the public /pulse-recap page.
 *   ImageRights  under each post with a picture (an ADMIN's read only): the
 *              picture's library standing, its rights, and whether it is
 *              public now; the rights category to set (PUT
 *              /:id/posts/:postId/image-rights). A picture is copied to and
 *              served from the public site only while approved, public and
 *              cleared; a copy that may no longer be served is "revocation
 *              pending" with its address (the file is still there).
 * Styles: AdminPanel.css (pulse-recap-*).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { atHandle } from '../../pages/feed/feedConstants';

const STATUS_WORDS = { draft: 'Draft', published: 'Published', dropped: 'Dropped' };
const errorOf = (err, fallback) => err.response?.data?.error || fallback;
const who = (p) => p.poster_display_name || `${atHandle(p.poster_handle)}`;
const count = (n) => Number(n || 0).toLocaleString('en-US');

/** "28 Sep" for a week's Monday. */
export const weekShort = (weekStart) => new Date(`${weekStart}T00:00:00Z`)
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** The list with item i moved by `by` (-1 up, +1 down). */
export function moved(list, i, by) {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

const WHY_WORDS = {
  no_library_record: 'it has no media-library record',
  not_approved: 'its library record is not approved',
  not_public: 'its library record is not public',
  no_rights_declared: 'no rights are declared',
  rights_not_cleared: 'its rights are not cleared',
  copy_of_another_picture: 'the public copy was made from another library record (publish again to copy this one)',
};

/** What the public sees of this picture now, in words. */
export function imageStateWords(r) {
  if (r.public_now) return 'Picture: public on the recap page.';
  const why = (r.why || []).map((w) => WHY_WORDS[w] || w).join('; ');
  if (r.ready && !r.revocation) return 'Picture: cleared. It is copied to the public site the next time this recap is published.';
  return `Picture: not on the recap page (text only)${why ? `: ${why}` : ''}.`;
}

/** One post's picture: where it stands, and the rights an ADMIN declares for it. */
export function ImageRights({ recapId, post, categories, disabled, onSaved }) {
  const r = post.image_rights;
  const [category, setCategory] = useState(r.rights?.category || '');
  const [note, setNote] = useState(r.rights?.note || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // A reloaded review replaces the picks, during render (as RecapCard does).
  const [shown, setShown] = useState(r);
  if (shown !== r) {
    setShown(r);
    setCategory(r.rights?.category || ''); setNote(r.rights?.note || '');
  }
  const name = who(post);
  const takesNote = Boolean(categories.find((c) => c.key === category)?.note);
  const changed = category !== (r.rights?.category || '') || (takesNote ? note.trim() : '') !== (r.rights?.note || '');
  const save = async () => {
    setBusy(true); setError(null);
    try {
      await api.put(`/api/v1/pulse-recaps/${recapId}/posts/${post.id}/image-rights`, {
        category, ...(takesNote && note.trim() ? { note: note.trim() } : {}), ...(r.library ? {} : { create: true }),
      });
      onSaved?.();
    } catch (err) {
      console.error('[PulseRecaps] saving the picture\'s rights failed:', err.response?.status || err.message);
      setError(errorOf(err, 'Saving the rights failed.'));
    } finally { setBusy(false); }
  };

  return (
    <div className="pulse-recap-rights" data-testid="pulse-recap-rights">
      <span className="pulse-hint" data-testid="pulse-recap-rights-state">{imageStateWords(r)}</span>
      <span className="pulse-hint">
        {r.library ? `Library: ${r.library.status}, ${r.library.visibility}.` : 'Library: no record of this picture.'}
        {' '}Rights: {r.rights ? r.rights.label : 'not declared'}.
      </span>
      {r.library?.usage_rights && (
        <span className="pulse-hint">Usage note on file (context only, not a clearance): {r.library.usage_rights}</span>
      )}
      {r.revocation === 'pending' && r.copy && (
        <span className="pulse-warning" data-testid="pulse-recap-revocation">
          Revocation pending: this picture is no longer sent with the recap, but its copy is still in the public bucket and still opens at{' '}
          <span className="pulse-recap-key">{r.copy.url || r.copy.key}</span> (key <span className="pulse-recap-key">{r.copy.key}</span>). Nothing has been deleted.
        </span>
      )}
      {!disabled && (
        <>
          <label>Rights for {name}&apos;s picture
            <select value={category} disabled={busy} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Not declared</option>
              {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>
          {takesNote && (
            <label>Private note for {name}&apos;s picture (optional; never shown publicly)
              <input type="text" maxLength={500} value={note} disabled={busy} onChange={(e) => setNote(e.target.value)} />
            </label>
          )}
          {!r.library && (
            <span className="pulse-hint">Saving adds this picture to the media library as a private draft (no file is copied). Until it is approved and public there, it stays off the recap page, and readers of The Pulse do not see it either.</span>
          )}
          <span className="pulse-recap-actions">
            <button type="button" className="pulse-btn" disabled={busy || !category || !changed} aria-label={`Save rights for ${name}'s picture`} onClick={save}>
              {r.library ? 'Save rights' : 'Add to the library and save rights'}
            </button>
          </span>
        </>
      )}
      {error && <p className="pulse-error" role="alert">{error}</p>}
    </div>
  );
}

export function RecapCard({ recap, onChange, rightsCategories = null }) {
  const [title, setTitle] = useState(recap.title);
  const [intro, setIntro] = useState(recap.intro || '');
  const [posts, setPosts] = useState(recap.posts);
  const [candidates, setCandidates] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // A reloaded recap (after Save, Publish ...) replaces the edits, during
  // render: an effect would run after the first paint and could undo an
  // edit made before it ran (main's CI, 2026-10-12).
  const [shown, setShown] = useState(recap);
  if (shown !== recap) {
    setShown(recap);
    setTitle(recap.title); setIntro(recap.intro || ''); setPosts(recap.posts);
  }

  const dropped = recap.status === 'dropped';
  const dirty = title !== recap.title || intro !== (recap.intro || '')
    || posts.map((p) => p.id).join() !== recap.posts.map((p) => p.id).join();
  const act = async (label, call) => {
    setBusy(true); setError(null);
    try { await call(); onChange?.(); } catch (err) {
      console.error(`[PulseRecaps] ${label} failed:`, err.response?.status || err.message);
      setError(errorOf(err, `${label} failed.`));
    } finally { setBusy(false); }
  };
  const save = () => act('Saving the recap', () => api.put(`/api/v1/pulse-recaps/${recap.id}`, {
    title: title.trim(), intro: intro.trim(), post_ids: posts.map((p) => p.id),
  }));
  const loadCandidates = async () => {
    try {
      const res = await api.get(`/api/v1/pulse-recaps/${recap.id}/candidates`);
      setCandidates(Array.isArray(res.data?.posts) ? res.data.posts : []);
    } catch (err) {
      console.error('[PulseRecaps] the week\'s posts could not be read:', err.response?.status || err.message);
      setError('The week\'s posts could not be loaded.');
    }
  };
  const inRecap = new Set(posts.map((p) => p.id));

  return (
    <li className="pulse-recap-card" data-testid="pulse-recap-card">
      <div className="pulse-recap-head">
        <b>Week of {weekShort(recap.week_start)}</b>
        <span className={`pulse-recap-status pulse-recap-status-${recap.status}`}>{STATUS_WORDS[recap.status] || recap.status}</span>
        {recap.status === 'published' && <Link to={`/pulse-recap/${recap.id}`}>See it on the site</Link>}
      </div>
      <label>Title
        <input type="text" maxLength={200} value={title} disabled={dropped || busy} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>Intro
        <textarea rows={3} maxLength={4000} value={intro} disabled={dropped || busy} onChange={(e) => setIntro(e.target.value)}
          placeholder="A line or two in your words, above the posts." />
      </label>
      {posts.length === 0 ? <p className="pulse-hint">No posts in this recap.</p> : (
        <ol className="pulse-recap-posts">
          {posts.map((p, i) => (
            <li key={p.id} data-testid="pulse-recap-post">
              <span className="pulse-recap-post-text"><b>{who(p)}</b> {p.content_text}</span>
              <span className="pulse-hint">{count(p.likes)} likes · {count(p.comments_count)} comments</span>
              {!dropped && (
                <span className="pulse-recap-actions">
                  <button type="button" className="pulse-link-btn" aria-label={`Move ${who(p)}'s post up`} disabled={busy || i === 0} onClick={() => setPosts((l) => moved(l, i, -1))}>Up</button>
                  <button type="button" className="pulse-link-btn" aria-label={`Move ${who(p)}'s post down`} disabled={busy || i === posts.length - 1} onClick={() => setPosts((l) => moved(l, i, 1))}>Down</button>
                  <button type="button" className="pulse-link-btn" aria-label={`Take ${who(p)}'s post out`} disabled={busy} onClick={() => setPosts((l) => l.filter((x) => x.id !== p.id))}>Take out</button>
                </span>
              )}
              {p.image_rights && Array.isArray(rightsCategories) && (
                <ImageRights recapId={recap.id} post={p} categories={rightsCategories} disabled={dropped} onSaved={onChange} />
              )}
            </li>
          ))}
        </ol>
      )}
      {!dropped && (candidates === null ? (
        <button type="button" className="pulse-link-btn" onClick={loadCandidates}>Add from this week</button>
      ) : (
        <ul className="pulse-recap-candidates" data-testid="pulse-recap-candidates">
          {candidates.filter((c) => !inRecap.has(c.id)).map((c) => (
            <li key={c.id}>
              <span className="pulse-recap-post-text"><b>{who(c)}</b> {c.content_text}</span>
              <button type="button" className="pulse-link-btn" disabled={busy} onClick={() => setPosts((l) => [...l, c])}>Add</button>
            </li>
          ))}
          {candidates.every((c) => inRecap.has(c.id)) && <li className="pulse-hint">Every post of the week is in.</li>}
        </ul>
      ))}
      {!dropped && (
        <span className="pulse-recap-actions">
          <button type="button" className="pulse-btn" disabled={busy || !dirty || !title.trim()} onClick={save}>Save</button>
          {recap.status === 'draft' && (
            <button type="button" className="pulse-btn" disabled={busy || dirty} title={dirty ? 'Save first' : undefined}
              onClick={() => act('Publishing the recap', () => api.post(`/api/v1/pulse-recaps/${recap.id}/publish`, {}))}>Publish</button>
          )}
          {recap.status === 'published' && (
            <button type="button" className="pulse-link-btn" disabled={busy}
              onClick={() => act('Unpublishing the recap', () => api.post(`/api/v1/pulse-recaps/${recap.id}/unpublish`, {}))}>Unpublish</button>
          )}
          {recap.status === 'draft' && (
            <button type="button" className="pulse-link-btn" disabled={busy}
              onClick={() => act('Dropping the recap', () => api.post(`/api/v1/pulse-recaps/${recap.id}/drop`, {}))}>Drop</button>
          )}
        </span>
      )}
      {Array.isArray(recap.pending_revocations) && recap.pending_revocations.length > 0 && (
        <div className="pulse-recap-rights" data-testid="pulse-recap-pending">
          <span className="pulse-warning">Revocation pending for {recap.pending_revocations.length === 1 ? '1 public copy' : `${recap.pending_revocations.length} public copies`}: no longer sent with the recap, but still in the public bucket. Nothing has been deleted.</span>
          <ul className="pulse-recap-candidates">
            {recap.pending_revocations.map((c) => <li key={c.key} className="pulse-hint pulse-recap-key">{c.url || c.key}</li>)}
          </ul>
        </div>
      )}
      {error && <p className="pulse-error" role="alert">{error}</p>}
    </li>
  );
}

export default function PulseRecaps({ showId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/api/v1/pulse-recaps?show_id=${encodeURIComponent(showId)}`);
      setData(res.data);
      setError(null);
    } catch (err) {
      console.error('[PulseRecaps] the recaps could not be read:', err.response?.status || err.message);
      setError('The recaps could not be loaded.');
    }
  }, [showId]);
  useEffect(() => { load(); }, [load]);

  const build = async () => {
    setBusy(true); setNote(null); setError(null);
    try {
      const res = await api.post('/api/v1/pulse-recaps/build', { show_id: showId });
      setNote(res.data?.created ? "Last week's recap is drafted." : "Last week's recap was already there.");
      await load();
    } catch (err) {
      console.error('[PulseRecaps] building the recap failed:', err.response?.status || err.message);
      setError(errorOf(err, 'Building the recap failed.'));
    } finally { setBusy(false); }
  };
  const recaps = Array.isArray(data?.recaps) ? data.recaps : [];

  return (
    <section className="pulse-recap" aria-labelledby="pulse-recap-heading" data-testid="pulse-recap">
      <h3 id="pulse-recap-heading">Recaps</h3>
      <p className="pulse-hint">Each week&apos;s biggest posts, as a page on the public site once you publish it. A draft is made for last week while the posting engine is on; you can build it any time.</p>
      <span className="pulse-recap-actions">
        <button type="button" className="pulse-btn" disabled={busy} onClick={build}>Build last week&apos;s recap</button>
        <Link to="/pulse-recap">The public recap page</Link>
      </span>
      {note && <p className="pulse-hint" role="status">{note}</p>}
      {error && <p className="pulse-error" role="alert">{error}</p>}
      {!data && !error && <p className="pulse-hint">Loading the recaps…</p>}
      {data && (recaps.length === 0 ? <p className="pulse-hint" data-testid="pulse-recap-empty">No recaps yet.</p> : (
        <ul className="pulse-recap-cards">
          {recaps.map((r) => <RecapCard key={r.id} recap={r} onChange={load} rightsCategories={data.rights_categories} />)}
        </ul>
      ))}
    </section>
  );
}
