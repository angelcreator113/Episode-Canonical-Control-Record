/**
 * Producer Mode's card, button and layout styles that the Season Plan pieces
 * (SeasonPlan.jsx) are drawn with. Moved out of WorldAdmin's `S`, which
 * spreads them back in, so Producer Mode and the Season page (2026-10-25)
 * draw the same pieces the same way.
 */
export const PLAN_S = {
  center: { textAlign: 'center', padding: 60, color: 'var(--text-muted)' },
  // Soft pink accents, as on the episode page (Evoni, 2026-10-05): the tab
  // row's rule, the cards' top edge and border, the header's teal-to-pink
  // line and the context bar (WorldAdmin.css). Actions and the active tab
  // stay teal; pink is never under text here.
  content: { display: 'flex', flexDirection: 'column', gap: 16, animation: 'waFadeIn 0.2s ease' },
  card: { background: 'var(--surface-card)', border: '1px solid var(--accent-subtle)', borderTop: '2px solid var(--accent-light)', borderRadius: 14, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  cardTitle: { fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' },
  muted: { color: 'var(--text-muted)', fontSize: 13 },
  primaryBtn: { padding: '8px 18px', background: 'var(--lala-lavender)', border: 'none', borderRadius: 8, color: 'var(--text-inverse)', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--shadow-sm)', transition: 'all 0.15s' },
  secBtn: { padding: '8px 18px', background: 'var(--surface-bg)', border: '1px solid var(--primary-subtle)', borderRadius: 8, color: 'var(--primary-text)', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' },
};
