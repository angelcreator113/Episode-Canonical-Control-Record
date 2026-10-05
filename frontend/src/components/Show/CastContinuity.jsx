/**
 * Producer Mode → Cast & Continuity → Lala's State & Continuity (Evoni's
 * redesign, 2026-10-05): Lala's stats as bars with what last moved each,
 * the decision log of her episode results beside them, the story threads as
 * a strip of episode squares, and the cast. The stat editor's state stays in
 * WorldAdmin, which owns the save.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import {
  STAT_ROWS, lastChange, describeChange, afterEpisode, decisionEntries,
  currentEpisodeNumber, threadSquares, stripSpan, threadPulse,
} from '../../lib/castContinuity';

const STAT_SHORT = { coins: 'coins', reputation: 'rep', brand_trust: 'trust', influence: 'influence', stress: 'stress' };
const signed = (n) => `${n > 0 ? '+' : ''}${Number(n).toLocaleString()}`;

/**
 * Lala's card. edit: { editing, form, setForm, open, cancel, save, saving }.
 * coinGoal: the next financial goal's threshold, the coin bar's end (no bar without one).
 */
export function LalaStatsCard({ charState, history = [], episodes = [], coinGoal = null, edit }) {
  const stats = charState?.state || null;
  const after = afterEpisode(history);
  const d = charState?.defaults;
  const defaults = d
    ? `${(d.coins ?? 0).toLocaleString()} coins, ${d.reputation ?? 0} rep, ${d.brand_trust ?? 0} trust, ${d.influence ?? 0} inf, ${d.stress ?? 0} stress`
    : '500 coins, 1 rep, 1 trust, 1 inf, 0 stress';
  return (
    <section className="wa-cc-card wa-cc-lala" data-testid="cc-lala">
      <div className="wa-cc-lala-head">
        <span className="wa-cc-avatar lala" aria-hidden="true">L</span>
        <div className="wa-cc-lala-name">
          <h2>Lala</h2>
          <p>Main character{after != null ? ` · After Episode ${after}` : ''}</p>
        </div>
        {!edit.editing ? (
          <button type="button" className="wa-cc-link-btn" onClick={edit.open} disabled={!charState}>Edit stats</button>
        ) : (
          <div className="wa-cc-edit-actions">
            <button type="button" className="wa-cc-secondary" onClick={edit.cancel}>Cancel</button>
            <button type="button" className="wa-cc-primary" onClick={edit.save} disabled={edit.saving}>{edit.saving ? 'Saving…' : 'Save'}</button>
          </div>
        )}
      </div>

      {stats ? (
        <ul className="wa-cc-stats">
          {STAT_ROWS.filter((row) => row.key in stats).map(({ key, label }) => {
            const val = Number(stats[key]) || 0;
            const isCoin = key === 'coins';
            const max = isCoin ? coinGoal : 10;
            const change = lastChange(history, key, episodes);
            const alarm = (key === 'stress' && val >= 5) || (isCoin && val < 0);
            return (
              <li key={key} className={`wa-cc-stat stat-${key}${alarm ? ' alarm' : ''}`} data-testid={`cc-stat-${key}`}>
                <div className="wa-cc-stat-top">
                  <span className="wa-cc-stat-label">{label}</span>
                  {edit.editing ? (
                    // Coins take any integer (the backend stores negatives); the rest 0–10, the backend's clamp.
                    <input type="number" className="wa-cc-stat-input" aria-label={label}
                      value={edit.form[key] ?? val}
                      onChange={(e) => edit.setForm((p) => ({ ...p, [key]: parseInt(e.target.value, 10) }))}
                      {...(isCoin ? {} : { min: 0, max: 10 })} />
                  ) : (
                    <span className="wa-cc-stat-value">
                      {change && <span className="wa-cc-stat-delta">{signed(change.delta)}</span>}
                      <strong>{val.toLocaleString()}</strong>
                    </span>
                  )}
                </div>
                {max ? (
                  <div className="wa-cc-bar" role="presentation">
                    <span style={{ width: `${Math.max(0, Math.min(100, (val / max) * 100))}%` }} />
                  </div>
                ) : (
                  <p className="wa-cc-stat-note">No active goal to measure coins against</p>
                )}
                <p className="wa-cc-stat-note">{change ? `Last change: ${describeChange(change)}` : 'No change yet'}</p>
              </li>
            );
          })}
        </ul>
      ) : <p className="wa-cc-empty">No stats yet. Evaluating an episode seeds her starting stats.</p>}

      <details className="wa-cc-rules">
        <summary>Character rules</summary>
        <dl>
          {[
            ['Voice activation', 'Required'],
            ['Idle behaviors', 'Wave, mirror glance, inspect'],
            ['Default stats', defaults],
            ['Fail behavior', 'Forced smile, softer voice, stress anim'],
          ].map(([l, v]) => <div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}
        </dl>
      </details>
    </section>
  );
}

/** The latest episode results: what each did to Lala. */
export function DecisionLogCard({ history = [], episodes = [] }) {
  const entries = decisionEntries(history, episodes);
  return (
    <section className="wa-cc-card wa-cc-log" data-testid="cc-decision-log">
      <div className="wa-cc-card-head">
        <h2>Decision Log</h2>
        {history.length > 0 && <a className="wa-cc-link" href="#cc-ledger">See all</a>}
      </div>
      {entries.length ? (
        <ol className="wa-cc-timeline">
          {entries.map((e) => (
            <li key={e.id}>
              <span className="wa-cc-when">Episode {e.episodeNumber ?? '?'}{e.tier ? ` · Result: ${e.tier.toUpperCase()}` : ''}</span>
              <Link className="wa-cc-what" to={`/episodes/${e.episodeId}`}>{e.title}</Link>
              {e.notes && <p className="wa-cc-why">{e.notes}</p>}
              {e.deltas.length > 0 && (
                <ul className="wa-cc-chips">
                  {e.deltas.map(([k, v]) => <li key={k}>{signed(v)} {STAT_SHORT[k] || k.replace(/_/g, ' ')}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ol>
      ) : <p className="wa-cc-empty">No episode results yet. Each accepted episode adds what it did to Lala.</p>}
    </section>
  );
}

/** The season's story threads, one row each: a square per episode, and when it last came up. */
export function StoryThreadsStrip({ showId, episodes = [] }) {
  const [threads, setThreads] = useState(null);
  useEffect(() => {
    let cancelled = false;
    api.get(`/api/v1/world/${showId}/season/threads`)
      .then((r) => { if (!cancelled) setThreads(r.data?.threads || []); })
      .catch((err) => { console.error('[CastContinuity] story threads load failed:', err); if (!cancelled) setThreads([]); });
    return () => { cancelled = true; };
  }, [showId]);
  const current = currentEpisodeNumber(episodes);
  const span = stripSpan(threads, current);
  return (
    <section className="wa-cc-card wa-cc-threads" data-testid="cc-threads">
      <div className="wa-cc-card-head">
        <h2>Story threads <span className="wa-cc-sub">What the season is carrying, and when it last came up</span></h2>
        <Link className="wa-cc-link" to={`/shows/${showId}/world?tab=season`}>All threads</Link>
      </div>
      {threads == null ? <p className="wa-cc-empty">Loading threads…</p> : threads.length === 0 ? (
        <p className="wa-cc-empty">No story threads yet. Create them in Episodes → Season Plan.</p>
      ) : (
        <>
          <ul className="wa-cc-thread-list">
            {threads.map((t) => {
              const pulse = threadPulse(t, episodes, current);
              return (
                <li key={t.id} className={`wa-cc-thread${pulse.quiet ? ' quiet' : ''}${t.status === 'closed' ? ' closed' : ''}`} data-testid={`cc-thread-${t.id}`}>
                  <div className="wa-cc-thread-name">
                    <strong>{t.title}</strong>
                    {t.description && <span>{t.description}</span>}
                  </div>
                  <ol className="wa-cc-squares" aria-label={`Episodes carrying ${t.title}`}>
                    {threadSquares(t, span, current).map((sq) => (
                      <li key={sq.slot} className={`${sq.on ? 'on' : ''}${sq.ahead ? ' ahead' : ''}`.trim() || undefined}
                        title={`Episode ${sq.slot}${sq.on ? ': carries the thread' : ''}`} />
                    ))}
                  </ol>
                  <span className="wa-cc-pulse">{pulse.text}</span>
                </li>
              );
            })}
          </ul>
          <p className="wa-cc-legend">Each square is an episode. Filled means its slot carries the thread; faded squares are still ahead.</p>
        </>
      )}
    </section>
  );
}

/** The show's cast: Lala and the narrator. */
export function CastRow() {
  return (
    <section className="wa-cc-card wa-cc-cast" data-testid="cc-cast">
      <div className="wa-cc-card-head">
        <h2>Cast in this show <span className="wa-cc-sub">2 people</span></h2>
        <Link className="wa-cc-link" to="/character-registry">Open Character Registry</Link>
      </div>
      <ul className="wa-cc-people">
        <li>
          <span className="wa-cc-avatar lala" aria-hidden="true">L</span>
          <strong>Lala</strong>
          <span>Lead · AI avatar</span>
          <em>In every episode</em>
        </li>
        <li>
          <span className="wa-cc-avatar prime" aria-hidden="true">P</span>
          <strong>JustAWomanInHerPrime</strong>
          <span>Creator narrator</span>
          <em>Narrator + gameplay driver</em>
          <details className="wa-cc-rules">
            <summary>Voice</summary>
            <dl>
              {[
                ['Voice', 'Warm, strategic, luxury aspirational'],
                ['Aliases', 'Prime:, Me:, You:'],
                ['CTA style', 'Confident, community-focused'],
              ].map(([l, v]) => <div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}
            </dl>
          </details>
        </li>
      </ul>
    </section>
  );
}
