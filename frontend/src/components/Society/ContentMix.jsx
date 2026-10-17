/**
 * A content type's mix on the Society tab (Evoni's idea 3, 2026-10-17;
 * services/contentPillars): its pillars, each with its share of the posts
 * and an example. Generate Posts keeps a character to their type's mix.
 * Edit changes it; Suggest proposes one (nothing saved until Save); Reset
 * goes back to the default for the fifteen default types.
 */
import { useState } from 'react';
import api from '../../services/api';
import './ContentMix.css';

const blank = () => ({ name: '', share: '', example: '' });

export default function ContentMix({ type, onSaved }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const pillars = type?.pillars || [];

  const edit = (from = pillars) => setRows((from.length ? from : [blank()]).map((p) => ({ name: p.name, share: String(p.share ?? ''), example: p.example || '' })));
  const change = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const sum = (rows || []).reduce((a, r) => a + (Number(r.share) || 0), 0);

  const call = async (what, fn, ok) => {
    setBusy(what);
    setNote(null);
    try {
      await fn();
      if (ok) setNote({ kind: 'ok', text: ok });
    } catch (err) {
      console.error(`[ContentMix] ${what} failed:`, err);
      setNote({ kind: 'error', text: err.response?.data?.error || 'That did not work. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  const save = () => call('save', async () => {
    const body = { name: type.name, pillars: rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name, share: Number(r.share) || 0, example: r.example })) };
    const res = await api.put('/api/v1/cast/content-pillars', body);
    setRows(null);
    onSaved?.({ ...type, pillars: res.data?.pillars || [], custom: true });
  }, 'Saved. Shares are scaled to add up to 100.');

  const reset = () => call('reset', async () => {
    const res = await api.put('/api/v1/cast/content-pillars', { name: type.name, pillars: null });
    setRows(null);
    onSaved?.({ ...type, pillars: res.data?.pillars || [], custom: false });
  }, 'Back to the default mix.');

  const suggest = () => call('suggest', async () => {
    const res = await api.post('/api/v1/cast/content-pillars/suggest', { name: type.name });
    edit(res.data?.pillars || []);
  }, 'Suggested. Change anything, then save.');

  return (
    <div className="cm" data-testid="ss-content-mix">
      <span className="ss-label">Content mix{type?.custom ? ' (yours)' : ''}</span>
      {!rows ? (
        <>
          {pillars.length ? (
            <ul className="cm-list">
              {pillars.map((p) => (
                <li key={p.name} className="cm-pillar">
                  <span className="cm-bar" style={{ width: `${p.share}%` }} aria-hidden="true" />
                  <strong>{p.name}</strong> <span className="cm-share">{p.share}%</span>
                  {p.example && <span className="cm-example">{p.example}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="cm-note">No mix yet. Suggest one, or write your own.</p>}
          <span className="cm-actions">
            <button type="button" className="cm-btn" disabled={!!busy} onClick={() => edit()}>{pillars.length ? 'Edit mix' : 'Write a mix'}</button>
            <button type="button" className="cm-btn" disabled={!!busy} onClick={suggest}>{busy === 'suggest' ? 'Suggesting…' : 'Suggest a mix'}</button>
            {type?.custom && type?.has_default && <button type="button" className="cm-btn" disabled={!!busy} onClick={reset}>Reset to default</button>}
          </span>
        </>
      ) : (
        <form className="cm-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
          {rows.map((r, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <fieldset key={i} className="cm-row">
              <legend className="cm-legend">Pillar {i + 1}</legend>
              <label>Name<input value={r.name} onChange={(e) => change(i, { name: e.target.value })} maxLength={60} /></label>
              <label>Share %<input type="number" min="0" max="100" value={r.share} onChange={(e) => change(i, { share: e.target.value })} /></label>
              <label>Example<input value={r.example} onChange={(e) => change(i, { example: e.target.value })} maxLength={200} /></label>
              <button type="button" className="cm-btn" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label={`Remove pillar ${i + 1}`}>Remove</button>
            </fieldset>
          ))}
          <p className="cm-note">Shares add up to {sum}%{sum !== 100 ? '; they are scaled to 100 when saved' : ''}.</p>
          <span className="cm-actions">
            {rows.length < 6 && <button type="button" className="cm-btn" onClick={() => setRows((rs) => [...rs, blank()])}>Add a pillar</button>}
            <button type="submit" className="cm-btn is-primary" disabled={!!busy}>{busy === 'save' ? 'Saving…' : 'Save mix'}</button>
            <button type="button" className="cm-btn" disabled={!!busy} onClick={() => setRows(null)}>Cancel</button>
          </span>
        </form>
      )}
      {note && <p className={`cm-note${note.kind === 'error' ? ' is-error' : ''}`} role={note.kind === 'error' ? 'alert' : 'status'}>{note.text}</p>}
    </div>
  );
}
