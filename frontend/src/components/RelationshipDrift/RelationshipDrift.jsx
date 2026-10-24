/**
 * Where relationships disagree (Evoni, 2026-10-23: "We need to make sure
 * everywhere relationships are mentioned all information is the same";
 * services/relationshipTruth). The story pair is the truth; each item is a
 * place another store says something else: the Pulse pair's kind, a Pulse
 * couple with someone the story does not pair them with, a Pulse profile's
 * tie to Lala, a character's relationships map. Fix applies the suggested
 * fix (the server reads it fresh); Different on purpose keeps the item off
 * the list until one of the stores changes (a secret romance shown online
 * as friends, say).
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, EyeOff } from 'lucide-react';
import api from '../../services/api';
import './RelationshipDrift.css';

const BASE = '/api/v1/relationships/drift';

const KIND_LABEL = {
  pulse_kind: 'Story and Pulse disagree',
  pulse_missing: 'Not on The Pulse',
  pulse_couple_elsewhere: 'A couple with someone else',
  lala_tie: 'Tie to Lala',
  relationships_map: 'Relationships map',
  pulse_story_deleted: 'Story pair deleted',
};

const whoOf = (item) => (item.who || []).map((p) => (p.handle && p.name !== p.handle ? `${p.name} (${p.handle})` : p.name)).join(' and ');

export default function RelationshipDrift({ onFixed }) {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(BASE);
      const list = Array.isArray(res.data?.items) ? res.data.items : [];
      setItems(list);
      return list;
    } catch (err) {
      console.error('[RelationshipDrift] could not load:', err);
      setItems([]);
      setNote({ kind: 'error', text: err.response?.data?.error || 'Where relationships disagree could not be loaded.' });
      return [];
    }
  }, []);
  useEffect(() => {
    load().then((list) => { if (list.length) setOpen(true); });
  }, [load]);

  const act = async (item, what) => {
    setBusy(`${what}:${item.key}`);
    setNote(null);
    try {
      await api.post(`${BASE}/${encodeURIComponent(item.key)}/${what}`, {});
      await load();
      if (what === 'fix' && onFixed) onFixed();
      setNote({ kind: 'ok', text: what === 'fix' ? `Fixed: ${item.fix?.label || 'done'}.` : `Kept as it is: ${whoOf(item)} stay different on purpose.` });
    } catch (err) {
      console.error(`[RelationshipDrift] ${what} failed:`, err);
      setNote({ kind: 'error', text: err.response?.data?.error || 'That did not work. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  const count = items?.length || 0;
  return (
    <section className="rd" data-testid="relationship-drift" aria-label="Where relationships disagree">
      <div className="rd-head">
        <button type="button" className="rd-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <AlertTriangle size={16} aria-hidden />
          Where relationships disagree{items ? ` (${count})` : ''}
        </button>
      </div>
      {open && (
        <>
          <p className="rd-note">The story (Relationships) is the truth. Each row is a place that says something else. Fix makes it agree; Different on purpose keeps it as it is, until something changes.</p>
          {items && !count && <p className="rd-note" data-testid="rd-empty">Everything agrees.</p>}
          <ul className="rd-list">
            {(items || []).map((item) => (
              <li key={item.key} className="rd-row" data-testid="rd-item">
                <div className="rd-who">
                  <strong>{whoOf(item)}</strong>
                  <span className="rd-tag">{KIND_LABEL[item.kind] || item.kind}</span>
                </div>
                <dl className="rd-says">
                  {(item.says || []).map((s) => (
                    <div key={s.store} className="rd-say">
                      <dt>{s.store}</dt>
                      <dd>{s.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="rd-actions">
                  <button type="button" className="rd-btn is-primary" disabled={!!busy} onClick={() => act(item, 'fix')}>
                    <Check size={14} aria-hidden />
                    {busy === `fix:${item.key}` ? 'Fixing…' : item.fix?.label || 'Fix'}
                  </button>
                  <button type="button" className="rd-btn" disabled={!!busy} onClick={() => act(item, 'keep')}>
                    <EyeOff size={14} aria-hidden />
                    {busy === `keep:${item.key}` ? 'Keeping…' : 'Different on purpose'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {note && <p className={`rd-note${note.kind === 'error' ? ' is-error' : ''}`} role={note.kind === 'error' ? 'alert' : 'status'}>{note.text}</p>}
    </section>
  );
}
