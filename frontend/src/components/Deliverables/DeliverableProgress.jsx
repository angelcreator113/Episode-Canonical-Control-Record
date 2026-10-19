/**
 * Deliverables that check themselves (Evoni, 2026-10-19: "yes start
 * deliverables after phase 2"; services/deliverableProgress): a deal's
 * deliverables with "Pulse stories: 2 of 3" and the posts that count, and
 * "Link a post" (the likely posts first). Given an eventId or an
 * opportunityId. `compact` shows only the lines (the Opportunities tab).
 * Linking is ADMIN; a post counts while it is live in the right format.
 */
import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Circle, Link2, X, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { atHandle } from '../../pages/feed/feedConstants';
import './DeliverableProgress.css';

const BASE = '/api/v1/deliverable-progress';
const errorText = (err, fallback) => err?.response?.data?.error || fallback;

function Suggestions({ deliverableId, onLink, busy }) {
  const [state, setState] = useState({ loading: true, posts: [] });
  useEffect(() => {
    let live = true;
    api.get(`${BASE}/deliverables/${deliverableId}/suggestions`)
      .then((r) => { if (live) setState({ loading: false, posts: r.data?.posts || [] }); })
      .catch((err) => { console.error('[DeliverableProgress] suggestions failed:', err); if (live) setState({ loading: false, posts: [], error: errorText(err, 'Could not find posts.') }); });
    return () => { live = false; };
  }, [deliverableId]);
  if (state.loading) return <p className="dp-muted"><Loader2 size={12} className="dp-spin" aria-hidden /> Finding posts…</p>;
  if (state.error) return <p className="dp-error" role="alert">{state.error}</p>;
  if (!state.posts.length) return <p className="dp-muted">No posts in this format yet.</p>;
  return (
    <ul className="dp-suggest" data-testid={`dp-suggest-${deliverableId}`}>
      {state.posts.map((p) => (
        <li key={p.id}>
          <span className="dp-post"><b>{atHandle(p.handle) || 'A post'}</b> {p.text}{p.status !== 'live' && <span className="dp-muted"> · draft, counts once it goes out</span>}</span>
          <button type="button" className="dp-btn" disabled={busy} onClick={() => onLink(p.id)}>Link</button>
        </li>
      ))}
    </ul>
  );
}

export default function DeliverableProgress({ eventId = null, opportunityId = null, compact = false, canEdit = true }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const url = opportunityId ? `${BASE}/opportunities/${opportunityId}` : `${BASE}/events/${eventId}`;

  const load = useCallback(async () => {
    try {
      const res = await api.get(url);
      setData(res.data);
    } catch (err) {
      console.error('[DeliverableProgress] progress could not be read:', err);
      setError(errorText(err, 'Could not read the deliverables.'));
    }
  }, [url]);
  useEffect(() => { if (eventId || opportunityId) load(); }, [load, eventId, opportunityId]);

  const act = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      setData((d) => ({ ...d, ...res.data }));
      setOpen(null);
    } catch (err) {
      console.error('[DeliverableProgress] link change failed:', err);
      setError(errorText(err, 'That did not save.'));
    } finally {
      setBusy(false);
    }
  };
  const link = (deliverableId, postId) => act(() => api.post(`${BASE}/deliverables/${deliverableId}/posts`, { post_id: postId }));
  const unlink = (deliverableId, postId) => act(() => api.delete(`${BASE}/deliverables/${deliverableId}/posts/${postId}`));

  if (!data) return error ? <p className="dp-error" role="alert">{error}</p> : null;
  const countable = (data.deliverables || []).filter((d) => d.countable);
  if (!countable.length) return null;

  if (compact) {
    return (
      <span className="dp-compact" data-testid="dp-compact">
        {data.all_done
          ? <span className="dp-done"><CheckCircle2 size={12} aria-hidden /> Deliverables done</span>
          : countable.map((d) => <span key={d.id} className={d.done ? 'dp-done' : 'dp-left'}>{d.line}</span>)}
      </span>
    );
  }

  return (
    <div className="dp" data-testid="dp-progress">
      <p className="dp-head">
        {data.all_done
          ? <span className="dp-done"><CheckCircle2 size={14} aria-hidden /> Deliverables done</span>
          : <span>On The Pulse: {data.done} of {data.countable} done</span>}
      </p>
      {error && <p className="dp-error" role="alert">{error}</p>}
      <ul className="dp-list">
        {countable.map((d) => (
          <li key={d.id} className="dp-item" data-testid={`dp-item-${d.id}`}>
            <span className="dp-line">
              {d.done ? <CheckCircle2 size={14} className="dp-done" aria-hidden /> : <Circle size={14} aria-hidden />}
              <b>{d.line}</b>
              {canEdit && !d.done && (
                <button type="button" className="dp-link" onClick={() => setOpen(open === d.id ? null : d.id)} aria-expanded={open === d.id}>
                  <Link2 size={12} aria-hidden /> Link a post
                </button>
              )}
            </span>
            {d.posts.length > 0 && (
              <ul className="dp-posts">
                {d.posts.map((p) => (
                  <li key={p.id}>
                    <span className="dp-post"><b>{atHandle(p.handle) || 'A post'}</b> {p.text}{!p.counts && <span className="dp-muted"> · not counting ({p.status === 'live' ? 'another format' : 'not live'})</span>}</span>
                    {canEdit && (
                      <button type="button" className="dp-icon" disabled={busy} onClick={() => unlink(d.id, p.id)} aria-label="Stop counting this post"><X size={12} aria-hidden /></button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {open === d.id && <Suggestions deliverableId={d.id} busy={busy} onLink={(postId) => link(d.id, postId)} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
