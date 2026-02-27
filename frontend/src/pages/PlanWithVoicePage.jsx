/**
 * PlanWithVoicePage.jsx — Standalone voice planner
 *
 * Full-page conversational story planner.
 * Lets user pick a book, loads its chapters + characters,
 * then renders StoryPlannerConversational.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import StoryPlannerConversational from '../components/StoryPlannerConversational';
import './PlanWithVoicePage.css';

const API = '/api/v1/storyteller';

/* ─── tiny api helper (mirrors StorytellerPage) ─── */
function authHeader() {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => 'Request failed');
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/* ─── simple toast hook ─── */
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);
  return { toasts, add };
}

/* ═══════════════════════════════════════
   PlanWithVoicePage
   ═══════════════════════════════════════ */

export default function PlanWithVoicePage() {
  const navigate = useNavigate();
  const toast = useToasts();

  const [books, setBooks]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapters, setChapters]     = useState([]);
  const [characters, setCharacters] = useState([]);
  const [ready, setReady]           = useState(false);

  /* ── Load all books on mount ── */
  useEffect(() => {
    (async () => {
      try {
        const data = await api('/books');
        const list = Array.isArray(data) ? data : (data?.books || []);
        setBooks(list);

        // Auto-select the first book (or restore from sessionStorage)
        const savedId = sessionStorage.getItem('pwv_bookId');
        const match = savedId ? list.find(b => b.id === savedId) : null;
        if (match) {
          openBook(match);
        } else if (list.length === 1) {
          openBook(list[0]);
        }
      } catch {
        toast.add('Failed to load books', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Open a book: fetch full data + chapters ── */
  const openBook = useCallback(async (bookSummary) => {
    try {
      const data = await api(`/books/${bookSummary.id}`);
      const book = data?.book || data;
      const chs  = book?.chapters || data?.chapters || [];

      setSelectedBook(book);
      setChapters(chs);
      sessionStorage.setItem('pwv_bookId', book.id);

      // try to load characters from registry
      try {
        const charRes = await fetch('/api/v1/character-registry/registries', { headers: authHeader() });
        const charData = await charRes.json();
        const regs = charData?.registries || [];
        const chars = Array.isArray(regs)
          ? regs.flatMap(r => (r.characters || []).map(c => ({
              ...c,
              name: c.display_name || c.character_key || c.name,
            })))
          : [];
        setCharacters(chars);
      } catch {
        setCharacters([]);
      }

      setReady(true);
    } catch {
      toast.add('Failed to load book', 'error');
    }
  }, [toast]);

  /* ── Go back to book selection ── */
  const goBack = () => {
    setSelectedBook(null);
    setChapters([]);
    setCharacters([]);
    setReady(false);
    sessionStorage.removeItem('pwv_bookId');
  };

  /* ── Toast UI ── */
  const ToastLayer = () =>
    toast.toasts.length > 0 ? (
      <div className="pwv-toast-container">
        {toast.toasts.map(t => (
          <div key={t.id} className={`pwv-toast pwv-toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>
    ) : null;

  /* ═══ RENDER ═══ */

  // Loading state
  if (loading) {
    return (
      <div className="pwv-root pwv-loading">
        <div className="pwv-loading-text">Loading books…</div>
        <ToastLayer />
      </div>
    );
  }

  // Book is selected → show planner
  if (ready && selectedBook) {
    return (
      <div className="pwv-root pwv-planner-active">
        <StoryPlannerConversational
          book={selectedBook}
          chapters={chapters}
          characters={characters}
          onApply={() => {
            toast.add('Plan applied successfully', 'success');
            // Re-fetch chapters to see updates
            openBook(selectedBook);
          }}
          onClose={() => navigate(-1)}
          toast={toast}
        />
        <ToastLayer />
      </div>
    );
  }

  // Book selection screen
  return (
    <div className="pwv-root">
      <header className="pwv-header">
        <button className="pwv-back-btn" onClick={() => navigate(-1)}>← Back</button>
        <h1 className="pwv-title">Plan with Voice</h1>
        <p className="pwv-subtitle">Choose a book to start planning</p>
      </header>

      <div className="pwv-book-grid">
        {books.length === 0 ? (
          <div className="pwv-empty">
            <p>No books found.</p>
            <p className="pwv-empty-hint">Create a book in the Storyteller first.</p>
          </div>
        ) : (
          books.map(book => (
            <button
              key={book.id}
              className="pwv-book-card"
              onClick={() => openBook(book)}
            >
              <div className="pwv-book-card-title">{book.title || 'Untitled'}</div>
              {book.description && (
                <div className="pwv-book-card-desc">{book.description}</div>
              )}
              <div className="pwv-book-card-meta">
                {book.chapter_count || book.chapters?.length || '—'} chapters
              </div>
            </button>
          ))
        )}
      </div>

      <ToastLayer />
    </div>
  );
}
