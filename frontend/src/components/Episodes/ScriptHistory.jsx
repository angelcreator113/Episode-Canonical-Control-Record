// The Script tab's version history (Script tab audit, 2026-10-15: "there's
// no undo, and Regenerate replaces the whole script"). Each script a save, a
// lock or Regenerate replaced is kept on the server (GET
// /episodes/:id/script-versions); one can be read and put back on the page,
// where Save keeps it as any edit.
// History audit (2026-10-24): what putting a version back changes, as lines
// in and out of the page (`preview`: the text the page would hold, approved
// beats kept as they are now); a version the same as the page is not put
// back; dates read "2 hours ago" with the full time on hover; Escape on a
// version goes back to the list; a backdrop closes it.
import { useState, useEffect, useRef } from 'react';
import { History, X } from 'lucide-react';
import api from '../../services/api';
import useDialogLayer from '../../hooks/useDialogLayer';
import { lineDiff, diffHunks, diffSummary } from '../../lib/scriptLineDiff';

const SOURCE_LABELS = { save: 'Before a save', lock: 'Before a lock', generate: 'Before Regenerate', restore: 'Before a restore was saved' };

// What Tab moves between inside the panel (as ScriptTableRead's).
const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), input:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])';

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * A version's time as { text, title, iso }: "just now", "5 min ago",
 * "3 hours ago", "yesterday", "4 days ago", else "Oct 3"; title the full date
 * and time. null when there is no date (an older server sends none).
 */
export function versionTime(iso, now = Date.now()) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const title = d.toLocaleString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const s = Math.round((now - d.getTime()) / 1000);
  const startOf = (t) => { const x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const days = Math.round((startOf(now) - startOf(d.getTime())) / 86400000);
  let text;
  if (s < 0) text = d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  else if (s < 60) text = 'just now';
  else if (s < 3600) text = `${Math.floor(s / 60)} min ago`;
  else if (days === 0) text = `${plural(Math.floor(s / 3600), 'hour')} ago`;
  else if (days === 1) text = 'yesterday';
  else if (days < 7) text = `${days} days ago`;
  else text = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(d.getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}) });
  return { text, title, iso: d.toISOString() };
}

function VersionMeta({ v }) {
  const t = versionTime(v.created_at);
  const beats = Number.isFinite(Number(v.beats)) && v.beats !== null ? plural(Number(v.beats), 'beat') : null;
  return (
    <span className="esp-history-meta">
      {SOURCE_LABELS[v.restore ? 'restore' : v.source] || 'Earlier'}
      {t && <> · <time dateTime={t.iso} title={t.title}>{t.text}</time></>}
      {beats && <> · {beats}</>}
    </span>
  );
}

const isNarrow = () => {
  try { return window.matchMedia?.('(max-width: 760px)').matches || false; } catch (err) { console.error('[ScriptHistory] width check failed:', err); return false; }
};

// What putting the version back changes on the page.
function VersionDiff({ diff }) {
  const { add, del } = diffSummary(diff);
  const hunks = diffHunks(diff).slice(0, 400);
  return (
    <details className="esp-history-diff" data-testid="script-history-diff" open={!isNarrow()}>
      <summary className="esp-history-diff-sum">
        Changes to the page: {plural(add, 'line')} in, {plural(del, 'line')} out
      </summary>
      <ol className="esp-history-diff-list" aria-label="Lines that change">
        {hunks.map((d, k) => (d.type === 'gap'
          ? <li key={k} className="esp-history-diff-gap" aria-hidden="true">…</li>
          : (
            <li key={k} className={`esp-history-diff-line is-${d.type}`} data-type={d.type}>
              <span className="esp-history-diff-mark" aria-hidden="true">{d.type === 'add' ? '+' : d.type === 'del' ? '−' : ' '}</span>
              <span className="esp-sr">{d.type === 'add' ? 'Comes back: ' : d.type === 'del' ? 'Goes: ' : 'Unchanged: '}</span>
              <span className="esp-history-diff-text">{d.text}</span>
            </li>
          )))}
      </ol>
    </details>
  );
}

export default function ScriptHistory({ episodeId, dirty = false, hasProposal = false, current = null, preview = null, onRestore }) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState(null);
  const [shown, setShown] = useState(null);
  // { message, retry } for a read that failed.
  const [error, setError] = useState(null);
  // 'list' | 'version' | null: what is being read, said in a polite live region.
  const [reading, setReading] = useState(null);
  // The latest read asked for: an earlier one answering late is dropped
  // (Script page audit, 2026-10-19: clicking version 1 then 2 could show,
  // and put back, version 1).
  const readRef = useRef(0);
  // The panel is aria-modal (Script page audit, 2026-10-19): Tab stays in
  // it and Escape closes it, both from anywhere (focus falls to the page
  // when the button pressed inside is replaced), and focus goes back to
  // History when it closes. Tab as ScriptTableRead's.
  const openerRef = useRef(null);
  const dialogRef = useRef(null);
  const versionHeadRef = useRef(null);
  // The version row Back returns focus to (History audit, 2026-10-24).
  const backToRef = useRef(null);
  const wasOpen = useRef(false);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  // Escape and Tab are History's only while it is the dialog on top, and its
  // Escape is answered (Script page re-audit, 2026-10-19: one Escape closed
  // the DREAM Map over it and History too; Tab pulled focus behind the map).
  const isTop = useDialogLayer(open);
  const isTopRef = useRef(isTop);
  isTopRef.current = isTop;
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      const onKey = (e) => {
        if (e.defaultPrevented || !isTopRef.current()) return;
        // On a version, Escape goes back to the list; on the list, it closes.
        if (e.key === 'Escape') { e.preventDefault(); if (shownRef.current) back(); else close(); return; }
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
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // A version opened: focus its heading. Back: focus the row it came from.
  useEffect(() => {
    if (!open) return;
    if (shown) { versionHeadRef.current?.focus(); return; }
    const id = backToRef.current;
    if (id == null || !versions) return;
    backToRef.current = null;
    [...(dialogRef.current?.querySelectorAll('[data-version-id]') || [])].find((el) => el.dataset.versionId === String(id))?.focus();
  }, [open, shown, versions]);

  const readList = async () => {
    const seq = readRef.current + 1;
    readRef.current = seq;
    setError(null); setVersions(null); setReading('list');
    try {
      const res = await api.get(`/api/v1/episodes/${episodeId}/script-versions`);
      if (seq !== readRef.current) return;
      setVersions(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error('[ScriptHistory] list failed:', err);
      if (seq !== readRef.current) return;
      setError({ message: 'The history could not be read.', retry: readList });
      setVersions([]);
    } finally { if (seq === readRef.current) setReading(null); }
  };
  // Pressed again while open (behind its backdrop on a desktop, or from the
  // keyboard), History keeps the version on view (History audit, 2026-10-24).
  const openPanel = () => {
    if (open) { (versionHeadRef.current || dialogRef.current)?.focus(); return; }
    setOpen(true); setShown(null);
    // Read afresh each time it opens: a save made since is listed.
    readList();
  };
  const show = async (id) => {
    const seq = readRef.current + 1;
    readRef.current = seq;
    setError(null); setReading('version');
    try {
      const res = await api.get(`/api/v1/episodes/${episodeId}/script-versions/${id}`);
      if (seq !== readRef.current) return;
      backToRef.current = id;
      setShown(res.data?.data || null);
    } catch (err) {
      console.error('[ScriptHistory] version read failed:', err);
      if (seq === readRef.current) setError({ message: 'That version could not be read.', retry: () => show(id) });
    } finally { if (seq === readRef.current) setReading(null); }
  };
  const back = () => { readRef.current += 1; setReading(null); setError(null); setShown(null); };
  const close = () => { readRef.current += 1; setReading(null); setOpen(false); };

  const text = typeof shown?.script_content === 'string' ? shown.script_content : '';
  const landing = shown ? (preview ? preview(text) : text) : null;
  const same = shown && typeof current === 'string' && landing === current;
  const diff = shown && !same && typeof current === 'string' ? lineDiff(current, landing) : null;

  // The panel closes only when the page took the version: a refusal (a new
  // script is being written) leaves it open on it (Script page audit, 2026-10-19).
  // An open AI suggestion is asked about too (History audit, 2026-10-24: it was dropped without a word).
  const restore = () => {
    if (!shown || same) return;
    const losing = [dirty && 'your unsaved changes', hasProposal && 'the suggestion waiting for “Use it”'].filter(Boolean);
    if (losing.length) {
      const what = losing.join(' and ');
      if (!window.confirm(`Put this version on the page? ${what.charAt(0).toUpperCase()}${what.slice(1)} will be replaced.`)) return;
    }
    if (onRestore(text, shown) === false) return;
    close();
  };

  return (
    <>
      <button type="button" ref={openerRef} className="esp-btn" data-testid="script-history" aria-haspopup="dialog" aria-expanded={open} onClick={openPanel}><History size={14} aria-hidden="true" /> History</button>
      {open && (
        <>
          {/* Modal on a desktop too (History audit, 2026-10-24): the page behind is covered, and a click on it closes History. */}
          <div className="esp-history-backdrop" data-testid="script-history-backdrop" aria-hidden="true" onClick={close} />
          <div ref={dialogRef} className="esp-history" role="dialog" aria-modal="true" aria-label="Script history" data-testid="script-history-panel" tabIndex={-1}>
            <div className="esp-history-head">
              <h3 className="esp-history-title">History</h3>
              <button type="button" className="esp-btn is-small" aria-label="Close" autoFocus onClick={close}><X size={14} aria-hidden="true" /></button>
            </div>
            <p className="esp-history-empty" aria-live="polite" data-testid="script-history-status">{reading ? 'Reading…' : ''}</p>
            {error && (
              <div className="esp-history-error">
                <p className="esp-error" role="alert">{error.message}</p>
                <button type="button" className="esp-btn is-small" data-testid="script-history-retry" onClick={error.retry}>Try again</button>
              </div>
            )}
            {versions?.length === 0 && !error && !shown && <p className="esp-history-empty">No earlier versions yet. Each save, lock or Regenerate keeps the script it replaces.</p>}
            {shown ? (
              <div>
                <h4 className="esp-history-vtitle" ref={versionHeadRef} tabIndex={-1} data-testid="script-history-version-head">
                  <VersionMeta v={shown} />
                </h4>
                {same
                  ? <p className="esp-history-same" role="status" data-testid="script-history-same">This version is the same as the page.</p>
                  : diff && <VersionDiff diff={diff} />}
                <details className="esp-history-full">
                  <summary className="esp-history-diff-sum">The whole version</summary>
                  <pre className="esp-history-text" data-testid="script-history-text">{text}</pre>
                </details>
                <div className="esp-history-actions">
                  {!same && <button type="button" className="esp-btn-primary is-small" data-testid="script-history-restore" onClick={restore}>Put this version on the page</button>}
                  <button type="button" className="esp-btn is-small" data-testid="script-history-back" onClick={back}>Back to the list</button>
                </div>
                {!same && <p className="esp-history-note">It replaces the page&apos;s script as an unsaved change; Save keeps it. Approved beats stay locked as they are now.</p>}
              </div>
            ) : (
              <ul className="esp-history-list">
                {(versions || []).map((v) => (
                  <li key={v.id}>
                    <button type="button" className="esp-history-item" data-testid="script-history-item" data-version-id={v.id} onClick={() => show(v.id)}>
                      <VersionMeta v={v} />
                      {v.preview && <span className="esp-history-preview">{v.preview}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
}
