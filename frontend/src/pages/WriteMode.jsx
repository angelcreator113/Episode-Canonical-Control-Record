/**
 * WriteMode.jsx
 * frontend/src/pages/WriteMode.jsx
 *
 * Unified Writing Hub — TOC sidebar + prose editor + context panel.
 * Voice-first writing mode with full book awareness.
 *
 * ROUTE: /write/:bookId/:chapterId
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LoadingSkeleton from '../components/LoadingSkeleton';
import WriteModeAIWriter from '../components/WriteModeAIWriter';

// ── Merged from StorytellerPage ──
import ScenesPanel from '../components/ScenesPanel';
import BookStructurePanel from '../components/BookStructurePanel';
import MemoryBankView from '../components/MemoryBankView';
import LalaSceneDetection from '../components/LalaSceneDetection';
import ExportPanel from '../components/ExportPanel';
import NarrativeIntelligence from '../components/NarrativeIntelligence';
import { ContinuityGuard } from '../components/ContinuityGuard';
import { MemoryCard, MEMORY_STYLES } from '../components/MemoryConfirmation';


import './WriteMode.css';

const API = '/api/v1';

/* Planning-field completeness helper */
const PLAN_FIELDS = ['scene_goal', 'theme', 'chapter_notes', 'pov', 'emotional_state_start', 'emotional_state_end'];

/* ── Section types for chapter structure ── */
const SECTION_TYPES = [
  { type: 'h2',         label: 'Chapter Title',  icon: 'H2' },
  { type: 'h3',         label: 'Section',        icon: 'H3' },
  { type: 'h4',         label: 'Subsection',     icon: 'H4' },
  { type: 'body',       label: 'Body',           icon: '¶' },
  { type: 'quote',      label: 'Quote',          icon: '“' },
  { type: 'reflection', label: 'Reflection',     icon: '?' },
  { type: 'divider',    label: 'Divider',        icon: '─' },
];
const HEADER_TYPES = ['h1', 'h2', 'h3', 'h4'];

function tocUuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── CENTER TABS ──────────────────────────────────────────────────────────
const CENTER_TABS = [
  { id: 'write',     label: 'Write'     },
  { id: 'review',    label: 'Review'    },
  { id: 'structure', label: 'Structure' },
  { id: 'scenes',    label: 'Scenes'    },
  { id: 'memory',    label: 'Memory'    },
  { id: 'lala',      label: 'Emergence' },
  { id: 'export',    label: 'Export'    },
];

// ── MAIN COMPONENT ────────────────────────────────────────────────────────

export default function WriteMode({ hideTopBar = false, initialCenterTab = 'write' }) {
  const { bookId, chapterId } = useParams();
  const navigate = useNavigate();

  // ── Mobile detection: hide sidebars at JSX level on phones ──
  const MOBILE_BP = 767;
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= MOBILE_BP);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BP}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Chapter / book state
  const [chapter,    setChapter]    = useState(null);
  const [book,       setBook]       = useState(null);
  const [allChapters, setAllChapters] = useState([]);
  const [loading,    setLoading]    = useState(true);

  // Sidebar state — force off on mobile
  const [showToc,    setShowToc]    = useState(() => {
    const saved = localStorage.getItem('wm-show-toc');
    return saved !== null ? saved === 'true' : true;
  });
  const [showContext, setShowContext] = useState(() => {
    const saved = localStorage.getItem('wm-show-context');
    return saved !== null ? saved === 'true' : true;
  });

  // Effective visibility: never show panels on mobile
  const effectiveToc     = !isMobile && showToc;
  // When embedded in CJ (hideTopBar), still hide context panel on mobile
  // — the CJ ribbon's Tools dropdown provides access to AI Writer instead.
  const effectiveContext = !isMobile && showContext;
  const [tocDragIdx,     setTocDragIdx]     = useState(null);
  const [tocDragOverIdx, setTocDragOverIdx] = useState(null);
  const [editingTocId,   setEditingTocId]   = useState(null);
  const [tocEditTitle,   setTocEditTitle]   = useState('');
  const [addingTocChapter, setAddingTocChapter] = useState(false);
  const [newTocTitle,    setNewTocTitle]    = useState('');

  // TOC section structure state
  const [expandedTocId,    setExpandedTocId]    = useState(null); // chapter id whose sections are shown
  const [tocSections,      setTocSections]      = useState([]);   // sections for expanded chapter
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [sectionEditVal,   setSectionEditVal]   = useState('');
  const [addingSectionType, setAddingSectionType] = useState(null); // show type picker
  const [showSectionTypeMenu, setShowSectionTypeMenu] = useState(false);
  const tocSectionSaveRef = useRef(null);

  // Per-section prose state (when chapter has header sections)
  const [sectionProse, setSectionProse] = useState({}); // { sectionId: prose string }
  const sectionProseRef = useRef({});

  // Context panel state
  const [editingContext,  setEditingContext]  = useState(null); // field name being edited
  const [contextEditVal,  setContextEditVal]  = useState('');
  const [prevChapterSummary, setPrevChapterSummary] = useState(null);
  const [contextTab, setContextTab] = useState('plan'); // 'plan' | 'ai-writer'

  // Prose state
  const [prose,      setProse]      = useState('');
  const [wordCount,  setWordCount]  = useState(0);
  const [saved,      setSaved]      = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [lastSavedAgo, setLastSavedAgo] = useState('');

  // Voice state
  const [listening,  setListening]  = useState(false);
  const [transcript, setTranscript] = useState('');
  const [generating, setGenerating] = useState(false);
  const [micError,   setMicError]   = useState(null);

  // Edit mode state
  const [editMode,   setEditMode]   = useState(false);
  const [editNote,   setEditNote]   = useState('');
  const [editListening, setEditListening] = useState(false);

  // AI toolbar state
  const [aiAction,     setAiAction]     = useState(null); // 'continue'|'deepen'|'nudge'
  const [nudgeText,    setNudgeText]    = useState(null);
  const [proseBeforeAi, setProseBeforeAi] = useState(null); // for undo
  const [genLength,    setGenLength]    = useState('paragraph'); // 'sentence'|'paragraph'
  const [streamingText, setStreamingText] = useState(''); // live text while streaming
  const [previewText,  setPreviewText]  = useState(null); // AI text pending acceptance

  // Character state
  const [characters,        setCharacters]        = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [charLoading,       setCharLoading]       = useState(false);

  // UI state
  const [showExit,   setShowExit]   = useState(false);
  const [hint,       setHint]       = useState(null);
  const [sessionLog, setSessionLog] = useState([]);
  const [hintLog,    setHintLog]    = useState([]);
  const [showHintLog, setShowHintLog] = useState(false);

  // Focus mode
  const [focusMode,  setFocusMode]  = useState(false);
  const preFocusSidebarRef = useRef({ toc: true, ctx: true });

  // Session timer & goal
  const [sessionStart]             = useState(() => Date.now());
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [wordGoal,       setWordGoal]       = useState(() => {
    const saved = localStorage.getItem('wm-word-goal');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [showGoalInput,  setShowGoalInput]  = useState(false);
  const startingWordCountRef = useRef(0);

  // Paragraph-level actions
  const [selectedParagraph, setSelectedParagraph] = useState(null); // index
  const [paraAction,        setParaAction]        = useState(null); // 'rewrite'|'expand'|'delete'
  const [paraInstruction,   setParaInstruction]   = useState('');   // free-form instruction for paragraph edit

  // History / version snapshots
  const [history,        setHistory]        = useState([]); // [{prose, label, timestamp}]
  const [showHistory,    setShowHistory]    = useState(false);

  // Help modal
  const [showHelp,       setShowHelp]       = useState(false);

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState(null); // { message, onConfirm }

  // Quick character switch
  const [showCharQuick,  setShowCharQuick]  = useState(false);

  // ── NEW: Center tab state ──
  const [centerTab,    setCenterTab]    = useState(initialCenterTab || 'write');

  // ── Chapter-level instruction mode ──
  const [chapterInstruction, setChapterInstruction] = useState('');
  const [chapterInstructionOpen, setChapterInstructionOpen] = useState(false);
  const [chapterInstructionLoading, setChapterInstructionLoading] = useState(false);

  // ── Write All Scenes state ──
  const [writingAllScenes, setWritingAllScenes] = useState(false);
  const [currentSceneIdx,  setCurrentSceneIdx]  = useState(-1);
  const [totalScenes,      setTotalScenes]      = useState(0);

  // ── Read Aloud (TTS) ──
  const [ttsPlaying,       setTtsPlaying]       = useState(false);

  // ── AI Generation History ──
  const [aiHistory,        setAiHistory]        = useState([]);
  const [showAiHistory,    setShowAiHistory]    = useState(false);

  // ── Find & Replace ──
  const [showFindReplace,  setShowFindReplace]  = useState(false);
  const [findText,         setFindText]         = useState('');
  const [replaceText,      setReplaceText]      = useState('');
  const [findMatches,      setFindMatches]      = useState(0);

  // ── Chapter Synopsis ──
  const [synopsis,         setSynopsis]         = useState('');
  const [synopsisLoading,  setSynopsisLoading]  = useState(false);

  // ── Split Reference View ──
  const [showReference,    setShowReference]    = useState(false);
  const [referenceChapter, setReferenceChapter] = useState(null);
  const [referenceProse,   setReferenceProse]   = useState('');

  // ── Daily Writing Stats ──
  const [writingStats,     setWritingStats]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('wm-writing-stats') || '[]'); } catch { return []; }
  });
  const [showStats,        setShowStats]        = useState(false);

  // ── Prose Formatting Preview ──
  const [prosePreviewMode, setProsePreviewMode] = useState(false);

  // ── Tension / pacing analysis ──
  const tensionAnalysis = useMemo(() => {
    if (!prose.trim()) return [];
    const paras = prose.split(/\n\n+/).filter(p => p.trim());
    const TENSION_WORDS = {
      high: /\b(scream|crash|slam|blood|broke|shatter|run|chase|fire|kill|fight|punch|rage|explode|desperate|panic|terror)\b/gi,
      medium: /\b(tension|argue|whisper|tremble|shak|nervous|afraid|anxious|pressure|tight|clench|swallow|breath|stare|frown|grip)\b/gi,
      internal: /\b(wonder|thought|felt|remember|realize|knew|believed|hoped|wished|imagine|dream|fear|doubt|guilt|shame)\b/gi,
      calm: /\b(smile|laugh|warm|gentle|quiet|soft|peace|comfort|rest|sleep|morning|sun|light|kitchen|coffee|home)\b/gi,
    };
    return paras.map((p, i) => {
      const words = p.split(/\s+/).length;
      const high = (p.match(TENSION_WORDS.high) || []).length;
      const med = (p.match(TENSION_WORDS.medium) || []).length;
      const internal = (p.match(TENSION_WORDS.internal) || []).length;
      const calm = (p.match(TENSION_WORDS.calm) || []).length;
      const score = Math.min(10, Math.round(((high * 3 + med * 2 + internal * 1) / Math.max(1, words)) * 100));
      const tone = high > med && high > calm ? 'action' : internal > calm ? 'interior' : calm > med ? 'calm' : 'tension';
      return { index: i, score, tone, words };
    });
  }, [prose]);

  // ── Scene beat detection (maps prose paragraphs to 5-beat structure) ──
  const SCENE_BEATS = [
    { id: 'domestic', label: 'Domestic', icon: '🏠', desc: 'Ground in real life' },
    { id: 'driver', label: 'Driver', icon: '🔑', desc: 'What pulls into action' },
    { id: 'collision', label: 'Collision', icon: '💥', desc: 'Two worlds touch' },
    { id: 'escalation', label: 'Escalation', icon: '📈', desc: 'Past the point of return' },
    { id: 'close', label: 'Intimate Close', icon: '🌙', desc: 'Alone with what happened' },
  ];
  const beatProgress = useMemo(() => {
    const paras = prose.split(/\n\n+/).filter(p => p.trim());
    const total = paras.length;
    if (total === 0) return SCENE_BEATS.map((b, i) => ({ ...b, active: false, current: false }));
    // Map: first 20% = domestic, 20-40% = driver, 40-60% = collision, 60-80% = escalation, 80-100% = close
    const pct = (i) => i / Math.max(1, total - 1);
    const currentPara = total - 1;
    const currentPct = pct(currentPara);
    return SCENE_BEATS.map((b, i) => {
      const start = i * 0.2;
      const end = (i + 1) * 0.2;
      return { ...b, active: currentPct >= start, current: currentPct >= start && currentPct < end };
    });
  }, [prose]);

  // ── Emotional arc position (heuristic from prose content) ──
  const emotionalArcPosition = useMemo(() => {
    if (!prose.trim()) return 0;
    const paras = prose.split(/\n\n+/).filter(p => p.trim());
    const total = paras.length;
    // Simple heuristic: position is how far through the chapter we are
    // weighted by emotional intensity in recent paragraphs
    const pct = Math.min(100, Math.round((total / Math.max(1, total)) * 100));
    const recentParas = paras.slice(-3).join(' ');
    const intense = (recentParas.match(/\b(broke|shatter|scream|cry|rage|realize|truth|finally|never)\b/gi) || []).length;
    return Math.min(100, Math.round((total / Math.max(total, 20)) * 100) + intense * 5);
  }, [prose]);

  // ── Listen for CJ ribbon tab switches ──
  useEffect(() => {
    const handler = (e) => {
      if (e.detail && CENTER_TABS.some(t => t.id === e.detail)) {
        setCenterTab(e.detail);
      }
    };
    window.addEventListener('cj-set-tab', handler);
    return () => window.removeEventListener('cj-set-tab', handler);
  }, []);

  // ── Listen for CJ context-panel toggle (AI Writer sidebar) ──
  useEffect(() => {
    const handler = (e) => {
      const tab = e.detail?.tab; // optional: switch to a specific context tab
      setShowContext(prev => {
        const next = !prev;
        if (next && tab) setContextTab(tab);
        return next;
      });
    };
    window.addEventListener('cj-toggle-context', handler);
    return () => window.removeEventListener('cj-toggle-context', handler);
  }, []);

  // ── Listen for scene-generate-prose events from ScenesPanel ──
  useEffect(() => {
    const handler = (e) => {
      const { chapterId: scChId, sceneTitle } = e.detail || {};
      if (scChId && scChId === chapterId && sceneTitle) {
        setCenterTab('write');
        setChapterInstruction(`Write a prose scene for: "${sceneTitle}". Include sensory detail, emotional interiority, and authentic dialogue.`);
        setChapterInstructionOpen(true);
      } else if (scChId && scChId !== chapterId) {
        setHint(`Switch to that chapter first to generate prose for "${sceneTitle}".`);
        setTimeout(() => setHint(null), 5000);
      }
    };
    window.addEventListener('scene-generate-prose', handler);
    return () => window.removeEventListener('scene-generate-prose', handler);
  }, [chapterId]);

  // ── NEW: Review tab state (from StorytellerPage) ──
  const [reviewLines,      setReviewLines]      = useState([]);
  const [editingLine,      setEditingLine]      = useState(null);
  const [editText,         setEditText]         = useState('');
  const [lastApprovedLine, setLastApprovedLine] = useState(null);
  const [reviewLoading,    setReviewLoading]    = useState(false);

  // ── Registry characters (for NI / Lala / Memory tabs) ──
  const [registryCharacters, setRegistryCharacters] = useState([]);

  // ── NEW: NI — count prose lines, show panel after 5+ ──
  const proseLineCount = prose.split(/\n\n+/).filter(s => s.trim().length > 20).length;
  const niShouldShow   = proseLineCount >= 5 && centerTab === 'write';

  const recognitionRef  = useRef(null);
  const editRecRef      = useRef(null);
  const proseRef        = useRef(null);
  const proseTextareaRef = useRef(null);
  const autoSaveRef     = useRef(null);
  const transcriptRef   = useRef('');
  const editTransRef    = useRef('');

  // ── RELOAD CHAPTERS (callable from child components) ────────────────
  const reloadChapters = useCallback(async () => {
    try {
      const res = await fetch(`${API}/storyteller/books/${bookId}`);
      const data = await res.json();
      const bookData = data?.book || data;
      setBook(bookData);
      const chapters = (bookData.chapters || []).sort((a, b) =>
        (a.sort_order ?? a.chapter_number ?? 0) - (b.sort_order ?? b.chapter_number ?? 0)
      );
      setAllChapters(chapters);
      return chapters;
    } catch { return null; }
  }, [bookId]);

  // ── LOAD BOOK + ALL CHAPTERS ──────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/storyteller/books/${bookId}`);
        const data = await res.json();
        const bookData = data?.book || data;
        setBook(bookData);

        const chapters = (bookData.chapters || []).sort((a, b) =>
          (a.sort_order ?? a.chapter_number ?? 0) - (b.sort_order ?? b.chapter_number ?? 0)
        );
        setAllChapters(chapters);

        const ch = chapters.find(c => c.id === chapterId);
        setChapter(ch || { id: chapterId, title: 'Chapter' });

        // Load any existing draft prose
        if (ch?.draft_prose) {
          setProse(ch.draft_prose);
          setWordCount(ch.draft_prose.split(/\s+/).filter(Boolean).length);
        }

        // Initialize per-section prose from sections JSONB
        if (ch?.sections?.length > 0) {
          const pMap = {};
          ch.sections.forEach(s => { if (s.id) pMap[s.id] = s.prose || ''; });
          setSectionProse(pMap);
          sectionProseRef.current = pMap;
          // If sections already have prose, use combined text as source of truth
          const sectionContent = ch.sections
            .filter(s => ['h2','h3','h4'].includes(s.type) && s.prose?.trim())
            .map(s => s.prose)
            .join('\n\n');
          if (sectionContent.trim()) {
            setProse(sectionContent);
            setWordCount(sectionContent.split(/\s+/).filter(Boolean).length);
          }
        }

        // Build previous chapter summary + continuity digest for AI
        const currentIdx = chapters.findIndex(c => c.id === chapterId);
        if (currentIdx > 0) {
          const prev = chapters[currentIdx - 1];
          const prevProse = prev.draft_prose?.trim();
          if (prevProse) {
            const paragraphs = prevProse.split(/\n\n+/).filter(Boolean);
            const lastPara = paragraphs[paragraphs.length - 1];
            setPrevChapterSummary({
              title: prev.title,
              excerpt: lastPara.length > 200 ? lastPara.slice(0, 200) + '…' : lastPara,
              wordCount: prevProse.split(/\s+/).filter(Boolean).length,
              // Continuity digest: last 500 chars for AI context
              continuityDigest: prevProse.slice(-500),
            });
          } else {
            setPrevChapterSummary({
              title: prev.title,
              excerpt: null,
              wordCount: 0,
            });
          }
        }
      } catch {
        setChapter({ id: chapterId, title: 'Chapter' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [bookId, chapterId]);

  // ── LOAD CHARACTERS ───────────────────────────────────────────────────

  useEffect(() => {
    async function loadCharacters() {
      setCharLoading(true);
      try {
        const res = await fetch(`${API}/character-registry/registries`);
        const data = await res.json();
        const regs = data.registries || data || [];
        const allChars = [];
        for (const reg of regs) {
          const rRes = await fetch(`${API}/character-registry/registries/${reg.id}`);
          const rData = await rRes.json();
          const chars = rData.characters || rData.registry?.characters || [];
          chars.forEach(c => allChars.push({ ...c, _registryTitle: reg.title || reg.book_tag }));
        }
        setCharacters(allChars.filter(c => c.status !== 'declined'));
      } catch (err) {
        console.error('Failed to load characters:', err);
      }
      setCharLoading(false);
    }
    loadCharacters();
  }, []);

  // ── SESSION TIMER ─────────────────────────────────────────────────────

  useEffect(() => {
    const timer = setInterval(() => {
      setSessionElapsed(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionStart]);

  // ── LAST SAVED AGO UPDATER ──
  useEffect(() => {
    if (!lastSavedAt) { setLastSavedAgo(''); return; }
    const tick = () => {
      const sec = Math.floor((Date.now() - lastSavedAt) / 1000);
      if (sec < 10)      setLastSavedAgo('saved just now');
      else if (sec < 60) setLastSavedAgo(`saved ${sec}s ago`);
      else               setLastSavedAgo(`saved ${Math.floor(sec / 60)}m ago`);
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [lastSavedAt]);

  // ── HINT LOGGER — persist hints into a session log ──
  useEffect(() => {
    if (hint) {
      setHintLog(prev => [...prev.slice(-49), { text: hint, time: Date.now() }]);
    }
  }, [hint]);

  // Track starting word count for goal progress 
  useEffect(() => {
    if (startingWordCountRef.current === 0 && wordCount > 0) {
      startingWordCountRef.current = wordCount;
    }
  }, [wordCount]);

  // ── NEW: Load registry characters (for alive systems + NI) ────────────

  useEffect(() => {
    fetch(`${API}/character-registry/registries`)
      .then(r => r.json())
      .then(data => {
        const regs = data?.registries || data || [];
        const chars = Array.isArray(regs)
          ? regs.flatMap(r => (r.characters || []))
          : [];
        setRegistryCharacters(chars);
      })
      .catch(() => {});
  }, []);

  // ── NEW: Load review lines when switching to Review tab ───────────────

  useEffect(() => {
    if (centerTab !== 'review' || !chapterId) return;
    loadReviewLines();
  }, [centerTab, chapterId]);

  // ── NEW: MEMORY_STYLES injection ──────────────────────────────────────

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = MEMORY_STYLES;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // ── SNAPSHOT HELPER ───────────────────────────────────────────────────

  const takeSnapshot = useCallback((label) => {
    if (!prose.trim()) return;
    setHistory(prev => [...prev.slice(-19), {
      prose,
      label,
      timestamp: Date.now(),
      wordCount,
    }]);
  }, [prose, wordCount]);

  // ── PARAGRAPH-LEVEL ACTIONS ───────────────────────────────────────────

  const handleParagraphAction = useCallback(async (action) => {
    if (selectedParagraph === null || generating) return;
    const paragraphs = prose.split(/\n\n+/);
    const targetPara = paragraphs[selectedParagraph];
    if (!targetPara) return;

    if (action === 'delete') {
      setConfirmAction({
        message: 'Delete this paragraph? This can be undone via Snapshots.',
        onConfirm: () => {
          takeSnapshot('Before delete paragraph');
          const newParagraphs = paragraphs.filter((_, i) => i !== selectedParagraph);
          const newProse = newParagraphs.join('\n\n');
          setProse(newProse);
          setWordCount(newProse.split(/\s+/).filter(Boolean).length);
          setSaved(false);
          setSelectedParagraph(null);
          setParaAction(null);
          setConfirmAction(null);
        },
      });
      return;
    }

    takeSnapshot(`Before ${action} paragraph`);
    setGenerating(true);
    setParaAction(action);
    try {
      let editNote;
      if (action === 'custom' && paraInstruction.trim()) {
        editNote = paraInstruction.trim();
      } else if (action === 'rewrite') {
        editNote = 'Rewrite this paragraph with better prose, keeping the same meaning and tone.';
      } else {
        editNote = 'Expand this paragraph with more sensory detail, interiority, and emotional depth. Keep the same voice.';
      }
      const res = await fetch(`${API}/memories/story-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_prose: targetPara,
          edit_note: editNote,
          pnos_act: chapter?.pnos_act || 'act_1',
          chapter_title: chapter?.title,
          character_id: selectedCharacter?.id || null,
        }),
      });
      const data = await res.json();
      if (data.prose) {
        const newParagraphs = [...paragraphs];
        newParagraphs[selectedParagraph] = data.prose.trim();
        const newProse = newParagraphs.join('\n\n');
        setProse(newProse);
        setWordCount(newProse.split(/\s+/).filter(Boolean).length);
        setSaved(false);
      }
    } catch (err) {
      console.error('paragraph action error:', err);
    }
    setGenerating(false);
    setSelectedParagraph(null);
    setParaAction(null);
    setParaInstruction('');
  }, [prose, selectedParagraph, generating, chapter, selectedCharacter, takeSnapshot, paraInstruction]);

  // ── AUTOSAVE ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    if (!prose || saved) return;
    autoSaveRef.current = setTimeout(() => saveDraft(prose), 8000);
    return () => clearTimeout(autoSaveRef.current);
  }, [prose, saved]);

  const saveDraft = useCallback(async (text) => {
    if (!text) return;
    setSaving(true);
    try {
      await fetch(`${API}/storyteller/chapters/${chapterId}/save-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_prose: text }),
      });
      // Also persist per-section prose into sections JSONB
      const curSP = sectionProseRef.current;
      if (Object.keys(curSP).length > 0) {
        // Read latest chapter from state via closure
        setChapter(prev => {
          if (prev?.sections?.length > 0) {
            const updatedSections = prev.sections.map(s => ({
              ...s,
              prose: curSP[s.id] ?? s.prose ?? '',
            }));
            fetch(`${API}/storyteller/chapters/${chapterId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sections: updatedSections }),
            }).catch(() => {});
            return { ...prev, sections: updatedSections };
          }
          return prev;
        });
      }
      setSaved(true);
      setLastSavedAt(Date.now());
    } catch {}
    setSaving(false);
  }, [chapterId]);

  // ── CHAPTER-LEVEL INSTRUCTION ─────────────────────────────────────────
  const handleChapterInstruction = useCallback(async () => {
    if (!chapterInstruction.trim() || !prose.trim()) return;
    setChapterInstructionLoading(true);
    try {
      const res = await fetch(`${API}/memories/story-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: bookId,
          chapter_id: chapterId,
          current_prose: prose,
          edit_note: chapterInstruction.trim(),
        }),
      });
      const data = await res.json();
      const revised = data.revised_prose || data.prose || data.content;
      if (revised) {
        setProse(revised);
        setChapterInstruction('');
        setChapterInstructionOpen(false);
      }
    } catch {}
    setChapterInstructionLoading(false);
  }, [chapterInstruction, prose, bookId, chapterId]);

  // ── READ ALOUD (TTS) ─────────────────────────────────────────────────

  const handleReadAloud = useCallback(() => {
    if (ttsPlaying) {
      speechSynthesis.cancel();
      setTtsPlaying(false);
      return;
    }
    const ta = proseTextareaRef.current;
    const sel = ta ? ta.value.substring(ta.selectionStart, ta.selectionEnd) : '';
    const textToRead = sel.trim() || prose;
    if (!textToRead.trim()) return;

    const utt = new SpeechSynthesisUtterance(textToRead.slice(0, 5000));
    utt.rate = 0.9;
    utt.pitch = 1;
    utt.onend = () => setTtsPlaying(false);
    utt.onerror = () => setTtsPlaying(false);
    setTtsPlaying(true);
    speechSynthesis.speak(utt);
  }, [prose, ttsPlaying]);

  // ── AI GENERATION HISTORY TRACKER ─────────────────────────────────────

  const pushAiHistory = useCallback((action, result) => {
    setAiHistory(prev => [...prev.slice(-29), {
      action,
      text: (result || '').slice(0, 500),
      timestamp: Date.now(),
      wordCount: (result || '').split(/\s+/).filter(Boolean).length,
    }]);
  }, []);

  // ── FIND & REPLACE ────────────────────────────────────────────────────

  const doFind = useCallback((needle) => {
    if (!needle || !prose) { setFindMatches(0); return; }
    try {
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = prose.match(new RegExp(escaped, 'gi'));
      setFindMatches(matches ? matches.length : 0);
    } catch { setFindMatches(0); }
  }, [prose]);

  const doReplace = useCallback((all) => {
    if (!findText || !prose) return;
    takeSnapshot('Before find/replace');
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (all) {
      setProse(prev => prev.replace(new RegExp(escaped, 'gi'), replaceText));
    } else {
      setProse(prev => prev.replace(new RegExp(escaped, 'i'), replaceText));
    }
    setSaved(false);
  }, [findText, replaceText, prose, takeSnapshot]);

  // ── CHAPTER SYNOPSIS ──────────────────────────────────────────────────

  const generateSynopsis = useCallback(async () => {
    if (!prose.trim()) return;
    setSynopsisLoading(true);
    try {
      const res = await fetch(`${API}/memories/chapter-synopsis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prose: prose.slice(0, 4000),
          chapter_title: chapter?.title || 'Untitled',
          character_id: selectedCharacter?.id || null,
        }),
      });
      const data = await res.json();
      setSynopsis(data.synopsis || '');
    } catch { setSynopsis('Error generating synopsis.'); }
    setSynopsisLoading(false);
  }, [prose, chapter, selectedCharacter]);

  // ── SCENE TRANSITION HELPER ───────────────────────────────────────────

  const generateTransition = useCallback(async (sceneAEnd, sceneBStart, insertPos) => {
    if (!sceneAEnd && !sceneBStart) return;
    setGenerating(true);
    takeSnapshot('Before transition');
    try {
      const res = await fetch(`${API}/memories/scene-transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene_a_end: sceneAEnd,
          scene_b_start: sceneBStart,
          chapter_title: chapter?.title || '',
          character_id: selectedCharacter?.id || null,
          theme: chapter?.theme || '',
        }),
      });
      const data = await res.json();
      const transition = data.transition || data.prose || '';
      if (transition && insertPos != null) {
        const before = prose.slice(0, insertPos);
        const after = prose.slice(insertPos);
        setProse(before + '\n\n' + transition.trim() + '\n\n' + after);
        setSaved(false);
        setHint('Transition inserted');
        setTimeout(() => setHint(null), 3000);
      }
    } catch { setHint('Transition generation failed'); setTimeout(() => setHint(null), 3000); }
    setGenerating(false);
  }, [prose, chapter, selectedCharacter, takeSnapshot]);

  // ── SPLIT REFERENCE VIEW ──────────────────────────────────────────────

  const loadReferenceChapter = useCallback(async (refChId) => {
    if (!refChId) return;
    try {
      const res = await fetch(`${API}/storyteller/chapters/${refChId}`);
      const data = await res.json();
      const ch = data?.chapter || data;
      setReferenceChapter(ch);
      setReferenceProse(ch?.draft_prose || ch?.prose || '');
      setShowReference(true);
    } catch { setHint('Could not load reference chapter'); setTimeout(() => setHint(null), 3000); }
  }, []);

  // ── DAILY WRITING STATS ───────────────────────────────────────────────

  const saveSessionStats = useCallback(() => {
    const wordsWritten = Math.max(0, wordCount - startingWordCountRef.current);
    if (wordsWritten < 5) return;
    const today = new Date().toISOString().slice(0, 10);
    setWritingStats(prev => {
      const existing = prev.find(s => s.date === today);
      const updated = existing
        ? prev.map(s => s.date === today ? { ...s, words: s.words + wordsWritten, sessions: s.sessions + 1 } : s)
        : [...prev.slice(-29), { date: today, words: wordsWritten, sessions: 1, elapsed: sessionElapsed }];
      localStorage.setItem('wm-writing-stats', JSON.stringify(updated));
      return updated;
    });
  }, [wordCount, sessionElapsed]);

  // Save stats on unmount
  useEffect(() => () => saveSessionStats(), []);

  // ── WRITE ALL SCENES ──────────────────────────────────────────────
  const handleWriteAllScenes = useCallback(async () => {
    const secs = chapter?.sections || [];
    const sceneHeaders = secs.filter(s => s.type === 'h2' || s.type === 'h3');
    if (sceneHeaders.length === 0) {
      setHint('No scene sections found — apply a blueprint first.');
      setTimeout(() => setHint(null), 4000);
      return;
    }

    takeSnapshot('Before write all scenes');
    setWritingAllScenes(true);
    setTotalScenes(sceneHeaders.length);
    setGenerating(true);

    let accumulated = prose || '';

    for (let i = 0; i < sceneHeaders.length; i++) {
      setCurrentSceneIdx(i);
      const scene = sceneHeaders[i];
      const sceneName = scene.content || scene.title || `Scene ${i + 1}`;
      const isFirst = i === 0 && !accumulated.trim();

      // Build scene-specific brief: overall chapter goal + this scene's role
      const sceneBrief = `${chapter?.scene_goal || chapter?.title || ''}\nCURRENT SCENE: "${sceneName}" (scene ${i + 1} of ${sceneHeaders.length})\n${chapter?.chapter_notes || ''}`;

      try {
        const res = await fetch(`${API}/memories/story-continue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_prose: accumulated.trim() || `[Opening — ${sceneName}]`,
            chapter_title: chapter?.title || 'Untitled Chapter',
            chapter_brief: sceneBrief,
            pnos_act: chapter?.pnos_act || 'act_1',
            book_character: book?.character || 'JustAWoman',
            character_id: selectedCharacter?.id || null,
            gen_length: genLength,
            stream: false,
            emotional_state_start: i === 0 ? (chapter?.emotional_state_start || '') : '',
            emotional_state_end: i === sceneHeaders.length - 1 ? (chapter?.emotional_state_end || '') : '',
            theme: chapter?.theme || book?.theme || '',
            pov: chapter?.pov || '',
            sections: chapter?.sections || [],
            chapter_notes: chapter?.chapter_notes || '',
            tone: chapter?.tone || book?.tone || '',
          }),
        });

        const data = await res.json();
        const newProse = data.prose || data.continuation || data.content || data.text || '';
        if (newProse) {
          // Add scene header + generated prose
          const header = `\n\n---\n\n### ${sceneName}\n\n`;
          accumulated = (accumulated ? accumulated + header : `### ${sceneName}\n\n`) + newProse.trim();
          setProse(accumulated);
          setWordCount(accumulated.split(/\s+/).filter(Boolean).length);
          setSaved(false);
        }
      } catch (err) {
        console.error(`Scene ${i + 1} generation error:`, err);
        setHint(`Scene "${sceneName}" failed — continuing with remaining scenes.`);
        setTimeout(() => setHint(null), 3000);
      }
    }

    setWritingAllScenes(false);
    setCurrentSceneIdx(-1);
    setGenerating(false);
    setHint(`All ${sceneHeaders.length} scenes generated! Review and refine.`);
    setTimeout(() => setHint(null), 5000);
  }, [chapter, prose, bookId, book, selectedCharacter, genLength, takeSnapshot]);

  // ── VOICE RECOGNITION — MAIN ─────────────────────────────────────────

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setMicError('Voice not supported on this browser. Try Chrome.');
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    transcriptRef.current = '';

    rec.onresult = (e) => {
      let interim = '';
      let final = transcriptRef.current;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript + ' ';
        } else {
          interim = e.results[i][0].transcript;
        }
      }
      transcriptRef.current = final;
      setTranscript(final + interim);
    };

    rec.onerror = (e) => {
      if (e.error !== 'no-speech') setMicError('Mic error — tap to retry');
      setListening(false);
    };

    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
    setMicError(null);
    setTranscript('');
    transcriptRef.current = '';
  }, []);

  // ── GENERATE PROSE FROM SPEECH ────────────────────────────────────────

  const generateProse = useCallback(async (spoken) => {
    takeSnapshot('Before voice-to-story');
    setGenerating(true);
    setStreamingText('');
    try {
      const res = await fetch(`${API}/memories/voice-to-story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spoken,
          existing_prose:  prose,
          chapter_title:   chapter?.title,
          chapter_brief:   chapter?.scene_goal || chapter?.chapter_notes,
          pnos_act:        chapter?.pnos_act || 'act_1',
          book_character:  book?.character || 'JustAWoman',
          session_log:     sessionLog.slice(-4),
          character_id:    selectedCharacter?.id || null,
          gen_length:      genLength,
          stream:          true,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let hintData = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'processing') {
              setStreamingText('…');
            } else if (evt.type === 'text') {
              fullText += evt.text;
              setStreamingText(fullText);
              // Auto-scroll while streaming
              if (proseRef.current) {
                proseRef.current.scrollTop = proseRef.current.scrollHeight;
              }
            } else if (evt.type === 'done') {
              hintData = evt.hint || null;
            } else if (evt.type === 'error') {
              console.error('voice-to-story stream error:', evt.error);
            }
          } catch {}
        }
      }

      if (fullText) {
        const newProse = prose
          ? prose.trimEnd() + '\n\n' + fullText
          : fullText;
        setProse(newProse);
        setWordCount(newProse.split(/\s+/).filter(Boolean).length);
        setSaved(false);
        setSessionLog(prev => [...prev, { spoken, generated: fullText }]);
        if (hintData) {
          setHint(hintData);
          setTimeout(() => setHint(null), 6000);
        }
      }
    } catch (err) {
      console.error('voice-to-story error:', err);
    }
    setStreamingText('');
    setGenerating(false);
  }, [prose, chapter, book, sessionLog, genLength, selectedCharacter, takeSnapshot]);

  const toggleListening = useCallback(async () => {
    if (listening) {
      // Stop and generate
      recognitionRef.current?.stop();
      setListening(false);
      const spoken = transcriptRef.current.trim();
      if (!spoken) return;
      setTranscript('');
      await generateProse(spoken);
    } else {
      // Start listening
      startListening();
    }
  }, [listening, startListening, generateProse]);

  // ── EDIT LOOP — VOICE ─────────────────────────────────────────────────

  const startEditListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    editTransRef.current = '';

    rec.onresult = (e) => {
      let interim = '';
      let final = editTransRef.current;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
        else interim = e.results[i][0].transcript;
      }
      editTransRef.current = final;
      setEditNote(final + interim);
    };
    rec.onend = () => setEditListening(false);
    editRecRef.current = rec;
    rec.start();
    setEditListening(true);
    editTransRef.current = '';
  }, []);

  const stopEditListening = useCallback(() => {
    editRecRef.current?.stop();
    setEditListening(false);
  }, []);

  const applyEdit = useCallback(async () => {
    if (!editNote.trim()) return;
    takeSnapshot('Before edit');
    setGenerating(true);
    try {
      const res = await fetch(`${API}/memories/story-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_prose: prose,
          edit_note:     editNote.trim(),
          pnos_act:      chapter?.pnos_act || 'act_1',
          chapter_title: chapter?.title,
        }),
      });
      const data = await res.json();
      if (data.prose) {
        setProse(data.prose);
        setWordCount(data.prose.split(/\s+/).filter(Boolean).length);
        setSaved(false);
        setEditNote('');
        editTransRef.current = '';
      }
    } catch (err) {
      console.error('story-edit error:', err);
    }
    setGenerating(false);
  }, [prose, editNote, chapter, takeSnapshot]);

  // ── AI TOOLBAR ACTIONS ─────────────────────────────────────────────────

  const handleContinue = useCallback(async () => {
    if (generating) return;
    takeSnapshot('Before continue');
    setAiAction('continue');
    setGenerating(true);
    setProseBeforeAi(prose);
    setNudgeText(null);
    setStreamingText('');
    try {
      const res = await fetch(`${API}/memories/story-continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_prose:  prose.trim() || `[Opening scene — ${chapter?.scene_goal || chapter?.chapter_notes || chapter?.title || 'begin the chapter'}]`,
          chapter_title:  chapter?.title || 'Untitled Chapter',
          chapter_brief:  chapter?.scene_goal || chapter?.chapter_notes || chapter?.title || '',
          pnos_act:       chapter?.pnos_act || 'act_1',
          book_character: book?.character || 'JustAWoman',
          character_id:   selectedCharacter?.id || null,
          gen_length:     genLength,
          stream:         true,
          // Full plan context for Claude
          emotional_state_start: chapter?.emotional_state_start || '',
          emotional_state_end:   chapter?.emotional_state_end || '',
          theme:                 chapter?.theme || book?.theme || '',
          pov:                   chapter?.pov || '',
          characters_present:    chapter?.characters_present || '',
          sections:              chapter?.sections || [],
          chapter_notes:         chapter?.chapter_notes || '',
          tone:                  chapter?.tone || book?.tone || '',
          setting:               chapter?.setting || book?.setting || '',
          conflict:              chapter?.conflict || book?.conflict || '',
          stakes:                chapter?.stakes || book?.stakes || '',
          hooks:                 chapter?.hooks || '',
        }),
      });

      if (!res.ok) {
        // Server returned an error — try to extract message from JSON body
        try {
          const errData = await res.json();
          setHint(errData.error || `Server error (${res.status}) — please try again.`);
        } catch {
          setHint(`Server error (${res.status}) — please try again.`);
        }
        setTimeout(() => setHint(null), 5000);
        setStreamingText('');
        setGenerating(false);
        setAiAction(null);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'text') {
              fullText += evt.text;
              setStreamingText(fullText);
              if (proseRef.current) {
                proseRef.current.scrollTop = proseRef.current.scrollHeight;
              }
            } else if (evt.type === 'error') {
              setHint(evt.error);
              setTimeout(() => setHint(null), 5000);
            }
          } catch {}
        }
      }

      if (fullText) {
        setPreviewText(fullText);
      } else {
        setHint('No text generated — try again or write a few words first.');
        setTimeout(() => setHint(null), 5000);
      }
    } catch (err) {
      console.error('story-continue error:', err);
      setHint('Connection error — check your server and try again.');
      setTimeout(() => setHint(null), 5000);
    }
    setStreamingText('');
    setGenerating(false);
    setAiAction(null);
  }, [prose, chapter, book, generating, genLength, selectedCharacter, takeSnapshot]);

  const handleDeepen = useCallback(async () => {
    if (!prose.trim() || generating) {
      if (!prose.trim() && !generating) {
        setHint('Write some prose first — then Deepen will enrich it.');
        setTimeout(() => setHint(null), 4000);
      }
      return;
    }
    takeSnapshot('Before deepen');
    setAiAction('deepen');
    setGenerating(true);
    setProseBeforeAi(prose);
    setNudgeText(null);
    try {
      const res = await fetch(`${API}/memories/story-deepen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_prose:  prose,
          pnos_act:       chapter?.pnos_act || 'act_1',
          chapter_title:  chapter?.title,
          character_id:   selectedCharacter?.id || null,
          // Full plan context for Claude
          chapter_brief:         chapter?.scene_goal || chapter?.chapter_notes || '',
          emotional_state_start: chapter?.emotional_state_start || '',
          emotional_state_end:   chapter?.emotional_state_end || '',
          theme:                 chapter?.theme || book?.theme || '',
          pov:                   chapter?.pov || '',
          characters_present:    chapter?.characters_present || '',
          tone:                  chapter?.tone || book?.tone || '',
          setting:               chapter?.setting || book?.setting || '',
          conflict:              chapter?.conflict || book?.conflict || '',
          stakes:                chapter?.stakes || book?.stakes || '',
        }),
      });
      if (!res.ok) {
        setHint(`Deepen failed (${res.status}) — please try again.`);
        setTimeout(() => setHint(null), 5000);
        setGenerating(false);
        setAiAction(null);
        return;
      }
      const data = await res.json();
      if (data.prose) {
        pushAiHistory('deepen', data.prose);
        setProse(data.prose);
        setWordCount(data.prose.split(/\s+/).filter(Boolean).length);
        setSaved(false);
      } else if (data.error) {
        setHint(data.error);
        setTimeout(() => setHint(null), 5000);
      }
    } catch (err) {
      console.error('story-deepen error:', err);
      setHint('Connection error — check your server and try again.');
      setTimeout(() => setHint(null), 5000);
    }
    setGenerating(false);
    setAiAction(null);
  }, [prose, chapter, generating, selectedCharacter, takeSnapshot]);

  const handleNudge = useCallback(async () => {
    if (generating) return;
    setAiAction('nudge');
    setGenerating(true);
    setNudgeText(null);
    try {
      const res = await fetch(`${API}/memories/story-nudge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_prose:  prose,
          chapter_title:  chapter?.title,
          chapter_brief:  chapter?.scene_goal || chapter?.chapter_notes,
          pnos_act:       chapter?.pnos_act || 'act_1',
          character_id:   selectedCharacter?.id || null,
          // Full plan context for Claude
          emotional_state_start: chapter?.emotional_state_start || '',
          emotional_state_end:   chapter?.emotional_state_end || '',
          theme:                 chapter?.theme || book?.theme || '',
          pov:                   chapter?.pov || '',
          characters_present:    chapter?.characters_present || '',
          tone:                  chapter?.tone || book?.tone || '',
          setting:               chapter?.setting || book?.setting || '',
          conflict:              chapter?.conflict || book?.conflict || '',
          stakes:                chapter?.stakes || book?.stakes || '',
        }),
      });
      if (!res.ok) {
        setHint(`Nudge failed (${res.status}) — please try again.`);
        setTimeout(() => setHint(null), 5000);
        setGenerating(false);
        setAiAction(null);
        return;
      }
      const data = await res.json();
      if (data.nudge) {
        setNudgeText(data.nudge);
      }
    } catch (err) {
      console.error('story-nudge error:', err);
      setHint('Connection error — check your server and try again.');
      setTimeout(() => setHint(null), 5000);
    }
    setGenerating(false);
    setAiAction(null);
  }, [prose, chapter, generating, selectedCharacter]);

  const undoAi = useCallback(() => {
    if (proseBeforeAi !== null) {
      setProse(proseBeforeAi);
      setWordCount(proseBeforeAi.split(/\s+/).filter(Boolean).length);
      setSaved(false);
      setProseBeforeAi(null);
    }
  }, [proseBeforeAi]);

  // ── PREVIEW ACCEPT / REJECT ─────────────────────────────────────────
  const acceptPreview = useCallback(() => {
    if (!previewText) return;
    const newProse = prose.trim()
      ? prose.trimEnd() + '\n\n' + previewText
      : previewText;
    setProse(newProse);
    setWordCount(newProse.split(/\s+/).filter(Boolean).length);
    setSaved(false);
    pushAiHistory('continue', previewText);
    setPreviewText(null);
  }, [previewText, prose, pushAiHistory]);

  const rejectPreview = useCallback(() => {
    setPreviewText(null);
  }, []);

  // ── REVIEW LINES LOADER ─────────────────────────────────────────────

  const loadReviewLines = useCallback(async () => {
    setReviewLoading(true);
    try {
      const res  = await fetch(`${API}/storyteller/books/${bookId}`);
      const data = await res.json();
      const bookData = data?.book || data;
      const ch = (bookData.chapters || []).find(c => c.id === chapterId);
      setReviewLines(ch?.lines || []);
    } catch {}
    setReviewLoading(false);
  }, [bookId, chapterId]);

  // ── REVIEW LINE ACTIONS ─────────────────────────────────────────────

  const updateLineLocal = (lineId, updates) => {
    setReviewLines(prev => prev.map(ln => ln.id === lineId ? { ...ln, ...updates } : ln));
  };

  const approveLine = async (lineId) => {
    try {
      await fetch(`${API}/storyteller/lines/${lineId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'approved' }),
      });
      const updatedLines = reviewLines.map(ln => ln.id === lineId ? { ...ln, status: 'approved' } : ln);
      setReviewLines(updatedLines);
      const line = reviewLines.find(l => l.id === lineId);
      if (line) setLastApprovedLine({ ...line, status: 'approved' });
      // Sync approved lines back to draft prose
      syncLinesToDraft(updatedLines);
    } catch {}
  };

  const rejectLine = async (lineId) => {
    try {
      await fetch(`${API}/storyteller/lines/${lineId}`, { method: 'DELETE' });
      setReviewLines(prev => prev.filter(l => l.id !== lineId));
    } catch {}
  };

  const startLineEdit = (line) => { setEditingLine(line.id); setEditText(line.text || line.content || ''); };

  const saveLineEdit = async () => {
    try {
      await fetch(`${API}/storyteller/lines/${editingLine}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: editText, content: editText, status: 'edited' }),
      });
      const updatedLines = reviewLines.map(ln => ln.id === editingLine ? { ...ln, text: editText, content: editText, status: 'edited' } : ln);
      setReviewLines(updatedLines);
      setEditingLine(null);
      setEditText('');
      // Sync edited lines back to draft prose
      syncLinesToDraft(updatedLines);
    } catch {}
  };

  const approveAll = async () => {
    const pending = reviewLines.filter(l => l.status === 'pending');
    for (const ln of pending) await approveLine(ln.id);
  };

  // ── SYNC APPROVED LINES BACK TO DRAFT PROSE ─────────────────────────
  // After approving/editing lines, rebuild draft_prose from the current review lines
  // so Write tab always reflects the latest approved content
  const syncLinesToDraft = useCallback(async (updatedLines) => {
    const lines = updatedLines || reviewLines;
    const approvedOrEdited = lines
      .filter(l => l.status === 'approved' || l.status === 'edited')
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    if (approvedOrEdited.length === 0) return;
    const rebuiltProse = approvedOrEdited.map(l => l.text || l.content || '').join('\n\n');
    setProse(rebuiltProse);
    setWordCount(rebuiltProse.split(/\s+/).filter(Boolean).length);
    // Persist to server
    try {
      await fetch(`${API}/storyteller/chapters/${chapterId}/save-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_prose: rebuiltProse }),
      });
    } catch {}
  }, [reviewLines, chapterId]);

  // ── SEND TO REVIEW ────────────────────────────────────────────────────

  const sendToReview = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`${API}/storyteller/chapters/${chapterId}/save-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_prose: prose }),
      });

      // Check for existing approved/edited lines that should be preserved
      const existingRes = await fetch(`${API}/storyteller/books/${bookId}`);
      const existingData = await existingRes.json();
      const existingBook = existingData?.book || existingData;
      const existingCh = (existingBook.chapters || []).find(c => c.id === chapterId);
      const existingLines = existingCh?.lines || [];
      const approvedLines = existingLines.filter(l => l.status === 'approved' || l.status === 'edited');

      // If there are approved lines, delete only pending/rejected lines then append new prose
      // If no approved lines exist, use replace mode for a fresh start
      const importMode = approvedLines.length > 0 ? 'append' : 'replace';

      if (approvedLines.length > 0) {
        // Delete only pending/rejected lines to preserve approved ones
        const toDelete = existingLines.filter(l => l.status === 'pending' || l.status === 'rejected');
        for (const ln of toDelete) {
          try {
            await fetch(`${API}/storyteller/lines/${ln.id}`, { method: 'DELETE' });
          } catch {}
        }
      }

      // Convert paragraphs to LINE-marked format for import
      const paragraphs = prose.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      const lineMarked = paragraphs.map((p, i) => `LINE ${i + 1}\n${p}`).join('\n\n');
      await fetch(`${API}/storyteller/chapters/${chapterId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: lineMarked, mode: importMode }),
      });

      // ── Emotional Impact — the character carries the scene ──
      if (selectedCharacter?.id && prose) {
        fetch(`${API}/storyteller/chapters/${chapterId}/emotional-impact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prose,
            character_id: selectedCharacter.id,
          }),
        }).catch(() => {}); // Fire-and-forget
      }

      // Switch to Review tab instead of navigating away
      setCenterTab('review');
      await loadReviewLines();
    } catch (err) {
      console.error('sendToReview error:', err);
    }
    setSaving(false);
  }, [prose, chapterId, bookId, selectedCharacter, loadReviewLines]);

  // ── PROSE EDIT (direct typing) ────────────────────────────────────────

  const handleProseChange = (e) => {
    const val = e.target.value;
    setProse(val);
    setWordCount(val.split(/\s+/).filter(Boolean).length);
    setSaved(false);
    // Auto-grow textarea on mobile
    autoGrowTextarea(e.target);
  };

  // Auto-grow textarea so it doesn't need internal scroll on mobile
  const autoGrowTextarea = useCallback((el) => {
    if (!el || window.innerWidth > 767) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  // Re-grow textarea when prose changes externally (AI generation, undo, etc.)
  useEffect(() => {
    if (proseTextareaRef.current && window.innerWidth <= 767) {
      autoGrowTextarea(proseTextareaRef.current);
    }
  }, [prose, streamingText, autoGrowTextarea]);

  // ── SECTION-AWARE PROSE ───────────────────────────────────────────────

  const hasSectionHeaders = chapter?.sections?.length > 0 &&
    chapter.sections.some(s => ['h2','h3','h4'].includes(s.type));

  const handleSectionProseChange = useCallback((secId, value) => {
    setSectionProse(prev => {
      const updated = { ...prev, [secId]: value };
      sectionProseRef.current = updated;
      // Combine all section prose into the main prose state
      const combined = (chapter?.sections || [])
        .filter(s => ['h2','h3','h4'].includes(s.type))
        .map(s => updated[s.id] || '')
        .filter(Boolean)
        .join('\n\n');
      setProse(combined);
      setWordCount(combined.split(/\s+/).filter(Boolean).length);
      setSaved(false);
      return updated;
    });
  }, [chapter?.sections]);

  // ── TOGGLE FOCUS MODE ─────────────────────────────────────────────────

  const toggleFocusMode = useCallback(() => {
    setFocusMode(prev => {
      if (!prev) {
        // Entering focus mode — save sidebar state, then close them
        preFocusSidebarRef.current = { toc: showToc, ctx: showContext };
        setShowToc(false);
        setShowContext(false);
      } else {
        // Exiting focus mode — restore previous sidebar state
        setShowToc(preFocusSidebarRef.current.toc);
        setShowContext(preFocusSidebarRef.current.ctx);
      }
      return !prev;
    });
  }, [showToc, showContext]);

  // ── KEYBOARD SHORTCUTS ────────────────────────────────────────────────

  useEffect(() => {
    const handleKey = (e) => {
      // Ctrl/Cmd+Enter → Continue
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!editMode && prose.trim() && !generating) handleContinue();
      }
      // Ctrl/Cmd+D → Deepen
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (!editMode && prose.trim() && !generating) handleDeepen();
      }
      // Ctrl/Cmd+S → Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (prose) saveDraft(prose);
      }
      // Ctrl/Cmd+F → Find & Replace
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowFindReplace(v => !v);
      }
      // Escape → exit edit mode, close panels
      if (e.key === 'Escape') {
        if (showFindReplace) { setShowFindReplace(false); return; }
        if (editMode) { setEditMode(false); return; }
        if (showHistory) { setShowHistory(false); return; }
        if (showGoalInput) { setShowGoalInput(false); return; }
        if (focusMode) { toggleFocusMode(); return; }
        if (selectedParagraph !== null) { setSelectedParagraph(null); setParaAction(null); return; }
        if (editingTocId) { setEditingTocId(null); return; }
        if (addingTocChapter) { setAddingTocChapter(false); return; }
        if (editingContext) { setEditingContext(null); return; }
      }
      // F11 → toggle focus mode (prevent browser fullscreen)
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFocusMode();
      }
      // Ctrl+[ → previous chapter, Ctrl+] → next chapter
      if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        e.preventDefault();
        goAdjacentChapter(-1);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ']') {
        e.preventDefault();
        goAdjacentChapter(1);
      }
      // Ctrl+B → toggle TOC sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setShowToc(t => !t);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [editMode, prose, generating, focusMode, showHistory, showGoalInput, showFindReplace, selectedParagraph, handleContinue, handleDeepen, saveDraft, toggleFocusMode]);

  // ── TOC / CONTEXT — PERSIST TOGGLES ─────────────────────────────────

  useEffect(() => { localStorage.setItem('wm-show-toc', JSON.stringify(showToc)); }, [showToc]);
  useEffect(() => { localStorage.setItem('wm-show-context', JSON.stringify(showContext)); }, [showContext]);

  // ── SWITCH CHAPTER ────────────────────────────────────────────────────

  const switchChapter = useCallback(async (targetId) => {
    if (targetId === chapterId) return;
    // auto-save current
    if (prose) await saveDraft(prose);
    navigate(`/chapter/${bookId}/${targetId}`);
  }, [chapterId, bookId, prose, saveDraft, navigate]);

  // ── PREV / NEXT CHAPTER ───────────────────────────────────────────────

  const goAdjacentChapter = useCallback((direction) => {
    const idx = allChapters.findIndex(c => c.id === chapterId);
    if (idx < 0) return;
    const target = allChapters[idx + direction];
    if (target) switchChapter(target.id);
  }, [allChapters, chapterId, switchChapter]);

  // ── TOC: REORDER (drag & drop) ────────────────────────────────────────

  const handleTocDrop = useCallback(async () => {
    if (tocDragIdx === null || tocDragOverIdx === null || tocDragIdx === tocDragOverIdx) {
      setTocDragIdx(null);
      setTocDragOverIdx(null);
      return;
    }
    const reordered = [...allChapters];
    const [moved] = reordered.splice(tocDragIdx, 1);
    reordered.splice(tocDragOverIdx, 0, moved);
    // optimistic update
    setAllChapters(reordered);
    setTocDragIdx(null);
    setTocDragOverIdx(null);
    // persist new sort_order
    try {
      await Promise.all(reordered.map((ch, i) =>
        fetch(`${API}/storyteller/chapters/${ch.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: i + 1 }),
        })
      ));
    } catch (err) {
      console.error('reorder error', err);
    }
  }, [allChapters, tocDragIdx, tocDragOverIdx]);

  // ── TOC: RENAME CHAPTER ───────────────────────────────────────────────

  const commitTocRename = useCallback(async () => {
    if (!editingTocId || !tocEditTitle.trim()) { setEditingTocId(null); return; }
    setAllChapters(prev => prev.map(c => c.id === editingTocId ? { ...c, title: tocEditTitle.trim() } : c));
    if (editingTocId === chapterId) setChapter(prev => ({ ...prev, title: tocEditTitle.trim() }));
    setEditingTocId(null);
    try {
      await fetch(`${API}/storyteller/chapters/${editingTocId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: tocEditTitle.trim() }),
      });
    } catch (err) { console.error('rename error', err); }
  }, [editingTocId, tocEditTitle, chapterId]);

  // ── TOC: EXPAND / COLLAPSE SECTIONS ─────────────────────────────────

  const toggleExpandChapter = useCallback((chId) => {
    if (expandedTocId === chId) {
      setExpandedTocId(null);
      setTocSections([]);
      return;
    }
    setExpandedTocId(chId);
    const ch = allChapters.find(c => c.id === chId);
    const secs = (ch?.sections && Array.isArray(ch.sections)) ? ch.sections.map(s => ({ ...s, id: s.id || tocUuid() })) : [];
    setTocSections(secs);
  }, [expandedTocId, allChapters]);

  // Auto-save sections (debounced)
  const saveTocSections = useCallback(async (secs) => {
    if (!expandedTocId) return;
    try {
      await fetch(`${API}/storyteller/chapters/${expandedTocId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: secs }),
      });
      // update local cache
      setAllChapters(prev => prev.map(c => c.id === expandedTocId ? { ...c, sections: secs } : c));
      if (expandedTocId === chapterId) setChapter(prev => ({ ...prev, sections: secs }));
    } catch (err) { console.error('save sections error', err); }
  }, [expandedTocId, chapterId]);

  // Trigger debounced section save
  useEffect(() => {
    if (!expandedTocId || tocSections.length === 0) return;
    clearTimeout(tocSectionSaveRef.current);
    tocSectionSaveRef.current = setTimeout(() => saveTocSections(tocSections), 1500);
    return () => clearTimeout(tocSectionSaveRef.current);
  }, [tocSections, expandedTocId, saveTocSections]);

  // ── TOC SECTIONS: ADD ─────────────────────────────────────────────────

  const addTocSection = useCallback((type = 'body') => {
    const newSec = { id: tocUuid(), type, content: '' };
    setTocSections(prev => [...prev, newSec]);
    setShowSectionTypeMenu(false);
    // Auto-focus
    setTimeout(() => {
      setEditingSectionId(newSec.id);
      setSectionEditVal('');
    }, 50);
  }, []);

  // ── TOC SECTIONS: UPDATE ──────────────────────────────────────────────

  const commitSectionEdit = useCallback(() => {
    if (!editingSectionId) return;
    setTocSections(prev => prev.map(s => s.id === editingSectionId ? { ...s, content: sectionEditVal } : s));
    setEditingSectionId(null);
  }, [editingSectionId, sectionEditVal]);

  // ── TOC SECTIONS: DELETE ──────────────────────────────────────────────

  const deleteTocSection = useCallback((secId) => {
    setTocSections(prev => prev.filter(s => s.id !== secId));
  }, []);

  // ── TOC SECTIONS: REORDER ─────────────────────────────────────────────

  const moveTocSection = useCallback((secId, direction) => {
    setTocSections(prev => {
      const idx = prev.findIndex(s => s.id === secId);
      if (idx < 0) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  }, []);

  // ── TOC: ADD NEW CHAPTER ──────────────────────────────────────────────

  const commitAddChapter = useCallback(async () => {
    const title = newTocTitle.trim() || `Chapter ${allChapters.length + 1}`;
    setAddingTocChapter(false);
    setNewTocTitle('');
    try {
      const res = await fetch(`${API}/storyteller/books/${bookId}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          chapter_number: allChapters.length + 1,
          sort_order: allChapters.length + 1,
        }),
      });
      const data = await res.json();
      const newCh = data.chapter || data;
      setAllChapters(prev => [...prev, newCh]);
    } catch (err) { console.error('add chapter error', err); }
  }, [bookId, allChapters.length, newTocTitle]);

  // ── CONTEXT: SAVE PLANNING FIELD ──────────────────────────────────────

  const saveContextField = useCallback(async (field, value) => {
    // optimistic
    setChapter(prev => ({ ...prev, [field]: value }));
    setAllChapters(prev => prev.map(c => c.id === chapterId ? { ...c, [field]: value } : c));
    setEditingContext(null);
    try {
      await fetch(`${API}/storyteller/chapters/${chapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
    } catch (err) { console.error('save context field error', err); }
  }, [chapterId]);

  // ── COMPUTED: chapter progress stats ──────────────────────────────────

  const chapterStats = useMemo(() => {
    const total = allChapters.length;
    const written = allChapters.filter(c => c.draft_prose?.trim()).length;
    const totalWords = allChapters.reduce((sum, c) => sum + (c.draft_prose ? c.draft_prose.split(/\s+/).filter(Boolean).length : 0), 0);
    return { total, written, totalWords };
  }, [allChapters]);

  // ── RENDER ────────────────────────────────────────────────────────────

  if (loading) return <div className="wm-load-screen"><LoadingSkeleton variant="editor" /></div>;

  const approvedLines = reviewLines.filter(l => l.status === 'approved' || l.status === 'edited');
  const pendingLines  = reviewLines.filter(l => l.status === 'pending');

  // ── REVIEW LINE RENDERER ──────────────────────────────────────────────
  function renderReviewLine(ln, isPending) {
    const isEditing = editingLine === ln.id;
    const text = ln.text || ln.content || '';
    return (
      <div
        key={ln.id}
        className={`wm-review-line wm-review-line--${ln.status}${isEditing ? ' editing' : ''}`}
      >
        <div className="wm-review-line-content">
          {isEditing ? (
            <>
              <textarea
                className="wm-review-line-edit"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                autoFocus
              />
              <div className="wm-review-line-edit-actions">
                <button className="wm-review-save" onClick={saveLineEdit}>Save</button>
                <button className="wm-review-cancel" onClick={() => setEditingLine(null)}>Cancel</button>
              </div>
            </>
          ) : (
            <p className={`wm-review-line-text${isPending ? ' pending' : ''}`}>{text}</p>
          )}
        </div>
        {!isEditing && (
          <div className="wm-review-line-actions">
            {isPending && (
              <button className="wm-line-approve" onClick={() => approveLine(ln.id)} title="Approve">{'✓'}</button>
            )}
            <button className="wm-line-edit" onClick={() => startLineEdit(ln)} title="Edit">{'✎'}</button>
            {isPending && (
              <button className="wm-line-reject" onClick={() => rejectLine(ln.id)} title="Reject">{'✕'}</button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`wm-root${focusMode ? ' wm-focus-mode' : ''}`}>
      {/* ── FOCUS MODE EXIT ── */}
      {focusMode && (
        <button className="wm-focus-exit" onClick={toggleFocusMode} title="Exit focus mode (F11)">
          {'✕'}
        </button>
      )}

      {/* ── TOP BAR ── */}
      {!hideTopBar && (
      <header className="wm-topbar">
        <button className="wm-back-btn" onClick={() => setShowExit(true)}>
          {'←'}
        </button>

        <button
          className={`wm-sidebar-toggle${showToc ? ' active' : ''}`}
          onClick={() => setShowToc(t => !t)}
          title="Table of Contents (Ctrl+B)"
        >
          {'☰'}
        </button>
        <div className="wm-chapter-info">
          <div className="wm-chapter-title">{chapter?.title || 'Untitled'}</div>
          <div className="wm-book-title">{book?.title || book?.character || ''}</div>
        </div>

        {/* ── Session timer ── */}
        <div className="wm-session-timer">
          <span className="wm-timer-icon">{'⏱'}</span>
          <span className="wm-timer-value">
            {Math.floor(sessionElapsed / 3600) > 0 && `${Math.floor(sessionElapsed / 3600)}:`}
            {String(Math.floor((sessionElapsed % 3600) / 60)).padStart(2, '0')}:{String(sessionElapsed % 60).padStart(2, '0')}
          </span>
        </div>

        <div className="wm-top-right">
          {/* Quick Character Switch */}
          <div className="wm-quick-char-wrap">
            <button
              className="wm-quick-char-btn"
              onClick={() => setShowCharQuick(q => !q)}
              title="Quick switch character"
            >
              <span>{selectedCharacter?.icon || '👤'}</span>
              <span className="wm-quick-char-caret">{showCharQuick ? '▲' : '▼'}</span>
            </button>
            {showCharQuick && (
              <div className="wm-quick-char-dropdown">
                <div
                  className={`wm-quick-char-option${!selectedCharacter ? ' selected' : ''}`}
                  onClick={() => { setSelectedCharacter(null); setShowCharQuick(false); }}
                >
                  <span className="wm-quick-char-option-icon">{'—'}</span>
                  <span>Narrator</span>
                </div>
                {characters.map(c => (
                  <div
                    key={c.id}
                    className={`wm-quick-char-option${selectedCharacter?.id === c.id ? ' selected' : ''}`}
                    onClick={() => { setSelectedCharacter(c); setShowCharQuick(false); }}
                  >
                    <span className="wm-quick-char-option-icon">{c.icon || '👤'}</span>
                    <span>{c.display_name || c.selected_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {wordCount > 0 && (
            <div className="wm-word-count-wrap" onClick={() => setShowGoalInput(g => !g)} title="Click to set word goal">
              {wordGoal > 0 && (() => {
                const progress = Math.min(1, (wordCount - startingWordCountRef.current) / wordGoal);
                const r = 12, c = 2 * Math.PI * r;
                const color = progress >= 1 ? '#4A9B6F' : progress >= 0.5 ? '#B8962E' : '#B85C38';
                return (
                  <svg className="wm-goal-ring" width="28" height="28" viewBox="0 0 28 28">
                    <circle cx="14" cy="14" r={r} fill="none" stroke="rgba(28,24,20,0.08)" strokeWidth="2.5" />
                    <circle cx="14" cy="14" r={r} fill="none" stroke={color} strokeWidth="2.5"
                      strokeDasharray={c} strokeDashoffset={c * (1 - progress)}
                      strokeLinecap="round" transform="rotate(-90 14 14)"
                      style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }} />
                  </svg>
                );
              })()}
              <span className="wm-word-count">{wordCount}w</span>
            </div>
          )}
          <div className="wm-save-status">
            {saving ? '·· saving' : saved ? lastSavedAgo : '· unsaved'}
          </div>

          <button
            className={`wm-tts-btn${ttsPlaying ? ' active' : ''}`}
            onClick={handleReadAloud}
            title={ttsPlaying ? 'Stop reading' : 'Read aloud (select text or reads all)'}
          >
            {ttsPlaying ? '◼' : '🔊'}
          </button>

          <button
            className="wm-stats-btn"
            onClick={() => setShowStats(s => !s)}
            title="Writing stats"
          >
            {'📊'}
          </button>

          <button
            className={`wm-history-btn${showHistory ? ' active' : ''}`}
            onClick={() => setShowHistory(h => !h)}
            title={`Snapshots (${history.length})`}
          >
            {'📜'}{history.length > 0 && <span className="wm-history-badge">{history.length}</span>}
          </button>

          <button
            className={`wm-focus-btn${focusMode ? ' active' : ''}`}
            onClick={toggleFocusMode}
            title="Focus mode (F11)"
          >
            {focusMode ? '⛶' : '⛶'}
          </button>

          <button
            className={`wm-sidebar-toggle wm-ctx-toggle${showContext ? ' active' : ''}`}
            onClick={() => setShowContext(c => !c)}
            title="Chapter context panel"
          >
            {'ℹ'}
          </button>

          <button
            className="wm-help-btn"
            onClick={() => setShowHelp(true)}
            title="Keyboard shortcuts & help"
          >
            {'?'}
          </button>
        </div>
      </header>
      )}

      {/* ── WORD GOAL BAR ── */}
      {wordGoal > 0 && (() => {
        const wordsWritten = Math.max(0, wordCount - startingWordCountRef.current);
        const pct = Math.min(100, (wordsWritten / wordGoal) * 100);
        const goalMet = wordsWritten >= wordGoal;
        return (
          <div className={`wm-goal-bar-wrap${goalMet ? ' wm-goal-met' : ''}`}>
            <div className="wm-goal-bar">
              <div
                className="wm-goal-fill"
                style={{ width: `${pct}%`, background: goalMet ? '#4A9B6F' : pct > 50 ? '#B8962E' : '#B85C38' }}
              />
            </div>
            <span className="wm-goal-label">
              {goalMet ? '✓ ' : ''}{wordsWritten} / {wordGoal} words this session
            </span>
          </div>
        );
      })()}

      {/* ── WORD GOAL INPUT ── */}
      {showGoalInput && (
        <div className="wm-goal-input-wrap">
          <label className="wm-goal-input-label">Session word goal:</label>
          <input
            className="wm-goal-input"
            type="number"
            min={0}
            step={50}
            value={wordGoal}
            onChange={e => {
              const v = parseInt(e.target.value) || 0;
              setWordGoal(v);
              localStorage.setItem('wm-word-goal', v);
            }}
            placeholder="e.g. 500"
          />
          <button className="wm-goal-input-close" onClick={() => setShowGoalInput(false)}>{'✓'}</button>
        </div>
      )}

      {/* ── MAIN HUB LAYOUT ── */}
      <div className="wm-hub-layout">

        {/* ── LEFT: TOC SIDEBAR (hidden on mobile) ── */}
        {effectiveToc && (
          <aside className="wm-toc-sidebar">
            <div className="wm-toc-header">
              <span className="wm-toc-header-title">Contents</span>
              <span className="wm-toc-stats">{chapterStats.written}/{chapterStats.total} &middot; {chapterStats.totalWords.toLocaleString()}w</span>
            </div>

            <div className="wm-toc-list">
              {allChapters.map((ch, i) => {
                const isCurrent = ch.id === chapterId;
                const chWords = ch.draft_prose ? ch.draft_prose.split(/\s+/).filter(Boolean).length : 0;
                const isExpanded = expandedTocId === ch.id;
                const hasSections = ch.sections && Array.isArray(ch.sections) && ch.sections.length > 0;
                const cType = ch.chapter_type || 'chapter';
                const typeIcon = cType === 'prologue' ? '◈' : cType === 'epilogue' ? '◇' : cType === 'interlude' ? '~' : cType === 'afterword' ? '∗' : null;
                const showPartDivider = ch.part_number && (i === 0 || ch.part_number !== allChapters[i - 1]?.part_number);
                return (
                  <div key={ch.id} className="wm-toc-chapter-group">
                    {showPartDivider && (
                      <div className="wm-toc-part-divider">
                        <span className="wm-toc-part-label">Part {ch.part_number}{ch.part_title ? ` — ${ch.part_title}` : ''}</span>
                      </div>
                    )}
                    <div
                      className={`wm-toc-item${isCurrent ? ' current' : ''}${tocDragOverIdx === i ? ' drag-over' : ''}`}
                      draggable
                      onDragStart={() => setTocDragIdx(i)}
                      onDragOver={(e) => { e.preventDefault(); setTocDragOverIdx(i); }}
                      onDragEnd={handleTocDrop}
                      onClick={() => !editingTocId && switchChapter(ch.id)}
                    >
                      <span className="wm-toc-drag">{'≡'}</span>
                      <button
                        className={`wm-toc-expand${isExpanded ? ' expanded' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleExpandChapter(ch.id); }}
                        title={isExpanded ? 'Collapse sections' : 'Show sections'}
                      >
                        {'▸'}
                      </button>
                      <span className="wm-toc-num">{ch.chapter_number || i + 1}</span>
                      {typeIcon && <span className="wm-toc-type-badge" title={cType}>{typeIcon}</span>}
                      {editingTocId === ch.id ? (
                        <input
                          className="wm-toc-edit-input"
                          value={tocEditTitle}
                          onChange={e => setTocEditTitle(e.target.value)}
                          onBlur={commitTocRename}
                          onKeyDown={e => { if (e.key === 'Enter') commitTocRename(); if (e.key === 'Escape') setEditingTocId(null); }}
                          autoFocus
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="wm-toc-title"
                          onDoubleClick={(e) => { e.stopPropagation(); setEditingTocId(ch.id); setTocEditTitle(ch.title || ''); }}
                        >
                          {ch.title || 'Untitled'}
                        </span>
                      )}
                      <span className="wm-toc-words">{chWords > 0 ? `${chWords}w` : '—'}</span>
                    </div>

                    {/* ── Sections inside this chapter ── */}
                    {isExpanded && (
                      <div className="wm-toc-sections">
                        {tocSections.length === 0 && (
                          <div className="wm-toc-sec-empty">No sections yet</div>
                        )}
                        {tocSections.map((sec) => {
                          const typeInfo = SECTION_TYPES.find(t => t.type === sec.type) || { icon: '?', label: sec.type };
                          const isHeader = HEADER_TYPES.includes(sec.type);
                          const isDivider = sec.type === 'divider';
                          return (
                            <div key={sec.id} className={`wm-toc-sec-item${isHeader ? ' is-header' : ''}${isDivider ? ' is-divider' : ''}`}>
                              <span className="wm-toc-sec-icon" title={typeInfo.label}>{typeInfo.icon}</span>
                              {isDivider ? (
                                <span className="wm-toc-sec-divider-line" />
                              ) : editingSectionId === sec.id ? (
                                <input
                                  className="wm-toc-sec-edit"
                                  value={sectionEditVal}
                                  onChange={e => setSectionEditVal(e.target.value)}
                                  onBlur={commitSectionEdit}
                                  onKeyDown={e => { if (e.key === 'Enter') commitSectionEdit(); if (e.key === 'Escape') setEditingSectionId(null); }}
                                  placeholder={typeInfo.label + '…'}
                                  autoFocus
                                />
                              ) : (
                                <span
                                  className="wm-toc-sec-text"
                                  onClick={(e) => { e.stopPropagation(); setEditingSectionId(sec.id); setSectionEditVal(sec.content || ''); }}
                                >
                                  {sec.content || <span className="wm-toc-sec-placeholder">{typeInfo.label}</span>}
                                </span>
                              )}
                              <div className="wm-toc-sec-actions">
                                <button onClick={(e) => { e.stopPropagation(); moveTocSection(sec.id, -1); }} title="Move up">{'↑'}</button>
                                <button onClick={(e) => { e.stopPropagation(); moveTocSection(sec.id, 1); }} title="Move down">{'↓'}</button>
                                <button className="wm-toc-sec-del" onClick={(e) => { e.stopPropagation(); deleteTocSection(sec.id); }} title="Delete">{'×'}</button>
                              </div>
                            </div>
                          );
                        })}

                        {/* Add section */}
                        {showSectionTypeMenu && expandedTocId === ch.id ? (
                          <div className="wm-toc-sec-type-menu">
                            {SECTION_TYPES.map(st => (
                              <button key={st.type} className="wm-toc-sec-type-opt" onClick={() => addTocSection(st.type)}>
                                <span className="wm-toc-sec-type-icon">{st.icon}</span> {st.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <button className="wm-toc-sec-add" onClick={(e) => { e.stopPropagation(); setShowSectionTypeMenu(true); }}>
                            + Add Section
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add chapter */}
            {addingTocChapter ? (
              <div className="wm-toc-add-row">
                <input
                  className="wm-toc-add-input"
                  value={newTocTitle}
                  onChange={e => setNewTocTitle(e.target.value)}
                  onBlur={commitAddChapter}
                  onKeyDown={e => { if (e.key === 'Enter') commitAddChapter(); if (e.key === 'Escape') setAddingTocChapter(false); }}
                  placeholder={`Chapter ${allChapters.length + 1}`}
                  autoFocus
                />
              </div>
            ) : (
              <button className="wm-toc-add-btn" onClick={() => setAddingTocChapter(true)}>
                + Add Chapter
              </button>
            )}

            {/* Prev/Next nav */}
            <div className="wm-toc-nav">
              <button
                className="wm-toc-nav-btn"
                disabled={allChapters.findIndex(c => c.id === chapterId) <= 0}
                onClick={() => goAdjacentChapter(-1)}
              >
                {'←'} Prev
              </button>
              <button
                className="wm-toc-nav-btn"
                disabled={allChapters.findIndex(c => c.id === chapterId) >= allChapters.length - 1}
                onClick={() => goAdjacentChapter(1)}
              >
                Next {'→'}
              </button>
            </div>
          </aside>
        )}

        {/* ── CENTER: MAIN WRITING COLUMN ── */}
        <div className="wm-main-col">

      {/* ══ CENTER TAB BAR ══ */}
      <div className="wm-center-tabs">
        {CENTER_TABS.map(tab => (
          <button
            key={tab.id}
            className={`wm-center-tab${centerTab === tab.id ? ' wm-center-tab--active' : ''}`}
            onClick={() => setCenterTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'review' && pendingLines.length > 0 && (
              <span className="wm-tab-badge">{pendingLines.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══ MOBILE UTILITY BAR — character picker + chapter nav (phones only) ══ */}
      {isMobile && (
        <div className="wm-mobile-bar">
          {/* Character picker */}
          <div className="wm-mob-char-wrap">
            <button
              className="wm-mob-char-btn"
              onClick={() => setShowCharQuick(q => !q)}
            >
              <span className="wm-mob-char-icon">{selectedCharacter?.icon || '👤'}</span>
              <span className="wm-mob-char-name">{selectedCharacter?.display_name || selectedCharacter?.selected_name || 'Narrator'}</span>
              <span className="wm-mob-char-caret">{showCharQuick ? '▲' : '▼'}</span>
            </button>
            {showCharQuick && (
              <div className="wm-mob-char-dropdown">
                <button
                  className={`wm-mob-char-option${!selectedCharacter ? ' selected' : ''}`}
                  onClick={() => { setSelectedCharacter(null); setShowCharQuick(false); }}
                >
                  <span className="wm-mob-char-opt-icon">{'—'}</span>
                  Narrator
                </button>
                {characters.map(c => (
                  <button
                    key={c.id}
                    className={`wm-mob-char-option${selectedCharacter?.id === c.id ? ' selected' : ''}`}
                    onClick={() => { setSelectedCharacter(c); setShowCharQuick(false); }}
                  >
                    <span className="wm-mob-char-opt-icon">{c.icon || '👤'}</span>
                    {c.display_name || c.selected_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chapter nav */}
          {allChapters.length > 1 && (
            <div className="wm-mob-chapter-nav">
              <button
                className="wm-mob-nav-btn"
                disabled={allChapters.findIndex(c => c.id === chapterId) <= 0}
                onClick={() => goAdjacentChapter(-1)}
              >{'‹'}</button>
              <span className="wm-mob-nav-label">
                {(() => {
                  const idx = allChapters.findIndex(c => c.id === chapterId);
                  return `${idx + 1}/${allChapters.length}`;
                })()}
              </span>
              <button
                className="wm-mob-nav-btn"
                disabled={allChapters.findIndex(c => c.id === chapterId) >= allChapters.length - 1}
                onClick={() => goAdjacentChapter(1)}
              >{'›'}</button>
            </div>
          )}

          {/* Word count */}
          {wordCount > 0 && (
            <span className="wm-mob-wc">{wordCount}w</span>
          )}
        </div>
      )}

      {/* ══ WRITE TAB ══ */}
      {centerTab === 'write' && (
      <>

      {/* ── REVIEW SYNC BANNER ── */}
      {pendingLines.length > 0 && (
        <div className="wm-sync-banner" onClick={() => setCenterTab('review')}>
          <span className="wm-sync-dot" />
          <span>{pendingLines.length} pending line{pendingLines.length > 1 ? 's' : ''} in Review</span>
          <span className="wm-sync-action">Go to Review {'→'}</span>
        </div>
      )}

      {/* ── MAIN CONTENT AREA ── */}
      <div className="wm-content-row">
        {/* ── PROSE SECTION ── */}
        <div className="wm-prose-wrap" ref={proseRef}>

          {/* ── Manuscript page container ── */}
          <div className="wm-manuscript-page">

            {/* ── Chapter opening ── */}
            <div className="wm-chapter-opening">
              <h2 className="wm-chapter-heading">{chapter?.title || 'Untitled'}</h2>
            </div>

            {/* ── Section-aware writing area ── */}
            {hasSectionHeaders ? (
              <div className="wm-canvas-sections">
                {chapter.sections.map((sec, idx) => {
                  const isHeader = ['h2','h3','h4'].includes(sec.type);
                  /* Skip h2 that duplicates the chapter title already shown above */
                  const isDuplicateTitle = sec.type === 'h2' &&
                    sec.content?.trim().toLowerCase() === (chapter?.title || '').trim().toLowerCase();
                  return (
                    <div key={sec.id || idx} className="wm-cs-block">
                      {/* Section marker */}
                      {sec.type === 'divider' && (
                        <div className="wm-cs-divider"><span className="wm-cs-divider-line" /></div>
                      )}
                      {sec.type === 'h2' && !isDuplicateTitle && (
                        <h2 className="wm-cs-h2">{sec.content || 'Untitled Section'}</h2>
                      )}
                      {sec.type === 'h3' && (
                        <h3 className="wm-cs-h3">{sec.content || 'Untitled Section'}</h3>
                      )}
                      {sec.type === 'h4' && (
                        <h4 className="wm-cs-h4">{sec.content || 'Untitled'}</h4>
                      )}
                      {sec.type === 'quote' && (
                        <blockquote className="wm-cs-quote">{sec.content}</blockquote>
                      )}
                      {sec.type === 'reflection' && (
                        <div className="wm-cs-reflection">{sec.content}</div>
                      )}
                      {sec.type === 'body' && (
                        <p className="wm-cs-body">{sec.content}</p>
                      )}
                      {/* Textarea under each header section */}
                      {isHeader && (
                        <textarea
                          className="wm-prose-area wm-section-prose"
                          value={sectionProse[sec.id] || ''}
                          onChange={(e) => {
                            handleSectionProseChange(sec.id, e.target.value);
                            autoGrowTextarea(e.target);
                          }}
                          placeholder={`Write under ${sec.content || 'this section'}…`}
                          spellCheck={false}
                          readOnly={generating}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
              {/* ── Welcome guide for empty chapters ── */}
              {!prose.trim() && !generating && !editMode && (
                <div className="wm-welcome-guide">
                  <div className="wm-welcome-title">How would you like to begin?</div>
                  <div className="wm-welcome-options">
                    <button className="wm-welcome-option" onClick={() => proseTextareaRef.current?.focus()}>
                      <span className="wm-welcome-option-icon">{'✍'}</span>
                      <span className="wm-welcome-option-label">Type</span>
                      <span className="wm-welcome-option-desc">Start writing in your own words</span>
                    </button>
                    <button className="wm-welcome-option" onClick={toggleListening}>
                      <span className="wm-welcome-option-icon">{'🎙'}</span>
                      <span className="wm-welcome-option-label">Speak</span>
                      <span className="wm-welcome-option-desc">Dictate and AI transforms it into prose</span>
                    </button>
                    <button className="wm-welcome-option" onClick={handleContinue}>
                      <span className="wm-welcome-option-icon">{'✨'}</span>
                      <span className="wm-welcome-option-label">AI Start</span>
                      <span className="wm-welcome-option-desc">Generate an opening based on your chapter plan</span>
                    </button>
                  </div>
                  <div className="wm-welcome-workflow">
                    <span className="wm-welcome-step">Write</span>
                    <span className="wm-welcome-arrow">{'→'}</span>
                    <span className="wm-welcome-step">Review</span>
                    <span className="wm-welcome-arrow">{'→'}</span>
                    <span className="wm-welcome-step">Approve</span>
                  </div>
                  <div className="wm-welcome-tip">
                    Fill in the <strong>Chapter Plan</strong> on the right to give AI better context
                  </div>
                </div>
              )}
              {prosePreviewMode && prose.trim() ? (
                <div className="wm-prose-preview" onClick={() => setProsePreviewMode(false)}>
                  {prose.split(/\n\n+/).filter(s => s.trim()).map((para, i) => (
                    <p key={i} className="wm-prose-preview-para">{
                      para.replace(/---/g, '\u2014')
                          .replace(/--/g, '\u2013')
                          .replace(/"([^"]*?)"/g, '\u201C$1\u201D')
                          .replace(/'([^']*?)'/g, '\u2018$1\u2019')
                          .replace(/\*([^*]+)\*/g, '$1')
                    }</p>
                  ))}
                  <div className="wm-prose-preview-hint">Click anywhere to return to editing</div>
                </div>
              ) : (
              <textarea
                className="wm-prose-area"
                ref={proseTextareaRef}
                value={streamingText ? (prose ? prose.trimEnd() + '\n\n' + streamingText : streamingText) : prose}
                onChange={handleProseChange}
                onDoubleClick={(e) => {
                  if (editMode || generating) return;
                  const pos = e.target.selectionStart;
                  const textBefore = prose.slice(0, pos);
                  const paraIndex = textBefore.split(/\n\n+/).length - 1;
                  setSelectedParagraph(paraIndex);
                }}
                placeholder={editMode ? '' : "Begin writing…"}
                spellCheck={false}
                readOnly={generating}
              />
              )}
              {/* ── Pacing Arc Sparkline ── */}
              {tensionAnalysis.length > 2 && (
                <div className="wm-sparkline-gutter" aria-hidden="true" title="Pacing arc — emotional intensity by paragraph">
                  <svg className="wm-sparkline-svg" viewBox={`0 0 ${tensionAnalysis.length * 6} 40`} preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke="#B8962E"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                      points={tensionAnalysis.map((p, i) => `${i * 6 + 3},${40 - p.score * 4}`).join(' ')}
                    />
                    {tensionAnalysis.map((p, i) => (
                      <circle
                        key={i}
                        cx={i * 6 + 3}
                        cy={40 - p.score * 4}
                        r={1.5}
                        fill={p.tone === 'action' ? '#C0392B' : p.tone === 'interior' ? '#8E44AD' : p.tone === 'calm' ? '#27AE60' : '#B8962E'}
                      >
                        <title>¶{i + 1}: {p.tone} ({p.score}/10, {p.words}w)</title>
                      </circle>
                    ))}
                  </svg>
                  <div className="wm-sparkline-labels">
                    <span>Low</span><span>High</span>
                  </div>
                </div>
              )}
              </>
            )}

          </div>

          {/* ── Narrative Intelligence panel — appears after 5+ prose lines ── */}
          {niShouldShow && (
            <div className="wm-ni-panel">
              <div className="wm-ni-panel-header">
                <span className="wm-ni-label">Narrative Intelligence</span>
              </div>
              <NarrativeIntelligence
                chapter={chapter}
                lines={prose.split(/\n\n+/).filter(s => s.trim()).map((text, i) => ({
                  id:      `prose-${i}`,
                  content: text,
                  text:    text,
                  status:  'approved',
                }))}
                lineIndex={proseLineCount - 1}
                book={book}
                characters={registryCharacters}
              />
            </div>
          )}

          {/* ── Contextual paragraph hint ── */}
          {!editMode && prose.trim() && (
            <div
              className={`wm-para-float-hint${selectedParagraph !== null ? ' active' : ''}`}
              onClick={() => {
                if (selectedParagraph !== null) {
                  setSelectedParagraph(null);
                  setParaAction(null);
                } else {
                  setSelectedParagraph(0);
                }
              }}
              title="Paragraph actions"
            >
              {'¶'}
            </div>
          )}

          {/* ── PARAGRAPH SELECTION OVERLAY ── */}
          {selectedParagraph !== null && (
            <div className="wm-para-overlay">
              {prose.split(/\n\n+/).map((p, i) => (
                <div
                  key={i}
                  className={`wm-para-block${i === selectedParagraph ? ' selected' : ''}`}
                  onClick={() => setSelectedParagraph(i === selectedParagraph ? null : i)}
                >
                  <p>{p}</p>
                  {i === selectedParagraph && (
                    <div className="wm-para-actions">
                      <button onClick={(e) => { e.stopPropagation(); handleParagraphAction('rewrite'); }} disabled={generating}>
                        {generating && paraAction === 'rewrite' ? 'Rewriting…' : '✎ Rewrite'}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleParagraphAction('expand'); }} disabled={generating}>
                        {generating && paraAction === 'expand' ? 'Expanding…' : '↔ Expand'}
                      </button>
                      <button className="wm-para-delete" onClick={(e) => { e.stopPropagation(); handleParagraphAction('delete'); }} disabled={generating}>
                        {'✗ Delete'}
                      </button>
                      <button className="wm-para-cancel" onClick={(e) => { e.stopPropagation(); setSelectedParagraph(null); setParaAction(null); }}>
                        {'✕'}
                      </button>
                      <div className="wm-para-custom" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          className="wm-para-custom-input"
                          placeholder="Custom instruction…"
                          value={paraInstruction}
                          onChange={(e) => setParaInstruction(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && paraInstruction.trim()) handleParagraphAction('custom'); }}
                          disabled={generating}
                        />
                        <button
                          className="wm-para-custom-go"
                          onClick={() => handleParagraphAction('custom')}
                          disabled={generating || !paraInstruction.trim()}
                        >
                          {generating && paraAction === 'custom' ? '…' : '→'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {generating && !streamingText && (
            <div className="wm-generating">
              <div className="wm-generating-dots">
                <span className="wm-generating-dot" />
                <span className="wm-generating-dot" />
                <span className="wm-generating-dot" />
              </div>
              <div className="wm-generating-label">
                {aiAction === 'continue' ? 'continuing your story' :
                 aiAction === 'deepen' ? 'deepening the moment' :
                 aiAction === 'nudge' ? 'thinking' :
                 'writing'}
              </div>
            </div>
          )}

          {hint && !generating && (
            <div className="wm-hint">
              <div className="wm-hint-dot" />
              <div className="wm-hint-text">{hint}</div>
              {hintLog.length > 1 && (
                <button className="wm-hint-log-toggle" onClick={() => setShowHintLog(h => !h)} title="View hint history">
                  {hintLog.length}
                </button>
              )}
            </div>
          )}
          {showHintLog && hintLog.length > 0 && (
            <div className="wm-hint-log">
              <div className="wm-hint-log-header">
                <span className="wm-hint-log-title">Session Hints</span>
                <button className="wm-hint-log-close" onClick={() => setShowHintLog(false)}>{'×'}</button>
              </div>
              {[...hintLog].reverse().map((h, i) => (
                <div key={i} className="wm-hint-log-item">
                  <span className="wm-hint-log-time">{new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="wm-hint-log-text">{h.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── TRANSCRIPT PREVIEW (while listening) ── */}
      {listening && transcript && (
        <div className="wm-transcript">
          <div className="wm-transcript-text">{transcript}</div>
        </div>
      )}

      {/* ── NUDGE DISPLAY ── */}
      {nudgeText && !generating && (
        <div className="wm-nudge">
          <div className="wm-nudge-icon">{"💡"}</div>
          <div className="wm-nudge-text">{nudgeText}</div>
          <button className="wm-nudge-close" onClick={() => setNudgeText(null)}>{"×"}</button>
        </div>
      )}

      {/* ── AI TOOLBAR ── */}
      {!editMode && (
        <div className="wm-ai-toolbar">
          <button
            className={`wm-ai-btn${aiAction === 'continue' ? ' active' : ''}`}
            onClick={handleContinue}
            disabled={generating}
            title={!prose.trim() ? 'Generate an opening for this chapter' : 'Continue writing from where you left off'}
          >
            <span className="wm-ai-icon">{"✨"}</span>
            <span className="wm-ai-btn-label">Continue</span>
            <span className="wm-ai-btn-desc">{!prose.trim() ? 'Start chapter' : 'Keep going'}</span>
          </button>
          <button
            className={`wm-ai-btn${aiAction === 'deepen' ? ' active' : ''}`}
            onClick={handleDeepen}
            disabled={generating || !prose.trim()}
            title={!prose.trim() ? 'Write something first — then Deepen will enrich your text' : 'Add sensory detail and emotional depth to your prose'}
          >
            <span className="wm-ai-icon">{"🔍"}</span>
            <span className="wm-ai-btn-label">Deepen</span>
            <span className="wm-ai-btn-desc">Enrich details</span>
          </button>
          <button
            className={`wm-ai-btn${aiAction === 'nudge' ? ' active' : ''}`}
            onClick={handleNudge}
            disabled={generating}
            title="Get a creative writing prompt — not inserted, just a suggestion"
          >
            <span className="wm-ai-icon">{"💡"}</span>
            <span className="wm-ai-btn-label">Nudge</span>
            <span className="wm-ai-btn-desc">Get a prompt</span>
          </button>
          {proseBeforeAi !== null && !generating && (
            <button className="wm-ai-btn wm-undo-ai" onClick={undoAi}>
              <span className="wm-ai-icon">{"↩"}</span> Undo
            </button>
          )}
          <button
            className={`wm-len-toggle${genLength === 'sentence' ? ' sentence' : ''}`}
            onClick={() => {
              setGenLength(g => {
                const next = g === 'paragraph' ? 'sentence' : 'paragraph';
                setHint(next === 'sentence' ? 'Continue will generate 1-2 sentences' : 'Continue will generate full paragraphs');
                setTimeout(() => setHint(null), 3000);
                return next;
              });
            }}
            title={genLength === 'sentence' ? 'Generating one sentence at a time' : 'Generating full paragraphs'}
          >
            {genLength === 'sentence' ? '1 line' : '¶ full'}
          </button>
          {prose.trim() && (
            <button
              className={`wm-ai-btn wm-para-mode-btn${selectedParagraph !== null ? ' active' : ''}`}
              onClick={() => {
                if (selectedParagraph !== null) {
                  setSelectedParagraph(null);
                  setParaAction(null);
                } else {
                  setSelectedParagraph(0);
                }
              }}
              title="Paragraph-level actions"
            >
              <span className="wm-ai-icon">{'¶'}</span> Paragraphs
            </button>
          )}
          {prose.trim() && (
            <button
              className={`wm-ai-btn${prosePreviewMode ? ' active' : ''}`}
              onClick={() => setProsePreviewMode(p => !p)}
              title="Toggle manuscript preview"
            >
              <span className="wm-ai-icon">{'📖'}</span> Preview
            </button>
          )}
          {aiHistory.length > 0 && (
            <button
              className="wm-ai-btn"
              onClick={() => setShowAiHistory(true)}
              title={`${aiHistory.length} AI generations`}
            >
              <span className="wm-ai-icon">{'📋'}</span> History
            </button>
          )}
          {!prose.trim() && (
            <span className="wm-ai-hint">Tap <strong>Continue</strong> to start writing — or <strong>Nudge</strong> for a creative prompt</span>
          )}
        </div>
      )}

      {/* ── HISTORY PANEL ── */}
      {showHistory && (
        <div className="wm-history-panel">
          <div className="wm-history-header">
            <span className="wm-history-title">Snapshots</span>
            <button className="wm-history-close" onClick={() => setShowHistory(false)}>{'×'}</button>
          </div>
          {history.length === 0 ? (
            <div className="wm-history-empty">No snapshots yet. Snapshots are taken automatically before each AI action.</div>
          ) : (
            <div className="wm-history-list">
              {[...history].reverse().map((snap, i) => {
                const idx = history.length - 1 - i;
                const t = new Date(snap.timestamp);
                const timeStr = `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`;
                return (
                  <div key={i} className="wm-history-item">
                    <div className="wm-history-item-header">
                      <span className="wm-history-item-label">{snap.label}</span>
                      <span className="wm-history-item-meta">{timeStr} · {snap.wordCount}w</span>
                    </div>
                    <div className="wm-history-item-preview">
                      {snap.prose.length > 200 ? snap.prose.slice(0, 200) + '…' : snap.prose}
                    </div>
                    <button
                      className="wm-history-restore"
                      onClick={() => {
                        takeSnapshot('Before restore');
                        setProse(snap.prose);
                        setWordCount(snap.prose.split(/\s+/).filter(Boolean).length);
                        setSaved(false);
                        setShowHistory(false);
                      }}
                    >
                      Restore this version
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── EDIT MODE PANEL ── */}
      {editMode && (
        <div className="wm-edit-panel">
          <div className="wm-edit-label">What needs to change?</div>
          <div className="wm-edit-row">
            <textarea
              className="wm-edit-input"
              value={editNote}
              onChange={e => setEditNote(e.target.value)}
              placeholder="That part is right but she wouldn't say it that way..."
              rows={3}
            />
            <button
              className="wm-edit-mic-btn"
              onPointerDown={startEditListening}
              onPointerUp={stopEditListening}
            >
              {editListening
                ? <span className="wm-mic-active-ring">{'🎙'}</span>
                : '🎙'}
            </button>
          </div>
          <button
            className="wm-apply-btn"
            style={{ opacity: editNote.trim() ? 1 : 0.35 }}
            onClick={applyEdit}
            disabled={!editNote.trim() || generating}
          >
            {generating ? 'Rewriting…' : 'Apply →'}
          </button>
        </div>
      )}

      {/* ── MIC ERROR ── */}
      {micError && (
        <div className="wm-mic-error">{micError}</div>
      )}

      {/* ── BOTTOM BAR ── */}
      {!editMode && (
        <div className="wm-bottom-bar">
          <button
            className={`wm-mic-btn${listening ? ' listening' : ''}`}
            onClick={toggleListening}
            disabled={generating}
          >
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
              <rect x="9" y="3" width="10" height="16" rx="5"
                fill={listening ? '#F5F0E8' : '#1a1a1a'} />
              <path d="M5 14c0 5 3.5 9 9 9s9-4 9-9"
                stroke={listening ? '#F5F0E8' : '#1a1a1a'}
                strokeWidth="2" strokeLinecap="round" fill="none"/>
              <line x1="14" y1="23" x2="14" y2="26"
                stroke={listening ? '#F5F0E8' : '#1a1a1a'}
                strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          <div className="wm-bottom-hint">
            {listening
              ? 'Listening… tap mic to stop and convert to prose'
              : generating
              ? (aiAction === 'continue' ? 'Continuing your story…' : aiAction === 'deepen' ? 'Enriching your prose…' : 'Writing…')
              : prose
              ? 'When ready, tap → Review to approve your lines'
              : 'Tap mic to dictate, or just start typing above'}
          </div>

          {prose.length > 20 && (
            <button
              className="wm-send-btn"
              onClick={sendToReview}
              disabled={saving}
            >
              {saving ? '…' : '→ Review'}
            </button>
          )}
        </div>
      )}

      </>)}{/* end write tab */}

      {/* ══ REVIEW TAB ══ */}
      {centerTab === 'review' && (
        <div className="wm-review-tab">
          <div className="wm-review-header">
            <button className="wm-review-back-btn" onClick={() => setCenterTab('write')}>
              {'←'} Back to Write
            </button>
            <div className="wm-review-stats">
              <span className="wm-review-stat approved">{approvedLines.length} approved</span>
              {pendingLines.length > 0 && (
                <span className="wm-review-stat pending">{pendingLines.length} pending</span>
              )}
              <span className="wm-review-stat total">{reviewLines.length} total</span>
            </div>
            {pendingLines.length > 0 && (
              <button className="wm-approve-all-btn" onClick={approveAll}>
                Approve all ({pendingLines.length})
              </button>
            )}
          </div>

          {reviewLoading ? (
            <div className="wm-review-loading">Loading lines{'…'}</div>
          ) : reviewLines.length === 0 ? (
            <div className="wm-review-empty">
              <div className="wm-review-empty-icon">{'◌'}</div>
              <div className="wm-review-empty-text">
                No lines yet. Write in the Write tab and click {'→'} Review to send them here.
              </div>
              <button className="wm-review-go-write" onClick={() => setCenterTab('write')}>
                Go to Write tab {'→'}
              </button>
            </div>
          ) : (
            <div className="wm-review-manuscript">
              {approvedLines.map((ln, i) => (
                <div key={ln.id}>
                  {renderReviewLine(ln, false)}
                  {(i + 1) % 5 === 0 && i < approvedLines.length - 1 && (
                    <div className="wm-ni-inline">
                      <NarrativeIntelligence
                        chapter={chapter}
                        lines={approvedLines.slice(Math.max(0, i - 4), i + 1)}
                        lineIndex={i}
                        book={book}
                        characters={registryCharacters}
                      />
                    </div>
                  )}
                </div>
              ))}

              <ContinuityGuard
                chapter={chapter}
                lines={approvedLines}
                book={book}
                triggerLine={lastApprovedLine}
              />

              {pendingLines.length > 0 && (
                <div className="wm-pending-section">
                  <div className="wm-pending-label">{pendingLines.length} pending</div>
                  {pendingLines.map(ln => renderReviewLine(ln, true))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ STRUCTURE TAB ══ */}
      {centerTab === 'structure' && (
        <div className="wm-panel-tab">
          <BookStructurePanel
            bookId={bookId}
            allChapters={allChapters}
            onChapterUpdate={(chId, updates) => {
              setAllChapters(prev => prev.map(c => c.id === chId ? { ...c, ...updates } : c));
            }}
            onReloadChapters={reloadChapters}
          />
        </div>
      )}

      {/* ══ SCENES TAB ══ */}
      {centerTab === 'scenes' && (
        <div className="wm-panel-tab">
          <ScenesPanel bookId={bookId} chapters={allChapters} onChaptersChange={reloadChapters} book={book} characterId={selectedCharacter?.id} />
        </div>
      )}

      {/* ══ MEMORY TAB ══ */}
      {centerTab === 'memory' && (
        <div className="wm-panel-tab">
          <MemoryBankView bookId={bookId} />
        </div>
      )}

      {/* ══ LALA TAB ══ */}
      {centerTab === 'lala' && (
        <div className="wm-panel-tab">
          <LalaSceneDetection bookId={bookId} />
        </div>
      )}

      {/* ══ EXPORT TAB ══ */}
      {centerTab === 'export' && (
        <div className="wm-panel-tab">
          <ExportPanel bookId={bookId} />
        </div>
      )}

        </div>{/* end wm-main-col */}

        {/* ── RIGHT: CONTEXT PANEL (hidden on mobile) ── */}
        {effectiveContext && (
          <aside className="wm-context-panel">
            <div className="wm-ctx-header">
              <div className="wm-ctx-tabs">
                <button
                  className={`wm-ctx-tab${contextTab === 'plan' ? ' wm-ctx-tab--active' : ''}`}
                  onClick={() => setContextTab('plan')}
                >
                  Chapter Plan
                </button>
                <button
                  className={`wm-ctx-tab${contextTab === 'ai-writer' ? ' wm-ctx-tab--active' : ''}`}
                  onClick={() => setContextTab('ai-writer')}
                >
                  {"✦"} Write
                </button>
                {charLoading && <span className="wm-ctx-loading">◌</span>}
              </div>
            </div>

            {/* ── AI WRITER TAB ── */}
            {contextTab === 'ai-writer' && (
              <WriteModeAIWriter
                chapterId={chapterId}
                bookId={bookId}
                selectedCharacter={selectedCharacter}
                characters={characters}
                onSelectCharacter={setSelectedCharacter}
                currentProse={prose}
                previousChapterDigest={prevChapterSummary?.continuityDigest || ''}
                chapterContext={{
                  scene_goal:          chapter?.scene_goal,
                  theme:               chapter?.theme,
                  emotional_arc_start: chapter?.emotional_state_start,
                  emotional_arc_end:   chapter?.emotional_state_end,
                  pov:                 chapter?.pov,
                }}
                onInsert={(text) => {
                  const ta = proseTextareaRef.current;
                  const pos = ta?.selectionStart;
                  if (ta && pos != null && pos > 0 && pos < (prose || '').length) {
                    // Insert at cursor position
                    const before = prose.slice(0, pos);
                    const after = prose.slice(pos);
                    const sep = before.endsWith('\n') ? '\n' : '\n\n';
                    const sepAfter = after.startsWith('\n') ? '' : '\n\n';
                    setProse(before + sep + text + sepAfter + after);
                  } else {
                    // Append at end (default)
                    setProse(prev => prev ? prev + '\n\n' + text : text);
                  }
                }}
              />
            )}

            {/* ── CHAPTER PLAN TAB ── */}
            {contextTab === 'plan' && (<>

            {/* Chapter Templates */}
            <div className="wm-ctx-field">
              <label className="wm-ctx-label">Chapter Blueprints</label>
              <div className="wm-tpl-grid">
                {[
                  {
                    name: 'Conversation',
                    icon: '💬',
                    scene_goal: 'Two characters navigate an unresolved tension across multiple settings and emotional shifts',
                    emotional_state_start: 'Composed',
                    emotional_state_end: 'Shaken',
                    theme: 'Connection & conflict',
                    chapter_notes: 'Scene 1: Surface-level encounter (public space, pretending). Scene 2: Private escalation (alone, masks slip). Scene 3: The thing that gets said (the line that changes the air). Optional Scene 4: Aftermath — one character alone processing.',
                    sections: [
                      { type: 'h2', content: 'The Surface' },
                      { type: 'p', content: '' },
                      { type: 'h2', content: 'Behind Closed Doors' },
                      { type: 'p', content: '' },
                      { type: 'h2', content: 'The Line That Changes Everything' },
                      { type: 'p', content: '' },
                      { type: 'h2', content: 'Alone With It' },
                      { type: 'p', content: '' },
                    ],
                  },
                  {
                    name: 'Pressure Cooker',
                    icon: '⚡',
                    scene_goal: 'External forces compress time and space, pushing the character into decisions they aren\'t ready for',
                    emotional_state_start: 'Alert',
                    emotional_state_end: 'Exhausted',
                    theme: 'Survival & determination',
                    chapter_notes: 'Scene 1: The normal before (routine, maybe even bored). Scene 2: Disruption — the thing that changes the day. Scene 3: Escalation — no time to think, forced to act. Scene 4: Cost — what it took, what was lost.',
                    sections: [
                      { type: 'h2', content: 'Before' },
                      { type: 'p', content: '' },
                      { type: 'h2', content: 'The Disruption' },
                      { type: 'p', content: '' },
                      { type: 'h2', content: 'No Time Left' },
                      { type: 'p', content: '' },
                      { type: 'h2', content: 'What It Cost' },
                      { type: 'p', content: '' },
                    ],
                  },
                  {
                    name: 'Revelation',
                    icon: '🪞',
                    scene_goal: 'Character is confronted by something they\'ve been avoiding — a memory, a truth, a person — and can\'t look away anymore',
                    emotional_state_start: 'Guarded',
                    emotional_state_end: 'Exposed',
                    theme: 'Self-understanding & denial',
                    chapter_notes: 'Scene 1: Avoidance in motion (doing something else, but the thing is hovering). Scene 2: The trigger — an object, a conversation, a place that forces the memory. Scene 3: The flood — interior monologue, flashback, or raw confrontation with the truth. Scene 4: New ground — not healed, but different.',
                    sections: [
                      { type: 'h2', content: 'Keeping Busy' },
                      { type: 'p', content: '' },
                      { type: 'h2', content: 'The Trigger' },
                      { type: 'p', content: '' },
                      { type: 'h2', content: 'The Flood' },
                      { type: 'p', content: '' },
                      { type: 'h2', content: 'New Ground' },
                      { type: 'p', content: '' },
                    ],
                  },
                  {
                    name: 'Power Shift',
                    icon: '🔥',
                    scene_goal: 'The dynamic between two or more characters permanently changes — someone gains or loses standing, trust, or control',
                    emotional_state_start: 'Wary',
                    emotional_state_end: 'Transformed',
                    theme: 'Power, trust & betrayal',
                    chapter_notes: 'Scene 1: Established dynamic (who has power, who is performing). Scene 2: Cracks — a small moment reveals the real alignment. Scene 3: Confrontation or maneuver — someone acts on what they know. Scene 4: New order — the relationship can never go back to what it was.',
                    sections: [
                      { type: 'h2', content: 'The Old Dynamic' },
                      { type: 'p', content: '' },
                      { type: 'h2', content: 'Cracks' },
                      { type: 'p', content: '' },
                      { type: 'h2', content: 'The Move' },
                      { type: 'p', content: '' },
                      { type: 'h2', content: 'New Order' },
                      { type: 'p', content: '' },
                    ],
                  },
                  {
                    name: 'Parallel Lives',
                    icon: '🔀',
                    scene_goal: 'Cut between two timelines, two characters, or two versions of the same character to reveal contrast or connection',
                    emotional_state_start: 'Fragmented',
                    emotional_state_end: 'Convergent',
                    theme: 'Duality & recognition',
                    chapter_notes: 'Scene 1: Thread A — one character or timeline. Scene 2: Thread B — the other. Scene 3: Weave — the two start to bleed into each other. Scene 4: Collision or echo — where they meet, rhyme, or diverge forever.',
                    sections: [
                      { type: 'h2', content: 'Thread A' },
                      { type: 'p', content: '' },
                      { type: 'h2', content: 'Thread B' },
                      { type: 'p', content: '' },
                      { type: 'h2', content: 'The Weave' },
                      { type: 'p', content: '' },
                      { type: 'h2', content: 'Where They Meet' },
                      { type: 'p', content: '' },
                    ],
                  },
                  {
                    name: 'Slow Burn',
                    icon: '🕯️',
                    scene_goal: 'Nothing dramatic happens — but everything shifts underneath through accumulating details, silences, and small gestures',
                    emotional_state_start: 'Still',
                    emotional_state_end: 'Aching',
                    theme: 'Intimacy & the weight of ordinary life',
                    chapter_notes: 'Scene 1: Domestic texture (morning routine, shared space, familiar sounds). Scene 2: A small disruption — not a crisis, just a crack in the rhythm. Scene 3: The unspoken — what passes between characters in silence, in gesture. Scene 4: The last image — a detail that carries the chapter\'s emotional weight.',
                    sections: [
                      { type: 'h2', content: 'The Routine' },
                      { type: 'p', content: '' },
                      { type: 'h2', content: 'A Small Crack' },
                      { type: 'p', content: '' },
                      { type: 'h2', content: 'What Goes Unsaid' },
                      { type: 'p', content: '' },
                      { type: 'h2', content: 'The Last Image' },
                      { type: 'p', content: '' },
                    ],
                  },
                ].map(tpl => (
                  <button
                    key={tpl.name}
                    className="wm-tpl-btn"
                    title={tpl.chapter_notes}
                    onClick={() => {
                      setConfirmAction({
                        message: `Apply "${tpl.name}" blueprint? This will set the chapter plan, scene sections, and notes.`,
                        onConfirm: () => {
                          // Set all plan fields
                          saveContextField('scene_goal', tpl.scene_goal);
                          saveContextField('emotional_state_start', tpl.emotional_state_start);
                          saveContextField('emotional_state_end', tpl.emotional_state_end);
                          saveContextField('theme', tpl.theme);
                          saveContextField('chapter_notes', tpl.chapter_notes);
                          // Set sections
                          const secs = tpl.sections.map(s => ({ ...s, id: tocUuid() }));
                          saveContextField('sections', secs);
                          setTocSections(secs);
                          setConfirmAction(null);
                          setHint(`Applied "${tpl.name}" blueprint — ${tpl.sections.filter(s => s.type === 'h2').length} scenes ready`);
                        },
                      });
                    }}
                  >
                    <span className="wm-tpl-icon">{tpl.icon}</span>
                    <span className="wm-tpl-name">{tpl.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Write All Scenes — auto-generate prose for each section */}
            {chapter?.sections?.some(s => s.type === 'h2' || s.type === 'h3') && (
              <div className="wm-write-all-scenes">
                <button
                  className="wm-write-all-btn"
                  onClick={handleWriteAllScenes}
                  disabled={writingAllScenes || generating}
                >
                  {writingAllScenes ? (
                    <>
                      <span className="wm-write-all-spinner" />
                      Writing scene {currentSceneIdx + 1} of {totalScenes}…
                    </>
                  ) : (
                    <>
                      <span>✦</span> Write all {chapter.sections.filter(s => s.type === 'h2' || s.type === 'h3').length} scenes
                    </>
                  )}
                </button>
                {!writingAllScenes && (
                  <div className="wm-write-all-hint">
                    Generates prose for each scene section sequentially
                  </div>
                )}
                {writingAllScenes && (
                  <div className="wm-write-all-progress">
                    <div className="wm-write-all-progress-fill" style={{ width: `${((currentSceneIdx + 1) / totalScenes) * 100}%` }} />
                  </div>
                )}
              </div>
            )}

            {/* Scene Goal */}
            <div className="wm-ctx-field">
              <label className="wm-ctx-label">Scene Goal</label>
              {editingContext === 'scene_goal' ? (
                <textarea
                  className="wm-ctx-input"
                  value={contextEditVal}
                  onChange={e => setContextEditVal(e.target.value)}
                  onBlur={() => saveContextField('scene_goal', contextEditVal)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveContextField('scene_goal', contextEditVal); } if (e.key === 'Escape') setEditingContext(null); }}
                  rows={3}
                  autoFocus
                />
              ) : (
                <div
                  className="wm-ctx-value"
                  onClick={() => { setEditingContext('scene_goal'); setContextEditVal(chapter?.scene_goal || ''); }}
                  title="Click to edit"
                >
                  {chapter?.scene_goal || <span className="wm-ctx-empty">What happens in this chapter?</span>}
                </div>
              )}
            </div>

            {/* ── Scene Beat Planner ── */}
            <div className="wm-beat-planner">
              <label className="wm-ctx-label">Scene Beats</label>
              <div className="wm-beat-strip">
                {beatProgress.map(b => (
                  <div key={b.id} className={`wm-beat${b.active ? ' wm-beat--active' : ''}${b.current ? ' wm-beat--current' : ''}`} title={b.desc}>
                    <span className="wm-beat-icon">{b.icon}</span>
                    <span className="wm-beat-label">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div className="wm-ctx-field">
              <label className="wm-ctx-label">Theme</label>
              {editingContext === 'theme' ? (
                <input
                  className="wm-ctx-input"
                  value={contextEditVal}
                  onChange={e => setContextEditVal(e.target.value)}
                  onBlur={() => saveContextField('theme', contextEditVal)}
                  onKeyDown={e => { if (e.key === 'Enter') saveContextField('theme', contextEditVal); if (e.key === 'Escape') setEditingContext(null); }}
                  autoFocus
                />
              ) : (
                <div
                  className="wm-ctx-value"
                  onClick={() => { setEditingContext('theme'); setContextEditVal(chapter?.theme || ''); }}
                >
                  {chapter?.theme || <span className="wm-ctx-empty">Central theme</span>}
                </div>
              )}
            </div>

            {/* Emotional Arc */}
            <div className="wm-ctx-field">
              <label className="wm-ctx-label">Emotional Arc</label>
              <div className="wm-ctx-arc">
                {editingContext === 'emotional_state_start' ? (
                  <input
                    className="wm-ctx-input wm-ctx-input-sm"
                    value={contextEditVal}
                    onChange={e => setContextEditVal(e.target.value)}
                    onBlur={() => saveContextField('emotional_state_start', contextEditVal)}
                    onKeyDown={e => { if (e.key === 'Enter') saveContextField('emotional_state_start', contextEditVal); if (e.key === 'Escape') setEditingContext(null); }}
                    placeholder="Start"
                    autoFocus
                  />
                ) : (
                  <span
                    className="wm-ctx-arc-point"
                    onClick={() => { setEditingContext('emotional_state_start'); setContextEditVal(chapter?.emotional_state_start || ''); }}
                  >
                    {chapter?.emotional_state_start || 'Start'}
                  </span>
                )}
                <span className="wm-ctx-arc-arrow">{'→'}</span>
                {editingContext === 'emotional_state_end' ? (
                  <input
                    className="wm-ctx-input wm-ctx-input-sm"
                    value={contextEditVal}
                    onChange={e => setContextEditVal(e.target.value)}
                    onBlur={() => saveContextField('emotional_state_end', contextEditVal)}
                    onKeyDown={e => { if (e.key === 'Enter') saveContextField('emotional_state_end', contextEditVal); if (e.key === 'Escape') setEditingContext(null); }}
                    placeholder="End"
                    autoFocus
                  />
                ) : (
                  <span
                    className="wm-ctx-arc-point"
                    onClick={() => { setEditingContext('emotional_state_end'); setContextEditVal(chapter?.emotional_state_end || ''); }}
                  >
                    {chapter?.emotional_state_end || 'End'}
                  </span>
                )}
              </div>
              {/* ── Emotional Arc Compass ── */}
              {(chapter?.emotional_state_start || chapter?.emotional_state_end) && (
                <div className="wm-arc-compass">
                  <div className="wm-arc-compass-track">
                    <div className="wm-arc-compass-fill" style={{ width: `${emotionalArcPosition}%` }} />
                    <div className="wm-arc-compass-needle" style={{ left: `${emotionalArcPosition}%` }} />
                  </div>
                  <div className="wm-arc-compass-labels">
                    <span className="wm-arc-compass-start">{chapter?.emotional_state_start || 'Start'}</span>
                    <span className="wm-arc-compass-pct">{emotionalArcPosition}%</span>
                    <span className="wm-arc-compass-end">{chapter?.emotional_state_end || 'End'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* POV */}
            <div className="wm-ctx-field">
              <label className="wm-ctx-label">POV</label>
              {editingContext === 'pov' ? (
                <input
                  className="wm-ctx-input"
                  value={contextEditVal}
                  onChange={e => setContextEditVal(e.target.value)}
                  onBlur={() => saveContextField('pov', contextEditVal)}
                  onKeyDown={e => { if (e.key === 'Enter') saveContextField('pov', contextEditVal); if (e.key === 'Escape') setEditingContext(null); }}
                  autoFocus
                />
              ) : (
                <div
                  className="wm-ctx-value"
                  onClick={() => { setEditingContext('pov'); setContextEditVal(chapter?.pov || ''); }}
                >
                  {chapter?.pov || <span className="wm-ctx-empty">Perspective</span>}
                </div>
              )}
            </div>

            {/* Chapter Notes */}
            <div className="wm-ctx-field">
              <label className="wm-ctx-label">Notes</label>
              {editingContext === 'chapter_notes' ? (
                <textarea
                  className="wm-ctx-input"
                  value={contextEditVal}
                  onChange={e => setContextEditVal(e.target.value)}
                  onBlur={() => saveContextField('chapter_notes', contextEditVal)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveContextField('chapter_notes', contextEditVal); } if (e.key === 'Escape') setEditingContext(null); }}
                  rows={4}
                  autoFocus
                />
              ) : (
                <div
                  className="wm-ctx-value wm-ctx-notes"
                  onClick={() => { setEditingContext('chapter_notes'); setContextEditVal(chapter?.chapter_notes || ''); }}
                >
                  {chapter?.chapter_notes || <span className="wm-ctx-empty">Reminders, ideas, references&hellip;</span>}
                </div>
              )}
            </div>

            {/* Previous Chapter Summary */}
            {prevChapterSummary && (
              <div className="wm-ctx-prev">
                <label className="wm-ctx-label">Previous: {prevChapterSummary.title}</label>
                <div className="wm-ctx-prev-stats">{prevChapterSummary.wordCount.toLocaleString()} words</div>
                {prevChapterSummary.excerpt ? (
                  <div className="wm-ctx-prev-excerpt">&ldquo;{prevChapterSummary.excerpt}&rdquo;</div>
                ) : (
                  <div className="wm-ctx-prev-excerpt wm-ctx-empty">Not yet written</div>
                )}
              </div>
            )}

            {/* ── Chapter Synopsis ── */}
            <div className="wm-ctx-field">
              <label className="wm-ctx-label">Synopsis</label>
              <button
                className="wm-synopsis-btn"
                onClick={generateSynopsis}
                disabled={synopsisLoading || !prose.trim()}
              >
                {synopsisLoading ? '◌ Generating…' : synopsis ? '↻ Regenerate Synopsis' : '✦ Generate Synopsis'}
              </button>
              {synopsis && <div className="wm-synopsis-text">{synopsis}</div>}
            </div>

            {/* ── Scene Transition Helper ── */}
            {prose.split(/\n\n+/).length > 3 && (
              <div className="wm-ctx-field">
                <label className="wm-ctx-label">Scene Transitions</label>
                <button
                  className="wm-transition-btn"
                  onClick={() => {
                    const paras = prose.split(/\n\n+/);
                    const ta = proseTextareaRef.current;
                    const cursorPos = ta?.selectionStart || 0;
                    // Find which paragraph break is closest to cursor
                    let charCount = 0;
                    let splitIdx = 0;
                    for (let i = 0; i < paras.length; i++) {
                      charCount += paras[i].length + 2;
                      if (charCount >= cursorPos) { splitIdx = charCount; break; }
                    }
                    const sceneAEnd = paras.slice(Math.max(0, Math.floor(paras.length / 2) - 1), Math.floor(paras.length / 2)).join('\n\n');
                    const sceneBStart = paras.slice(Math.floor(paras.length / 2), Math.floor(paras.length / 2) + 1).join('\n\n');
                    generateTransition(sceneAEnd, sceneBStart, prose.indexOf(sceneBStart));
                  }}
                  disabled={generating}
                >
                  {'🔗'} Write transition at midpoint
                </button>
                <div className="wm-transition-hint">Generates connective prose between scenes. Place cursor at the break point.</div>
              </div>
            )}

            {/* ── Reference Chapter ── */}
            <div className="wm-ctx-field">
              <label className="wm-ctx-label">Reference Chapter</label>
              <select
                className="wm-reference-select"
                value=""
                onChange={e => { if (e.target.value) loadReferenceChapter(e.target.value); }}
              >
                <option value="">View another chapter…</option>
                {allChapters.filter(c => c.id !== chapterId).map(c => (
                  <option key={c.id} value={c.id}>{c.title || `Chapter ${c.chapter_number}`}</option>
                ))}
              </select>
            </div>

            {/* Chapter-Level Instruction */}
            <div className="wm-chapter-instruction">
              <button
                className={`wm-chapter-instruction-toggle${chapterInstructionOpen ? ' wm-chapter-instruction-toggle--open' : ''}`}
                onClick={() => setChapterInstructionOpen(o => !o)}
              >
                <span>🎬</span> Direct this scene
              </button>
              {chapterInstructionOpen && (
                <div className="wm-chapter-instruction-body">
                  <textarea
                    className="wm-ctx-input wm-chapter-instruction-input"
                    value={chapterInstruction}
                    onChange={e => setChapterInstruction(e.target.value)}
                    placeholder="e.g. Make the dialogue more tense, add sensory details about the rain…"
                    rows={3}
                  />
                  <button
                    className="wm-chapter-instruction-run"
                    onClick={handleChapterInstruction}
                    disabled={chapterInstructionLoading || !chapterInstruction.trim() || !prose.trim()}
                  >
                    {chapterInstructionLoading ? '◌ Revising…' : 'Apply to chapter'}
                  </button>
                  <div className="wm-chapter-instruction-hint">
                    Rewrites the full chapter prose with your direction
                  </div>
                </div>
              )}
            </div>

            {/* Quick link to structure in TOC */}
            <button
              className="wm-ctx-structure-link"
              onClick={() => {
                if (!showToc) setShowToc(true);
                setExpandedTocId(prev => {
                  if (prev !== chapterId) {
                    const ch = allChapters.find(c => c.id === chapterId);
                    const secs = (ch?.sections && Array.isArray(ch.sections)) ? ch.sections.map(s => ({ ...s, id: s.id || tocUuid() })) : [];
                    setTocSections(secs);
                  }
                  return chapterId;
                });
              }}
            >
              {'☰'} Show Chapter Structure
            </button>

            </>)}{/* end plan tab */}
          </aside>
        )}

      </div>{/* end wm-hub-layout */}

      {/* ── AI PROSE PREVIEW MODAL ── */}
      {previewText && (
        <div className="wm-modal-overlay" onClick={rejectPreview}>
          <div className="wm-modal wm-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="wm-modal-title">Preview Generated Text</div>
            <div className="wm-preview-prose">{previewText}</div>
            <div className="wm-modal-btns">
              <button className="wm-modal-cancel" onClick={rejectPreview}>Discard</button>
              <button className="wm-modal-leave wm-preview-accept" onClick={acceptPreview}>Insert into prose</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRMATION DIALOG ── */}
      {confirmAction && (
        <div className="wm-modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="wm-modal" onClick={e => e.stopPropagation()}>
            <div className="wm-modal-title">Confirm</div>
            <div className="wm-modal-sub">{confirmAction.message}</div>
            <div className="wm-modal-btns">
              <button className="wm-modal-cancel" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button className="wm-modal-leave" onClick={confirmAction.onConfirm}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXIT MODAL ── */}
      {showExit && (
        <div className="wm-modal-overlay" onClick={() => setShowExit(false)}>
          <div className="wm-modal" onClick={e => e.stopPropagation()}>
            <div className="wm-modal-title">Leave Write Mode?</div>
            <div className="wm-modal-sub">
              {prose ? 'Your draft is saved. You can come back.' : 'Nothing written yet.'}
            </div>
            <div className="wm-modal-btns">
              <button className="wm-modal-cancel" onClick={() => setShowExit(false)}>Stay</button>
              <button className="wm-modal-leave" onClick={async () => {
                if (prose) await saveDraft(prose);
                navigate(`/book/${bookId}`);
              }}>
                {prose ? 'Save & Leave' : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FIND & REPLACE ── */}
      {showFindReplace && (
        <div className="wm-find-replace">
          <div className="wm-find-replace-row">
            <input
              className="wm-find-input"
              placeholder="Find…"
              value={findText}
              onChange={e => { setFindText(e.target.value); doFind(e.target.value); }}
              autoFocus
            />
            <span className="wm-find-count">{findMatches > 0 ? `${findMatches} found` : ''}</span>
          </div>
          <div className="wm-find-replace-row">
            <input
              className="wm-find-input"
              placeholder="Replace with…"
              value={replaceText}
              onChange={e => setReplaceText(e.target.value)}
            />
            <button className="wm-find-btn" onClick={() => doReplace(false)} disabled={!findText || findMatches === 0}>Replace</button>
            <button className="wm-find-btn" onClick={() => doReplace(true)} disabled={!findText || findMatches === 0}>All</button>
            <button className="wm-find-close" onClick={() => setShowFindReplace(false)}>{'×'}</button>
          </div>
        </div>
      )}

      {/* ── AI GENERATION HISTORY ── */}
      {showAiHistory && (
        <div className="wm-modal-overlay" onClick={() => setShowAiHistory(false)}>
          <div className="wm-modal wm-ai-history-modal" onClick={e => e.stopPropagation()}>
            <div className="wm-modal-title">AI Generation History</div>
            <button className="wm-help-close" onClick={() => setShowAiHistory(false)}>{'×'}</button>
            {aiHistory.length === 0 ? (
              <div className="wm-ai-history-empty">No AI generations yet. Use Continue, Deepen, or AI Writer.</div>
            ) : (
              <div className="wm-ai-history-list">
                {[...aiHistory].reverse().map((entry, i) => (
                  <div key={i} className="wm-ai-history-item">
                    <div className="wm-ai-history-meta">
                      <span className="wm-ai-history-action">{entry.action}</span>
                      <span className="wm-ai-history-time">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="wm-ai-history-words">{entry.wordCount}w</span>
                    </div>
                    <div className="wm-ai-history-text">{entry.text}</div>
                    <button
                      className="wm-ai-history-insert"
                      onClick={() => {
                        takeSnapshot('Before insert from history');
                        setProse(prev => prev ? prev.trimEnd() + '\n\n' + entry.text : entry.text);
                        setSaved(false);
                        setShowAiHistory(false);
                        setHint('Inserted from history');
                        setTimeout(() => setHint(null), 3000);
                      }}
                    >
                      Insert
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DAILY WRITING STATS ── */}
      {showStats && (
        <div className="wm-modal-overlay" onClick={() => setShowStats(false)}>
          <div className="wm-modal wm-stats-modal" onClick={e => e.stopPropagation()}>
            <div className="wm-modal-title">Writing Stats</div>
            <button className="wm-help-close" onClick={() => setShowStats(false)}>{'×'}</button>

            <div className="wm-stats-current">
              <div className="wm-stats-row">
                <span className="wm-stats-label">This session</span>
                <span className="wm-stats-value">{Math.max(0, wordCount - startingWordCountRef.current)}w</span>
              </div>
              <div className="wm-stats-row">
                <span className="wm-stats-label">Session time</span>
                <span className="wm-stats-value">
                  {Math.floor(sessionElapsed / 60)}m {sessionElapsed % 60}s
                </span>
              </div>
              <div className="wm-stats-row">
                <span className="wm-stats-label">Chapter total</span>
                <span className="wm-stats-value">{wordCount}w</span>
              </div>
            </div>

            {writingStats.length > 0 && (
              <div className="wm-stats-history">
                <div className="wm-stats-history-title">Recent Sessions</div>
                <div className="wm-stats-chart">
                  {writingStats.slice(-14).map((s, i) => {
                    const maxW = Math.max(...writingStats.slice(-14).map(d => d.words), 1);
                    return (
                      <div key={i} className="wm-stats-bar-wrap" title={`${s.date}: ${s.words}w`}>
                        <div className="wm-stats-bar" style={{ height: `${(s.words / maxW) * 100}%` }} />
                        <span className="wm-stats-bar-label">{s.date.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="wm-stats-streak">
                  {(() => {
                    let streak = 0;
                    const today = new Date().toISOString().slice(0, 10);
                    for (let i = writingStats.length - 1; i >= 0; i--) {
                      const d = new Date(today);
                      d.setDate(d.getDate() - (writingStats.length - 1 - i));
                      if (writingStats[i].date === d.toISOString().slice(0, 10)) streak++;
                      else break;
                    }
                    return streak > 1 ? `🔥 ${streak}-day writing streak` : '';
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SPLIT REFERENCE VIEW ── */}
      {showReference && referenceChapter && (
        <div className="wm-reference-panel">
          <div className="wm-reference-header">
            <span className="wm-reference-title">{referenceChapter.title || 'Reference'}</span>
            <button className="wm-reference-close" onClick={() => setShowReference(false)}>{'×'}</button>
          </div>
          <div className="wm-reference-prose">
            {referenceProse || 'No prose in this chapter.'}
          </div>
        </div>
      )}

      {/* ── HELP / SHORTCUTS MODAL ── */}
      {showHelp && (
        <div className="wm-modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="wm-modal wm-help-modal" onClick={e => e.stopPropagation()}>
            <div className="wm-modal-title">Write Mode Guide</div>
            <button className="wm-help-close" onClick={() => setShowHelp(false)}>{'×'}</button>

            <div className="wm-help-section">
              <div className="wm-help-section-title">Workflow</div>
              <div className="wm-help-flow">
                <span className="wm-help-flow-step"><strong>Write</strong> your prose</span>
                <span className="wm-help-flow-arrow">{'→'}</span>
                <span className="wm-help-flow-step">Click <strong>→ Review</strong></span>
                <span className="wm-help-flow-arrow">{'→'}</span>
                <span className="wm-help-flow-step"><strong>Approve</strong> each line</span>
              </div>
              <div className="wm-help-note">Approved lines become the final version of your chapter.</div>
            </div>

            <div className="wm-help-section">
              <div className="wm-help-section-title">AI Tools</div>
              <div className="wm-help-tools">
                <div className="wm-help-tool"><span className="wm-help-tool-icon">{'✨'}</span><strong>Continue</strong> — AI writes the next passage, continuing from your prose</div>
                <div className="wm-help-tool"><span className="wm-help-tool-icon">{'🔍'}</span><strong>Deepen</strong> — Enriches your text with sensory detail and emotional depth</div>
                <div className="wm-help-tool"><span className="wm-help-tool-icon">{'💡'}</span><strong>Nudge</strong> — Gives you a creative prompt (not inserted into your text)</div>
                <div className="wm-help-tool"><span className="wm-help-tool-icon">{'🎙'}</span><strong>Voice</strong> — Speak your ideas; AI transforms them into narrative prose</div>
                <div className="wm-help-tool"><span className="wm-help-tool-icon">{'¶'}</span><strong>Paragraphs</strong> — Select any paragraph to rewrite, expand, or delete it</div>
              </div>
            </div>

            <div className="wm-help-section">
              <div className="wm-help-section-title">Keyboard Shortcuts</div>
              <div className="wm-help-shortcuts">
                <div className="wm-help-shortcut"><kbd>Ctrl+Enter</kbd><span>Continue</span></div>
                <div className="wm-help-shortcut"><kbd>Ctrl+D</kbd><span>Deepen</span></div>
                <div className="wm-help-shortcut"><kbd>Ctrl+S</kbd><span>Save draft</span></div>
                <div className="wm-help-shortcut"><kbd>Ctrl+B</kbd><span>Toggle Contents sidebar</span></div>
                <div className="wm-help-shortcut"><kbd>Ctrl+[</kbd><span>Previous chapter</span></div>
                <div className="wm-help-shortcut"><kbd>Ctrl+]</kbd><span>Next chapter</span></div>
                <div className="wm-help-shortcut"><kbd>F11</kbd><span>Focus mode</span></div>
                <div className="wm-help-shortcut"><kbd>Esc</kbd><span>Close panel / exit mode</span></div>
              </div>
            </div>

            <div className="wm-help-section">
              <div className="wm-help-section-title">Panels</div>
              <div className="wm-help-tools">
                <div className="wm-help-tool"><strong>Chapter Plan</strong> — Set scene goal, theme, emotional arc, and POV to guide AI</div>
                <div className="wm-help-tool"><strong>{'✦'} Write</strong> — AI Writer that writes in a specific character's voice</div>
                <div className="wm-help-tool"><strong>Contents</strong> — Navigate chapters, reorder, and manage sections</div>
                <div className="wm-help-tool"><strong>Snapshots</strong> — Auto-saved before each AI action; restore any version</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
