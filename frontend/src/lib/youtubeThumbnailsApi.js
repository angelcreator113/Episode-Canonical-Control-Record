/**
 * YouTube thumbnails (Templates › YouTube thumbnails; Evoni, 2026-10-17):
 * /api/v1/youtube-thumbnails. An episode's 1280x720 thumbnail from its
 * show's style; the server renders it, so the preview is the saved file.
 */
import api from '../services/api';

const base = '/api/v1/youtube-thumbnails';

export const LAYOUTS = [
  { key: 'lala-left', label: 'Lala left' },
  { key: 'lala-right', label: 'Lala right' },
  { key: 'center', label: 'Title only' },
];

// The LalaVerse palette for the accent (the show's name, the badge, the
// bottom stripe) and the title's colour.
export const ACCENTS = ['#E0689F', '#C2407F', '#B8962E', '#E6C98F', '#A46EE0', '#2BB5AD'];
export const TEXT_COLORS = [
  { value: '#FFFFFF', label: 'White' },
  { value: '#FDF4E3', label: 'Cream' },
  { value: '#FFE9A8', label: 'Gold' },
];

/** The request: the spec as JSON, and the uploaded pictures when there are any. */
export function renderForm(spec, files = {}) {
  const form = new FormData();
  form.append('spec', JSON.stringify(spec));
  if (files.background) form.append('background', files.background);
  if (files.lala) form.append('lala', files.lala);
  return form;
}

/** The thumbnail's words for an episode: its title, the show's name, "EP n". */
export function episodeWords(episode, show) {
  const n = episode?.episode_number;
  return {
    title: episode?.title || '',
    kicker: show?.name || '',
    badge: n || n === 0 ? `EP ${n}` : '',
  };
}

export const youtubeThumbnailsApi = {
  sources: (episodeId) => api.get(`${base}/episodes/${episodeId}/sources`).then((r) => r.data?.data),
  render: (spec, files) => api.post(`${base}/render`, renderForm(spec, files), { responseType: 'blob', timeout: 60000 }).then((r) => r.data),
  save: (episodeId, spec, files) => api.post(`${base}/episodes/${episodeId}`, renderForm(spec, files), { timeout: 60000 }).then((r) => r.data?.data),
  saveStyle: (showId, style) => api.put(`${base}/shows/${showId}/style`, style).then((r) => r.data?.data),
  shows: () => api.get('/api/v1/shows').then((r) => (Array.isArray(r.data?.data) ? r.data.data : [])),
  episodes: (showId) => api.get(`/api/v1/episodes?show_id=${showId}&limit=500&sort=episode_number:ASC`)
    .then((r) => (Array.isArray(r.data?.data) ? r.data.data : [])),
};
