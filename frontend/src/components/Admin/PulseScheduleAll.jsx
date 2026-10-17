/**
 * Schedule all (Evoni, 2026-10-17: "Yes I want them all"): Review's drafts
 * with no release time, each at the time the story suggests
 * (GET /feed-posts/release-plan, services/postRelease planReleases), in
 * story order. She sees the plan, changes any time, and schedules them
 * (POST /feed-posts/release-plan). A time that breaks the story order (a
 * load-bearing post after its episode airs, a reply before its post, a
 * post before its reveal) says what it breaks; those are skipped until she
 * chooses "Schedule them anyway". Styles: PulseReviewPost.css.
 */
import React, { useState } from 'react';
import api from '../../services/api';
import { atHandle } from '../../pages/feed/feedConstants';
import { StoryProblems, localInput, tzOffset } from './PulseReviewPost';

export default function PulseScheduleAll({ showId, drafts = 0, onChange }) {
  const [plan, setPlan] = useState(null);
  const [times, setTimes] = useState({});
  const [skipped, setSkipped] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const open = async () => {
    setBusy(true); setError(null); setDone(null); setSkipped({});
    try {
      const res = await api.get(`/api/v1/feed-posts/release-plan?show_id=${encodeURIComponent(showId)}&tz_offset=${tzOffset()}`);
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setPlan(items);
      setTimes(Object.fromEntries(items.map((i) => [i.post_id, localInput(new Date(i.at))])));
    } catch (err) {
      console.error('[PulseScheduleAll] the plan could not be made:', err.response?.status || err.message);
      setError(err.response?.data?.error || 'The plan could not be made.');
    } finally { setBusy(false); }
  };

  const apply = async (anyway) => {
    const items = (anyway ? plan.filter((i) => skipped[i.post_id]) : plan)
      .filter((i) => times[i.post_id])
      .map((i) => ({ post_id: i.post_id, at: new Date(times[i.post_id]).toISOString() }));
    if (!items.length) return;
    setBusy(true); setError(null);
    try {
      const res = await api.post('/api/v1/feed-posts/release-plan', { items, tz_offset: tzOffset(), anyway });
      const scheduled = res.data?.scheduled || [];
      const held = Object.fromEntries((res.data?.skipped || []).map((s) => [s.post_id, s.problems]));
      const failed = res.data?.failed || [];
      setSkipped(held);
      const left = new Set([...Object.keys(held), ...failed.map((f) => f.post_id)]);
      setPlan((p) => p.filter((i) => left.has(i.post_id)));
      setDone({ scheduled: scheduled.length, skipped: Object.keys(held).length, failed });
      if (scheduled.length) onChange?.();
    } catch (err) {
      console.error('[PulseScheduleAll] scheduling failed:', err.response?.status || err.message);
      setError(err.response?.data?.error || 'Scheduling failed.');
    } finally { setBusy(false); }
  };

  if (!plan) {
    return (
      <div className="prv-schedule-all" data-testid="prv-schedule-all">
        <button type="button" className="prv-btn" disabled={busy || !drafts} onClick={open}>
          {busy ? 'Planning…' : 'Schedule all drafts at suggested times'}
        </button>
        {error && <p className="prv-error" role="alert">{error}</p>}
      </div>
    );
  }

  const failedOf = (id) => done?.failed?.find((f) => f.post_id === id)?.error;
  return (
    <div className="prv-schedule-all" data-testid="prv-schedule-all">
      {done && (
        <p className="prv-muted" data-testid="prv-schedule-all-done">
          Scheduled {done.scheduled}.{done.skipped ? ` ${done.skipped} would break the story order: change the time, or schedule them anyway.` : ''}
        </p>
      )}
      {plan.length === 0 ? (
        <p className="prv-muted">{done ? 'Every draft has a release time.' : 'Every draft already has a release time, or is held.'}</p>
      ) : (
        <>
          <p className="prv-muted">Each draft at the time the story suggests, in story order. Change any time before you schedule them.</p>
          <ul className="prv-plain prv-plan">
            {plan.map((i) => (
              <li key={i.post_id} className="prv-plan-item" data-testid="prv-plan-item">
                <span><b>{atHandle(i.handle)}</b>{i.story && <span className="prv-story"> · {i.story}</span>}{i.post_weight === 'load_bearing' && <span className="prv-badge"> load-bearing</span>}</span>
                <span className="prv-plan-text">“{i.text}”</span>
                <span className="prv-release">
                  <input type="datetime-local" aria-label={`Release ${atHandle(i.handle)} on`} value={times[i.post_id] || ''}
                    onChange={(e) => setTimes((t) => ({ ...t, [i.post_id]: e.target.value }))} />
                  <span className="prv-muted">{i.why}</span>
                </span>
                <StoryProblems problems={skipped[i.post_id] || (times[i.post_id] === localInput(new Date(i.at)) ? i.problems : [])} testId="prv-plan-problems" />
                {failedOf(i.post_id) && <p className="prv-error" role="alert">{failedOf(i.post_id)}</p>}
              </li>
            ))}
          </ul>
          <span className="prv-actions">
            <button type="button" className="prv-btn" disabled={busy} onClick={() => apply(false)}>{busy ? 'Scheduling…' : `Schedule ${plan.length === 1 ? 'it' : `these ${plan.length}`}`}</button>
            {Object.keys(skipped).length > 0 && (
              <button type="button" className="prv-link-btn" disabled={busy} onClick={() => apply(true)}>Schedule them anyway</button>
            )}
          </span>
        </>
      )}
      <button type="button" className="prv-link-btn" disabled={busy} onClick={() => { setPlan(null); setDone(null); }}>Close</button>
      {error && <p className="prv-error" role="alert">{error}</p>}
    </div>
  );
}
