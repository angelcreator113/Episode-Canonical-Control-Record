/**
 * PacingArc.jsx
 * frontend/src/components/PacingArc.jsx
 *
 * PACING ARC — emotional temperature across all chapters.
 * Shows the emotional temperature curve. Author sets 1–5 intensity per chapter.
 * Reveals burnout risk, drift risk, missing recovery beats, and finale drops.
 */

import { useState } from 'react';

const PNOS_ACT_COLORS = {
  act_1: '#C9A84C',
  act_2: '#B85C38',
  act_3: '#7B5EA7',
  act_4: '#4A7C59',
  act_5: '#C9A84C',
};

const TEMP_LABELS = {
  1: 'Still',
  2: 'Low',
  3: 'Medium',
  4: 'High',
  5: 'Peak',
};

function analyzePacing(chapters) {
  const withTemp = chapters.filter(c => c.emotional_temperature);
  if (withTemp.length < 3) return [];

  const flags = [];
  const temps = withTemp.map(c => c.emotional_temperature);

  for (let i = 0; i <= temps.length - 3; i++) {
    if (temps[i] >= 4 && temps[i+1] >= 4 && temps[i+2] >= 4) {
      flags.push({
        type: 'burnout_risk',
        label: 'Burnout risk',
        note: `${withTemp[i].title} through ${withTemp[i+2].title} — 3 consecutive high-intensity chapters. Reader may disengage.`,
        color: '#B85C38',
      });
      break;
    }
  }

  for (let i = 0; i <= temps.length - 3; i++) {
    if (temps[i] <= 2 && temps[i+1] <= 2 && temps[i+2] <= 2) {
      flags.push({
        type: 'drift_risk',
        label: 'Drift risk',
        note: `${withTemp[i].title} through ${withTemp[i+2].title} — 3 consecutive low-intensity chapters. Reader may lose the thread.`,
        color: '#7B5EA7',
      });
      break;
    }
  }

  for (let i = 0; i < temps.length - 1; i++) {
    if (temps[i] >= 4) {
      const nextTwo = temps.slice(i+1, i+3);
      if (nextTwo.every(t => t >= 4)) {
        flags.push({
          type: 'no_recovery',
          label: 'No recovery beat',
          note: `After ${withTemp[i].title} — no lower-intensity chapter follows. Readers need to breathe.`,
          color: '#8B6914',
        });
        break;
      }
    }
  }

  if (temps.length >= 3) {
    const lastThree = temps.slice(-3);
    if (lastThree[2] < lastThree[0]) {
      flags.push({
        type: 'finale_drop',
        label: 'Finale dropping',
        note: 'The final chapters are declining in intensity. The book should be building toward its close.',
        color: '#B85C38',
      });
    }
  }

  return flags;
}

export default function PacingArc({ chapters = [], onTemperatureChange }) {
  const [hovered,    setHovered]    = useState(null);
  const [editingId,  setEditingId]  = useState(null);

  const sorted = [...chapters].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  const flags  = analyzePacing(sorted);
  const maxTemp = 5;

  const W = 500;
  const H = 80;
  const PAD = 16;
  const plotW = W - PAD * 2;
  const plotH = H - PAD * 2;

  const points = sorted
    .filter(c => c.emotional_temperature)
    .map((c, i, arr) => {
      const x = PAD + (arr.length === 1 ? plotW / 2 : (i / (arr.length - 1)) * plotW);
      const y = PAD + plotH - ((c.emotional_temperature - 1) / (maxTemp - 1)) * plotH;
      return { x, y, chapter: c };
    });

  const pathD = points.length < 2 ? '' : points.map((p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }).join(' ');

  return (
    <div style={st.panel}>
      <div style={st.header}>
        <div style={st.title}>PACING ARC</div>
        <div style={st.sub}>Emotional temperature across all chapters. Set after approving each chapter.</div>
      </div>

      {points.length >= 2 ? (
        <div style={st.chartWrap}>
          <svg viewBox={`0 0 ${W} ${H}`} style={st.svg}>
            {[1,2,3,4,5].map(t => {
              const y = PAD + plotH - ((t - 1) / (maxTemp - 1)) * plotH;
              return (
                <line key={t} x1={PAD} y1={y} x2={W - PAD} y2={y}
                  stroke="rgba(30,25,20,0.05)" strokeWidth="1" />
              );
            })}
            {pathD && (
              <path d={pathD} fill="none"
                stroke="#C9A84C" strokeWidth="1.5"
                strokeOpacity="0.6" />
            )}
            {points.map((p, i) => (
              <g key={p.chapter.id}>
                <circle
                  cx={p.x} cy={p.y} r={hovered === p.chapter.id ? 5 : 3.5}
                  fill={PNOS_ACT_COLORS[p.chapter.pnos_act] || '#C9A84C'}
                  opacity={hovered === p.chapter.id ? 1 : 0.8}
                  style={{ cursor: 'pointer', transition: 'r 0.1s' }}
                  onMouseEnter={() => setHovered(p.chapter.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setEditingId(editingId === p.chapter.id ? null : p.chapter.id)}
                />
              </g>
            ))}
          </svg>
          <div style={st.yAxis}>
            {[5,4,3,2,1].map(t => (
              <div key={t} style={st.yLabel}>{TEMP_LABELS[t]}</div>
            ))}
          </div>
        </div>
      ) : (
        <div style={st.noData}>
          Set emotional temperature on approved chapters to see the arc.
        </div>
      )}

      <div style={st.chapterList}>
        {sorted.map(ch => {
          const temp = ch.emotional_temperature;
          const actColor = PNOS_ACT_COLORS[ch.pnos_act] || '#C9A84C';
          const isEditing = editingId === ch.id;
          return (
            <div
              key={ch.id}
              style={{
                ...st.chapterRow,
                background: isEditing ? 'rgba(201,168,76,0.04)' : 'transparent',
              }}
            >
              <div style={st.chapterLeft}>
                <div style={{ ...st.actDot, background: actColor }} />
                <div style={st.chapterTitle}>{ch.title}</div>
              </div>
              <div style={st.tempControls}>
                {[1,2,3,4,5].map(t => (
                  <button
                    key={t}
                    style={{
                      ...st.tempBtn,
                      background: temp >= t ? actColor : 'rgba(30,25,20,0.08)',
                      opacity:    temp >= t ? 1 : 0.4,
                    }}
                    onClick={() => {
                      const next = temp === t ? null : t;
                      onTemperatureChange?.(ch.id, next);
                    }}
                    title={TEMP_LABELS[t]}
                  />
                ))}
                {temp && (
                  <div style={{ ...st.tempLabel, color: actColor }}>
                    {TEMP_LABELS[temp]}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {flags.length > 0 && (
        <div style={st.flags}>
          <div style={st.flagsTitle}>PACING FLAGS</div>
          {flags.map((f, i) => (
            <div key={i} style={{ ...st.flag, borderLeftColor: f.color }}>
              <div style={{ ...st.flagLabel, color: f.color }}>{f.label}</div>
              <div style={st.flagNote}>{f.note}</div>
            </div>
          ))}
        </div>
      )}

      {flags.length === 0 && points.length >= 4 && (
        <div style={st.clean}>
          ✓ Pacing looks healthy — rise, dip, and recovery rhythm present.
        </div>
      )}
    </div>
  );
}

const st = {
  panel: {
    border: '1px solid rgba(30,25,20,0.1)',
    borderRadius: 3, overflow: 'hidden', background: 'white',
  },
  header: { padding: '12px 14px 8px', display: 'flex', flexDirection: 'column', gap: 3 },
  title: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    letterSpacing: '0.2em', color: '#C9A84C',
  },
  sub: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    color: 'rgba(30,25,20,0.35)', letterSpacing: '0.03em', lineHeight: 1.5,
  },
  chartWrap: {
    padding: '4px 14px 8px', display: 'flex', alignItems: 'stretch', gap: 8,
  },
  svg: { flex: 1, overflow: 'visible' },
  yAxis: {
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    paddingTop: 16, paddingBottom: 16,
  },
  yLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 7,
    color: 'rgba(30,25,20,0.22)', letterSpacing: '0.06em', lineHeight: 1,
  },
  noData: {
    padding: '16px 14px',
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    color: 'rgba(30,25,20,0.3)', letterSpacing: '0.04em',
  },
  chapterList: {
    borderTop: '1px solid rgba(30,25,20,0.06)',
    display: 'flex', flexDirection: 'column',
  },
  chapterRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '7px 14px', borderBottom: '1px solid rgba(30,25,20,0.04)',
    transition: 'background 0.1s',
  },
  chapterLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  actDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  chapterTitle: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 12.5, fontStyle: 'italic', color: 'rgba(30,25,20,0.7)',
  },
  tempControls: { display: 'flex', alignItems: 'center', gap: 4 },
  tempBtn: {
    width: 12, height: 12, borderRadius: '50%',
    border: 'none', cursor: 'pointer',
    transition: 'all 0.1s', padding: 0,
  },
  tempLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    letterSpacing: '0.08em', marginLeft: 4, minWidth: 32,
  },
  flags: {
    borderTop: '1px solid rgba(30,25,20,0.06)',
    padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8,
    background: 'rgba(255,252,248,0.8)',
  },
  flagsTitle: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    letterSpacing: '0.15em', color: 'rgba(30,25,20,0.3)',
  },
  flag: {
    borderLeft: '2px solid', paddingLeft: 8,
    display: 'flex', flexDirection: 'column', gap: 3,
  },
  flagLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    fontWeight: 600, letterSpacing: '0.08em',
  },
  flagNote: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    color: 'rgba(30,25,20,0.5)', letterSpacing: '0.03em', lineHeight: 1.55,
  },
  clean: {
    borderTop: '1px solid rgba(74,124,89,0.1)',
    padding: '8px 14px',
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    letterSpacing: '0.05em', color: '#4A7C59',
  },
};
