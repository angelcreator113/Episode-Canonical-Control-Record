/**
 * Admin › The Pulse › Growth (Task 2957; The Pulse spec §4 "Growth — Lala's
 * follower line across episodes (approved numbers solid, projection dashed),
 * best and worst posts, biggest jumps and their causes … and Influence").
 * Influence (Task 3066; Evoni, 2026-10-13) is shown read only: Lala's stat
 * now and each episode's change; episodes move it, The Pulse never does.
 * The tier is worked out from the count at each moment (Task 3033,
 * lib/pulseAudience), never the stored follower_tier. Reads GET /api/v1/pulse-followers/growth; her starting count, when
 * it is still proposed, is confirmed here (PUT /pulse-followers/:id/accept),
 * and with none yet, starting counts are proposed (POST /pulse-followers/starts).
 * Styles: AdminPanel.css (pulse-growth-*).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../services/api';
import { tierLabel } from '../../lib/pulseAudience';
import { atHandle } from '../../pages/feed/feedConstants';

const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-US') : '—');
const signed = (n) => `${Number(n) > 0 ? '+' : Number(n) < 0 ? '−' : ''}${fmt(Math.abs(Number(n)))}`;
const REVIEW = '/admin?tab=pulse&sub=review';

/** Lala's Influence, read only (Task 3066): the value now out of the scale, and each episode's change. */
export function InfluenceCard({ influence }) {
  const rows = influence?.by_episode || [];
  const now = influence?.now;
  return (
    <section className="pulse-growth-card" aria-label="Influence" data-testid="pulse-growth-influence">
      <h3>Influence</h3>
      {now === null || now === undefined
        ? <p className="pulse-growth-muted">No Influence for Lala yet: it starts with her first completed episode.</p>
        : <p className="pulse-growth-influence-now"><b>{fmt(now)}</b> of {fmt(influence.scale || 10)}</p>}
      {rows.length > 0 && (
        <ol className="pulse-growth-list" data-testid="pulse-growth-influence-episodes">
          {rows.map((r) => (
            <li key={r.episode_id}>
              <span className="pulse-growth-num">{r.change === 0 ? '±0' : signed(r.change)}</span>
              <span className="pulse-growth-text">Episode {r.episode_number ?? '?'}{r.after !== null && r.after !== undefined ? ` · ${fmt(r.after)} after` : ''}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="pulse-growth-muted">Read only: completing an episode changes Influence; The Pulse does not.</p>
    </section>
  );
}

/** A short axis label for a story moment, so the axis fits a phone: "Ep 2", "+1 day", "+1 week". */
export function shortMoment(row) {
  if (row.cause === 'start' || !Number.isInteger(row.story_order) || row.story_order < 10) return 'Start';
  const ep = Math.floor(row.story_order / 10);
  const phase = row.story_order % 10;
  if (phase === 8) return '+1 day';
  if (phase === 9) return '+1 week';
  if (phase === 7) return `Ep ${ep}`;
  return `Ep ${ep} ·`;
}

/**
 * The chart's points: each accepted change's count (solid), then the
 * proposed episode changes (dashed), joined at the latest accepted point.
 * `short` labels the axis; `label` (the full story moment) the tooltip.
 */
export function chartPoints(line = [], projection = []) {
  const points = line.map((r) => ({ label: r.label, short: shortMoment(r), count: r.count }));
  const projected = projection.filter((r) => r.count != null);
  if (points.length && projected.length) {
    points[points.length - 1] = { ...points[points.length - 1], projected: points[points.length - 1].count };
    for (const r of projected) points.push({ label: r.label, short: shortMoment(r), projected: r.count });
  }
  return points;
}

/** Where a change came from, in words. */
export function causeText(row) {
  if (row.cause === 'episode') return `Episode ${row.episode_number ?? '?'} result`;
  if (row.cause === 'override') return row.reason ? `Set by hand: ${row.reason}` : 'Set by hand';
  if (row.cause === 'post') return 'A post';
  if (row.cause === 'event') return 'An event';
  return row.cause;
}

function StartCard({ start, showId, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const act = async (label, call) => {
    setBusy(true); setError(null);
    try { await call(); onChange?.(); }
    catch (err) { console.error(`[PulseGrowth] ${label} failed:`, err.response?.status || err.message); setError(err.response?.data?.error || `${label} failed.`); }
    finally { setBusy(false); }
  };
  return (
    <div className="pulse-growth-start" data-testid="pulse-growth-start">
      {!start && (
        <>
          <p>Lala has no starting follower count yet. Propose one for every character from their estimate or tier; Lala's waits for you.</p>
          <button type="button" className="pulse-growth-btn" disabled={busy}
            onClick={() => act('Propose starting counts', () => api.post('/api/v1/pulse-followers/starts', { show_id: showId }))}>Propose starting counts</button>
        </>
      )}
      {start?.status === 'proposed' && (
        <>
          <p>Lala's starting count is proposed at <b>{fmt(start.count)}</b>. {start.reason}</p>
          <button type="button" className="pulse-growth-btn" disabled={busy}
            onClick={() => act('Confirm', () => api.put(`/api/v1/pulse-followers/${start.id}/accept`))}>Confirm {fmt(start.count)}</button>
        </>
      )}
      {start?.status === 'accepted' && <p>Started at <b>{fmt(start.count)}</b> followers.</p>}
      {error && <p className="pulse-growth-error" role="alert">{error}</p>}
    </div>
  );
}

/** The follower line; chartWidth renders a fixed width (tests), else it fills its box. */
export function GrowthChart({ points, chartWidth }) {
  const chart = (width) => (
    <LineChart data={points} width={width} height={240} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
      <CartesianGrid className="pulse-growth-grid" vertical={false} />
      <XAxis dataKey="short" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={48} interval="preserveStartEnd" />
      <YAxis tick={{ fontSize: 11 }} width={56} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
      <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ''} formatter={(v, name) => [fmt(v), name === 'projected' ? 'Proposed' : 'Followers']} />
      <Line className="pulse-growth-accepted" type="linear" dataKey="count" name="count" connectNulls={false} isAnimationActive={false} />
      <Line className="pulse-growth-projection" type="linear" dataKey="projected" name="projected" strokeDasharray="6 4" connectNulls isAnimationActive={false} />
    </LineChart>
  );
  return (
    <div className="pulse-growth-chart" aria-hidden="true" data-testid="pulse-growth-chart">
      {chartWidth ? chart(chartWidth) : <ResponsiveContainer width="100%" height={240}>{chart()}</ResponsiveContainer>}
    </div>
  );
}

function PostList({ title, posts, testId }) {
  return (
    <section className="pulse-growth-card" aria-label={title} data-testid={testId}>
      <h3>{title}</h3>
      {posts.length === 0 ? <p className="pulse-growth-muted">No decided numbers yet.</p> : (
        <ol className="pulse-growth-list">
          {posts.map((p) => (
            <li key={p.post_id}>
              <span className="pulse-growth-num">{fmt(p.likes)} likes</span>
              <span className="pulse-growth-text">{p.content_text || 'A photo'}</span>
              {(p.status === 'viral' || p.status === 'flop') && <span className="pulse-growth-tag">{p.status === 'viral' ? 'Made viral' : 'Made a flop'}</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function PulseGrowth({ showId, chartWidth }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try {
      const res = await api.get(`/api/v1/pulse-followers/growth?show_id=${encodeURIComponent(showId)}`);
      setData(res.data); setError(null);
    } catch (err) {
      console.error('[PulseGrowth] growth could not be read:', err.response?.status || err.message);
      setError('Growth could not be loaded.');
    }
  }, [showId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <p className="pulse-growth-error" role="alert">{error}</p>;
  if (!data) return <p className="pulse-growth-muted">Loading Growth…</p>;
  if (!data.profile) return <p className="pulse-growth-muted" data-testid="pulse-growth-empty">Lala has no Feed profile yet, so there is no follower line to show.</p>;

  const line = data.line || [];
  const projection = data.projection || [];
  const latest = line.length ? line[line.length - 1] : null;
  const points = chartPoints(line, projection);
  const tier = tierLabel(latest?.count);

  return (
    <div className="pulse-growth" data-testid="pulse-growth">
      <p className="pulse-growth-summary" data-testid="pulse-growth-summary">
        {latest
          ? <>{atHandle(data.profile.handle)} has <b>{fmt(latest.count)}</b> followers{tier ? ` · ${tier}` : ''}{data.start?.status === 'accepted' && line.length > 1 ? `, ${signed(latest.count - data.start.count)} since her start` : ''}.</>
          : <>No accepted follower count for {atHandle(data.profile.handle)} yet.</>}
        {projection.length > 0 && <> {projection.length === 1 ? 'One episode change waits' : `${projection.length} episode changes wait`} in <Link to={REVIEW}>Review</Link>.</>}
      </p>
      <StartCard start={data.start} showId={showId} onChange={load} />
      {points.length > 0 && (
        <section className="pulse-growth-card" aria-label="Follower line">
          <h3>Follower line</h3>
          <GrowthChart points={points} chartWidth={chartWidth} />
          <p className="pulse-growth-key"><span className="pulse-growth-key-solid" aria-hidden="true" /> Accepted <span className="pulse-growth-key-dashed" aria-hidden="true" /> Proposed, waiting in Review</p>
          <ol className="pulse-growth-sr" data-testid="pulse-growth-points">
            {line.map((r) => <li key={r.id}>{r.label}: {fmt(r.count)} followers{tierLabel(r.count) ? ` (${tierLabel(r.count)})` : ''}</li>)}
            {projection.map((r) => <li key={r.id}>{r.label}: {fmt(r.count)} followers{tierLabel(r.count) ? ` (${tierLabel(r.count)})` : ''}, proposed</li>)}
          </ol>
        </section>
      )}
      <InfluenceCard influence={data.influence} />
      <div className="pulse-growth-columns">
        <PostList title="Best posts" posts={data.best || []} testId="pulse-growth-best" />
        <PostList title="Worst posts" posts={data.worst || []} testId="pulse-growth-worst" />
      </div>
      <section className="pulse-growth-card" aria-label="Biggest jumps" data-testid="pulse-growth-jumps">
        <h3>Biggest jumps</h3>
        {(data.jumps || []).length === 0 ? <p className="pulse-growth-muted">No changes since her start yet.</p> : (
          <ol className="pulse-growth-list">
            {data.jumps.map((j) => (
              <li key={j.id}>
                <span className="pulse-growth-num">{signed(j.change)}</span>
                <span className="pulse-growth-text">{j.label} · {causeText(j)}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="pulse-growth-muted">Changes are proposed and decided in <Link to={REVIEW}>Review</Link>.</p>
      </section>
    </div>
  );
}
