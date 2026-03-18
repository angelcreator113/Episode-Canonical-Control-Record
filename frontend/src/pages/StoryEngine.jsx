import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import StoryReviewPanel from '../components/StoryReviewPanel';
import WriteModeAIWriter from '../components/WriteModeAIWriter';
import useStoryEngine from '../hooks/useStoryEngine';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import StoryNavigator from './StoryNavigator';
import StoryInspector from './StoryInspector';
import ArcGenerationStatus from './ArcGenerationStatus';
import { API_BASE, PHASE_COLORS, PHASE_LABELS, TYPE_ICONS, WORLD_LABELS, getReadingTime } from './storyEngineConstants';
import './StoryEngine.css';

// ─── Toast notification system ────────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="se-toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`se-toast se-toast-${t.type}`}>
          <span className="se-toast-icon">
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'info' ? 'ℹ' : '⚠'}
          </span>
          <span className="se-toast-msg">{t.message}</span>
          <button className="se-toast-close" onClick={() => onDismiss(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

// ─── Therapy-informed story suggestions ──────────────────────────────────────
function TherapySuggestions({ characterKey, apiBase }) {
  const [suggestions, setSuggestions] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!characterKey) return;
    setSuggestions(null);
    fetch(`${apiBase}/story-health/therapy-suggestions/${characterKey}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setSuggestions(d))
      .catch(err => console.warn('therapy suggestions failed:', err.message));
  }, [characterKey, apiBase]);

  if (!suggestions?.suggestions?.length) return null;
  return (
    <div style={{
      margin: '0 14px 12px', padding: 12, borderRadius: 10,
      background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)',
    }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed' }}>
          Story Suggestions ({suggestions.suggestions.length})
        </span>
        <span style={{ fontSize: 10, color: '#999' }}>{expanded ? '▾' : '▸'}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {suggestions.suggestions.map((s, i) => (
            <div key={s.title || i} style={{ display: 'flex', gap: 8, fontSize: 11, padding: '4px 0' }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                background: s.priority === 'high' ? '#ef4444' : s.priority === 'medium' ? '#f59e0b' : '#999',
              }} />
              <div>
                <div style={{ fontWeight: 500, color: '#333' }}>{s.title}</div>
                <div style={{ color: '#888', fontSize: 10 }}>{s.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Bottom Writing Tools (compact toolbar below story content) ───────────────
const BOTTOM_TOOLS = [
  { id: 'continue', icon: '✨', label: 'Continue the moment', group: 'flow', action: 'continue', spinner: 'Expanding…' },
  { id: 'deepen',   icon: '🧠', label: 'Deepen the scene',   group: 'flow', action: 'deepen',   spinner: 'Layering depth…' },
  { id: 'nudge',    icon: '🎯', label: 'Refine tone',        group: 'refinement', action: 'nudge', spinner: 'Refining…' },
  { id: 'rewrite',  icon: '🔄', label: 'Rework paragraph',   group: 'refinement', action: 'rewrite', spinner: 'Reworking…' },
];

function BottomWritingTools({ story, charObj, selectedCharKey, activeWorld, charColor, onInsertText, currentProse }) {
  const [activeAction, setActiveAction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [lengthMode, setLengthMode] = useState('paragraph');
  const [copied, setCopied] = useState(false);

  const accent = charColor || '#B8962E';
  const charName = charObj?.display_name || selectedCharKey || '';

  useEffect(() => {
    setResult(null); setError(null); setActiveAction(null); setCopied(false);
  }, [selectedCharKey]);

  async function runTool(tool) {
    if (!selectedCharKey || !story) return;
    setActiveAction(tool.id);
    setResult(null); setError(null); setLoading(true); setCopied(false);

    const payload = {
      chapter_id: String(story.story_number || ''),
      book_id: activeWorld || '',
      character_id: charObj?.id || selectedCharKey,
      character: {
        name: charName,
        type: charObj?.role_type, role: charObj?.role_type,
        core_desire: charObj?.core_desire, core_fear: charObj?.core_fear,
        core_wound: charObj?.core_wound, description: charObj?.description,
      },
      recent_prose: (currentProse || story.text || '').slice(-600),
      chapter_context: {},
      action: tool.action,
      length: lengthMode,
    };

    try {
      const res = await fetch('/api/v1/memories/ai-writer-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const text = data.content || data.prose || data.nudge || data.continuation || data.text || data.result || '';
      if (text) setResult(text);
      else setError('No content returned — try a different action.');
    } catch {
      setError('Generation failed. Check connection and try again.');
    }
    setLoading(false);
  }

  if (!story || !selectedCharKey) return null;

  const flowTools = BOTTOM_TOOLS.filter(t => t.group === 'flow');
  const refinementTools = BOTTOM_TOOLS.filter(t => t.group === 'refinement');

  return (
    <div className="se-bottom-tools">
      <div className="se-bottom-tools-groups">
        <div className="se-bottom-tools-group">
          <div className="se-bottom-tools-group-label"><span className="se-bottom-tools-group-icon">✨</span> Writing Flow</div>
          <div className="se-bottom-tools-row">
            {flowTools.map(tool => (
              <button
                key={tool.id}
                className={`se-bottom-tool-pill${activeAction === tool.id ? ' active' : ''}`}
                style={{ '--tool-accent': accent }}
                onClick={() => runTool(tool)}
                disabled={loading}
              >
                <span className="se-bottom-tool-icon">{tool.icon}</span>
                <span className="se-bottom-tool-label">
                  {tool.label}
                  {loading && activeAction === tool.id && <span className="se-bottom-tool-spinner"> {tool.spinner}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="se-bottom-tools-group">
          <div className="se-bottom-tools-group-label"><span className="se-bottom-tools-group-icon">🎯</span> Refinement</div>
          <div className="se-bottom-tools-row">
            {refinementTools.map(tool => (
              <button
                key={tool.id}
                className={`se-bottom-tool-pill${activeAction === tool.id ? ' active' : ''}`}
                style={{ '--tool-accent': accent }}
                onClick={() => runTool(tool)}
                disabled={loading}
              >
                <span className="se-bottom-tool-icon">{tool.icon}</span>
                <span className="se-bottom-tool-label">
                  {tool.label}
                  {loading && activeAction === tool.id && <span className="se-bottom-tool-spinner"> {tool.spinner}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="se-bottom-tools-length">
        <button
          className={`se-bottom-length-pill${lengthMode === 'full' ? ' active' : ''}`}
          style={{ '--tool-accent': accent }}
          onClick={() => setLengthMode('full')}
        >¶ full</button>
        <button
          className={`se-bottom-length-pill${lengthMode === 'paragraph' ? ' active' : ''}`}
          style={{ '--tool-accent': accent }}
          onClick={() => setLengthMode('paragraph')}
        >¶ Paragraphs</button>
      </div>

      {error && <div className="se-bottom-tools-error">{error}</div>}

      {result && (
        <div className="se-bottom-tools-result">
          <div className="se-bottom-tools-result-header">
            <span className="se-bottom-tools-result-title">Generated</span>
            <div className="se-bottom-tools-result-actions">
              <button className="se-bottom-tools-result-btn" onClick={() => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button className="se-bottom-tools-result-btn se-bottom-tools-result-btn--insert" style={{ background: accent, color: '#fff' }} onClick={() => { onInsertText?.(result); setResult(null); }}>
                Insert into story
              </button>
              <button className="se-bottom-tools-result-btn" onClick={() => setResult(null)}>Dismiss</button>
            </div>
          </div>
          <div className="se-bottom-tools-result-text">{result}</div>
        </div>
      )}
    </div>
  );
}

// ─── Story reader / editor panel ──────────────────────────────────────────────
function StoryPanel({
  story, task, charColor, charName,
  onApprove, onReject, onEdit, onCheckConsistency,
  onSaveForLater, savingForLater,
  consistencyConflicts, consistencyLoading,
  therapyMemories, therapyLoading,
  onAddToRegistry,
  registryUpdate,
  readingMode, onToggleReadingMode,
  writeMode, onToggleWriteMode,
  onNavigateStory, hasPrev, hasNext,
  onExportStory, onDelete,
  onEvaluate,
  charObj, selectedCharKey, activeWorld, allCharacters, onSelectChar,
  storiesMinimized, onToggleStoriesMinimized,
}) {
  const editing = writeMode;
  const setEditing = onToggleWriteMode;
  const [editText, setEditText] = useState(story?.text || '');
  const [saveStatus, setSaveStatus] = useState('saved');
  const [selectedVoice, setSelectedVoice] = useState(selectedCharKey || null);
  const [voicesExpanded, setVoicesExpanded] = useState(false);

  // ── Text-to-Speech state ──
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsPaused, setTtsPaused] = useState(false);
  const [ttsRate, setTtsRate] = useState(1);
  const ttsUtteranceRef = useRef(null);

  const handleTtsPlay = useCallback(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    if (ttsPaused) {
      synth.resume();
      setTtsPaused(false);
      setTtsPlaying(true);
      return;
    }

    synth.cancel();
    const text = editing ? editText : (story?.text || '');
    if (!text.trim()) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = ttsRate;
    utterance.pitch = 1;

    // Pick a natural-sounding voice if available
    const voices = synth.getVoices();
    const preferred = voices.find(v => v.name.includes('Natural') || v.name.includes('Online'))
                   || voices.find(v => v.lang.startsWith('en') && !v.localService)
                   || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => { setTtsPlaying(false); setTtsPaused(false); };
    utterance.onerror = () => { setTtsPlaying(false); setTtsPaused(false); };

    ttsUtteranceRef.current = utterance;
    synth.speak(utterance);
    setTtsPlaying(true);
    setTtsPaused(false);
  }, [editing, editText, story?.text, ttsPaused, ttsRate]);

  const handleTtsPause = useCallback(() => {
    const synth = window.speechSynthesis;
    if (synth?.speaking) {
      synth.pause();
      setTtsPaused(true);
      setTtsPlaying(false);
    }
  }, []);

  const handleTtsStop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setTtsPlaying(false);
    setTtsPaused(false);
  }, []);

  // Cleanup TTS on unmount or story change
  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, [story?.story_number]);

  useEffect(() => {
    if (selectedCharKey) setSelectedVoice(selectedCharKey);
  }, [selectedCharKey]);

  useEffect(() => {
    setSaveStatus('saved');
  }, [story?.story_number]);

  useEffect(() => {
    if (editing && editText !== (story?.text || '')) {
      setSaveStatus('unsaved');
    }
  }, [editText, editing, story?.text]);

  const [currentPage, setCurrentPage] = useState(0);
  const [evalScore, setEvalScore] = useState(null);
  const [activeThreads, setActiveThreads] = useState([]);
  const [selectionPopup, setSelectionPopup] = useState(null);
  const textareaRef = useRef(null);
  const storyBodyRef = useRef(null);
  const prevStoryRef = useRef(story?.story_number);

  // Text selection popup for reading mode
  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !storyBodyRef.current?.contains(sel.anchorNode)) {
        setSelectionPopup(null);
        return;
      }
      const text = sel.toString().trim();
      if (text.length < 3) { setSelectionPopup(null); return; }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionPopup({
        text,
        top: rect.top - 44,
        left: rect.left + rect.width / 2,
      });
    };
    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, []);

  const WORDS_PER_PAGE = 250;
  const pages = useMemo(() => {
    const text = story?.text || '';
    const paragraphs = text.split('\n');
    const result = [[]];
    let wordCount = 0;
    for (const para of paragraphs) {
      const words = para.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount > 0 && wordCount + words > WORDS_PER_PAGE) {
        result.push([]);
        wordCount = 0;
      }
      result[result.length - 1].push(para);
      wordCount += words;
    }
    return result.filter(p => p.some(line => line.trim()));
  }, [story?.text]);
  const totalPages = pages.length;

  const editPageOffsets = useMemo(() => {
    const text = editText || '';
    const paragraphs = text.split('\n');
    const offsets = [0];
    let wordCount = 0;
    let charPos = 0;
    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i];
      const words = para.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount > 0 && wordCount + words > WORDS_PER_PAGE) {
        offsets.push(charPos);
        wordCount = 0;
      }
      wordCount += words;
      charPos += para.length + 1;
    }
    return offsets;
  }, [editText]);
  const editTotalPages = editPageOffsets.length;

  useEffect(() => {
    if (editing && currentPage >= editTotalPages) {
      setCurrentPage(Math.max(0, editTotalPages - 1));
    }
  }, [editing, editTotalPages, currentPage]);

  useEffect(() => {
    setEditText(story?.text || '');
    setCurrentPage(0);
    if (prevStoryRef.current != null && prevStoryRef.current !== story?.story_number) {
      if (onToggleWriteMode) onToggleWriteMode(false);
    }
    prevStoryRef.current = story?.story_number;
  }, [story, onToggleWriteMode]);

  useEffect(() => {
    setEvalScore(null);
    if (!story?.id) return;
    fetch(`${API_BASE}/memories/eval-stories/${story.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.evaluation?.overall_score != null) setEvalScore(d.evaluation);
      })
      .catch(err => console.warn('eval score fetch failed:', err.message));
  }, [story?.id]);

  useEffect(() => {
    setActiveThreads([]);
    if (!story?.story_number || !selectedCharKey) return;
    fetch(`${API_BASE}/story-health/threads-for-story/${story.story_number}?character_key=${encodeURIComponent(selectedCharKey)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.threads) setActiveThreads(d.threads); })
      .catch(err => console.warn('thread fetch failed:', err.message));
  }, [story?.story_number, selectedCharKey]);

  if (!story && !task) return (
    <div className={`se-story-panel se-story-section${storiesMinimized ? ' se-story-section--minimized' : ''}`}>
      <div className="se-story-section-header" onClick={() => onToggleStoriesMinimized()} role="button" tabIndex={0}>
        <div className="se-story-section-title">Upcoming Stories</div>
        <div className="se-story-section-right">
          <div className="se-story-section-sub">Generated tasks appear here</div>
          <span className={`se-story-section-chevron${storiesMinimized ? ' se-chevron-collapsed' : ''}`}>▾</span>
        </div>
      </div>
      {!storiesMinimized && (
        <div className="se-story-section-empty">
          <div className="se-story-empty-icon">◎</div>
          <div className="se-story-empty-text">
            Once the arc is generated, individual story tasks will appear here.
          </div>
          <div className="se-story-skeletons">
            <div className="se-story-skeleton" />
            <div className="se-story-skeleton" />
            <div className="se-story-skeleton" />
          </div>
        </div>
      )}
    </div>
  );

  if (task && !story) return (
    <div className="se-story-panel se-story-brief">
      <div className="se-story-brief-header" style={{ borderColor: charColor }}>
        <div className="se-story-brief-num">Chapter {task.story_number}</div>
        <div className="se-story-brief-title">{task.title}</div>
        <div className="se-story-brief-phase" style={{ color: PHASE_COLORS[task.phase] || '#888' }}>
          {PHASE_LABELS[task.phase] || task.phase || '—'}
          {task.wound_clock != null && <> · Wound Clock {task.wound_clock}</>}
          {task.stakes_level != null && <> · Stakes {task.stakes_level}</>}
        </div>
      </div>
      {task.chapter_theme && (
        <div className="se-story-brief-field" style={{ marginBottom: 16 }}>
          <div className="se-story-brief-label">Chapter Theme</div>
          <div className="se-story-brief-value">{task.chapter_theme}</div>
        </div>
      )}
      {task.situations?.length > 0 && (
        <div className="se-situations-list">
          <div className="se-story-brief-label" style={{ marginBottom: 10 }}>
            Situations ({task.situations.length})
          </div>
          {task.situations.map((s, i) => {
            const isObj = typeof s === 'object';
            if (!isObj) return (
              <div key={i} className="se-situation-card">
                <div className="se-situation-header">
                  <span className="se-situation-num">{i + 1}</span>
                  <span className="se-situation-title">{s}</span>
                </div>
              </div>
            );
            return (
              <div key={i} className="se-situation-card">
                <div className="se-situation-header">
                  <span className="se-situation-num">{s.situation_number || i + 1}</span>
                  <span className="se-situation-title">{s.title || s.situation_type || `Situation ${i + 1}`}</span>
                  {s.tone && <span className="se-situation-tone">{s.tone}</span>}
                  {s.situation_type && s.title && (
                    <span className="se-situation-type">{s.situation_type.replace(/_/g, ' ')}</span>
                  )}
                </div>
                {s.what_happens && (
                  <div className="se-situation-body">{s.what_happens}</div>
                )}
                {(s.what_she_knows || s.what_she_doesnt_say) && (
                  <div className="se-situation-subtext">
                    {s.what_she_knows && <div><strong>She knows:</strong> {s.what_she_knows}</div>}
                    {s.what_she_doesnt_say && <div><strong>She doesn't say:</strong> {s.what_she_doesnt_say}</div>}
                  </div>
                )}
                {s.characters_present?.length > 0 && (
                  <div className="se-situation-chars">
                    {s.characters_present.map((c, ci) => (
                      <span key={ci} className="se-situation-char-tag">{c}</span>
                    ))}
                  </div>
                )}
                {s.opening_line && (
                  <div className="se-situation-opening">"{s.opening_line}"</div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {task.chapter_arc && (
        <div className="se-story-brief-field" style={{ marginTop: 16 }}>
          <div className="se-story-brief-label">Chapter Arc</div>
          <div className="se-story-brief-value">{task.chapter_arc}</div>
        </div>
      )}
      <div className="se-story-brief-grid" style={{ marginTop: 16 }}>
        {task.david_presence && (
          <div className="se-story-brief-field">
            <div className="se-story-brief-label">David</div>
            <div className="se-story-brief-value">{task.david_presence}</div>
          </div>
        )}
        {task.marcus_phase && task.marcus_phase !== 'none' && (
          <div className="se-story-brief-field">
            <div className="se-story-brief-label">Marcus</div>
            <div className="se-story-brief-value">{task.marcus_phase.replace(/_/g, ' ')}</div>
          </div>
        )}
      </div>
      {task.new_character && (
        <div className="se-story-brief-new-char">
          <span className="se-story-brief-label">New Character</span>
          <span>{task.new_character_name} — {task.new_character_role}</span>
        </div>
      )}
      <div style={{ padding: '16px 20px', borderTop: '1px solid #e8e4d8', display: 'flex', gap: 10 }}>
        <button
          className="se-btn"
          style={{ background: '#3D7A9B', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none' }}
          onClick={() => onEvaluate?.()}
          title="Evaluate with multi-voice scoring"
        >
          Evaluate
        </button>
      </div>
    </div>
  );

  const wordCount = editing
    ? editText.split(/\s+/).filter(Boolean).length
    : (story.word_count || 0);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await onEdit(story, editText);
      setSaveStatus('saved');
      setEditing(false);
    } catch (e) {
      setSaveStatus('unsaved');
    }
  };

  return (
    <div className={`se-story-panel ${readingMode ? 'se-reading-mode' : ''}`}>
      {editing ? (
        <div className="se-edit-header">
          <div className="se-edit-header-left">
            <button
              className="se-edit-back"
              onClick={() => { setEditing(false); setEditText(story.text); setSaveStatus('saved'); }}
            >
              ← Back to Story Engine
            </button>
            <div className="se-edit-header-info">
              <span className="se-edit-header-title">{story.title}</span>
              <span className="se-edit-header-dot">·</span>
              <span style={{ color: PHASE_COLORS[story.phase] }}>{PHASE_LABELS[story.phase]}</span>
              <span className="se-edit-header-dot">·</span>
              <span>{wordCount.toLocaleString()} words</span>
              <span className="se-edit-header-dot">·</span>
              <span>{getReadingTime(wordCount)}</span>
            </div>
          </div>
          <div className="se-edit-header-right">
            <div className="se-tts-controls">
              {!ttsPlaying && !ttsPaused && (
                <button className="se-btn se-btn-tts" onClick={handleTtsPlay} title="Read aloud">🔊</button>
              )}
              {ttsPlaying && (
                <button className="se-btn se-btn-tts se-btn-tts-active" onClick={handleTtsPause} title="Pause">⏸</button>
              )}
              {ttsPaused && (
                <button className="se-btn se-btn-tts" onClick={handleTtsPlay} title="Resume">▶</button>
              )}
              {(ttsPlaying || ttsPaused) && (
                <button className="se-btn se-btn-tts-stop" onClick={handleTtsStop} title="Stop">■</button>
              )}
            </div>
            <span className={`se-save-indicator se-save-${saveStatus}`}>
              {saveStatus === 'saved' ? 'Saved — your scene is evolving' : saveStatus === 'saving' ? 'Capturing your words…' : 'Unsaved changes'}
            </span>
            <button
              className="se-btn se-btn-save-primary"
              style={{ background: charColor }}
              onClick={handleSave}
            >
              Save
            </button>
            <button
              className="se-btn se-btn-cancel-light"
              onClick={() => { setEditing(false); setEditText(story.text); setSaveStatus('saved'); }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="se-story-header" style={{ borderBottomColor: charColor }}>
          <div className="se-story-header-left">
            <div className="se-story-nav-row">
              <button className="se-btn se-btn-nav" onClick={() => onNavigateStory?.(-1)} disabled={!hasPrev} title="Previous story (←)">‹ Prev</button>
              <div className="se-story-header-num">Story {story.story_number}</div>
              <button className="se-btn se-btn-nav" onClick={() => onNavigateStory?.(1)} disabled={!hasNext} title="Next story (→)">Next ›</button>
            </div>
            <div className="se-story-header-title">{story.title}</div>
            <div className="se-story-header-meta">
              <span style={{ color: PHASE_COLORS[story.phase] }}>{PHASE_LABELS[story.phase]}</span>
              <span className="se-header-arc-stage">
                {story.phase === 'establishment' ? 'Establishing' : story.phase === 'pressure' ? 'Rising' : story.phase === 'crisis' ? 'Breaking' : story.phase === 'integration' ? 'Resolving' : story.phase || '—'}
              </span>
              <span>·</span>
              <span>Chapter {story.story_number}</span>
              <span>·</span>
              <span>{story.word_count?.toLocaleString() || '—'} words</span>
              {story.word_count > 0 && (
                <>
                  <span>·</span>
                  <span className="se-reading-time">{getReadingTime(story.word_count)}</span>
                </>
              )}
            </div>
          </div>
          <div className="se-story-header-actions">
            <div className="se-mode-toggle">
              <button
                className={`se-mode-btn ${!readingMode ? 'active' : ''}`}
                onClick={() => { if (readingMode) onToggleReadingMode?.(); }}
              >
                Edit
              </button>
              <button
                className={`se-mode-btn ${readingMode ? 'active' : ''}`}
                onClick={() => { if (!readingMode) onToggleReadingMode?.(); }}
              >
                Read
              </button>
            </div>
            <div className="se-tts-controls">
              {!ttsPlaying && !ttsPaused && (
                <button className="se-btn se-btn-tts" onClick={handleTtsPlay} title="Read aloud">
                  🔊 Listen
                </button>
              )}
              {ttsPlaying && (
                <button className="se-btn se-btn-tts se-btn-tts-active" onClick={handleTtsPause} title="Pause reading">
                  ⏸ Pause
                </button>
              )}
              {ttsPaused && (
                <button className="se-btn se-btn-tts" onClick={handleTtsPlay} title="Resume reading">
                  ▶ Resume
                </button>
              )}
              {(ttsPlaying || ttsPaused) && (
                <button className="se-btn se-btn-tts-stop" onClick={handleTtsStop} title="Stop reading">■</button>
              )}
              {(ttsPlaying || ttsPaused) && (
                <select
                  className="se-tts-speed"
                  value={ttsRate}
                  onChange={(e) => {
                    const newRate = parseFloat(e.target.value);
                    setTtsRate(newRate);
                    handleTtsStop();
                    setTimeout(() => {
                      const synth = window.speechSynthesis;
                      const text = editing ? editText : (story?.text || '');
                      const u = new SpeechSynthesisUtterance(text);
                      u.rate = newRate;
                      const voices = synth.getVoices();
                      const pref = voices.find(v => v.name.includes('Natural') || v.name.includes('Online'))
                                || voices.find(v => v.lang.startsWith('en') && !v.localService)
                                || voices.find(v => v.lang.startsWith('en'));
                      if (pref) u.voice = pref;
                      u.onend = () => { setTtsPlaying(false); setTtsPaused(false); };
                      u.onerror = () => { setTtsPlaying(false); setTtsPaused(false); };
                      synth.speak(u);
                      setTtsPlaying(true);
                      setTtsPaused(false);
                    }, 100);
                  }}
                  title="Reading speed"
                >
                  <option value="0.5">0.5×</option>
                  <option value="0.75">0.75×</option>
                  <option value="1">1×</option>
                  <option value="1.25">1.25×</option>
                  <option value="1.5">1.5×</option>
                  <option value="2">2×</option>
                </select>
              )}
            </div>
            {!readingMode && (
              <>
                <button className="se-btn se-btn-export" onClick={() => onExportStory?.(story)} title="Copy or download story">Export</button>
                <button className="se-btn se-btn-edit" onClick={() => setEditing(true)}>Edit</button>
                <button className="se-btn se-btn-consistency" onClick={() => onCheckConsistency(story)} disabled={consistencyLoading}>
                  {consistencyLoading ? '…' : 'Check'}
                </button>
                <button className="se-btn se-btn-save-later" onClick={() => onSaveForLater(story)} disabled={savingForLater}>
                  {savingForLater ? 'Saving…' : 'Save Draft'}
                </button>
                <button className="se-btn se-btn-delete" style={{ color: '#c0392b' }} onClick={() => { if (window.confirm('Delete this story permanently?')) onDelete?.(story); }} title="Delete story">
                  Delete
                </button>
                <button className="se-btn" style={{ background: '#3D7A9B', color: '#fff' }} onClick={() => onEvaluate?.()} title="Evaluate with multi-voice scoring">
                  Evaluate
                </button>
                <button className="se-btn se-btn-approve" style={{ background: charColor }} onClick={() => onApprove(story, true)}>
                  {evalScore ? `Approve (${evalScore.overall_score})` : 'Approve'}
                </button>
                {evalScore && (
                  <div className="se-eval-badge" style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 6,
                    background: evalScore.overall_score >= 70 ? 'rgba(16,185,129,0.1)' : evalScore.overall_score >= 50 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                    color: evalScore.overall_score >= 70 ? '#059669' : evalScore.overall_score >= 50 ? '#d97706' : '#dc2626',
                    fontWeight: 600, marginLeft: -4,
                  }}>
                    {evalScore.overall_score >= 70 ? '✓ Strong' : evalScore.overall_score >= 50 ? '~ Fair' : '✕ Needs work'}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {story.new_character && story.new_character_name && (
        <div className="se-new-char-alert">
          <span className="se-new-char-icon">+</span>
          <span>New character introduced: <strong>{story.new_character_name}</strong> — {story.new_character_role}</span>
          <button className="se-new-char-approve" onClick={() => onAddToRegistry && onAddToRegistry(story)}>Add to Registry</button>
          <button className="se-new-char-reject" onClick={() => {}}>Story Only</button>
        </div>
      )}

      {consistencyConflicts?.length > 0 && (
        <div className="se-conflicts">
          <div className="se-conflicts-title">Downstream Conflicts</div>
          {consistencyConflicts.map((c, i) => (
            <div key={i} className={`se-conflict se-conflict-${c.severity}`}>
              <span className="se-conflict-story">Story {c.story_number}</span>
              <span className="se-conflict-type">{c.conflict_type}</span>
              <span className="se-conflict-desc">{c.description}</span>
            </div>
          ))}
        </div>
      )}

      {activeThreads.length > 0 && !editing && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 14px',
          background: 'rgba(176,146,46,0.04)', borderBottom: '1px solid var(--se-border-light)',
          fontSize: 11,
        }}>
          <span style={{ color: '#999', fontWeight: 600, marginRight: 4 }}>Active Threads:</span>
          {activeThreads.slice(0, 5).map(t => (
            <span key={t.id} style={{
              padding: '2px 8px', borderRadius: 10,
              background: t.thread_type === 'relationship' ? 'rgba(212,96,112,0.1)' :
                          t.thread_type === 'mystery' ? 'rgba(123,78,207,0.1)' :
                          'rgba(176,146,46,0.08)',
              color: t.thread_type === 'relationship' ? '#d46070' :
                     t.thread_type === 'mystery' ? '#7b4ecf' : '#8b7a2e',
              fontWeight: 500,
            }}>
              {t.title}
            </span>
          ))}
          {activeThreads.length > 5 && <span style={{ color: '#999' }}>+{activeThreads.length - 5} more</span>}
        </div>
      )}

      <div className="se-story-body">
        {editing ? (
          <div className="se-edit-layout">
            <div className="se-edit-canvas">
              <textarea
                ref={textareaRef}
                className="se-story-editor"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                spellCheck
              />
              {editTotalPages > 1 && (
                <div className="se-page-nav">
                  <button
                    className="se-btn se-btn-page"
                    onClick={() => {
                      setCurrentPage(p => {
                        const next = p - 1;
                        const ta = textareaRef.current;
                        if (ta) {
                          ta.setSelectionRange(editPageOffsets[next], editPageOffsets[next]);
                          const lineHeight = parseInt(getComputedStyle(ta).lineHeight) || 20;
                          const textBefore = editText.slice(0, editPageOffsets[next]);
                          const linesAbove = textBefore.split('\n').length - 1;
                          ta.scrollTop = linesAbove * lineHeight;
                        }
                        return next;
                      });
                    }}
                    disabled={currentPage === 0}
                  >
                    ← Previous
                  </button>
                  <span className="se-page-indicator">Page {currentPage + 1} of {editTotalPages}</span>
                  <button
                    className="se-btn se-btn-page"
                    onClick={() => {
                      setCurrentPage(p => {
                        const next = p + 1;
                        const ta = textareaRef.current;
                        if (ta) {
                          ta.setSelectionRange(editPageOffsets[next], editPageOffsets[next]);
                          const lineHeight = parseInt(getComputedStyle(ta).lineHeight) || 20;
                          const textBefore = editText.slice(0, editPageOffsets[next]);
                          const linesAbove = textBefore.split('\n').length - 1;
                          ta.scrollTop = linesAbove * lineHeight;
                        }
                        return next;
                      });
                    }}
                    disabled={currentPage >= editTotalPages - 1}
                  >
                    Next →
                  </button>
                </div>
              )}
              <BottomWritingTools
                story={story}
                charObj={charObj}
                selectedCharKey={selectedCharKey}
                activeWorld={activeWorld}
                charColor={charColor}
                currentProse={editText}
                onInsertText={(text) => {
                  const ta = textareaRef.current;
                  if (ta) {
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const before = editText.slice(0, start);
                    const after = editText.slice(end);
                    setEditText(before + text + after);
                    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + text.length; ta.focus(); }, 0);
                  } else {
                    setEditText(prev => prev + '\n\n' + text);
                  }
                }}
              />
            </div>

            <div className="se-writing-tools">
              <div className="se-tools-section">
                <div className="se-tools-section-title">Story Info</div>
                <div className="se-tools-info-grid">
                  <div className="se-tools-info-row">
                    <span className="se-tools-info-label">Type</span>
                    <span className="se-tools-info-value" style={{ color: PHASE_COLORS[story.phase] }}>{PHASE_LABELS[story.phase]}</span>
                  </div>
                  <div className="se-tools-info-row">
                    <span className="se-tools-info-label">Word Count</span>
                    <span className="se-tools-info-value">{wordCount.toLocaleString()}</span>
                  </div>
                  <div className="se-tools-info-row">
                    <span className="se-tools-info-label">Pages</span>
                    <span className="se-tools-info-value">{editTotalPages}</span>
                  </div>
                  <div className="se-tools-info-row">
                    <span className="se-tools-info-label">Reading Time</span>
                    <span className="se-tools-info-value">{getReadingTime(wordCount)}</span>
                  </div>
                </div>
              </div>

              <div className="se-tools-section se-tools-section-voices">
                <div
                  className="se-tools-section-title se-tools-section-collapsible"
                  onClick={() => setVoicesExpanded(v => !v)}
                >
                  <span>Narrative Perspective</span>
                  <span className={`se-tools-chevron ${voicesExpanded ? '' : 'se-tools-chevron-collapsed'}`}>▾</span>
                </div>
                <div className="se-tools-section-subtitle">Choose voice for AI edits</div>
                {selectedVoice && allCharacters?.[selectedVoice] && !voicesExpanded && (
                  <div className="se-voice-selected-summary">
                    <span className="se-voice-radio se-voice-radio-on" />
                    <span className="se-voice-name">{allCharacters[selectedVoice].display_name || selectedVoice}</span>
                    <span className="se-voice-active-label">Writing tone applied</span>
                  </div>
                )}
                {voicesExpanded && (
                  <div className="se-voice-list se-voice-list-scrollable">
                    {allCharacters && Object.entries(allCharacters).map(([key, c]) => (
                      <label
                        key={key}
                        className={`se-voice-option ${selectedVoice === key ? 'se-voice-active' : ''}`}
                        onClick={() => { setSelectedVoice(key); onSelectChar?.(key); }}
                      >
                        <span className={`se-voice-radio ${selectedVoice === key ? 'se-voice-radio-on' : ''}`} />
                        <span className="se-voice-name">{c.display_name || key}</span>
                        {selectedVoice === key && <span className="se-voice-active-label">Writing tone applied</span>}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="se-tools-section">
                <div className="se-tools-section-title">Creative Tools</div>
                <WriteModeAIWriter
                  chapterId={String(story?.story_number || task?.story_number || '')}
                  bookId={activeWorld || ''}
                  selectedCharacter={charObj ? {
                    id: charObj.id || selectedCharKey,
                    name: charObj.display_name || charName,
                    selected_name: charObj.display_name || charName,
                    type: charObj.role_type, role: charObj.role_type,
                    core_desire: charObj.core_desire, core_fear: charObj.core_fear,
                    core_wound: charObj.core_wound, description: charObj.description,
                  } : null}
                  currentProse={editText}
                  chapterContext={task ? {
                    scene_goal: task.task, theme: task.title,
                    emotional_arc_start: task.phase, emotional_arc_end: '', pov: charName || '',
                  } : {}}
                  onInsert={(text) => {
                    const ta = textareaRef.current;
                    if (ta) {
                      const start = ta.selectionStart;
                      const end = ta.selectionEnd;
                      const before = editText.slice(0, start);
                      const after = editText.slice(end);
                      setEditText(before + text + after);
                      setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + text.length; ta.focus(); }, 0);
                    } else {
                      setEditText(prev => prev + '\n\n' + text);
                    }
                  }}
                  getSelectedText={() => {
                    const ta = textareaRef.current;
                    if (ta && ta.selectionStart !== ta.selectionEnd) return editText.slice(ta.selectionStart, ta.selectionEnd);
                    return '';
                  }}
                  characters={allCharacters ? Object.entries(allCharacters).map(([key, c]) => ({
                    ...c, id: c.id || key, character_key: key, name: c.display_name,
                  })) : []}
                  onSelectCharacter={(c) => { setSelectedVoice(c?.character_key || c?.id); onSelectChar?.(c?.character_key || c?.id); }}
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="se-story-text" ref={storyBodyRef}>
              {(pages[currentPage] || []).map((para, i) => (
                para.trim()
                  ? <p key={i} className="se-story-para">{para}</p>
                  : <div key={i} className="se-story-spacer" />
              ))}
            </div>
            {/* Text selection popup */}
            {selectionPopup && !editing && (
              <div className="se-text-selection-popup" style={{ top: selectionPopup.top, left: selectionPopup.left, transform: 'translateX(-50%)' }}>
                <button className="se-text-selection-btn" onClick={() => { setEditing(true); setSelectionPopup(null); }}>Rewrite</button>
                <button className="se-text-selection-btn" onClick={() => { setEditing(true); setSelectionPopup(null); }}>Deepen</button>
                <button className="se-text-selection-btn" onClick={() => { setEditing(true); setSelectionPopup(null); }}>Change Tone</button>
              </div>
            )}
            {totalPages > 1 && (
              <div className="se-page-nav">
                <button className="se-btn se-btn-page" onClick={() => { setCurrentPage(p => p - 1); storyBodyRef.current?.scrollTo(0, 0); }} disabled={currentPage === 0}>‹ Prev</button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div className="se-chapter-timeline">
                    {Array.from({ length: Math.min(totalPages, 12) }, (_, i) => {
                      const pageIdx = totalPages <= 12 ? i : Math.round(i * (totalPages - 1) / 11);
                      return (
                        <React.Fragment key={i}>
                          {i > 0 && <div className={`se-timeline-connector${pageIdx <= currentPage ? ' completed' : ''}`} />}
                          <div
                            className={`se-timeline-dot${pageIdx === currentPage ? ' active' : pageIdx < currentPage ? ' completed' : ''}`}
                            onClick={() => { setCurrentPage(pageIdx); storyBodyRef.current?.scrollTo(0, 0); }}
                            style={{ cursor: 'pointer' }}
                            title={`Page ${pageIdx + 1}`}
                          />
                        </React.Fragment>
                      );
                    })}
                  </div>
                  <span className="se-page-indicator" style={{ fontSize: 11 }}>Page {currentPage + 1} of {totalPages}</span>
                </div>
                <button className="se-btn se-btn-page" onClick={() => { setCurrentPage(p => p + 1); storyBodyRef.current?.scrollTo(0, 0); }} disabled={currentPage >= totalPages - 1}>Next ›</button>
              </div>
            )}
          </>
        )}
      </div>

      {!editing && story && (
        <BottomWritingTools
          story={story}
          charObj={charObj}
          selectedCharKey={selectedCharKey}
          activeWorld={activeWorld}
          charColor={charColor}
          onInsertText={(text) => {
            setEditText((story.text || '') + '\n\n' + text);
            setEditing(true);
          }}
        />
      )}

      {!editing && therapyMemories?.length > 0 && (
        <div className="se-therapy-panel">
          <div className="se-therapy-title">Therapy Room Feeds</div>
          {therapyMemories.map((m, i) => (
            <div key={i} className="se-therapy-memory">
              <span className="se-therapy-category">{m.category?.replace(/_/g, ' ')}</span>
              <span className="se-therapy-statement">{m.statement}</span>
            </div>
          ))}
          {therapyLoading && <div className="se-therapy-loading">Extracting memories…</div>}
        </div>
      )}

      {!editing && selectedCharKey && <TherapySuggestions characterKey={selectedCharKey} apiBase={API_BASE} />}

      {!editing && registryUpdate && (
        <div className="se-registry-update">
          <span className="se-registry-icon">🔄</span>
          <span className="se-registry-text">{registryUpdate}</span>
        </div>
      )}

      {story && !editing && (
        <StoryReviewPanel
          story={story}
          characterKey={story.character_key}
          taskBrief={task}
          charColor={charColor}
          onApproved={(saved) => { console.log('Story approved & persisted', saved.id); onApprove(story); }}
          onRejected={(saved) => { console.log('Story rejected & persisted', saved.id); onReject(story); }}
          onSaved={(saved) => { console.log('Story saved', saved.id); }}
        />
      )}
    </div>
  );
}

// ─── Main StoryEngine component ───────────────────────────────────────────────
export default function StoryEngine() {
  const navigate = useNavigate();
  const engine = useStoryEngine();

  // --- Keyboard shortcuts (#5) ---
  useKeyboardShortcuts(useMemo(() => ({
    'ArrowUp':    () => engine.navigateStory(-1),
    'ArrowDown':  () => engine.navigateStory(1),
    'f':          () => engine.setReadingMode(prev => !prev),
    'Escape':     () => engine.setReadingMode(false),
    'ctrl+s':     () => { if (engine.activeStory) engine.handleSaveForLater(engine.activeStory); },
    'ctrl+Enter': () => { if (engine.activeStory) engine.setApproveConfirm(engine.activeStory); },
  }), [engine.navigateStory, engine.activeStory, engine.handleSaveForLater, engine.setReadingMode, engine.setApproveConfirm]));

  return (
    <div className={`se-page ${engine.readingMode ? 'se-fullscreen-reading' : ''} ${engine.writeMode ? 'se-write-mode' : ''}`}>
      <ToastContainer toasts={engine.toasts} onDismiss={engine.dismissToast} />

      {/* ── Header ── */}
      {!engine.readingMode && (
        <header className="se-header">
          <div className="se-header-nav">
            <button className="se-header-back" onClick={() => navigate('/')}>←</button>
            <span className="se-header-breadcrumb">
              Story Engine
              {engine.char?.world && <span className="se-header-world"> · {WORLD_LABELS[engine.char.world] || engine.char.world}</span>}
            </span>
          </div>
          {engine.activeStory && (
            <div className="se-header-story">
              <span className="se-header-title">{engine.activeStory.title}</span>
              <span className="se-header-phase" style={{ color: PHASE_COLORS[engine.activeStory.phase] }}>
                {PHASE_LABELS[engine.activeStory.phase]}
              </span>
              <span className="se-header-chapter">Chapter {engine.activeStory.story_number}</span>
              <span className="se-header-words">{engine.activeStory.word_count?.toLocaleString()} words</span>
              {engine.activeStory.word_count > 0 && (
                <span className="se-header-reading-time">{getReadingTime(engine.activeStory.word_count)}</span>
              )}
            </div>
          )}
          <div className="se-header-actions">
            {engine.activeStory && !engine.writeMode && (
              <>
                <button
                  className="se-header-btn se-header-btn--evaluate"
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (engine.activeStory?.text) params.set('text', '1');
                    const charData = engine.selectedChar && engine.CHARACTERS[engine.selectedChar];
                    const world = charData?.world;
                    // Collect characters from task situations + world characters
                    const sitChars = new Set();
                    if (engine.activeTask?.situations?.length) {
                      engine.activeTask.situations.forEach(s => {
                        (s.characters_present || []).forEach(c => sitChars.add(c));
                      });
                    }
                    const worldChars = world ? Object.keys(engine.CHARACTERS).filter(k => engine.CHARACTERS[k].world === world) : engine.selectedChar ? [engine.selectedChar] : [];
                    worldChars.forEach(c => sitChars.add(c));
                    const sceneChars = [...sitChars];
                    if (sceneChars.length) params.set('chars', sceneChars.join(','));
                    if (charData?.registry_id) params.set('registry_id', charData.registry_id);
                    const charNames = {};
                    sceneChars.forEach(k => { charNames[k] = engine.CHARACTERS[k]?.display_name || k; });
                    navigate(`/story-evaluation?${params.toString()}`, {
                      state: { storyText: engine.activeStory?.text, taskBrief: engine.activeTask, activeWorld: engine.activeWorld || world, charNames, povChar: engine.selectedChar },
                    });
                  }}
                >
                  Evaluate
                </button>
                <button className="se-header-btn se-header-btn--approve" style={{ background: engine.char?.color }} onClick={() => engine.setApproveConfirm(engine.activeStory)}>
                  Approve
                </button>
                <button className="se-header-btn se-header-btn--reject" onClick={() => engine.handleReject(engine.activeStory)}>
                  Reject
                </button>
                <div className="se-more-wrap">
                  <button className="se-header-btn se-header-btn--more" onClick={() => engine.setMoreMenuOpen(v => !v)}>···</button>
                  {engine.moreMenuOpen && (
                    <div className="se-more-dropdown" onClick={() => engine.setMoreMenuOpen(false)}>
                      <button onClick={() => engine.handleExportStory(engine.activeStory)}>Export</button>
                      <button onClick={() => engine.handleSaveForLater(engine.activeStory)}>Save Draft</button>
                      <button onClick={() => engine.handleCheckConsistency(engine.activeStory)}>Check Consistency</button>
                      <button onClick={() => engine.setReadingMode(prev => !prev)}>Reading Mode</button>
                      <button style={{ color: '#c0392b' }} onClick={() => { if (window.confirm('Delete this story permanently?')) engine.handleDelete(engine.activeStory); }}>Delete</button>
                    </div>
                  )}
                </div>
              </>
            )}
            <button className="se-mobile-toggle" onClick={() => engine.setMobileNav(v => !v)} title="Story list">☰</button>
            <button className="se-mobile-toggle" onClick={() => engine.setMobileInspector(v => !v)} title="Inspector">ℹ</button>
          </div>
        </header>
      )}

      {/* ── Three-panel body ── */}
      <div className="se-panels">
        {/* Left: Story Navigator */}
        {!engine.readingMode && (
          <StoryNavigator
            CHARACTERS={engine.CHARACTERS}
            charsLoading={engine.charsLoading}
            selectedChar={engine.selectedChar}
            setSelectedChar={engine.setSelectedChar}
            char={engine.char}
            approvedStories={engine.approvedStories}
            savedStories={engine.savedStories}
            stories={engine.stories}
            tasks={engine.tasks}
            tasksLoading={engine.tasksLoading}
            filteredTasks={engine.filteredTasks}
            activeTask={engine.activeTask}
            generation={engine.generation}
            handleGenerateArc={engine.handleGenerateArc}
            handleGenerate={engine.handleGenerate}
            handleGenerateNextChapter={engine.handleGenerateNextChapter}
            generatingNextChapter={engine.generatingNextChapter}
            handleSelectTask={engine.handleSelectTask}
            phaseFilter={engine.phaseFilter}
            setPhaseFilter={engine.setPhaseFilter}
            searchQuery={engine.searchQuery}
            setSearchQuery={engine.setSearchQuery}
            batchMode={engine.batchMode}
            setBatchMode={engine.setBatchMode}
            batchSelected={engine.batchSelected}
            setBatchSelected={engine.setBatchSelected}
            handleBatchApprove={engine.handleBatchApprove}
            handleBatchToggle={engine.handleBatchToggle}
            mobileNav={engine.mobileNav}
            setMobileNav={engine.setMobileNav}
            elapsed={engine.generation.elapsed}
            arcProgress={engine.arcProgress}
          />
        )}

        {/* Center: Writing Canvas */}
        <main className="se-canvas">
          {engine.generation.generating && engine.generation.generatingNum === engine.activeTask?.story_number ? (
            <div className="se-canvas-generating">
              <div className="se-generating-ring" style={{ borderTopColor: engine.char?.color }} />
              <div className="se-generating-title">Writing Story {engine.generation.generatingNum}…</div>
              <div className="se-generating-sub">{engine.char?.display_name}'s world is assembling itself.</div>
              <div className="se-generating-elapsed">{engine.generation.elapsed}s · typically 1–2 minutes</div>
            </div>
          ) : engine.tasksLoading && engine.arcProgress ? (
            /* Arc generation in progress — show full status bar in canvas */
            <div className="se-canvas-hero">
              <div className="se-hero-icon" style={{ color: engine.char?.color }}>{engine.char?.icon || '◇'}</div>
              <div className="se-hero-title">Building {engine.char?.display_name ? `${engine.char.display_name}'s` : 'your'} story arc</div>
              <ArcGenerationStatus
                arcProgress={engine.arcProgress}
                charColor={engine.char?.color}
                elapsed={engine.generation.elapsed}
              />
            </div>
          ) : engine.generatingNextChapter ? (
            <div className="se-canvas-generating">
              <div className="se-generating-ring" style={{ borderTopColor: engine.char?.color }} />
              <div className="se-generating-title">Generating Chapter {engine.tasks.length + 1} Brief…</div>
              <div className="se-generating-sub">Building on {engine.tasks.length} previous {engine.tasks.length === 1 ? 'chapter' : 'chapters'}.</div>
            </div>
          ) : !engine.tasksLoading && engine.tasks.length === 0 && !engine.activeStory ? (
            <div className="se-canvas-hero">
              <div className="se-hero-icon" style={{ color: engine.char?.color }}>{engine.char?.icon || '◇'}</div>
              <div className="se-hero-title">Begin {engine.char?.display_name ? `${engine.char.display_name}'s` : 'your'} story</div>
              <div className="se-hero-text">
                Generate chapter briefs one at a time. Each new chapter builds on the ones before it.
              </div>
              <button className="se-hero-btn" style={{ background: engine.char?.color || '#b0922e' }} onClick={() => engine.handleGenerateNextChapter()} disabled={engine.generatingNextChapter}>
                Generate Chapter 1
              </button>
              <div className="se-hero-sub">Typically 15–30 seconds per chapter</div>
            </div>
          ) : (
            <StoryPanel
              story={engine.activeStory}
              task={engine.activeTask}
              charColor={engine.char?.color}
              charName={engine.char?.display_name}
              onApprove={(story, needsConfirm) => needsConfirm ? engine.setApproveConfirm(story) : engine.handleApprove(story)}
              onReject={engine.handleReject}
              onEdit={engine.handleEdit}
              onCheckConsistency={engine.handleCheckConsistency}
              onSaveForLater={engine.handleSaveForLater}
              savingForLater={engine.savingForLater}
              consistencyConflicts={engine.consistencyConflicts}
              consistencyLoading={engine.consistencyLoading}
              therapyMemories={engine.therapyMemories}
              therapyLoading={engine.therapyLoading}
              onAddToRegistry={engine.handleAddToRegistry}
              registryUpdate={engine.registryUpdate}
              readingMode={engine.readingMode}
              onToggleReadingMode={() => engine.setReadingMode(prev => !prev)}
              writeMode={engine.writeMode}
              onToggleWriteMode={(v) => engine.setWriteMode(typeof v === 'boolean' ? v : !engine.writeMode)}
              onNavigateStory={engine.navigateStory}
              hasPrev={engine.hasPrevStory}
              hasNext={engine.hasNextStory}
              onExportStory={engine.handleExportStory}
              onDelete={engine.handleDelete}
              onEvaluate={(storyOrTask) => {
                const params = new URLSearchParams();
                if (engine.activeStory?.text) params.set('text', '1');
                const brief = storyOrTask?.task || engine.activeTask?.task;
                if (brief) params.set('brief', brief);
                const charData = engine.selectedChar && engine.CHARACTERS[engine.selectedChar];
                const world = charData?.world;
                const sceneChars = world ? Object.keys(engine.CHARACTERS).filter(k => engine.CHARACTERS[k].world === world) : engine.selectedChar ? [engine.selectedChar] : [];
                if (sceneChars.length) params.set('chars', sceneChars.join(','));
                if (charData?.registry_id) params.set('registry_id', charData.registry_id);
                const charNames = {};
                sceneChars.forEach(k => { charNames[k] = engine.CHARACTERS[k]?.display_name || k; });
                navigate(`/story-evaluation?${params.toString()}`, {
                  state: { storyText: engine.activeStory?.text, taskBrief: storyOrTask || engine.activeTask, activeWorld: engine.activeWorld || world, charNames, povChar: engine.selectedChar },
                });
              }}
              charObj={engine.char}
              selectedCharKey={engine.selectedChar}
              activeWorld={engine.activeWorld}
              allCharacters={engine.CHARACTERS}
              onSelectChar={engine.setSelectedChar}
              storiesMinimized={engine.storiesMinimized}
              onToggleStoriesMinimized={() => engine.setStoriesMinimized(m => !m)}
            />
          )}
        </main>

        {/* Right: Inspector */}
        {!engine.readingMode && (
          <StoryInspector
            activeTask={engine.activeTask}
            activeStory={engine.activeStory}
            selectedChar={engine.selectedChar}
            char={engine.char}
            tasks={engine.tasks}
            stories={engine.stories}
            approvedStories={engine.approvedStories}
            savedStories={engine.savedStories}
            consistencyConflicts={engine.consistencyConflicts}
            worldToggles={engine.worldToggles}
            handleWorldToggle={engine.handleWorldToggle}
            writeMode={engine.writeMode}
            setWriteMode={engine.setWriteMode}
            readingMode={engine.readingMode}
            setReadingMode={engine.setReadingMode}
            handleSaveForLater={engine.handleSaveForLater}
            savingForLater={engine.savingForLater}
            setApproveConfirm={engine.setApproveConfirm}
            handleReject={engine.handleReject}
            mobileInspector={engine.mobileInspector}
          />
        )}
      </div>

      {/* Mobile backdrop */}
      {(engine.mobileNav || engine.mobileInspector) && (
        <div className="se-drawer-backdrop" onClick={() => { engine.setMobileNav(false); engine.setMobileInspector(false); }} />
      )}

      {/* Amber notification — scene eligibility */}
      {engine.amberNotification?.type === 'scene_eligible' && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, width: 340,
          background: '#fff', border: '1px solid #e8dcf5', borderRadius: 14,
          boxShadow: '0 8px 32px rgba(168,137,200,0.18)', padding: '16px 18px',
          zIndex: 500, animation: 'ws-slide-up 0.22s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #d4789a, #a889c8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: '#fff', fontWeight: 700,
            }}>A</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Amber</div>
              <div style={{ fontSize: 10, color: '#9999b3' }}>Story {engine.amberNotification.story_number} approved</div>
            </div>
            <button onClick={() => engine.setAmberNotification(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#9999b3', fontSize: 16 }}>×</button>
          </div>
          <div style={{ fontSize: 12, color: '#5a5a7a', lineHeight: 1.6, marginBottom: 12 }}>
            <strong style={{ color: '#1a1a2e' }}>
              {engine.amberNotification.eligibility.charA.name}
              {engine.amberNotification.eligibility.charB ? ` & ${engine.amberNotification.eligibility.charB.name}` : ''}
            </strong>
            {' '}— this story ends at a door.{' '}
            <span style={{ color: '#a889c8' }}>{engine.amberNotification.eligibility.scene_type?.replace(/_/g, ' ')}</span>
            {' '}· intensity: <span style={{ color: '#d4789a' }}>{engine.amberNotification.eligibility.intensity}</span>
            {engine.amberNotification.eligibility.location && <span style={{ color: '#7ab3d4' }}> · {engine.amberNotification.eligibility.location}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { navigate('/scene-studio', { state: { autoPopulate: engine.amberNotification.eligibility } }); engine.setAmberNotification(null); }}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: '#a889c8', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              Generate Scene
            </button>
            <button onClick={() => engine.setAmberNotification(null)}
              style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', color: '#9999b3', border: '1px solid #e8e0f0', cursor: 'pointer', fontSize: 12 }}>
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Approval confirmation modal */}
      {engine.approveConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => engine.setApproveConfirm(null)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', width: 380, boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>
              Approve Story {engine.approveConfirm.story_number}?
            </div>
            <div style={{ fontSize: 13, color: '#5a5a7a', marginBottom: 16, lineHeight: 1.6 }}>
              "{engine.approveConfirm.title}" — This will extract memories, update registry, generate texture layers, and check scene eligibility.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => engine.setApproveConfirm(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e0dcd4', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#666' }}>
                Cancel
              </button>
              <button onClick={() => { engine.handleApprove(engine.approveConfirm); engine.setApproveConfirm(null); }}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: engine.char?.color || '#9a7d1e', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch progress indicator */}
      {engine.batchProgress && (
        <div style={{
          position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: '#fff', border: '1px solid #e0dcd4', borderRadius: 10,
          padding: '10px 20px', zIndex: 550, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', gap: 12, fontSize: 13,
        }}>
          <div className="se-spinner" style={{ width: 16, height: 16, borderTopColor: engine.char?.color }} />
          <span>Approving {engine.batchProgress.current}/{engine.batchProgress.total}…</span>
          <div style={{ width: 80, height: 4, background: '#eee', borderRadius: 2 }}>
            <div style={{ width: `${(engine.batchProgress.current / engine.batchProgress.total) * 100}%`, height: '100%', background: engine.char?.color || '#9a7d1e', borderRadius: 2, transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

      {/* Batch generation progress */}
      {engine.generation.batchGenProgress && (
        <div style={{
          position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: '#1c1917', color: '#faf8f4', border: '1px solid #333',
          borderRadius: 10, padding: '10px 20px', zIndex: 550,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, maxWidth: 420,
        }}>
          <div className="se-spinner" style={{ width: 16, height: 16, borderTopColor: engine.char?.color || '#b0922e' }} />
          <div>
            <div style={{ fontWeight: 600 }}>Generating {engine.generation.batchGenProgress.current}/{engine.generation.batchGenProgress.total}</div>
            {engine.generation.batchGenProgress.currentTitle && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{engine.generation.batchGenProgress.currentTitle}</div>}
          </div>
          <div style={{ width: 80, height: 4, background: '#333', borderRadius: 2, marginLeft: 'auto' }}>
            <div style={{ width: `${(engine.generation.batchGenProgress.current / engine.generation.batchGenProgress.total) * 100}%`, height: '100%', background: engine.char?.color || '#b0922e', borderRadius: 2, transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

      {/* Undo rejected story */}
      {engine.rejectedStory && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a2e', color: '#fff', borderRadius: 10,
          padding: '10px 16px', zIndex: 550, display: 'flex', alignItems: 'center', gap: 12,
          fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}>
          <span>Story {engine.rejectedStory.story.story_number} rejected</span>
          <button onClick={engine.handleUndoReject}
            style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            Undo
          </button>
        </div>
      )}

      {/* Inline texture preview */}
      {engine.lastTexture && !engine.amberTextureNotes && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, width: 360,
          background: '#fff', border: '1px solid #e8dcf5', borderRadius: 14,
          boxShadow: '0 8px 32px rgba(168,137,200,0.18)', padding: '16px 18px',
          zIndex: 498, maxHeight: '50vh', overflowY: 'auto', animation: 'ws-slide-up 0.22s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Texture — Story {engine.lastTexture.story_number}</div>
            <button onClick={() => engine.setLastTexture(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#9999b3', fontSize: 16 }}>&times;</button>
          </div>
          {engine.lastTexture.texture?.inner_thought_text && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#b0922e', marginBottom: 4 }}>Inner Thought ({engine.lastTexture.texture.inner_thought_type?.replace('_', ' ')})</div>
              <div style={{ fontSize: 12, color: '#3a3a5a', lineHeight: 1.6, fontStyle: 'italic' }}>{engine.lastTexture.texture.inner_thought_text.slice(0, 200)}{engine.lastTexture.texture.inner_thought_text.length > 200 ? '…' : ''}</div>
            </div>
          )}
          {engine.lastTexture.texture?.body_narrator_text && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#d4789a', marginBottom: 4 }}>Body Narrator</div>
              <div style={{ fontSize: 12, color: '#3a3a5a', lineHeight: 1.6 }}>{engine.lastTexture.texture.body_narrator_text}</div>
            </div>
          )}
          {engine.lastTexture.texture?.conflict_surface_text && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#c0392b', marginBottom: 4 }}>Conflict</div>
              <div style={{ fontSize: 12, color: '#3a3a5a', lineHeight: 1.6 }}>{engine.lastTexture.texture.conflict_surface_text}</div>
            </div>
          )}
          {engine.lastTexture.texture?.private_moment_text && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7c3aed', marginBottom: 4 }}>Private Moment</div>
              <div style={{ fontSize: 12, color: '#3a3a5a', lineHeight: 1.6 }}>{engine.lastTexture.texture.private_moment_text.slice(0, 200)}{engine.lastTexture.texture.private_moment_text.length > 200 ? '…' : ''}</div>
            </div>
          )}
          {engine.lastTexture.texture?.post_text && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0d9668', marginBottom: 4 }}>Post ({engine.lastTexture.texture.post_platform})</div>
              <div style={{ fontSize: 12, color: '#3a3a5a', lineHeight: 1.6 }}>{engine.lastTexture.texture.post_text}</div>
            </div>
          )}
          {engine.lastTexture.texture?.bleed_text && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#546678', marginBottom: 4 }}>Bleed</div>
              <div style={{ fontSize: 12, color: '#3a3a5a', lineHeight: 1.6 }}>{engine.lastTexture.texture.bleed_text}</div>
            </div>
          )}
          <button onClick={() => { navigate(`/texture-review/${engine.lastTexture.story_number}?char=${engine.selectedChar}`); engine.setLastTexture(null); }}
            style={{ width: '100%', padding: '8px 0', borderRadius: 8, background: '#a889c8', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, marginTop: 4 }}>
            Full Texture Review
          </button>
        </div>
      )}

      {/* Amber texture notes */}
      {engine.amberTextureNotes && (
        <div style={{
          position: 'fixed', bottom: engine.amberNotification ? 220 : 24, right: 24, width: 360,
          background: '#fff', border: '1px solid #e8dcf5', borderRadius: 14,
          boxShadow: '0 8px 32px rgba(168,137,200,0.18)', padding: '16px 18px',
          zIndex: 499, animation: 'ws-slide-up 0.22s ease', maxHeight: '60vh', overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #d4789a, #a889c8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: '#fff', fontWeight: 700,
            }}>A</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Amber read Story {engine.amberTextureNotes.story_number}</div>
              <div style={{ fontSize: 10, color: '#9999b3' }}>"{engine.amberTextureNotes.story_title}"</div>
            </div>
            <button onClick={() => engine.setAmberTextureNotes(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#9999b3', fontSize: 16 }}>&times;</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {engine.amberTextureNotes.notes.map((note, i) => (
              <div key={i} style={{
                padding: '10px 12px',
                background: note.type === 'warning' ? '#fdf0f4' : note.type === 'contradiction' ? '#f6f1fc' : note.type === 'opportunity' ? '#f0f8fd' : '#fafafa',
                borderRadius: 8,
                border: `1px solid ${note.type === 'warning' ? '#f5dce6' : note.type === 'contradiction' ? '#e8dcf5' : note.type === 'opportunity' ? '#daeef9' : '#f2eef8'}`,
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: note.type === 'warning' ? '#d4789a' : note.type === 'contradiction' ? '#a889c8' : note.type === 'opportunity' ? '#7ab3d4' : '#9999b3',
                  marginBottom: 4,
                }}>{note.type}</div>
                <div style={{ fontSize: 12, color: '#3a3a5a', lineHeight: 1.6 }}>{note.note}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => { navigate(`/texture-review/${engine.amberTextureNotes.story_number}?char=${engine.selectedChar}`); engine.setAmberTextureNotes(null); }}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: '#a889c8', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              Review Texture
            </button>
            <button onClick={() => engine.setAmberTextureNotes(null)}
              style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', color: '#9999b3', border: '1px solid #e8e0f0', cursor: 'pointer', fontSize: 12 }}>
              Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
