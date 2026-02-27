/**
 * WriteModeAIWriter.jsx
 * frontend/src/components/WriteModeAIWriter.jsx
 *
 * Character-aware AI Writer tab for WriteMode's right context panel.
 * Knows: current chapter, selected character, what's been written,
 *        the character's full registry profile.
 *
 * Props:
 *   chapterId: string
 *   bookId: string
 *   selectedCharacter: { id, name, selected_name, type, role,
 *                        belief_pressured, emotional_function, writer_notes }
 *   currentProse: string — current textarea content (last 500 chars used)
 *   chapterContext: { scene_goal, theme, emotional_arc_start, emotional_arc_end, pov }
 *   onInsert: function(text) — inserts generated text into the editor
 */

import { useState } from 'react';

const ACTIONS = [
  {
    id:       'continue',
    icon:     '→',
    label:    'Continue',
    sub:      'Write what happens next in their voice',
    endpoint: '/api/v1/memories/story-continue',
  },
  {
    id:       'dialogue',
    icon:     '“',
    label:    'Their next line',
    sub:      'What would they say right now',
    endpoint: '/api/v1/memories/ai-writer-action',
    action:   'dialogue',
  },
  {
    id:       'interior',
    icon:     '◌',
    label:    'Interior monologue',
    sub:      'What they are thinking but not saying',
    endpoint: '/api/v1/memories/ai-writer-action',
    action:   'interior',
  },
  {
    id:       'reaction',
    icon:     '↯',
    label:    'Their reaction',
    sub:      'How they respond to what just happened',
    endpoint: '/api/v1/memories/ai-writer-action',
    action:   'reaction',
  },
  {
    id:       'lala',
    icon:     '✦',
    label:    'Lala moment',
    sub:      'The intrusive thought she would never post',
    endpoint: '/api/v1/memories/ai-writer-action',
    action:   'lala',
    onlyFor:  ['special'], // only show for JustAWoman / Lala type characters
  },
];

const TYPE_COLORS = {
  pressure: '#B85C38',
  mirror:   '#9B7FD4',
  support:  '#4A9B6F',
  shadow:   '#E08C3A',
  special:  '#B8962E',
};

export default function WriteModeAIWriter({
  chapterId,
  bookId,
  selectedCharacter,
  currentProse,
  chapterContext,
  onInsert,
}) {
  const [activeAction, setActiveAction] = useState(null);
  const [result,       setResult]       = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);

  const accent   = TYPE_COLORS[selectedCharacter?.type] || '#B8962E';
  const charName = selectedCharacter?.selected_name || selectedCharacter?.name;

  // Filter actions — Lala moment only for special type
  const availableActions = ACTIONS.filter(a =>
    !a.onlyFor || a.onlyFor.includes(selectedCharacter?.type)
  );

  async function runAction(action) {
    if (!selectedCharacter) return;
    setActiveAction(action.id);
    setResult(null);
    setError(null);
    setLoading(true);

    // Build context payload
    const recentProse = currentProse
      ? currentProse.slice(-600)
      : '';

    const payload = {
      chapter_id:    chapterId,
      book_id:       bookId,
      character_id:  selectedCharacter.id,
      character:     {
        name:               charName,
        type:               selectedCharacter.type,
        role:               selectedCharacter.role,
        belief_pressured:   selectedCharacter.belief_pressured,
        emotional_function: selectedCharacter.emotional_function,
        writer_notes:       selectedCharacter.writer_notes,
      },
      recent_prose:  recentProse,
      chapter_context: chapterContext,
      action:        action.action || action.id,
      length:        'paragraph',
    };

    try {
      const res = await fetch(action.endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      const data = await res.json();

      // Handle standard response
      const text = data.content || data.continuation || data.text ||
                   data.result  || data.suggestion   || '';

      setResult(text);

    } catch (e) {
      setError('Generation failed. Try again.');
    }

    setLoading(false);
  }

  function handleInsert() {
    if (!result) return;
    onInsert?.(result);
    setResult(null);
    setActiveAction(null);
  }

  function handleDiscard() {
    setResult(null);
    setActiveAction(null);
  }

  // ── NO CHARACTER SELECTED ──────────────────────────────────────────
  if (!selectedCharacter) {
    return (
      <div style={s.empty}>
        <div style={s.emptyIcon}>{'◈'}</div>
        <div style={s.emptyText}>
          Select a character from the picker above to write in their voice.
        </div>
      </div>
    );
  }

  return (
    <div style={s.root}>

      {/* Character header */}
      <div style={s.charHeader}>
        <div style={{ ...s.charType, color: accent }}>
          {selectedCharacter.type}
        </div>
        <div style={s.charName}>{charName}</div>
        {selectedCharacter.belief_pressured && (
          <div style={s.charBelief}>
            &ldquo;{selectedCharacter.belief_pressured}&rdquo;
          </div>
        )}
      </div>

      {/* Action list */}
      {!result && (
        <div style={s.actions}>
          {availableActions.map(action => (
            <button
              key={action.id}
              style={{
                ...s.actionBtn,
                background:  activeAction === action.id && loading
                             ? `${accent}10` : 'transparent',
                borderColor: activeAction === action.id
                             ? accent : 'rgba(28,24,20,0.1)',
                opacity:     loading && activeAction !== action.id ? 0.4 : 1,
              }}
              onClick={() => runAction(action)}
              disabled={loading}
            >
              <span style={{ ...s.actionIcon, color: accent }}>
                {action.icon}
              </span>
              <div style={s.actionText}>
                <div style={s.actionLabel}>
                  {action.label}
                  {loading && activeAction === action.id && (
                    <span style={s.spinner}> {'◌'}</span>
                  )}
                </div>
                <div style={s.actionSub}>{action.sub}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={s.resultPanel}>
          <div style={s.resultHeader}>
            <div style={{ ...s.resultAction, color: accent }}>
              {availableActions.find(a => a.id === activeAction)?.label || 'Generated'}
            </div>
            <button style={s.discardBtn} onClick={handleDiscard}>{'✕'}</button>
          </div>

          <div style={s.resultText}>{result}</div>

          <div style={s.resultActions}>
            <button
              style={{ ...s.insertBtn, background: accent }}
              onClick={handleInsert}
            >
              Insert into manuscript
            </button>
            <button style={s.tryAgainBtn} onClick={() => {
              const action = availableActions.find(a => a.id === activeAction);
              if (action) runAction(action);
            }}>
              Try again
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={s.error}>{error}</div>
      )}

    </div>
  );
}


// ── STYLES ────────────────────────────────────────────────────────────

const INK       = '#1C1814';
const INK_MID   = 'rgba(28,24,20,0.5)';
const INK_LIGHT = 'rgba(28,24,20,0.25)';
const PARCHMENT = '#FAF7F0';

const s = {
  root: {
    display:       'flex',
    flexDirection: 'column',
    height:        '100%',
    overflow:      'hidden',
  },

  // No character
  empty: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '32px 16px',
    gap:            12,
    textAlign:      'center',
    flex:           1,
  },
  emptyIcon: {
    fontSize: 22,
    color:    INK_LIGHT,
  },
  emptyText: {
    fontFamily: "'Lora', Georgia, serif",
    fontStyle:  'italic',
    fontSize:   12,
    color:      INK_MID,
    lineHeight: 1.6,
    maxWidth:   200,
  },

  // Character header
  charHeader: {
    padding:      '12px 14px',
    borderBottom: '1px solid rgba(28,24,20,0.08)',
  },
  charType: {
    fontSize:      7.5,
    letterSpacing: '0.15em',
    marginBottom:  4,
    fontFamily:    "'DM Mono', monospace",
  },
  charName: {
    fontFamily:   "'Cormorant Garamond', Georgia, serif",
    fontSize:     16,
    color:        INK,
    marginBottom: 4,
  },
  charBelief: {
    fontFamily: "'Lora', Georgia, serif",
    fontStyle:  'italic',
    fontSize:   10,
    color:      INK_MID,
    lineHeight: 1.5,
  },

  // Actions
  actions: {
    display:       'flex',
    flexDirection: 'column',
    padding:       '8px 0',
    overflowY:     'auto',
    flex:          1,
  },
  actionBtn: {
    display:     'flex',
    gap:         10,
    padding:     '10px 14px',
    border:      'none',
    borderLeft:  '2px solid',
    cursor:      'pointer',
    textAlign:   'left',
    transition:  'all 0.12s ease',
    marginBottom: 1,
  },
  actionIcon: {
    fontSize:   16,
    lineHeight: 1,
    flexShrink: 0,
    marginTop:  2,
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    width:      18,
    textAlign:  'center',
  },
  actionText: {
    flex: 1,
  },
  actionLabel: {
    fontSize:      11,
    color:         INK,
    letterSpacing: '0.02em',
    marginBottom:  2,
    fontFamily:    "'DM Mono', monospace",
  },
  actionSub: {
    fontSize:   9,
    color:      INK_MID,
    lineHeight: 1.4,
    fontFamily: "'Lora', Georgia, serif",
    fontStyle:  'italic',
  },
  spinner: {
    opacity: 0.5,
  },

  // Result
  resultPanel: {
    flex:          1,
    display:       'flex',
    flexDirection: 'column',
    padding:       '12px 14px',
    gap:           10,
    overflowY:     'auto',
  },
  resultHeader: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  resultAction: {
    fontSize:      8,
    letterSpacing: '0.15em',
    fontFamily:    "'DM Mono', monospace",
  },
  discardBtn: {
    background: 'none',
    border:     'none',
    color:      INK_LIGHT,
    fontSize:   12,
    cursor:     'pointer',
    padding:    '2px 4px',
  },
  resultText: {
    fontFamily:  "'Lora', Georgia, serif",
    fontStyle:   'italic',
    fontSize:    13,
    color:       INK,
    lineHeight:  1.8,
    flex:        1,
    padding:     '10px 12px',
    background:  'rgba(28,24,20,0.03)',
    borderRadius: 3,
    border:      '1px solid rgba(28,24,20,0.08)',
  },
  resultActions: {
    display:       'flex',
    flexDirection: 'column',
    gap:           6,
  },
  insertBtn: {
    border:        'none',
    borderRadius:  3,
    padding:       '10px',
    color:         PARCHMENT,
    fontSize:      9,
    letterSpacing: '0.1em',
    cursor:        'pointer',
    fontFamily:    "'DM Mono', monospace",
  },
  tryAgainBtn: {
    background:    'none',
    border:        '1px solid rgba(28,24,20,0.1)',
    borderRadius:  3,
    padding:       '8px',
    color:         INK_MID,
    fontSize:      9,
    letterSpacing: '0.08em',
    cursor:        'pointer',
    fontFamily:    "'DM Mono', monospace",
  },

  // Error
  error: {
    padding:    '10px 14px',
    fontSize:   10,
    color:      '#B85C38',
    fontStyle:  'italic',
    fontFamily: "'Lora', Georgia, serif",
  },
};
