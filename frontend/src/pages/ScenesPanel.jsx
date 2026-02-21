/**
 * ScenesPanel.jsx
 *
 * Right-panel Scenes tab for the Book Editor.
 * On-demand generation via Claude API — click "Generate" to fetch suggestions.
 * "Add to Chapter →" creates a real pending line via the storyteller API.
 *
 * Usage in StorytellerPage.jsx BookEditor:
 *
 *   import ScenesPanel from './ScenesPanel';
 *
 *   {activeRightTab === 'scenes' && (
 *     <ScenesPanel
 *       bookId={book.id}
 *       chapters={chapters}
 *       onLineAdded={(chapterId, line) => {
 *         // append line to chapters state — same as addLine does
 *         setChapters(prev => prev.map(c =>
 *           c.id === chapterId ? { ...c, lines: [...(c.lines || []), line] } : c
 *         ));
 *         toast('Scene added as pending line');
 *       }}
 *     />
 *   )}
 */

import { useState } from 'react';

const MEMORIES_API    = '/api/v1/memories';
const STORYTELLER_API = '/api/v1/storyteller';

export default function ScenesPanel({ bookId, chapters = [], onLineAdded }) {
  const [scenes, setScenes]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [contextUsed, setContextUsed] = useState(null);
  // Per-scene: which chapter is selected for "Add to Chapter"
  const [selectedChapter, setSelectedChapter] = useState({});
  // Per-scene: adding state
  const [adding, setAdding]       = useState({});
  // Per-scene: added confirmation
  const [added, setAdded]         = useState({});

  async function generate() {
    setLoading(true);
    setError(null);
    setScenes([]);
    setAdded({});
    try {
      const res = await fetch(`${MEMORIES_API}/books/${bookId}/scenes`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setScenes(data.scenes || []);
      setGeneratedAt(data.generated_at);
      setContextUsed(data.context_used);
      // Pre-select chapter_id from suggestion if available
      const preselect = {};
      data.scenes?.forEach((scene, i) => {
        if (scene.chapter_id) preselect[i] = scene.chapter_id;
        else if (chapters.length > 0) preselect[i] = chapters[0].id;
      });
      setSelectedChapter(preselect);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function addToChapter(scene, idx) {
    const chapterId = selectedChapter[idx];
    if (!chapterId) return;

    setAdding(prev => ({ ...prev, [idx]: true }));
    try {
      const res = await fetch(`${STORYTELLER_API}/chapters/${chapterId}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `[SCENE SUGGESTION] ${scene.title} — ${scene.description}`,
          source_tags: ['scene_suggestion'],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add line');

      onLineAdded?.(chapterId, data.line);
      setAdded(prev => ({ ...prev, [idx]: true }));
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(prev => ({ ...prev, [idx]: false }));
    }
  }

  return (
    <div style={s.shell}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.title}>Scene Setter</div>
        <div style={s.subtitle}>On-demand · based on memories + approved lines</div>
      </div>

      {/* Generate button */}
      <button
        style={{
          ...s.generateBtn,
          opacity: loading ? 0.6 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
        onClick={generate}
        disabled={loading}
      >
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <LoadingDots /> Generating…
          </span>
        ) : scenes.length > 0 ? (
          '↺ Regenerate Scenes'
        ) : (
          '✦ Generate Scene Suggestions'
        )}
      </button>

      {/* Context used */}
      {contextUsed && !loading && (
        <div style={s.contextRow}>
          <span>{contextUsed.memories} memories</span>
          <span style={{ color: 'rgba(245,240,232,0.2)' }}>·</span>
          <span>{contextUsed.lines} approved lines</span>
          {generatedAt && (
            <>
              <span style={{ color: 'rgba(245,240,232,0.2)' }}>·</span>
              <span>{new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={s.error}>{error}</div>
      )}

      {/* Empty state */}
      {!loading && !error && scenes.length === 0 && (
        <p style={s.empty}>
          Click Generate to suggest scenes based on your confirmed memories and approved narrative lines.
        </p>
      )}

      {/* Scene cards */}
      {scenes.length > 0 && (
        <div style={s.sceneList}>
          {scenes.map((scene, idx) => {
            const isAdded = !!added[idx];
            return (
            <div key={idx} style={{
              ...s.sceneCard,
              opacity: isAdded ? 0.4 : 1,
              transition: 'opacity 0.3s ease, max-height 0.4s ease',
            }}>

              {/* Added confirmation banner */}
              {isAdded && (
                <div style={s.addedBanner}>
                  <span style={{ fontSize: 12 }}>✓</span>
                  <span>Added to {chapters.find(c => c.id === selectedChapter[idx])?.title || 'chapter'}</span>
                </div>
              )}

              {/* Chapter label */}
              <div style={{
                ...s.chapterLabel,
                textDecoration: isAdded ? 'line-through' : 'none',
              }}>{scene.chapter_hint || 'Scene Suggestion'}</div>

              {/* Title */}
              <div style={{
                ...s.sceneTitle,
                textDecoration: isAdded ? 'line-through' : 'none',
              }}>{scene.title}</div>

              {/* Collapse description/characters/reason when added */}
              {!isAdded && (
                <>
                  {/* Description */}
                  <div style={s.sceneDesc}>{scene.description}</div>

                  {/* Characters */}
                  {scene.characters?.length > 0 && (
                    <div style={s.charRow}>
                      {scene.characters.map(char => (
                        <span key={char} style={s.charChip}>{char}</span>
                      ))}
                    </div>
                  )}

                  {/* Reason */}
                  {scene.reason && (
                    <div style={s.reason}>{scene.reason}</div>
                  )}
                </>
              )}

              {/* Add to chapter controls */}
              {!isAdded ? (
                <div style={s.addRow}>
                  <select
                    value={selectedChapter[idx] || ''}
                    onChange={e => setSelectedChapter(prev => ({ ...prev, [idx]: e.target.value }))}
                    style={s.chapterSelect}
                  >
                    {chapters.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                  <button
                    style={{
                      ...s.addBtn,
                      opacity: adding[idx] ? 0.5 : 1,
                      cursor: adding[idx] ? 'not-allowed' : 'pointer',
                    }}
                    onClick={() => addToChapter(scene, idx)}
                    disabled={adding[idx]}
                  >
                    {adding[idx] ? 'Adding…' : 'Add →'}
                  </button>
                </div>
              ) : null}
            </div>
            );
          }))
        </div>
      )}
    </div>
  );
}

// ── Loading dots ───────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 4, height: 4, borderRadius: '50%',
          background: '#C9A84C', display: 'inline-block',
          animation: 'pulse 1.2s ease-in-out infinite',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </span>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = {
  shell: {
    padding: '18px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  header: {
    marginBottom: 2,
  },
  title: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 17,
    fontStyle: 'italic',
    color: 'rgba(245,240,232,0.9)',
    marginBottom: 3,
  },
  subtitle: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: 'rgba(245,240,232,0.3)',
    letterSpacing: '0.1em',
  },
  generateBtn: {
    width: '100%',
    background: 'rgba(90,110,58,0.12)',
    border: '1px solid rgba(90,110,58,0.3)',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#7A9A4A',
    padding: '10px 14px',
    transition: 'all 0.15s',
  },
  contextRow: {
    display: 'flex',
    gap: 6,
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(245,240,232,0.25)',
    letterSpacing: '0.06em',
    flexWrap: 'wrap',
  },
  error: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: '#B85C38',
    letterSpacing: '0.04em',
    lineHeight: 1.5,
    background: 'rgba(184,92,56,0.08)',
    border: '1px solid rgba(184,92,56,0.2)',
    borderRadius: 2,
    padding: '8px 10px',
  },
  empty: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: 'rgba(245,240,232,0.25)',
    letterSpacing: '0.06em',
    lineHeight: 1.6,
  },
  sceneList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  sceneCard: {
    padding: '12px 0',
    borderBottom: '1px solid rgba(90,110,58,0.12)',
  },
  chapterLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#7A9A4A',
    marginBottom: 4,
  },
  sceneTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(245,240,232,0.85)',
    lineHeight: 1.3,
    marginBottom: 6,
  },
  sceneDesc: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: 'rgba(245,240,232,0.45)',
    lineHeight: 1.6,
    letterSpacing: '0.04em',
    marginBottom: 7,
  },
  charRow: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  charChip: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(245,240,232,0.4)',
    background: 'rgba(90,110,58,0.12)',
    borderRadius: 2,
    padding: '2px 6px',
  },
  reason: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(245,240,232,0.25)',
    letterSpacing: '0.04em',
    lineHeight: 1.5,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  addRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  chapterSelect: {
    flex: 1,
    background: 'rgba(245,240,232,0.05)',
    border: '1px solid rgba(245,240,232,0.1)',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: 'rgba(245,240,232,0.6)',
    padding: '4px 6px',
    cursor: 'pointer',
  },
  addBtn: {
    background: 'rgba(90,110,58,0.2)',
    border: '1px solid rgba(90,110,58,0.3)',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.08em',
    color: '#7A9A4A',
    padding: '4px 10px',
    whiteSpace: 'nowrap',
    transition: 'all 0.12s',
  },
  addedConfirm: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: '#4A7C59',
    letterSpacing: '0.08em',
    marginTop: 4,
  },
  addedBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.08em',
    color: '#4A7C59',
    background: 'rgba(74,124,89,0.12)',
    border: '1px solid rgba(74,124,89,0.25)',
    borderRadius: 2,
    padding: '6px 10px',
    marginBottom: 6,
  },
};
