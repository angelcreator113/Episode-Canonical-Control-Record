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
import MemoryBankView from './MemoryBankView';
import LalaSceneDetection from '../components/LalaSceneDetection';
import ExportPanel from '../components/ExportPanel';
import SceneInterview from './SceneInterview';
import NarrativeIntelligence from './NarrativeIntelligence';
import { ContinuityGuard } from './ContinuityGuard';
import { MemoryCard, MEMORY_STYLES } from './MemoryConfirmation';
import { PlantEchoButton, IncomingEchoes, EchoHealthPanel } from '../components/DecisionEchoPanel';
import BeliefTracker from '../components/BeliefTracker';
import BookQuestionLayer, { getBookQuestionContext } from '../components/BookQuestionLayer';
import CharacterAppearanceRules from '../components/CharacterAppearanceRules';
import ChapterExitEmotion from '../components/ChapterExitEmotion';
import { getLalaSessionPrompt } from '../data/lalaVoiceData';
import { getCharacterRulesPrompt } from '../data/characterAppearanceRules';

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
  { id: 'lala',      label: 'Lala'      },
  { id: 'export',    label: 'Export'    },
];

// ── MAIN COMPONENT ────────────────────────────────────────────────────────

export default function WriteMode() {
  const { bookId, chapterId } = useParams();
  const navigate = useNavigate();

  // Chapter / book state
  const [chapter,    setChapter]    = useState(null);
  const [book,       setBook]       = useState(null);
  const [allChapters, setAllChapters] = useState([]);
  const [loading,    setLoading]    = useState(true);

  // Sidebar state
  const [showToc,    setShowToc]    = useState(() => {
    const saved = localStorage.getItem('wm-show-toc');
    return saved !== null ? saved === 'true' : true;
  });
  const [showContext, setShowContext] = useState(() => {
    const saved = localStorage.getItem('wm-show-context');
    return saved !== null ? saved === 'true' : true;
  });
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

  // Voice state
  const [listening,  setListening]  = useState(false);
  const [transcript, setTranscript] = useState('');
  const [generating, setGenerating] = useState(false);
  const [micError,   setMicError]   = useState(null);

  // Edit mode state
  const [editMode,   setEditMode]   = useState(false);
  const [editNote,   setEditNote]   = useState('');
  const [editListening, setEditListening] = useState(false);
  const [editTranscript, setEditTranscript] = useState('');

  // AI toolbar state
  const [aiAction,     setAiAction]     = useState(null); // 'continue'|'deepen'|'nudge'
  const [nudgeText,    setNudgeText]    = useState(null);
  const [proseBeforeAi, setProseBeforeAi] = useState(null); // for undo
  const [genLength,    setGenLength]    = useState('paragraph'); // 'sentence'|'paragraph'
  const [streamingText, setStreamingText] = useState(''); // live text while streaming

  // Character state
  const [characters,        setCharacters]        = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [charLoading,       setCharLoading]       = useState(false);

  // UI state
  const [showExit,   setShowExit]   = useState(false);
  const [hint,       setHint]       = useState(null);
  const [sessionLog, setSessionLog] = useState([]);

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

  // History / version snapshots
  const [history,        setHistory]        = useState([]); // [{prose, label, timestamp}]
  const [showHistory,    setShowHistory]    = useState(false);

  // Quick character switch
  const [showCharQuick,  setShowCharQuick]  = useState(false);

  // ── NEW: Center tab state ──
  const [centerTab,    setCenterTab]    = useState('write');

  // ── NEW: Review tab state (from StorytellerPage) ──
  const [reviewLines,      setReviewLines]      = useState([]);
  const [editingLine,      setEditingLine]      = useState(null);
  const [editText,         setEditText]         = useState('');
  const [lastApprovedLine, setLastApprovedLine] = useState(null);
  const [reviewLoading,    setReviewLoading]    = useState(false);

  // ── NEW: Alive systems state (from StorytellerPage) ──
  const [registryCharacters, setRegistryCharacters] = useState([]);
  const [chapterCharacters,  setChapterCharacters]  = useState([]);
  const [exitEmotionData,    setExitEmotionData]    = useState({ exit_emotion: '', exit_emotion_note: '' });
  const [pnosAct,            setPnosAct]            = useState('act_1');
  const [activeThreads,      setActiveThreads]      = useState([]);
  const [incomingEchoes,     setIncomingEchoes]     = useState([]);
  const [interviewDone,      setInterviewDone]      = useState(false);

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

        // Build previous chapter summary
        const currentIdx = chapters.findIndex(c => c.id === chapterId);
        if (currentIdx > 0) {
          const prev = chapters[currentIdx - 1];
          const prevProse = prev.draft_prose?.trim();
          if (prevProse) {
            // First ~200 chars of last paragraph
            const paragraphs = prevProse.split(/\n\n+/).filter(Boolean);
            const lastPara = paragraphs[paragraphs.length - 1];
            setPrevChapterSummary({
              title: prev.title,
              excerpt: lastPara.length > 200 ? lastPara.slice(0, 200) + '…' : lastPara,
              wordCount: prevProse.split(/\s+/).filter(Boolean).length,
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

  // ── NEW: Load incoming echoes ─────────────────────────────────────────

  useEffect(() => {
    if (!chapterId || !bookId) return;
    fetch(`${API}/storyteller/echoes?book_id=${bookId}&target_chapter_id=${chapterId}`)
      .then(r => r.json())
      .then(data => setIncomingEchoes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [chapterId, bookId]);

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
      takeSnapshot('Before delete paragraph');
      const newParagraphs = paragraphs.filter((_, i) => i !== selectedParagraph);
      const newProse = newParagraphs.join('\n\n');
      setProse(newProse);
      setWordCount(newProse.split(/\s+/).filter(Boolean).length);
      setSaved(false);
      setSelectedParagraph(null);
      setParaAction(null);
      return;
    }

    takeSnapshot(`Before ${action} paragraph`);
    setGenerating(true);
    setParaAction(action);
    try {
      const res = await fetch(`${API}/memories/story-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_prose: targetPara,
          edit_note: action === 'rewrite'
            ? 'Rewrite this paragraph with better prose, keeping the same meaning and tone.'
            : 'Expand this paragraph with more sensory detail, interiority, and emotional depth. Keep the same voice.',
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
  }, [prose, selectedParagraph, generating, chapter, selectedCharacter, takeSnapshot]);

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
    } catch {}
    setSaving(false);
  }, [chapterId]);

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
            if (evt.type === 'text') {
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
      setEditTranscript(final + interim);
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
        setEditTranscript('');
        editTransRef.current = '';
      }
    } catch (err) {
      console.error('story-edit error:', err);
    }
    setGenerating(false);
  }, [prose, editNote, chapter, takeSnapshot]);

  // ── AI TOOLBAR ACTIONS ─────────────────────────────────────────────────

  const handleContinue = useCallback(async () => {
    if (!prose.trim() || generating) return;
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
          current_prose:  prose,
          chapter_title:  chapter?.title,
          chapter_brief:  chapter?.scene_goal || chapter?.chapter_notes,
          pnos_act:       chapter?.pnos_act || 'act_1',
          book_character: book?.character || 'JustAWoman',
          character_id:   selectedCharacter?.id || null,
          gen_length:     genLength,
          stream:         true,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
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
        const newProse = prose.trimEnd() + '\n\n' + fullText;
        setProse(newProse);
        setWordCount(newProse.split(/\s+/).filter(Boolean).length);
        setSaved(false);
      }
    } catch (err) {
      console.error('story-continue error:', err);
    }
    setStreamingText('');
    setGenerating(false);
    setAiAction(null);
  }, [prose, chapter, book, generating, genLength, selectedCharacter, takeSnapshot]);

  const handleDeepen = useCallback(async () => {
    if (!prose.trim() || generating) return;
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
        }),
      });
      const data = await res.json();
      if (data.prose) {
        setProse(data.prose);
        setWordCount(data.prose.split(/\s+/).filter(Boolean).length);
        setSaved(false);
      } else if (data.error) {
        setHint(data.error);
        setTimeout(() => setHint(null), 5000);
      }
    } catch (err) {
      console.error('story-deepen error:', err);
    }
    setGenerating(false);
    setAiAction(null);
  }, [prose, chapter, generating, takeSnapshot]);

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
        }),
      });
      const data = await res.json();
      if (data.nudge) {
        setNudgeText(data.nudge);
      }
    } catch (err) {
      console.error('story-nudge error:', err);
    }
    setGenerating(false);
    setAiAction(null);
  }, [prose, chapter, generating]);

  const undoAi = useCallback(() => {
    if (proseBeforeAi !== null) {
      setProse(proseBeforeAi);
      setWordCount(proseBeforeAi.split(/\s+/).filter(Boolean).length);
      setSaved(false);
      setProseBeforeAi(null);
    }
  }, [proseBeforeAi]);

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
      updateLineLocal(lineId, { status: 'approved' });
      const line = reviewLines.find(l => l.id === lineId);
      if (line) setLastApprovedLine({ ...line, status: 'approved' });
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
      updateLineLocal(editingLine, { text: editText, content: editText, status: 'edited' });
      setEditingLine(null);
      setEditText('');
    } catch {}
  };

  const approveAll = async () => {
    const pending = reviewLines.filter(l => l.status === 'pending');
    for (const ln of pending) await approveLine(ln.id);
  };

  // ── SEND TO REVIEW ────────────────────────────────────────────────────

  const sendToReview = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`${API}/storyteller/chapters/${chapterId}/save-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_prose: prose }),
      });
      // Convert paragraphs to LINE-marked format for import
      const paragraphs = prose.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      const lineMarked = paragraphs.map((p, i) => `LINE ${i + 1}\n${p}`).join('\n\n');
      await fetch(`${API}/storyteller/chapters/${chapterId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: lineMarked, mode: 'replace' }),
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
      // Escape → exit edit mode, close panels
      if (e.key === 'Escape') {
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
  }, [editMode, prose, generating, focusMode, showHistory, showGoalInput, selectedParagraph, handleContinue, handleDeepen, saveDraft, toggleFocusMode]);

  // ── TOC / CONTEXT — PERSIST TOGGLES ─────────────────────────────────

  useEffect(() => { localStorage.setItem('wm_showToc', JSON.stringify(showToc)); }, [showToc]);
  useEffect(() => { localStorage.setItem('wm_showContext', JSON.stringify(showContext)); }, [showContext]);

  // ── SWITCH CHAPTER ────────────────────────────────────────────────────

  const switchChapter = useCallback(async (targetId) => {
    if (targetId === chapterId) return;
    // auto-save current
    if (prose) await saveDraft(prose);
    navigate(`/write/${bookId}/${targetId}`);
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

  // ── TOC SECTIONS: CHANGE TYPE ─────────────────────────────────────────

  const changeSectionType = useCallback((secId, newType) => {
    setTocSections(prev => prev.map(s => s.id === secId ? { ...s, type: newType } : s));
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
                  <span>No character voice</span>
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
            <div className="wm-word-count" onClick={() => setShowGoalInput(g => !g)} title="Click to set word goal">
              {wordCount}w
              {wordGoal > 0 && (
                <span className="wm-goal-fraction">
                  {' / '}{wordGoal}
                </span>
              )}
            </div>
          )}
          <div className="wm-save-status">
            {saving ? '·· saving' : saved ? '' : '· unsaved'}
          </div>

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
        </div>
      </header>

      {/* ── WORD GOAL BAR ── */}
      {wordGoal > 0 && (
        <div className="wm-goal-bar-wrap">
          <div className="wm-goal-bar">
            <div
              className="wm-goal-fill"
              style={{ width: `${Math.min(100, ((wordCount - startingWordCountRef.current) / wordGoal) * 100)}%` }}
            />
          </div>
          <span className="wm-goal-label">
            {Math.max(0, wordCount - startingWordCountRef.current)} / {wordGoal} words this session
          </span>
        </div>
      )}

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
              localStorage.setItem('wm_word_goal', v);
            }}
            placeholder="e.g. 500"
          />
          <button className="wm-goal-input-close" onClick={() => setShowGoalInput(false)}>{'✓'}</button>
        </div>
      )}

      {/* ── MAIN HUB LAYOUT ── */}
      <div className="wm-hub-layout">

        {/* ── LEFT: TOC SIDEBAR ── */}
        {showToc && (
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

      {/* ══ WRITE TAB ══ */}
      {centerTab === 'write' && (
      <>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="wm-content-row">
        {/* ── PROSE SECTION ── */}
        <div className="wm-prose-wrap" ref={proseRef}>

          {/* Scene Interview — empty chapter */}
          {!prose.trim() && !interviewDone && (
            <div className="wm-scene-interview-wrap">
              <SceneInterview
                book={book}
                chapter={chapter}
                characters={registryCharacters}
                onComplete={() => setInterviewDone(true)}
                onSkip={() => setInterviewDone(true)}
                onLineAdded={() => { setCenterTab('review'); loadReviewLines(); }}
              />
            </div>
          )}

          {/* Alive system context layers */}
          {prose.trim() && (
            <div className="wm-alive-systems">
              <BeliefTracker
                chapter={chapter}
                onActChange={act => setPnosAct(act)}
                onThreadChange={threads => setActiveThreads(threads)}
              />
              <BookQuestionLayer
                book={book}
                chapter={chapter}
                onDirectionChange={() => {}}
              />
              <CharacterAppearanceRules
                chapterCharacters={chapterCharacters}
                onCharacterToggle={(ids) => setChapterCharacters(ids)}
              />
              <ChapterExitEmotion
                chapter={chapter}
                onExitChange={(data) => setExitEmotionData(data)}
              />
              <IncomingEchoes
                echoes={incomingEchoes}
                onMarkLanded={async (echoId) => {
                  try {
                    await fetch(`${API}/storyteller/echoes/${echoId}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'landed' }),
                    });
                    setIncomingEchoes(prev =>
                      prev.map(e => e.id === echoId ? { ...e, status: 'landed' } : e)
                    );
                  } catch {}
                }}
              />
            </div>
          )}

          {/* ── Manuscript page container ── */}
          <div className="wm-manuscript-page">

            {/* ── Running header ── */}
            <div className="wm-manuscript-header">
              <span className="wm-mh-book">{book?.title || ''}</span>
              <span className="wm-mh-chapter">
                {chapter?.chapter_number ? `Chapter ${chapter.chapter_number}` : ''}
              </span>
            </div>

            {/* ── Chapter opening ── */}
            <div className="wm-chapter-opening">
              <div className="wm-chapter-num">
                {chapter?.chapter_number
                  ? String(chapter.chapter_number).padStart(2, '0')
                  : '—'}
              </div>
              <h2 className="wm-chapter-heading">{chapter?.title || 'Untitled'}</h2>
              <div className="wm-chapter-ornament">{'❖'}</div>
            </div>

            {/* ── Section-aware writing area ── */}
            {hasSectionHeaders ? (
              <div className="wm-canvas-sections">
                {chapter.sections.map((sec, idx) => {
                  const isHeader = ['h2','h3','h4'].includes(sec.type);
                  return (
                    <div key={sec.id || idx} className="wm-cs-block">
                      {/* Section marker */}
                      {sec.type === 'divider' && (
                        <div className="wm-cs-divider"><span className="wm-cs-divider-line" /></div>
                      )}
                      {sec.type === 'h2' && (
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
              <textarea
                className="wm-prose-area"
                ref={proseTextareaRef}
                value={streamingText ? (prose ? prose.trimEnd() + '\n\n' + streamingText : streamingText) : prose}
                onChange={handleProseChange}
                placeholder={editMode ? '' : "Begin writing…"}
                spellCheck={false}
                readOnly={generating}
              />
            )}

            {/* ── Running footer ── */}
            <div className="wm-manuscript-footer">
              <span className="wm-mf-words">{wordCount > 0 ? `${wordCount.toLocaleString()} words` : ''}</span>
              <span className="wm-mf-ornament">{'—'}</span>
              <span className="wm-mf-page">
                {chapter?.chapter_number ? `Ch. ${chapter.chapter_number}` : ''}
              </span>
            </div>
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
            disabled={generating || !prose.trim()}
          >
            <span className="wm-ai-icon">{"✨"}</span> Continue
          </button>
          <button
            className={`wm-ai-btn${aiAction === 'deepen' ? ' active' : ''}`}
            onClick={handleDeepen}
            disabled={generating || !prose.trim()}
          >
            <span className="wm-ai-icon">{"🔍"}</span> Deepen
          </button>
          <button
            className={`wm-ai-btn${aiAction === 'nudge' ? ' active' : ''}`}
            onClick={handleNudge}
            disabled={generating}
          >
            <span className="wm-ai-icon">{"💡"}</span> Nudge
          </button>
          {proseBeforeAi !== null && !generating && (
            <button className="wm-ai-btn wm-undo-ai" onClick={undoAi}>
              <span className="wm-ai-icon">{"↩"}</span> Undo
            </button>
          )}
          <button
            className={`wm-len-toggle${genLength === 'sentence' ? ' sentence' : ''}`}
            onClick={() => setGenLength(g => g === 'paragraph' ? 'sentence' : 'paragraph')}
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
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
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
              ? 'Tap mic to stop & write'
              : generating
              ? (aiAction === 'continue' ? 'Continuing…' : aiAction === 'deepen' ? 'Deepening…' : 'Writing your story…')
              : prose
              ? 'Tap mic to speak — or use AI tools above'
              : 'Tap mic to speak, or type and use AI tools'}
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
          <ScenesPanel bookId={bookId} chapters={allChapters} onChaptersChange={reloadChapters} book={book} />
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

        {/* ── RIGHT: CONTEXT PANEL ── */}
        {showContext && (
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
              </div>
            </div>

            {/* ── AI WRITER TAB ── */}
            {contextTab === 'ai-writer' && (
              <WriteModeAIWriter
                chapterId={chapterId}
                bookId={bookId}
                selectedCharacter={null}
                currentProse={prose}
                chapterContext={{
                  scene_goal:          chapter?.scene_goal,
                  theme:               chapter?.theme,
                  emotional_arc_start: chapter?.emotional_state_start,
                  emotional_arc_end:   chapter?.emotional_state_end,
                  pov:                 chapter?.pov,
                }}
                onInsert={(text) => {
                  setProse(prev => prev ? prev + '\n\n' + text : text);
                }}
              />
            )}

            {/* ── CHAPTER PLAN TAB ── */}
            {contextTab === 'plan' && (<>

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
    </div>
  );
}
