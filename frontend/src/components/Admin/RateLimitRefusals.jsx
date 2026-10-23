/**
 * Admin › Tools: "Recent sign-in and rate-limit refusals" — the last 200
 * requests a rate limit refused, newest first, with a count per limit
 * (GET /api/v1/admin/rate-limit-refusals; middleware/rateLimits
 * recentRefusals). Evoni, 2026-10-23: locked out twice, and neither of us
 * could tell which limit it was without the server logs.
 *
 * The server keeps the list in memory, so it starts empty after every
 * restart (every deploy); the panel says so.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import apiClient from '../../services/api';
import './RateLimitRefusals.css';

// What each limit is, in words (rateLimits.refusedBy's `limit` names, plus
// 'cognito' for the sign-in service's own limits).
export const LIMIT_LABELS = {
  'sign-in': 'Sign-in (wrong passwords)',
  site: 'Site (signed-out requests)',
  writes: 'Saves per minute',
  refresh: 'Session refresh',
  cognito: 'Sign-in service (Cognito)',
};
export const limitLabel = (limit) => LIMIT_LABELS[limit] || limit;

const timeLabel = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
};

export default function RateLimitRefusals() {
  const [state, setState] = useState({ loading: true, error: null, refusals: [], counts: {}, kept: 200 });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await apiClient.get('/api/v1/admin/rate-limit-refusals');
      const data = res.data?.data || {};
      setState({ loading: false, error: null, refusals: data.refusals || [], counts: data.counts || {}, kept: data.kept || 200 });
    } catch (err) {
      console.error('[RateLimitRefusals] load failed:', err.message, err.response?.status);
      setState((s) => ({ ...s, loading: false, error: 'Could not load the refusals list.' }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { loading, error, refusals, counts, kept } = state;
  const countEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <section className="rlr" aria-labelledby="rlr-heading" data-testid="rate-limit-refusals">
      <div className="rlr-head">
        <h2 id="rlr-heading" className="rlr-title">
          <ShieldAlert size={18} aria-hidden="true" />
          Recent refusals
        </h2>
        <button type="button" className="rlr-refresh" onClick={load} disabled={loading}>
          <RefreshCw size={14} aria-hidden="true" className={loading ? 'rlr-spin' : undefined} />
          Refresh
        </button>
      </div>
      <p className="rlr-note">
        Requests a sign-in or rate limit turned away, newest first (the last {kept}).
        The server keeps this list in memory, so it clears when the server restarts, which every deploy does.
      </p>

      {error && <p className="rlr-error" role="alert">{error}</p>}

      {countEntries.length > 0 && (
        <ul className="rlr-counts" aria-label="Refusals per limit">
          {countEntries.map(([limit, n]) => (
            <li key={limit} className={`rlr-count rlr-limit--${limit}`}>
              <span className="rlr-count-n">{n}</span>
              <span className="rlr-count-label">{limitLabel(limit)}</span>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && refusals.length === 0 && (
        <p className="rlr-empty">No refusals since the server last started.</p>
      )}

      {refusals.length > 0 && (
        <ol className="rlr-list">
          {refusals.map((r, i) => (
            <li key={`${r.at}-${i}`} className="rlr-row">
              <time className="rlr-time" dateTime={r.at}>{timeLabel(r.at)}</time>
              <span className={`rlr-badge rlr-limit--${r.limit}`}>{limitLabel(r.limit)}</span>
              <span className="rlr-req"><span className="rlr-method">{r.method}</span> {r.path}</span>
              <span className="rlr-ip" title="Address, last part hidden">{r.ip}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
