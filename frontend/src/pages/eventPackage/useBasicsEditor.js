/**
 * The Event's Basics, edited in their rows (Task #1755; in the row since
 * Evoni, 2026-10-23), and Fill in. Moved out of EventPackagePage.jsx
 * (Task #54).
 *
 * Saves one Basics field through the existing PUT (all four columns are in
 * its allowedFields). An empty value clears the column (the route turns ''
 * into NULL). Nothing in canon_consequences is touched: a drafted field's
 * state comes from comparing the column with its saved copy
 * (automation.drafted_values, or automation.event_date_auto for the
 * date), so a changed value reads Edited. Task #2128, Evoni's (b): saving
 * a date no longer deletes event_date_auto. Time, dress code and
 * description never carry a derived value here: they are saved only from
 * what Evoni typed or a suggestion she accepted.
 */
import { useState } from 'react';
import { BASICS_FIELDS, BASICS_PAGE_ORDER, isToFill, fmtBasicsValue } from '../../lib/eventPackageFields';

export default function useBasicsEditor({ basics, used, putEvent, load, setToast, openSection }) {
  // Which field is open, and its draft value.
  const [basicsEditing, setBasicsEditing] = useState(null);
  const [fillRound, setFillRound] = useState(null); // keys Fill in has opened, while it runs
  const [basicsDraft, setBasicsDraft] = useState('');
  const [basicsSaving, setBasicsSaving] = useState(false);

  // Fill in: opens each field still to fill in turn; a save moves on to the
  // next one not yet opened this round, Cancel stops.
  const toFill = BASICS_PAGE_ORDER.filter((key) => isToFill(basics[key]));
  // The one open in its row is not listed again under Still to fill.
  const toFillShown = toFill.filter((key) => key !== basicsEditing);

  const saveBasicsField = async (key, rawValue, successMessage) => {
    const spec = BASICS_FIELDS[key];
    if (!spec || used || basicsSaving) return;
    const value = typeof rawValue === 'string' ? rawValue.trim() : '';
    const body = { [spec.column]: value || null };
    setBasicsSaving(true);
    try {
      await putEvent(body);
      // Fill in moves on to the next field it has not opened yet.
      const next = fillRound ? toFill.find((k) => k !== key && !fillRound.includes(k)) : null;
      if (next) {
        setFillRound([...fillRound, next]);
        setBasicsDraft(basics[next]?.value || '');
        setBasicsEditing(next);
      } else {
        setFillRound(null);
        setBasicsEditing(null);
        setBasicsDraft('');
      }
      setToast(successMessage || (value ? `${spec.label} saved` : `${spec.label} cleared`));
      await load();
    } catch (err) {
      console.error('[EventPackage] saveBasicsField failed:', err);
      setToast(err.response?.data?.error || err.message || `Failed to save ${spec.label.toLowerCase()}`);
    } finally {
      setBasicsSaving(false);
    }
  };

  const acceptBasicsSuggestion = (key) => {
    const suggestion = basics[key]?.suggestion;
    if (!suggestion) return;
    saveBasicsField(key, suggestion.value, `${BASICS_FIELDS[key].label} set to ${fmtBasicsValue(key, suggestion.value)}`);
  };

  // Each field is edited in its own row now (Evoni, 2026-10-23), not in a
  // dialog; The Event opens if it was folded.
  const openBasicsEditor = (key) => {
    if (used) return;
    openSection('identity');
    setBasicsDraft(basics[key]?.value || '');
    setBasicsEditing(key);
  };
  const closeBasicsEditor = () => {
    if (basicsSaving) return;
    setBasicsEditing(null); setBasicsDraft(''); setFillRound(null);
  };

  const startFillIn = () => {
    if (!toFill.length) return;
    setFillRound([toFill[0]]);
    openBasicsEditor(toFill[0]);
  };

  return {
    basicsEditing, basicsDraft, setBasicsDraft, basicsSaving, toFill, toFillShown,
    saveBasicsField, acceptBasicsSuggestion, openBasicsEditor, closeBasicsEditor, startFillIn,
  };
}
