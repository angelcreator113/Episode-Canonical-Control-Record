/**
 * BookEditor.jsx — The Quiet Room
 *
 * All business logic preserved.
 * Render redesigned for editorial calm.
 *
 * Extracted from StorytellerPage.jsx for maintainability.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MemoryCard, MEMORY_STYLES } from '../pages/MemoryConfirmation';
import MemoryBankView from '../pages/MemoryBankView';
import ChapterBrief from '../pages/ChapterBrief';
import SceneInterview from '../pages/SceneInterview';
import NarrativeIntelligence from '../pages/NarrativeIntelligence';
import { ContinuityGuard, RewriteOptions } from '../pages/ContinuityGuard';
import ScenesPanel from '../pages/ScenesPanel';
import TOCPanel from '../pages/TOCPanel';
import ImportDraftModal from '../pages/ImportDraftModal';
import LalaSceneDetection from './LalaSceneDetection';
import ExportPanel from './ExportPanel';
import ScriptBridgePanel from './ScriptBridgePanel';
import StoryPlannerConversational from './StoryPlannerConversational';
import { PlantEchoButton } from './DecisionEchoPanel';
import { getBookQuestionContext } from './BookQuestionLayer';
import ChapterExitEmotion from './ChapterExitEmotion';
import { VoiceTypeTag } from './VoiceAttributionButton';
import SectionEditor from './SectionEditor';
import { getLalaSessionPrompt } from '../data/lalaVoiceData';
import { getCharacterRulesPrompt } from '../data/characterAppearanceRules';
import { getVentureContext } from '../data/ventureData';
import { API, authHeader, api } from '../utils/storytellerApi';
import { numberWord } from '../utils/storytellerHelpers';

export default
function BookEditor({ book, onClose, toast, onRefresh, initialChapterId }) {

  /* ── State ── */
  const [chapters, setChapters] = useState(book.chapters || []);
  const [activeChapterId, setActiveChapterId] = useState(
    initialChapterId || (book.chapters && book.chapters[0]?.id) || null
  );
  const [activeView, setActiveView] = useState(() => {
    // Restore view from sessionStorage (no longer synced to URL)
    try { return sessionStorage.getItem('st_view') || 'book'; } catch { return 'book'; }
  });
  const [registryCharacters, setRegistryCharacters] = useState([]);

  // UI state
  const [pendingOpen, setPendingOpen] = useState(true);
  const [showCheckin, setShowCheckin] = useState(true);
  const [incomingEchoes, setIncomingEchoes] = useState([]);
  const [activeThreads, setActiveThreads] = useState([]);
  const [pnosAct, setPnosAct] = useState('act_1');
  const [reviewMode, setReviewMode] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);

  // Alive system state
  const [chapterCharacters, setChapterCharacters] = useState([]);
  const [exitEmotionData, setExitEmotionData] = useState({ exit_emotion: '', exit_emotion_note: '' });
  const [questionDirection, setQuestionDirection] = useState(null);
  const [writingMode, setWritingMode] = useState(false);

  // Prose mode state (write-mode style instead of line-by-line)
  const [proseMode, setProseMode] = useState(true);
  const [proseText, setProseText] = useState('');
  const [proseSaved, setProseSaved] = useState(true);
  const proseSaveTimer = useRef(null);
  const proseRef = useRef('');         // always-current prose (avoids stale closures)
  const chapterIdRef = useRef(null);   // always-current chapter id
  const proseSavedRef = useRef(true);  // always-current saved flag

  // AI Tools state
  const [aiAction, setAiAction] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const [canonOpen, setCanonOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [wardrobeAssignOpen, setWardrobeAssignOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Editing state
  const [editingLine, setEditingLine] = useState(null);
  const [editText, setEditText] = useState('');
  const [editingBookTitle, setEditingBookTitle] = useState(false);
  const [bookTitleDraft, setBookTitleDraft] = useState(book.title || '');
  const [editingChapterId, setEditingChapterId] = useState(null);
  const [chapterTitleDraft, setChapterTitleDraft] = useState('');

  // Chapter management
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterBadge, setNewChapterBadge] = useState('');
  const [addingLineTo, setAddingLineTo] = useState(null);
  const [newLineText, setNewLineText] = useState('');

  // Sub-component state
  const [importTarget, setImportTarget] = useState(null);
  const [interviewDone, setInterviewDone] = useState(false);
  const [redoInterview, setRedoInterview] = useState(false);
  const [lastApprovedLine, setLastApprovedLine] = useState(null);
  const [contextExpanded, setContextExpanded] = useState(false);

  // Saved indicator
  const [savedAt, setSavedAt] = useState(null);
  const markSaved = () => setSavedAt(Date.now());
  const justSaved = savedAt && (Date.now() - savedAt < 3000);

  /* ── Effects ── */

  // Persist activeView in sessionStorage (not URL — avoids interfering with parent searchParams)
  useEffect(() => {
    try { sessionStorage.setItem('st_view', activeView); } catch {}
  }, [activeView]);

  // Keep refs in sync with state (used by timer callbacks & beforeunload)
  useEffect(() => { proseRef.current = proseText; }, [proseText]);
  useEffect(() => { chapterIdRef.current = activeChapterId; }, [activeChapterId]);
  useEffect(() => { proseSavedRef.current = proseSaved; }, [proseSaved]);

  // Load prose ONLY when the active chapter *ID* changes (not when chapters array mutates)
  const prevChapterIdRef = useRef(null);
  useEffect(() => {
    if (!activeChapterId || activeChapterId === prevChapterIdRef.current) return;
    prevChapterIdRef.current = activeChapterId;
    const ch = chapters.find(c => c.id === activeChapterId);
    if (ch?.draft_prose) {
      setProseText(ch.draft_prose);
      proseRef.current = ch.draft_prose;
    } else {
      // Fallback: join approved lines into prose
      const lns = (ch?.lines || []).filter(l => l.status === 'approved' || l.status === 'edited');
      const text = lns.map(l => l.text).join('\n\n');
      setProseText(text);
      proseRef.current = text;
    }
    setProseSaved(true);
    proseSavedRef.current = true;
  }, [activeChapterId, chapters]);

  // Core save function — reads from refs, never stale
  const doSave = useCallback(async () => {
    const text = proseRef.current;
    const chId = chapterIdRef.current;
    if (!text || !chId) return;
    try {
      const res = await fetch(`${API}/chapters/${chId}/save-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ draft_prose: text }),
      });
      if (res.ok) {
        setProseSaved(true);
        proseSavedRef.current = true;
        markSaved();
      } else {
        console.error('Prose save failed:', res.status);
      }
    } catch (e) { console.error('Prose autosave failed:', e); }
  }, []);  // no deps — reads from refs

  // Autosave prose (debounced 2s after last edit)
  useEffect(() => {
    if (proseSaved || !proseText || !activeChapterId) return;
    if (proseSaveTimer.current) clearTimeout(proseSaveTimer.current);
    proseSaveTimer.current = setTimeout(() => { doSave(); }, 2000);
    return () => clearTimeout(proseSaveTimer.current);
  }, [proseText, proseSaved, activeChapterId, doSave]);

  // Save immediately before page unload (handles refresh / tab close)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!proseSavedRef.current && proseRef.current && chapterIdRef.current) {
        // Use sendBeacon for reliable save during unload
        const url = `${API}/chapters/${chapterIdRef.current}/save-draft`;
        const blob = new Blob([JSON.stringify({ draft_prose: proseRef.current })], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);  // stable — reads from refs

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = MEMORY_STYLES;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    fetch('/api/v1/character-registry/registries', { headers: authHeader() })
      .then(r => r.json())
      .then(data => {
        // API returns { registries: [{ characters: [...] }, ...] } — flatten to character list
        const regs = data?.registries || data || [];
        const chars = Array.isArray(regs)
          ? regs.flatMap(r => (r.characters || []).map(c => ({ ...c, name: c.display_name || c.character_key })))
          : [];
        setRegistryCharacters(chars);
      })
      .catch(() => {});
  }, []);

  // Fetch incoming echoes for the active chapter
  useEffect(() => {
    if (!activeChapterId || !book?.id) return;
    fetch(`/api/v1/storyteller/echoes?book_id=${book.id}&target_chapter_id=${activeChapterId}`, { headers: authHeader() })
      .then(r => r.json())
      .then(data => setIncomingEchoes(Array.isArray(data) ? data : []))
      .catch(() => setIncomingEchoes([]));
  }, [activeChapterId, book?.id]);

  useEffect(() => {
    setChapters(book.chapters || []);
    if (!activeChapterId && book.chapters?.length) {
      setActiveChapterId(book.chapters[0].id);
    }
  }, [book]);

  /* ── Computed ── */
  const activeChapter = chapters.find(ch => ch.id === activeChapterId) || null;
  const lines = activeChapter?.lines || [];
  const allLines = chapters.flatMap(ch => ch.lines || []);
  const approvedLines = lines.filter(l => l.status === 'approved' || l.status === 'edited');
  const pendingLines = lines.filter(l => l.status === 'pending');
  const pendingCount = pendingLines.length;
  const totalWordCount = allLines.reduce(
    (s, l) => s + (l.text || '').split(/\s+/).filter(Boolean).length, 0
  );
  const chapterIndex = activeChapter ? chapters.findIndex(ch => ch.id === activeChapterId) + 1 : 0;

  // Era detection for ambient theming
  const eraSlug = activeChapter?.badge?.toLowerCase().replace(/\s+/g, '-') || '';
  const eraTheme = eraSlug.includes('pre-prime') ? 'pre-prime'
    : eraSlug.includes('prime') ? 'prime' : 'default';

  // Build narrative payload — all alive system context for AI routes
  const buildNarrativePayload = useCallback(() => ({
    venture_context: getVentureContext ? getVentureContext(pnosAct) : '',
    pnos_act: pnosAct,
    incoming_echoes: incomingEchoes,
    active_threads: activeThreads,
    character_rules: getCharacterRulesPrompt(chapterCharacters),
    book_question: getBookQuestionContext(book, activeChapter),
    exit_emotion: exitEmotionData.exit_emotion || '',
    exit_emotion_note: exitEmotionData.exit_emotion_note || '',
    lala_session_prompt: getLalaSessionPrompt ? getLalaSessionPrompt() : '',
  }), [pnosAct, incomingEchoes, activeThreads, chapterCharacters, book, activeChapter, exitEmotionData]);

  /* ── AI Tools ── */

  const AI_ACTIONS = [
    { id: 'continue',  icon: '→', label: 'Continue',           sub: 'Write what comes next',          endpoint: '/api/v1/memories/story-continue' },
    { id: 'deepen',    icon: '◌', label: 'Deepen',             sub: 'Add sensory & emotional depth',  endpoint: '/api/v1/memories/story-deepen' },
    { id: 'dialogue',  icon: '"', label: 'Dialogue',           sub: 'Generate natural dialogue',      endpoint: '/api/v1/memories/ai-writer-action', action: 'dialogue' },
    { id: 'interior',  icon: '∞', label: 'Interior Monologue', sub: 'What they think but don\'t say', endpoint: '/api/v1/memories/ai-writer-action', action: 'interior' },
    { id: 'rewrite',   icon: '↻', label: 'Rewrite',            sub: 'Three alternative takes',        endpoint: '/api/v1/memories/rewrite-options' },
  ];

  const runAiAction = async (action) => {
    setAiAction(action.id);
    setAiResult(null);
    setAiError(null);
    setAiLoading(true);

    const recentProse = proseText ? proseText.slice(-800) : '';
    const narrativeCtx = buildNarrativePayload();

    const payload = {
      chapter_id: activeChapterId,
      book_id: book.id,
      current_prose: recentProse,
      recent_prose: recentProse,
      pnos_act: narrativeCtx.pnos_act,
      chapter_title: activeChapter?.title || '',
      book_title: book.title || '',
      character_rules: narrativeCtx.character_rules,
      exit_emotion: narrativeCtx.exit_emotion,
      venture_context: narrativeCtx.venture_context,
      action: action.action || action.id,
      length: 'paragraph',
    };

    // For rewrite, pass the last paragraph as "text"
    if (action.id === 'rewrite') {
      const paragraphs = proseText.split('\n\n').filter(p => p.trim());
      payload.text = paragraphs[paragraphs.length - 1] || proseText.slice(-300);
      payload.book_id = book.id;
    }

    try {
      const res = await fetch(action.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (action.id === 'rewrite') {
        // rewrite-options returns { rewrites: [...] }
        const rewrites = data.rewrites || data.options || [];
        setAiResult(rewrites.length > 0
          ? rewrites.map((r, i) => `${i + 1}. ${r.label || r.type || 'Option ' + (i+1)}\n${r.text}`).join('\n\n---\n\n')
          : data.text || data.content || 'No rewrites generated.');
      } else {
        setAiResult(
          data.continuation || data.content || data.text || data.prose ||
          data.result || data.suggestion || 'No result generated.'
        );
      }
    } catch (e) {
      setAiError('Generation failed — check that the backend is running.');
    }
    setAiLoading(false);
  };

  const insertAiResult = () => {
    if (!aiResult) return;
    // For rewrite, replace the last paragraph
    if (aiAction === 'rewrite') {
      // Don't auto-insert rewrites — user should copy what they want
      navigator.clipboard?.writeText(aiResult).catch(() => {});
      toast.add('Copied to clipboard — paste where you like');
    } else {
      setProseText(prev => {
        const trimmed = prev.trimEnd();
        return trimmed + (trimmed ? '\n\n' : '') + aiResult;
      });
      setProseSaved(false);
    }
    setAiResult(null);
    setAiAction(null);
  };

  const discardAiResult = () => {
    setAiResult(null);
    setAiAction(null);
    setAiError(null);
  };

  /* ── Section → Prose insertion ── */
  const insertSectionHeading = (sectionTitle) => {
    // Insert section title as a bold heading line in prose, then switch to manuscript view
    setProseText(prev => {
      const trimmed = prev.trimEnd();
      const heading = sectionTitle;
      // Check if this heading is already in the prose
      if (trimmed.includes(heading)) {
        // Already exists — just switch view, don't duplicate
        return prev;
      }
      const updated = trimmed + (trimmed ? '\n\n' : '') + heading + '\n\n';
      proseRef.current = updated;
      return updated;
    });
    setProseSaved(false);
    proseSavedRef.current = false;
    setActiveView('book');
    setMobileNavOpen(false);
  };

  /* ── Handlers ── */

  const updateLineLocal = (lineId, updates) => {
    setChapters(prev => prev.map(ch => ({
      ...ch,
      lines: (ch.lines || []).map(ln => ln.id === lineId ? { ...ln, ...updates } : ln),
    })));
  };

  const removeLineLocal = (lineId) => {
    setChapters(prev => prev.map(ch => ({
      ...ch,
      lines: (ch.lines || []).filter(ln => ln.id !== lineId),
    })));
  };

  const saveBookTitle = async () => {
    try {
      await api(`/books/${book.id}`, {
        method: 'PUT',
        body: JSON.stringify({ title: bookTitleDraft }),
      });
      setEditingBookTitle(false);
      markSaved();
      onRefresh();
    } catch (e) {
      toast.add('Failed to save title', 'error');
    }
  };

  const saveChapterTitle = async (chId) => {
    try {
      await api(`/chapters/${chId || editingChapterId}`, {
        method: 'PUT',
        body: JSON.stringify({ title: chapterTitleDraft }),
      });
      setChapters(prev =>
        prev.map(ch => ch.id === (chId || editingChapterId)
          ? { ...ch, title: chapterTitleDraft } : ch
        )
      );
      setEditingChapterId(null);
      markSaved();
    } catch (e) {
      toast.add('Failed to save chapter title', 'error');
    }
  };

  const approveLine = async (lineId) => {
    try {
      await api(`/lines/${lineId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'approved' }),
      });
      updateLineLocal(lineId, { status: 'approved' });
      markSaved();
      // memory extraction
      const line = lines.find(l => l.id === lineId);
      if (line) setLastApprovedLine({ ...line, status: 'approved' });
      if (line) {
        try {
          await api('/extract-memory', {
            method: 'POST',
            body: JSON.stringify({ text: line.text, bookId: book.id }),
          });
        } catch {}
      }
    } catch (e) {
      toast.add('Failed to approve line', 'error');
    }
  };

  const rejectLine = async (lineId) => {
    try {
      await api(`/lines/${lineId}`, { method: 'DELETE' });
      removeLineLocal(lineId);
      markSaved();
    } catch (e) {
      toast.add('Failed to reject line', 'error');
    }
  };

  const startEdit = (line) => {
    setEditingLine(line.id);
    setEditText(line.text);
  };

  const saveEdit = async () => {
    try {
      await api(`/lines/${editingLine}`, {
        method: 'PUT',
        body: JSON.stringify({ text: editText, status: 'edited' }),
      });
      updateLineLocal(editingLine, { text: editText, status: 'edited' });
      setEditingLine(null);
      setEditText('');
      markSaved();
    } catch (e) {
      toast.add('Failed to save edit', 'error');
    }
  };

  const cancelEdit = () => {
    setEditingLine(null);
    setEditText('');
  };

  const approveAll = async () => {
    try {
      await api(`/books/${book.id}/approve-all`, { method: 'POST' });
      for (const ln of pendingLines) {
        try {
          await api('/extract-memory', {
            method: 'POST',
            body: JSON.stringify({ text: ln.text, bookId: book.id }),
          });
        } catch {}
      }
      markSaved();
      toast.add('All lines approved');
      onRefresh();
    } catch (e) {
      toast.add('Failed to approve all', 'error');
    }
  };

  const addChapter = async () => {
    if (!newChapterTitle.trim()) return;
    try {
      const ch = await api('/chapters', {
        method: 'POST',
        body: JSON.stringify({
          book_id: book.id,
          title: newChapterTitle,
          badge: newChapterBadge,
        }),
      });
      setChapters(prev => [...prev, { ...ch, lines: [] }]);
      setActiveChapterId(ch.id);
      setShowAddChapter(false);
      setNewChapterTitle('');
      setNewChapterBadge('');
      setActiveView('book');
      markSaved();
    } catch (e) {
      toast.add('Failed to add chapter', 'error');
    }
  };

  const deleteChapter = async (chId) => {
    if (!window.confirm('Delete this chapter? This cannot be undone.')) return;
    try {
      await api(`/chapters/${chId}`, { method: 'DELETE' });
      const remaining = chapters.filter(ch => ch.id !== chId);
      setChapters(remaining);
      if (activeChapterId === chId) {
        setActiveChapterId(remaining[0]?.id || null);
      }
      markSaved();
    } catch (e) {
      toast.add('Failed to delete chapter', 'error');
    }
  };

  const addLine = async (chapterId) => {
    if (!newLineText.trim()) return;
    try {
      const ln = await api(`/chapters/${chapterId}/lines`, {
        method: 'POST',
        body: JSON.stringify({ text: newLineText, status: 'approved' }),
      });
      setChapters(prev =>
        prev.map(ch =>
          ch.id === chapterId
            ? { ...ch, lines: [...(ch.lines || []), ln] }
            : ch
        )
      );
      setNewLineText('');
      setAddingLineTo(null);
      markSaved();
    } catch (e) {
      toast.add('Failed to add line', 'error');
    }
  };

  const resetChapter = async () => {
    if (!window.confirm('Reset this chapter? All lines will be removed.')) return;
    try {
      for (const ln of lines) {
        await api(`/lines/${ln.id}`, { method: 'DELETE' });
      }
      setChapters(prev =>
        prev.map(ch => ch.id === activeChapterId ? { ...ch, lines: [] } : ch)
      );
      setInterviewDone(false);
      markSaved();
      toast.add('Chapter reset');
    } catch (e) {
      toast.add('Failed to reset chapter', 'error');
    }
  };

  const openWorkspace = (view) => {
    setActiveView(view);
    setDrawerOpen(false);
  };

  /* ── renderLine — individual manuscript line ── */

  const renderLine = (ln, isPending) => {
    const isEditing = editingLine === ln.id;
    return (
      <div
        key={ln.id}
        className={`st-line st-line-${ln.status}${isEditing ? ' st-line-editing' : ''}${reviewMode ? ' st-line-review' : ''}`}
      >
        {/* Review mode status badge */}
        {reviewMode && (
          <div className={`st-review-badge st-review-badge-${ln.status}`}>
            {ln.status === 'approved' ? '✓' : ln.status === 'pending' ? '○' : ln.status === 'edited' ? '✎' : '•'}
          </div>
        )}
        {/* Voice type gutter tag */}
        {!reviewMode && ln.voice_type && ln.voice_type !== 'unattributed' && (
          <div style={{ position: 'absolute', left: -54, top: 4 }}>
            <VoiceTypeTag
              line={ln}
              onConfirm={async (lineId, newType) => {
                updateLineLocal(lineId, { voice_type: newType, voice_confirmed: true });
                try {
                  await fetch(`/api/v1/memories/confirm-voice`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeader() },
                    body: JSON.stringify({ line_id: lineId, voice_type: newType }),
                  });
                } catch (e) { console.error('Voice confirm failed:', e); }
              }}
            />
          </div>
        )}
        <div className="st-line-content">
          {!isEditing && (
            <div className={`st-line-text${isPending ? ' pending' : ''}`}>
              {ln.text}
            </div>
          )}
          {isEditing && (
            <>
              <textarea
                className="st-edit-area"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                autoFocus
              />
              <div className="st-edit-actions">
                <button className="st-edit-save" onClick={saveEdit}>Save</button>
                <button className="st-edit-cancel" onClick={cancelEdit}>Cancel</button>
              </div>
            </>
          )}
          {ln.source_tags && ln.source_tags.length > 0 && (
            <div className="st-line-meta">
              {ln.source_tags.map((tag, i) => (
                <span key={i} className="st-source-tag">{tag}</span>
              ))}
            </div>
          )}
          {ln.status === 'rejected' && (
            <RewriteOptions lineId={ln.id} bookId={book.id} onRewrite={onRefresh} />
          )}
          {reviewMode && ln.memory_data && <MemoryCard data={ln.memory_data} />}
        </div>
        <div className={`st-line-actions${reviewMode ? ' st-line-actions-review' : ''}`}>
          {reviewMode && !isEditing ? (
            <>
              {ln.status !== 'approved' && (
                <button className="st-line-action st-action-approve" onClick={() => approveLine(ln.id)} title="Approve">{'✓'}</button>
              )}
              <button className="st-line-action st-action-edit" onClick={() => startEdit(ln)} title="Edit">{'✎'}</button>
              <button className="st-line-action st-action-reject" onClick={() => rejectLine(ln.id)} title="Reject">{'✕'}</button>
            </>
          ) : (
            <>
              {isPending && (
                <>
                  <button className="st-line-action st-action-approve" onClick={() => approveLine(ln.id)}>{'✓'}</button>
                  <button className="st-line-action st-action-edit" onClick={() => startEdit(ln)}>{'✎'}</button>
                  <button className="st-line-action st-action-reject" onClick={() => rejectLine(ln.id)}>{'✕'}</button>
                </>
              )}
              {!isPending && !isEditing && (
                <>
                  <button className="st-line-action st-action-edit" onClick={() => startEdit(ln)}>{'✎'}</button>
                  <PlantEchoButton
                    line={ln}
                    chapters={chapters}
                    bookId={book.id}
                    onPlanted={() => {
                      fetch(`/api/v1/storyteller/echoes?book_id=${book.id}&target_chapter_id=${activeChapterId}`, { headers: authHeader() })
                        .then(r => r.json()).then(d => setIncomingEchoes(d.echoes || []));
                    }}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════
     RENDER — The Quiet Room
     ═══════════════════════════════════════ */

  return (
    <div
      className={`st-editor-layout${writingMode ? ' st-writing-mode' : ''}`}
      data-era={eraTheme}
    >
      {/* Writing Mode — exit button, floats into view on hover */}
      {writingMode && (
        <button className="st-writing-mode-exit" onClick={() => setWritingMode(false)}>
          Exit Focus
        </button>
      )}

      {/* ── Top Bar ── */}
      <div className="st-topbar">
        <div className="st-topbar-left">
          <button className="st-topbar-back" onClick={onClose}>
            <span className="st-topbar-back-arrow">←</span>
            <span className="st-topbar-back-text">Chapters</span>
          </button>
          <button
            className="st-mobile-nav-toggle"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label="Toggle chapters"
          >
            {mobileNavOpen ? '✕' : '☰'}
          </button>
        </div>

        <div className="st-topbar-center">
          <span className="st-topbar-title">
            {book.title}
            {activeChapter && (
              <span className="st-topbar-title-dim"> — {activeChapter.title}</span>
            )}
          </span>
        </div>

        <div className="st-topbar-right">
          <span className="st-topbar-wordcount">
            {totalWordCount.toLocaleString()} words
          </span>
          {savedAt && (
            <span
              className={`st-topbar-saved${justSaved ? ' just-saved' : ''}`}
              key={savedAt}
            >
              Saved
            </span>
          )}
          <button
            className={`st-tools-btn${drawerOpen ? ' active' : ''}`}
            onClick={e => { e.stopPropagation(); setDrawerOpen(!drawerOpen); }}
          >
            <span className="st-tools-btn-icon-m">⋯</span>
            <span className="st-tools-btn-text">☰ Tools</span>
          </button>
        </div>
      </div>

      {/* ── Tools Panel — right side slide-out ── */}
      {drawerOpen && (
        <>
          <div className="st-tools-backdrop" onClick={() => setDrawerOpen(false)} />
          <aside className="st-tools-panel" onClick={e => e.stopPropagation()}>
            <div className="st-tools-header">
              <span className="st-tools-heading">Tools</span>
              <button className="st-tools-close" onClick={() => setDrawerOpen(false)}>✕</button>
            </div>

            <div className="st-tools-group">
              <div className="st-tools-group-label">Workspaces</div>
              <button className={`st-tools-item${activeView === 'book' ? ' active' : ''}`} onClick={() => openWorkspace('book')}>
                <span className="st-tools-icon">✦</span> Manuscript
              </button>
              <button className={`st-tools-item${activeView === 'planner' ? ' active' : ''}`} onClick={() => openWorkspace('planner')}>
                <span className="st-tools-icon">⌗</span> Story Planner
              </button>
              <button className={`st-tools-item${activeView === 'memory' ? ' active' : ''}`} onClick={() => openWorkspace('memory')}>
                <span className="st-tools-icon">◉</span> Memory Bank
              </button>
              <button className={`st-tools-item${activeView === 'toc' ? ' active' : ''}`} onClick={() => openWorkspace('toc')}>
                <span className="st-tools-icon">≡</span> Table of Contents
              </button>
              <button className={`st-tools-item${activeView === 'sections' ? ' active' : ''}`} onClick={() => openWorkspace('sections')}>
                <span className="st-tools-icon">§</span> Sections
              </button>
              <button className={`st-tools-item${activeView === 'scenes' ? ' active' : ''}`} onClick={() => openWorkspace('scenes')}>
                <span className="st-tools-icon">▦</span> Scenes
              </button>
              <button className={`st-tools-item${activeView === 'script' ? ' active' : ''}`} onClick={() => openWorkspace('script')}>
                <span className="st-tools-icon">⟶</span> Script Bridge
              </button>
              <button className={`st-tools-item${activeView === 'lala' ? ' active' : ''}`} onClick={() => openWorkspace('lala')}>
                <span className="st-tools-icon">✧</span> Lala Detection
              </button>
              <button className={`st-tools-item${activeView === 'export' ? ' active' : ''}`} onClick={() => openWorkspace('export')}>
                <span className="st-tools-icon">↓</span> Export
              </button>
            </div>

            {activeChapter && (
              <div className="st-tools-group">
                <div className="st-tools-group-label">This Chapter</div>
                <button className="st-tools-item" onClick={() => { setProseMode(!proseMode); setDrawerOpen(false); }}>
                  <span className="st-tools-icon">{proseMode ? '¶' : '✍'}</span> {proseMode ? 'Switch to Lines' : 'Switch to Prose'}
                </button>
                <button className="st-tools-item" onClick={() => { setBriefOpen(true); setDrawerOpen(false); }}>
                  <span className="st-tools-icon">✎</span> Define Intention
                </button>
                <button className="st-tools-item" onClick={() => { setImportTarget(activeChapter); setDrawerOpen(false); }}>
                  <span className="st-tools-icon">↓</span> Import Draft
                </button>
                <button className={`st-tools-item${reviewMode ? ' active' : ''}`} onClick={() => { setReviewMode(!reviewMode); setDrawerOpen(false); }}>
                  <span className="st-tools-icon">👁</span> Review Mode
                </button>
                <button className={`st-tools-item${canonOpen ? ' active' : ''}`} onClick={() => { setCanonOpen(!canonOpen); setDrawerOpen(false); }}>
                  <span className="st-tools-icon">⊞</span> Canon Panel
                </button>
                <button className={`st-tools-item${writingMode ? ' active' : ''}`} onClick={() => { setWritingMode(!writingMode); setDrawerOpen(false); }}>
                  <span className="st-tools-icon">◯</span> Focus Mode
                </button>
                <button className="st-tools-item" onClick={() => { setRedoInterview(true); setDrawerOpen(false); }}>
                  <span className="st-tools-icon">⟳</span> Scene Interview
                </button>
                <button className="st-tools-item" onClick={() => { setContextExpanded(true); setDrawerOpen(false); }}>
                  <span className="st-tools-icon">⚙</span> Chapter Settings
                </button>
                <button className="st-tools-item st-tools-danger" onClick={() => { resetChapter(); setDrawerOpen(false); }}>
                  <span className="st-tools-icon">✕</span> Reset Chapter
                </button>
              </div>
            )}
          </aside>
        </>
      )}

      {/* ── Editor Body (Nav + Content) ── */}
      <div className="st-editor-body">

        {/* Mobile nav backdrop */}
        {mobileNavOpen && (
          <div className="st-mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
        )}

        {/* Left Navigation */}
        <nav className={`st-nav${mobileNavOpen ? ' st-nav-mobile-open' : ''}`}>
          <div className="st-nav-brand">
              <div className="st-nav-brand-label">Archive</div>
              {editingBookTitle ? (
                <input
                  className="st-inline-edit st-inline-edit-book"
                  value={bookTitleDraft}
                  onChange={e => setBookTitleDraft(e.target.value)}
                  onBlur={saveBookTitle}
                  onKeyDown={e => { if (e.key === 'Enter') saveBookTitle(); if (e.key === 'Escape') setEditingBookTitle(false); }}
                  autoFocus
                />
              ) : (
                <div className="st-nav-brand-row">
                  <h3
                    className="st-nav-brand-title"
                    onDoubleClick={() => { setEditingBookTitle(true); setBookTitleDraft(book.title || ''); }}
                  >
                    {book.title}
                  </h3>
                  <button
                    className="st-nav-edit-btn"
                    onClick={() => { setEditingBookTitle(true); setBookTitleDraft(book.title || ''); }}
                    title="Edit book title"
                  >
                    ✎
                  </button>
                </div>
              )}
              {book.subtitle && <div className="st-nav-brand-sub">{book.subtitle}</div>}
            </div>

          <div className="st-nav-scroll">

          <div className="st-nav-section">
            <div className="st-nav-section-label">Chapters</div>
            <div className="st-nav-chapters">
              {chapters.map((ch, i) => (
                <div key={ch.id} style={{ position: 'relative' }}>
                  <button
                    className={`st-nav-chapter${ch.id === activeChapterId ? ' active' : ''}`}
                    onClick={() => { setActiveChapterId(ch.id); setActiveView('book'); setMobileNavOpen(false); }}
                  >
                    <span className="st-nav-num">{String(i + 1).padStart(2, '0')}</span>
                    <div className="st-nav-chapter-info">
                      {editingChapterId === ch.id ? (
                        <input
                          className="st-inline-edit st-inline-edit-chapter"
                          value={chapterTitleDraft}
                          onChange={e => setChapterTitleDraft(e.target.value)}
                          onBlur={() => saveChapterTitle(ch.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveChapterTitle(ch.id);
                            if (e.key === 'Escape') setEditingChapterId(null);
                          }}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <div
                          className="st-nav-chapter-title"
                          onDoubleClick={e => {
                            e.stopPropagation();
                            setEditingChapterId(ch.id);
                            setChapterTitleDraft(ch.title || '');
                          }}
                        >
                          {ch.title || 'Untitled'}
                        </div>
                      )}
                    </div>
                  </button>
                  <div className="st-nav-chapter-actions">
                    <button
                      className="st-nav-chapter-edit"
                      onClick={e => {
                        e.stopPropagation();
                        setEditingChapterId(ch.id);
                        setChapterTitleDraft(ch.title || '');
                      }}
                      title="Edit chapter title"
                    >
                      ✎
                    </button>
                    <button
                      className="st-nav-chapter-delete"
                      onClick={e => { e.stopPropagation(); deleteChapter(ch.id); }}
                      title="Delete chapter"
                    >
                      ×
                    </button>
                  </div>
                  {/* Section names beneath active chapter — clickable to insert heading */}
                  {ch.id === activeChapterId && Array.isArray(ch.sections) && ch.sections.length > 0 && (
                    <div className="st-nav-sections">
                      {ch.sections.map((sec, si) => {
                        const sectionTitle = sec.content?.substring(0, 36) || sec.meta?.description?.substring(0, 36) || `Section ${si + 1}`;
                        return (
                          <button
                            key={sec.id || si}
                            className="st-nav-section-item st-nav-section-clickable"
                            onClick={(e) => {
                              e.stopPropagation();
                              insertSectionHeading(sectionTitle);
                            }}
                            title={`Write: ${sectionTitle}`}
                          >
                            <span className={`st-nav-section-dot st-dot-${sec.meta?.section_type || sec.type || 'body'}`} />
                            <span className="st-nav-section-label">{sectionTitle}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="st-nav-add">
            <button onClick={() => setShowAddChapter(true)}>+ New Chapter</button>
          </div>

          </div>{/* end st-nav-scroll */}
        </nav>

        {/* ── Main Content ── */}
        <div className="st-editor">

          {/* Add Chapter Form */}
          {showAddChapter && (
            <div className="st-add-chapter-form">
              <div className="st-form-group">
                <label>Title</label>
                <input
                  value={newChapterTitle}
                  onChange={e => setNewChapterTitle(e.target.value)}
                  placeholder="Chapter title"
                  onKeyDown={e => { if (e.key === 'Enter') addChapter(); }}
                />
              </div>
              <div className="st-form-group">
                <label>Era / Badge</label>
                <input
                  value={newChapterBadge}
                  onChange={e => setNewChapterBadge(e.target.value)}
                  placeholder="e.g. Pre-Prime Era"
                />
              </div>
              <button className="st-btn st-btn-sm st-btn-gold" onClick={addChapter}>
                Add
              </button>
              <button
                className="st-btn st-btn-sm st-btn-ghost"
                onClick={() => { setShowAddChapter(false); setNewChapterTitle(''); setNewChapterBadge(''); }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* ── Manuscript View ── */}
          {activeView === 'book' ? (
            activeChapter ? (
              <div className="st-manuscript-wrapper">
                <div className="st-manuscript">

                  {/* Chapter Header — minimal */}
                  <div className="st-chapter-header">
                    <div className="st-chapter-header-label">
                      Chapter {numberWord(chapterIndex)}
                    </div>
                    {editingChapterId === activeChapter.id ? (
                      <input
                        className="st-inline-edit st-inline-edit-chapter-bar"
                        value={chapterTitleDraft}
                        onChange={e => setChapterTitleDraft(e.target.value)}
                        onBlur={() => saveChapterTitle(activeChapter.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveChapterTitle(activeChapter.id);
                          if (e.key === 'Escape') setEditingChapterId(null);
                        }}
                        autoFocus
                      />
                    ) : (
                      <h2
                        className="st-chapter-header-title"
                        onDoubleClick={() => {
                          setEditingChapterId(activeChapter.id);
                          setChapterTitleDraft(activeChapter.title || '');
                        }}
                      >
                        {activeChapter.title || 'Untitled Chapter'}
                      </h2>
                    )}
                  </div>



                  {/* ── Scene Interview (on demand) ── */}
                  {redoInterview && (
                    <SceneInterview
                      book={book}
                      chapter={activeChapter}
                      characters={registryCharacters}
                      onComplete={() => {
                        setInterviewDone(true);
                        setRedoInterview(false);
                        onRefresh();
                      }}
                      onSkip={() => {
                        setInterviewDone(true);
                        setRedoInterview(false);
                      }}
                      onLineAdded={() => onRefresh()}
                    />
                  )}

                  {/* Review Mode Banner */}
                  {reviewMode && (
                    <div className="st-review-banner">
                      <div className="st-review-banner-left">
                        <span className="st-review-banner-icon">{'👁'}</span>
                        <span className="st-review-banner-title">Review Mode</span>
                        <span className="st-review-banner-stats">
                          {approvedLines.length} approved {'·'} {pendingLines.length} pending {'·'} {lines.length} total
                        </span>
                      </div>
                      <div className="st-review-banner-actions">
                        {pendingLines.length > 0 && (
                          <button className="st-btn st-btn-sm st-btn-ghost" onClick={approveAll}>
                            Approve All ({pendingLines.length})
                          </button>
                        )}
                        <button className="st-review-banner-exit" onClick={() => setReviewMode(false)}>
                          Exit Review
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Book Page — the manuscript body */}
                  <div className={`st-book-page${reviewMode ? ' st-book-page-review' : ''}`}>

                    {proseMode ? (
                      /* ── Prose Mode (WriteMode-style textarea) ── */
                      <>
                        <textarea
                          className="st-prose-textarea"
                          value={proseText}
                          onChange={e => {
                            setProseText(e.target.value);
                            proseRef.current = e.target.value;
                            setProseSaved(false);
                            proseSavedRef.current = false;
                          }}
                          onBlur={() => { if (!proseSavedRef.current) doSave(); }}
                          onKeyDown={e => {
                            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                              e.preventDefault();
                              doSave();
                            }
                          }}
                          placeholder="Start writing your story here…"
                        />
                        <div className="st-prose-status">
                          <span>{proseText.split(/\s+/).filter(Boolean).length} words</span>
                          {proseSaved ? (
                            <span className="st-prose-saved">✓ Saved</span>
                          ) : (
                            <button className="st-prose-save-btn" onClick={doSave}>Save now</button>
                          )}
                        </div>
                      </>
                    ) : (
                      /* ── Line-by-Line Mode ── */
                      <>
                    {/* Approved lines with Narrative Intelligence every 5 */}
                    {approvedLines.map((ln, i) => (
                      <React.Fragment key={ln.id}>
                        {renderLine(ln, false)}
                        {(i + 1) % 5 === 0 && i < approvedLines.length - 1 && (
                          <div className="narrative-intelligence-wrapper">
                            <div className="st-ai-indicator">
                              <span className="st-ai-indicator-tooltip">
                                Narrative intelligence
                              </span>
                            </div>
                            <NarrativeIntelligence
                              chapter={activeChapter}
                              lines={approvedLines.slice(Math.max(0, i - 4), i + 1)}
                              lineIndex={i}
                              book={book}
                              characters={registryCharacters}
                            />
                          </div>
                        )}
                      </React.Fragment>
                    ))}

                    {/* Continuity Guard */}
                    <ContinuityGuard
                      chapter={activeChapter}
                      lines={approvedLines}
                      book={book}
                      triggerLine={lastApprovedLine}
                    />

                    {/* Pending Lines — collapsible */}
                    {pendingLines.length > 0 && (
                      <>
                        <button
                          className="st-pending-toggle"
                          onClick={() => setPendingOpen(!pendingOpen)}
                        >
                          <span className={`arrow${pendingOpen ? ' open' : ''}`}>▸</span>
                          {pendingLines.length} pending {pendingLines.length === 1 ? 'line' : 'lines'}
                        </button>
                        {pendingOpen && (
                          <div className="st-pending-body">
                            {pendingLines.map(ln => (
                              <React.Fragment key={ln.id}>
                                {renderLine(ln, true)}
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Add Line */}
                    {addingLineTo === activeChapterId ? (
                      <div className="st-add-line">
                        <input
                          value={newLineText}
                          onChange={e => setNewLineText(e.target.value)}
                          placeholder="Continue writing…"
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) addLine(activeChapterId); }}
                          autoFocus
                        />
                        <button
                          className="st-btn st-btn-sm st-btn-gold"
                          onClick={() => addLine(activeChapterId)}
                        >
                          Add
                        </button>
                      </div>
                    ) : (
                      <button
                        className="st-add-line-trigger"
                        onClick={() => setAddingLineTo(activeChapterId)}
                      >
                        Continue writing…
                      </button>
                    )}
                      </>
                    )}
                  </div>


                </div>

                {/* Canon Panel — right side, sticky */}
                {canonOpen && (
                  <div className="st-canon-panel">
                    <div className="st-canon-header">
                      Canon
                      <button
                        className="st-canon-close"
                        onClick={() => setCanonOpen(false)}
                      >
                        ×
                      </button>
                    </div>
                    <div className="st-canon-body">
                      {registryCharacters.length > 0 ? (
                        registryCharacters.map(char => (
                          <div key={char.id} className="st-canon-row">
                            <span className="st-canon-label">{char.name}</span>
                            <span className="st-canon-value">
                              {char.role || char.description || '—'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 13, color: 'var(--st-muted)', fontStyle: 'italic' }}>
                          No characters in registry
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="st-welcome">
                <div className="st-welcome-icon">✦</div>
                <h2 className="st-welcome-title">Select a chapter to start writing</h2>
                <p className="st-welcome-sub">Pick a chapter from the sidebar, or create a new one.</p>
                <button className="st-btn st-btn-sm st-btn-gold" onClick={() => setShowAddChapter(true)}>+ New Chapter</button>
              </div>
            )

          /* ── Workspace Panels ── */
          ) : activeView === 'toc' ? (
            <TOCPanel book={book} chapters={chapters} onChapterClick={(id) => { setActiveChapterId(id); setActiveView('book'); }} />
          ) : activeView === 'memory' ? (
            <MemoryBankView bookId={book.id} />
          ) : activeView === 'scenes' ? (
            <ScenesPanel bookId={book.id} chapters={chapters} />
          ) : activeView === 'lala' ? (
            <LalaSceneDetection bookId={book.id} />
          ) : activeView === 'export' ? (
            <ExportPanel bookId={book.id} />
          ) : activeView === 'script' ? (
            <ScriptBridgePanel
              bookId={book.id}
              bookTitle={book.title}
              chapterId={activeChapter?.id}
              chapterTitle={activeChapter?.title}
              showId={book.show_id}
            />
          ) : activeView === 'sections' ? (
            activeChapter ? (
              <SectionEditor
                chapter={activeChapter}
                onSave={(updated) => {
                  setChapters(prev => prev.map(ch =>
                    ch.id === activeChapter.id ? { ...ch, sections: updated } : ch
                  ));
                }}
                onGoToSection={(title) => insertSectionHeading(title)}
                toast={toast}
              />
            ) : (
              <div className="st-welcome">
                <div className="st-welcome-icon">§</div>
                <h2 className="st-welcome-title">Select a chapter first</h2>
                <p className="st-welcome-sub">Pick a chapter from the sidebar to edit its sections.</p>
              </div>
            )
          ) : activeView === 'planner' ? (
            <StoryPlannerConversational
              book={book}
              chapters={chapters}
              characters={registryCharacters}
              onApply={() => { onRefresh?.(); setActiveView('book'); }}
              onClose={() => setActiveView('book')}
              toast={toast}
            />
          ) : null}
        </div>
      </div>

      {/* ── Brief Sheet — right-side overlay ── */}
      {briefOpen && (
        <div className="st-brief-sheet-overlay" onClick={() => setBriefOpen(false)}>
          <div className="st-brief-sheet" onClick={e => e.stopPropagation()}>
            <div className="st-brief-sheet-header">
              <span className="st-brief-sheet-title">Define Intention</span>
              <button
                className="st-brief-sheet-close"
                onClick={() => setBriefOpen(false)}
              >
                ×
              </button>
            </div>
            <ChapterBrief chapter={activeChapter} characters={registryCharacters} />
          </div>
        </div>
      )}

      {/* ── Import Draft Modal ── */}
      {importTarget && (
        <ImportDraftModal
          chapterId={importTarget.id}
          chapterTitle={importTarget.title}
          open={true}
          onClose={() => setImportTarget(null)}
          onImported={() => { setImportTarget(null); onRefresh(); }}
        />
      )}

      {/* ═══ AI Bottom Bar — fixed to viewport bottom ═══ */}
      {activeView === 'book' && activeChapter && (
        <div className={`st-bottombar${aiResult || aiError ? ' st-bottombar-expanded' : ''}`}>

          {/* Result slide-up panel */}
          {(aiResult || aiError) && (
            <div className="st-bottombar-result">
              {aiError ? (
                <div className="st-bottombar-error">
                  <span>{aiError}</span>
                  <button onClick={discardAiResult}>Dismiss</button>
                </div>
              ) : (
                <>
                  <div className="st-bottombar-result-header">
                    <span className="st-bottombar-result-label">
                      ✦ {AI_ACTIONS.find(a => a.id === aiAction)?.label || 'Generated'}
                    </span>
                    <button className="st-bottombar-result-close" onClick={discardAiResult}>✕</button>
                  </div>
                  <div className="st-bottombar-result-text">{aiResult}</div>
                  <div className="st-bottombar-result-actions">
                    <button className="st-bottombar-insert" onClick={insertAiResult}>
                      {aiAction === 'rewrite' ? 'Copy to clipboard' : 'Insert into manuscript'}
                    </button>
                    <button className="st-bottombar-retry" onClick={() => {
                      const a = AI_ACTIONS.find(x => x.id === aiAction);
                      if (a) runAiAction(a);
                    }}>
                      Try again
                    </button>
                    <button className="st-bottombar-discard" onClick={discardAiResult}>Discard</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Action buttons row */}
          <div className="st-bottombar-actions">
            <div className="st-bottombar-label">
              <span className="st-bottombar-icon">✦</span>
              AI
            </div>
            {AI_ACTIONS.map(action => (
              <button
                key={action.id}
                className={`st-bottombar-btn${aiAction === action.id && aiLoading ? ' loading' : ''}`}
                onClick={() => runAiAction(action)}
                disabled={aiLoading}
                title={action.sub}
              >
                <span className="st-bottombar-btn-icon">{action.icon}</span>
                <span className="st-bottombar-btn-label">{action.label}</span>
                {aiLoading && aiAction === action.id && (
                  <span className="st-bottombar-spinner">◌</span>
                )}
              </button>
            ))}
            <div className="st-bottombar-meta">
              <span className="st-bottombar-wordcount">
                {proseText.split(/\s+/).filter(Boolean).length} w
              </span>
              <span className={`st-bottombar-save${proseSaved ? ' saved' : ''}`}>
                {proseSaved ? '✓' : '…'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
