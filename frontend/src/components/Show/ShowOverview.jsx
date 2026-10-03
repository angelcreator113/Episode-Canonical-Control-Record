/**
 * Producer Mode → Overview (Evoni, 2026-10-03: the consolidation as
 * proposed). Four questions, each answered briefly with a way to act:
 *   1. What am I producing?   episodes in production, each with Continue;
 *   2. What needs attention?  events whose setup is incomplete, with what is
 *                             missing and a link to finish it;
 *   3. What comes next?       the next ready event and the season's next slot;
 *   4. What recently changed? a short activity list.
 * Lala's state is one compact line; her full history is in Cast &
 * Continuity, results and tiers in Episodes → Results. A brand-new show sees
 * the first steps instead.
 *
 * Props: showId, episodes, events, stateHistory, decisions, charState,
 * wardrobeCount, goTo(tabKey) to open a Producer Mode section.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { computeEventPackageReadiness, computeEventState, describeMissing } from '../../utils/eventReadinessSections';

export const IN_PRODUCTION = ['draft', 'scripted', 'in_build', 'in_review'];
const STATUS_LABEL = { draft: 'Draft', scripted: 'Scripted', in_build: 'In build', in_review: 'In review' };
const STAT_ICONS = { coins: '🪙', reputation: '⭐', brand_trust: '🤝', influence: '📣', stress: '😰' };

const time = (d) => (d ? new Date(d).getTime() || 0 : 0);

/** The episodes in production, in episode order. */
export function episodesInProduction(episodes) {
  return (episodes || [])
    .filter((e) => IN_PRODUCTION.includes(e.status) && e.evaluation_status !== 'accepted')
    .sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));
}

/** Events whose setup is incomplete, with what each is missing. */
export function eventsNeedingAttention(events) {
  return (events || []).map((ev) => {
    const readiness = computeEventPackageReadiness(ev);
    const state = computeEventState(ev, readiness);
    if (state !== 'needs_organizer' && state !== 'needs_setup') return null;
    const missing = state === 'needs_organizer' ? ['Organizer'] : describeMissing(readiness.blocking);
    return { event: ev, state, missing };
  }).filter(Boolean);
}

/** The next ready event: soonest dated first, then undated. */
export function nextReadyEvent(events) {
  const ready = (events || []).filter((ev) => computeEventState(ev) === 'ready');
  return ready.sort((a, b) => {
    const da = a.event_date ? time(a.event_date) : Infinity;
    const db = b.event_date ? time(b.event_date) : Infinity;
    return da - db;
  })[0] || null;
}

/** The latest changes: stat changes and decisions, newest first. */
export function recentActivity(stateHistory, decisions, limit = 5) {
  const items = [
    ...(stateHistory || []).map((h) => ({
      key: `h-${h.id || h.created_at}`,
      at: h.created_at,
      text: `${h.episode_title || 'An episode'} changed Lala's stats`,
    })),
    ...(decisions || []).map((d) => ({
      key: `d-${d.id || d.created_at}`,
      at: d.created_at,
      text: `Decision: ${String(d.type || 'recorded').replace(/_/g, ' ')}`,
    })),
  ];
  return items.sort((a, b) => time(b.at) - time(a.at)).slice(0, limit);
}

function useNextSlot(showId) {
  const [state, setState] = useState({ loading: true, slot: null, failed: false });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, failed: false }));
    try {
      const r = await api.get(`/api/v1/world/${showId}/season/roadmap`);
      const roadmap = r.data?.roadmap || null;
      const slots = (roadmap?.phases || []).flatMap((p) => p.slots || []);
      const slot = roadmap?.next_slot_number ? slots.find((s) => s.slot_number === roadmap.next_slot_number) || null : null;
      setState({ loading: false, slot, failed: false, hasSeason: Boolean(roadmap) });
    } catch (err) {
      console.error('[ShowOverview] season roadmap load failed:', err);
      setState({ loading: false, slot: null, failed: true });
    }
  }, [showId]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

export default function ShowOverview({ showId, episodes = [], events = [], stateHistory = [], decisions = [], charState = null, wardrobeCount = 0, goTo = () => {} }) {
  const producing = useMemo(() => episodesInProduction(episodes), [episodes]);
  const attention = useMemo(() => eventsNeedingAttention(events), [events]);
  const nextEvent = useMemo(() => nextReadyEvent(events), [events]);
  const activity = useMemo(() => recentActivity(stateHistory, decisions), [stateHistory, decisions]);
  const next = useNextSlot(showId);
  const isNew = episodes.length === 0 && events.length === 0;
  const stats = Object.entries(charState?.state || {});

  return (
    <div className="sov" data-testid="show-overview">
      {stats.length > 0 && (
        <div className="sov-lala" data-testid="sov-lala">
          <span className="sov-lala-label">Lala now</span>
          {stats.map(([k, v]) => <span key={k} className="sov-chip">{STAT_ICONS[k] || '•'} {String(k).replace(/_/g, ' ')} {v}</span>)}
          <button type="button" className="sov-link" onClick={() => goTo('characters-list')}>Full state &amp; history</button>
        </div>
      )}

      {isNew && (
        <section className="sov-card sov-start" data-testid="sov-first-steps">
          <h2>Start this show</h2>
          <ol>
            <li className={wardrobeCount > 0 ? 'done' : ''}><button type="button" onClick={() => goTo('wardrobe-items')}>Add wardrobe pieces</button></li>
            <li><button type="button" onClick={() => goTo('events')}>Create an event</button></li>
            <li>Start its episode from the event</li>
          </ol>
        </section>
      )}

      <div className="sov-grid">
        <section className="sov-card" data-testid="sov-producing">
          <h2>What you're producing</h2>
          {producing.length === 0 ? (
            <p className="sov-empty">Nothing in production. <Link to={`/shows/${showId}/new-episode`}>New Episode</Link></p>
          ) : (
            <ul className="sov-list">
              {producing.slice(0, 4).map((ep) => (
                <li key={ep.id}>
                  <span className="sov-main">
                    <strong>{ep.episode_number ? `Episode ${ep.episode_number}` : 'Episode'}</strong> · {ep.title || 'Untitled'}
                    <span className="sov-sub">{STATUS_LABEL[ep.status] || ep.status}</span>
                  </span>
                  <Link className="sov-btn" to={`/episodes/${ep.id}`}>Continue</Link>
                </li>
              ))}
            </ul>
          )}
          {producing.length > 4 && <button type="button" className="sov-link" onClick={() => goTo('episodes-production')}>All {producing.length} in production</button>}
        </section>

        <section className="sov-card" data-testid="sov-attention">
          <h2>Needs your attention</h2>
          {attention.length === 0 ? (
            <p className="sov-empty">Nothing needs attention.</p>
          ) : (
            <ul className="sov-list">
              {attention.slice(0, 5).map(({ event, missing }) => (
                <li key={event.id}>
                  <span className="sov-main">
                    <strong>{event.name || 'Untitled event'}</strong>
                    <span className="sov-sub">Missing: {missing.join('; ')}</span>
                  </span>
                  <Link className="sov-btn sov-btn-outline" to={`/shows/${showId}/events/${event.id}`}>Finish setup</Link>
                </li>
              ))}
            </ul>
          )}
          {attention.length > 5 && <button type="button" className="sov-link" onClick={() => goTo('events')}>All {attention.length} events needing setup</button>}
        </section>

        <section className="sov-card" data-testid="sov-next">
          <h2>What comes next</h2>
          <ul className="sov-list">
            <li data-testid="sov-next-event">
              {nextEvent ? (
                <>
                  <span className="sov-main">
                    <strong>{nextEvent.name}</strong>
                    <span className="sov-sub">Ready{nextEvent.event_date ? ` · ${new Date(nextEvent.event_date).toLocaleDateString()}` : ''}</span>
                  </span>
                  <Link className="sov-btn" to={`/shows/${showId}/events/${nextEvent.id}`}>Start Episode</Link>
                </>
              ) : <span className="sov-empty">No event is ready yet.</span>}
            </li>
            <li data-testid="sov-next-slot">
              {next.loading ? <span className="sov-empty">Loading the season…</span>
                : next.failed ? (
                  <span className="sov-empty">Couldn't load the season. <button type="button" className="sov-link" onClick={next.reload}>Retry</button></span>
                ) : next.slot ? (
                  <>
                    <span className="sov-main">
                      <strong>Next slot: {next.slot.label}</strong>
                      {next.slot.intention?.story_purpose && <span className="sov-sub">{next.slot.intention.story_purpose}</span>}
                    </span>
                    <button type="button" className="sov-btn sov-btn-outline" onClick={() => goTo('season')}>Season Plan</button>
                  </>
                ) : <span className="sov-empty">{next.hasSeason ? 'Every slot this season is filled.' : 'No season planned yet.'} <button type="button" className="sov-link" onClick={() => goTo('season')}>Season Plan</button></span>}
            </li>
          </ul>
        </section>

        <section className="sov-card" data-testid="sov-activity">
          <h2>Recently changed</h2>
          {activity.length === 0 ? <p className="sov-empty">Nothing yet.</p> : (
            <ul className="sov-list sov-activity">
              {activity.map((a) => (
                <li key={a.key}>
                  <span className="sov-main">{a.text}</span>
                  <span className="sov-sub">{a.at ? new Date(a.at).toLocaleDateString() : ''}</span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="sov-link" onClick={() => goTo('decisions')}>All activity &amp; decisions</button>
        </section>
      </div>
    </div>
  );
}
