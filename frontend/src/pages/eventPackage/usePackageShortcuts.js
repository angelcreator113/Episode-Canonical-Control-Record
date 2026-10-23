/**
 * The Event Package's keyboard shortcuts on a desktop (Evoni, 2026-10-23):
 * `g` then 1–9 jumps to that section, `s` saves the open Basics editor, `?`
 * shows the help (Escape hides it). Keys are ignored while typing in a field, while a dialog
 * is open, with a modifier held, and on a touch-only screen.
 */
import { useEffect, useRef } from 'react';

const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const G_WINDOW_MS = 1500;

export function isTouchOnly() {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  } catch (err) {
    console.error('[EventPackage] touch check failed:', err);
    return false;
  }
}

/**
 * handlersRef.current: { onJump(n), onSave() → true when it saved, onHelp(),
 * onEscape() → true when it closed the help },
 * read fresh on each key (the page sets it every render).
 */
export default function usePackageShortcuts({ enabled, dialogOpen, handlersRef }) {
  const dialogRef = useRef(dialogOpen);
  dialogRef.current = dialogOpen;

  useEffect(() => {
    if (!enabled || isTouchOnly()) return undefined;
    let gAt = 0;
    const onKey = (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && typeof t.closest === 'function' && t.closest(TYPING)) return;
      if (dialogRef.current || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const h = handlersRef.current;
      if (gAt && Date.now() - gAt < G_WINDOW_MS && /^[1-9]$/.test(e.key)) {
        gAt = 0;
        e.preventDefault();
        h.onJump?.(Number(e.key));
        return;
      }
      gAt = 0;
      if (e.key === 'Escape') { if (h.onEscape?.()) e.preventDefault(); return; }
      if (e.key === 'g') { gAt = Date.now(); return; }
      if (e.key === 's') { if (h.onSave?.()) e.preventDefault(); return; }
      if (e.key === '?') { e.preventDefault(); h.onHelp?.(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled, handlersRef]);
}
