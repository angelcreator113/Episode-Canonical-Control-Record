/**
 * StoryPlanner.jsx — Book + Chapter + Section Planning with AI
 *
 * A workspace panel that lets authors:
 * 1. See their book structure (Parts → Chapters → Sections)
 * 2. Generate a full outline with AI
 * 3. Add/edit/reorder parts, chapters, and sections
 * 4. Expand individual chapters into sections with AI
 * 5. Apply the plan to create actual chapters in the DB
 */
import React, { useState, useEffect, useCallback } from 'react';
import './StoryPlanner.css';

const API = '/api/v1';

/* ═══════════════════════════════════════
   StoryPlanner — Main Component
   ═══════════════════════════════════════ */

export default function StoryPlanner({ book, chapters = [], onRefresh, onChapterClick, toast }) {
  const [plan, setPlan] = useState(null);         // The outline data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('structure'); // 'structure' | 'generate'
  const [applying, setApplying] = useState(false);

  // Generation form
  const [instructions, setInstructions] = useState('');
  const [numParts, setNumParts] = useState('');
  const [numChapters, setNumChapters] = useState('');

  // Expanding chapter sections
  const [expandingChapterId, setExpandingChapterId] = useState(null);

  // Section editing
  const [editingSection, setEditingSection] = useState(null); // { chapterId, sectionIndex }
  const [sectionDraft, setSectionDraft] = useState({ title: '', type: 'scene', description: '' });

  // Build current structure from existing chapters
  const buildStructure = useCallback(() => {
    if (!chapters.length) return null;
    const sorted = [...chapters].sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

    // Group by part_number
    const partMap = new Map();
    sorted.forEach(ch => {
      const partNum = ch.part_number || 1;
      if (!partMap.has(partNum)) {
        partMap.set(partNum, {
          part_number: partNum,
          part_title: ch.part_title || `Part ${partNum}`,
          chapters: [],
        });
      }
      partMap.get(partNum).chapters.push(ch);
    });

    return { parts: Array.from(partMap.values()) };
  }, [chapters]);

  const currentStructure = buildStructure();

  /* ── AI Outline Generation ── */
  const generateOutline = async (mode = 'full', targetChapterId = null) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/memories/story-outline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: book.id,
          book_title: book.title || '',
          book_description: book.description || '',
          character_name: book.character_name || '',
          existing_chapters: chapters.map(ch => ({
            id: ch.id,
            title: ch.title,
            chapter_type: ch.chapter_type || 'chapter',
            part_number: ch.part_number,
            part_title: ch.part_title,
            sections: ch.sections || [],
            scene_goal: ch.scene_goal || '',
            draft_prose: ch.draft_prose || '',
          })),
          instructions,
          mode,
          target_chapter_id: targetChapterId,
          num_parts: numParts ? parseInt(numParts) : null,
          num_chapters: numChapters ? parseInt(numChapters) : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      if (mode === 'full') {
        setPlan(data.outline);
        setActiveTab('structure');
      } else if (mode === 'expand_chapter' && data.outline?.sections) {
        // Apply sections to the specific chapter
        await applySectionsToChapter(targetChapterId, data.outline.sections);
        setExpandingChapterId(null);
      } else if (mode === 'add_sections' && data.outline?.chapters) {
        // Apply sections to multiple chapters
        for (const entry of data.outline.chapters) {
          const ch = chapters[entry.chapter_index];
          if (ch) await applySectionsToChapter(ch.id, entry.sections);
        }
      }

      toast?.add('Outline generated');
    } catch (e) {
      setError(e.message);
      toast?.add('Failed to generate outline', 'error');
    }
    setLoading(false);
  };

  /* ── Apply sections to a chapter ── */
  const applySectionsToChapter = async (chapterId, sections) => {
    const sectionBlocks = sections.map((s, i) => ({
      id: `sec-${Date.now()}-${i}`,
      type: 'h3',
      content: s.title || `Section ${i + 1}`,
      collapsed: false,
      meta: {
        section_type: s.type || 'scene',
        description: s.description || '',
        emotional_beat: s.emotional_beat || '',
      },
    }));

    await fetch(`${API}/storyteller/chapters/${chapterId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sections: sectionBlocks }),
    });
  };

  /* ── Apply full plan — creates chapters from the AI outline ── */
  const applyFullPlan = async () => {
    if (!plan?.parts) return;
    setApplying(true);

    try {
      let chapterNum = chapters.length;
      for (const part of plan.parts) {
        for (const ch of part.chapters) {
          chapterNum++;
          // Check if chapter already exists (by title match)
          const existing = chapters.find(
            c => c.title?.toLowerCase().trim() === ch.title?.toLowerCase().trim()
          );

          if (existing) {
            // Update existing chapter with plan data
            await fetch(`${API}/storyteller/chapters/${existing.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chapter_type: ch.chapter_type || 'chapter',
                part_number: part.part_number,
                part_title: part.part_title,
                scene_goal: ch.scene_goal || '',
                sections: (ch.sections || []).map((s, i) => ({
                  id: `sec-${Date.now()}-${i}`,
                  type: 'h3',
                  content: s.title || `Section ${i + 1}`,
                  collapsed: false,
                  meta: {
                    section_type: s.type || 'scene',
                    description: s.description || '',
                    emotional_beat: s.emotional_beat || '',
                  },
                })),
              }),
            });
          } else {
            // Create new chapter
            const createRes = await fetch(`${API}/storyteller/books/${book.id}/chapters`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: ch.title,
                chapter_number: chapterNum,
                chapter_type: ch.chapter_type || 'chapter',
                part_number: part.part_number,
                part_title: part.part_title,
                scene_goal: ch.scene_goal || '',
                sections: (ch.sections || []).map((s, i) => ({
                  id: `sec-${Date.now()}-${i}`,
                  type: 'h3',
                  content: s.title || `Section ${i + 1}`,
                  collapsed: false,
                  meta: {
                    section_type: s.type || 'scene',
                    description: s.description || '',
                    emotional_beat: s.emotional_beat || '',
                  },
                })),
              }),
            });
          }
        }
      }

      toast?.add('Plan applied — chapters created');
      onRefresh?.();
      setPlan(null);
    } catch (e) {
      toast?.add('Failed to apply plan: ' + e.message, 'error');
    }
    setApplying(false);
  };

  /* ── Add section to an existing chapter ── */
  const addSectionToChapter = async (chapterId) => {
    const ch = chapters.find(c => c.id === chapterId);
    if (!ch) return;

    const existing = ch.sections || [];
    const newSection = {
      id: `sec-${Date.now()}`,
      type: 'h3',
      content: sectionDraft.title || 'New Section',
      collapsed: false,
      meta: {
        section_type: sectionDraft.type || 'scene',
        description: sectionDraft.description || '',
        emotional_beat: '',
      },
    };

    try {
      await fetch(`${API}/storyteller/chapters/${chapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: [...existing, newSection] }),
      });
      toast?.add('Section added');
      setEditingSection(null);
      setSectionDraft({ title: '', type: 'scene', description: '' });
      onRefresh?.();
    } catch (e) {
      toast?.add('Failed to add section', 'error');
    }
  };

  /* ── Remove section from chapter ── */
  const removeSection = async (chapterId, sectionIndex) => {
    const ch = chapters.find(c => c.id === chapterId);
    if (!ch) return;
    const updated = [...(ch.sections || [])];
    updated.splice(sectionIndex, 1);

    try {
      await fetch(`${API}/storyteller/chapters/${chapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: updated }),
      });
      toast?.add('Section removed');
      onRefresh?.();
    } catch (e) {
      toast?.add('Failed to remove section', 'error');
    }
  };

  /* ── Update chapter metadata (part, type, goal) ── */
  const updateChapterMeta = async (chapterId, updates) => {
    try {
      await fetch(`${API}/storyteller/chapters/${chapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      onRefresh?.();
    } catch (e) {
      toast?.add('Failed to update chapter', 'error');
    }
  };

  /* ═══════════════════════════════════════
     RENDER
     ═══════════════════════════════════════ */

  return (
    <div className="sp-planner">
      {/* Header */}
      <div className="sp-header">
        <div className="sp-header-left">
          <div className="sp-header-icon">✦</div>
          <div>
            <h2 className="sp-title">Story Planner</h2>
            <p className="sp-subtitle">Plan your book's structure — parts, chapters, and sections</p>
          </div>
        </div>
        <div className="sp-tabs">
          <button
            className={`sp-tab${activeTab === 'structure' ? ' active' : ''}`}
            onClick={() => setActiveTab('structure')}
          >
            Structure
          </button>
          <button
            className={`sp-tab${activeTab === 'generate' ? ' active' : ''}`}
            onClick={() => setActiveTab('generate')}
          >
            AI Generate
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="sp-error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* ═══ Generate Tab ═══ */}
      {activeTab === 'generate' && (
        <div className="sp-generate">
          <div className="sp-generate-intro">
            <p>Describe your vision and the AI will generate a structured outline with parts, chapters, and sections.</p>
          </div>

          <div className="sp-form">
            <div className="sp-form-group">
              <label>Planning Instructions</label>
              <textarea
                className="sp-textarea"
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="Describe your book's concept, themes, character arcs, or specific structural ideas. The AI will build an outline around this vision…"
                rows={5}
              />
            </div>

            <div className="sp-form-row">
              <div className="sp-form-group sp-form-half">
                <label>Number of Parts</label>
                <input
                  type="number"
                  className="sp-input"
                  value={numParts}
                  onChange={e => setNumParts(e.target.value)}
                  placeholder="Auto (2-4)"
                  min={1}
                  max={10}
                />
              </div>
              <div className="sp-form-group sp-form-half">
                <label>Number of Chapters</label>
                <input
                  type="number"
                  className="sp-input"
                  value={numChapters}
                  onChange={e => setNumChapters(e.target.value)}
                  placeholder="Auto (8-20)"
                  min={1}
                  max={50}
                />
              </div>
            </div>

            <div className="sp-form-actions">
              <button
                className="sp-btn sp-btn-gold"
                onClick={() => generateOutline('full')}
                disabled={loading}
              >
                {loading ? '✦ Generating…' : '✦ Generate Full Outline'}
              </button>
              {chapters.length > 0 && (
                <button
                  className="sp-btn sp-btn-ghost"
                  onClick={() => generateOutline('add_sections')}
                  disabled={loading}
                >
                  Add Sections to Existing Chapters
                </button>
              )}
            </div>
          </div>

          {/* ── AI-Generated Plan Preview ── */}
          {plan && (
            <div className="sp-plan-preview">
              <div className="sp-plan-header">
                <h3 className="sp-plan-title">✦ Generated Outline</h3>
                <div className="sp-plan-actions">
                  <button
                    className="sp-btn sp-btn-gold"
                    onClick={applyFullPlan}
                    disabled={applying}
                  >
                    {applying ? 'Applying…' : 'Apply Plan →'}
                  </button>
                  <button
                    className="sp-btn sp-btn-ghost"
                    onClick={() => setPlan(null)}
                  >
                    Discard
                  </button>
                </div>
              </div>

              {plan.parts?.map((part, pi) => (
                <div key={pi} className="sp-plan-part">
                  <div className="sp-plan-part-header">
                    <span className="sp-plan-part-num">Part {part.part_number}</span>
                    <span className="sp-plan-part-title">{part.part_title}</span>
                    {part.theme && <span className="sp-plan-part-theme">{part.theme}</span>}
                  </div>

                  {part.chapters?.map((ch, ci) => (
                    <div key={ci} className="sp-plan-chapter">
                      <div className="sp-plan-chapter-header">
                        <span className="sp-plan-chapter-type">{ch.chapter_type || 'chapter'}</span>
                        <span className="sp-plan-chapter-title">{ch.title}</span>
                      </div>
                      {ch.scene_goal && (
                        <div className="sp-plan-chapter-goal">
                          <strong>Goal:</strong> {ch.scene_goal}
                        </div>
                      )}
                      {ch.emotional_arc && (
                        <div className="sp-plan-chapter-arc">
                          <strong>Arc:</strong> {ch.emotional_arc}
                        </div>
                      )}
                      {ch.characters_present?.length > 0 && (
                        <div className="sp-plan-chapter-chars">
                          {ch.characters_present.map((c, i) => (
                            <span key={i} className="sp-plan-char-tag">{c}</span>
                          ))}
                        </div>
                      )}
                      {ch.sections?.length > 0 && (
                        <div className="sp-plan-sections">
                          {ch.sections.map((s, si) => (
                            <div key={si} className="sp-plan-section">
                              <div className="sp-plan-section-header">
                                <span className={`sp-plan-section-type sp-type-${s.type}`}>{s.type}</span>
                                <span className="sp-plan-section-title">{s.title}</span>
                              </div>
                              <div className="sp-plan-section-desc">{s.description}</div>
                              {s.emotional_beat && (
                                <div className="sp-plan-section-beat">♡ {s.emotional_beat}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ Structure Tab — Current Book Structure ═══ */}
      {activeTab === 'structure' && (
        <div className="sp-structure">
          {!currentStructure || chapters.length === 0 ? (
            <div className="sp-empty">
              <div className="sp-empty-icon">✦</div>
              <h3>No chapters yet</h3>
              <p>Switch to the "AI Generate" tab to create an outline, or add chapters manually from the editor.</p>
            </div>
          ) : (
            currentStructure.parts.map((part, pi) => (
              <div key={pi} className="sp-part">
                <div className="sp-part-header">
                  <div className="sp-part-label">
                    <span className="sp-part-num">Part {part.part_number}</span>
                    <span className="sp-part-title">{part.part_title}</span>
                  </div>
                  <span className="sp-part-count">
                    {part.chapters.length} {part.chapters.length === 1 ? 'chapter' : 'chapters'}
                  </span>
                </div>

                {part.chapters.map((ch, ci) => {
                  const sections = ch.sections || [];
                  const headerSections = sections.filter(s => s.type === 'h3' || s.type === 'h2');
                  const wordCount = (ch.draft_prose || '').split(/\s+/).filter(Boolean).length;
                  const isExpanding = expandingChapterId === ch.id;

                  return (
                    <div key={ch.id} className="sp-chapter">
                      <div className="sp-chapter-header" onClick={() => onChapterClick?.(ch.id)}>
                        <div className="sp-chapter-info">
                          <span className="sp-chapter-num">
                            {ch.chapter_number || ci + 1}.
                          </span>
                          <span className="sp-chapter-title">{ch.title || 'Untitled'}</span>
                          {ch.chapter_type && ch.chapter_type !== 'chapter' && (
                            <span className="sp-chapter-type-badge">{ch.chapter_type}</span>
                          )}
                        </div>
                        <div className="sp-chapter-meta">
                          <span className="sp-chapter-words">{wordCount > 0 ? `${wordCount.toLocaleString()} w` : '—'}</span>
                          <span className="sp-chapter-section-count">
                            {headerSections.length} §
                          </span>
                        </div>
                      </div>

                      {ch.scene_goal && (
                        <div className="sp-chapter-goal">{ch.scene_goal}</div>
                      )}

                      {/* Sections list */}
                      {headerSections.length > 0 && (
                        <div className="sp-sections">
                          {headerSections.map((sec, si) => (
                            <div key={sec.id || si} className="sp-section">
                              <div className="sp-section-row">
                                <span className={`sp-section-type sp-type-${sec.meta?.section_type || 'scene'}`}>
                                  {sec.meta?.section_type || 'scene'}
                                </span>
                                <span className="sp-section-title">{sec.content}</span>
                                <button
                                  className="sp-section-remove"
                                  onClick={(e) => { e.stopPropagation(); removeSection(ch.id, sections.indexOf(sec)); }}
                                  title="Remove section"
                                >
                                  ✕
                                </button>
                              </div>
                              {sec.meta?.description && (
                                <div className="sp-section-desc">{sec.meta.description}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Section actions */}
                      <div className="sp-chapter-actions">
                        {editingSection?.chapterId === ch.id ? (
                          <div className="sp-add-section-form">
                            <input
                              className="sp-input sp-input-sm"
                              placeholder="Section title…"
                              value={sectionDraft.title}
                              onChange={e => setSectionDraft(prev => ({ ...prev, title: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && addSectionToChapter(ch.id)}
                              autoFocus
                            />
                            <select
                              className="sp-select-sm"
                              value={sectionDraft.type}
                              onChange={e => setSectionDraft(prev => ({ ...prev, type: e.target.value }))}
                            >
                              <option value="scene">Scene</option>
                              <option value="reflection">Reflection</option>
                              <option value="transition">Transition</option>
                              <option value="revelation">Revelation</option>
                            </select>
                            <input
                              className="sp-input sp-input-sm"
                              placeholder="Brief description…"
                              value={sectionDraft.description}
                              onChange={e => setSectionDraft(prev => ({ ...prev, description: e.target.value }))}
                            />
                            <button className="sp-btn-sm sp-btn-gold" onClick={() => addSectionToChapter(ch.id)}>Add</button>
                            <button className="sp-btn-sm sp-btn-ghost" onClick={() => setEditingSection(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div className="sp-chapter-action-row">
                            <button
                              className="sp-btn-sm sp-btn-ghost"
                              onClick={() => {
                                setEditingSection({ chapterId: ch.id });
                                setSectionDraft({ title: '', type: 'scene', description: '' });
                              }}
                            >
                              + Add Section
                            </button>
                            <button
                              className="sp-btn-sm sp-btn-ghost"
                              onClick={() => {
                                setExpandingChapterId(ch.id);
                                generateOutline('expand_chapter', ch.id);
                              }}
                              disabled={loading && isExpanding}
                            >
                              {isExpanding && loading ? '✦ Planning…' : '✦ AI Plan Sections'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="sp-loading">
          <div className="sp-loading-spinner">✦</div>
          <div className="sp-loading-text">Planning your story…</div>
        </div>
      )}
    </div>
  );
}
