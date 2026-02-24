/**
 * VentureRegistry.jsx
 * frontend/src/components/VentureRegistry.jsx
 *
 * THE VENTURE REGISTRY — wired into the writing layer
 *
 * JustAWoman attempted 5 ventures before Lala. Each one has a hidden
 * lesson, a buried self, and a decision echo that reverberates later.
 */

import { useState } from 'react';
import { VENTURES, PNOS_ACTS } from '../data/ventureData';

const STATUS_STYLES = {
  'ABANDONED':                  { color: '#B85C38', bg: 'rgba(184,92,56,0.08)' },
  'PARTIALLY SUCCEEDED / SPIRIT-DRAINING': { color: '#8B6914', bg: 'rgba(139,105,20,0.08)' },
  'LOW TRACTION / PSYCHOLOGICALLY HEAVY':  { color: '#7B5EA7', bg: 'rgba(123,94,167,0.08)' },
  'MONEY PIT / HYPE-FUELED':    { color: '#B85C38', bg: 'rgba(184,92,56,0.08)' },
};

const ACT_COLORS = {
  act_1: '#C9A84C',
  act_2: '#B85C38',
  act_3: '#7B5EA7',
  act_4: '#4A7C59',
  act_5: '#C9A84C',
};

export default function VentureRegistry({ activeAct = 'act_1', onVentureSelect }) {
  const [expanded, setExpanded]   = useState(null);
  const [showEchoes, setShowEchoes] = useState(false);

  // Ventures relevant to the current act are highlighted
  const currentActVentures = VENTURES.filter(v =>
    v.act === activeAct || v.act === 'act_1_2'
  );

  return (
    <div style={st.panel}>
      <div style={st.header}>
        <div style={st.headerLeft}>
          <div style={st.label}>VENTURE REGISTRY</div>
          <div style={st.sub}>
            5 attempts before Lala. Each one is still in her body.
          </div>
        </div>
        <button
          style={{ ...st.echoToggle, color: showEchoes ? '#C9A84C' : 'rgba(30,25,20,0.3)' }}
          onClick={() => setShowEchoes(!showEchoes)}
          title="Toggle decision echoes"
        >
          ⟳ echoes
        </button>
      </div>

      {/* Current act indicator */}
      <div style={{ ...st.actBadge, borderColor: `${ACT_COLORS[activeAct]}40`, color: ACT_COLORS[activeAct] }}>
        {PNOS_ACTS[activeAct]?.label} · "{PNOS_ACTS[activeAct]?.belief}"
      </div>

      {/* Venture list */}
      <div style={st.ventureList}>
        {VENTURES.map(venture => {
          const isActive   = venture.act === activeAct || venture.act === 'act_1_2';
          const isExpanded = expanded === venture.id;
          const statusStyle = STATUS_STYLES[venture.status] || { color: 'rgba(30,25,20,0.4)', bg: 'transparent' };

          return (
            <div
              key={venture.id}
              style={{
                ...st.ventureCard,
                opacity:     isActive ? 1 : 0.45,
                borderColor: isActive ? 'rgba(201,168,76,0.2)' : 'rgba(30,25,20,0.08)',
                background:  isExpanded ? 'rgba(201,168,76,0.03)' : 'white',
              }}
            >
              {/* Card header — always visible */}
              <div
                style={st.cardHeader}
                onClick={() => {
                  setExpanded(isExpanded ? null : venture.id);
                  onVentureSelect?.(venture);
                }}
              >
                <div style={st.cardLeft}>
                  <div style={st.archetype}>{venture.archetype}</div>
                  <div style={st.ventureName}>{venture.name}</div>
                  <div style={{ ...st.statusBadge, color: statusStyle.color, background: statusStyle.bg }}>
                    {venture.status}
                  </div>
                </div>
                <div style={st.actTag}>{venture.actLabel}</div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={st.cardBody}>
                  <VentureField label="WHAT IT PROMISED"  text={venture.promised} />
                  <VentureField label="WHAT IT COST"      text={venture.cost} />
                  <VentureField label="HIDDEN LESSON"     text={venture.lesson} color="#4A7C59" />
                  <VentureField label="BURIED SELF"       text={venture.buriedSelf} color="#7B5EA7" />

                  {showEchoes && (
                    <div style={st.echoBlock}>
                      <div style={st.echoLabel}>⟳ DECISION ECHO</div>
                      <div style={st.echoText}>{venture.decisionEcho}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VentureField({ label, text, color }) {
  return (
    <div style={st.field}>
      <div style={{ ...st.fieldLabel, color: color || 'rgba(30,25,20,0.3)' }}>{label}</div>
      <div style={st.fieldText}>{text}</div>
    </div>
  );
}

const st = {
  panel: {
    display: 'flex', flexDirection: 'column', gap: 10,
    padding: '14px 20px',
    borderTop: '1px solid rgba(47,42,38,0.06)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: 3 },
  label: {
    fontFamily: 'DM Mono, monospace', fontSize: 9,
    letterSpacing: '0.2em', color: '#C9A84C',
  },
  sub: {
    fontFamily: 'DM Mono, monospace', fontSize: 8.5,
    color: 'rgba(30,25,20,0.35)', letterSpacing: '0.04em', lineHeight: 1.5,
  },
  echoToggle: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    letterSpacing: '0.06em', padding: '2px 0',
    transition: 'color 0.15s',
  },
  actBadge: {
    border: '1px solid', borderRadius: 2,
    padding: '5px 10px',
    fontFamily: 'DM Mono, monospace', fontSize: 9,
    letterSpacing: '0.05em', lineHeight: 1.5,
  },
  ventureList: {
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  ventureCard: {
    border: '1px solid', borderRadius: 3,
    overflow: 'hidden', transition: 'opacity 0.2s, background 0.15s',
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '10px 12px', cursor: 'pointer',
  },
  cardLeft: { display: 'flex', flexDirection: 'column', gap: 3 },
  archetype: {
    fontFamily: 'DM Mono, monospace', fontSize: 8.5,
    letterSpacing: '0.12em', color: 'rgba(30,25,20,0.3)',
  },
  ventureName: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 13.5, fontStyle: 'italic', color: 'rgba(30,25,20,0.82)',
  },
  statusBadge: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    letterSpacing: '0.06em', padding: '2px 6px',
    borderRadius: 2, display: 'inline-block', marginTop: 2,
  },
  actTag: {
    fontFamily: 'DM Mono, monospace', fontSize: 7,
    color: 'rgba(30,25,20,0.25)', letterSpacing: '0.08em',
    flexShrink: 0, paddingTop: 2,
  },
  cardBody: {
    padding: '0 12px 12px',
    display: 'flex', flexDirection: 'column', gap: 8,
    borderTop: '1px solid rgba(30,25,20,0.06)',
    paddingTop: 10,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 3 },
  fieldLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 7,
    letterSpacing: '0.12em', textTransform: 'uppercase',
  },
  fieldText: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 12, fontStyle: 'italic', color: 'rgba(30,25,20,0.7)',
    lineHeight: 1.6,
  },
  echoBlock: {
    background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)',
    borderRadius: 2, padding: '8px 10px',
    display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4,
  },
  echoLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 7,
    letterSpacing: '0.12em', color: '#C9A84C',
  },
  echoText: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 12, fontStyle: 'italic', color: 'rgba(30,25,20,0.65)',
    lineHeight: 1.6,
  },
};
