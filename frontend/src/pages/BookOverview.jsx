import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

/* Planning-field completeness helper */
const PLAN_FIELDS = ['scene_goal', 'theme', 'chapter_notes', 'pov', 'emotional_state_start', 'emotional_state_end'];
function planScore(ch) {
  return PLAN_FIELDS.filter(f => ch[f]?.toString().trim()).length;
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

  // View mode: 'cards' | 'outline' | 'blueprint'
  const [viewMode, setViewMode] = useState('cards');

  // Blueprint inline editing
  const [blueprintEditId, setBlueprintEditId] = useState(null);
  const [blueprintEditField, setBlueprintEditField] = useState(null);
  const [blueprintEditValue, setBlueprintEditValue] = useState('');
  const blueprintInputRef = useRef(null);

  // Batch chapter planning
  const [showBatchAdd, setShowBatchAdd] = useState(false);
  const [batchTitles, setBatchTitles] = useState('');
  const [batchAdding, setBatchAdding] = useState(false);
  const batchRef = useRef(null);

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

  // ── Batch-add chapters (outline planner) ──
  const addBatchChapters = async () => {
    const titles = batchTitles.split('\n').map(t => t.trim()).filter(Boolean);
    if (titles.length === 0) return;
    try {
      setBatchAdding(true);
      const startNum = chapters.length + 1;
      const results = [];
      for (let i = 0; i < titles.length; i++) {
        const data = await api(`/books/${id}/chapters`, {
          method: 'POST',
          body: JSON.stringify({
            chapter_number: startNum + i,
            title: titles[i],
          }),
        });
        results.push(data.chapter || data);
      }
      setChapters(prev => [...prev, ...results]);
      setBatchTitles('');
      setShowBatchAdd(false);
      flash(`${results.length} chapter${results.length > 1 ? 's' : ''} added`);
    } catch { flash('Failed to add chapters', 'error'); }
    finally { setBatchAdding(false); }
  };

  // ── Focus batch textarea ──
  useEffect(() => {
    if (showBatchAdd && batchRef.current) batchRef.current.focus();
  }, [showBatchAdd]);

  // ── Outline stats ──
  const outlineStats = useMemo(() => {
    const planned = chapters.filter(ch => planScore(ch) >= 2).length;
    const withProse = chapters.filter(ch => ch.draft_prose?.trim()).length;
    return { total: chapters.length, planned, withProse };
  }, [chapters]);

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
      pov: ch.pov || 'first_person',
      emotional_state_start: ch.emotional_state_start || '',
      emotional_state_end: ch.emotional_state_end || '',
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

  // ── Focus blueprint inline edit ──
  useEffect(() => {
    if (blueprintEditId && blueprintInputRef.current) blueprintInputRef.current.focus();
  }, [blueprintEditId, blueprintEditField]);

  // ── Blueprint inline edit helpers ──
  const startBlueprintEdit = (ch, field) => {
    setBlueprintEditId(ch.id);
    setBlueprintEditField(field);
    setBlueprintEditValue(ch[field] || '');
  };

  const saveBlueprintEdit = async () => {
    if (!blueprintEditId || !blueprintEditField) return;
    try {
      await api(`/chapters/${blueprintEditId}`, {
        method: 'PUT',
        body: JSON.stringify({ [blueprintEditField]: blueprintEditValue }),
      });
      setChapters(prev => prev.map(c =>
        c.id === blueprintEditId ? { ...c, [blueprintEditField]: blueprintEditValue } : c
      ));
      flash('Saved');
    } catch { flash('Failed to save', 'error'); }
    finally {
      setBlueprintEditId(null);
      setBlueprintEditField(null);
    }
  };

  const cancelBlueprintEdit = () => {
    setBlueprintEditId(null);
    setBlueprintEditField(null);
    setBlueprintEditValue('');
  };

  // ── Export outline to clipboard ──
  const exportOutline = async () => {
    const lines = [];
    lines.push(`# ${book.title || 'Untitled Book'}`);
    if (book.description) lines.push(`\n> ${book.description}`);
    lines.push(`\n---\n`);
    lines.push(`**${chapters.length} Chapters** | ${outlineStats.planned} Planned | ${outlineStats.withProse} Written\n`);

    chapters.forEach((ch, idx) => {
      const num = ch.chapter_number || idx + 1;
      lines.push(`## Chapter ${num}: ${ch.title || 'Untitled'}`);
      lines.push('');
      if (ch.scene_goal) lines.push(`**Scene Goal:** ${ch.scene_goal}`);
      const parts = [];
      if (ch.theme) parts.push(`**Theme:** ${ch.theme}`);
      if (ch.pov) {
        const povLabel = { first_person: 'First Person', third_person_limited: 'Third Person Limited', third_person_omniscient: 'Third Person Omniscient', second_person: 'Second Person' };
        parts.push(`**POV:** ${povLabel[ch.pov] || ch.pov}`);
      }
      if (parts.length) lines.push(parts.join(' | '));
      if (ch.emotional_state_start || ch.emotional_state_end) {
        lines.push(`**Emotional Arc:** ${ch.emotional_state_start || '?'} \u2192 ${ch.emotional_state_end || '?'}`);
      }
      if (ch.chapter_notes) lines.push(`\n*Notes:* ${ch.chapter_notes}`);
      if (ch.draft_prose?.trim()) lines.push(`\n\u2713 *Has draft prose*`);
      lines.push('');
      lines.push('---\n');
    });

    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      flash('Outline copied to clipboard');
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      flash('Outline copied to clipboard');
    }
  };

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

          {/* View toggle */}
          <div className="bo-view-toggle">
            <button
              className={`bo-view-btn${viewMode === 'cards' ? ' active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Card view"
            >Cards</button>
            <button
              className={`bo-view-btn${viewMode === 'outline' ? ' active' : ''}`}
              onClick={() => setViewMode('outline')}
              title="Outline table"
            >Outline</button>
            <button
              className={`bo-view-btn${viewMode === 'blueprint' ? ' active' : ''}`}
              onClick={() => setViewMode('blueprint')}
              title="Manuscript blueprint"
            >Blueprint</button>
          </div>
          {chapters.length > 0 && (
            <button className="bo-export-btn" onClick={exportOutline} title="Copy outline to clipboard">
              Export
            </button>
          )}
        </div>

        {/* ── Outline Progress Bar ── */}
        {chapters.length > 0 && (
          <div className="bo-outline-stats">
            <div className="bo-stat-bar">
              <div
                className="bo-stat-fill bo-stat-planned"
                style={{ width: `${(outlineStats.planned / outlineStats.total) * 100}%` }}
              />
              <div
                className="bo-stat-fill bo-stat-written"
                style={{ width: `${(outlineStats.withProse / outlineStats.total) * 100}%` }}
              />
            </div>
            <div className="bo-stat-labels">
              <span className="bo-stat-label">{outlineStats.planned}/{outlineStats.total} planned</span>
              <span className="bo-stat-label">{outlineStats.withProse}/{outlineStats.total} written</span>
            </div>
          </div>
        )}
      </header>

      {/* ── Chapter List ── */}
      <div className="bo-chapter-list">
        {chapters.length === 0 && !showNewChapter && !showBatchAdd && (
          <div className="bo-empty">
            <div className="bo-empty-icon">{'\uD83D\uDCD6'}</div>
            <div className="bo-empty-text">No chapters yet. Plan your book outline or add your first chapter.</div>
          </div>
        )}

        {/* ───── OUTLINE VIEW ───── */}
        {viewMode === 'outline' && chapters.length > 0 && (
          <div className="bo-outline-table">
            <div className="bo-outline-header-row">
              <span className="bo-outline-col bo-ol-num">#</span>
              <span className="bo-outline-col bo-ol-title">Title</span>
              <span className="bo-outline-col bo-ol-goal">Scene Goal</span>
              <span className="bo-outline-col bo-ol-theme">Theme</span>
              <span className="bo-outline-col bo-ol-arc">Emotional Arc</span>
              <span className="bo-outline-col bo-ol-status">Status</span>
              <span className="bo-outline-col bo-ol-actions"></span>
            </div>
            {chapters.map((ch, idx) => {
              const score = planScore(ch);
              const hasProse = ch.draft_prose?.trim();
              return (
                <div
                  key={ch.id}
                  className={`bo-outline-row${editingId === ch.id ? ' editing' : ''}`}
                  draggable={editingId !== ch.id}
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                >
                  <span className="bo-outline-col bo-ol-num">{ch.chapter_number || idx + 1}</span>
                  <span className="bo-outline-col bo-ol-title" title={ch.title}>{ch.title}</span>
                  <span className="bo-outline-col bo-ol-goal" title={ch.scene_goal || ''}>
                    {ch.scene_goal ? ch.scene_goal.substring(0, 60) + (ch.scene_goal.length > 60 ? '\u2026' : '') : '\u2014'}
                  </span>
                  <span className="bo-outline-col bo-ol-theme">{ch.theme || '\u2014'}</span>
                  <span className="bo-outline-col bo-ol-arc">
                    {ch.emotional_state_start || ch.emotional_state_end
                      ? `${ch.emotional_state_start || '?'} \u2192 ${ch.emotional_state_end || '?'}`
                      : '\u2014'}
                  </span>
                  <span className="bo-outline-col bo-ol-status">
                    <span className={`bo-plan-dots`} title={`${score}/${PLAN_FIELDS.length} fields planned`}>
                      {PLAN_FIELDS.map((_, i) => (
                        <span key={i} className={`bo-plan-dot${i < score ? ' filled' : ''}`} />
                      ))}
                    </span>
                    {hasProse && <span className="bo-ol-written-badge">W</span>}
                  </span>
                  <span className="bo-outline-col bo-ol-actions">
                    <button className="bo-btn bo-btn-ghost bo-btn-sm" onClick={() => startEdit(ch)}>Plan</button>
                    <button className="bo-btn bo-btn-write bo-btn-sm" onClick={() => navigate(`/write/${id}/${ch.id}`)}>Write</button>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ───── BLUEPRINT VIEW ───── */}
        {viewMode === 'blueprint' && chapters.length > 0 && (
          <div className="bo-blueprint">
            <div className="bo-bp-title-block">
              <h2 className="bo-bp-doc-title">Manuscript Outline</h2>
              <p className="bo-bp-doc-subtitle">{book.title}</p>
              <div className="bo-bp-doc-stats">
                {chapters.length} chapters &middot; {outlineStats.planned} planned &middot; {outlineStats.withProse} with prose
              </div>
            </div>

            {chapters.map((ch, idx) => {
              const num = ch.chapter_number || idx + 1;
              const score = planScore(ch);
              const hasProse = ch.draft_prose?.trim();
              const isInlineEditing = blueprintEditId === ch.id;

              const renderField = (field, label, placeholder, isTextarea = false) => {
                const value = ch[field];
                const isEditingThis = isInlineEditing && blueprintEditField === field;

                if (isEditingThis) {
                  return (
                    <div className="bo-bp-field editing">
                      <span className="bo-bp-field-label">{label}</span>
                      {isTextarea ? (
                        <textarea
                          ref={blueprintInputRef}
                          className="bo-bp-inline-input"
                          value={blueprintEditValue}
                          onChange={e => setBlueprintEditValue(e.target.value)}
                          placeholder={placeholder}
                          rows={3}
                          onKeyDown={e => {
                            if (e.key === 'Escape') cancelBlueprintEdit();
                            if (e.key === 'Enter' && e.ctrlKey) saveBlueprintEdit();
                          }}
                        />
                      ) : (
                        <input
                          ref={blueprintInputRef}
                          className="bo-bp-inline-input"
                          value={blueprintEditValue}
                          onChange={e => setBlueprintEditValue(e.target.value)}
                          placeholder={placeholder}
                          onKeyDown={e => {
                            if (e.key === 'Escape') cancelBlueprintEdit();
                            if (e.key === 'Enter') saveBlueprintEdit();
                          }}
                        />
                      )}
                      <div className="bo-bp-inline-actions">
                        <button className="bo-btn bo-btn-gold bo-btn-sm" onClick={saveBlueprintEdit}>Save</button>
                        <button className="bo-btn bo-btn-ghost bo-btn-sm" onClick={cancelBlueprintEdit}>Cancel</button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    className={`bo-bp-field${value?.trim() ? '' : ' empty'}`}
                    onClick={() => startBlueprintEdit(ch, field)}
                    title="Click to edit"
                  >
                    <span className="bo-bp-field-label">{label}</span>
                    <span className="bo-bp-field-value">
                      {value?.trim() || <span className="bo-bp-placeholder">{placeholder}</span>}
                    </span>
                  </div>
                );
              };

              return (
                <div key={ch.id} className="bo-bp-chapter">
                  <div className="bo-bp-chapter-header">
                    <span className="bo-bp-chapter-num">Chapter {num}</span>
                    <h3 className="bo-bp-chapter-title"
                        onClick={() => startBlueprintEdit(ch, 'title')}
                        title="Click to edit title">
                      {isInlineEditing && blueprintEditField === 'title' ? (
                        <input
                          ref={blueprintInputRef}
                          className="bo-bp-inline-input bo-bp-title-input"
                          value={blueprintEditValue}
                          onChange={e => setBlueprintEditValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Escape') cancelBlueprintEdit();
                            if (e.key === 'Enter') saveBlueprintEdit();
                          }}
                        />
                      ) : (
                        ch.title || 'Untitled'
                      )}
                    </h3>
                    <div className="bo-bp-chapter-actions">
                      <span className="bo-bp-score" title={`${score}/${PLAN_FIELDS.length} fields`}>
                        {PLAN_FIELDS.map((_, i) => (
                          <span key={i} className={`bo-plan-dot${i < score ? ' filled' : ''}`} />
                        ))}
                      </span>
                      {hasProse && <span className="bo-bp-written">\u2713 Written</span>}
                      <button
                        className="bo-btn bo-btn-write bo-btn-sm"
                        onClick={() => navigate(`/write/${id}/${ch.id}`)}
                      >Write</button>
                    </div>
                  </div>

                  <div className="bo-bp-fields">
                    {renderField('scene_goal', 'Scene Goal', 'What happens in this chapter?', true)}

                    <div className="bo-bp-field-row">
                      {renderField('theme', 'Theme', 'e.g. invisibility, self-doubt')}
                      <div
                        className={`bo-bp-field${ch.pov?.trim() ? '' : ' empty'}`}
                        onClick={() => startBlueprintEdit(ch, 'pov')}
                        title="Click to edit"
                      >
                        <span className="bo-bp-field-label">POV</span>
                        {isInlineEditing && blueprintEditField === 'pov' ? (
                          <>
                            <select
                              ref={blueprintInputRef}
                              className="bo-bp-inline-input bo-field-select"
                              value={blueprintEditValue || 'first_person'}
                              onChange={e => setBlueprintEditValue(e.target.value)}
                            >
                              <option value="first_person">First Person</option>
                              <option value="third_person_limited">Third Person Limited</option>
                              <option value="third_person_omniscient">Third Person Omniscient</option>
                              <option value="second_person">Second Person</option>
                            </select>
                            <div className="bo-bp-inline-actions">
                              <button className="bo-btn bo-btn-gold bo-btn-sm" onClick={saveBlueprintEdit}>Save</button>
                              <button className="bo-btn bo-btn-ghost bo-btn-sm" onClick={cancelBlueprintEdit}>Cancel</button>
                            </div>
                          </>
                        ) : (
                          <span className="bo-bp-field-value">
                            {ch.pov ? { first_person: 'First Person', third_person_limited: '3rd Limited', third_person_omniscient: '3rd Omniscient', second_person: 'Second Person' }[ch.pov] || ch.pov : <span className="bo-bp-placeholder">Set POV</span>}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bo-bp-field-row">
                      {renderField('emotional_state_start', 'Emotional Start', 'e.g. hopeful, anxious')}
                      <span className="bo-bp-arc-arrow">\u2192</span>
                      {renderField('emotional_state_end', 'Emotional End', 'e.g. devastated, resolved')}
                    </div>

                    {renderField('chapter_notes', 'Notes', 'Anything to remember about this chapter\u2026', true)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ───── CARD VIEW ───── */}
        {viewMode === 'cards' && chapters.map((ch, idx) => {
          const isEditing = editingId === ch.id;
          const isDragging = dragIdx === idx;
          const isDragOver = dragOverIdx === idx;
          const hasGoal = ch.scene_goal?.trim();
          const hasTheme = ch.theme?.trim();
          const hasNotes = ch.chapter_notes?.trim();
          const hasProse = ch.draft_prose?.trim();
          const score = planScore(ch);

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
                  {score > 0 && (
                    <span className="bo-ch-tag bo-tag-plan">{score}/{PLAN_FIELDS.length} planned</span>
                  )}
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

              {/* Emotional arc preview */}
              {!isEditing && (ch.emotional_state_start || ch.emotional_state_end) && (
                <div className="bo-ch-preview">
                  <span className="bo-ch-preview-label">Arc:</span>{' '}
                  {ch.emotional_state_start || '?'} {'\u2192'} {ch.emotional_state_end || '?'}
                </div>
              )}

              {/* Edit Form (expanded) */}
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
                  <div className="bo-field-row">
                    <div className="bo-field bo-field-half">
                      <label className="bo-field-label">Theme</label>
                      <input
                        className="bo-field-input"
                        value={editFields.theme}
                        onChange={e => setEditFields(f => ({ ...f, theme: e.target.value }))}
                        placeholder="e.g. invisibility, self-doubt"
                      />
                    </div>
                    <div className="bo-field bo-field-half">
                      <label className="bo-field-label">POV</label>
                      <select
                        className="bo-field-input bo-field-select"
                        value={editFields.pov}
                        onChange={e => setEditFields(f => ({ ...f, pov: e.target.value }))}
                      >
                        <option value="first_person">First Person</option>
                        <option value="third_person_limited">Third Person Limited</option>
                        <option value="third_person_omniscient">Third Person Omniscient</option>
                        <option value="second_person">Second Person</option>
                      </select>
                    </div>
                  </div>
                  <div className="bo-field-row">
                    <div className="bo-field bo-field-half">
                      <label className="bo-field-label">Emotional Start</label>
                      <input
                        className="bo-field-input"
                        value={editFields.emotional_state_start}
                        onChange={e => setEditFields(f => ({ ...f, emotional_state_start: e.target.value }))}
                        placeholder="e.g. hopeful, anxious, numb"
                      />
                    </div>
                    <div className="bo-field bo-field-half">
                      <label className="bo-field-label">Emotional End</label>
                      <input
                        className="bo-field-input"
                        value={editFields.emotional_state_end}
                        onChange={e => setEditFields(f => ({ ...f, emotional_state_end: e.target.value }))}
                        placeholder="e.g. devastated, resolved"
                      />
                    </div>
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

        {/* ── Batch Chapter Planner ── */}
        {showBatchAdd && (
          <div className="bo-batch-form">
            <div className="bo-batch-header">
              <h3 className="bo-batch-title">Plan Your Chapters</h3>
              <p className="bo-batch-desc">Type one chapter title per line to scaffold your book outline.</p>
            </div>
            <textarea
              ref={batchRef}
              className="bo-batch-input"
              value={batchTitles}
              onChange={e => setBatchTitles(e.target.value)}
              placeholder={'Chapter 1: The Beginning\nChapter 2: Rising Action\nChapter 3: The Turning Point\nChapter 4: Climax\nChapter 5: Resolution'}
              rows={8}
              onKeyDown={e => {
                if (e.key === 'Escape') { setShowBatchAdd(false); setBatchTitles(''); }
              }}
            />
            <div className="bo-batch-footer">
              <span className="bo-batch-count">
                {batchTitles.split('\n').filter(t => t.trim()).length} chapter{batchTitles.split('\n').filter(t => t.trim()).length !== 1 ? 's' : ''}
              </span>
              <div className="bo-batch-actions">
                <button
                  className="bo-btn bo-btn-gold"
                  onClick={addBatchChapters}
                  disabled={!batchTitles.trim() || batchAdding}
                >
                  {batchAdding ? 'Creating\u2026' : 'Create All'}
                </button>
                <button className="bo-btn bo-btn-ghost" onClick={() => { setShowBatchAdd(false); setBatchTitles(''); }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Add Chapter Buttons ── */}
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
        ) : !showBatchAdd && (
          <div className="bo-add-buttons">
            <button className="bo-add-chapter-btn" onClick={() => setShowNewChapter(true)}>
              + Add Chapter
            </button>
            <button className="bo-add-chapter-btn bo-add-batch-btn" onClick={() => setShowBatchAdd(true)}>
              + Plan Multiple Chapters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
