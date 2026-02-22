/**
 * NarrativeIntelligence.jsx
 * frontend/src/pages/NarrativeIntelligence.jsx
 *
 * Inline writing co-pilot. Reads last 10 lines + chapter brief,
 * surfaces suggestions every 5-6 lines.
 *
 * Suggestion types:
 * - continuation  : where the scene could go next
 * - line          : actual prose in JustAWoman's voice
 * - character_cue : a character is overdue to appear
 * - sensory       : scene needs physical grounding
 * - lala          : Lala proto-voice conditions detected
 */

import { useState, useEffect, useRef } from 'react';

const MEMORIES_API    = '/api/v1/memories';
const STORYTELLER_API = '/api/v1/storyteller';

// Suggestion type config
const TYPE_CONFIG = {
  continuation: {
    label:  'WHERE TO NEXT',
    color:  '#6E8BB5',
    icon:   '→',
    bg:     'rgba(110,139,181,0.05)',
    border: 'rgba(110,139,181,0.12)',
  },
  line: {
    label:  'LINE SUGGESTION',
    color:  '#7A9B7E',
    icon:   '✎',
    bg:     'rgba(122,155,126,0.05)',
    border: 'rgba(122,155,126,0.15)',
  },
  character_cue: {
    label:  'CHARACTER CUE',
    color:  '#B8A468',
    icon:   '◈',
    bg:     'rgba(184,164,104,0.05)',
    border: 'rgba(198,168,94,0.15)',
  },
  sensory: {
    label:  'GROUND THE SCENE',
    color:  '#9484B3',
    icon:   '◉',
    bg:     'rgba(148,132,179,0.05)',
    border: 'rgba(148,132,179,0.12)',
  },
  lala: {
    label:  '✦ LALA MOMENT',
    color:  '#C6A85E',
    icon:   '✦',
    bg:     'rgba(198,168,94,0.06)',
    border: 'rgba(198,168,94,0.2)',
  },
};

export default function NarrativeIntelligence({
  chapter,
  lines,
  lineIndex,
  book,
  characters,
  onAccept,
}) {
  const [suggestion, setSuggestion]   = useState(null);
  const [loading, setLoading]         = useState(false);
  const [dismissed, setDismissed]     = useState(false);
  const [copied, setCopied]           = useState(false);
  const [accepting, setAccepting]     = useState(false);
  const [expanded, setExpanded]       = useState(false);
  const hasFetched = useRef(false);

  // Auto-fetch when component mounts
  useEffect(() => {
    if (hasFetched.current) return;
    if (lines.length < 3) return; // need at least 3 lines to analyze
    hasFetched.current = true;
    fetchSuggestion();
  }, []);

  async function fetchSuggestion() {
    setLoading(true);
    setDismissed(false);
    setSuggestion(null);
    try {
      // Last 10 lines
      const recentLines = lines
        .slice(Math.max(0, lineIndex - 9), lineIndex + 1)
        .map(l => l.content || l.text || '')
        .filter(Boolean);

      const res = await fetch(`${MEMORIES_API}/narrative-intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id:       book.id,
          chapter_id:    chapter.id,
          chapter_brief: {
            title:                 chapter.title,
            theme:                 chapter.theme,
            scene_goal:            chapter.scene_goal,
            emotional_state_start: chapter.emotional_state_start,
            emotional_state_end:   chapter.emotional_state_end,
            pov:                   chapter.pov || 'first_person',
            chapter_notes:         chapter.chapter_notes,
          },
          recent_lines:  recentLines,
          line_count:    lines.length,
          characters:    characters.map(c => ({
            name: c.name || c.display_name,
            type: c.type || c.role_type,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuggestion(data.suggestion);
      setExpanded(true);
    } catch (err) {
      console.error('NarrativeIntelligence fetch error:', err);
      // Fail silently — don't interrupt writing
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    if (!suggestion?.line_suggestion) return;
    setAccepting(true);
    try {
      const res = await fetch(
        `${STORYTELLER_API}/chapters/${chapter.id}/lines`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text:        suggestion.line_suggestion,
            source_tags: 'narrative_intelligence',
            group_label: `AI suggestion after line ${lineIndex + 1}`,
            status:      'pending',
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onAccept?.(data.line);
      setDismissed(true);
    } catch (err) {
      console.error('Accept suggestion error:', err);
    } finally {
      setAccepting(false);
    }
  }

  function handleCopy() {
    const text = suggestion?.line_suggestion || suggestion?.suggestion;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (dismissed) return null;

  if (loading) {
    return (
      <div style={s.loadingRow}>
        <div style={s.loadingDots}>
          {[0,1,2].map(i => (
            <span key={i} style={{
              ...s.loadingDot,
              animationDelay: `${i * 0.2}s`,
            }} />
          ))}
        </div>
        <span style={s.loadingText}>Reading your lines…</span>
      </div>
    );
  }

  if (!suggestion) return null;

  const config = TYPE_CONFIG[suggestion.type] || TYPE_CONFIG.continuation;
  const hasLineSuggestion = !!(suggestion.line_suggestion);

  return (
    <div style={{
      ...s.card,
      background: config.bg,
      borderColor: config.border,
    }}>

      {/* Header */}
      <div style={s.cardHeader} onClick={() => setExpanded(!expanded)}>
        <div style={s.cardHeaderLeft}>
          <span style={{ ...s.typeIcon, color: config.color }}>{config.icon}</span>
          <span style={{ ...s.typeLabel, color: config.color }}>{config.label}</span>
        </div>
        <div style={s.cardHeaderRight}>
          <button
            style={s.dismissBtn}
            onClick={e => { e.stopPropagation(); setDismissed(true); }}
            title='Dismiss'
          >
            ✕
          </button>
          <button
            style={s.refreshBtn}
            onClick={e => { e.stopPropagation(); hasFetched.current = false; fetchSuggestion(); }}
            title='Get different suggestion'
          >
            ↺
          </button>
          <span style={s.expandIcon}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={s.cardBody}>

          {/* Main suggestion text */}
          <div style={s.suggestionText}>
            {suggestion.suggestion}
          </div>

          {/* Line suggestion — actual prose */}
          {hasLineSuggestion && (
            <div style={s.lineSuggestion}>
              <div style={s.lineSuggestionLabel}>IN HER VOICE</div>
              <div style={s.lineSuggestionText}>
                "{suggestion.line_suggestion}"
              </div>

              <div style={s.lineActions}>
                <button
                  style={s.copyBtn}
                  onClick={handleCopy}
                >
                  {copied ? '✓ Copied' : 'Copy to edit'}
                </button>
                <button
                  style={{
                    ...s.acceptBtn,
                    opacity: accepting ? 0.6 : 1,
                  }}
                  onClick={handleAccept}
                  disabled={accepting}
                >
                  {accepting ? 'Adding…' : '+ Add as pending line'}
                </button>
              </div>
            </div>
          )}

          {/* Character cue details */}
          {suggestion.type === 'character_cue' && suggestion.character && (
            <div style={s.characterCue}>
              <span style={s.cueCharName}>{suggestion.character}</span>
              <span style={s.cueCharRole}>{suggestion.character_role}</span>
            </div>
          )}

          {/* Lala moment — special styling */}
          {suggestion.type === 'lala' && (
            <div style={s.lalaBlock}>
              <div style={s.lalaLabel}>LALA PROTO-VOICE</div>
              <div style={s.lalaHint}>
                She's been circling this thought. One intrusive voice — confident, not afraid. Different from the doubt.
              </div>
              {suggestion.lala_line && (
                <div style={s.lalaLine}>"{suggestion.lala_line}"</div>
              )}
            </div>
          )}

          {/* What to do hint */}
          {suggestion.what_to_do && (
            <div style={s.whatToDo}>{suggestion.what_to_do}</div>
          )}

        </div>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = {
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    margin: '8px 0',
  },
  loadingDots: {
    display: 'flex',
    gap: 4,
  },
  loadingDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: 'rgba(198,168,94,0.35)',
    display: 'inline-block',
    animation: 'pulse 1.2s ease-in-out infinite',
  },
  loadingText: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: 'rgba(30,25,20,0.3)',
    letterSpacing: '0.08em',
  },
  card: {
    border: '1px solid',
    borderRadius: 3,
    margin: '12px 0',
    overflow: 'hidden',
    transition: 'all 0.15s',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 14px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  cardHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  cardHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  typeIcon: {
    fontSize: 13,
    fontWeight: 600,
  },
  typeLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.16em',
    fontWeight: 600,
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(30,25,20,0.25)',
    fontSize: 13,
    cursor: 'pointer',
    padding: '2px 4px',
    lineHeight: 1,
  },
  refreshBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(30,25,20,0.25)',
    fontSize: 12,
    cursor: 'pointer',
    padding: '2px 4px',
    lineHeight: 1,
  },
  expandIcon: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'rgba(30,25,20,0.2)',
  },
  cardBody: {
    padding: '0 14px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    borderTop: '1px solid rgba(30,25,20,0.06)',
    paddingTop: 12,
  },
  suggestionText: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 13,
    color: 'rgba(30,25,20,0.65)',
    letterSpacing: '0.03em',
    lineHeight: 1.6,
  },
  lineSuggestion: {
    background: 'rgba(255,255,255,0.6)',
    border: '1px solid rgba(30,25,20,0.08)',
    borderRadius: 2,
    padding: '10px 12px',
  },
  lineSuggestionLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.18em',
    color: 'rgba(30,25,20,0.3)',
    marginBottom: 6,
  },
  lineSuggestionText: {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 15,
    fontStyle: 'italic',
    color: 'rgba(47,42,38,0.78)',
    lineHeight: 1.7,
    marginBottom: 10,
  },
  lineActions: {
    display: 'flex',
    gap: 8,
  },
  copyBtn: {
    background: 'none',
    border: '1px solid rgba(30,25,20,0.15)',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    letterSpacing: '0.08em',
    color: 'rgba(30,25,20,0.45)',
    padding: '5px 10px',
    cursor: 'pointer',
    transition: 'all 0.12s',
  },
  acceptBtn: {
    background: '#7A9B7E',
    border: 'none',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    letterSpacing: '0.08em',
    color: 'white',
    padding: '5px 12px',
    cursor: 'pointer',
    transition: 'opacity 0.12s',
  },
  characterCue: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  cueCharName: {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 13,
    fontStyle: 'italic',
    color: '#B8A468',
  },
  cueCharRole: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'rgba(30,25,20,0.3)',
    letterSpacing: '0.06em',
  },
  lalaBlock: {
    background: 'rgba(198,168,94,0.04)',
    border: '1px solid rgba(198,168,94,0.15)',
    borderRadius: 2,
    padding: '10px 12px',
  },
  lalaLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.2em',
    color: '#C6A85E',
    marginBottom: 6,
  },
  lalaHint: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: 'rgba(30,25,20,0.4)',
    lineHeight: 1.5,
    letterSpacing: '0.03em',
    marginBottom: 8,
  },
  lalaLine: {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 15,
    fontStyle: 'italic',
    color: '#C6A85E',
    lineHeight: 1.5,
  },
  whatToDo: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: 'rgba(30,25,20,0.35)',
    letterSpacing: '0.04em',
    lineHeight: 1.5,
    fontStyle: 'italic',
    borderTop: '1px solid rgba(30,25,20,0.06)',
    paddingTop: 8,
  },
};
