/**
 * Admin › The Pulse › Engine (Task 2968; The Pulse spec §7 "Cost control: a
 * daily generation cap; jobs run through a queue"). Evoni, 2026-10-12: the
 * cap counts AI requests per day, 5 automated and 15 manual (Task 3031);
 * ambient posts ship off until she turns them on. Reads and saves
 * /api/v1/pulse-engine: the two daily limits, the switches, today's
 * requests by lane and by kind, whether the worker runs on this server, the
 * queue and the last jobs. Episodes without posts (Task 3049): a completed
 * episode whose posts were never queued can be queued from here, once.
 *
 * Laid out to Evoni's Engine mock (2026-10-17): the engine's status (read
 * only: PULSE_ENGINE_ENABLED is a server setting, hers), the four numbers,
 * Engine settings with a switch per kind (ambient, comments, storylines,
 * events, voice building), Today's breakdown, the Queue, Events coming up
 * and Last jobs. Styles: PulseEngine.css (pe-*).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Clock, FileText, Layers, ListChecks, RefreshCw, Settings2, Zap,
} from 'lucide-react';
import api from '../../services/api';
import './PulseEngine.css';

const STATUS_LABELS = { queued: 'Waiting', running: 'Running', done: 'Done', failed: 'Failed', skipped: 'Skipped' };
const KIND_LABELS = { event: 'Event post', ambient: 'Ambient post', comment: 'Comment', dm: 'DM', storyline: 'Storyline beat', voice: 'Voice build', moment: 'World moment' };
const LIMIT_MAX = 100;

// The switches, in the mock's order (ambient first: it was the only one).
export const SWITCHES = [
  { key: 'ambient_enabled', label: 'Ambient posts', on: 'Characters post now and then between events, within half the automated requests.', off: 'Off: only events trigger posts. Turn on when you are happy with the voices.' },
  { key: 'comments_enabled', label: 'Comment posts', on: 'Characters reply to the posts the engine drafts.', off: 'Off: no replies are drafted; queued ones wait until it is on.' },
  { key: 'storylines_enabled', label: 'Storyline posts', on: 'Planned storyline beats are drafted when they come due.', off: 'Off: beats wait, planned, until it is on.' },
  { key: 'events_enabled', label: 'Event posts', on: "A completed episode's event posts are drafted automatically.", off: 'Off: completed episodes wait under Episodes without posts for you to queue.' },
  { key: 'voices_enabled', label: 'Voice building', on: 'The engine builds the voice of each new Active character.', off: 'Off: new characters wait; build their voices yourself in Voices.' },
];

// Today's requests by kind (services/pulseRequests kinds), in the mock's rows.
export const BREAKDOWN = {
  automated: [
    { label: 'Events', kinds: ['event'] }, { label: 'Ambient', kinds: ['ambient'] }, { label: 'Comments', kinds: ['comment', 'comments'] },
    { label: 'Storylines', kinds: ['storyline'] }, { label: 'Voice building', kinds: ['voice'] },
  ],
  manual: [
    { label: 'DMs', kinds: ['dm'] }, { label: 'Draft reactions', kinds: ['reactions'] }, { label: 'Redrafts', kinds: ['redraft'] },
    { label: 'Rebuild voices', kinds: ['voice'] }, { label: 'Storyline suggestions', kinds: ['suggestions'] },
    { label: 'Character and episode posts', kinds: ['character_posts', 'episode_posts'] },
  ],
};

/** Today's requests against the limits, in words. */
export function todayText(state) {
  const used = state.requests_today || { automated: 0, manual: 0 };
  return `Today: ${used.automated} of ${state.settings.automated_requests} automated, ${used.manual} of ${state.settings.manual_requests} manual.`;
}

/** A lane's rows: each with its count; kinds no row names are summed as Other. */
export function breakdownRows(lane, byKind = {}) {
  const counts = byKind[lane] || {};
  const named = new Set(BREAKDOWN[lane].flatMap((r) => r.kinds));
  const rows = BREAKDOWN[lane].map((r) => ({ label: r.label, n: r.kinds.reduce((sum, k) => sum + (counts[k] || 0), 0) }));
  const other = Object.entries(counts).filter(([k]) => !named.has(k)).reduce((sum, [, n]) => sum + n, 0);
  return other ? [...rows, { label: 'Other', n: other }] : rows;
}

const validLimit = (text) => /^\d+$/.test(String(text).trim()) && Number(text) <= LIMIT_MAX;
const episodeName = (e) => `Episode ${e.episode_number ?? '?'}${e.title ? `, ${e.title}` : ''}`;
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const eventWhen = (e) => {
  if (!e.event_date) return null;
  const d = new Date(`${String(e.event_date).slice(0, 10)}T12:00:00`);
  const date = Number.isNaN(d.getTime()) ? String(e.event_date) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return e.event_time ? `${date} · ${e.event_time}` : date;
};
const pct = (used, limit) => (limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0);

function Stat({ Icon, value, label, sub, bar, testId }) {
  return (
    <div className="pe-stat" data-testid={testId}>
      <div className="pe-stat-top">
        <span className="pe-stat-icon" aria-hidden="true"><Icon size={22} /></span>
        <span className="pe-stat-text"><span className="pe-stat-value">{value}</span><span className="pe-stat-label">{label}</span></span>
      </div>
      {bar !== undefined && <span className="pe-bar" aria-hidden="true"><span style={{ width: `${bar}%` }} /></span>}
      <span className="pe-stat-sub">{sub}</span>
    </div>
  );
}

function Lane({ title, used, limit, rows }) {
  return (
    <div className="pe-lane">
      <span className="pe-lane-title">{title}</span>
      <span className="pe-lane-value"><b>{used}</b> / {limit}</span>
      <span className="pe-bar" aria-hidden="true"><span style={{ width: `${pct(used, limit)}%` }} /></span>
      <ul>{rows.map((r) => <li key={r.label}><span>{r.label}</span><b>{r.n}</b></li>)}</ul>
    </div>
  );
}

export default function PulseEngine({ showId }) {
  const [state, setState] = useState(null);
  const [limits, setLimits] = useState({ automated: '', manual: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  const apply = (data) => {
    setState(data);
    setLimits({ automated: String(data.settings.automated_requests), manual: String(data.settings.manual_requests) });
  };
  const load = useCallback(async () => {
    try {
      const res = await api.get(`/api/v1/pulse-engine?show_id=${encodeURIComponent(showId)}`);
      apply(res.data); setError(null);
    } catch (err) {
      console.error('[PulseEngine] the engine could not be read:', err.response?.status || err.message);
      setError('The engine could not be loaded.');
    }
  }, [showId]);
  useEffect(() => { load(); }, [load]);

  const save = async (fields, label) => {
    setBusy(true); setError(null);
    try {
      const res = await api.put('/api/v1/pulse-engine', { show_id: showId, ...fields });
      apply(res.data);
    } catch (err) {
      console.error(`[PulseEngine] ${label} failed:`, err.response?.status || err.message);
      setError(err.response?.data?.error || `${label} failed.`);
    } finally { setBusy(false); }
  };

  const queuePosts = async (episode) => {
    setBusy(true); setError(null); setNote(null);
    try {
      const res = await api.post(`/api/v1/pulse-engine/episodes/${episode.id}/queue`, { show_id: showId });
      apply(res.data);
      setNote(res.data.queued
        ? `Queued ${res.data.posts} post${res.data.posts === 1 ? '' : 's'} for ${episodeName(episode)}.`
        : res.data.message || 'No one would post about it.');
    } catch (err) {
      console.error('[PulseEngine] queueing the posts failed:', err.response?.status || err.message);
      setError(err.response?.data?.error || 'Queueing the posts failed.');
    } finally { setBusy(false); }
  };

  // Draft an episode's event posts before it is completed (step 6b): they all wait in Review.
  const draftEarly = async (episode) => {
    setBusy(true); setError(null); setNote(null);
    try {
      const res = await api.post(`/api/v1/pulse-engine/episodes/${episode.id}/draft-event`, { show_id: showId });
      apply(res.data);
      setNote(res.data.queued
        ? `Drafting ${res.data.posts} post${res.data.posts === 1 ? '' : 's'} about ${episode.event_name || 'its event'} for ${episodeName(episode)}. They wait in Review.`
        : res.data.message || 'No one would post about it.');
    } catch (err) {
      console.error('[PulseEngine] drafting the event posts failed:', err.response?.status || err.message);
      setError(err.response?.data?.error || 'Drafting the event posts failed.');
    } finally { setBusy(false); }
  };

  if (!state) return error ? <p className="pe-error" role="alert">{error}</p> : <p className="pe-muted">Loading the engine…</p>;

  const { settings } = state;
  const used = state.requests_today || { automated: 0, manual: 0 };
  const limitsValid = validLimit(limits.automated) && validLimit(limits.manual);
  const limitsChanged = limitsValid
    && (Number(limits.automated) !== settings.automated_requests || Number(limits.manual) !== settings.manual_requests);
  const running = state.worker_enabled;
  const waiting = state.jobs_waiting ?? (state.queue || []).length;

  return (
    <div className="pe" data-testid="pulse-engine">
      <section className="pe-card pe-head" aria-labelledby="pe-heading">
        <span className="pe-head-icon" aria-hidden="true"><Settings2 size={24} /></span>
        <div className="pe-head-text">
          <h3 id="pe-heading">Posting Engine</h3>
          <p className="pe-muted">Drafts posts for events, ambient moments, comments, storylines and character voices. Every draft waits in Review or goes through the quality gate.</p>
        </div>
        <span className={running ? 'pe-status is-on' : 'pe-status'} data-testid="pe-status">
          <span className="pe-dot" aria-hidden="true" />
          <span><b>{running ? 'Engine is running' : 'Engine is off'}</b><span>{running ? 'On this server' : 'A server setting'}</span></span>
        </span>
        {!running && (
          <p className="pe-warning" data-testid="pulse-engine-off">
            <AlertTriangle size={18} aria-hidden="true" />
            <span><b>The posting engine isn't running on this server yet.</b> Jobs wait in the queue until it is switched on (PULSE_ENGINE_ENABLED, a server setting).</span>
          </p>
        )}
      </section>

      <div className="pe-stats">
        <Stat Icon={Zap} testId="pe-stat-automated" value={`${used.automated} / ${settings.automated_requests}`} label="Automated today"
          bar={pct(used.automated, settings.automated_requests)} sub={`Daily limit: ${settings.automated_requests}`} />
        <Stat Icon={FileText} testId="pe-stat-manual" value={`${used.manual} / ${settings.manual_requests}`} label="Manual today"
          bar={pct(used.manual, settings.manual_requests)} sub={`Daily limit: ${settings.manual_requests}`} />
        <Stat Icon={Clock} testId="pe-stat-waiting" value={waiting} label="Pending in queue"
          sub={waiting ? (running ? 'Running in turn' : 'Waiting for the engine to start') : 'Nothing waiting'} />
        <Stat Icon={CheckCircle2} testId="pe-stat-done" value={state.jobs_done_today ?? 0} label="Completed today"
          sub={`${state.drafts_today ?? 0} draft${state.drafts_today === 1 ? '' : 's'} made today`} />
      </div>

      <div className="pe-grid">
        <section className="pe-card" aria-labelledby="pe-settings-heading">
          <h3 id="pe-settings-heading" className="pe-h3"><Settings2 size={18} aria-hidden="true" /> Engine settings</h3>
          <form className="pe-limits" onSubmit={(e) => {
            e.preventDefault();
            if (limitsChanged) save({ automated_requests: Number(limits.automated), manual_requests: Number(limits.manual) }, 'Saving the limits');
          }}>
            <label htmlFor="pulse-engine-automated">Automated requests a day</label>
            <input id="pulse-engine-automated" type="number" inputMode="numeric" min="0" max={LIMIT_MAX} step="1" value={limits.automated}
              onChange={(e) => setLimits((l) => ({ ...l, automated: e.target.value }))} />
            <label htmlFor="pulse-engine-manual">Manual requests a day</label>
            <input id="pulse-engine-manual" type="number" inputMode="numeric" min="0" max={LIMIT_MAX} step="1" value={limits.manual}
              onChange={(e) => setLimits((l) => ({ ...l, manual: e.target.value }))} />
            <button type="submit" className="pe-btn is-primary" disabled={busy || !limitsChanged}>Save changes</button>
          </form>
          <ul className="pe-switches">
            {SWITCHES.map((sw) => {
              const on = settings[sw.key] !== false;
              return (
                <li key={sw.key}>
                  <label className="pe-switch">
                    <input type="checkbox" role="switch" checked={on} disabled={busy} aria-label={sw.label}
                      onChange={(e) => save({ [sw.key]: e.target.checked }, `Switching ${sw.label.toLowerCase()}`)} />
                    <span className="pe-switch-track" aria-hidden="true" />
                    <span className="pe-switch-text">
                      <b>{sw.label} {on ? 'on' : 'off'}</b>
                      <span>{on ? sw.on : sw.off}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {error && <p className="pe-error" role="alert">{error}</p>}
        </section>

        <div className="pe-col">
          <section className="pe-card" aria-labelledby="pe-breakdown-heading">
            <h3 id="pe-breakdown-heading" className="pe-h3"><BarChart3 size={18} aria-hidden="true" /> Today's breakdown</h3>
            <p className="pe-muted" data-testid="pulse-engine-today">{todayText(state)}</p>
            <div className="pe-lanes">
              <Lane title="Automated requests" used={used.automated} limit={settings.automated_requests} rows={breakdownRows('automated', state.requests_by_kind)} />
              <Lane title="Manual requests" used={used.manual} limit={settings.manual_requests} rows={breakdownRows('manual', state.requests_by_kind)} />
            </div>
            <p className="pe-muted pe-small">
              A request is one drafting call, a regeneration included; the quality check and viewing saved drafts take none.
              The day resets at midnight UTC, and every AI call also stays inside the overall daily AI budget.
            </p>
          </section>

          <section className="pe-card" aria-labelledby="pe-queue-heading" data-testid="pe-queue">
            <div className="pe-card-head">
              <h3 id="pe-queue-heading" className="pe-h3"><Layers size={18} aria-hidden="true" /> Queue <span className="pe-count">{waiting} waiting</span></h3>
              <button type="button" className="pe-btn" disabled={busy} onClick={load}><RefreshCw size={16} aria-hidden="true" />Refresh</button>
            </div>
            {(state.queue || []).length === 0 ? (
              <p className="pe-empty"><Clock size={20} aria-hidden="true" /><b>No jobs in the queue</b><span>Jobs appear here when content is queued, and run when the engine is running.</span></p>
            ) : (
              <ul className="pe-jobs">
                {state.queue.map((j) => (
                  <li key={j.id}>
                    <span className={`pe-job-status is-${j.status}`}>{STATUS_LABELS[j.status] || j.status}</span>
                    <span>{KIND_LABELS[j.kind] || j.kind}</span>
                    <span className="pe-muted">{when(j.run_after || j.created_at)}</span>
                    {j.error && <span className="pe-why">{j.error}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {note && <p className="pe-note" role="status" data-testid="pulse-engine-note">{note}</p>}

      <div className="pe-grid">
        <div className="pe-col">
          {state.episodes_with_draft_events?.length > 0 && (
            <section className="pe-card" aria-label="Events not yet in a completed episode" data-testid="pulse-engine-draft-events">
              <h3 className="pe-h3"><CalendarDays size={18} aria-hidden="true" /> Events coming up</h3>
              <p className="pe-muted">Draft the event's posts now so the script can use them. Every draft waits in Review, and completing the episode won't queue them again.</p>
              <ul className="pe-events">
                {state.episodes_with_draft_events.map((e) => (
                  <li key={e.id}>
                    {e.image_url ? <img src={e.image_url} alt="" /> : <span className="pe-event-img" aria-hidden="true"><CalendarDays size={22} /></span>}
                    <span className="pe-event-text">
                      <span className="pe-muted">Episode {e.episode_number ?? '?'}</span>
                      <b>{e.title || episodeName(e)}</b>
                      {(e.event_name || e.venue_name) && <span className="pe-muted">{[e.event_name, e.venue_name].filter(Boolean).join(' · ')}</span>}
                      {eventWhen(e) && <span className="pe-muted">{eventWhen(e)}</span>}
                    </span>
                    <button type="button" className="pe-btn is-primary" disabled={busy} onClick={() => draftEarly(e)}>Draft event posts</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {state.episodes_without_posts?.length > 0 && (
            <section className="pe-card" aria-label="Episodes without posts" data-testid="pulse-engine-episodes">
              <h3 className="pe-h3"><ListChecks size={18} aria-hidden="true" /> Episodes without posts</h3>
              <p className="pe-muted">Completed, but their event posts were never queued: the engine was off, event posts were switched off, or the day's requests were used. Queueing takes no request now; each batch takes one when it drafts.</p>
              <ul className="pe-jobs">
                {state.episodes_without_posts.map((e) => (
                  <li key={e.id}>
                    <span>{episodeName(e)}</span>
                    <button type="button" className="pe-btn" disabled={busy} onClick={() => queuePosts(e)}>Queue its posts</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section className="pe-card" aria-labelledby="pe-jobs-heading">
          <h3 id="pe-jobs-heading" className="pe-h3"><Clock size={18} aria-hidden="true" /> Last jobs</h3>
          {state.jobs.length === 0 ? (
            <p className="pe-empty"><Clock size={20} aria-hidden="true" /><b>No jobs yet.</b><span>Finished posts, voice builds and other engine jobs appear here.</span></p>
          ) : (
            <ul className="pe-jobs" data-testid="pulse-engine-jobs">
              {state.jobs.map((j) => (
                <li key={j.id}>
                  <span className={`pe-job-status is-${j.status}`}>{STATUS_LABELS[j.status] || j.status}</span>
                  <span>{KIND_LABELS[j.kind] || j.kind}{j.drafts ? ` · ${j.drafts} draft${j.drafts === 1 ? '' : 's'}` : ''}</span>
                  <span className="pe-muted">{when(j.finished_at || j.created_at)}</span>
                  {j.error && <span className="pe-why">{j.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
