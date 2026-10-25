/**
 * EventBasicsRow — one Basics field in The Event (Task #1755): its state
 * (set, edited, auto-drafted, suggested), its value (tapped to edit it in
 * the row, Evoni 2026-10-23), the long description's Show more, and a
 * suggestion's Use this. A field still to fill shows nothing here (it is
 * listed under Still to fill) unless it is the one being edited.
 * Moved out of EventPackagePage.jsx when the page was split (Task #54);
 * the markup and class names are as they were.
 */
import { useState } from 'react';
import { Lightbulb, CheckCircle2 } from 'lucide-react';
import InlineBasicsField from '../../pages/eventPackage/InlineBasicsField';
import ShowMoreToggle from '../ShowMoreToggle';
import { hasValueState } from '../../utils/eventBasics';
import {
  BASICS_FIELDS, DESCRIPTION_CLAMP_AT, isToFill, basicsStateLabel, basicsStateIcon, fmtBasicsValue,
} from '../../lib/eventPackageFields';

export default function EventBasicsRow({ fieldKey: key, basics, used, editor }) {
  const {
    basicsEditing, basicsDraft, setBasicsDraft, basicsSaving, saveBasicsField, closeBasicsEditor, openBasicsEditor, acceptBasicsSuggestion,
  } = editor;
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const spec = BASICS_FIELDS[key];
  const f = basics[key];
  const editing = basicsEditing === key && !used;
  if (isToFill(f) && !editing) return null;
  const StateIcon = basicsStateIcon(f);
  const hasValue = hasValueState(f.state);
  const clampDescription = key === 'description' && hasValue && String(f.value || '').length > DESCRIPTION_CLAMP_AT;
  // Tapping the value edits it in the row (Evoni, 2026-10-23).
  const valueButton = (children, className = 'epp-basic-value') => (used ? <span className={className}>{children}</span> : (
    <button type="button" className={`${className} epp-basic-value-btn`} onClick={() => openBasicsEditor(key)} disabled={basicsSaving} title={`Edit ${spec.label.toLowerCase()}`}>
      {children}
    </button>
  ));
  return (
    <div className={`epp-basic is-${f.state}${editing ? ' is-editing' : ''}`} data-testid={`basics-${key}`} data-state={f.state}>
      <dt>
        {spec.label}
        {f.state !== 'set' && (
          <span className="epp-basic-state" data-testid={`basics-${key}-state`}><StateIcon size={11} aria-hidden="true" /> {basicsStateLabel(f)}</span>
        )}
      </dt>
      <dd>
        {editing ? (
          <InlineBasicsField
            fieldKey={key} spec={spec} field={f} draft={basicsDraft} onDraft={setBasicsDraft} saving={basicsSaving}
            onSave={() => saveBasicsField(key, basicsDraft)} onCancel={closeBasicsEditor}
            onClear={() => saveBasicsField(key, '')} formatValue={fmtBasicsValue}
          />
        ) : <>
        {hasValue && key === 'description' ? (
          <>
            <span id="epp-description-text" data-testid="basics-description-text"
              className={`epp-basic-prose-wrap${clampDescription && !descriptionOpen ? ' is-clamped' : ''}`}>
              {valueButton(fmtBasicsValue(key, f.value), 'epp-basic-value epp-basic-prose')}
            </span>
            {clampDescription && (
              <ShowMoreToggle
                open={descriptionOpen} hidden={1} onToggle={() => setDescriptionOpen((o) => !o)}
                label={descriptionOpen ? 'Show less' : 'Show more'} testId="basics-description-more" controls="epp-description-text"
              />
            )}
          </>
        ) : hasValue ? (
          valueButton(fmtBasicsValue(key, f.value))
        ) : (
          <span className="epp-basic-unset">Not set</span>
        )}
        {hasValue && f.inList === false && (
          <span className="epp-saved-copy" data-testid={`basics-${key}-unlisted`} title="Stored before the Event Package offered a list; not one of the allowed values. Choose one to replace it.">not an allowed value</span>
        )}
        {f.fromSavedCopy && (
          <span className="epp-saved-copy" title="Not yet in the event's own fields — shown from its saved automation copy">saved copy</span>
        )}
        {!used && (
          <button type="button" className="epp-inline-link" onClick={() => openBasicsEditor(key)} disabled={basicsSaving}>
            {hasValue ? 'Edit' : 'Set'}
          </button>
        )}
        {f.state === 'suggested' && (
          <div className="epp-suggestion" data-testid={`basics-${key}-suggestion`}>
            <span className="epp-suggestion-text">
              <Lightbulb size={12} aria-hidden="true" /> Suggestion: <strong>{fmtBasicsValue(key, f.suggestion.value)}</strong>
              <span className="epp-suggestion-basis">{f.suggestion.basis}</span>
            </span>
            <button
              type="button" className="epp-btn epp-btn-small epp-suggestion-accept" data-testid={`basics-${key}-accept`}
              onClick={() => acceptBasicsSuggestion(key)} disabled={basicsSaving}
            >
              <CheckCircle2 size={13} /> Use this
            </button>
          </div>
        )}
        </>}
      </dd>
    </div>
  );
}
