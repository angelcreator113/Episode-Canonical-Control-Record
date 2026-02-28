/**
 * ChapterJourney.jsx
 * Route: /chapter/:bookId/:chapterId
 *
 * Phase 1 — State detection + routing.
 * Reads the chapter's current state from the API and renders
 * the right existing component. No new UI. No existing components touched.
 *
 * Stage detection priority:
 *   REVIEW  — chapter has 5+ lines OR any prose content
 *   WRITE   — chapter has a scene_goal (brief exists)
 *   PLAN    — everything else (empty chapter, no brief)
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './ChapterJourney.css';

// ── Lazy imports — load only what's needed for the current stage ──────────────
import StoryPlannerConversational from '../components/StoryPlannerConversational';
import WriteMode                  from './WriteMode';
import StorytellerPage            from './StorytellerPage';

// ── Stage constants ────────────────────────────────────────────────────────────
const STAGE = {
  LOADING: 'loading',
  PLAN:    'plan',
  WRITE:   'write',
  REVIEW:  'review',
  ERROR:   'error',
};

const STAGE_LABELS = {
  plan:   'Plan',
  write:  'Write',
  review: 'Review',
};

const STAGE_ORDER = ['plan', 'write', 'review'];

// ── API helpers ────────────────────────────────────────────────────────────────
async function fetchChapterState(bookId, chapterId) {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(
    `/api/v1/storyteller/books/${bookId}`,
    { headers }
  );
  if (!res.ok) throw new Error(`Failed to load book: ${res.status}`);
  const data = await res.json();

  const chapter = data.chapters?.find(c => c.id === chapterId);
  if (!chapter) throw new Error('Chapter not found');

  const lines         = chapter.lines || [];
  const approvedCount = lines.filter(l => l.status === 'approved').length;
  const totalLines    = lines.length;
  const hasProse      = !!(chapter.prose_content || chapter.prose || chapter.draft_prose);
  const hasSceneGoal  = !!(chapter.scene_goal?.trim());

  return {
    chapter,
    book:         data,
    approvedCount,
    totalLines,
    hasProse,
    hasSceneGoal,
  };
}

function detectStage({ approvedCount, totalLines, hasProse, hasSceneGoal }) {
  if (approvedCount >= 5)  return STAGE.REVIEW;
  if (hasProse)            return STAGE.REVIEW;
  if (totalLines > 0)      return STAGE.REVIEW;
  if (hasSceneGoal)        return STAGE.WRITE;
  return STAGE.PLAN;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ChapterJourney() {
  const { bookId, chapterId } = useParams();
  const navigate              = useNavigate();

  const [stage,           setStage]           = useState(STAGE.LOADING);
  const [chapterData,     setChapterData]     = useState(null);
  const [bookData,        setBookData]        = useState(null);
  const [error,           setError]           = useState(null);
  const [manualOverride,  setManualOverride]  = useState(null);
  const [overrideWarning, setOverrideWarning] = useState(null);

  // ── Load chapter state ───────────────────────────────────────────────────────
  const loadChapter = useCallback(async () => {
    setStage(STAGE.LOADING);
    setError(null);
    try {
      const result        = await fetchChapterState(bookId, chapterId);
      const detectedStage = detectStage(result);
      setChapterData(result.chapter);
      setBookData(result.book);
      setStage(detectedStage);
      setManualOverride(null);
    } catch (err) {
      console.error('ChapterJourney load error:', err);
      setError(err.message);
      setStage(STAGE.ERROR);
    }
  }, [bookId, chapterId]);

  useEffect(() => {
    loadChapter();
  }, [loadChapter]);

  // ── Manual stage override ────────────────────────────────────────────────────
  const handleStageClick = (targetStage) => {
    const currentStage = manualOverride || stage;
    if (targetStage === currentStage) return;

    if (targetStage === STAGE.WRITE && stage === STAGE.PLAN) {
      setOverrideWarning('This chapter has no brief yet. You can write anyway — the context panel will be empty.');
    } else if (targetStage === STAGE.REVIEW && stage === STAGE.PLAN) {
      setOverrideWarning('There\'s nothing to review yet. Jump to Write first, or Plan this chapter.');
      return;
    } else {
      setOverrideWarning(null);
    }

    setManualOverride(targetStage);
  };

  const dismissOverrideWarning = () => {
    setOverrideWarning(null);
  };

  // ── Stage transition callbacks ───────────────────────────────────────────────
  const handlePlanComplete = useCallback(() => {
    setManualOverride(null);
    loadChapter();
  }, [loadChapter]);

  const handleWriteComplete = useCallback(() => {
    setManualOverride(null);
    loadChapter();
  }, [loadChapter]);

  const handleReviewComplete = useCallback(() => {
    navigate('/storyteller');
  }, [navigate]);

  // ── Active stage ─────────────────────────────────────────────────────────────
  const activeStage = manualOverride || stage;

  // ── Render ───────────────────────────────────────────────────────────────────
  if (stage === STAGE.LOADING) {
    return (
      <div className="cj-loading">
        <div className="cj-loading-dots">
          <span /><span /><span />
        </div>
        <p>Opening chapter…</p>
      </div>
    );
  }

  if (stage === STAGE.ERROR) {
    return (
      <div className="cj-error">
        <p>Couldn't load this chapter.</p>
        <p className="cj-error-detail">{error}</p>
        <button onClick={loadChapter}>Try again</button>
        <button onClick={() => navigate('/storyteller')}>Back to library</button>
      </div>
    );
  }

  return (
    <div className={`cj-root cj-stage--${activeStage}`}>

      {/* ── Stage indicator bar ─────────────────────────────────────────────── */}
      <div className="cj-stage-bar">
        <button
          className="cj-back-btn"
          onClick={() => navigate('/storyteller')}
          title="Back to library"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        <div className="cj-stage-info">
          <span className="cj-book-title">{bookData?.title || 'Book'}</span>
          <span className="cj-divider">·</span>
          <span className="cj-chapter-title">{chapterData?.title || 'Chapter'}</span>
        </div>

        {/* Stage pills */}
        <div className="cj-stage-pills">
          {STAGE_ORDER.map((s, i) => (
            <button
              key={s}
              className={`cj-stage-pill${activeStage === s ? ' active' : ''}${stage === s ? ' detected' : ''}`}
              onClick={() => handleStageClick(s)}
              title={
                manualOverride === s
                  ? 'You chose this stage manually'
                  : stage === s
                  ? 'This is where your chapter is'
                  : 'Jump to this stage'
              }
            >
              {i > 0 && <span className="cj-pill-arrow">→</span>}
              <span className="cj-pill-label">{STAGE_LABELS[s]}</span>
              {stage === s && !manualOverride && (
                <span className="cj-pill-dot" />
              )}
            </button>
          ))}
        </div>

        {manualOverride && (
          <button
            className="cj-override-reset"
            onClick={() => { setManualOverride(null); setOverrideWarning(null); }}
            title="Go back to detected stage"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 8a6 6 0 1 1 1.76 4.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M2 12V8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Auto
          </button>
        )}
      </div>

      {/* ── Override warning banner ──────────────────────────────────────────── */}
      {overrideWarning && (
        <div className="cj-override-warning">
          <span>{overrideWarning}</span>
          <button onClick={dismissOverrideWarning}>Got it</button>
        </div>
      )}

      {/* ── Stage content ────────────────────────────────────────────────────── */}
      <div className="cj-content">

        {activeStage === STAGE.PLAN && (
          <StoryPlannerConversational
            bookId={bookId}
            chapterId={chapterId}
            chapter={chapterData}
            book={bookData}
            onComplete={handlePlanComplete}
            hideHeader={true}
          />
        )}

        {activeStage === STAGE.WRITE && (
          <WriteMode
            bookId={bookId}
            chapterId={chapterId}
            chapter={chapterData}
            book={bookData}
            onReviewReady={handleWriteComplete}
            hideTopBar={true}
          />
        )}

        {activeStage === STAGE.REVIEW && (
          <StorytellerPage
            bookId={bookId}
            chapterId={chapterId}
            chapter={chapterData}
            book={bookData}
            onChapterComplete={handleReviewComplete}
            initialView="book"
            hideTopBar={true}
          />
        )}

      </div>
    </div>
  );
}
