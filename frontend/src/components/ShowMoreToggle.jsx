/**
 * The Show more / Show less button under a folded list (lib/showMore.js).
 * Renders nothing when nothing is folded and the list is closed. `label`
 * replaces the counted label ("Show more" for a clamped paragraph).
 */
import { ChevronDown, ChevronUp } from 'lucide-react';
import { showMoreLabel } from '../lib/showMore';

export default function ShowMoreToggle({ open, hidden, onToggle, noun, label, testId, controls }) {
  if (!open && !hidden) return null;
  return (
    <button
      type="button" className="epp-inline-link epp-show-more" onClick={onToggle}
      aria-expanded={open} aria-controls={controls} data-testid={testId}
    >
      {open ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
      {' '}{label || showMoreLabel(open, hidden, noun)}
    </button>
  );
}
