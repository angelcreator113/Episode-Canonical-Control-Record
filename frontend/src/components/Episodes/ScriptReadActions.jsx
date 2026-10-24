// frontend/src/components/Episodes/ScriptReadActions.jsx
// The Script tab's Table read and Export buttons (Script tab audit,
// 2026-10-15). Kept out of EpisodeScriptTab.jsx so the tab mounts one
// element. Both read the script as the page has it, saved or not.

import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Download, Printer, FileText, ScrollText, Copy } from 'lucide-react';
import ScriptTableRead from './ScriptTableRead';
import { toFountain, toPlainText, scriptFileName } from '../../lib/scriptExport';
import './ScriptTableRead.css';

// A file the browser saves, from text made here.
export function downloadText(text, fileName, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked a second after the click (Script tab audit 6, 2026-10-24):
  // Safari had not read the blob yet when it was revoked at once.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}
export const REVOKE_AFTER_MS = 1000;

// The script as written onto the clipboard (Evoni, 2026-10-24: "I have no way
// to copy the full script" from her phone). The Clipboard API where the page
// may use it, else a hidden textarea and execCommand('copy') (older Safari,
// or a page not served over https). Resolves true when it was copied.
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch (err) {
    console.error('[ScriptReadActions] clipboard write failed, trying the fallback:', err);
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (err) {
    console.error('[ScriptReadActions] copy fallback failed:', err);
    return false;
  }
}

// Where the open menu sits: fixed under its button, so the header's
// scrolling row (.esp-actions, overflow-x at 760px and under) does not clip
// it (Script tab audit 6, 2026-10-24). Kept 8px inside the window.
const MENU_WIDTH = 200;
export function menuPlace(rect, width = typeof window !== 'undefined' ? window.innerWidth : 1024) {
  if (!rect) return null;
  const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, width - MENU_WIDTH - 8));
  return { position: 'fixed', top: Math.round(rect.bottom + 4), left: Math.round(left), right: 'auto' };
}

export default function ScriptReadActions({ scriptText, title = '', dirty = false, onScreen = null, scenePlan = [], startBeat = 0, episodeId = null, beatNumber = null, episodeNumber = null, cast = null }) {
  // null | 'read' | 'print'
  const [mode, setMode] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [place, setPlace] = useState(null);
  const menuRef = useRef(null);
  const summaryRef = useRef(null);
  const unsavedNote = dirty ? ' (includes unsaved changes)' : '';
  const scenes = Object.fromEntries((scenePlan || []).filter((p) => p?.beat_number && p.scene_set_name).map((p) => [p.beat_number, p.scene_set_name]));
  const closeMenu = useCallback(() => { if (menuRef.current) menuRef.current.open = false; setPlace(null); }, []);
  const onToggle = () => {
    const open = !!menuRef.current?.open;
    setPlace(open ? menuPlace(summaryRef.current?.getBoundingClientRect?.()) : null);
  };
  // While it is open: Escape and a click outside close it, focus back on
  // its button; a scroll or resize moves it with the button.
  const open = place !== null;
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); summaryRef.current?.focus(); } };
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) closeMenu(); };
    const onMove = () => setPlace(menuPlace(summaryRef.current?.getBoundingClientRect?.()));
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, closeMenu]);

  const download = (kind) => {
    closeMenu();
    setError(null);
    try {
      // ep-3-the-gala.fountain; an untitled one ep-3-script (Script tab audit 6).
      const name = scriptFileName(title, episodeNumber);
      if (kind === 'fountain') downloadText(toFountain(scriptText, { title, scenes, cast }), `${name}.fountain`);
      else downloadText(toPlainText(scriptText, { title, cast }), `${name}.txt`);
    } catch (err) {
      console.error('[ScriptReadActions] download failed:', err);
      setError('The download could not be made.');
    }
  };

  const copy = async () => {
    closeMenu();
    setError(null);
    const ok = await copyText(String(scriptText ?? ''));
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2500); }
    else setError('The script could not be copied. Use the Raw editor: select all, then copy.');
  };

  return (
    <>
      <button type="button" className="esp-btn str-launch" data-testid="script-table-read" title={`Read the script through, full screen${unsavedNote}`} onClick={() => setMode('read')}>
        <BookOpen size={14} aria-hidden="true" /> Table read
      </button>
      {/* The Teleprompter page on this episode and the open beat (Evoni,
          2026-10-20). It reads the saved script; an in-app link, so the
          tab's unsaved-changes guard asks first. */}
      {episodeId && (
        <Link className="esp-btn str-launch" data-testid="script-teleprompter"
          to={`/teleprompter?episode=${encodeURIComponent(episodeId)}${beatNumber != null ? `&beat=${encodeURIComponent(beatNumber)}` : ''}`}
          title={`Read the saved script on the teleprompter and record yourself${dirty ? ' (save first: unsaved changes are not in it)' : ''}`}>
          <ScrollText size={14} aria-hidden="true" /> Teleprompter
        </Link>
      )}
      <details className="str-export" ref={menuRef} data-testid="script-export" onToggle={onToggle}>
        <summary ref={summaryRef} className="esp-btn str-launch" title={`Download or print the script${unsavedNote}`}>Export</summary>
        <div className={`str-export-menu${place ? ' is-fixed' : ''}`} role="group" aria-label="Export" style={place || undefined} data-testid="script-export-menu">
          <button type="button" className="str-export-item" data-testid="script-export-copy" title={`Copy the whole script as written, tags and all${unsavedNote}`} onClick={copy}>
            <Copy size={14} aria-hidden="true" /> Copy script
          </button>
          <button type="button" className="str-export-item" data-testid="script-export-fountain" title={`Fountain screenplay file${unsavedNote}`} onClick={() => download('fountain')}>
            <Download size={14} aria-hidden="true" /> Download .fountain
          </button>
          <button type="button" className="str-export-item" data-testid="script-export-text" title={`Plain text${unsavedNote}`} onClick={() => download('text')}>
            <FileText size={14} aria-hidden="true" /> Download .txt
          </button>
          <button type="button" className="str-export-item" data-testid="script-export-print" title={`Print the table read, or save it as a PDF${unsavedNote}`} onClick={() => { closeMenu(); setMode('print'); }}>
            <Printer size={14} aria-hidden="true" /> Print / PDF
          </button>
          {dirty && <p className="str-export-note" data-testid="script-export-unsaved">Includes unsaved changes</p>}
        </div>
      </details>
      {copied && <span className="str-export-note" role="status" data-testid="script-export-copied">Script copied</span>}
      {error && <span className="str-export-note" role="alert">{error}</span>}
      {mode && (
        <ScriptTableRead scriptText={scriptText} title={title} onScreen={onScreen} startBeat={mode === 'read' ? startBeat : 0}
          printMode={mode === 'print'} onClose={() => setMode(null)} episodeId={episodeId} cast={cast} />
      )}
    </>
  );
}
