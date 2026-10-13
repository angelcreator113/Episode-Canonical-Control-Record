/**
 * Admin › The Pulse › Uploads › Lala's everyday fits (Task #2922): outfits
 * she wears outside episodes, one photo each with an optional caption, alt
 * text and the story date she wore it (/api/v1/pulse-fits). Newest story
 * date first. Episode fits stay on the episode's Style Page.
 * Styles: styles/AdminPanel.css.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Pencil, Trash2 } from 'lucide-react';
import api from '../../services/api';
import RevealPicker from './RevealPicker';

const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong.';

export const fitsApi = {
  list: (showId) => api.get(`/api/v1/pulse-fits?show_id=${encodeURIComponent(showId)}`).then((r) => r.data?.fits || []),
  create: (showId, file, fields) => {
    const form = new FormData();
    form.append('show_id', showId);
    for (const [k, v] of Object.entries(fields)) if (v) form.append(k, v);
    form.append('image', file);
    return api.post('/api/v1/pulse-fits', form).then((r) => r.data?.fit);
  },
  update: (id, fields) => api.patch(`/api/v1/pulse-fits/${id}`, fields).then((r) => r.data?.fit),
  remove: (id) => api.delete(`/api/v1/pulse-fits/${id}`),
};

// Newest story date first, undated last, as the server lists them.
const byStoryDate = (a, b) => {
  if (a.story_date && b.story_date && a.story_date !== b.story_date) return a.story_date < b.story_date ? 1 : -1;
  if (a.story_date && !b.story_date) return -1;
  if (!a.story_date && b.story_date) return 1;
  return String(b.created_at || '').localeCompare(String(a.created_at || ''));
};

function FitFields({ value, onChange, idPrefix }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="pulse-fit-fields">
      <label className="pulse-field" htmlFor={`${idPrefix}-caption`}>Caption
        <input id={`${idPrefix}-caption`} type="text" maxLength={2000} value={value.caption} onChange={set('caption')} />
      </label>
      <label className="pulse-field" htmlFor={`${idPrefix}-date`}>Story date
        <input id={`${idPrefix}-date`} type="date" value={value.story_date} onChange={set('story_date')} />
      </label>
      <label className="pulse-field" htmlFor={`${idPrefix}-alt`}>Alt text
        <input id={`${idPrefix}-alt`} type="text" maxLength={300} value={value.image_alt} placeholder="What she's wearing" onChange={set('image_alt')} />
      </label>
    </div>
  );
}

const EMPTY = { caption: '', story_date: '', image_alt: '' };
const fieldsOf = (fit) => ({ caption: fit.caption || '', story_date: fit.story_date || '', image_alt: fit.image_alt || '' });

function FitTile({ fit, onSaved, onRemoved }) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState(fieldsOf(fit));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const run = async (fn) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
    } catch (err) {
      console.error(`[PulseFits] ${fit.id} action failed:`, err);
      setNote(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const save = () => run(async () => {
    onSaved(await fitsApi.update(fit.id, { caption: fields.caption, image_alt: fields.image_alt, story_date: fields.story_date || null }));
    setEditing(false);
  });
  const remove = () => {
    if (!window.confirm('Remove this fit from The Pulse?')) return;
    run(async () => {
      await fitsApi.remove(fit.id);
      onRemoved(fit.id);
    });
  };

  return (
    <li className="pulse-fit" data-testid={`pulse-fit-${fit.id}`}>
      <img src={fit.image_url} alt={fit.image_alt || ''} />
      {editing ? (
        <>
          <FitFields value={fields} onChange={setFields} idPrefix={`fit-${fit.id}`} />
          <div className="pulse-actions">
            <button type="button" className="pulse-btn primary" disabled={busy} onClick={save}>Save</button>
            <button type="button" className="pulse-btn" disabled={busy} onClick={() => { setFields(fieldsOf(fit)); setEditing(false); }}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <p className="pulse-fit-caption">{fit.caption || <span className="pulse-hint">No caption</span>}</p>
          <p className="pulse-hint">{fit.story_date ? `Worn ${fit.story_date}` : 'No story date'}</p>
          <RevealPicker type="image" kind="fit" id={fit.id} label={fit.caption ? `the fit “${fit.caption}”` : 'this fit'} imageUrl={fit.image_url} />
          <div className="pulse-actions">
            <button type="button" className="pulse-btn" disabled={busy} onClick={() => setEditing(true)}><Pencil size={16} aria-hidden="true" /> Edit</button>
            <button type="button" className="pulse-btn danger" disabled={busy} onClick={remove}><Trash2 size={16} aria-hidden="true" /> Remove</button>
          </div>
        </>
      )}
      {note && <p className="pulse-error" role="alert">{note}</p>}
    </li>
  );
}

export default function PulseFitsCard({ showId }) {
  const [fits, setFits] = useState(null);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null); // { file, preview }
  const [fields, setFields] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    let alive = true;
    fitsApi.list(showId)
      .then((list) => { if (alive) setFits(list); })
      .catch((err) => {
        console.error('[PulseFits] the fits could not be read:', err);
        if (alive) setError('The fits could not be loaded.');
      });
    return () => { alive = false; };
  }, [showId]);

  useEffect(() => () => { if (pending?.preview) URL.revokeObjectURL(pending.preview); }, [pending]);

  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let preview = null;
    try {
      preview = URL.createObjectURL(file);
    } catch (err) {
      console.error('[PulseFits] no preview for the chosen file:', err);
    }
    setPending({ file, preview });
    setFields(EMPTY);
    setNote(null);
  };
  const upload = async () => {
    setBusy(true);
    setNote(null);
    try {
      const fit = await fitsApi.create(showId, pending.file, fields);
      setFits((list) => [...(list || []), fit].sort(byStoryDate));
      setPending(null);
    } catch (err) {
      console.error('[PulseFits] upload failed:', err);
      setNote(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="pulse-card" aria-labelledby="pulse-fits-heading" data-testid="pulse-fits">
      <h3 id="pulse-fits-heading">Lala's everyday fits</h3>
      <p className="pulse-hint">Outfits she wears outside episodes. Episode fits come from the episode's Style Page.</p>
      {error && <p className="pulse-error" role="alert">{error}</p>}
      {!fits && !error && <p className="pulse-hint"><Loader2 size={14} className="pulse-spin" aria-hidden="true" /> Loading the fits…</p>}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pick} data-testid="pulse-fit-file" />
      {fits && (
        <ul className="pulse-fits">
          <li className="pulse-fit">
            {pending ? (
              <div className="pulse-fit-new" data-testid="pulse-fit-new">
                {pending.preview && <img src={pending.preview} alt="" />}
                <FitFields value={fields} onChange={setFields} idPrefix="fit-new" />
                <div className="pulse-actions">
                  <button type="button" className="pulse-btn primary" disabled={busy} onClick={upload}>
                    {busy ? <Loader2 size={16} className="pulse-spin" aria-hidden="true" /> : null} Add fit
                  </button>
                  <button type="button" className="pulse-btn" disabled={busy} onClick={() => setPending(null)}>Cancel</button>
                </div>
                {note && <p className="pulse-error" role="alert">{note}</p>}
              </div>
            ) : (
              <button type="button" className="pulse-add-spot tall" onClick={() => fileRef.current?.click()} data-testid="pulse-fit-add">
                <ImagePlus size={20} aria-hidden="true" /> + Add fit
              </button>
            )}
          </li>
          {fits.map((fit) => (
            <FitTile key={fit.id} fit={fit}
              onSaved={(next) => setFits((list) => list.map((f) => (f.id === next.id ? next : f)).sort(byStoryDate))}
              onRemoved={(id) => setFits((list) => list.filter((f) => f.id !== id))} />
          ))}
        </ul>
      )}
    </section>
  );
}
