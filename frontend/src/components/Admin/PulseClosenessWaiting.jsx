/**
 * Admin › The Pulse › Review › Closeness waiting (Task 2983; The Pulse spec
 * §9 "Repeated interactions (or ignored ones) adjust Relationship Map
 * closeness by small amounts, each change recorded with its cause, proposed
 * and approved like numbers"). Changes involving Lala, and large ones, wait
 * here: the pair, closeness before and after (in points out of 100), the
 * cause and the post behind it, with Accept, Adjust (a change and a one-line
 * reason) and Reject (/api/v1/pulse-closeness).
 * Styles: PulseReviewPost.css (prv-num-*, shared with Numbers waiting).
 */
import React, { useState } from 'react';
import api from '../../services/api';
import { atHandle } from '../../pages/feed/feedConstants';

export const CAUSE_LABELS = {
  comment: 'Commented',
  mention: 'Mentioned them',
  ignored: "Ignored a close friend's post",
  override: 'Set by hand',
};

/** Closeness 0–1 as points out of 100; a change with its sign. */
export const points = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : String(Math.round(Number(v) * 100)));
export const signed = (v) => {
  const n = Math.round(Number(v) * 100);
  return n > 0 ? `+${n}` : String(n);
};

function AdjustForm({ delta, busy, onSubmit, onCancel }) {
  const [value, setValue] = useState(String(Math.round(Number(delta) * 100)));
  const [reason, setReason] = useState('');
  const n = Number(value);
  const ready = /^-?\d+$/.test(value.trim()) && Math.abs(n) <= 20 && reason.trim().length > 0;
  return (
    <form className="prv-num-adjust" data-testid="prv-close-adjust"
      onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit({ delta: n / 100, reason: reason.trim() }); }}>
      <label className="prv-num-field">Change (points, −20 to 20)
        <input type="number" inputMode="numeric" min="-20" max="20" step="1" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <label className="prv-num-field prv-num-reason">Why, in one line
        <input type="text" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value.replace(/[\r\n]/g, ' '))} />
      </label>
      <span className="prv-actions">
        <button type="submit" className="prv-btn" disabled={busy || !ready}>Save change</button>
        <button type="button" className="prv-link-btn" disabled={busy} onClick={onCancel}>Cancel</button>
      </span>
    </form>
  );
}

export function ClosenessCard({ row, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [adjusting, setAdjusting] = useState(false);
  const decide = async (action, label, body) => {
    setBusy(true); setError(null);
    try {
      await api.put(`/api/v1/pulse-closeness/${row.id}/${action}`, body);
      onChange?.();
    } catch (err) {
      console.error(`[PulseCloseness] ${label} failed:`, err.response?.status || err.message);
      setError(err.response?.data?.error || `${label} failed.`);
    } finally { setBusy(false); }
  };
  const name = (p, id) => (p?.handle ? `${atHandle(p.handle)}` : `profile ${id}`);
  const source = row.source || {};
  return (
    <li className="prv-num" data-testid="prv-close">
      <div className="prv-num-head">
        <b>{name(row.a, row.profile_a_id)} ↔ {name(row.b, row.profile_b_id)}</b>
        <span className="prv-num-flag">{CAUSE_LABELS[row.cause] || row.cause}</span>
      </div>
      <p className="prv-num-proposed" data-testid="prv-close-change">
        <span>Closeness <b>{points(row.closeness_before)}</b> → <b>{points(row.closeness_after)}</b></span>
        <span><b>{signed(row.delta)}</b></span>
        {row.label && <span className="prv-muted">{row.label}</span>}
      </p>
      {source.comment_text && <p className="prv-num-text">“{source.comment_text}”</p>}
      {source.content_text && <p className="prv-num-text prv-muted">{source.poster_handle ? `${atHandle(source.poster_handle)}: ` : ''}{source.content_text}</p>}
      {adjusting ? (
        <AdjustForm delta={row.delta} busy={busy} onCancel={() => setAdjusting(false)}
          onSubmit={(body) => decide('adjust', 'Adjust', body)} />
      ) : (
        <span className="prv-actions">
          <button type="button" className="prv-btn" disabled={busy} onClick={() => decide('accept', 'Accept')}>Accept</button>
          <button type="button" className="prv-link-btn" disabled={busy} onClick={() => setAdjusting(true)}>Adjust</button>
          <button type="button" className="prv-link-btn" disabled={busy} onClick={() => decide('reject', 'Reject')}>Reject</button>
        </span>
      )}
      {error && <p className="prv-error" role="alert">{error}</p>}
    </li>
  );
}

export default function PulseClosenessWaiting({ changes, total, onChange }) {
  return (
    <>
      <p className="prv-muted">Comments, mentions and ignored posts move how close two characters are. Small changes between others apply on their own; Lala's and large ones wait for you.</p>
      <ul className="prv-plain">{changes.map((c) => <ClosenessCard key={c.id} row={c} onChange={onChange} />)}</ul>
      {total > changes.length && <p className="prv-muted">Showing {changes.length} of {total}.</p>}
    </>
  );
}
