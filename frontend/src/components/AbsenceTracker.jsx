/**
 * AbsenceTracker.jsx
 * frontend/src/components/AbsenceTracker.jsx
 *
 * ABSENCE TRACKER — characters whose disappearance is the story.
 * Tracks The Almost-Mentor and The Digital Products Customer.
 * Flags when absence windows are open or overdue.
 */

import { useState } from 'react';
import { CHARACTER_APPEARANCE_RULES } from '../data/characterAppearanceRules';

const ABSENCE_TRACKED = [
  {
    id:             'the_almost_mentor',
    name:           'The Almost-Mentor',
    color:          '#8B6914',
    rule:           'Appears once. Their absence teaches more than their presence.',
    ideal_window:   { min: 3, max: 4 },
    absence_prompt: 'JustAWoman notices the silence where the guidance was. Nobody came to save her. That was the lesson.',
  },
  {
    id:             'the_digital_products_customer',
    name:           'The Digital Products Customer',
    color:          '#5B7FA6',
    rule:           'One brief appearance. Their weight lands 3 acts later (Act IV).',
    ideal_window:   { min: 8, max: 15 },
    absence_prompt: 'The memory of the one person who believed in the product more than she did.',
  },
];

export default function AbsenceTracker({ chapters = [], currentChapterId, onAcknowledge }) {
  const [expanded, setExpanded] = useState(true);

  const sorted = [...chapters].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  const currentIdx = sorted.findIndex(c => c.id === currentChapterId);

  const statuses = ABSENCE_TRACKED.map(tracked => {
    const lastAppearanceIdx = sorted.reduce((last, ch, idx) => {
      const present = ch.characters_present || [];
      return present.includes(tracked.id) ? idx : last;
    }, -1);

    if (lastAppearanceIdx === -1) {
      return { ...tracked, status: 'not_yet_appeared', chaptersAgo: null, lastChapter: null };
    }

    const lastChapter  = sorted[lastAppearanceIdx];
    const chaptersAgo  = currentIdx > lastAppearanceIdx ? currentIdx - lastAppearanceIdx : 0;

    const absenceAcknowledged = sorted.slice(lastAppearanceIdx + 1, currentIdx + 1)
      .some(ch => (ch.chapter_notes || '').toLowerCase().includes(tracked.id.replace(/_/g, ' ')));

    const { min, max } = tracked.ideal_window;
    let urgency = 'waiting';
    if (chaptersAgo >= min && chaptersAgo <= max && !absenceAcknowledged) urgency = 'window_open';
    if (chaptersAgo > max && !absenceAcknowledged) urgency = 'overdue';
    if (absenceAcknowledged) urgency = 'acknowledged';

    return {
      ...tracked,
      status:               'appeared',
      chaptersAgo,
      lastChapter,
      lastAppearanceIdx,
      absenceAcknowledged,
      urgency,
    };
  }).filter(s => s.status !== 'not_yet_appeared');

  if (statuses.length === 0) return null;

  const hasFlag = statuses.some(s => s.urgency === 'overdue' || s.urgency === 'window_open');

  return (
    <div style={st.panel}>
      <div style={st.header} onClick={() => setExpanded(!expanded)}>
        <div style={st.headerLeft}>
          <div style={st.eyebrow}>ABSENCE TRACKER</div>
          <div style={st.sub}>Characters whose disappearance is the story</div>
        </div>
        <div style={st.right}>
          {hasFlag && <div style={st.flag}>!</div>}
          <div style={st.caret}>{expanded ? '▲' : '▼'}</div>
        </div>
      </div>

      {expanded && (
        <div style={st.body}>
          {statuses.map(s => (
            <AbsenceCard
              key={s.id}
              tracked={s}
              onAcknowledge={() => onAcknowledge?.(s.id, s.lastChapter?.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AbsenceCard({ tracked, onAcknowledge }) {
  const urgencyConfig = {
    waiting:      { color: 'rgba(30,25,20,0.25)', label: 'Not yet' },
    window_open:  { color: '#C9A84C',             label: 'Window open' },
    overdue:      { color: '#B85C38',             label: 'Overdue' },
    acknowledged: { color: '#4A7C59',             label: 'Acknowledged' },
  };

  const uc = urgencyConfig[tracked.urgency] || urgencyConfig.waiting;

  return (
    <div style={{ ...st.card, borderLeftColor: tracked.color }}>
      <div style={st.cardTop}>
        <div style={st.cardName}>{tracked.name}</div>
        <div style={{ ...st.urgencyBadge, color: uc.color, borderColor: `${uc.color}40`, background: `${uc.color}0e` }}>
          {uc.label}
        </div>
      </div>

      <div style={st.cardRule}>{tracked.rule}</div>

      {tracked.lastChapter && (
        <div style={st.cardMeta}>
          <span style={st.metaLabel}>Last appeared: </span>
          {tracked.lastChapter.title}
          {tracked.chaptersAgo > 0 && (
            <span style={{ color: uc.color }}> · {tracked.chaptersAgo} chapter{tracked.chaptersAgo !== 1 ? 's' : ''} ago</span>
          )}
        </div>
      )}

      {tracked.urgency === 'window_open' && (
        <div style={st.windowNote}>
          The absence window is open. Now is the right time for the absence to land in the prose.
          <br/>{tracked.absence_prompt}
        </div>
      )}

      {tracked.urgency === 'overdue' && (
        <div style={{ ...st.windowNote, borderColor: 'rgba(184,92,56,0.2)', background: 'rgba(184,92,56,0.04)', color: 'rgba(30,25,20,0.6)' }}>
          The absence window passed without acknowledgment. Consider surfacing it in the next chapter.
          <br/>{tracked.absence_prompt}
        </div>
      )}

      {(tracked.urgency === 'window_open' || tracked.urgency === 'overdue') && (
        <button style={{ ...st.acknowledgeBtn, borderColor: tracked.color, color: tracked.color }} onClick={onAcknowledge}>
          Plant absence echo in current chapter →
        </button>
      )}

      {tracked.urgency === 'acknowledged' && (
        <div style={st.acknowledgedNote}>✓ Absence acknowledged in manuscript</div>
      )}
    </div>
  );
}

const st = {
  panel: {
    border: '1px solid rgba(30,25,20,0.1)',
    borderRadius: 3, overflow: 'hidden', background: 'white',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '10px 14px', cursor: 'pointer',
  },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: 3 },
  eyebrow: {
    fontFamily: 'DM Mono, monospace', fontSize: 7,
    letterSpacing: '0.2em', color: 'rgba(30,25,20,0.3)',
  },
  sub: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    color: 'rgba(30,25,20,0.4)', letterSpacing: '0.03em',
  },
  right: { display: 'flex', alignItems: 'center', gap: 8 },
  flag: {
    width: 18, height: 18, borderRadius: '50%',
    background: '#B85C38', color: 'white',
    fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  caret: { fontFamily: 'DM Mono, monospace', fontSize: 7, color: 'rgba(30,25,20,0.2)' },
  body: {
    borderTop: '1px solid rgba(30,25,20,0.06)',
    padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10,
  },
  card: {
    borderLeft: '2px solid', paddingLeft: 10,
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardName: {
    fontFamily: 'DM Mono, monospace', fontSize: 9,
    fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(30,25,20,0.7)',
  },
  urgencyBadge: {
    border: '1px solid', borderRadius: 20,
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    letterSpacing: '0.08em', padding: '2px 7px',
  },
  cardRule: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 12, fontStyle: 'italic', color: 'rgba(30,25,20,0.55)', lineHeight: 1.5,
  },
  cardMeta: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    color: 'rgba(30,25,20,0.35)', letterSpacing: '0.04em',
  },
  metaLabel: { color: 'rgba(30,25,20,0.22)' },
  windowNote: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    color: 'rgba(30,25,20,0.55)', letterSpacing: '0.03em', lineHeight: 1.6,
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 2, padding: '7px 9px',
    background: 'rgba(201,168,76,0.04)',
  },
  acknowledgeBtn: {
    background: 'none', border: '1px solid',
    borderRadius: 2, cursor: 'pointer',
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    letterSpacing: '0.08em', padding: '5px 10px',
    alignSelf: 'flex-start', transition: 'all 0.12s',
  },
  acknowledgedNote: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    letterSpacing: '0.05em', color: '#4A7C59',
  },
};
