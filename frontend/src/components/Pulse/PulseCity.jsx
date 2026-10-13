/**
 * The Pulse › Dream Cities (Task 2987; The Pulse spec §3 "City feeds: each
 * Dream City has its own feed and local trends"). With no city chosen, the
 * five cities to pick from; with one, its name in its colours, its local
 * trends and its feed. Both read at the page's story moment, so a later
 * episode's posts and trends never show early:
 *   GET /api/v1/feed-posts?show_id=&city=&at=&status=live&with=comments
 *   GET /api/v1/feed-enhanced/:showId/trending?city=&at=
 * A post's city is its poster's (utils/feedCities.cityPostsSql).
 * Styles: SocialMediaPage.css (pl-cityfeed-*).
 */
import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import api from '../../services/api';
import PulsePost from './PulsePost';
import { TrendingCard, cityVars } from './PulseSides';

const PAGE = 30;

export default function PulseCity({ show, cities, cityKey, viewAt, onCity }) {
  const city = cities.find((c) => c.key === cityKey) || null;
  const [posts, setPosts] = useState(null);
  const [trends, setTrends] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!show?.id || !city) return undefined;
    let alive = true;
    setPosts(null);
    setError(null);
    const qs = new URLSearchParams({ show_id: show.id, city: city.key, status: 'live', with: 'comments', limit: String(PAGE) });
    if (viewAt) qs.set('at', viewAt);
    const trendQs = new URLSearchParams({ city: city.key });
    if (viewAt) trendQs.set('at', viewAt);
    (async () => {
      const [feed, trend] = await Promise.all([
        api.get(`/api/v1/feed-posts?${qs}`).catch((err) => {
          console.error('[ThePulse] the city feed could not be read:', err.response?.status || err.message);
          return null;
        }),
        api.get(`/api/v1/feed-enhanced/${encodeURIComponent(show.id)}/trending?${trendQs}`).catch((err) => {
          console.error('[ThePulse] the city trends could not be read:', err.response?.status || err.message);
          return null;
        }),
      ]);
      if (!alive) return;
      if (!feed) setError(`${city.name} could not be loaded.`);
      setPosts(Array.isArray(feed?.data?.data) ? feed.data.data : []);
      setTrends(Array.isArray(trend?.data?.data) ? trend.data.data : []);
    })();
    return () => { alive = false; };
  }, [show?.id, city, viewAt]);

  if (!cities.length) return <p className="pl-empty">Loading the Dream Cities…</p>;

  if (!city) {
    return (
      <section className="pl-card" aria-labelledby="pl-cityfeed-pick" data-testid="pl-cityfeed-pick">
        <h2 id="pl-cityfeed-pick" className="pl-card-title">Dream Cities</h2>
        <ul className="pl-cities">
          {cities.map((c) => (
            <li key={c.key} className="pl-city" style={cityVars(c)}>
              <span className="pl-city-text">
                <button type="button" className="pl-city-open" onClick={() => onCity(c.key)}><span className="pl-city-dot" aria-hidden="true" />{c.name}</button>
                {c.subtitle && <small>{c.subtitle}</small>}
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="pl-cityfeed" data-testid="pl-cityfeed">
      <header className="pl-cityfeed-head" style={cityVars(city)}>
        <button type="button" className="pl-cityfeed-back" onClick={() => onCity(null)}><ArrowLeft size={18} aria-hidden="true" /> Dream Cities</button>
        <h2 className="pl-cityfeed-name"><span className="pl-city-dot" aria-hidden="true" />{city.name}</h2>
        {city.subtitle && <p className="pl-cityfeed-sub">{city.subtitle}</p>}
      </header>
      <TrendingCard topics={trends} title={`Trending in ${city.name}`} />
      {error && <p className="pl-error" role="alert">{error}</p>}
      {!posts && !error && <p className="pl-quiet">Loading…</p>}
      {posts && posts.length === 0 && !error && <p className="pl-empty" data-testid="pl-cityfeed-empty">Nothing posted in {city.name} yet.</p>}
      {(posts || []).map((p) => <PulsePost key={p.id} post={p} onCity={onCity} />)}
    </div>
  );
}
