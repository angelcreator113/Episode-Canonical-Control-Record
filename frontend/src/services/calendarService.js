import api from './api';

export const calendarService = {
  // Markers
  getMarkers: (seriesId) => api.get(`/api/v1/calendar/markers${seriesId ? `?series_id=${seriesId}` : ''}`).then(r => r.data),
  createMarker: (data) => api.post('/api/v1/calendar/markers', data).then(r => r.data),
  setPresent: (id) => api.put(`/api/v1/calendar/markers/${id}/set-present`).then(r => r.data),

  // Events
  getEvents: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/api/v1/calendar/events${qs ? `?${qs}` : ''}`).then(r => r.data);
  },
  createEvent: (data) => api.post('/api/v1/calendar/events', data).then(r => r.data),
  updateEvent: (id, data) => api.put(`/api/v1/calendar/events/${id}`, data).then(r => r.data),

  // Attendees
  getAttendees: (eventId) => api.get(`/api/v1/calendar/events/${eventId}/attendees`).then(r => r.data),
  addAttendee: (eventId, data) => api.post(`/api/v1/calendar/events/${eventId}/attendees`, data).then(r => r.data),

  // Ripples
  generateRipples: (eventId) => api.post(`/api/v1/calendar/events/${eventId}/ripples/generate`).then(r => r.data),
  confirmRipple: (id) => api.put(`/api/v1/calendar/ripples/${id}/confirm`).then(r => r.data),

  // Special
  getSimultaneous: (datetime) => api.get(`/api/v1/calendar/simultaneous?datetime=${encodeURIComponent(datetime)}`).then(r => r.data),

  // Mirror Field
  getSelfPortrait: () => api.get('/api/v1/social-profiles/mirror/self-portrait').then(r => r.data),

  // Crossings
  getCrossingTracker: () => api.get('/api/v1/character-crossings/tracker').then(r => r.data),
  confirmGap: (id, data) => api.put(`/api/v1/character-crossings/${id}/confirm-gap`, data).then(r => r.data),

  // Author notes with watch/plant/intent
  getActionableNotes: () => api.get('/api/v1/author-notes?entity_type=calendar_event&entity_id=global').then(r => r.data).catch(() => ({ notes: [] })),
};
