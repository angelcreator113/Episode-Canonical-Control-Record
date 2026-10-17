/**
 * A character's Appearance tab (Evoni, 2026-10-17: "we need an appearance
 * tab and a generator"; "yes to the portrait images";
 * services/characterAppearance).
 *
 *   How they look: face, hair, skin, build, how they carry themselves,
 *     marks, signature style, palette, accessories, at home, going out,
 *     never seen in. Edited here; "Suggest their look" reads their whole
 *     character file (money, type, mask, city) and fills the form to save
 *     as it is or change first. It joins their character file, so posts,
 *     scenes and the pressure test follow it.
 *   Portraits: "Make a portrait" draws one from the saved look (it costs
 *     an image; the estimate is shown), kept in the studio's storage; "Use
 *     as their profile photo" sets it.
 * Styles: CharacterAppearanceTab.css (cap-*), one column at 375px.
 */
import { useState, useEffect, useCallback } from 'react';
import { Sparkles, ImagePlus, Check } from 'lucide-react';
import api from '../../services/api';
import './CharacterAppearanceTab.css';

const FIELDS = [
  ['summary', 'At a glance', 'One line: how they look'],
  ['face', 'Face', ''],
  ['hair', 'Hair', ''],
  ['skin', 'Skin', ''],
  ['build', 'Build', 'How they are built (no numbers)'],
  ['presence', 'How they carry themselves', 'How they move, take up space'],
  ['marks', 'Marks', 'Scars, tattoos, piercings'],
  ['signature_style', 'Signature style', ''],
  ['palette', 'Palette', 'Colours, separated by commas'],
  ['accessories', 'Accessories', ''],
  ['at_home', 'At home', 'What they wear when no one is looking'],
  ['going_out', 'Going out', 'What they wear to be seen'],
  ['never_wears', 'Never seen in', ''],
];
const base = (id) => `/api/v1/cast/characters/${id}/appearance`;
const money = (usd) => (usd == null ? null : `$${Number(usd).toFixed(2)}`);
const formOf = (a = {}) => Object.fromEntries(FIELDS.map(([k]) => [k, k === 'palette' ? (a.palette || []).join(', ') : (a[k] || '')]));

export default function CharacterAppearanceTab({ character, onPortraitChanged }) {
  const id = character.id;
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [why, setWhy] = useState(null);
  const [busy, setBusy] = useState(null); // 'save' | 'suggest' | 'portrait' | url
  const [note, setNote] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(base(id));
      setData(res.data);
    } catch (err) {
      console.error('[CharacterAppearanceTab] appearance load failed:', err);
      setNote({ kind: 'error', text: err.response?.data?.error || 'Could not load their appearance.' });
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (what, call) => {
    setBusy(what);
    setNote(null);
    try {
      return await call();
    } catch (err) {
      console.error(`[CharacterAppearanceTab] ${what} failed:`, err);
      setNote({ kind: 'error', text: err.response?.data?.error || 'That did not work. Try again.' });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const suggest = () => act('suggest', async () => {
    const res = await api.post(`${base(id)}/suggest`);
    const p = res.data?.proposal || {};
    setForm(formOf(p));
    setWhy(p.why || null);
    setNote({ kind: 'ok', text: 'Suggested from who they are. Save to keep it, or change it first.' });
  });
  const save = (e) => {
    e.preventDefault();
    return act('save', async () => {
      const body = { ...form, palette: form.palette.split(',').map((x) => x.trim()).filter(Boolean), ...(why ? { why } : {}) };
      const res = await api.put(base(id), body);
      setData((d) => ({ ...d, ...res.data }));
      setForm(null);
      setWhy(null);
      setNote({ kind: 'ok', text: 'Saved.' });
    });
  };
  const portrait = () => act('portrait', async () => {
    const res = await api.post(`${base(id)}/portrait`);
    setData((d) => ({ ...d, ...res.data }));
    setNote({ kind: 'ok', text: 'A new portrait is below. Use it as their profile photo, or make another.' });
  });
  const use = (url) => act(url, async () => {
    const res = await api.post(`${base(id)}/portrait/use`, { url });
    setData((d) => ({ ...d, ...res.data }));
    onPortraitChanged?.(url);
    setNote({ kind: 'ok', text: 'That portrait is their profile photo now.' });
  });

  if (!data) return <p className="ch-note">{note?.text || 'Loading…'}</p>;
  const a = data.appearance;
  const portraits = a?.portraits || [];
  const cost = money(data.portrait_cost);

  return (
    <div className="cap" data-testid="cap">
      <section className="cap-section" aria-labelledby="cap-look">
        <div className="cap-head">
          <h2 id="cap-look" className="cap-title">How they look</h2>
          <span className="ch-note">One look every scene, post and portrait follows.</span>
        </div>
        {!form && (
          <>
            {a ? (
              <dl className="cap-sheet" data-testid="cap-sheet">
                {FIELDS.filter(([k]) => (k === 'palette' ? (a.palette || []).length : a[k])).map(([k, label]) => (
                  <div key={k} className="cap-row">
                    <dt>{label}</dt>
                    <dd>{k === 'palette' ? a.palette.join(', ') : a[k]}</dd>
                  </div>
                ))}
              </dl>
            ) : <p className="ch-note">No appearance yet. Suggest one from who they are, or write it.</p>}
            {a?.why && <p className="cap-why">Why: {a.why}</p>}
            <span className="cap-actions">
              <button type="button" className="cap-btn" disabled={!!busy} onClick={suggest}>
                <Sparkles size={14} aria-hidden="true" /> {busy === 'suggest' ? 'Reading who they are…' : a ? 'Suggest a new look' : 'Suggest their look'}
              </button>
              <button type="button" className="cap-btn-soft" disabled={!!busy} onClick={() => { setForm(formOf(a || {})); setWhy(a?.why || null); }}>
                {a ? 'Edit' : 'Write it myself'}
              </button>
            </span>
          </>
        )}
        {form && (
          <form className="cap-form" onSubmit={save} data-testid="cap-form">
            {FIELDS.map(([k, label, hint]) => (
              <label key={k}>
                {label}
                {k === 'summary' || k === 'palette'
                  ? <input value={form[k]} placeholder={hint} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                  : <textarea rows={2} value={form[k]} placeholder={hint} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />}
              </label>
            ))}
            {why && <p className="cap-why">Why: {why}</p>}
            <span className="cap-actions">
              <button type="submit" className="cap-btn" disabled={!!busy}>{busy === 'save' ? 'Saving…' : 'Save their look'}</button>
              <button type="button" className="cap-btn-soft" disabled={!!busy} onClick={() => { setForm(null); setWhy(null); }}>Cancel</button>
            </span>
          </form>
        )}
      </section>

      <section className="cap-section" aria-labelledby="cap-portraits">
        <div className="cap-head">
          <h2 id="cap-portraits" className="cap-title">Portraits</h2>
          <span className="ch-note">Made from their saved look{cost ? `; about ${cost} each` : ''}.</span>
        </div>
        <span className="cap-actions">
          <button type="button" className="cap-btn" disabled={!!busy || !a?.summary} onClick={portrait}>
            <ImagePlus size={14} aria-hidden="true" /> {busy === 'portrait' ? 'Making a portrait…' : 'Make a portrait'}
          </button>
          {!a?.summary && <span className="ch-note">Save their look first (at least “at a glance”).</span>}
        </span>
        {portraits.length > 0 && (
          <ul className="cap-portraits">
            {portraits.map((p) => (
              <li key={p.url} className="cap-portrait" data-testid="cap-portrait">
                <img src={p.url} alt={`A portrait of ${character.selected_name || character.display_name}`} loading="lazy" />
                {data.portrait_url === p.url
                  ? <span className="cap-current"><Check size={14} aria-hidden="true" /> Their profile photo</span>
                  : (
                    <button type="button" className="cap-btn-soft" disabled={!!busy} onClick={() => use(p.url)}>
                      {busy === p.url ? 'Setting…' : 'Use as their profile photo'}
                    </button>
                  )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {note && <p className={note.kind === 'error' ? 'ch-note is-error' : 'ch-note'} role={note.kind === 'error' ? 'alert' : 'status'}>{note.text}</p>}
    </div>
  );
}
