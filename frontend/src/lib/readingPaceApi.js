/**
 * Her learned reading pace, kept on the show (Evoni, 2026-10-28):
 * GET/PUT /api/v1/shows/:id/reading-pace (src/utils/readingPace). This
 * device keeps a copy too, so the pace still works with no show or with
 * the server out of reach.
 */
import api from '../services/api';

const base = (showId) => `/api/v1/shows/${encodeURIComponent(showId)}/reading-pace`;

const asSetting = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

export const readingPaceApi = {
  get: (showId) => api.get(base(showId)).then((r) => asSetting(r?.data?.data)),
  save: (showId, body) => api.put(base(showId), body).then((r) => asSetting(r?.data?.data)),
};

const LOCAL_KEY = (showId) => `lala.readingPace.v1.${showId || 'device'}`;

/** This device's copy: { [performer]: { use, episodes } }, or {}. */
export function readLocalPace(showId, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  try {
    const raw = storage?.getItem(LOCAL_KEY(showId));
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch (err) {
    console.error('[readingPace] the copy on this device could not be read:', err);
    return {};
  }
}

export function writeLocalPace(showId, value, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  try {
    storage?.setItem(LOCAL_KEY(showId), JSON.stringify(value || {}));
    return true;
  } catch (err) {
    console.error('[readingPace] the copy on this device could not be kept:', err);
    return false;
  }
}
