/**
 * The show's release schedule (Evoni, 2026-10-25): "Releases every Sunday at
 * 10:00 AM", when releasing starts, and a pause that keeps it. Every field
 * stays editable. Before a change is saved it shows what moves ("E3 moves
 * from Sun, Nov 15 to Sat, Nov 14"); dates set by hand never move.
 * Props: rs (useReleaseSchedule's result).
 */
import { useEffect, useState } from 'react';
import { CalendarClock, Pause, Play } from 'lucide-react';
import {
  DAY_OPTIONS, DEFAULT_SCHEDULE, PLATFORM_OPTIONS, scheduleSentence, startLine, formatDay, moveText, errorText,
} from '../../lib/releaseSchedule';
import './ReleaseSchedule.css';

const MAX_MOVES = 8;
const FIELDS = ['day', 'time', 'cadence', 'first_release', 'paused', 'platforms'];
const pick = (s) => Object.fromEntries(FIELDS.map((k) => [k, k === 'platforms' ? [...(s?.platforms?.length ? s.platforms : DEFAULT_SCHEDULE.platforms)] : s?.[k] ?? DEFAULT_SCHEDULE[k]]));
const same = (a, b) => FIELDS.every((k) => JSON.stringify(a?.[k] ?? null) === JSON.stringify(b?.[k] ?? null));

/** What the draft would change, fetched while it differs from the saved schedule. */
function useChangePreview(rs, draft, saved, open) {
  const [preview, setPreview] = useState(null);
  const key = JSON.stringify(draft);
  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    if (!open || !draft || (saved && same(draft, saved))) return undefined;
    rs.preview(draft)
      .then((data) => { if (!cancelled) setPreview({ moves: data?.moves || [] }); })
      .catch((err) => { console.error('[ReleaseScheduleEditor] preview failed:', err); if (!cancelled) setPreview({ error: errorText(err) }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, open]);
  return preview;
}

export default function ReleaseScheduleEditor({ rs }) {
  const view = rs.view;
  const saved = view?.schedule ? pick(view.schedule) : null;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const preview = useChangePreview(rs, draft, saved, open);

  const start = () => { setDraft(pick(view?.schedule || view?.suggestion || DEFAULT_SCHEDULE)); setError(null); setOpen(true); };
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const save = async (next = draft) => {
    setSaving(true);
    setError(null);
    try {
      await rs.save(next);
      setOpen(false);
    } catch (err) {
      console.error('[ReleaseScheduleEditor] save failed:', err);
      setError(errorText(err));
    }
    setSaving(false);
  };

  if (!view) {
    return rs.error
      ? <section className="rsch" data-testid="release-schedule"><p className="rsch-error" role="alert">The release schedule did not load: {rs.error}</p></section>
      : null;
  }

  return (
    <section className={`rsch${saved?.paused ? ' is-paused' : ''}`} data-testid="release-schedule" aria-label="Release schedule">
      <div className="rsch-head">
        <CalendarClock size={20} aria-hidden="true" />
        <div className="rsch-head-text">
          {saved ? (
            <>
              <h3 data-testid="release-schedule-sentence">{scheduleSentence(saved)}</h3>
              <p data-testid="release-schedule-start">{startLine(view)}</p>
            </>
          ) : (
            <>
              <h3>No release schedule yet</h3>
              <p>Set the day and time the show releases and each episode&apos;s date fills itself. Suggested: every Sunday at 10:00 AM.</p>
            </>
          )}
        </div>
        {!open && (
          <div className="rsch-actions">
            {saved && (
              <button type="button" className="rsch-btn is-quiet" disabled={saving} onClick={() => save({ ...saved, paused: !saved.paused })}
                data-testid="release-schedule-pause">
                {saved.paused ? <><Play size={14} aria-hidden="true" /> Resume</> : <><Pause size={14} aria-hidden="true" /> Pause</>}
              </button>
            )}
            <button type="button" className="rsch-btn" onClick={start} data-testid="release-schedule-edit">{saved ? 'Edit' : 'Set the schedule'}</button>
          </div>
        )}
      </div>

      {open && draft && (
        <form className="rsch-form" onSubmit={(e) => { e.preventDefault(); save(); }} data-testid="release-schedule-form">
          <div className="rsch-fields">
            <label>
              <span>Day</span>
              <select value={draft.day} onChange={(e) => set({ day: e.target.value })} data-testid="release-schedule-day">
                {DAY_OPTIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </label>
            <label>
              <span>Time (your time)</span>
              <input type="time" value={draft.time} onChange={(e) => set({ time: e.target.value })} required data-testid="release-schedule-time" />
            </label>
            <label>
              <span>How often</span>
              <select value={draft.cadence} onChange={(e) => set({ cadence: e.target.value })}>
                <option value="weekly">Every week</option>
              </select>
            </label>
            <label>
              <span>Starts releasing</span>
              <input type="date" value={draft.first_release || ''} onChange={(e) => set({ first_release: e.target.value || null })} data-testid="release-schedule-first" />
              <small>{draft.first_release ? `The first one goes out on the first ${DAY_OPTIONS.find((d) => d.key === draft.day)?.label} from ${formatDay(draft.first_release)}.` : 'Not releasing yet: dates are previews and nothing warns.'}</small>
            </label>
          </div>
          <fieldset className="rsch-platforms" data-testid="release-schedule-platforms">
            <legend>On the schedule</legend>
            {PLATFORM_OPTIONS.map((p) => {
              const on = draft.platforms.includes(p.key);
              return (
                <label key={p.key} className={on ? 'is-on' : ''}>
                  <input type="checkbox" checked={on} disabled={on && draft.platforms.length === 1}
                    onChange={() => set({ platforms: on ? draft.platforms.filter((k) => k !== p.key) : PLATFORM_OPTIONS.map((o) => o.key).filter((k) => k === p.key || draft.platforms.includes(k)) })}
                    data-testid={`release-schedule-platform-${p.key}`} />
                  <span>{p.label}</span>
                </label>
              );
            })}
            <small>{(() => {
              const off = PLATFORM_OPTIONS.filter((p) => !draft.platforms.includes(p.key)).map((p) => p.label);
              return off.length ? `Not on the schedule: ${off.join(', ')}. They keep their own release times.` : 'Every platform releases on the schedule.';
            })()}</small>
          </fieldset>
          {draft.first_release && (
            <button type="button" className="rsch-link" onClick={() => set({ first_release: null })} data-testid="release-schedule-not-yet">Not releasing yet</button>
          )}
          <label className="rsch-check">
            <input type="checkbox" checked={draft.paused} onChange={(e) => set({ paused: e.target.checked })} data-testid="release-schedule-paused" />
            <span>Pause the schedule (it is kept; no schedule dates until you resume)</span>
          </label>

          {(!saved || !same(draft, saved)) && (
            <div className="rsch-preview" data-testid="release-schedule-preview" aria-live="polite">
              <strong>What this changes</strong>
              {!preview ? <p>Working it out…</p> : preview.error ? <p className="rsch-error">{preview.error}</p>
                : preview.moves.length ? (
                  <ul>
                    {preview.moves.slice(0, MAX_MOVES).map((m) => <li key={m.episode_id}>{moveText(m)}</li>)}
                    {preview.moves.length > MAX_MOVES && <li>and {preview.moves.length - MAX_MOVES} more</li>}
                  </ul>
                ) : <p>No episode&apos;s date changes.</p>}
              <p className="rsch-note">Dates you set by hand stay where they are.</p>
            </div>
          )}

          {error && <p className="rsch-error" role="alert">{error}</p>}
          <div className="rsch-actions">
            <button type="button" className="rsch-btn is-quiet" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="rsch-btn" disabled={saving || (saved && same(draft, saved))} data-testid="release-schedule-save">
              {saving ? 'Saving…' : 'Save schedule'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
