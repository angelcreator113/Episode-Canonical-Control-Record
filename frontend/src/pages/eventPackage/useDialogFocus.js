/**
 * The open dialog (audit, 2026-10-23), moved out of EventPackagePage.jsx
 * (Task #54): Escape closes the top one (as its own X would, so not while
 * it saves), Tab stays inside it, focus starts in it and goes back where it
 * was when it closes. closeTopDialogRef is set by the page each render.
 */
import { useEffect } from 'react';

export default function useDialogFocus(anyDialogOpen, closeTopDialogRef) {
  useEffect(() => {
    if (!anyDialogOpen) return undefined;
    const opener = document.activeElement;
    const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const topDialog = () => {
      const all = [...document.querySelectorAll('[role="dialog"]')].filter((d) => !d.closest('.els-overlay') || d.classList.contains('els-overlay'));
      return all[all.length - 1] || null;
    };
    const dlg = topDialog();
    if (dlg && !dlg.contains(document.activeElement)) dlg.querySelector(FOCUSABLE)?.focus?.();
    const onKey = (e) => {
      const top = topDialog();
      if (!top || top.classList.contains('els-overlay')) return; // the Locations step handles its own keys
      if (e.key === 'Escape') {
        e.preventDefault();
        closeTopDialogRef.current?.();
      } else if (e.key === 'Tab') {
        const items = [...top.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (!items.length) return;
        const first = items[0]; const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        else if (!top.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener && document.contains(opener)) opener.focus?.();
    };
  }, [anyDialogOpen]); // eslint-disable-line react-hooks/exhaustive-deps
}
