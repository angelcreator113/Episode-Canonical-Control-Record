import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import useActiveShow from '../hooks/useActiveShow';
import { checkSetup, COUNT_LABELS } from '../components/WorldSetupProgress';
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
    route: '/universe?tab=world',
    description: 'Define the DREAM cities, companies, universities, and legendary figures of the LalaVerse. This is the foundation — who runs what, where power lives.',
    feeds: ['Cultural Calendar', 'Locations', 'Feed profiles'],
    action: 'Set up cities, corporations, and schools → Brain Update',
    checkField: 'infrastructure',
  },
  {
    num: 2,
    key: 'influencer',
    icon: '⭐',
    title: 'Social Systems',
    route: '/universe?tab=society',
    description: 'How does influence work? Creator archetypes, relationship types, income streams, trend cycles. These rules determine how feed profiles behave.',
    feeds: ['Feed profile generation', 'Event automation', 'Story evaluation'],
    action: 'Review archetypes and economy → Brain Update',
    checkField: 'influencer',
  },
  {
    num: 3,
    key: 'calendar',
    icon: '📅',
    title: 'Culture & Events',
    route: '/universe?tab=culture',
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
    route: '/universe?tab=culture',
    description: 'How the world remembers its past — legends, feuds, anniversaries. Gives characters shared history to reference in dialogue and content.',
    feeds: ['Character dialogue', 'Feed post generation', 'Story depth'],
    action: 'Review memory types → Brain Update',
    checkField: 'memory',
  },
  {
    num: 5,
    key: 'locations',
    icon: '📍',
    title: 'Locations & Venues',
    route: '/universe?tab=world',
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
    route: '/universe?tab=culture',
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

  // The same checks as the LalaVerse Overview's World Setup
  // (components/WorldSetupProgress checkSetup, 2026-10-06): the routes' real
  // shapes, the active show (audit CTX-01) rather than the first show the
  // API returns, steps 1, 2 and 4 counted from the Franchise Brain as well
  // as saved edits, and "could not check" apart from "not done". This page
  // checked page-content's `data` (never there), the profiles' `count`
  // (never there) and the first show, and logged nothing on a failure.
  const { showId, loaded: showsLoaded } = useActiveShow();
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!showsLoaded) return undefined;
    let live = true;
    setLoading(true);
    checkSetup(showId || undefined)
      .then((r) => { if (live) { setResult(r); setStatus(r.done); } })
      .catch((err) => { console.error('[WorldSetupGuide] setup check failed:', err); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [showId, showsLoaded]);

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
          <strong style={{ color: '#B8962E' }}>How it all connects:</strong> Infrastructure defines the world → Influencer rules govern how people behave → Cultural Calendar creates yearly events → Memory gives depth → Locations are where things happen → Feed profiles are the people → Events are the story moments. Each layer feeds into the next. On the World, Society and Culture pages, Brain Update (Connect to Brain the first time) copies the page into the Show Bible as cards.
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {STEPS.map((step) => {
            const done = status[step.checkField];
            const unreachable = (result?.unreachable || []).includes(step.checkField);
            const detail = result?.details?.[step.checkField]
              || (result && !unreachable ? `${result.counts?.[step.checkField] ?? 0} ${COUNT_LABELS[step.checkField]}` : null);
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
                      {unreachable && <span data-testid={`guide-unreachable-${step.checkField}`} style={{ fontSize: 9, padding: '2px 6px', background: 'var(--warning-bg)', color: 'var(--warning-text)', borderRadius: 4, fontWeight: 600 }}>COULD NOT CHECK</span>}
                      {detail && <span data-testid={`guide-detail-${step.checkField}`} style={{ fontSize: 10, color: done ? '#666' : 'var(--warning-text)', fontFamily: "'DM Mono', monospace" }}>{detail}</span>}
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
