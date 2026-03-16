import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import StoryReviewPanel from '../components/StoryReviewPanel';
import WriteModeAIWriter from '../components/WriteModeAIWriter';
import ArcTrackingPanel from '../components/ArcTrackingPanel';
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

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  const selected = characters[selectedChar];

  const grouped = useMemo(() => {
    const groups = {};
    for (const [key, c] of Object.entries(characters)) {
      const w = c.world || 'unknown';
      if (!groups[w]) groups[w] = [];
      groups[w].push([key, c]);
    }
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
        <span className="se-char-trigger-world">
          {WORLD_SHORT[selected?.world] || selected?.world?.slice(0, 3)?.toUpperCase()}
        </span>
        <span className="se-char-trigger-count">{totalCount} characters</span>
        <span className={`se-char-trigger-arrow ${open ? 'open' : ''}`}>▾</span>
      </button>

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

// ─── Arc progress bar ────────────────────────────────────────────────────────
function ArcProgress({ approvedStories, savedStories = [], stories = {} }) {
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

// ─── Task card ────────────────────────────────────────────────────────────────
function TaskCard({
  task, isApproved, isSaved, isActive, onGenerate, onSelect,
  charColor, generating, batchMode, batchSelected, onBatchToggle
}) {
  const cardRef = useRef(null);

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
          <span className="se-task-phase" style={{ color: PHASE_COLORS[task.phase] }}>
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
  storiesMinimized, onToggleStoriesMinimized,
}) {
  const editing = writeMode;
  const setEditing = onToggleWriteMode;
  const [editText, setEditText] = useState(story?.text || '');
  const [showAiSidebar, setShowAiSidebar] = useState(() => window.innerWidth <= 768);
  const [currentPage, setCurrentPage] = useState(0);
  const [evalScore, setEvalScore] = useState(null);
  const [activeThreads, setActiveThreads] = useState([]);
  const textareaRef = useRef(null);
  const storyBodyRef = useRef(null);
  const prevStoryRef = useRef(story?.story_number);

  const WORDS_PER_PAGE = 250;
  const pages = useMemo(() => {
    const text = story?.text || '';
    const paragraphs = text.split('\n');
    const result = [[]];
    let wordCount = 0;
    for (const para of paragraphs) {
      const words = para.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount > 0 && wordCount + words > WORDS_PER_PAGE) {
        result.push([]);
        wordCount = 0;
      }
      result[result.length - 1].push(para);
      wordCount += words;
    }
    return result.filter(p => p.some(line => line.trim()));
  }, [story?.text]);
  const totalPages = pages.length;

  // Paginate editText for edit-mode page navigation
  const editPageOffsets = useMemo(() => {
    const text = editText || '';
    const paragraphs = text.split('\n');
    const offsets = [0]; // char offset where each page starts
    let wordCount = 0;
    let charPos = 0;
    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i];
      const words = para.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount > 0 && wordCount + words > WORDS_PER_PAGE) {
        offsets.push(charPos);
        wordCount = 0;
      }
      wordCount += words;
      charPos += para.length + 1; // +1 for the \n
    }
    return offsets;
  }, [editText]);
  const editTotalPages = editPageOffsets.length;

  // Clamp currentPage when edit content changes page count
  useEffect(() => {
    if (editing && currentPage >= editTotalPages) {
      setCurrentPage(Math.max(0, editTotalPages - 1));
    }
  }, [editing, editTotalPages, currentPage]);

  useEffect(() => {
    setEditText(story?.text || '');
    setCurrentPage(0);
    if (prevStoryRef.current != null && prevStoryRef.current !== story?.story_number) {
      if (onToggleWriteMode) onToggleWriteMode(false);
    }
    prevStoryRef.current = story?.story_number;
  }, [story, onToggleWriteMode]);

  // Fetch evaluation score for current story
  useEffect(() => {
    setEvalScore(null);
    if (!story?.id) return;
    fetch(`${API_BASE}/memories/eval-stories/${story.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.evaluation?.overall_score != null) {
          setEvalScore(d.evaluation);
        }
      })
      .catch(err => console.warn('eval score fetch failed:', err.message));
  }, [story?.id]);

  // Fetch active threads for this story's character
  useEffect(() => {
    setActiveThreads([]);
    if (!story?.story_number || !selectedCharKey) return;
    fetch(`${API_BASE}/story-health/threads-for-story/${story.story_number}?character_key=${encodeURIComponent(selectedCharKey)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.threads) setActiveThreads(d.threads); })
      .catch(err => console.warn('thread fetch failed:', err.message));
  }, [story?.story_number, selectedCharKey]);

  if (!story && !task) return (
    <div
      className={`se-story-panel se-story-section${storiesMinimized ? ' se-story-section--minimized' : ''}`}
    >
      <div className="se-story-section-header" onClick={() => onToggleStoriesMinimized()} role="button" tabIndex={0}>
        <div className="se-story-section-title">Upcoming Stories</div>
        <div className="se-story-section-right">
          <div className="se-story-section-sub">Generated tasks appear here</div>
          <span className={`se-story-section-chevron${storiesMinimized ? ' se-chevron-collapsed' : ''}`}>▾</span>
        </div>
      </div>
      {!storiesMinimized && (
        <div className="se-story-section-empty">
          <div className="se-story-empty-icon">◎</div>
          <div className="se-story-empty-text">
            Once the arc is generated, individual story tasks will appear here.
          </div>
          <div className="se-story-skeletons">
            <div className="se-story-skeleton" />
            <div className="se-story-skeleton" />
            <div className="se-story-skeleton" />
          </div>
        </div>
      )}
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
          style={{ background: '#3D7A9B', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none' }}
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
      <div className="se-story-header" style={{ borderBottomColor: charColor }}>
        <div className="se-story-header-left">
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
                <span>{Math.ceil(story.word_count / 250)} {Math.ceil(story.word_count / 250) === 1 ? 'page' : 'pages'}</span>
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
                onClick={() => onApprove(story, true)}
              >
                {evalScore ? `Approve (${evalScore.overall_score})` : 'Approve'}
              </button>
              {evalScore && (
                <div className="se-eval-badge" style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 6,
                  background: evalScore.overall_score >= 70 ? 'rgba(16,185,129,0.1)' : evalScore.overall_score >= 50 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                  color: evalScore.overall_score >= 70 ? '#059669' : evalScore.overall_score >= 50 ? '#d97706' : '#dc2626',
                  fontWeight: 600, marginLeft: -4,
                }}>
                  {evalScore.overall_score >= 70 ? '✓ Strong' : evalScore.overall_score >= 50 ? '~ Fair' : '✕ Needs work'}
                </div>
              )}
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
            onClick={() => {}}
          >
            Story Only
          </button>
        </div>
      )}

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

      {/* Thread Awareness — which threads this story could advance */}
      {activeThreads.length > 0 && !editing && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 14px',
          background: 'rgba(176,146,46,0.04)', borderBottom: '1px solid var(--se-border-light)',
          fontSize: 11,
        }}>
          <span style={{ color: '#999', fontWeight: 600, marginRight: 4 }}>⧖ Active Threads:</span>
          {activeThreads.slice(0, 5).map(t => (
            <span key={t.id} style={{
              padding: '2px 8px', borderRadius: 10,
              background: t.thread_type === 'relationship' ? 'rgba(212,96,112,0.1)' :
                          t.thread_type === 'mystery' ? 'rgba(123,78,207,0.1)' :
                          'rgba(176,146,46,0.08)',
              color: t.thread_type === 'relationship' ? '#d46070' :
                     t.thread_type === 'mystery' ? '#7b4ecf' : '#8b7a2e',
              fontWeight: 500,
            }}>
              {t.title}
            </span>
          ))}
          {activeThreads.length > 5 && (
            <span style={{ color: '#999' }}>+{activeThreads.length - 5} more</span>
          )}
        </div>
      )}

      <div className="se-story-body">
        {editing ? (
          <>
          <div className="se-edit-container">
            <textarea
              ref={textareaRef}
              className="se-story-editor"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              spellCheck
            />
            <button
              className="se-ai-sidebar-toggle"
              onClick={() => setShowAiSidebar(v => !v)}
              title={showAiSidebar ? 'Hide AI tools' : 'Show AI tools'}
            >
              {showAiSidebar ? '✕ Close' : '✦ AI Tools'}
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
                  core_desire: charObj.core_desire,
                  core_fear: charObj.core_fear,
                  core_wound: charObj.core_wound,
                  description: charObj.description,
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
          {editTotalPages > 1 && (
            <div className="se-page-nav">
              <button
                className="se-btn se-btn-page"
                onClick={() => {
                  setCurrentPage(p => {
                    const next = p - 1;
                    const ta = textareaRef.current;
                    if (ta) {
                      ta.setSelectionRange(editPageOffsets[next], editPageOffsets[next]);
                      // scroll textarea so the cursor/page start is visible
                      const lineHeight = parseInt(getComputedStyle(ta).lineHeight) || 20;
                      const textBefore = editText.slice(0, editPageOffsets[next]);
                      const linesAbove = textBefore.split('\n').length - 1;
                      ta.scrollTop = linesAbove * lineHeight;
                    }
                    return next;
                  });
                }}
                disabled={currentPage === 0}
              >
                ‹ Prev Page
              </button>
              <span className="se-page-indicator">
                Page {currentPage + 1} of {editTotalPages}
              </span>
              <button
                className="se-btn se-btn-page"
                onClick={() => {
                  setCurrentPage(p => {
                    const next = p + 1;
                    const ta = textareaRef.current;
                    if (ta) {
                      ta.setSelectionRange(editPageOffsets[next], editPageOffsets[next]);
                      const lineHeight = parseInt(getComputedStyle(ta).lineHeight) || 20;
                      const textBefore = editText.slice(0, editPageOffsets[next]);
                      const linesAbove = textBefore.split('\n').length - 1;
                      ta.scrollTop = linesAbove * lineHeight;
                    }
                    return next;
                  });
                }}
                disabled={currentPage >= editTotalPages - 1}
              >
                Next Page ›
              </button>
            </div>
          )}
          </>
        ) : (
          <>
            <div className="se-story-text" ref={storyBodyRef}>
              {(pages[currentPage] || []).map((para, i) => (
                para.trim()
                  ? <p key={i} className="se-story-para">{para}</p>
                  : <div key={i} className="se-story-spacer" />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="se-page-nav">
                <button
                  className="se-btn se-btn-page"
                  onClick={() => { setCurrentPage(p => p - 1); storyBodyRef.current?.scrollTo(0, 0); }}
                  disabled={currentPage === 0}
                >
                  ‹ Prev Page
                </button>
                <span className="se-page-indicator">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <button
                  className="se-btn se-btn-page"
                  onClick={() => { setCurrentPage(p => p + 1); storyBodyRef.current?.scrollTo(0, 0); }}
                  disabled={currentPage >= totalPages - 1}
                >
                  Next Page ›
                </button>
              </div>
            )}
          </>
        )}
      </div>

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

      {/* Therapy-informed story suggestions */}
      {!editing && selectedCharKey && (() => {
        const TherapySuggestions = () => {
          const [suggestions, setSuggestions] = React.useState(null);
          const [expanded, setExpanded] = React.useState(false);
          React.useEffect(() => {
            fetch(`${API_BASE}/story-health/therapy-suggestions/${selectedCharKey}`)
              .then(r => r.ok ? r.json() : null)
              .then(d => setSuggestions(d))
              .catch(err => console.warn('therapy suggestions failed:', err.message));
          }, []);
          if (!suggestions?.suggestions?.length) return null;
          return (
            <div style={{
              margin: '0 14px 12px', padding: 12, borderRadius: 10,
              background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)',
            }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setExpanded(e => !e)}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed' }}>
                  🧠 Story Suggestions ({suggestions.suggestions.length})
                </span>
                <span style={{ fontSize: 10, color: '#999' }}>{expanded ? '▾' : '▸'}</span>
              </div>
              {expanded && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {suggestions.suggestions.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11, padding: '4px 0' }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                        background: s.priority === 'high' ? '#ef4444' : s.priority === 'medium' ? '#f59e0b' : '#999',
                      }} />
                      <div>
                        <div style={{ fontWeight: 500, color: '#333' }}>{s.title}</div>
                        <div style={{ color: '#888', fontSize: 10 }}>{s.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        };
        return <TherapySuggestions />;
      })()}

      {!editing && registryUpdate && (
        <div className="se-registry-update">
          <span className="se-registry-icon">🔄</span>
          <span className="se-registry-text">{registryUpdate}</span>
        </div>
      )}

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

  const [CHARACTERS, setCHARACTERS] = useState(FALLBACK_CHARACTERS);
  const [charsLoading, setCharsLoading] = useState(true);
  const [worldsList, setWorldsList] = useState([]);

  const [selectedChar, setSelectedChar] = useState(() => {
    try { return localStorage.getItem('se_selectedChar') || ''; } catch { return ''; }
  });
  const [activeWorld, setActiveWorld] = useState(() => {
    try { return localStorage.getItem('se_activeWorld') || 'book-1'; } catch { return 'book-1'; }
  });

  useEffect(() => {
    if (selectedChar) try { localStorage.setItem('se_selectedChar', selectedChar); } catch {}
  }, [selectedChar]);

  useEffect(() => {
    try { localStorage.setItem('se_activeWorld', activeWorld); } catch {}
  }, [activeWorld]);

  const [worldToggles, setWorldToggles] = useState({});
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [stories, setStories] = useState({});
  const [approvedStories, setApprovedStories] = useState([]);
  const [savedStories, setSavedStories] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [activeStory, setActiveStory] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generatingNum, setGeneratingNum] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(null);
  const [consistencyConflicts, setConsistencyConflicts] = useState([]);
  const [consistencyLoading, setConsistencyLoading] = useState(false);
  const [therapyMemories, setTherapyMemories] = useState([]);
  const [therapyLoading, setTherapyLoading] = useState(false);
  const [registryUpdate, setRegistryUpdate] = useState(null);
  const [savingForLater, setSavingForLater] = useState(false);
  const [processingStory, setProcessingStory] = useState(null); // lock to prevent concurrent save/approve
  const [amberNotification, setAmberNotification] = useState(null);
  const [amberTextureNotes, setAmberTextureNotes] = useState(null);
  const [approveConfirm, setApproveConfirm] = useState(null); // story awaiting approval confirmation
  const [lastTexture, setLastTexture] = useState(null); // inline texture preview after approval
  const [rejectedStory, setRejectedStory] = useState(null); // undo buffer for rejected stories
  const [batchProgress, setBatchProgress] = useState(null); // { current, total } for batch approve
  const [batchGenProgress, setBatchGenProgress] = useState(null); // { current, total, currentTitle } for batch generate

  const [showStats, setShowStats] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [writeMode, setWriteMode] = useState(() => {
    try { return localStorage.getItem('se_writeMode') === '1'; } catch { return false; }
  });
  const [storiesMinimized, setStoriesMinimized] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('se_writeMode', writeMode ? '1' : '0'); } catch {}
  }, [writeMode]);

  useEffect(() => {
    document.body.classList.add('page-story-engine');
    return () => document.body.classList.remove('page-story-engine');
  }, []);

  const [toasts, setToasts] = useState([]);
  const [phaseFilter, setPhaseFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState(new Set());

  const char = CHARACTERS[selectedChar];

  const addToast = useCallback((message, type = 'info') => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (phaseFilter && t.phase !== phaseFilter) return false;
      if (typeFilter && t.story_type !== typeFilter) return false;
      if (
        searchQuery &&
        !t.title?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !t.task?.toLowerCase().includes(searchQuery.toLowerCase())
      ) return false;
      return true;
    });
  }, [tasks, phaseFilter, typeFilter, searchQuery]);

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

  const hasPrevStory = useMemo(() => activeTask ? tasks.findIndex(t => t.story_number === activeTask.story_number) > 0 : false, [activeTask, tasks]);
  const hasNextStory = useMemo(() => activeTask ? tasks.findIndex(t => t.story_number === activeTask.story_number) < tasks.length - 1 : false, [activeTask, tasks]);

  const handleExportStory = useCallback((story) => {
    const text = `# ${story.title}\n\nStory ${story.story_number} · ${PHASE_LABELS[story.phase]} · ${story.story_type}\n${story.word_count?.toLocaleString() || ''} words\n\n${story.text || ''}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        addToast('Story copied to clipboard', 'success');
      });
    }
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `story-${story.story_number}-${story.title?.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [addToast]);

  const handleBatchApprove = useCallback(async () => {
    if (batchSelected.size === 0) return;
    const nums = [...batchSelected].filter(n => stories[n] && !approvedStories.includes(n));
    if (nums.length === 0) { addToast('No eligible stories to approve', 'warning'); return; }

    setBatchProgress({ current: 0, total: nums.length });
    for (let i = 0; i < nums.length; i++) {
      setBatchProgress({ current: i + 1, total: nums.length });
      await handleApprove(stories[nums[i]]);
    }
    setBatchProgress(null);
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

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowUp') { e.preventDefault(); navigateStory(-1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); navigateStory(1); }
      if (e.key === 'f' || e.key === 'F') {
        if (!e.ctrlKey && !e.metaKey) { setReadingMode(prev => !prev); }
      }
      if (e.key === 'Escape') { setReadingMode(false); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeStory) handleSaveForLater(activeStory);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (activeStory) setApproveConfirm(activeStory);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigateStory, activeStory]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/memories/story-engine-characters`);
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();

        if (cancelled) return;

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
              registry_id: c.registry_id,
              core_desire: c.core_desire,
              core_fear: c.core_fear,
              core_wound: c.core_wound,
              description: c.description,
            };
          }
        }

        if (Object.keys(chars).length > 0) {
          setCHARACTERS(chars);
          setWorldsList(worlds);
          const toggles = {};
          for (const w of worlds) toggles[w] = true;
          setWorldToggles(toggles);
          if (!selectedChar) {
            const firstKey = Object.keys(chars)[0];
            setSelectedChar(firstKey);
          }
        } else {
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

  const cacheKey = (charKey) => `se_tasks_${charKey}`;
  const storyCacheKey = (charKey) => `se_stories_${charKey}`;

  function getCachedTasks(charKey) {
    try {
      const raw = localStorage.getItem(cacheKey(charKey));
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() - data.ts > 86400000) { localStorage.removeItem(cacheKey(charKey)); return null; }
      return data.tasks;
    } catch { return null; }
  }

  function setCachedTasks(charKey, taskList) {
    try {
      localStorage.setItem(cacheKey(charKey), JSON.stringify({ ts: Date.now(), tasks: taskList }));
    } catch {}
  }

  function getCachedStories(charKey) {
    try {
      const raw = localStorage.getItem(storyCacheKey(charKey));
      if (!raw) return null;
      const data = JSON.parse(raw);
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
    } catch {}
  }

  useEffect(() => {
    if (!selectedChar) return;
    setActiveTask(null);
    setActiveStory(null);
    setConsistencyConflicts([]);
    setTherapyMemories([]);
    setSavedStories([]);

    const cachedStoryData = getCachedStories(selectedChar);
    if (cachedStoryData) {
      setStories(cachedStoryData.stories);
      setApprovedStories(cachedStoryData.approved);
    } else {
      setStories({});
      setApprovedStories([]);
    }

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
            setStories(prev => ({ ...prev, ...dbStories }));
            setApprovedStories(prev => [...new Set([...prev, ...dbApproved])]);
            setSavedStories(dbSaved);
            setCachedStories(selectedChar,
              { ...(cachedStoryData?.stories || {}), ...dbStories },
              [...new Set([...(cachedStoryData?.approved || []), ...dbApproved])]);
          }
        }
      } catch {}

    })();

    const cached = getCachedTasks(selectedChar);
    if (cached?.length) {
      setTasks(cached);
      const savedNum = (() => { try { return Number(localStorage.getItem('se_activeTaskNum')); } catch { return 0; } })();
      const restored = savedNum && cached.find(t => t.story_number === savedNum);
      setActiveTask(restored || cached[0]);
      if (restored && cachedStoryData?.stories?.[savedNum]) setActiveStory(cachedStoryData.stories[savedNum]);
      return;
    }

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
      } catch {}
      setTasks([]);
    })();
  }, [selectedChar]);

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

  async function handleBatchGenerate() {
    // Find all ungenerated tasks
    const ungenerated = tasks.filter(t => !stories[t.story_number] && !approvedStories.includes(t.story_number));
    if (!ungenerated.length) {
      addToast('All stories already generated', 'info');
      return;
    }

    if (!window.confirm(`Generate ${ungenerated.length} remaining stories? This runs the full quality pipeline for each.`)) return;

    setGenerating(true);
    setBatchGenProgress({ current: 0, total: ungenerated.length, currentTitle: ungenerated[0]?.title });

    // Build previous stories from already approved/generated
    const previousStories = approvedStories
      .sort((a, b) => a - b)
      .map(n => ({
        number: n,
        title: stories[n]?.title || `Story ${n}`,
        summary: (stories[n]?.text || '').slice(0, 800),
      }));

    try {
      const response = await fetch(`${API_BASE}/memories/batch-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterKey: selectedChar,
          taskBriefs: ungenerated,
          previousStories,
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const newStories = { ...stories };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (line.includes('event: progress') || data.status === 'generating') {
                setBatchGenProgress(prev => ({
                  ...prev,
                  current: data.completed || prev?.current || 0,
                  currentTitle: data.title || prev?.currentTitle,
                }));
              }
              if (data.word_count && data.story_number) {
                // Story completed — update the stories map
                setBatchGenProgress(prev => ({
                  ...prev,
                  current: data.completed || (prev?.current || 0) + 1,
                }));
              }
            } catch { /* skip unparseable SSE lines */ }
          }
          if (line.startsWith('event: story_complete')) {
            // Next line will have the data
          }
        }
      }

      // After stream ends, reload all stories from the pipeline results
      // Re-fetch the story tasks to get fresh data
      addToast(`Batch generation complete — ${ungenerated.length} stories generated`, 'success');
    } catch (e) {
      console.error('Batch generate error:', e);
      addToast('Batch generation failed — some stories may not have been generated', 'error');
    } finally {
      setGenerating(false);
      setBatchGenProgress(null);
    }
  }

  async function handleGenerate(task) {
    setGenerating(true);
    setGeneratingNum(task.story_number);
    setActiveTask(task);
    setActiveStory(null);
    setConsistencyConflicts([]);
    setTherapyMemories([]);
    startTimer();

    // On mobile, scroll to top so the generating indicator is visible
    if (window.innerWidth <= 900) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    try {
      const previousStories = approvedStories
        .filter((n) => n < task.story_number)
        .sort((a, b) => a - b)
        .map((n) => ({
          number: n,
          title: stories[n]?.title || `Story ${n}`,
          summary: stories[n]?.text?.slice(0, 800) || '',
        }));

      const res = await fetch(`${API_BASE}/memories/pipeline-generate`, {
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

  async function handleSaveForLater(story) {
    if (processingStory === story.story_number) return;
    setProcessingStory(story.story_number);
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
      setProcessingStory(null);
    }
  }

  async function handleApprove(story) {
    if (processingStory === story.story_number) return;
    setProcessingStory(story.story_number);

    const nextApproved = [...new Set([...approvedStories, story.story_number])];
    setApprovedStories(nextApproved);
    setSavedStories(prev => [...new Set([...prev, story.story_number])]);
    setCachedStories(selectedChar, stories, nextApproved);

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
      addToast('Failed to extract story memories', 'error');
    } finally {
      setTherapyLoading(false);
    }

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
      addToast('Failed to update character registry', 'error');
    }

    // Texture layer generation — fires BEFORE arc tracking so story 47 bleed is not skipped
    try {
      const textureRes = await fetch(`${API_BASE}/texture-layer/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: {
            story_number: story.story_number,
            title:        story.title,
            text:         story.text,
            phase:        story.phase,
            story_type:   story.story_type,
          },
          character_key:      selectedChar,
          characters_present: tasks
            .find(t => t.story_number === story.story_number)
            ?.characters_present || [],
          registry_id: char?.registry_id || null,
        }),
      });

      if (textureRes.ok) {
        const textureData = await textureRes.json();
        setLastTexture({
          story_number: story.story_number,
          story_title:  story.title,
          texture:      textureData.texture,
        });
        if (textureData.texture?.amber_notes?.length) {
          setAmberTextureNotes({
            story_number: story.story_number,
            story_title:  story.title,
            notes:        textureData.texture.amber_notes,
            texture_id:   textureData.texture.id,
          });
        }
      }
    } catch (e) {
      console.error('texture layer generation error:', e);
      addToast('Failed to generate texture layers', 'error');
    }

    // Arc tracking update — after texture so bleed_generated flag doesn't block story 47
    try {
      await fetch(`${API_BASE}/arc-tracking/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_key: selectedChar,
          story_number: story.story_number,
          story_type: story.story_type,
          phase: story.phase,
          phone_appeared: story.text?.toLowerCase().includes('her phone') ||
                          story.text?.toLowerCase().includes('the phone'),
        }),
      });
    } catch (e) {
      console.error('arc tracking update error:', e);
      addToast('Failed to update arc tracking', 'error');
    }

    // Scene eligibility check
    if (story.db_id) {
      try {
        const eligibilityRes = await fetch(`${API_BASE}/world/scenes/check-eligibility`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            story_id: story.db_id,
            character_key: selectedChar,
            story_text: story.text,
            story_type: story.story_type,
            story_number: story.story_number,
            characters_present: tasks
              .find(t => t.story_number === story.story_number)
              ?.characters_present || [],
          }),
        });
        if (eligibilityRes.ok) {
          const eligibility = await eligibilityRes.json();
          if (eligibility.eligible) {
            setAmberNotification({
              type: 'scene_eligible',
              story_number: story.story_number,
              story_title: story.title,
              eligibility,
            });
          }
        }
      } catch (e) {
        console.error('scene eligibility check error:', e);
        addToast('Failed to check scene eligibility', 'error');
      }
    }

    setProcessingStory(null);

    // Auto-advance to the next unwritten story
    const nextUnwritten = tasks.find(
      t => t.story_number > story.story_number && !stories[t.story_number] && !nextApproved.includes(t.story_number)
    );
    if (nextUnwritten) {
      setActiveTask(nextUnwritten);
      setActiveStory(null);
    }
  }

  function handleReject(story) {
    // Soft-delete: keep in undo buffer for 10 seconds
    setRejectedStory({ story, timestamp: Date.now() });
    const nextStories = { ...stories };
    delete nextStories[story.story_number];
    setStories(nextStories);
    setActiveStory(null);
    setActiveTask(tasks.find((t) => t.story_number === story.story_number) || null);
    setCachedStories(selectedChar, nextStories, approvedStories);
    addToast('Story rejected', 'info');
  }

  function handleUndoReject() {
    if (!rejectedStory) return;
    const restored = rejectedStory.story;
    const nextStories = { ...stories, [restored.story_number]: restored };
    setStories(nextStories);
    setActiveStory(restored);
    setActiveTask(tasks.find(t => t.story_number === restored.story_number) || null);
    setCachedStories(selectedChar, nextStories, approvedStories);
    setRejectedStory(null);
    addToast('Story restored', 'success');
  }

  // Clear undo buffer after 10 seconds
  useEffect(() => {
    if (!rejectedStory) return;
    const timer = setTimeout(() => setRejectedStory(null), 10000);
    return () => clearTimeout(timer);
  }, [rejectedStory]);

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

  async function handleEdit(story, newText) {
    const updated = { ...story, text: newText, word_count: newText.split(/\s+/).length };
    const nextStories = { ...stories, [story.story_number]: updated };
    setStories(nextStories);
    setActiveStory(updated);
    setCachedStories(selectedChar, nextStories, approvedStories);

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

    await handleCheckConsistency(updated);
  }

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

  function handleWorldToggle(worldId) {
    setWorldToggles((prev) => ({ ...prev, [worldId]: !prev[worldId] }));
  }

  function handleSelectTask(task) {
    setActiveTask(task);
    setActiveStory(stories[task.story_number] || null);
    setConsistencyConflicts([]);
    setTherapyMemories([]);
  }

  return (
    <div className={`se-page ${readingMode ? 'se-fullscreen-reading' : ''} ${writeMode ? 'se-write-mode' : ''} ${activeStory ? 'se-has-active-story' : ''}`}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ── Slim top bar ──────────────────────────────────── */}
      {!readingMode && (
        <div className="se-topbar">
          <button className="se-btn-back" onClick={() => navigate('/')}>
            ← Home
          </button>
        </div>
      )}

      {/* ── Mobile deck: character + arc (visible < 900px) ─────────── */}
      {!readingMode && !writeMode && (
        <div className="se-mobile-deck">
          <CharacterSelector
            characters={CHARACTERS}
            selectedChar={selectedChar}
            onSelect={setSelectedChar}
            loading={charsLoading}
          />
          <ArcProgress
            approvedStories={approvedStories}
            savedStories={savedStories}
            stories={stories}
          />
        </div>
      )}

      {/* ── Main body: sidebar + workspace ──────────────────────────── */}
      <div className="se-body">
        {/* ── Left sidebar ─────────────────────────────────────────── */}
        {!readingMode && !writeMode && (
          <div className="se-sidebar">
            {/* Character selector */}
            <div className="se-sidebar-section">
              <CharacterSelector
                characters={CHARACTERS}
                selectedChar={selectedChar}
                onSelect={setSelectedChar}
                loading={charsLoading}
              />
            </div>

            {/* Arc progress — compact */}
            <div className="se-sidebar-section se-sidebar-arc">
              <ArcProgress
                approvedStories={approvedStories}
                savedStories={savedStories}
                stories={stories}
              />
            </div>

            {/* Arc tracking panel */}
            {selectedChar && (
              <div className="se-sidebar-section">
                <ArcTrackingPanel
                  characterKey={selectedChar}
                  characterName={char?.display_name || selectedChar}
                />
              </div>
            )}

            {/* World toggles — compact pills */}
            {Object.keys(worldToggles).length > 0 && (
              <div className="se-sidebar-section se-sidebar-worlds">
                <div className="se-sidebar-label">Worlds</div>
                <div className="se-world-pills">
                  {Object.entries(worldToggles).map(([worldId, isOpen]) => (
                    <button
                      key={worldId}
                      className={`se-world-pill ${isOpen ? 'open' : 'closed'}`}
                      onClick={() => handleWorldToggle(worldId)}
                      title={`${WORLD_LABELS[worldId] || worldId}: New characters ${isOpen ? 'open' : 'locked'}`}
                    >
                      <span className="se-world-pill-name">{WORLD_LABELS[worldId] || worldId}</span>
                      <span className={`se-world-pill-dot ${isOpen ? 'open' : 'closed'}`} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stats — collapsible */}
            <div className="se-sidebar-section">
              <button
                className="se-sidebar-toggle"
                onClick={() => setShowStats(prev => !prev)}
              >
                <span>Stats</span>
                <span className="se-sidebar-toggle-arrow">{showStats ? '▾' : '▸'}</span>
              </button>
              {showStats && (
                <StatsDashboard
                  tasks={tasks}
                  stories={stories}
                  approvedStories={approvedStories}
                  savedStories={savedStories}
                />
              )}
            </div>

            {/* Story Sparks — collapsible */}
            {selectedChar && (() => {
              const StorySparks = () => {
                const [sparks, setSparks] = React.useState([]);
                const [open, setOpen] = React.useState(false);
                const [loading, setLoading] = React.useState(false);

                const loadSparks = () => {
                  if (sparks.length) { setOpen(!open); return; }
                  setOpen(true);
                  setLoading(true);
                  fetch(`/api/v1/story-health/story-sparks/${selectedChar}`)
                    .then(r => r.json())
                    .then(d => setSparks(d.sparks || []))
                    .catch(err => console.warn('story sparks failed:', err.message))
                    .finally(() => setLoading(false));
                };

                return (
                  <div className="se-sidebar-section">
                    <button className="se-sidebar-toggle" onClick={loadSparks}>
                      <span>Story Sparks</span>
                      <span className="se-sidebar-toggle-arrow">{open ? '▾' : '▸'}</span>
                    </button>
                    {open && (
                      <div className="se-sparks-list">
                        {loading ? (
                          <div className="se-sparks-loading">Generating sparks…</div>
                        ) : sparks.length === 0 ? (
                          <div className="se-sparks-loading">No sparks available yet</div>
                        ) : sparks.map((s, i) => (
                          <div key={i} className="se-spark-card">
                            <div className="se-spark-type">{s.type || 'Spark'}</div>
                            <div className="se-spark-text">{s.suggestion || s.title || JSON.stringify(s)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              };
              return <StorySparks />;
            })()}

            {/* Keyboard shortcuts */}
            <div className="se-sidebar-shortcuts">
              <span>↑↓ Nav</span>
              <span>F Read</span>
              <span>⌘S Save</span>
              <span>⌘↵ Approve…</span>
            </div>
          </div>
        )}

        {/* ── Workspace: task list + story column ──────────────────── */}
        <div className={`se-workspace${storiesMinimized ? ' se-stories-collapsed' : ''}${!tasksLoading && tasks.length === 0 ? ' se-workspace-hero' : ''}`}>
          {!readingMode && !writeMode && tasksLoading && (
            <div className="se-task-list">
              <div className="se-task-loading">
                <div className="se-spinner" style={{ borderTopColor: char?.color }} />
                <span>Building {char?.display_name}'s 50-story arc…</span>
                <span className="se-task-loading-elapsed">{elapsed}s elapsed · typically 2–3 minutes</span>
              </div>
            </div>
          )}

          {!readingMode && !writeMode && !tasksLoading && tasks.length === 0 && (
            <div className="se-hero-fullpage">
              <div className="se-hero-icon" style={{ color: char?.color }}>{char?.icon || '◇'}</div>
              <div className="se-hero-title">Build {char?.display_name ? `${char.display_name}'s` : 'your'} story engine</div>
              <div className="se-hero-text">
                Generate a 50-story progression that moves from establishment
                through pressure, crisis, and integration. The first run takes
                a few minutes — after that, it loads instantly.
              </div>
              <button
                className="se-btn se-btn-generate-arc se-primary-btn"
                style={{ background: char?.color || '#b0922e' }}
                onClick={() => handleGenerateArc()}
              >
                Generate Story Arc
              </button>
              <div className="se-hero-sub">Typically 2–3 minutes</div>
            </div>
          )}

          {!readingMode && !writeMode && !tasksLoading && tasks.length > 0 && (
            <div className="se-task-list">
              <>
                <div className="se-task-section-intro">
                    <div className="se-task-section-title">Story Arc</div>
                    <div className="se-task-section-sub">
                      {char?.display_name}'s 50-story progression
                    </div>
                  </div>

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
                        className="se-btn se-btn-generate-all"
                        style={{ background: char?.color || '#b0922e', color: '#fff' }}
                        onClick={handleBatchGenerate}
                        disabled={generating}
                        title="Generate all remaining stories through the quality pipeline"
                      >
                        {generating && batchGenProgress ? `⟳ ${batchGenProgress.current}/${batchGenProgress.total}` : '▶ Generate All'}
                      </button>
                      <button
                        className="se-btn se-btn-regen"
                        onClick={() => {
                          if (window.confirm('Regenerate the entire arc? This replaces all 50 task briefs.')) {
                            handleGenerateArc(true);
                          }
                        }}
                      >
                        ↻ Regen
                      </button>
                    </div>
                  </div>

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
            </div>
          )}

          {/* Story column — hidden in hero state on mobile */}
          <div className={`se-story-column${storiesMinimized ? ' se-stories-collapsed' : ''}`}>
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
              onApprove={(story, needsConfirm) => needsConfirm ? setApproveConfirm(story) : handleApprove(story)}
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
                // Collect all characters in the same world as the POV character
                const charData = selectedChar && CHARACTERS[selectedChar];
                const world = charData?.world;
                const sceneChars = world
                  ? Object.keys(CHARACTERS).filter(k => CHARACTERS[k].world === world)
                  : selectedChar ? [selectedChar] : [];
                if (sceneChars.length) params.set('chars', sceneChars.join(','));
                if (charData?.registry_id) params.set('registry_id', charData.registry_id);
                const charNames = {};
                sceneChars.forEach(k => { charNames[k] = CHARACTERS[k]?.display_name || k; });
                navigate(`/story-evaluation?${params.toString()}`, {
                  state: {
                    storyText: story?.text,
                    taskBrief: activeTask,
                    activeWorld: activeWorld || world,
                    charNames,
                    povChar: selectedChar,
                  },
                });
              }}
              charObj={char}
              selectedCharKey={selectedChar}
              activeWorld={activeWorld}
              allCharacters={CHARACTERS}
              onSelectChar={setSelectedChar}
              storiesMinimized={storiesMinimized}
              onToggleStoriesMinimized={() => setStoriesMinimized(m => !m)}
            />
          )}
        </div>
        </div>
      </div>

      {/* Amber notification — scene eligibility after story approval */}
      {amberNotification?.type === 'scene_eligible' && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 340,
          background: '#fff',
          border: '1px solid #e8dcf5',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(168,137,200,0.18)',
          padding: '16px 18px',
          zIndex: 500,
          animation: 'ws-slide-up 0.22s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #d4789a, #a889c8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: '#fff', fontWeight: 700,
            }}>A</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Amber</div>
              <div style={{ fontSize: 10, color: '#9999b3' }}>Story {amberNotification.story_number} approved</div>
            </div>
            <button
              onClick={() => setAmberNotification(null)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none',
                cursor: 'pointer', color: '#9999b3', fontSize: 16 }}
            >×</button>
          </div>

          <div style={{ fontSize: 12, color: '#5a5a7a', lineHeight: 1.6, marginBottom: 12 }}>
            <strong style={{ color: '#1a1a2e' }}>
              {amberNotification.eligibility.charA.name}
              {amberNotification.eligibility.charB
                ? ` & ${amberNotification.eligibility.charB.name}`
                : ''
              }
            </strong>
            {' '}— this story ends at a door.{' '}
            <span style={{ color: '#a889c8' }}>
              {amberNotification.eligibility.scene_type?.replace(/_/g, ' ')}
            </span>
            {' '}· intensity:{' '}
            <span style={{ color: '#d4789a' }}>
              {amberNotification.eligibility.intensity}
            </span>
            {amberNotification.eligibility.location && (
              <span style={{ color: '#7ab3d4' }}>
                {' '}· {amberNotification.eligibility.location}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                navigate('/scene-studio', {
                  state: { autoPopulate: amberNotification.eligibility }
                });
                setAmberNotification(null);
              }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8,
                background: '#a889c8', color: '#fff',
                border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
              }}
            >
              Generate Scene
            </button>
            <button
              onClick={() => setAmberNotification(null)}
              style={{
                padding: '8px 14px', borderRadius: 8,
                background: 'transparent', color: '#9999b3',
                border: '1px solid #e8e0f0', cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Approval confirmation modal */}
      {approveConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setApproveConfirm(null)}>
          <div style={{
            background: '#fff', borderRadius: 14, padding: '24px 28px', width: 380,
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>
              Approve Story {approveConfirm.story_number}?
            </div>
            <div style={{ fontSize: 13, color: '#5a5a7a', marginBottom: 16, lineHeight: 1.6 }}>
              "{approveConfirm.title}" — This will extract memories, update registry, generate texture layers, and check scene eligibility.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setApproveConfirm(null)}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid #e0dcd4',
                  background: '#fff', cursor: 'pointer', fontSize: 13, color: '#666',
                }}
              >Cancel</button>
              <button
                onClick={() => { handleApprove(approveConfirm); setApproveConfirm(null); }}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: char?.color || '#9a7d1e', color: '#fff',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >Approve</button>
            </div>
          </div>
        </div>
      )}

      {/* Batch progress indicator */}
      {batchProgress && (
        <div style={{
          position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: '#fff', border: '1px solid #e0dcd4', borderRadius: 10,
          padding: '10px 20px', zIndex: 550, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', gap: 12, fontSize: 13,
        }}>
          <div className="se-spinner" style={{ width: 16, height: 16, borderTopColor: char?.color }} />
          <span>Approving {batchProgress.current}/{batchProgress.total}…</span>
          <div style={{ width: 80, height: 4, background: '#eee', borderRadius: 2 }}>
            <div style={{
              width: `${(batchProgress.current / batchProgress.total) * 100}%`,
              height: '100%', background: char?.color || '#9a7d1e', borderRadius: 2,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Batch generation progress indicator */}
      {batchGenProgress && (
        <div style={{
          position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: '#1c1917', color: '#faf8f4', border: '1px solid #333',
          borderRadius: 10, padding: '10px 20px', zIndex: 550,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 12, fontSize: 13,
          maxWidth: 420,
        }}>
          <div className="se-spinner" style={{ width: 16, height: 16, borderTopColor: char?.color || '#b0922e' }} />
          <div>
            <div style={{ fontWeight: 600 }}>Generating {batchGenProgress.current}/{batchGenProgress.total}</div>
            {batchGenProgress.currentTitle && (
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{batchGenProgress.currentTitle}</div>
            )}
          </div>
          <div style={{ width: 80, height: 4, background: '#333', borderRadius: 2, marginLeft: 'auto' }}>
            <div style={{
              width: `${(batchGenProgress.current / batchGenProgress.total) * 100}%`,
              height: '100%', background: char?.color || '#b0922e', borderRadius: 2,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Undo rejected story */}
      {rejectedStory && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a2e', color: '#fff', borderRadius: 10,
          padding: '10px 16px', zIndex: 550, display: 'flex', alignItems: 'center', gap: 12,
          fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}>
          <span>Story {rejectedStory.story.story_number} rejected</span>
          <button
            onClick={handleUndoReject}
            style={{
              padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)',
              background: 'transparent', color: '#fff', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
            }}
          >Undo</button>
        </div>
      )}

      {/* Inline texture preview after approval */}
      {lastTexture && !amberTextureNotes && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, width: 360,
          background: '#fff', border: '1px solid #e8dcf5', borderRadius: 14,
          boxShadow: '0 8px 32px rgba(168,137,200,0.18)',
          padding: '16px 18px', zIndex: 498, maxHeight: '50vh', overflowY: 'auto',
          animation: 'ws-slide-up 0.22s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>
              Texture — Story {lastTexture.story_number}
            </div>
            <button
              onClick={() => setLastTexture(null)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none',
                cursor: 'pointer', color: '#9999b3', fontSize: 16 }}
            >&times;</button>
          </div>
          {lastTexture.texture?.inner_thought_text && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#b0922e', marginBottom: 4 }}>
                Inner Thought ({lastTexture.texture.inner_thought_type?.replace('_', ' ')})
              </div>
              <div style={{ fontSize: 12, color: '#3a3a5a', lineHeight: 1.6, fontStyle: 'italic' }}>
                {lastTexture.texture.inner_thought_text.slice(0, 200)}{lastTexture.texture.inner_thought_text.length > 200 ? '…' : ''}
              </div>
            </div>
          )}
          {lastTexture.texture?.body_narrator_text && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#d4789a', marginBottom: 4 }}>Body Narrator</div>
              <div style={{ fontSize: 12, color: '#3a3a5a', lineHeight: 1.6 }}>
                {lastTexture.texture.body_narrator_text}
              </div>
            </div>
          )}
          {lastTexture.texture?.conflict_surface_text && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#c0392b', marginBottom: 4 }}>Conflict</div>
              <div style={{ fontSize: 12, color: '#3a3a5a', lineHeight: 1.6 }}>
                {lastTexture.texture.conflict_surface_text}
              </div>
            </div>
          )}
          {lastTexture.texture?.private_moment_text && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7c3aed', marginBottom: 4 }}>Private Moment</div>
              <div style={{ fontSize: 12, color: '#3a3a5a', lineHeight: 1.6 }}>
                {lastTexture.texture.private_moment_text.slice(0, 200)}{lastTexture.texture.private_moment_text.length > 200 ? '…' : ''}
              </div>
            </div>
          )}
          {lastTexture.texture?.post_text && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0d9668', marginBottom: 4 }}>Post ({lastTexture.texture.post_platform})</div>
              <div style={{ fontSize: 12, color: '#3a3a5a', lineHeight: 1.6 }}>
                {lastTexture.texture.post_text}
              </div>
            </div>
          )}
          {lastTexture.texture?.bleed_text && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#546678', marginBottom: 4 }}>Bleed</div>
              <div style={{ fontSize: 12, color: '#3a3a5a', lineHeight: 1.6 }}>
                {lastTexture.texture.bleed_text}
              </div>
            </div>
          )}
          <button
            onClick={() => {
              navigate(`/texture-review/${lastTexture.story_number}?char=${selectedChar}`);
              setLastTexture(null);
            }}
            style={{
              width: '100%', padding: '8px 0', borderRadius: 8,
              background: '#a889c8', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, marginTop: 4,
            }}
          >
            Full Texture Review
          </button>
        </div>
      )}

      {/* Amber texture notification — texture layer notes after story approval */}
      {amberTextureNotes && (
        <div style={{
          position: 'fixed',
          bottom: amberNotification ? 220 : 24,
          right: 24,
          width: 360,
          background: '#fff',
          border: '1px solid #e8dcf5',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(168,137,200,0.18)',
          padding: '16px 18px',
          zIndex: 499,
          animation: 'ws-slide-up 0.22s ease',
          maxHeight: '60vh',
          overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #d4789a, #a889c8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: '#fff', fontWeight: 700,
            }}>A</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Amber read Story {amberTextureNotes.story_number}</div>
              <div style={{ fontSize: 10, color: '#9999b3' }}>"{amberTextureNotes.story_title}"</div>
            </div>
            <button
              onClick={() => setAmberTextureNotes(null)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none',
                cursor: 'pointer', color: '#9999b3', fontSize: 16 }}
            >&times;</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {amberTextureNotes.notes.map((note, i) => (
              <div key={i} style={{
                padding: '10px 12px',
                background: note.type === 'warning'   ? '#fdf0f4' :
                            note.type === 'contradiction' ? '#f6f1fc' :
                            note.type === 'opportunity' ? '#f0f8fd' :
                            '#fafafa',
                borderRadius: 8,
                border: `1px solid ${
                  note.type === 'warning'   ? '#f5dce6' :
                  note.type === 'contradiction' ? '#e8dcf5' :
                  note.type === 'opportunity' ? '#daeef9' :
                  '#f2eef8'
                }`,
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: note.type === 'warning'   ? '#d4789a' :
                         note.type === 'contradiction' ? '#a889c8' :
                         note.type === 'opportunity' ? '#7ab3d4' :
                         '#9999b3',
                  marginBottom: 4,
                }}>{note.type}</div>
                <div style={{ fontSize: 12, color: '#3a3a5a', lineHeight: 1.6 }}>
                  {note.note}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => {
                navigate(`/texture-review/${amberTextureNotes.story_number}?char=${selectedChar}`);
                setAmberTextureNotes(null);
              }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8,
                background: '#a889c8', color: '#fff',
                border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
              }}
            >
              Review Texture
            </button>
            <button
              onClick={() => setAmberTextureNotes(null)}
              style={{
                padding: '8px 14px', borderRadius: 8,
                background: 'transparent', color: '#9999b3',
                border: '1px solid #e8e0f0', cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}