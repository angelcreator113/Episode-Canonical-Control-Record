/**
 * BookList.jsx — Literary Table of Contents / Card Grid
 *
 * Single book → elegant TOC with chapter listing.
 * Multiple books → card grid with status badges.
 *
 * Extracted from StorytellerPage.jsx for maintainability.
 */
import React, { useState, useEffect } from 'react';
import { api } from '../utils/storytellerApi';
import { timeAgo, numberWord } from '../utils/storytellerHelpers';

export default function BookList({ books, onOpen, onDelete, onNew }) {
  const list = Array.isArray(books) ? books : [];
  const [bookDetail, setBookDetail] = useState(null);

  // When single book exists, fetch full detail for TOC chapter listing
  useEffect(() => {
    if (list.length === 1 && list[0]?.id) {
      api(`/books/${list[0].id}`)
        .then(data => setBookDetail(data?.book || data))
        .catch(() => {});
    }
  }, [list.length === 1 ? list[0]?.id : null]);

  // ── Single Book → Literary Table of Contents ──
  if (list.length === 1) {
    const book = bookDetail || list[0];
    const chapters = bookDetail
      ? (bookDetail.chapters || []).slice().sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0))
      : [];
    const totalWords = chapters.reduce((sum, ch) => {
      return sum + (ch.draft_prose || '').split(/\s+/).filter(Boolean).length;
    }, 0);
    const chapterCount = bookDetail ? chapters.length : (book.chapter_count ?? 0);

    return (
      <div className="st-book-toc">
        {/* ── Title Page ── */}
        <div className="st-toc-title-page">
          <div className="st-toc-ornament">✦</div>
          <h1 className="st-toc-book-title">{book.title}</h1>
          {book.subtitle && <p className="st-toc-subtitle">{book.subtitle}</p>}
          {book.character_name && (
            <p className="st-toc-author">{book.character_name}</p>
          )}
          <div className="st-toc-stats">
            <span>{chapterCount} {chapterCount === 1 ? 'Chapter' : 'Chapters'}</span>
            <span className="st-toc-stats-sep">·</span>
            <span>{totalWords.toLocaleString()} Words</span>
          </div>
          <div className="st-toc-ornament">✦</div>
        </div>

        {/* ── Chapter Listing ── */}
        {chapters.length > 0 ? (
          <>
            <div className="st-toc-heading">Contents</div>
            <div className="st-toc-chapters">
              {chapters.map((ch, i) => {
                const wordCount = (ch.draft_prose || '').split(/\s+/).filter(Boolean).length;
                const hasContent = wordCount > 0 || (ch.lines && ch.lines.length > 0);
                return (
                  <button
                    key={ch.id}
                    className="st-toc-chapter-row"
                    onClick={() => onOpen(book.id, ch.id)}
                    style={{ '--toc-index': i }}
                  >
                    <span className="st-toc-ch-num">{numberWord(i + 1)}</span>
                    <span className="st-toc-ch-dot" />
                    <span className="st-toc-ch-title">{ch.title || 'Untitled'}</span>
                    <span className="st-toc-ch-meta">
                      {hasContent ? `${wordCount.toLocaleString()} words` : '—'}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : !bookDetail ? (
          <div className="st-toc-loading">
            <div className="st-spinner" /> Loading contents…
          </div>
        ) : (
          <div className="st-toc-empty">No chapters yet. Create one to begin.</div>
        )}

        {/* ── Footer ── */}
        <div className="st-toc-footer">
          {chapters.length > 0 && (
            <button
              className="st-toc-begin-btn"
              onClick={() => onOpen(book.id, chapters[0]?.id)}
            >
              Begin Writing →
            </button>
          )}
          <button
            className="st-toc-new-btn"
            onClick={() => onOpen(book.id)}
          >
            + Add Chapter
          </button>
        </div>
      </div>
    );
  }

  // ── Multiple Books → Card Grid ──
  return (
    <div className="st-book-list">
      <div className="st-book-list-header">
        <h1>Story Archives</h1>
        <p className="st-book-list-subtitle">Your narrative canon — select an archive to open.</p>
      </div>
      <div className="st-book-grid">
        {list.map(book => {
          const chapterCount = book.chapter_count ?? (book.chapters || []).length;
          const lineCount = book.line_count ?? 0;
          const pending = book.pending_count ?? 0;
          const approved = (book.approved_count ?? 0) + (book.edited_count ?? 0);
          const pct = lineCount ? Math.round((approved / lineCount) * 100) : 0;
          const tone = pending === 0 && lineCount === 0 ? 'clean'
            : pending === 0 ? 'warm' : 'active';
          const label = lineCount === 0 ? 'Empty'
            : pending === 0 ? 'Clean' : 'In Progress';
          return (
            <div key={book.id} className="st-book-card" onClick={() => onOpen(book.id)}>
              <div className="st-card-top">
                <span className={`st-card-status st-tone-${tone}`}>{label}</span>
                <span className="st-card-age">{timeAgo(book.updated_at)}</span>
              </div>
              <div className="st-card-title">{book.title}</div>
              {book.subtitle && <p className="st-card-sub">{book.subtitle}</p>}
              <div className="st-card-meta">
                <span>{chapterCount} chapters</span>
                <span className="st-meta-sep">·</span>
                <span>{lineCount} lines</span>
                {pending > 0 && (
                  <>
                    <span className="st-meta-sep">·</span>
                    <span className="st-meta-pending">{pending} pending</span>
                  </>
                )}
              </div>
              <div className="st-card-progress">
                <div className="st-card-progress-bar" style={{ width: `${pct}%` }} />
              </div>
              {book.recent_insight && <p className="st-card-insight">{book.recent_insight}</p>}
              <div className="st-card-foot">
                <span className="st-card-open">Open archive →</span>
                <button
                  className="st-card-delete"
                  onClick={e => { e.stopPropagation(); onDelete(book.id); }}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
        <div className="st-book-card st-card-new" onClick={onNew}>
          <div className="st-card-new-icon">+</div>
          <div className="st-card-new-label">Create New Archive</div>
        </div>
      </div>
      {books.length === 0 && (
        <div className="st-empty"><p>No archives yet. Create one to begin.</p></div>
      )}
    </div>
  );
}
