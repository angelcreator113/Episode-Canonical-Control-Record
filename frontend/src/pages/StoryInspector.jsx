import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { PHASE_COLORS, PHASE_LABELS, TYPE_ICONS, WORLD_LABELS, getReadingTime, API_BASE } from './storyEngineConstants';

// ─── Scene Pulse — emotional feedback ────────────────────────────────────────
function ScenePulse({ story }) {
  const text = story?.text || '';
  const words = text.split(/\s+/).filter(Boolean);
  const totalWords = words.length;

  // Simple heuristic tone analysis based on text content
  const tensionWords = ['but', 'however', 'yet', 'suddenly', 'despite', 'fear', 'danger', 'risk', 'threat', 'worried', 'anxious', 'nervous', 'tense', 'sharp', 'cold', 'dark'];
  const calmWords = ['gently', 'softly', 'quietly', 'peace', 'warm', 'light', 'morning', 'breath', 'slow', 'calm', 'still', 'easy'];
  const internalWords = ['thought', 'felt', 'wondered', 'remembered', 'knew', 'mind', 'heart', 'believed', 'imagined', 'realized'];
  const dialogueCount = (text.match(/[""][^""]*[""]|"[^"]*"/g) || []).length;

  const lowerText = text.toLowerCase();
  const tensionScore = tensionWords.reduce((s, w) => s + (lowerText.split(w).length - 1), 0);
  const calmScore = calmWords.reduce((s, w) => s + (lowerText.split(w).length - 1), 0);
  const internalScore = internalWords.reduce((s, w) => s + (lowerText.split(w).length - 1), 0);

  const intensity = totalWords > 0 ? Math.min(100, Math.round((tensionScore / (totalWords / 100)) * 15)) : 0;
  const tone = tensionScore > calmScore * 1.5 ? 'Tension building' : calmScore > tensionScore * 1.5 ? 'Calm' : 'Controlled';
  const focus = internalScore > dialogueCount * 1.5 ? 'Internal' : dialogueCount > internalScore * 1.5 ? 'Relational' : 'External';

  const toneColor = tone === 'Tension building' ? '#B85C38' : tone === 'Calm' ? '#4A9B6F' : '#B8962E';

  return (
    <div className="se-scene-pulse">
      <div className="se-pulse-row">
        <span className="se-pulse-label">Tone</span>
        <span className="se-pulse-value" style={{ background: `${toneColor}12`, color: toneColor }}>{tone}</span>
      </div>
      <div className="se-pulse-row">
        <span className="se-pulse-label">Intensity</span>
        <div className="se-pulse-bar">
          <div className="se-pulse-bar-fill" style={{ width: `${intensity}%`, background: intensity > 60 ? '#B85C38' : intensity > 30 ? '#B8962E' : '#4A9B6F' }} />
        </div>
        <span style={{ fontSize: 10, color: '#9d968d', minWidth: 32, textAlign: 'right' }}>{intensity > 60 ? 'High' : intensity > 30 ? 'Medium' : 'Low'}</span>
      </div>
      <div className="se-pulse-row">
        <span className="se-pulse-label">Focus</span>
        <span className="se-pulse-value">{focus}</span>
      </div>
    </div>
  );
}

// ─── Next Move Suggestion ────────────────────────────────────────────────────
function NextMoveSuggestion({ story, characterKey }) {
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSuggestion(null);
    if (!story?.id || !characterKey) return;
    setLoading(true);
    fetch(`${API_BASE}/story-health/story-sparks/${characterKey}`)
      .then(r => r.json())
      .then(d => {
        const sparks = d.sparks || [];
        if (sparks.length > 0) {
          setSuggestion(sparks[0].suggestion || sparks[0].title || 'Continue developing the current scene arc.');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [story?.id, characterKey]);

  return (
    <div className="se-next-move">
      <div className="se-next-move-header">
        <span>{'🔮'}</span>
        <span>Suggested Next Move</span>
      </div>
      {loading ? (
        <div className="se-next-move-loading">Reading the story arc…</div>
      ) : suggestion ? (
        <div className="se-next-move-text">{suggestion}</div>
      ) : (
        <div className="se-next-move-text">Select a story to see suggestions.</div>
      )}
    </div>
  );
}

// ─── Lazy-loaded inspector panels (#6) ────────────────────────────────────────
const ArcTrackingPanel = lazy(() => import('../components/ArcTrackingPanel'));

// ─── Stats dashboard ──────────────────────────────────────────────────────────
function StatsDashboard({ tasks, stories, approvedStories, savedStories }) {
  const storyValues = Object.values(stories);
  const totalWords = storyValues.reduce((s, st) => s + (st.word_count || st.text?.split(/\s+/).length || 0), 0);
  const generated = storyValues.length;
  const approved = approvedStories.length;
  const queued = savedStories.filter(n => !approvedStories.includes(n)).length;
  const completion = tasks.length > 0 ? Math.round((approved / tasks.length) * 100) : 0;

  const wordsByPhase = {};
  storyValues.forEach(s => {
    const phase = s.phase || 'unknown';
    wordsByPhase[phase] = (wordsByPhase[phase] || 0) + (s.word_count || s.text?.split(/\s+/).length || 0);
  });

  return (
    <div className="se-stats-dashboard">
      <div className="se-stats-grid">
        <div className="se-stat-card">
          <div className="se-stat-value">{totalWords.toLocaleString()}</div>
          <div className="se-stat-label">Words Written</div>
        </div>
        <div className="se-stat-card">
          <div className="se-stat-value">{generated}</div>
          <div className="se-stat-label">Generated</div>
        </div>
        <div className="se-stat-card se-stat-approved">
          <div className="se-stat-value">{approved}</div>
          <div className="se-stat-label">Approved</div>
        </div>
        <div className="se-stat-card se-stat-queued">
          <div className="se-stat-value">{queued}</div>
          <div className="se-stat-label">In Queue</div>
        </div>
        <div className="se-stat-card se-stat-completion">
          <div className="se-stat-value">{completion}%</div>
          <div className="se-stat-label">Complete</div>
        </div>
      </div>
      {Object.keys(wordsByPhase).length > 0 && (
        <div className="se-stats-phase-row">
          {Object.entries(wordsByPhase).map(([phase, words]) => (
            <div key={phase} className="se-stats-phase-item">
              <span className="se-stats-phase-dot" style={{ background: PHASE_COLORS[phase] }} />
              <span className="se-stats-phase-name">{PHASE_LABELS[phase] || phase}</span>
              <span className="se-stats-phase-words">{words.toLocaleString()} words</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Story Sparks panel (lazy-loaded on demand) ──────────────────────────────
function StorySparksPanel({ characterKey }) {
  const [sparks, setSparks] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSparks([]);
    setOpen(false);
  }, [characterKey]);

  const loadSparks = useCallback(() => {
    if (sparks.length) { setOpen(!open); return; }
    setOpen(true); setLoading(true);
    fetch(`${API_BASE}/story-health/story-sparks/${characterKey}`)
      .then(r => r.json()).then(d => setSparks(d.sparks || []))
      .catch(err => console.warn('story sparks:', err.message))
      .finally(() => setLoading(false));
  }, [characterKey, sparks.length, open]);

  return (
    <section className="se-insp-section">
      <button className="se-insp-toggle" onClick={loadSparks}>
        <span>Story Sparks</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="se-insp-sparks">
          {loading ? <div className="se-insp-dim">Generating…</div>
            : sparks.length === 0 ? <div className="se-insp-dim">No sparks yet</div>
            : sparks.map((s, i) => (
              <div key={s.title || i} className="se-insp-spark">
                <div className="se-insp-spark-type">{s.type || 'Spark'}</div>
                <div className="se-insp-spark-text">{s.suggestion || s.title || JSON.stringify(s)}</div>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}

// ─── StoryInspector (right panel) ─────────────────────────────────────────────
export default function StoryInspector({
  activeTask, activeStory, selectedChar, char,
  tasks, stories, approvedStories, savedStories,
  consistencyConflicts, worldToggles, handleWorldToggle,
  writeMode, setWriteMode, readingMode, setReadingMode,
  handleSaveForLater, savingForLater,
  setApproveConfirm, handleReject,
  mobileInspector,
}) {
  return (
    <aside className={`se-inspector ${mobileInspector ? 'se-drawer-open' : ''}`}>
      {/* Story info */}
      {activeTask && (
        <section className="se-insp-section">
          <div className="se-insp-label">Story Info</div>
          <div className="se-insp-row">
            <span className="se-insp-key">Story</span>
            <span className="se-insp-val">#{activeTask.story_number}</span>
          </div>
          <div className="se-insp-row">
            <span className="se-insp-key">Phase</span>
            <span className="se-insp-val" style={{ color: PHASE_COLORS[activeTask.phase] || '#888' }}>
              {PHASE_LABELS[activeTask.phase] || activeTask.phase || '—'}
            </span>
          </div>
          <div className="se-insp-row">
            <span className="se-insp-key">Type</span>
            <span className="se-insp-val">{TYPE_ICONS[activeTask.story_type] || '○'} {activeTask.story_type?.replace(/_/g, ' ') || '—'}</span>
          </div>
          {activeStory && (
            <>
              <div className="se-insp-row">
                <span className="se-insp-key">Words</span>
                <span className="se-insp-val">{activeStory.word_count?.toLocaleString()}</span>
              </div>
              <div className="se-insp-row">
                <span className="se-insp-key">Reading</span>
                <span className="se-insp-val">{getReadingTime(activeStory.word_count)}</span>
              </div>
            </>
          )}
          {activeTask.task && (
            <div className="se-insp-brief">
              <div className="se-insp-key">Task</div>
              <div className="se-insp-brief-text">{activeTask.task}</div>
            </div>
          )}
          {activeTask.obstacle && (
            <div className="se-insp-brief">
              <div className="se-insp-key">Obstacle</div>
              <div className="se-insp-brief-text">{activeTask.obstacle}</div>
            </div>
          )}
        </section>
      )}

      {/* Scene Pulse — emotional feedback */}
      {activeStory && (
        <section className="se-insp-section">
          <div className="se-insp-label">Scene Pulse</div>
          <ScenePulse story={activeStory} />
        </section>
      )}

      {/* Stats */}
      <section className="se-insp-section">
        <div className="se-insp-label">Stats</div>
        <StatsDashboard
          tasks={tasks}
          stories={stories}
          approvedStories={approvedStories}
          savedStories={savedStories}
        />
      </section>

      {/* Arc Tracking — lazy loaded (#6) */}
      {selectedChar && (
        <section className="se-insp-section">
          <Suspense fallback={<div className="se-insp-dim">Loading arc tracking…</div>}>
            <ArcTrackingPanel
              characterKey={selectedChar}
              characterName={char?.display_name || selectedChar}
            />
          </Suspense>
        </section>
      )}

      {/* Worlds */}
      {Object.keys(worldToggles).length > 0 && (
        <section className="se-insp-section">
          <div className="se-insp-label">Worlds</div>
          <div className="se-insp-worlds">
            {Object.entries(worldToggles).map(([worldId, isOpen]) => (
              <button
                key={worldId}
                className={`se-world-pill ${isOpen ? 'open' : 'closed'}`}
                onClick={() => handleWorldToggle(worldId)}
              >
                <span className="se-world-pill-name">{WORLD_LABELS[worldId] || worldId}</span>
                <span className={`se-world-pill-dot ${isOpen ? 'open' : 'closed'}`} />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Story Sparks — lazy loaded on demand (#6) */}
      {selectedChar && <StorySparksPanel characterKey={selectedChar} />}

      {/* Consistency conflicts */}
      {consistencyConflicts?.length > 0 && (
        <section className="se-insp-section se-insp-conflicts">
          <div className="se-insp-label">Conflicts</div>
          {consistencyConflicts.map((c, i) => (
            <div key={i} className={`se-insp-conflict se-insp-conflict--${c.severity}`}>
              <span>Story {c.story_number}</span>
              <span>{c.description}</span>
            </div>
          ))}
        </section>
      )}

      {/* Next Move Suggestion */}
      {selectedChar && <NextMoveSuggestion story={activeStory} characterKey={selectedChar} />}

      {/* Keyboard hints */}
      <div className="se-insp-shortcuts">
        <span>↑↓ Nav</span>
        <span>F Read</span>
        <span>⌘S Save</span>
        <span>⌘↵ Approve</span>
      </div>
    </aside>
  );
}
