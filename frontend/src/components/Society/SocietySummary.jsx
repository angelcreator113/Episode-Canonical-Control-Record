/**
 * SocietySummary — the Society tab's front page in the LalaVerse hub, to
 * Evoni's mock (2026-10-06): who is in the Feed (the ten profile
 * archetypes, counted), what the Feed is talking about, where Lala stands
 * on the career ladder, and the legends. The Social Systems page's own
 * tabs (Archetypes, Legends & Society, Social Rules, Trends) stay below.
 *
 * Real data or a plain line (lib/societySummary): counts from the
 * LalaVerse profiles, trends from the show's Feed posts (no direction:
 * the data has none), Lala's tier from her reputation.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import useActiveShow from '../../hooks/useActiveShow';
import { archetypeCounts, trendBars, careerLadder } from '../../lib/societySummary';
import './SocietySummary.css';

const plural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export default function SocietySummary({ legendGroups = [], onOpen }) {
  const { show, loaded } = useActiveShow();
  const [data, setData] = useState(null);

  useEffect(() => {
    // Wait for the active show: the trends and Lala's tier are the show's.
    if (!loaded) return undefined;
    let live = true;
    setData(null);
    const read = (url, label) => api.get(url).then((r) => r.data).catch((err) => {
      console.error(`[Society] the ${label} could not be read:`, err?.response?.status || err?.message);
      return null;
    });
    Promise.all([
      read('/api/v1/social-profiles/analytics/composition?feed_layer=lalaverse', 'Feed profiles'),
      show?.id ? read(`/api/v1/feed-enhanced/${show.id}/trending`, 'trends') : Promise.resolve(null),
      show?.id ? read(`/api/v1/characters/lala/state?show_id=${encodeURIComponent(show.id)}`, "Lala's state") : Promise.resolve(null),
    ]).then(([composition, trending, lala]) => {
      if (!live) return;
      setData({
        archetypes: composition ? archetypeCounts(composition) : null,
        trends: trending ? trendBars(trending.data) : null,
        reputation: lala?.state?.reputation ?? null,
        stateRead: Boolean(lala),
      });
    });
    return () => { live = false; };
  }, [loaded, show?.id]);

  const ladder = careerLadder(data?.reputation);
  const roles = legendGroups.reduce((n, g) => n + (g.roles?.length || 0), 0);
  const feedTab = show?.id ? `/shows/${show.id}/world?tab=feed` : '/feed';

  return (
    <div className="soc" data-testid="society-summary">
      <div className="soc-col">
        <section className="soc-card" aria-labelledby="soc-arch-heading">
          <div className="soc-head">
            <h2 id="soc-arch-heading" className="soc-title">Archetypes in the Feed</h2>
            {data?.archetypes && <span className="soc-sub">{plural(data.archetypes.total, 'LalaVerse profile')}</span>}
            <Link className="soc-link" to="/feed?tab=people&layer=lalaverse">See the people →</Link>
          </div>
          {!data ? <p className="soc-note">Counting the profiles…</p>
            : !data.archetypes ? <p className="soc-note">The Feed profiles could not be read just now.</p>
            : data.archetypes.total === 0 ? <p className="soc-note" data-testid="soc-arch-empty">No LalaVerse profiles yet. Generate the Feed and each profile lands in one of these ten.</p>
            : (
              <ul className="soc-arch" data-testid="soc-archetypes">
                {data.archetypes.rows.map((a, i) => (
                  <li key={a.key} className={`soc-arch-tile soc-tone-${i % 5}${a.count === 0 ? ' is-empty' : ''}`}>
                    <span className="soc-arch-count">{a.count.toLocaleString()}</span>
                    <span className="soc-arch-label">{a.label}</span>
                    <span className="soc-arch-bar" aria-hidden="true"><span style={{ width: `${data.archetypes.total ? Math.round((a.count / data.archetypes.total) * 100) : 0}%` }} /></span>
                  </li>
                ))}
              </ul>
            )}
          {data?.archetypes?.other > 0 && <p className="soc-note">{plural(data.archetypes.other, 'profile')} carry an archetype outside the ten.</p>}
        </section>

        <section className="soc-card" aria-labelledby="soc-trend-heading">
          <div className="soc-head">
            <h2 id="soc-trend-heading" className="soc-title">Trending now</h2>
            <Link className="soc-btn" to={feedTab}>Post about a trend</Link>
          </div>
          {!data ? <p className="soc-note">Reading the Feed…</p>
            : !data.trends ? <p className="soc-note">{show?.id ? "The Feed's trends could not be read just now." : 'Choose a show to see what its Feed is talking about.'}</p>
            : data.trends.length === 0 ? <p className="soc-note" data-testid="soc-trends-empty">Nothing is trending yet: trends come from the hashtags and topics of the show's Feed posts.</p>
            : (
              <ul className="soc-trends" data-testid="soc-trends">
                {data.trends.map((t) => (
                  <li key={t.topic} className="soc-trend">
                    <span className="soc-trend-topic">{t.topic}</span>
                    <span className="soc-trend-bar" aria-hidden="true"><span style={{ width: `${Math.round(t.share * 100)}%` }} /></span>
                    <span className="soc-trend-posts">{plural(t.posts, 'post')}</span>
                  </li>
                ))}
              </ul>
            )}
          <p className="soc-foot">Ranked by how many of the show's Feed posts carry them. The Feed counts posts and reactions, not whether a trend is rising or fading.</p>
        </section>
      </div>

      <div className="soc-col">
        <section className="soc-card soc-ladder-card" aria-labelledby="soc-ladder-heading">
          <h2 id="soc-ladder-heading" className="soc-title">The career ladder</h2>
          <ol className="soc-ladder" data-testid="soc-ladder">
            {ladder.map((t) => (
              <li key={t.tier} className={`soc-rung${t.here ? ' is-here' : ''}`}>
                <span className="soc-rung-num">{t.tier}</span>
                <span className="soc-rung-label">{t.label}<span className="soc-rung-rep"> · reputation {t.reputation}</span></span>
                {t.here && <span className="soc-here">Lala is here</span>}
              </li>
            ))}
          </ol>
          {data && !ladder.some((t) => t.here) && (
            <p className="soc-note">{data.stateRead ? "Lala's reputation isn't set for this show yet." : "Lala's reputation could not be read just now."}</p>
          )}
          {data?.reputation != null && <p className="soc-foot">Her reputation is {data.reputation}. Events gate on these tiers.</p>}
        </section>

        <section className="soc-card" aria-labelledby="soc-legend-heading">
          <h2 id="soc-legend-heading" className="soc-title">Legends</h2>
          <p className="soc-note">
            The names everyone in the LalaVerse knows: {plural(roles, 'legendary role')} in {plural(legendGroups.length, 'group')}. All are placeholders; no role is linked to a character yet.
          </p>
          <ul className="soc-legends" data-testid="soc-legends">
            {legendGroups.map((g) => (
              <li key={g.group}>
                <button type="button" className="soc-legend" onClick={() => onOpen?.('legends', g.group)}>
                  {g.group}<span className="soc-legend-n">{g.roles?.length || 0}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
