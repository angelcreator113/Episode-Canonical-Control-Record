/**
 * A post's location on The Pulse (Task 3090; Evoni, 2026-10-13): a Dream
 * City or a canonical venue, whose city the server fills in. A tagged post
 * appears in that city's feed; an untagged post reads its poster's city. A
 * tag is a label only: it never says Lala travelled there.
 *
 *   placeValue / placeBody   the composer's <select> value, and the fields it sends
 *   placeGroups(places)      the venues grouped by city for the picker
 *   placeOfPost(post)        { key, label } for the post's meta line, else null
 */
import { DREAM_CITIES } from '../data/dreamCities';

const nameOf = (key) => DREAM_CITIES.find((c) => c.key === key)?.name || null;

/** The picker's value for a city or venue: "city:<key>" or "venue:<id>". */
export const placeValue = (kind, id) => `${kind}:${id}`;

/** The POST /feed-posts fields for a picker value; no location sends nothing. */
export function placeBody(value) {
  const at = String(value || '').indexOf(':');
  if (at < 0) return {};
  const kind = value.slice(0, at);
  const id = value.slice(at + 1);
  if (!id) return {};
  if (kind === 'venue') return { place_location_id: id };
  if (kind === 'city') return { place_city: id };
  return {};
}

/** GET /feed-posts/places's venues by city, in Dream City order; a venue with no city comes last. */
export function placeGroups(places) {
  const venues = Array.isArray(places?.venues) ? places.venues : [];
  const groups = DREAM_CITIES
    .map((c) => ({ key: c.key, name: c.name, venues: venues.filter((v) => v.city === c.key) }))
    .filter((g) => g.venues.length);
  const other = venues.filter((v) => !nameOf(v.city));
  if (other.length) groups.push({ key: '', name: 'Other venues', venues: other });
  return groups;
}

/**
 * Where the post's meta line says it is: its tag ("Velvet Room · Echo Park"),
 * else its poster's city. `key` opens that city's feed; null when unknown.
 */
export function placeOfPost(post) {
  const place = post?.place;
  if (place && (place.city || place.name)) {
    const city = place.city_name || nameOf(place.city);
    return { key: nameOf(place.city) ? place.city : null, label: [place.name, city].filter(Boolean).join(' · ') };
  }
  const home = post?.socialProfile?.city;
  return nameOf(home) ? { key: home, label: nameOf(home) } : null;
}
