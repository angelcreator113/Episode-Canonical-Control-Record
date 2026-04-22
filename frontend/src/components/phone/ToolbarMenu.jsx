import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Lightweight dropdown for the Phone Hub toolbar. Click the trigger to
 * open; click anywhere outside or press Escape to close. Used to
 * collapse the 7-button toolbar into "+ Add" (creation actions) and
 * "More" (view/export actions) while keeping the primary CTA
 * (Generate All) at full visibility.
 *
 * Children should be plain <button>s — the menu doesn't wrap them so
 * callers control exactly what each item does.
 */
export default function ToolbarMenu({
  label,
  icon,
  className = '',
  disabled = false,
  children,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`toolbar-menu ${className}`.trim()}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      <button
        type="button"
        className="overlays-header-btn"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {icon}
        <span className="btn-label">{label}</span>
        <ChevronDown size={11} style={{ marginLeft: 2, opacity: 0.7 }} />
      </button>
      {open && (
        <div
          className="toolbar-menu__list"
          role="menu"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}
