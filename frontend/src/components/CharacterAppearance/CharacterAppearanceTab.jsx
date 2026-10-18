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
 * Laid out to Evoni's mock (2026-10-18, step 7 of the character page):
 * visual identity (their photo and portraits, paged), physical details,
 * signature look, wardrobe palette, accessories and notes. The mock's hair
 * styles, makeup and style influences have nothing stored behind them.
 * Styles: CharacterAppearanceTab.css (cap-*) with the page's ch-card; one
 * column at 375px.
 */
import { useState, useEffect, useCallback } from 'react';
import { Sparkles, ImagePlus, Check, Palette, Shirt, Gem, FileText } from 'lucide-react';
import Pager from '../Pager/Pager';
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
const LABEL = Object.fromEntries(FIELDS.map(([k, l]) => [k, l]));
// Physical details, and their signature looks (Evoni's mock, 2026-10-18).
const PHYSICAL = ['face', 'hair', 'skin', 'build', 'presence', 'marks'];
const LOOKS = [['signature_style', 'Signature style'], ['going_out', 'Going out'], ['at_home', 'At home'], ['never_wears', 'Never seen in']];
const PORTRAITS_PER_PAGE = 4;
// A palette colour the browser knows paints its swatch; a word it doesn't (oat) shows as a plain swatch.
const swatchStyle = (c) => {
  try {
    return typeof CSS !== 'undefined' && CSS.supports?.('color', c) ? { background: c } : undefined;
  } catch (err) {
    console.error('[CharacterAppearanceTab] colour check failed:', err);
    return undefined;
  }
};
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
  const [page, setPage] = useState(1);

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
  const portraitList = data?.appearance?.portraits || [];
  const portraitPage = portraitList.slice((page - 1) * PORTRAITS_PER_PAGE, page * PORTRAITS_PER_PAGE);
  const use = (url) => act(url, async () => {
    const res = await api.post(`${base(id)}/portrait/use`, { url });
    setData((d) => ({ ...d, ...res.data }));
    onPortraitChanged?.(url);
    setNote({ kind: 'ok', text: 'That portrait is their profile photo now.' });
  });

  const remove = (url) => act(`remove:${url}`, async () => {
    const res = await api.post(`${base(id)}/portrait/remove`, { url });
    setData((d) => ({ ...d, ...res.data }));
    if (data.portrait_url === url) onPortraitChanged?.(null);
    setNote({ kind: 'ok', text: 'Removed.' });
  });

  if (!data) return <p className="ch-note">{note?.text || 'Loading…'}</p>;
  const a = data.appearance;
  const portraits = a?.portraits || [];
  const cost = money(data.portrait_cost);
  const name = character.selected_name || character.display_name;
  const photo = data.portrait_url || character.portrait_url || null;
  const physical = PHYSICAL.filter((k) => a?.[k]);
  const looks = LOOKS.filter(([k]) => a?.[k]);
  const palette = a?.palette || [];
  const head = (id, title, Icon, action, sub) => (
    <div className="ch-card-head">
      <span className="ch-head-icon" aria-hidden="true"><Icon size={20} /></span>
      <span className="ch-head-text">
        <h2 id={id} className="ch-h2">{title}</h2>
        {sub && <span className="ch-note">{sub}</span>}
      </span>
      {action}
    </div>
  );
  const editing = !!form;
  const actions = !editing && (
    <span className="cap-actions">
      <button type="button" className="cap-btn" disabled={!!busy} onClick={suggest}>
        <Sparkles size={14} aria-hidden="true" /> {busy === 'suggest' ? 'Reading who they are…' : a ? 'Suggest a new look' : 'Suggest their look'}
      </button>
      <button type="button" className="ch-pill-btn" disabled={!!busy} onClick={() => { setForm(formOf(a || {})); setWhy(a?.why || null); }}>
        {a ? 'Edit' : 'Write it myself'}
      </button>
    </span>
  );

  return (
    <div className="cap" data-testid="cap">
      {editing && (
        <section className="ch-card" aria-labelledby="cap-edit">
          {head('cap-edit', 'How they look', Palette, null, 'One look every scene, post and portrait follows.')}
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
        </section>
      )}
      {note && <p className={note.kind === 'error' ? 'ch-note is-error' : 'ch-note'} role={note.kind === 'error' ? 'alert' : 'status'}>{note.text}</p>}

      <div className="cap-grid">
        <div className="cap-col">
          <section className="ch-card" aria-labelledby="cap-identity" data-testid="cap-identity">
            {head('cap-identity', 'Visual identity', ImagePlus, null, `Made from their saved look${cost ? `; about ${cost} each` : ''}.`)}
            <div className="cap-photo">
              {photo ? <img src={photo} alt={`${name}’s profile photo`} /> : <span className="cap-photo-empty">No profile photo yet</span>}
              <span className="cap-photo-label">Profile photo</span>
            </div>
            <span className="cap-actions">
              <button type="button" className="cap-btn" disabled={!!busy || !a?.summary} onClick={portrait}>
                <ImagePlus size={14} aria-hidden="true" /> {busy === 'portrait' ? 'Making a portrait…' : 'Make a portrait'}
              </button>
              {!a?.summary && <span className="ch-note">Save their look first (at least “at a glance”).</span>}
            </span>
            {portraits.length > 0 && (
              <>
                <ul className="cap-portraits">
                  {portraitPage.map((p) => (
                    <li key={p.url} className="cap-portrait" data-testid="cap-portrait">
                      <img src={p.url} alt={`A portrait of ${name}`} loading="lazy" />
                      {data.portrait_url === p.url
                        ? <span className="cap-current"><Check size={14} aria-hidden="true" /> Their profile photo</span>
                        : (
                          <button type="button" className="cap-btn-soft" disabled={!!busy} onClick={() => use(p.url)}>
                            {busy === p.url ? 'Setting…' : 'Use as their profile photo'}
                          </button>
                        )}
                      <button type="button" className="cap-btn-soft" disabled={!!busy} onClick={() => remove(p.url)}
                        aria-label={`Remove this portrait${data.portrait_url === p.url ? ' (their profile photo)' : ''}`}>
                        {busy === `remove:${p.url}` ? 'Removing…' : 'Remove'}
                      </button>
                    </li>
                  ))}
                </ul>
                <Pager page={page} total={portraits.length} size={PORTRAITS_PER_PAGE} onPage={setPage} label="Portraits" />
              </>
            )}
          </section>
          <section className="ch-card" aria-labelledby="cap-pal" data-testid="cap-palette">
            {head('cap-pal', 'Wardrobe palette', Palette)}
            {palette.length ? (
              <ul className="cap-swatches">
                {palette.map((c) => (
                  <li key={c} className="cap-swatch">
                    <span className="cap-swatch-chip" style={swatchStyle(c)} aria-hidden="true" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="ch-note">No palette yet.</p>}
          </section>
        </div>
        <div className="cap-col">
          <section className="ch-card" aria-labelledby="cap-look" data-testid="cap-physical">
            {head('cap-look', 'Physical details', Sparkles, null, 'One look every scene, post and portrait follows.')}
            {a && physical.length > 0 ? (
              <dl className="cap-sheet" data-testid="cap-sheet">
                {physical.map((k) => (
                  <div key={k} className="cap-row">
                    <dt>{LABEL[k]}</dt>
                    <dd>{a[k]}</dd>
                  </div>
                ))}
              </dl>
            ) : <p className="ch-note">{a ? 'Nothing written about their face, hair or build yet.' : 'No appearance yet. Suggest one from who they are, or write it.'}</p>}
            {actions}
          </section>
          <section className="ch-card" aria-labelledby="cap-acc" data-testid="cap-accessories">
            {head('cap-acc', 'Accessories', Gem)}
            <p className="cap-text">{a?.accessories || <span className="ch-note">No accessories written yet.</span>}</p>
          </section>
        </div>
        <div className="cap-col">
          <section className="ch-card" aria-labelledby="cap-sig" data-testid="cap-signature">
            {head('cap-sig', 'Signature look', Shirt)}
            {looks.length ? (
              <ul className="cap-looks">
                {looks.map(([k, label]) => (
                  <li key={k} className={`cap-look is-${k}`}>
                    <span className="cap-look-label">{label}</span>
                    <span>{a[k]}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="ch-note">No signature look yet: what they wear going out, at home, and never.</p>}
          </section>
          <section className="ch-card" aria-labelledby="cap-notes" data-testid="cap-notes">
            {head('cap-notes', 'Appearance notes', FileText)}
            {a?.summary || a?.why ? (
              <ul className="ch-rules-list">
                {a.summary && <li><span className="ch-wf-kind">At a glance</span>{a.summary}</li>}
                {a.why && <li className="cap-why"><span className="ch-wf-kind">Why this look</span>Why: {a.why}</li>}
              </ul>
            ) : <p className="ch-note">No notes yet.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
