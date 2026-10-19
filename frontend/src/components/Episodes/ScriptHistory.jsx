// The Script tab's version history (Script tab audit, 2026-10-15: "there's
// no undo, and Regenerate replaces the whole script"). Each script a save, a
// lock or Regenerate replaced is kept on the server (GET
// /episodes/:id/script-versions); one can be read and put back on the page,
// where Save keeps it as any edit.
import { useState, useEffect, useRef } from 'react';
import { History, X } from 'lucide-react';
import api from '../../services/api';

const SOURCE_LABELS = { save: 'Before a save', lock: 'Before a lock', generate: 'Before Regenerate' };

// What Tab moves between inside the panel (as ScriptTableRead's).
const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

const when = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export default function ScriptHistory({ episodeId, dirty = false, onRestore }) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState(null);
  const [shown, setShown] = useState(null);
  const [error, setError] = useState(null);
  // The panel is aria-modal (Script page audit, 2026-10-19): Tab stays in
  // it and Escape closes it, both from anywhere (focus falls to the page
  // when the button pressed inside is replaced), and focus goes back to
  // History when it closes. Tab as ScriptTableRead's.
  const openerRef = useRef(null);
  const dialogRef = useRef(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      const onKey = (e) => {
        if (e.defaultPrevented) return;
        if (e.key === 'Escape') { setOpen(false); return; }
        if (e.key !== 'Tab') return;
        const box = dialogRef.current;
        const items = [...(box?.querySelectorAll(FOCUSABLE) || [])];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        const at = document.activeElement;
        const inside = box.contains(at);
        if (e.shiftKey && (!inside || at === first || at === box)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (!inside || at === last)) { e.preventDefault(); first.focus(); }
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }
    if (wasOpen.current) { wasOpen.current = false; if (openerRef.current?.isConnected) openerRef.current.focus(); }
    return undefined;
  }, [open]);

  const openPanel = async () => {
    setOpen(true); setShown(null); setError(null); setVersions(null);
    try {
      const res = await api.get(`/api/v1/episodes/${episodeId}/script-versions`);
      setVersions(res.data?.data || []);
    } catch (err) {
      console.error('[ScriptHistory] list failed:', err);
      setError('The history could not be read.');
      setVersions([]);
    }
  };
  const show = async (id) => {
    setError(null);
    try {
      const res = await api.get(`/api/v1/episodes/${episodeId}/script-versions/${id}`);
      setShown(res.data?.data || null);
    } catch (err) {
      console.error('[ScriptHistory] version read failed:', err);
      setError('That version could not be read.');
    }
  };
  const restore = () => {
    if (!shown) return;
    if (dirty && !window.confirm('Put this version on the page? Your unsaved changes will be replaced.')) return;
    onRestore(shown.script_content);
    setOpen(false);
  };

  return (
    <>
      <button type="button" ref={openerRef} className="esp-btn" data-testid="script-history" onClick={openPanel}><History size={14} aria-hidden="true" /> History</button>
      {open && (
        <div ref={dialogRef} className="esp-history" role="dialog" aria-modal="true" aria-label="Script history" data-testid="script-history-panel" tabIndex={-1}>
          <div className="esp-history-head">
            <h3 className="esp-history-title">History</h3>
            <button type="button" className="esp-btn is-small" aria-label="Close" autoFocus onClick={() => setOpen(false)}><X size={14} aria-hidden="true" /></button>
          </div>
          {error && <p className="esp-error" role="alert">{error}</p>}
          {versions === null && <p className="esp-history-empty">Reading…</p>}
          {versions?.length === 0 && !error && <p className="esp-history-empty">No earlier versions yet. Each save, lock or Regenerate keeps the script it replaces.</p>}
          {shown ? (
            <div>
              <p className="esp-history-meta">{SOURCE_LABELS[shown.source] || 'Earlier'} · {when(shown.created_at)} · {shown.beats} beats</p>
              <pre className="esp-history-text" data-testid="script-history-text">{shown.script_content}</pre>
              <div className="esp-history-actions">
                <button type="button" className="esp-btn-primary is-small" data-testid="script-history-restore" onClick={restore}>Put this version on the page</button>
                <button type="button" className="esp-btn is-small" onClick={() => setShown(null)}>Back to the list</button>
              </div>
              <p className="esp-history-note">It replaces the page&apos;s script as an unsaved change; Save keeps it. Approved beats stay locked as they are now.</p>
            </div>
          ) : (
            <ul className="esp-history-list">
              {(versions || []).map((v) => (
                <li key={v.id}>
                  <button type="button" className="esp-history-item" data-testid="script-history-item" onClick={() => show(v.id)}>
                    <span className="esp-history-meta">{SOURCE_LABELS[v.source] || 'Earlier'} · {when(v.created_at)} · {v.beats} beats</span>
                    {v.preview && <span className="esp-history-preview">{v.preview}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
