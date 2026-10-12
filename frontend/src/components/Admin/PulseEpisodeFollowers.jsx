/**
 * Admin › The Pulse › Review › Episode followers (Task 2956; The Pulse spec
 * §8 "Episode follower change: proposed when an episode is completed, from
 * its result and its posts; approved by Evoni"). Each completed episode's
 * proposed change to Lala's followers, with why, and Accept or Adjust (the
 * change and a one-line reason). Accepted, it goes into the follower ledger
 * and the Decision Log (/api/v1/pulse-followers).
 * Styles: PulseReviewPost.css (prv-epf-*).
 */
import React, { useState } from 'react';
import api from '../../services/api';

const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-US') : '—');
const signed = (n) => `${Number(n) > 0 ? '+' : Number(n) < 0 ? '−' : ''}${fmt(Math.abs(Number(n)))}`;

/** "Episode 3", from the change's story order (an episode's After is its number × 10 + 7). */
export const episodeOf = (row) => (Number.isInteger(row?.story_order) ? Math.floor(row.story_order / 10) : null);

/** Why the change is what it is, a line each. */
export function episodeLines(factors = {}) {
  const lines = [];
  if (factors.tier) lines.push(`Result: ${String(factors.tier).toUpperCase()}${factors.score != null ? ` (${factors.score}/100)` : ''}`);
  if (factors.followers_known === false) lines.push('Lala has no accepted follower count yet');
  else if (factors.followers != null) lines.push(`${signed(factors.from_result ?? 0)} from the result, on ${fmt(factors.followers)} followers`);
  if (factors.post_likes != null) lines.push(`${signed(factors.from_posts ?? 0)} from the episode's posts (${fmt(factors.post_likes)} likes)`);
  return lines;
}

function AdjustForm({ change, busy, onSubmit, onCancel }) {
  const [value, setValue] = useState(String(change));
  const [reason, setReason] = useState('');
  const whole = /^-?\d+$/.test(value.trim());
  const ready = whole && reason.trim().length > 0;
  return (
    <form className="prv-epf-adjust" data-testid="prv-epf-adjust"
      onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit({ change: Number(value), reason: reason.trim() }); }}>
      <label className="prv-epf-field">Change in followers
        <input type="number" inputMode="numeric" step="1" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <label className="prv-epf-field prv-epf-reason">Why, in one line
        <input type="text" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value.replace(/[\r\n]/g, ' '))} />
      </label>
      <span className="prv-actions">
        <button type="submit" className="prv-btn" disabled={busy || !ready}>Save change</button>
        <button type="button" className="prv-link-btn" disabled={busy} onClick={onCancel}>Cancel</button>
      </span>
    </form>
  );
}

export function EpisodeFollowersCard({ row, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [adjusting, setAdjusting] = useState(false);
  const decide = async (path, label, body) => {
    setBusy(true); setError(null);
    try {
      await api.put(`/api/v1/pulse-followers/${row.id}/${path}`, body);
      onChange?.();
    } catch (err) {
      console.error(`[PulseEpisodeFollowers] ${label} failed:`, err.response?.status || err.message);
      setError(err.response?.data?.error || `${label} failed.`);
    } finally { setBusy(false); }
  };
  const ep = episodeOf(row);
  return (
    <li className="prv-epf" data-testid="prv-epf">
      <div className="prv-epf-head">
        <b>{ep != null ? `Episode ${ep}` : 'An episode'}</b>
        <span className="prv-muted">@{row.handle || 'lala'}</span>
      </div>
      <p className="prv-epf-change" data-testid="prv-epf-change"><b>{signed(row.change)}</b> followers</p>
      <ul className="prv-epf-why" aria-label="Why this change">
        {episodeLines(row.factors || {}).map((line) => <li key={line}>{line}</li>)}
      </ul>
      {adjusting ? (
        <AdjustForm change={row.change} busy={busy} onCancel={() => setAdjusting(false)}
          onSubmit={(body) => decide('adjust', 'Adjust', body)} />
      ) : (
        <span className="prv-actions">
          <button type="button" className="prv-btn" disabled={busy} onClick={() => decide('accept', 'Accept')}>Accept</button>
          <button type="button" className="prv-link-btn" disabled={busy} onClick={() => setAdjusting(true)}>Adjust</button>
        </span>
      )}
      {error && <p className="prv-error" role="alert">{error}</p>}
    </li>
  );
}

export default function PulseEpisodeFollowers({ rows, onChange }) {
  return (
    <>
      <p className="prv-muted">Proposed when an episode is completed, from its result and its posts. Accepted, it goes into Lala's followers and the Decision Log.</p>
      <ul className="prv-plain">{rows.map((r) => <EpisodeFollowersCard key={r.id} row={r} onChange={onChange} />)}</ul>
    </>
  );
}
