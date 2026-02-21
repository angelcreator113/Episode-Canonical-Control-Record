/**
 * StorytellerPage — PNOS Book Editor
 *
 * Two views:
 *   1) Book list — grid of character books
 *   2) Book editor — line-by-line review with approve/edit/reject
 *
 * Location: frontend/src/pages/StorytellerPage.jsx
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import './StorytellerPage.css';
import { MemoryCard, MemoryBankPanel, MEMORY_STYLES } from './MemoryConfirmation';
import ScenesPanel from './ScenesPanel';
import NewBookModal from './NewBookModal';

const API = '/api/v1/storyteller';

// ── Helpers ──────────────────────────────────────

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);
  return { toasts, toast: add };
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
  return data;
}

// ── Toast renderer ───────────────────────────────

function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="st-toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`st-toast st-toast-${t.type}`}>{t.message}</div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════

export default function StorytellerPage() {
  const [books, setBooks] = useState([]);
  const [activeBook, setActiveBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const { toasts, toast } = useToasts();

  // ── Load book list ───────────────────────────

  const loadBooks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api('/books');
      setBooks(data.books || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  // ── Open a book for editing ─────────────────

  const openBook = useCallback(async (id) => {
    try {
      setLoading(true);
      const data = await api(`/books/${id}`);
      setActiveBook(data.book);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const closeBook = () => {
    setActiveBook(null);
    loadBooks();
  };

  // ── Delete book ─────────────────────────────

  const deleteBook = async (id) => {
    if (!window.confirm('Delete this book? This cannot be undone.')) return;
    try {
      await api(`/books/${id}`, { method: 'DELETE' });
      toast('Book deleted');
      loadBooks();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  // ── Render ──────────────────────────────────

  if (loading && !activeBook && !books.length) {
    return (
      <div className="storyteller-page">
        <div className="st-loading"><div className="st-spinner" /> Loading books…</div>
        <ToastContainer toasts={toasts} />
      </div>
    );
  }

  return (
    <div className="storyteller-page">
      {activeBook ? (
        <BookEditor
          book={activeBook}
          onBack={closeBook}
          toast={toast}
          onRefresh={() => openBook(activeBook.id)}
        />
      ) : (
        <BookList
          books={books}
          onOpen={openBook}
          onDelete={deleteBook}
          onCreate={() => setShowCreate(true)}
        />
      )}

      <NewBookModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        showId={null}
        onBookCreated={(book) => {
          toast('Book created');
          setShowCreate(false);
          setActiveBook(book);
        }}
      />

      <ToastContainer toasts={toasts} />
    </div>
  );
}

// ══════════════════════════════════════════════════
// Book List
// ══════════════════════════════════════════════════

function BookList({ books, onOpen, onDelete, onCreate }) {
  return (
    <div className="st-book-list">
      <div className="st-book-list-header">
        <h1>📖 StoryTeller</h1>
        <button className="st-btn st-btn-gold" onClick={onCreate}>
          + New Book
        </button>
      </div>

      {books.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty-icon">📖</span>
          <p><strong>No character books yet.</strong></p>
          <p>Create your first book to start reviewing lines.</p>
        </div>
      ) : (
        <div className="st-book-grid">
          {books.map(book => (
            <div key={book.id} className="st-book-card" onClick={() => onOpen(book.id)}>
              <span className={`st-badge st-status-${book.status}`}>{book.status}</span>
              <h3>{book.title || book.character_name}</h3>
              <div className="st-book-sub">
                {[book.era_name, book.timeline_position, book.primary_pov].filter(Boolean).join(' · ') || book.subtitle || ''}
              </div>
              <div className="st-book-stats">
                <span><span className="st-dot st-dot-pending" /> {book.pending_count || 0} pending</span>
                <span><span className="st-dot st-dot-approved" /> {book.approved_count || 0} approved</span>
                <span><span className="st-dot st-dot-edited" /> {book.edited_count || 0} edited</span>
              </div>
              <button
                className="st-btn st-btn-danger st-btn-sm"
                style={{ position: 'absolute', bottom: 10, right: 10, opacity: 0.7 }}
                onClick={e => { e.stopPropagation(); onDelete(book.id); }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
// Book Editor — 2-Column Calm Author-First Layout
// [ Left Nav ] | [ Center Content ]
// View toggle replaces right sidebar
// ══════════════════════════════════════════════════

function BookEditor({ book, onBack, toast, onRefresh }) {
  const [chapters, setChapters] = useState(book.chapters || []);
  const [activeChapterId, setActiveChapterId] = useState(
    () => (book.chapters || [])[0]?.id || null
  );
  const [activeView, setActiveView] = useState('book'); // book | memory | scenes
  const [registryCharacters, setRegistryCharacters] = useState([]);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

  // Inject Memory keyframe styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = MEMORY_STYLES;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Fetch registry characters for the MemoryCard confirm step
  useEffect(() => {
    const showId = book.show_id;
    if (!showId) return;
    fetch(`/api/v1/character-registry/registries?show_id=${showId}`)
      .then(r => r.json())
      .then(data => {
        const chars = data.registries?.flatMap(r => r.characters || []) || [];
        setRegistryCharacters(chars);
      })
      .catch(() => {});
  }, [book.show_id]);

  const [editingLine, setEditingLine] = useState(null);
  const [editText, setEditText] = useState('');
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterBadge, setNewChapterBadge] = useState('');
  const [addingLineTo, setAddingLineTo] = useState(null);
  const [newLineText, setNewLineText] = useState('');

  // Active chapter
  const activeChapter = chapters.find(c => c.id === activeChapterId) || null;
  const lines = activeChapter?.lines || [];

  // Compute stats
  const allLines = chapters.flatMap(c => c.lines || []);
  const pendingCount = allLines.filter(l => l.status === 'pending').length;

  // Separate approved/edited lines from pending for the active chapter
  const approvedLines = lines.filter(l => l.status === 'approved' || l.status === 'edited');
  const pendingLines = lines.filter(l => l.status === 'pending');

  // Group lines by group_label
  const groupLines = (lineList) => {
    const groups = [];
    let currentGroup = null;
    for (const line of lineList) {
      const label = line.group_label || '';
      if (!currentGroup || currentGroup.label !== label) {
        currentGroup = { label, lines: [] };
        groups.push(currentGroup);
      }
      currentGroup.lines.push(line);
    }
    return groups;
  };

  // ── Line actions ───────────────────────────

  const approveLine = async (lineId) => {
    try {
      await api(`/lines/${lineId}`, { method: 'PUT', body: { status: 'approved' } });
      updateLineLocal(lineId, { status: 'approved' });
      toast('Line approved');
    } catch (err) { toast(err.message, 'error'); }
  };

  const rejectLine = async (lineId) => {
    try {
      await api(`/lines/${lineId}`, { method: 'DELETE' });
      removeLineLocal(lineId);
      toast('Line removed');
    } catch (err) { toast(err.message, 'error'); }
  };

  const startEdit = (line) => {
    setEditingLine(line.id);
    setEditText(line.text);
  };

  const saveEdit = async () => {
    if (!editingLine) return;
    try {
      const data = await api(`/lines/${editingLine}`, {
        method: 'PUT',
        body: { text: editText },
      });
      updateLineLocal(editingLine, { text: editText, status: data.line?.status || 'edited' });
      toast('Line updated');
      setEditingLine(null);
    } catch (err) { toast(err.message, 'error'); }
  };

  const cancelEdit = () => { setEditingLine(null); setEditText(''); };

  // ── Approve all ────────────────────────────

  const approveAll = async () => {
    if (pendingCount === 0) return toast('No pending lines', 'info');
    try {
      const data = await api(`/books/${book.id}/approve-all`, { method: 'POST' });
      toast(`${data.approved_count} lines approved`);
      const refreshed = await api(`/books/${book.id}`);
      setChapters(refreshed.book.chapters || []);
    } catch (err) { toast(err.message, 'error'); }
  };

  // ── Add chapter ────────────────────────────

  const addChapter = async () => {
    if (!newChapterTitle.trim()) return;
    try {
      const data = await api(`/books/${book.id}/chapters`, {
        method: 'POST',
        body: { title: newChapterTitle, badge: newChapterBadge || undefined },
      });
      const newChap = { ...data.chapter, lines: data.chapter.lines || [] };
      setChapters(prev => [...prev, newChap]);
      setActiveChapterId(newChap.id);
      setNewChapterTitle('');
      setNewChapterBadge('');
      setShowAddChapter(false);
      toast('Chapter added');
    } catch (err) { toast(err.message, 'error'); }
  };

  // ── Delete chapter ─────────────────────────

  const deleteChapter = async (chapterId) => {
    if (!window.confirm('Delete this chapter and all its lines?')) return;
    try {
      await api(`/chapters/${chapterId}`, { method: 'DELETE' });
      setChapters(prev => {
        const next = prev.filter(c => c.id !== chapterId);
        if (activeChapterId === chapterId) {
          setActiveChapterId(next[0]?.id || null);
        }
        return next;
      });
      toast('Chapter deleted');
    } catch (err) { toast(err.message, 'error'); }
  };

  // ── Add line ───────────────────────────────

  const addLine = async (chapterId) => {
    if (!newLineText.trim()) return;
    try {
      const data = await api(`/chapters/${chapterId}/lines`, {
        method: 'POST',
        body: { text: newLineText },
      });
      setChapters(prev => prev.map(c =>
        c.id === chapterId
          ? { ...c, lines: [...(c.lines || []), data.line] }
          : c
      ));
      setNewLineText('');
      setAddingLineTo(null);
      toast('Line added');
    } catch (err) { toast(err.message, 'error'); }
  };

  // ── Local state helpers ────────────────────

  const updateLineLocal = (lineId, updates) => {
    setChapters(prev => prev.map(c => ({
      ...c,
      lines: (c.lines || []).map(l => l.id === lineId ? { ...l, ...updates } : l),
    })));
  };

  const removeLineLocal = (lineId) => {
    setChapters(prev => prev.map(c => ({
      ...c,
      lines: (c.lines || []).filter(l => l.id !== lineId),
    })));
  };

  // ── Render a single line ───────────────────

  const renderLine = (line) => (
    <React.Fragment key={line.id}>
      <div className={`st-line ${editingLine === line.id ? 'st-line-editing' : ''}`}>
        <div className="st-line-content">
          {editingLine === line.id ? (
            <>
              <textarea
                className="st-edit-area"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.metaKey) saveEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
              />
              <div className="st-edit-actions">
                <button className="st-edit-save" onClick={saveEdit}>Save</button>
                <button className="st-edit-cancel" onClick={cancelEdit}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className={`st-line-text ${line.status === 'pending' ? 'pending' : ''}`}>
                {line.text}
              </div>
              {(line.source_tags || []).length > 0 && (
                <div className="st-line-meta">
                  {line.source_tags.map((tag, ti) => (
                    <span key={ti} className="st-source-tag">{tag}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {editingLine !== line.id && (
          <div className="st-line-actions">
            {line.status !== 'approved' && (
              <button
                className="st-line-action st-action-approve"
                onClick={() => approveLine(line.id)}
                title="Approve"
              >✓</button>
            )}
            <button
              className="st-line-action st-action-edit"
              onClick={() => startEdit(line)}
              title="Edit"
            >✎</button>
            <button
              className="st-line-action st-action-reject"
              onClick={() => rejectLine(line.id)}
              title="Remove"
            >✕</button>
          </div>
        )}
      </div>
      {(line.status === 'approved' || line.status === 'edited') && reviewMode && (
        <MemoryCard
          lineId={line.id}
          characters={registryCharacters}
          onConfirmed={(memory) => {
            toast(`Memory confirmed → ${memory.character?.display_name || 'Registry'}`);
          }}
          onDismissed={() => {}}
        />
      )}
    </React.Fragment>
  );

  // ── Render ─────────────────────────────────

  return (
    <div className="st-editor-layout">

      {/* ── Left Nav ── */}
      <nav className="st-nav">
        <div className="st-nav-header">
          <button className="st-nav-back" onClick={onBack}>← Books</button>
          <div className="st-nav-character">{book.title || book.character_name}</div>
          <div className="st-nav-subtitle">
            {book.subtitle || [book.era_name, book.timeline_position].filter(Boolean).join(' · ') || ''}
          </div>
        </div>

        <div className="st-nav-chapters">
          {chapters.map((ch, i) => (
            <div
              key={ch.id}
              className={`st-nav-chapter ${ch.id === activeChapterId ? 'active' : ''}`}
              onClick={() => setActiveChapterId(ch.id)}
            >
              <span className="st-nav-num">
                {String(ch.chapter_number || i + 1).padStart(2, '0')}
              </span>
              <span className="st-nav-chapter-title">{ch.title}</span>
            </div>
          ))}
        </div>

        <div className="st-nav-add">
          <button onClick={() => setShowAddChapter(!showAddChapter)}>
            + Add Chapter
          </button>
        </div>
      </nav>

      {/* ── Center Content ── */}
      <div className="st-editor">

        {/* View toggle: Book | Memory | Scenes */}
        <div className="st-view-bar">
          {['book', 'memory', 'scenes'].map(v => (
            <button
              key={v}
              className={`st-view-tab ${activeView === v ? 'active' : ''}`}
              onClick={() => setActiveView(v)}
            >
              {v === 'book' ? 'Book' : v === 'memory' ? 'Memory' : 'Scenes'}
            </button>
          ))}
          <div className="st-view-spacer" />
          {activeView === 'book' && (
            <div className="st-view-actions">
              {pendingCount > 0 && (
                <button className="st-btn st-btn-secondary st-btn-sm" onClick={approveAll}>
                  Approve All ({pendingCount})
                </button>
              )}
              <button className="st-btn st-btn-primary st-btn-sm" onClick={onRefresh}>
                Compile
              </button>
            </div>
          )}
        </div>

        {/* Add chapter form (shared) */}
        {showAddChapter && (
          <div className="st-add-chapter-form">
            <div className="st-form-group">
              <label>Chapter Title</label>
              <input
                autoFocus
                value={newChapterTitle}
                onChange={e => setNewChapterTitle(e.target.value)}
                placeholder="e.g. Core Identity"
                onKeyDown={e => e.key === 'Enter' && addChapter()}
              />
            </div>
            <div className="st-form-group">
              <label>Badge (optional)</label>
              <input
                value={newChapterBadge}
                onChange={e => setNewChapterBadge(e.target.value)}
                placeholder="e.g. VOICE"
              />
            </div>
            <button className="st-btn st-btn-primary st-btn-sm" onClick={addChapter}>Add</button>
            <button className="st-btn st-btn-ghost st-btn-sm" onClick={() => setShowAddChapter(false)}>Cancel</button>
          </div>
        )}

        {/* ── Book View ── */}
        {activeView === 'book' && (
          <>
            {!activeChapter ? (
              <div className="st-no-selection">
                {chapters.length === 0
                  ? 'Add a chapter to get started.'
                  : 'Select a chapter from the left.'}
              </div>
            ) : (
              <>
                {/* Chapter heading */}
                <div className="st-chapter-heading">
                  <h1>{activeChapter.title}</h1>
                  <div className="st-chapter-meta">
                    {approvedLines.length} {approvedLines.length === 1 ? 'line' : 'lines'}
                    {pendingLines.length > 0 && ` · ${pendingLines.length} pending`}
                    <button
                      className={`st-review-indicator ${reviewMode ? 'active' : ''}`}
                      onClick={() => setReviewMode(r => !r)}
                      title={reviewMode ? 'Exit review mode' : 'Enter review mode'}
                    >
                      <span className="st-review-dot" />
                      <span className="st-review-count">
                        {reviewMode ? 'Reviewing' : 'Review'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Approved / edited lines — the book content */}
                {approvedLines.length > 0 && (
                  <div className="st-section">
                    {groupLines(approvedLines).map((group, gi) => (
                      <div key={gi}>
                        {group.label && (
                          <div className="st-section-label">{group.label}</div>
                        )}
                        {group.lines.map(renderLine)}
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending lines — collapsed by default */}
                {pendingLines.length > 0 && (
                  <div className="st-section">
                    <button
                      className="st-pending-toggle"
                      onClick={() => setPendingOpen(!pendingOpen)}
                    >
                      <span className={`arrow ${pendingOpen ? 'open' : ''}`}>▶</span>
                      {pendingLines.length} Pending Memory Detection{pendingLines.length !== 1 ? 's' : ''}
                    </button>
                    {pendingOpen && (
                      <div className="st-pending-body">
                        {groupLines(pendingLines).map((group, gi) => (
                          <div key={gi}>
                            {group.label && (
                              <div className="st-section-label">{group.label}</div>
                            )}
                            {group.lines.map(renderLine)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Add line */}
                {addingLineTo === activeChapter.id ? (
                  <div className="st-add-line">
                    <input
                      autoFocus
                      value={newLineText}
                      onChange={e => setNewLineText(e.target.value)}
                      placeholder="Write a new line…"
                      onKeyDown={e => {
                        if (e.key === 'Enter') addLine(activeChapter.id);
                        if (e.key === 'Escape') { setAddingLineTo(null); setNewLineText(''); }
                      }}
                    />
                    <button className="st-btn st-btn-primary st-btn-sm" onClick={() => addLine(activeChapter.id)}>Add</button>
                    <button className="st-btn st-btn-ghost st-btn-sm" onClick={() => { setAddingLineTo(null); setNewLineText(''); }}>Cancel</button>
                  </div>
                ) : (
                  <button
                    className="st-add-line-trigger"
                    onClick={() => { setAddingLineTo(activeChapter.id); setNewLineText(''); }}
                  >
                    + Add line
                  </button>
                )}
              </>
            )}
          </>
        )}

        {/* ── Memory View (replaces right panel) ── */}
        {activeView === 'memory' && (
          <MemoryBankPanel bookId={book.id} />
        )}

        {/* ── Scenes View (replaces right panel) ── */}
        {activeView === 'scenes' && (
          <ScenesPanel
            bookId={book.id}
            chapters={chapters}
            onLineAdded={(chapterId, line) => {
              setChapters(prev => prev.map(c =>
                c.id === chapterId
                  ? { ...c, lines: [...(c.lines || []), line] }
                  : c
              ));
              toast('Scene added as pending line');
            }}
          />
        )}
      </div>
    </div>
  );
}
