import { useState, useEffect, useCallback, useMemo } from 'react';
import usePersistedState from './usePersistedState';
import useGenerationJob from './useGenerationJob';
import apiClient from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

// Track 3 module-scope helpers (Pattern D). Pre-flight (§9.11) noted the
// previous local authHeaders(extra={}) supported header merging, but no
// caller actually used the extra param — dead-code drift, dropped here.
export const persistStory = (payload) =>
  apiClient.post(`${API_BASE}/stories`, payload);

export const deleteStoryFromDb = (dbId) =>
  apiClient.delete(`${API_BASE}/stories/${dbId}`);

const ROLE_COLORS = {
  protagonist: '#9a7d1e',
  special:     '#9a7d1e',
  pressure:    '#c0392b',
  mirror:      '#7c3aed',
  support:     '#0d9668',
  shadow:      '#546678',
};

const FALLBACK_CHARACTERS = {
  justawoman: { display_name: 'JustAWoman', icon: '♛', role_type: 'special',  world: 'book-1',    color: '#9a7d1e' },
  david:      { display_name: 'David',      icon: '◈',  role_type: 'pressure', world: 'book-1',    color: '#c0392b' },
  dana:       { display_name: 'Dana',       icon: '◉',  role_type: 'support',  world: 'book-1',    color: '#0d9668' },
  chloe:      { display_name: 'Chloe',      icon: '◎',  role_type: 'mirror',   world: 'book-1',    color: '#7c3aed' },
  jade:       { display_name: 'Jade',       icon: '◆',  role_type: 'shadow',   world: 'book-1',    color: '#546678' },
  lala:       { display_name: 'Lala',       icon: '✦',  role_type: 'special',  world: 'lalaverse', color: '#d63384' },
};

// ─── localStorage cache helpers ─────────────────────────────────────────────
function getCachedTasks(charKey) {
  try {
    const raw = localStorage.getItem(`se_tasks_${charKey}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.ts > 86400000) { localStorage.removeItem(`se_tasks_${charKey}`); return null; }
    return data.tasks;
  } catch { return null; }
}

function setCachedTasks(charKey, taskList) {
  try {
    localStorage.setItem(`se_tasks_${charKey}`, JSON.stringify({ ts: Date.now(), tasks: taskList }));
  } catch {}
}

function getCachedStories(charKey) {
  try {
    const raw = localStorage.getItem(`se_stories_${charKey}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.ts > 604800000) { localStorage.removeItem(`se_stories_${charKey}`); return null; }
    return { stories: data.stories || {}, approved: data.approved || [] };
  } catch { return null; }
}

function setCachedStories(charKey, storiesObj, approvedArr) {
  try {
    localStorage.setItem(`se_stories_${charKey}`, JSON.stringify({
      ts: Date.now(), stories: storiesObj, approved: approvedArr,
    }));
  } catch {}
}

// ─── Toast counter ──────────────────────────────────────────────────────────
let toastIdCounter = 0;

/**
 * Central hook for all StoryEngine state + handlers.
 * Consolidates ~30 state variables and all async action handlers.
 * Includes optimistic UI (#7) and streamlined approval workflow (#4).
 */
export default function useStoryEngine() {
  // --- Characters ---
  const [CHARACTERS, setCHARACTERS] = useState(FALLBACK_CHARACTERS);
  const [charsLoading, setCharsLoading] = useState(true);
  const [worldsList, setWorldsList] = useState([]);

  // --- Persisted state (replaces inline localStorage reads) ---
  const [selectedChar, setSelectedChar] = usePersistedState('se_selectedChar', '');
  const [activeWorld, setActiveWorld] = usePersistedState('se_activeWorld', 'book-1');
  const [writeMode, setWriteMode] = usePersistedState('se_writeMode', false, {
    serialize: v => v ? '1' : '0',
    deserialize: v => v === '1',
  });

  // --- Data state ---
  const [worldToggles, setWorldToggles] = useState({});
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [stories, setStories] = useState({});
  const [approvedStories, setApprovedStories] = useState([]);
  const [savedStories, setSavedStories] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [activeStory, setActiveStory] = useState(null);

  // --- Processing locks ---
  const [processingStory, setProcessingStory] = useState(null);
  const [savingForLater, setSavingForLater] = useState(false);

  // --- Analysis state ---
  const [consistencyConflicts, setConsistencyConflicts] = useState([]);
  const [consistencyLoading, setConsistencyLoading] = useState(false);
  const [therapyMemories, setTherapyMemories] = useState([]);
  const [therapyLoading, setTherapyLoading] = useState(false);
  const [registryUpdate, setRegistryUpdate] = useState(null);

  // --- UI overlays ---
  const [approveConfirm, setApproveConfirm] = useState(null);
  const [lastTexture, setLastTexture] = useState(null);
  const [rejectedStory, setRejectedStory] = useState(null);
  const [amberNotification, setAmberNotification] = useState(null);
  const [amberTextureNotes, setAmberTextureNotes] = useState(null);
  const [batchProgress, setBatchProgress] = useState(null);
  const [arcProgress, setArcProgress] = useState(null); // SSE arc generation progress

  // --- UI toggles ---
  const [readingMode, setReadingMode] = useState(false);
  const [storiesMinimized, setStoriesMinimized] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState(new Set());
  const [mobileNav, setMobileNav] = useState(false);
  const [mobileInspector, setMobileInspector] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // --- Toasts ---
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // --- Derived ---
  const char = CHARACTERS[selectedChar];

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (phaseFilter && t.phase !== phaseFilter) return false;
      if (typeFilter && t.story_type !== typeFilter) return false;
      if (searchQuery && !t.title?.toLowerCase().includes(searchQuery.toLowerCase()) && !t.task?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [tasks, phaseFilter, typeFilter, searchQuery]);

  const hasPrevStory = useMemo(() => activeTask ? tasks.findIndex(t => t.story_number === activeTask.story_number) > 0 : false, [activeTask, tasks]);
  const hasNextStory = useMemo(() => activeTask ? tasks.findIndex(t => t.story_number === activeTask.story_number) < tasks.length - 1 : false, [activeTask, tasks]);

  // --- Generation hook ---
  const generation = useGenerationJob({
    selectedChar,
    tasks,
    stories,
    approvedStories,
    addToast,
    onStoryReady: useCallback((storyNumber, data) => {
      setStories(prev => {
        const next = { ...prev, [storyNumber]: data };
        setCachedStories(selectedChar, next, approvedStories);
        return next;
      });
      setActiveStory(data);
    }, [selectedChar, approvedStories]),
    onStoriesBatchUpdate: useCallback((storyNum, storyData) => {
      setStories(prev => {
        const next = { ...prev, [storyNum]: storyData };
        setCachedStories(selectedChar, next, approvedStories);
        return next;
      });
    }, [selectedChar, approvedStories]),
  });

  // --- Body class ---
  useEffect(() => {
    document.body.classList.add('page-story-engine');
    return () => document.body.classList.remove('page-story-engine');
  }, []);

  // --- Load characters ---
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
              id: c.id, display_name: c.display_name, icon: c.icon || '◈',
              role_type: c.role_type, world: c.world,
              color: ROLE_COLORS[c.role_type] || '#546678',
              portrait_url: c.portrait_url, has_dna: c.has_dna, registry_id: c.registry_id,
              core_desire: c.core_desire, core_fear: c.core_fear, core_wound: c.core_wound,
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
          if (!selectedChar) setSelectedChar(Object.keys(chars)[0]);
        } else {
          setCHARACTERS(FALLBACK_CHARACTERS);
          setWorldToggles({ 'book-1': true, lalaverse: true });
          if (!selectedChar) setSelectedChar('justawoman');
        }
      } catch {
        setCHARACTERS(FALLBACK_CHARACTERS);
        setWorldToggles({ 'book-1': true, lalaverse: true });
        if (!selectedChar) setSelectedChar('justawoman');
      } finally {
        if (!cancelled) setCharsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Load tasks + stories on character change ---
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

    // Load from DB
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
                story_number: s.story_number, title: s.title, text: s.text,
                phase: s.phase, story_type: s.story_type, word_count: s.word_count,
                new_character: s.new_character, new_character_name: s.new_character_name,
                new_character_role: s.new_character_role, opening_line: s.opening_line,
                character_key: s.character_key, db_id: s.id, db_status: s.status,
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

    // Load tasks
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
  }, [selectedChar]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Navigation ---
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

  const handleSelectTask = useCallback((task) => {
    setActiveTask(task);
    setActiveStory(stories[task.story_number] || null);
    setConsistencyConflicts([]);
    setTherapyMemories([]);
  }, [stories]);

  // --- Generate arc (SSE with real-time progress) ---
  const handleGenerateArc = useCallback(async (forceRegenerate = false) => {
    setTasksLoading(true);
    setArcProgress(null);

    try {
      const res = await fetch(`${API_BASE}/memories/generate-story-tasks-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterKey: selectedChar, forceRegenerate }),
      });

      if (!res.ok) throw new Error('Failed to start arc generation');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              setArcProgress(event);

              if (event.step === 'done') {
                // Arc complete — extract results
                const result = event;
                setTasks(result.tasks || []);
                setCachedTasks(selectedChar, result.tasks || []);
                if (result.tasks?.length) setActiveTask(result.tasks[0]);
                // Keep arcProgress showing 'done' briefly, then clear
                setTimeout(() => setArcProgress(null), 3000);
              }

              if (event.step === 'error') {
                console.error('Arc generation error:', event.message);
                addToast(event.message || 'Arc generation failed', 'error');
                setTimeout(() => setArcProgress(null), 5000);
              }
            } catch (parseErr) {
              // Skip malformed events
            }
          }
        }
      }
    } catch (e) {
      console.error('generateArc SSE error:', e);
      addToast('Arc generation failed — please try again.', 'error');
      setArcProgress(null);
    } finally {
      setTasksLoading(false);
    }
  }, [selectedChar, addToast]);

  // --- Generate next chapter brief (single chapter, sequential) ---
  const [generatingNextChapter, setGeneratingNextChapter] = useState(false);
  const handleGenerateNextChapter = useCallback(async () => {
    if (generatingNextChapter) return;
    setGeneratingNextChapter(true);
    try {
      const res = await fetch(`${API_BASE}/memories/generate-next-chapter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterKey: selectedChar }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate next chapter');
      }
      const data = await res.json();
      if (data.complete) {
        addToast('All 50 chapters have been generated!', 'info');
        return;
      }
      const updatedTasks = data.allTasks || [];
      setTasks(updatedTasks);
      setCachedTasks(selectedChar, updatedTasks);
      // Set the new chapter as active
      if (data.chapter) {
        setActiveTask(data.chapter);
        setActiveStory(null);
        addToast(`Chapter ${data.chapterNumber} brief generated`, 'success');
      }
    } catch (e) {
      console.error('generateNextChapter error:', e);
      addToast(e.message || 'Failed to generate next chapter', 'error');
    } finally {
      setGeneratingNextChapter(false);
    }
  }, [generatingNextChapter, selectedChar, addToast]);

  // --- Generate single story ---
  const handleGenerate = useCallback(async (task) => {
    setActiveTask(task);
    setActiveStory(null);
    setConsistencyConflicts([]);
    setTherapyMemories([]);
    if (window.innerWidth <= 900) window.scrollTo({ top: 0, behavior: 'smooth' });
    await generation.generate(task);
  }, [generation]);

  // --- Save for later ---
  const handleSaveForLater = useCallback(async (story) => {
    if (processingStory === story.story_number) return;
    setProcessingStory(story.story_number);
    setSavingForLater(true);
    try {
      const res = await persistStory({
          character_key: selectedChar, story_number: story.story_number,
          title: story.title, text: story.text, phase: story.phase,
          story_type: story.story_type,
          word_count: story.word_count || story.text?.split(/\s+/).length,
          status: 'draft',
          task_brief: tasks.find(t => t.story_number === story.story_number),
          new_character: story.new_character, new_character_name: story.new_character_name,
          new_character_role: story.new_character_role, opening_line: story.opening_line,
      });
      const data = res.data;
      setSavedStories(prev => [...new Set([...prev, story.story_number])]);
      setStories(prev => {
        const next = { ...prev, [story.story_number]: { ...story, db_id: data.story?.id, db_status: 'draft' } };
        setCachedStories(selectedChar, next, approvedStories);
        return next;
      });
      addToast('Story saved — come back to review & approve anytime', 'success');
    } catch (e) {
      console.error('saveForLater error:', e);
      addToast('Failed to save story. Please try again.', 'error');
    } finally {
      setSavingForLater(false);
      setProcessingStory(null);
    }
  }, [processingStory, selectedChar, tasks, approvedStories, addToast]);

  // --- Approve (#4 streamlined + #7 optimistic) ---
  const handleApprove = useCallback(async (story) => {
    if (processingStory === story.story_number) return;
    setProcessingStory(story.story_number);

    // ── Optimistic UI (#7): immediately mark approved ──
    const nextApproved = [...new Set([...approvedStories, story.story_number])];
    setApprovedStories(nextApproved);
    setSavedStories(prev => [...new Set([...prev, story.story_number])]);
    setCachedStories(selectedChar, stories, nextApproved);

    // Check if there's already a next task generated (advance to it)
    const nextExisting = tasks.find(
      t => t.story_number > story.story_number && !stories[t.story_number] && !nextApproved.includes(t.story_number)
    );
    if (nextExisting) {
      setActiveTask(nextExisting);
      setActiveStory(null);
    }

    // ── Fire all post-approval tasks concurrently (#4) ──
    const task = tasks.find(t => t.story_number === story.story_number);
    const storyPayload = {
      character_key: selectedChar, story_number: story.story_number,
      title: story.title, text: story.text, phase: story.phase,
      story_type: story.story_type,
      word_count: story.word_count || story.text?.split(/\s+/).length,
      status: 'approved', task_brief: task,
      new_character: story.new_character, new_character_name: story.new_character_name,
      new_character_role: story.new_character_role, opening_line: story.opening_line,
    };

    // Group 1: Must complete (persist + extract memories)
    const persistPromise = persistStory(storyPayload)
      .catch(e => { console.error('story persist error:', e); addToast('Failed to save approved story to database', 'error'); });

    const memoryPromise = fetch(`${API_BASE}/memories/extract-story-memories`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterId: char?.id || selectedChar, characterKey: selectedChar,
        storyNumber: story.story_number, storyTitle: story.title, storyText: story.text,
      }),
    }).then(r => r.ok ? r.json() : null).catch(e => {
      console.error('extract memories error:', e);
      addToast('Failed to extract story memories', 'error');
      return null;
    });

    setTherapyLoading(true);
    const [, memoryData] = await Promise.all([persistPromise, memoryPromise]);
    setTherapyLoading(false);
    if (memoryData?.pain_points) setTherapyMemories(memoryData.pain_points);

    // Group 2: Fire-and-forget post-approval tasks (concurrent)
    const postApprovalTasks = [];

    // Registry update
    postApprovalTasks.push(
      fetch(`${API_BASE}/memories/story-engine-update-registry`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterKey: selectedChar, storyNumber: story.story_number,
          storyTitle: story.title, storyText: story.text, extractedMemories: memoryData,
        }),
      }).then(r => r.ok ? r.json() : null).then(regData => {
        if (regData?.updated) {
          setRegistryUpdate(`Registry updated: ${regData.summary}`);
          setTimeout(() => setRegistryUpdate(null), 8000);
        }
      }).catch(e => { console.error('registry update error:', e); addToast('Failed to update character registry', 'error'); })
    );

    // Texture layer generation
    postApprovalTasks.push(
      fetch(`${API_BASE}/texture-layer/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: { story_number: story.story_number, title: story.title, text: story.text, phase: story.phase, story_type: story.story_type },
          character_key: selectedChar,
          characters_present: [...new Set(task?.situations?.flatMap(s => s.characters_present || []) || [])],
          registry_id: char?.registry_id || null,
        }),
      }).then(r => r.ok ? r.json() : null).then(textureData => {
        if (textureData?.texture) {
          setLastTexture({ story_number: story.story_number, story_title: story.title, texture: textureData.texture });
          if (textureData.texture.amber_notes?.length) {
            setAmberTextureNotes({ story_number: story.story_number, story_title: story.title, notes: textureData.texture.amber_notes, texture_id: textureData.texture.id });
          }
        }
      }).catch(e => { console.error('texture layer error:', e); addToast('Failed to generate texture layers', 'error'); })
    );

    // Arc tracking update
    postApprovalTasks.push(
      fetch(`${API_BASE}/arc-tracking/update`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_key: selectedChar, story_number: story.story_number,
          story_type: story.story_type, phase: story.phase,
          phone_appeared: story.text?.toLowerCase().includes('her phone') || story.text?.toLowerCase().includes('the phone'),
        }),
      }).catch(e => { console.error('arc tracking error:', e); addToast('Failed to update arc tracking', 'error'); })
    );

    // Scene eligibility check
    if (story.db_id) {
      postApprovalTasks.push(
        fetch(`${API_BASE}/world/scenes/check-eligibility`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            story_id: story.db_id, character_key: selectedChar, story_text: story.text,
            story_type: story.story_type, story_number: story.story_number,
            characters_present: task?.characters_present || [],
          }),
        }).then(r => r.ok ? r.json() : null).then(eligibility => {
          if (eligibility?.eligible) {
            setAmberNotification({ type: 'scene_eligible', story_number: story.story_number, story_title: story.title, eligibility });
          }
        }).catch(e => { console.error('scene eligibility error:', e); addToast('Failed to check scene eligibility', 'error'); })
      );
    }

    // Wait for all post-approval tasks (but don't block UI — it's already updated)
    await Promise.allSettled(postApprovalTasks);

    // Auto-generate next chapter brief if no next task exists
    const hasNextTask = tasks.some(
      t => t.story_number > story.story_number && !stories[t.story_number] && !nextApproved.includes(t.story_number)
    );
    if (!hasNextTask && tasks.length < 50) {
      // Fire-and-forget — generates next chapter in background
      addToast('Generating next chapter brief…', 'info');
      try {
        const nextRes = await fetch(`${API_BASE}/memories/generate-next-chapter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ characterKey: selectedChar }),
        });
        if (nextRes.ok) {
          const nextData = await nextRes.json();
          if (nextData.chapter && nextData.allTasks) {
            setTasks(nextData.allTasks);
            setCachedTasks(selectedChar, nextData.allTasks);
            setActiveTask(nextData.chapter);
            setActiveStory(null);
            addToast(`Chapter ${nextData.chapterNumber} brief ready`, 'success');
          } else if (nextData.complete) {
            addToast('All 50 chapters generated!', 'info');
          }
        }
      } catch (e) {
        console.error('auto-generate next chapter error:', e);
      }
    }

    setProcessingStory(null);
  }, [processingStory, approvedStories, selectedChar, stories, tasks, char, addToast]);

  // --- Reject (#7 optimistic with undo) ---
  const handleReject = useCallback((story) => {
    setRejectedStory({ story, timestamp: Date.now() });
    setStories(prev => {
      const next = { ...prev };
      delete next[story.story_number];
      setCachedStories(selectedChar, next, approvedStories);
      return next;
    });
    setActiveStory(null);
    setActiveTask(tasks.find(t => t.story_number === story.story_number) || null);
    addToast('Story rejected', 'info');
  }, [selectedChar, approvedStories, tasks, addToast]);

  const handleUndoReject = useCallback(() => {
    if (!rejectedStory) return;
    const restored = rejectedStory.story;
    setStories(prev => {
      const next = { ...prev, [restored.story_number]: restored };
      setCachedStories(selectedChar, next, approvedStories);
      return next;
    });
    setActiveStory(restored);
    setActiveTask(tasks.find(t => t.story_number === restored.story_number) || null);
    setRejectedStory(null);
    addToast('Story restored', 'success');
  }, [rejectedStory, selectedChar, approvedStories, tasks, addToast]);

  // Clear undo buffer after 10 seconds
  useEffect(() => {
    if (!rejectedStory) return;
    const timer = setTimeout(() => setRejectedStory(null), 10000);
    return () => clearTimeout(timer);
  }, [rejectedStory]);

  // --- Delete ---
  const handleDelete = useCallback(async (story) => {
    if (!story) return;
    // Delete from DB if it has a db_id
    if (story.db_id) {
      try {
        await deleteStoryFromDb(story.db_id);
      } catch (e) { console.error('story delete error:', e); }
    }
    // Remove from local state
    setStories(prev => {
      const next = { ...prev };
      delete next[story.story_number];
      const nextApproved = approvedStories.filter(n => n !== story.story_number);
      setApprovedStories(nextApproved);
      setSavedStories(prev => prev.filter(n => n !== story.story_number));
      setCachedStories(selectedChar, next, nextApproved);
      return next;
    });
    setActiveStory(null);
    setActiveTask(tasks.find(t => t.story_number === story.story_number) || null);
    addToast('Story deleted', 'info');
  }, [selectedChar, approvedStories, tasks, addToast]);

  // --- Edit ---
  const handleEdit = useCallback(async (story, newText) => {
    const updated = { ...story, text: newText, word_count: newText.split(/\s+/).length };
    setStories(prev => {
      const next = { ...prev, [story.story_number]: updated };
      setCachedStories(selectedChar, next, approvedStories);
      return next;
    });
    setActiveStory(updated);

    try {
      const task = tasks.find(t => t.story_number === story.story_number);
      await persistStory({
        character_key: selectedChar, story_number: story.story_number,
        title: story.title, text: newText, phase: story.phase,
        story_type: story.story_type, word_count: newText.split(/\s+/).length,
        status: story.db_status || 'draft', task_brief: task,
        new_character: story.new_character, new_character_name: story.new_character_name,
        new_character_role: story.new_character_role, opening_line: story.opening_line,
      });
      addToast('Story saved', 'success');
    } catch (e) {
      console.error('Story save error:', e);
      addToast('Failed to save story to database', 'error');
    }

    await handleCheckConsistency(updated);
  }, [selectedChar, approvedStories, tasks, addToast]);

  // --- Consistency check ---
  const handleCheckConsistency = useCallback(async (story) => {
    setConsistencyLoading(true);
    setConsistencyConflicts([]);
    try {
      const existingStories = Object.values(stories).map(s => ({
        story_number: s.story_number, title: s.title, summary: s.text?.slice(0, 300),
      }));
      const res = await fetch(`${API_BASE}/memories/check-story-consistency`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterKey: selectedChar, editedStoryNumber: story.story_number,
          editedStoryText: story.text, existingStories,
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
  }, [stories, selectedChar]);

  // --- Add to registry ---
  const handleAddToRegistry = useCallback(async (story) => {
    if (!story.new_character_name) return;
    try {
      const res = await fetch(`${API_BASE}/memories/story-engine-add-character`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_name: story.new_character_name, character_role: story.new_character_role,
          world: char?.world || 'book-1', story_number: story.story_number, story_title: story.title,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.already_existed) {
          addToast(`${story.new_character_name} already exists in the registry.`, 'warning');
        } else {
          addToast(`${story.new_character_name} added to the registry as draft.`, 'success');
          // Refresh characters
          const charRes = await fetch(`${API_BASE}/memories/story-engine-characters`);
          if (charRes.ok) {
            const charData = await charRes.json();
            const chars = {};
            for (const world of Object.keys(charData.worlds || {})) {
              for (const c of charData.worlds[world]) {
                chars[c.character_key] = {
                  id: c.id, display_name: c.display_name, icon: c.icon || '◈',
                  role_type: c.role_type, world: c.world,
                  color: ROLE_COLORS[c.role_type] || '#546678',
                  portrait_url: c.portrait_url, has_dna: c.has_dna,
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
  }, [char, addToast]);

  // --- Export ---
  const handleExportStory = useCallback((story) => {
    const text = `# ${story.title}\n\nStory ${story.story_number} · ${story.phase} · ${story.story_type}\n${story.word_count?.toLocaleString() || ''} words\n\n${story.text || ''}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => addToast('Story copied to clipboard', 'success'));
    }
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `story-${story.story_number}-${story.title?.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [addToast]);

  // --- Batch approve ---
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
  }, [batchSelected, stories, approvedStories, addToast, handleApprove]);

  const handleBatchToggle = useCallback((storyNum) => {
    setBatchSelected(prev => {
      const next = new Set(prev);
      if (next.has(storyNum)) next.delete(storyNum);
      else next.add(storyNum);
      return next;
    });
  }, []);

  const handleWorldToggle = useCallback((worldId) => {
    setWorldToggles(prev => ({ ...prev, [worldId]: !prev[worldId] }));
  }, []);

  return {
    // Characters
    CHARACTERS, charsLoading, worldsList, selectedChar, setSelectedChar, char,

    // World
    activeWorld, setActiveWorld, worldToggles, handleWorldToggle,

    // Tasks
    tasks, tasksLoading, filteredTasks,
    activeTask, setActiveTask, activeStory, setActiveStory,
    handleSelectTask, handleGenerateArc, arcProgress,
    handleGenerateNextChapter, generatingNextChapter,

    // Stories
    stories, approvedStories, savedStories,

    // Generation
    generation,
    handleGenerate,

    // Actions
    handleApprove, handleReject, handleUndoReject, handleDelete,
    handleEdit, handleCheckConsistency, handleAddToRegistry,
    handleSaveForLater, handleExportStory,
    handleBatchApprove, handleBatchToggle,
    savingForLater, processingStory,

    // Analysis
    consistencyConflicts, consistencyLoading,
    therapyMemories, therapyLoading,
    registryUpdate,

    // UI overlays
    approveConfirm, setApproveConfirm,
    lastTexture, setLastTexture,
    rejectedStory, amberNotification, setAmberNotification,
    amberTextureNotes, setAmberTextureNotes,
    batchProgress,

    // UI toggles
    readingMode, setReadingMode,
    writeMode, setWriteMode,
    storiesMinimized, setStoriesMinimized,
    phaseFilter, setPhaseFilter,
    typeFilter, setTypeFilter,
    searchQuery, setSearchQuery,
    batchMode, setBatchMode,
    batchSelected, setBatchSelected,
    mobileNav, setMobileNav,
    mobileInspector, setMobileInspector,
    moreMenuOpen, setMoreMenuOpen,

    // Navigation
    navigateStory, hasPrevStory, hasNextStory,

    // Toasts
    toasts, addToast, dismissToast,
  };
}

// Re-export constants for use by child components
export { FALLBACK_CHARACTERS, ROLE_COLORS };
