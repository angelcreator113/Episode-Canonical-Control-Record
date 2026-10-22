/**
 * The Files tab's shared pieces (Evoni, 2026-10-22: lighter photo cards,
 * empty spots shrink). CardMenu: a "⋯" button on a photo card that opens
 * its options (move, process again, delete …), closed by Escape, a tap
 * outside, or scrolling. It floats over the page (fixed, placed under the
 * button), so a card's edge or a scrolling strip never cuts it off. AddChip: an empty pose or folder as one small "+ Back" chip that
 * still takes a drop or opens the file picker. Styles: EpisodePosesPanel.css.
 */
import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';

const MENU_WIDTH = 196;

export function CardMenu({ label = 'Photo options', children }) {
  const [at, setAt] = useState(null); // { top, left } while open
  const box = useRef(null);
  const btn = useRef(null);
  const open = Boolean(at);
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setAt(null);
    const away = (e) => { if (box.current && !box.current.contains(e.target)) close(); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);
  const toggle = () => {
    if (open) { setAt(null); return; }
    const r = btn.current?.getBoundingClientRect() || { left: 0, bottom: 0 };
    const width = window.innerWidth || MENU_WIDTH;
    setAt({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, width - MENU_WIDTH - 8)) });
  };
  return (
    <div className="epp-menu" ref={box}>
      <button ref={btn} type="button" className="epp-menu-btn" aria-label={label} aria-expanded={open} title={label} onClick={toggle}>
        <MoreHorizontal size={16} aria-hidden />
      </button>
      {open && <div className="epp-menu-body" role="group" aria-label={label} style={{ top: at.top, left: at.left, width: MENU_WIDTH }}>{children}</div>}
    </div>
  );
}

export function AddChip({ label, accept, multiple = true, onFiles, testId, inputTestId, disabled = false }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  return (
    <span className={`epp-chip${over ? ' is-over' : ''}`} data-testid={testId}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer?.files); }}>
      <button type="button" className="epp-chip-btn" disabled={disabled} onClick={() => input.current?.click()} aria-label={`Add ${label}`}>
        <Plus size={14} aria-hidden /> {label}
      </button>
      <input ref={input} type="file" accept={accept} multiple={multiple} hidden data-testid={inputTestId}
        onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
    </span>
  );
}
