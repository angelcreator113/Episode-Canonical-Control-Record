/**
 * FillMissingPanel — "Fill what's missing" (Evoni, 2026-10-25): every draft
 * side by side, each with Accept / Edit / Skip, and Accept all. A draft is
 * saved only when accepted (useFillMissing, through the event PUT). Each
 * row says where it came from and why: "AI draft", "From this event's
 * facts" (the page's own suggestions, which Suggest with AI used to list),
 * or "Rate card" for a fee. Fresh ideas (nothing was empty) also say what
 * they would replace.
 */
import { useEffect, useRef, useState } from 'react';
import { Check, Pencil, SkipForward, Sparkles, X, Loader2 } from 'lucide-react';
import { EVENT_CATEGORIES, EVENT_FORMATS, taxonomyLabel } from '../../utils/eventTaxonomy';
import { fieldValueText, NUMBER_FIELDS } from '../../lib/eventActions';

const OPTIONS = { category: EVENT_CATEGORIES, format: EVENT_FORMATS };
const LONG = new Set(['description', 'narrative_stakes', 'fail_consequence', 'success_unlock']);
const SOURCE_LABEL = { ai: 'AI draft', facts: 'From this event’s facts', rate_card: 'Rate card' };
const INPUT_TYPE = { event_time: 'time', event_date: 'date' };

function DraftEditor({ row, onChange }) {
  const label = `Draft ${row.label.toLowerCase()}`;
  if (OPTIONS[row.field]) {
    return (
      <select value={row.draft} onChange={(e) => onChange(e.target.value)} aria-label={label} data-testid={`fill-edit-${row.field}`}>
        {!OPTIONS[row.field].includes(row.draft) && <option value={row.draft}>{row.draft}</option>}
        {OPTIONS[row.field].map((o) => <option key={o} value={o}>{taxonomyLabel(o)}</option>)}
      </select>
    );
  }
  if (LONG.has(row.field)) {
    return <textarea rows={3} value={row.draft} onChange={(e) => onChange(e.target.value)} aria-label={label} data-testid={`fill-edit-${row.field}`} />;
  }
  return (
    <input
      type={INPUT_TYPE[row.field] || (NUMBER_FIELDS.has(row.field) ? 'number' : 'text')}
      value={row.draft} onChange={(e) => onChange(e.target.value)} aria-label={label} data-testid={`fill-edit-${row.field}`}
    />
  );
}

export default function FillMissingPanel({ fill }) {
  const [editing, setEditing] = useState(() => new Set());
  const headRef = useRef(null);
  useEffect(() => { headRef.current?.focus(); }, []);
  const { rows, saving, openCount, canAcceptAll } = fill;
  const ideas = fill.mode === 'ideas';
  const toggleEdit = (field) => setEditing((s) => { const n = new Set(s); if (n.has(field)) n.delete(field); else n.add(field); return n; });

  return (
    <div className="eff-fill" role="region" aria-labelledby="eff-fill-title" data-testid="fill-missing-panel"
      onKeyDown={(e) => { if (e.key === 'Escape' && !saving) { e.stopPropagation(); fill.close(); } }}>
      <div className="eff-fill-head">
        <h3 id="eff-fill-title" ref={headRef} tabIndex={-1}><Sparkles size={14} aria-hidden="true" /> {ideas ? 'Fresh ideas' : <>Drafts for what&apos;s missing</>}</h3>
        <button type="button" className="epp-icon-btn" onClick={fill.close} disabled={saving} aria-label="Close the drafts"><X size={15} /></button>
      </div>
      <p className="eff-fill-note">Nothing is saved until you accept it.</p>
      {rows.length === 0 && (
        <p className="eff-fill-empty" data-testid="fill-empty">
          {ideas ? 'No new ideas this time.' : 'Nothing to draft: every field it can fill is set.'}
        </p>
      )}
      {rows.length > 0 && (
        <ul className="eff-fill-list">
          {rows.map((row) => {
            const isEditing = editing.has(row.field) && row.state === 'open';
            return (
              <li key={row.field} className={`eff-fill-row is-${row.state}`} data-testid={`fill-row-${row.field}`} data-state={row.state} data-source={row.source}>
                <div className="eff-fill-field">{row.label}</div>
                <div className="eff-fill-value">
                  {isEditing ? <DraftEditor row={row} onChange={(v) => fill.edit(row.field, v)} />
                    : <span className="eff-fill-text" data-testid={`fill-value-${row.field}`}>{row.display || fieldValueText(row.field, row.draft)}</span>}
                  {row.current != null && (
                    <span className="eff-fill-now" data-testid={`fill-current-${row.field}`}>Now: {fieldValueText(row.field, row.current)}</span>
                  )}
                  <span className={`eff-fill-why is-${row.source}`}>{SOURCE_LABEL[row.source] || 'AI draft'}{row.reason ? ` · ${row.reason}` : ''}</span>
                </div>
                <div className="eff-fill-actions">
                  {row.state === 'open' && (
                    <>
                      <button type="button" className="epp-btn epp-btn-small epp-btn-primary" data-testid={`fill-accept-${row.field}`}
                        onClick={() => fill.acceptOne(row.field)} disabled={saving || !fill.usable(row)}>
                        <Check size={13} aria-hidden="true" /> Accept
                      </button>
                      {!row.fixed && (
                        <button type="button" className="epp-btn epp-btn-small" data-testid={`fill-editbtn-${row.field}`}
                          onClick={() => toggleEdit(row.field)} disabled={saving} aria-pressed={isEditing}>
                          <Pencil size={13} aria-hidden="true" /> {isEditing ? 'Done' : 'Edit'}
                        </button>
                      )}
                      <button type="button" className="epp-btn epp-btn-small" data-testid={`fill-skip-${row.field}`}
                        onClick={() => fill.skip(row.field)} disabled={saving}>
                        <SkipForward size={13} aria-hidden="true" /> Skip
                      </button>
                    </>
                  )}
                  {row.state === 'saving' && <span className="eff-fill-status"><Loader2 size={13} className="epp-spin-icon" aria-hidden="true" /> Saving…</span>}
                  {row.state === 'saved' && <span className="eff-fill-status is-saved"><Check size={13} aria-hidden="true" /> Saved</span>}
                  {row.state === 'skipped' && <span className="eff-fill-status">Skipped</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="eff-fill-foot">
        <button type="button" className="epp-btn epp-btn-small" onClick={fill.close} disabled={saving} data-testid="fill-close">
          {openCount ? 'Close' : 'Done'}
        </button>
        {openCount > 1 && (
          <button type="button" className="epp-btn epp-btn-small epp-btn-primary" onClick={fill.acceptAll} disabled={saving || !canAcceptAll} data-testid="fill-accept-all">
            <Check size={13} aria-hidden="true" /> Accept all ({openCount})
          </button>
        )}
      </div>
    </div>
  );
}
