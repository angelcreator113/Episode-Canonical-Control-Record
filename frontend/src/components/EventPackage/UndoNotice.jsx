/**
 * UndoNotice — the inline "Removed ‘Story mentions’ · Undo" line the Event
 * Package's components show after a destructive one-click (useUndo).
 *
 * Always renders its live region (role=status), so a screen reader hears
 * the notice when it appears; empty, it takes no space. Undo is a real
 * button; × ends the offer at once. The timer pauses while the pointer or
 * focus is on the notice. `match(notice)` (optional) shows only the
 * notices it accepts (a document card shows its own).
 *
 * FloatingUndoHost draws the floating offers (useUndo) at the foot of the
 * screen, above the page's toast; showFloatingUndos() mounts it once, on
 * its own root, so it outlives the component that made the offer.
 */
import { useEffect, useReducer } from 'react';
import { createRoot } from 'react-dom/client';
import { Loader2, Undo2, X } from 'lucide-react';
import { floatingUndos, subscribeAllUndos, undoHandle } from './useUndo';
import './UndoNotice.css';

export default function UndoNotice({ undo, match = null, testId = 'undo-notice', className = '' }) {
  const notice = undo?.notice && (!match || match(undo.notice)) ? undo.notice : null;
  return (
    <div
      role="status" aria-live="polite" data-testid={`${testId}-region`}
      className={`eun-region${notice ? ' has-notice' : ''}${className ? ` ${className}` : ''}`}
    >
      {notice && (
        <div
          className={`eun${notice.error ? ' is-error' : ''}`} data-testid={testId}
          onMouseEnter={undo.pause} onMouseLeave={undo.resume} onFocus={undo.pause} onBlur={undo.resume}
        >
          <span className="eun-text">{notice.message}</span>
          <span className="eun-actions">
            <button type="button" className="eun-undo" onClick={undo.undo} disabled={notice.busy} data-testid={`${testId}-undo`}>
              {notice.busy ? <Loader2 size={12} className="eun-spin" aria-hidden="true" /> : <Undo2 size={12} aria-hidden="true" />}
              {notice.busy ? 'Undoing…' : 'Undo'}
            </button>
            <button type="button" className="eun-close" onClick={undo.dismiss} disabled={notice.busy} aria-label="Dismiss" data-testid={`${testId}-dismiss`}>
              <X size={12} aria-hidden="true" />
            </button>
          </span>
          {notice.error && <span className="eun-error" data-testid={`${testId}-error`}>Couldn&apos;t undo: {notice.error}</span>}
        </div>
      )}
    </div>
  );
}

export function FloatingUndoHost() {
  const [, rerender] = useReducer((n) => n + 1, 0);
  useEffect(() => subscribeAllUndos(rerender), []);
  const list = floatingUndos();
  return (
    <div className="eun-floating" data-testid="undo-floating">
      {list.map(({ key }) => <UndoNotice key={key} undo={undoHandle(key)} testId="undo-floating-notice" />)}
    </div>
  );
}

let floatingRoot = null;
/** Mounts FloatingUndoHost once (on document.body); later calls do nothing. */
export function showFloatingUndos() {
  if (floatingRoot || typeof document === 'undefined') return;
  try {
    const el = document.createElement('div');
    el.className = 'eun-floating-root';
    document.body.appendChild(el);
    floatingRoot = { root: createRoot(el), el };
    floatingRoot.root.render(<FloatingUndoHost />);
  } catch (err) {
    console.error('[UndoNotice] floating host mount failed:', err);
    floatingRoot = null;
  }
}

/** Tests: the floating host taken away again. */
export function hideFloatingUndos() {
  if (!floatingRoot) return;
  const { root, el } = floatingRoot;
  floatingRoot = null;
  try {
    root.unmount();
  } catch (err) {
    console.error('[UndoNotice] floating host unmount failed:', err);
  }
  el.remove();
}
