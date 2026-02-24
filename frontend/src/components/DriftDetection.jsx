/**
 * DriftDetection.jsx
 * frontend/src/components/DriftDetection.jsx
 *
 * ════════════════════════════════════════════════════════════════════════
 * DRIFT DETECTION — what happens when you shift characters mid-interview
 * ════════════════════════════════════════════════════════════════════════
 *
 * Four exports:
 *
 * 1. DriftIndicator       — subtle banner when drift is detected
 * 2. RelationalNoteCard   — single cross-character observation card
 * 3. RelationalNotesPanel — sidebar panel of all session observations
 * 4. BridgeMomentPrompt   — prominent bridge question display
 */

import { useState, useEffect } from 'react';

// ── DRIFT INDICATOR ───────────────────────────────────────────────────────

export function DriftIndicator({ drift, primaryCharacter }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (drift?.drifted_to) {
      setVisible(true);
    } else {
      const t = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(t);
    }
  }, [drift?.drifted_to]);

  if (!visible || !drift) return null;

  const isBridgeReady = drift.bridge_ready;
  const isFullShift   = drift.drift_type === 'full_shift';
  const isComparison  = drift.drift_type === 'comparison';

  const message = isBridgeReady
    ? `Bridge moment — what does drifting to ${drift.drifted_to} tell you about ${primaryCharacter}?`
    : isFullShift
    ? `You shifted to ${drift.drifted_to} — following it.`
    : isComparison
    ? `You're comparing ${primaryCharacter} to ${drift.drifted_to} — leaning in.`
    : `${drift.drifted_to} mentioned — staying with ${primaryCharacter}.`;

  const color = isBridgeReady ? '#C9A84C' : isFullShift ? '#9B7FD4' : '#4A9B6F';

  return (
    <div style={{
      ...st.driftBanner,
      borderColor:  `${color}30`,
      background:   `${color}08`,
    }}>
      <div style={{ ...st.driftDot, background: color }} />
      <div style={{ ...st.driftMessage, color }}>
        {message}
      </div>
      {isFullShift && !isBridgeReady && (
        <div style={st.driftSub}>
          This is perception data — how {primaryCharacter} sees {drift.drifted_to}.
        </div>
      )}
    </div>
  );
}

// ── RELATIONAL NOTE CARD ──────────────────────────────────────────────────

export function RelationalNoteCard({ note }) {
  if (!note?.observation) return null;

  return (
    <div style={st.noteCard}>
      <div style={st.noteHeader}>
        <div style={st.noteFrom}>{note.primary_character}</div>
        <div style={st.noteArrow}>→</div>
        <div style={st.noteTo}>{note.drifted_to}</div>
        <div style={st.noteType}>{note.type === 'full_shift' ? 'DEEP DRIFT' : 'COMPARISON'}</div>
      </div>
      <div style={st.noteObservation}>{note.observation}</div>
      {note.raw_content && (
        <div style={st.noteRaw}>"{note.raw_content.slice(0, 120)}{note.raw_content.length > 120 ? '...' : ''}"</div>
      )}
    </div>
  );
}

// ── RELATIONAL NOTES PANEL ────────────────────────────────────────────────

export function RelationalNotesPanel({ notes = [], primaryCharacter }) {
  const [expanded, setExpanded] = useState(true);

  if (notes.length === 0) return null;

  // Group by drifted_to character
  const grouped = notes.reduce((acc, note) => {
    if (!note.drifted_to) return acc;
    if (!acc[note.drifted_to]) acc[note.drifted_to] = [];
    acc[note.drifted_to].push(note);
    return acc;
  }, {});

  return (
    <div style={st.panel}>
      <div style={st.panelHeader} onClick={() => setExpanded(!expanded)}>
        <div style={st.panelTitle}>CROSS-CHARACTER OBSERVATIONS</div>
        <div style={st.panelSub}>
          How {primaryCharacter} perceives other characters — captured from natural drift
        </div>
        <div style={st.panelCaret}>{expanded ? '▲' : '▼'}</div>
      </div>

      {expanded && (
        <div style={st.panelBody}>
          <div style={st.panelNote}>
            This is perception data — what {primaryCharacter} thinks and feels about others.
            Different from the other characters' own profiles.
          </div>

          {Object.entries(grouped).map(([charName, charNotes]) => (
            <div key={charName} style={st.charGroup}>
              <div style={st.charGroupLabel}>
                {primaryCharacter.toUpperCase()} ON {charName.toUpperCase()}
              </div>
              {charNotes.map((note, i) => (
                <div key={i} style={st.groupNote}>
                  {note.observation && (
                    <div style={st.groupObservation}>{note.observation}</div>
                  )}
                  <div style={st.groupRaw}>
                    "{note.raw_content?.slice(0, 100)}{note.raw_content?.length > 100 ? '...' : ''}"
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── BRIDGE MOMENT PROMPT ──────────────────────────────────────────────────

export function BridgeMomentPrompt({ primaryCharacter, driftedTo }) {
  return (
    <div style={st.bridge}>
      <div style={st.bridgeEyebrow}>BRIDGE MOMENT</div>
      <div style={st.bridgeQuestion}>
        You were talking about {primaryCharacter} and kept coming back to {driftedTo}.
        What does that drift tell you about {primaryCharacter} — not about {driftedTo}?
      </div>
      <div style={st.bridgeSub}>
        This is the question the session was building toward.
        The interviewer will ask it now.
      </div>
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────

const st = {
  // Drift banner
  driftBanner: {
    border: '1px solid',
    borderRadius: 3,
    padding: '8px 12px',
    marginBottom: 12,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  driftDot: {
    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
  },
  driftMessage: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.06em',
    fontWeight: 600,
  },
  driftSub: {
    width: '100%',
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(30,25,20,0.4)',
    letterSpacing: '0.03em',
    paddingLeft: 14,
  },

  // Relational note card
  noteCard: {
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 3,
    padding: '10px 12px',
    background: 'rgba(201,168,76,0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginBottom: 8,
  },
  noteHeader: {
    display: 'flex', alignItems: 'center', gap: 7,
  },
  noteFrom: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    fontWeight: 700, letterSpacing: '0.08em',
    color: 'rgba(30,25,20,0.6)',
  },
  noteArrow: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    color: 'rgba(30,25,20,0.2)',
  },
  noteTo: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    fontWeight: 700, letterSpacing: '0.08em',
    color: '#C9A84C',
  },
  noteType: {
    fontFamily: 'DM Mono, monospace', fontSize: 6.5,
    letterSpacing: '0.15em',
    color: 'rgba(30,25,20,0.25)',
    marginLeft: 'auto',
  },
  noteObservation: {
    fontFamily: "'Cormorant Garamond', 'Lora', serif",
    fontSize: 14,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.75)',
    lineHeight: 1.55,
  },
  noteRaw: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    color: 'rgba(30,25,20,0.35)',
    letterSpacing: '0.02em',
    lineHeight: 1.5,
    fontStyle: 'italic',
  },

  // Panel
  panel: {
    border: '1px solid rgba(30,25,20,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    background: 'white',
    marginTop: 12,
  },
  panelHeader: {
    padding: '10px 14px',
    cursor: 'pointer',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 4,
  },
  panelTitle: {
    fontFamily: 'DM Mono, monospace', fontSize: 7,
    letterSpacing: '0.2em', color: '#C9A84C',
    width: '100%',
  },
  panelSub: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    color: 'rgba(30,25,20,0.35)', letterSpacing: '0.03em',
    lineHeight: 1.5, flex: 1,
  },
  panelCaret: {
    fontFamily: 'DM Mono, monospace', fontSize: 7,
    color: 'rgba(30,25,20,0.2)',
  },
  panelBody: {
    borderTop: '1px solid rgba(30,25,20,0.06)',
    padding: '10px 14px',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  panelNote: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    color: 'rgba(30,25,20,0.35)', letterSpacing: '0.03em',
    lineHeight: 1.6,
    fontStyle: 'italic',
  },
  charGroup: {
    display: 'flex', flexDirection: 'column', gap: 7,
  },
  charGroupLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    letterSpacing: '0.15em', color: 'rgba(30,25,20,0.3)',
  },
  groupNote: {
    borderLeft: '2px solid rgba(201,168,76,0.3)',
    paddingLeft: 10,
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  groupObservation: {
    fontFamily: "'Cormorant Garamond', 'Lora', serif",
    fontSize: 13.5, fontStyle: 'italic',
    color: 'rgba(30,25,20,0.7)', lineHeight: 1.5,
  },
  groupRaw: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    color: 'rgba(30,25,20,0.3)', letterSpacing: '0.02em',
    lineHeight: 1.5,
  },

  // Bridge moment
  bridge: {
    border: '1px solid rgba(201,168,76,0.35)',
    borderRadius: 3,
    padding: '14px 16px',
    background: 'rgba(201,168,76,0.06)',
    display: 'flex', flexDirection: 'column', gap: 8,
    marginBottom: 12,
  },
  bridgeEyebrow: {
    fontFamily: 'DM Mono, monospace', fontSize: 7,
    letterSpacing: '0.2em', color: '#C9A84C',
  },
  bridgeQuestion: {
    fontFamily: "'Cormorant Garamond', 'Lora', serif",
    fontSize: 16, fontStyle: 'italic',
    color: 'rgba(30,25,20,0.8)', lineHeight: 1.55,
  },
  bridgeSub: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    color: 'rgba(30,25,20,0.35)', letterSpacing: '0.04em',
    lineHeight: 1.5,
  },
};
