/**
 * Producer Mode → Overview, to Evoni's redesign (her mock, 2026-10-05; the
 * four questions of 2026-10-03 kept). It opens on the one next step, then:
 *   - Now producing: the first episode in production, with the episode's own
 *     production checklist (loadProductionChecks, the same checks as its
 *     Production tab), Continue, the script and the phone; the rest in
 *     production listed under it;
 *   - Needs your attention: events whose setup is incomplete;
 *   - Recently changed: a short activity list;
 *   - beside them, Lala now (her stats), the episode's money (the linked
 *     event's forecast), and up next (the season's next slot and the next
 *     ready event).
 * A brand-new show sees the first steps instead of a next step.
 *
 * Props: showId, episodes, events, stateHistory, decisions, charState,
 * wardrobeCount, goTo(tabKey) to open a Producer Mode section.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { computeEventPackageReadiness, computeEventState, describeMissing } from '../../utils/eventReadinessSections';
import { CHECKLIST_SECTIONS, computeSectionState, checklistFixTarget, loadProductionChecks } from '../Episodes/EpisodeProductionChecklist';

export const IN_PRODUCTION = ['draft', 'scripted', 'in_build', 'in_review'];
const STATUS_LABEL = { draft: 'Draft', scripted: 'Scripted', in_build: 'In build', in_review: 'In review' };
const STAT_LABEL = { coins: 'Coins', reputation: 'Reputation', brand_trust: 'Brand Trust', influence: 'Influence', stress: 'Stress' };
const STAT_ORDER = ['coins', 'reputation', 'brand_trust', 'influence', 'stress'];

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

/** The checklist's sections that report a state (all of them since the checklist fixes, 2026-10-07; a section may still set unavailableReason). */
const LIVE_SECTIONS = CHECKLIST_SECTIONS.filter((sec) => !sec.unavailableReason);

/**
 * The checklist at a glance: items done of all items, and each section's
 * state with a short label: "Complete", "Not started" when nothing in it is
 * done, else its required items done ("0 of 1" while only optional items
 * are), or all its items for a section with none required.
 */
export function checklistSummary(checks) {
  const items = LIVE_SECTIONS.flatMap((sec) => sec.items);
  const done = items.filter((item) => checks[item.id]).length;
  const sections = LIVE_SECTIONS.map((sec) => {
    const { state } = computeSectionState(sec, checks);
    const required = sec.items.filter((item) => item.required);
    const counted = required.length ? required : sec.items;
    const n = counted.filter((item) => checks[item.id]).length;
    const label = state === 'complete' ? 'Complete' : state === 'needs_setup' ? 'Not started' : `${n} of ${counted.length}`;
    return { id: sec.id, title: sec.label, state, label };
  });
  return { done, total: items.length, sections };
}

/**
 * The one next step: the first production step still missing a required
 * item on the episode in production, else that episode's script; with
 * nothing in production, the next ready event, then the first event needing
 * setup, then the season. Null for a brand-new show (it sees its first
 * steps). An action is { href, label } or { goTo, label }.
 */
export function nextStepFor({ showId, producing = [], checks = null, attention = [], nextEvent = null, isNew = false }) {
  if (isNew) return null;
  const ep = producing[0];
  if (ep) {
    const name = ep.episode_number ? `Episode ${ep.episode_number}` : 'this episode';
    const open = { href: `/episodes/${ep.id}`, label: 'Continue episode' };
    if (!checks) return { title: `Continue ${name}`, detail: ep.title || '', action: open };
    for (const sec of LIVE_SECTIONS) {
      const missing = sec.items.filter((item) => item.required && !checks[item.id]);
      if (!missing.length) continue;
      const target = checklistFixTarget(missing[0].id, { episode: ep, showId });
      return {
        title: `Finish ${sec.label} for ${name}`,
        detail: `Still needed: ${missing.map((item) => item.label.toLowerCase()).join('; ')}.`,
        action: target ? { href: target.href, label: target.label || 'Open' } : open,
      };
    }
    return { title: `${name} is ready for its script`, detail: 'Every required production step is done.', action: { href: `/episodes/${ep.id}?tab=scripts`, label: 'Open the script' } };
  }
  if (nextEvent) {
    return { title: `Start an episode from ${nextEvent.name || 'the next event'}`, detail: 'The event is ready: every setup step is done.', action: { href: `/shows/${showId}/events/${nextEvent.id}`, label: 'Start Episode' } };
  }
  if (attention.length) {
    const { event, missing } = attention[0];
    return { title: `Finish setting up ${event.name || 'an event'}`, detail: `Missing: ${missing.join('; ')}.`, action: { href: `/shows/${showId}/events/${event.id}`, label: 'Finish setup' } };
  }
  return { title: 'Plan the season', detail: 'Nothing is in production and no event is waiting.', action: { goTo: 'season', label: 'Season Plan' } };
}

function useProductionChecks(episode, showId) {
  const [state, setState] = useState({ loading: Boolean(episode), checks: null, linkedEvent: null });
  useEffect(() => {
    if (!episode?.id) { setState({ loading: false, checks: null, linkedEvent: null }); return undefined; }
    let cancelled = false;
    setState({ loading: true, checks: null, linkedEvent: null });
    loadProductionChecks(episode, showId).then(({ checks, linkedEvent }) => {
      if (!cancelled) setState({ loading: false, checks, linkedEvent });
    });
    return () => { cancelled = true; };
  }, [episode?.id, showId]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

/** The linked event's money forecast: what the deal pays, the look, the spending, the balance after. */
function useEventForecast(showId, eventId) {
  const [state, setState] = useState({ loading: false, forecast: null, failed: false });
  const load = useCallback(async () => {
    if (!eventId) { setState({ loading: false, forecast: null, failed: false }); return; }
    setState({ loading: true, forecast: null, failed: false });
    try {
      const r = await api.get(`/api/v1/world/${showId}/events/${eventId}/financial-forecast`);
      setState({ loading: false, forecast: r.data?.success === false ? null : r.data, failed: r.data?.success === false });
    } catch (err) {
      console.error('[ShowOverview] financial forecast load failed:', err);
      setState({ loading: false, forecast: null, failed: true });
    }
  }, [showId, eventId]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

const coins = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString() : '—');

function Action({ action, goTo, className }) {
  if (!action) return null;
  if (action.goTo) return <button type="button" className={className} onClick={() => goTo(action.goTo)}>{action.label}</button>;
  return <Link className={className} to={action.href}>{action.label}</Link>;
}

function NowProducing({ showId, producing, checksState }) {
  const ep = producing[0];
  if (!ep) {
    return (
      <section className="sov-card sov-now" data-testid="sov-producing">
        <span className="sov-eyebrow">Now producing</span>
        <p className="sov-empty">Nothing in production. <Link to={`/shows/${showId}/new-episode`}>New Episode</Link></p>
      </section>
    );
  }
  const summary = checksState.checks ? checklistSummary(checksState.checks) : null;
  const pct = summary && summary.total ? Math.round((summary.done / summary.total) * 100) : 0;
  return (
    <section className="sov-card sov-now" data-testid="sov-producing">
      <div className="sov-now-head">
        <span className="sov-eyebrow">Now producing</span>
        <span className="sov-status">{STATUS_LABEL[ep.status] || ep.status}</span>
        <span className="sov-now-where">
          {ep.season_number ? `Season ${ep.season_number} · ` : ''}{ep.episode_number ? `Episode ${ep.episode_number}` : 'Episode'}
        </span>
      </div>
      <h2 className="sov-now-title">{ep.title || 'Untitled'}</h2>
      {(ep.logline || ep.description) && <p className="sov-now-logline">{ep.logline || ep.description}</p>}

      <div className="sov-checklist" data-testid="sov-checklist">
        <div className="sov-checklist-head">
          <span>Production checklist</span>
          <span>{summary ? <><strong>{summary.done}</strong> of {summary.total}</> : checksState.loading ? 'Checking…' : ''}</span>
        </div>
        <div className="sov-bar" role="progressbar" aria-label="Production checklist" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="sov-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        {summary && (
          <ul className="sov-steps">
            {summary.sections.map((sec) => (
              <li key={sec.id} className={`sov-step ${sec.state}`}>
                <span className="sov-step-title">{sec.title}</span>
                <span className="sov-step-state">{sec.label}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="sov-note">The same checklist as the episode's <Link to={`/episodes/${ep.id}?tab=checklist`}>Production tab</Link>.</p>
      </div>

      <div className="sov-actions">
        <Link className="sov-btn sov-btn-lg" to={`/episodes/${ep.id}`}>Continue episode</Link>
        <Link className="sov-link" to={`/episodes/${ep.id}?tab=scripts`}>Open script</Link>
        <Link className="sov-link" to={`/episodes/${ep.id}?tab=phone`}>Lala's Phone</Link>
      </div>

      {producing.length > 1 && (
        <div className="sov-also">
          <span className="sov-eyebrow">Also in production</span>
          <ul className="sov-list">
            {producing.slice(1, 4).map((other) => (
              <li key={other.id}>
                <span className="sov-main">
                  <strong>{other.episode_number ? `Episode ${other.episode_number}` : 'Episode'}</strong> · {other.title || 'Untitled'}
                  <span className="sov-sub">{STATUS_LABEL[other.status] || other.status}</span>
                </span>
                <Link className="sov-btn sov-btn-outline" to={`/episodes/${other.id}`}>Continue</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function EpisodeMoney({ episode, showId, linkedEvent, checksLoading, goTo }) {
  const { loading, forecast, failed, reload } = useEventForecast(showId, linkedEvent?.id);
  const name = episode.episode_number ? `Episode ${episode.episode_number}` : 'This episode';
  const look = (forecast?.expenses?.outfit_retail || 0) + (forecast?.expenses?.outfit_rentals || 0);
  const spending = Math.max(0, (forecast?.expenses?.total || 0) - look);
  return (
    <section className="sov-card sov-money" data-testid="sov-money">
      <span className="sov-eyebrow">{name} money</span>
      {checksLoading || loading ? <p className="sov-empty">Working out the money…</p>
        : !linkedEvent ? <p className="sov-empty">No event is linked to this episode yet, so there is no deal to count. <button type="button" className="sov-link" onClick={() => goTo('events')}>Events</button></p>
          : failed || !forecast ? <p className="sov-empty">Couldn't work out the money. <button type="button" className="sov-link" onClick={reload}>Retry</button></p>
            : (
              <dl className="sov-ledger">
                <div><dt>Deal pays <span>(at Complete)</span></dt><dd className="plus">+{coins(forecast.income?.total)}</dd></div>
                <div><dt>Lala's look</dt><dd className="minus">−{coins(look)}</dd></div>
                <div><dt>Event spending</dt><dd className="minus">−{coins(spending)}</dd></div>
                <div className="sov-ledger-total"><dt>Coins after this episode</dt><dd>{coins(forecast.projected_balance?.baseline)}</dd></div>
              </dl>
            )}
      <button type="button" className="sov-link" onClick={() => goTo('finances')}>Open the Money tab</button>
    </section>
  );
}

export default function ShowOverview({ showId, episodes = [], events = [], stateHistory = [], decisions = [], charState = null, wardrobeCount = 0, goTo = () => {} }) {
  const producing = useMemo(() => episodesInProduction(episodes), [episodes]);
  const attention = useMemo(() => eventsNeedingAttention(events), [events]);
  const nextEvent = useMemo(() => nextReadyEvent(events), [events]);
  const activity = useMemo(() => recentActivity(stateHistory, decisions), [stateHistory, decisions]);
  const next = useNextSlot(showId);
  const isNew = episodes.length === 0 && events.length === 0;
  const checksState = useProductionChecks(producing[0] || null, showId);
  const step = nextStepFor({ showId, producing, checks: checksState.checks, attention, nextEvent, isNew });
  const state = charState?.state || {};
  const stats = [...STAT_ORDER.filter((k) => k in state), ...Object.keys(state).filter((k) => !STAT_ORDER.includes(k))];

  return (
    <div className="sov" data-testid="show-overview">
      {step && (
        <div className="sov-next-step" data-testid="sov-next-step">
          <span className="sov-next-step-icon" aria-hidden="true">→</span>
          <div className="sov-next-step-text">
            <span className="sov-next-step-label">Your next step</span>
            <strong>{step.title}</strong>
            {step.detail && <span>{step.detail}</span>}
          </div>
          <Action action={step.action} goTo={goTo} className="sov-next-step-btn" />
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

      <div className="sov-layout">
        <div className="sov-col">
          <NowProducing showId={showId} producing={producing} checksState={checksState} />

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

        <aside className="sov-side">
          {stats.length > 0 && (
            <section className="sov-card sov-lala" data-testid="sov-lala">
              <div className="sov-side-head">
                <span className="sov-eyebrow">Lala now</span>
                <button type="button" className="sov-link" onClick={() => goTo('characters-list')}>History</button>
              </div>
              <div className="sov-stats">
                {stats.map((k) => (
                  <div key={k} className="sov-stat">
                    <span className="sov-stat-label">{STAT_LABEL[k] || String(k).replace(/_/g, ' ')}</span>
                    <span className="sov-stat-value">{k === 'coins' ? coins(state[k]) : state[k]}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {producing[0] && (
            <EpisodeMoney episode={producing[0]} showId={showId} linkedEvent={checksState.linkedEvent} checksLoading={checksState.loading} goTo={goTo} />
          )}

          <section className="sov-card" data-testid="sov-next">
            <span className="sov-eyebrow">Up next</span>
            <ul className="sov-list">
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
              <li data-testid="sov-next-event">
                {nextEvent ? (
                  <>
                    <span className="sov-main">
                      <strong>{nextEvent.name}</strong>
                      <span className="sov-sub">Ready{nextEvent.event_date ? ` · ${new Date(nextEvent.event_date).toLocaleDateString()}` : ''}</span>
                    </span>
                    <Link className="sov-btn" to={`/shows/${showId}/events/${nextEvent.id}`}>Start Episode</Link>
                  </>
                ) : (
                  <span className="sov-empty">No event is ready yet. <button type="button" className="sov-link" onClick={() => goTo('events')}>Pick an event</button></span>
                )}
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
