/**
 * One DREAM city list (Evoni, 2026-10-18: "start the one DREAM city list").
 * The saved list (page_content world_infrastructure › DREAM_CITIES, the one
 * World Foundation and The Pulse edit) over the built-in one: a page that
 * shows a city shows its saved words and colour, and the writers read the
 * same words (services/dreamCityText on the server).
 *
 *   withSaved(base, saved)  each city of `base` with its saved fields laid
 *     over it, by key; a page's own fields (a map's pins) are kept, and a
 *     city that is not saved stays as built in
 *   useDreamCities(base)  the hook: `base` at first, then with the saved
 *     list once it is read (one read per page load; forgetSavedCities
 *     after a save)
 */
import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { DREAM_CITIES } from '../data/dreamCities';

let pending = null;

/** The saved list, or null (none saved, or a failed read, logged). */
export function loadSavedCities() {
  if (!pending) {
    pending = api.get('/api/v1/page-content/world_infrastructure')
      .then((res) => {
        const saved = res?.data?.DREAM_CITIES;
        return Array.isArray(saved) && saved.length ? saved : null;
      })
      .catch((err) => {
        console.error('[dreamCityList] the saved DREAM cities could not be read:', err?.message);
        pending = null;
        return null;
      });
  }
  return pending;
}

export function forgetSavedCities() { pending = null; }

export function withSaved(base, saved) {
  if (!Array.isArray(saved) || !saved.length) return base;
  const byKey = new Map(saved.filter((c) => c?.key).map((c) => [c.key, c]));
  return base.map((city) => (byKey.has(city.key) ? { ...city, ...byKey.get(city.key) } : city));
}

export function useDreamCities(base = DREAM_CITIES) {
  const [saved, setSaved] = useState(null);
  useEffect(() => {
    let cancelled = false;
    loadSavedCities().then((list) => { if (!cancelled) setSaved(list); });
    return () => { cancelled = true; };
  }, []);
  return useMemo(() => withSaved(base, saved), [base, saved]);
}
