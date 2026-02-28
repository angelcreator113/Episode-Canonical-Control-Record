/**
 * ChapterJourney.jsx — Phase 2: Unified Shell
 *
 * Route: /chapter/:bookId/:chapterId
 *
 * What Phase 2 adds over Phase 1:
 *  - Stage-aware color system (light pink / light teal / gold)
 *  - Shared top bar with breadcrumb + stage pills
 *  - Brief flash animation on stage transitions
 *  - Override warning banner
 *  - Stage-enter animation on child component
 *  - Three-dot loading state with stage colors
 *
 * What this file does NOT change:
 *  - Stage detection logic (same as Phase 1)
 *  - Which component renders per stage
 *  - Props passed to child components
 *  - Backend API calls
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './ChapterJourney.css';

// ── Lazy imports — same as Phase 1 ────────────────────────────────────────
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

// Stage metadata — labels, arrows between stages
const STAGES = [
  { id: 'plan',   label: 'Plan'   },
  { id: 'write',  label: 'Write'  },
  { id: 'review', label: 'Review' },
];

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

    // Flash on change
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 320);

    // Stage-enter animation on new content
    setStageEnter(false);
    setTimeout(() => setStageEnter(true), 50);

    setActiveStage(newStage);
    setIsOverride(override);
    prevStageRef.current = activeStage;
  }, [activeStage]);

  const handlePillClick = useCallback((stageId) => {
    if (stageId === activeStage) return;

    // If clicking detected stage — remove override
    if (stageId === detectedStage) {
      transitionTo(stageId, false);
      return;
    }

    // Otherwise it's a manual override
    transitionTo(stageId, true);
  }, [activeStage, detectedStage, transitionTo]);

  const handleReturnToAuto = useCallback(() => {
    transitionTo(detectedStage, false);
  }, [detectedStage, transitionTo]);

  // ── Stage callbacks (passed to child components) ───────────────────────

  const handlePlanComplete = useCallback(() => {
    transitionTo('write', false);
  }, [transitionTo]);

  const handleWriteComplete = useCallback(() => {
    transitionTo('review', false);
  }, [transitionTo]);

  const handleReviewComplete = useCallback(() => {
    // Chapter done — for now navigate back to book
    navigate(`/storyteller?bookId=${bookId}`);
  }, [navigate, bookId]);

  const handleChapterRefresh = useCallback(async () => {
    await loadChapter();
  }, [loadChapter]);

  // ── Override warning message ───────────────────────────────────────────

  const overrideMessages = {
    plan:   `Viewing Plan — no brief yet. Chapter will use defaults when writing starts.`,
    write:  `Viewing Write — chapter draft is ready for review.`,
    review: `Viewing Review — chapter may not have a brief or prose yet.`,
  };

  // ── Render helpers ─────────────────────────────────────────────────────

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

  const stageClass  = activeStage;                           // 'plan' | 'write' | 'review'
  const flashClass  = isFlashing ? 'cj-flash' : '';
  const rootClasses = `cj-root cj-${stageClass} ${flashClass}`.trim();
  const chapterTitle = chapter?.title || 'Untitled Chapter';
  const bookTitle    = book?.title    || 'Untitled Book';

  // Shared props for all child components
  const sharedProps = {
    bookId,
    chapterId,
    book,
    chapter,
    onChapterRefresh: handleChapterRefresh,
  };

  return (
    <div className={rootClasses}>

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="cj-bar">
        <button
          className="cj-back"
          onClick={() => navigate(`/storyteller?bookId=${bookId}`)}
          title="Back to book"
        >
          ←
        </button>

        <div className="cj-breadcrumb">
          <span className="cj-book-name" title={bookTitle}>{bookTitle}</span>
          <span className="cj-sep">·</span>
          <span className="cj-chapter-name" title={chapterTitle}>{chapterTitle}</span>
        </div>

        {/* Stage pills */}
        <div className="cj-pills">
          {STAGES.map((s, i) => {
            const isActive   = s.id === activeStage;
            const isDetected = s.id === detectedStage;
            return (
              <React.Fragment key={s.id}>
                {i > 0 && (
                  <span className="cj-pill-sep" style={{
                    fontSize: 9,
                    opacity: 0.2,
                    color: 'currentColor',
                    margin: '0 1px',
                    userSelect: 'none',
                  }}>›</span>
                )}
                <button
                  className={`cj-pill ${isActive ? 'cj-active' : ''}`}
                  data-s={s.id}
                  onClick={() => handlePillClick(s.id)}
                  title={isDetected && !isOverride
                    ? `Current stage (auto-detected)`
                    : isDetected
                    ? `Detected stage — click to return`
                    : `Jump to ${s.label}`}
                >
                  {isDetected && !isOverride && <span className="cj-pill-dot" />}
                  {s.label}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Return to auto button — visible only when overriding */}
        {isOverride && (
          <button className="cj-pill-auto" onClick={handleReturnToAuto} title="Return to auto-detected stage">
            ↺ Auto
          </button>
        )}
      </div>

      {/* ── Override warning ─────────────────────────────────────────── */}
      {isOverride && (
        <div className="cj-override-banner">
          <span>{overrideMessages[activeStage]}</span>
          <button onClick={handleReturnToAuto}>Return to detected stage</button>
        </div>
      )}

      {/* ── Stage content ────────────────────────────────────────────── */}
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
