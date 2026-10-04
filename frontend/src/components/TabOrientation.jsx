/**
 * TabOrientation — the three-line "what this is" strip at the top of a hub
 * tab (2026-10-04): what the tab holds, what reads it, what to do here.
 * Dismissed per tab, remembered in this browser; a "Guide" link brings it
 * back. The copy lives beside the hub (pages/lalaverseOrientation.js).
 */
import React, { useState } from 'react';

const KEY = (id) => `lalaverse.orientation.${id}.dismissed`;

const readDismissed = (id) => {
  try { return window.localStorage.getItem(KEY(id)) === '1'; }
  catch (err) { console.error('[TabOrientation] could not read the dismissal:', err); return false; }
};
const writeDismissed = (id, value) => {
  try { if (value) window.localStorage.setItem(KEY(id), '1'); else window.localStorage.removeItem(KEY(id)); }
  catch (err) { console.error('[TabOrientation] could not remember the dismissal:', err); }
};

const row = { display: 'grid', gridTemplateColumns: 'minmax(96px, 120px) 1fr', gap: 8, fontSize: 12, lineHeight: 1.5 };
const label = { fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--lala-gold-text)', paddingTop: 2 };

export default function TabOrientation({ id, title, what, reads, doHere }) {
  const [dismissed, setDismissed] = useState(() => readDismissed(id));
  const toggle = (value) => { writeDismissed(id, value); setDismissed(value); };

  if (dismissed) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button type="button" onClick={() => toggle(false)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--primary-text)', cursor: 'pointer', textDecoration: 'underline' }}>
          Guide: {title}
        </button>
      </div>
    );
  }

  return (
    <section aria-label={`About this tab: ${title}`} data-testid={`orientation-${id}`}
      style={{ background: 'var(--primary-subtle)', border: '1px solid var(--primary-light)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--primary-text)' }}>{title}</h2>
        <button type="button" onClick={() => toggle(true)} aria-label="Dismiss this guide"
          style={{ background: 'none', border: '1px solid var(--primary-light)', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: 'var(--primary-text)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Got it
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={row}><span style={label}>What it is</span><span>{what}</span></div>
        <div style={row}><span style={label}>Who reads it</span><span>{reads}</span></div>
        <div style={row}><span style={label}>Do here</span><span>{doHere}</span></div>
      </div>
    </section>
  );
}
