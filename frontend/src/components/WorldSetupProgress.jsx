/**
 * WorldSetupProgress — the seven world-building steps and which are done.
 *
 * Lifted out of WorldDashboard's Setup Progress tab into the LalaVerse
 * Overview (2026-10-04): one overview per question, so the world's state
 * of completion sits beside the show at a glance. Each step links to the
 * hub tab that does the work. The "events" check reads the active show
 * (audit CTX-01), never the first show the API returns.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';

const API = import.meta.env.VITE_API_URL || '/api/v1';

export const SETUP_STEPS = [
  { num: 1, key: 'infrastructure', icon: '🏗️', title: 'World Foundation', route: '/universe?tab=world', description: 'Define the DREAM cities, companies, universities, and legendary figures.', feeds: ['Cultural Calendar', 'Locations', 'Feed profiles'] },
  { num: 2, key: 'influencer', icon: '⭐', title: 'Social Systems', route: '/universe?tab=society', description: 'How influence works — archetypes, relationships, economy, trends.', feeds: ['Feed profile generation', 'Event automation', 'Story evaluation'] },
  { num: 3, key: 'calendar', icon: '📅', title: 'Culture & Events', route: '/universe?tab=culture', description: 'The yearly rhythm — events, awards, micro events that auto-spawn world events.', feeds: ['Events Library', 'Feed activity', 'Episode planning'] },
  { num: 4, key: 'memory', icon: '📜', title: 'Cultural Memory', route: '/universe?tab=culture&sub=history', description: 'How the world remembers — legends, feuds, archives. Gives depth.', feeds: ['Character dialogue', 'Feed posts', 'Story depth'] },
  { num: 5, key: 'locations', icon: '📍', title: 'Locations & Venues', route: '/universe?tab=world&sub=locations', description: 'The map — venues, properties, scene sets. Events need venues.', feeds: ['Event venues', 'Scene Sets', 'HOME_BASE'] },
  { num: 6, key: 'feed', icon: '👥', title: 'Generate Feed', route: '/feed?layer=lalaverse', description: "Create Lala's social world — influencers, rivals, friends.", feeds: ['Event hosts', 'Guest lists', 'Social drama'] },
  { num: 7, key: 'events', icon: '🎉', title: 'Create World Events', route: '/universe?tab=culture&sub=events', description: 'Calendar events auto-spawn world events with hosts and guest lists.', feeds: ['Episode injection', 'Scene creation'] },
];

const safeFetch = async (url) => {
  try { const res = await apiClient.get(url); return res.data; }
  catch { return null; }
};

/** The seven checks; `showId` is the active show for the events check. */
export async function checkSetup(showId) {
  const checks = {};
  const infra = await safeFetch(`${API}/page-content/world_infrastructure`);
  checks.infrastructure = Boolean(infra?.data && Object.keys(infra.data).length > 0);
  const infl = await safeFetch(`${API}/page-content/influencer_systems`);
  checks.influencer = Boolean(infl?.data && Object.keys(infl.data).length > 0);
  const cal = await safeFetch(`${API}/calendar/events?event_type=lalaverse_cultural`);
  checks.calendar = (cal?.events || []).length > 0;
  const mem = await safeFetch(`${API}/page-content/cultural_memory`);
  checks.memory = Boolean(mem?.data && Object.keys(mem.data).length > 0);
  const loc = await safeFetch(`${API}/world/locations`);
  checks.locations = (loc?.locations || []).length > 0;
  const feed = await safeFetch(`${API}/social-profiles?feed_layer=lalaverse&limit=1`);
  checks.feed = (feed?.count || 0) > 0;
  if (showId) { const ev = await safeFetch(`${API}/world/${showId}/events?status=draft`); checks.events = (ev?.events || []).length > 0; }
  else checks.events = false;
  return checks;
}

export default function WorldSetupProgress({ showId }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let live = true;
    checkSetup(showId).then((checks) => { if (live) setStatus(checks); });
    return () => { live = false; };
  }, [showId]);

  const total = SETUP_STEPS.length;
  const done = status ? Object.values(status).filter(Boolean).length : 0;
  const complete = status && done === total;

  return (
    <section aria-labelledby="world-setup-heading" style={{ background: 'var(--surface-card)', borderRadius: 10, border: '1px solid var(--lala-parchment-3)', padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <h3 id="world-setup-heading" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>🧭 World Setup</h3>
        <div data-testid="world-setup-count" style={{ fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: status ? (complete ? 'var(--success-text)' : 'var(--lala-gold-text)') : 'var(--text-secondary)' }}>
          {status ? `${done}/${total}` : '…'}
        </div>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} style={{ background: 'var(--lala-parchment-2)', borderRadius: 8, height: 8, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ background: complete ? 'var(--success)' : 'var(--lala-gold)', height: '100%', width: `${(done / total) * 100}%`, borderRadius: 8, transition: 'width 0.3s' }} />
      </div>
      <div style={{ background: 'var(--surface-bg)', border: '1px solid var(--lala-parchment-3)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--lala-gold-text)' }}>How it connects:</strong> Foundation defines the world → Social Systems govern behavior → Culture & Events creates yearly events → Memory gives depth → Locations are where things happen → Feed profiles are the people → Events are the story moments.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8 }}>
        {SETUP_STEPS.map((step) => {
          const isDone = Boolean(status?.[step.key]);
          return (
            <button key={step.key} type="button" onClick={() => navigate(step.route)} aria-label={`Step ${step.num}: ${step.title}${isDone ? ' (done)' : ''}`}
              style={{ textAlign: 'left', background: isDone ? 'var(--success-bg)' : 'var(--surface-card)', border: `1px solid ${isDone ? 'var(--success-border)' : 'var(--lala-parchment-3)'}`, borderRadius: 8, padding: 12, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10, fontFamily: 'inherit' }}>
              <div aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', background: isDone ? 'var(--success)' : 'var(--surface-bg)', color: isDone ? 'var(--text-inverse)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, border: `2px solid ${isDone ? 'var(--success)' : 'var(--lala-parchment-3)'}` }}>
                {isDone ? '✓' : step.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--lala-gold-text)' }}>STEP {step.num}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{step.title}</span>
                  {isDone && <span style={{ fontSize: 9, padding: '2px 6px', background: 'var(--success-bg)', color: 'var(--success-text)', borderRadius: 4, fontWeight: 600 }}>DONE</span>}
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 4px', lineHeight: 1.5 }}>{step.description}</p>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}><strong style={{ color: 'var(--lala-gold-text)' }}>Feeds:</strong> {step.feeds.join(' · ')}</div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
