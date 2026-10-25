/**
 * ShortcutsHelp — the desktop keyboard shortcuts' help ("?"), listing
 * the sections g then 1–9 jumps to.
 * Moved out of EventPackagePage.jsx when the page was split (Task #54);
 * the markup and class names are as they were.
 */
import { Keyboard, X } from 'lucide-react';

export default function ShortcutsHelp({ nav, onClose }) {
  return (
    <div className="epp-shortcuts" role="region" aria-label="Keyboard shortcuts" data-testid="shortcuts-help">
      <div className="epp-shortcuts-head">
        <strong><Keyboard size={14} aria-hidden="true" /> Keyboard shortcuts</strong>
        <button type="button" className="epp-icon-btn" onClick={onClose} aria-label="Close shortcuts"><X size={14} /></button>
      </div>
      <dl>
        <div><dt><kbd>g</kbd> then <kbd>1</kbd>–<kbd>{Math.min(9, nav.length)}</kbd></dt><dd>Go to that section: {nav.slice(0, 9).map((s, i) => `${i + 1} ${s.label}`).join(' · ')}</dd></div>
        <div><dt><kbd>s</kbd></dt><dd>Save the Basics field you are editing (click outside its box first)</dd></div>
        <div><dt><kbd>?</kbd></dt><dd>Show or hide this list</dd></div>
      </dl>
      <p className="epp-shortcuts-note">Not while typing in a field or with a dialog open.</p>
    </div>
  );
}
