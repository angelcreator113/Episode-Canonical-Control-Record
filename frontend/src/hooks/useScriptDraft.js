// The Script tab's unsaved edits, kept in this browser (Script tab audit,
// 2026-10-15): a crash, a closed tab or a lost connection no longer loses
// them. While the page has unsaved changes they are written here (after a
// short pause in typing); a save clears them. When the tab opens and finds
// edits the saved script doesn't have, it offers them back. Browser storage
// can be missing or blocked, so every read and write is guarded, and the
// page works without it.
import { useEffect, useRef, useState } from 'react';

const keyOf = (episodeId) => `esp-draft-${episodeId}`;

function readDraft(episodeId) {
  if (!episodeId) return null;
  try {
    const raw = window.localStorage.getItem(keyOf(episodeId));
    const draft = raw ? JSON.parse(raw) : null;
    return draft && typeof draft.text === 'string' ? draft : null;
  } catch (err) {
    console.error('[ScriptDraft] could not read the kept draft:', err);
    return null;
  }
}

function writeDraft(episodeId, draft) {
  try {
    if (draft) window.localStorage.setItem(keyOf(episodeId), JSON.stringify(draft));
    else window.localStorage.removeItem(keyOf(episodeId));
  } catch (err) {
    console.error('[ScriptDraft] could not keep the draft:', err);
  }
}

/**
 * { offer, discard } — offer is { text, at, baseChanged } when this browser
 * holds edits the saved script doesn't have, else null. Restoring is the
 * caller's (it puts offer.text on the page); either way call discard() to
 * drop the offer, which also clears the kept copy when nothing is unsaved.
 */
export default function useScriptDraft({ episodeId, scriptText, savedScript, delay = 800 }) {
  const [offer, setOffer] = useState(() => {
    const draft = readDraft(episodeId);
    if (!draft || draft.text === savedScript) return null;
    return { text: draft.text, at: draft.at || null, base: typeof draft.base === 'string' ? draft.base : null };
  });

  // The write still waiting for its pause in typing; the tab closing
  // (another page, Back) writes it at once (Script tab re-audit, 2026-10-15:
  // the last edits before leaving were lost).
  const pending = useRef(null);
  useEffect(() => {
    // The kept copy stays as it is until its offer is answered.
    if (!episodeId || offer) { pending.current = null; return undefined; }
    const write = () => { pending.current = null; writeDraft(episodeId, scriptText !== savedScript ? { text: scriptText, base: savedScript, at: Date.now() } : null); };
    pending.current = write;
    const t = setTimeout(write, delay);
    return () => clearTimeout(t);
  }, [episodeId, scriptText, savedScript, offer, delay]);
  useEffect(() => () => { pending.current?.(); }, []);

  const discard = () => setOffer(null);
  // Whether the saved script has changed since the draft was kept, against
  // the saved script as it is now (re-audit 2: read once, it missed a newer
  // script the tab took after opening).
  return { offer: offer ? { ...offer, baseChanged: offer.base !== null && offer.base !== savedScript } : null, discard };
}
