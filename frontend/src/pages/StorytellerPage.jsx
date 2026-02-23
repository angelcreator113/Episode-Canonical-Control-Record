/**
 * StorytellerPage.jsx — The Quiet Room
 *
 * "The page should feel like a quiet room.
 *  The intelligence should feel like it's thinking — not talking."
 *
 * Layout: True editorial center, 800px manuscript, generous breathing room
 * Typography: Spectral body, Lora titles, DM Sans chrome
 * Philosophy: Calm × Intelligence
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MemoryCard, MEMORY_STYLES } from './MemoryConfirmation';
import MemoryBankView from './MemoryBankView';
import ChapterBrief from './ChapterBrief';
import SceneInterview from './SceneInterview';
import NarrativeIntelligence from './NarrativeIntelligence';
import { ContinuityGuard, RewriteOptions } from './ContinuityGuard';
import ScenesPanel from './ScenesPanel';
import TOCPanel from './TOCPanel';
import NewBookModal from './NewBookModal';
import ImportDraftModal from './ImportDraftModal';
import ChapterDraftGenerator from './ChapterDraftGenerator';
import LalaSceneDetection from '../components/LalaSceneDetection';
import ExportPanel from '../components/ExportPanel';
import ScriptBridgePanel from '../components/ScriptBridgePanel';
import './StorytellerPage.css';

const API = '/api/v1/storyteller';

/* ═══════════════════════════════════════
   Hooks & Helpers
   ═══════════════════════════════════════ */

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);
  return { toasts, add };
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => 'Request failed');
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="st-toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`st-toast st-toast-${t.type}`}>{t.msg}</div>
      ))}
    </div>
  );
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function archiveState(book) {
  const chapters = book.chapters || [];
  const lines = chapters.flatMap(ch => ch.lines || []);
  const pending = lines.filter(l => l.status === 'pending').length;
  const edited = lines.filter(l => l.status === 'edited').length;
  if (lines.length === 0) return { label: 'Empty', tone: 'clean' };
  if (pending === 0 && edited === 0) return { label: 'Clean', tone: 'clean' };
  if (pending > 0) return { label: 'In Progress', tone: 'active' };
  return { label: 'Refined', tone: 'warm' };
}

const NUM_WORDS = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen', 'Twenty', 'Twenty-One', 'Twenty-Two', 'Twenty-Three',
  'Twenty-Four', 'Twenty-Five', 'Twenty-Six', 'Twenty-Seven', 'Twenty-Eight',
  'Twenty-Nine', 'Thirty',
];
const numberWord = n => NUM_WORDS[n] || String(n);

/* ═══════════════════════════════════════
   StorytellerPage — Main Route Component
   ═══════════════════════════════════════ */

function StorytellerPage() {
  const [books, setBooks] = useState([]);
  const [activeBook, setActiveBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const toast = useToasts();

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

  const openBook = useCallback(async (id) => {
    try {
      setLoading(true);
      const data = await api(`/books/${id}`);
      setActiveBook(data?.book || data);
    } catch (e) {
      toast.add('Failed to open archive', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const closeBook = () => setActiveBook(null);

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

  if (loading && !activeBook && !books.length) {
    return <div className="storyteller-page"><div className="st-loading"><div className="st-spinner" /> Loading archives…</div></div>;
  }

  return (
    <div className="storyteller-page">
      {activeBook ? (
        <BookEditor
          book={activeBook}
          onClose={closeBook}
          toast={toast}
          onRefresh={() => openBook(activeBook.id)}
        />
      ) : (
        <BookList
          books={books}
          onOpen={openBook}
          onDelete={deleteBook}
          onNew={() => setShowCreate(true)}
        />
      )}
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

/* ═══════════════════════════════════════
   BookList — Archive Grid
   ═══════════════════════════════════════ */

function BookList({ books, onOpen, onDelete, onNew }) {
  const list = Array.isArray(books) ? books : [];
  return (
    <div className="st-book-list">
      <div className="st-book-list-header">
        <h1>Story Archives</h1>
        <p className="st-book-list-subtitle">Your narrative canon — select an archive to open.</p>
      </div>
      <div className="st-book-grid">
        {list.map(book => {
          // The list endpoint provides pre-computed counts (chapters stripped)
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

/* ═══════════════════════════════════════
   BookEditor — The Quiet Room
   All business logic preserved.
   Render redesigned for editorial calm.
   ═══════════════════════════════════════ */

function BookEditor({ book, onClose, toast, onRefresh }) {
  const navigate = useNavigate();

  /* ── State ── */
  const [chapters, setChapters] = useState(book.chapters || []);
  const [activeChapterId, setActiveChapterId] = useState(
    (book.chapters && book.chapters[0]?.id) || null
  );
  const [activeView, setActiveView] = useState('book');
  const [registryCharacters, setRegistryCharacters] = useState([]);

  // UI state
  const [pendingOpen, setPendingOpen] = useState(true);
  const [reviewMode, setReviewMode] = useState(false);
  const [writingMode, setWritingMode] = useState(false);
  const [canonOpen, setCanonOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Editing state
  const [editingLine, setEditingLine] = useState(null);
  const [editText, setEditText] = useState('');
  const [editingBookTitle, setEditingBookTitle] = useState(false);
  const [bookTitleDraft, setBookTitleDraft] = useState(book.title || '');
  const [editingChapterId, setEditingChapterId] = useState(null);
  const [chapterTitleDraft, setChapterTitleDraft] = useState('');

  // Chapter management
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterBadge, setNewChapterBadge] = useState('');
  const [addingLineTo, setAddingLineTo] = useState(null);
  const [newLineText, setNewLineText] = useState('');

  // Sub-component state
  const [importTarget, setImportTarget] = useState(null);
  const [interviewDone, setInterviewDone] = useState(false);
  const [redoInterview, setRedoInterview] = useState(false);
  const [lastApprovedLine, setLastApprovedLine] = useState(null);

  // Saved indicator
  const [savedAt, setSavedAt] = useState(null);
  const markSaved = () => setSavedAt(Date.now());
  const justSaved = savedAt && (Date.now() - savedAt < 3000);

  /* ── Effects ── */
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = MEMORY_STYLES;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    fetch('/api/v1/character-registry/registries')
      .then(r => r.json())
      .then(data => setRegistryCharacters(data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setChapters(book.chapters || []);
    if (!activeChapterId && book.chapters?.length) {
      setActiveChapterId(book.chapters[0].id);
    }
  }, [book]);

  /* ── Computed ── */
  const activeChapter = chapters.find(ch => ch.id === activeChapterId) || null;
  const lines = activeChapter?.lines || [];
  const allLines = chapters.flatMap(ch => ch.lines || []);
  const approvedLines = lines.filter(l => l.status === 'approved' || l.status === 'edited');
  const pendingLines = lines.filter(l => l.status === 'pending');
  const pendingCount = pendingLines.length;
  const totalWordCount = allLines.reduce(
    (s, l) => s + (l.text || '').split(/\s+/).filter(Boolean).length, 0
  );
  const chapterIndex = activeChapter ? chapters.findIndex(ch => ch.id === activeChapterId) + 1 : 0;

  // Era detection for ambient theming
  const eraSlug = activeChapter?.badge?.toLowerCase().replace(/\s+/g, '-') || '';
  const eraTheme = eraSlug.includes('pre-prime') ? 'pre-prime'
    : eraSlug.includes('prime') ? 'prime' : 'default';

  /* ── Handlers ── */

  const updateLineLocal = (lineId, updates) => {
    setChapters(prev => prev.map(ch => ({
      ...ch,
      lines: (ch.lines || []).map(ln => ln.id === lineId ? { ...ln, ...updates } : ln),
    })));
  };

  const removeLineLocal = (lineId) => {
    setChapters(prev => prev.map(ch => ({
      ...ch,
      lines: (ch.lines || []).filter(ln => ln.id !== lineId),
    })));
  };

  const saveBookTitle = async () => {
    try {
      await api(`/books/${book.id}`, {
        method: 'PUT',
        body: JSON.stringify({ title: bookTitleDraft }),
      });
      setEditingBookTitle(false);
      markSaved();
      onRefresh();
    } catch (e) {
      toast.add('Failed to save title', 'error');
    }
  };

  const saveChapterTitle = async (chId) => {
    try {
      await api(`/chapters/${chId || editingChapterId}`, {
        method: 'PUT',
        body: JSON.stringify({ title: chapterTitleDraft }),
      });
      setChapters(prev =>
        prev.map(ch => ch.id === (chId || editingChapterId)
          ? { ...ch, title: chapterTitleDraft } : ch
        )
      );
      setEditingChapterId(null);
      markSaved();
    } catch (e) {
      toast.add('Failed to save chapter title', 'error');
    }
  };

  const approveLine = async (lineId) => {
    try {
      await api(`/lines/${lineId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'approved' }),
      });
      updateLineLocal(lineId, { status: 'approved' });
      markSaved();
      // memory extraction
      const line = lines.find(l => l.id === lineId);
      if (line) setLastApprovedLine({ ...line, status: 'approved' });
      if (line) {
        try {
          await api('/extract-memory', {
            method: 'POST',
            body: JSON.stringify({ text: line.text, bookId: book.id }),
          });
        } catch {}
      }
    } catch (e) {
      toast.add('Failed to approve line', 'error');
    }
  };

  const rejectLine = async (lineId) => {
    try {
      await api(`/lines/${lineId}`, { method: 'DELETE' });
      removeLineLocal(lineId);
      markSaved();
    } catch (e) {
      toast.add('Failed to reject line', 'error');
    }
  };

  const startEdit = (line) => {
    setEditingLine(line.id);
    setEditText(line.text);
  };

  const saveEdit = async () => {
    try {
      await api(`/lines/${editingLine}`, {
        method: 'PUT',
        body: JSON.stringify({ text: editText, status: 'edited' }),
      });
      updateLineLocal(editingLine, { text: editText, status: 'edited' });
      setEditingLine(null);
      setEditText('');
      markSaved();
    } catch (e) {
      toast.add('Failed to save edit', 'error');
    }
  };

  const cancelEdit = () => {
    setEditingLine(null);
    setEditText('');
  };

  const approveAll = async () => {
    try {
      await api(`/books/${book.id}/approve-all`, { method: 'POST' });
      for (const ln of pendingLines) {
        try {
          await api('/extract-memory', {
            method: 'POST',
            body: JSON.stringify({ text: ln.text, bookId: book.id }),
          });
        } catch {}
      }
      markSaved();
      toast.add('All lines approved');
      onRefresh();
    } catch (e) {
      toast.add('Failed to approve all', 'error');
    }
  };

  const addChapter = async () => {
    if (!newChapterTitle.trim()) return;
    try {
      const ch = await api('/chapters', {
        method: 'POST',
        body: JSON.stringify({
          book_id: book.id,
          title: newChapterTitle,
          badge: newChapterBadge,
        }),
      });
      setChapters(prev => [...prev, { ...ch, lines: [] }]);
      setActiveChapterId(ch.id);
      setShowAddChapter(false);
      setNewChapterTitle('');
      setNewChapterBadge('');
      setActiveView('book');
      markSaved();
    } catch (e) {
      toast.add('Failed to add chapter', 'error');
    }
  };

  const deleteChapter = async (chId) => {
    if (!window.confirm('Delete this chapter? This cannot be undone.')) return;
    try {
      await api(`/chapters/${chId}`, { method: 'DELETE' });
      const remaining = chapters.filter(ch => ch.id !== chId);
      setChapters(remaining);
      if (activeChapterId === chId) {
        setActiveChapterId(remaining[0]?.id || null);
      }
      markSaved();
    } catch (e) {
      toast.add('Failed to delete chapter', 'error');
    }
  };

  const addLine = async (chapterId) => {
    if (!newLineText.trim()) return;
    try {
      const ln = await api(`/chapters/${chapterId}/lines`, {
        method: 'POST',
        body: JSON.stringify({ text: newLineText, status: 'approved' }),
      });
      setChapters(prev =>
        prev.map(ch =>
          ch.id === chapterId
            ? { ...ch, lines: [...(ch.lines || []), ln] }
            : ch
        )
      );
      setNewLineText('');
      setAddingLineTo(null);
      markSaved();
    } catch (e) {
      toast.add('Failed to add line', 'error');
    }
  };

  const resetChapter = async () => {
    if (!window.confirm('Reset this chapter? All lines will be removed.')) return;
    try {
      for (const ln of lines) {
        await api(`/lines/${ln.id}`, { method: 'DELETE' });
      }
      setChapters(prev =>
        prev.map(ch => ch.id === activeChapterId ? { ...ch, lines: [] } : ch)
      );
      setInterviewDone(false);
      markSaved();
      toast.add('Chapter reset');
    } catch (e) {
      toast.add('Failed to reset chapter', 'error');
    }
  };

  const openWorkspace = (view) => {
    setActiveView(view);
    setDrawerOpen(false);
  };

  /* ── renderLine — individual manuscript line ── */

  const renderLine = (ln, isPending) => {
    const isEditing = editingLine === ln.id;
    return (
      <div
        key={ln.id}
        className={`st-line st-line-${ln.status}${isEditing ? ' st-line-editing' : ''}`}
      >
        <div className="st-line-content">
          {!isEditing && (
            <div className={`st-line-text${isPending ? ' pending' : ''}`}>
              {ln.text}
            </div>
          )}
          {isEditing && (
            <>
              <textarea
                className="st-edit-area"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                autoFocus
              />
              <div className="st-edit-actions">
                <button className="st-edit-save" onClick={saveEdit}>Save</button>
                <button className="st-edit-cancel" onClick={cancelEdit}>Cancel</button>
              </div>
            </>
          )}
          {ln.source_tags && ln.source_tags.length > 0 && (
            <div className="st-line-meta">
              {ln.source_tags.map((tag, i) => (
                <span key={i} className="st-source-tag">{tag}</span>
              ))}
            </div>
          )}
          {ln.status === 'rejected' && (
            <RewriteOptions lineId={ln.id} bookId={book.id} onRewrite={onRefresh} />
          )}
          {reviewMode && ln.memory_data && <MemoryCard data={ln.memory_data} />}
        </div>
        <div className="st-line-actions">
          {isPending && (
            <>
              <button className="st-line-action st-action-approve" onClick={() => approveLine(ln.id)}>✓</button>
              <button className="st-line-action st-action-edit" onClick={() => startEdit(ln)}>✎</button>
              <button className="st-line-action st-action-reject" onClick={() => rejectLine(ln.id)}>✕</button>
            </>
          )}
          {!isPending && !isEditing && (
            <button className="st-line-action st-action-edit" onClick={() => startEdit(ln)}>✎</button>
          )}
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════
     RENDER — The Quiet Room
     ═══════════════════════════════════════ */

  return (
    <div
      className={`st-editor-layout${writingMode ? ' st-writing-mode' : ''}`}
      data-era={eraTheme}
    >
      {/* Writing Mode — exit button, floats into view on hover */}
      {writingMode && (
        <button className="st-writing-mode-exit" onClick={() => setWritingMode(false)}>
          Exit Focus
        </button>
      )}

      {/* ── Top Bar ── */}
      <div className="st-topbar">
        <div className="st-topbar-left">
          <button className="st-topbar-back" onClick={onClose}>← Library</button>
          <div className="st-topbar-sep" />
          <span className="st-topbar-brand">Prime Studios</span>
          <button
            className="st-mobile-nav-toggle"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label="Toggle chapters"
          >
            {mobileNavOpen ? '✕' : '☰'}
          </button>
        </div>

        <div className="st-topbar-center">
          <span className="st-topbar-title">
            {book.title}
            {activeChapter && (
              <span className="st-topbar-title-dim"> — {activeChapter.title}</span>
            )}
          </span>
        </div>

        <div className="st-topbar-right">
          <span className="st-topbar-wordcount">
            {totalWordCount.toLocaleString()} words
          </span>
          {savedAt && (
            <span
              className={`st-topbar-saved${justSaved ? ' just-saved' : ''}`}
              key={savedAt}
            >
              Saved
            </span>
          )}
          <button
            className={`st-mode-toggle${writingMode ? ' active' : ''}`}
            onClick={() => setWritingMode(!writingMode)}
          >
            Focus
          </button>
          <button
            className={`st-workspace-toggle${activeView !== 'book' ? ' has-active' : ''}`}
            onClick={e => { e.stopPropagation(); setDrawerOpen(!drawerOpen); }}
          >
            Workspace ▾
          </button>
        </div>
      </div>

      {/* ── Workspace Drawer ── */}
      {drawerOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 25 }}
            onClick={() => setDrawerOpen(false)}
          />
          <div className="st-workspace-drawer" onClick={e => e.stopPropagation()}>
            <button
              className={`st-workspace-item${activeView === 'book' ? ' active' : ''}`}
              onClick={() => openWorkspace('book')}
            >
              <span className="st-workspace-item-icon">✦</span> Manuscript
            </button>
            <button
              className={`st-workspace-item${activeView === 'toc' ? ' active' : ''}`}
              onClick={() => openWorkspace('toc')}
            >
              <span className="st-workspace-item-icon">≡</span> Table of Contents
            </button>
            <button
              className={`st-workspace-item${activeView === 'memory' ? ' active' : ''}`}
              onClick={() => openWorkspace('memory')}
            >
              <span className="st-workspace-item-icon">◉</span> Memory Bank
            </button>
            <button
              className={`st-workspace-item${activeView === 'scenes' ? ' active' : ''}`}
              onClick={() => openWorkspace('scenes')}
            >
              <span className="st-workspace-item-icon">▦</span> Scenes
            </button>
            <button
              className={`st-workspace-item${activeView === 'lala' ? ' active' : ''}`}
              onClick={() => openWorkspace('lala')}
            >
              <span className="st-workspace-item-icon">✦</span> Lala Detection
            </button>
            <button
              className={`st-workspace-item${activeView === 'script' ? ' active' : ''}`}
              onClick={() => openWorkspace('script')}
            >
              <span className="st-workspace-item-icon">⟶</span> Script
            </button>
            <button
              className={`st-workspace-item${activeView === 'export' ? ' active' : ''}`}
              onClick={() => openWorkspace('export')}
            >
              <span className="st-workspace-item-icon">↓</span> Export
            </button>
          </div>
        </>
      )}

      {/* ── Editor Body (Nav + Content) ── */}
      <div className="st-editor-body">

        {/* Mobile nav backdrop */}
        {mobileNavOpen && (
          <div className="st-mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
        )}

        {/* Left Navigation — Quiet */}
        <nav className={`st-nav${mobileNavOpen ? ' st-nav-mobile-open' : ''}`}>
          <div className="st-nav-brand">
            <div className="st-nav-brand-label">Archive</div>
            {editingBookTitle ? (
              <input
                className="st-inline-edit st-inline-edit-book"
                value={bookTitleDraft}
                onChange={e => setBookTitleDraft(e.target.value)}
                onBlur={saveBookTitle}
                onKeyDown={e => { if (e.key === 'Enter') saveBookTitle(); if (e.key === 'Escape') setEditingBookTitle(false); }}
                autoFocus
              />
            ) : (
              <h3
                className="st-nav-brand-title"
                onDoubleClick={() => { setEditingBookTitle(true); setBookTitleDraft(book.title || ''); }}
              >
                {book.title}
              </h3>
            )}
            {book.subtitle && <div className="st-nav-brand-sub">{book.subtitle}</div>}
          </div>

          <div className="st-nav-section">
            <div className="st-nav-section-label">Chapters</div>
            <div className="st-nav-chapters">
              {chapters.map((ch, i) => (
                <div key={ch.id} style={{ position: 'relative' }}>
                  <button
                    className={`st-nav-chapter${ch.id === activeChapterId ? ' active' : ''}`}
                    onClick={() => { setActiveChapterId(ch.id); setActiveView('book'); setMobileNavOpen(false); }}
                  >
                    <span className="st-nav-num">{String(i + 1).padStart(2, '0')}</span>
                    <div className="st-nav-chapter-info">
                      {editingChapterId === ch.id ? (
                        <input
                          className="st-inline-edit st-inline-edit-chapter"
                          value={chapterTitleDraft}
                          onChange={e => setChapterTitleDraft(e.target.value)}
                          onBlur={() => saveChapterTitle(ch.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveChapterTitle(ch.id);
                            if (e.key === 'Escape') setEditingChapterId(null);
                          }}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <div
                          className="st-nav-chapter-title"
                          onDoubleClick={e => {
                            e.stopPropagation();
                            setEditingChapterId(ch.id);
                            setChapterTitleDraft(ch.title || '');
                          }}
                        >
                          {ch.title || 'Untitled'}
                        </div>
                      )}
                    </div>
                  </button>
                  <button
                    className="st-nav-chapter-delete"
                    onClick={e => { e.stopPropagation(); deleteChapter(ch.id); }}
                    title="Delete chapter"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="st-nav-add">
            <button onClick={() => setShowAddChapter(true)}>+ New Chapter</button>
          </div>

          <div className="st-nav-stats">
            <div className="st-stat-row">
              <span className="st-stat-label">Lines</span>
              <span className="st-stat-val">{allLines.length}</span>
            </div>
            <div className="st-stat-row">
              <span className="st-stat-label">Pending</span>
              <span className="st-stat-val st-stat-pending">
                {allLines.filter(l => l.status === 'pending').length}
              </span>
            </div>
            <div className="st-stat-row">
              <span className="st-stat-label">Approved</span>
              <span className="st-stat-val st-stat-approved">
                {allLines.filter(l => l.status === 'approved' || l.status === 'edited').length}
              </span>
            </div>
          </div>
        </nav>

        {/* ── Main Content ── */}
        <div className="st-editor">

          {/* Add Chapter Form */}
          {showAddChapter && (
            <div className="st-add-chapter-form">
              <div className="st-form-group">
                <label>Title</label>
                <input
                  value={newChapterTitle}
                  onChange={e => setNewChapterTitle(e.target.value)}
                  placeholder="Chapter title"
                  onKeyDown={e => { if (e.key === 'Enter') addChapter(); }}
                />
              </div>
              <div className="st-form-group">
                <label>Era / Badge</label>
                <input
                  value={newChapterBadge}
                  onChange={e => setNewChapterBadge(e.target.value)}
                  placeholder="e.g. Pre-Prime Era"
                />
              </div>
              <button className="st-btn st-btn-sm st-btn-gold" onClick={addChapter}>
                Add
              </button>
              <button
                className="st-btn st-btn-sm st-btn-ghost"
                onClick={() => { setShowAddChapter(false); setNewChapterTitle(''); setNewChapterBadge(''); }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* ── Manuscript View ── */}
          {activeView === 'book' ? (
            activeChapter ? (
              <div className="st-manuscript-wrapper">
                <div className="st-manuscript">

                  {/* Literary Chapter Header */}
                  <div className="st-chapter-header">
                    <div className="st-chapter-header-label">
                      Chapter {numberWord(chapterIndex)}
                    </div>
                    {editingChapterId === activeChapter.id ? (
                      <input
                        className="st-inline-edit st-inline-edit-chapter-bar"
                        value={chapterTitleDraft}
                        onChange={e => setChapterTitleDraft(e.target.value)}
                        onBlur={() => saveChapterTitle(activeChapter.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveChapterTitle(activeChapter.id);
                          if (e.key === 'Escape') setEditingChapterId(null);
                        }}
                        autoFocus
                      />
                    ) : (
                      <h2
                        className="st-chapter-header-title"
                        onDoubleClick={() => {
                          setEditingChapterId(activeChapter.id);
                          setChapterTitleDraft(activeChapter.title || '');
                        }}
                      >
                        {activeChapter.title || 'Untitled Chapter'}
                      </h2>
                    )}
                    <div className="st-chapter-header-meta">
                      {activeChapter.badge && <span>{activeChapter.badge}</span>}
                      {activeChapter.badge && <span>·</span>}
                      <span>{approvedLines.length} approved</span>
                      {pendingCount > 0 && (
                        <>
                          <span>·</span>
                          <span>{pendingCount} pending</span>
                        </>
                      )}
                    </div>

                    {/* Chapter Actions — icons, appear on hover */}
                    <div className="st-chapter-actions">
                      <button
                        className="st-chapter-icon-btn"
                        onClick={() => setBriefOpen(true)}
                        title="Define intention"
                      >
                        ✎
                      </button>
                      <button
                        className="st-chapter-icon-btn"
                        onClick={() => setImportTarget(activeChapter)}
                        title="Import draft"
                      >
                        ↓
                      </button>
                      <button
                        className={`st-chapter-icon-btn${reviewMode ? ' active' : ''}`}
                        onClick={() => setReviewMode(!reviewMode)}
                        title={reviewMode ? 'Exit review' : 'Review mode'}
                        style={reviewMode ? { color: 'var(--st-gold)', opacity: 1 } : {}}
                      >
                        👁
                      </button>
                      <button
                        className="st-chapter-icon-btn"
                        onClick={() => setRedoInterview(true)}
                        title="Redo interview"
                      >
                        ⟳
                      </button>
                      <button
                        className="st-chapter-icon-btn"
                        onClick={() => setCanonOpen(!canonOpen)}
                        title={canonOpen ? 'Close canon' : 'Canon panel'}
                        style={canonOpen ? { color: 'var(--st-gold)', opacity: 1 } : {}}
                      >
                        ⊞
                      </button>
                      <button
                        className="st-chapter-icon-btn danger"
                        onClick={resetChapter}
                        title="Reset draft"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Scene Interview — empty chapter, not yet interviewed */}
                  {((lines.length === 0 && !interviewDone) || redoInterview) && (
                    <SceneInterview
                      book={book}
                      chapter={activeChapter}
                      characters={registryCharacters}
                      onComplete={() => {
                        setInterviewDone(true);
                        setRedoInterview(false);
                        onRefresh();
                      }}
                    />
                  )}

                  {/* Chapter Draft Generator — after interview, before lines */}
                  {interviewDone && lines.length === 0 && (
                    <ChapterDraftGenerator
                      chapter={activeChapter}
                      book={book}
                      onDraftGenerated={onRefresh}
                    />
                  )}

                  {/* Book Page — the manuscript body */}
                  <div className="st-book-page">
                    {/* Approved lines with Narrative Intelligence every 5 */}
                    {approvedLines.map((ln, i) => (
                      <React.Fragment key={ln.id}>
                        {renderLine(ln, false)}
                        {(i + 1) % 5 === 0 && i < approvedLines.length - 1 && (
                          <div className="narrative-intelligence-wrapper">
                            <div className="st-ai-indicator">
                              <span className="st-ai-indicator-tooltip">
                                Narrative intelligence
                              </span>
                            </div>
                            <NarrativeIntelligence
                              chapter={activeChapter}
                              lines={approvedLines.slice(Math.max(0, i - 4), i + 1)}
                              lineIndex={i}
                              book={book}
                              characters={registryCharacters}
                            />
                          </div>
                        )}
                      </React.Fragment>
                    ))}

                    {/* Continuity Guard */}
                    <ContinuityGuard
                      chapter={activeChapter}
                      lines={approvedLines}
                      book={book}
                      triggerLine={lastApprovedLine}
                    />

                    {/* Pending Lines — collapsible */}
                    {pendingLines.length > 0 && (
                      <>
                        <button
                          className="st-pending-toggle"
                          onClick={() => setPendingOpen(!pendingOpen)}
                        >
                          <span className={`arrow${pendingOpen ? ' open' : ''}`}>▸</span>
                          {pendingLines.length} pending {pendingLines.length === 1 ? 'line' : 'lines'}
                        </button>
                        {pendingOpen && (
                          <div className="st-pending-body">
                            {pendingLines.map(ln => (
                              <React.Fragment key={ln.id}>
                                {renderLine(ln, true)}
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Add Line */}
                    {addingLineTo === activeChapterId ? (
                      <div className="st-add-line">
                        <input
                          value={newLineText}
                          onChange={e => setNewLineText(e.target.value)}
                          placeholder="Continue writing…"
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) addLine(activeChapterId); }}
                          autoFocus
                        />
                        <button
                          className="st-btn st-btn-sm st-btn-gold"
                          onClick={() => addLine(activeChapterId)}
                        >
                          Add
                        </button>
                      </div>
                    ) : (
                      <button
                        className="st-add-line-trigger"
                        onClick={() => setAddingLineTo(activeChapterId)}
                      >
                        Continue writing…
                      </button>
                    )}
                  </div>

                  {/* Action Bar — quiet footer */}
                  <div className="st-action-bar">
                    <span className="st-action-hint">
                      {pendingCount > 0 ? `${pendingCount} pending` : 'All lines approved'}
                    </span>
                    <div className="st-action-bar-btns">
                      {pendingCount > 0 && (
                        <button
                          className="st-btn st-btn-sm st-btn-ghost"
                          onClick={approveAll}
                        >
                          Approve All
                        </button>
                      )}
                      <button
                        className="st-btn st-btn-sm st-btn-ghost"
                        onClick={() => setImportTarget(activeChapter)}
                      >
                        Import
                      </button>
                      <button
                        className="st-btn st-btn-sm st-btn-primary"
                        onClick={() => navigate(`/books/${book.id}/read`)}
                      >
                        Publish Draft
                      </button>
                    </div>
                  </div>
                </div>

                {/* Canon Panel — right side, sticky */}
                {canonOpen && (
                  <div className="st-canon-panel">
                    <div className="st-canon-header">
                      Canon
                      <button
                        className="st-canon-close"
                        onClick={() => setCanonOpen(false)}
                      >
                        ×
                      </button>
                    </div>
                    <div className="st-canon-body">
                      {registryCharacters.length > 0 ? (
                        registryCharacters.map(char => (
                          <div key={char.id} className="st-canon-row">
                            <span className="st-canon-label">{char.name}</span>
                            <span className="st-canon-value">
                              {char.role || char.description || '—'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 13, color: 'var(--st-muted)', fontStyle: 'italic' }}>
                          No characters in registry
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="st-no-selection">
                Select a chapter to begin writing
              </div>
            )

          /* ── Workspace Panels ── */
          ) : activeView === 'toc' ? (
            <TOCPanel book={book} chapters={chapters} onChapterClick={(id) => { setActiveChapterId(id); setActiveView('book'); }} />
          ) : activeView === 'memory' ? (
            <MemoryBankView bookId={book.id} />
          ) : activeView === 'scenes' ? (
            <ScenesPanel bookId={book.id} chapters={chapters} />
          ) : activeView === 'lala' ? (
            <LalaSceneDetection bookId={book.id} />
          ) : activeView === 'export' ? (
            <ExportPanel bookId={book.id} />
          ) : activeView === 'script' ? (
            <ScriptBridgePanel
              bookId={book.id}
              bookTitle={book.title}
              chapterId={activeChapter?.id}
              chapterTitle={activeChapter?.title}
              showId={book.show_id}
            />
          ) : null}
        </div>
      </div>

      {/* ── Brief Sheet — right-side overlay ── */}
      {briefOpen && (
        <div className="st-brief-sheet-overlay" onClick={() => setBriefOpen(false)}>
          <div className="st-brief-sheet" onClick={e => e.stopPropagation()}>
            <div className="st-brief-sheet-header">
              <span className="st-brief-sheet-title">Define Intention</span>
              <button
                className="st-brief-sheet-close"
                onClick={() => setBriefOpen(false)}
              >
                ×
              </button>
            </div>
            <ChapterBrief chapter={activeChapter} characters={registryCharacters} />
          </div>
        </div>
      )}

      {/* ── Import Draft Modal ── */}
      {importTarget && (
        <ImportDraftModal
          chapterId={importTarget.id}
          chapterTitle={importTarget.title}
          open={true}
          onClose={() => setImportTarget(null)}
          onImported={() => { setImportTarget(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

export default StorytellerPage;
