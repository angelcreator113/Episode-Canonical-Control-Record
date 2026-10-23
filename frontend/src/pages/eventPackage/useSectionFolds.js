/**
 * Which Event Package sections are open (Evoni, 2026-10-23). A section whose
 * readiness items are all complete starts folded to one line; one still to
 * do starts open. What the person opens or closes is remembered per event in
 * localStorage, which may be unavailable (private window, blocked storage):
 * then the page simply starts from the defaults each time.
 */
import { useCallback, useState } from 'react';

const storageKey = (eventId) => `epp-sections:${eventId}`;

function readStored(eventId) {
  try {
    const raw = window.localStorage.getItem(storageKey(eventId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    console.error('[EventPackage] section folds read failed:', err);
    return {};
  }
}

/** Returns { isOpen(anchor, complete), setOpen(anchor, open) }. */
export default function useSectionFolds(eventId) {
  const [stored, setStored] = useState(() => readStored(eventId));

  const isOpen = useCallback((anchor, complete) => (
    typeof stored[anchor] === 'boolean' ? stored[anchor] : !complete
  ), [stored]);

  const setOpen = useCallback((anchor, open) => {
    setStored((prev) => {
      if (prev[anchor] === open) return prev;
      const next = { ...prev, [anchor]: open };
      try {
        window.localStorage.setItem(storageKey(eventId), JSON.stringify(next));
      } catch (err) {
        console.error('[EventPackage] section folds save failed:', err);
      }
      return next;
    });
  }, [eventId]);

  return { isOpen, setOpen };
}
