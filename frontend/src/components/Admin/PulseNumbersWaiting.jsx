/**
 * Admin › The Pulse › Review › Numbers waiting (Task 2954; The Pulse spec §8
 * "Review: Lala's numbers always wait for Evoni"). Each live post's
 * proposed likes and shares that did not auto-accept (Task 2953), with why
 * they were proposed and why they wait, and the four decisions: Accept,
 * Adjust (two numbers and a one-line reason), Make it viral, Make it flop.
 * A decision locks the numbers (/api/v1/pulse-numbers).
 * Styles: PulseReviewPost.css (prv-num-*).
 */
import React, { useState } from 'react';
import api from '../../services/api';

export const FLAG_LABELS = {
  lala: "Lala's post",
  about_lala: 'About Lala',
  spike: 'Unusual spike',
  no_followers: 'No follower count yet',
};

const KIND_LABELS = { fit: 'Fit post', status: 'Status', announcement: 'Announcement', other: 'Other post' };
const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-US') : '—');

/** The factors, in a line each: why these numbers were proposed. */
export function factorLines(factors = {}) {
  const lines = [`${fmt(factors.followers)} followers${factors.followers_from && factors.followers_from !== 'ledger' ? ` (${factors.followers_from})` : ''}`];
  lines.push(KIND_LABELS[factors.kind] || 'Post');
  if (factors.trending) lines.push(`Riding ${factors.trending_topic || 'a trend'}`);
  if (factors.episode_tier) lines.push(`Episode result: ${factors.episode_tier}`);
  if (factors.poster_median != null) lines.push(`Usually about ${fmt(factors.poster_median)} likes`);
  return lines;
}

function AdjustForm({ proposed, busy, onSubmit, onCancel }) {
  const [likes, setLikes] = useState(String(proposed.likes));
  const [shares, setShares] = useState(String(proposed.shares));
  const [reason, setReason] = useState('');
  const whole = (v) => /^\d+$/.test(v.trim());
  const ready = whole(likes) && whole(shares) && reason.trim().length > 0;
  return (
    <form className="prv-num-adjust" data-testid="prv-num-adjust"
      onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit({ likes: Number(likes), shares: Number(shares), reason: reason.trim() }); }}>
      <label className="prv-num-field">Likes
        <input type="number" inputMode="numeric" min="0" step="1" value={likes} onChange={(e) => setLikes(e.target.value)} />
      </label>
      <label className="prv-num-field">Shares
        <input type="number" inputMode="numeric" min="0" step="1" value={shares} onChange={(e) => setShares(e.target.value)} />
      </label>
      <label className="prv-num-field prv-num-reason">Why, in one line
        <input type="text" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value.replace(/[\r\n]/g, ' '))} />
      </label>
      <span className="prv-actions">
        <button type="submit" className="prv-btn" disabled={busy || !ready}>Save numbers</button>
        <button type="button" className="prv-link-btn" disabled={busy} onClick={onCancel}>Cancel</button>
      </span>
    </form>
  );
}

export function NumbersCard({ row, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [adjusting, setAdjusting] = useState(false);
  const decide = async (action, label, body) => {
    setBusy(true); setError(null);
    try {
      await api.put(`/api/v1/pulse-numbers/${row.id}/${action}`, body);
      onChange?.();
    } catch (err) {
      console.error(`[PulseNumbers] ${label} failed:`, err.response?.status || err.message);
      setError(err.response?.data?.error || `${label} failed.`);
    } finally { setBusy(false); }
  };
  const post = row.post || {};
  return (
    <li className="prv-num" data-testid="prv-num">
      <div className="prv-num-head">
        <b>@{post.poster_handle || row.poster_handle || 'unknown'}</b>
        {row.flag && <span className="prv-num-flag" data-testid="prv-num-flag">{FLAG_LABELS[row.flag] || row.flag}</span>}
      </div>
      {post.content_text && <p className="prv-num-text">{post.content_text}</p>}
      <p className="prv-num-proposed" data-testid="prv-num-proposed">
        <span><b>{fmt(row.proposed.likes)}</b> likes</span>
        <span><b>{fmt(row.proposed.shares)}</b> shares</span>
      </p>
      <ul className="prv-num-why" aria-label="Why these numbers">
        {factorLines(row.factors).map((line) => <li key={line}>{line}</li>)}
      </ul>
      {adjusting ? (
        <AdjustForm proposed={row.proposed} busy={busy} onCancel={() => setAdjusting(false)}
          onSubmit={(body) => decide('adjust', 'Adjust', body)} />
      ) : (
        <span className="prv-actions">
          <button type="button" className="prv-btn" disabled={busy} onClick={() => decide('accept', 'Accept')}>Accept</button>
          <button type="button" className="prv-link-btn" disabled={busy} onClick={() => setAdjusting(true)}>Adjust</button>
          <button type="button" className="prv-link-btn" disabled={busy} onClick={() => decide('viral', 'Make it viral')}>Make it viral</button>
          <button type="button" className="prv-link-btn" disabled={busy} onClick={() => decide('flop', 'Make it flop')}>Make it flop</button>
        </span>
      )}
      {error && <p className="prv-error" role="alert">{error}</p>}
    </li>
  );
}

export default function PulseNumbersWaiting({ numbers, total, onChange }) {
  return (
    <>
      <p className="prv-muted">Proposed when each post went live. Lala's, posts about her and unusual numbers wait for you; a decision locks them.</p>
      <ul className="prv-plain">{numbers.map((n) => <NumbersCard key={n.id} row={n} onChange={onChange} />)}</ul>
      {total > numbers.length && <p className="prv-muted">Showing {numbers.length} of {total}.</p>}
    </>
  );
}
