/**
 * BookStructurePanel.jsx
 * frontend/src/components/BookStructurePanel.jsx
 *
 * Full book structure editor: Front Matter, Parts/Acts, Chapter Types, Back Matter.
 * Mounted as a center tab in WriteMode.
 *
 * Props:
 *   bookId       — UUID of the current book
 *   allChapters  — array of chapter objects (already fetched by WriteMode)
 *   onChapterUpdate — callback(chapterId, updates) to save chapter changes
 *   onReloadChapters — callback() to re-fetch chapters after structural change
 */

import { useState, useEffect, useCallback } from 'react';

const API = '/api/v1';

/* ── Chapter type options ── */
const CHAPTER_TYPES = [
  { value: 'prologue',  label: 'Prologue',  icon: '◈' },
  { value: 'chapter',   label: 'Chapter',   icon: '§' },
  { value: 'interlude', label: 'Interlude', icon: '~' },
  { value: 'epilogue',  label: 'Epilogue',  icon: '◇' },
  { value: 'afterword', label: 'Afterword', icon: '∗' },
];

/* ── Roman numerals for part numbers ── */
const toRoman = (n) => {
  const vals = [10, 9, 5, 4, 1];
  const syms = ['X', 'IX', 'V', 'IV', 'I'];
  let result = '';
  vals.forEach((v, i) => { while (n >= v) { result += syms[i]; n -= v; } });
  return result || '';
};

/* ── Helper: auth headers ── */
const authHeaders = () => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export default function BookStructurePanel({ bookId, allChapters = [], onChapterUpdate, onReloadChapters }) {
  /* ── State ── */
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [saving, setSaving] = useState(false);

  // Front matter fields
  const [frontMatter, setFrontMatter] = useState({
    dedication: '', epigraph: '', epigraph_attribution: '',
    foreword: '', preface: '', copyright: '',
  });
  // Back matter fields
  const [backMatter, setBackMatter] = useState({
    about_author: '', acknowledgments: '', glossary: '',
    appendix: '', bibliography: '', notes: '',
  });
  const [authorName, setAuthorName] = useState('');

  /* ── Fetch book ── */
  useEffect(() => {
    if (!bookId) return;
    setLoading(true);
    fetch(`${API}/storyteller/books/${bookId}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        const b = data.book || data;
        setBook(b);
        setAuthorName(b.author_name || '');
        if (b.front_matter) setFrontMatter(prev => ({ ...prev, ...b.front_matter }));
        if (b.back_matter) setBackMatter(prev => ({ ...prev, ...b.back_matter }));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [bookId]);

  /* ── Save book metadata ── */
  const saveBookMeta = useCallback(async () => {
    if (!bookId) return;
    setSaving(true);
    try {
      await fetch(`${API}/storyteller/books/${bookId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          author_name: authorName,
          front_matter: frontMatter,
          back_matter: backMatter,
        }),
      });
    } catch (e) {
      console.error('Save book meta error:', e);
    } finally {
      setSaving(false);
    }
  }, [bookId, authorName, frontMatter, backMatter]);

  /* ── Save chapter type/part ── */
  const saveChapterMeta = useCallback(async (chId, updates) => {
    try {
      await fetch(`${API}/storyteller/chapters/${chId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      });
      if (onChapterUpdate) onChapterUpdate(chId, updates);
    } catch (e) {
      console.error('Save chapter meta error:', e);
    }
  }, [onChapterUpdate]);

  /* ── Derived data ── */
  const sortedChapters = [...allChapters].sort((a, b) => (a.sort_order ?? a.chapter_number ?? 0) - (b.sort_order ?? b.chapter_number ?? 0));

  // Group by parts
  const partGroups = sortedChapters.reduce((groups, ch) => {
    const pn = ch.part_number || 0;
    if (!groups[pn]) groups[pn] = { number: pn, title: ch.part_title || '', chapters: [] };
    groups[pn].chapters.push(ch);
    return groups;
  }, {});
  const parts = Object.values(partGroups).sort((a, b) => a.number - b.number);

  // Book stats
  const totalWords = sortedChapters.reduce((sum, ch) => {
    const w = ch.draft_prose ? ch.draft_prose.split(/\s+/).filter(Boolean).length : 0;
    return sum + w;
  }, 0);
  const sceneCount = sortedChapters.reduce((sum, ch) => {
    const secs = ch.sections || [];
    return sum + secs.filter(s => s.type === 'h3').length;
  }, 0);

  /* ── Section nav ── */
  const SECTIONS = [
    { id: 'overview',   label: 'Overview',      icon: '📖' },
    { id: 'front',      label: 'Front Matter',   icon: '◈' },
    { id: 'structure',  label: 'Parts & Chapters', icon: '§' },
    { id: 'back',       label: 'Back Matter',    icon: '◇' },
  ];

  if (loading) {
    return (
      <div className="bsp-loading">
        <span className="bsp-loading-text">Loading book structure…</span>
      </div>
    );
  }

  return (
    <div className="bsp-panel">

      {/* ── Section nav ── */}
      <div className="bsp-nav">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            className={`bsp-nav-btn${activeSection === s.id ? ' active' : ''}`}
            onClick={() => setActiveSection(s.id)}
          >
            <span className="bsp-nav-icon">{s.icon}</span>
            <span className="bsp-nav-label">{s.label}</span>
          </button>
        ))}
      </div>

      {/* ═══════════════════════ OVERVIEW ═══════════════════════ */}
      {activeSection === 'overview' && (
        <div className="bsp-section">
          <div className="bsp-overview-header">
            <h2 className="bsp-title">{book?.title || 'Untitled'}</h2>
            {book?.subtitle && <p className="bsp-subtitle">{book.subtitle}</p>}
          </div>

          <div className="bsp-stats-grid">
            <div className="bsp-stat">
              <span className="bsp-stat-num">{sortedChapters.length}</span>
              <span className="bsp-stat-label">Chapters</span>
            </div>
            <div className="bsp-stat">
              <span className="bsp-stat-num">{sceneCount}</span>
              <span className="bsp-stat-label">Scenes</span>
            </div>
            <div className="bsp-stat">
              <span className="bsp-stat-num">{totalWords.toLocaleString()}</span>
              <span className="bsp-stat-label">Words</span>
            </div>
            <div className="bsp-stat">
              <span className="bsp-stat-num">{Math.max(1, Math.round(totalWords / 250))}</span>
              <span className="bsp-stat-label">Min Read</span>
            </div>
          </div>

          {/* Structure outline */}
          <div className="bsp-outline">
            <h3 className="bsp-outline-title">Book Outline</h3>

            {/* Front matter indicators */}
            <div className="bsp-outline-group">
              <span className="bsp-outline-group-label">Front Matter</span>
              <div className="bsp-outline-pills">
                {frontMatter.dedication && <span className="bsp-pill filled">Dedication</span>}
                {frontMatter.epigraph && <span className="bsp-pill filled">Epigraph</span>}
                {frontMatter.foreword && <span className="bsp-pill filled">Foreword</span>}
                {frontMatter.preface && <span className="bsp-pill filled">Preface</span>}
                {frontMatter.copyright && <span className="bsp-pill filled">Copyright</span>}
                {!frontMatter.dedication && !frontMatter.epigraph && !frontMatter.foreword && !frontMatter.preface && !frontMatter.copyright && (
                  <span className="bsp-pill empty">None added yet</span>
                )}
              </div>
            </div>

            {/* Chapter outline with parts */}
            {parts.map(part => (
              <div key={part.number} className="bsp-outline-group">
                {part.number > 0 && (
                  <span className="bsp-outline-part-label">
                    Part {toRoman(part.number)}{part.title ? ` — ${part.title}` : ''}
                  </span>
                )}
                {part.number === 0 && parts.length > 1 && (
                  <span className="bsp-outline-part-label bsp-outline-part-unassigned">Unassigned</span>
                )}
                {part.chapters.map((ch, idx) => {
                  const ctype = CHAPTER_TYPES.find(t => t.value === (ch.chapter_type || 'chapter'));
                  const chWords = ch.draft_prose ? ch.draft_prose.split(/\s+/).filter(Boolean).length : 0;
                  const scenes = (ch.sections || []).filter(s => s.type === 'h3').length;
                  return (
                    <div key={ch.id} className="bsp-outline-chapter">
                      <span className="bsp-outline-ch-icon">{ctype?.icon || '§'}</span>
                      <span className="bsp-outline-ch-type">{ctype?.label || 'Chapter'}</span>
                      <span className="bsp-outline-ch-title">{ch.title || 'Untitled'}</span>
                      <span className="bsp-outline-ch-meta">
                        {scenes > 0 && `${scenes} scene${scenes > 1 ? 's' : ''}`}
                        {scenes > 0 && chWords > 0 && ' · '}
                        {chWords > 0 && `${chWords.toLocaleString()}w`}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Back matter indicators */}
            <div className="bsp-outline-group">
              <span className="bsp-outline-group-label">Back Matter</span>
              <div className="bsp-outline-pills">
                {backMatter.about_author && <span className="bsp-pill filled">About the Author</span>}
                {backMatter.acknowledgments && <span className="bsp-pill filled">Acknowledgments</span>}
                {backMatter.glossary && <span className="bsp-pill filled">Glossary</span>}
                {backMatter.appendix && <span className="bsp-pill filled">Appendix</span>}
                {backMatter.bibliography && <span className="bsp-pill filled">Bibliography</span>}
                {backMatter.notes && <span className="bsp-pill filled">Notes</span>}
                {!backMatter.about_author && !backMatter.acknowledgments && !backMatter.glossary && !backMatter.appendix && !backMatter.bibliography && !backMatter.notes && (
                  <span className="bsp-pill empty">None added yet</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ FRONT MATTER ═══════════════════════ */}
      {activeSection === 'front' && (
        <div className="bsp-section">
          <div className="bsp-section-header">
            <h3 className="bsp-section-title">Front Matter</h3>
            <p className="bsp-section-desc">These pages appear before Chapter 1 in your manuscript.</p>
          </div>

          {/* Author */}
          <div className="bsp-field">
            <label className="bsp-field-label">Author Name</label>
            <input
              className="bsp-input"
              value={authorName}
              onChange={e => setAuthorName(e.target.value)}
              placeholder="Your name as it appears on the title page"
            />
          </div>

          {/* Copyright */}
          <div className="bsp-field">
            <label className="bsp-field-label">Copyright Page</label>
            <textarea
              className="bsp-textarea"
              value={frontMatter.copyright}
              onChange={e => setFrontMatter(prev => ({ ...prev, copyright: e.target.value }))}
              placeholder={`© ${new Date().getFullYear()} ${authorName || '[Author Name]'}. All rights reserved.\n\nNo part of this publication may be reproduced...`}
              rows={4}
            />
          </div>

          {/* Dedication */}
          <div className="bsp-field">
            <label className="bsp-field-label">Dedication</label>
            <textarea
              className="bsp-textarea bsp-textarea--short"
              value={frontMatter.dedication}
              onChange={e => setFrontMatter(prev => ({ ...prev, dedication: e.target.value }))}
              placeholder="For those who dare to imagine…"
              rows={2}
            />
          </div>

          {/* Epigraph */}
          <div className="bsp-field">
            <label className="bsp-field-label">Epigraph</label>
            <textarea
              className="bsp-textarea bsp-textarea--short"
              value={frontMatter.epigraph}
              onChange={e => setFrontMatter(prev => ({ ...prev, epigraph: e.target.value }))}
              placeholder="A quote that sets the tone for the entire work…"
              rows={2}
            />
            <input
              className="bsp-input bsp-input--secondary"
              value={frontMatter.epigraph_attribution}
              onChange={e => setFrontMatter(prev => ({ ...prev, epigraph_attribution: e.target.value }))}
              placeholder="— Attribution (e.g., Virginia Woolf)"
            />
          </div>

          {/* Foreword */}
          <div className="bsp-field">
            <label className="bsp-field-label">Foreword</label>
            <p className="bsp-field-hint">Written by someone other than the author — an endorsement or context-setting piece.</p>
            <textarea
              className="bsp-textarea"
              value={frontMatter.foreword}
              onChange={e => setFrontMatter(prev => ({ ...prev, foreword: e.target.value }))}
              placeholder="Press Enter to begin your foreword…"
              rows={6}
            />
          </div>

          {/* Preface */}
          <div className="bsp-field">
            <label className="bsp-field-label">Preface</label>
            <p className="bsp-field-hint">Written by the author — explains why you wrote this book and how to read it.</p>
            <textarea
              className="bsp-textarea"
              value={frontMatter.preface}
              onChange={e => setFrontMatter(prev => ({ ...prev, preface: e.target.value }))}
              placeholder="Press Enter to begin your preface…"
              rows={6}
            />
          </div>

          <div className="bsp-save-row">
            <button className="bsp-save-btn" onClick={saveBookMeta} disabled={saving}>
              {saving ? 'Saving…' : 'Save Front Matter'}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════ PARTS & CHAPTERS ═══════════════════════ */}
      {activeSection === 'structure' && (
        <div className="bsp-section">
          <div className="bsp-section-header">
            <h3 className="bsp-section-title">Parts & Chapters</h3>
            <p className="bsp-section-desc">
              Organize chapters into Parts/Acts and set chapter types (Prologue, Interlude, Epilogue, etc.).
            </p>
          </div>

          {sortedChapters.map((ch, idx) => {
            const ctype = ch.chapter_type || 'chapter';
            const partNum = ch.part_number || 0;
            // Show part header when this is the first chapter with this part_number
            const prevPartNum = idx > 0 ? (sortedChapters[idx - 1].part_number || 0) : -1;
            const showPartHeader = partNum !== prevPartNum && partNum > 0;

            return (
              <div key={ch.id}>
                {showPartHeader && (
                  <div className="bsp-part-header">
                    <span className="bsp-part-numeral">Part {toRoman(partNum)}</span>
                    <input
                      className="bsp-part-title-input"
                      value={ch.part_title || ''}
                      onChange={e => {
                        const newTitle = e.target.value;
                        // Update all chapters with this part_number
                        sortedChapters.filter(c => c.part_number === partNum).forEach(c => {
                          saveChapterMeta(c.id, { part_title: newTitle });
                        });
                      }}
                      placeholder="Part title (optional)"
                    />
                  </div>
                )}

                <div className="bsp-chapter-row">
                  <div className="bsp-ch-left">
                    <span className="bsp-ch-num">{ch.chapter_number || idx + 1}</span>
                    <span className="bsp-ch-title">{ch.title || 'Untitled'}</span>
                  </div>
                  <div className="bsp-ch-controls">
                    {/* Chapter type */}
                    <select
                      className="bsp-select"
                      value={ctype}
                      onChange={e => saveChapterMeta(ch.id, { chapter_type: e.target.value })}
                    >
                      {CHAPTER_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                      ))}
                    </select>

                    {/* Part assignment */}
                    <select
                      className="bsp-select bsp-select--part"
                      value={partNum}
                      onChange={e => saveChapterMeta(ch.id, { part_number: parseInt(e.target.value) || null, part_title: e.target.value == 0 ? null : ch.part_title })}
                    >
                      <option value={0}>No Part</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                        <option key={n} value={n}>Part {toRoman(n)}</option>
                      ))}
                    </select>

                    {/* Scene count badge */}
                    {(() => {
                      const scenes = (ch.sections || []).filter(s => s.type === 'h3').length;
                      return scenes > 0 ? (
                        <span className="bsp-scene-badge">{scenes} scene{scenes > 1 ? 's' : ''}</span>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
            );
          })}

          {sortedChapters.length === 0 && (
            <div className="bsp-empty">No chapters yet. Add chapters from the TOC sidebar.</div>
          )}
        </div>
      )}

      {/* ═══════════════════════ BACK MATTER ═══════════════════════ */}
      {activeSection === 'back' && (
        <div className="bsp-section">
          <div className="bsp-section-header">
            <h3 className="bsp-section-title">Back Matter</h3>
            <p className="bsp-section-desc">These pages appear after the final chapter.</p>
          </div>

          {/* About the Author */}
          <div className="bsp-field">
            <label className="bsp-field-label">About the Author</label>
            <textarea
              className="bsp-textarea"
              value={backMatter.about_author}
              onChange={e => setBackMatter(prev => ({ ...prev, about_author: e.target.value }))}
              placeholder="A short biography — who you are, what you write, where you live…"
              rows={5}
            />
          </div>

          {/* Acknowledgments */}
          <div className="bsp-field">
            <label className="bsp-field-label">Acknowledgments</label>
            <textarea
              className="bsp-textarea"
              value={backMatter.acknowledgments}
              onChange={e => setBackMatter(prev => ({ ...prev, acknowledgments: e.target.value }))}
              placeholder="Thank the people and forces that made this book possible…"
              rows={5}
            />
          </div>

          {/* Glossary */}
          <div className="bsp-field">
            <label className="bsp-field-label">Glossary</label>
            <p className="bsp-field-hint">Define specialized terms used in your book. One term per line: <em>Term — Definition</em></p>
            <textarea
              className="bsp-textarea"
              value={backMatter.glossary}
              onChange={e => setBackMatter(prev => ({ ...prev, glossary: e.target.value }))}
              placeholder="Chronoweave — The fabric of intersecting timelines…\nEchostone — A memory artifact that replays…"
              rows={6}
            />
          </div>

          {/* Appendix */}
          <div className="bsp-field">
            <label className="bsp-field-label">Appendix</label>
            <textarea
              className="bsp-textarea"
              value={backMatter.appendix}
              onChange={e => setBackMatter(prev => ({ ...prev, appendix: e.target.value }))}
              placeholder="Supplementary material, tables, maps, or charts…"
              rows={5}
            />
          </div>

          {/* Bibliography / References */}
          <div className="bsp-field">
            <label className="bsp-field-label">Bibliography / References</label>
            <textarea
              className="bsp-textarea"
              value={backMatter.bibliography}
              onChange={e => setBackMatter(prev => ({ ...prev, bibliography: e.target.value }))}
              placeholder="Sources, references, or further reading…"
              rows={4}
            />
          </div>

          {/* Notes */}
          <div className="bsp-field">
            <label className="bsp-field-label">Author's Notes / Endnotes</label>
            <textarea
              className="bsp-textarea"
              value={backMatter.notes}
              onChange={e => setBackMatter(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Behind-the-scenes thoughts, research notes, or endnotes…"
              rows={4}
            />
          </div>

          <div className="bsp-save-row">
            <button className="bsp-save-btn" onClick={saveBookMeta} disabled={saving}>
              {saving ? 'Saving…' : 'Save Back Matter'}
            </button>
          </div>
        </div>
      )}

      <style>{`
/* ═══ BookStructurePanel Styles ═══ */
.bsp-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #FAF7F0;
}
.bsp-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300px;
  font-family: 'Lora', Georgia, serif;
  font-style: italic;
  color: rgba(28, 24, 20, 0.4);
  font-size: 14px;
}

/* ── Nav ── */
.bsp-nav {
  display: flex;
  gap: 0;
  border-bottom: 1px solid rgba(28, 24, 20, 0.08);
  padding: 0 12px;
  background: #FAF7F0;
  flex-shrink: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.bsp-nav-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 10px 14px 8px;
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: rgba(28, 24, 20, 0.4);
  cursor: pointer;
  transition: all 0.12s ease;
  white-space: nowrap;
}
.bsp-nav-btn:hover { color: rgba(28, 24, 20, 0.7); }
.bsp-nav-btn.active {
  color: #1C1814;
  border-bottom-color: #B8962E;
}
.bsp-nav-icon { font-size: 12px; }

/* ── Section ── */
.bsp-section {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px 40px;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}
.bsp-section-header { margin-bottom: 24px; }
.bsp-section-title {
  font-family: 'Lora', Georgia, serif;
  font-size: 18px;
  font-weight: 500;
  color: #1C1814;
  margin: 0 0 6px;
}
.bsp-section-desc {
  font-family: 'Spectral', Georgia, serif;
  font-size: 13px;
  color: rgba(28, 24, 20, 0.5);
  margin: 0;
  line-height: 1.6;
}

/* ── Overview ── */
.bsp-overview-header { text-align: center; padding: 16px 0 24px; }
.bsp-title {
  font-family: 'Lora', Georgia, serif;
  font-size: 24px;
  font-weight: 500;
  font-style: italic;
  color: #1C1814;
  margin: 0 0 4px;
}
.bsp-subtitle {
  font-family: 'Spectral', Georgia, serif;
  font-size: 14px;
  color: rgba(28, 24, 20, 0.5);
  margin: 0;
}

/* Stats grid */
.bsp-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 28px;
}
.bsp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 8px;
  border: 1px solid rgba(28, 24, 20, 0.06);
  border-radius: 4px;
  background: #FFFDF9;
}
.bsp-stat-num {
  font-family: 'DM Mono', monospace;
  font-size: 20px;
  color: #1C1814;
  font-weight: 500;
}
.bsp-stat-label {
  font-family: 'DM Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.15em;
  color: rgba(28, 24, 20, 0.35);
  text-transform: uppercase;
  margin-top: 4px;
}

/* Outline */
.bsp-outline { margin-top: 8px; }
.bsp-outline-title {
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.15em;
  color: rgba(28, 24, 20, 0.3);
  text-transform: uppercase;
  margin: 0 0 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(28, 24, 20, 0.06);
}
.bsp-outline-group { margin-bottom: 16px; }
.bsp-outline-group-label {
  font-family: 'DM Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.12em;
  color: rgba(28, 24, 20, 0.35);
  text-transform: uppercase;
  display: block;
  margin-bottom: 8px;
}
.bsp-outline-part-label {
  font-family: 'Lora', Georgia, serif;
  font-size: 13px;
  font-weight: 600;
  color: #B8962E;
  display: block;
  margin-bottom: 8px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(184, 150, 46, 0.15);
}
.bsp-outline-part-unassigned { color: rgba(28, 24, 20, 0.3); }
.bsp-outline-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.bsp-pill {
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.05em;
  padding: 4px 10px;
  border-radius: 3px;
  border: 1px solid rgba(28, 24, 20, 0.08);
}
.bsp-pill.filled { background: rgba(184, 150, 46, 0.08); color: #8A7434; border-color: rgba(184, 150, 46, 0.2); }
.bsp-pill.empty { color: rgba(28, 24, 20, 0.3); font-style: italic; }

.bsp-outline-chapter {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0 6px 8px;
  border-bottom: 1px solid rgba(28, 24, 20, 0.04);
}
.bsp-outline-ch-icon { font-size: 11px; color: rgba(28, 24, 20, 0.3); width: 16px; text-align: center; }
.bsp-outline-ch-type {
  font-family: 'DM Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.08em;
  color: rgba(28, 24, 20, 0.35);
  text-transform: uppercase;
  min-width: 60px;
}
.bsp-outline-ch-title {
  font-family: 'Spectral', Georgia, serif;
  font-size: 14px;
  color: #1C1814;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bsp-outline-ch-meta {
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  color: rgba(28, 24, 20, 0.3);
  white-space: nowrap;
}

/* ── Fields (Front/Back matter) ── */
.bsp-field { margin-bottom: 20px; }
.bsp-field-label {
  display: block;
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.1em;
  color: rgba(28, 24, 20, 0.5);
  text-transform: uppercase;
  margin-bottom: 6px;
}
.bsp-field-hint {
  font-family: 'Spectral', Georgia, serif;
  font-size: 12px;
  color: rgba(28, 24, 20, 0.4);
  font-style: italic;
  margin: 0 0 8px;
  line-height: 1.5;
}
.bsp-input,
.bsp-textarea {
  width: 100%;
  border: 1px solid rgba(28, 24, 20, 0.1);
  border-radius: 3px;
  padding: 10px 14px;
  font-family: 'Spectral', Georgia, serif;
  font-size: 14px;
  line-height: 1.7;
  color: #1C1814;
  background: #FFFDF9;
  outline: none;
  transition: border-color 0.12s ease;
  box-sizing: border-box;
}
.bsp-input:focus,
.bsp-textarea:focus {
  border-color: rgba(184, 150, 46, 0.4);
}
.bsp-input--secondary {
  margin-top: 6px;
  font-style: italic;
  color: rgba(28, 24, 20, 0.6);
  font-size: 13px;
}
.bsp-textarea { resize: vertical; min-height: 60px; }
.bsp-textarea--short { min-height: 40px; }

.bsp-save-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid rgba(28, 24, 20, 0.06);
}
.bsp-save-btn {
  background: #1C1814;
  color: #FAF7F0;
  border: none;
  border-radius: 3px;
  padding: 10px 28px;
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: opacity 0.12s ease;
}
.bsp-save-btn:hover { opacity: 0.85; }
.bsp-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Parts & Chapters ── */
.bsp-part-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0 8px;
  border-top: 2px solid rgba(184, 150, 46, 0.2);
  margin-top: 16px;
}
.bsp-part-header:first-child { margin-top: 0; }
.bsp-part-numeral {
  font-family: 'Lora', Georgia, serif;
  font-size: 14px;
  font-weight: 600;
  color: #B8962E;
  white-space: nowrap;
}
.bsp-part-title-input {
  flex: 1;
  background: none;
  border: none;
  border-bottom: 1px solid rgba(28, 24, 20, 0.08);
  padding: 4px 0;
  font-family: 'Spectral', Georgia, serif;
  font-size: 14px;
  color: #1C1814;
  outline: none;
}
.bsp-part-title-input:focus { border-bottom-color: rgba(184, 150, 46, 0.4); }

.bsp-chapter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid rgba(28, 24, 20, 0.04);
  gap: 12px;
  flex-wrap: wrap;
}
.bsp-ch-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}
.bsp-ch-num {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  color: rgba(28, 24, 20, 0.3);
  width: 24px;
  text-align: right;
  flex-shrink: 0;
}
.bsp-ch-title {
  font-family: 'Spectral', Georgia, serif;
  font-size: 14px;
  color: #1C1814;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bsp-ch-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.bsp-select {
  background: #FFFDF9;
  border: 1px solid rgba(28, 24, 20, 0.1);
  border-radius: 3px;
  padding: 5px 8px;
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  color: #1C1814;
  cursor: pointer;
  outline: none;
}
.bsp-select:focus { border-color: rgba(184, 150, 46, 0.4); }
.bsp-select--part { min-width: 85px; }
.bsp-scene-badge {
  font-family: 'DM Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.08em;
  color: rgba(28, 24, 20, 0.35);
  background: rgba(28, 24, 20, 0.04);
  padding: 3px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.bsp-empty {
  text-align: center;
  padding: 32px 16px;
  font-family: 'Lora', Georgia, serif;
  font-style: italic;
  color: rgba(28, 24, 20, 0.35);
  font-size: 14px;
}

/* ── Mobile responsive ── */
@media (max-width: 480px) {
  .bsp-section { padding: 16px 12px 32px; }
  .bsp-stats-grid { grid-template-columns: repeat(2, 1fr); }
  .bsp-chapter-row { flex-direction: column; align-items: flex-start; gap: 8px; }
  .bsp-ch-controls { width: 100%; }
  .bsp-select { flex: 1; }
  .bsp-nav-btn { padding: 8px 10px 6px; font-size: 9px; }
  .bsp-outline-chapter { padding: 6px 0; }
}
@media (min-width: 481px) and (max-width: 768px) {
  .bsp-section { padding: 16px 16px 32px; }
  .bsp-stats-grid { grid-template-columns: repeat(4, 1fr); gap: 8px; }
}
      `}</style>
    </div>
  );
}
