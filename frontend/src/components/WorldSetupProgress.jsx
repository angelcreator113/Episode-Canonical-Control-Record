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
 *
 * Steps 1, 2 and 4 (2026-10-06, Evoni: "these dont seem to be hooked up to
 * the system"): their pages open on built-in starter content that is only
 * saved once edited, and what the rest of the system reads is the Franchise
 * Brain, filled by each page's Brain Update. Such a step is done when the
 * Brain holds that page's cards (GET /franchise-brain/sync/status) or the
 * page has saved edits, and says which; with neither it says the page has
 * starter content only, not in the Brain yet.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import './WorldSetupProgress.css';

const API = import.meta.env.VITE_API_URL || '/api/v1';

export const SETUP_STEPS = [
  { num: 1, key: 'infrastructure', icon: '🏗️', title: 'World Foundation', short: 'DREAM cities, companies, universities, legends', route: '/universe?tab=world', description: 'Define the DREAM cities, companies, universities, and legendary figures.', feeds: ['Cultural Calendar', 'Locations', 'Feed profiles'] },
  { num: 2, key: 'influencer', icon: '⭐', title: 'Social Systems', short: 'archetypes, relationships, economy, trends', route: '/universe?tab=society', description: 'How influence works — archetypes, relationships, economy, trends.', feeds: ['Feed profile generation', 'Event automation', 'Story evaluation'] },
  { num: 3, key: 'calendar', icon: '📅', title: 'Culture & Events', short: 'yearly rhythm, awards, micro events', route: '/universe?tab=culture', description: 'The yearly rhythm — events, awards, micro events that auto-spawn world events.', feeds: ['Events Library', 'Feed activity', 'Episode planning'] },
  { num: 4, key: 'memory', icon: '📜', title: 'Cultural Memory', short: 'history and what people remember', route: '/universe?tab=culture&sub=history', description: 'How the world remembers — legends, feuds, archives. Gives depth.', feeds: ['Character dialogue', 'Feed posts', 'Story depth'] },
  { num: 5, key: 'locations', icon: '📍', title: 'Locations & Venues', short: 'where things happen', route: '/universe?tab=world&sub=locations', description: 'The map — venues, properties, scene sets. Events need venues.', feeds: ['Event venues', 'Scene Sets', 'HOME_BASE'] },
  { num: 6, key: 'feed', icon: '👥', title: 'Generate Feed', short: 'the people with a voice', route: '/feed?tab=people&layer=lalaverse', description: "Create Lala's social world — influencers, rivals, friends.", feeds: ['Event hosts', 'Guest lists', 'Social drama'] },
  { num: 7, key: 'events', icon: '🎉', title: 'Create World Events', short: 'the moments episodes are made from', route: '/universe?tab=culture&sub=events', description: 'Calendar events auto-spawn world events with hosts and guest lists.', feeds: ['Episode injection', 'Scene creation'] },
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
export const COUNT_LABELS = { infrastructure: 'sections', influencer: 'sections', calendar: 'cultural calendar events', memory: 'sections', locations: 'locations', feed: 'profiles', events: 'draft events' };

// The Brain Update source of each step whose page opens on starter content.
export const BRAIN_SOURCES = { infrastructure: 'world_foundation', influencer: 'social_systems', memory: 'cultural_memory' };

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Where a step's button goes. Step 7 counts the active show's draft world
 * events, so it opens that show's Events library, where those events are
 * listed; it used to open Culture's calendar list, which holds other rows
 * (wiring map, docs/reads/2026-10-06-lalaverse-wiring-map.md §7, fix-list
 * item 6). With no show yet it keeps the calendar, where world events are
 * spawned from.
 */
export function stepRoute(step, showId) {
  if (step?.key === 'events' && showId) return `/shows/${encodeURIComponent(showId)}/world?tab=events`;
  return step?.route;
}

/** What a Brain-backed step says: in the Brain, saved, or starter content only. */
export function brainDetail(cards, sections) {
  const parts = [];
  if (cards > 0) parts.push(`In the Brain · ${plural(cards, 'card')}`);
  if (sections > 0) parts.push(`Saved · ${plural(sections, 'section')}`);
  return parts.length ? parts.join(' · ') : 'Starter content only, not in the Brain yet';
}

/**
 * The seven checks; `showId` is the active show for the events check.
 * Returns { done: { key: boolean }, counts: { key: number }, unreachable: [key] }.
 */
export async function checkSetup(showId) {
  const counts = {};
  const unreachable = [];
  const details = {};
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

  // Steps 1, 2 and 4: the Brain's cards from the page count as well as its
  // saved edits. A Brain that could not be read leaves a step with no saved
  // edits as "could not check".
  const brainBody = await safeFetch(`${API}/franchise-brain/sync/status`);
  const brain = brainBody ? (brainBody.data || {}) : null;
  for (const [key, source] of Object.entries(BRAIN_SOURCES)) {
    if (unreachable.includes(key)) continue;
    const sections = counts[key] || 0;
    if (!brain) {
      if (!sections) unreachable.push(key);
      else details[key] = brainDetail(0, sections);
      continue;
    }
    const cards = (Number(brain[source]?.cards) || 0) + (Number(brain[source]?.legacy) || 0);
    done[key] = cards > 0 || sections > 0;
    details[key] = brainDetail(cards, sections);
  }
  return { done, counts, unreachable, details };
}

/**
 * The first step still to do, for the "Next" banner: not done and not
 * "could not check". Null until the checks are in, and once all are done.
 */
export function nextStep(result) {
  if (!result?.done) return null;
  const unreachable = result.unreachable || [];
  return SETUP_STEPS.find((s) => !result.done[s.key] && !unreachable.includes(s.key)) || null;
}

/*
 * "Build the world" (the LalaVerse mock, 2026-10-06): the seven steps as
 * numbered circles on a dashed line, a checked circle once done, each with
 * its one-line scope and what it holds, then a banner naming the next step.
 */
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
  const next = nextStep(result);

  return (
    <section className="wsp" aria-labelledby="world-setup-heading">
      <div className="wsp-head">
        <h2 id="world-setup-heading" className="wsp-title">Build the world</h2>
        <span className="wsp-sub">{status ? `Each step feeds the next. ${done} of ${total} done.` : 'Each step feeds the next. Checking…'}</span>
        <div data-testid="world-setup-count" className={`wsp-count${complete ? ' is-complete' : ''}`}
          role="progressbar" aria-label="World setup steps done" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          {status ? `${done}/${total}` : '…'}
        </div>
      </div>
      {unreachable.length > 0 && (
        <div data-testid="world-setup-unreachable" className="wsp-unreachable">
          {unreachable.length === 1 ? 'One step could not be checked' : `${unreachable.length} steps could not be checked`} (the server did not answer). Those are not counted as done or not done.
        </div>
      )}
      <ol className="wsp-steps">
        {SETUP_STEPS.map((step) => {
          const isDone = Boolean(status?.[step.key]);
          const isUnreachable = unreachable.includes(step.key);
          const n = result?.counts?.[step.key];
          const detail = result?.details?.[step.key];
          return (
            <li key={step.key} className={`wsp-step wsp-tone-${step.num}${isDone ? ' is-done' : ''}`}>
              <button type="button" className="wsp-step-btn" onClick={() => navigate(stepRoute(step, showId))}
                aria-label={`Step ${step.num}: ${step.title}${isDone ? ' (done)' : isUnreachable ? ' (could not check)' : ''}`}>
                <span className="wsp-circle" aria-hidden="true">{isDone ? '✓' : step.num}</span>
                <span className="wsp-step-text">
                  <span className="wsp-step-title">{step.title}</span>
                  <span className="wsp-step-short">{step.short}</span>
                  {isUnreachable && <span className="wsp-chip-warn">Could not check</span>}
                  {result && !isUnreachable && (
                    <span data-testid={`world-setup-count-${step.key}`} className={`wsp-step-count${!isDone && detail ? ' is-warn' : ''}`}>
                      {detail || `${n} ${COUNT_LABELS[step.key]}`}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {next && (
        <div className="wsp-next" data-testid="world-setup-next">
          <span className="wsp-next-mark" aria-hidden="true">✦</span>
          <div className="wsp-next-text">
            <strong>Next: {next.title}</strong>
            <span>{next.description} It feeds {next.feeds.join(', ')}.</span>
          </div>
          <button type="button" className="wsp-next-btn" onClick={() => navigate(stepRoute(next, showId))}>Start step {next.num}</button>
        </div>
      )}
      {complete && <div className="wsp-next is-complete" data-testid="world-setup-next">Every step is done: the world is set up.</div>}
    </section>
  );
}
