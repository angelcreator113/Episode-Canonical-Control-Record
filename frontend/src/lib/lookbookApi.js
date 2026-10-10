/**
 * The episode's Lookbook routes (Task #2812): the data the Style Page edits
 * and the Wardrobe style sheet panel shares. GET/PUT /episodes/:id/lookbook,
 * POST/PATCH/DELETE its images, and PUT its venue toggle. Every write
 * returns the Lookbook.
 */
import api from '../services/api';

const base = (episodeId) => `/api/v1/episodes/${episodeId}/lookbook`;
export const lookbookApi = {
  get: (episodeId) => api.get(base(episodeId)).then((r) => r.data?.data),
  save: (episodeId, fields) => api.put(base(episodeId), fields).then((r) => r.data?.data),
  upload: (episodeId, files, category) => {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    if (category) form.append('category', category);
    return api.post(`${base(episodeId)}/images`, form).then((r) => r.data?.data?.lookbook);
  },
  move: (episodeId, imageId, changes) => api.patch(`${base(episodeId)}/images/${imageId}`, changes).then((r) => r.data?.data?.lookbook),
  remove: (episodeId, imageId) => api.delete(`${base(episodeId)}/images/${imageId}`).then((r) => r.data?.data?.lookbook),
  venue: (episodeId, body) => api.put(`${base(episodeId)}/venue`, body).then((r) => r.data?.data),
};
