/**
 * SectionEditor.jsx — Manage sections for a chapter
 *
 * Add, edit, delete, reorder sections (scene / beat / transition / body).
 *
 * Extracted from StorytellerPage.jsx for maintainability.
 */
import React, { useState, useEffect } from 'react';
import { authHeader } from '../utils/storytellerApi';

const SECTION_TYPES = [
  { value: 'scene', label: 'Scene', dot: '🟢' },
  { value: 'beat', label: 'Beat', dot: '🔵' },
  { value: 'transition', label: 'Transition', dot: '🟡' },
  { value: 'body', label: 'Body', dot: '⚪' },
];

export default function SectionEditor({ chapter, onSave, onGoToSection, toast }) {
  const [sections, setSections] = useState(() =>
    Array.isArray(chapter?.sections) ? chapter.sections.map((s, i) => ({ ...s, _key: s.id || `sec-${i}` })) : []
  );
  const [editIdx, setEditIdx] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editType, setEditType] = useState('body');
  const [editDesc, setEditDesc] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState('scene');
  const [saving, setSaving] = useState(false);

  // Reset when chapter changes
  useEffect(() => {
    setSections(
      Array.isArray(chapter?.sections) ? chapter.sections.map((s, i) => ({ ...s, _key: s.id || `sec-${i}` })) : []
    );
    setEditIdx(null);
    setAddOpen(false);
  }, [chapter?.id]);

  const save = async (updated) => {
    setSaving(true);
    try {
      const cleaned = updated.map(({ _key, ...rest }) => rest);
      await fetch(`/api/v1/storyteller/chapters/${chapter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ sections: cleaned }),
      });
      onSave?.(cleaned);
      toast.add('Sections saved');
    } catch {
      toast.add('Failed to save sections', 'error');
    }
    setSaving(false);
  };

  const addSection = () => {
    if (!newContent.trim()) return;
    const sec = {
      _key: `sec-${Date.now()}`,
      type: 'h3',
      content: newContent.trim(),
      meta: { section_type: newType, description: '' },
    };
    const next = [...sections, sec];
    setSections(next);
    save(next);
    setNewContent('');
    setAddOpen(false);
  };

  const startEdit = (i) => {
    const s = sections[i];
    setEditIdx(i);
    setEditContent(s.content || '');
    setEditType(s.meta?.section_type || s.type || 'body');
    setEditDesc(s.meta?.description || '');
  };

  const saveEdit = () => {
    if (editIdx === null) return;
    const next = sections.map((s, i) =>
      i === editIdx
        ? { ...s, content: editContent, meta: { ...s.meta, section_type: editType, description: editDesc } }
        : s
    );
    setSections(next);
    save(next);
    setEditIdx(null);
  };

  const deleteSection = (i) => {
    const next = sections.filter((_, idx) => idx !== i);
    setSections(next);
    save(next);
  };

  const moveSection = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    setSections(next);
    save(next);
  };

  const typeLabel = (t) => SECTION_TYPES.find(st => st.value === t)?.label || t;
  const typeDot = (t) => SECTION_TYPES.find(st => st.value === t)?.dot || '⚪';

  return (
    <div className="st-section-editor">
      <div className="st-section-editor-header">
        <h2 className="st-section-editor-title">Sections — {chapter?.title || 'Untitled'}</h2>
        <p className="st-section-editor-sub">Break this chapter into scenes, beats, and transitions.</p>
      </div>

      {sections.length === 0 && !addOpen && (
        <div className="st-section-editor-empty">
          <p>No sections yet. Add your first section to structure this chapter.</p>
        </div>
      )}

      <div className="st-section-list">
        {sections.map((sec, i) => (
          <div key={sec._key} className={`st-section-item${editIdx === i ? ' editing' : ''}`}>
            {editIdx === i ? (
              <div className="st-section-edit-form">
                <input
                  className="st-section-edit-input"
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  placeholder="Section title…"
                  autoFocus
                />
                <select className="st-section-edit-select" value={editType} onChange={e => setEditType(e.target.value)}>
                  {SECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.dot} {t.label}</option>)}
                </select>
                <textarea
                  className="st-section-edit-desc"
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  placeholder="Description / notes (optional)…"
                  rows={2}
                />
                <div className="st-section-edit-actions">
                  <button className="st-section-btn-save" onClick={saveEdit}>Save</button>
                  <button className="st-section-btn-cancel" onClick={() => setEditIdx(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="st-section-row">
                <span className="st-section-dot">{typeDot(sec.meta?.section_type || sec.type)}</span>
                <div className="st-section-body" style={{ cursor: 'pointer' }} onClick={() => onGoToSection?.(sec.content || `Section ${i + 1}`)}>
                  <span className="st-section-name">{sec.content || 'Untitled section'}</span>
                  <span className="st-section-type-label">{typeLabel(sec.meta?.section_type || sec.type)}</span>
                  {sec.meta?.description && <span className="st-section-desc">{sec.meta.description}</span>}
                  <span className="st-section-write-hint">Click to write →</span>
                </div>
                <div className="st-section-actions">
                  <button onClick={() => moveSection(i, -1)} disabled={i === 0} title="Move up">↑</button>
                  <button onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1} title="Move down">↓</button>
                  <button onClick={() => startEdit(i)} title="Edit">✎</button>
                  <button onClick={() => deleteSection(i)} title="Delete" className="st-section-delete">×</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {addOpen ? (
        <div className="st-section-add-form">
          <input
            className="st-section-add-input"
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="Section title…"
            onKeyDown={e => e.key === 'Enter' && addSection()}
            autoFocus
          />
          <select className="st-section-add-select" value={newType} onChange={e => setNewType(e.target.value)}>
            {SECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.dot} {t.label}</option>)}
          </select>
          <button className="st-section-btn-save" onClick={addSection}>Add</button>
          <button className="st-section-btn-cancel" onClick={() => { setAddOpen(false); setNewContent(''); }}>Cancel</button>
        </div>
      ) : (
        <button className="st-section-add-btn" onClick={() => setAddOpen(true)}>
          + Add Section
        </button>
      )}

      {saving && <div className="st-section-saving">Saving…</div>}
    </div>
  );
}
