/**
 * Whether the editor is on a phone, and which way it is held (Evoni,
 * 2026-11-03: "If I'm on my phone then I should have to turn my phone the
 * other way … landscape mode is a lot better than portrait").
 *
 * A phone is a touch screen (coarse pointer) whose shorter side is under
 * 600 CSS px, so tablets and desktops (a narrow desktop window included) are
 * never treated as phones. A phone always gets the editor in landscape:
 * held (or locked) in portrait, the page draws itself turned
 * (lib/editorRotation), and the screen's own size is reported so the turned
 * page can fill it.
 *
 * { phone, portrait, width, height }; phone and portrait are false where
 * matchMedia is missing (tests, old browsers).
 */
import { useEffect, useState } from 'react';

export const PHONE_SHORT_SIDE = 600;

export function readPhoneOrientation(win = typeof window === 'undefined' ? null : window) {
  try {
    const size = { width: win?.innerWidth || 0, height: win?.innerHeight || 0 };
    if (!win || typeof win.matchMedia !== 'function') return { phone: false, portrait: false, ...size };
    const coarse = win.matchMedia('(pointer: coarse)').matches;
    const short = Math.min(win.screen?.width || win.innerWidth, win.screen?.height || win.innerHeight);
    const phone = coarse && short > 0 && short < PHONE_SHORT_SIDE;
    const portrait = win.matchMedia('(orientation: portrait)').matches;
    return { phone, portrait: phone && portrait, ...size };
  } catch (err) {
    console.warn('[EpisodeEditor] could not read the screen orientation:', err?.message);
    return { phone: false, portrait: false, width: 0, height: 0 };
  }
}

export default function usePhoneOrientation() {
  const [state, setState] = useState(() => readPhoneOrientation());
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const update = () => setState((cur) => {
      const next = readPhoneOrientation();
      return cur.phone === next.phone && cur.portrait === next.portrait && cur.width === next.width && cur.height === next.height ? cur : next;
    });
    const queries = [];
    try {
      if (typeof window.matchMedia === 'function') {
        for (const q of ['(orientation: portrait)', '(pointer: coarse)']) {
          const mql = window.matchMedia(q);
          if (mql?.addEventListener) { mql.addEventListener('change', update); queries.push(mql); }
        }
      }
    } catch (err) {
      console.warn('[EpisodeEditor] could not watch the screen orientation:', err?.message);
    }
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      for (const mql of queries) mql.removeEventListener('change', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return state;
}
