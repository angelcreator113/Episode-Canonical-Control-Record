/**
 * Season Plan › Season twists (Evoni, 2026-10-23: the approved plan "from a
 * finished script to the story to the next episode", PR 3; "Season twists
 * as their own list"). A twist is planted in one episode and paid off in a
 * later one. When the plant episode's script is written the writer is told
 * to plant it, subtly and unexplained; the payoff episode's writer is told
 * to pay it off (services/seasonTwists). The list checks itself: a payoff
 * before its plant, a payoff with no plant, an episode no longer in the
 * season. Delete is done at once, with Undo (useUndo, as the Event
 * Package: undo instead of confirm). The reveal plan beside it stays the
 * plan for the characters' kept secrets.
 *
 * 2nd round (Evoni, 2026-10-23): the season line (SeasonTwistLine) draws
 * each twist from its plant to its payoff with the warnings beside it;
 * "Suggest twists" asks the AI for 3-5 drafts from the season, its open
 * threads and the characters' relationships (POST .../twists/suggest).
 * A draft is only shown: Keep saves it as it is, Edit opens it in the form,
 * Drop discards it. Nothing is saved without her.
 *
 * Plant tracker (2026-10-25): each twist is a plant, with its kind
 * (twist, relationship, opportunity, mystery, callback) and the beat it is
 * planted in; the Season page's Plants tab (SeasonPlants) lists them all by
 * episode, warns about the ones that never pay off and marks where each
 * paid off. "See every plant" opens it.
 *
 * Props: showId, api (the page's client), onSeeAll (optional: opens the Plants tab).
 */
import { useCallback, useEffect, useState } from 'react';
import { Route, Plus, Pencil, Trash2, AlertTriangle, ArrowRight, Sparkles, Check, X, ListTree } from 'lucide-react';
import UndoNotice from '../EventPackage/UndoNotice';
import { useUndo } from '../EventPackage/useUndo';
import SeasonTwistLine from './SeasonTwistLine';
import { PLANT_KINDS, KIND_LABEL } from '../../lib/seasonPlants';
import './SeasonTwists.css';

const STATUS_LABEL = { planned: 'Planned', planted: 'Planted', paid_off: 'Paid off', dropped: 'Dropped' };
const EMPTY = { arc: null, slots: [], threads: [], characters: [], twists: [], warnings: [] };
const BLANK = { id: null, title: '', description: '', kind: 'twist', plant_beat: '', plant_slot_id: '', payoff_slot_id: '', status: 'planned', thread_ids: [], character_ids: [], note: '' };
// The beat box holds text; the server reads a number or nothing.
const beatOut = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const errorOf = (err, fallback) => err?.response?.data?.error || fallback;
const slotText = (s) => `${s.label}${s.episode?.title ? ` · ${s.episode.title}` : s.story_purpose ? ` · ${s.story_purpose.slice(0, 50)}` : ''}`;

export default function SeasonTwists({ showId, api, onSeeAll = null }) {
  const base = `/api/v1/world/${showId}/season/twists`;
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  // The AI's drafts, shown until each is kept or dropped; never saved on their own.
  const [drafts, setDrafts] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const undo = useUndo(`twists:${showId}`, { setData });

  const load = useCallback(async () => {
    try {
      setData((await api.get(base)).data);
    } catch (err) {
      console.error('[SeasonTwists] load failed:', err);
      setData(EMPTY);
      setNote({ error: true, text: errorOf(err, 'The season twists could not be loaded.') });
    }
  }, [api, base]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true); setNote(null);
    const { id, draftKey, ...rest } = form;
    const body = { ...rest, plant_beat: beatOut(rest.plant_beat) };
    try {
      const res = id ? await api.put(`${base}/${id}`, body) : await api.put(base, body);
      setData(res.data);
      setForm(null);
      if (draftKey) setDrafts((ds) => ds.filter((d) => d.key !== draftKey));
      setNote({ text: id ? 'Twist saved.' : 'Twist added.' });
    } catch (err) {
      console.error('[SeasonTwists] save failed:', err);
      setNote({ error: true, text: errorOf(err, 'The twist was not saved.') });
    } finally { setBusy(false); }
  };

  const suggest = async () => {
    setSuggesting(true); setNote(null);
    try {
      const res = await api.post(`${base}/suggest`);
      const stamp = Date.now();
      setDrafts((res.data?.drafts || []).map((d, i) => ({ ...d, key: `d-${stamp}-${i}` })));
    } catch (err) {
      console.error('[SeasonTwists] suggest failed:', err);
      setNote({ error: true, text: errorOf(err, 'No twists could be suggested. Try again.') });
    } finally { setSuggesting(false); }
  };

  const draftBody = (d) => ({
    title: d.title, description: d.description || '', kind: d.kind || 'twist', plant_beat: null, plant_slot_id: d.plant_slot_id || '', payoff_slot_id: d.payoff_slot_id || '',
    status: 'planned', thread_ids: d.thread_ids || [], character_ids: d.character_ids || [], note: '',
  });
  const keepDraft = async (d) => {
    setBusy(true); setNote(null);
    try {
      setData((await api.put(base, draftBody(d))).data);
      setDrafts((ds) => ds.filter((x) => x.key !== d.key));
      setNote({ text: `Kept “${d.title}”.` });
    } catch (err) {
      console.error('[SeasonTwists] keep draft failed:', err);
      setNote({ error: true, text: errorOf(err, 'The twist was not saved.') });
    } finally { setBusy(false); }
  };
  const editDraft = (d) => { setNote(null); setForm({ ...BLANK, ...draftBody(d), plant_beat: '', draftKey: d.key }); };
  const dropDraft = (d) => setDrafts((ds) => ds.filter((x) => x.key !== d.key));

  const remove = async (t) => {
    setBusy(true); setNote(null);
    try {
      setData((await api.delete(`${base}/${t.id}`)).data);
      if (form?.id === t.id) setForm(null);
      undo.offer({
        message: `Deleted “${t.title}”`,
        undo: async (ctx) => {
          const res = await api.post(`${base}/${t.id}/restore`);
          (ctx.setData || setData)(res.data);
        },
      });
    } catch (err) {
      console.error('[SeasonTwists] delete failed:', err);
      setNote({ error: true, text: errorOf(err, 'The twist was not deleted.') });
    } finally { setBusy(false); }
  };

  if (!data || !data.arc) return null;
  const slotById = new Map(data.slots.map((s) => [s.id, s]));
  const threadById = new Map(data.threads.map((t) => [t.id, t]));
  const characterById = new Map(data.characters.map((c) => [c.id, c]));
  const warnFor = (id) => data.warnings.filter((w) => w.twist_id === id);

  const edit = (t) => {
    setNote(null);
    setForm({
      id: t.id, title: t.title || '', description: t.description || '', kind: t.kind || 'twist', plant_beat: t.plant_beat ?? '', plant_slot_id: t.plant_slot_id || '',
      payoff_slot_id: t.payoff_slot_id || '', status: t.status || 'planned', thread_ids: t.thread_ids || [],
      character_ids: t.character_ids || [], note: t.note || '',
    });
  };
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggle = (key, id) => setForm((f) => ({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] }));

  // Episodes still to come, and the twist's own (even when done) so an edit keeps it.
  const plantSlot = form ? slotById.get(form.plant_slot_id) : null;
  const plantOptions = form ? data.slots.filter((s) => !s.done || s.id === form.plant_slot_id) : [];
  const payoffOptions = form ? data.slots.filter((s) => (!s.done || s.id === form.payoff_slot_id) && (!plantSlot || s.slot_number > plantSlot.slot_number)) : [];
  const payoffTooEarly = form && plantSlot && form.payoff_slot_id && (slotById.get(form.payoff_slot_id)?.slot_number || 0) <= plantSlot.slot_number;

  const path = (t) => (
    <p className="stw-path">
      <span className="stw-slot"><span className="stw-slot-role">Plant</span> {t.plant ? slotText(slotById.get(t.plant.id) || t.plant) : 'Episode missing'}</span>
      <ArrowRight size={14} aria-hidden="true" className="stw-arrow" />
      <span className={`stw-slot${t.payoff ? '' : ' is-open'}`}>
        <span className="stw-slot-role">Pay off</span> {t.payoff ? slotText(slotById.get(t.payoff.id) || t.payoff) : t.payoff_slot_id ? 'Episode missing' : 'Not chosen yet'}
      </span>
    </p>
  );

  return (
    <section className="stw-card" aria-labelledby="stw-title" data-testid="season-twists">
      <header className="stw-head">
        <div>
          <h3 id="stw-title" className="stw-title"><Route size={18} aria-hidden="true" /> Season twists</h3>
          <p className="stw-about">
            Plant a twist in one episode and pay it off in a later one. The plant episode&apos;s script is told to plant it
            subtly, without explaining it; the payoff episode&apos;s script is told to pay it off.
          </p>
        </div>
        <div className="stw-head-actions">
          {onSeeAll && (
            <button type="button" className="stw-btn is-quiet" onClick={onSeeAll} data-testid="stw-see-plants">
              <ListTree size={14} aria-hidden="true" /> See every plant
            </button>
          )}
          <button type="button" className="stw-btn is-quiet" disabled={busy || suggesting} onClick={suggest} data-testid="stw-suggest">
            <Sparkles size={14} aria-hidden="true" /> {suggesting ? 'Suggesting…' : 'Suggest twists'}
          </button>
          {!form && (
            <button type="button" className="stw-btn" disabled={busy} onClick={() => { setNote(null); setForm({ ...BLANK }); }}>
              <Plus size={14} aria-hidden="true" /> Add a twist
            </button>
          )}
        </div>
      </header>
      {note && <p className={`stw-note${note.error ? ' is-error' : ' is-done'}`} role="status">{note.text}</p>}
      {suggesting && <p className="stw-note" role="status" data-testid="stw-suggesting">Reading the season, its open threads and the relationships…</p>}
      <UndoNotice undo={undo} testId="stw-undo" />

      {drafts.length > 0 && (
        <section className="stw-drafts" aria-label="Suggested twists" data-testid="stw-drafts">
          <p className="stw-drafts-about">Suggested by AI. Nothing is saved until you keep it.</p>
          <ul className="stw-list">
            {drafts.map((d) => {
              const plant = slotById.get(d.plant_slot_id);
              const payoff = slotById.get(d.payoff_slot_id);
              const threads = (d.thread_ids || []).map((id) => threadById.get(id)?.title).filter(Boolean);
              const people = (d.character_ids || []).map((id) => characterById.get(id)?.name).filter(Boolean);
              return (
                <li key={d.key} className="stw-twist is-draft" data-testid={`stw-draft-${d.key}`}>
                  <span className="stw-twist-title">{d.title}</span>
                  {d.description && <p className="stw-desc">{d.description}</p>}
                  <p className="stw-path">
                    <span className={`stw-slot${plant ? '' : ' is-open'}`}><span className="stw-slot-role">Plant</span> {plant ? slotText(plant) : 'Choose in Edit'}</span>
                    <ArrowRight size={14} aria-hidden="true" className="stw-arrow" />
                    <span className={`stw-slot${payoff ? '' : ' is-open'}`}><span className="stw-slot-role">Pay off</span> {payoff ? slotText(payoff) : 'Not chosen yet'}</span>
                  </p>
                  {(threads.length > 0 || people.length > 0) && (
                    <p className="stw-links">
                      {threads.map((x) => <span key={`t-${x}`} className="stw-tag">Thread: {x}</span>)}
                      {people.map((x) => <span key={`c-${x}`} className="stw-tag is-person">{x}</span>)}
                    </p>
                  )}
                  <div className="stw-actions">
                    <button type="button" className="stw-link-btn" disabled={busy || !plant} onClick={() => keepDraft(d)} aria-label={`Keep ${d.title}`}>
                      <Check size={13} aria-hidden="true" /> Keep
                    </button>
                    <button type="button" className="stw-link-btn" disabled={busy} onClick={() => editDraft(d)} aria-label={`Edit ${d.title} before keeping it`}>
                      <Pencil size={13} aria-hidden="true" /> Edit
                    </button>
                    <button type="button" className="stw-link-btn is-danger" disabled={busy} onClick={() => dropDraft(d)} aria-label={`Drop ${d.title}`}>
                      <X size={13} aria-hidden="true" /> Drop
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <SeasonTwistLine slots={data.slots} twists={data.twists} warnings={data.warnings} />

      {data.twists.length === 0 ? (
        <p className="stw-note" data-testid="stw-empty">No twists yet — plant one in an episode and pay it off later.</p>
      ) : (
        <ul className="stw-list" aria-label="Season twists">
          {data.twists.map((t) => {
            const threads = t.thread_ids.map((id) => threadById.get(id)?.title).filter(Boolean);
            const people = t.character_ids.map((id) => characterById.get(id)?.name).filter(Boolean);
            return (
              <li key={t.id} className={`stw-twist${t.status === 'dropped' ? ' is-dropped' : ''}`} data-testid={`stw-twist-${t.id}`}>
                <div className="stw-twist-head">
                  <span className="stw-twist-title">{t.title}</span>
                  <span className={`stw-status is-${t.status}`}>{STATUS_LABEL[t.status] || t.status}</span>
                </div>
                <p className="stw-links">
                  <span className="stw-tag">{KIND_LABEL[t.kind] || 'Twist'}</span>
                  {t.plant_beat ? <span className="stw-tag">Beat {t.plant_beat}</span> : null}
                </p>
                {t.description && <p className="stw-desc">{t.description}</p>}
                {path(t)}
                {(threads.length > 0 || people.length > 0) && (
                  <p className="stw-links">
                    {threads.map((x) => <span key={`t-${x}`} className="stw-tag">Thread: {x}</span>)}
                    {people.map((x) => <span key={`c-${x}`} className="stw-tag is-person">{x}</span>)}
                  </p>
                )}
                {warnFor(t.id).map((w) => (
                  <p key={w.text} className="stw-warn"><AlertTriangle size={13} aria-hidden="true" /> {w.text}</p>
                ))}
                <div className="stw-actions">
                  <button type="button" className="stw-link-btn" disabled={busy} onClick={() => edit(t)} aria-label={`Edit ${t.title}`}>
                    <Pencil size={13} aria-hidden="true" /> Edit
                  </button>
                  <button type="button" className="stw-link-btn is-danger" disabled={busy} onClick={() => remove(t)} aria-label={`Delete ${t.title}`}>
                    <Trash2 size={13} aria-hidden="true" /> Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {form && (
        <fieldset className="stw-form" data-testid="stw-form">
          <legend className="stw-legend">{form.id ? 'Edit the twist' : form.draftKey ? 'Edit the suggestion, then add it' : 'Add a twist'}</legend>
          <label className="stw-field is-wide">
            <span>Title</span>
            <input type="text" value={form.title} maxLength={200} placeholder="The ring is not hers" onChange={set('title')} />
          </label>
          <label className="stw-field is-wide">
            <span>What it is</span>
            <textarea rows={3} value={form.description} maxLength={2000} placeholder="Maren wears a ring she says was her mother's; it was Mo's." onChange={set('description')} />
          </label>
          <label className="stw-field">
            <span>Kind</span>
            <select value={form.kind} onChange={set('kind')}>
              {PLANT_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </label>
          <label className="stw-field">
            <span>Beat (optional)</span>
            <input type="number" min={1} max={99} inputMode="numeric" value={form.plant_beat} placeholder="Which beat plants it" onChange={set('plant_beat')} />
          </label>
          <label className="stw-field">
            <span>Planted in</span>
            <select value={form.plant_slot_id} onChange={(e) => {
              const plant = slotById.get(e.target.value);
              setForm((f) => {
                const payoff = slotById.get(f.payoff_slot_id);
                return { ...f, plant_slot_id: e.target.value, payoff_slot_id: payoff && plant && payoff.slot_number <= plant.slot_number ? '' : f.payoff_slot_id };
              });
            }}>
              <option value="">Choose…</option>
              {plantOptions.map((s) => <option key={s.id} value={s.id}>{slotText(s)}</option>)}
            </select>
          </label>
          <label className="stw-field">
            <span>Paid off in</span>
            <select value={form.payoff_slot_id} onChange={set('payoff_slot_id')}>
              <option value="">Later — not chosen yet</option>
              {payoffOptions.map((s) => <option key={s.id} value={s.id}>{slotText(s)}</option>)}
            </select>
          </label>
          {form.id && (
            <label className="stw-field">
              <span>Status</span>
              <select value={form.status} onChange={set('status')}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          )}
          {data.threads.length > 0 && (
            <div className="stw-field is-wide" role="group" aria-label="Threads">
              <span>Threads</span>
              <div className="stw-picks">
                {data.threads.map((t) => (
                  <label key={t.id} className={`stw-pick${form.thread_ids.includes(t.id) ? ' is-on' : ''}`}>
                    <input type="checkbox" checked={form.thread_ids.includes(t.id)} onChange={() => toggle('thread_ids', t.id)} /> {t.title}
                  </label>
                ))}
              </div>
            </div>
          )}
          {data.characters.length > 0 && (
            <div className="stw-field is-wide" role="group" aria-label="Characters">
              <span>Characters</span>
              <div className="stw-picks">
                {data.characters.map((c) => (
                  <label key={c.id} className={`stw-pick${form.character_ids.includes(c.id) ? ' is-on' : ''}`}>
                    <input type="checkbox" checked={form.character_ids.includes(c.id)} onChange={() => toggle('character_ids', c.id)} /> {c.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <label className="stw-field is-wide">
            <span>Note (optional)</span>
            <input type="text" value={form.note} maxLength={500} placeholder="Keep the ring in frame, never mention it" onChange={set('note')} />
          </label>
          {payoffTooEarly && <p className="stw-warn">The payoff comes after the plant: choose a later episode.</p>}
          <div className="stw-form-actions">
            <button type="button" className="stw-btn" disabled={busy || !form.title.trim() || !form.plant_slot_id || payoffTooEarly} onClick={save}>
              {form.id ? 'Save twist' : 'Add twist'}
            </button>
            <button type="button" className="stw-btn is-quiet" disabled={busy} onClick={() => setForm(null)}>Cancel</button>
          </div>
        </fieldset>
      )}
    </section>
  );
}
