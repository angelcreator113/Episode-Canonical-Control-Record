// frontend/src/components/Episodes/ScriptReadActions.jsx
// The Script tab's Table read and Export buttons (Script tab audit,
// 2026-10-15). Kept out of EpisodeScriptTab.jsx so the tab mounts one
// element. Both read the script as the page has it, saved or not.

import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Download, Printer, FileText, ScrollText } from 'lucide-react';
import ScriptTableRead from './ScriptTableRead';
import { toFountain, toPlainText, scriptFileSlug } from '../../lib/scriptExport';
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
  // Revoked after the click has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function ScriptReadActions({ scriptText, title = '', dirty = false, onScreen = null, scenePlan = [], startBeat = 0, episodeId = null, beatNumber = null }) {
  // null | 'read' | 'print'
  const [mode, setMode] = useState(null);
  const [error, setError] = useState(null);
  const menuRef = useRef(null);
  const unsavedNote = dirty ? ' (includes unsaved changes)' : '';
  const scenes = Object.fromEntries((scenePlan || []).filter((p) => p?.beat_number && p.scene_set_name).map((p) => [p.beat_number, p.scene_set_name]));
  const closeMenu = () => { if (menuRef.current) menuRef.current.open = false; };

  const download = (kind) => {
    closeMenu();
    setError(null);
    try {
      const slug = scriptFileSlug(title);
      if (kind === 'fountain') downloadText(toFountain(scriptText, { title, scenes }), `${slug}.fountain`);
      else downloadText(toPlainText(scriptText, { title }), `${slug}.txt`);
    } catch (err) {
      console.error('[ScriptReadActions] download failed:', err);
      setError('The download could not be made.');
    }
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
      <details className="str-export" ref={menuRef} data-testid="script-export">
        <summary className="esp-btn str-launch" title={`Download or print the script${unsavedNote}`}>Export</summary>
        <div className="str-export-menu" role="group" aria-label="Export">
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
      {error && <span className="str-export-note" role="alert">{error}</span>}
      {mode && (
        <ScriptTableRead scriptText={scriptText} title={title} onScreen={onScreen} startBeat={mode === 'read' ? startBeat : 0}
          printMode={mode === 'print'} onClose={() => setMode(null)} />
      )}
    </>
  );
}
