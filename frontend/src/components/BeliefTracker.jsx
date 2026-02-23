/**
 * BeliefTracker.jsx
 * frontend/src/components/BeliefTracker.jsx
 *
 * BELIEF TRACKER — wired into the Chapter Brief
 *
 * The 5 PNOS acts each have a distinct core belief and a distinct voice.
 * Act I JustAWoman and Act IV JustAWoman are not the same person.
 */

import { useState } from 'react';
import { PNOS_ACTS, PLOT_THREADS } from '../data/ventureData';

const ACT_COLORS = {
  act_1: '#C9A84C',
  act_2: '#B85C38',
  act_3: '#7B5EA7',
  act_4: '#4A7C59',
  act_5: '#C9A84C',
};

export default function BeliefTracker({ chapter, onActChange, onThreadChange }) {
  const savedAct     = chapter?.pnos_act || parsePnosActFromNotes(chapter?.chapter_notes) || 'act_1';
  const savedThreads = chapter?.active_threads || [];

  const [selectedAct,     setSelectedAct]     = useState(savedAct);
  const [activeThreads,   setActiveThreads]   = useState(savedThreads);
  const [expanded,        setExpanded]        = useState(false);

  const act = PNOS_ACTS[selectedAct];

  function handleActChange(actId) {
    setSelectedAct(actId);
    onActChange?.(actId);
  }

  function handleThreadToggle(threadId) {
    const next = activeThreads.includes(threadId)
      ? activeThreads.filter(t => t !== threadId)
      : [...activeThreads, threadId];
    setActiveThreads(next);
    onThreadChange?.(next);
  }

  return (
    <div style={st.panel}>

      {/* ── Collapsed view — always visible ───────────────────────── */}
      <div style={st.collapsedRow} onClick={() => setExpanded(!expanded)}>
        <div style={st.collapsedLeft}>
          <div style={{ ...st.actPill, background: `${ACT_COLORS[selectedAct]}18`, color: ACT_COLORS[selectedAct], borderColor: `${ACT_COLORS[selectedAct]}40` }}>
            {act.label}
          </div>
          <div style={st.beliefPreview}>
            "{act.belief}"
          </div>
        </div>
        <div style={{ ...st.threadDots, gap: 5 }}>
          {Object.values(PLOT_THREADS).map(thread => (
            <div
              key={thread.id}
              style={{
                ...st.threadDot,
                background: activeThreads.includes(thread.id) ? thread.color : 'rgba(30,25,20,0.1)',
              }}
              title={thread.label}
            />
          ))}
          <div style={st.expandCaret}>{expanded ? '\u25B2' : '\u25BC'}</div>
        </div>
      </div>

      {/* ── Expanded view ─────────────────────────────────────────── */}
      {expanded && (
        <div style={st.expandedBody}>

          {/* Act selector */}
          <div style={st.section}>
            <div style={st.sectionLabel}>PNOS ACT</div>
            <div style={st.actRow}>
              {Object.values(PNOS_ACTS).map(a => (
                <button
                  key={a.id}
                  style={{
                    ...st.actBtn,
                    background:   selectedAct === a.id ? `${ACT_COLORS[a.id]}18` : 'white',
                    borderColor:  selectedAct === a.id ? ACT_COLORS[a.id] : 'rgba(30,25,20,0.1)',
                    color:        selectedAct === a.id ? ACT_COLORS[a.id] : 'rgba(30,25,20,0.45)',
                  }}
                  onClick={() => handleActChange(a.id)}
                >
                  {a.label.split(' \u2014 ')[0]}<br />
                  <span style={{ fontWeight: 400, fontSize: 8 }}>{a.label.split(' \u2014 ')[1]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Current belief */}
          <div style={st.beliefBlock}>
            <div style={{ ...st.beliefQuote, color: ACT_COLORS[selectedAct] }}>
              "{act.belief}"
            </div>
            <div style={st.beliefVoice}>
              <span style={st.voiceLabel}>VOICE: </span>
              {act.voice_note}
            </div>
            <div style={st.beliefShift}>
              <span style={st.voiceLabel}>SHIFT: </span>
              {act.shifted_by}
            </div>
          </div>

          {/* Thread toggles */}
          <div style={st.section}>
            <div style={st.sectionLabel}>ACTIVE THREADS THIS CHAPTER</div>
            <div style={st.threadRow}>
              {Object.values(PLOT_THREADS).map(thread => (
                <button
                  key={thread.id}
                  style={{
                    ...st.threadBtn,
                    borderColor:  activeThreads.includes(thread.id) ? thread.color : 'rgba(30,25,20,0.1)',
                    background:   activeThreads.includes(thread.id) ? `${thread.color}12` : 'white',
                    color:        activeThreads.includes(thread.id) ? thread.color : 'rgba(30,25,20,0.35)',
                  }}
                  onClick={() => handleThreadToggle(thread.id)}
                >
                  <div style={{ ...st.threadBtnDot, background: thread.color }} />
                  {thread.label}
                </button>
              ))}
            </div>
            {activeThreads.length > 0 && (
              <div style={st.threadQuestions}>
                {activeThreads.map(id => {
                  const t = PLOT_THREADS[id];
                  return t ? (
                    <div key={id} style={{ ...st.threadQuestion, borderLeftColor: t.color }}>
                      <span style={{ color: t.color, fontFamily: 'DM Mono, monospace', fontSize: 7, letterSpacing: '0.1em' }}>{t.label.toUpperCase()}: </span>
                      {t.question}
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

// ── Parse act from chapter_notes if using Option A (no migration) ────────
function parsePnosActFromNotes(notes) {
  if (!notes) return null;
  const match = notes.match(/^\[PNOS:(act_\d)\]/);
  return match ? match[1] : null;
}

// ── Styles ────────────────────────────────────────────────────────────────

const st = {
  panel: {
    border: '1px solid rgba(201,168,76,0.15)',
    borderRadius: 3,
    background: 'rgba(255,253,248,0.6)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  collapsedRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 14px', cursor: 'pointer',
  },
  collapsedLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  actPill: {
    border: '1px solid', borderRadius: 20,
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    letterSpacing: '0.1em', padding: '3px 9px', flexShrink: 0,
  },
  beliefPreview: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 12, fontStyle: 'italic', color: 'rgba(30,25,20,0.55)',
    lineHeight: 1.4,
  },
  threadDots: { display: 'flex', alignItems: 'center' },
  threadDot: { width: 7, height: 7, borderRadius: '50%', transition: 'background 0.15s' },
  expandCaret: {
    fontFamily: 'DM Mono, monospace', fontSize: 7,
    color: 'rgba(30,25,20,0.2)', marginLeft: 6,
  },
  expandedBody: {
    borderTop: '1px solid rgba(201,168,76,0.1)',
    padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 14,
    background: 'rgba(255,253,248,0.4)',
  },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    letterSpacing: '0.16em', color: 'rgba(30,25,20,0.3)',
  },
  actRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  actBtn: {
    border: '1px solid', borderRadius: 2,
    fontFamily: 'DM Mono, monospace', fontSize: 8.5,
    fontWeight: 600, letterSpacing: '0.08em',
    padding: '6px 10px', cursor: 'pointer',
    lineHeight: 1.4, textAlign: 'center',
    transition: 'all 0.12s',
  },
  beliefBlock: {
    background: 'rgba(201,168,76,0.04)',
    border: '1px solid rgba(201,168,76,0.12)',
    borderRadius: 2, padding: '10px 12px',
    display: 'flex', flexDirection: 'column', gap: 7,
  },
  beliefQuote: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 14, fontStyle: 'italic', lineHeight: 1.5,
  },
  beliefVoice: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    color: 'rgba(30,25,20,0.5)', letterSpacing: '0.03em', lineHeight: 1.6,
  },
  beliefShift: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    color: 'rgba(30,25,20,0.4)', letterSpacing: '0.03em', lineHeight: 1.5,
  },
  voiceLabel: {
    color: 'rgba(30,25,20,0.25)', letterSpacing: '0.12em', fontSize: 7,
  },
  threadRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  threadBtn: {
    border: '1px solid', borderRadius: 2,
    fontFamily: 'DM Mono, monospace', fontSize: 8, letterSpacing: '0.08em',
    padding: '5px 10px 5px 8px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
    transition: 'all 0.12s',
  },
  threadBtnDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  threadQuestions: { display: 'flex', flexDirection: 'column', gap: 6 },
  threadQuestion: {
    borderLeft: '2px solid',
    paddingLeft: 8,
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 12, fontStyle: 'italic', color: 'rgba(30,25,20,0.6)',
    lineHeight: 1.55,
  },
};
