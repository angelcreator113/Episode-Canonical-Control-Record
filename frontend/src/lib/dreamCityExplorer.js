/**
 * The World tab's city explorer, to Evoni's mock (Lalas_Social_Media_Page_3,
 * 2026-10-06): pick one of the five DREAM cities and see its places,
 * schools and companies. Pure: DreamCityExplorer renders.
 *
 * A location names its city in free text (world_locations.city), so a
 * venue belongs to a city when its city reads as the city's name or key
 * ("Dazzle District", "dazzle district", "dazzle_district"). Universities
 * carry a city; corporations and legends carry none in the data, so the
 * explorer says they are not placed rather than guessing.
 */

const norm = (s) => String(s || '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Does this free-text city name the DREAM city? */
export function inCity(text, city) {
  const t = norm(text);
  return Boolean(t) && (t === norm(city?.name) || t === norm(city?.key));
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What a venue row says under its name: the events that use it, else what it is. */
export function venueLine(loc) {
  const events = (loc?.events || []).filter((e) => e?.name);
  if (events.length === 1) return `Used by ${events[0].name}`;
  if (events.length > 1) return `Used by ${events[0].name} and ${plural(events.length - 1, 'other event')}`;
  const kind = [loc?.venue_type || loc?.property_type || loc?.location_type, loc?.district].filter(Boolean).join(' · ');
  return kind ? `${kind.replace(/_/g, ' ')} · no events here yet` : 'No events here yet';
}

/**
 * The city's places: every location in it except the city row itself,
 * venues first, then by how many events use them.
 */
export function cityPlaces(locations, city) {
  return (locations || [])
    .filter((l) => l && l.location_type !== 'city' && inCity(l.city, city))
    .sort((a, b) => Number(b.location_type === 'venue') - Number(a.location_type === 'venue')
      || (b.events?.length || 0) - (a.events?.length || 0)
      || String(a.name).localeCompare(String(b.name)))
    .map((l) => ({ id: l.id, name: l.name || 'Unnamed place', line: venueLine(l), events: l.events?.length || 0 }));
}

/** How many locations each city holds, for the map's bubbles. */
export function placeCounts(locations, cities) {
  return Object.fromEntries((cities || []).map((c) => [c.key, cityPlaces(locations, c).length]));
}

/** The city's schools (UNIVERSITIES carry a city). */
export function citySchools(universities, city) {
  return (universities || []).filter((u) => inCity(u?.city, city));
}

/** Companies placed in the city, and how many name no city at all. */
export function cityCompanies(corporations, city) {
  const list = corporations || [];
  return {
    here: list.filter((c) => c?.city && inCity(c.city, city)),
    unplaced: list.filter((c) => !c?.city).length,
  };
}
