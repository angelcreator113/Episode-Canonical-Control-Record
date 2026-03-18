import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PHASE_COLORS, PHASE_LABELS, TYPE_ICONS, WORLD_LABELS, WORLD_SHORT, ARC_SHORT_LABELS } from './storyEngineConstants';
import ArcGenerationStatus from './ArcGenerationStatus';

// ─── Searchable character dropdown ────────────────────────────────────────────
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

// ─── Arc progress bar ─────────────────────────────────────────────────────────
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
            <div className="se-arc-phase-label" style={{ color: PHASE_COLORS[phase] }} title={PHASE_LABELS[phase]}>
              {ARC_SHORT_LABELS[phase]}
            </div>
            <div className="se-arc-phase-bar">
              <div className="se-arc-phase-fill" style={{ width: `${pct}%`, background: PHASE_COLORS[phase] }} />
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
          <span className="se-task-type" title={task.story_type}>{TYPE_ICONS[task.story_type]}</span>
          <span className="se-task-phase" style={{ color: PHASE_COLORS[task.phase] }}>{PHASE_LABELS[task.phase]}</span>
          {isSaved && !isApproved && <span className="se-task-saved-badge">saved</span>}
          {task.new_character && <span className="se-task-new-char">+ {task.new_character_name}</span>}
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

// ─── StoryNavigator (left panel) ──────────────────────────────────────────────
export default function StoryNavigator({
  CHARACTERS, charsLoading, selectedChar, setSelectedChar, char,
  approvedStories, savedStories, stories,
  tasks, tasksLoading, filteredTasks,
  activeTask, generation,
  handleGenerateArc, handleGenerate, handleSelectTask,
  handleGenerateNextChapter, generatingNextChapter,
  phaseFilter, setPhaseFilter, searchQuery, setSearchQuery,
  batchMode, setBatchMode, batchSelected, setBatchSelected,
  handleBatchApprove, handleBatchToggle,
  mobileNav, setMobileNav,
  elapsed,
  arcProgress,
}) {
  return (
    <aside className={`se-navigator ${mobileNav ? 'se-drawer-open' : ''}`}>
      <div className="se-nav-top">
        <CharacterSelector
          characters={CHARACTERS}
          selectedChar={selectedChar}
          onSelect={(c) => { setSelectedChar(c); setMobileNav(false); }}
          loading={charsLoading}
        />
        <ArcProgress
          approvedStories={approvedStories}
          savedStories={savedStories}
          stories={stories}
        />
      </div>

      {/* Nav actions */}
      <div className="se-nav-actions">
        {tasks.length === 0 && !tasksLoading && (
          <button
            className="se-nav-btn se-nav-btn--primary"
            style={{ background: char?.color || '#b0922e' }}
            onClick={() => handleGenerateNextChapter()}
            disabled={generatingNextChapter}
          >
            {generatingNextChapter ? 'Generating…' : 'Generate Chapter 1'}
          </button>
        )}
        {tasks.length > 0 && tasks.length < 50 && (
          <>
            <button
              className="se-nav-btn se-nav-btn--generate"
              style={{ background: char?.color || '#b0922e' }}
              onClick={() => handleGenerateNextChapter()}
              disabled={generatingNextChapter}
            >
              {generatingNextChapter ? 'Generating…' : `Generate Chapter ${tasks.length + 1}`}
            </button>
            <button
              className={`se-nav-btn se-nav-btn--secondary ${batchMode ? 'active' : ''}`}
              onClick={() => { setBatchMode(prev => !prev); setBatchSelected(new Set()); }}
            >
              {batchMode ? '✕' : '☐'}
            </button>
            {batchMode && batchSelected.size > 0 && (
              <button
                className="se-nav-btn se-nav-btn--generate"
                style={{ background: char?.color }}
                onClick={handleBatchApprove}
              >
                Approve {batchSelected.size}
              </button>
            )}
          </>
        )}
      </div>

      {/* Filters */}
      {tasks.length > 0 && (
        <div className="se-nav-filter">
          <input
            className="se-nav-search"
            type="text"
            placeholder="Search stories…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="se-nav-pills">
            {['establishment', 'pressure', 'crisis', 'integration'].map(p => (
              <button
                key={p}
                className={`se-nav-pill ${phaseFilter === p ? 'active' : ''}`}
                style={phaseFilter === p ? { background: PHASE_COLORS[p], color: '#fff' } : undefined}
                onClick={() => setPhaseFilter(prev => prev === p ? null : p)}
              >
                {PHASE_LABELS[p]}
              </button>
            ))}
          </div>
          <div className="se-nav-count">
            {filteredTasks.length}{filteredTasks.length !== tasks.length ? `/${tasks.length}` : ''} {filteredTasks.length === 1 ? 'story' : 'stories'}
          </div>
        </div>
      )}

      {/* Story list */}
      <div className="se-nav-stories">
        {tasksLoading ? (
          arcProgress ? (
            <ArcGenerationStatus
              arcProgress={arcProgress}
              charColor={char?.color}
              elapsed={elapsed}
            />
          ) : (
            <div className="se-nav-loading">
              <div className="se-spinner" style={{ borderTopColor: char?.color }} />
              <span>Building arc… {elapsed}s</span>
            </div>
          )
        ) : (
          filteredTasks.map((t) => (
            <TaskCard
              key={t.story_number}
              task={t}
              isApproved={approvedStories.includes(t.story_number)}
              isSaved={savedStories.includes(t.story_number) && !approvedStories.includes(t.story_number)}
              isActive={activeTask?.story_number === t.story_number}
              onGenerate={handleGenerate}
              onSelect={(task) => { handleSelectTask(task); setMobileNav(false); }}
              charColor={char?.color}
              generating={generation.generating && generation.generatingNum === t.story_number}
              batchMode={batchMode}
              batchSelected={batchSelected}
              onBatchToggle={handleBatchToggle}
            />
          ))
        )}
        {filteredTasks.length === 0 && tasks.length > 0 && (
          <div className="se-nav-empty">
            No stories match.
            <button onClick={() => { setPhaseFilter(null); setSearchQuery(''); }}>Clear</button>
          </div>
        )}
      </div>
    </aside>
  );
}
