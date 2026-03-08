/**
 * SessionStart — Creative session launcher
 * Clear single-path flow: everything funnels into StoryTeller
 * Draft shortcuts clearly labeled as quick-resume
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './SessionStart.css';

const API = import.meta.env.VITE_API_URL || '/api/v1';

function SessionStart() {
  const navigate = useNavigate();
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBrief();
  }, []);

  const fetchBrief = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/session/brief`);
      if (!res.ok) throw new Error('Failed to load briefing');
      const data = await res.json();
      setBrief(data);
    } catch (err) {
      console.error('Session brief error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ── Helpers ── */
  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const formatNumber = (n) => {
    if (!n) return '0';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toString();
  };

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="ss-container">
        <div className="ss-loading">
          <div className="ss-pulse" />
          <p className="ss-loading-text">Preparing your session…</p>
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="ss-container">
        <div className="ss-error">
          <h2>Couldn't load your briefing</h2>
          <p>{error}</p>
          <button className="ss-btn ss-btn-primary" onClick={fetchBrief}>Retry</button>
          <button className="ss-btn ss-btn-ghost" onClick={() => navigate('/')}>Go to Dashboard</button>
        </div>
      </div>
    );
  }

  const { greeting, stats, recentBooks, draftsInProgress } = brief || {};

  return (
    <div className="ss-container">
      <div className="ss-inner">

        {/* ── Header / Greeting ── */}
        <header className="ss-header">
          <div className="ss-sigil">◈</div>
          <h1 className="ss-greeting">{greeting}</h1>
          <p className="ss-subtitle">Session Briefing</p>
        </header>

        {/* ── Stats Row ── */}
        {stats && (
          <div className="ss-stats-row">
            <div className="ss-stat">
              <span className="ss-stat-value">{formatNumber(stats.totalBooks)}</span>
              <span className="ss-stat-label">Books</span>
            </div>
            <div className="ss-stat">
              <span className="ss-stat-value">{formatNumber(stats.totalChapters)}</span>
              <span className="ss-stat-label">Chapters</span>
            </div>
            <div className="ss-stat">
              <span className="ss-stat-value">{formatNumber(stats.totalWords)}</span>
              <span className="ss-stat-label">Words</span>
            </div>
            <div className="ss-stat">
              <span className="ss-stat-value">{stats.draftsInProgress}</span>
              <span className="ss-stat-label">Drafts</span>
            </div>
          </div>
        )}

        {/* ── Primary CTA — single clear path ── */}
        <section className="ss-primary-action">
          <button className="ss-btn ss-btn-hero" onClick={() => navigate('/storyteller')}>
            📖 Open StoryTeller
          </button>
          <p className="ss-primary-hint">Your books, chapters & the writing journey</p>
        </section>

        {/* ── Flow Explainer ── */}
        <div className="ss-flow-explainer">
          <span className="ss-flow-step">
            <span className="ss-flow-num">1</span>
            <span className="ss-flow-name">Story Planner</span>
            <span className="ss-flow-desc">Plan your chapter</span>
          </span>
          <span className="ss-flow-arrow">›</span>
          <span className="ss-flow-step">
            <span className="ss-flow-num">2</span>
            <span className="ss-flow-name">WriteMode</span>
            <span className="ss-flow-desc">Write your prose</span>
          </span>
          <span className="ss-flow-arrow">›</span>
          <span className="ss-flow-step">
            <span className="ss-flow-num">3</span>
            <span className="ss-flow-name">StoryTeller</span>
            <span className="ss-flow-desc">Review & finalize</span>
          </span>
        </div>

        {/* ── Quick Resume — clearly labeled as shortcuts ── */}
        {draftsInProgress && draftsInProgress.length > 0 && (
          <section className="ss-section">
            <h2 className="ss-section-title">
              <span className="ss-section-icon">✍</span>
              Quick Resume
              <span className="ss-section-badge">Jumps directly into chapter</span>
            </h2>
            <div className="ss-cards">
              {draftsInProgress.map((d) => (
                <button
                  key={d.chapterId}
                  className="ss-card ss-card-draft"
                  onClick={() => navigate(`/chapter/${d.bookId}/${d.chapterId}`)}
                >
                  <div className="ss-card-top">
                    <span className="ss-card-badge">Ch {d.chapterNumber}</span>
                    <span className="ss-card-time">{timeAgo(d.lastTouched)}</span>
                  </div>
                  <h3 className="ss-card-title">{d.chapterTitle}</h3>
                  <p className="ss-card-meta">{d.bookTitle}</p>
                  {d.character && <p className="ss-card-character">⟐ {d.character}</p>}
                  <div className="ss-card-words">{formatNumber(d.wordCount)} words</div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Recent Books — read-only cover-to-cover view ── */}
        {recentBooks && recentBooks.length > 0 && (
          <section className="ss-section">
            <h2 className="ss-section-title">
              <span className="ss-section-icon">📖</span>
              Recent Books
              <span className="ss-section-badge">Read-only view</span>
            </h2>
            <div className="ss-cards">
              {recentBooks.map((book) => (
                <button
                  key={book.id}
                  className="ss-card ss-card-book"
                  onClick={() => navigate(`/books/${book.id}/read`)}
                >
                  <div className="ss-card-top">
                    <span className="ss-card-badge ss-badge-status" data-status={book.status}>
                      {book.status}
                    </span>
                    <span className="ss-card-time">{timeAgo(book.lastTouched)}</span>
                  </div>
                  <h3 className="ss-card-title">{book.title}</h3>
                  {book.character && <p className="ss-card-character">⟐ {book.character}</p>}
                  <p className="ss-card-meta">{book.chapterCount} chapter{book.chapterCount !== 1 ? 's' : ''}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Secondary Actions ── */}
        <section className="ss-actions">
          <button className="ss-btn ss-btn-secondary" onClick={() => navigate('/universe')}>
            ◈ Universe Overview
          </button>
          <button className="ss-btn ss-btn-ghost" onClick={() => navigate('/character-registry')}>
            👤 Character Registry
          </button>
        </section>

      </div>
    </div>
  );
}

export default SessionStart;
