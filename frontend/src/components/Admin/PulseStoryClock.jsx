/**
 * Admin › The Pulse › Story clock (Task 2941; The Pulse spec §4 "Story clock
 * scrubber": pick any story moment and see The Pulse exactly as it was then;
 * Evoni, 2026-10-11: a sub-tab here). A slider and steppers over the
 * backstory and every numbered episode's moments (Before, Announced,
 * Invitation sent, Lala arrives, During, After, the day after, a week after),
 * starting at the present. The preview is Lala's view at that moment: the
 * same reads The Pulse makes with ?at=, so the story clock and reveals apply
 * (hidden items absent, teasers in place of their images). "Open in The Pulse" goes to
 * /pulse?at=<order>, which only admins can use.
 * Styles: styles/AdminPanel.css (pulse-clock-*) and, for the preview,
 * pages/SocialMediaPage.css (pl-*).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { useReveals } from './PulseRevealContext';
import { storyMoments, presentOrder } from '../../lib/storyClock';
import { loadPulseCities } from '../../lib/pulseCities';
import PulsePost from '../Pulse/PulsePost';
import { pulseFeedUrl } from '../../lib/pulsePosts';
import { CitiesCard, UpcomingCard, LatestFitCard } from '../Pulse/PulseSides';
import { FirstLook } from '../Pulse/PulseReveal';
import '../../pages/SocialMediaPage.css';

const PREVIEW_POSTS = 20;
const list = (r) => (Array.isArray(r?.data?.data) ? r.data.data : []);

/** Lala's view of The Pulse at `at`: posts, events, the latest fit, the cover, and the cities as she sees them then. */
function usePulseAt(showId, at) {
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!showId || !Number.isInteger(at)) return undefined;
    let alive = true;
    const id = encodeURIComponent(showId);
    setError(null);
    const safe = async (p, label) => {
      try { return await p; } catch (err) { console.error(`[StoryClock] ${label} could not be read:`, err.response?.status || err.message); return null; }
    };
    (async () => {
      const [posts, side, fit, cover, cityView] = await Promise.all([
        safe(api.get(pulseFeedUrl(showId, at, PREVIEW_POSTS)), 'posts'),
        safe(api.get(`/api/v1/social-profiles/lala/sidebar?show_id=${id}&at=${at}`), 'events'),
        safe(api.get(`/api/v1/pulse-fits/latest?show_id=${id}&at=${at}`), 'latest fit'),
        safe(api.get(`/api/v1/shows/${id}/pulse-cover?at=${at}`), 'cover'),
        safe(loadPulseCities(showId, String(at)), 'cities'),
      ]);
      if (!alive) return;
      if (!posts) setError('The Pulse could not be read at this moment.');
      setView({
        at,
        posts: list(posts),
        total: posts?.data?.total ?? list(posts).length,
        events: Array.isArray(side?.data?.data?.upcoming) ? side.data.data.upcoming : [],
        fit: fit?.data?.latest || null,
        cover: cover?.data?.cover || null,
        cities: cityView?.cities || [],
        cityStates: cityView?.states || {},
      });
    })();
    return () => { alive = false; };
  }, [showId, at]);
  return { view, error };
}

export default function PulseStoryClock() {
  const ctx = useReveals();
  const showId = ctx?.showId;
  const episodes = ctx?.episodes || [];
  const moments = useMemo(() => storyMoments(episodes), [episodes]);
  const present = useMemo(() => presentOrder(episodes), [episodes]);
  const [index, setIndex] = useState(null);

  // Starts at the present (or the nearest moment before it) once the episodes are in.
  const presentIndex = useMemo(() => {
    let best = 0;
    moments.forEach((m, i) => { if (m.order <= present) best = i; });
    return best;
  }, [moments, present]);
  const current = moments[index ?? presentIndex] || moments[0];
  const at = current?.order;
  const { view, error } = usePulseAt(showId, at);


  if (!ctx) return null;
  const i = index ?? presentIndex;
  const step = (d) => setIndex(Math.min(moments.length - 1, Math.max(0, i + d)));
  const loading = !view || view.at !== at;

  return (
    <section className="pulse-clock" aria-labelledby="pulse-clock-heading" data-testid="pulse-clock">
      <h3 id="pulse-clock-heading">Story clock</h3>
      <p className="pulse-hint">Pick a story moment to see The Pulse exactly as Lala's audience saw it then: hidden items are left out and teasers show in place of their images.</p>
      {ctx.loadError && <p className="pulse-error" role="alert">{ctx.loadError}</p>}
      <div className="pulse-clock-controls">
        <button type="button" className="pulse-btn" aria-label="An earlier moment" disabled={i === 0} onClick={() => step(-1)}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <label className="pulse-clock-slider">
          <span className="pulse-sr">Story moment</span>
          <input type="range" min={0} max={Math.max(0, moments.length - 1)} step={1} value={i}
            aria-valuetext={current?.label} onChange={(e) => setIndex(Number(e.target.value))} data-testid="pulse-clock-slider" />
        </label>
        <button type="button" className="pulse-btn" aria-label="A later moment" disabled={i >= moments.length - 1} onClick={() => step(1)}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="pulse-clock-now" aria-live="polite" data-testid="pulse-clock-label">
        <b>{current?.label}</b>
        {at === present && <span className="pulse-clock-present"> · the present</span>}
        {at !== present && <>{' '}<button type="button" className="pulse-link-btn" onClick={() => setIndex(null)}>Back to the present</button></>}
      </p>
      <p className="pulse-clock-open">
        <Link to={`/pulse?at=${at}`} data-testid="pulse-clock-open"><ExternalLink size={14} aria-hidden="true" /> Open in The Pulse at this moment</Link>
      </p>

      <div className="pl-page pl-preview" data-testid="pulse-clock-preview" aria-busy={loading}>
        {loading && <p className="pl-quiet"><Loader2 size={14} className="pulse-spin" aria-hidden="true" /> Reading The Pulse at {current?.label}…</p>}
        {error && <p className="pl-error" role="alert">{error}</p>}
        {view && view.at === at && (
          <div className="pl-preview-grid">
            <div className="pl-preview-main">
              {view.cover?.url && (
                <FirstLook active={Boolean(view.cover.teaser)} className="pl-preview-cover" style={view.cover.teaser_style}>
                  <img className="pl-cover" src={view.cover.url} alt={view.cover.teaser ? '' : (view.cover.alt || '')} />
                </FirstLook>
              )}
              <p className="pl-quiet" data-testid="pulse-clock-count">
                {view.total === 0 ? 'Nothing posted by this moment.' : `${view.total} ${view.total === 1 ? 'post' : 'posts'} by this moment${view.total > view.posts.length ? `; the newest ${view.posts.length} shown` : ''}.`}
              </p>
              {view.posts.map((p) => <PulsePost key={p.id} post={p} />)}
            </div>
            <aside className="pl-preview-side">
              <LatestFitCard fit={view.fit} director={false} />
              <UpcomingCard events={view.events} />
              <CitiesCard cities={view.cities} director={false} states={view.cityStates} />
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
