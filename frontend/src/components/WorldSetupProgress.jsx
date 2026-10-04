/**
 * WorldSetupProgress — the seven world-building steps and which are done.
 *
 * Lifted out of WorldDashboard's Setup Progress tab into the LalaVerse
 * Overview (2026-10-04): one overview per question, so the world's state
 * of completion sits beside the show at a glance. Each step links to the
 * hub tab that does the work. The "events" check reads the active show
 * (audit CTX-01), never the first show the API returns.
 *
 * The checks read the routes' real shapes (2026-10-04): GET /page-content/:name
 * answers the content object itself (the checks read a `data` property that
 * was never there, so three steps could never be done), and GET
 * /social-profiles answers { profiles, pagination: { total } } (the check read
 * `count`). Each check measures usable records, not just presence, and an
 * endpoint that could not be reached is "could not check", not "not done".
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
  { num: 6, key: 'feed', icon: '👥', title: 'Generate Feed', route: '/feed?tab=people&layer=lalaverse', description: "Create Lala's social world — influencers, rivals, friends.", feeds: ['Event hosts', 'Guest lists', 'Social drama'] },
  { num: 7, key: 'events', icon: '🎉', title: 'Create World Events', route: '/universe?tab=culture&sub=events', description: 'Calendar events auto-spawn world events with hosts and guest lists.', feeds: ['Episode injection', 'Scene creation'] },
];

// A fetch that reports "unreachable" (null) apart from "empty".
const safeFetch = async (url) => {
  try { const res = await apiClient.get(url); return res.data ?? {}; }
  catch (err) { console.error('[WorldSetupProgress] check unreachable:', url, err?.response?.status || err?.message); return null; }
};

// Usable records in a page-content object: sections that hold something
// (a non-empty array or object, or a non-empty scalar). Keys alone are not
// configuration.
const usableSections = (content) => Object.values(content || {}).filter((v) => (
  Array.isArray(v) ? v.length > 0 : v && typeof v === 'object' ? Object.keys(v).length > 0 : Boolean(v)
)).length;

/** What each step counts, in words, for the step card. */
export const COUNT_LABELS = { infrastructure: 'sections', influencer: 'sections', calendar: 'events', memory: 'sections', locations: 'locations', feed: 'profiles', events: 'draft events' };

/**
 * The seven checks; `showId` is the active show for the events check.
 * Returns { done: { key: boolean }, counts: { key: number }, unreachable: [key] }.
 */
export async function checkSetup(showId) {
  const counts = {};
  const unreachable = [];
  const count = async (key, url, measure) => {
    const body = url ? await safeFetch(url) : {};
    if (body === null) { unreachable.push(key); counts[key] = 0; return; }
    counts[key] = measure(body);
  };
  await count('infrastructure', `${API}/page-content/world_infrastructure`, usableSections);
  await count('influencer', `${API}/page-content/influencer_systems`, usableSections);
  await count('calendar', `${API}/calendar/events?event_type=lalaverse_cultural`, (b) => (Array.isArray(b.events) ? b.events.length : 0));
  await count('memory', `${API}/page-content/cultural_memory`, usableSections);
  await count('locations', `${API}/world/locations`, (b) => (Array.isArray(b.locations) ? b.locations.length : 0));
  await count('feed', `${API}/social-profiles?feed_layer=lalaverse&limit=1`, (b) => Number(b.pagination?.total ?? b.statusCounts?.total ?? (Array.isArray(b.profiles) ? b.profiles.length : 0)) || 0);
  if (showId) await count('events', `${API}/world/${showId}/events?status=draft`, (b) => (Array.isArray(b.events) ? b.events.length : 0));
  else counts.events = 0;
  const done = Object.fromEntries(Object.entries(counts).map(([k, n]) => [k, n > 0]));
  return { done, counts, unreachable };
}

export default function WorldSetupProgress({ showId }) {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);

  useEffect(() => {
    let live = true;
    checkSetup(showId).then((r) => { if (live) setResult(r); });
    return () => { live = false; };
  }, [showId]);

  const status = result?.done || null;
  const total = SETUP_STEPS.length;
  const done = status ? Object.values(status).filter(Boolean).length : 0;
  const complete = status && done === total;
  const unreachable = result?.unreachable || [];

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
      {unreachable.length > 0 && (
        <div data-testid="world-setup-unreachable" style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning-text)', fontSize: 12 }}>
          {unreachable.length === 1 ? 'One step could not be checked' : `${unreachable.length} steps could not be checked`} (the server did not answer). Those are not counted as done or not done.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8 }}>
        {SETUP_STEPS.map((step) => {
          const isDone = Boolean(status?.[step.key]);
          const isUnreachable = unreachable.includes(step.key);
          const n = result?.counts?.[step.key];
          return (
            <button key={step.key} type="button" onClick={() => navigate(step.route)} aria-label={`Step ${step.num}: ${step.title}${isDone ? ' (done)' : isUnreachable ? ' (could not check)' : ''}`}
              style={{ textAlign: 'left', background: isDone ? 'var(--success-bg)' : 'var(--surface-card)', border: `1px solid ${isDone ? 'var(--success-border)' : 'var(--lala-parchment-3)'}`, borderRadius: 8, padding: 12, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10, fontFamily: 'inherit' }}>
              <div aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', background: isDone ? 'var(--success)' : 'var(--surface-bg)', color: isDone ? 'var(--text-inverse)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, border: `2px solid ${isDone ? 'var(--success)' : 'var(--lala-parchment-3)'}` }}>
                {isDone ? '✓' : step.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--lala-gold-text)' }}>STEP {step.num}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{step.title}</span>
                  {isDone && <span style={{ fontSize: 9, padding: '2px 6px', background: 'var(--success-bg)', color: 'var(--success-text)', borderRadius: 4, fontWeight: 600 }}>DONE</span>}
                  {isUnreachable && <span style={{ fontSize: 9, padding: '2px 6px', background: 'var(--warning-bg)', color: 'var(--warning-text)', borderRadius: 4, fontWeight: 600 }}>COULD NOT CHECK</span>}
                  {result && !isUnreachable && <span data-testid={`world-setup-count-${step.key}`} style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>{n} {COUNT_LABELS[step.key]}</span>}
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
