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

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './ChapterJourney.css';

// ── Lazy imports ───────────────────────────────────────────────────────────
const StoryPlannerConversational = React.lazy(() =>
  import('../components/StoryPlannerConversational')
);
const WriteMode = React.lazy(() =>
  import('./WriteMode')
);
const StorytellerPage = React.lazy(() =>
  import('./StorytellerPage')
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

function detectChapterStage(ch) {
  if (!ch) return 'plan';
  const lines = ch.lines || [];
  const approved = lines.filter(l => l.status === 'approved' || l.status === 'edited').length;
  if (approved >= 5 || ch.prose?.trim() || lines.length > 0) return 'review';
  if (ch.scene_goal?.trim()) return 'write';
  const hasContent = ch.what?.trim() || ch.emotionalStart?.trim() || ch.emotionalEnd?.trim();
  if (hasContent) return 'planned';
  return 'plan';
}

const STAGES = [
  { id: 'plan',   label: 'Plan'   },
  { id: 'write',  label: 'Write'  },
  { id: 'review', label: 'Review' },
];

const MODE_LABELS = {
  plan:   'Plan Mode',
  write:  'Write Mode',
  review: 'Review Mode',
};

const SAVE_LABELS = {
  plan:   '💾 Save Plan',
  write:  '💾 Save Draft',
  review: '💾 Save Review',
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
      { key: 'Next Step', val: chapter?.what?.trim() ? 'Refine characters & arc' : 'Define what happens' },
      { key: 'Emotional Arc', val: emotional || 'Not set yet' },
    ];
  }
  if (activeStage === 'write') {
    const lineCount = chapter?.lines?.length || 0;
    return [
      { key: 'Status',    val: lineCount > 0 ? `${lineCount} lines drafted` : 'No lines yet' },
      { key: 'Scene Goal', val: chapter?.scene_goal?.trim() || 'Open-ended' },
      { key: 'Chapter', val: `${chNum} of ${total}` },
    ];
  }
  // review
  const approved = (chapter?.lines || []).filter(l => l.status === 'approved' || l.status === 'edited').length;
  const totalLines = chapter?.lines?.length || 0;
  return [
    { key: 'Status',   val: totalLines > 0 ? `${approved}/${totalLines} approved` : 'No lines to review' },
    { key: 'Quality',  val: approved === totalLines && totalLines > 0 ? 'Ready to publish' : 'In review' },
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
      { key: 'Mode',   val: 'Plan (manual)' },
      { key: 'Detected', val: detected },
      { key: 'Impact', val: 'No brief yet — defaults will be used' },
    ];
  }
  if (activeStage === 'write') {
    return [
      { key: 'Mode',   val: 'Write (manual)' },
      { key: 'Detected', val: detected },
      { key: 'Impact', val: 'Draft ready for review' },
    ];
  }
  return [
    { key: 'Mode',   val: 'Review (manual)' },
    { key: 'Detected', val: detected },
    { key: 'Impact', val: 'May lack brief or prose' },
  ];
}

// ── ChapterJourney ─────────────────────────────────────────────────────────

export default function ChapterJourney() {
  const { bookId, chapterId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [book, setBook]                 = useState(null);
  const [chapter, setChapter]           = useState(null);
  const [detectedStage, setDetectedStage] = useState('plan');
  const [activeStage, setActiveStage]   = useState('plan');
  const [isOverride, setIsOverride]     = useState(false);
  const [isFlashing, setIsFlashing]     = useState(false);
  const [stageEnter, setStageEnter]     = useState(false);

  const prevStageRef = useRef(null);
  const saveRef = useRef(null); // ref placeholder for child save triggers

  // ── Load chapter data ──────────────────────────────────────────────────

  const loadChapter = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/v1/storyteller/books/${bookId}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

      const data = await res.json();
      const bookData = data.book || data;
      const chapters = bookData.chapters || [];
      const found = chapters.find(c => c.id === chapterId) || chapters[0];

      setBook(bookData);
      setChapter(found || null);

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
    prevStageRef.current = activeStage;
  }, [activeStage]);

  const handlePillClick = useCallback((stageId) => {
    if (stageId === activeStage) return;
    if (stageId === detectedStage) {
      transitionTo(stageId, false);
      return;
    }
    transitionTo(stageId, true);
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
    navigate(`/storyteller?bookId=${bookId}`);
  }, [navigate, bookId]);

  const handleChapterRefresh = useCallback(async () => {
    await loadChapter();
  }, [loadChapter]);

  // Save button handler — triggers child's save via ref or custom event
  const handleRibbonSave = useCallback(() => {
    if (saveRef.current?.save) {
      saveRef.current.save();
    } else {
      // Dispatch custom event that child can listen for
      window.dispatchEvent(new CustomEvent('cj-ribbon-save', { detail: { stage: activeStage } }));
    }
  }, [activeStage]);

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
    onChapterRefresh: handleChapterRefresh,
  };

  return (
    <div className={rootClasses}>

      {/* ── Mode Ribbon ────────────────────────────────────────────────── */}
      <div className="cj-ribbon">

        {/* Row 1: mode identity + context + pills + save */}
        <div className="cj-ribbon-row">
          <button
            className="cj-back"
            onClick={() => navigate(`/storyteller?bookId=${bookId}`)}
            title="Back to book"
          >←</button>

          <div className="cj-mode-label">
            <span className="cj-mode-dot" />
            {MODE_LABELS[activeStage]}
          </div>

          <div className="cj-mode-context">
            <span className="cj-mode-chapter" title={chapterTitle}>{chapterTitle}</span>
            <span className="cj-mode-book" title={bookTitle}>{bookTitle}</span>
          </div>

          {/* Stage pills */}
          <div className="cj-pills">
            {STAGES.map((s, i) => {
              const isActive   = s.id === activeStage;
              const isDetected = s.id === detectedStage;
              return (
                <React.Fragment key={s.id}>
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
                    {s.label}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          <div className="cj-ribbon-actions">
            {isOverride && (
              <button className="cj-pill-auto" onClick={handleReturnToAuto} title="Return to auto-detected stage">
                ↺ Return to {STAGES.find(s => s.id === detectedStage)?.label}
              </button>
            )}
            <button className="cj-save-btn" onClick={handleRibbonSave} title={SAVE_LABELS[activeStage]}>
              {SAVE_LABELS[activeStage]}
            </button>
          </div>
        </div>

        {/* Row 2: structured info blocks */}
        <div className="cj-ribbon-info">
          {infoBlocks.map((b, i) => (
            <div className="cj-info-block" key={i}>
              <span className="cj-info-label">{b.key}</span>
              <span className="cj-info-value">{b.val}</span>
            </div>
          ))}
        </div>

        {/* Row 3: progress strip */}
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

      {/* ── Override banner (structured) ─────────────────────────────────── */}
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
      <React.Suspense fallback={
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
            <StorytellerPage
              {...sharedProps}
              initialView="book"
              onChapterComplete={handleReviewComplete}
              hideTopBar={true}
            />
          )}

        </div>
      </React.Suspense>
    </div>
  );
}
