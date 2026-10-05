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

export default function ReleaseBoard({ showId, episodes = [], history = [] }) {
  const listed = nextRelease(episodes);
  const { full, posts } = useNextRelease(listed?.id || null);
  const ep = full && full.id === listed?.id ? { ...listed, ...full } : listed;
  // The calendar reads the next episode's full row too, so its date matches the card's.
  const calendar = releaseCalendar(episodes.map((e) => (e.id === ep?.id ? ep : e)));
  const results = releasedResults(episodes, history);

  return (
    <div className="wa-rel" data-testid="release-board">
      <div className="wa-rel-head">
        <h2>Release</h2>
        <p>Getting finished episodes out the door, and onto Lala&apos;s feed</p>
      </div>

      {ep ? (
        <section className="wa-rel-next" data-testid="release-next" aria-label="Next release">
          <div className={`wa-rel-thumb${ep.thumbnail_url ? '' : ' empty'}`}
            style={ep.thumbnail_url ? { backgroundImage: `url(${ep.thumbnail_url})` } : undefined}>
            {!ep.thumbnail_url && <span>No thumbnail yet</span>}
          </div>
          <div className="wa-rel-next-body">
            <span className="wa-rel-eyebrow">Next release</span>
            <h3>Episode {ep.episode_number ?? '?'} · {ep.title || 'Untitled'}</h3>
            <p className="wa-rel-when">{goLive(ep) ? `Goes live ${formatWhen(goLive(ep))}` : 'No go-live date yet'}</p>
            <ul className="wa-rel-ready">
              {readiness(ep, posts).map((r) => (
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
            <h2>Feed posts going out with this episode</h2>
            <Link className="wa-rel-link" to={`/shows/${showId}/feed-timeline`}>Open the feed timeline</Link>
          </div>
          {!ep ? <p className="wa-rel-empty">No episode to release.</p> : posts == null ? <p className="wa-rel-empty">Loading posts…</p> : posts.length === 0 ? (
            <p className="wa-rel-empty">No feed posts for this episode yet. Make them on the feed timeline.</p>
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
          {posts?.some((p) => p.status !== 'live') && <p className="wa-rel-note">Drafts go live when the episode is published.</p>}
        </section>

        <section className="wa-rel-card wa-rel-calendar" data-testid="release-calendar">
          <div className="wa-rel-card-head"><h2>Release calendar</h2></div>
          {calendar.length ? (
            <ol>
              {calendar.map(({ ep: e, when, state }) => {
                const d = when ? formatWhen(when).split(/,? /) : null;
                return (
                  <li key={e.id}>
                    <span className={`wa-rel-date${when ? '' : ' none'}`} aria-hidden="true">
                      {d ? <><small>{d[0]}</small>{d[1]}</> : '—'}
                    </span>
                    <span className="wa-rel-cal-text">
                      <Link to={`/episodes/${e.id}`}>Episode {e.episode_number ?? '?'}</Link>
                      <span>{when ? `${state} · ${formatWhen(when)}` : state}</span>
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
