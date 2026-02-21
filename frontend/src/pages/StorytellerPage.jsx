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
import TOCPanel from './TOCPanel';
import ScenesPanel from './ScenesPanel';

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

  // ── Create book ─────────────────────────────

  const createBook = async (form) => {
    try {
      const data = await api('/books', { method: 'POST', body: form });
      toast('Book created');
      setShowCreate(false);
      setActiveBook(data.book);
    } catch (err) {
      toast(err.message, 'error');
    }
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

      {showCreate && (
        <CreateBookModal
          onSubmit={createBook}
          onClose={() => setShowCreate(false)}
        />
      )}

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
              <h3>{book.character_name}</h3>
              <div className="st-book-sub">
                {[book.season_label, book.week_label].filter(Boolean).join(' · ') || book.title}
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
// Create Book Modal
// ══════════════════════════════════════════════════

function CreateBookModal({ onSubmit, onClose }) {
  const [form, setForm] = useState({
    character_name: '',
    season_label: '',
    week_label: '',
    title: '',
    subtitle: '',
  });

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.character_name.trim()) return;
    onSubmit({
      ...form,
      title: form.title || form.character_name,
    });
  };

  return (
    <div className="st-modal-backdrop" onClick={onClose}>
      <div className="st-modal" onClick={e => e.stopPropagation()}>
        <h2>New Character Book</h2>
        <form onSubmit={handleSubmit}>
          <div className="st-form-group">
            <label>Character Name *</label>
            <input
              autoFocus
              value={form.character_name}
              onChange={e => set('character_name', e.target.value)}
              placeholder="e.g. Frankie Moreau"
            />
          </div>
          <div className="st-form-group">
            <label>Season Label</label>
            <input
              value={form.season_label}
              onChange={e => set('season_label', e.target.value)}
              placeholder="e.g. Season 01"
            />
          </div>
          <div className="st-form-group">
            <label>Week Label</label>
            <input
              value={form.week_label}
              onChange={e => set('week_label', e.target.value)}
              placeholder="e.g. Week 6 Draft"
            />
          </div>
          <div className="st-form-group">
            <label>Title</label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Auto-filled from character name"
            />
          </div>
          <div className="st-form-group">
            <label>Subtitle</label>
            <input
              value={form.subtitle}
              onChange={e => set('subtitle', e.target.value)}
              placeholder="e.g. A Canonical Personality Reference"
            />
          </div>
          <div className="st-modal-actions">
            <button type="button" className="st-btn st-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="st-btn st-btn-gold">Create Book</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// Book Editor — The full PNOS Book Editor view
// ══════════════════════════════════════════════════

function BookEditor({ book, onBack, toast, onRefresh }) {
  const [chapters, setChapters] = useState(book.chapters || []);
  const [collapsed, setCollapsed] = useState({});
  const [activeRightTab, setActiveRightTab] = useState('memories');
  const [registryCharacters, setRegistryCharacters] = useState([]);

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
      .catch(() => { /* registry fetch optional */ });
  }, [book.show_id]);
  const [editingLine, setEditingLine] = useState(null);
  const [editText, setEditText] = useState('');
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterBadge, setNewChapterBadge] = useState('');
  const [addingLineTo, setAddingLineTo] = useState(null);
  const [newLineText, setNewLineText] = useState('');

  // Compute stats
  const allLines = chapters.flatMap(c => c.lines || []);
  const pendingCount = allLines.filter(l => l.status === 'pending').length;
  const approvedCount = allLines.filter(l => l.status === 'approved').length;
  const editedCount = allLines.filter(l => l.status === 'edited').length;

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
      // Refresh from server for accuracy
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
      setChapters(prev => [...prev, { ...data.chapter, lines: data.chapter.lines || [] }]);
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
      setChapters(prev => prev.filter(c => c.id !== chapterId));
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

  const toggleChapter = (id) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Render ─────────────────────────────────

  return (
    <div className="st-editor-layout">
    <div className="st-editor">
      {/* Compact top bar — title + stats + actions in one row */}
      <div className="st-editor-topbar">
        <button className="st-back-btn" onClick={onBack} title="Back to books">←</button>
        <div className="st-topbar-info">
          <h2>{book.character_name}</h2>
          <span className="st-topbar-sub">
            {book.subtitle || [book.season_label, book.week_label].filter(Boolean).join(' · ')}
          </span>
        </div>
        <div className="st-topbar-stats">
          <span className="st-stat">
            <span className="st-dot st-dot-pending" /> {pendingCount}
          </span>
          <span className="st-stat">
            <span className="st-dot st-dot-approved" /> {approvedCount}
          </span>
          <span className="st-stat">
            <span className="st-dot st-dot-edited" /> {editedCount}
          </span>
        </div>
        <div className="st-topbar-actions">
          <button className="st-btn st-btn-gold st-btn-sm" onClick={approveAll}>
            ✓ Approve All ({pendingCount})
          </button>
          <button
            className="st-btn st-btn-ghost st-btn-sm"
            onClick={() => setShowAddChapter(!showAddChapter)}
          >
            + Chapter
          </button>
        </div>
      </div>

      {/* Add chapter form */}
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
          <button className="st-btn st-btn-gold st-btn-sm" onClick={addChapter}>Add</button>
          <button className="st-btn st-btn-ghost st-btn-sm" onClick={() => setShowAddChapter(false)}>Cancel</button>
        </div>
      )}

      {/* Chapters */}
      {chapters.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty-icon">📝</span>
          <p>No chapters yet. Add one to get started.</p>
        </div>
      ) : (
        chapters.map((chapter) => {
          const isOpen = !collapsed[chapter.id];
          const lines = chapter.lines || [];

          // Group lines by group_label
          const groups = [];
          let currentGroup = null;
          for (const line of lines) {
            const label = line.group_label || '';
            if (!currentGroup || currentGroup.label !== label) {
              currentGroup = { label, lines: [] };
              groups.push(currentGroup);
            }
            currentGroup.lines.push(line);
          }

          return (
            <div key={chapter.id} id={`chapter-${chapter.id}`} className="st-chapter">
              <div className="st-chapter-header" onClick={() => toggleChapter(chapter.id)}>
                <span className={`st-chapter-toggle ${isOpen ? 'open' : ''}`}>▶</span>
                <span className="st-chapter-title">
                  Chapter {chapter.chapter_number}: {chapter.title}
                </span>
                {chapter.badge && (
                  <span className="st-chapter-badge">{chapter.badge}</span>
                )}
                <span className="st-chapter-count">
                  {lines.length} line{lines.length !== 1 ? 's' : ''}
                </span>
                <button
                  className="st-chapter-delete"
                  onClick={e => { e.stopPropagation(); deleteChapter(chapter.id); }}
                  title="Delete chapter"
                >
                  ✕
                </button>
              </div>

              {isOpen && (
                <div className="st-chapter-body">
                  {groups.map((group, gi) => (
                    <div key={gi} className="st-line-group">
                      {group.label && (
                        <div className="st-line-group-label">{group.label}</div>
                      )}
                      {group.lines.map((line) => (
                        <React.Fragment key={line.id}>
                        <div
                          className={`st-line ${editingLine === line.id ? 'st-line-editing' : ''}`}
                        >
                          <div className="st-line-dot">
                            <span className={`st-dot st-dot-${line.status}`} />
                          </div>

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
                                <div className="st-line-text">{line.text}</div>
                                <div className="st-line-meta">
                                  {(line.source_tags || []).map((tag, ti) => (
                                    <span key={ti} className="st-source-tag">{tag}</span>
                                  ))}
                                </div>
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
                                title="Reject / Remove"
                              >✕</button>
                            </div>
                          )}
                        </div>
                        {(line.status === 'approved' || line.status === 'edited') && (
                          <MemoryCard
                            lineId={line.id}
                            characters={registryCharacters}
                            onConfirmed={(memory) => {
                              toast(`Memory confirmed → ${memory.character?.display_name || 'Registry'}`);
                            }}
                            onDismissed={(memoryId) => {
                              // Optional: update local state if tracking dismissed count
                            }}
                          />
                        )}
                        </React.Fragment>
                      ))}
                    </div>
                  ))}

                  {/* Add line */}
                  {addingLineTo === chapter.id ? (
                    <div className="st-add-line">
                      <input
                        autoFocus
                        value={newLineText}
                        onChange={e => setNewLineText(e.target.value)}
                        placeholder="Enter line text…"
                        onKeyDown={e => {
                          if (e.key === 'Enter') addLine(chapter.id);
                          if (e.key === 'Escape') { setAddingLineTo(null); setNewLineText(''); }
                        }}
                      />
                      <button className="st-btn st-btn-gold st-btn-sm" onClick={() => addLine(chapter.id)}>Add</button>
                      <button className="st-btn st-btn-ghost st-btn-sm" onClick={() => { setAddingLineTo(null); setNewLineText(''); }}>Cancel</button>
                    </div>
                  ) : (
                    <button
                      className="st-btn st-btn-ghost st-btn-sm"
                      style={{ marginTop: 6 }}
                      onClick={() => { setAddingLineTo(chapter.id); setNewLineText(''); }}
                    >
                      + Add Line
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>

    {/* ── Right Panel ── */}
    <div className="st-right-panel">
      <div className="st-right-tabs">
        <button
          className={`st-right-tab ${activeRightTab === 'memories' ? 'active' : ''}`}
          onClick={() => setActiveRightTab('memories')}
        >
          Memory
        </button>
        <button
          className={`st-right-tab ${activeRightTab === 'toc' ? 'active' : ''}`}
          onClick={() => setActiveRightTab('toc')}
        >
          TOC
        </button>
        <button
          className={`st-right-tab ${activeRightTab === 'scenes' ? 'active' : ''}`}
          onClick={() => setActiveRightTab('scenes')}
        >
          Scenes
        </button>
      </div>
      {activeRightTab === 'memories' && <MemoryBankPanel bookId={book.id} />}
      {activeRightTab === 'toc' && (
        <TOCPanel
          book={book}
          chapters={chapters}
          onChapterClick={(chapterId) => {
            setCollapsed(prev => ({ ...prev, [chapterId]: false }));
            setTimeout(() => {
              document.getElementById(`chapter-${chapterId}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);
          }}
        />
      )}
      {activeRightTab === 'scenes' && (
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
