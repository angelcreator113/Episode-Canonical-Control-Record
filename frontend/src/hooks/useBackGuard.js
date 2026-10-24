/**
 * The phone's Back while the teleprompter's reader is open (Teleprompter
 * audit 2, Evoni, 2026-10-24: Back dropped an unsaved take without a word).
 * The app's BrowserRouter has no blocker, so while `open` the reader puts one
 * history entry of its own on top; Back pops it and onBack() decides: true
 * lets the reader close, false keeps it (the entry goes back on, so the next
 * Back asks again). Closed any other way, the entry comes off quietly. The
 * page's address never changes.
 */
import { useEffect, useRef } from 'react';

const MARK = 'stpReader';

export default function useBackGuard(open, onBack) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const pushedRef = useRef(false);
  // This reader's own mark: an entry left by an earlier one (before a
  // reload) is not this one's, so popping onto it is still a Back.
  const tokenRef = useRef(null);
  if (!tokenRef.current) tokenRef.current = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  const push = () => {
    try {
      window.history.pushState({ ...(window.history.state || {}), [MARK]: tokenRef.current }, '');
      pushedRef.current = true;
    } catch (err) {
      console.error('[useBackGuard] history entry not added:', err);
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    push();
    const onPop = (e) => {
      // Still on this reader's own entry: not a Back out.
      if (!pushedRef.current || e?.state?.[MARK] === tokenRef.current) return;
      pushedRef.current = false;
      let leave = true;
      try { leave = onBackRef.current?.() !== false; } catch (err) {
        console.error('[useBackGuard] back not handled:', err);
      }
      if (!leave) push();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Closed some other way: our entry comes off, quietly.
      if (pushedRef.current && window.history.state?.[MARK] === tokenRef.current) {
        pushedRef.current = false;
        try { window.history.back(); } catch (err) { console.error('[useBackGuard] history entry not removed:', err); }
      }
    };
  }, [open]);
}
