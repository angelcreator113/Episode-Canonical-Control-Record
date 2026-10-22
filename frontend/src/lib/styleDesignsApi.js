/**
 * Template Studio › Style sheets (Evoni, 2026-10-22): the Style Page's
 * designs for a show, each on or off. GET/PUT /api/v1/shows/:id/style-designs.
 */
import api from '../services/api';

const base = (showId) => `/api/v1/shows/${showId}/style-designs`;
export const styleDesignsApi = {
  get: (showId) => api.get(base(showId)).then((r) => r.data?.data),
  save: (showId, off) => api.put(base(showId), { off }).then((r) => r.data?.data),
};
