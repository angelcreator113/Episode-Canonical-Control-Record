/**
 * Season page › Plants (2026-10-25): every plant in the season, the small
 * details a script sets up that should pay off later ("Declan Ferris is
 * @thriftveil"; "Studio by Sable wants Lala to model, not design"). Read
 * from GET /world/:showId/season/twists (services/seasonTwists getTwists):
 * every season twist is a plant.
 *
 * What needs attention first (a plant open more than ~3 episodes with no
 * payoff planned, or past its planned payoff episode; the server's typed
 * warnings), then the open plants with no payoff, then the timeline by the
 * episode that plants each one. "Mark paid off" asks which episode it paid
 * off in and how (POST .../:id/paid-off), with Undo (POST .../:id/reopen);
 * "Not paid off after all" takes it back later. Drop sets it dropped, with
 * Undo. Plants are added and edited on the Story tab (SeasonTwists) and
 * from a script (the Script tab's Suggest plants from this script).
 *
 * Props: showId, api (the page's client), onAddPlants (optional: opens the Story tab).
 */
import { useCallback, useEffect, useState } from 'react';
import { Sprout, AlertTriangle, Check, X, Undo2, Pencil } from 'lucide-react';
import UndoNotice from '../EventPackage/UndoNotice';
import { useUndo } from '../EventPackage/useUndo';
import {
  KIND_LABEL, PLANT_STATUS, isOpen, plantsByEpisode, openWithoutPayoff, plantCounts, payoffChoices, payoffLine, episodeName,
} from '../../lib/seasonPlants';
import './SeasonPlants.css';

const errorOf = (err, fallback) => err?.response?.data?.error || fallback;

// The fields a PUT needs to keep a plant as it is, with one change.
const keepBody = (t, change) => ({
  title: t.title, description: t.description || '', kind: t.kind || 'twist', plant_beat: t.plant_beat ?? null,
  plant_slot_id: t.plant_slot_id, payoff_slot_id: t.payoff_slot_id || '', status: t.status,
  thread_ids: t.thread_ids || [], character_ids: t.character_ids || [], note: t.note || '', ...change,
});

export default function SeasonPlants({ showId, api, onAddPlants = null }) {
  const base = `/api/v1/world/${showId}/season/twists`;
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  // The "Mark paid off" form open on one plant: { id, slot_id, note }.
  const [marking, setMarking] = useState(null);
  const undo = useUndo(`plants:${showId}`, { setData });

  const load = useCallback(async () => {
    try {
      setData((await api.get(base)).data);
    } catch (err) {
      console.error('[SeasonPlants] load failed:', err);
      setData({ arc: null, slots: [], twists: [], warnings: [], failed: true });
    }
  }, [api, base]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <p className="spl-note" role="status">Loading the plants…</p>;
  if (data.failed) {
    return (
      <p className="spl-note is-error" role="alert" data-testid="spl-failed">
        The plants could not be loaded. <button type="button" className="spl-link-btn" onClick={load}>Try again</button>
      </p>
    );
  }
  if (!data.arc) return <p className="spl-note">Set up the season first; its plants are listed here.</p>;

  const twists = data.twists || [];
  const counts = plantCounts(twists);
  const timeline = plantsByEpisode(data.slots, twists);
  const noPayoff = openWithoutPayoff(twists);
  const byId = new Map(twists.map((t) => [t.id, t]));
  const attention = (data.warnings || []).filter((w) => w.type && byId.has(w.twist_id));
  const warnFor = (id) => attention.filter((w) => w.twist_id === id);

  const startMark = (t) => {
    setNote(null);
    const choices = payoffChoices(data.slots, t);
    const planned = choices.find((s) => s.id === t.payoff_slot_id);
    setMarking({ id: t.id, slot_id: planned?.id || '', note: '' });
  };

  const markPaid = async (t) => {
    const slot = data.slots.find((s) => s.id === marking.slot_id);
    setBusy(true); setNote(null);
    try {
      const res = await api.post(`${base}/${t.id}/paid-off`, { slot_id: marking.slot_id, note: marking.note });
      setData(res.data);
      setMarking(null);
      undo.offer({
        message: `Marked “${t.title}” paid off in ${episodeName(slot)}`,
        undo: async (ctx) => { (ctx.setData || setData)((await api.post(`${base}/${t.id}/reopen`)).data); },
      });
    } catch (err) {
      console.error('[SeasonPlants] mark paid off failed:', err);
      setNote({ error: true, text: errorOf(err, 'It was not marked paid off. Try again.') });
    } finally { setBusy(false); }
  };

  const reopen = async (t) => {
    setBusy(true); setNote(null);
    try {
      setData((await api.post(`${base}/${t.id}/reopen`)).data);
      setNote({ text: `“${t.title}” is open again.` });
    } catch (err) {
      console.error('[SeasonPlants] reopen failed:', err);
      setNote({ error: true, text: errorOf(err, 'That did not work. Try again.') });
    } finally { setBusy(false); }
  };

  const drop = async (t) => {
    setBusy(true); setNote(null);
    try {
      setData((await api.put(`${base}/${t.id}`, keepBody(t, { status: 'dropped' }))).data);
      undo.offer({
        message: `Dropped “${t.title}”`,
        undo: async (ctx) => { (ctx.setData || setData)((await api.put(`${base}/${t.id}`, keepBody(t, {}))).data); },
      });
    } catch (err) {
      console.error('[SeasonPlants] drop failed:', err);
      setNote({ error: true, text: errorOf(err, 'It was not dropped. Try again.') });
    } finally { setBusy(false); }
  };

  const markForm = (t) => (
    <fieldset className="spl-mark" data-testid={`spl-mark-form-${t.id}`}>
      <legend className="spl-legend">Where did it pay off?</legend>
      <label className="spl-field">
        <span>Paid off in</span>
        <select value={marking.slot_id} onChange={(e) => setMarking((m) => ({ ...m, slot_id: e.target.value }))}>
          <option value="">Choose the episode…</option>
          {payoffChoices(data.slots, t).map((s) => (
            <option key={s.id} value={s.id}>{episodeName(s)}{s.episode?.title ? ` · ${s.episode.title}` : ''}</option>
          ))}
        </select>
      </label>
      <label className="spl-field is-wide">
        <span>How it paid off (optional)</span>
        <input type="text" maxLength={1000} value={marking.note} placeholder="Lala finds his login on the gala laptop"
          onChange={(e) => setMarking((m) => ({ ...m, note: e.target.value }))} />
      </label>
      <div className="spl-actions">
        <button type="button" className="spl-btn" disabled={busy || !marking.slot_id} onClick={() => markPaid(t)}>
          <Check size={14} aria-hidden="true" /> Mark paid off
        </button>
        <button type="button" className="spl-btn is-quiet" disabled={busy} onClick={() => setMarking(null)}>Cancel</button>
      </div>
    </fieldset>
  );

  const card = (t) => (
    <li key={t.id} className={`spl-plant is-${t.status}`} data-testid={`spl-plant-${t.id}`}>
      <div className="spl-plant-head">
        <span className="spl-plant-title">{t.title}</span>
        <span className={`spl-status is-${t.status}`}>{PLANT_STATUS[t.status] || t.status}</span>
      </div>
      <p className="spl-chips">
        <span className="spl-chip">{KIND_LABEL[t.kind] || 'Twist'}</span>
        <span className="spl-chip">{t.plant ? `Planted in ${episodeName(t.plant)}` : 'Its episode is no longer in the season'}{t.plant_beat ? `, beat ${t.plant_beat}` : ''}</span>
      </p>
      {t.description && <p className="spl-desc">{t.description}</p>}
      <p className={`spl-payoff${t.status === 'paid_off' ? ' is-done' : ''}`} data-testid={`spl-payoff-${t.id}`}>
        {payoffLine(t)}{t.status === 'paid_off' && t.payoff_note ? ` — ${t.payoff_note}` : ''}
      </p>
      {warnFor(t.id).map((w) => (
        <p key={w.text} className="spl-warn"><AlertTriangle size={13} aria-hidden="true" /> {w.text}</p>
      ))}
      {marking?.id === t.id ? markForm(t) : (
        <div className="spl-actions">
          {isOpen(t) && t.plant && (
            <button type="button" className="spl-link-btn" disabled={busy} onClick={() => startMark(t)} aria-label={`Mark ${t.title} paid off`}>
              <Check size={13} aria-hidden="true" /> Mark paid off
            </button>
          )}
          {isOpen(t) && (
            <button type="button" className="spl-link-btn is-danger" disabled={busy} onClick={() => drop(t)} aria-label={`Drop ${t.title}`}>
              <X size={13} aria-hidden="true" /> Drop
            </button>
          )}
          {t.status === 'paid_off' && (
            <button type="button" className="spl-link-btn" disabled={busy} onClick={() => reopen(t)} aria-label={`${t.title} was not paid off after all`}>
              <Undo2 size={13} aria-hidden="true" /> Not paid off after all
            </button>
          )}
        </div>
      )}
    </li>
  );

  return (
    <section className="spl-card" aria-labelledby="spl-title" data-testid="season-plants">
      <header className="spl-head">
        <div>
          <h3 id="spl-title" className="spl-title"><Sprout size={18} aria-hidden="true" /> Season plants</h3>
          <p className="spl-about">
            The small details a script sets up that should pay off later. See them all by episode, mark where each one
            paid off, and catch the ones that never do.
          </p>
        </div>
        {onAddPlants && (
          <button type="button" className="spl-btn is-quiet" onClick={onAddPlants} data-testid="spl-add">
            <Pencil size={14} aria-hidden="true" /> Add or edit plants
          </button>
        )}
      </header>
      <p className="spl-summary" data-testid="spl-summary">
        {counts.total} {counts.total === 1 ? 'plant' : 'plants'} · {counts.open} open · {counts.paidOff} paid off
        {data.current_episode ? ` · the season is at Episode ${data.current_episode}` : ''}
      </p>
      {note && <p className={`spl-note${note.error ? ' is-error' : ' is-done'}`} role="status">{note.text}</p>}
      <UndoNotice undo={undo} testId="spl-undo" />

      {twists.length === 0 ? (
        <p className="spl-note" data-testid="spl-empty">
          No plants yet. On an episode&apos;s Script tab, use Suggest plants from this script, or add one on the Story tab.
        </p>
      ) : (
        <>
          {attention.length > 0 && (
            <section className="spl-section is-warn" aria-labelledby="spl-attention" data-testid="spl-attention">
              <h4 id="spl-attention" className="spl-section-title"><AlertTriangle size={14} aria-hidden="true" /> Needs a payoff</h4>
              <ul className="spl-warn-list">
                {attention.map((w) => (
                  <li key={`${w.twist_id}-${w.type}`} className="spl-warn">{w.text}</li>
                ))}
              </ul>
            </section>
          )}

          {noPayoff.length > 0 && (
            <section className="spl-section" aria-labelledby="spl-open" data-testid="spl-open">
              <h4 id="spl-open" className="spl-section-title">Open, with no payoff planned ({noPayoff.length})</h4>
              <ul className="spl-open-list">
                {noPayoff.map((t) => (
                  <li key={t.id}>
                    <strong>{t.title}</strong> · {KIND_LABEL[t.kind] || 'Twist'}{t.plant ? ` · planted in ${episodeName(t.plant)}` : ''}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="spl-section" aria-labelledby="spl-timeline" data-testid="spl-timeline">
            <h4 id="spl-timeline" className="spl-section-title">By episode</h4>
            <ol className="spl-episodes">
              {timeline.map((g) => (
                <li key={g.key} className="spl-episode" data-testid={`spl-episode-${g.slot ? g.slot.slot_number : 'missing'}`}>
                  <p className="spl-episode-name">
                    {g.slot ? `${episodeName(g.slot)}${g.slot.episode?.title ? ` · ${g.slot.episode.title}` : ''}` : 'An episode no longer in the season'}
                  </p>
                  <ul className="spl-list">{g.plants.map(card)}</ul>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </section>
  );
}
