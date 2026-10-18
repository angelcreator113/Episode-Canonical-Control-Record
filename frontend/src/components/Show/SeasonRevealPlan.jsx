/**
 * Season Plan › Reveal plan (Evoni, 2026-10-18, stage E of the storytelling
 * plan: the season blueprint). Which kept secret the season hints at or
 * reveals in which episode. Each secret with its path through the season;
 * the plan becomes that episode's permission for the secret when its script
 * and story are written, and the chapter writer reads the whole season to
 * foreshadow what comes later (services/seasonRevealPlan). The plan checks
 * itself: a reveal with no hint before it, a hint after the reveal, a
 * reveal of something the audience already knows.
 *
 * Props: showId, api (the page's client).
 */
import { useCallback, useEffect, useState } from 'react';
import { Eye, X, AlertTriangle, Plus } from 'lucide-react';
import './SeasonRevealPlan.css';

const STATE_LABEL = { hidden: 'Not hinted yet', hinted: 'Hinted', revealed: 'Revealed' };
const errorOf = (err, fallback) => err?.response?.data?.error || fallback;
const BLANK = { slot_id: '', secret_id: '', intent: 'hint', note: '' };

export default function SeasonRevealPlan({ showId, api }) {
  const base = `/api/v1/world/${showId}/season/reveals`;
  const [plan, setPlan] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const load = useCallback(async () => {
    try {
      setPlan((await api.get(base)).data);
    } catch (err) {
      console.error('[SeasonRevealPlan] load failed:', err);
      setPlan({ arc: null, slots: [], secrets: [], reveals: [], warnings: [] });
      setNote({ error: true, text: errorOf(err, 'The reveal plan could not be loaded.') });
    }
  }, [api, base]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, failed, done) => {
    setBusy(true); setNote(null);
    try { setPlan((await fn()).data); if (done) setNote({ text: done }); return true; } catch (err) {
      console.error('[SeasonRevealPlan] request failed:', err);
      setNote({ error: true, text: errorOf(err, failed) });
      return false;
    } finally { setBusy(false); }
  };
  const add = async () => {
    if (await run(() => api.put(base, form), 'It was not added to the plan.', 'Added to the plan.')) setForm((f) => ({ ...BLANK, slot_id: f.slot_id }));
  };
  const remove = (id) => run(() => api.delete(`${base}/${id}`), 'It was not taken out of the plan.');

  if (!plan || !plan.arc) return null;
  const slotById = new Map(plan.slots.map((s) => [s.id, s]));
  const open = plan.slots.filter((s) => !s.done);
  const warnFor = (id) => plan.warnings.filter((w) => w.secret_id === id);

  return (
    <section className="srp-card" aria-labelledby="srp-title" data-testid="season-reveal-plan">
      <header>
        <h3 id="srp-title" className="srp-title"><Eye size={18} aria-hidden="true" /> Reveal plan</h3>
        <p className="srp-about">
          Which secret the season hints at or reveals, and in which episode. When that episode is written its script and
          story follow the plan; the chapter book sees what comes later and foreshadows it without giving it away.
        </p>
      </header>
      {note && <p className={`srp-note${note.error ? ' is-error' : ' is-done'}`} role="status">{note.text}</p>}

      {plan.secrets.length === 0 ? (
        <p className="srp-note">No one in this show keeps a secret yet. Add them in a character&apos;s Inner life, under Secrets.</p>
      ) : (
        <>
          <ul className="srp-secrets" aria-label="Secrets and when the season shows them">
            {plan.secrets.map((s) => {
              const steps = plan.reveals.filter((r) => r.secret_id === s.id);
              return (
                <li key={s.id} className="srp-secret" data-testid={`srp-secret-${s.id}`}>
                  <div className="srp-secret-head">
                    <span className="srp-secret-text"><strong>{s.character_name}:</strong> {s.text}</span>
                    <span className={`srp-state is-${s.state}`}>{STATE_LABEL[s.state] || s.state}</span>
                  </div>
                  {steps.length ? (
                    <ol className="srp-steps">
                      {steps.map((r) => (
                        <li key={r.id} className={`srp-step is-${r.intent}`} data-testid={`srp-step-${r.id}`}>
                          <span>
                            <strong>{r.label}</strong> {r.intent === 'reveal' ? 'Reveal' : 'Hint'}
                            {slotById.get(r.slot_id)?.episode?.title ? ` · ${slotById.get(r.slot_id).episode.title}` : ''}
                            {r.note ? <span className="srp-how"> · {r.note}</span> : null}
                          </span>
                          {!slotById.get(r.slot_id)?.done && (
                            <button type="button" className="srp-x" aria-label={`Take ${r.label} out of the plan`} disabled={busy} onClick={() => remove(r.id)}><X size={14} /></button>
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : <p className="srp-note">Not in the plan yet.</p>}
                  {warnFor(s.id).map((w) => (
                    <p key={w.text} className="srp-warn"><AlertTriangle size={13} aria-hidden="true" /> {w.text}</p>
                  ))}
                </li>
              );
            })}
          </ul>

          <fieldset className="srp-add">
            <legend className="srp-legend">Add to the plan</legend>
            <label className="srp-field">
              <span>Episode</span>
              <select value={form.slot_id} onChange={(e) => setForm((f) => ({ ...f, slot_id: e.target.value }))}>
                <option value="">Choose…</option>
                {open.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}{s.episode?.title ? ` · ${s.episode.title}` : s.story_purpose ? ` · ${s.story_purpose.slice(0, 50)}` : ''}</option>
                ))}
              </select>
            </label>
            <label className="srp-field">
              <span>Secret</span>
              <select value={form.secret_id} onChange={(e) => setForm((f) => ({ ...f, secret_id: e.target.value }))}>
                <option value="">Choose…</option>
                {plan.secrets.map((s) => <option key={s.id} value={s.id}>{s.character_name}: {s.text.slice(0, 70)}</option>)}
              </select>
            </label>
            <label className="srp-field">
              <span>The episode will</span>
              <select value={form.intent} onChange={(e) => setForm((f) => ({ ...f, intent: e.target.value }))}>
                <option value="hint">Hint at it</option>
                <option value="reveal">Reveal it</option>
              </select>
            </label>
            <label className="srp-field is-wide">
              <span>How (optional)</span>
              <input type="text" value={form.note} placeholder="She hides her bare hand from the camera" onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </label>
            <button type="button" className="srp-btn" disabled={busy || !form.slot_id || !form.secret_id} onClick={add}>
              <Plus size={14} aria-hidden="true" /> Add to the plan
            </button>
          </fieldset>
        </>
      )}
    </section>
  );
}
