/**
 * InlineBasicsField — one Basics field edited in its own row (Evoni,
 * 2026-10-23), in place of the dialog each field used to open. The page owns
 * the draft and the save (saveBasicsField → putEvent, the same save queue and
 * version handling); this is the input, the suggestion fill and Save /
 * Cancel / Clear. Enter saves a one-line input (never an empty one: Enter
 * never clears a field); Escape cancels.
 */
import { CalendarClock, Sparkles } from 'lucide-react';
import { taxonomyLabel } from '../../utils/eventTaxonomy';
import { DATE_DRAFT_SOURCE } from '../../utils/eventBasics';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^\d{2}:\d{2}$/;

export default function InlineBasicsField({
  fieldKey, spec, field, draft, onDraft, saving, onSave, onCancel, onClear, formatValue,
}) {
  // A stored value the native date/time input can't show (older free-text
  // rows) falls back to a text input, so it isn't lost.
  const nativeOk = (spec.input === 'date' && (!draft || ISO_DATE.test(draft)))
    || (spec.input === 'time' && (!draft || HH_MM.test(draft)));
  const inputType = nativeOk ? spec.input : 'text';
  const canSave = !saving && !!draft.trim() && !(spec.input === 'select' && !spec.options.includes(draft));
  const inputId = `epp-basics-input-${fieldKey}`;
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); return; }
    if (e.key === 'Enter' && spec.input !== 'textarea' && spec.input !== 'select') {
      e.preventDefault();
      if (canSave) onSave();
    }
  };

  return (
    <div className="epp-inline-edit" role="group" aria-label={spec.title} data-testid={`basics-editor-${fieldKey}`}>
      {field.state === 'auto_drafted' && (
        <p className="epp-basics-note" data-testid="basics-dialog-draft-note">
          {field.source === DATE_DRAFT_SOURCE ? (
            <><CalendarClock size={13} aria-hidden="true" /> Auto-drafted · schedule: 45 days after the event was created. Changing it marks it Edited.</>
          ) : (
            <><Sparkles size={13} aria-hidden="true" /> Auto-drafted · AI draft. Changing it marks it Edited.</>
          )}
        </p>
      )}
      {spec.input === 'select' ? (
        <select
          id={inputId} autoFocus value={draft} onChange={(e) => onDraft(e.target.value)} onKeyDown={onKeyDown}
          aria-label={spec.title} data-testid={`basics-input-${fieldKey}`}
        >
          <option value="">Choose {spec.label.toLowerCase()}…</option>
          {draft && !spec.options.includes(draft) && (
            <option value={draft} disabled>{draft} (not an allowed value)</option>
          )}
          {spec.options.map((o) => <option key={o} value={o}>{taxonomyLabel(o)}</option>)}
        </select>
      ) : spec.input === 'textarea' ? (
        <textarea
          id={inputId} autoFocus rows={4} value={draft} onChange={(e) => onDraft(e.target.value)} onKeyDown={onKeyDown}
          placeholder="What is this event?" aria-label={spec.title} data-testid={`basics-input-${fieldKey}`}
        />
      ) : (
        <input
          id={inputId} autoFocus type={inputType} value={draft} maxLength={spec.maxLength}
          onChange={(e) => onDraft(e.target.value)} onKeyDown={onKeyDown}
          placeholder={fieldKey === 'dressCode' ? 'e.g. black tie formal' : ''}
          aria-label={spec.title} data-testid={`basics-input-${fieldKey}`}
        />
      )}
      {field.suggestion && (
        <button type="button" className="epp-inline-link epp-basics-fill" onClick={() => onDraft(field.suggestion.value)}>
          Fill in suggestion: {formatValue(fieldKey, field.suggestion.value)}
        </button>
      )}
      <div className="epp-inline-edit-actions">
        {field.value && (
          <button type="button" className="epp-btn epp-btn-small" onClick={onClear} disabled={saving}>Clear</button>
        )}
        <span className="epp-basics-spacer" />
        <button type="button" className="epp-btn epp-btn-small" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="button" className="epp-btn epp-btn-small epp-btn-primary" onClick={onSave} disabled={!canSave} data-testid={`basics-save-${fieldKey}`}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
