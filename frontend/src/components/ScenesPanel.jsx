/**
 * ScenesPanel.jsx
 * 
 * Displays all scenes across all chapters for a book.
 * Supports creating, renaming, and deleting scenes (h3 sections).
 * Includes AI Scene Planner — per-chapter AI-powered scene suggestions
 * and book-wide AI scene generation.
 * Used as a center tab in WriteMode.
 */

import { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/api';

const API = '/api/v1';

// Track 3 module-scope helpers (Pattern D).
export const updateChapterSections = (chapterId, sections) =>
  apiClient.put(`${API}/storyteller/chapters/${chapterId}`, { sections });

export const planScenesForChapter = (payload) =>
  apiClient.post(`${API}/memories/scene-planner`, payload);

export const fetchBookSceneSuggestions = (bookId) =>
  apiClient.get(`${API}/memories/books/${bookId}/scenes`);

export default function ScenesPanel({ bookId, chapters = [], onChaptersChange, book, characterId }) {
  const [expanded, setExpanded] = useState({});
  const [addingSceneTo, setAddingSceneTo] = useState(null);
  const [newSceneTitle, setNewSceneTitle] = useState('');
  const [editingScene, setEditingScene] = useState(null); // { chId, secId }
  const [editVal, setEditVal] = useState('');

  // AI planner state
  const [aiLoading, setAiLoading] = useState({}); // { chapterId: true }
  const [aiSuggestions, setAiSuggestions] = useState({}); // { chapterId: [...] }
  const [bookAiLoading, setBookAiLoading] = useState(false);
  const [bookAiScenes, setBookAiScenes] = useState(null);
  const [aiError, setAiError] = useState(null);

  const toggle = (chId) => setExpanded(prev => ({ ...prev, [chId]: !prev[chId] }));

  // Extract scenes (h3 sections) from each chapter
  const chaptersWithScenes = chapters.map(ch => {
    const sections = Array.isArray(ch.sections) ? ch.sections : [];
    const scenes = sections.filter(s => s.type === 'h3');
    return { ...ch, scenes, allSections: sections };
  });

  const totalScenes = chaptersWithScenes.reduce((s, ch) => s + ch.scenes.length, 0);

  /* ── Add scene to chapter ── */
  const addScene = useCallback(async (chId, title) => {
    const sceneTitle = title || newSceneTitle;
    if (!sceneTitle?.trim()) return;
    const ch = chapters.find(c => c.id === chId);
    if (!ch) return;
    const currentSections = Array.isArray(ch.sections) ? [...ch.sections] : [];
    const newSection = {
      id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'h3',
      content: sceneTitle.trim(),
      prose: '',
    };
    currentSections.push(newSection);
    try {
      await updateChapterSections(chId, currentSections);
      if (onChaptersChange) onChaptersChange();
    } catch (e) { console.error('Add scene error:', e); }
    setAddingSceneTo(null);
    setNewSceneTitle('');
  }, [newSceneTitle, chapters, onChaptersChange]);

  /* ── Rename scene ── */
  const renameScene = useCallback(async (chId, secId, newTitle) => {
    const ch = chapters.find(c => c.id === chId);
    if (!ch) return;
    const currentSections = (Array.isArray(ch.sections) ? ch.sections : []).map(s =>
      s.id === secId ? { ...s, content: newTitle } : s
    );
    try {
      await updateChapterSections(chId, currentSections);
      if (onChaptersChange) onChaptersChange();
    } catch (e) { console.error('Rename scene error:', e); }
    setEditingScene(null);
  }, [chapters, onChaptersChange]);

  /* ── Delete scene ── */
  const deleteScene = useCallback(async (chId, secId) => {
    const ch = chapters.find(c => c.id === chId);
    if (!ch) return;
    const currentSections = (Array.isArray(ch.sections) ? ch.sections : []).filter(s => s.id !== secId);
    try {
      await updateChapterSections(chId, currentSections);
      if (onChaptersChange) onChaptersChange();
    } catch (e) { console.error('Delete scene error:', e); }
  }, [chapters, onChaptersChange]);

  /* ── AI: Plan scenes for a specific chapter ── */
  const planChapterScenes = useCallback(async (ch) => {
    setAiLoading(prev => ({ ...prev, [ch.id]: true }));
    setAiError(null);
    try {
      const existingScenes = (Array.isArray(ch.sections) ? ch.sections : [])
        .filter(s => s.type === 'h3')
        .map(s => ({ content: s.content, title: s.content }));

      const res = await planScenesForChapter({
        book_id: bookId,
        chapter_id: ch.id,
        chapter_title: ch.title,
        chapter_type: ch.chapter_type || 'chapter',
        character_id: characterId || null,
        existing_scenes: existingScenes,
        draft_prose: ch.draft_prose || '',
        book_title: book?.title || '',
        book_description: book?.description || '',
        all_chapters: chapters.map(c => ({
          id: c.id,
          title: c.title,
          chapter_type: c.chapter_type,
          scenes: (Array.isArray(c.sections) ? c.sections : []).filter(s => s.type === 'h3'),
        })),
        theme: ch.theme || '',
        scene_goal: ch.scene_goal || '',
      });
      const data = res.data;
      setAiSuggestions(prev => ({ ...prev, [ch.id]: data.suggestions || [] }));
    } catch (e) {
      console.error('AI scene planner error:', e);
      setAiError(e.message);
    } finally {
      setAiLoading(prev => ({ ...prev, [ch.id]: false }));
    }
  }, [bookId, chapters, book, onChaptersChange, characterId]);

  /* ── AI: Book-wide scene suggestions ── */
  const planBookScenes = useCallback(async () => {
    setBookAiLoading(true);
    setAiError(null);
    try {
      const res = await fetchBookSceneSuggestions(bookId);
      const data = res.data;
      setBookAiScenes(data.scenes || data);
    } catch (e) {
      console.error('Book AI scenes error:', e);
      setAiError(e.message);
    } finally {
      setBookAiLoading(false);
    }
  }, [bookId]);

  /* ── Accept AI suggestion → add as real scene ── */
  const acceptSuggestion = useCallback(async (chId, suggestion) => {
    await addScene(chId, suggestion.title);
    // Remove from suggestions
    setAiSuggestions(prev => ({
      ...prev,
      [chId]: (prev[chId] || []).filter(s => s.title !== suggestion.title),
    }));
  }, [addScene]);

  /* ── Accept book-wide suggestion ── */
  const acceptBookSuggestion = useCallback(async (suggestion) => {
    const targetCh = suggestion.chapter_id
      ? chapters.find(c => c.id === suggestion.chapter_id)
      : chapters[0];
    if (!targetCh) return;
    await addScene(targetCh.id, suggestion.title);
    setBookAiScenes(prev => prev ? prev.filter(s => s.title !== suggestion.title) : null);
  }, [chapters, addScene]);

  // ── Position emoji
  const posIcon = (pos) => pos === 'beginning' ? '▶' : pos === 'end' ? '◀' : '◆';

  return (
    <div className="scenes-panel">
      <div className="scenes-panel-header">
        <div>
          <h3 className="scenes-panel-title">Scenes Overview</h3>
          <span className="scenes-panel-count">{totalScenes} scenes across {chapters.length} chapters</span>
        </div>
        <button
          className="scenes-panel-ai-book-btn"
          onClick={planBookScenes}
          disabled={bookAiLoading}
          title="AI analyzes your entire book and suggests scenes that would strengthen the arc"
        >
          {bookAiLoading ? '⧖ Thinking…' : '✨ AI Scene Architect'}
        </button>
      </div>

      {/* ── AI error ── */}
      {aiError && (
        <div className="scenes-panel-ai-error">
          <span>{'⚠'} {aiError}</span>
          <button onClick={() => setAiError(null)}>{'×'}</button>
        </div>
      )}

      {/* ── Book-wide AI suggestions ── */}
      {bookAiScenes && bookAiScenes.length > 0 && (
        <div className="scenes-panel-ai-book-results">
          <div className="scenes-panel-ai-book-label">
            {'✨'} AI Suggested Scenes for Your Book
          </div>
          {bookAiScenes.map((scene, i) => (
            <div key={i} className="scenes-panel-ai-card">
              <div className="scenes-panel-ai-card-head">
                <span className="scenes-panel-ai-card-title">{scene.title}</span>
                {scene.chapter_hint && (
                  <span className="scenes-panel-ai-card-ch">{scene.chapter_hint}</span>
                )}
              </div>
              <p className="scenes-panel-ai-card-desc">{scene.description}</p>
              {scene.reason && (
                <p className="scenes-panel-ai-card-reason">
                  <span className="scenes-panel-ai-card-reason-label">Why:</span> {scene.reason}
                </p>
              )}
              {scene.characters && scene.characters.length > 0 && (
                <div className="scenes-panel-ai-card-chars">
                  {scene.characters.map(c => <span key={c} className="scenes-panel-ai-char-tag">{c}</span>)}
                </div>
              )}
              <div className="scenes-panel-ai-card-actions">
                <button
                  className="scenes-panel-ai-accept"
                  onClick={() => acceptBookSuggestion(scene)}
                  title="Add this scene to the chapter"
                >
                  {'✓'} Add Scene
                </button>
                <button
                  className="scenes-panel-ai-dismiss"
                  onClick={() => setBookAiScenes(prev => prev.filter((_, j) => j !== i))}
                  title="Dismiss"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
          <button className="scenes-panel-ai-clear" onClick={() => setBookAiScenes(null)}>
            Clear all suggestions
          </button>
        </div>
      )}

      {chaptersWithScenes.length === 0 ? (
        <div className="scenes-panel-empty">
          <p>No chapters yet. Create chapters to start adding scenes.</p>
        </div>
      ) : (
        <div className="scenes-panel-list">
          {chaptersWithScenes.map((ch, i) => (
            <div key={ch.id} className="scenes-panel-chapter">
              <button
                className={`scenes-panel-chapter-btn${expanded[ch.id] ? ' expanded' : ''}`}
                onClick={() => toggle(ch.id)}
              >
                <span className="scenes-panel-ch-num">Ch. {ch.chapter_number || i + 1}</span>
                {ch.chapter_type && ch.chapter_type !== 'chapter' && (
                  <span className="scenes-panel-ch-type">{ch.chapter_type}</span>
                )}
                <span className="scenes-panel-ch-title">{ch.title || 'Untitled'}</span>
                <span className="scenes-panel-ch-count">
                  {ch.scenes.length} scene{ch.scenes.length !== 1 ? 's' : ''}
                </span>
                <span className="scenes-panel-ch-arrow">{expanded[ch.id] ? '▾' : '▸'}</span>
              </button>

              {expanded[ch.id] && (
                <div className="scenes-panel-scenes">
                  {ch.scenes.length === 0 ? (
                    <div className="scenes-panel-no-scenes">No scenes defined</div>
                  ) : (
                    ch.scenes.map((scene, si) => (
                      <div key={scene.id || si} className="scenes-panel-scene">
                        <span className="scenes-panel-scene-num">{si + 1}</span>
                        <span className="scenes-panel-scene-dinkus">{'✦'}</span>
                        {editingScene && editingScene.chId === ch.id && editingScene.secId === scene.id ? (
                          <input
                            className="scenes-panel-scene-edit"
                            value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onBlur={() => renameScene(ch.id, scene.id, editVal)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') renameScene(ch.id, scene.id, editVal);
                              if (e.key === 'Escape') setEditingScene(null);
                            }}
                            autoFocus
                          />
                        ) : (
                          <span
                            className="scenes-panel-scene-title"
                            onDoubleClick={() => { setEditingScene({ chId: ch.id, secId: scene.id }); setEditVal(scene.content || ''); }}
                            title="Double-click to rename"
                          >
                            {scene.content || 'Untitled Scene'}
                          </span>
                        )}
                        <button
                          className="scenes-panel-scene-del"
                          onClick={() => deleteScene(ch.id, scene.id)}
                          title="Delete scene"
                        >
                          {'×'}
                        </button>
                        <button
                          className="scenes-panel-scene-gen"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('scene-generate-prose', {
                              detail: { chapterId: ch.id, sceneTitle: scene.content, sceneId: scene.id }
                            }));
                          }}
                          title="Generate prose for this scene using AI"
                        >
                          {'✦ Write'}
                        </button>
                      </div>
                    ))
                  )}

                  {/* Add scene manually */}
                  {addingSceneTo === ch.id ? (
                    <div className="scenes-panel-add-row">
                      <input
                        className="scenes-panel-add-input"
                        value={newSceneTitle}
                        onChange={e => setNewSceneTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') addScene(ch.id);
                          if (e.key === 'Escape') { setAddingSceneTo(null); setNewSceneTitle(''); }
                        }}
                        placeholder="Scene title…"
                        autoFocus
                      />
                      <button className="scenes-panel-add-confirm" onClick={() => addScene(ch.id)}>{'✓'}</button>
                      <button className="scenes-panel-add-cancel" onClick={() => { setAddingSceneTo(null); setNewSceneTitle(''); }}>{'×'}</button>
                    </div>
                  ) : (
                    <div className="scenes-panel-add-row-buttons">
                      <button
                        className="scenes-panel-add-btn"
                        onClick={() => { setAddingSceneTo(ch.id); setNewSceneTitle(''); }}
                      >
                        + Add Scene
                      </button>
                      <button
                        className="scenes-panel-ai-plan-btn"
                        onClick={() => planChapterScenes(ch)}
                        disabled={aiLoading[ch.id]}
                        title="AI reads your chapter and suggests scenes"
                      >
                        {aiLoading[ch.id] ? '⧖ Planning…' : '✨ AI Plan Scenes'}
                      </button>
                    </div>
                  )}

                  {/* ── AI suggestions for this chapter ── */}
                  {aiSuggestions[ch.id] && aiSuggestions[ch.id].length > 0 && (
                    <div className="scenes-panel-ai-suggestions">
                      <div className="scenes-panel-ai-label">
                        {'✨'} AI Suggestions
                      </div>
                      {aiSuggestions[ch.id].map((sug, si) => (
                        <div key={si} className="scenes-panel-ai-sug-card">
                          <div className="scenes-panel-ai-sug-head">
                            <span className="scenes-panel-ai-sug-pos" title={sug.suggested_position || 'middle'}>
                              {posIcon(sug.suggested_position)}
                            </span>
                            <span className="scenes-panel-ai-sug-title">{sug.title}</span>
                            {sug.emotional_beat && (
                              <span className="scenes-panel-ai-sug-beat">{sug.emotional_beat}</span>
                            )}
                          </div>
                          <p className="scenes-panel-ai-sug-desc">{sug.description}</p>
                          {sug.purpose && (
                            <p className="scenes-panel-ai-sug-purpose">
                              <span className="scenes-panel-ai-sug-purpose-label">Purpose:</span> {sug.purpose}
                            </p>
                          )}
                          <div className="scenes-panel-ai-sug-actions">
                            <button
                              className="scenes-panel-ai-accept"
                              onClick={() => acceptSuggestion(ch.id, sug)}
                            >
                              {'✓'} Add Scene
                            </button>
                            <button
                              className="scenes-panel-ai-dismiss"
                              onClick={() => setAiSuggestions(prev => ({
                                ...prev,
                                [ch.id]: (prev[ch.id] || []).filter((_, j) => j !== si),
                              }))}
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        className="scenes-panel-ai-clear"
                        onClick={() => setAiSuggestions(prev => ({ ...prev, [ch.id]: [] }))}
                      >
                        Clear suggestions
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .scenes-panel { padding: 24px; max-width: 760px; margin: 0 auto; }
        .scenes-panel-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 24px; gap: 16px; flex-wrap: wrap;
        }
        .scenes-panel-title {
          font-family: 'Playfair Display', 'Lora', Georgia, serif;
          font-size: 20px; font-weight: 600; color: var(--text-primary); margin: 0 0 4px;
        }
        .scenes-panel-count {
          font-family: 'DM Mono', monospace; font-size: 10px;
          letter-spacing: 0.1em; color: var(--text-secondary);
        }
        .scenes-panel-empty {
          text-align: center; padding: 48px 24px;
          font-family: 'Lora', Georgia, serif; font-style: italic;
          color: var(--text-secondary); font-size: 14px;
        }

        /* ── Book-level AI button ── */
        .scenes-panel-ai-book-btn {
          background: var(--lala-gold-soft);
          border: 1px solid var(--lala-gold-line);
          border-radius: 6px; padding: 8px 16px;
          font-family: 'DM Mono', monospace; font-size: 10px;
          letter-spacing: 0.08em; color: var(--lala-gold-text);
          cursor: pointer; transition: all 0.15s ease; white-space: nowrap;
        }
        .scenes-panel-ai-book-btn:hover:not(:disabled) {
          border-color: var(--lala-gold);
        }
        .scenes-panel-ai-book-btn:disabled { opacity: 0.6; cursor: wait; }

        /* ── AI error ── */
        .scenes-panel-ai-error {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--danger-bg); border: 1px solid var(--danger-border);
          border-radius: 6px; padding: 10px 14px; margin-bottom: 16px;
          font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--danger-text);
        }
        .scenes-panel-ai-error button {
          background: none; border: none; font-size: 16px;
          color: var(--danger-text); cursor: pointer;
        }

        /* ── Book-wide AI results ── */
        .scenes-panel-ai-book-results {
          background: var(--lala-gold-soft);
          border: 1px solid var(--lala-gold-line);
          border-radius: 8px; padding: 16px; margin-bottom: 24px;
        }
        .scenes-panel-ai-book-label {
          font-family: 'DM Mono', monospace; font-size: 10px;
          letter-spacing: 0.12em; color: var(--lala-gold-text); margin-bottom: 12px;
          text-transform: uppercase;
        }

        /* ── AI card (book-wide) ── */
        .scenes-panel-ai-card {
          background: var(--surface-card);
          border: 1px solid var(--lala-parchment-3);
          border-radius: 6px; padding: 12px 14px; margin-bottom: 10px;
        }
        .scenes-panel-ai-card-head {
          display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px;
        }
        .scenes-panel-ai-card-title {
          font-family: 'Lora', Georgia, serif; font-size: 14px;
          font-weight: 600; color: var(--text-primary);
        }
        .scenes-panel-ai-card-ch {
          font-family: 'DM Mono', monospace; font-size: 9px;
          color: var(--text-secondary); letter-spacing: 0.05em;
        }
        .scenes-panel-ai-card-desc {
          font-family: 'Lora', Georgia, serif; font-size: 12.5px;
          color: var(--text-secondary); line-height: 1.5; margin: 0 0 6px;
        }
        .scenes-panel-ai-card-reason {
          font-family: 'DM Sans', sans-serif; font-size: 11px;
          color: var(--text-secondary); margin: 0 0 6px; font-style: italic;
        }
        .scenes-panel-ai-card-reason-label {
          font-weight: 600; font-style: normal; color: var(--text-secondary);
        }
        .scenes-panel-ai-card-chars {
          display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px;
        }
        .scenes-panel-ai-char-tag {
          font-family: 'DM Mono', monospace; font-size: 9px;
          background: var(--lala-gold-soft); color: var(--lala-gold-text);
          border-radius: 3px; padding: 2px 6px;
        }
        .scenes-panel-ai-card-actions {
          display: flex; gap: 8px;
        }

        /* ── Per-chapter AI plan button ── */
        .scenes-panel-add-row-buttons {
          display: flex; align-items: center; gap: 12px; padding: 4px 0;
        }
        .scenes-panel-ai-plan-btn {
          background: none; border: none;
          font-family: 'DM Mono', monospace; font-size: 9px;
          letter-spacing: 0.08em; color: var(--lala-gold-text);
          cursor: pointer; padding: 8px 0; transition: all 0.12s ease;
        }
        .scenes-panel-ai-plan-btn:hover:not(:disabled) { text-decoration: underline; }
        .scenes-panel-ai-plan-btn:disabled { opacity: 0.5; cursor: wait; }

        /* ── AI suggestions per chapter ── */
        .scenes-panel-ai-suggestions {
          background: var(--lala-gold-soft);
          border: 1px solid var(--lala-gold-line);
          border-radius: 6px; padding: 12px; margin-top: 8px;
        }
        .scenes-panel-ai-label {
          font-family: 'DM Mono', monospace; font-size: 9px;
          letter-spacing: 0.12em; color: var(--lala-gold-text); margin-bottom: 10px;
          text-transform: uppercase;
        }
        .scenes-panel-ai-sug-card {
          background: var(--surface-card);
          border: 1px solid var(--lala-parchment-3);
          border-radius: 5px; padding: 10px 12px; margin-bottom: 8px;
        }
        .scenes-panel-ai-sug-head {
          display: flex; align-items: baseline; gap: 6px; margin-bottom: 4px;
        }
        .scenes-panel-ai-sug-pos {
          font-size: 8px; color: var(--text-secondary);
        }
        .scenes-panel-ai-sug-title {
          font-family: 'Lora', Georgia, serif; font-size: 13px;
          font-weight: 600; color: var(--text-primary);
        }
        .scenes-panel-ai-sug-beat {
          font-family: 'DM Sans', sans-serif; font-size: 10px;
          color: var(--lala-gold-text); font-style: italic; margin-left: auto;
        }
        .scenes-panel-ai-sug-desc {
          font-family: 'Lora', Georgia, serif; font-size: 12px;
          color: var(--text-secondary); line-height: 1.45; margin: 0 0 4px;
        }
        .scenes-panel-ai-sug-purpose {
          font-family: 'DM Sans', sans-serif; font-size: 10.5px;
          color: var(--text-secondary); margin: 0 0 6px; font-style: italic;
        }
        .scenes-panel-ai-sug-purpose-label {
          font-weight: 600; font-style: normal; color: var(--text-secondary);
        }
        .scenes-panel-ai-sug-actions {
          display: flex; gap: 8px;
        }

        /* ── Shared AI action buttons ── */
        .scenes-panel-ai-accept {
          background: var(--success-bg); border: 1px solid var(--success-border);
          border-radius: 4px; padding: 4px 10px;
          font-family: 'DM Mono', monospace; font-size: 9px;
          color: var(--success-text); cursor: pointer; transition: all 0.12s ease;
        }
        .scenes-panel-ai-accept:hover {
          border-color: var(--success);
        }
        .scenes-panel-ai-dismiss {
          background: none; border: none;
          font-family: 'DM Mono', monospace; font-size: 9px;
          color: var(--text-secondary); cursor: pointer;
        }
        .scenes-panel-ai-dismiss:hover { color: var(--text-primary); }
        .scenes-panel-ai-clear {
          background: none; border: none;
          font-family: 'DM Mono', monospace; font-size: 9px;
          color: var(--text-secondary); cursor: pointer;
          padding: 6px 0; margin-top: 4px;
        }
        .scenes-panel-ai-clear:hover { color: var(--text-primary); }

        /* ── Chapter type badge ── */
        .scenes-panel-ch-type {
          font-family: 'DM Mono', monospace; font-size: 8px;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--lala-gold-text); background: var(--lala-gold-soft);
          border-radius: 3px; padding: 1px 5px;
        }

        /* ── Existing styles ── */
        .scenes-panel-chapter { margin-bottom: 2px; }
        .scenes-panel-chapter-btn {
          display: flex; align-items: center; gap: 10px; width: 100%;
          background: none; border: none; border-bottom: 1px solid var(--lala-parchment-2);
          padding: 12px 8px; cursor: pointer; text-align: left;
          transition: background 0.12s ease;
        }
        .scenes-panel-chapter-btn:hover { background: var(--lala-parchment-2); }
        .scenes-panel-ch-num {
          font-family: 'DM Mono', monospace; font-size: 10px;
          color: var(--text-secondary); min-width: 40px;
        }
        .scenes-panel-ch-title {
          flex: 1; font-family: 'Lora', Georgia, serif; font-size: 14px; color: var(--text-primary);
        }
        .scenes-panel-ch-count {
          font-family: 'DM Mono', monospace; font-size: 9px;
          color: var(--text-secondary); letter-spacing: 0.05em;
        }
        .scenes-panel-ch-arrow {
          font-size: 10px; color: var(--text-secondary); min-width: 14px; text-align: center;
        }
        .scenes-panel-scenes {
          padding: 4px 0 12px 52px;
        }
        .scenes-panel-no-scenes {
          font-family: 'Lora', Georgia, serif; font-style: italic;
          font-size: 12px; color: var(--text-secondary); padding: 8px 0;
        }
        .scenes-panel-scene {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 0; font-family: 'Lora', Georgia, serif; font-size: 13px;
        }
        .scenes-panel-scene-num {
          font-family: 'DM Mono', monospace; font-size: 9px;
          color: var(--text-secondary); min-width: 16px;
        }
        .scenes-panel-scene-dinkus {
          font-size: 8px; color: var(--lala-gold); opacity: 0.6;
        }
        .scenes-panel-scene-title {
          color: var(--text-primary); cursor: default; flex: 1;
        }
        .scenes-panel-scene-title:hover { text-decoration: underline dotted var(--text-secondary); }
        .scenes-panel-scene-edit {
          flex: 1; border: none; border-bottom: 1px solid var(--lala-gold);
          background: none; font-family: 'Lora', Georgia, serif; font-size: 13px;
          color: var(--text-primary); padding: 2px 0; outline: none;
        }
        .scenes-panel-scene-del {
          background: none; border: none; font-size: 14px; color: var(--text-secondary);
          cursor: pointer; padding: 2px 4px; opacity: 0; transition: opacity 0.1s ease;
        }
        .scenes-panel-scene:hover .scenes-panel-scene-del { opacity: 1; }
        .scenes-panel-scene-del:hover { color: var(--danger-text); }
        .scenes-panel-scene-gen {
          background: none; border: 1px solid var(--lala-gold-line);
          border-radius: 3px; font-family: 'DM Mono', monospace;
          font-size: 9px; letter-spacing: 0.04em; color: var(--lala-gold-text);
          cursor: pointer; padding: 2px 8px; opacity: 0;
          transition: opacity 0.1s ease, background 0.12s ease;
        }
        .scenes-panel-scene:hover .scenes-panel-scene-gen { opacity: 1; }
        .scenes-panel-scene-gen:hover { background: var(--lala-gold-soft); }

        /* Add scene */
        .scenes-panel-add-btn {
          background: none; border: none; font-family: 'DM Mono', monospace;
          font-size: 9px; letter-spacing: 0.08em; color: var(--text-secondary);
          cursor: pointer; padding: 8px 0; transition: color 0.12s ease;
        }
        .scenes-panel-add-btn:hover { color: var(--lala-gold-text); }
        .scenes-panel-add-row {
          display: flex; align-items: center; gap: 6px; padding: 6px 0;
        }
        .scenes-panel-add-input {
          flex: 1; border: none; border-bottom: 1px solid var(--lala-parchment-3);
          background: none; font-family: 'Lora', Georgia, serif; font-size: 13px;
          color: var(--text-primary); padding: 4px 0; outline: none;
        }
        .scenes-panel-add-input:focus { border-bottom-color: var(--lala-gold); }
        .scenes-panel-add-confirm,
        .scenes-panel-add-cancel {
          background: none; border: none; font-size: 14px;
          cursor: pointer; padding: 2px 4px; color: var(--text-secondary);
        }
        .scenes-panel-add-confirm:hover { color: var(--success-text); }
        .scenes-panel-add-cancel:hover { color: var(--danger-text); }

        @media (max-width: 480px) {
          .scenes-panel { padding: 16px 12px; }
          .scenes-panel-scenes { padding-left: 32px; }
          .scenes-panel-header { flex-direction: column; }
          .scenes-panel-ai-sug-head { flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}
