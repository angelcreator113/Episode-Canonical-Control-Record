/**
 * ReadingMode.jsx
 * frontend/src/pages/ReadingMode.jsx
 *
 * Route: /books/:bookId/read
 *
 * Clean manuscript view. No editing tools. No status badges. No buttons.
 * Just the approved and edited lines, in order, as a reader would see them.
 *
 * What it shows:
 * - Book title + character name (small, top)
 * - Each chapter as a section with title
 * - Only approved + edited lines (pending/rejected invisible)
 * - Word count + reading time estimate
 * - Lala lines styled differently (detected by source_type === 'lala' or
 *   source_tags?.lala === true — falls back to italic gold styling)
 *
 * What it hides:
 * - All status badges
 * - All action buttons
 * - Line numbers
 * - Source refs
 * - Everything that belongs to the editor
 *
 * Entry points:
 * - StorytellerPage: "Read" button next to book title
 * - Sidebar: optional "Reading Mode" link
 *
 * Exit:
 * - "← Back to Editor" top left — returns to /storyteller (or history.back())
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const STORYTELLER_API = '/api/v1/storyteller';

// Average adult reading speed
const WORDS_PER_MINUTE = 250;

export default function ReadingMode() {
  const { bookId }   = useParams();
  const navigate     = useNavigate();

  const [book,     setBook]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [progress, setProgress] = useState(0);
  const [showToc,  setShowToc]  = useState(false);

  const scrollRef = useRef(null);

  useEffect(() => { load(); }, [bookId]);

  // Reading progress tracker
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onScroll() {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const pct = scrollHeight <= clientHeight
        ? 100
        : Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
      setProgress(pct);
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [loading]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res  = await api.get(`${STORYTELLER_API}/books/${bookId}`);
      const data = res.data;
      setBook(data.book || data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load book');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onBack={() => navigate(-1)} />;
  if (!book)   return <ErrorState message='Book not found' onBack={() => navigate(-1)} />;

  // Build reading data
  const chapters = (book.chapters || [])
    .slice()
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map(ch => ({
      ...ch,
      readableLines: (ch.lines || ch.storyteller_lines || [])
        .filter(l => ['approved', 'edited'].includes(l.status))
        .sort((a, b) => (a.order_index ?? a.sort_order ?? 0) - (b.order_index ?? b.sort_order ?? 0)),
    }))
    .filter(ch => ch.readableLines.length > 0);

  const allLines = chapters.flatMap(ch => ch.readableLines);
  const wordCount = allLines.reduce((sum, l) => {
    const text = l.content || l.text || '';
    return sum + text.trim().split(/\s+/).filter(Boolean).length;
  }, 0);
  const readingMinutes = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));

  return (
    <div style={s.shell} ref={scrollRef}>

      {/* Progress bar */}
      <div style={{ ...s.progressBar, width: `${progress}%` }} />

      {/* Top bar */}
      <div style={s.topBar}>
        <button
          style={s.backBtn}
          onClick={() => navigate(-1)}
          type='button'
        >
          ← Editor
        </button>

        <div style={s.topMeta}>
          <span style={s.topTitle}>{book.title}</span>
          <span style={s.topDivider}>·</span>
          <span style={s.topStat}>{wordCount.toLocaleString()} words</span>
          <span style={s.topDivider}>·</span>
          <span style={s.topStat}>{readingMinutes} min read</span>
        </div>

        <button
          style={s.tocBtn}
          onClick={() => setShowToc(v => !v)}
          type='button'
        >
          {showToc ? '✕' : '≡'}
        </button>
      </div>

      {/* Table of contents drawer */}
      {showToc && (
        <div style={s.toc}>
          <div style={s.tocTitle}>Contents</div>
          {chapters.map((ch, i) => (
            <a
              key={ch.id}
              href={`#chapter-${ch.id}`}
              style={s.tocItem}
              onClick={() => setShowToc(false)}
            >
              <span style={s.tocNum}>{i + 1}</span>
              <span style={s.tocChapterTitle}>{ch.title || `Chapter ${i + 1}`}</span>
              <span style={s.tocLineCount}>{ch.readableLines.length} lines</span>
            </a>
          ))}
        </div>
      )}

      {/* Manuscript */}
      <div style={s.manuscript}>

        {/* Book header */}
        <div style={s.bookHeader}>
          {book.character && (
            <div style={s.bookCharacter}>{book.character}</div>
          )}
          <h1 style={s.bookTitle}>{book.title}</h1>
          {book.description && (
            <div style={s.bookDescription}>{book.description}</div>
          )}
          <div style={s.bookRule} />
        </div>

        {/* Chapters */}
        {chapters.length === 0 ? (
          <div style={s.emptyState}>
            No approved lines yet. Approve lines in the editor to see them here.
          </div>
        ) : (
          chapters.map((chapter, chIdx) => (
            <ChapterSection
              key={chapter.id}
              chapter={chapter}
              chapterIndex={chIdx}
              isLast={chIdx === chapters.length - 1}
            />
          ))
        )}

        {/* End mark */}
        {chapters.length > 0 && (
          <div style={s.endMark}>
            <div style={s.endRule} />
            <div style={s.endText}>∎</div>
          </div>
        )}

        {/* Bottom padding */}
        <div style={{ height: 120 }} />

      </div>
    </div>
  );
}

// ── Chapter Section ────────────────────────────────────────────────────────

function ChapterSection({ chapter, chapterIndex, isLast }) {
  return (
    <section id={`chapter-${chapter.id}`} style={s.chapter}>

      {/* Chapter header */}
      <div style={s.chapterHeader}>
        <div style={s.chapterNum}>
          {String(chapterIndex + 1).padStart(2, '0')}
        </div>
        <h2 style={s.chapterTitle}>
          {chapter.title || `Chapter ${chapterIndex + 1}`}
        </h2>
      </div>

      {/* Lines */}
      <div style={s.lines}>
        {chapter.readableLines.map((line, lineIdx) => (
          <Line
            key={line.id}
            line={line}
            isFirst={lineIdx === 0}
          />
        ))}
      </div>

      {/* Chapter divider */}
      {!isLast && (
        <div style={s.chapterDivider}>
          <span style={s.chapterDividerDot}>◆</span>
        </div>
      )}

    </section>
  );
}

// ── Line ──────────────────────────────────────────────────────────────────

function Line({ line, isFirst }) {
  const text = line.content || line.text || '';
  if (!text.trim()) return null;

  // Detect Lala line — source_type, source_tags, or content heuristic
  const isLala = (
    line.source_type === 'lala' ||
    line.source_tags?.lala === true ||
    line.source_tags?.suggestion_type === 'lala'
  );

  if (isLala) {
    return (
      <p style={s.lalaLine}>
        {text}
      </p>
    );
  }

  // Drop cap on first line of chapter
  if (isFirst && text.length > 0) {
    const firstChar = text[0];
    const rest      = text.slice(1);
    return (
      <p style={s.line}>
        <span style={s.dropCap}>{firstChar}</span>
        {rest}
      </p>
    );
  }

  return <p style={s.line}>{text}</p>;
}

// ── Loading / Error ────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={s.centerState}>
      <div style={s.loadingDots}>
        {[0,1,2].map(i => (
          <div key={i} style={{ ...s.dot, animationDelay: `${i * 0.3}s` }} />
        ))}
      </div>
      <div style={s.loadingText}>Opening book…</div>
    </div>
  );
}

function ErrorState({ message, onBack }) {
  return (
    <div style={s.centerState}>
      <div style={s.errorText}>{message}</div>
      <button style={s.errorBack} onClick={onBack} type='button'>
        ← Go back
      </button>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const PARCHMENT = '#faf8f4';
const INK       = '#1c1917';
const INK_LIGHT = '#44403c';
const GOLD      = '#C9A84C';
const RULE      = '#e8e0d0';

const s = {
  shell: {
    minHeight: '100vh',
    background: PARCHMENT,
    overflowY: 'auto',
    position: 'relative',
  },

  // Progress bar
  progressBar: {
    position: 'fixed',
    top: 0,
    left: 0,
    height: 2,
    background: GOLD,
    zIndex: 100,
    transition: 'width 0.1s linear',
    pointerEvents: 'none',
  },

  // Top bar
  topBar: {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    background: 'rgba(250,248,244,0.92)',
    backdropFilter: 'blur(8px)',
    borderBottom: `1px solid ${RULE}`,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.1em',
    color: 'rgba(28,25,23,0.4)',
    cursor: 'pointer',
    padding: '4px 0',
    transition: 'color 0.12s',
  },
  topMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  topTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 13,
    fontStyle: 'italic',
    color: INK_LIGHT,
  },
  topDivider: {
    color: 'rgba(28,25,23,0.2)',
    fontSize: 12,
  },
  topStat: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.08em',
    color: 'rgba(28,25,23,0.35)',
  },
  tocBtn: {
    background: 'none',
    border: 'none',
    fontFamily: 'DM Mono, monospace',
    fontSize: 14,
    color: 'rgba(28,25,23,0.35)',
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
  },

  // TOC
  toc: {
    position: 'sticky',
    top: 45,
    zIndex: 40,
    background: 'rgba(250,248,244,0.97)',
    borderBottom: `1px solid ${RULE}`,
    padding: '16px 24px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  tocTitle: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    letterSpacing: '0.2em',
    color: 'rgba(28,25,23,0.3)',
    marginBottom: 4,
  },
  tocItem: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    textDecoration: 'none',
    padding: '4px 0',
    borderBottom: `1px solid ${RULE}`,
  },
  tocNum: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: GOLD,
    flexShrink: 0,
    width: 20,
  },
  tocChapterTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 14,
    fontStyle: 'italic',
    color: INK,
    flex: 1,
  },
  tocLineCount: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(28,25,23,0.25)',
    letterSpacing: '0.06em',
  },

  // Manuscript
  manuscript: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '60px 40px 0',
  },

  // Book header
  bookHeader: {
    textAlign: 'center',
    marginBottom: 72,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  bookCharacter: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.22em',
    color: GOLD,
    textTransform: 'uppercase',
  },
  bookTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 36,
    fontWeight: 700,
    fontStyle: 'italic',
    color: INK,
    margin: 0,
    lineHeight: 1.2,
  },
  bookDescription: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 15,
    fontStyle: 'italic',
    color: INK_LIGHT,
    maxWidth: 440,
    lineHeight: 1.6,
    textAlign: 'center',
  },
  bookRule: {
    width: 48,
    height: 1,
    background: GOLD,
    marginTop: 8,
  },

  // Chapter
  chapter: {
    marginBottom: 64,
  },
  chapterHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 16,
    marginBottom: 36,
    paddingBottom: 14,
    borderBottom: `1px solid ${RULE}`,
  },
  chapterNum: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.18em',
    color: GOLD,
    flexShrink: 0,
  },
  chapterTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 22,
    fontStyle: 'italic',
    fontWeight: 600,
    color: INK,
    margin: 0,
    lineHeight: 1.3,
  },

  // Lines
  lines: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  line: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 17,
    lineHeight: 1.85,
    color: INK,
    margin: '0 0 20px',
    textAlign: 'left',
    letterSpacing: '0.01em',
  },
  // Lala proto-voice — gold, italic, slightly indented
  lalaLine: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 16,
    lineHeight: 1.8,
    color: GOLD,
    fontStyle: 'italic',
    margin: '28px 0 28px 32px',
    paddingLeft: 16,
    borderLeft: `2px solid rgba(201,168,76,0.3)`,
    letterSpacing: '0.01em',
  },
  // Drop cap
  dropCap: {
    float: 'left',
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 68,
    lineHeight: 0.8,
    fontWeight: 700,
    color: GOLD,
    marginRight: 6,
    marginTop: 10,
  },

  // Chapter divider
  chapterDivider: {
    textAlign: 'center',
    margin: '48px 0',
  },
  chapterDividerDot: {
    color: GOLD,
    fontSize: 12,
    opacity: 0.5,
  },

  // End mark
  endMark: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    marginTop: 48,
  },
  endRule: {
    width: 48,
    height: 1,
    background: RULE,
  },
  endText: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 16,
    color: 'rgba(201,168,76,0.4)',
  },

  // Empty state
  emptyState: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.1em',
    color: 'rgba(28,25,23,0.25)',
    textAlign: 'center',
    padding: '80px 0',
    lineHeight: 1.8,
  },

  // Loading
  centerState: {
    minHeight: '100vh',
    background: PARCHMENT,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingDots: {
    display: 'flex',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: GOLD,
    animation: 'pulse 1.2s ease-in-out infinite',
  },
  loadingText: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 14,
    fontStyle: 'italic',
    color: INK_LIGHT,
  },
  errorText: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    color: 'rgba(28,25,23,0.4)',
    letterSpacing: '0.08em',
  },
  errorBack: {
    background: 'none',
    border: 'none',
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.1em',
    color: GOLD,
    cursor: 'pointer',
    padding: '4px 0',
  },
};
