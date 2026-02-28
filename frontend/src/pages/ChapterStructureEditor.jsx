/**
 * ChapterStructureEditor.jsx
 * frontend/src/pages/ChapterStructureEditor.jsx
 *
 * Structured writing editor with visual hierarchy.
 * Text styles: H1 (Book Title), H2 (Chapter Title), H3 (Section Header),
 *              H4 (Subsection), Body, Quote, Reflection, Divider
 * Features: Collapsible sections, auto-generated TOC, chapter templates
 *
 * ROUTE: /chapter-structure/:bookId/:chapterId
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './ChapterStructureEditor.css';

const API = '/api/v1/storyteller';

/* ── Helpers ── */
function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/* ── Section Types ── */
const SECTION_TYPES = [
  { type: 'h1',         label: 'Book Title',       shortcut: 'H1', placeholder: 'Book title…' },
  { type: 'h2',         label: 'Chapter Title',    shortcut: 'H2', placeholder: 'Chapter title…' },
  { type: 'h3',         label: 'Section Header',   shortcut: 'H3', placeholder: 'Section header…' },
  { type: 'h4',         label: 'Subsection',       shortcut: 'H4', placeholder: 'Subsection…' },
  { type: 'body',       label: 'Body Text',        shortcut: 'P',  placeholder: 'Write your prose…' },
  { type: 'quote',      label: 'Quote / Epigraph', shortcut: 'Q',  placeholder: 'A quote or reflection…' },
  { type: 'reflection', label: 'Reflection Prompt', shortcut: 'R', placeholder: 'A question to explore…' },
  { type: 'divider',    label: 'Divider',          shortcut: '─', placeholder: '' },
];

const HEADER_TYPES = ['h1', 'h2', 'h3', 'h4'];

/* ── Chapter Templates ── */
const CHAPTER_TEMPLATES = {
  standard: {
    name: 'Standard Chapter',
    desc: 'Chapter goal, theme, emotional arc, sections, and reflection.',
    sections: [
      { type: 'h2', content: 'Chapter Title' },
      { type: 'h4', content: 'Chapter Goal' },
      { type: 'body', content: '' },
      { type: 'h4', content: 'Theme' },
      { type: 'body', content: '' },
      { type: 'h4', content: 'Emotional Arc' },
      { type: 'body', content: '' },
      { type: 'divider', content: '' },
      { type: 'h3', content: 'Section 1' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'Section 2' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'Section 3' },
      { type: 'body', content: '' },
      { type: 'divider', content: '' },
      { type: 'h4', content: 'Reflection Prompts' },
      { type: 'reflection', content: 'What did this chapter reveal?' },
    ],
  },
  memoir_chapter: {
    name: 'Memoir Chapter',
    desc: 'Personal narrative with sensory detail, reflection, and insight.',
    sections: [
      { type: 'h2', content: 'Chapter Title' },
      { type: 'quote', content: '' },
      { type: 'h3', content: 'The Scene' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'What I Felt' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'What I Know Now' },
      { type: 'body', content: '' },
      { type: 'divider', content: '' },
      { type: 'reflection', content: 'What did you learn from this moment?' },
    ],
  },
  creative_essay: {
    name: 'Creative Essay',
    desc: 'Thesis, exploration, counterpoint, and synthesis.',
    sections: [
      { type: 'h2', content: 'Essay Title' },
      { type: 'h3', content: 'Opening Hook' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'The Idea' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'The Counterpoint' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'Synthesis' },
      { type: 'body', content: '' },
      { type: 'quote', content: '' },
    ],
  },
  adventure_chapter: {
    name: 'Adventure Chapter',
    desc: 'Style-forward chapter with look breakdown, styling notes, and world-building.',
    sections: [
      { type: 'h2', content: 'Chapter Title' },
      { type: 'h4', content: 'The Look' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'The Setup' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'The Adventure' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'The Lesson' },
      { type: 'body', content: '' },
      { type: 'h4', content: 'Styling Notes' },
      { type: 'body', content: '' },
      { type: 'divider', content: '' },
      { type: 'reflection', content: 'What style truth did Lala discover?' },
    ],
  },
  minimal: {
    name: 'Blank Canvas',
    desc: 'Just a title and body. Build your own structure.',
    sections: [
      { type: 'h2', content: '' },
      { type: 'body', content: '' },
    ],
  },
};


/* ════════════════════════════════════════════════════════════════════════ */
/* MAIN COMPONENT                                                         */
/* ════════════════════════════════════════════════════════════════════════ */

export default function ChapterStructureEditor() {
  const { bookId, chapterId } = useParams();
  const navigate = useNavigate();

  // Data state
  const [book, setBook]           = useState(null);
  const [chapter, setChapter]     = useState(null);
  const [sections, setSections]   = useState([]);
  const [loading, setLoading]     = useState(true);

  // UI state
  const [toast, setToast]             = useState(null);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(true);
  const [focusedId, setFocusedId]     = useState(null);
  const [typeMenuId, setTypeMenuId]   = useState(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState(new Set());

  // Refs
  const autoSaveRef = useRef(null);
  const sectionRefs = useRef({});
  const editorRef   = useRef(null);

  // ── Load book + chapter data ──────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/books/${bookId}`);
        const data = await res.json();
        const bookData = data?.book || data;
        setBook(bookData);

        const ch = bookData.chapters?.find(c => c.id === chapterId);
        if (ch) {
          setChapter(ch);
          if (ch.sections && Array.isArray(ch.sections) && ch.sections.length > 0) {
            // Ensure each section has an id
            const withIds = ch.sections.map(s => ({ ...s, id: s.id || uuid() }));
            setSections(withIds);
          } else {
            // No sections yet — offer template or start empty
            setSections([]);
          }
        } else {
          setChapter({ id: chapterId, title: 'Untitled Chapter' });
        }
      } catch (err) {
        console.error('Load failed:', err);
        flash('Failed to load chapter', 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [bookId, chapterId]);

  // ── Auto-save (debounced) ─────────────────────────────────────────────

  const saveSections = useCallback(async (data) => {
    if (!chapterId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/chapters/${chapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: data }),
      });
      if (!res.ok) throw new Error(`Save failed ${res.status}`);
      setSaved(true);
      setSaving(false);
    } catch (err) {
      console.error('Save error:', err);
      flash('Save failed', 'error');
      setSaving(false);
    }
  }, [chapterId]);

  // Trigger auto-save on section changes
  useEffect(() => {
    if (loading || sections.length === 0) return;
    setSaved(false);
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => saveSections(sections), 2000);
    return () => clearTimeout(autoSaveRef.current);
  }, [sections, loading, saveSections]);

  // ── Toast helper ──────────────────────────────────────────────────────

  function flash(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Section operations ────────────────────────────────────────────────

  const addSection = useCallback((type = 'body', afterId = null) => {
    const newSection = { id: uuid(), type, content: '', collapsed: false };
    setSections(prev => {
      if (afterId) {
        const idx = prev.findIndex(s => s.id === afterId);
        if (idx >= 0) {
          const copy = [...prev];
          copy.splice(idx + 1, 0, newSection);
          return copy;
        }
      }
      return [...prev, newSection];
    });
    // Focus the new section after render
    setTimeout(() => {
      const el = sectionRefs.current[newSection.id];
      if (el) el.focus();
    }, 50);
    return newSection.id;
  }, []);

  const updateSection = useCallback((id, updates) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const deleteSection = useCallback((id) => {
    setSections(prev => prev.filter(s => s.id !== id));
    setFocusedId(null);
  }, []);

  const moveSection = useCallback((id, direction) => {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  }, []);

  const changeType = useCallback((id, newType) => {
    updateSection(id, { type: newType });
    setTypeMenuId(null);
  }, [updateSection]);

  // ── Toggle collapse ──────────────────────────────────────────────────

  const toggleCollapse = useCallback((id) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // ── Apply template ───────────────────────────────────────────────────

  const applyTemplate = useCallback((templateKey) => {
    const tpl = CHAPTER_TEMPLATES[templateKey];
    if (!tpl) return;
    const newSections = tpl.sections.map(s => ({
      id: uuid(),
      type: s.type,
      content: s.content || '',
      collapsed: false,
    }));
    setSections(newSections);
    setShowTemplate(false);
    flash(`Applied "${tpl.name}" template`);
  }, []);

  // ── Keyboard handler ─────────────────────────────────────────────────

  const handleKeyDown = useCallback((e, section) => {
    // Enter on a header or body: add a new body block below
    if (e.key === 'Enter' && !e.shiftKey && section.type !== 'body') {
      e.preventDefault();
      addSection('body', section.id);
    }
    // Backspace on empty block: delete it
    if (e.key === 'Backspace' && !section.content && sections.length > 1) {
      e.preventDefault();
      const idx = sections.findIndex(s => s.id === section.id);
      const prevId = idx > 0 ? sections[idx - 1].id : null;
      deleteSection(section.id);
      if (prevId) {
        setTimeout(() => {
          const el = sectionRefs.current[prevId];
          if (el) el.focus();
        }, 50);
      }
    }
  }, [addSection, deleteSection, sections]);

  // ── Compute TOC ──────────────────────────────────────────────────────

  const tocItems = useMemo(() => {
    return sections
      .filter(s => HEADER_TYPES.includes(s.type))
      .map(s => ({
        id: s.id,
        type: s.type,
        content: s.content || `Untitled ${s.type.toUpperCase()}`,
      }));
  }, [sections]);

  // ── Compute which sections are hidden (collapsed under a header) ─────

  const hiddenIds = useMemo(() => {
    const hidden = new Set();
    let currentCollapsedLevel = null;

    for (const s of sections) {
      const isHeader = HEADER_TYPES.includes(s.type);
      const level = isHeader ? HEADER_TYPES.indexOf(s.type) : 999;

      if (currentCollapsedLevel !== null) {
        // If we hit a header at same or higher level, stop collapsing
        if (isHeader && level <= currentCollapsedLevel) {
          currentCollapsedLevel = null;
        } else {
          hidden.add(s.id);
          continue;
        }
      }

      if (isHeader && collapsedIds.has(s.id)) {
        currentCollapsedLevel = level;
      }
    }
    return hidden;
  }, [sections, collapsedIds]);

  // ── Count children for collapse badge ────────────────────────────────

  const childCount = useCallback((headerId) => {
    const idx = sections.findIndex(s => s.id === headerId);
    if (idx < 0) return 0;
    const headerLevel = HEADER_TYPES.indexOf(sections[idx].type);
    let count = 0;
    for (let i = idx + 1; i < sections.length; i++) {
      const s = sections[i];
      const isHeader = HEADER_TYPES.includes(s.type);
      if (isHeader && HEADER_TYPES.indexOf(s.type) <= headerLevel) break;
      count++;
    }
    return count;
  }, [sections]);

  // ── Word count ───────────────────────────────────────────────────────

  const wordCount = useMemo(() => {
    return sections
      .filter(s => ['body', 'quote', 'reflection'].includes(s.type))
      .reduce((sum, s) => sum + (s.content || '').split(/\s+/).filter(Boolean).length, 0);
  }, [sections]);

  // ── Scroll to TOC item ───────────────────────────────────────────────

  const scrollToSection = useCallback((id) => {
    // Make sure it's not hidden
    setCollapsedIds(prev => {
      const next = new Set(prev);
      // Uncollapse any parent header that hides this section
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].id === id) break;
        if (HEADER_TYPES.includes(sections[i].type) && next.has(sections[i].id)) {
          next.delete(sections[i].id);
        }
      }
      return next;
    });

    setTimeout(() => {
      const el = sectionRefs.current[id];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setFocusedId(id);
      }
    }, 100);
  }, [sections]);

  // ── Textarea auto-resize ─────────────────────────────────────────────

  const autoResize = useCallback((el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="cse-loading">Loading chapter structure…</div>;
  }

  const chapterTitle = chapter?.title || 'Untitled';
  const bookTitle = book?.title || 'Book';

  return (
    <div className="cse-root">
      {/* Toast */}
      {toast && (
        <div className={`cse-toast cse-toast-${toast.type}`}>{toast.msg}</div>
      )}

      {/* ── Header ── */}
      <header className="cse-header">
        <button className="cse-back-btn" onClick={() => navigate(`/book/${bookId}`)}>
          &larr; Back
        </button>
        <div className="cse-header-info">
          <h1>{chapterTitle} &mdash; Structure</h1>
          <div className="cse-breadcrumb">{bookTitle} / Ch. {chapter?.chapter_number || '?'}</div>
        </div>
        <div className="cse-header-actions">
          <span className={`cse-save-status ${saving ? 'saving' : saved ? 'saved' : ''}`}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Unsaved'}
          </span>
          <button
            className="cse-add-btn"
            onClick={() => navigate(`/chapter/${bookId}/${chapterId}`)}
          >
            Write Mode
          </button>
          <button className="cse-add-btn primary" onClick={() => setShowTemplate(true)}>
            Templates
          </button>
        </div>
      </header>

      {/* ── Layout ── */}
      <div className="cse-layout">
        {/* TOC Sidebar */}
        <nav className="cse-toc">
          <div className="cse-toc-title">Table of Contents</div>
          {tocItems.length === 0 ? (
            <div className="cse-toc-empty">Add headers to build your TOC</div>
          ) : (
            tocItems.map(item => (
              <button
                key={item.id}
                className={`cse-toc-item toc-${item.type}${focusedId === item.id ? ' active' : ''}`}
                onClick={() => scrollToSection(item.id)}
                title={item.content}
              >
                {item.content || `Untitled ${item.type.toUpperCase()}`}
              </button>
            ))
          )}
        </nav>

        {/* Editor */}
        <main className="cse-editor" ref={editorRef}>
          {sections.length === 0 ? (
            <div className="cse-editor-empty">
              <h2>No structure yet</h2>
              <p>Start with a template or add sections manually.</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button className="cse-add-btn primary" onClick={() => setShowTemplate(true)}>
                  Choose Template
                </button>
                <button className="cse-add-btn" onClick={() => addSection('h2')}>
                  + Add Chapter Title
                </button>
              </div>
            </div>
          ) : (
            sections.map((section, idx) => {
              if (hiddenIds.has(section.id)) return null;

              const isHeader = HEADER_TYPES.includes(section.type);
              const isCollapsed = collapsedIds.has(section.id);
              const children = isHeader ? childCount(section.id) : 0;
              const isDivider = section.type === 'divider';
              const blockClass = `cse-block-${section.type}`;
              const typeInfo = SECTION_TYPES.find(t => t.type === section.type);

              return (
                <div
                  key={section.id}
                  className={`cse-section${focusedId === section.id ? ' cse-section-focused' : ''}`}
                  data-section-id={section.id}
                >
                  {/* Hover toolbar */}
                  <div className="cse-section-toolbar">
                    <button
                      className="cse-section-tool-btn cse-drag-handle"
                      title="Drag to reorder"
                      onMouseDown={e => e.preventDefault()}
                    >
                      &#x2630;
                    </button>
                    <button
                      className="cse-section-tool-btn"
                      title="Change type"
                      onClick={() => setTypeMenuId(typeMenuId === section.id ? null : section.id)}
                    >
                      T
                    </button>
                    <button
                      className="cse-section-tool-btn"
                      title="Move up"
                      onClick={() => moveSection(section.id, -1)}
                    >
                      &uarr;
                    </button>
                    <button
                      className="cse-section-tool-btn"
                      title="Move down"
                      onClick={() => moveSection(section.id, 1)}
                    >
                      &darr;
                    </button>
                    <button
                      className="cse-section-tool-btn"
                      title="Add block below"
                      onClick={() => addSection('body', section.id)}
                    >
                      +
                    </button>
                    <button
                      className="cse-section-tool-btn danger"
                      title="Delete"
                      onClick={() => deleteSection(section.id)}
                    >
                      &times;
                    </button>
                  </div>

                  {/* Type selector dropdown */}
                  {typeMenuId === section.id && (
                    <div className="cse-type-selector">
                      {SECTION_TYPES.map(t => (
                        <button
                          key={t.type}
                          className={`cse-type-option${t.type === section.type ? ' active' : ''}`}
                          onClick={() => changeType(section.id, t.type)}
                        >
                          <span className="cse-type-option-label">{t.shortcut}</span>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Block content */}
                  {isDivider ? (
                    <hr className={blockClass} />
                  ) : (
                    <div className={blockClass}>
                      {isHeader && (
                        <span
                          className={`cse-collapse-toggle${isCollapsed ? ' collapsed' : ''}`}
                          onClick={() => toggleCollapse(section.id)}
                          title={isCollapsed ? 'Expand section' : 'Collapse section'}
                        >
                          &#x25BC;
                        </span>
                      )}
                      <textarea
                        ref={el => {
                          sectionRefs.current[section.id] = el;
                          if (el) autoResize(el);
                        }}
                        className="cse-block-input"
                        value={section.content}
                        placeholder={typeInfo?.placeholder || 'Type here…'}
                        rows={1}
                        onFocus={() => setFocusedId(section.id)}
                        onChange={e => {
                          updateSection(section.id, { content: e.target.value });
                          autoResize(e.target);
                        }}
                        onKeyDown={e => handleKeyDown(e, section)}
                      />
                      {isHeader && isCollapsed && children > 0 && (
                        <span className="cse-collapsed-badge">
                          {children} hidden
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </main>
      </div>

      {/* ── Bottom toolbar ── */}
      <div className="cse-bottom-bar">
        <button className="cse-add-btn" onClick={() => addSection('h3')}>
          + Section
        </button>
        <button className="cse-add-btn" onClick={() => addSection('body')}>
          + Body
        </button>
        <button className="cse-add-btn" onClick={() => addSection('quote')}>
          + Quote
        </button>
        <button className="cse-add-btn" onClick={() => addSection('reflection')}>
          + Reflection
        </button>
        <button className="cse-add-btn" onClick={() => addSection('divider')}>
          + Divider
        </button>
        <div className="cse-bottom-spacer" />
        <span className="cse-word-count">{wordCount} words</span>
        <span className="cse-section-count">{sections.length} blocks</span>
      </div>

      {/* ── Template Picker Modal ── */}
      {showTemplate && (
        <div className="cse-template-overlay" onClick={e => { if (e.target === e.currentTarget) setShowTemplate(false); }}>
          <div className="cse-template-modal">
            <h2>Chapter Templates</h2>
            <p>Choose a structure template. {sections.length > 0 ? 'This will replace your current sections.' : 'This sets up your chapter structure.'}</p>

            {Object.entries(CHAPTER_TEMPLATES).map(([key, tpl]) => (
              <div key={key} className="cse-template-card" onClick={() => applyTemplate(key)}>
                <h3>{tpl.name}</h3>
                <div className="cse-template-desc">{tpl.desc}</div>
                <div className="cse-template-sections">
                  {tpl.sections.length} blocks: {tpl.sections.filter(s => HEADER_TYPES.includes(s.type)).length} headers, {tpl.sections.filter(s => s.type === 'body').length} body, {tpl.sections.filter(s => !HEADER_TYPES.includes(s.type) && s.type !== 'body' && s.type !== 'divider').length} other
                </div>
              </div>
            ))}

            <div className="cse-template-actions">
              <button className="cse-add-btn" onClick={() => setShowTemplate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
