/**
 * VoiceAttributionButton.jsx + VoiceTypeTag
 *
 * VoiceAttributionButton — Chapter-level action button.
 *   Sends all lines to /attribute-voices, shows summary on complete.
 *
 * VoiceTypeTag — Inline gutter badge showing voice type per line.
 *   Click to cycle/confirm voice type.
 *
 * Light theme — parchment ground, ink text, gold accents.
 *
 * Usage:
 *   import { VoiceAttributionButton, VoiceTypeTag } from '../components/VoiceAttributionButton';
 */

import React, { useState, useCallback } from 'react';

const API = '/api/v1/memories';

/* ── Palette ── */
const PARCHMENT = '#FAF7F0';
const INK       = '#1C1814';
const GOLD      = '#B8962E';

/* ── Voice type config ── */
const VOICE_COLORS = {
  narrator:      { bg: 'rgba(28,24,20,0.06)',  border: 'rgba(28,24,20,0.15)',  text: INK },
  interior:      { bg: 'rgba(184,150,46,0.08)', border: 'rgba(184,150,46,0.22)', text: '#8B7520' },
  dialogue:      { bg: 'rgba(70,130,180,0.08)', border: 'rgba(70,130,180,0.22)', text: '#3B6E8F' },
  lala:          { bg: 'rgba(170,80,160,0.08)', border: 'rgba(170,80,160,0.22)', text: '#8B4085' },
  transition:    { bg: 'rgba(28,24,20,0.03)',   border: 'rgba(28,24,20,0.10)',  text: 'rgba(28,24,20,0.45)' },
  unattributed:  { bg: 'transparent',           border: 'rgba(28,24,20,0.08)',  text: 'rgba(28,24,20,0.30)' },
};

const VOICE_LABELS = {
  narrator:     'NAR',
  interior:     'INT',
  dialogue:     'DLG',
  lala:         'LALA',
  transition:   'TRN',
  unattributed: '—',
};

const VOICE_ORDER = ['narrator', 'interior', 'dialogue', 'lala', 'transition'];


/* ════════════════════════════════════════════════════════════════════════
   VoiceAttributionButton — Chapter header action
   ════════════════════════════════════════════════════════════════════════ */

export function VoiceAttributionButton({ chapterId, lines, bookContext, onComplete }) {
  const [loading, setLoading]   = useState(false);
  const [summary, setSummary]   = useState(null);
  const [showSummary, setShow]  = useState(false);

  const runAttribution = useCallback(async () => {
    if (!lines?.length) return;
    setLoading(true);
    setSummary(null);
    try {
      const res = await fetch(`${API}/attribute-voices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapter_id:   chapterId,
          lines:        lines.map(l => ({
            id:          l.id,
            content:     l.text,
            order_index: l.order_index || l.sort_order || 0,
          })),
          book_context: bookContext || '',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSummary(data.summary);
        setShow(true);
        if (onComplete) onComplete(data.attributions);
      }
    } catch (err) {
      console.error('Voice attribution failed:', err);
    } finally {
      setLoading(false);
    }
  }, [chapterId, lines, bookContext, onComplete]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="st-chapter-icon-btn"
        onClick={runAttribution}
        disabled={loading || !lines?.length}
        title={loading ? 'Attributing voices…' : 'Attribute voices'}
        style={{
          opacity: loading ? 0.5 : 1,
          cursor: loading ? 'wait' : 'pointer',
        }}
      >
        {loading ? '◌' : '⊜'}
      </button>

      {/* Summary tooltip */}
      {showSummary && summary && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            right: 0,
            background: PARCHMENT,
            border: `1px solid rgba(28,24,20,0.12)`,
            borderRadius: 8,
            padding: '14px 18px',
            minWidth: 180,
            boxShadow: '0 4px 20px rgba(28,24,20,0.10)',
            zIndex: 100,
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
          }}
          onMouseLeave={() => setShow(false)}
        >
          <div style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: GOLD,
            marginBottom: 10,
          }}>
            Voice Attribution
          </div>
          {Object.entries(summary).map(([type, count]) => (
            <div key={type} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '3px 0',
              color: INK,
            }}>
              <span>{VOICE_LABELS[type] || type}</span>
              <span style={{ color: 'rgba(28,24,20,0.5)' }}>{count}</span>
            </div>
          ))}
          <div style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: '1px solid rgba(28,24,20,0.08)',
            fontSize: 10,
            color: 'rgba(28,24,20,0.4)',
            textAlign: 'center',
          }}>
            Click line tags to confirm
          </div>
        </div>
      )}
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════════════
   VoiceTypeTag — Per-line gutter badge
   ════════════════════════════════════════════════════════════════════════ */

export function VoiceTypeTag({ line, onConfirm }) {
  const voiceType  = line.voice_type || 'unattributed';
  const confirmed  = line.voice_confirmed;
  const confidence = line.voice_confidence;
  const colors     = VOICE_COLORS[voiceType] || VOICE_COLORS.unattributed;

  const cycleVoice = useCallback(() => {
    const idx     = VOICE_ORDER.indexOf(voiceType);
    const nextIdx = (idx + 1) % VOICE_ORDER.length;
    const next    = VOICE_ORDER[nextIdx];
    if (onConfirm) onConfirm(line.id, next);
  }, [voiceType, line.id, onConfirm]);

  if (voiceType === 'unattributed') return null;

  return (
    <button
      onClick={cycleVoice}
      title={`${voiceType}${confidence ? ` (${Math.round(confidence * 100)}%)` : ''}${confirmed ? ' ✓' : ' — click to cycle'}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '2px 7px',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 4,
        fontFamily: "'DM Mono', monospace",
        fontSize: 9,
        letterSpacing: '0.08em',
        color: colors.text,
        cursor: 'pointer',
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        opacity: confirmed ? 1 : 0.7,
        transition: 'all 0.2s',
      }}
    >
      {VOICE_LABELS[voiceType]}
      {confirmed && <span style={{ fontSize: 8, marginLeft: 2 }}>✓</span>}
    </button>
  );
}
