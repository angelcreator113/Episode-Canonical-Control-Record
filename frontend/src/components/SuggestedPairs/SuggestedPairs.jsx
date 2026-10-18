/**
 * Suggested pairs on the Relationship Map (Evoni's idea 4, PR 2,
 * 2026-10-17; services/pairSuggestions): creators who share an audience or
 * compete for one but have no relationship yet, each with a proposed kind
 * and why. Keep makes the relationship (change the kind or the line
 * first); Dismiss never suggests that pair again. The Feed scheduler's
 * auto-discover adds here too, instead of making relationships on its own.
 */
import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import './SuggestedPairs.css';

const KINDS = ['collab', 'rival', 'feud', 'mentor', 'bestie', 'shade', 'copycat', 'orbit'];
const BASE = '/api/v1/feed-relationships/suggestions';
const at = (h) => `@${String(h || '').replace(/^@+/, '')}`;

export default function SuggestedPairs({ onKept }) {
  const [pairs, setPairs] = useState(null);
  const [open, setOpen] = useState(false);
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(BASE);
      setPairs(res.data?.pairs || []);
    } catch (err) {
      console.error('[SuggestedPairs] could not load:', err);
      setPairs([]);
      setNote({ kind: 'error', text: err.response?.data?.error || 'Suggested pairs could not be loaded.' });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const edit = (key, patch) => setEdits((e) => ({ ...e, [key]: { ...(e[key] || {}), ...patch } }));
  const run = async (what, fn, ok) => {
    setBusy(what);
    setNote(null);
    try {
      const msg = await fn();
      setNote({ kind: 'ok', text: msg || ok });
    } catch (err) {
      console.error(`[SuggestedPairs] ${what} failed:`, err);
      setNote({ kind: 'error', text: err.response?.data?.error || 'That did not work. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  const suggest = () => run('suggest', async () => {
    const res = await api.post(BASE, {});
    await load();
    setOpen(true);
    const n = res.data?.added?.length || 0;
    return n ? `${n} new pair${n === 1 ? '' : 's'} to look at.` : (res.data?.note || 'No new pairs.');
  });
  const keep = (p) => run(`keep:${p.key}`, async () => {
    const e = edits[p.key] || {};
    await api.post(`${BASE}/${p.key}/keep`, { type: e.type || p.type, why: e.why ?? p.why });
    await load();
    if (onKept) onKept();
  }, `Kept: ${at(p.profile_a.handle)} and ${at(p.profile_b.handle)} are now on the map.`);
  const dismiss = (p) => run(`dismiss:${p.key}`, async () => {
    await api.post(`${BASE}/${p.key}/dismiss`);
    await load();
  }, 'Dismissed. That pair will not be suggested again.');

  const count = pairs?.length || 0;
  return (
    <section className="sp" data-testid="suggested-pairs" aria-label="Suggested pairs">
      <div className="sp-head">
        <button type="button" className="sp-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          Suggested pairs{pairs ? ` (${count})` : ''}
        </button>
        <button type="button" className="sp-btn is-primary" disabled={!!busy} onClick={suggest}>
          {busy === 'suggest' ? 'Finding pairs…' : 'Suggest pairs'}
        </button>
      </div>
      {open && (
        <>
          <p className="sp-note">Creators who share an audience or compete for one, with no relationship yet: niche first, then content type. Nothing is added to the map until you keep it.</p>
          {pairs && !count && <p className="sp-note">Nothing waiting. Suggest pairs to look for some.</p>}
          <ul className="sp-list">
            {(pairs || []).map((p) => {
              const e = edits[p.key] || {};
              return (
                <li key={p.key} className="sp-row">
                  <div className="sp-who">
                    <strong>{at(p.profile_a.handle)}</strong> and <strong>{at(p.profile_b.handle)}</strong>
                    {p.source === 'auto' && <span className="sp-tag">from auto-discover</span>}
                  </div>
                  <div className="sp-meta">
                    {[p.profile_a.society_archetype, p.profile_b.society_archetype].filter(Boolean).join(' · ')}
                    {p.profile_a.content_category && p.profile_a.content_category === p.profile_b.content_category ? ` · both ${p.profile_a.content_category}` : ''}
                  </div>
                  <label className="sp-field">Kind
                    <select value={e.type || p.type} onChange={(ev) => edit(p.key, { type: ev.target.value })} aria-label={`Kind for ${at(p.profile_a.handle)} and ${at(p.profile_b.handle)}`}>
                      {[...new Set([p.type, ...KINDS])].map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
                    </select>
                  </label>
                  <label className="sp-field">Why
                    <input value={e.why ?? (p.why || '')} onChange={(ev) => edit(p.key, { why: ev.target.value })} maxLength={300} aria-label={`Why for ${at(p.profile_a.handle)} and ${at(p.profile_b.handle)}`} />
                  </label>
                  <span className="sp-actions">
                    <button type="button" className="sp-btn is-primary" disabled={!!busy} onClick={() => keep(p)}>{busy === `keep:${p.key}` ? 'Keeping…' : 'Keep'}</button>
                    <button type="button" className="sp-btn" disabled={!!busy} onClick={() => dismiss(p)}>Dismiss</button>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {note && <p className={`sp-note${note.kind === 'error' ? ' is-error' : ''}`} role={note.kind === 'error' ? 'alert' : 'status'}>{note.text}</p>}
    </section>
  );
}
