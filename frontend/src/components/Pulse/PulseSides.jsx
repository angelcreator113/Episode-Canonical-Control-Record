/**
 * The Pulse's side cards (Task 2928; docs/design/2026-10-the-pulse.md §3
 * Left, Right, City colours, Latest fit), built from real data only:
 *   CitiesCard      the five Dream Cities, each row tinted with its colours
 *                   (saved palette, else the spec's), dot, name, subtitle and
 *                   its image when uploaded. No map: there is no map image yet.
 *   CityStrip       the same cities as a compact horizontal strip, for phones
 *                   (the right column drops below the feed there).
 *   TrendingCard    the top five tags counted from live posts.
 *   UpcomingCard    date tile, name, venue and time. The episode an event
 *                   belongs to never shows (§2 rule 5).
 *   LatestFitCard   Lala's latest fit, the caption in script.
 * Director view shows empty image spots as "+ Add" (to Uploads); Lala's view
 * leaves them out. Cities are quiet until phase 7 brings city feeds.
 * Reveals (Task 2939): before its moment an image is blurred as a "first
 * look" (or left out when hidden) and an event shows its name only;
 * Director view shows a "Reveals: …" chip instead.
 * Styles: pages/SocialMediaPage.css (pl-*).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus } from 'lucide-react';
import { paletteOf } from '../../lib/pulseCities';
import { revealKey } from '../../lib/pulseReveals';
import { FirstLook, RevealChip } from './PulseReveal';

export const UPLOADS = '/admin?tab=pulse&sub=uploads';
export const TRENDING_MAX = 5;
export const UPCOMING_MAX = 3;

// A city's colours ride in as --city-a/--city-b/--city-c; the stylesheet tints with them.
export function cityVars(city) {
  const [a, b, c] = paletteOf(city);
  if (!a) return undefined;
  return { '--city-a': a, '--city-b': b || a, '--city-c': c || b || a };
}

function AddLink({ label, className = '' }) {
  return (
    <Link className={`pl-add-spot ${className}`} to={UPLOADS}>
      <ImagePlus size={18} aria-hidden="true" /> + Add {label}
    </Link>
  );
}

function CityImage({ city, director, state }) {
  if (city.image_url && state !== 'hidden') {
    return (
      <FirstLook active={state === 'teaser'} className="pl-city-first-look">
        <img className="pl-city-image" src={city.image_url} alt={state === 'teaser' ? '' : (city.image_alt || '')} data-testid="pl-city-image" />
      </FirstLook>
    );
  }
  if (director) {
    return (
      <Link className="pl-city-image pl-city-add" to={UPLOADS} aria-label={`Add an image for ${city.name}`} data-testid="pl-city-add">
        <ImagePlus size={16} aria-hidden="true" /> + Add
      </Link>
    );
  }
  return <span className="pl-city-image pl-city-name-tile" aria-hidden="true">{city.name}</span>;
}

/** states: Lala's view's city image states ({ 'city:<key>': 'teaser' | 'hidden' }); labels: Director view's reveal labels. */
export function CitiesCard({ cities, director, states = {}, labels = null }) {
  if (!cities.length) return null;
  return (
    <section className="pl-card pl-cities-card" aria-labelledby="pl-cities-heading" data-testid="pl-cities">
      <h2 id="pl-cities-heading" className="pl-card-title">Explore the Dream Cities</h2>
      <ul className="pl-cities">
        {cities.map((c) => (
          <li key={c.key} className="pl-city" style={cityVars(c)} data-testid="pl-city-row">
            <CityImage city={c} director={director} state={states[`city:${c.key}`]} />
            <span className="pl-city-text">
              <b><span className="pl-city-dot" aria-hidden="true" />{c.name}</b>
              {c.subtitle && <small>{c.subtitle}</small>}
              {director && <RevealChip label={labels?.get(revealKey('image', c.key, 'city'))} />}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CityStrip({ cities }) {
  if (!cities.length) return null;
  return (
    <ul className="pl-city-strip" aria-label="Dream Cities" data-testid="pl-city-strip">
      {cities.map((c) => (
        <li key={c.key} style={cityVars(c)} title="City feeds are coming to The Pulse">
          <span className="pl-city-dot" aria-hidden="true" />{c.name}
        </li>
      ))}
    </ul>
  );
}

/** "#tag" for a topic, as the post wrote it; one with no # gets one. */
export const tagOf = (topic) => {
  const t = String(topic || '').trim();
  return t.startsWith('#') ? t : `#${t.replace(/\s+/g, '')}`;
};

export function TrendingCard({ topics, director }) {
  const top = (topics || []).filter((t) => t?.topic && t.post_count > 0).slice(0, TRENDING_MAX);
  return (
    <section className="pl-card" aria-labelledby="pl-trending-heading" data-testid="pl-trending">
      <h2 id="pl-trending-heading" className="pl-card-title">Trending in the Verse</h2>
      {top.length === 0 && <p className="pl-quiet">Nothing trending yet.</p>}
      <ol className="pl-trending">
        {top.map((t, i) => (
          <li key={t.topic} data-testid="pl-trend">
            <span className="pl-trend-rank">{i + 1}</span>
            <span className="pl-trend-text">
              <b className="pl-tag">{tagOf(t.topic)}</b>
              <small>{t.post_count} {t.post_count === 1 ? 'post' : 'posts'}</small>
            </span>
          </li>
        ))}
      </ol>
      {director && <p className="pl-card-foot" data-testid="pl-trending-foot">Counted from approved posts</p>}
    </section>
  );
}

/** The date tile's month and day for a YYYY-MM-DD date; null for anything else. */
export function dateTile(date) {
  const m = typeof date === 'string' && date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(day.getTime())) return null;
  return { month: day.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }), day: String(day.getUTCDate()) };
}

// Only these fields of an event ever reach the screen; its episode never does.
export function UpcomingRow({ event, revealLabel = null }) {
  if (event.teaser) {
    return (
      <li className="pl-event pl-event-tiled pl-event-teaser" data-testid="pl-event">
        <span className="pl-date-tile pl-date-tile-empty" aria-hidden="true" />
        <span className="pl-event-text"><b>{event.name}</b><span className="pl-meta pl-first-look-text">First look</span></span>
      </li>
    );
  }
  const tile = dateTile(event.date);
  const loose = !tile && typeof event.date === 'string' && event.date.trim() ? event.date.trim() : null;
  const meta = [event.venue, loose, event.time].filter(Boolean).join(' · ');
  return (
    <li className="pl-event pl-event-tiled" data-testid="pl-event">
      {tile
        ? <span className="pl-date-tile"><small>{tile.month}</small> <b>{tile.day}</b></span>
        : <span className="pl-date-tile pl-date-tile-empty" aria-hidden="true" />}
      <span className="pl-event-text">
        <b>{event.name}</b>
        {meta && <span className="pl-meta">{meta}</span>}
        <RevealChip label={revealLabel} />
      </span>
    </li>
  );
}

export function UpcomingCard({ events, max = UPCOMING_MAX, labels = null }) {
  return (
    <section className="pl-card" aria-labelledby="pl-upcoming-heading" data-testid="pl-upcoming">
      <h2 id="pl-upcoming-heading" className="pl-card-title">Upcoming Events</h2>
      {events.length === 0 && <p className="pl-quiet">Nothing coming up.</p>}
      <ul className="pl-events">{events.slice(0, max).map((e) => <UpcomingRow key={e.id} event={e} revealLabel={labels?.get(revealKey('event', e.id))} />)}</ul>
    </section>
  );
}

export function LatestFitCard({ fit, director, revealLabel = null }) {
  if (!fit?.image_url) {
    if (!director) return null;
    return (
      <section className="pl-card pl-fit" aria-labelledby="pl-fit-heading" data-testid="pl-fit">
        <h2 id="pl-fit-heading" className="pl-card-title">Check out the latest fit</h2>
        <AddLink label="Lala's latest fit" className="pl-fit-add" />
      </section>
    );
  }
  return (
    <section className="pl-card pl-fit" aria-labelledby="pl-fit-heading" data-testid="pl-fit">
      <h2 id="pl-fit-heading" className="pl-card-title">Check out the latest fit</h2>
      <FirstLook active={Boolean(fit.teaser)}>
        <img className="pl-fit-photo" src={fit.image_url} alt={fit.teaser ? '' : (fit.image_alt || "Lala's latest fit")} data-testid="pl-fit-photo" />
      </FirstLook>
      {fit.caption && !fit.teaser && <p className="pl-fit-caption">{fit.caption}</p>}
      {director && <RevealChip label={revealLabel} />}
    </section>
  );
}
