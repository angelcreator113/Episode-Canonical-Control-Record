/**
 * The episode editor's reads (Timeline Editor redesign P1, 2026-11-02).
 * P1 only reads: nothing here writes the edit, a take, a clip or a scene.
 *
 * The C1 routes (/api/v1/episodes/:id/edit) answer { success, data } and
 * answer 404 EPISODE_EDIT_OFF while the episode edit is switched off.
 */
import api from '../services/api';
import { unwrapEpisode } from '../utils/timelineLoad';

const enc = encodeURIComponent;
const editBase = (episodeId) => `/api/v1/episodes/${enc(episodeId)}/edit`;
const dataOf = (r) => r?.data?.data;

/** Why a read failed, as the page says it: { kind, message }. */
export function readFailure(err) {
  const status = err?.response?.status;
  const code = err?.response?.data?.code;
  if (code === 'EPISODE_EDIT_OFF') return { kind: 'off', message: 'The episode edit is switched off on this server (EPISODE_EDIT).' };
  if (status === 404) return { kind: 'not_found', message: 'This episode was not found.' };
  if (status === 401) return { kind: 'auth', message: 'Sign in to open the editor.' };
  if (status === 403) return { kind: 'auth', message: 'Your account cannot open this editor.' };
  if (!err?.response) return { kind: 'offline', message: 'The server could not be reached. Nothing was changed.' };
  return { kind: 'failed', message: err?.response?.data?.error || 'The editor could not be loaded. Nothing was changed.' };
}

export const episodeEditApi = {
  /** The episode (GET /episodes/:id answers { data: episode, script_revision }), or null. */
  episode: (episodeId) => api.get(`/api/v1/episodes/${enc(episodeId)}`).then((r) => unwrapEpisode(r?.data)),
  /** { edit_revision, rows, edit }: the live edit, in editTimeline's shape. */
  load: (episodeId) => api.get(editBase(episodeId)).then((r) => {
    const d = dataOf(r);
    if (!d || typeof d !== 'object' || !d.edit || typeof d.edit !== 'object') throw new Error('unrecognised edit response');
    return d;
  }),
  /** { ready, edit_revision, counts, findings }: the server's full check (sources and voice included). */
  findings: (episodeId) => api.get(`${editBase(episodeId)}/findings`).then((r) => {
    const d = dataOf(r);
    if (!d || !Array.isArray(d.findings)) throw new Error('unrecognised findings response');
    return d;
  }),
  /** The episode's raw clips (Lala, guests, Prime), each with url_raw, url_cutout, thumbnail_url. */
  rawClips: (episodeId) => api.get(`/api/v1/episode-clips/${enc(episodeId)}`).then((r) => (Array.isArray(r?.data?.data) ? r.data.data : [])),
  /** The scene sets linked to the episode, each with its angles. */
  sceneSets: (episodeId) => api.get(`/api/v1/episodes/${enc(episodeId)}/scene-sets`).then((r) => (Array.isArray(r?.data?.data) ? r.data.data : [])),
  /** Voice Studio's playable takes: { takes: [...with audio_url], held }. Voice Studio off (404) is no takes. */
  takes: (episodeId) => api.get(`/api/v1/voice-studio/${enc(episodeId)}/playable`).then(
    (r) => ({ available: true, takes: dataOf(r)?.takes || [], held: dataOf(r)?.held || [] }),
    (err) => {
      if (err?.response?.status === 404) return { available: false, takes: [], held: [] };
      throw err;
    },
  ),
};
