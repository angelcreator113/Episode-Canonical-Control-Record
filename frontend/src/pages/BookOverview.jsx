import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './BookOverview.css';

const API = '/api/v1/storyteller';

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export default function BookOverview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Editing state
  const [editingId, setEditingId] = useState(null);   // which chapter is being edited
  const [editFields, setEditFields] = useState({});     // edited field values
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // New chapter form
  const [showNewChapter, setShowNewChapter] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [addingChapter, setAddingChapter] = useState(false);
  const newTitleRef = useRef(null);

  // Drag reorder state
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // Book title editing
  const [editingBook, setEditingBook] = useState(false);
  const [bookTitle, setBookTitle] = useState('');
  const [bookDescription, setBookDescription] = useState('');

  // ── Load book & chapters ──
  const loadBook = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api(`/books/${id}`);
      const b = data.book || data;
      setBook(b);
      setBookTitle(b.title || '');
      setBookDescription(b.description || '');
      const chs = (b.chapters || []).sort(
        (a, b) => (a.sort_order ?? a.chapter_number) - (b.sort_order ?? b.chapter_number)
      );
      setChapters(chs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadBook(); }, [loadBook]);

  // ── Toast helper ──
  const flash = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // ── Save book metadata ──
  const saveBook = async () => {
    try {
      await api(`/books/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title: bookTitle, description: bookDescription }),
      });
      setBook(prev => ({ ...prev, title: bookTitle, description: bookDescription }));
      setEditingBook(false);
      flash('Book updated');
    } catch { flash('Failed to save', 'error'); }
  };

  // ── Add chapter ──
  const addChapter = async () => {
    if (!newTitle.trim()) return;
    try {
      setAddingChapter(true);
      const nextNum = chapters.length + 1;
      const data = await api(`/books/${id}/chapters`, {
        method: 'POST',
        body: JSON.stringify({
          chapter_number: nextNum,
          title: newTitle.trim(),
        }),
      });
      const newCh = data.chapter || data;
      setChapters(prev => [...prev, newCh]);
      setNewTitle('');
      setShowNewChapter(false);
      flash(`Chapter ${nextNum} added`);
    } catch { flash('Failed to add chapter', 'error'); }
    finally { setAddingChapter(false); }
  };

  // ── Delete chapter ──
  const deleteChapter = async (chId) => {
    if (!window.confirm('Delete this chapter? This cannot be undone.')) return;
    try {
      await api(`/chapters/${chId}`, { method: 'DELETE' });
      setChapters(prev => prev.filter(c => c.id !== chId));
      if (editingId === chId) setEditingId(null);
      flash('Chapter deleted');
    } catch { flash('Failed to delete', 'error'); }
  };

  // ── Start editing a chapter ──
  const startEdit = (ch) => {
    setEditingId(ch.id);
    setEditFields({
      title: ch.title || '',
      scene_goal: ch.scene_goal || '',
      theme: ch.theme || '',
      chapter_notes: ch.chapter_notes || '',
    });
  };

  // ── Save chapter edits ──
  const saveChapter = async () => {
    if (!editingId) return;
    try {
      setSaving(true);
      await api(`/chapters/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(editFields),
      });
      setChapters(prev => prev.map(c =>
        c.id === editingId ? { ...c, ...editFields } : c
      ));
      setEditingId(null);
      flash('Chapter saved');
    } catch { flash('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  // ── Drag-to-reorder ──
  const handleDragStart = (idx) => { setDragIdx(idx); };
  const handleDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDragEnd = async () => {
    if (dragIdx === null || dragOverIdx === null || dragIdx === dragOverIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const reordered = [...chapters];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dragOverIdx, 0, moved);

    // Update sort_order locally
    const updated = reordered.map((ch, i) => ({ ...ch, sort_order: i, chapter_number: i + 1 }));
    setChapters(updated);
    setDragIdx(null);
    setDragOverIdx(null);

    // Persist each chapter's new sort_order
    try {
      await Promise.all(updated.map(ch =>
        api(`/chapters/${ch.id}`, {
          method: 'PUT',
          body: JSON.stringify({ sort_order: ch.sort_order, chapter_number: ch.chapter_number }),
        })
      ));
      flash('Chapters reordered');
    } catch { flash('Reorder failed to save', 'error'); }
  };

  // ── Focus new chapter title input ──
  useEffect(() => {
    if (showNewChapter && newTitleRef.current) newTitleRef.current.focus();
  }, [showNewChapter]);

  // ── Render ──
  if (loading) {
    return (
      <div className="bo-root">
        <div className="bo-loading">Loading book\u2026</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="bo-root">
        <div className="bo-error">
          <div>{error}</div>
          <button onClick={() => navigate('/storyteller')}>{'\u2190'} Back to Archives</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bo-root">
      {/* ── Toast ── */}
      {toast && (
        <div className={`bo-toast bo-toast-${toast.type}`}>{toast.msg}</div>
      )}

      {/* ── Header ── */}
      <header className="bo-header">
        <button className="bo-back" onClick={() => navigate('/storyteller')}>
          {'\u2190'} Archives
        </button>

        {editingBook ? (
          <div className="bo-book-edit">
            <input
              className="bo-book-title-input"
              value={bookTitle}
              onChange={e => setBookTitle(e.target.value)}
              placeholder="Book title"
            />
            <textarea
              className="bo-book-desc-input"
              value={bookDescription}
              onChange={e => setBookDescription(e.target.value)}
              placeholder="A short description\u2026"
              rows={2}
            />
            <div className="bo-book-edit-actions">
              <button className="bo-btn bo-btn-gold" onClick={saveBook}>Save</button>
              <button className="bo-btn bo-btn-ghost" onClick={() => setEditingBook(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="bo-book-info" onClick={() => setEditingBook(true)}>
            <h1 className="bo-book-title">{book.title}</h1>
            {book.description && <p className="bo-book-desc">{book.description}</p>}
            <span className="bo-book-edit-hint">click to edit</span>
          </div>
        )}

        <div className="bo-header-meta">
          <span className="bo-chapter-count">{chapters.length} chapter{chapters.length !== 1 ? 's' : ''}</span>
          {book.status && <span className={`bo-status bo-status-${book.status}`}>{book.status}</span>}
        </div>
      </header>

      {/* ── Chapter List ── */}
      <div className="bo-chapter-list">
        {chapters.length === 0 && !showNewChapter && (
          <div className="bo-empty">
            <div className="bo-empty-icon">{'\uD83D\uDCD6'}</div>
            <div className="bo-empty-text">No chapters yet. Add your first chapter to begin.</div>
          </div>
        )}

        {chapters.map((ch, idx) => {
          const isEditing = editingId === ch.id;
          const isDragging = dragIdx === idx;
          const isDragOver = dragOverIdx === idx;
          const hasGoal = ch.scene_goal?.trim();
          const hasTheme = ch.theme?.trim();
          const hasNotes = ch.chapter_notes?.trim();
          const hasProse = ch.draft_prose?.trim();

          return (
            <div
              key={ch.id}
              className={`bo-chapter-card${isEditing ? ' editing' : ''}${isDragging ? ' dragging' : ''}${isDragOver ? ' drag-over' : ''}`}
              draggable={!isEditing}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
            >
              {/* Card Header */}
              <div className="bo-ch-header">
                <div className="bo-ch-drag-handle" title="Drag to reorder">{'\u2261'}</div>
                <span className="bo-ch-number">{ch.chapter_number || idx + 1}</span>

                {isEditing ? (
                  <input
                    className="bo-ch-title-input"
                    value={editFields.title}
                    onChange={e => setEditFields(f => ({ ...f, title: e.target.value }))}
                    placeholder="Chapter title"
                    autoFocus
                  />
                ) : (
                  <span className="bo-ch-title">{ch.title}</span>
                )}

                <div className="bo-ch-actions">
                  {!isEditing && (
                    <>
                      <button
                        className="bo-btn bo-btn-write"
                        onClick={() => navigate(`/write/${id}/${ch.id}`)}
                        title="Open in WriteMode"
                      >
                        {'\u270E'} Write
                      </button>
                      <button
                        className="bo-btn bo-btn-ghost bo-btn-sm"
                        onClick={() => startEdit(ch)}
                        title="Edit chapter details"
                      >
                        Edit
                      </button>
                      <button
                        className="bo-btn bo-btn-danger bo-btn-sm"
                        onClick={() => deleteChapter(ch.id)}
                        title="Delete chapter"
                      >
                        {'\u2715'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Tags / status pills */}
              {!isEditing && (
                <div className="bo-ch-tags">
                  {hasProse && <span className="bo-ch-tag bo-tag-prose">has prose</span>}
                  {hasGoal && <span className="bo-ch-tag bo-tag-goal">scene goal</span>}
                  {hasTheme && <span className="bo-ch-tag bo-tag-theme">theme</span>}
                  {hasNotes && <span className="bo-ch-tag bo-tag-notes">notes</span>}
                  {!hasProse && !hasGoal && !hasTheme && !hasNotes && (
                    <span className="bo-ch-tag bo-tag-empty">empty</span>
                  )}
                </div>
              )}

              {/* Quick preview (when not editing) */}
              {!isEditing && hasGoal && (
                <div className="bo-ch-preview">
                  <span className="bo-ch-preview-label">Goal:</span> {ch.scene_goal}
                </div>
              )}

              {/* Edit Form */}
              {isEditing && (
                <div className="bo-ch-edit-form">
                  <div className="bo-field">
                    <label className="bo-field-label">Scene Goal</label>
                    <textarea
                      className="bo-field-input"
                      value={editFields.scene_goal}
                      onChange={e => setEditFields(f => ({ ...f, scene_goal: e.target.value }))}
                      placeholder="What happens in this chapter? What does the character want?"
                      rows={2}
                    />
                  </div>
                  <div className="bo-field">
                    <label className="bo-field-label">Theme</label>
                    <input
                      className="bo-field-input"
                      value={editFields.theme}
                      onChange={e => setEditFields(f => ({ ...f, theme: e.target.value }))}
                      placeholder="e.g. invisibility, self-doubt, finding voice"
                    />
                  </div>
                  <div className="bo-field">
                    <label className="bo-field-label">Notes</label>
                    <textarea
                      className="bo-field-input"
                      value={editFields.chapter_notes}
                      onChange={e => setEditFields(f => ({ ...f, chapter_notes: e.target.value }))}
                      placeholder="Anything you want to remember about this chapter\u2026"
                      rows={3}
                    />
                  </div>
                  <div className="bo-ch-edit-actions">
                    <button className="bo-btn bo-btn-gold" onClick={saveChapter} disabled={saving}>
                      {saving ? 'Saving\u2026' : 'Save'}
                    </button>
                    <button className="bo-btn bo-btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* ── Add Chapter ── */}
        {showNewChapter ? (
          <div className="bo-new-chapter-form">
            <input
              ref={newTitleRef}
              className="bo-new-chapter-input"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder={`Chapter ${chapters.length + 1} title\u2026`}
              onKeyDown={e => {
                if (e.key === 'Enter' && newTitle.trim()) addChapter();
                if (e.key === 'Escape') { setShowNewChapter(false); setNewTitle(''); }
              }}
            />
            <div className="bo-new-chapter-actions">
              <button
                className="bo-btn bo-btn-gold"
                onClick={addChapter}
                disabled={!newTitle.trim() || addingChapter}
              >
                {addingChapter ? 'Adding\u2026' : 'Add Chapter'}
              </button>
              <button
                className="bo-btn bo-btn-ghost"
                onClick={() => { setShowNewChapter(false); setNewTitle(''); }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="bo-add-chapter-btn" onClick={() => setShowNewChapter(true)}>
            + Add Chapter
          </button>
        )}
      </div>
    </div>
  );
}
