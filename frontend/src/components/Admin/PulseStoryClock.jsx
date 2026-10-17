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
 * Since Evoni's Story Clock mock (2026-10-17) this preview is the second
 * view; the first is the day planner (PulseStoryPlanner).
 * Styles: styles/AdminPanel.css (pulse-clock-*), PulseStoryClock.css (sc-*,
 * sp-*) and, for the preview, pages/SocialMediaPage.css (pl-*).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Clock, ExternalLink, History, Loader2, Plus } from 'lucide-react';
import api from '../../services/api';
import { useReveals } from './PulseRevealContext';
import { storyMoments, presentOrder } from '../../lib/storyClock';
import { loadPulseCities } from '../../lib/pulseCities';
import PulsePost from '../Pulse/PulsePost';
import { pulseFeedUrl } from '../../lib/pulsePosts';
import { CitiesCard, UpcomingCard, LatestFitCard } from '../Pulse/PulseSides';
import { FirstLook } from '../Pulse/PulseReveal';
import PulseStoryPlanner from './PulseStoryPlanner';
import { addDays, plannerDayOf } from '../../lib/storyPlanner';
import '../../pages/SocialMediaPage.css';
import './PulseStoryClock.css';

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

/** The Pulse at a story moment: the scrubber and Lala's view then (Task 2941). */
export function StoryMomentPreview() {
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
    <section className="pulse-clock sc-preview" aria-labelledby="pulse-clock-heading" data-testid="pulse-clock">
      <h3 id="pulse-clock-heading">The Pulse at a story moment</h3>
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

const VIEWS = [
  { key: 'planner', label: 'Day planner', Icon: CalendarClock },
  { key: 'moment', label: 'The Pulse at a story moment', Icon: History },
];
const dayLabel = (day) => new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Story Clock (Evoni's mock, 2026-10-17): the day planner (PulseStoryPlanner,
 * by the clock time posts go out), with the date and Add story; or The
 * Pulse at a story moment (StoryMomentPreview), kept as the second view.
 */
export default function PulseStoryClock({ now = new Date() }) {
  const ctx = useReveals();
  const [view, setView] = useState('planner');
  const [day, setDay] = useState(() => plannerDayOf(now));
  const [addKey, setAddKey] = useState(0);
  if (!ctx) return null;
  const today = plannerDayOf(now);
  return (
    <div className="sc" data-testid="story-clock">
      <section className="sp-card sc-head" aria-labelledby="sc-heading">
        <span className="sc-head-icon" aria-hidden="true"><Clock size={24} /></span>
        <div className="sc-head-text">
          <h3 id="sc-heading">Story Clock</h3>
          <p className="sp-hint">{view === 'planner'
            ? "Plan what happens in Lala's world through the day. Posts go out on The Pulse at their times."
            : 'See The Pulse exactly as Lala\'s audience saw it at any story moment.'}</p>
        </div>
        {view === 'planner' && (
          <button type="button" className="sp-btn is-primary" onClick={() => setAddKey((k) => k + 1)} data-testid="sc-add">
            <Plus size={18} aria-hidden="true" />Add story
          </button>
        )}
        <div className="sc-bar">
          <div className="sc-views" role="tablist" aria-label="Story Clock views">
            {VIEWS.map(({ key, label, Icon }) => (
              <button key={key} type="button" role="tab" aria-selected={view === key} className={view === key ? 'sc-view is-active' : 'sc-view'} onClick={() => setView(key)}>
                <Icon size={16} aria-hidden="true" />{label}
              </button>
            ))}
          </div>
          {view === 'planner' && (
            <div className="sc-date" role="group" aria-label="Day">
              <button type="button" className="sp-icon-btn" aria-label="The day before" onClick={() => setDay((d) => addDays(d, -1))}><ChevronLeft size={18} aria-hidden="true" /></button>
              <label className="sc-date-pick">
                <CalendarDays size={16} aria-hidden="true" />
                <span data-testid="sc-day">{dayLabel(day)}</span>
                <input type="date" value={day} aria-label="Pick a day" onChange={(e) => { if (e.target.value) setDay(e.target.value); }} />
              </label>
              <button type="button" className="sp-icon-btn" aria-label="The day after" onClick={() => setDay((d) => addDays(d, 1))}><ChevronRight size={18} aria-hidden="true" /></button>
              {day !== today && <button type="button" className="sc-today" onClick={() => setDay(today)}>Today</button>}
            </div>
          )}
        </div>
      </section>
      {view === 'planner'
        ? <PulseStoryPlanner showId={ctx.showId} day={day} addKey={addKey} />
        : <div className="sp-card"><StoryMomentPreview /></div>}
    </div>
  );
}
