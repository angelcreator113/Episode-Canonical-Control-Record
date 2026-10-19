/**
 * Counts toward a deal (Evoni, 2026-10-19; services/deliverableProgress):
 * on a post's card in Pulse Review, what deal deliverable the post counts
 * toward, or a pick of the open ones in its format. A post counts once it
 * is live; it stops counting if it is taken down. ADMIN.
 */
import { useState, useEffect, useCallback } from 'react';
import { Briefcase } from 'lucide-react';
import api from '../../services/api';
import './PostDeal.css';

const BASE = '/api/v1/deliverable-progress';
const errorText = (err, fallback) => err?.response?.data?.error || fallback;

export default function PostDeal({ postId }) {
  const [data, setData] = useState(null);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`${BASE}/posts/${postId}`);
      setData(res.data);
    } catch (err) {
      console.error('[PostDeal] could not read the deals:', err);
      setError(errorText(err, 'Could not read the deals.'));
    }
  }, [postId]);
  useEffect(() => { load(); }, [load]);

  const change = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setPick('');
      await load();
    } catch (err) {
      console.error('[PostDeal] the link could not be saved:', err);
      setError(errorText(err, 'That did not save.'));
    } finally {
      setBusy(false);
    }
  };

  if (!data || (!data.counts_toward && !data.open.length)) return error ? <p className="pd-error" role="alert">{error}</p> : null;
  return (
    <div className="pd" data-testid="post-deal">
      <Briefcase size={13} aria-hidden />
      {data.counts_toward ? (
        <>
          <span>Counts toward <b>{data.counts_toward.name}</b></span>
          <button type="button" className="pd-btn is-quiet" disabled={busy}
            onClick={() => change(() => api.delete(`${BASE}/deliverables/${data.counts_toward.deliverable_id}/posts/${postId}`))}>Unlink</button>
        </>
      ) : (
        <>
          <label className="pd-label" htmlFor={`pd-${postId}`}>Counts toward a deal</label>
          <select id={`pd-${postId}`} className="pd-select" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Choose…</option>
            {data.open.map((o) => <option key={o.deliverable_id} value={o.deliverable_id}>{o.name}{o.line ? ` (${o.line.split(': ')[1]})` : ''}</option>)}
          </select>
          <button type="button" className="pd-btn" disabled={busy || !pick}
            onClick={() => change(() => api.post(`${BASE}/deliverables/${pick}/posts`, { post_id: postId }))}>Link</button>
        </>
      )}
      {error && <span className="pd-error" role="alert">{error}</span>}
    </div>
  );
}
