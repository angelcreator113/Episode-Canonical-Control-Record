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
    <div className="se-therapy-suggestions">
      <div
        className="se-therapy-suggestions-header"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="se-therapy-suggestions-title">
          Story Suggestions ({suggestions.suggestions.length})
        </span>
        <span className="se-therapy-suggestions-chevron">{expanded ? '▾' : '▸'}</span>
      </div>
      {expanded && (
        <div className="se-therapy-suggestions-list">
          {suggestions.suggestions.map((s, i) => (
            <div key={s.title || i} className="se-therapy-suggestion-item">
              <span
                className="se-therapy-suggestion-dot"
                style={{
                  background: s.priority === 'high' ? '#ef4444' : s.priority === 'medium' ? '#f59e0b' : '#999',
                }}
              />
              <div>
                <div className="se-therapy-suggestion-name">{s.title}</div>
                <div className="se-therapy-suggestion-desc">{s.description}</div>
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
          <div className="se-bottom-tools-group-label"><span className="se-bottom-tools-group-icon" aria-hidden="true">✨</span> Writing Flow</div>
          <div className="se-bottom-tools-row" role="group" aria-label="Writing flow tools">
            {flowTools.map(tool => (
              <button
                key={tool.id}
                className={`se-bottom-tool-pill${activeAction === tool.id ? ' active' : ''}`}
                style={{ '--tool-accent': accent }}
                onClick={() => runTool(tool)}
                disabled={loading}
                aria-label={tool.label}
                aria-busy={loading && activeAction === tool.id}
              >
                <span className="se-bottom-tool-icon" aria-hidden="true">{tool.icon}</span>
                <span className="se-bottom-tool-label">
                  {tool.label}
                  {loading && activeAction === tool.id && <span className="se-bottom-tool-spinner" role="status" aria-live="polite"> {tool.spinner}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="se-bottom-tools-group">
          <div className="se-bottom-tools-group-label"><span className="se-bottom-tools-group-icon" aria-hidden="true">🎯</span> Refinement</div>
          <div className="se-bottom-tools-row" role="group" aria-label="Refinement tools">
            {refinementTools.map(tool => (
              <button
                key={tool.id}
                className={`se-bottom-tool-pill${activeAction === tool.id ? ' active' : ''}`}
                style={{ '--tool-accent': accent }}
                onClick={() => runTool(tool)}
                disabled={loading}
                aria-label={tool.label}
                aria-busy={loading && activeAction === tool.id}
              >
                <span className="se-bottom-tool-icon" aria-hidden="true">{tool.icon}</span>
                <span className="se-bottom-tool-label">
                  {tool.label}
                  {loading && activeAction === tool.id && <span className="se-bottom-tool-spinner" role="status" aria-live="polite"> {tool.spinner}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="se-bottom-tools-length" role="group" aria-label="Output length">
        <button
          className={`se-bottom-length-pill${lengthMode === 'full' ? ' active' : ''}`}
          style={{ '--tool-accent': accent }}
          onClick={() => setLengthMode('full')}
          aria-pressed={lengthMode === 'full'}
          title="Generate full-length content"
        >¶ full</button>
        <button
          className={`se-bottom-length-pill${lengthMode === 'paragraph' ? ' active' : ''}`}
          style={{ '--tool-accent': accent }}
          onClick={() => setLengthMode('paragraph')}
          aria-pressed={lengthMode === 'paragraph'}
          title="Generate paragraph-length content"
        >¶ Paragraphs</button>
      </div>

      {error && <div className="se-bottom-tools-error" role="alert" aria-live="assertive">{error}</div>}

      {result && (
        <div className="se-bottom-tools-result" role="region" aria-label="Generated content" aria-live="polite">
          <div className="se-bottom-tools-result-header">
            <span className="se-bottom-tools-result-title">Generated</span>
            <div className="se-bottom-tools-result-actions">
              <button className="se-bottom-tools-result-btn" onClick={() => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 3000); }} aria-live="polite">
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
              <button className="se-bottom-tools-result-btn se-bottom-tools-result-btn--insert" style={{ background: accent, color: '#fff' }} onClick={() => { onInsertText?.(result); setResult(null); }}>
                Insert into story
              </button>
              <button className="se-bottom-tools-result-btn" onClick={() => setResult(null)} aria-label="Dismiss generated content">Dismiss</button>
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
  story, task, charColor, charName, totalChapters,
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
  focusMode, onToggleFocusMode,
}) {
  const editing = writeMode;
  const setEditing = onToggleWriteMode;
  const [editText, setEditTextRaw] = useState(story?.text || '');
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const [lastSavedText, setLastSavedText] = useState(story?.text || '');
  const [selectedVoice, setSelectedVoice] = useState(selectedCharKey || null);
  const [voicesExpanded, setVoicesExpanded] = useState(false);

  // Undo/redo history for AI insertions and edits
  const undoStackRef = useRef([story?.text || '']);
  const redoStackRef = useRef([]);
  const lastSnapshotRef = useRef(Date.now());

  const setEditText = useCallback((valOrFn) => {
    setEditTextRaw(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      // Snapshot every 3 seconds of typing, or immediately for AI insertions (large changes)
      const now = Date.now();
      const isLargeChange = Math.abs(next.length - prev.length) > 20;
      if (isLargeChange || now - lastSnapshotRef.current > 3000) {
        undoStackRef.current.push(prev);
        if (undoStackRef.current.length > 50) undoStackRef.current.shift();
        redoStackRef.current = [];
        lastSnapshotRef.current = now;
      }
      return next;
    });
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    setEditTextRaw(prev => {
      redoStackRef.current.push(prev);
      return undoStackRef.current.pop();
    });
  }, []);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    setEditTextRaw(prev => {
      undoStackRef.current.push(prev);
      return redoStackRef.current.pop();
    });
  }, []);

  // ── Text-to-Speech state (ElevenLabs with browser fallback) ──
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsPaused, setTtsPaused] = useState(false);
  const [ttsRate, setTtsRate] = useState(1);
  const [ttsLoading, setTtsLoading] = useState(false);
  const ttsUtteranceRef = useRef(null);
  const ttsAudioRef = useRef(null);
  const ttsUsingElevenLabs = useRef(false);

  const handleTtsPlay = useCallback(async () => {
    const text = editing ? editText : (story?.text || '');
    if (!text.trim()) return;

    // Resume if paused
    if (ttsPaused) {
      if (ttsUsingElevenLabs.current && ttsAudioRef.current) {
        ttsAudioRef.current.play();
      } else {
        window.speechSynthesis?.resume();
      }
      setTtsPaused(false);
      setTtsPlaying(true);
      return;
    }

    // Stop any existing playback
    handleTtsStop();

    // Try ElevenLabs first
    setTtsLoading(true);
    try {
      const res = await fetch('/api/v1/amber/read-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.playbackRate = ttsRate;
        audio.onended = () => { setTtsPlaying(false); setTtsPaused(false); URL.revokeObjectURL(url); };
        audio.onerror = () => { setTtsPlaying(false); setTtsPaused(false); URL.revokeObjectURL(url); };
        ttsAudioRef.current = audio;
        ttsUsingElevenLabs.current = true;
        setTtsLoading(false);
        audio.play();
        setTtsPlaying(true);
        setTtsPaused(false);
        return;
      }
    } catch {
      // ElevenLabs unavailable — fall through to browser TTS
    }

    // Browser TTS fallback
    setTtsLoading(false);
    ttsUsingElevenLabs.current = false;
    const synth = window.speechSynthesis;
    if (!synth) return;

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = ttsRate;
    utterance.pitch = 1;

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
    if (ttsUsingElevenLabs.current && ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      setTtsPaused(true);
      setTtsPlaying(false);
    } else {
      const synth = window.speechSynthesis;
      if (synth?.speaking) {
        synth.pause();
        setTtsPaused(true);
        setTtsPlaying(false);
      }
    }
  }, []);

  const handleTtsStop = useCallback(() => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
      if (ttsAudioRef.current.src) URL.revokeObjectURL(ttsAudioRef.current.src);
      ttsAudioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    ttsUsingElevenLabs.current = false;
    setTtsPlaying(false);
    setTtsPaused(false);
    setTtsLoading(false);
  }, []);

  // Cleanup TTS on unmount or story change
  useEffect(() => {
    return () => {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        if (ttsAudioRef.current.src) URL.revokeObjectURL(ttsAudioRef.current.src);
        ttsAudioRef.current = null;
      }
      window.speechSynthesis?.cancel();
    };
  }, [story?.story_number]);

  useEffect(() => {
    if (selectedCharKey) setSelectedVoice(selectedCharKey);
  }, [selectedCharKey]);

  useEffect(() => {
    setSaveStatus('idle');
    setLastSavedText(story?.text || '');
  }, [story?.story_number]);

  const hasUnsavedChanges = editing && editText !== lastSavedText;

  const [currentPage, setCurrentPage] = useState(0);
  const [evalScore, setEvalScore] = useState(null);
  const [activeThreads, setActiveThreads] = useState([]);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [selectionPopup, setSelectionPopup] = useState(null);
  const [activeParaIndex, setActiveParaIndex] = useState(null);
  const textareaRef = useRef(null);
  const storyBodyRef = useRef(null);
  const aiWriterRef = useRef(null);
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
    // Only reset editor text when navigating to a different story,
    // NOT when the same story object updates after a save.
    const storyNum = story?.story_number;
    const isNewStory = prevStoryRef.current != null && prevStoryRef.current !== storyNum;
    if (isNewStory) {
      if (onToggleWriteMode) onToggleWriteMode(false);
    }
    // Reset text when story changes and we're NOT actively editing,
    // or when it's a completely different story.
    if (!editing || isNewStory) {
      setEditText(story?.text || '');
      setLastSavedText(story?.text || '');
      setCurrentPage(0);
    }
    prevStoryRef.current = storyNum;
  }, [story, onToggleWriteMode, editing]);

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
      <div className="se-story-brief-actions">
        <button
          className="se-btn se-btn-evaluate"
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

  // ── Arc Stage computation ──
  const arcStage = useMemo(() => {
    const num = story?.story_number || 1;
    const total = totalChapters || num;
    const pct = total > 0 ? num / total : 0;
    if (pct <= 0.2) return { label: 'Establishment', icon: '🌱' };
    if (pct <= 0.45) return { label: 'Rising', icon: '📈' };
    if (pct <= 0.65) return { label: 'Confrontation', icon: '⚡' };
    if (pct <= 0.85) return { label: 'Breaking', icon: '🔥' };
    return { label: 'Resolution', icon: '🌅' };
  }, [story?.story_number, totalChapters]);

  // ── Scene Pulse (heuristic text analysis) ──
  const scenePulse = useMemo(() => {
    const text = (editing ? editText : story?.text || '').toLowerCase();
    const words = text.split(/\s+/).filter(Boolean);
    const wc = words.length;
    if (wc < 10) return null;

    // Tone detection
    const tensionWords = ['scream', 'shatter', 'broke', 'rage', 'fear', 'panic', 'blood', 'fight', 'slash', 'fire', 'crash', 'dark', 'death', 'danger', 'threat', 'storm', 'trembl', 'shook', 'violent', 'desperate'];
    const calmWords = ['gentle', 'soft', 'quiet', 'peace', 'calm', 'warm', 'light', 'smile', 'laugh', 'comfort', 'ease', 'still', 'tender', 'rest', 'glow', 'serene', 'breath'];
    const tensionCount = tensionWords.reduce((n, w) => n + (text.match(new RegExp(w, 'gi')) || []).length, 0);
    const calmCount = calmWords.reduce((n, w) => n + (text.match(new RegExp(w, 'gi')) || []).length, 0);
    const toneRatio = wc > 0 ? (tensionCount - calmCount) / Math.sqrt(wc) : 0;
    const tone = toneRatio > 0.3 ? 'Tension' : toneRatio < -0.15 ? 'Calm' : 'Controlled';

    // Intensity (exclamation density + short sentences)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const exclamations = (text.match(/!/g) || []).length;
    const avgSentenceLen = sentences.length > 0 ? wc / sentences.length : wc;
    const intensityScore = Math.min(1, (exclamations / Math.max(1, sentences.length)) * 2 + (avgSentenceLen < 8 ? 0.3 : 0));
    const intensity = intensityScore > 0.6 ? 'High' : intensityScore > 0.25 ? 'Medium' : 'Low';

    // Focus (internal vs external vs relational)
    const internalWords = ['thought', 'felt', 'remembered', 'wondered', 'knew', 'believed', 'mind', 'heart', 'soul', 'dream', 'imagine', 'sense', 'fear', 'hope', 'wish'];
    const relationalWords = ['said', 'told', 'asked', 'replied', 'whispered', 'called', 'together', 'between', 'they', 'we', 'touch', 'embrace', 'held', 'love'];
    const internalCount = internalWords.reduce((n, w) => n + (text.match(new RegExp('\\b' + w, 'gi')) || []).length, 0);
    const relationalCount = relationalWords.reduce((n, w) => n + (text.match(new RegExp('\\b' + w, 'gi')) || []).length, 0);
    const focus = internalCount > relationalCount * 1.3 ? 'Internal' : relationalCount > internalCount * 1.3 ? 'Relational' : 'External';

    return { tone, intensity, focus };
  }, [editing, editText, story?.text]);

  // ── Next Move suggestion (heuristic) ──
  const nextMoveSuggestion = useMemo(() => {
    if (!scenePulse) return null;
    const { tone, intensity, focus } = scenePulse;
    const name = charName || 'the character';
    if (tone === 'Calm' && intensity === 'Low') return `This scene is calm — consider adding tension through ${name}'s unspoken fears or an unexpected arrival`;
    if (tone === 'Tension' && intensity === 'High') return `High tension — give ${name} a moment of breath, a quiet reflection before the next beat`;
    if (focus === 'Internal' && intensity !== 'High') return `${name} is deep in thought — ground the scene with external action or dialogue to balance`;
    if (focus === 'Relational') return `The focus is relational — let ${name}'s unspoken feelings surface through gesture or silence`;
    if (tone === 'Controlled') return `${name}'s composure is holding — push toward a revelation that cracks the surface`;
    if (focus === 'External') return `Lots of action — turn inward and explore what this moment means to ${name} emotionally`;
    return `Consider a sensory detail that anchors ${name} in this specific place and time`;
  }, [scenePulse, charName]);

  // Use refs so callbacks always see latest values
  const editTextRef = useRef(editText);
  editTextRef.current = editText;
  const saveStatusRef = useRef(saveStatus);
  saveStatusRef.current = saveStatus;

  const savedFlashRef = useRef(null);
  const handleSave = useCallback(async (opts = {}) => {
    if (saveStatusRef.current === 'saving') return;
    const textToSave = editTextRef.current;
    setSaveStatus('saving');
    try {
      await onEdit(story, textToSave);
      setLastSavedText(textToSave);
      setSaveStatus('saved');
      // Flash "✓ Saved" briefly, then revert to idle so button shows "Save"
      if (savedFlashRef.current) clearTimeout(savedFlashRef.current);
      savedFlashRef.current = setTimeout(() => setSaveStatus('idle'), 1500);
      if (opts.closeAfter) setEditing(false);
    } catch (e) {
      setSaveStatus('idle');
    }
  }, [story, onEdit]);

  // Autosave — debounce 2s after each edit
  const autosaveTimerRef = useRef(null);
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      handleSave();
    }, 2000);
    return () => clearTimeout(autosaveTimerRef.current);
  }, [editText, hasUnsavedChanges, handleSave]);

  // Keyboard shortcuts: Ctrl+S save, Ctrl+Z undo, Ctrl+Shift+Z redo, Ctrl+1/2/3/4 AI tools
  useEffect(() => {
    if (!editing) return;
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
      // AI writing tools: Ctrl+1 Continue, Ctrl+2 Deepen, Ctrl+3 Refine, Ctrl+4 Rewrite
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        const toolMap = { '1': 'continue', '2': 'deepen', '3': 'nudge', '4': 'rewrite' };
        const actionId = toolMap[e.key];
        if (actionId && aiWriterRef.current) {
          e.preventDefault();
          aiWriterRef.current.triggerAction(actionId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editing, handleSave, handleUndo, handleRedo]);

  return (
    <div className={`se-story-panel ${readingMode ? 'se-reading-mode' : ''} ${focusMode ? 'se-focus-mode' : ''}`}>
      {editing ? (
        <div className="se-edit-header" role="toolbar" aria-label="Edit controls">
          <div className="se-edit-header-left">
            <button
              className="se-edit-back"
              aria-label="Back to reading view"
              onClick={() => {
                if (hasUnsavedChanges) {
                  if (!window.confirm('You have unsaved changes. Discard them?')) return;
                }
                setEditing(false); setEditText(story.text); setSaveStatus('saved'); setLastSavedText(story?.text || '');
              }}
            >
              ← Exit Edit
            </button>
            <span className="se-mode-badge se-mode-badge--edit">✏️ Editing</span>
            <span className="se-edit-header-title">{story.title}</span>
            <span className="se-edit-header-meta">
              Ch {story.story_number}{totalChapters ? `/${totalChapters}` : ''}
              <span className="se-edit-header-dot">·</span>
              {wordCount.toLocaleString()} words
            </span>
          </div>
          <div className="se-edit-header-right">
            <div className="se-tts-controls">
              {!ttsPlaying && !ttsPaused && !ttsLoading && (
                <button className="se-btn se-btn-tts" onClick={handleTtsPlay} title="Read aloud">
                  Listen
                </button>
              )}
              {ttsLoading && (
                <button className="se-btn se-btn-tts" disabled title="Loading audio…">
                  <span className="se-spinner" style={{ width: 12, height: 12, display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} /> Loading…
                </button>
              )}
              {ttsPlaying && (
                <button className="se-btn se-btn-tts se-btn-tts-active" onClick={handleTtsPause} title="Pause reading">
                  Pause
                </button>
              )}
              {ttsPaused && (
                <button className="se-btn se-btn-tts" onClick={handleTtsPlay} title="Resume reading">
                  Resume
                </button>
              )}
              {(ttsPlaying || ttsPaused) && (
                <button className="se-btn se-btn-tts-stop" onClick={handleTtsStop} title="Stop reading">Stop</button>
              )}
              {(ttsPlaying || ttsPaused) && (
                <select
                  className="se-tts-speed"
                  value={ttsRate}
                  onChange={(e) => {
                    const newRate = parseFloat(e.target.value);
                    setTtsRate(newRate);
                    if (ttsUsingElevenLabs.current && ttsAudioRef.current) {
                      ttsAudioRef.current.playbackRate = newRate;
                    } else {
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
                    }
                  }}
                  title="Reading speed"
                >
                  <option value="0.5">0.5x</option>
                  <option value="0.75">0.75x</option>
                  <option value="1">1x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
              )}
            </div>
            <button
              className={`se-btn se-btn-focus-toggle ${focusMode ? 'active' : ''}`}
              onClick={() => onToggleFocusMode?.()}
              title={focusMode ? 'Exit focus mode' : 'Focus mode — hide panels, center text'}
            >
              {focusMode ? 'Full View' : 'Focus'}
            </button>
            <button
              className={`se-btn se-btn-save-primary ${saveStatus === 'saved' ? 'se-btn-save-saved' : ''} ${hasUnsavedChanges ? 'se-save-unsaved' : ''}`}
              style={{ background: hasUnsavedChanges ? charColor : undefined }}
              onClick={() => handleSave()}
              disabled={saveStatus === 'saving'}
              aria-live="polite"
              aria-atomic="true"
            >
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : hasUnsavedChanges ? 'Save Now' : 'Save'}
            </button>
            <button
              className="se-btn se-btn-cancel-light"
              onClick={() => {
                if (hasUnsavedChanges) {
                  if (!window.confirm('You have unsaved changes. Discard them?')) return;
                }
                setEditing(false); setEditText(story.text); setSaveStatus('saved'); setLastSavedText(story?.text || '');
                if (focusMode) onToggleFocusMode?.();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="se-story-header" style={{ borderBottomColor: charColor }}>
          <div className="se-story-header-left">
            <div className="se-story-nav-row">
              <span className="se-mode-badge se-mode-badge--read">📖 Reading</span>
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
            <button
              className={`se-btn se-btn-focus-toggle ${focusMode ? 'active' : ''}`}
              onClick={() => onToggleFocusMode?.()}
              title={focusMode ? 'Exit focus mode' : 'Focus mode'}
            >
              {focusMode ? 'Full View' : 'Focus'}
            </button>
            <button
              className="se-btn se-btn-edit-story"
              onClick={() => { if (readingMode) onToggleReadingMode?.(); setEditing(true); }}
            >
              ✏️ Edit Story
            </button>
            <div className="se-tts-controls">
              {!ttsPlaying && !ttsPaused && !ttsLoading && (
                <button className="se-btn se-btn-tts" onClick={handleTtsPlay} title="Read aloud">
                  Listen
                </button>
              )}
              {ttsLoading && (
                <button className="se-btn se-btn-tts" disabled title="Loading audio…">
                  <span className="se-spinner" style={{ width: 12, height: 12, display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} /> Loading…
                </button>
              )}
              {ttsPlaying && (
                <button className="se-btn se-btn-tts se-btn-tts-active" onClick={handleTtsPause} title="Pause reading">
                  Pause
                </button>
              )}
              {ttsPaused && (
                <button className="se-btn se-btn-tts" onClick={handleTtsPlay} title="Resume reading">
                  Resume
                </button>
              )}
              {(ttsPlaying || ttsPaused) && (
                <button className="se-btn se-btn-tts-stop" onClick={handleTtsStop} title="Stop reading">Stop</button>
              )}
              {(ttsPlaying || ttsPaused) && (
                <select
                  className="se-tts-speed"
                  value={ttsRate}
                  onChange={(e) => {
                    const newRate = parseFloat(e.target.value);
                    setTtsRate(newRate);
                    // For ElevenLabs audio, just change playback rate live
                    if (ttsUsingElevenLabs.current && ttsAudioRef.current) {
                      ttsAudioRef.current.playbackRate = newRate;
                    } else {
                      // For browser TTS, must restart with new rate
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
                    }
                  }}
                  title="Reading speed"
                >
                  <option value="0.5">0.5x</option>
                  <option value="0.75">0.75x</option>
                  <option value="1">1x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
              )}
            </div>
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
        <div className="se-active-threads">
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
                aria-label="Story manuscript editor"
              />
              {editTotalPages > 1 && (
                <div className="se-page-nav">
                  <button
                    className="se-btn se-btn-page"
                    aria-label={`Previous page (page ${currentPage} of ${editTotalPages})`}
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
                  <span className="se-page-indicator" aria-live="polite">Page {currentPage + 1} of {editTotalPages}</span>
                  <button
                    className="se-btn se-btn-page"
                    aria-label={`Next page (page ${currentPage + 2} of ${editTotalPages})`}
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
              {/* Compact AI tools bar — visible on mobile below editor */}
              <div className="se-edit-quick-tools" role="group" aria-label="Quick AI tools">
                <button
                  className="se-edit-quick-pill"
                  style={{ '--pill-accent': charColor || '#B8962E' }}
                  onClick={() => aiWriterRef.current?.triggerAction('continue')}
                  disabled={aiWriterRef.current?.isLoading}
                  title="Continue the moment (Ctrl+1)"
                >
                  <span aria-hidden="true">✨</span> Continue
                </button>
                <button
                  className="se-edit-quick-pill"
                  style={{ '--pill-accent': charColor || '#B8962E' }}
                  onClick={() => aiWriterRef.current?.triggerAction('deepen')}
                  disabled={aiWriterRef.current?.isLoading}
                  title="Deepen the scene (Ctrl+2)"
                >
                  <span aria-hidden="true">🧠</span> Deepen
                </button>
                <button
                  className="se-edit-quick-pill"
                  style={{ '--pill-accent': charColor || '#B8962E' }}
                  onClick={() => aiWriterRef.current?.triggerAction('nudge')}
                  disabled={aiWriterRef.current?.isLoading}
                  title="Refine tone (Ctrl+3)"
                >
                  <span aria-hidden="true">🎯</span> Refine
                </button>
                <button
                  className="se-edit-quick-pill"
                  style={{ '--pill-accent': charColor || '#B8962E' }}
                  onClick={() => aiWriterRef.current?.triggerAction('rewrite')}
                  disabled={aiWriterRef.current?.isLoading}
                  title="Rework paragraph (Ctrl+4) — select text first"
                >
                  <span aria-hidden="true">🔄</span> Rework
                </button>
              </div>
            </div>

            {!focusMode && <div className={`se-writing-tools ${mobileToolsOpen ? 'se-writing-tools--mobile-open' : ''}`} id="writing-tools-panel" role="region" aria-label="Writing tools">
              <button
                className="se-mobile-tools-toggle"
                onClick={() => setMobileToolsOpen(v => !v)}
                aria-expanded={mobileToolsOpen}
                aria-controls="writing-tools-panel"
                title={mobileToolsOpen ? 'Collapse writing tools panel' : 'Expand writing tools panel'}
              >
                {mobileToolsOpen ? '▾ Hide Tools' : '▸ Writing Tools'}
              </button>
              {/* Scene Pulse */}
              {scenePulse && (
                <div className="se-tools-section se-scene-pulse-section">
                  <div className="se-tools-section-title">Scene Pulse</div>
                  <div className="se-scene-pulse">
                    <div className="se-pulse-row">
                      <span className="se-pulse-label">Tone</span>
                      <span className={`se-pulse-value se-pulse-tone-${scenePulse.tone.toLowerCase()}`}>{scenePulse.tone}</span>
                    </div>
                    <div className="se-pulse-row">
                      <span className="se-pulse-label">Intensity</span>
                      <div className="se-pulse-bar-track">
                        <div className={`se-pulse-bar-fill se-pulse-intensity-${scenePulse.intensity.toLowerCase()}`} />
                      </div>
                      <span className="se-pulse-value-sm">{scenePulse.intensity}</span>
                    </div>
                    <div className="se-pulse-row">
                      <span className="se-pulse-label">Focus</span>
                      <span className="se-pulse-value">{scenePulse.focus}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Chapter Timeline */}
              {totalChapters > 1 && (
                <div className="se-tools-section se-chapter-timeline-section">
                  <div className="se-tools-section-title">Chapter Progress</div>
                  <div className="se-chapter-timeline">
                    <div className="se-timeline-bar">
                      <div className="se-timeline-fill" style={{ width: `${Math.min(100, ((story.story_number || 1) / totalChapters) * 100)}%`, background: charColor || 'var(--se-gold)' }} />
                    </div>
                    <div className="se-timeline-dots">
                      {Array.from({ length: Math.min(totalChapters, 12) }, (_, i) => {
                        const chNum = i + 1;
                        const isCurrent = chNum === (story.story_number || 1);
                        const isPast = chNum < (story.story_number || 1);
                        return (
                          <span key={i} className={`se-timeline-dot ${isCurrent ? 'se-timeline-dot-current' : isPast ? 'se-timeline-dot-past' : ''}`}
                            style={isCurrent ? { background: charColor || 'var(--se-gold)' } : {}}
                            title={`Chapter ${chNum}`}
                          />
                        );
                      })}
                      {totalChapters > 12 && <span className="se-timeline-more">+{totalChapters - 12}</span>}
                    </div>
                    <div className="se-timeline-label">{arcStage.icon} {arcStage.label} Phase</div>
                  </div>
                </div>
              )}

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
                  ref={aiWriterRef}
                  cursorContext={(() => {
                    const ta = textareaRef.current;
                    if (!ta || !editText) return '';
                    const pos = ta.selectionStart || 0;
                    const start = Math.max(0, pos - 40);
                    const end = Math.min(editText.length, pos + 40);
                    return editText.slice(start, end).replace(/\n/g, ' ').trim();
                  })()}
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
                    // Auto-collapse tools on mobile after insertion
                    setMobileToolsOpen(false);
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

              {/* Next Move suggestion */}
              {nextMoveSuggestion && (
                <div className="se-tools-section se-next-move-section">
                  <div className="se-tools-section-title">🔮 Suggested Next Move</div>
                  <div className="se-next-move">{nextMoveSuggestion}</div>
                </div>
              )}
            </div>}
          </div>
        ) : (
          <>
            <div className={`se-story-text ${focusMode ? 'se-story-text--focus' : ''}`} ref={storyBodyRef}>
              {(pages[currentPage] || []).map((para, i) => (
                para.trim()
                  ? <p
                      key={i}
                      className={`se-story-para ${activeParaIndex === i ? 'se-para-active' : ''} ${activeParaIndex !== null && activeParaIndex !== i ? 'se-para-dimmed' : ''}`}
                      onMouseEnter={() => setActiveParaIndex(i)}
                      onMouseLeave={() => setActiveParaIndex(null)}
                    >{para}</p>
                  : <div key={i} className="se-story-spacer" />
              ))}
            </div>
            {/* Inline editing toolbar — appears on text selection */}
            {selectionPopup && !editing && (
              <div className="se-inline-toolbar" style={{ top: selectionPopup.top, left: Math.min(Math.max(selectionPopup.left, 100), window.innerWidth - 100) }}>
                <button className="se-inline-btn" onClick={() => { setEditing(true); setSelectionPopup(null); }}>
                  <span className="se-inline-btn-icon">&#10024;</span> Continue from here
                </button>
                <button className="se-inline-btn" onClick={() => { setEditing(true); setSelectionPopup(null); }}>
                  <span className="se-inline-btn-icon">&#129504;</span> Deepen this
                </button>
                <button className="se-inline-btn" onClick={() => { setEditing(true); setSelectionPopup(null); }}>
                  <span className="se-inline-btn-icon">&#127919;</span> Refine tone
                </button>
                <button className="se-inline-btn" onClick={() => { setEditing(true); setSelectionPopup(null); }}>
                  <span className="se-inline-btn-icon">&#128260;</span> Rewrite
                </button>
              </div>
            )}

            {!editing && selectedCharKey && <TherapySuggestions characterKey={selectedCharKey} apiBase={API_BASE} />}

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

            {!editing && registryUpdate && (
              <div className="se-registry-update">
                <span className="se-registry-icon">🔄</span>
                <span className="se-registry-text">{registryUpdate}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Pinned bottom controls (always visible) ── */}
      {!editing && story && (
        <div className="se-pinned-controls">
          <StoryReviewPanel
            story={story}
            characterKey={story.character_key}
            taskBrief={task}
            charColor={charColor}
            onApproved={(saved) => { console.log('Story approved & persisted', saved.id); onApprove(story); }}
            onRejected={(saved) => { console.log('Story rejected & persisted', saved.id); onReject(story); }}
            onSaved={(saved) => { console.log('Story saved', saved.id); }}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => { setCurrentPage(page); storyBodyRef.current?.scrollTo(0, 0); }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main StoryEngine component ───────────────────────────────────────────────
export default function StoryEngine() {
  const navigate = useNavigate();
  const engine = useStoryEngine();
  const [focusMode, setFocusMode] = useState(false);

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
    <div className={`se-page ${engine.readingMode ? 'se-fullscreen-reading' : ''} ${engine.writeMode ? 'se-write-mode' : ''} ${focusMode ? 'se-focus-active' : ''}`}>
      <ToastContainer toasts={engine.toasts} onDismiss={engine.dismissToast} />

      {/* ── Header ── */}
      {!engine.readingMode && !focusMode && (
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
        {!engine.readingMode && !focusMode && (
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
              totalChapters={engine.tasks.length}
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
              focusMode={focusMode}
              onToggleFocusMode={() => setFocusMode(f => !f)}
            />
          )}
        </main>

        {/* Right: Inspector */}
        {!engine.readingMode && !focusMode && (
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
        <div className="se-amber-notification">
          <div className="se-amber-header">
            <div className="se-amber-avatar">A</div>
            <div>
              <div className="se-amber-name">Amber</div>
              <div className="se-amber-sub">Story {engine.amberNotification.story_number} approved</div>
            </div>
            <button className="se-amber-close" onClick={() => engine.setAmberNotification(null)}>&times;</button>
          </div>
          <div className="se-amber-body">
            <strong className="se-amber-chars">
              {engine.amberNotification.eligibility.charA.name}
              {engine.amberNotification.eligibility.charB ? ` & ${engine.amberNotification.eligibility.charB.name}` : ''}
            </strong>
            {' '}&mdash; this story ends at a door.{' '}
            <span className="se-amber-scene-type">{engine.amberNotification.eligibility.scene_type?.replace(/_/g, ' ')}</span>
            {' '}&middot; intensity: <span className="se-amber-intensity">{engine.amberNotification.eligibility.intensity}</span>
            {engine.amberNotification.eligibility.location && <span className="se-amber-location"> &middot; {engine.amberNotification.eligibility.location}</span>}
          </div>
          <div className="se-amber-actions">
            <button className="se-amber-btn se-amber-btn--primary" onClick={() => { navigate('/scene-studio', { state: { autoPopulate: engine.amberNotification.eligibility } }); engine.setAmberNotification(null); }}>
              Generate Scene
            </button>
            <button className="se-amber-btn se-amber-btn--secondary" onClick={() => engine.setAmberNotification(null)}>
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Approval confirmation modal */}
      {engine.approveConfirm && (
        <div className="se-modal-backdrop" onClick={() => engine.setApproveConfirm(null)}>
          <div className="se-modal-card" onClick={e => e.stopPropagation()}>
            <div className="se-modal-title">
              Approve Story {engine.approveConfirm.story_number}?
            </div>
            <div className="se-modal-body">
              &ldquo;{engine.approveConfirm.title}&rdquo; &mdash; This will extract memories, update registry, generate texture layers, and check scene eligibility.
            </div>
            <div className="se-modal-actions">
              <button className="se-modal-btn se-modal-btn--cancel" onClick={() => engine.setApproveConfirm(null)}>
                Cancel
              </button>
              <button className="se-modal-btn se-modal-btn--confirm" style={{ background: engine.char?.color || '#9a7d1e' }} onClick={() => { engine.handleApprove(engine.approveConfirm); engine.setApproveConfirm(null); }}>
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch progress indicator */}
      {engine.batchProgress && (
        <div className="se-fixed-toast se-fixed-toast--top">
          <div className="se-spinner" style={{ width: 16, height: 16, borderTopColor: engine.char?.color }} />
          <span>Approving {engine.batchProgress.current}/{engine.batchProgress.total}&hellip;</span>
          <div className="se-progress-track">
            <div className="se-progress-fill" style={{ width: `${(engine.batchProgress.current / engine.batchProgress.total) * 100}%`, background: engine.char?.color || '#9a7d1e' }} />
          </div>
        </div>
      )}

      {/* Batch generation progress */}
      {engine.generation.batchGenProgress && (
        <div className="se-fixed-toast se-fixed-toast--top se-fixed-toast--dark">
          <div className="se-spinner" style={{ width: 16, height: 16, borderTopColor: engine.char?.color || '#b0922e' }} />
          <div>
            <div style={{ fontWeight: 600 }}>Generating {engine.generation.batchGenProgress.current}/{engine.generation.batchGenProgress.total}</div>
            {engine.generation.batchGenProgress.currentTitle && <div className="se-fixed-toast-sub">{engine.generation.batchGenProgress.currentTitle}</div>}
          </div>
          <div className="se-progress-track se-progress-track--dark" style={{ marginLeft: 'auto' }}>
            <div className="se-progress-fill" style={{ width: `${(engine.generation.batchGenProgress.current / engine.generation.batchGenProgress.total) * 100}%`, background: engine.char?.color || '#b0922e' }} />
          </div>
        </div>
      )}

      {/* Undo rejected story */}
      {engine.rejectedStory && (
        <div className="se-fixed-toast se-fixed-toast--bottom se-fixed-toast--dark">
          <span>Story {engine.rejectedStory.story.story_number} rejected</span>
          <button className="se-undo-btn" onClick={engine.handleUndoReject}>
            Undo
          </button>
        </div>
      )}

      {/* Inline texture preview */}
      {engine.lastTexture && !engine.amberTextureNotes && (
        <div className="se-amber-notification se-amber-notification--texture">
          <div className="se-amber-header">
            <div className="se-amber-name">Texture &mdash; Story {engine.lastTexture.story_number}</div>
            <button className="se-amber-close" onClick={() => engine.setLastTexture(null)}>&times;</button>
          </div>
          {engine.lastTexture.texture?.inner_thought_text && (
            <div className="se-texture-block">
              <div className="se-texture-label" style={{ color: '#b0922e' }}>Inner Thought ({engine.lastTexture.texture.inner_thought_type?.replace('_', ' ')})</div>
              <div className="se-texture-text" style={{ fontStyle: 'italic' }}>{engine.lastTexture.texture.inner_thought_text.slice(0, 200)}{engine.lastTexture.texture.inner_thought_text.length > 200 ? '\u2026' : ''}</div>
            </div>
          )}
          {engine.lastTexture.texture?.body_narrator_text && (
            <div className="se-texture-block">
              <div className="se-texture-label" style={{ color: '#d4789a' }}>Body Narrator</div>
              <div className="se-texture-text">{engine.lastTexture.texture.body_narrator_text}</div>
            </div>
          )}
          {engine.lastTexture.texture?.conflict_surface_text && (
            <div className="se-texture-block">
              <div className="se-texture-label" style={{ color: '#c0392b' }}>Conflict</div>
              <div className="se-texture-text">{engine.lastTexture.texture.conflict_surface_text}</div>
            </div>
          )}
          {engine.lastTexture.texture?.private_moment_text && (
            <div className="se-texture-block">
              <div className="se-texture-label" style={{ color: '#7c3aed' }}>Private Moment</div>
              <div className="se-texture-text">{engine.lastTexture.texture.private_moment_text.slice(0, 200)}{engine.lastTexture.texture.private_moment_text.length > 200 ? '\u2026' : ''}</div>
            </div>
          )}
          {engine.lastTexture.texture?.post_text && (
            <div className="se-texture-block">
              <div className="se-texture-label" style={{ color: '#0d9668' }}>Post ({engine.lastTexture.texture.post_platform})</div>
              <div className="se-texture-text">{engine.lastTexture.texture.post_text}</div>
            </div>
          )}
          {engine.lastTexture.texture?.bleed_text && (
            <div className="se-texture-block">
              <div className="se-texture-label" style={{ color: '#546678' }}>Bleed</div>
              <div className="se-texture-text">{engine.lastTexture.texture.bleed_text}</div>
            </div>
          )}
          <button className="se-amber-btn se-amber-btn--primary" style={{ width: '100%', marginTop: 4 }} onClick={() => { navigate(`/texture-review/${engine.lastTexture.story_number}?char=${engine.selectedChar}`); engine.setLastTexture(null); }}>
            Full Texture Review
          </button>
        </div>
      )}

      {/* Amber texture notes */}
      {engine.amberTextureNotes && (
        <div className={`se-amber-notification se-amber-notification--notes ${engine.amberNotification ? 'se-amber-notification--stacked' : ''}`}>
          <div className="se-amber-header">
            <div className="se-amber-avatar">A</div>
            <div>
              <div className="se-amber-name">Amber read Story {engine.amberTextureNotes.story_number}</div>
              <div className="se-amber-sub">&ldquo;{engine.amberTextureNotes.story_title}&rdquo;</div>
            </div>
            <button className="se-amber-close" onClick={() => engine.setAmberTextureNotes(null)}>&times;</button>
          </div>
          <div className="se-amber-notes-list">
            {engine.amberTextureNotes.notes.map((note, i) => (
              <div key={i} className={`se-amber-note se-amber-note--${note.type}`}>
                <div className="se-amber-note-type">{note.type}</div>
                <div className="se-amber-note-text">{note.note}</div>
              </div>
            ))}
          </div>
          <div className="se-amber-actions">
            <button className="se-amber-btn se-amber-btn--primary" onClick={() => { navigate(`/texture-review/${engine.amberTextureNotes.story_number}?char=${engine.selectedChar}`); engine.setAmberTextureNotes(null); }}>
              Review Texture
            </button>
            <button className="se-amber-btn se-amber-btn--secondary" onClick={() => engine.setAmberTextureNotes(null)}>
              Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
