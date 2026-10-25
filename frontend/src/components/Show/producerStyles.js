/**
 * Producer Mode's styles and the small lookups its pieces draw with: the
 * `S` style object, the tier colours, the stat and event-type icons and the
 * event status pipeline. Moved out of WorldAdmin.jsx (2026-10-25) when the
 * Episode Ledger and the Opportunities tab moved to the Season page, so both
 * pages draw them the same way; WorldAdmin imports them back.
 */
import { PLAN_S } from './planStyles';

export const STAT_ICONS = { coins: '🪙', reputation: '⭐', brand_trust: '🤝', influence: '📣', stress: '😰' };
export const TIER_COLORS = { slay: 'var(--lala-gold)', pass: 'var(--success)', safe: 'var(--warning)', fail: 'var(--danger)' };
export const TIER_BG = { slay: 'var(--lala-gold-soft)', pass: 'var(--success-bg)', safe: 'var(--warning-bg)', fail: 'var(--danger-bg)' };
export const TIER_BORDER = { slay: 'var(--lala-gold-line)', pass: 'var(--success-border)', safe: 'var(--warning-border)', fail: 'var(--danger-border)' };
export const TIER_TEXT = { slay: 'var(--lala-gold-text)', pass: 'var(--success-text)', safe: 'var(--warning-text)', fail: 'var(--danger-text)' };
export const TIER_EMOJIS = { slay: '👑', pass: '✨', safe: '😐', fail: '💔' };
export const EVENT_TYPE_ICONS = { invite: '💌', upgrade: '⬆️', guest: '🌟', fail_test: '💔', deliverable: '📦', brand_deal: '🤝' };

// ─── EVENT STATUS PIPELINE ───
export const EVENT_STATUSES = ['draft', 'ready', 'used', 'scripted', 'filmed'];
export const EVENT_STATUS_CONFIG = {
  draft:    { label: 'Draft', color: '#94a3b8', bg: '#f1f5f9', icon: '○' },
  ready:    { label: 'Ready', color: '#b45309', bg: '#fef3c7', icon: '◎' },
  declined: { label: 'Declined', color: '#dc2626', bg: '#fef2f2', icon: '✗' },
  used:     { label: 'Injected', color: '#6366f1', bg: '#eef2ff', icon: '◉' },
  scripted: { label: 'Scripted', color: '#16a34a', bg: '#f0fdf4', icon: '✓' },
  filmed:   { label: 'Filmed', color: '#0284c7', bg: '#f0f9ff', icon: '★' },
};

// Results: an episode's evaluation in words (evaluation_status is 'computed' once scored, 'accepted' once kept).
export const EVALUATION_LABEL = { accepted: 'Evaluated', computed: 'Scored, not accepted' };

// ─── STYLES ───
export const S = {
  // The cards, buttons and layout the Season Plan pieces share (components/Show/planStyles).
  ...PLAN_S,
  // Producer Mode's chrome, in the studio theme's tokens (audit VISUAL-01,
  // batch 4): one token edit recolors every tab, card and button here.
  page: { maxWidth: 1200, margin: '0 auto', padding: '20px 24px', fontFamily: 'var(--font-sans)' },
  backLink: { color: 'var(--primary-text)', fontSize: 13, textDecoration: 'none', fontWeight: 500 },
  errorBanner: { display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10, color: 'var(--danger)', fontSize: 13, marginBottom: 12 },
  successBanner: { padding: '10px 16px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 10, color: 'var(--success)', fontSize: 13, marginBottom: 12, fontWeight: 600 },
  xBtn: { background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14 },
  smBtn: { padding: '5px 12px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 500, transition: 'all 0.12s' },
  smBtnDanger: { padding: '5px 12px', background: 'rgba(220,53,53,0.05)', border: '1px solid rgba(220,53,53,0.12)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: 'var(--danger)', fontWeight: 500, transition: 'all 0.12s' },
  // Overflow-menu item (Task #1648's per-card and header "⋯" menus —
  // WorldAdmin.jsx's own style, not shared with any other page).
  menuItem: { display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--lala-parchment-2)', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer' },
  // Marks a card's venue/date value resolved from the saved automation
  // copy rather than the event's own column (Task #1656) — same meaning
  // as EventPackagePage.css's .epp-saved-copy, kept inline here since this
  // file has no shared stylesheet of its own.
  savedCopyTag: { display: 'inline-block', marginLeft: 6, padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', background: 'var(--lala-gold-soft)', border: '1px solid var(--lala-gold-line)', color: 'var(--lala-gold-text)', verticalAlign: 'middle' },
  statsRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  statVal: (k, v) => ({ fontSize: 24, fontWeight: 700, color: (k === 'stress' && v >= 5) || (k === 'coins' && v < 0) ? 'var(--danger)' : 'var(--text-primary)' }),
  qGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 },
  qBox: { background: 'var(--surface-card)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 12, padding: 16, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  qVal: { fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' },
  qLbl: { fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 4, fontWeight: 500, letterSpacing: '0.3px' },
  tHead: { display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.08)', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.3px' },
  tRow: { display: 'flex', gap: 8, padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.04)', alignItems: 'center', fontSize: 13, transition: 'background 0.1s' },
  tCol: { flex: 1, minWidth: 0 },
  empty: { padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 },
  tierPill: (t) => ({ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: TIER_BG[t], color: TIER_TEXT[t] }),
  statusPill: (s) => {
    const cfg = EVENT_STATUS_CONFIG[s] || EVENT_STATUS_CONFIG.draft;
    return { padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, background: cfg.bg, color: cfg.color };
  },
  sourceBadge: (s) => ({ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: s === 'override' ? 'var(--warning-bg)' : s === 'manual' ? 'var(--danger-bg)' : 'var(--primary-subtle)', color: s === 'override' ? 'var(--warning-text)' : s === 'manual' ? 'var(--danger)' : 'var(--primary-text)' }),
  deltaBadge: (v) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: v > 0 ? 'var(--success-bg)' : 'var(--danger-bg)', color: v > 0 ? 'var(--success)' : 'var(--danger)' }),
  toastOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, pointerEvents: 'none' },
  toastBox: { padding: '20px 40px', maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box', background: 'var(--text-primary)', color: 'var(--surface-bg)', borderRadius: 14, fontSize: 14, fontWeight: 700, boxShadow: '0 12px 40px rgba(0,0,0,0.3)', textAlign: 'center', animation: 'waFadeIn 0.3s ease', pointerEvents: 'auto' },
  toastBoxFailed: { background: 'var(--danger)', boxShadow: '0 12px 40px rgba(180,35,24,0.35)' },
  eTag: { padding: '2px 8px', background: 'var(--primary-subtle)', borderRadius: 6, fontSize: 11, color: 'var(--primary-text)', fontWeight: 500 },
  fLabel: { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' },
  inp: { width: '100%', padding: '8px 12px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, color: 'var(--text-primary)', boxSizing: 'border-box', transition: 'border-color 0.15s', outline: 'none' },
  sel: { width: '100%', padding: '8px 12px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, color: 'var(--text-primary)', background: 'var(--surface-card)', transition: 'border-color 0.15s' },
  tArea: { width: '100%', padding: '8px 12px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 13, color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' },
};

// A toast reporting a failure: shown in red (F1). Producer Mode's and the
// event library's toasts both read it.
const FAILURE_TOAST = /\b(fail(ed|ure)?|error|could not|couldn't|can't|refused|not configured)\b/i;
export function isFailureToast(text) {
  return FAILURE_TOAST.test(String(text || ''));
}
