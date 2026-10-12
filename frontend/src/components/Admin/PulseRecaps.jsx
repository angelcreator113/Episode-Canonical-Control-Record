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
 * Styles: AdminPanel.css (pulse-recap-*).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const STATUS_WORDS = { draft: 'Draft', published: 'Published', dropped: 'Dropped' };
const errorOf = (err, fallback) => err.response?.data?.error || fallback;
const who = (p) => p.poster_display_name || `@${p.poster_handle}`;
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

export function RecapCard({ recap, onChange }) {
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
          {recaps.map((r) => <RecapCard key={r.id} recap={r} onChange={load} />)}
        </ul>
      ))}
    </section>
  );
}
