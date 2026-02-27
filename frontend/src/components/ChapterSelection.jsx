/**
 * ChapterSelection.jsx — Creator Dashboard
 *
 * Simple, clean entry point: pick a chapter, start writing.
 * Shows book stats, chapter list, and a "Plan with Voice" shortcut.
 *
 * Extracted from StorytellerPage.jsx for maintainability.
 */
import React, { useState, useEffect } from 'react';
import { api } from '../utils/storytellerApi';
import { timeAgo } from '../utils/storytellerHelpers';
import StoryPlannerConversational from './StoryPlannerConversational';

export default function ChapterSelection({ book, onSelectChapter, onHome, onRefresh, toast }) {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [showPlanner, setShowPlanner] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('view') === 'planner'; } catch { return false; }
  });

  const refreshChapters = async () => {
    const data = await api(`/books/${book.id}`);
    const b = data?.book || data;
    setChapters((b.chapters || []).slice().sort((a, b2) => (a.chapter_number || 0) - (b2.chapter_number || 0)));
  };

  useEffect(() => {
    if (!book?.id) return;
    setLoading(true);
    refreshChapters()
      .catch(() => toast.add('Failed to load chapters', 'error'))
      .finally(() => setLoading(false));
  }, [book?.id]);

  const createChapter = async () => {
    if (!newChapterTitle.trim()) return;
    try {
      await api(`/books/${book.id}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newChapterTitle.trim(), chapter_number: chapters.length + 1 }),
      });
      setNewChapterTitle('');
      setShowAddChapter(false);
      await refreshChapters();
      toast.add('Chapter created');
    } catch {
      toast.add('Failed to create chapter', 'error');
    }
  };

  /* ── Computed project stats ── */
  const totalWords = chapters.reduce((sum, ch) => {
    return sum + (ch.draft_prose || '').split(/\s+/).filter(Boolean).length;
  }, 0);

  // Find most recently edited chapter
  const lastEditedChapter = chapters.length > 0
    ? chapters.slice().sort((a, b) => {
        const aTime = new Date(a.updated_at || 0).getTime();
        const bTime = new Date(b.updated_at || 0).getTime();
        return bTime - aTime;
      })[0]
    : null;

  const chaptersWithContent = chapters.filter(ch =>
    (ch.draft_prose || '').split(/\s+/).filter(Boolean).length > 0
  ).length;

  return (
    <div className="st-dash">
      {/* ── Top bar with branding ── */}
      <div className="st-dash-topbar">
        <button className="st-dash-back" onClick={onHome}>← Home</button>
        <span className="st-dash-brand">Storyteller</span>
      </div>

      {/* ── Project Header ── */}
      <div className="st-dash-header">
        <h1 className="st-dash-title">{book.title}</h1>
        {book.subtitle && <p className="st-dash-subtitle">{book.subtitle}</p>}

        <div className="st-dash-meta">
          <span className="st-dash-meta-item">
            <strong>{chapters.length}</strong> {chapters.length === 1 ? 'chapter' : 'chapters'}
          </span>
          <span className="st-dash-meta-sep">·</span>
          <span className="st-dash-meta-item">
            <strong>{totalWords.toLocaleString()}</strong> words
          </span>
          {book.updated_at && (
            <>
              <span className="st-dash-meta-sep">·</span>
              <span className="st-dash-meta-item">edited {timeAgo(book.updated_at)}</span>
            </>
          )}
        </div>

        {/* Primary CTA */}
        <div className="st-dash-actions">
          {lastEditedChapter && chaptersWithContent > 0 ? (
            <button className="st-dash-cta" onClick={() => onSelectChapter(lastEditedChapter.id)}>
              Continue Writing →
            </button>
          ) : chapters.length > 0 ? (
            <button className="st-dash-cta" onClick={() => onSelectChapter(chapters[0].id)}>
              Start Writing →
            </button>
          ) : null}
          <button className="st-dash-plan-btn" onClick={() => setShowPlanner(true)}>
            🎙️ Plan with Voice
          </button>
          {!showAddChapter ? (
            <button className="st-dash-add-btn" onClick={() => setShowAddChapter(true)}>
              + New Chapter
            </button>
          ) : (
            <div className="st-dash-add-form">
              <input
                className="st-dash-add-input"
                placeholder="Chapter title…"
                value={newChapterTitle}
                onChange={e => setNewChapterTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createChapter()}
                autoFocus
              />
              <button className="st-dash-add-confirm" onClick={createChapter}>Create</button>
              <button className="st-dash-add-cancel" onClick={() => { setShowAddChapter(false); setNewChapterTitle(''); }}>×</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Chapter List ── */}
      {loading ? (
        <div className="st-dash-loading">
          <div className="st-spinner" /> Loading…
        </div>
      ) : chapters.length > 0 ? (
        <div className="st-dash-chapters">
          {chapters.map((ch, i) => {
            const words = (ch.draft_prose || '').split(/\s+/).filter(Boolean).length;
            const hasContent = words > 0;
            const rawSections = Array.isArray(ch.sections) ? ch.sections : [];
            const sections = rawSections.filter(s => ['h2','h3'].includes(s.type) && s.content);

            return (
              <button
                key={ch.id}
                className="st-dash-chapter-row"
                onClick={() => onSelectChapter(ch.id)}
                style={{ '--card-index': i }}
              >
                <span className="st-dash-ch-num">{i + 1}</span>
                <div className="st-dash-ch-body">
                  <span className="st-dash-ch-title">{ch.title || 'Untitled'}</span>
                  {sections.length > 0 && (
                    <div className="st-dash-ch-sections">
                      {sections.map((s, si) => (
                        <span key={si} className="st-dash-ch-section-tag">{s.content}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="st-dash-ch-info">
                  <span className="st-dash-ch-words">{hasContent ? `${words.toLocaleString()} words` : 'Empty'}</span>
                  {ch.updated_at && <span className="st-dash-ch-time">{timeAgo(ch.updated_at)}</span>}
                </div>
                <span className="st-dash-ch-arrow">→</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="st-dash-empty">
          <p className="st-dash-empty-title">No chapters yet</p>
          <p className="st-dash-empty-sub">Create your first chapter to start writing.</p>
        </div>
      )}

      {/* ── Voice Story Planner overlay ── */}
      {showPlanner && (
        <div className="st-dash-planner-overlay">
          <StoryPlannerConversational
            book={book}
            chapters={chapters}
            characters={[]}
            onApply={() => { refreshChapters(); setShowPlanner(false); }}
            onClose={() => setShowPlanner(false)}
            toast={toast}
          />
        </div>
      )}
    </div>
  );
}
