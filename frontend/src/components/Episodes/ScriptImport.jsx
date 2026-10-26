// "Import a script" on the Script tab (Evoni, 2026-10-25): paste a script
// written anywhere else, see it in the app's own way of writing a script
// (lib/scriptImport convertScript), then replace the script with it or add
// it to the end. The look's pieces (the tab's locked outfit) turn equip
// lines into [WEAR: id]; the tab's phone screens and overlays name the
// on-screen steps. Nothing is saved here: the page shows the new script as
// unsaved changes, and Save keeps it. Styles in EpisodeScriptPage.css.
import { useState, useMemo, useRef, useEffect } from 'react';
import { FileInput, X, AlertTriangle } from 'lucide-react';
import useDialogLayer from '../../hooks/useDialogLayer';
import { convertScript, importedScript } from '../../lib/scriptImport';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default function ScriptImport({ scriptText = '', look = [], onScreen = null, approvedCount = 0, disabled = false, onImport }) {
  const [open, setOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const openerRef = useRef(null);
  const pasteRef = useRef(null);
  // isTop() reads the dialog stack when called, so the effect's copy stays right.
  const isTop = useDialogLayer(open);

  const result = useMemo(() => {
    if (!pasted.trim()) return null;
    try {
      return convertScript(pasted, { look: Array.isArray(look) ? look : [], onScreen: onScreen || {} });
    } catch (err) {
      console.error('[ScriptImport] convert failed:', err);
      return { script: '', notes: [], counts: null, failed: true };
    }
  }, [pasted, look, onScreen]);

  const close = () => setOpen(false);
  // Escape closes it while it is the dialog on top; focus goes to the paste
  // box, and back to the button when it closes.
  useEffect(() => {
    if (!open) return undefined;
    pasteRef.current?.focus();
    const onKey = (e) => {
      if (e.defaultPrevented || !isTop()) return;
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    };
    document.addEventListener('keydown', onKey);
    const opener = openerRef.current;
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasScript = !!String(scriptText || '').trim();
  const apply = (mode) => {
    if (!result?.script) return;
    if (mode === 'replace' && hasScript && !window.confirm('Replace the whole script with the imported one? Nothing is saved until you press Save.')) return;
    onImport?.(importedScript(scriptText, result.script, mode), mode);
    setPasted('');
    setOpen(false);
  };

  const c = result?.counts;
  return (
    <>
      <button type="button" ref={openerRef} className="esp-btn" data-testid="script-import" aria-haspopup="dialog" aria-expanded={open}
        disabled={disabled} title="Paste a script written somewhere else and turn it into this app's format" onClick={() => setOpen(true)}>
        <FileInput size={14} aria-hidden="true" /> Import a script
      </button>
      {open && (
        <>
          <div className="esp-import-backdrop" aria-hidden="true" onClick={close} />
          <div className="esp-import" role="dialog" aria-modal="true" aria-labelledby="esp-import-title" data-testid="script-import-panel">
            <div className="esp-import-head">
              <h3 className="esp-import-title" id="esp-import-title">Import a script</h3>
              <button type="button" className="esp-btn is-small" aria-label="Close" onClick={close}><X size={14} aria-hidden="true" /></button>
            </div>
            <label className="esp-import-label" htmlFor="esp-import-paste">Paste your script</label>
            <p className="esp-import-hint">{'Any format works: "BEAT 1 —" headers, PRIME: and LALA: lines, [CLICK invite], [GAME: EQUIP …]. You\'ll see it converted before anything changes.'}</p>
            <textarea id="esp-import-paste" ref={pasteRef} className="esp-import-paste" data-testid="script-import-paste" rows={8}
              value={pasted} onChange={(e) => setPasted(e.target.value)} />

            {result?.failed && <p className="esp-error" role="alert">{"This script couldn't be converted. Try pasting it again."}</p>}
            {result && !result.failed && (
              <>
                {c && (
                  <p className="esp-import-sum" role="status" data-testid="script-import-summary">
                    {plural(c.beats, 'beat', 'beats')} · {plural(c.speakers, 'spoken line', 'spoken lines')} · {plural(c.wear, 'outfit piece', 'outfit pieces')} matched · {plural(c.steps, 'on-screen step', 'on-screen steps')}
                  </p>
                )}
                {result.notes.length > 0 && (
                  <div className="esp-import-notes" data-testid="script-import-notes">
                    <p className="esp-import-notes-head"><AlertTriangle size={14} aria-hidden="true" /> {"I couldn't convert these — check them"}</p>
                    <ul className="esp-import-notes-list">
                      {result.notes.map((n, i) => (
                        <li key={`${n.line}-${i}`} data-testid="script-import-note">
                          {n.line != null && <span className="esp-import-note-at">Line {n.line}: </span>}
                          {n.text && <span className="esp-import-note-text">{`“${n.text}”`}</span>}
                          <span className="esp-import-note-why"> {n.why}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="esp-import-label">How it will look</p>
                <pre className="esp-import-preview" data-testid="script-import-preview">{result.script}</pre>
                {approvedCount > 0 && (
                  <p className="esp-import-hint" data-testid="script-import-approved">
                    {plural(approvedCount, 'approved beat stays', 'approved beats stay')} as {approvedCount === 1 ? 'it is' : 'they are'} when you save.
                  </p>
                )}
                <div className="esp-import-actions">
                  <button type="button" className="esp-btn-primary is-small" data-testid="script-import-replace" disabled={!result.script} onClick={() => apply('replace')}>
                    {hasScript ? 'Replace the script' : 'Use this script'}
                  </button>
                  {hasScript && (
                    <button type="button" className="esp-btn is-small" data-testid="script-import-append" disabled={!result.script} onClick={() => apply('append')}>
                      Add to the end
                    </button>
                  )}
                  <button type="button" className="esp-btn is-small" onClick={close}>Cancel</button>
                </div>
                <p className="esp-import-hint">Nothing is saved until you press Save.</p>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
