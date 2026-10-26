/**
 * Producer Mode → Release: the season's bonus episodes and specials, each on
 * its own day (Evoni, 2026-10-26: "All three and on YouTube"; services/
 * seasonSpecials). The weekly schedule never dates them, so each one's date
 * and time is set here (or on the Roadmap's special card), with the
 * suggested day to take in one click: the Wednesday nearest a bonus's event,
 * else midweek after the episode it follows. A special with a date gets the
 * same deadline warning as a weekly episode. Shown only when there is one.
 *
 * Props: rs (useReleaseSchedule), api, showId.
 */
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { formatDay, formatTime, deadlineWarning, errorText } from '../../lib/releaseSchedule';
import './SpecialReleaseDates.css';

function SpecialDateRow({ row, onSave }) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(row.date || '');
  const [time, setTime] = useState(row.time || '');
  const [error, setError] = useState(null);
  const save = async (patch) => {
    setError(null);
    try { await onSave(row.special_id, patch); setEditing(false); } catch (err) {
      console.error('[SpecialReleaseDates] date failed:', err);
      setError(errorText(err));
    }
  };
  const when = row.date ? `${formatDay(row.date)}${row.time ? ` · ${formatTime(row.time)}` : ''}` : 'No date yet';
  const suggested = row.suggested?.date ? `${formatDay(row.suggested.date)}${row.suggested.time ? ` · ${formatTime(row.suggested.time)}` : ''}` : null;
  const warning = deadlineWarning(row, null);
  return (
    <li className={`srel-row${row.date ? '' : ' is-unset'}`} data-testid={`srel-row-${row.special_id}`}>
      <span className="srel-label">{row.special?.label}</span>
      <span className="srel-body">
        <strong className="srel-title">{row.title || 'Untitled special'}</strong>
        <span className="srel-when" data-testid={`srel-when-${row.special_id}`}>{when} · YouTube</span>
        {warning && <span className={`srel-warn is-${warning.tone}`} role="status">{warning.text}</span>}
        {editing ? (
          <span className="srel-edit">
            <input type="date" aria-label={`${row.special?.label} release date`} value={date} onChange={(e) => setDate(e.target.value)} />
            <input type="time" aria-label={`${row.special?.label} release time`} value={time} onChange={(e) => setTime(e.target.value)} />
            <button type="button" className="rsch-btn" onClick={() => save({ release_date: date || null, release_time: time || null })}>Save</button>
            <button type="button" className="rsch-link" onClick={() => setEditing(false)}>Cancel</button>
          </span>
        ) : (
          <span className="srel-edit">
            <button type="button" className="rsch-link" onClick={() => setEditing(true)} data-testid={`srel-change-${row.special_id}`}>{row.date ? 'Change date' : 'Set a date'}</button>
            {!row.date && suggested && (
              <button type="button" className="rsch-link" onClick={() => save({ release_date: row.suggested.date, release_time: row.suggested.time || null })}
                data-testid={`srel-use-${row.special_id}`}>Use {suggested}</button>
            )}
          </span>
        )}
        {error && <span className="rsch-error" role="alert">{error}</span>}
      </span>
    </li>
  );
}

export default function SpecialReleaseDates({ rs, api, showId }) {
  const rows = rs?.view?.specials || [];
  if (!rows.length) return null;
  const onSave = async (id, patch) => {
    await api.patch(`/api/v1/world/${showId}/season/specials/${id}`, patch);
    await rs.reload();
  };
  return (
    <section className="srel" aria-label="Specials" data-testid="release-specials">
      <h3 className="srel-head"><Sparkles size={18} aria-hidden="true" /> Specials <span>their own days, on YouTube; the weekly episodes keep theirs</span></h3>
      <ul className="srel-list">
        {rows.map((r) => <SpecialDateRow key={r.special_id} row={r} onSave={onSave} />)}
      </ul>
    </section>
  );
}
