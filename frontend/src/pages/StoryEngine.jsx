import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './StoryEngine.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

// ─── Character meta (mirrors backend CHARACTER_DNA) ───────────────────────────
const CHARACTERS = {
  justawoman: { display_name: 'JustAWoman', icon: '♛', role_type: 'special',  world: 'book1',    color: '#9a7d1e' },
  david:      { display_name: 'David',      icon: '◈',  role_type: 'pressure', world: 'book1',    color: '#c0392b' },
  dana:       { display_name: 'Dana',       icon: '◉',  role_type: 'support',  world: 'book1',    color: '#0d9668' },
  chloe:      { display_name: 'Chloe',      icon: '◎',  role_type: 'mirror',   world: 'book1',    color: '#7c3aed' },
  jade:       { display_name: 'Jade',       icon: '◆',  role_type: 'shadow',   world: 'book1',    color: '#546678' },
  lala:       { display_name: 'Lala',       icon: '✦',  role_type: 'special',  world: 'lalaverse', color: '#d63384' },
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
function WorldToggle({ worlds, onToggle }) {
  return (
    <div className="se-world-toggles">
      {Object.entries(worlds).map(([worldId, open]) => (
        <div key={worldId} className={`se-world-toggle ${open ? 'open' : 'closed'}`}>
          <div className="se-world-toggle-label">
            {worldId === 'book1' ? 'Book 1 World' : 'LalaVerse'}
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

// ─── Arc progress bar ─────────────────────────────────────────────────────────
function ArcProgress({ tasks, approvedStories }) {
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
            <div className="se-arc-phase-count">{approved}/{total}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Task card (story brief before writing) ───────────────────────────────────
function TaskCard({ task, isApproved, isActive, onGenerate, onSelect, charColor, generating }) {
  return (
    <div
      className={`se-task-card ${isActive ? 'active' : ''} ${isApproved ? 'approved' : ''}`}
      style={{ '--char-color': charColor }}
      onClick={() => onSelect(task)}
    >
      <div className="se-task-number">
        {isApproved
          ? <span className="se-task-check">✓</span>
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
          {generating ? 'Writing…' : 'Write'}
        </button>
      )}
    </div>
  );
}

// ─── Story reader / editor panel ──────────────────────────────────────────────
function StoryPanel({
  story, task, charColor, charName,
  onApprove, onReject, onEdit, onCheckConsistency,
  consistencyConflicts, consistencyLoading,
  therapyMemories, therapyLoading,
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(story?.text || '');
  const textareaRef = useRef(null);

  useEffect(() => {
    setEditText(story?.text || '');
    setEditing(false);
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
    </div>
  );

  return (
    <div className="se-story-panel">
      {/* Header */}
      <div className="se-story-header" style={{ borderBottomColor: charColor }}>
        <div className="se-story-header-left">
          <div className="se-story-header-num">Story {story.story_number}</div>
          <div className="se-story-header-title">{story.title}</div>
          <div className="se-story-header-meta">
            <span style={{ color: PHASE_COLORS[story.phase] }}>{PHASE_LABELS[story.phase]}</span>
            <span>·</span>
            <span>{TYPE_ICONS[story.story_type]} {story.story_type}</span>
            <span>·</span>
            <span>{story.word_count?.toLocaleString() || '—'} words</span>
          </div>
        </div>
        <div className="se-story-header-actions">
          {!editing && (
            <>
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
          <button className="se-new-char-approve">Add to Registry</button>
          <button className="se-new-char-reject">Story Only</button>
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
          <textarea
            ref={textareaRef}
            className="se-story-editor"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            spellCheck
          />
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

      {/* Therapy panel */}
      {therapyMemories?.length > 0 && (
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
    </div>
  );
}

// ─── Main StoryEngine component ───────────────────────────────────────────────
export default function StoryEngine() {
  const navigate = useNavigate();

  // Character selection
  const [selectedChar, setSelectedChar]       = useState('justawoman');
  const [activeWorld, setActiveWorld]         = useState('book1');

  // World creation toggles
  const [worldToggles, setWorldToggles]       = useState({
    book1:     true,
    lalaverse: true,
  });

  // Task arc (50 story briefs)
  const [tasks, setTasks]                     = useState([]);
  const [tasksLoading, setTasksLoading]       = useState(false);

  // Generated stories (storyNumber → story object)
  const [stories, setStories]                 = useState({});
  const [approvedStories, setApprovedStories] = useState([]); // story numbers

  // Active story/task in right panel
  const [activeTask, setActiveTask]           = useState(null);
  const [activeStory, setActiveStory]         = useState(null);

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

  const char = CHARACTERS[selectedChar];

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

  // ── Load tasks + stories: try localStorage → server cache → empty state ──
  useEffect(() => {
    if (!selectedChar) return;
    setActiveTask(null);
    setActiveStory(null);
    setConsistencyConflicts([]);
    setTherapyMemories([]);

    // Restore any previously-written stories for this character
    const cachedStoryData = getCachedStories(selectedChar);
    if (cachedStoryData) {
      setStories(cachedStoryData.stories);
      setApprovedStories(cachedStoryData.approved);
    } else {
      setStories({});
      setApprovedStories([]);
    }

    // 1. Check localStorage for task arc
    const cached = getCachedTasks(selectedChar);
    if (cached?.length) {
      setTasks(cached);
      setActiveTask(cached[0]);
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
            setActiveTask(data.tasks[0]);
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
      // Build previous stories context (last 3 approved)
      const previousStories = approvedStories
        .filter((n) => n < task.story_number)
        .slice(-3)
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
        alert('Story generation failed — please try again.');
        return;
      }

      const nextStories = { ...stories, [task.story_number]: data };
      setStories(nextStories);
      setActiveStory(data);
      setCachedStories(selectedChar, nextStories, approvedStories);
    } catch (e) {
      console.error('handleGenerate error:', e);
      alert('Story generation failed — please try again.');
    } finally {
      setGenerating(false);
      setGeneratingNum(null);
      stopTimer();
    }
  }

  // ── Approve a story ───────────────────────────────────────────────────────
  async function handleApprove(story) {
    const nextApproved = [...new Set([...approvedStories, story.story_number])];
    setApprovedStories(nextApproved);
    setCachedStories(selectedChar, stories, nextApproved);

    // Extract memories for therapy room
    setTherapyLoading(true);
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
      }
    } catch (e) {
      console.error('extract memories error:', e);
    } finally {
      setTherapyLoading(false);
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

  // ── Edit a story — triggers cascade check ────────────────────────────────
  async function handleEdit(story, newText) {
    const updated = { ...story, text: newText, word_count: newText.split(/\s+/).length };
    const nextStories = { ...stories, [story.story_number]: updated };
    setStories(nextStories);
    setActiveStory(updated);
    setCachedStories(selectedChar, nextStories, approvedStories);

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
    <div className="se-page">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="se-topbar">
        <button className="se-btn-back" onClick={() => navigate('/')}>
          ← Home
        </button>
        <div className="se-topbar-title">Story Engine</div>
        <WorldToggle worlds={worldToggles} onToggle={handleWorldToggle} />
      </div>

      {/* ── Character selector ────────────────────────────────────────────── */}
      <div className="se-char-bar">
        {Object.entries(CHARACTERS).map(([key, c]) => (
          <button
            key={key}
            className={`se-char-pill ${selectedChar === key ? 'active' : ''}`}
            style={{ '--char-color': c.color }}
            onClick={() => setSelectedChar(key)}
          >
            <span className="se-char-icon">{c.icon}</span>
            <span className="se-char-name">{c.display_name}</span>
            <span className="se-char-world">{c.world === 'lalaverse' ? 'LV' : 'B1'}</span>
          </button>
        ))}
      </div>

      {/* ── Arc progress ──────────────────────────────────────────────────── */}
      <ArcProgress tasks={tasks} approvedStories={approvedStories} />

      {/* ── Main workspace ────────────────────────────────────────────────── */}
      <div className="se-workspace">

        {/* Left: task list */}
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
              <div className="se-task-list-header">
                <span className="se-task-list-count">{tasks.length} stories</span>
                <button
                  className="se-btn se-btn-regen"
                  onClick={() => { if (window.confirm('Regenerate the entire arc? This replaces all 50 task briefs.')) handleGenerateArc(true); }}
                >
                  ↻ Regenerate
                </button>
              </div>
              {tasks.map((task) => (
                <TaskCard
                  key={task.story_number}
                  task={task}
                  isApproved={approvedStories.includes(task.story_number)}
                  isActive={activeTask?.story_number === task.story_number}
                  onGenerate={handleGenerate}
                  onSelect={handleSelectTask}
                  charColor={char?.color}
                  generating={generating && generatingNum === task.story_number}
                />
              ))}
            </>
          )}
        </div>

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
              consistencyConflicts={consistencyConflicts}
              consistencyLoading={consistencyLoading}
              therapyMemories={therapyMemories}
              therapyLoading={therapyLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
}
