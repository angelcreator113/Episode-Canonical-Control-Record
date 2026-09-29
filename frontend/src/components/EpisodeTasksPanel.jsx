/**
 * Producer Mode → Episodes: an episode's "Tasks & Details" panel (Task #2272).
 *
 * The button opens and closes the panel; the arrow shows which. The first
 * open loads the episode's host, guests, venue and social tasks through
 * `load`; later opens reuse them. Each episode's panel keeps its own state.
 *
 * Before this, the button wrote the panel's HTML into the DOM and returned
 * early once loaded, so it opened once and never closed.
 *
 * `load(episodeId)` resolves to { automation, event, socialTasks }.
 */

import React, { useState } from 'react';
import SocialTaskBadge from './SocialTaskBadge';

const SOURCE_BG = { platform: '#f0f7ff', category: '#f0fdf4' };

export default function EpisodeTasksPanel({ episodeId, load, buttonStyle }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [error, setError] = useState(false);

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    if (details) { setOpen(true); return; }
    setLoading(true);
    setError(false);
    try {
      setDetails(await load(episodeId));
      setOpen(true);
    } catch (err) {
      console.error('[EpisodeTasksPanel] load failed:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const label = loading ? '⏳ Loading...'
    : open ? '📱 Tasks & Details ▲'
    : details ? '📱 Tasks & Details ▼'
    : '📱 View Tasks & Details';

  const automation = details?.automation;
  const event = details?.event;
  const guests = automation?.guest_profiles || [];
  const socialTasks = details?.socialTasks || [];

  return (
    <div style={{ marginTop: 14 }}>
      <button type="button" onClick={toggle} disabled={loading} aria-expanded={open} style={buttonStyle}>
        {label}
      </button>
      {error && <span style={{ marginLeft: 8, fontSize: 11, color: '#dc2626' }}>Couldn't load tasks. Try again.</span>}
      {open && details && (
        <div data-testid="episode-tasks-content" style={{ marginTop: 10, padding: 12, background: '#fafafa', borderRadius: 8, fontSize: 12, lineHeight: 1.6 }}>
          {automation?.host_display_name && (
            <div style={{ marginBottom: 8 }}><strong>Host:</strong> {automation.host_display_name} ({automation.host_handle || ''})</div>
          )}
          {guests.length > 0 && (
            <div style={{ marginBottom: 8 }}><strong>Guest List:</strong> {guests.map((g) => g.display_name || g.handle).join(', ')}</div>
          )}
          {event?.venue_name && (
            <div style={{ marginBottom: 8 }}><strong>Venue:</strong> {event.venue_name}{event.venue_address ? ` — ${event.venue_address}` : ''}</div>
          )}
          <div style={{ marginTop: 12, fontWeight: 600, color: '#B8962E' }}>📱 Social Media Tasks</div>
          {socialTasks.length > 0 ? (
            <div style={{ marginTop: 4, display: 'grid', gap: 4 }}>
              {socialTasks.map((t, i) => (
                <div key={t.slot || i} style={{ fontSize: 12, padding: '4px 8px', background: SOURCE_BG[t.source] || '#f8f8f8', borderRadius: 4 }}>
                  {t.completed ? '☑' : '☐'} <strong>{t.label}</strong>
                  <SocialTaskBadge task={t} />
                  {t.source === 'platform' && <span style={{ fontSize: 8, padding: '1px 4px', background: '#dbeafe', color: '#1e40af', borderRadius: 3, marginLeft: 4 }}>{t.platform}</span>}
                  {t.source === 'category' && <span style={{ fontSize: 8, padding: '1px 4px', background: '#d1fae5', color: '#065f46', borderRadius: 3, marginLeft: 4 }}>niche</span>}
                  {' '}<span style={{ color: '#999', fontSize: 10 }}>· {t.platform} · {t.timing}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 4, fontSize: 11, color: '#999' }}>No social tasks generated yet</div>
          )}
        </div>
      )}
    </div>
  );
}
