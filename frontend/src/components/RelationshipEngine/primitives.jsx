/**
 * Shared UI Primitives — RelationshipEngine
 * Prime Studios · LalaVerse
 */
import { useState, useCallback, useEffect, useRef } from 'react';

/* ── Button ────────────────────────────────────────────────────────── */
export function Btn({ variant = 'ghost', onClick, disabled, children, className = '', ...rest }) {
  const cls = {
    primary: 'cg-btn-primary',
    ghost:   'cg-btn-ghost',
    rose:    'cg-btn-danger',
    outline: 'cg-btn-secondary',
  };
  return (
    <button
      className={`${cls[variant] || cls.ghost} ${className}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ── Layer filter button ───────────────────────────────────────────── */
export function LFBtn({ active, onClick, count, dot, children }) {
  return (
    <button className={`re-lf-btn ${active ? 'is-active' : ''}`} onClick={onClick}>
      {dot && <span className="re-lf-dot" style={{ background: dot }} />}
      <span className="re-lf-label">{children}</span>
      <span className="re-lf-count">{count}</span>
    </button>
  );
}

/* ── Spinner ───────────────────────────────────────────────────────── */
export function Spinner() {
  return (
    <div className="re-spinner-wrap">
      <span className="re-spinner" />
      <span className="re-spinner-text">Loading…</span>
    </div>
  );
}

/* ── Field (read-only display) ─────────────────────────────────────── */
export function Field({ label, value }) {
  if (!value) return null;
  return (
    <div className="re-field">
      <div className="re-field-label">{label}</div>
      <div className="re-field-value">{value}</div>
    </div>
  );
}

/* ── Label ─────────────────────────────────────────────────────────── */
export function Label({ children }) {
  return <div className="re-label">{children}</div>;
}

/* ── Input ─────────────────────────────────────────────────────────── */
export function Input({ value, onChange, placeholder, multiline, id }) {
  const Component = multiline ? 'textarea' : 'input';
  return (
    <Component
      id={id}
      className={`cg-form-input ${multiline ? 'is-multiline' : ''}`}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={multiline ? 3 : undefined}
    />
  );
}

/* ── Select ────────────────────────────────────────────────────────── */
export function Select({ value, onChange, children, id }) {
  return (
    <select id={id} className="cg-form-select" value={value} onChange={onChange}>
      {children}
    </select>
  );
}

/* ── Pill ──────────────────────────────────────────────────────────── */
export function Pill({ children, color, bg }) {
  return (
    <span className="re-pill" style={{ color, background: bg || color + '18' }}>
      {children}
    </span>
  );
}

/* ── Toast hook ────────────────────────────────────────────────────── */
// A toast can carry one action (e.g. Undo after a delete); it then stays
// longer, and running the action closes it.
let toastSeq = 0;
export function useToast() {
  const [toasts, set] = useState([]);
  const dismiss = useCallback(id => set(p => p.filter(t => t.id !== id)), []);
  const show = useCallback((msg, type = 'info', action = null) => {
    toastSeq += 1;
    const id = `${Date.now()}-${toastSeq}`;
    set(p => [...p, { id, msg, type, action }]);
    setTimeout(() => dismiss(id), action ? 8000 : 3800);
  }, [dismiss]);
  return { toasts, show, dismiss };
}

/* ── Phone width (the Inspector becomes a bottom sheet) ─────────────── */
export const PHONE_QUERY = '(max-width: 600px)';
export function useIsPhone() {
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;
  const [phone, setPhone] = useState(get);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(PHONE_QUERY);
    const on = () => setPhone(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return phone;
}

/* ── Focus trap: Tab stays inside, Escape closes ────────────────────── */
export function useFocusTrap(active, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return undefined;
    const before = document.activeElement;
    const items = () => [...el.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter(n => !n.disabled);
    (el.querySelector('[data-autofocus]') || items()[0])?.focus();
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); onClose?.(); return; }
      if (e.key !== 'Tab') return;
      const list = items();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('keydown', onKey);
      if (before && typeof before.focus === 'function') before.focus();
    };
  }, [active, onClose]);
  return ref;
}
