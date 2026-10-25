/**
 * Producer Mode → Release → Next release (Evoni's redesign, 2026-10-05):
 * the next episode out the door with what it still needs, the feed posts
 * that go out with it, the release calendar, and how released episodes went.
 * Props: showId, episodes (the show's list), history (GET /world/:showId/history).
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { nextRelease, goLive, formatWhen, readiness, POST_TIMING, releaseCalendar, releasedResults } from '../../lib/releaseBoard';
import { useReleaseSchedule, whenText, deadlineWarning, formatDay, errorText } from '../../lib/releaseSchedule';
import ReleaseScheduleEditor from './ReleaseScheduleEditor';
import './ReleaseSchedule.css';

const STAT_LABEL = { reputation: 'Reputation', brand_trust: 'Brand Trust', influence: 'Influence', stress: 'Stress' };
const signed = (n) => `${n > 0 ? '+' : ''}${Number(n).toLocaleString()}`;

/** The next episode's full row (the list leaves out its thumbnail, title approval and distribution) and its feed posts. */
function useNextRelease(episodeId) {
  const [full, setFull] = useState(null);
  const [posts, setPosts] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setFull(null);
    setPosts(null);
    if (!episodeId) return undefined;
    api.get(`/api/v1/episodes/${episodeId}`)
      .then((r) => { if (!cancelled) setFull(r.data?.data || r.data || null); })
      .catch((err) => { console.error('[ReleaseBoard] episode load failed:', err); });
    api.get(`/api/v1/feed-posts/episode/${episodeId}`)
      .then((r) => { if (!cancelled) setPosts(r.data?.data || []); })
      .catch((err) => { console.error('[ReleaseBoard] feed posts load failed:', err); if (!cancelled) setPosts([]); });
    return () => { cancelled = true; };
  }, [episodeId]);
  return { full, posts };
}

/**
 * An episode's own date on the calendar: change it by hand, or (when it was
 * set by hand and there is a schedule) hand it back to the schedule.
 */
function EpisodeDate({ ep, row, hasSchedule, onSet }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const n = ep.episode_number ?? '?';
  const set = async (day) => {
    setError(null);
    try { await onSet(ep.id, day); setEditing(false); } catch (err) {
      console.error('[ReleaseBoard] episode date failed:', err);
      setError(errorText(err));
    }
  };
  const hand = row?.source === 'hand';
  return (
    <span className="rsch-ep" data-testid={`release-date-${ep.id}`}>
      {hand && hasSchedule && <span className="rsch-tag">Set by hand</span>}
      {editing ? (
        <input type="date" aria-label={`Episode ${n} release date`} defaultValue={hand ? row.date : (row?.date || '')}
          onChange={(e) => { if (e.target.value) set(e.target.value); }} data-testid={`release-date-input-${ep.id}`} />
      ) : (
        <button type="button" className="rsch-link" onClick={() => setEditing(true)} data-testid={`release-date-change-${ep.id}`}>Change date</button>
      )}
      {hand && hasSchedule && (
        <button type="button" className="rsch-link" onClick={() => set(null)} data-testid={`release-date-back-${ep.id}`}>Back to the schedule</button>
      )}
      {editing && <button type="button" className="rsch-link" onClick={() => setEditing(false)}>Cancel</button>}
      {error && <span className="rsch-error" role="alert">{error}</span>}
    </span>
  );
}

export default function ReleaseBoard({ showId, episodes: listedEpisodes = [], history = [] }) {
  const rs = useReleaseSchedule({ api, showId });
  // Once the schedule loads, its rows are the dates (the list's air_date can
  // be stale after a date is changed here).
  const dated = (e) => {
    const row = e && rs.view ? rs.rowsById[e.id] : null;
    return row ? { ...e, air_date: row.source === 'hand' ? row.date : null } : e;
  };
  const episodes = listedEpisodes.map(dated);
  const listed = nextRelease(episodes);
  const { full, posts } = useNextRelease(listed?.id || null);
  const ep = full && full.id === listed?.id ? dated({ ...listed, ...full }) : listed;
  const row = ep ? rs.rowsById[ep.id] || null : null;
  // The calendar reads the next episode's full row too, so its date matches the card's.
  const calendar = releaseCalendar(episodes.map((e) => (e.id === ep?.id ? ep : e)), 4, rs.rowsById);
  const results = releasedResults(episodes, history);
  const ready = ep ? readiness(ep, posts, row) : [];
  const warning = deadlineWarning(row, ready);
  const hasSchedule = Boolean(rs.view?.schedule);
  const nextWhen = row?.date ? whenText(row) : goLive(ep) ? formatWhen(goLive(ep)) : null;

  return (
    <div className="wa-rel" data-testid="release-board">
      <div className="wa-rel-head">
        <h2>Release</h2>
        <p>Getting finished episodes out the door, and onto The Pulse</p>
      </div>

      <ReleaseScheduleEditor rs={rs} />

      {ep ? (
        <section className="wa-rel-next" data-testid="release-next" aria-label="Next release">
          <div className={`wa-rel-thumb${ep.thumbnail_url ? '' : ' empty'}`}
            style={ep.thumbnail_url ? { backgroundImage: `url(${ep.thumbnail_url})` } : undefined}>
            {!ep.thumbnail_url && <span>No thumbnail yet</span>}
          </div>
          <div className="wa-rel-next-body">
            <span className="wa-rel-eyebrow">Next release</span>
            <h3>Episode {ep.episode_number ?? '?'} · {ep.title || 'Untitled'}</h3>
            <p className="wa-rel-when" data-testid="release-next-when">
              {nextWhen ? (row?.source === 'preview' ? `Not releasing yet · ${nextWhen}` : `Goes live ${nextWhen}`) : 'No go-live date yet'}
            </p>
            {warning && <p className={`rsch-warn is-${warning.tone}`} role="status" data-testid="release-deadline">{warning.text}</p>}
            <ul className="wa-rel-ready">
              {ready.map((r) => (
                <li key={r.key} className={`state-${r.state}`} data-testid={`release-ready-${r.key}`}>
                  <strong>{r.label}</strong>
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>
            <Link className="wa-rel-link" to={`/episodes/${ep.id}?tab=distribution`}>Open its distribution</Link>
          </div>
        </section>
      ) : (
        <section className="wa-rel-next empty" data-testid="release-next">
          <p className="wa-rel-empty">Every episode is released. The next one shows here once it is made.</p>
        </section>
      )}

      <div className="wa-rel-row">
        <section className="wa-rel-card" data-testid="release-posts">
          <div className="wa-rel-card-head">
            <h2>Pulse posts going out with this episode</h2>
            <Link className="wa-rel-link" to={`/shows/${showId}/feed-timeline`}>Open the post timeline</Link>
          </div>
          {!ep ? <p className="wa-rel-empty">No episode to release.</p> : posts == null ? <p className="wa-rel-empty">Loading posts…</p> : posts.length === 0 ? (
            <p className="wa-rel-empty">No Pulse posts for this episode yet. Make them on the post timeline.</p>
          ) : (
            <ul className="wa-rel-posts">
              {posts.map((p) => {
                const who = p.poster_display_name || p.poster_handle || 'Lala';
                return (
                  <li key={p.id} data-testid={`release-post-${p.id}`}>
                    <span className="wa-rel-avatar" aria-hidden="true">{who.replace(/^@/, '').charAt(0).toUpperCase()}</span>
                    <div className="wa-rel-post-body">
                      <p><strong>{who}</strong> {p.content_text}</p>
                      <span>{POST_TIMING[p.timeline_position] || 'With the episode'}</span>
                    </div>
                    <span className={`wa-rel-status ${p.status === 'live' ? 'live' : 'draft'}`}>{p.status === 'live' ? 'Live' : 'Draft'}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {posts?.some((p) => p.status !== 'live') && <p className="wa-rel-note">Drafts wait for approval under Requests in Lala&apos;s posts.</p>}
        </section>

        <section className="wa-rel-card wa-rel-calendar" data-testid="release-calendar">
          <div className="wa-rel-card-head"><h2>Release calendar</h2></div>
          {calendar.length ? (
            <ol>
              {calendar.map(({ ep: e, when, state, row: r }) => {
                // The schedule's day ("Sun, Nov 1" → Nov / 1), a preview faded; else the old date.
                const day = r?.date ? formatDay(r.date).split(/,? /) : null;
                const d = day ? [day[1], day[2]] : when ? formatWhen(when).split(/,? /) : null;
                const text = r?.date ? (r.source === 'preview' ? `Not releasing yet · ${whenText(r)}` : `${state} · ${whenText(r)}`)
                  : when ? `${state} · ${formatWhen(when)}` : state;
                return (
                  <li key={e.id} data-testid={`release-cal-${e.id}`}>
                    <span className={`wa-rel-date${d ? '' : ' none'}${r?.source === 'preview' ? ' is-preview' : ''}`} aria-hidden="true">
                      {d ? <><small>{d[0]}</small>{d[1]}</> : '—'}
                    </span>
                    <span className="wa-rel-cal-text">
                      <Link to={`/episodes/${e.id}`}>Episode {e.episode_number ?? '?'}</Link>
                      <span>{text}</span>
                      {rs.view && <EpisodeDate ep={e} row={r} hasSchedule={hasSchedule} onSet={rs.setEpisodeDate} />}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : <p className="wa-rel-empty">Nothing waiting to be released.</p>}
        </section>
      </div>

      <section className="wa-rel-card" data-testid="release-results">
        <div className="wa-rel-card-head">
          <h2>How released episodes went <span className="wa-rel-sub">Results move Lala&apos;s stats and her Decision Log</span></h2>
        </div>
        {results.length ? (
          <ul className="wa-rel-results">
            {results.map(({ ep: e, tier, coins, stats }) => (
              <li key={e.id} className={tier ? `tier-${tier}` : undefined} data-testid={`release-result-${e.id}`}>
                <span className="wa-rel-tier">{tier ? tier.toUpperCase() : 'Not scored'}</span>
                <span className="wa-rel-result-text">
                  <Link to={`/episodes/${e.id}`}>Episode {e.episode_number ?? '?'} · {e.title || 'Untitled'}</Link>
                  <span>{stats.length ? stats.map(([k, v]) => `${STAT_LABEL[k] || k} ${signed(v)}`).join(' · ') : 'No stat changes recorded'}</span>
                </span>
                {coins !== 0 && <span className="wa-rel-coins">{signed(coins)} coins</span>}
              </li>
            ))}
          </ul>
        ) : <p className="wa-rel-empty">No released episodes yet.</p>}
      </section>
    </div>
  );
}
