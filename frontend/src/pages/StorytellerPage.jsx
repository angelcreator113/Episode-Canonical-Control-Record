/**
 * StorytellerPage.jsx — The Quiet Room
 *
 * "The page should feel like a quiet room.
 *  The intelligence should feel like it's thinking — not talking."
 *
 * Layout: True editorial center, 800px manuscript, generous breathing room
 * Typography: Spectral body, Lora titles, DM Sans chrome
 * Philosophy: Calm × Intelligence
 *
 * Components extracted to individual files for maintainability:
 *   BookList          → ../components/BookList.jsx
 *   ChapterSelection  → ../components/ChapterSelection.jsx
 *   SectionEditor     → ../components/SectionEditor.jsx
 *   BookEditor        → ../components/BookEditor.jsx
 *
 * Shared utilities:
 *   api / authHeader  → ../utils/storytellerApi.js
 *   useToasts         → ../hooks/useToasts.jsx
 *   timeAgo / etc     → ../utils/storytellerHelpers.js
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import NewBookModal from './NewBookModal';
import BookEditor from '../components/BookEditor';
import ChapterSelection from '../components/ChapterSelection';
import { api } from '../utils/storytellerApi';
import { useToasts, ToastContainer } from '../hooks/useToasts';
import './StorytellerPage.css';

/* ═══════════════════════════════════════
   StorytellerPage — Main Route Component
   ═══════════════════════════════════════ */

function StorytellerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [books, setBooks] = useState([]);
  const [activeBook, setActiveBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [initialChapterId, setInitialChapterId] = useState(null);
  const toast = useToasts();
  const openingRef = useRef(false); // guard against re-entrant openBook calls

  const loadBooks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api('/books');
      setBooks(Array.isArray(data) ? data : (data?.books || []));
    } catch (e) {
      toast.add('Failed to load archives', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const openBook = useCallback(async (id, chapterId) => {
    if (openingRef.current) return; // prevent re-entrant calls from searchParams effect
    openingRef.current = true;
    try {
      setLoading(true);
      const data = await api(`/books/${id}`);
      setActiveBook(data?.book || data);
      if (chapterId) setInitialChapterId(chapterId);
      // Persist book (and optional chapter) in URL so refresh restores the editor
      const params = { book: String(id) };
      if (chapterId) params.chapter = String(chapterId);
      setSearchParams(params, { replace: true });
      // Also persist in sessionStorage so a hard refresh can recover
      try { sessionStorage.setItem('st_book', String(id)); } catch {}
      if (chapterId) try { sessionStorage.setItem('st_chapter', String(chapterId)); } catch {}
    } catch (e) {
      toast.add('Failed to open archive', 'error');
    } finally {
      setLoading(false);
      openingRef.current = false;
    }
  }, [setSearchParams]);

  const closeBook = () => {
    setActiveBook(null);
    setInitialChapterId(null);
    // Clear book/chapter params from URL without navigation
    if (searchParams.has('book') || searchParams.has('chapter')) {
      setSearchParams({}, { replace: true });
    }
  };

  const deleteBook = useCallback(async (id) => {
    if (!window.confirm('Delete this archive? This cannot be undone.')) return;
    try {
      await api(`/books/${id}`, { method: 'DELETE' });
      setBooks(prev => prev.filter(b => b.id !== id));
      toast.add('Archive deleted');
    } catch (e) {
      toast.add('Failed to delete archive', 'error');
    }
  }, []);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  // Auto-open book from URL query params (?book=xxx&chapter=yyy)
  // Falls back to sessionStorage if URL params are missing
  useEffect(() => {
    let bookParam = searchParams.get('book');
    let chapterParam = searchParams.get('chapter');
    // Fallback: recover from sessionStorage if URL params were lost
    if (!bookParam) {
      try {
        bookParam = sessionStorage.getItem('st_book');
        chapterParam = chapterParam || sessionStorage.getItem('st_chapter');
      } catch {}
    }
    if (bookParam && !activeBook) {
      openBook(bookParam, chapterParam);
    }
  }, [searchParams]);

  // Auto-open the first book when the list loads (skip book list page)
  useEffect(() => {
    if (!loading && !activeBook && books.length > 0 && !searchParams.get('book')) {
      openBook(books[0].id);
    }
  }, [loading, books, activeBook]);

  // Go back to chapter selection (clear chapter but keep book)
  const backToChapters = () => {
    setInitialChapterId(null);
    if (activeBook) {
      setSearchParams({ book: String(activeBook.id) }, { replace: true });
    }
  };

  if (loading && !activeBook && !books.length) {
    return <div className="storyteller-page"><div className="st-loading"><div className="st-spinner" /> Loading archives…</div></div>;
  }

  // If no books exist yet, show create prompt
  if (!loading && books.length === 0 && !activeBook) {
    return (
      <div className="storyteller-page">
        <div className="st-book-list" style={{ textAlign: 'center', paddingTop: '120px' }}>
          <h2 style={{ fontFamily: 'var(--st-serif)', color: 'var(--st-ink)', marginBottom: '12px' }}>No archives yet</h2>
          <p style={{ color: 'var(--st-muted)', marginBottom: '24px' }}>Create your first book to begin writing.</p>
          <button className="st-btn st-btn-primary" onClick={() => setShowCreate(true)}>+ New Archive</button>
        </div>
        {showCreate && (
          <NewBookModal
            onClose={() => setShowCreate(false)}
            onCreated={(b) => { setShowCreate(false); loadBooks(); if (b?.id) openBook(b.id); }}
          />
        )}
        <ToastContainer toasts={toast.toasts} />
      </div>
    );
  }

  // Determine if we should show chapter selection or the editor
  const showEditor = activeBook && initialChapterId;

  return (
    <div className="storyteller-page">
      {showEditor ? (
        <BookEditor
          book={activeBook}
          onClose={backToChapters}
          toast={toast}
          onRefresh={() => openBook(activeBook.id)}
          initialChapterId={initialChapterId}
        />
      ) : activeBook ? (
        <ChapterSelection
          book={activeBook}
          onSelectChapter={(chapterId) => {
            setInitialChapterId(chapterId);
            setSearchParams({ book: String(activeBook.id), chapter: String(chapterId) }, { replace: true });
            try { sessionStorage.setItem('st_chapter', String(chapterId)); } catch {}
          }}
          onHome={() => navigate('/')}
          onRefresh={() => openBook(activeBook.id)}
          toast={toast}
        />
      ) : null}
      {showCreate && (
        <NewBookModal
          onClose={() => setShowCreate(false)}
          onCreated={(b) => { setShowCreate(false); loadBooks(); if (b?.id) openBook(b.id); }}
        />
      )}
      <ToastContainer toasts={toast.toasts} />
    </div>
  );
}

export default StorytellerPage;
