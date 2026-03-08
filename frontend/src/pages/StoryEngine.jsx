import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import StoryReviewPanel from './StoryReviewPanel';
import WriteModeAIWriter from '../components/WriteModeAIWriter';
import './StoryEngine.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

// ─── Reading time helper ──────────────────────────────────────────────────────
const getReadingTime = (wordCount) => {
  if (!wordCount) return null;
  const mins = Math.ceil(wordCount / 250);
  return mins < 1 ? '< 1 min' : `${mins} min read`;
};

// ─── Toast notification system ────────────────────────────────────────────────
let toastIdCounter = 0;

function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="se-toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`se-toast se-toast-${t.type}`}>
          <span className="se-toast-icon">
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'info' ? 'ℹ' : '⚠'}
          </span>
          <span className="se-toast-msg">{t.message}</span>
          <button className="se-toast-close" onClick={() => onDismiss(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

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

// ─── Fallback characters (used if DB fetch fails) ────────────────────────────
const FALLBACK_CHARACTERS = {
  justawoman: { display_name: 'JustAWoman', icon: '♛', role_type: 'special',  world: 'book-1',    color: '#9a7d1e' },
  david:      { display_name: 'David',      icon: '◈',  role_type: 'pressure', world: 'book-1',    color: '#c0392b' },
  dana:       { display_name: 'Dana',       icon: '◉',  role_type: 'support',  world: 'book-1',    color: '#0d9668' },
  chloe:      { display_name: 'Chloe',      icon: '◎',  role_type: 'mirror',   world: 'book-1',    color: '#7c3aed' },
  jade:       { display_name: 'Jade',       icon: '◆',  role_type: 'shadow',   world: 'book-1',    color: '#546678' },
  lala:       { display_name: 'Lala',       icon: '✦',  role_type: 'special',  world: 'lalaverse', color: '#d63384' },
};

// ─── Role-type → color mapping for dynamic characters ─────────────────────────
const ROLE_COLORS = {
  protagonist: '#9a7d1e',
  special:     '#9a7d1e',
  pressure:    '#c0392b',
  mirror:      '#7c3aed',
  support:     '#0d9668',
  shadow:      '#546678',
};

const PHASE_COLORS = {
  establishment: '#9a7d1e',
  pressure:      '#c0392b',
  crisis:        '#b91c1c',
  integration:   '#0d9668',
};

const PHASE_LABELS = {
  establishment: 'Establishment',
  pressure:      'Pressure',
  crisis:        'Crisis',
  integration:   'Integration',
};

const TYPE_ICONS = {
  internal:  '◎',
  collision: '⊕',
  wrong_win: '◇',
};

// ─── World toggle ─────────────────────────────────────────────────────────────
const WORLD_LABELS = {
  'book-1': 'Book 1 World',
  'lalaverse': 'LalaVerse',
};

function WorldToggle({ worlds, onToggle }) {
  return (
    <div className="se-world-toggles">
      {Object.entries(worlds).map(([worldId, open]) => (
        <div key={worldId} className={`se-world-toggle ${open ? 'open' : 'closed'}`}>
          <div className="se-world-toggle-label">
            {WORLD_LABELS[worldId] || worldId}
          </div>
          <div className="se-world-toggle-status">
            New characters {open ? 'open' : 'locked'}
          </div>
          <button
            className={`se-world-toggle-btn ${open ? 'open' : 'closed'}`}
            onClick={() => onToggle(worldId)}
          >
            {open ? 'OPEN' : 'LOCKED'}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Searchable character dropdown ────────────────────────────────────────────
const WORLD_SHORT = { 'book-1': 'B1', lalaverse: 'LV' };

function CharacterSelector({ characters, selectedChar, onSelect, loading }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Auto-focus search when opened
  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  const selected = characters[selectedChar];

  // Group and filter characters
  const grouped = useMemo(() => {
    const groups = {};
    for (const [key, c] of Object.entries(characters)) {
      const w = c.world || 'unknown';
      if (!groups[w]) groups[w] = [];
      groups[w].push([key, c]);
    }
    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      const filtered = {};
      for (const [world, chars] of Object.entries(groups)) {
        const matches = chars.filter(([, c]) => c.display_name.toLowerCase().includes(q));
        if (matches.length) filtered[world] = matches;
      }
      return filtered;
    }
    return groups;
  }, [characters, search]);

  const worldOrder = Object.keys(grouped).sort();
  const totalCount = Object.values(characters).length;

  if (loading) {
    return <div className="se-char-selector"><div className="se-char-loading">Loading characters…</div></div>;
  }

  return (
    <div className="se-char-selector" ref={dropdownRef}>
      {/* Trigger button — shows selected character */}
      <button
        className="se-char-trigger"
        onClick={() => setOpen(prev => !prev)}
        style={{ '--char-color': selected?.color }}
      >
        {selected?.portrait_url ? (
          <img className="se-char-portrait" src={selected.portrait_url} alt="" />
        ) : (
          <span className="se-char-icon">{selected?.icon || '◇'}</span>
        )}
        <span className="se-char-trigger-name">{selected?.display_name || 'Select character'}</span>
        <span className="se-char-trigger-world">{WORLD_SHORT[selected?.world] || selected?.world?.slice(0, 3)?.toUpperCase()}</span>
        <span className="se-char-trigger-count">{totalCount} characters</span>
        <span className={`se-char-trigger-arrow ${open ? 'open' : ''}`}>▾</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="se-char-dropdown">
          <div className="se-char-search-row">
            <input
              ref={searchRef}
              className="se-char-search"
              type="text"
              placeholder="Search characters…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setOpen(false); setSearch(''); }
                // Enter to select first match
                if (e.key === 'Enter' && worldOrder.length > 0) {
                  const firstGroup = grouped[worldOrder[0]];
                  if (firstGroup?.length) {
                    onSelect(firstGroup[0][0]);
                    setOpen(false);
                    setSearch('');
                  }
                }
              }}
            />
          </div>
          <div className="se-char-dropdown-list">
            {worldOrder.length === 0 ? (
              <div className="se-char-dropdown-empty">No characters match "{search}"</div>
            ) : (
              worldOrder.map(world => (
                <div key={world} className="se-char-dropdown-group">
                  <div className="se-char-dropdown-group-label">
                    {WORLD_LABELS[world] || world}
                    <span className="se-char-dropdown-group-count">{grouped[world].length}</span>
                  </div>
                  {grouped[world].map(([key, c]) => (
                    <button
                      key={key}
                      className={`se-char-dropdown-item ${selectedChar === key ? 'active' : ''}`}
                      style={{ '--char-color': c.color }}
                      onClick={() => { onSelect(key); setOpen(false); setSearch(''); }}
                    >
                      {c.portrait_url ? (
                        <img className="se-char-portrait" src={c.portrait_url} alt="" />
                      ) : (
                        <span className="se-char-icon">{c.icon}</span>
                      )}
                      <span className="se-char-dropdown-name">{c.display_name}</span>
                      <span className="se-char-dropdown-role">{c.role_type || ''}</span>
                      {selectedChar === key && <span className="se-char-dropdown-check">✓</span>}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Arc progress bar (with status dots) ──────────────────────────────────────
function ArcProgress({ tasks, approvedStories, savedStories = [], stories = {} }) {
  const phases = ['establishment', 'pressure', 'crisis', 'integration'];
  const phaseRanges = { establishment: [1,10], pressure: [11,25], crisis: [26,40], integration: [41,50] };

  return (
    <div className="se-arc-progress">
      {phases.map((phase) => {
        const [start, end] = phaseRanges[phase];
        const total = end - start + 1;
        const approved = approvedStories.filter((n) => n >= start && n <= end).length;
        const pct = Math.round((approved / total) * 100);
        return (
          <div key={phase} className="se-arc-phase">
            <div className="se-arc-phase-label" style={{ color: PHASE_COLORS[phase] }}>
              {PHASE_LABELS[phase]}
            </div>
            <div className="se-arc-phase-bar">
              <div
                className="se-arc-phase-fill"
                style={{ width: `${pct}%`, background: PHASE_COLORS[phase] }}
              />
            </div>
            <div className="se-arc-dots">
              {Array.from({ length: total }, (_, i) => {
                const num = start + i;
                const isApproved = approvedStories.includes(num);
                const isSaved = savedStories.includes(num) && !isApproved;
                const isGenerated = stories[num] && !isApproved && !isSaved;
                return (
                  <span
                    key={num}
                    className={`se-arc-dot ${isApproved ? 'approved' : isSaved ? 'saved' : isGenerated ? 'generated' : ''}`}
                    title={`Story ${num}${isApproved ? ' ✓' : isSaved ? ' (saved)' : isGenerated ? ' (draft)' : ''}`}
                    style={isApproved ? { background: PHASE_COLORS[phase] } : undefined}
                  />
                );
              })}
            </div>
            <div className="se-arc-phase-count">{approved}/{total}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Task card (story brief before writing) ───────────────────────────────────
function TaskCard({ task, isApproved, isSaved, isActive, onGenerate, onSelect, charColor, generating, batchMode, batchSelected, onBatchToggle }) {
  const cardRef = useRef(null);

  // Auto-scroll into view when active
  useEffect(() => {
    if (isActive && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isActive]);

  return (
    <div
      ref={cardRef}
      className={`se-task-card ${isActive ? 'active' : ''} ${isApproved ? 'approved' : ''} ${isSaved ? 'saved' : ''}`}
      style={{ '--char-color': charColor }}
      onClick={() => onSelect(task)}
    >
      {batchMode && !isApproved && (
        <label className="se-batch-checkbox" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={batchSelected?.has(task.story_number) || false}
            onChange={() => onBatchToggle?.(task.story_number)}
          />
        </label>
      )}
      <div className="se-task-number">
        {isApproved
          ? <span className="se-task-check">✓</span>
          : isSaved
            ? <span className="se-task-saved-icon" title="Saved — review later">📥</span>
            : <span>{task.story_number}</span>
        }
      </div>
      <div className="se-task-body">
        <div className="se-task-title">{task.title}</div>
        <div className="se-task-meta">
          <span className="se-task-type" title={task.story_type}>
            {TYPE_ICONS[task.story_type]}
          </span>
          <span
            className="se-task-phase"
            style={{ color: PHASE_COLORS[task.phase] }}
          >
            {PHASE_LABELS[task.phase]}
          </span>
          {isSaved && !isApproved && (
            <span className="se-task-saved-badge">saved</span>
          )}
          {task.new_character && (
            <span className="se-task-new-char">+ {task.new_character_name}</span>
          )}
        </div>
        <div className="se-task-excerpt">{task.task}</div>
      </div>
      {!isApproved && (
        <button
          className="se-task-generate-btn"
          onClick={(e) => { e.stopPropagation(); onGenerate(task); }}
          disabled={generating}
        >
          {generating ? 'Writing…' : isSaved ? 'Rewrite' : 'Write'}
        </button>
      )}
    </div>
  );
}

// ─── Story reader / editor panel ──────────────────────────────────────────────
function StoryPanel({
  story, task, charColor, charName,
  onApprove, onReject, onEdit, onCheckConsistency,
  onSaveForLater, savingForLater,
  consistencyConflicts, consistencyLoading,
  therapyMemories, therapyLoading,
  onAddToRegistry,
  registryUpdate,
  readingMode, onToggleReadingMode,
  writeMode, onToggleWriteMode,
  onNavigateStory, hasPrev, hasNext,
  onExportStory,
  onEvaluate,
  charObj, selectedCharKey, activeWorld, allCharacters, onSelectChar,
}) {
  const editing = writeMode;
  const setEditing = onToggleWriteMode;
  const [editText, setEditText] = useState(story?.text || '');
  const [showAiSidebar, setShowAiSidebar] = useState(false);
  const textareaRef = useRef(null);
  const prevStoryRef = useRef(story?.story_number);

  useEffect(() => {
    setEditText(story?.text || '');
    // Only exit edit mode when navigating to a different story, not on initial mount
    if (prevStoryRef.current != null && prevStoryRef.current !== story?.story_number) {
      if (onToggleWriteMode) onToggleWriteMode(false);
    }
    prevStoryRef.current = story?.story_number;
  }, [story]);

  if (!story && !task) return (
    <div className="se-story-panel se-story-empty">
      <div className="se-story-empty-icon">◎</div>
      <div className="se-story-empty-text">Select a story to read or generate one.</div>
    </div>
  );

  if (task && !story) return (
    <div className="se-story-panel se-story-brief">
      <div className="se-story-brief-header" style={{ borderColor: charColor }}>
        <div className="se-story-brief-num">Story {task.story_number}</div>
        <div className="se-story-brief-title">{task.title}</div>
        <div className="se-story-brief-phase" style={{ color: PHASE_COLORS[task.phase] }}>
          {PHASE_LABELS[task.phase]} · {task.story_type}
        </div>
      </div>
      <div className="se-story-brief-grid">
        <div className="se-story-brief-field">
          <div className="se-story-brief-label">Task</div>
          <div className="se-story-brief-value">{task.task}</div>
        </div>
        <div className="se-story-brief-field">
          <div className="se-story-brief-label">Obstacle</div>
          <div className="se-story-brief-value">{task.obstacle}</div>
        </div>
        <div className="se-story-brief-field">
          <div className="se-story-brief-label">Strength Weaponized</div>
          <div className="se-story-brief-value">{task.strength_weaponized}</div>
        </div>
        <div className="se-story-brief-field">
          <div className="se-story-brief-label">Opening Line</div>
          <div className="se-story-brief-value se-story-brief-opening">"{task.opening_line}"</div>
        </div>
      </div>
      {task.new_character && (
        <div className="se-story-brief-new-char">
          <span className="se-story-brief-label">New Character</span>
          <span>{task.new_character_name} — {task.new_character_role}</span>
        </div>
      )}
      <div className="se-story-brief-therapy">
        <div className="se-story-brief-label">Therapy Seeds</div>
        {(task.therapy_seeds || []).map((seed, i) => (
          <div key={i} className="se-therapy-seed">{seed}</div>
        ))}
      </div>
      <div style={{ padding: '16px 20px', borderTop: '1px solid #e8e4d8', display: 'flex', gap: 10 }}>
        <button
          className="se-btn"
          style={{ background: '#3D7A9B', color: '#fff', padding: '8px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none' }}
          onClick={() => onEvaluate?.({ task: task.task, title: task.title, story_number: task.story_number })}
          title="Evaluate with multi-voice scoring"
        >
          📊 Evaluate
        </button>
      </div>
    </div>
  );

  return (
    <div className={`se-story-panel ${readingMode ? 'se-reading-mode' : ''}`}>
      {/* Header */}
      <div className="se-story-header" style={{ borderBottomColor: charColor }}>
        <div className="se-story-header-left">
          {/* Prev/Next navigation */}
          <div className="se-story-nav-row">
            <button
              className="se-btn se-btn-nav"
              onClick={() => onNavigateStory?.(-1)}
              disabled={!hasPrev}
              title="Previous story (←)"
            >
              ‹ Prev
            </button>
            <div className="se-story-header-num">Story {story.story_number}</div>
            <button
              className="se-btn se-btn-nav"
              onClick={() => onNavigateStory?.(1)}
              disabled={!hasNext}
              title="Next story (→)"
            >
              Next ›
            </button>
          </div>
          <div className="se-story-header-title">{story.title}</div>
          <div className="se-story-header-meta">
            <span style={{ color: PHASE_COLORS[story.phase] }}>{PHASE_LABELS[story.phase]}</span>
            <span>·</span>
            <span>{TYPE_ICONS[story.story_type]} {story.story_type}</span>
            <span>·</span>
            <span>{story.word_count?.toLocaleString() || '—'} words</span>
            {story.word_count > 0 && (
              <>
                <span>·</span>
                <span className="se-reading-time">{getReadingTime(story.word_count)}</span>
              </>
            )}
          </div>
        </div>
        <div className="se-story-header-actions">
          {!editing && (
            <>
              <button
                className="se-btn se-btn-reading-mode"
                onClick={() => onToggleReadingMode?.()}
                title={readingMode ? 'Exit reading mode (Esc)' : 'Reading mode (F)'}
              >
                {readingMode ? '⊟' : '⊞'}
              </button>
              <button
                className="se-btn se-btn-export"
                onClick={() => onExportStory?.(story)}
                title="Copy or download story"
              >
                ↗ Export
              </button>
              <button className="se-btn se-btn-edit" onClick={() => setEditing(true)}>Edit</button>
              <button
                className="se-btn se-btn-consistency"
                onClick={() => onCheckConsistency(story)}
                disabled={consistencyLoading}
              >
                {consistencyLoading ? '…' : 'Check'}
              </button>
              <button className="se-btn se-btn-reject" onClick={() => onReject(story)}>Reject</button>
              <button
                className="se-btn se-btn-save-later"
                onClick={() => onSaveForLater(story)}
                disabled={savingForLater}
              >
                {savingForLater ? 'Saving…' : '📥 Save for Later'}
              </button>
              <button
                className="se-btn"
                style={{ background: '#3D7A9B', color: '#fff' }}
                onClick={() => onEvaluate?.(story)}
                title="Evaluate with multi-voice scoring"
              >
                📊 Evaluate
              </button>
              <button
                className="se-btn se-btn-approve"
                style={{ background: charColor }}
                onClick={() => onApprove(story)}
              >
                Approve
              </button>
            </>
          )}
          {editing && (
            <>
              <button className="se-btn se-btn-cancel" onClick={() => { setEditing(false); setEditText(story.text); }}>Cancel</button>
              <span className="se-edit-wordcount">{editText.split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
              <button
                className="se-btn se-btn-approve"
                style={{ background: charColor }}
                onClick={() => { onEdit(story, editText); setEditing(false); }}
              >
                Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* New character alert */}
      {story.new_character && story.new_character_name && (
        <div className="se-new-char-alert">
          <span className="se-new-char-icon">+</span>
          <span>New character introduced: <strong>{story.new_character_name}</strong> — {story.new_character_role}</span>
          <button
            className="se-new-char-approve"
            onClick={() => onAddToRegistry && onAddToRegistry(story)}
          >
            Add to Registry
          </button>
          <button
            className="se-new-char-reject"
            onClick={() => {/* Story Only — dismiss alert */}}
          >
            Story Only
          </button>
        </div>
      )}

      {/* Consistency conflicts */}
      {consistencyConflicts?.length > 0 && (
        <div className="se-conflicts">
          <div className="se-conflicts-title">⚠ Downstream Conflicts</div>
          {consistencyConflicts.map((c, i) => (
            <div key={i} className={`se-conflict se-conflict-${c.severity}`}>
              <span className="se-conflict-story">Story {c.story_number}</span>
              <span className="se-conflict-type">{c.conflict_type}</span>
              <span className="se-conflict-desc">{c.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Story text */}
      <div className="se-story-body">
        {editing ? (
          <div className="se-edit-container">
            <textarea
              ref={textareaRef}
              className="se-story-editor"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              spellCheck
            />
            {/* Mobile toggle for AI sidebar */}
            <button
              className="se-ai-sidebar-toggle"
              onClick={() => setShowAiSidebar(v => !v)}
              title={showAiSidebar ? 'Hide AI tools' : 'Show AI tools'}
            >
              {showAiSidebar ? '✕' : '✦'}
            </button>
            <div className={`se-ai-writer-sidebar${showAiSidebar ? ' se-ai-sidebar-open' : ''}`}>
              <WriteModeAIWriter
                chapterId={String(story?.story_number || task?.story_number || '')}
                bookId={activeWorld || ''}
                selectedCharacter={charObj ? {
                  id: charObj.id || selectedCharKey,
                  name: charObj.display_name || charName,
                  selected_name: charObj.display_name || charName,
                  type: charObj.role_type,
                  role: charObj.role_type,
                } : null}
                currentProse={editText}
                chapterContext={task ? {
                  scene_goal: task.task,
                  theme: task.title,
                  emotional_arc_start: task.phase,
                  emotional_arc_end: '',
                  pov: charName || '',
                } : {}}
                onInsert={(text) => {
                  const ta = textareaRef.current;
                  if (ta) {
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const before = editText.slice(0, start);
                    const after = editText.slice(end);
                    setEditText(before + text + after);
                    setTimeout(() => {
                      ta.selectionStart = ta.selectionEnd = start + text.length;
                      ta.focus();
                    }, 0);
                  } else {
                    setEditText(prev => prev + '\n\n' + text);
                  }
                }}
                getSelectedText={() => {
                  const ta = textareaRef.current;
                  if (ta && ta.selectionStart !== ta.selectionEnd) {
                    return editText.slice(ta.selectionStart, ta.selectionEnd);
                  }
                  return '';
                }}
                characters={allCharacters ? Object.entries(allCharacters).map(([key, c]) => ({
                  ...c, id: c.id || key, character_key: key, name: c.display_name,
                })) : []}
                onSelectCharacter={(c) => onSelectChar?.(c?.character_key || c?.id)}
              />
            </div>
          </div>
        ) : (
          <div className="se-story-text">
            {(story.text || '').split('\n').map((para, i) => (
              para.trim()
                ? <p key={i} className="se-story-para">{para}</p>
                : <div key={i} className="se-story-spacer" />
            ))}
          </div>
        )}
      </div>

      {/* Therapy panel (hidden during editing) */}
      {!editing && therapyMemories?.length > 0 && (
        <div className="se-therapy-panel">
          <div className="se-therapy-title">Therapy Room Feeds</div>
          {therapyMemories.map((m, i) => (
            <div key={i} className="se-therapy-memory">
              <span className="se-therapy-category">{m.category?.replace(/_/g, ' ')}</span>
              <span className="se-therapy-statement">{m.statement}</span>
            </div>
          ))}
          {therapyLoading && <div className="se-therapy-loading">Extracting memories…</div>}
        </div>
      )}

      {/* Registry feedback notification (hidden during editing) */}
      {!editing && registryUpdate && (
        <div className="se-registry-update">
          <span className="se-registry-icon">🔄</span>
          <span className="se-registry-text">{registryUpdate}</span>
        </div>
      )}

      {/* Persistence bridge — save / approve / reject to DB (hidden during editing) */}
      {story && !editing && (
        <StoryReviewPanel
          story={story}
          characterKey={story.character_key}
          taskBrief={task}
          charColor={charColor}
          onApproved={(saved) => { console.log('Story approved & persisted', saved.id); onApprove(story); }}
          onRejected={(saved) => { console.log('Story rejected & persisted', saved.id); onReject(story); }}
          onSaved={(saved)    => { console.log('Story saved', saved.id); }}
        />
      )}
    </div>
  );
}

// ─── Main StoryEngine component ───────────────────────────────────────────────
export default function StoryEngine() {
  const navigate = useNavigate();

  // Dynamic characters from DB
  const [CHARACTERS, setCHARACTERS] = useState(FALLBACK_CHARACTERS);
  const [charsLoading, setCharsLoading] = useState(true);
  const [worldsList, setWorldsList] = useState([]);

  // Character selection — restore from localStorage on refresh
  const [selectedChar, setSelectedChar]       = useState(() => {
    try { return localStorage.getItem('se_selectedChar') || ''; } catch { return ''; }
  });
  const [activeWorld, setActiveWorld]         = useState(() => {
    try { return localStorage.getItem('se_activeWorld') || 'book-1'; } catch { return 'book-1'; }
  });

  // Persist selectedChar + activeWorld to localStorage
  useEffect(() => {
    if (selectedChar) try { localStorage.setItem('se_selectedChar', selectedChar); } catch {}
  }, [selectedChar]);
  useEffect(() => {
    try { localStorage.setItem('se_activeWorld', activeWorld); } catch {}
  }, [activeWorld]);

  // World creation toggles
  const [worldToggles, setWorldToggles]       = useState({});

  // Task arc (50 story briefs)
  const [tasks, setTasks]                     = useState([]);
  const [tasksLoading, setTasksLoading]       = useState(false);

  // Generated stories (storyNumber → story object)
  const [stories, setStories]                 = useState({});
  const [approvedStories, setApprovedStories] = useState([]); // story numbers
  const [savedStories, setSavedStories]       = useState([]); // story numbers saved as draft in DB

  // Active story/task in right panel
  const [activeTask, setActiveTask]           = useState(null);
  const [activeStory, setActiveStory]         = useState(null);

  // Persist activeTask number to localStorage
  useEffect(() => {
    if (activeTask?.story_number) try { localStorage.setItem('se_activeTaskNum', String(activeTask.story_number)); } catch {}
  }, [activeTask]);

  // Generation state
  const [generating, setGenerating]           = useState(false);
  const [generatingNum, setGeneratingNum]     = useState(null);

  // Elapsed time counter
  const [elapsed, setElapsed]                 = useState(0);
  const elapsedRef                            = useRef(null);

  // Consistency
  const [consistencyConflicts, setConsistencyConflicts] = useState([]);
  const [consistencyLoading, setConsistencyLoading]     = useState(false);

  // Therapy memories
  const [therapyMemories, setTherapyMemories] = useState([]);
  const [therapyLoading, setTherapyLoading]   = useState(false);

  // Registry feedback notification
  const [registryUpdate, setRegistryUpdate]   = useState(null);

  // Save-for-later state
  const [savingForLater, setSavingForLater]   = useState(false);

  // ── New redesign state ───────────────────────────────────────────────────
  const [showStats, setShowStats]             = useState(false);
  const [readingMode, setReadingMode]         = useState(false);
  const [writeMode, setWriteMode]             = useState(() => {
    try { return localStorage.getItem('se_writeMode') === '1'; } catch { return false; }
  });

  // Persist writeMode to localStorage
  useEffect(() => {
    try { localStorage.setItem('se_writeMode', writeMode ? '1' : '0'); } catch {}
  }, [writeMode]);

  // Tag body so global overlays (Amber) can hide on this page at mobile widths
  useEffect(() => {
    document.body.classList.add('page-story-engine');
    return () => document.body.classList.remove('page-story-engine');
  }, []);

  const [toasts, setToasts]                   = useState([]);
  const [phaseFilter, setPhaseFilter]         = useState(null);
  const [typeFilter, setTypeFilter]           = useState(null);
  const [searchQuery, setSearchQuery]         = useState('');
  const [batchMode, setBatchMode]             = useState(false);
  const [batchSelected, setBatchSelected]     = useState(new Set());

  const char = CHARACTERS[selectedChar];

  // ── Toast helpers ────────────────────────────────────────────────────────
  const addToast = useCallback((message, type = 'info') => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Filtered tasks (phase / type / search) ──────────────────────────────
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (phaseFilter && t.phase !== phaseFilter) return false;
      if (typeFilter && t.story_type !== typeFilter) return false;
      if (searchQuery && !t.title?.toLowerCase().includes(searchQuery.toLowerCase()) && !t.task?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [tasks, phaseFilter, typeFilter, searchQuery]);

  // ── Story navigation helper ──────────────────────────────────────────────
  const navigateStory = useCallback((direction) => {
    if (!activeTask || !tasks.length) return;
    const idx = tasks.findIndex(t => t.story_number === activeTask.story_number);
    const nextIdx = idx + direction;
    if (nextIdx >= 0 && nextIdx < tasks.length) {
      const nextTask = tasks[nextIdx];
      setActiveTask(nextTask);
      setActiveStory(stories[nextTask.story_number] || null);
      setConsistencyConflicts([]);
      setTherapyMemories([]);
    }
  }, [activeTask, tasks, stories]);

  const hasPrevStory = activeTask ? tasks.findIndex(t => t.story_number === activeTask.story_number) > 0 : false;
  const hasNextStory = activeTask ? tasks.findIndex(t => t.story_number === activeTask.story_number) < tasks.length - 1 : false;

  // ── Export story (copy / download) ───────────────────────────────────────
  const handleExportStory = useCallback((story) => {
    const text = `# ${story.title}\n\nStory ${story.story_number} · ${PHASE_LABELS[story.phase]} · ${story.story_type}\n${story.word_count?.toLocaleString() || ''} words\n\n${story.text || ''}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        addToast('Story copied to clipboard', 'success');
      });
    }
    // Also trigger download
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `story-${story.story_number}-${story.title?.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [addToast]);

  // ── Batch approve handler ────────────────────────────────────────────────
  const handleBatchApprove = useCallback(async () => {
    if (batchSelected.size === 0) return;
    const nums = [...batchSelected].filter(n => stories[n] && !approvedStories.includes(n));
    if (nums.length === 0) { addToast('No eligible stories to approve', 'warning'); return; }

    addToast(`Approving ${nums.length} stories…`, 'info');
    for (const num of nums) {
      await handleApprove(stories[num]);
    }
    setBatchSelected(new Set());
    setBatchMode(false);
    addToast(`${nums.length} stories approved`, 'success');
  }, [batchSelected, stories, approvedStories, addToast]);

  const handleBatchToggle = useCallback((storyNum) => {
    setBatchSelected(prev => {
      const next = new Set(prev);
      if (next.has(storyNum)) next.delete(storyNum);
      else next.add(storyNum);
      return next;
    });
  }, []);

  // ── Elapsed-time timer helper ────────────────────────────────────────────
  const startTimer = useCallback(() => {
    setElapsed(0);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    const t0 = Date.now();
    elapsedRef.current = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
  }, []);

  useEffect(() => () => stopTimer(), [stopTimer]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      // Skip if typing in an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Arrow Up/Down — navigate tasks
      if (e.key === 'ArrowUp') { e.preventDefault(); navigateStory(-1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); navigateStory(1); }

      // F — toggle reading mode
      if (e.key === 'f' || e.key === 'F') {
        if (!e.ctrlKey && !e.metaKey) { setReadingMode(prev => !prev); }
      }

      // Escape — exit reading mode
      if (e.key === 'Escape') { setReadingMode(false); }

      // Ctrl+S — save for later
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeStory) handleSaveForLater(activeStory);
      }

      // Ctrl+Enter — approve
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (activeStory) handleApprove(activeStory);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigateStory, activeStory]);

  // ── Load characters dynamically from DB ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/memories/story-engine-characters`);
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();

        if (cancelled) return;

        // Build CHARACTERS dict from the API response
        const chars = {};
        const worlds = Object.keys(data.worlds || {});

        for (const world of worlds) {
          for (const c of data.worlds[world]) {
            chars[c.character_key] = {
              id: c.id,
              display_name: c.display_name,
              icon: c.icon || '◈',
              role_type: c.role_type,
              world: c.world,
              color: ROLE_COLORS[c.role_type] || '#546678',
              portrait_url: c.portrait_url,
              has_dna: c.has_dna,
            };
          }
        }

        if (Object.keys(chars).length > 0) {
          setCHARACTERS(chars);
          setWorldsList(worlds);
          // Build world toggles
          const toggles = {};
          for (const w of worlds) toggles[w] = true;
          setWorldToggles(toggles);
          // Select first character if none selected
          if (!selectedChar) {
            const firstKey = Object.keys(chars)[0];
            setSelectedChar(firstKey);
          }
        } else {
          // Fallback if no characters in DB
          setCHARACTERS(FALLBACK_CHARACTERS);
          setWorldToggles({ 'book-1': true, lalaverse: true });
          if (!selectedChar) setSelectedChar('justawoman');
        }
      } catch (err) {
        console.error('Failed to load SE characters from DB:', err);
        setCHARACTERS(FALLBACK_CHARACTERS);
        setWorldToggles({ 'book-1': true, lalaverse: true });
        if (!selectedChar) setSelectedChar('justawoman');
      } finally {
        if (!cancelled) setCharsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── localStorage helpers for caching ─────────────────────────────────────
  const cacheKey     = (charKey) => `se_tasks_${charKey}`;
  const storyCacheKey = (charKey) => `se_stories_${charKey}`;

  function getCachedTasks(charKey) {
    try {
      const raw = localStorage.getItem(cacheKey(charKey));
      if (!raw) return null;
      const data = JSON.parse(raw);
      // Expire after 24 hours
      if (Date.now() - data.ts > 86400000) { localStorage.removeItem(cacheKey(charKey)); return null; }
      return data.tasks;
    } catch { return null; }
  }

  function setCachedTasks(charKey, taskList) {
    try {
      localStorage.setItem(cacheKey(charKey), JSON.stringify({ ts: Date.now(), tasks: taskList }));
    } catch { /* quota exceeded */ }
  }

  function getCachedStories(charKey) {
    try {
      const raw = localStorage.getItem(storyCacheKey(charKey));
      if (!raw) return null;
      const data = JSON.parse(raw);
      // Expire after 7 days
      if (Date.now() - data.ts > 604800000) { localStorage.removeItem(storyCacheKey(charKey)); return null; }
      return { stories: data.stories || {}, approved: data.approved || [] };
    } catch { return null; }
  }

  function setCachedStories(charKey, storiesObj, approvedArr) {
    try {
      localStorage.setItem(storyCacheKey(charKey), JSON.stringify({
        ts: Date.now(),
        stories: storiesObj,
        approved: approvedArr,
      }));
    } catch { /* quota exceeded */ }
  }

  // ── Load tasks + stories: try localStorage → DB → server cache → empty state ──
  useEffect(() => {
    if (!selectedChar) return;
    setActiveTask(null);
    setActiveStory(null);
    setConsistencyConflicts([]);
    setTherapyMemories([]);
    setSavedStories([]);

    // Restore any previously-written stories for this character from localStorage
    const cachedStoryData = getCachedStories(selectedChar);
    if (cachedStoryData) {
      setStories(cachedStoryData.stories);
      setApprovedStories(cachedStoryData.approved);
    } else {
      setStories({});
      setApprovedStories([]);
    }

    // Also load DB-persisted stories (saved for later / approved) — merges with cache
    (async () => {
      try {
        const dbRes = await fetch(`${API_BASE}/stories/character/${selectedChar}`);
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          if (dbData.stories?.length) {
            const dbStories = {};
            const dbApproved = [];
            const dbSaved = [];
            for (const s of dbData.stories) {
              dbStories[s.story_number] = {
                story_number: s.story_number,
                title: s.title,
                text: s.text,
                phase: s.phase,
                story_type: s.story_type,
                word_count: s.word_count,
                new_character: s.new_character,
                new_character_name: s.new_character_name,
                new_character_role: s.new_character_role,
                opening_line: s.opening_line,
                character_key: s.character_key,
                db_id: s.id,
                db_status: s.status,
              };
              if (s.status === 'approved') dbApproved.push(s.story_number);
              if (s.status === 'draft' || s.status === 'approved') dbSaved.push(s.story_number);
            }
            // Merge: DB data takes precedence (it's the persisted truth)
            setStories(prev => ({ ...prev, ...dbStories }));
            setApprovedStories(prev => [...new Set([...prev, ...dbApproved])]);
            setSavedStories(dbSaved);
            // Update localStorage cache with DB data
            setCachedStories(selectedChar,
              { ...(cachedStoryData?.stories || {}), ...dbStories },
              [...new Set([...(cachedStoryData?.approved || []), ...dbApproved])]);
          }
        }
      } catch { /* network error — localStorage fallback still active */ }
    })();

    // 1. Check localStorage for task arc
    const cached = getCachedTasks(selectedChar);
    if (cached?.length) {
      setTasks(cached);
      // Restore last-viewed task, or fall back to first
      const savedNum = (() => { try { return Number(localStorage.getItem('se_activeTaskNum')); } catch { return 0; } })();
      const restored = savedNum && cached.find(t => t.story_number === savedNum);
      setActiveTask(restored || cached[0]);
      if (restored && cachedStoryData?.stories?.[savedNum]) setActiveStory(cachedStoryData.stories[savedNum]);
      return;
    }

    // 2. Check server-side cache (instant GET, no Claude call)
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/memories/story-engine-tasks/${selectedChar}`);
        if (res.ok) {
          const data = await res.json();
          if (data.cached && data.tasks?.length) {
            setTasks(data.tasks);
            setCachedTasks(selectedChar, data.tasks);
            const savedNum = (() => { try { return Number(localStorage.getItem('se_activeTaskNum')); } catch { return 0; } })();
            const restored = savedNum && data.tasks.find(t => t.story_number === savedNum);
            setActiveTask(restored || data.tasks[0]);
            if (restored && cachedStoryData?.stories?.[savedNum]) setActiveStory(cachedStoryData.stories[savedNum]);
            return;
          }
        }
      } catch { /* network error — ignore */ }
      // 3. No cache anywhere → show empty state with "Generate Arc" button
      setTasks([]);
    })();
  }, [selectedChar]);

  // ── Generate task arc (user-initiated, not automatic) ────────────────────
  async function handleGenerateArc(forceRegenerate = false) {
    setTasksLoading(true);
    startTimer();
    try {
      const res = await fetch(`${API_BASE}/memories/generate-story-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterKey: selectedChar, forceRegenerate }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setTasks(data.tasks || []);
      setCachedTasks(selectedChar, data.tasks || []);
      if (data.tasks?.length) setActiveTask(data.tasks[0]);
    } catch (e) {
      console.error('generateArc error:', e);
    } finally {
      setTasksLoading(false);
      stopTimer();
    }
  }

  // ── Generate a story ──────────────────────────────────────────────────────
  async function handleGenerate(task) {
    setGenerating(true);
    setGeneratingNum(task.story_number);
    setActiveTask(task);
    setActiveStory(null);
    setConsistencyConflicts([]);
    setTherapyMemories([]);
    startTimer();

    try {
      // Build previous stories context — send ALL approved for richer continuity
      const previousStories = approvedStories
        .filter((n) => n < task.story_number)
        .sort((a, b) => a - b)
        .map((n) => ({
          number: n,
          title: stories[n]?.title || `Story ${n}`,
          summary: stories[n]?.text?.slice(0, 200) || '',
        }));

      const res = await fetch(`${API_BASE}/memories/generate-story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterKey: selectedChar,
          storyNumber: task.story_number,
          taskBrief: task,
          previousStories,
        }),
      });

      if (!res.ok) throw new Error('Failed');
      const data = await res.json();

      if (data.fallback) {
        addToast('Story generation failed — please try again.', 'error');
        return;
      }

      const nextStories = { ...stories, [task.story_number]: data };
      setStories(nextStories);
      setActiveStory(data);
      setCachedStories(selectedChar, nextStories, approvedStories);
    } catch (e) {
      console.error('handleGenerate error:', e);
      addToast('Story generation failed — please try again.', 'error');
    } finally {
      setGenerating(false);
      setGeneratingNum(null);
      stopTimer();
    }
  }

  // ── Save a story for later (persist to DB as draft, don't approve) ────────
  async function handleSaveForLater(story) {
    setSavingForLater(true);
    try {
      const res = await fetch(`${API_BASE}/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_key: selectedChar,
          story_number: story.story_number,
          title: story.title,
          text: story.text,
          phase: story.phase,
          story_type: story.story_type,
          word_count: story.word_count || story.text?.split(/\s+/).length,
          status: 'draft',
          task_brief: tasks.find(t => t.story_number === story.story_number),
          new_character: story.new_character,
          new_character_name: story.new_character_name,
          new_character_role: story.new_character_role,
          opening_line: story.opening_line,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const nextSaved = [...new Set([...savedStories, story.story_number])];
        setSavedStories(nextSaved);
        // Update the story object with DB info
        const nextStories = { ...stories, [story.story_number]: { ...story, db_id: data.story?.id, db_status: 'draft' } };
        setStories(nextStories);
        setCachedStories(selectedChar, nextStories, approvedStories);
        addToast('📥 Story saved — come back to review & approve anytime', 'success');
      }
    } catch (e) {
      console.error('saveForLater error:', e);
      addToast('Failed to save story. Please try again.', 'error');
    } finally {
      setSavingForLater(false);
    }
  }
  // ── Approve a story ───────────────────────────────────────────────────────
  async function handleApprove(story) {
    const nextApproved = [...new Set([...approvedStories, story.story_number])];
    setApprovedStories(nextApproved);
    // Track as saved too (approved implies saved)
    setSavedStories(prev => [...new Set([...prev, story.story_number])]);
    setCachedStories(selectedChar, stories, nextApproved);

    // Extract memories for therapy room
    setTherapyLoading(true);
    let extractedMemories = null;
    try {
      const res = await fetch(`${API_BASE}/memories/extract-story-memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: char?.id || selectedChar,
          characterKey: selectedChar,
          storyNumber: story.story_number,
          storyTitle: story.title,
          storyText: story.text,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTherapyMemories(data.pain_points || []);
        extractedMemories = data;
      }
    } catch (e) {
      console.error('extract memories error:', e);
    } finally {
      setTherapyLoading(false);
    }

    // Registry feedback loop — update character profile based on story events
    try {
      const regRes = await fetch(`${API_BASE}/memories/story-engine-update-registry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterKey: selectedChar,
          storyNumber: story.story_number,
          storyTitle: story.title,
          storyText: story.text,
          extractedMemories,
        }),
      });
      if (regRes.ok) {
        const regData = await regRes.json();
        if (regData.updated) {
          setRegistryUpdate(`Registry updated: ${regData.summary}`);
          setTimeout(() => setRegistryUpdate(null), 8000);
        }
      }
    } catch (e) {
      console.error('registry update error:', e);
    }
  }

  // ── Reject a story ────────────────────────────────────────────────────────
  function handleReject(story) {
    const nextStories = { ...stories };
    delete nextStories[story.story_number];
    setStories(nextStories);
    setActiveStory(null);
    setActiveTask(tasks.find((t) => t.story_number === story.story_number) || null);
    setCachedStories(selectedChar, nextStories, approvedStories);
  }

  // ── Add new character from a story to the registry ────────────────────────
  async function handleAddToRegistry(story) {
    if (!story.new_character_name) return;
    try {
      const res = await fetch(`${API_BASE}/memories/story-engine-add-character`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_name: story.new_character_name,
          character_role: story.new_character_role,
          world: char?.world || 'book-1',
          story_number: story.story_number,
          story_title: story.title,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.already_existed) {
          addToast(`${story.new_character_name} already exists in the registry.`, 'warning');
        } else {
          addToast(`${story.new_character_name} added to the registry as draft.`, 'success');
          // Refresh character list
          const charRes = await fetch(`${API_BASE}/memories/story-engine-characters`);
          if (charRes.ok) {
            const charData = await charRes.json();
            const chars = {};
            for (const world of Object.keys(charData.worlds || {})) {
              for (const c of charData.worlds[world]) {
                chars[c.character_key] = {
                  id: c.id,
                  display_name: c.display_name,
                  icon: c.icon || '◈',
                  role_type: c.role_type,
                  world: c.world,
                  color: ROLE_COLORS[c.role_type] || '#546678',
                  portrait_url: c.portrait_url,
                  has_dna: c.has_dna,
                };
              }
            }
            if (Object.keys(chars).length > 0) setCHARACTERS(chars);
          }
        }
      }
    } catch (e) {
      console.error('addToRegistry error:', e);
      addToast('Failed to add character to registry.', 'error');
    }
  }

  // ── Edit a story — persist to DB + triggers cascade check ─────────────────
  async function handleEdit(story, newText) {
    const updated = { ...story, text: newText, word_count: newText.split(/\s+/).length };
    const nextStories = { ...stories, [story.story_number]: updated };
    setStories(nextStories);
    setActiveStory(updated);
    setCachedStories(selectedChar, nextStories, approvedStories);

    // Persist to database
    try {
      const task = tasks.find(t => t.story_number === story.story_number);
      await fetch(`${API_BASE}/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_key: selectedChar,
          story_number: story.story_number,
          title: story.title,
          text: newText,
          phase: story.phase,
          story_type: story.story_type,
          word_count: newText.split(/\s+/).length,
          status: story.db_status || 'draft',
          task_brief: task,
          new_character: story.new_character,
          new_character_name: story.new_character_name,
          new_character_role: story.new_character_role,
          opening_line: story.opening_line,
        }),
      });
      addToast('Story saved', 'success');
    } catch (e) {
      console.error('Story save error:', e);
      addToast('Failed to save story to database', 'error');
    }

    // Cascade consistency check
    await handleCheckConsistency(updated);
  }

  // ── Check story consistency ───────────────────────────────────────────────
  async function handleCheckConsistency(story) {
    setConsistencyLoading(true);
    setConsistencyConflicts([]);
    try {
      const existingStories = Object.values(stories).map((s) => ({
        story_number: s.story_number,
        title: s.title,
        summary: s.text?.slice(0, 300),
      }));

      const res = await fetch(`${API_BASE}/memories/check-story-consistency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterKey: selectedChar,
          editedStoryNumber: story.story_number,
          editedStoryText: story.text,
          existingStories,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setConsistencyConflicts(data.conflicts || []);
      }
    } catch (e) {
      console.error('consistency check error:', e);
    } finally {
      setConsistencyLoading(false);
    }
  }

  // ── World toggle ──────────────────────────────────────────────────────────
  function handleWorldToggle(worldId) {
    setWorldToggles((prev) => ({ ...prev, [worldId]: !prev[worldId] }));
  }

  // ── Select task/story ─────────────────────────────────────────────────────
  function handleSelectTask(task) {
    setActiveTask(task);
    setActiveStory(stories[task.story_number] || null);
    setConsistencyConflicts([]);
    setTherapyMemories([]);
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={`se-page ${readingMode ? 'se-fullscreen-reading' : ''} ${writeMode ? 'se-write-mode' : ''}`}>

      {/* ── Toast notifications ──────────────────────────────────────────── */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      {!readingMode && (
        <div className="se-topbar">
          <button className="se-btn-back" onClick={() => navigate('/')}>
            ← Home
          </button>
          <div className="se-topbar-title">Story Engine</div>
          <button
            className={`se-btn se-btn-stats-toggle ${showStats ? 'active' : ''}`}
            onClick={() => setShowStats(prev => !prev)}
            title="Toggle stats dashboard"
          >
            📊 Stats
          </button>
          <WorldToggle worlds={worldToggles} onToggle={handleWorldToggle} />
        </div>
      )}

      {/* ── Stats dashboard (collapsible) ─────────────────────────────────── */}
      {showStats && !readingMode && (
        <StatsDashboard
          tasks={tasks}
          stories={stories}
          approvedStories={approvedStories}
          savedStories={savedStories}
        />
      )}

      {/* ── Character selector (searchable dropdown) ─────────────────────── */}
      {!readingMode && (
        <CharacterSelector
          characters={CHARACTERS}
          selectedChar={selectedChar}
          onSelect={setSelectedChar}
          loading={charsLoading}
        />
      )}

      {/* ── Arc progress (with status dots) ───────────────────────────────── */}
      {!readingMode && (
        <ArcProgress
          tasks={tasks}
          approvedStories={approvedStories}
          savedStories={savedStories}
          stories={stories}
        />
      )}

      {/* ── Main workspace ────────────────────────────────────────────────── */}
      <div className="se-workspace">

        {/* Left: task list */}
        {!readingMode && !writeMode && (
          <div className="se-task-list">
            {tasksLoading ? (
              <div className="se-task-loading">
                <div className="se-spinner" style={{ borderTopColor: char?.color }} />
                <span>Building {char?.display_name}'s 50-story arc…</span>
                <span className="se-task-loading-elapsed">{elapsed}s elapsed · typically 2–3 minutes</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="se-task-empty">
                <div className="se-task-empty-icon" style={{ color: char?.color }}>{char?.icon}</div>
                <div className="se-task-empty-title">No story arc yet for {char?.display_name}</div>
                <div className="se-task-empty-desc">
                  Generate a 50-story task arc using AI.
                  This takes 2–3 minutes on the first run,
                  then loads instantly from cache.
                </div>
                <button
                  className="se-btn se-btn-generate-arc"
                  style={{ background: char?.color }}
                  onClick={() => handleGenerateArc()}
                >
                  Generate 50-Story Arc
                </button>
              </div>
            ) : (
              <>
                {/* Filter bar */}
                <div className="se-filter-bar">
                  <input
                    className="se-filter-search"
                    type="text"
                    placeholder="Search stories…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <div className="se-filter-pills">
                    {['establishment', 'pressure', 'crisis', 'integration'].map(p => (
                      <button
                        key={p}
                        className={`se-filter-pill ${phaseFilter === p ? 'active' : ''}`}
                        style={phaseFilter === p ? { background: PHASE_COLORS[p], color: '#fff', borderColor: PHASE_COLORS[p] } : undefined}
                        onClick={() => setPhaseFilter(prev => prev === p ? null : p)}
                      >
                        {PHASE_LABELS[p]}
                      </button>
                    ))}
                    {['internal', 'collision', 'wrong_win'].map(t => (
                      <button
                        key={t}
                        className={`se-filter-pill se-filter-type ${typeFilter === t ? 'active' : ''}`}
                        onClick={() => setTypeFilter(prev => prev === t ? null : t)}
                      >
                        {TYPE_ICONS[t]} {t.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Task list header */}
                <div className="se-task-list-header">
                  <span className="se-task-list-count">
                    {filteredTasks.length}{filteredTasks.length !== tasks.length ? `/${tasks.length}` : ''} stories
                    {(() => {
                      const queueCount = savedStories.filter(n => !approvedStories.includes(n)).length;
                      return queueCount > 0 ? (
                        <span className="se-reading-queue-badge">📥 {queueCount} to review</span>
                      ) : null;
                    })()}
                  </span>
                  <div className="se-task-list-actions">
                    <button
                      className={`se-btn se-btn-batch ${batchMode ? 'active' : ''}`}
                      onClick={() => { setBatchMode(prev => !prev); setBatchSelected(new Set()); }}
                    >
                      {batchMode ? '✕ Cancel' : '☐ Batch'}
                    </button>
                    {batchMode && batchSelected.size > 0 && (
                      <button
                        className="se-btn se-btn-batch-approve"
                        style={{ background: char?.color }}
                        onClick={handleBatchApprove}
                      >
                        Approve {batchSelected.size}
                      </button>
                    )}
                    <button
                      className="se-btn se-btn-regen"
                      onClick={() => { if (window.confirm('Regenerate the entire arc? This replaces all 50 task briefs.')) handleGenerateArc(true); }}
                    >
                      ↻ Regen
                    </button>
                  </div>
                </div>

                {/* Task cards */}
                {filteredTasks.map((task) => (
                  <TaskCard
                    key={task.story_number}
                    task={task}
                    isApproved={approvedStories.includes(task.story_number)}
                    isSaved={savedStories.includes(task.story_number) && !approvedStories.includes(task.story_number)}
                    isActive={activeTask?.story_number === task.story_number}
                    onGenerate={handleGenerate}
                    onSelect={handleSelectTask}
                    charColor={char?.color}
                    generating={generating && generatingNum === task.story_number}
                    batchMode={batchMode}
                    batchSelected={batchSelected}
                    onBatchToggle={handleBatchToggle}
                  />
                ))}
                {filteredTasks.length === 0 && tasks.length > 0 && (
                  <div className="se-filter-empty">
                    No stories match current filters.
                    <button className="se-filter-clear" onClick={() => { setPhaseFilter(null); setTypeFilter(null); setSearchQuery(''); }}>
                      Clear filters
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Right: story panel */}
        <div className="se-story-column">
          {generating && generatingNum === activeTask?.story_number ? (
            <div className="se-generating">
              <div className="se-generating-ring" style={{ borderTopColor: char?.color }} />
              <div className="se-generating-title">Writing Story {generatingNum}…</div>
              <div className="se-generating-sub">
                {char?.display_name}'s world is assembling itself.
              </div>
              <div className="se-generating-elapsed">{elapsed}s · typically 1–2 minutes</div>
            </div>
          ) : (
            <StoryPanel
              story={activeStory}
              task={activeTask}
              charColor={char?.color}
              charName={char?.display_name}
              onApprove={handleApprove}
              onReject={handleReject}
              onEdit={handleEdit}
              onCheckConsistency={handleCheckConsistency}
              onSaveForLater={handleSaveForLater}
              savingForLater={savingForLater}
              consistencyConflicts={consistencyConflicts}
              consistencyLoading={consistencyLoading}
              therapyMemories={therapyMemories}
              therapyLoading={therapyLoading}
              onAddToRegistry={handleAddToRegistry}
              registryUpdate={registryUpdate}
              readingMode={readingMode}
              onToggleReadingMode={() => setReadingMode(prev => !prev)}
              writeMode={writeMode}
              onToggleWriteMode={(v) => setWriteMode(typeof v === 'boolean' ? v : !writeMode)}
              onNavigateStory={navigateStory}
              hasPrev={hasPrevStory}
              hasNext={hasNextStory}
              onExportStory={handleExportStory}
              onEvaluate={(story) => {
                const params = new URLSearchParams();
                if (story?.text) params.set('text', '1');
                if (activeTask?.task) params.set('brief', activeTask.task);
                if (selectedChar) params.set('char', selectedChar);
                navigate(`/story-evaluation?${params.toString()}`, { state: { storyText: story?.text, taskBrief: activeTask } });
              }}
              charObj={char}
              selectedCharKey={selectedChar}
              activeWorld={activeWorld}
              allCharacters={CHARACTERS}
              onSelectChar={setSelectedChar}
            />
          )}
        </div>
      </div>

      {/* ── Keyboard shortcuts hint ──────────────────────────────────────── */}
      {!readingMode && (
        <div className="se-shortcuts-hint">
          <span>↑↓ Navigate</span>
          <span>F Reading mode</span>
          <span>Ctrl+S Save</span>
          <span>Ctrl+Enter Approve</span>
        </div>
      )}
    </div>
  );
}
