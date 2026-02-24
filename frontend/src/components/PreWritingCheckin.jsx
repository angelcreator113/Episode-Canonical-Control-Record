/**
 * PreWritingCheckin.jsx
 * frontend/src/components/PreWritingCheckin.jsx
 *
 * ════════════════════════════════════════════════════════════════════════
 * PRE-WRITING CHECK-IN PANEL
 * Lives inside the Book Editor, above the manuscript.
 * Triggered when the author opens a chapter.
 *
 * Flow:
 * 1. "Who's in this scene?" — character picker from registry
 * 2. Pick one → 5-exchange check-in with that character in their voice
 * 3. "You're ready. Go write the scene."
 * 4. Panel collapses. Manuscript opens.
 *
 * Also accessible as a standalone trigger — "Talk to a character"
 * button in the chapter header for any time during writing, not
 * just at the start.
 *
 * ════════════════════════════════════════════════════════════════════════
 * USAGE
 * ════════════════════════════════════════════════════════════════════════
 *
 * In StoryTeller.jsx / BookEditor.jsx, add above the chapter accordion:
 *
 *   import PreWritingCheckin from '../components/PreWritingCheckin';
 *
 *   <PreWritingCheckin
 *     characters={registryCharacters}
 *     chapterContext={chapter.scene_goal || chapter.title}
 *     onDismiss={() => setCheckinOpen(false)}
 *   />
 *
 * registryCharacters = array of character objects from Character Registry
 * chapterContext = chapter brief / scene goal string passed to voice mode
 */

import { useState } from 'react';
import CharacterVoiceMode from '../pages/CharacterVoiceMode';

function typeColor(type) {
  return {
    protagonist: '#C9A84C', pressure: '#B85C38', mirror: '#7B5EA7',
    support: '#4A7C59',     shadow:   '#8B6914', special: '#C9A84C',
  }[type] || '#C9A84C';
}

export default function PreWritingCheckin({
  characters = [],
  chapterContext = null,
  onDismiss,
}) {
  const [selected, setSelected]     = useState(null);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [completed, setCompleted]   = useState([]);  // ids of completed checkins

  // Filter to characters who have a profile (accepted or finalized)
  const eligible = characters.filter(c =>
    c.status === 'accepted' || c.status === 'finalized'
  );

  function handleSelect(char) {
    setSelected(char);
    setCheckinOpen(true);
  }

  function handleCheckinClose() {
    if (selected) setCompleted(prev => [...prev, selected.id]);
    setCheckinOpen(false);
    setSelected(null);
  }

  if (eligible.length === 0) return null;

  return (
    <>
      <div style={st.panel}>
        <div style={st.header}>
          <div style={st.headerLeft}>
            <div style={st.label}>WHO{'\u2019'}S IN THIS SCENE?</div>
            <div style={st.sub}>
              Talk to a character before writing. 5 exchanges to get inside their head.
            </div>
          </div>
          <button style={st.dismissBtn} onClick={onDismiss}>
            Skip {'\u2192'}
          </button>
        </div>

        <div style={st.characterGrid}>
          {eligible.map(char => {
            const name    = char.selected_name || char.display_name || char.name;
            const type    = char.role_type || 'special';
            const color   = typeColor(type);
            const done    = completed.includes(char.id);
            const locked  = char.status === 'finalized';

            return (
              <button
                key={char.id}
                style={{
                  ...st.charCard,
                  borderColor: done ? `${color}60` : `${color}25`,
                  background:  done ? `${color}10` : 'rgba(255,255,255,0.7)',
                  opacity:     1,
                }}
                onClick={() => handleSelect(char)}
              >
                {/* Type indicator dot */}
                <div style={{ ...st.typeDot, background: color }} />

                <div style={st.charName}>{name}</div>
                <div style={{ ...st.charType, color }}>{type}</div>

                {done && (
                  <div style={{ ...st.doneTag, color, borderColor: `${color}40` }}>
                    {'\u2713'} ready
                  </div>
                )}
                {locked && !done && (
                  <div style={st.lockedTag}>finalized</div>
                )}

                <div style={st.talkHint}>
                  {done ? 'Talk again' : 'Talk \u2192'}
                </div>
              </button>
            );
          })}
        </div>

        {completed.length > 0 && (
          <div style={st.readyRow}>
            <div style={st.readyText}>
              {completed.length === 1
                ? `You\u2019ve talked to ${eligible.find(c => c.id === completed[0])?.selected_name || 'them'}.`
                : `You\u2019ve talked to ${completed.length} characters.`
              } You{'\u2019'}re ready.
            </div>
            <button style={st.writeBtn} onClick={onDismiss}>
              Start writing {'\u2192'}
            </button>
          </div>
        )}
      </div>

      {/* Voice mode modal */}
      {selected && (
        <CharacterVoiceMode
          character={selected}
          mode="checkin"
          chapterContext={chapterContext}
          open={checkinOpen}
          onClose={handleCheckinClose}
        />
      )}
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const st = {
  panel: {
    background: '#FFF0F3',
    border: '1px solid rgba(219,112,147,0.18)',
    borderRadius: 6, padding: '16px 20px',
    marginBottom: 20,
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: {
    fontFamily: 'DM Mono, monospace', fontSize: 9,
    letterSpacing: '0.2em', color: 'rgba(180,80,120,0.7)',
  },
  sub: {
    fontFamily: 'DM Mono, monospace', fontSize: 9,
    color: 'rgba(100,40,60,0.4)', letterSpacing: '0.04em', lineHeight: 1.5,
  },
  dismissBtn: {
    background: 'none', border: 'none',
    fontFamily: 'DM Mono, monospace', fontSize: 9,
    letterSpacing: '0.1em', color: 'rgba(180,80,120,0.4)',
    cursor: 'pointer', padding: '2px 0',
  },
  characterGrid: {
    display: 'flex', flexWrap: 'wrap', gap: 8,
  },
  charCard: {
    position: 'relative',
    border: '1px solid', borderRadius: 4,
    padding: '10px 14px 10px 20px',
    cursor: 'pointer', textAlign: 'left',
    display: 'flex', flexDirection: 'column', gap: 3,
    minWidth: 130, transition: 'border-color 0.15s, background 0.15s',
    background: 'rgba(255,255,255,0.6)',
  },
  typeDot: {
    position: 'absolute', left: 8, top: 14,
    width: 5, height: 5, borderRadius: '50%',
  },
  charName: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 14, fontStyle: 'italic',
    color: 'rgba(60,30,40,0.85)', lineHeight: 1.3,
  },
  charType: {
    fontFamily: 'DM Mono, monospace', fontSize: 8.5, letterSpacing: '0.1em',
  },
  doneTag: {
    fontFamily: 'DM Mono, monospace', fontSize: 8, letterSpacing: '0.1em',
    border: '1px solid', borderRadius: 2, padding: '1px 6px',
    display: 'inline-block', marginTop: 3, alignSelf: 'flex-start',
  },
  lockedTag: {
    fontFamily: 'DM Mono, monospace', fontSize: 8, letterSpacing: '0.1em',
    color: 'rgba(100,40,60,0.35)', marginTop: 3,
  },
  talkHint: {
    fontFamily: 'DM Mono, monospace', fontSize: 8.5,
    color: 'rgba(180,80,120,0.4)', letterSpacing: '0.08em',
    marginTop: 4,
  },
  readyRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderTop: '1px solid rgba(219,112,147,0.15)', paddingTop: 12,
  },
  readyText: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 13, fontStyle: 'italic', color: 'rgba(100,40,60,0.6)',
  },
  writeBtn: {
    background: '#e8a0b0', border: 'none', borderRadius: 3,
    fontFamily: 'DM Mono, monospace', fontSize: 10,
    letterSpacing: '0.12em', color: '#fff', fontWeight: 600,
    padding: '8px 16px', cursor: 'pointer',
  },
};
