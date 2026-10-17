/**
 * A content type's shared audiences on the Society tab (Evoni's idea 4,
 * 2026-10-17; services/audienceMap): the types it shares an audience with
 * (they comment on each other, collaborate) and the types it competes with
 * (rivals watch each other). Who comments on whose posts follows these,
 * niche first (two creators in the same niche overlap most; services/
 * audienceMap pairAffinity).
 * Edit changes them; Suggest proposes some (nothing saved until Save);
 * Reset goes back to the default for the fifteen default types.
 */
import { useEffect, useState } from 'react';
import api from '../../services/api';
import './AudienceLinks.css';

// One read of the whole map for every card on the page.
let mapRequest = null;
export const loadAudienceMap = (fresh = false) => {
  if (fresh || !mapRequest) {
    mapRequest = api.get('/api/v1/cast/audience-map')
      .then((r) => Object.fromEntries((r.data?.types || []).map((t) => [t.name, t])))
      .catch((err) => { mapRequest = null; throw err; });
  }
  return mapRequest;
};

const Chips = ({ names, empty }) => (names.length
  ? <span className="al-chips">{names.map((n) => <span key={n} className="al-chip">{n}</span>)}</span>
  : <span className="al-none">{empty}</span>);

export default function AudienceLinks({ name, types }) {
  const [type, setType] = useState(null);
  const [all, setAll] = useState([]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);

  useEffect(() => {
    let live = true;
    loadAudienceMap()
      .then((map) => {
        if (!live) return;
        setType(map[name] || { name, shares: [], competes: [], custom: false, has_default: false });
        setAll(Object.keys(map));
      })
      .catch((err) => {
        console.error('[AudienceLinks] the audience map could not be read:', err?.response?.status || err?.message);
        if (live) setType({ error: true });
      });
    return () => { live = false; };
  }, [name]);

  if (!type) return null;
  if (type.error) return <p className="al-none">Shared audiences could not be read just now.</p>;
  const others = (types && types.length ? types : all).filter((n) => n !== name);

  const toggle = (key, n) => setForm((f) => ({ ...f, [key]: f[key].includes(n) ? f[key].filter((x) => x !== n) : [...f[key], n] }));
  const call = async (what, fn, ok) => {
    setBusy(what);
    setNote(null);
    try {
      await fn();
      if (ok) setNote({ kind: 'ok', text: ok });
    } catch (err) {
      console.error(`[AudienceLinks] ${what} failed:`, err);
      setNote({ kind: 'error', text: err.response?.data?.error || 'That did not work. Try again.' });
    } finally {
      setBusy(null);
    }
  };
  const saved = (t) => { setType(t); setForm(null); loadAudienceMap(true).catch(() => {}); };
  const save = () => call('save', async () => {
    const res = await api.put('/api/v1/cast/audience-map', { name, shares: form.shares, competes: form.competes });
    saved(res.data?.type);
  }, 'Saved.');
  const reset = () => call('reset', async () => {
    const res = await api.put('/api/v1/cast/audience-map', { name, reset: true });
    saved(res.data?.type);
  }, 'Back to the default.');
  const suggest = () => call('suggest', async () => {
    const res = await api.post('/api/v1/cast/audience-map/suggest', { name });
    setForm({ shares: res.data?.shares || [], competes: res.data?.competes || [] });
    if (res.data?.why) setNote({ kind: 'ok', text: `Suggested: ${res.data.why} Change anything, then save.` });
  });

  return (
    <div className="al" data-testid="ss-audience">
      <span className="ss-label">Audience{type.custom ? ' (yours)' : ''}</span>
      <p className="al-none">Who actually overlaps depends on niche first: two creators in the same niche share the most, whatever their types; these links decide whether they share or compete.</p>
      {!form ? (
        <>
          <p className="al-row"><strong>Shares an audience with</strong> <Chips names={type.shares} empty="none yet" /></p>
          <p className="al-row"><strong>Competes with</strong> <Chips names={type.competes} empty="none" /></p>
          <span className="al-actions">
            <button type="button" className="al-btn" disabled={!!busy} onClick={() => setForm({ shares: [...type.shares], competes: [...type.competes] })}>Edit</button>
            <button type="button" className="al-btn" disabled={!!busy} onClick={suggest}>{busy === 'suggest' ? 'Suggesting…' : 'Suggest'}</button>
            {type.custom && type.has_default && <button type="button" className="al-btn" disabled={!!busy} onClick={reset}>Reset to default</button>}
          </span>
        </>
      ) : (
        <form className="al-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
          {[['shares', 'Shares an audience with'], ['competes', 'Competes with']].map(([key, label]) => (
            <fieldset key={key} className="al-set">
              <legend>{label}</legend>
              {others.map((n) => (
                <label key={n} className="al-pick">
                  <input type="checkbox" checked={form[key].includes(n)} onChange={() => toggle(key, n)} aria-label={`${label}: ${n}`} /> {n}
                </label>
              ))}
            </fieldset>
          ))}
          <span className="al-actions">
            <button type="submit" className="al-btn is-primary" disabled={!!busy}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
            <button type="button" className="al-btn" disabled={!!busy} onClick={() => setForm(null)}>Cancel</button>
          </span>
        </form>
      )}
      {note && <p className={`al-note${note.kind === 'error' ? ' is-error' : ''}`} role={note.kind === 'error' ? 'alert' : 'status'}>{note.text}</p>}
    </div>
  );
}
