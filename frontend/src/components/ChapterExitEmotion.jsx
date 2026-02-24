/**
 * ChapterExitEmotion.jsx
 * frontend/src/components/ChapterExitEmotion.jsx
 *
 * CHAPTER EXIT EMOTION — what the reader feels on the last line.
 * Set BEFORE drafting. The generator shapes its last 3–5 lines toward this feeling.
 */

import { useState } from 'react';

const EXIT_EMOTIONS = [
  {
    id:    'unsettled_recognition',
    label: 'Unsettled recognition',
    note:  'They see themselves. They\'re not sure they like it.',
    acts:  ['act_1', 'act_2'],
    color: '#B85C38',
  },
  {
    id:    'quiet_ache',
    label: 'Quiet ache',
    note:  'Something tender was touched. No resolution. Just the feeling.',
    acts:  ['act_1', 'act_2', 'act_3'],
    color: '#7B5EA7',
  },
  {
    id:    'held_breath',
    label: 'Held breath',
    note:  'Something is about to happen. The reader can feel it but not name it yet.',
    acts:  ['act_2', 'act_3'],
    color: '#8B6914',
  },
  {
    id:    'permission',
    label: 'Permission',
    note:  'The reader exhales. Something they were afraid to want has been named.',
    acts:  ['act_3', 'act_4'],
    color: '#4A7C59',
  },
  {
    id:    'companionship',
    label: 'Companionship',
    note:  'They are not alone in this. That\'s all. That\'s enough.',
    acts:  ['act_1', 'act_2', 'act_3', 'act_4'],
    color: '#5B7FA6',
  },
  {
    id:    'earned_momentum',
    label: 'Earned momentum',
    note:  'Something shifted. Not fixed — shifted. The next chapter pulls.',
    acts:  ['act_3', 'act_4', 'act_5'],
    color: '#4A7C59',
  },
  {
    id:    'beautiful_incompleteness',
    label: 'Beautiful incompleteness',
    note:  'The chapter ended mid-thought. The reader carries it forward.',
    acts:  ['act_1', 'act_2', 'act_3'],
    color: '#C9A84C',
  },
  {
    id:    'weight',
    label: 'Weight',
    note:  'Something landed. The reader will think about this later.',
    acts:  ['act_2', 'act_4', 'act_5'],
    color: '#5B4A6B',
  },
];

export default function ChapterExitEmotion({ chapter, onExitChange }) {
  const [expanded,  setExpanded]  = useState(false);
  const [custom,    setCustom]    = useState(chapter?.exit_emotion_note || '');
  const [isCustom,  setIsCustom]  = useState(chapter?.exit_emotion === 'custom');

  const selectedId = chapter?.exit_emotion;
  const selected   = EXIT_EMOTIONS.find(e => e.id === selectedId);
  const activeAct  = chapter?.pnos_act || 'act_1';

  const relevant  = EXIT_EMOTIONS.filter(e => e.acts.includes(activeAct));
  const secondary = EXIT_EMOTIONS.filter(e => !e.acts.includes(activeAct));

  function handleSelect(emotion) {
    setIsCustom(false);
    onExitChange?.({ exit_emotion: emotion.id, exit_emotion_note: emotion.note });
  }

  function handleCustomSave() {
    if (!custom.trim()) return;
    onExitChange?.({ exit_emotion: 'custom', exit_emotion_note: custom.trim() });
  }

  return (
    <div style={st.panel}>
      <div style={st.header} onClick={() => setExpanded(!expanded)}>
        <div style={st.headerLeft}>
          <div style={st.eyebrow}>CHAPTER EXIT EMOTION</div>
          <div style={st.preview}>
            {selected
              ? `${selected.label} — ${selected.note}`
              : isCustom && custom
              ? custom
              : 'What does the reader feel on the last line?'}
          </div>
        </div>
        {(selected || (isCustom && custom)) && (
          <div style={{
            ...st.chip,
            color: selected?.color || '#C9A84C',
            borderColor: `${selected?.color || '#C9A84C'}40`,
            background: `${selected?.color || '#C9A84C'}0e`,
          }}>
            {selected?.label || 'Custom'}
          </div>
        )}
        <div style={st.caret}>{expanded ? '▲' : '▼'}</div>
      </div>

      {expanded && (
        <div style={st.body}>
          <div style={st.instruction}>
            Set this BEFORE drafting. The generator will shape the chapter's last 3–5 lines toward this feeling.
          </div>

          <div style={st.section}>
            <div style={st.sectionLabel}>FOR THIS ACT</div>
            <div style={st.emotionGrid}>
              {relevant.map(e => (
                <EmotionCard
                  key={e.id}
                  emotion={e}
                  isSelected={selectedId === e.id}
                  onSelect={() => handleSelect(e)}
                />
              ))}
            </div>
          </div>

          <div style={st.section}>
            <div style={st.sectionLabel}>OTHER OPTIONS</div>
            <div style={st.emotionGrid}>
              {secondary.map(e => (
                <EmotionCard
                  key={e.id}
                  emotion={e}
                  isSelected={selectedId === e.id}
                  onSelect={() => handleSelect(e)}
                  dimmed
                />
              ))}
            </div>
          </div>

          <div style={st.section}>
            <div style={st.sectionLabel}>WRITE YOUR OWN</div>
            <div style={st.customRow}>
              <textarea
                style={{ ...st.customInput, borderColor: isCustom && custom ? '#C9A84C' : 'rgba(30,25,20,0.12)' }}
                placeholder="The reader closes the chapter feeling..."
                value={custom}
                rows={2}
                onChange={e => {
                  setCustom(e.target.value);
                  setIsCustom(true);
                }}
              />
              <button
                style={{ ...st.customSave, opacity: custom.trim() ? 1 : 0.4 }}
                onClick={handleCustomSave}
                disabled={!custom.trim()}
              >
                Set →
              </button>
            </div>
          </div>

          {(selectedId || (isCustom && custom)) && (
            <button
              style={st.clearBtn}
              onClick={() => {
                setIsCustom(false);
                onExitChange?.({ exit_emotion: null, exit_emotion_note: null });
              }}
            >
              Clear exit emotion
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EmotionCard({ emotion, isSelected, onSelect, dimmed }) {
  return (
    <button
      style={{
        ...st.emotionCard,
        borderColor:  isSelected ? emotion.color : 'rgba(30,25,20,0.08)',
        background:   isSelected ? `${emotion.color}0e` : 'white',
        opacity:      dimmed && !isSelected ? 0.55 : 1,
      }}
      onClick={onSelect}
    >
      <div style={{ ...st.emotionLabel, color: isSelected ? emotion.color : 'rgba(30,25,20,0.65)' }}>
        {emotion.label}
      </div>
      <div style={st.emotionNote}>{emotion.note}</div>
    </button>
  );
}

const st = {
  panel: {
    border: '1px solid rgba(30,25,20,0.1)',
    borderRadius: 3, overflow: 'hidden', marginBottom: 10,
    background: 'white',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '10px 14px', cursor: 'pointer',
  },
  headerLeft: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
  eyebrow: {
    fontFamily: 'DM Mono, monospace', fontSize: 7,
    letterSpacing: '0.2em', color: 'rgba(30,25,20,0.3)',
  },
  preview: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 12.5, fontStyle: 'italic', color: 'rgba(30,25,20,0.55)', lineHeight: 1.4,
  },
  chip: {
    border: '1px solid', borderRadius: 20, flexShrink: 0,
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    letterSpacing: '0.08em', padding: '2px 8px', alignSelf: 'flex-start',
  },
  caret: { fontFamily: 'DM Mono, monospace', fontSize: 7, color: 'rgba(30,25,20,0.2)' },
  body: {
    borderTop: '1px solid rgba(30,25,20,0.06)',
    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12,
  },
  instruction: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    color: 'rgba(30,25,20,0.35)', letterSpacing: '0.03em', lineHeight: 1.6,
  },
  section: { display: 'flex', flexDirection: 'column', gap: 7 },
  sectionLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    letterSpacing: '0.15em', color: 'rgba(30,25,20,0.25)',
  },
  emotionGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  emotionCard: {
    border: '1px solid', borderRadius: 2,
    padding: '8px 10px', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', gap: 3,
    textAlign: 'left', transition: 'all 0.12s',
    maxWidth: 200, minWidth: 140,
  },
  emotionLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 8.5,
    fontWeight: 600, letterSpacing: '0.05em',
  },
  emotionNote: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 11, fontStyle: 'italic',
    color: 'rgba(30,25,20,0.4)', lineHeight: 1.4,
  },
  customRow: { display: 'flex', gap: 8, alignItems: 'flex-start' },
  customInput: {
    flex: 1, border: '1px solid', borderRadius: 2,
    padding: '8px 10px', resize: 'vertical',
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 12.5, fontStyle: 'italic',
    color: 'rgba(30,25,20,0.75)', lineHeight: 1.5, outline: 'none',
  },
  customSave: {
    background: '#C9A84C', border: 'none', borderRadius: 2,
    fontFamily: 'DM Mono, monospace', fontSize: 9,
    letterSpacing: '0.1em', color: 'white', fontWeight: 600,
    padding: '8px 14px', cursor: 'pointer', flexShrink: 0,
    transition: 'opacity 0.12s',
  },
  clearBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    letterSpacing: '0.08em', color: 'rgba(30,25,20,0.25)',
    textDecoration: 'underline', padding: 0, alignSelf: 'flex-start',
  },
};
