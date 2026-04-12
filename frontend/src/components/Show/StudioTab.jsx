// frontend/src/components/Show/StudioTab.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';

/**
 * StudioTab — Production Dashboard
 *
 * The first thing you see when you open a show. Shows:
 * - Getting started pipeline (when new)
 * - Current episode in progress
 * - Production stats at a glance
 * - Quick action links
 */

function StudioTab({ show, episodes = [] }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const showId = show?.id;

  useEffect(() => {
    if (showId) loadStats();
  }, [showId, episodes.length]);

  const loadStats = async () => {
    try {
      const [eventsRes, wardrobeRes, balanceRes] = await Promise.allSettled([
        api.get(`/api/v1/world/${showId}/events?limit=100`).catch(() => ({ data: {} })),
        api.get(`/api/v1/wardrobe?show_id=${showId}&limit=200`).catch(() => ({ data: {} })),
        api.get(`/api/v1/world/${showId}/balance`).catch(() => ({ data: {} })),
      ]);

      const events = eventsRes.status === 'fulfilled' ? (eventsRes.value.data?.events || []) : [];
      const wardrobe = wardrobeRes.status === 'fulfilled' ? (wardrobeRes.value.data?.data || []) : [];
      const balance = balanceRes.status === 'fulfilled' ? (balanceRes.value.data?.balance ?? null) : null;

      setStats({
        events: events.length,
        eventsReady: events.filter(e => e.status !== 'draft').length,
        wardrobe: wardrobe.length,
        balance,
        episodes: episodes.length,
        completed: episodes.filter(e => e.evaluation_status === 'accepted').length,
        drafted: episodes.filter(e => e.status === 'draft').length,
      });
    } catch {
      setStats({ events: 0, eventsReady: 0, wardrobe: 0, balance: null, episodes: episodes.length, completed: 0, drafted: 0 });
    }
  };

  const currentEpisode = episodes.find(ep => ['draft', 'scripted', 'in_build', 'in_review'].includes(ep.status));
  const isNew = episodes.length === 0 && (stats?.events || 0) === 0;

  // Getting started steps
  const gettingStarted = [
    { icon: '💌', label: 'Create events in Producer Mode', done: (stats?.events || 0) > 0, route: `/shows/${showId}/world?tab=events`, detail: stats?.events ? `${stats.events} events` : 'Start here' },
    { icon: '👗', label: 'Upload wardrobe items', done: (stats?.wardrobe || 0) >= 3, route: `/shows/${showId}/world?tab=wardrobe`, detail: stats?.wardrobe ? `${stats.wardrobe} items` : 'Add items' },
    { icon: '🎬', label: 'Generate an episode from an event', done: episodes.length > 0, route: `/shows/${showId}/world?tab=events`, detail: episodes.length ? `${episodes.length} episodes` : 'Inject event → generate' },
    { icon: '🚀', label: 'Set up distribution platforms', done: !!show.distribution_defaults, route: `/shows/${showId}?tab=distribution`, detail: show.distribution_defaults ? 'Configured' : 'YouTube, TikTok, IG, FB' },
    { icon: '👑', label: 'Complete your first episode', done: (stats?.completed || 0) > 0, route: `/shows/${showId}/world?tab=events`, detail: stats?.completed ? `${stats.completed} completed` : 'Evaluate + finalize' },
  ];

  const doneCount = gettingStarted.filter(s => s.done).length;
  const pct = Math.round((doneCount / gettingStarted.length) * 100);
  const nextStep = gettingStarted.find(s => !s.done);

  const S = {
    card: { background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 16px' },
    statNum: { fontSize: 28, fontWeight: 800, color: '#1a1a2e', lineHeight: 1 },
    statLabel: { fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: 500 },
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Stats Row */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
          <div style={S.card}>
            <div style={S.statNum}>{stats.events}</div>
            <div style={S.statLabel}>Events</div>
          </div>
          <div style={S.card}>
            <div style={S.statNum}>{stats.wardrobe}</div>
            <div style={S.statLabel}>Wardrobe</div>
          </div>
          <div style={S.card}>
            <div style={S.statNum}>{stats.episodes}</div>
            <div style={S.statLabel}>Episodes</div>
          </div>
          <div style={S.card}>
            <div style={S.statNum}>{stats.completed}</div>
            <div style={S.statLabel}>Completed</div>
          </div>
          <div style={S.card}>
            <div style={{ ...S.statNum, color: stats.balance !== null ? (stats.balance >= 500 ? '#16a34a' : stats.balance >= 200 ? '#f59e0b' : '#dc2626') : '#94a3b8' }}>
              {stats.balance !== null ? stats.balance.toLocaleString() : '—'}
            </div>
            <div style={S.statLabel}>🪙 Balance</div>
          </div>
        </div>
      )}

      {/* Current Episode OR Getting Started */}
      {currentEpisode ? (
        <div style={{ ...S.card, marginBottom: 16, borderColor: '#c7d2fe', borderWidth: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6366f1', textTransform: 'uppercase' }}>In Progress</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>{currentEpisode.title}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                Episode {currentEpisode.episode_number} · {currentEpisode.status}
              </div>
            </div>
            <button onClick={() => navigate(`/episodes/${currentEpisode.id}`)} style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              Continue →
            </button>
          </div>
        </div>
      ) : (
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>
                {isNew ? 'Getting Started' : 'Production Pipeline'}
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>{doneCount}/{gettingStarted.length} steps · {pct}%</div>
            </div>
            {nextStep && (
              <button onClick={() => navigate(nextStep.route)} style={{
                padding: '6px 16px', borderRadius: 6, border: 'none', background: '#B8962E', color: '#fff',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>
                Next: {nextStep.label.split(' ').slice(0, 3).join(' ')} →
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#16a34a' : pct >= 40 ? '#f59e0b' : '#6366f1', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>

          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {gettingStarted.map(step => (
              <div key={step.label}
                onClick={() => !step.done && navigate(step.route)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 6,
                  cursor: step.done ? 'default' : 'pointer',
                  background: step.done ? '#f0fdf4' : 'transparent',
                }}
                onMouseEnter={e => { if (!step.done) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={e => { if (!step.done) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{step.done ? '✅' : step.icon}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: step.done ? 400 : 600, color: step.done ? '#16a34a' : '#1a1a2e', textDecoration: step.done ? 'line-through' : 'none', opacity: step.done ? 0.7 : 1 }}>
                  {step.label}
                </span>
                <span style={{ fontSize: 12, color: step.done ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>{step.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { icon: '🎭', label: 'Producer Mode', route: `/shows/${showId}/world?tab=overview` },
          { icon: '💌', label: 'Events', route: `/shows/${showId}/world?tab=events` },
          { icon: '👥', label: "Lala's Feed", route: `/shows/${showId}/world?tab=feed` },
          { icon: '📍', label: 'Scene Library', route: `/shows/${showId}/scene-library` },
        ].map(action => (
          <button key={action.label} onClick={() => navigate(action.route)} style={{
            ...S.card, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 4, transition: 'all 0.15s', border: '1px solid #e2e8f0',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#c7d2fe'; e.currentTarget.style.background = '#fafafe'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}
          >
            <span style={{ fontSize: 24 }}>{action.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default StudioTab;
