/* ─────────────────────────────────────────────────────────────────────────────
   SidebarProgress.jsx — Show Production Progress
   Tracks real production metrics: events, wardrobe, episodes, overlays,
   distribution. Replaces the old 5-step onboarding wizard.
   ──────────────────────────────────────────────────────────────────────────── */

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api/v1';

function SidebarProgress({ showId, collapsed: sidebarCollapsed }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchProgress = useCallback(async () => {
    if (!showId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token') || sessionStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Fetch multiple data sources in parallel
      const [eventsRes, wardrobeRes, episodesRes, overlaysRes] = await Promise.allSettled([
        fetch(`${API_BASE}/world/${showId}/events?limit=100`, { headers }).then(r => r.json()).catch(() => ({})),
        fetch(`${API_BASE}/wardrobe?show_id=${showId}&limit=200`, { headers }).then(r => r.json()).catch(() => ({})),
        fetch(`${API_BASE}/episodes?show_id=${showId}&limit=100`, { headers }).then(r => r.json()).catch(() => ({})),
        fetch(`${API_BASE}/ui-overlays/${showId}`, { headers }).then(r => r.json()).catch(() => ({})),
      ]);

      const events = eventsRes.status === 'fulfilled' ? (eventsRes.value?.events || []) : [];
      const wardrobe = wardrobeRes.status === 'fulfilled' ? (wardrobeRes.value?.data || []) : [];
      const episodes = episodesRes.status === 'fulfilled' ? (episodesRes.value?.data || episodesRes.value || []) : [];
      const overlays = overlaysRes.status === 'fulfilled' ? (overlaysRes.value?.data || []) : [];

      const readyEvents = events.filter(e => e.status !== 'draft').length;
      const overlayGenerated = overlays.filter(o => o.generated || o.url || o.asset_id).length;
      const scriptedEpisodes = episodes.filter(e => e.script_content || e.status === 'published').length;
      const completedEpisodes = episodes.filter(e => e.evaluation_status === 'accepted').length;

      setData({
        events: { count: events.length, ready: readyEvents },
        wardrobe: { count: wardrobe.length },
        episodes: { count: episodes.length, scripted: scriptedEpisodes, completed: completedEpisodes },
        overlays: { generated: overlayGenerated, total: overlays.length },
      });
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [showId]);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  if (!showId || !data) return null;

  // Build progress steps from real data
  const steps = [
    {
      icon: '💌', label: 'Events',
      done: data.events.count > 0,
      detail: data.events.count > 0 ? `${data.events.ready} ready` : 'Create events',
      route: `/shows/${showId}/world?tab=events`,
    },
    {
      icon: '👗', label: 'Wardrobe',
      done: data.wardrobe.count >= 5,
      detail: data.wardrobe.count > 0 ? `${data.wardrobe.count} items` : 'Add items',
      route: `/shows/${showId}/world?tab=wardrobe`,
    },
    {
      icon: '✨', label: 'Overlays',
      done: data.overlays.generated >= 10,
      detail: `${data.overlays.generated}/${data.overlays.total}`,
      route: `/shows/${showId}/scene-library?tab=overlays`,
    },
    {
      icon: '📝', label: 'Episodes',
      done: data.episodes.scripted > 0,
      detail: data.episodes.count > 0 ? `${data.episodes.scripted} scripted` : 'Generate episodes',
      route: `/shows/${showId}/world?tab=episodes`,
    },
    {
      icon: '👑', label: 'Completed',
      done: data.episodes.completed > 0,
      detail: data.episodes.completed > 0 ? `${data.episodes.completed} finished` : 'Complete an episode',
      route: `/shows/${showId}/world?tab=episodes`,
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const nextStep = steps.find(s => !s.done);
  const priorityColor = pct === 100 ? '#2E8B57' : pct >= 60 ? '#b0922e' : '#C0392B';

  // Hide when fully complete
  if (pct === 100) return null;

  // Collapsed sidebar — minimal pip
  if (sidebarCollapsed) {
    return (
      <div
        style={{ padding: '10px 0', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}
        title={`Production: ${pct}% complete`}
        onClick={() => { if (nextStep) window.location.href = nextStep.route; }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: `2px solid ${priorityColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: priorityColor,
          fontFamily: 'DM Sans, sans-serif',
        }}>
          {pct}%
        </div>
      </div>
    );
  }

  return (
    <div style={{
      margin: '8px 12px',
      borderRadius: 8,
      border: '1px solid #f0d4de',
      background: '#fdf2f6',
      overflow: 'hidden',
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 12,
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 10px', cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{ fontWeight: 600, color: '#1C1814', fontSize: 11, letterSpacing: '0.04em' }}>
          SHOW PROGRESS
        </span>
        <span style={{ fontSize: 10, color: '#7A7268' }}>
          {open ? '▾' : '▸'} {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: '#E0D9CC', margin: '0 10px 6px 10px', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: priorityColor, borderRadius: 2,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Step list */}
      {open && (
        <div style={{ padding: '0 10px 8px 10px' }}>
          {steps.map(step => (
            <div key={step.label}
              onClick={() => { if (!step.done && step.route) window.location.href = step.route; }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '3px 0',
                color: step.done ? '#2E8B57' : '#B8AFA2',
                fontSize: 11,
                cursor: step.done ? 'default' : 'pointer',
              }}
            >
              <span style={{ width: 16, textAlign: 'center', fontSize: 12 }}>
                {step.done ? '✓' : step.icon}
              </span>
              <span style={{
                flex: 1,
                textDecoration: step.done ? 'line-through' : 'none',
                opacity: step.done ? 0.6 : 1,
              }}>
                {step.label}
              </span>
              <span style={{ fontSize: 9, color: step.done ? '#2E8B57' : '#B8AFA2', fontWeight: 600 }}>
                {step.detail}
              </span>
            </div>
          ))}

          {/* Next action button */}
          {nextStep && (
            <button
              onClick={() => window.location.href = nextStep.route}
              style={{
                width: '100%', marginTop: 8, padding: '6px 0',
                border: 'none', borderRadius: 6,
                background: priorityColor, color: '#fff',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                letterSpacing: '0.02em', fontFamily: 'DM Sans, sans-serif',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.target.style.opacity = '0.85'}
              onMouseLeave={e => e.target.style.opacity = '1'}
            >
              Next: {nextStep.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default SidebarProgress;
