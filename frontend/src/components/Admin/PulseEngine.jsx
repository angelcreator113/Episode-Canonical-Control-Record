/**
 * Admin › The Pulse › Engine (Task 2968; The Pulse spec §7 "Cost control: a
 * daily generation cap; jobs run through a queue"). Evoni, 2026-10-12: the
 * cap counts drafts per day; ambient posts ship off until she turns them
 * on. Reads and saves /api/v1/pulse-engine: the daily draft cap, the
 * ambient switch, drafts made today against the cap, whether the worker
 * runs on this server, and the last jobs.
 * Styles: AdminPanel.css (pulse-engine-*).
 */
import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';

const STATUS_LABELS = { queued: 'Waiting', running: 'Running', done: 'Done', failed: 'Failed', skipped: 'Skipped' };
const KIND_LABELS = { event: 'Event post', ambient: 'Ambient post', comment: 'Comment' };
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

export default function PulseEngine({ showId }) {
  const [state, setState] = useState(null);
  const [cap, setCap] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const apply = (data) => { setState(data); setCap(String(data.settings.daily_draft_cap)); };
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
  const capValid = /^\d+$/.test(cap.trim()) && Number(cap) <= 500;
  const capChanged = capValid && Number(cap) !== settings.daily_draft_cap;

  return (
    <div className="pulse-engine" data-testid="pulse-engine">
      {!state.worker_enabled && (
        <p className="pulse-engine-note" data-testid="pulse-engine-off">
          The posting engine isn't running on this server yet. Jobs wait in the queue until it is switched on (PULSE_ENGINE_ENABLED, a server setting).
        </p>
      )}
      <section className="pulse-engine-card" aria-label="Today">
        <h3>Today</h3>
        <p className="pulse-engine-today" data-testid="pulse-engine-today">
          <b>{state.drafts_today}</b> of {settings.daily_draft_cap} drafts made · {state.cap_left} left
        </p>
        <p className="pulse-engine-muted">The day resets at midnight UTC. Every AI call also stays inside the overall daily AI budget.</p>
      </section>
      <section className="pulse-engine-card" aria-label="Settings">
        <h3>Settings</h3>
        <form className="pulse-engine-cap" onSubmit={(e) => { e.preventDefault(); if (capChanged) save({ daily_draft_cap: Number(cap) }, 'Saving the cap'); }}>
          <label htmlFor="pulse-engine-cap">Daily draft cap</label>
          <input id="pulse-engine-cap" type="number" inputMode="numeric" min="0" max="500" step="1" value={cap} onChange={(e) => setCap(e.target.value)} />
          <button type="submit" className="pulse-engine-btn" disabled={busy || !capChanged}>Save</button>
        </form>
        <label className="pulse-engine-switch">
          <input type="checkbox" role="switch" checked={settings.ambient_enabled} disabled={busy}
            onChange={(e) => save({ ambient_enabled: e.target.checked }, 'Switching ambient posts')} />
          <span>Ambient posts {settings.ambient_enabled ? 'on' : 'off'}</span>
        </label>
        <p className="pulse-engine-muted">
          {settings.ambient_enabled
            ? 'Characters post now and then between events, within the daily cap.'
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
                {j.error && j.status !== 'done' && <span className="pulse-engine-why">{j.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
