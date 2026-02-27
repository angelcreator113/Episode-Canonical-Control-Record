/**
 * TherapyDilemmaGate.jsx
 * frontend/src/components/TherapyDilemmaGate.jsx
 *
 * The Dilemma Engine as it lives in Therapy Room.
 * Shows BEFORE a character's first session as a required baseline.
 * After baseline is established, unlocks the therapy session.
 *
 * Props:
 *   character: { id, name, selected_name, type, role, belief_pressured, writer_notes, wound_depth }
 *   onBaselineComplete: function() — called when dilemmas done, unlocks session
 *   onSkip: function() — skip baseline and go straight to session (optional escape)
 *
 * INTEGRATION:
 *   In TherapyRoom.jsx / TherapyPage.jsx — when a character is selected
 *   and has no previous sessions:
 *
 *   {selectedCharacter && sessionCount === 0 && !baselineComplete ? (
 *     <TherapyDilemmaGate
 *       character={selectedCharacter}
 *       onBaselineComplete={() => setBaselineComplete(true)}
 *       onSkip={() => setBaselineComplete(true)}
 *     />
 *   ) : (
 *     <TherapySessionPanel character={selectedCharacter} />
 *   )}
 */

import { useState } from 'react';
import CharacterDilemmaEngine from './CharacterDilemmaEngine';

const TYPE_COLORS = {
  pressure: '#B85C38',
  mirror:   '#9B7FD4',
  support:  '#4A9B6F',
  shadow:   '#E08C3A',
  special:  '#B8962E',
};

export default function TherapyDilemmaGate({ character, onBaselineComplete, onSkip }) {
  const [phase, setPhase] = useState('gate'); // gate | running | done
  const accent = TYPE_COLORS[character?.type] || '#B8962E';
  const charName = character?.selected_name || character?.name || 'this character';

  // Check if baseline already exists (belief_pressured + writer_notes populated)
  const hasBaseline = !!(character?.belief_pressured && character?.writer_notes);

  // If baseline already exists, skip the gate
  if (hasBaseline && phase === 'gate') {
    return (
      <div style={s.existingBaseline}>
        <div style={{ ...s.baselineDot, background: accent }} />
        <div style={s.baselineText}>
          <div style={s.baselineLabel}>BASELINE ESTABLISHED</div>
          <div style={s.baselineSub}>
            {charName}'s profile is active. Session can begin.
          </div>
        </div>
        <button
          style={{ ...s.proceedBtn, borderColor: accent, color: accent }}
          onClick={onBaselineComplete}
        >
          Open session →
        </button>
      </div>
    );
  }

  return (
    <div style={s.root}>

      {/* ── GATE PHASE — before dilemmas start ── */}
      {phase === 'gate' && (
        <div style={s.gate}>
          <div style={s.gateIcon}>◈</div>

          <div style={s.gateTitle}>
            No baseline established
          </div>

          <div style={s.gateBody}>
            Before {charName}'s first session, the system needs to understand
            who they are under pressure. Five dilemmas. Both choices cost something real.
            What they choose is who they are.
          </div>

          <div style={{ ...s.gateBody, marginTop: 8, opacity: 0.6 }}>
            This becomes the emotional baseline every future session builds from.
            Their wound depth, defense mechanisms, and operating logic all start here.
          </div>

          <div style={s.gateActions}>
            <button
              style={{ ...s.primaryBtn, background: accent }}
              onClick={() => setPhase('running')}
            >
              Establish baseline — run dilemmas
            </button>

            {onSkip && (
              <button style={s.skipBtn} onClick={onSkip}>
                Skip baseline — start session anyway
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── RUNNING PHASE — dilemma engine active ── */}
      {phase === 'running' && (
        <div style={s.running}>
          <div style={s.runningHeader}>
            <div style={s.runningLabel}>ESTABLISHING BASELINE</div>
            <div style={s.runningName}>{charName}</div>
          </div>

          <CharacterDilemmaEngine
            character={character}
            onProfileBuilt={(profile) => {
              setPhase('done');
              // Small delay so author sees the completed profile before transition
              setTimeout(() => {
                onBaselineComplete?.(profile);
              }, 2500);
            }}
          />
        </div>
      )}

      {/* ── DONE PHASE — baseline complete, transitioning ── */}
      {phase === 'done' && (
        <div style={s.done}>
          <div style={{ ...s.doneCheck, color: accent }}>◈</div>
          <div style={s.doneTitle}>Baseline established</div>
          <div style={s.doneSub}>
            {charName}'s profile is active.
            Opening the session room.
          </div>
          <div style={s.doneLoader}>
            <div style={{ ...s.doneLoaderFill, background: accent }} />
          </div>
        </div>
      )}

    </div>
  );
}

// ── STYLES ─────────────────────────────────────────────────────────────

const PARCHMENT  = '#FAF7F0';
const CREAM      = '#F5F0E5';
const INK        = '#1C1814';
const INK_MID    = 'rgba(28,24,20,0.5)';
const INK_LIGHT  = 'rgba(28,24,20,0.25)';

const s = {
  root: {
    background:   PARCHMENT,
    borderRadius: 6,
    overflow:     'hidden',
    border:       '1px solid rgba(28,24,20,0.08)',
  },

  // Gate
  gate: {
    padding:       '40px 32px',
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    textAlign:     'center',
    gap:           16,
  },
  gateIcon: {
    fontSize:    28,
    color:       INK_LIGHT,
    marginBottom: 4,
  },
  gateTitle: {
    fontFamily:   "'Cormorant Garamond', Georgia, serif",
    fontSize:     22,
    color:        INK,
    letterSpacing: '0.02em',
  },
  gateBody: {
    fontFamily:  "'Lora', Georgia, serif",
    fontStyle:   'italic',
    fontSize:    14,
    color:       INK_MID,
    lineHeight:  1.7,
    maxWidth:    460,
  },
  gateActions: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           10,
    marginTop:     8,
    width:         '100%',
    maxWidth:      340,
  },

  // Running
  running: {
    background: '#0d0b09', // dark for dilemma engine
  },
  runningHeader: {
    padding:        '16px 24px 0',
    display:        'flex',
    alignItems:     'center',
    gap:            12,
    borderBottom:   '1px solid rgba(250,247,240,0.06)',
    paddingBottom:  12,
  },
  runningLabel: {
    fontSize:      7.5,
    letterSpacing: '0.2em',
    color:         'rgba(250,247,240,0.3)',
    fontFamily:    "'DM Mono', monospace",
  },
  runningName: {
    fontFamily:    "'Cormorant Garamond', Georgia, serif",
    fontSize:      16,
    color:         'rgba(250,247,240,0.8)',
  },

  // Done
  done: {
    padding:       '48px 32px',
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           12,
    textAlign:     'center',
  },
  doneCheck: {
    fontSize: 32,
  },
  doneTitle: {
    fontFamily:   "'Cormorant Garamond', Georgia, serif",
    fontSize:     22,
    color:        INK,
  },
  doneSub: {
    fontFamily:  "'Lora', Georgia, serif",
    fontStyle:   'italic',
    fontSize:    13,
    color:       INK_MID,
    lineHeight:  1.6,
  },
  doneLoader: {
    width:        200,
    height:       2,
    background:   'rgba(28,24,20,0.08)',
    borderRadius: 1,
    overflow:     'hidden',
    marginTop:    16,
  },
  doneLoaderFill: {
    height:    '100%',
    width:     '100%',
    animation: 'progressFill 2.5s ease-out forwards',
  },

  // Existing baseline state
  existingBaseline: {
    display:     'flex',
    alignItems:  'center',
    gap:         12,
    padding:     '14px 16px',
    background:  CREAM,
    borderRadius: 4,
    border:      '1px solid rgba(28,24,20,0.08)',
  },
  baselineDot: {
    width:        8,
    height:       8,
    borderRadius: '50%',
    flexShrink:   0,
  },
  baselineText: {
    flex: 1,
  },
  baselineLabel: {
    fontSize:      7.5,
    letterSpacing: '0.15em',
    color:         INK_LIGHT,
    fontFamily:    "'DM Mono', monospace",
    marginBottom:  2,
  },
  baselineSub: {
    fontSize:   11,
    color:      INK_MID,
    fontFamily: "'Lora', Georgia, serif",
    fontStyle:  'italic',
  },
  proceedBtn: {
    background:    'none',
    border:        '1px solid',
    borderRadius:  3,
    padding:       '6px 14px',
    fontSize:      9,
    letterSpacing: '0.08em',
    cursor:        'pointer',
    fontFamily:    "'DM Mono', monospace",
    whiteSpace:    'nowrap',
  },

  // Shared
  primaryBtn: {
    border:        'none',
    borderRadius:  4,
    padding:       '13px 24px',
    color:         PARCHMENT,
    fontSize:      10,
    letterSpacing: '0.12em',
    cursor:        'pointer',
    fontFamily:    "'DM Mono', monospace",
    width:         '100%',
  },
  skipBtn: {
    background:    'none',
    border:        'none',
    color:         INK_LIGHT,
    fontSize:      9,
    letterSpacing: '0.06em',
    cursor:        'pointer',
    fontFamily:    "'DM Mono', monospace",
    textDecoration: 'underline',
    padding:       '4px 0',
  },
};
