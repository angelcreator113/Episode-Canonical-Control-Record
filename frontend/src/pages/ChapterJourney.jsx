/**
 * ChapterJourney.jsx — Phase 3: Mode Ribbon + Narrative OS
 *
 * Route: /chapter/:bookId/:chapterId
 *
 * Phase 3 adds:
 *  - Structured Mode Ribbon (mode identity + chapter context + info blocks)
 *  - Progress strip per stage
 *  - Stage-aware save button in ribbon
 *  - Override as structured blocks instead of sentence
 *  - Story arc / emotional / narrative metadata in info blocks
 */

import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import './ChapterJourney.css';

// File-local helpers. getBookApi is a 2-fold cross-CP dup (CP10 StoryEvaluationEngine).
// getDefaultRegistryApi is fresh.
export const getBookApi = (bookId) =>
  apiClient.get(`/api/v1/storyteller/books/${bookId}`).then((r) => r.data);
export const getDefaultRegistryApi = () =>
  apiClient.get('/api/v1/character-registry/registries/default').then((r) => r.data);

// ── Lazy imports ───────────────────────────────────────────────────────────
const StoryPlannerConversational = lazy(() =>
  import('../components/StoryPlannerConversational')
);
const WriteMode = lazy(() =>
  import('./WriteMode')
);

// ── Stage detection ────────────────────────────────────────────────────────

function detectStage(chapter) {
  if (!chapter) return 'plan';
  const lines = chapter.lines || [];
  const approved = lines.filter(l => l.status === 'approved' || l.status === 'edited').length;
  if (approved >= 5)              return 'review';
  if (chapter.prose?.trim())      return 'review';
  if (lines.length > 0)           return 'review';
  if (chapter.scene_goal?.trim()) return 'write';
  return 'plan';
}

const STAGES = [
  { id: 'plan',   label: 'Story Planner' },
  { id: 'write',  label: 'WriteMode'     },
  { id: 'review', label: 'StoryTeller'   },
];

const MODE_LABELS = {
  plan:   'Story Planner',
  write:  'WriteMode',
  review: 'StoryTeller',
};

const SAVE_LABELS = {
  plan:   '💾 Save Plan',
  write:  '💾 Save Draft',
  review: '💾 Save Final',
};

// Stage-specific info blocks content
function getInfoBlocks(activeStage, chapter, book) {
  const chapters = book?.chapters || [];
  const idx = chapters.findIndex(c => c.id === chapter?.id);
  const chNum = idx >= 0 ? idx + 1 : 1;
  const total = chapters.length || 1;

  const emotional = chapter?.emotionalStart && chapter?.emotionalEnd
    ? `${chapter.emotionalStart} → ${chapter.emotionalEnd}`
    : chapter?.emotionalStart || chapter?.emotionalEnd || null;

  if (activeStage === 'plan') {
    return [
      { key: 'Status',    val: chapter?.what?.trim() ? 'Brief drafted' : 'Needs a brief' },
      { key: 'Next Step', val: chapter?.what?.trim() ? 'Move to WriteMode' : 'Define what happens' },
      { key: 'Emotional Arc', val: emotional || 'Not set yet' },
    ];
  }
  if (activeStage === 'write') {
    const lineCount = chapter?.lines?.length || 0;
    return [
      { key: 'Status',    val: lineCount > 0 ? `${lineCount} lines drafted` : 'No lines yet' },
      { key: 'Scene Goal', val: chapter?.scene_goal?.trim() || 'Open-ended' },
      { key: 'Chapter',    val: `${chNum} of ${total}` },
    ];
  }
  // review
  const approved = (chapter?.lines || []).filter(l => l.status === 'approved' || l.status === 'edited').length;
  const totalLines = chapter?.lines?.length || 0;
  return [
    { key: 'Status',   val: totalLines > 0 ? `${approved}/${totalLines} approved` : 'No lines yet' },
    { key: 'Quality',  val: approved === totalLines && totalLines > 0 ? 'Ready to publish' : 'In progress' },
    { key: 'Chapter',  val: `${(idx >= 0 ? idx + 1 : 1)} of ${total}` },
  ];
}

// Progress stats
function getProgress(activeStage, book) {
  const chapters = book?.chapters || [];
  if (chapters.length === 0) return { label: 'Progress', done: 0, total: 1 };

  if (activeStage === 'plan') {
    const planned = chapters.filter(c => c.what?.trim() || c.emotionalStart?.trim() || c.emotionalEnd?.trim()).length;
    return { label: 'Planned', done: planned, total: chapters.length };
  }
  if (activeStage === 'write') {
    const drafted = chapters.filter(c => {
      const lines = c.lines || [];
      return lines.length > 0 || c.scene_goal?.trim();
    }).length;
    return { label: 'Drafted', done: drafted, total: chapters.length };
  }
  // review
  const reviewed = chapters.filter(c => {
    const lines = c.lines || [];
    const approved = lines.filter(l => l.status === 'approved' || l.status === 'edited').length;
    return approved >= 5 || c.prose?.trim();
  }).length;
  return { label: 'Reviewed', done: reviewed, total: chapters.length };
}

// ── Override structured blocks ─────────────────────────────────────────────

function getOverrideBlocks(activeStage, detectedStage) {
  const detected = STAGES.find(s => s.id === detectedStage)?.label || detectedStage;
  if (activeStage === 'plan') {
    return [
      { key: 'Mode',   val: 'Story Planner (manual)' },
      { key: 'Detected', val: detected },
      { key: 'Impact', val: 'No brief yet — defaults will be used' },
    ];
  }
  if (activeStage === 'write') {
    return [
      { key: 'Mode',   val: 'WriteMode (manual)' },
      { key: 'Detected', val: detected },
      { key: 'Impact', val: 'Draft ready for StoryTeller' },
    ];
  }
  return [
    { key: 'Mode',   val: 'StoryTeller (manual)' },
    { key: 'Detected', val: detected },
    { key: 'Impact', val: 'May lack brief or prose' },
  ];
}

// ── ChapterJourney ─────────────────────────────────────────────────────────

export default function ChapterJourney() {
  const { bookId, chapterId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [book, setBook]                   = useState(null);
  const [chapter, setChapter]             = useState(null);
  const [characters, setCharacters]       = useState([]);
  const [detectedStage, setDetectedStage] = useState('plan');
  const [activeStage, setActiveStage]     = useState('plan');
  const [isOverride, setIsOverride]       = useState(false);
  const [isFlashing, setIsFlashing]       = useState(false);
  const [stageEnter, setStageEnter]       = useState(false);
  const [toolsOpen, setToolsOpen]         = useState(false);

  // Tools dropdown: Save + AI Writer + WriteMode center-tab tools
  const TOOL_ITEMS = [
    { id: 'save',      icon: '💾', label: SAVE_LABELS[activeStage] || 'Save', action: 'save' },
    { id: 'ai-writer', icon: '✦',  label: 'AI Writer', action: 'toggle-context' },
    { id: 'structure', icon: '§',  label: 'Structure' },
    { id: 'scenes',    icon: '▦',  label: 'Scenes'    },
    { id: 'memory',    icon: '◉',  label: 'Memory'    },
    { id: 'lala',      icon: '✧',  label: 'Lala'      },
    { id: 'export',    icon: '↓',  label: 'Export'    },
  ];

  // Close tools dropdown on outside click
  const toolsRef = useRef(null);
  useEffect(() => {
    if (!toolsOpen) return;
    const close = (e) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target)) setToolsOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [toolsOpen]);

  // Optional ref hook: children that support imperative save can attach here
  const saveRef = useRef(null);

  // Save: try child imperative ref first, fall back to custom event
  const handleRibbonSave = useCallback(() => {
    if (saveRef.current?.save) {
      saveRef.current.save();
    } else {
      window.dispatchEvent(new CustomEvent('cj-ribbon-save', { detail: { stage: activeStage } }));
    }
  }, [activeStage]);

  const handleToolSelect = useCallback((toolId, action) => {
    if (action === 'save') {
      handleRibbonSave();
    } else if (action === 'toggle-context') {
      window.dispatchEvent(new CustomEvent('cj-toggle-context', { detail: { tab: 'ai-writer' } }));
    } else {
      window.dispatchEvent(new CustomEvent('cj-set-tab', { detail: toolId }));
    }
    setToolsOpen(false);
  }, [handleRibbonSave]);

  // ── Load chapter data ──────────────────────────────────────────────────

  const loadChapter = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load book + chapters AND characters in parallel
      const [data, charData] = await Promise.all([
        getBookApi(bookId),
        getDefaultRegistryApi().catch(() => null), // characters are optional — don't block on failure
      ]);

      const bookData = data.book || data;
      const chapters = bookData.chapters || [];
      const found = chapters.find(c => c.id === chapterId) || chapters[0];

      setBook(bookData);
      setChapter(found || null);

      // Load characters from default registry
      if (charData) {
        const reg = charData.registry || charData;
        setCharacters(reg.characters || reg.RegistryCharacters || []);
      }

      const stage = detectStage(found);
      setDetectedStage(stage);
      setActiveStage(stage);
      setIsOverride(false);
    } catch (err) {
      setError(err.message || 'Failed to load chapter');
    } finally {
      setLoading(false);
    }
  }, [bookId, chapterId]);

  useEffect(() => { loadChapter(); }, [loadChapter]);

  // ── Stage transition with flash ────────────────────────────────────────

  const transitionTo = useCallback((newStage, override = false) => {
    if (newStage === activeStage) return;
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 320);
    setStageEnter(false);
    setTimeout(() => setStageEnter(true), 50);
    setActiveStage(newStage);
    setIsOverride(override);
  }, [activeStage]);

  const handlePillClick = useCallback((stageId) => {
    if (stageId === activeStage) return;
    transitionTo(stageId, stageId !== detectedStage);
  }, [activeStage, detectedStage, transitionTo]);

  const handleReturnToAuto = useCallback(() => {
    transitionTo(detectedStage, false);
  }, [detectedStage, transitionTo]);

  // ── Stage callbacks ────────────────────────────────────────────────────

  const handlePlanComplete = useCallback(() => {
    transitionTo('write', false);
  }, [transitionTo]);

  const handleWriteComplete = useCallback(() => {
    transitionTo('review', false);
  }, [transitionTo]);

  const handleReviewComplete = useCallback(() => {
    try { sessionStorage.removeItem('st_chapter'); } catch {}
    navigate('/start');
  }, [navigate]);

  const handleChapterRefresh = useCallback(async () => {
    await loadChapter();
  }, [loadChapter]);

  // ── Memoized info ──────────────────────────────────────────────────────

  const infoBlocks = useMemo(
    () => getInfoBlocks(activeStage, chapter, book),
    [activeStage, chapter, book]
  );

  const progress = useMemo(
    () => getProgress(activeStage, book),
    [activeStage, book]
  );

  const overrideBlocks = useMemo(
    () => isOverride ? getOverrideBlocks(activeStage, detectedStage) : [],
    [isOverride, activeStage, detectedStage]
  );

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="cj-loading">
      <div className="cj-loading-dots">
        <span /><span /><span />
      </div>
      <p className="cj-loading-label">Loading chapter…</p>
    </div>
  );

  if (error) return (
    <div className="cj-error">
      <p>Couldn't load this chapter.</p>
      <small>{error}</small>
      <div>
        <button onClick={loadChapter}>Try again</button>
        <button onClick={() => navigate(-1)}>← Go back</button>
      </div>
    </div>
  );

  const stageClass  = activeStage;
  const flashClass  = isFlashing ? 'cj-flash' : '';
  const rootClasses = `cj-root cj-${stageClass} ${flashClass}`.trim();
  const chapterTitle = chapter?.title || 'Untitled Chapter';
  const bookTitle    = book?.title    || 'Untitled Book';
  const pctDone = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  const sharedProps = {
    bookId,
    chapterId,
    book,
    chapter,
    characters,
    onChapterRefresh: handleChapterRefresh,
  };

  return (
    <div className={rootClasses}>

      {/* ── Mode Ribbon ────────────────────────────────────────────────── */}
      <div className="cj-ribbon">

        {/* Row 1: back + mode identity + chapter context + save */}
        <div className="cj-ribbon-top">
          <button
            className="cj-back"
            onClick={() => {
              try { sessionStorage.removeItem('st_chapter'); } catch {}
              navigate('/start');
            }}
            title="Back to session"
          >←</button>

          <div className="cj-mode-label">
            <span className="cj-mode-dot" />
            {MODE_LABELS[activeStage]}
          </div>

          <div className="cj-mode-context">
            <span className="cj-mode-chapter" title={chapterTitle}>{chapterTitle}</span>
            <span className="cj-mode-book" title={bookTitle}>{bookTitle}</span>
          </div>

          {/* Tools dropdown — replaces separate Save button.
              In plan stage only Save is shown (inline button).
              In write/review stages the full dropdown appears. */}
          {(activeStage === 'write' || activeStage === 'review') ? (
            <div className="cj-tools-wrap" ref={toolsRef}>
              <button
                className={`cj-tools-btn${toolsOpen ? ' open' : ''}`}
                onClick={() => setToolsOpen(o => !o)}
                title="Tools & Save"
              >
                ⚙ Tools
              </button>
              {toolsOpen && (
                <div className="cj-tools-dropdown">
                  {TOOL_ITEMS.map(t => (
                    <button
                      key={t.id}
                      className={`cj-tools-item${t.id === 'save' ? ' cj-tools-save' : ''}`}
                      onClick={() => handleToolSelect(t.id, t.action)}
                    >
                      <span className="cj-tools-icon">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button className="cj-save-btn" onClick={handleRibbonSave} title={SAVE_LABELS[activeStage]}>
              {SAVE_LABELS[activeStage]}
            </button>
          )}
        </div>

        {/* Row 2: stage pills + optional override return */}
        <div className="cj-ribbon-nav">
          <div className="cj-pills">
            {STAGES.map((s, i) => {
              const isActive   = s.id === activeStage;
              const isDetected = s.id === detectedStage;
              return (
                <Fragment key={s.id}>
                  {i > 0 && <span className="cj-pill-sep">›</span>}
                  <button
                    className={`cj-pill ${isActive ? 'cj-active' : ''}`}
                    data-s={s.id}
                    onClick={() => handlePillClick(s.id)}
                    title={isDetected && !isOverride
                      ? 'Current stage (auto-detected)'
                      : isDetected
                      ? 'Detected stage — click to return'
                      : `Jump to ${s.label}`}
                  >
                    {isDetected && !isOverride && <span className="cj-pill-dot" />}
                    <span className="cj-pill-label">{s.label}</span>
                  </button>
                </Fragment>
              );
            })}
          </div>
        </div>

        {/* Row 3: structured info blocks */}
        <div className="cj-ribbon-info">
          {infoBlocks.map((b, i) => (
            <div className="cj-info-block" key={i}>
              <span className="cj-info-label">{b.key}</span>
              <span className="cj-info-value">{b.val}</span>
            </div>
          ))}
        </div>

        {/* Row 4: progress strip */}
        <div className="cj-progress-strip">
          <span className="cj-progress-label">{progress.label}</span>
          <div className="cj-progress-track">
            <div
              className="cj-progress-fill"
              style={{ width: `${pctDone}%` }}
            />
          </div>
          <span className="cj-progress-count">{progress.done}/{progress.total}</span>
        </div>
      </div>

      {/* ── Override banner ────────────────────────────────────────────────── */}
      {isOverride && (
        <div className="cj-override-banner">
          <div className="cj-override-blocks">
            {overrideBlocks.map((b, i) => (
              <div className="cj-ob-item" key={i}>
                <span className="cj-ob-key">{b.key}</span>
                <span className="cj-ob-val">{b.val}</span>
              </div>
            ))}
          </div>
          <button className="cj-pill-auto" onClick={handleReturnToAuto}>
            ↺ Return to {STAGES.find(s => s.id === detectedStage)?.label}
          </button>
        </div>
      )}

      {/* ── Stage content ────────────────────────────────────────────────── */}
      <Suspense fallback={
        <div className="cj-loading">
          <div className="cj-loading-dots"><span /><span /><span /></div>
        </div>
      }>
        <div className={`cj-content ${stageEnter ? 'cj-stage-enter' : ''}`.trim()}>

          {activeStage === 'plan' && (
            <StoryPlannerConversational
              {...sharedProps}
              onComplete={handlePlanComplete}
              hideHeader={true}
              activeChapterId={chapterId}
            />
          )}

          {activeStage === 'write' && (
            <WriteMode
              {...sharedProps}
              onReviewReady={handleWriteComplete}
              hideTopBar={true}
            />
          )}

          {activeStage === 'review' && (
            <WriteMode
              {...sharedProps}
              onReviewReady={handleReviewComplete}
              hideTopBar={true}
              initialCenterTab="review"
            />
          )}

        </div>
      </Suspense>
    </div>
  );
}
