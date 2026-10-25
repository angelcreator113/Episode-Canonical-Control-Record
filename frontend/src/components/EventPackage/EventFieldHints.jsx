/**
 * EventFieldHints — beside a section's fields (Evoni, 2026-10-25): the
 * smart defaults for them as one-tap chips ("Black tie · Maison Velour's
 * usual, 2 of its 3 other events"), and the quiet clash warnings that
 * concern them (the same day, a double-booked guest, money). A chip saves
 * that one field through the event PUT when tapped; nothing is saved
 * otherwise. `fields`: which defaults and clash fields this place shows.
 */
import { useState } from 'react';
import { AlertTriangle, Wand } from 'lucide-react';
import { FIELD_LABELS, fieldValueText } from '../../lib/eventFlow';
import './EventFlow.css';

export default function EventFieldHints({ flow, fields, used, putEvent, load, setToast }) {
  const [busy, setBusy] = useState(null);
  const defaults = (flow?.defaults || []).filter((d) => fields.includes(d.field));
  const warnings = (flow?.clashes?.lines || []).filter((l) => fields.includes(l.field));
  if (!defaults.length && !warnings.length) return null;

  const apply = async (d) => {
    if (used || busy) return;
    setBusy(d.field);
    try {
      await putEvent({ [d.field]: d.value });
      setToast(`${FIELD_LABELS[d.field] || d.field} set to ${fieldValueText(d.field, d.value)}`);
      await load();
    } catch (err) {
      console.error('[EventFieldHints] applying a default failed:', err);
      setToast(err.response?.data?.error || err.message || 'Failed to save');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="eff-hints" data-testid={`field-hints-${fields.join('-')}`}>
      {warnings.map((w, i) => (
        <p key={`${w.kind}-${i}`} className="eff-warn" data-testid={`clash-${w.kind}`}><AlertTriangle size={13} aria-hidden="true" /> {w.text}</p>
      ))}
      {!used && defaults.length > 0 && (
        <div className="eff-chips" role="group" aria-label="Suggested from the host and venue">
          {defaults.map((d) => (
            <button
              key={d.field} type="button" className="eff-chip" data-testid={`default-chip-${d.field}`}
              onClick={() => apply(d)} disabled={!!busy} title={d.basis}
            >
              <Wand size={12} aria-hidden="true" />
              <span className="eff-chip-field">{FIELD_LABELS[d.field]}:</span> <strong>{fieldValueText(d.field, d.value)}</strong>
              <span className="eff-chip-basis">{d.basis}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
