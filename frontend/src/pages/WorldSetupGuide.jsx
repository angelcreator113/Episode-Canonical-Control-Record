import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import './WorldLocations.css';

const API = import.meta.env.VITE_API_URL || '/api/v1';

// Track 6 CP15 module-scope helpers — anchor file. UNCLEAR-B reclassified
// all-BUG per v2.22 §9.11: cross-CP evidence shows every endpoint is auth-
// required via apiClient elsewhere. NO LOCKED PUBLIC retention.
//
// Helper-reuse density: 6 helpers cover 8 sites (3-way reuse on
// getPageContentApi sites 1, 2, 4 — second helper-reuse-density data
// point after CP14 EpisodeDetail).
//
// Cross-CP duplications per v2.12 §9.11:
//   - listLocationsApi: 4-fold (CP8 + CP11 + CP15 EpisodeScriptTab + here)
//   - listShowsApi: 6-fold (CP2 + CP5 + CP10 + CP11 + CP15 UPP + here)
//   - listWorldEventsApi: 4-fold (CP13 + CP14 + CP15 SocialProfileGenerator + here)
export const getPageContentApi = (pageName) =>
  apiClient.get(`${API}/page-content/${pageName}`).then((r) => r.data);
export const listCalendarEventsApi = (eventType) =>
  apiClient.get(`${API}/calendar/events?event_type=${encodeURIComponent(eventType)}`).then((r) => r.data);
export const listLocationsApi = () =>
  apiClient.get(`${API}/world/locations`).then((r) => r.data);
export const listSocialProfilesApi = (qs) =>
  apiClient.get(`${API}/social-profiles?${qs}`).then((r) => r.data);
export const listShowsApi = () =>
  apiClient.get(`${API}/shows`).then((r) => r.data);
export const listWorldEventsApi = (showId, status) =>
  apiClient.get(`${API}/world/${showId}/events?status=${status}`).then((r) => r.data);

const STEPS = [
  {
    num: 1,
    key: 'infrastructure',
    icon: '🏗️',
    title: 'Power Structures',
    route: '/world-foundation',
    description: 'Define the DREAM cities, companies, universities, and legendary figures of the LalaVerse. This is the foundation — who runs what, where power lives.',
    feeds: ['Cultural Calendar', 'Locations', 'Feed profiles'],
    action: 'Set up cities, corporations, and schools → Push to Brain',
    checkField: 'infrastructure',
  },
  {
    num: 2,
    key: 'influencer',
    icon: '⭐',
    title: 'Social Systems',
    route: '/social-systems',
    description: 'How does influence work? Creator archetypes, relationship types, income streams, trend cycles. These rules determine how feed profiles behave.',
    feeds: ['Feed profile generation', 'Event automation', 'Story evaluation'],
    action: 'Review archetypes and economy → Push to Brain',
    checkField: 'influencer',
  },
  {
    num: 3,
    key: 'calendar',
    icon: '📅',
    title: 'Culture & Events',
    route: '/culture-events',
    description: 'The yearly rhythm — Fashion Week, award shows, micro events. These cultural moments auto-spawn world events that Lala might get invited to.',
    feeds: ['Events Library (auto-spawn)', 'Feed activity', 'Episode planning'],
    action: 'Review events on Timeline + Micro tabs → Create Events from them',
    checkField: 'calendar',
  },
  {
    num: 4,
    key: 'memory',
    icon: '📜',
    title: 'Cultural Memory',
    route: '/culture-events',
    description: 'How the world remembers its past — legends, feuds, anniversaries. Gives characters shared history to reference in dialogue and content.',
    feeds: ['Character dialogue', 'Feed post generation', 'Story depth'],
    action: 'Review memory types → Push to Brain',
    checkField: 'memory',
  },
  {
    num: 5,
    key: 'locations',
    icon: '📍',
    title: 'Locations & Venues',
    route: '/world-foundation',
    description: 'The map — streets, districts, venues, properties. Events need venues. Characters need homes. Scenes need settings.',
    feeds: ['Event venues', 'Scene Sets', 'HOME_BASE properties'],
    action: 'Create locations for your key venues and character homes',
    checkField: 'locations',
  },
  {
    num: 6,
    key: 'feed',
    icon: '👥',
    title: "Generate Lala's Feed",
    route: null, // handled by show-specific route
    description: "The people — content creators, influencers, rivals, friends. They host events, attend parties, and populate Lala's social world.",
    feeds: ['Event hosts', 'Guest lists', 'Story characters', 'Social drama'],
    action: 'Go to Producer Mode → Lala\'s Feed tab → Generate 20 creators',
    checkField: 'feed',
  },
  {
    num: 7,
    key: 'events',
    icon: '🎉',
    title: 'Create World Events',
    route: '/culture-events',
    description: 'Cultural Calendar events auto-spawn world events with hosts from the Feed, venues from Locations, and guest lists from profile relationships.',
    feeds: ['Episode injection', 'Invitation generation', 'Scene creation'],
    action: 'Open a Calendar event → Click "Create Event from This"',
    checkField: 'events',
  },
];

export default function WorldSetupGuide() {
  const navigate = useNavigate();
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const checks = {};

        // Check infrastructure
        try {
          const d = await getPageContentApi('world_infrastructure');
          checks.infrastructure = d?.data && Object.keys(d.data).length > 0;
        } catch { checks.infrastructure = false; }

        // Check influencer systems
        try {
          const d = await getPageContentApi('influencer_systems');
          checks.influencer = d?.data && Object.keys(d.data).length > 0;
        } catch { checks.influencer = false; }

        // Check cultural calendar events
        try {
          const d = await listCalendarEventsApi('lalaverse_cultural');
          checks.calendar = (d.events || []).length > 0;
        } catch { checks.calendar = false; }

        // Check cultural memory
        try {
          const d = await getPageContentApi('cultural_memory');
          checks.memory = d?.data && Object.keys(d.data).length > 0;
        } catch { checks.memory = false; }

        // Check locations
        try {
          const d = await listLocationsApi();
          checks.locations = (d.locations || []).length > 0;
        } catch { checks.locations = false; }

        // Check feed profiles
        try {
          const d = await listSocialProfilesApi('feed_layer=lalaverse&limit=1');
          checks.feed = (d.count || 0) > 0;
        } catch { checks.feed = false; }

        // Check world events
        try {
          const shows = await listShowsApi();
          const showId = (shows.data || [])[0]?.id;
          if (showId) {
            const ed = await listWorldEventsApi(showId, 'draft');
            checks.events = (ed.events || []).length > 0;
          } else {
            checks.events = false;
          }
        } catch { checks.events = false; }

        setStatus(checks);
      } catch (e) {
        console.error('Status check failed:', e);
      }
      setLoading(false);
    };
    checkStatus();
  }, []);

  const completedCount = Object.values(status).filter(Boolean).length;
  const totalCount = STEPS.length;

  return (
    <div className="wl-page">
      <div className="wl-container" style={{ maxWidth: 800 }}>
        <div className="wl-header">
          <div>
            <h1 className="wl-title">World Setup Guide</h1>
            <p className="wl-subtitle">Build the LalaVerse step by step — each layer feeds into the next</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: completedCount === totalCount ? '#16a34a' : '#B8962E' }}>
              {loading ? '...' : `${completedCount}/${totalCount}`}
            </div>
            <div style={{ fontSize: 11, color: '#888' }}>steps complete</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background: '#eee', borderRadius: 8, height: 8, marginBottom: 32, overflow: 'hidden' }}>
          <div style={{ background: completedCount === totalCount ? '#16a34a' : '#B8962E', height: '100%', width: `${(completedCount / totalCount) * 100}%`, borderRadius: 8, transition: 'width 0.3s' }} />
        </div>

        {/* How it connects */}
        <div style={{ background: '#FAF7F0', border: '1px solid #e8e0d0', borderRadius: 10, padding: '16px 20px', marginBottom: 28, fontSize: 13, color: '#555', lineHeight: 1.6 }}>
          <strong style={{ color: '#B8962E' }}>How it all connects:</strong> Infrastructure defines the world → Influencer rules govern how people behave → Cultural Calendar creates yearly events → Memory gives depth → Locations are where things happen → Feed profiles are the people → Events are the story moments. Each layer feeds into the next. Push each to Franchise Brain so the AI uses your rules.
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {STEPS.map((step) => {
            const done = status[step.checkField];
            return (
              <div
                key={step.key}
                style={{
                  background: '#fff',
                  border: `1px solid ${done ? '#d4edda' : '#eee'}`,
                  borderRadius: 10,
                  padding: '16px 20px',
                  cursor: step.route ? 'pointer' : 'default',
                  transition: 'border-color 0.15s',
                }}
                onClick={() => step.route && navigate(step.route)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: done ? '#d4edda' : '#FAF7F0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                    border: `2px solid ${done ? '#16a34a' : '#e8e0d0'}`,
                  }}>
                    {done ? '✓' : step.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#B8962E' }}>STEP {step.num}</span>
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#2C2C2C' }}>{step.title}</span>
                      {done && <span style={{ fontSize: 9, padding: '2px 6px', background: '#d4edda', color: '#166534', borderRadius: 4, fontWeight: 600 }}>DONE</span>}
                    </div>
                    <p style={{ fontSize: 12, color: '#666', margin: '0 0 8px', lineHeight: 1.5 }}>{step.description}</p>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>
                      <strong style={{ color: '#B8962E' }}>Feeds into:</strong> {step.feeds.join(' · ')}
                    </div>
                    <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>
                      → {step.action}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
