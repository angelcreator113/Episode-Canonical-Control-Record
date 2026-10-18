/**
 * Studio types on Universe › Locations (Evoni, 2026-10-18: every creator's
 * studio read "venue · other"; "yes start the studio types"). Lists the
 * studios still typed "other" with the type that fits the creator who lives
 * there (their niche first, then their content type), and the new name when
 * the studio still has its generated one. Nothing changes until Evoni
 * applies the ones she keeps ticked. Hidden when there is nothing to fix.
 */
import { useCallback, useEffect, useState } from 'react';
import apiClient from '../../services/api';
import './StudioTypes.css';

const URL = '/api/v1/world/locations/studio-types';
const TYPE_WORDS = { recording_studio: 'recording studio' };
const typeWord = (t) => TYPE_WORDS[t] || t;

export default function StudioTypes({ onChanged }) {
  const [studios, setStudios] = useState(null);
  const [skip, setSkip] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(URL);
      setStudios(res.data?.studios || []);
    } catch (err) {
      console.error('[StudioTypes] could not load:', err);
      setStudios([]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (id) => setSkip((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const chosen = (studios || []).filter((s) => !skip.has(s.location_id));

  const apply = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await apiClient.post(URL, { items: chosen.map((s) => ({ location_id: s.location_id, ...s.proposed })) });
      const n = res.data?.changed || 0;
      setNote({ kind: 'ok', text: `Updated ${n} studio${n === 1 ? '' : 's'}.` });
      setSkip(new Set());
      await load();
      onChanged?.();
    } catch (err) {
      console.error('[StudioTypes] applying failed:', err);
      setNote({ kind: 'error', text: err.response?.data?.error || 'Could not update the studios.' });
    } finally {
      setBusy(false);
    }
  };

  if (!studios || (!studios.length && !note)) return null;
  return (
    <section className="stt" data-testid="studio-types" aria-label="Studio types">
      {studios.length > 0 && (
        <>
          <p className="stt-head">
            <strong>{studios.length} creator studio{studios.length === 1 ? ' is' : 's are'} typed “other”.</strong>{' '}
            Here is the type that fits who works there. Untick any you want to keep.
          </p>
          <ul className="stt-list">
            {studios.map((s) => (
              <li key={s.location_id}>
                <label className="stt-row">
                  <input type="checkbox" checked={!skip.has(s.location_id)} onChange={() => toggle(s.location_id)} />
                  <span>
                    <span className="stt-name">{s.proposed.name}</span>
                    {s.proposed.name !== s.name && <span className="stt-was"> (was {s.name})</span>}
                    <span className="stt-type"> · {typeWord(s.proposed.venue_type)}</span>
                    <span className="stt-why"> · {s.why}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button type="button" className="stt-btn" disabled={busy || !chosen.length} onClick={apply}>
            {busy ? 'Updating…' : `Apply ${chosen.length}`}
          </button>
        </>
      )}
      {note && <p className={`stt-note${note.kind === 'error' ? ' is-error' : ''}`} role={note.kind === 'error' ? 'alert' : 'status'}>{note.text}</p>}
    </section>
  );
}
