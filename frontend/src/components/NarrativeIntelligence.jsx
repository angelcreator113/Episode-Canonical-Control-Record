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
import apiClient from '../services/api';

const MEMORIES_API    = '/api/v1/memories';
const STORYTELLER_API = '/api/v1/storyteller';

// ─── Track 6 CP9 module-scope helpers (Pattern F prophylactic — Api suffix) ───
// 5 helpers covering 5 fetch sites. addChapterLineApi covers 2 sites
// (single-line accept + per-line in intimate-scene loop). Per v2.15 §9.11
// existing-test-file convention: NarrativeIntelligence is mocked in CP3
// WriteMode.test.jsx as `{ default: () => null }` (default-export-only
// suppression); new named exports here do NOT conflict because WriteMode
// imports only the default.
export const listWorldCharactersByBookApi = (bookId) =>
  apiClient.get(`/api/v1/world/characters?book_id=${bookId}`);
export const requestNarrativeIntelligenceApi = (payload) =>
  apiClient.post(`${MEMORIES_API}/narrative-intelligence`, payload);
export const generateIntimateSceneApi = (payload) =>
  apiClient.post(`${MEMORIES_API}/generate-intimate-scene`, payload);
export const addChapterLineApi = (chapterId, payload) =>
  apiClient.post(`${STORYTELLER_API}/chapters/${chapterId}/lines`, payload);

// Suggestion type config. Each type is a token family (theme batch 6,
// 2026-10-05): color the label and icon (4.5:1 on its bg and on white), bg
// the card wash, border its line. The old muted hexes were 2.1-3.8:1 on parchment.
const TYPE_CONFIG = {
  continuation: {
    label:  'WHERE TO NEXT',
    color:  'var(--info-text)',
    icon:   '→',
    bg:     'var(--info-bg)',
    border: 'var(--info-border)',
  },
  line: {
    label:  'LINE SUGGESTION',
    color:  'var(--success-text)',
    icon:   '✎',
    bg:     'var(--success-bg)',
    border: 'var(--success-border)',
  },
  character_cue: {
    label:  'CHARACTER CUE',
    color:  'var(--warning-text)',
    icon:   '◈',
    bg:     'var(--warning-bg)',
    border: 'var(--warning-border)',
  },
  sensory: {
    label:  'GROUND THE SCENE',
    color:  'var(--lala-lavender-text)',
    icon:   '◉',
    bg:     'var(--lala-lavender-soft)',
    border: 'var(--lala-lavender-line)',
  },
  lala: {
    label:  '✦ LALA MOMENT',
    color:  'var(--lala-gold-text)',
    icon:   '✦',
    bg:     'var(--lala-gold-soft)',
    border: 'var(--lala-gold-line)',
  },
  intimate_scene_trigger: {
    label:  '♡ INTIMATE TRIGGER',
    color:  'var(--accent-dark)',
    icon:   '♡',
    bg:     'var(--accent-subtle)',
    border: 'var(--accent-light)',
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
  const [worldChars, setWorldChars]   = useState([]);
  const [intimateTrigger, setIntimateTrigger] = useState(null);
  const [generatingScene, setGeneratingScene] = useState(false);
  const hasFetched = useRef(false);

  // Load world characters for intimacy-trigger detection
  useEffect(() => {
    if (!book?.id) return;
    listWorldCharactersByBookApi(book.id)
      .then(res => setWorldChars(res.data?.characters || res.data || []))
      .catch(() => {});
  }, [book?.id]);

  // Auto-fetch when component mounts
  useEffect(() => {
    if (hasFetched.current) return;
    if (lines.length < 3) return; // need at least 3 lines to analyze
    hasFetched.current = true;
    fetchSuggestion();
  }, []);

  /* ── Intimacy trigger detection ───────────────────────────────────── */
  function checkIntimacyTrigger(recentLines) {
    if (!worldChars.length) return;
    const recentText = recentLines.join(' ').toLowerCase();
    // Find world characters mentioned in the recent manuscript lines
    const mentioned = worldChars.filter(wc => {
      const name = (wc.name || wc.display_name || '').toLowerCase();
      return name && recentText.includes(name);
    });
    if (mentioned.length === 0) return;

    // Check for tension / intimacy keywords in recent text
    const tensionWords = [
      'close', 'breath', 'skin', 'lips', 'touch', 'heat',
      'pulse', 'tension', 'pull', 'lean', 'whisper', 'eye',
      'alone', 'dark', 'night', 'room', 'bed', 'door',
    ];
    const tensionHits = tensionWords.filter(w => recentText.includes(w)).length;
    if (tensionHits < 2) return; // need at least 2 tension signals

    // Pick the strongest candidate (prefer characters with attracted_to / intimate_style set)
    const ranked = mentioned
      .filter(c => c.attracted_to || c.intimate_style || c.intimate_dynamic)
      .sort((a, b) => {
        const score = c => (c.attracted_to ? 1 : 0) + (c.intimate_style ? 1 : 0) + (c.intimate_dynamic ? 1 : 0);
        return score(b) - score(a);
      });
    const candidate = ranked[0] || mentioned[0];

    setIntimateTrigger({
      character:  candidate,
      tension:    tensionHits,
      scene_type: tensionHits >= 5 ? 'first_encounter' : 'charged_moment',
    });
  }

  async function fetchSuggestion() {
    if (!book || !chapter) return;
    setLoading(true);
    setDismissed(false);
    setSuggestion(null);
    try {
      // Last 10 lines
      const recentLines = lines
        .slice(Math.max(0, lineIndex - 9), lineIndex + 1)
        .map(l => l.content || l.text || '')
        .filter(Boolean);

      const res = await requestNarrativeIntelligenceApi({
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
        characters:    (characters || []).map(c => ({
          name: c.name || c.display_name,
          type: c.type || c.role_type,
        })),
      });
      const data = res.data;
      setSuggestion(data.suggestion);
      setExpanded(true);

      // Check for intimacy trigger after NI fetch
      checkIntimacyTrigger(recentLines);
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
      const res = await addChapterLineApi(chapter.id, {
        text:        suggestion.line_suggestion,
        source_tags: ['narrative_intelligence'],
        group_label: `AI suggestion after line ${lineIndex + 1}`,
        status:      'pending',
      });
      onAccept?.(res.data?.line);
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

  /* ── Generate intimate scene via memories patch ───────────────────── */
  async function handleGenerateIntimateScene() {
    if (!intimateTrigger?.character) return;
    setGeneratingScene(true);
    try {
      const recentLines = lines
        .slice(Math.max(0, lineIndex - 9), lineIndex + 1)
        .map(l => l.content || l.text || '')
        .filter(Boolean);

      const res = await generateIntimateSceneApi({
        chapter_id:   chapter.id,
        character_id: intimateTrigger.character.id,
        scene_type:   intimateTrigger.scene_type || 'charged_moment',
        career_stage: intimateTrigger.character.career_stage || 'early_career',
        recent_lines: recentLines,
        chapter_brief: {
          title:                 chapter.title,
          theme:                 chapter.theme,
          scene_goal:            chapter.scene_goal,
          emotional_state_start: chapter.emotional_state_start,
          emotional_state_end:   chapter.emotional_state_end,
        },
      });
      const data = res.data;

      // Accept all generated lines into the chapter as pending
      if (data.lines?.length) {
        for (const line of data.lines) {
          await addChapterLineApi(chapter.id, {
            text:        line.content || line.text,
            source_tags: ['intimate_scene', intimateTrigger.character.name],
            group_label: `Intimate scene — ${intimateTrigger.character.name}`,
            status:      'pending',
          });
        }
        onAccept?.({ count: data.lines.length, type: 'intimate_scene' });
      }
      setIntimateTrigger(null);
    } catch (err) {
      console.error('Intimate scene generation error:', err);
    } finally {
      setGeneratingScene(false);
    }
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

      {/* ── Intimate scene trigger card ──────────────────────────── */}
      {intimateTrigger && (
        <div style={s.intimateTriggerBar}>
          <div style={s.intimateTriggerLeft}>
            <span style={s.intimateIcon}>♡</span>
            <span style={s.intimateLabel}>
              TENSION DETECTED — {intimateTrigger.character.name}
            </span>
            <span style={s.intimateHint}>
              {intimateTrigger.tension >= 5
                ? 'Strong intimate thread in recent lines.'
                : 'Charged atmosphere building.'}
            </span>
          </div>
          <div style={s.intimateTriggerActions}>
            <button
              style={s.intimateGenerateBtn}
              onClick={handleGenerateIntimateScene}
              disabled={generatingScene}
            >
              {generatingScene ? 'Writing scene…' : 'Generate scene'}
            </button>
            <button
              style={s.intimateDismissBtn}
              onClick={() => setIntimateTrigger(null)}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
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
    background: 'var(--lala-gold)',
    display: 'inline-block',
    animation: 'pulse 1.2s ease-in-out infinite',
  },
  loadingText: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: 'var(--text-secondary)',
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
    color: 'var(--text-secondary)',
    fontSize: 13,
    cursor: 'pointer',
    padding: '2px 4px',
    lineHeight: 1,
  },
  refreshBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 12,
    cursor: 'pointer',
    padding: '2px 4px',
    lineHeight: 1,
  },
  expandIcon: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'var(--text-secondary)',
  },
  cardBody: {
    padding: '0 14px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    borderTop: '1px solid var(--lala-parchment-2)',
    paddingTop: 12,
  },
  suggestionText: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 13,
    color: 'var(--text-primary)',
    letterSpacing: '0.03em',
    lineHeight: 1.6,
  },
  lineSuggestion: {
    background: 'var(--surface-card)',
    border: '1px solid var(--lala-parchment-3)',
    borderRadius: 2,
    padding: '10px 12px',
  },
  lineSuggestionLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.18em',
    color: 'var(--text-secondary)',
    marginBottom: 6,
  },
  lineSuggestionText: {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 15,
    fontStyle: 'italic',
    color: 'var(--text-primary)',
    lineHeight: 1.7,
    marginBottom: 10,
  },
  lineActions: {
    display: 'flex',
    gap: 8,
  },
  copyBtn: {
    background: 'none',
    border: '1px solid var(--lala-parchment-3)',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    letterSpacing: '0.08em',
    color: 'var(--text-secondary)',
    padding: '5px 10px',
    cursor: 'pointer',
    transition: 'all 0.12s',
  },
  acceptBtn: {
    background: 'var(--success-text)',
    border: 'none',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    letterSpacing: '0.08em',
    color: 'var(--text-inverse)',
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
    color: 'var(--lala-gold-text)',
  },
  cueCharRole: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'var(--text-secondary)',
    letterSpacing: '0.06em',
  },
  lalaBlock: {
    background: 'var(--lala-gold-soft)',
    border: '1px solid var(--lala-gold-line)',
    borderRadius: 2,
    padding: '10px 12px',
  },
  lalaLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.2em',
    color: 'var(--lala-gold-text)',
    marginBottom: 6,
  },
  lalaHint: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    letterSpacing: '0.03em',
    marginBottom: 8,
  },
  lalaLine: {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 15,
    fontStyle: 'italic',
    color: 'var(--lala-gold-text)',
    lineHeight: 1.5,
  },
  whatToDo: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: 'var(--text-secondary)',
    letterSpacing: '0.04em',
    lineHeight: 1.5,
    fontStyle: 'italic',
    borderTop: '1px solid var(--lala-parchment-2)',
    paddingTop: 8,
  },

  /* ── Intimate trigger styles ────────────────────────────────────── */
  intimateTriggerBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: 'var(--accent-subtle)',
    borderTop: '1px solid var(--accent-light)',
    gap: 12,
  },
  intimateTriggerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  intimateIcon: {
    fontSize: 14,
    color: 'var(--accent-dark)',
    flexShrink: 0,
  },
  intimateLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.12em',
    fontWeight: 600,
    color: 'var(--accent-dark)',
    whiteSpace: 'nowrap',
  },
  intimateHint: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'var(--accent-dark)',
    letterSpacing: '0.03em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  intimateTriggerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  intimateGenerateBtn: {
    background: 'var(--accent-dark)',
    border: 'none',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.08em',
    color: 'var(--text-inverse)',
    padding: '5px 12px',
    cursor: 'pointer',
    transition: 'opacity 0.12s',
    whiteSpace: 'nowrap',
  },
  intimateDismissBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--accent-dark)',
    fontSize: 13,
    cursor: 'pointer',
    padding: '2px 4px',
    lineHeight: 1,
  },
};
