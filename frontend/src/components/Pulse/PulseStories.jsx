/**
 * The Pulse's stories row (Task 2927; spec §3 Centre; Evoni, 2026-10-11):
 * Lala first, then characters with a live post in the last few days (newest
 * first), then the five Dream Cities. People: a gradient ring around their
 * photo, else their initial, with their city. Cities: a ring in the city's
 * first colour around its story-bubble image, else its initial in its
 * colours, with its subtitle. Tapping a person filters the feed to them;
 * a city is quiet until phase 7 brings city feeds. A city's story-bubble
 * image before its reveal (Task 2939) is blurred, or its initial when hidden.
 * Styles: pages/SocialMediaPage.css (pl-*).
 */
import React from 'react';
import { initial } from '../../lib/pulsePosts';
import { paletteOf } from '../../lib/pulseCities';
import { cityName } from './PulsePost';

export const RECENT_DAYS = 3;

/** Who posted live in the last few days, newest first, one entry each; Lala is left out (she leads the row). */
export function recentPosters(posts, { now = Date.now(), days = RECENT_DAYS, lalaHandle = 'lala' } = {}) {
  const since = now - days * 86400000;
  const seen = new Set([lalaHandle]);
  const out = [];
  const sorted = [...posts].sort((a, b) => new Date(b.posted_at || 0) - new Date(a.posted_at || 0));
  for (const p of sorted) {
    const t = new Date(p.posted_at || 0).getTime();
    if (!Number.isFinite(t) || t < since) continue;
    const handle = p.poster_handle || p.socialProfile?.handle;
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);
    out.push({
      handle,
      name: p.poster_display_name || p.socialProfile?.display_name || handle,
      photo: p.author_portrait_url || null,
      city: cityName(p.socialProfile?.city),
    });
  }
  return out;
}

// A city's colours ride in as --ring-a/--ring-b; the stylesheet draws them.
const ringVars = (a, b) => (a ? { '--ring-a': a, '--ring-b': b || a } : undefined);

function Bubble({ colors, children }) {
  return <span className="pl-story-ring" style={colors}><span className="pl-story-inner">{children}</span></span>;
}

export default function PulseStories({ lala, people, cities, active, onPerson, cityStates = {}, onCity = null }) {
  const lalaName = lala?.name || 'Lala';
  return (
    <section className="pl-stories" aria-label="Stories" data-testid="pl-stories">
      <ul>
        <li>
          <button type="button" className={active === lala?.handle ? 'pl-story active' : 'pl-story'} aria-pressed={active === lala?.handle}
            onClick={() => onPerson(lala?.handle, lalaName)} data-testid="pl-story-person">
            <Bubble>{lala?.photo ? <img src={lala.photo} alt="" /> : <span className="pl-story-initial">{initial(lalaName)}</span>}</Bubble>
            <b>{lalaName}</b>
            {lala?.city && <small>{lala.city}</small>}
          </button>
        </li>
        {people.map((p) => (
          <li key={p.handle}>
            <button type="button" className={active === p.handle ? 'pl-story active' : 'pl-story'} aria-pressed={active === p.handle}
              onClick={() => onPerson(p.handle, p.name)} data-testid="pl-story-person">
              <Bubble>{p.photo ? <img src={p.photo} alt="" /> : <span className="pl-story-initial">{initial(p.name)}</span>}</Bubble>
              <b>{p.name}</b>
              {p.city && <small>{p.city}</small>}
            </button>
          </li>
        ))}
        {cities.map((c) => {
          const [first, second] = paletteOf(c);
          const bubble = cityStates[`city_bubble:${c.key}`];
          const inner = (
            <>
              <Bubble colors={ringVars(first, second)}>
                {c.bubble_image_url && bubble !== 'hidden'
                  ? <img src={c.bubble_image_url} alt="" data-first-look={bubble === 'teaser' ? 'true' : undefined} />
                  : <span className="pl-story-initial pl-story-city-initial" style={ringVars(first, second)}>{initial(c.name)}</span>}
              </Bubble>
              <b>{c.name}</b>
              {c.subtitle && <small>{c.subtitle}</small>}
            </>
          );
          return (
            <li key={c.key}>
              {/* A city opens its own feed (Task 2987) where the page offers it. */}
              {onCity ? (
                <button type="button" className="pl-story" onClick={() => onCity(c.key)} data-testid="pl-story-city">{inner}</button>
              ) : (
                <span className="pl-story quiet" aria-disabled="true" data-testid="pl-story-city">{inner}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
