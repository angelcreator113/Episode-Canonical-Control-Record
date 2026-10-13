/**
 * Admin › The Pulse › Engine (Task 2968; The Pulse spec §7 "Cost control: a
 * daily generation cap; jobs run through a queue"). Evoni, 2026-10-12: the
 * cap counts AI requests per day, 5 automated and 15 manual (Task 3031);
 * ambient posts ship off until she turns them on. Reads and saves
 * /api/v1/pulse-engine: the two daily limits, the ambient switch, today's
 * requests by lane, whether the worker runs on this server, and the last
 * jobs.
 * Styles: AdminPanel.css (pulse-engine-*).
 */
import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';

const STATUS_LABELS = { queued: 'Waiting', running: 'Running', done: 'Done', failed: 'Failed', skipped: 'Skipped' };
const KIND_LABELS = { event: 'Event post', ambient: 'Ambient post', comment: 'Comment', dm: 'DM', storyline: 'Storyline beat' };
const LIMIT_MAX = 100;

/** Today's requests against the limits, in words. */
export function todayText(state) {
  const used = state.requests_today || { automated: 0, manual: 0 };
  return `Today: ${used.automated} of ${state.settings.automated_requests} automated, ${used.manual} of ${state.settings.manual_requests} manual.`;
}

const validLimit = (text) => /^\d+$/.test(String(text).trim()) && Number(text) <= LIMIT_MAX;
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

export default function PulseEngine({ showId }) {
  const [state, setState] = useState(null);
  const [limits, setLimits] = useState({ automated: '', manual: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

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

  if (!state) return error ? <p className="pulse-engine-error" role="alert">{error}</p> : <p className="pulse-engine-muted">Loading the engine…</p>;

  const { settings } = state;
  const limitsValid = validLimit(limits.automated) && validLimit(limits.manual);
  const limitsChanged = limitsValid
    && (Number(limits.automated) !== settings.automated_requests || Number(limits.manual) !== settings.manual_requests);

  return (
    <div className="pulse-engine" data-testid="pulse-engine">
      {!state.worker_enabled && (
        <p className="pulse-engine-note" data-testid="pulse-engine-off">
          The posting engine isn't running on this server yet. Jobs wait in the queue until it is switched on (PULSE_ENGINE_ENABLED, a server setting).
        </p>
      )}
      <section className="pulse-engine-card" aria-label="Today">
        <h3>Today</h3>
        <p className="pulse-engine-today" data-testid="pulse-engine-today">{todayText(state)}</p>
        <p className="pulse-engine-muted">
          A request is one drafting call, a regeneration included; the quality check and viewing saved drafts take none.
          Automated: event, ambient, comment and storyline posts. Manual: DMs, draft reactions, redrafts, building a voice and storyline suggestions.
          The day resets at midnight UTC. Every AI call also stays inside the overall daily AI budget.
        </p>
      </section>
      <section className="pulse-engine-card" aria-label="Settings">
        <h3>Settings</h3>
        <form className="pulse-engine-cap" onSubmit={(e) => {
          e.preventDefault();
          if (limitsChanged) save({ automated_requests: Number(limits.automated), manual_requests: Number(limits.manual) }, 'Saving the limits');
        }}>
          <label htmlFor="pulse-engine-automated">Automated requests a day</label>
          <input id="pulse-engine-automated" type="number" inputMode="numeric" min="0" max={LIMIT_MAX} step="1" value={limits.automated}
            onChange={(e) => setLimits((l) => ({ ...l, automated: e.target.value }))} />
          <label htmlFor="pulse-engine-manual">Manual requests a day</label>
          <input id="pulse-engine-manual" type="number" inputMode="numeric" min="0" max={LIMIT_MAX} step="1" value={limits.manual}
            onChange={(e) => setLimits((l) => ({ ...l, manual: e.target.value }))} />
          <button type="submit" className="pulse-engine-btn" disabled={busy || !limitsChanged}>Save</button>
        </form>
        <label className="pulse-engine-switch">
          <input type="checkbox" role="switch" checked={settings.ambient_enabled} disabled={busy}
            onChange={(e) => save({ ambient_enabled: e.target.checked }, 'Switching ambient posts')} />
          <span>Ambient posts {settings.ambient_enabled ? 'on' : 'off'}</span>
        </label>
        <p className="pulse-engine-muted">
          {settings.ambient_enabled
            ? 'Characters post now and then between events, within half the automated requests.'
            : 'Off: only events trigger posts. Turn on when you are happy with the voices.'}
        </p>
        {error && <p className="pulse-engine-error" role="alert">{error}</p>}
      </section>
      <section className="pulse-engine-card" aria-label="Last jobs">
        <h3>Last jobs</h3>
        {state.jobs.length === 0 ? <p className="pulse-engine-muted">No jobs yet.</p> : (
          <ul className="pulse-engine-jobs" data-testid="pulse-engine-jobs">
            {state.jobs.map((j) => (
              <li key={j.id}>
                <span className={`pulse-engine-status pulse-engine-status-${j.status}`}>{STATUS_LABELS[j.status] || j.status}</span>
                <span>{KIND_LABELS[j.kind] || j.kind}{j.drafts ? ` · ${j.drafts} draft${j.drafts === 1 ? '' : 's'}` : ''}</span>
                <span className="pulse-engine-muted">{when(j.finished_at || j.created_at)}</span>
                {j.error && <span className="pulse-engine-why">{j.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
