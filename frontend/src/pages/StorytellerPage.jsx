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
import { MemoryCard, MEMORY_STYLES } from './MemoryConfirmation';
import MemoryBankView from './MemoryBankView';
import ChapterBrief from './ChapterBrief';
import SceneInterview from './SceneInterview';
import NarrativeIntelligence from './NarrativeIntelligence';
import ScenesPanel from './ScenesPanel';
import TOCPanel from './TOCPanel';
import NewBookModal from './NewBookModal';
import ImportDraftModal from './ImportDraftModal';

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

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function archiveState(book) {
  const pending = book.pending_count || 0;
  const edited = book.edited_count || 0;
  if (pending > 0) return { label: `${pending} Insight${pending > 1 ? 's' : ''} Awaiting Review`, tone: 'warm' };
  if (edited > 0) return { label: `${edited} Chapter${edited > 1 ? 's' : ''} Updated`, tone: 'active' };
  return { label: 'Archive Clean', tone: 'clean' };
}

function BookList({ books, onOpen, onDelete, onCreate }) {
  return (
    <div className="st-book-list">
      <div className="st-book-list-header">
        <div>
          <h1>StoryTeller</h1>
          <p className="st-book-list-subtitle">Curate evolving character archives and narrative intelligence.</p>
        </div>
      </div>

      <div className="st-book-grid">
        {books.map(book => {
          const state = archiveState(book);
          const totalLines = book.line_count || 0;
          const approved = book.approved_count || 0;
          const progress = totalLines > 0 ? Math.round((approved / totalLines) * 100) : 0;

          return (
            <div key={book.id} className="st-book-card" onClick={() => onOpen(book.id)}>
              <div className="st-card-top">
                <span className={`st-card-status st-tone-${state.tone}`}>{state.label}</span>
                {book.updated_at && (
                  <span className="st-card-age">{timeAgo(book.updated_at)}</span>
                )}
              </div>

              <h2 className="st-card-title">{book.title || book.character_name}</h2>
              <p className="st-card-sub">
                {[book.era_name, book.timeline_position, book.primary_pov].filter(Boolean).join(' · ') || book.subtitle || ''}
              </p>

              <div className="st-card-meta">
                <span>{book.chapter_count || 0} Chapter{(book.chapter_count || 0) !== 1 ? 's' : ''}</span>
                <span className="st-meta-sep">·</span>
                <span>{approved} Confirmed</span>
                {(book.pending_count || 0) > 0 && (
                  <>
                    <span className="st-meta-sep">·</span>
                    <span className="st-meta-pending">{book.pending_count} Pending</span>
                  </>
                )}
              </div>

              {/* Progress arc */}
              <div className="st-card-progress">
                <div className="st-card-progress-bar" style={{ width: `${progress}%` }} />
              </div>

              {book.recent_insight && (
                <p className="st-card-insight">"{book.recent_insight.length > 80 ? book.recent_insight.slice(0, 80) + '…' : book.recent_insight}"</p>
              )}

              <div className="st-card-foot">
                <span className="st-card-open">Open Archive →</span>
                <button
                  className="st-card-delete"
                  onClick={e => { e.stopPropagation(); onDelete(book.id); }}
                  title="Delete book"
                >✕</button>
              </div>
            </div>
          );
        })}

        {/* New Archive tile */}
        <div className="st-book-card st-card-new" onClick={onCreate}>
          <span className="st-card-new-icon">+</span>
          <span className="st-card-new-label">Create New Archive</span>
        </div>
      </div>

      {books.length === 0 && (
        <div className="st-empty">
          <p>No archives yet. Create your first to start curating narrative intelligence.</p>
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
  const [activeView, setActiveView] = useState('book'); // book | toc | memory | scenes
  const [registryCharacters, setRegistryCharacters] = useState([]);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [writingMode, setWritingMode] = useState(false);
  const [canonOpen, setCanonOpen] = useState(false);

  // Inject Memory keyframe styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = MEMORY_STYLES;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Fetch registry characters for ChapterBrief + MemoryCard confirm step
  useEffect(() => {
    fetch('/api/v1/character-registry/registries')
      .then(r => r.json())
      .then(data => {
        const chars = (data.registries?.flatMap(r => r.characters || []) || [])
          .map(c => ({ id: c.id, name: c.display_name || c.name || c.character_key, type: c.role_type || c.type }));
        setRegistryCharacters(chars);
      })
      .catch(() => {});
  }, []);

  const [editingLine, setEditingLine] = useState(null);
  const [editText, setEditText] = useState('');
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterBadge, setNewChapterBadge] = useState('');
  const [addingLineTo, setAddingLineTo] = useState(null);
  const [newLineText, setNewLineText] = useState('');
  const [importTarget, setImportTarget] = useState(null);
  const [interviewDone, setInterviewDone] = useState({});

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
      // Fire memory extraction in background (don't block approval)
      fetch(`/api/v1/memories/lines/${lineId}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character_context: `Book: ${book.title || book.character_name}` }),
      }).catch(() => {}); // silent — extraction is best-effort
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
      const newChaps = refreshed.book.chapters || [];
      setChapters(newChaps);
      // Fire memory extraction for all newly approved lines in background
      const approvedLineIds = [];
      for (const ch of newChaps) {
        for (const ln of (ch.lines || [])) {
          if (ln.status === 'approved') approvedLineIds.push(ln.id);
        }
      }
      approvedLineIds.forEach(lid => {
        fetch(`/api/v1/memories/lines/${lid}/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ character_context: `Book: ${book.title || book.character_name}` }),
        }).catch(() => {});
      });
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
      <div className={`st-line st-line-${line.status || 'pending'} ${editingLine === line.id ? 'st-line-editing' : ''}`}>
        <div className="st-line-dot" />
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
              <button className="st-line-action st-action-approve" onClick={() => approveLine(line.id)} title="Approve">✓ Approve</button>
            )}
            <button className="st-line-action st-action-edit" onClick={() => startEdit(line)} title="Edit">Edit</button>
            <button className="st-line-action st-action-reject" onClick={() => rejectLine(line.id)} title="Remove">✕</button>
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

  // ── Era detection for ambient theming ───────
  const eraSlug = (book.era_name || '').toLowerCase();
  const eraTheme = eraSlug.includes('pre-prime') || eraSlug.includes('before') || eraSlug.includes('pre prime')
    ? 'pre-prime'
    : eraSlug.includes('prime') || eraSlug.includes('peak') || eraSlug.includes('jewel')
      ? 'prime'
      : 'default';

  // ── Render ─────────────────────────────────

  return (
    <div
      className={`st-editor-layout ${writingMode ? 'st-writing-mode' : ''}`}
      data-era={eraTheme}
    >

      {/* ── Left Nav ── */}
      <nav className="st-nav">
        <div className="st-nav-brand">
          <button className="st-nav-back" onClick={onBack}>← Archives</button>
          <div className="st-nav-brand-label">PNOS</div>
          <h2 className="st-nav-brand-title">{book.character_name || book.title}</h2>
          <div className="st-nav-brand-sub">
            {[book.era_name, book.timeline_position].filter(Boolean).join(' · ') || book.subtitle || ''}
          </div>
        </div>

        <div className="st-nav-section">
          <div className="st-nav-section-label">Chapters</div>
          <div className="st-nav-chapters">
            {chapters.map((ch, i) => {
              const chLines = ch.lines || [];
              const chPending = chLines.filter(l => l.status === 'pending').length;
              const chApproved = chLines.filter(l => l.status === 'approved').length;
              const chEdited = chLines.filter(l => l.status === 'edited').length;
              return (
                <button
                  key={ch.id}
                  className={`st-nav-chapter ${ch.id === activeChapterId ? 'active' : ''}`}
                  onClick={() => setActiveChapterId(ch.id)}
                >
                  <span className="st-nav-num">
                    {String(ch.chapter_number || i + 1).padStart(2, '0')}
                  </span>
                  <div className="st-nav-chapter-info">
                    <div className="st-nav-chapter-title">{ch.title}</div>
                    <div className="st-nav-chapter-meta">
                      {chLines.length} line{chLines.length !== 1 ? 's' : ''}{ch.badge ? ` · ${ch.badge}` : ''}
                    </div>
                    <div className="st-nav-dots">
                      {Array(Math.min(chApproved, 5)).fill(null).map((_, di) => (
                        <div key={`a${di}`} className="st-cnav-dot st-cnav-dot-a" />
                      ))}
                      {Array(Math.min(chPending, 5)).fill(null).map((_, di) => (
                        <div key={`p${di}`} className="st-cnav-dot st-cnav-dot-p" />
                      ))}
                      {Array(Math.min(chEdited, 5)).fill(null).map((_, di) => (
                        <div key={`e${di}`} className="st-cnav-dot st-cnav-dot-e" />
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="st-nav-add">
            <button onClick={() => setShowAddChapter(!showAddChapter)}>
              + Add Chapter
            </button>
          </div>
        </div>

        <div className="st-nav-stats">
          <div className="st-nav-section-label">Book Progress</div>
          <div className="st-stat-row">
            <span className="st-stat-label">Pending</span>
            <span className="st-stat-val st-stat-pending">{allLines.filter(l => l.status === 'pending').length}</span>
          </div>
          <div className="st-stat-row">
            <span className="st-stat-label">Approved</span>
            <span className="st-stat-val st-stat-approved">{allLines.filter(l => l.status === 'approved').length}</span>
          </div>
          <div className="st-stat-row">
            <span className="st-stat-label">Edited</span>
            <span className="st-stat-val st-stat-edited">{allLines.filter(l => l.status === 'edited').length}</span>
          </div>
        </div>
      </nav>

      {/* ── Center Content ── */}
      <div className="st-editor">

        {/* ── Book Identity Panel (Crown) ── */}
        <div className="st-crown">
          <div className="st-crown-inner">
            <h1 className="st-crown-title">{book.title || book.character_name}</h1>
            <div className="st-crown-meta">
              {[book.era_name, book.timeline_position].filter(Boolean).length > 0 && (
                <span className="st-crown-era">
                  {[book.era_name, book.timeline_position].filter(Boolean).join(' · ')}
                </span>
              )}
              {book.primary_pov && (
                <span className="st-crown-pov">POV: {book.primary_pov}</span>
              )}
              {book.subtitle && (
                <span className="st-crown-theme">{book.subtitle}</span>
              )}
            </div>
            <div className="st-crown-divider" />
          </div>

          {/* Top toolbar */}
          <div className="st-toolbar">
            <div className="st-toolbar-left">
              {['toc', 'book', 'memory', 'scenes'].map(v => (
                <button
                  key={v}
                  className={`st-view-tab ${activeView === v ? 'active' : ''}`}
                  onClick={() => setActiveView(v)}
                >
                  {v === 'book' ? 'Manuscript' : v === 'toc' ? 'TOC' : v === 'memory' ? 'Memory Bank' : 'Scenes'}
                </button>
              ))}
            </div>
            <div className="st-toolbar-right">
              <button
                className={`st-mode-toggle ${writingMode ? 'active' : ''}`}
                onClick={() => setWritingMode(w => !w)}
                title={writingMode ? 'Exit Writing Mode' : 'Enter Writing Mode'}
              >
                {writingMode ? '◉ Writing Mode' : '○ Enter Writing Mode'}
              </button>
              {activeView === 'book' && !writingMode && (
                <button
                  className="st-canon-toggle"
                  onClick={() => setCanonOpen(c => !c)}
                  title="Canon Anchor"
                >
                  📜
                </button>
              )}
            </div>
          </div>
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

        {/* ── Book / Manuscript View ── */}
        {activeView === 'book' && (
          <div className="st-manuscript-wrapper">
            <div className="st-manuscript">
              {!activeChapter ? (
                <div className="st-no-selection">
                  {chapters.length === 0
                    ? 'Add a chapter to begin writing.'
                    : 'Select a chapter from the left.'}
                </div>
              ) : (
                <>
                  {/* Chapter header bar */}
                  <div className="st-chapter-bar">
                    <span className="st-ch-num">
                      Chapter {String(activeChapter.chapter_number || (chapters.indexOf(activeChapter) + 1)).padStart(2, '0')}
                    </span>
                    <span className="st-ch-title">{activeChapter.title}</span>
                    {activeChapter.badge && (
                      <span className="st-ch-badge">{activeChapter.badge}</span>
                    )}
                    <span className={`st-ch-status ${pendingLines.length === 0 ? 'all-approved' : 'has-pending'}`}>
                      {pendingLines.length === 0 ? 'Complete' : `${pendingLines.length} pending`}
                    </span>
                    <button
                      className="st-import-btn"
                      onClick={() => setImportTarget(activeChapter.id)}
                      title="Import draft lines"
                    >
                      Import
                    </button>
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

                  {/* Scene Interview — auto-pops when chapter has no lines */}
                  {(activeChapter.lines || []).length === 0 && !interviewDone[activeChapter.id] && (
                    <SceneInterview
                      chapter={activeChapter}
                      book={book}
                      characters={registryCharacters}
                      onComplete={(brief) => {
                        setChapters(prev => prev.map(c =>
                          c.id === activeChapter.id ? { ...c, ...brief } : c
                        ));
                        setInterviewDone(prev => ({ ...prev, [activeChapter.id]: true }));
                      }}
                      onSkip={() => setInterviewDone(prev => ({
                        ...prev, [activeChapter.id]: true
                      }))}
                    />
                  )}

                  {/* Chapter Brief — writing context above lines */}
                  <ChapterBrief
                    chapter={activeChapter}
                    characters={registryCharacters}
                    onUpdated={(updated) => {
                      setChapters(prev => prev.map(c =>
                        c.id === updated.id ? { ...updated, lines: c.lines } : c
                      ));
                    }}
                  />

                  {/* Book page content */}
                  <div className="st-book-page">
                    {/* Approved / edited lines — the manuscript body */}
                    {approvedLines.length > 0 && (
                      <div className="st-section">
                        {(() => {
                          let niIdx = 0;
                          return groupLines(approvedLines).map((group, gi) => (
                            <div key={gi}>
                              {group.label && (
                                <div className="st-group-label">{group.label}</div>
                              )}
                              {group.lines.map(line => {
                                const idx = niIdx++;
                                return (
                                  <React.Fragment key={`ni-${line.id}`}>
                                    {renderLine(line)}
                                    {(idx + 1) % 5 === 0 && idx < approvedLines.length - 1 && (
                                      <NarrativeIntelligence
                                        chapter={activeChapter}
                                        lines={approvedLines}
                                        lineIndex={idx}
                                        book={book}
                                        characters={registryCharacters}
                                        onAccept={(newLine) => {
                                          setChapters(prev => prev.map(c =>
                                            c.id === activeChapter.id
                                              ? { ...c, lines: [...c.lines, newLine] }
                                              : c
                                          ));
                                        }}
                                      />
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          ));
                        })()}
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
                                  <div className="st-group-label">{group.label}</div>
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

                    {/* Action bar */}
                    <div className="st-action-bar">
                      <span className="st-action-hint">
                        {pendingLines.length === 0
                          ? 'Chapter complete ✓'
                          : `${pendingLines.length} item${pendingLines.length !== 1 ? 's' : ''} awaiting review`}
                      </span>
                      <div className="st-action-bar-btns">
                        {pendingCount > 0 && (
                          <button className="st-btn st-btn-gold st-btn-sm" onClick={approveAll}>
                            Approve All ({pendingCount})
                          </button>
                        )}
                        <button className="st-btn st-btn-ghost st-btn-sm" onClick={onRefresh}>
                          Compile Book ↗
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ── Canon Anchor Panel (right side, collapsible) ── */}
            {canonOpen && !writingMode && (
              <aside className="st-canon-panel">
                <div className="st-canon-header">
                  <span>📜 Canon Anchor</span>
                  <button className="st-canon-close" onClick={() => setCanonOpen(false)}>✕</button>
                </div>
                <div className="st-canon-body">
                  {book.era_name && (
                    <div className="st-canon-row">
                      <span className="st-canon-label">Era</span>
                      <span className="st-canon-value">{book.era_name}</span>
                    </div>
                  )}
                  {book.era_description && (
                    <div className="st-canon-row">
                      <span className="st-canon-label">Era Rule</span>
                      <span className="st-canon-value">{book.era_description}</span>
                    </div>
                  )}
                  {book.primary_pov && (
                    <div className="st-canon-row">
                      <span className="st-canon-label">POV</span>
                      <span className="st-canon-value">{book.primary_pov}</span>
                    </div>
                  )}
                  {book.subtitle && (
                    <div className="st-canon-row">
                      <span className="st-canon-label">Theme</span>
                      <span className="st-canon-value">{book.subtitle}</span>
                    </div>
                  )}
                  {book.description && (
                    <div className="st-canon-row">
                      <span className="st-canon-label">Narrative Function</span>
                      <span className="st-canon-value">{book.description}</span>
                    </div>
                  )}
                  <div className="st-canon-row">
                    <span className="st-canon-label">Canon Status</span>
                    <span className="st-canon-value">{book.canon_status || book.status || 'draft'}</span>
                  </div>
                  <div className="st-canon-row">
                    <span className="st-canon-label">Chapters</span>
                    <span className="st-canon-value">{chapters.length}</span>
                  </div>
                  <div className="st-canon-row">
                    <span className="st-canon-label">Total Lines</span>
                    <span className="st-canon-value">{allLines.length}</span>
                  </div>
                </div>
              </aside>
            )}
          </div>
        )}

        {/* ── TOC View ── */}
        {activeView === 'toc' && (
          <TOCPanel
            book={book}
            chapters={chapters}
            onChapterClick={(chId) => {
              setActiveChapterId(chId);
              setActiveView('book');
            }}
          />
        )}

        {/* ── Memory View ── */}
        {activeView === 'memory' && (
          <MemoryBankView bookId={book.id} showId={book.show_id} />
        )}

        {/* ── Scenes View ── */}
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

        {/* ── Import Draft Modal ── */}
        <ImportDraftModal
          chapterId={importTarget}
          chapterTitle={chapters.find(c => c.id === importTarget)?.title}
          open={!!importTarget}
          onClose={() => setImportTarget(null)}
          onImported={(lines) => {
            setChapters(prev => prev.map(c =>
              c.id === importTarget
                ? { ...c, lines: [...(c.lines || []), ...lines] }
                : c
            ));
            setImportTarget(null);
            toast(`Lines imported successfully`);
          }}
        />
      </div>
    </div>
  );
}
