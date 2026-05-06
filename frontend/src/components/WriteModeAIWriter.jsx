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

import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import apiClient from '../services/api';

// File-local helpers for non-streaming sites. The streaming-fetch site
// at runAction (line 251 + 259 getReader pair) is a Pattern G locked
// exception per v2.10 §9.11 — see the comment block at the call site.
export const aiWriterRewriteOptionsApi = (payload) =>
  apiClient.post('/api/v1/memories/rewrite-options', payload).then((r) => r.data);
export const aiWriterProseCritiqueApi = (payload) =>
  apiClient.post('/api/v1/memories/prose-critique', payload).then((r) => r.data);

const ACTIONS = [
  {
    id:       'continue',
    icon:     '✨',
    label:    'Continue the moment',
    shortLabel: 'Continue',
    shortcut: 'Ctrl+1',
    group:    'flow',
    endpoint: '/api/v1/memories/ai-writer-action',
    action:   'continue',
  },
  {
    id:       'deepen',
    icon:     '🧠',
    label:    'Deepen the scene',
    shortLabel: 'Deepen',
    shortcut: 'Ctrl+2',
    group:    'flow',
    endpoint: '/api/v1/memories/ai-writer-action',
    action:   'deepen',
  },
  {
    id:       'nudge',
    icon:     '🎯',
    label:    'Refine tone',
    shortLabel: 'Nudge',
    shortcut: 'Ctrl+3',
    group:    'refinement',
    endpoint: '/api/v1/memories/ai-writer-action',
    action:   'nudge',
  },
  {
    id:       'dialogue',
    icon:     '💬',
    label:    'Write dialogue',
    shortLabel: 'Dialogue',
    shortcut: '',
    group:    'voice',
    endpoint: '/api/v1/memories/ai-writer-action',
    action:   'dialogue',
  },
  {
    id:       'interior',
    icon:     '💭',
    label:    'Interior thoughts',
    shortLabel: 'Interior',
    shortcut: 'Ctrl+5',
    group:    'voice',
    endpoint: '/api/v1/memories/ai-writer-action',
    action:   'interior',
  },
  {
    id:       'reaction',
    icon:     '⚡',
    label:    'Character reaction',
    shortLabel: 'Reaction',
    shortcut: 'Ctrl+6',
    group:    'voice',
    endpoint: '/api/v1/memories/ai-writer-action',
    action:   'reaction',
  },
  {
    id:       'lala',
    icon:     '✧',
    label:    'Lala proto-voice',
    shortLabel: 'Lala',
    shortcut: 'Ctrl+7',
    group:    'special',
    endpoint: '/api/v1/memories/ai-writer-action',
    action:   'lala',
  },
];

const TONE_OPTIONS = [
  { id: 'default', label: 'Natural' },
  { id: 'intimate', label: 'Intimate' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'detached', label: 'Detached' },
  { id: 'raw', label: 'Raw' },
];
const TYPE_COLORS = {
  pressure: '#B85C38',
  mirror:   '#9B7FD4',
  support:  '#4A9B6F',
  shadow:   '#E08C3A',
  special:  '#B8962E',
};

const WriteModeAIWriter = forwardRef(function WriteModeAIWriter({
  chapterId,
  bookId,
  selectedCharacter,
  currentProse,
  chapterContext,
  onInsert,
  characters = [],
  onSelectCharacter,
  getSelectedText,
  cursorContext,
  previousChapterDigest,
}, ref) {
  const [activeAction, setActiveAction] = useState(null);
  const [result,       setResult]       = useState(null);
  const [editedResult, setEditedResult] = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [copied,       setCopied]       = useState(false);
  const [lengthMode,   setLengthMode]   = useState('paragraph');
  const [rewriteOptions, setRewriteOptions] = useState(null);
  const [toneMode, setToneMode] = useState('default');
  const retryRef = useRef(false);

  // ── Voice drift detection ──
  function detectDrift(generated) {
    if (!generated || !currentProse || currentProse.length < 200) return null;
    const baseline = currentProse.slice(-2000);
    const avg = (t) => {
      const sentences = t.split(/[.!?]+/).filter(s => s.trim());
      if (!sentences.length) return 0;
      return sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
    };
    const baseAvg = avg(baseline);
    const genAvg = avg(generated);
    if (baseAvg === 0) return null;
    const ratio = genAvg / baseAvg;
    // Check for excessive formality markers
    const formalWords = /\b(however|moreover|furthermore|consequently|nevertheless|thus|hence|whereas|notwithstanding)\b/gi;
    const baseFormal = (baseline.match(formalWords) || []).length / (baseline.split(/\s+/).length || 1);
    const genFormal = (generated.match(formalWords) || []).length / (generated.split(/\s+/).length || 1);
    const formalDrift = genFormal > baseFormal * 3 && genFormal > 0.01;
    if (ratio > 1.8 || ratio < 0.4 || formalDrift) {
      const reasons = [];
      if (ratio > 1.8) reasons.push('sentences are much longer than your prose');
      if (ratio < 0.4) reasons.push('sentences are much shorter than your prose');
      if (formalDrift) reasons.push('tone is more formal than your writing');
      return reasons.join('; ');
    }
    return null;
  }

  // Expose triggerAction for keyboard shortcuts from parent
  useImperativeHandle(ref, () => ({
    triggerAction: (actionId) => {
      if (loading) return;
      if (actionId === 'surprise') { runSurprise(); return; }
      const action = ACTIONS.find(a => a.id === actionId);
      if (action) runAction(action);
      else if (actionId === 'rewrite') runRewrite();
      else if (actionId === 'critique') runCritique();
    },
    get isLoading() { return loading; },
  }), [loading]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    if (!selectedCharacter) return;
    function handleKey(e) {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (!e.ctrlKey && !e.metaKey) return;
      const map = { '1': 'continue', '2': 'deepen', '3': 'nudge', '4': 'rewrite',
                    '5': 'interior', '6': 'reaction', '7': 'lala' };
      const actionId = map[e.key];
      if (!actionId || loading) return;
      e.preventDefault();
      if (actionId === 'rewrite') { runRewrite(); return; }
      const action = ACTIONS.find(a => a.id === actionId);
      if (action) runAction(action);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedCharacter, loading]);

  const accent   = TYPE_COLORS[selectedCharacter?.type] || '#B8962E';
  const charName = selectedCharacter?.selected_name || selectedCharacter?.name;

  // Clear result when character changes so old output doesn't bleed across characters
  useEffect(() => {
    setResult(null);
    setEditedResult(null);
    setActiveAction(null);
    setError(null);
    setCopied(false);
    setRewriteOptions(null);
  }, [selectedCharacter?.id]);

  async function runAction(action, isRetry = false) {
    if (!selectedCharacter) return;

    setActiveAction(action.id);
    // On retry, keep the old result visible while loading
    if (!isRetry) setResult(null);
    retryRef.current = isRetry;
    setEditedResult(null);
    setError(null);
    setLoading(true);
    setCopied(false);

    // Build context payload
    const recentProse = currentProse
      ? currentProse.slice(-1200)
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
        core_desire:        selectedCharacter.core_desire,
        core_fear:          selectedCharacter.core_fear,
        core_wound:         selectedCharacter.core_wound,
        description:        selectedCharacter.description,
      },
      recent_prose:  recentProse,
      chapter_context: chapterContext,
      previous_chapter_digest: previousChapterDigest || '',
      action:        action.action || action.id,
      length:        lengthMode,
      tone:          toneMode !== 'default' ? toneMode : undefined,
      stream:        true,
      // On retry, send a random hint so the API produces a different result
      ...(isRetry && { retry_hint: `v${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }),
    };

    try {
      // ── PATTERN G LOCKED EXCEPTION (v2.10 §9.11 + v2.18 candidate) ─────────
      // This site uses Server-Sent Events (SSE) streaming — server returns
      // content-type: text/event-stream and the body is consumed via
      // res.body.getReader(). axios cannot stream response bodies in the
      // browser (only in Node), so this site CANNOT migrate to apiClient.
      // Locked alongside BookEditor:55 keepalive + WriteMode:980/1145 SSE
      // streaming sites. Inline raw fetch + interceptor-bypass-by-design.
      // Auth: this endpoint is currently unauth-by-fetch — once Step 3
      // backend sweep completes, the streaming endpoints' auth posture is
      // determined server-side; the fetch here will need a manual Bearer
      // header attach (see WriteMode:980 precedent for the inline-auth pattern
      // when this site moves under requireAuth).
      // ───────────────────────────────────────────────────────────────────
      const res = await fetch(action.endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      // ── SSE streaming path ──
      if (res.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === 'text') {
                fullText += evt.text;
                setResult(fullText);
                setEditedResult(fullText);
              } else if (evt.type === 'error') {
                if (!retryRef.current) setResult(null);
                setError(evt.error || 'Generation failed.');
              }
            } catch {}
          }
        }
        if (!fullText && !retryRef.current) {
          setResult(null);
          setError('No content returned — try a different action or add more prose first.');
        }
      } else {
        // ── Fallback: JSON response ──
        const data = await res.json();
        const text = data.content || data.prose || data.nudge || data.continuation ||
                     data.text   || data.result || data.suggestion || '';

        if (text) {
          setResult(text);
          setEditedResult(text);
        } else {
          if (!retryRef.current) setResult(null);
          setError('No content returned — try a different action or add more prose first.');
        }
      }

    } catch (e) {
      // On retry failure, keep the old result visible
      if (!retryRef.current) setResult(null);
      setError('Generation failed. Check your connection and try again.');
    }

    setLoading(false);
  }

  async function runRewrite() {
    const selected = getSelectedText?.();
    if (!selected) {
      setError('Select some text in the editor first, then tap Rewrite.');
      return;
    }

    setActiveAction('rewrite');
    setResult(null);
    setEditedResult(null);
    setRewriteOptions(null);
    setError(null);
    setLoading(true);
    setCopied(false);

    try {
      const data = await aiWriterRewriteOptionsApi({
        book_id:       bookId,
        character_id:  selectedCharacter?.id,
        content:       selected,
        chapter_brief: chapterContext,
      });
      if (data.options?.length) {
        setRewriteOptions(data.options);
      } else {
        setError('No rewrite options returned — try selecting a different passage.');
      }
    } catch {
      setError('Rewrite failed. Check your connection and try again.');
    }

    setLoading(false);
  }

  function handlePickRewrite(option) {
    setResult(option.text);
    setEditedResult(option.text);
    setRewriteOptions(null);
    setActiveAction('rewrite');
  }

  function handleInsert() {
    const text = editedResult || result;
    if (!text) return;
    onInsert?.(text);
    setResult(null);
    setEditedResult(null);
    setActiveAction(null);
  }

  function handleDiscard() {
    setResult(null);
    setEditedResult(null);
    setActiveAction(null);
    setRewriteOptions(null);
  }

  function handleCopy() {
    const text = editedResult || result;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function runSurprise() {
    if (loading) return;
    const pool = ACTIONS.filter(a => a.group !== 'special');
    const pick = pool[Math.floor(Math.random() * pool.length)];
    runAction(pick);
  }

  async function runCritique() {
    if (!currentProse?.trim()) {
      setError('Add some prose first — then ask for a critique.');
      return;
    }
    setActiveAction('critique');
    setResult(null);
    setEditedResult(null);
    setRewriteOptions(null);
    setError(null);
    setLoading(true);
    setCopied(false);

    try {
      const data = await aiWriterProseCritiqueApi({
        book_id:      bookId,
        chapter_id:   chapterId,
        character_id: selectedCharacter?.id,
        prose:        currentProse,
      });
      if (data.critique) {
        setResult(data.critique);
        setEditedResult(data.critique);
      } else {
        setError('No critique returned — try again.');
      }
    } catch {
      setError('Critique failed. Check your connection.');
    }
    setLoading(false);
  }

  // ── NO CHARACTER SELECTED ──────────────────────────────────────────
  if (!selectedCharacter) {
    return (
      <div style={s.empty}>
        <div style={s.emptyIcon}>{'◈'}</div>
        <div style={s.emptyText}>
          Pick a character to write in their voice.
        </div>

        {/* Inline character picker */}
        {characters.length > 0 ? (
          <div style={s.charList}>
            {characters.map(c => (
              <button
                key={c.id}
                style={s.charOption}
                onClick={() => onSelectCharacter?.(c)}
              >
                <span style={s.charOptionIcon}>{c.icon || '👤'}</span>
                <span style={s.charOptionName}>{c.display_name || c.selected_name || c.name}</span>
                {c.type && <span style={{ ...s.charOptionType, color: TYPE_COLORS[c.type] || '#B8962E' }}>{c.type}</span>}
              </button>
            ))}
          </div>
        ) : (
          <div style={s.emptyHint}>No characters loaded yet.</div>
        )}
      </div>
    );
  }

  return (
    <div style={s.root}>

      {/* Character header */}
      <div style={s.charHeader}>
        <div style={s.charHeaderTop}>
          <div>
            <div style={{ ...s.charType, color: accent }}>
              {selectedCharacter.type}
            </div>
            <div style={s.charName}>{charName}</div>
          </div>
          <button
            style={s.changeCharBtn}
            onClick={() => onSelectCharacter?.(null)}
            title="Switch to a different character"
          >
            {'↻ Change'}
          </button>
        </div>
        {selectedCharacter.belief_pressured && (
          <div style={s.charBelief}>
            &ldquo;{selectedCharacter.belief_pressured}&rdquo;
          </div>
        )}
      </div>

      {/* Cursor context — shows where text will be inserted */}
      {cursorContext && !result && !rewriteOptions && (
        <div style={s.cursorContext}>
          <div style={s.cursorContextLabel}>Inserting at cursor:</div>
          <div style={s.cursorContextText}>…{cursorContext}…</div>
        </div>
      )}

      {/* Creative Tools */}
      {!result && !rewriteOptions && (
        <div style={s.toolbar}>
          {/* Writing Flow group */}
          <div style={s.groupHeader}>
            <span style={s.groupIcon} aria-hidden="true">✨</span>
            <span style={s.groupLabel}>Writing Flow</span>
          </div>
          <div style={s.toolRow} role="group" aria-label="Writing flow tools">
            {ACTIONS.filter(a => a.group === 'flow').map(action => (
              <button
                key={action.id}
                style={{
                  ...s.toolPill,
                  background:  activeAction === action.id && loading
                               ? `${accent}18` : 'rgba(28,24,20,0.04)',
                  borderColor: activeAction === action.id
                               ? accent : 'rgba(28,24,20,0.10)',
                  opacity:     loading && activeAction !== action.id ? 0.5 : 1,
                }}
                onClick={() => runAction(action)}
                disabled={loading}
                aria-label={action.label}
                aria-busy={loading && activeAction === action.id}
                title={`${action.label} (${action.shortcut})`}
              >
                <span style={s.toolIcon} aria-hidden="true">{action.icon}</span>
                <span style={s.toolLabel}>
                  {action.label}
                  {loading && activeAction === action.id && (
                    <span style={s.spinner} role="status" aria-live="polite">{activeAction === 'continue' ? ' Expanding the moment…' : ' Layering depth…'}</span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* Refinement group */}
          <div style={{ ...s.groupHeader, marginTop: 12 }}>
            <span style={s.groupIcon}>🎯</span>
            <span style={s.groupLabel}>Refinement</span>
          </div>
          <div style={s.toolRow} role="group" aria-label="Refinement tools">
            {ACTIONS.filter(a => a.group === 'refinement').map(action => (
              <button
                key={action.id}
                style={{
                  ...s.toolPill,
                  background:  activeAction === action.id && loading
                               ? `${accent}18` : 'rgba(28,24,20,0.04)',
                  borderColor: activeAction === action.id
                               ? accent : 'rgba(28,24,20,0.10)',
                  opacity:     loading && activeAction !== action.id ? 0.5 : 1,
                }}
                onClick={() => runAction(action)}
                disabled={loading}
                aria-label={action.label}
                aria-busy={loading && activeAction === action.id}
                title={`${action.label} (${action.shortcut})`}
              >
                <span style={s.toolIcon} aria-hidden="true">{action.icon}</span>
                <span style={s.toolLabel}>
                  {action.label}
                  {loading && activeAction === action.id && (
                    <span style={s.spinner} role="status" aria-live="polite"> Refining…</span>
                  )}
                </span>
              </button>
            ))}
            <button
              style={{
                ...s.toolPill,
                background:  activeAction === 'rewrite' && loading
                             ? `${accent}18` : 'rgba(28,24,20,0.04)',
                borderColor: activeAction === 'rewrite'
                             ? accent : 'rgba(28,24,20,0.10)',
                opacity:     loading && activeAction !== 'rewrite' ? 0.5 : 1,
              }}
              onClick={runRewrite}
              disabled={loading}
              aria-label="Rework paragraph"
              aria-busy={loading && activeAction === 'rewrite'}
              title="Rework paragraph (Ctrl+4) — select text first"
            >
              <span style={s.toolIcon} aria-hidden="true">{'🔄'}</span>
              <span style={s.toolLabel}>
                Rework paragraph
                {loading && activeAction === 'rewrite' && (
                  <span style={s.spinner} role="status" aria-live="polite"> Reworking…</span>
                )}
              </span>
            </button>
          </div>

          {/* Voice group */}
          <div style={{ ...s.groupHeader, marginTop: 12 }}>
            <span style={s.groupIcon}>💬</span>
            <span style={s.groupLabel}>Character Voice</span>
          </div>
          <div style={s.toolRow} role="group" aria-label="Character voice tools">
            {ACTIONS.filter(a => a.group === 'voice').map(action => (
              <button
                key={action.id}
                style={{
                  ...s.toolPill,
                  background:  activeAction === action.id && loading
                               ? `${accent}18` : 'rgba(28,24,20,0.04)',
                  borderColor: activeAction === action.id
                               ? accent : 'rgba(28,24,20,0.10)',
                  opacity:     loading && activeAction !== action.id ? 0.5 : 1,
                }}
                onClick={() => runAction(action)}
                disabled={loading}
                aria-label={action.label}
                aria-busy={loading && activeAction === action.id}
                title={`${action.label} (${action.shortcut})`}
              >
                <span style={s.toolIcon} aria-hidden="true">{action.icon}</span>
                <span style={s.toolLabel}>
                  {action.label}
                  {loading && activeAction === action.id && (
                    <span style={s.spinner} role="status" aria-live="polite"> Voicing…</span>
                  )}
                </span>
              </button>
            ))}
            {ACTIONS.filter(a => a.group === 'special').map(action => (
              <button
                key={action.id}
                style={{
                  ...s.toolPill,
                  background:  activeAction === action.id && loading
                               ? '#C8A2C818' : 'rgba(28,24,20,0.04)',
                  borderColor: activeAction === action.id
                               ? '#C8A2C8' : 'rgba(28,24,20,0.10)',
                  opacity:     loading && activeAction !== action.id ? 0.5 : 1,
                }}
                onClick={() => runAction(action)}
                disabled={loading}
                aria-label={action.label}
                aria-busy={loading && activeAction === action.id}
                title={`${action.label} (${action.shortcut})`}
              >
                <span style={s.toolIcon} aria-hidden="true">{action.icon}</span>
                <span style={s.toolLabel}>
                  {action.label}
                  {loading && activeAction === action.id && (
                    <span style={s.spinner} role="status" aria-live="polite"> Channeling Lala…</span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* Surprise Me */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              style={{
                ...s.toolPill,
                background: 'rgba(28,24,20,0.04)',
                borderColor: 'rgba(28,24,20,0.10)',
                opacity: loading ? 0.5 : 1,
                flex: 1,
                justifyContent: 'center',
              }}
              onClick={runSurprise}
              disabled={loading}
              title="Pick a random AI action"
            >
              <span style={s.toolIcon}>🎲</span>
              <span style={s.toolLabel}>Surprise me</span>
            </button>
            <button
              style={{
                ...s.toolPill,
                background: activeAction === 'critique' && loading ? `${accent}18` : 'rgba(28,24,20,0.04)',
                borderColor: activeAction === 'critique' ? accent : 'rgba(28,24,20,0.10)',
                opacity: loading && activeAction !== 'critique' ? 0.5 : 1,
                flex: 1,
                justifyContent: 'center',
              }}
              onClick={runCritique}
              disabled={loading}
              title="Get AI feedback on your prose"
            >
              <span style={s.toolIcon}>📖</span>
              <span style={s.toolLabel}>
                How does this read?
                {loading && activeAction === 'critique' && (
                  <span style={s.spinner}> Reading…</span>
                )}
              </span>
            </button>
          </div>

          {/* Tone selector */}
          <div style={{ ...s.lengthRow, marginTop: 8 }} role="group" aria-label="Tone preset">
            {TONE_OPTIONS.map(t => (
              <button
                key={t.id}
                style={{
                  ...s.lengthPill,
                  background: toneMode === t.id ? `${accent}14` : 'transparent',
                  color: toneMode === t.id ? accent : INK_MID,
                  borderColor: toneMode === t.id ? accent : 'rgba(28,24,20,0.10)',
                }}
                onClick={() => setToneMode(t.id)}
                aria-pressed={toneMode === t.id}
                title={`Tone: ${t.label}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Length toggle */}
          <div style={s.lengthRow} role="group" aria-label="Output length">
            <button
              style={{
                ...s.lengthPill,
                background: lengthMode === 'full' ? `${accent}14` : 'transparent',
                color: lengthMode === 'full' ? accent : INK_MID,
                borderColor: lengthMode === 'full' ? accent : 'rgba(28,24,20,0.10)',
              }}
              onClick={() => setLengthMode('full')}
              aria-pressed={lengthMode === 'full'}
              title="Generate full-length content"
            >
              ¶ full
            </button>
            <button
              style={{
                ...s.lengthPill,
                background: lengthMode === 'paragraph' ? `${accent}14` : 'transparent',
                color: lengthMode === 'paragraph' ? accent : INK_MID,
                borderColor: lengthMode === 'paragraph' ? accent : 'rgba(28,24,20,0.10)',
              }}
              onClick={() => setLengthMode('paragraph')}
              aria-pressed={lengthMode === 'paragraph'}
              title="Generate paragraph-length content"
            >
              ¶ Paragraphs
            </button>
          </div>

          {/* Mic hint */}
          <div style={s.micHint}>
            Tap mic to speak — or use creative tools above
          </div>
        </div>
      )}

      {/* Rewrite options */}
      {rewriteOptions && (
        <div style={s.rewritePanel} role="region" aria-label="Rewrite options">
          <div style={s.resultHeader}>
            <div style={{ ...s.resultAction, color: accent }}>Pick a rewrite</div>
            <button style={s.discardBtn} onClick={handleDiscard} aria-label="Dismiss rewrite options">{'✕'}</button>
          </div>
          {rewriteOptions.map((opt, i) => (
            <button
              key={i}
              style={s.rewriteOption}
              onClick={() => handlePickRewrite(opt)}
            >
              <div style={{ ...s.rewriteType, color: accent }}>
                {opt.type}
              </div>
              <div style={s.rewriteText}>{opt.text}</div>
            </button>
          ))}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={s.resultPanel} role="region" aria-label="Generated content" aria-live="polite">
          <div style={s.resultHeader}>
            <div style={{ ...s.resultAction, color: accent }}>
              {activeAction === 'rewrite' ? 'Rewrite' : (ACTIONS.find(a => a.id === activeAction)?.label || 'Generated')}
            </div>
            <button style={s.discardBtn} onClick={handleDiscard} aria-label="Discard generated content">{'✕'}</button>
          </div>

          <textarea
            style={s.resultText}
            value={editedResult ?? result ?? ''}
            onChange={e => setEditedResult(e.target.value)}
            rows={6}
            placeholder="Edit before inserting…"
            aria-label="Edit generated content before inserting into manuscript"
          />
          {/* Voice drift warning */}
          {(() => {
            const drift = detectDrift(result);
            return drift ? (
              <div style={s.driftWarning} role="status">
                <span style={s.driftIcon}>⚠</span>
                <span>Voice drift: {drift}</span>
                <button
                  style={s.driftRetryBtn}
                  disabled={loading}
                  onClick={() => {
                    const action = ACTIONS.find(a => a.id === activeAction);
                    if (action) runAction(action, true);
                  }}
                >
                  {loading ? '◌ …' : '↻ Regenerate in voice'}
                </button>
              </div>
            ) : null;
          })()}
          {loading && (
            <div style={s.retryLoading} role="status" aria-live="polite">Generating new version…</div>
          )}

          <div style={s.resultActions}>
            <button
              style={{ ...s.insertBtn, background: accent, opacity: loading ? 0.5 : 1 }}
              onClick={handleInsert}
              disabled={loading}
            >
              Insert into manuscript
            </button>
            <div style={s.resultRow}>
              <button style={{ ...s.tryAgainBtn, opacity: loading ? 0.5 : 1 }} disabled={loading} onClick={() => {
                const action = ACTIONS.find(a => a.id === activeAction);
                if (action) runAction(action, true);
              }}>
                {loading ? '◌ Generating…' : '↻ Try again'}
              </button>
              <button style={s.copyBtn} onClick={handleCopy}>
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={s.error} role="alert" aria-live="assertive">{error}</div>
      )}

    </div>
  );
});

export default WriteModeAIWriter;


// ── STYLES ────────────────────────────────────────────────────────────

const INK       = '#1C1814';
const INK_MID   = 'rgba(28,24,20,0.5)';
const INK_LIGHT = 'rgba(28,24,20,0.25)';
const PARCHMENT = '#FAF7F0';

const s = {
  root: {
    display:       'flex',
    flexDirection: 'column',
    flex:          1,
    minHeight:     0,
    overflow:      'hidden',
  },

  // No character
  empty: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'flex-start',
    padding:        '18px 12px',
    gap:            10,
    textAlign:      'center',
    flex:           1,
    overflowY:      'auto',
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
  emptyHint: {
    fontFamily: "'DM Mono', monospace",
    fontSize:   9,
    color:      INK_LIGHT,
    letterSpacing: '0.06em',
  },

  // Inline character picker
  charList: {
    display:       'flex',
    flexDirection: 'column',
    gap:           4,
    width:         '100%',
    overflowY:     'auto',
    marginTop:     4,
    flex:          1,
    minHeight:     0,
  },
  charOption: {
    display:      'flex',
    alignItems:   'center',
    gap:          8,
    padding:      '8px 12px',
    background:   'transparent',
    border:       '1px solid rgba(28,24,20,0.1)',
    borderRadius: 6,
    cursor:       'pointer',
    textAlign:    'left',
    transition:   'background 0.15s, border-color 0.15s',
  },
  charOptionIcon: {
    fontSize:   16,
    flexShrink: 0,
  },
  charOptionName: {
    flex:          1,
    fontFamily:    "'DM Mono', monospace",
    fontSize:      11,
    color:         INK,
    letterSpacing: '0.02em',
  },
  charOptionType: {
    fontSize:      7,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontFamily:    "'DM Mono', monospace",
  },

  // Character header
  charHeader: {
    padding:      '10px 14px',
    borderBottom: '1px solid rgba(28,24,20,0.08)',
  },
  charHeaderTop: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    gap:            8,
  },
  changeCharBtn: {
    background:    'none',
    border:        '1px solid rgba(28,24,20,0.12)',
    borderRadius:  4,
    padding:       '3px 8px',
    fontSize:      9,
    color:         INK_MID,
    cursor:        'pointer',
    fontFamily:    "'DM Mono', monospace",
    letterSpacing: '0.04em',
    whiteSpace:    'nowrap',
    flexShrink:    0,
    marginTop:     2,
    transition:    'color 0.15s, border-color 0.15s',
  },
  charType: {
    fontSize:      8,
    letterSpacing: '0.12em',
    marginBottom:  3,
    fontFamily:    "'DM Mono', monospace",
    textTransform: 'uppercase',
  },
  charName: {
    fontFamily:   "'Cormorant Garamond', Georgia, serif",
    fontSize:     15,
    color:        INK,
    marginBottom: 3,
  },
  charBelief: {
    fontFamily: "'Lora', Georgia, serif",
    fontStyle:  'italic',
    fontSize:   10,
    color:      INK_MID,
    lineHeight: 1.5,
  },

  // Cursor context — shows where insertion will happen
  cursorContext: {
    padding:      '8px 14px',
    borderBottom: '1px solid rgba(28,24,20,0.06)',
    background:   'rgba(28,24,20,0.02)',
  },
  cursorContextLabel: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize:   10,
    fontWeight:  600,
    color:       INK_MID,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 4,
  },
  cursorContextText: {
    fontFamily: "'Lora', Georgia, serif",
    fontSize:   12,
    color:       INK,
    lineHeight:  1.5,
    overflow:    'hidden',
    textOverflow: 'ellipsis',
    whiteSpace:  'nowrap',
    opacity:     0.7,
  },

  // Creative Tools toolbar
  toolbar: {
    display:       'flex',
    flexDirection: 'column',
    padding:       '12px 14px',
    gap:           8,
  },
  groupHeader: {
    display:        'flex',
    alignItems:     'center',
    gap:            6,
    marginBottom:   2,
  },
  groupIcon: {
    fontSize:   13,
    lineHeight: 1,
  },
  groupLabel: {
    fontSize:      11,
    fontWeight:    600,
    color:         INK,
    letterSpacing: '0.01em',
    fontFamily:    "'DM Mono', monospace",
  },
  toolRow: {
    display:        'flex',
    gap:            8,
    flexWrap:       'wrap',
  },
  toolPill: {
    display:      'flex',
    alignItems:   'center',
    gap:          6,
    padding:      '8px 14px',
    border:       '1px solid',
    borderRadius: 20,
    cursor:       'pointer',
    transition:   'all 0.15s ease',
    whiteSpace:   'nowrap',
  },
  toolIcon: {
    fontSize:   15,
    lineHeight: 1,
    flexShrink: 0,
  },
  toolLabel: {
    fontSize:      12,
    color:         INK,
    fontFamily:    "'DM Mono', monospace",
    letterSpacing: '0.02em',
  },
  lengthRow: {
    display:  'flex',
    gap:      8,
  },
  lengthPill: {
    padding:       '5px 12px',
    border:        '1px solid',
    borderRadius:  14,
    cursor:        'pointer',
    fontSize:      11,
    fontFamily:    "'DM Mono', monospace",
    letterSpacing: '0.02em',
    background:    'transparent',
    transition:    'all 0.15s ease',
  },
  micHint: {
    fontFamily:    "'Lora', Georgia, serif",
    fontStyle:     'italic',
    fontSize:      11,
    color:         INK_LIGHT,
    textAlign:     'center',
    padding:       '6px 0',
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
    fontFamily:   "'Lora', Georgia, serif",
    fontStyle:    'italic',
    fontSize:     13,
    color:        INK,
    lineHeight:   1.8,
    flex:         1,
    padding:      '10px 12px',
    background:   'rgba(28,24,20,0.03)',
    borderRadius: 3,
    border:       '1px solid rgba(28,24,20,0.08)',
    resize:       'vertical',
    minHeight:    80,
    outline:      'none',
    width:        '100%',
    boxSizing:    'border-box',
  },
  retryLoading: {
    fontFamily:    "'DM Mono', monospace",
    fontSize:      9,
    color:         INK_MID,
    letterSpacing: '0.06em',
    fontStyle:     'italic',
    padding:       '2px 0',
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
    flex:          1,
  },
  resultRow: {
    display: 'flex',
    gap:     6,
  },
  copyBtn: {
    background:    'none',
    border:        '1px solid rgba(28,24,20,0.1)',
    borderRadius:  3,
    padding:       '8px 10px',
    color:         INK_MID,
    fontSize:      9,
    letterSpacing: '0.08em',
    cursor:        'pointer',
    fontFamily:    "'DM Mono', monospace",
    whiteSpace:    'nowrap',
  },

  // Error
  error: {
    padding:    '10px 14px',
    fontSize:   10,
    color:      '#B85C38',
    fontStyle:  'italic',
    fontFamily: "'Lora', Georgia, serif",
  },

  // Voice drift warning
  driftWarning: {
    display:      'flex',
    alignItems:   'flex-start',
    gap:          6,
    padding:      '8px 10px',
    fontSize:     9,
    color:        '#B85C38',
    background:   'rgba(184,92,56,0.06)',
    borderRadius: 3,
    fontFamily:   "'DM Mono', monospace",
    letterSpacing:'0.04em',
    lineHeight:   1.5,
    marginTop:    4,
  },
  driftIcon: {
    fontSize:   11,
    flexShrink: 0,
  },
  driftRetryBtn: {
    marginLeft:   'auto',
    background:   'rgba(184,92,56,0.10)',
    border:       '1px solid rgba(184,92,56,0.25)',
    borderRadius: 3,
    color:        '#B85C38',
    fontSize:     9,
    fontFamily:   "'DM Mono', monospace",
    padding:      '2px 8px',
    cursor:       'pointer',
    whiteSpace:   'nowrap',
    flexShrink:   0,
  },

  // Rewrite options
  rewritePanel: {
    display:       'flex',
    flexDirection: 'column',
    padding:       '12px 14px',
    gap:           8,
    flex:          1,
    overflowY:     'auto',
  },
  rewriteOption: {
    display:      'flex',
    flexDirection: 'column',
    gap:          4,
    padding:      '10px 12px',
    background:   'rgba(28,24,20,0.03)',
    border:       '1px solid rgba(28,24,20,0.08)',
    borderRadius: 6,
    cursor:       'pointer',
    textAlign:    'left',
    transition:   'border-color 0.15s, background 0.15s',
  },
  rewriteType: {
    fontSize:      8,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontFamily:    "'DM Mono', monospace",
  },
  rewriteText: {
    fontFamily:   "'Lora', Georgia, serif",
    fontStyle:    'italic',
    fontSize:     12,
    color:        INK,
    lineHeight:   1.7,
  },
};
