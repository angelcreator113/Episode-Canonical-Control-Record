/**
 * Shared UI Primitives — RelationshipEngine
 * Prime Studios · LalaVerse
 */
import { useState, useCallback } from 'react';

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
export function useToast() {
  const [toasts, set] = useState([]);
  const show = useCallback((msg, type = 'info') => {
    const id = Date.now();
    set(p => [...p, { id, msg, type }]);
    setTimeout(() => set(p => p.filter(t => t.id !== id)), 3800);
  }, []);
  return { toasts, show };
}
