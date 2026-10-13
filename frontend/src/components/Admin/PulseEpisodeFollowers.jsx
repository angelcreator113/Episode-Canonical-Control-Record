/**
 * Admin › The Pulse › Review › Follower changes (Task 2956; widened in Task
 * 3086). Every proposed follower change waits here with its source, its
 * story time, why and the amount, and Accept or Adjust (the change and a
 * one-line reason):
 *   episode  Lala's change from a completed episode's result
 *   post     a published post's change once its numbers lock (its likes)
 *   event    Lala's change when an event deliverable is approved
 * Accepted, it goes into the follower ledger; an episode change also into
 * the Decision Log (/api/v1/pulse-followers). Followers only, never
 * Influence (Evoni, 2026-10-13).
 * Styles: PulseReviewPost.css (prv-epf-*).
 */
import React, { useState } from 'react';
import api from '../../services/api';
import { storyLabel } from '../../lib/storyClock';

/** The causes Review decides (a starting count is decided in Growth). */
export const FOLLOWER_CAUSES = ['episode', 'post', 'event'];

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
  // Changes proposed before Task 3086 also counted the episode's posts.
  if (factors.post_likes != null) lines.push(`${signed(factors.from_posts ?? 0)} from the episode's posts (${fmt(factors.post_likes)} likes)`);
  return lines;
}

const pct = (rate) => `${Math.round(Number(rate) * 1000) / 10}%`;

/** Where the change comes from: { title, detail }. */
export function sourceOf(row) {
  const f = row?.factors || {};
  if (row?.cause === 'post') return { title: `A post by @${f.poster_handle || row.handle || '?'}`, detail: f.post_text ? `“${f.post_text}”` : null };
  if (row?.cause === 'event') return { title: 'An event deliverable', detail: [f.deliverable, f.event_name && `for ${f.event_name}`].filter(Boolean).join(' ') || null };
  const ep = episodeOf(row);
  return { title: ep != null ? `Episode ${ep}` : 'An episode', detail: null };
}

/** Why the change is what it is, a line each, for any cause. */
export function changeLines(row) {
  const f = row?.factors || {};
  if (row?.cause === 'post') {
    const line = `${fmt(f.likes ?? 0)} likes × ${pct(f.rate ?? 0.02)}`;
    return [f.numbers === 'flop' ? `${line}, lost: Evoni made it a flop` : line];
  }
  if (row?.cause === 'event') {
    const pieces = Number(f.pieces) || 1;
    return [`${pieces} ${pieces === 1 ? 'piece' : 'pieces'} × ${pct(f.rate ?? 0.005)} of ${fmt(f.followers)} followers`];
  }
  return episodeLines(f);
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
  const source = sourceOf(row);
  const when = Number.isInteger(row.story_order) ? storyLabel(row.story_order) : null;
  return (
    <li className="prv-epf" data-testid="prv-epf">
      <div className="prv-epf-head">
        <b>{source.title}</b>
        <span className="prv-muted">@{row.handle || 'lala'}{when ? ` · ${when}` : ''}</span>
      </div>
      {source.detail && <p className="prv-muted" data-testid="prv-epf-source">{source.detail}</p>}
      <p className="prv-epf-change" data-testid="prv-epf-change"><b>{signed(row.change)}</b> followers</p>
      <ul className="prv-epf-why" aria-label="Why this change">
        {changeLines(row).map((line) => <li key={line}>{line}</li>)}
        {row.reason && row.cause !== 'episode' && <li key="reason">{row.reason}</li>}
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
      <p className="prv-muted">Proposed from an episode's result, a published post's likes, or an approved event deliverable. Accepted, it changes followers only; an episode change also goes into the Decision Log.</p>
      <ul className="prv-plain">{rows.map((r) => <EpisodeFollowersCard key={r.id} row={r} onChange={onChange} />)}</ul>
    </>
  );
}
