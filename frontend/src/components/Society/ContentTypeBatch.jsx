/**
 * The Society tab's batch for LalaVerse Feed profiles with no content type
 * yet (Evoni, 2026-10-17: the cards read "0 in the Feed"). One AI read per
 * profile (POST /cast/content-types/suggest-unset, at most 12 at a time)
 * proposes what each is known for; nothing is saved until Evoni keeps the
 * ones she wants, changing any first (POST /cast/content-types/apply).
 */
import { useState } from 'react';
import api from '../../services/api';
import './ContentTypeBatch.css';

export default function ContentTypeBatch({ unset, archetypes, onApplied }) {
  const [rows, setRows] = useState(null);
  const [more, setMore] = useState(0);
  const [failed, setFailed] = useState([]);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);

  const suggest = async () => {
    setBusy('suggest');
    setNote(null);
    try {
      const res = await api.post('/api/v1/cast/content-types/suggest-unset', {});
      setRows((res.data?.suggestions || []).map((s) => ({ ...s, keep: true, choice: s.name })));
      setFailed(res.data?.failed || []);
      setMore(res.data?.more || 0);
    } catch (err) {
      console.error('[ContentTypeBatch] suggest failed:', err);
      setNote({ kind: 'error', text: err.response?.data?.error || 'Could not suggest content types just now.' });
    } finally {
      setBusy(null);
    }
  };

  const change = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const apply = async () => {
    const items = rows.filter((r) => r.keep && r.choice).map((r) => ({ profile_id: r.profile_id, name: r.choice }));
    if (!items.length) { setNote({ kind: 'error', text: 'Tick at least one to save.' }); return; }
    setBusy('apply');
    setNote(null);
    try {
      const res = await api.post('/api/v1/cast/content-types/apply', { items });
      const saved = res.data?.saved?.length || 0;
      setRows(null);
      setNote({ kind: 'ok', text: `Saved ${saved} content type${saved === 1 ? '' : 's'}.` });
      if (onApplied) onApplied();
    } catch (err) {
      console.error('[ContentTypeBatch] apply failed:', err);
      setNote({ kind: 'error', text: err.response?.data?.error || 'Could not save them.' });
    } finally {
      setBusy(null);
    }
  };

  if (!unset && !rows && !note) return null;
  return (
    <div className="ctb" data-testid="ss-content-batch">
      {!rows ? (
        unset > 0 && (
          <button type="button" className="ctb-btn" disabled={!!busy} onClick={suggest}>
            {busy === 'suggest' ? `Reading ${Math.min(unset, 12)} profile${unset === 1 ? '' : 's'}…` : `Suggest content types for the ${unset} with none`}
          </button>
        )
      ) : (
        <>
          <p className="ctb-note">What each is known for, read from their profile. Untick any you don’t want, or pick another, then save.</p>
          <ul className="ctb-list">
            {rows.map((r, i) => (
              <li key={r.profile_id} className="ctb-row">
                <label className="ctb-keep">
                  <input type="checkbox" checked={r.keep} onChange={(e) => change(i, { keep: e.target.checked })} aria-label={`Keep for ${r.display_name || r.handle}`} />
                  <strong>{r.display_name || r.handle}</strong>{r.handle && r.display_name ? <span className="ctb-handle"> {r.handle}</span> : null}
                </label>
                <select value={r.choice} onChange={(e) => change(i, { choice: e.target.value })} aria-label={`Content type for ${r.display_name || r.handle}`}>
                  {archetypes.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
                </select>
                {r.why && <p className="ctb-why">{r.why}</p>}
                {r.differs_from_job && r.tension && <p className="ctb-tension">Job vs content: {r.tension}</p>}
              </li>
            ))}
          </ul>
          {failed.length > 0 && <p className="ctb-note">No suggestion for {failed.map((f) => f.display_name || f.handle).join(', ')}: {failed[0].error}</p>}
          {more > 0 && <p className="ctb-note">{more} more after these; suggest again once these are saved.</p>}
          <span className="ctb-actions">
            <button type="button" className="ctb-btn" disabled={!!busy} onClick={apply}>{busy === 'apply' ? 'Saving…' : 'Save the ticked ones'}</button>
            <button type="button" className="ctb-btn is-soft" disabled={!!busy} onClick={() => setRows(null)}>Cancel</button>
          </span>
        </>
      )}
      {note && <p className={`ctb-note${note.kind === 'error' ? ' is-error' : ''}`} role={note.kind === 'error' ? 'alert' : 'status'}>{note.text}</p>}
    </div>
  );
}
