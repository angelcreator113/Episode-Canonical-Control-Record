/**
 * GenModal — AI relationship generator dialog
 * Prime Studios · LalaVerse
 */
import { useState, useEffect, useRef } from 'react';
import { cname } from './tokens';
import { Btn, Label, Select } from './primitives';

export default function GenModal({ chars, genning, onGenerate, onClose }) {
  const [focus, setFocus] = useState('');

  /* focus trap */
  const overlayRef = useRef(null);
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const trap = e => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    el.addEventListener('keydown', trap);
    return () => el.removeEventListener('keydown', trap);
  }, [onClose]);

  return (
    <div ref={overlayRef} className="cg-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Generate relationship seeds">
      <div className="cg-modal re-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="re-accent-bar re-accent-reverse" />
        <div className="re-modal-header">
          <span className="re-modal-title">◈ Generate Seeds</span>
          <button onClick={onClose} className="re-close-btn" aria-label="Close dialog">×</button>
        </div>
        <div className="re-modal-body">
          <p className="re-gen-desc">
            Claude will analyse your registry and propose <strong>3–5 relationship candidates</strong> with tension states, LalaVerse mirrors, and career echoes.
          </p>
          <Label>Focus Character (optional)</Label>
          <Select value={focus} onChange={e => setFocus(e.target.value)}>
            <option value="">Any character</option>
            {chars.map(c => <option key={c.id} value={c.id}>{cname(c)}</option>)}
          </Select>
        </div>
        <div className="re-modal-footer">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={() => onGenerate(focus || null)} disabled={genning}>
            {genning ? 'Generating…' : '◈ Generate'}
          </Btn>
        </div>
      </div>
    </div>
  );
}
