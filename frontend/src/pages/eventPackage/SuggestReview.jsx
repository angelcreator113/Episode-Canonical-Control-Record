/**
 * SuggestReview — the review list "Suggest with AI" opens (Evoni,
 * 2026-10-23: "use real AI for the suggestions"). One row per suggestion:
 * a checkbox (checked), the field, the value (editable before saving) and
 * why. AI rows come from POST …/suggest-basics; the page adds the
 * deterministic suggestions the AI did not cover, marked "Suggested from
 * the event's facts". Save checked hands the checked rows back to the page,
 * which writes them in one PUT; Cancel writes nothing.
 */
import { useEffect, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { taxonomyLabel } from '../../utils/eventTaxonomy';

export default function SuggestReview({ rows, aiEmpty, saving, onSave, onCancel }) {
  const [state, setState] = useState(() => rows.map((r) => ({ id: r.id, checked: true, value: r.value })));
  const headRef = useRef(null);
  useEffect(() => { headRef.current?.focus(); }, []);

  const byId = Object.fromEntries(state.map((s) => [s.id, s]));
  const set = (id, patch) => setState((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const checked = rows.filter((r) => byId[r.id]?.checked && (r.fixed || String(byId[r.id].value || '').trim()));

  return (
    <div className="epp-suggest-review" role="region" aria-labelledby="epp-suggest-review-title" data-testid="suggest-review"
      onKeyDown={(e) => { if (e.key === 'Escape' && !saving) { e.stopPropagation(); onCancel(); } }}>
      <div className="epp-suggest-review-head">
        <h3 id="epp-suggest-review-title" ref={headRef} tabIndex={-1}><Sparkles size={14} aria-hidden="true" /> Suggestions to review</h3>
        <button type="button" className="epp-icon-btn" onClick={onCancel} disabled={saving} aria-label="Cancel suggestions"><X size={15} /></button>
      </div>
      <p className="epp-suggest-review-note">AI suggestions — check them before saving.</p>
      {aiEmpty && <p className="epp-suggest-empty" data-testid="suggest-empty">No new suggestions.</p>}
      {rows.length > 0 && (
        <ul className="epp-suggest-list">
          {rows.map((r) => {
            const s = byId[r.id];
            const boxId = `epp-suggest-${r.id}`;
            return (
              <li key={r.id} className={`epp-suggest-row${s.checked ? '' : ' is-off'}`} data-testid={`suggest-row-${r.id}`} data-source={r.source}>
                <input type="checkbox" id={boxId} checked={s.checked} onChange={(e) => set(r.id, { checked: e.target.checked })} disabled={saving} />
                <div className="epp-suggest-body">
                  <label htmlFor={boxId} className="epp-suggest-label">{r.label}</label>
                  {r.fixed ? (
                    <span className="epp-suggest-value">{r.display || r.value}</span>
                  ) : r.spec.input === 'select' ? (
                    <select value={s.value} onChange={(e) => set(r.id, { value: e.target.value })} aria-label={`Suggested ${r.label.toLowerCase()}`} disabled={saving} data-testid={`suggest-value-${r.id}`}>
                      {!r.spec.options.includes(s.value) && <option value={s.value}>{s.value}</option>}
                      {r.spec.options.map((o) => <option key={o} value={o}>{taxonomyLabel(o)}</option>)}
                    </select>
                  ) : r.spec.input === 'textarea' ? (
                    <textarea rows={3} value={s.value} onChange={(e) => set(r.id, { value: e.target.value })} aria-label={`Suggested ${r.label.toLowerCase()}`} disabled={saving} data-testid={`suggest-value-${r.id}`} />
                  ) : (
                    <input
                      type={(r.spec.input === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(s.value)) || (r.spec.input === 'time' && /^\d{2}:\d{2}$/.test(s.value)) ? r.spec.input : 'text'}
                      value={s.value} maxLength={r.spec.maxLength}
                      onChange={(e) => set(r.id, { value: e.target.value })} aria-label={`Suggested ${r.label.toLowerCase()}`}
                      disabled={saving} data-testid={`suggest-value-${r.id}`}
                    />
                  )}
                  <span className="epp-suggest-reason">{r.source === 'facts' ? 'Suggested from the event’s facts' : 'AI'}{r.reason ? ` · ${r.reason}` : ''}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="epp-suggest-actions">
        <button type="button" className="epp-btn epp-btn-small" onClick={onCancel} disabled={saving} data-testid="suggest-cancel">Cancel</button>
        {rows.length > 0 && (
          <button
            type="button" className="epp-btn epp-btn-small epp-btn-primary" data-testid="suggest-save"
            disabled={saving || checked.length === 0}
            onClick={() => onSave(checked.map((r) => ({ ...r, value: r.fixed ? r.value : String(byId[r.id].value).trim() })))}
          >
            {saving ? 'Saving…' : `Save checked (${checked.length})`}
          </button>
        )}
      </div>
    </div>
  );
}
