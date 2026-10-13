/**
 * The Dream Cities' Pulse fields (docs/design/2026-10-the-pulse.md §3 "City
 * colours", §4 Uploads; Task #2920), saved on the city in the DREAM_CITIES
 * override (page_content world_infrastructure › DREAM_CITIES; Evoni,
 * 2026-10-11), the list World Foundation already reads:
 *   image_url, image_alt   the city's image
 *   bubble_image_url       its story-bubble image
 *   palette                its colours, hex; `color` follows palette[0] so
 *                          the pages that read `color` show the same city
 * Saving reads the current list (the override, else the built-in one),
 * changes one city's fields and writes the whole list back: other cities and
 * fields this page doesn't know are kept.
 */
import api from '../services/api';
import { DREAM_CITIES } from '../data/dreamCities';

const PAGE = 'world_infrastructure';
const KEY = 'DREAM_CITIES';

// The spec's colours, offered until a city's palette is saved.
export const SPEC_PALETTES = {
  dazzle_district: ['#D4789A', '#B76E79', '#F2EDE4'], // fashion pink, rose gold, pearl
  radiance_row: ['#A889C8', '#7FD1D1'], // lavender, aqua
  echo_park: ['#7B4FC9', '#2F7BFF'], // violet, electric blue
  ascent_tower: ['#AEB6BF', '#A8D8EA'], // silver, ice blue
  maverick_harbor: ['#2A8C8C', '#9FD5C9', '#E8D6B0'], // coastal teal, sea glass, champagne
};

export const HEX = /^#[0-9a-fA-F]{6}$/;

export const hasSavedPalette = (city) => Array.isArray(city?.palette) && city.palette.length > 0;

/** The city's colours: its saved palette, else the spec's, else its one colour. */
export function paletteOf(city) {
  if (hasSavedPalette(city)) return city.palette;
  return SPEC_PALETTES[city?.key] || (city?.color ? [city.color] : []);
}

/** The list with one city's fields changed; everything else as it was. */
export function mergeCity(list, key, patch) {
  let found = false;
  const next = list.map((city) => {
    if (city?.key !== key) return city;
    found = true;
    const merged = { ...city, ...patch };
    if (Array.isArray(patch.palette) && patch.palette[0]) merged.color = patch.palette[0];
    return merged;
  });
  if (!found) throw new Error('That city is not in the Dream Cities list.');
  return next;
}

/** The current list: the saved override, else the built-in one. */
export async function loadCities() {
  const res = await api.get(`/api/v1/page-content/${PAGE}`);
  const saved = res.data?.[KEY];
  return Array.isArray(saved) && saved.length ? saved : DREAM_CITIES;
}

/**
 * The cities as Lala sees them at a story moment (Task 3041), from the
 * reveal-aware read: a first look's image and story bubble are their teasers
 * (teaser_style, bubble_teaser_style), hidden ones none; the full image never
 * reaches the page before its moment. { cities, states }; the built-in list
 * when none is saved (it has no images).
 */
export async function loadPulseCities(showId, at = 'present') {
  const res = await api.get(`/api/v1/pulse-reveals/cities?show_id=${encodeURIComponent(showId)}&at=${encodeURIComponent(at)}`);
  const saved = res.data?.cities;
  return { cities: (Array.isArray(saved) ? saved : DREAM_CITIES).filter((c) => c?.key), states: res.data?.states || {} };
}

/** Saves one city's fields onto the latest list; returns the saved list. */
export async function saveCity(key, patch) {
  const next = mergeCity(await loadCities(), key, patch);
  await api.put(`/api/v1/page-content/${PAGE}/${KEY}`, { data: next });
  return next;
}

/** Stores an image for a city; returns its URL. kind: 'image' | 'bubble'. */
export async function uploadCityImage(key, kind, file) {
  const form = new FormData();
  form.append('image', file);
  const res = await api.post(`/api/v1/world/dream-cities/${encodeURIComponent(key)}/image?kind=${kind}`, form);
  return res.data?.url;
}
