/**
 * StoryPlannerConversational.jsx
 *
 * Full-page conversational story planner.
 * Left:  Claude asks questions, you answer by voice or text.
 * Right: Live structure panel fills in as you talk.
 *
 * On Apply → writes to storyteller_chapters via PUT /api/v1/storyteller/chapters/:id
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import apiClient from '../services/api';
import './StoryPlannerConversational.css';

const API = '/api/v1';

// ── Opening message — adapts to what we already know ─────────────────────
function makeOpeningMessage(book, chapters) {
  const title   = book?.title;
  const hasChs  = chapters?.length > 0;
  const filled  = (chapters || []).filter(c => c.title || c.scene_goal || c.chapter_notes).length;

  if (title && filled > 0) {
    return {
      role: 'assistant',
      text: `Okay bestie, "${title}" is already looking like a SERVE — ${chapters.length} chapter${chapters.length > 1 ? 's' : ''} with ${filled} planned so far! Pick a chapter you want to go deeper on, or tell me what's still living rent-free in your head about this story. What part has you the most excited right now? ✨`,
      extracting: null,
    };
  }
  if (title && hasChs) {
    return {
      role: 'assistant',
      text: `"${title}" — okay I'm already obsessed with the title. You've got ${chapters.length} chapter${chapters.length > 1 ? 's' : ''} ready to go but they need the good stuff! Before we dive in, tell me: what is this book REALLY about? Not the plot — the FEELING. Like what do you want someone to carry with them after they put it down?`,
      extracting: null,
    };
  }
  if (title) {
    return {
      role: 'assistant',
      text: `"${title}" — no because I already love this?? Okay tell me everything. What pulled you to write this? What's the idea that just won't leave you alone? Give me as much or as little as you want, I'm all ears. 💅`,
      extracting: null,
    };
  }
  return {
    role: 'assistant',
    text: "Hiiii okay I'm so ready to build this book with you! Tell me — what's your story about? Not the summary, the HEART of it. Like what made you sit down and go 'I HAVE to write this'? Spill everything. ✨",
    extracting: null,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function planEmpty(chapters, book) {
  return {
    bookTitle:   book?.title || '',
    bookConcept: book?.description || '',
    theme:       book?.theme || '',
    pov:         book?.pov || '',
    tone:        book?.tone || '',
    setting:     book?.setting || '',
    conflict:    book?.conflict || '',
    stakes:      book?.stakes || '',
    parts:       [],
    chapters:    (chapters || []).map(ch => ({
      id:               ch.id,
      title:            ch.title || '',
      what:             ch.scene_goal || ch.chapter_notes || '',
      emotionalStart:   ch.emotional_state_start || '',
      emotionalEnd:     ch.emotional_state_end || '',
      characters:       Array.isArray(ch.characters_present) ? ch.characters_present : (typeof ch.characters_present === 'string' ? ch.characters_present.split(',').map(s => s.trim()).filter(Boolean) : []),
      sections:         Array.isArray(ch.sections) ? ch.sections : [],
      theme:            ch.theme || '',
      pov:              ch.pov || '',
      tone:             ch.tone || '',
      setting:          ch.setting || '',
      conflict:         ch.conflict || '',
      stakes:           ch.stakes || '',
      hooks:            ch.hooks || '',
      filled:           false,
    })),
  };
}

// ── Book health scanner — detects issues in the plan/book ────────────────
function scanBookHealth(plan, characters, book) {
  const issues = [];
  const add = (severity, category, message) => issues.push({ severity, category, message });

  // Book-level checks
  if (!plan.bookTitle)   add('warning', 'book', 'Your book doesn\'t have a title yet');
  if (!plan.bookConcept) add('warning', 'book', 'No book description or concept — readers won\'t know what it\'s about');
  if (!plan.theme)       add('info',    'book', 'Theme not defined — every great book has a central question');
  if (!plan.pov)         add('info',    'book', 'POV not set — who\'s telling this story?');
  if (!plan.tone)        add('info',    'book', 'Tone/mood not established yet');
  if (!plan.setting)     add('info',    'book', 'Setting not defined — where does this world live?');
  if (!plan.conflict)    add('warning', 'book', 'No central conflict — what\'s driving the story forward?');
  if (!plan.stakes)      add('warning', 'book', 'Stakes not defined — what happens if the protagonist fails?');

  // Chapter checks
  if (plan.chapters.length === 0) {
    add('error', 'structure', 'No chapters yet — your book needs at least one chapter');
  } else {
    const emptyChapters = plan.chapters.filter(ch => !ch.what && !ch.title);
    const noGoalChapters = plan.chapters.filter(ch => ch.title && !ch.what);
    const noEmotionChapters = plan.chapters.filter(ch => ch.what && !ch.emotionalStart && !ch.emotionalEnd);
    const noSectionsChapters = plan.chapters.filter(ch => ch.what && (!ch.sections || ch.sections.length === 0));
    const noCharChapters = plan.chapters.filter(ch => ch.what && (!ch.characters || ch.characters.length === 0));

    if (emptyChapters.length > 0)
      add('warning', 'chapters', `${emptyChapters.length} chapter${emptyChapters.length > 1 ? 's are' : ' is'} completely empty`);
    if (noGoalChapters.length > 0)
      add('warning', 'chapters', `${noGoalChapters.length} chapter${noGoalChapters.length > 1 ? 's' : ''} missing scene goals — what happens in them?`);
    if (noEmotionChapters.length > 0)
      add('info', 'chapters', `${noEmotionChapters.length} chapter${noEmotionChapters.length > 1 ? 's' : ''} missing emotional arcs`);
    if (noSectionsChapters.length > 0)
      add('info', 'chapters', `${noSectionsChapters.length} chapter${noSectionsChapters.length > 1 ? 's' : ''} have no sections defined`);
    if (noCharChapters.length > 0)
      add('info', 'chapters', `${noCharChapters.length} chapter${noCharChapters.length > 1 ? 's' : ''} don\'t list which characters appear`);
  }

  // Character checks
  if (characters.length === 0) {
    add('info', 'characters', 'No characters created yet — every story needs people');
  } else {
    const charsInChapters = new Set(plan.chapters.flatMap(ch => ch.characters || []));
    const unusedChars = characters.filter(c => !charsInChapters.has(c.selected_name || c.name));
    if (unusedChars.length > 0)
      add('info', 'characters', `${unusedChars.length} character${unusedChars.length > 1 ? 's' : ''} not assigned to any chapter yet`);
  }

  return issues;
}

// ── Severity counts helper ──────────────────────────────────────────────
function countHealthSeverity(issues) {
  return {
    errors:   issues.filter(i => i.severity === 'error').length,
    warnings: issues.filter(i => i.severity === 'warning').length,
    infos:    issues.filter(i => i.severity === 'info').length,
    total:    issues.length,
  };
}

// ── Book structure blueprint (what a complete book looks like) ────────────
const BOOK_STRUCTURE = {
  frontMatter: ['Title Page', 'Dedication', 'Epigraph', 'Table of Contents'],
  body:        'Chapters organized into Parts (optional) with sections per chapter',
  backMatter:  ['Acknowledgments', 'Glossary', 'About the Author', 'Bibliography'],
  chapterAnatomy: [
    'Title & Number',
    'Scene Goal (what happens)',
    'Emotional Arc (start → end)',
    'POV & Tone',
    'Setting & World Details',
    'Conflict & Stakes',
    'Sections (scene / reflection / transition / revelation)',
    'Hooks & Foreshadowing',
    'Characters Present',
  ],
};

function useVoiceInput() {
  const [listening,   setListening]   = useState(false);
  const [transcript,  setTranscript]  = useState('');
  const [supported,   setSupported]   = useState(false);
  const recRef = useRef(null);
  const wantListeningRef = useRef(false);
  const onResultRef = useRef(null);
  const segments = useRef([]);         // one entry per completed recognition session
  const restartCountRef = useRef(0);

  useEffect(() => {
    setSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  // Build display text: all committed segments + optional interim
  const buildText = useCallback((interim = '') => {
    return [...segments.current, interim].filter(Boolean).join(' ').trim();
  }, []);

  const startRec = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    if (recRef.current) {
      try { recRef.current.onend = null; recRef.current.abort(); } catch {}
    }

    const rec = new SR();
    // ALWAYS non-continuous: one utterance per session, auto-restart between.
    // This eliminates all duplicate-result bugs from continuous mode.
    rec.continuous     = false;
    rec.interimResults = true;
    rec.lang           = 'en-US';
    recRef.current     = rec;

    // Local flag — unique to THIS session closure. Once committed, ignore all
    // further onresult events from this session. This makes duplication
    // structurally impossible.
    let committed = false;

    rec.onresult = (e) => {
      if (committed) return;

      const last = e.results[e.results.length - 1];
      if (last.isFinal) {
        const text = last[0].transcript.trim();
        if (text) segments.current.push(text);
        committed = true;
        const full = buildText();
        setTranscript(full);
        if (onResultRef.current) onResultRef.current(full);
      } else {
        const full = buildText(last[0].transcript);
        setTranscript(full);
        if (onResultRef.current) onResultRef.current(full);
      }
      restartCountRef.current = 0;
    };

    rec.onerror = (e) => {
      if (wantListeningRef.current && (e.error === 'no-speech' || e.error === 'aborted')) {
        return; // will auto-restart via onend
      }
      console.warn('SpeechRecognition error:', e.error);
      wantListeningRef.current = false;
      setListening(false);
    };

    rec.onend = () => {
      if (wantListeningRef.current) {
        restartCountRef.current++;
        if (restartCountRef.current > 12) {
          wantListeningRef.current = false;
          setListening(false);
          return;
        }
        // Brief delay for browser cleanup before next session
        setTimeout(() => {
          if (wantListeningRef.current) {
            try { startRec(); } catch { setListening(false); wantListeningRef.current = false; }
          }
        }, 120);
        return;
      }
      setListening(false);
    };

    rec.start();
    setListening(true);
  }, [buildText]);

  // Auto-stop when screen goes off (phone sleep / lock)
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && wantListeningRef.current) {
        wantListeningRef.current = false;
        try { recRef.current?.stop(); } catch {}
        setListening(false);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const start = useCallback((onResult) => {
    onResultRef.current = onResult;
    wantListeningRef.current = true;
    segments.current = [];
    setTranscript('');
    startRec();
  }, [startRec]);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    try { recRef.current?.stop(); } catch {}
    setListening(false);
  }, []);

  return { listening, transcript, supported, start, stop, setTranscript };
}

// ── Main Component ───────────────────────────────────────────────────────

export default function StoryPlannerConversational({
  book,
  chapters = [],
  characters = [],
  onApply,
  onClose,
  toast,
  hideHeader = false,
  activeChapterId,
  chapter,
  bookId,
  chapterId,
  onChapterRefresh,
  onComplete,
}) {
  const bookKey = book?.id || 'default';

  // ── Session persistence helpers ──────────────────────────────────
  const loadSession = useCallback((key, fallback) => {
    try {
      const raw = sessionStorage.getItem(`spc_${key}_${bookKey}`);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }, [bookKey]);

  const saveSession = useCallback((key, value) => {
    try { sessionStorage.setItem(`spc_${key}_${bookKey}`, JSON.stringify(value)); } catch {}
  }, [bookKey]);

  // ── State (restored from session on mount) ───────────────────────
  const [messages,    setMessages]    = useState(() =>
    loadSession('msgs', null) || [makeOpeningMessage(book, chapters)]
  );
  const [input,       setInput]       = useState('');
  const [sending,     setSending]     = useState(false);
  const [plan,        setPlan]        = useState(() =>
    loadSession('plan', null) || planEmpty(chapters, book)
  );
  const [applying,    setApplying]    = useState(false);
  const [saved,       setSaved]       = useState(false);  // brief "Saved ✓" flash
  const [activeChIdx, setActiveChIdx] = useState(null);
  const [highlight,   setHighlight]   = useState(null);
  const [mobileTab,   setMobileTab]   = useState('chat'); // 'chat' | 'plan'
  const [approvals,   setApprovals]   = useState(() => loadSession('approvals', []));
  const [showStructure, setShowStructure] = useState(false); // toggle book structure view
  const [showHealth,    setShowHealth]    = useState(false); // toggle health report
  const [healthIssues, setHealthIssues]  = useState(() => scanBookHealth(planEmpty(chapters, book), characters, book));
  const chatRef   = useRef(null);
  const inputRef  = useRef(null);
  const rootRef   = useRef(null);
  const voice     = useVoiceInput();

  // ── Persist messages + plan to sessionStorage on change ──────────
  useEffect(() => { saveSession('msgs', messages); }, [messages, saveSession]);
  useEffect(() => { saveSession('plan', plan); },     [plan, saveSession]);
  useEffect(() => { saveSession('approvals', approvals); }, [approvals, saveSession]);

  // ── Recalculate health whenever plan or characters change ────────
  useEffect(() => {
    setHealthIssues(scanBookHealth(plan, characters, book));
  }, [plan, characters, book]);

  // ── Mobile keyboard resize: shrink root to visual viewport ───────
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      if (rootRef.current) {
        rootRef.current.style.height = `${vv.height}px`;
      }
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // Flash highlight off after 1.8s
  useEffect(() => {
    if (!highlight) return;
    const t = setTimeout(() => setHighlight(null), 1800);
    return () => clearTimeout(t);
  }, [highlight]);

  // ── Send message to Claude ────────────────────────────────────────────

  const send = useCallback(async (text) => {
    if (!text?.trim() || sending) return;
    const trimmed = text.trim();
    // Stop voice FIRST so its callback can't overwrite the cleared input
    if (voice.listening) voice.stop();
    const userMsg = { role: 'user', text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    voice.setTranscript('');
    setSending(true);

    try {
      const res = await apiClient.post(`${API}/memories/story-planner-chat`, {
        message:    trimmed,
        history:    messages.slice(-20),
        book:       { id: book?.id, title: book?.title },
        plan:       plan,
        characters: characters.map(c => ({
          id:   c.id,
          name: c.selected_name || c.name,
          type: c.type,
        })),
        approvalStatus: {
          pending:  pendingApprovals.length,
          approved: approvedCount,
          items:    approvals.filter(a => a.status !== 'dismissed').map(a => ({
            title: a.title, type: a.type, status: a.status,
          })),
        },
        healthReport: {
          issues: healthIssues,
          counts: countHealthSeverity(healthIssues),
        },
      });

      const data = res.data;

      // Update plan with extracted fields
      if (data.planUpdates && Object.keys(data.planUpdates).length > 0) {
        setPlan(prev => mergeUpdates(prev, data.planUpdates));
        if (data.planUpdates.highlightField) {
          setHighlight(data.planUpdates.highlightField);
        }
      }

      // Handle approval requests from Claude
      if (data.planUpdates?.approvals?.length) {
        setApprovals(prev => [
          ...prev,
          ...data.planUpdates.approvals.map((a, i) => ({
            ...a,
            id:        a.id || `approval-${Date.now()}-${i}`,
            status:    'pending',
            createdAt: Date.now(),
          })),
        ]);
      }

      setMessages(prev => [...prev, {
        role:       'assistant',
        text:       data.reply,
        extracting: data.planUpdates?.summary || null,
      }]);

      // Speak reply if voice was used
      if (voice.listening || data.speakReply) {
        speakText(data.reply);
      }

    } catch (err) {
      // Put user's text back so they don't lose it
      setInput(trimmed);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Connection lost — your message is still in the box. Try sending again.',
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [sending, messages, plan, book, characters, voice]);

  // ── Merge plan updates ────────────────────────────────────────────────

  function mergeUpdates(prev, updates) {
    const next = { ...prev };

    if (updates.bookTitle)   next.bookTitle   = updates.bookTitle;
    if (updates.bookConcept) next.bookConcept = updates.bookConcept;
    if (updates.theme)       next.theme       = updates.theme;
    if (updates.pov)         next.pov         = updates.pov;
    if (updates.tone)        next.tone        = updates.tone;
    if (updates.setting)     next.setting     = updates.setting;
    if (updates.conflict)    next.conflict    = updates.conflict;
    if (updates.stakes)      next.stakes      = updates.stakes;
    if (updates.parts)       next.parts       = updates.parts;

    if (updates.chapters) {
      // Update existing chapters
      next.chapters = prev.chapters.map((ch, idx) => {
        const upd = updates.chapters.find(u => u.id === ch.id || u.index === idx);
        if (!upd) return ch;
        return {
          ...ch,
          title:          upd.title          ?? ch.title,
          what:           upd.what           ?? ch.what,
          emotionalStart: upd.emotionalStart ?? ch.emotionalStart,
          emotionalEnd:   upd.emotionalEnd   ?? ch.emotionalEnd,
          characters:     upd.characters     ?? ch.characters,
          sections:       upd.sections       ?? ch.sections,
          theme:          upd.theme          ?? ch.theme,
          pov:            upd.pov            ?? ch.pov,
          tone:           upd.tone           ?? ch.tone,
          setting:        upd.setting        ?? ch.setting,
          conflict:       upd.conflict       ?? ch.conflict,
          stakes:         upd.stakes         ?? ch.stakes,
          hooks:          upd.hooks          ?? ch.hooks,
          filled:         true,
        };
      });

      // Append NEW chapters Claude suggested beyond existing count
      const existingCount = prev.chapters.length;
      const newOnes = updates.chapters.filter(u => {
        // Already matched an existing chapter by id or index?
        const matched = prev.chapters.some((ch, idx) => u.id === ch.id || u.index === idx);
        return !matched && (u.index >= existingCount || (!u.id && u.index === undefined));
      });
      for (const nu of newOnes) {
        next.chapters.push({
          id:             null,  // will be created on Apply
          title:          nu.title || `Chapter ${next.chapters.length + 1}`,
          what:           nu.what || '',
          emotionalStart: nu.emotionalStart || '',
          emotionalEnd:   nu.emotionalEnd || '',
          characters:     nu.characters || [],
          sections:       nu.sections || [],
          theme:          nu.theme || '',
          pov:            nu.pov || '',
          tone:           nu.tone || '',
          setting:        nu.setting || '',
          conflict:       nu.conflict || '',
          stakes:         nu.stakes || '',
          hooks:          nu.hooks || '',
          filled:         true,
          _isNew:         true,
        });
      }
    }

    return next;
  }

  // ── TTS ───────────────────────────────────────────────────────────────

  function speakText(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.05;
    window.speechSynthesis.speak(utt);
  }

  // ── Apply plan to chapters ────────────────────────────────────────────

  const applyPlan = useCallback(async () => {
    setApplying(true);
    let saved = 0;
    try {
      // Save book-level fields (title, description, theme, pov, tone, setting, conflict, stakes) if changed
      if (book?.id && (plan.bookTitle || plan.bookConcept || plan.theme || plan.pov || plan.tone || plan.setting || plan.conflict || plan.stakes)) {
        const bookUpdates = {};
        if (plan.bookTitle)   bookUpdates.title       = plan.bookTitle;
        if (plan.bookConcept) bookUpdates.description  = plan.bookConcept;
        if (plan.theme)       bookUpdates.theme        = plan.theme;
        if (plan.pov)         bookUpdates.pov          = plan.pov;
        if (plan.tone)        bookUpdates.tone         = plan.tone;
        if (plan.setting)     bookUpdates.setting      = plan.setting;
        if (plan.conflict)    bookUpdates.conflict     = plan.conflict;
        if (plan.stakes)      bookUpdates.stakes       = plan.stakes;
        await apiClient.put(`${API}/storyteller/books/${book.id}`, bookUpdates);
      }

      // Save chapter-level fields
      for (const ch of plan.chapters) {
        if (!ch.filled && !ch.title) continue;

        const chapterBody = {
          title:                 ch.title          || undefined,
          scene_goal:            ch.what           || undefined,
          emotional_state_start: ch.emotionalStart || undefined,
          emotional_state_end:   ch.emotionalEnd   || undefined,
          characters_present:    ch.characters?.join(', ') || undefined,
          theme:                 ch.theme || plan.theme || undefined,
          pov:                   ch.pov   || plan.pov   || undefined,
          tone:                  ch.tone  || plan.tone  || undefined,
          setting:               ch.setting  || undefined,
          conflict:              ch.conflict || undefined,
          stakes:                ch.stakes   || undefined,
          hooks:                 ch.hooks    || undefined,
          sections:              ch.sections?.length ? ch.sections : undefined,
          // Build chapter_notes as a richer summary combining plan details
          chapter_notes:         [
            ch.what,
            ch.emotionalStart && ch.emotionalEnd ? `Emotional arc: ${ch.emotionalStart} → ${ch.emotionalEnd}` : null,
            ch.characters?.length ? `Characters: ${ch.characters.join(', ')}` : null,
            ch.theme || plan.theme ? `Theme: ${ch.theme || plan.theme}` : null,
            ch.pov || plan.pov ? `POV: ${ch.pov || plan.pov}` : null,
            ch.tone || plan.tone ? `Tone: ${ch.tone || plan.tone}` : null,
            ch.setting ? `Setting: ${ch.setting}` : null,
            ch.conflict ? `Conflict: ${ch.conflict}` : null,
            ch.stakes ? `Stakes: ${ch.stakes}` : null,
            ch.hooks ? `Hooks: ${ch.hooks}` : null,
          ].filter(Boolean).join(' | ') || undefined,
        };

        if (ch._isNew || !ch.id) {
          // CREATE new chapter via POST
          const createRes = await apiClient.post(`${API}/storyteller/books/${book.id}/chapters`, {
            title:          chapterBody.title || `Chapter ${saved + 1}`,
            chapter_number: plan.chapters.indexOf(ch) + 1,
          });
          const createData = createRes.data;
          if (createData.chapter?.id) {
            // Now update with all fields
            ch.id = createData.chapter.id;
            await apiClient.put(`${API}/storyteller/chapters/${ch.id}`, chapterBody);
          }
        } else {
          // UPDATE existing chapter via PUT
          await apiClient.put(`${API}/storyteller/chapters/${ch.id}`, chapterBody);
        }
        saved++;
      }
      toast?.add(`Plan saved — ${saved} chapter${saved !== 1 ? 's' : ''} updated`, 'success');
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
      onApply?.();
      // Auto-transition to WriteMode after plan is saved
      onComplete?.();
    } catch {
      toast?.add('Error saving plan', 'error');
    } finally {
      setApplying(false);
    }
  }, [plan, book, onApply, onComplete, toast]);

  // ── Voice toggle ──────────────────────────────────────────────────────

  const toggleVoice = () => {
    if (voice.listening) {
      voice.stop();
      // If there's text, send it immediately rather than leaving it in the box
      const text = voice.transcript.trim() || input.trim();
      if (text) {
        send(text);
      }
    } else {
      // Cancel any TTS so it doesn't fight the mic
      window.speechSynthesis?.cancel();
      voice.start((t) => setInput(t));
    }
  };

  // ── Clear / restart conversation ──────────────────────────────────────
  const clearChat = () => {
    setMessages([makeOpeningMessage(book, chapters)]);
    setPlan(planEmpty(chapters, book));
    setInput('');
    setActiveChIdx(null);
    setApprovals([]);
    window.speechSynthesis?.cancel();
  };

  // ── Approval workflow ─────────────────────────────────────────────────

  const approveItem = useCallback((approvalId) => {
    setApprovals(prev => {
      const item = prev.find(a => a.id === approvalId);
      if (!item) return prev;
      // Merge the approved content into the plan
      if (item.content) {
        setPlan(p => mergeUpdates(p, item.content));
      }
      return prev.map(a => a.id === approvalId ? { ...a, status: 'approved' } : a);
    });
    toast?.add('Approved! Changes applied to your plan.', 'success');
  }, [toast]);

  const dismissItem = useCallback((approvalId) => {
    setApprovals(prev => prev.map(a => a.id === approvalId ? { ...a, status: 'dismissed' } : a));
  }, []);

  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  const approvedCount    = approvals.filter(a => a.status === 'approved').length;

  // ── Quick-action buttons ──────────────────────────────────────────────

  const generateTOC = useCallback(() => {
    if (sending) return;
    const chapterList = plan.chapters.map((ch, i) =>
      `${i + 1}. "${ch.title || 'Untitled'}"${ch.sections?.length ? ` (${ch.sections.length} sections)` : ''}`
    ).join(', ');
    send(`Based on our current plan, can you create a Table of Contents and book index for me? Here are the chapters so far: ${chapterList}. Propose it as something I can approve!`);
  }, [sending, send, plan.chapters]);

  const generateDescription = useCallback(() => {
    if (sending) return;
    const context = [
      plan.bookTitle && `Title: "${plan.bookTitle}"`,
      plan.bookConcept && `Current concept: ${plan.bookConcept}`,
      plan.theme && `Theme: ${plan.theme}`,
      plan.conflict && `Conflict: ${plan.conflict}`,
    ].filter(Boolean).join('. ');
    send(`Can you write me a compelling book description/synopsis that I can put on the back cover? ${context ? `Here's what we have: ${context}.` : ''} Give me a few options I can approve or edit!`);
  }, [sending, send, plan]);

  const generateBookLayout = useCallback(() => {
    if (sending) return;
    send(`Based on everything we've discussed, can you propose a complete book layout for me to approve? Include front matter, chapter structure, and back matter. Show me exactly how the book should be organized from cover to cover!`);
  }, [sending, send]);

  // ── Suggest name / rename helpers ─────────────────────────────────────

  const suggestBookTitle = useCallback(() => {
    if (sending) return;
    const context = plan.bookConcept ? ` (it's about: ${plan.bookConcept})` : '';
    send(`Can you suggest some book title ideas based on what we've discussed so far?${context} Give me a few options with different vibes!`);
  }, [sending, send, plan.bookConcept]);

  const suggestChapterTitle = useCallback((ch, idx) => {
    if (sending) return;
    const label = ch.title || `Chapter ${idx + 1}`;
    const context = ch.what ? ` Here's what happens: ${ch.what}` : '';
    send(`Help me come up with a better title for ${label}!${context} Pitch me some ideas!`);
  }, [sending, send]);

  const suggestSectionTitle = useCallback((section, ch, chIdx) => {
    if (sending) return;
    const chLabel = ch.title || `Chapter ${chIdx + 1}`;
    const secLabel = section.title || section.content || 'this section';
    send(`In "${chLabel}", can you suggest a better name for the section called "${secLabel}"? Make it hit!`);
  }, [sending, send]);

  const brainstormPlots = useCallback(() => {
    if (sending) return;
    const charNames = characters.map(c => c.selected_name || c.name).filter(Boolean);
    const charList = charNames.length > 0 ? ` My characters so far: ${charNames.join(', ')}.` : '';
    send(`Okay bestie I need your brain — can you brainstorm some plot ideas and dramatic storylines for my story?${charList} Give me the messy, dramatic, page-turner kind of ideas!`);
  }, [sending, send, characters]);

  // ── Check my book — send health report to Claude for diagnosis ────
  const checkMyBook = useCallback(() => {
    if (sending) return;
    const counts = countHealthSeverity(healthIssues);
    const issueList = healthIssues.map(i =>
      `[${i.severity.toUpperCase()}] ${i.category}: ${i.message}`
    ).join('\n');
    send(`Hey bestie, can you check my book for anything that's broken, missing, or needs attention? Here's what the health scanner found:\n\n${counts.total > 0 ? issueList : 'Everything looks clean!'}\n\nGive me your honest take — what should I fix first?`);
  }, [sending, send, healthIssues]);

  // ── Edit a sent message — reloads it into the input ──────────────────

  const editMessage = useCallback((msgIndex) => {
    if (sending) return;
    const msg = messages[msgIndex];
    if (!msg || msg.role !== 'user') return;
    // Put the text back in the input
    setInput(msg.text);
    // Remove this message and everything after it (including Claude's reply)
    setMessages(prev => prev.slice(0, msgIndex));
    // Focus the input so they can edit immediately
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [sending, messages]);

  // ── Handle key ───────────────────────────────────────────────────────

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };
  // ── Focus on a chapter — tell Claude we're working on it ───────────

  const focusChapter = useCallback((ch, idx) => {
    if (sending) return;
    setActiveChIdx(idx);
    setMobileTab('chat'); // switch to chat on mobile
    const label = ch.title || `Chapter ${idx + 1}`;
    const hasContent = ch.what || ch.emotionalStart || ch.characters?.length;
    const msg = hasContent
      ? `Okay let's go deeper on "${label}" — what else should I know about this chapter? Give me the tea! ☕`
      : `Alright let's figure out "${label}"! What happens in this chapter? Set the scene for me. ✨`;
    send(msg);
  }, [sending, send]);

  // ── Focus on a section within a chapter ─────────────────────────

  const focusSection = useCallback((section, ch, chIdx) => {
    if (sending) return;
    setMobileTab('chat'); // switch to chat on mobile
    const chLabel = ch.title || `Chapter ${chIdx + 1}`;
    const secLabel = section.title || section.content || 'this section';
    send(`Okay in "${chLabel}", let's talk about "${secLabel}" — what's the vibe here? What goes down? 🎬`);
  }, [sending, send]);
  // ── Filled chapters count ─────────────────────────────────────────────

  const filledCount  = plan.chapters.filter(c => c.filled || c.title).length;
  const totalCount   = plan.chapters.length;
  const planProgress = totalCount > 0 ? (filledCount / totalCount) * 100 : 0;

  // ── RENDER ────────────────────────────────────────────────────────────

  return (
    <div className="spc-root" ref={rootRef}>

      {/* ── HEADER ── */}
      {!hideHeader && (
        <header className="spc-header">
          <div className="spc-header-left">
            <span className="spc-header-title">Story Planner</span>
            <span className="spc-header-book">{book?.title || 'Untitled'}</span>
          </div>
          <div className="spc-header-right">
            <button
              className={`spc-save-btn${saved ? ' spc-save-btn--saved' : ''}`}
              onClick={applyPlan}
              disabled={applying}
            >
              {applying ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
            </button>
            <button
              className="spc-clear-btn"
              onClick={clearChat}
              title="Start a new conversation"
            >
              ↻
            </button>
            <button className="spc-close-btn" onClick={onClose}>✕</button>
          </div>
        </header>
      )}

      {/* ── MOBILE TAB BAR ── */}
      <div className="spc-mobile-tabs">
        <button
          className={`spc-mobile-tab${mobileTab === 'chat' ? ' active' : ''}`}
          onClick={() => setMobileTab('chat')}
        >
          Chat
        </button>
        <button
          className={`spc-mobile-tab${mobileTab === 'plan' ? ' active' : ''}`}
          onClick={() => setMobileTab('plan')}
        >
          Plan {filledCount > 0 ? `(${filledCount})` : ''}
        </button>
      </div>

      {/* ── PROGRESS BAR ── */}
      <div className="spc-progress-bar">
        <div className="spc-progress-fill" style={{ width: `${planProgress}%` }} />
      </div>

      {/* ── SPLIT BODY ── */}
      <div className="spc-body">

        {/* ═══ LEFT: CONVERSATION ═══ */}
        <div className={`spc-chat-col${mobileTab === 'chat' ? ' spc-mobile-show' : ' spc-mobile-hide'}`}>

          <div className="spc-chat-messages" ref={chatRef}>
            {messages.map((msg, i) => (
              <div key={i} className={`spc-msg spc-msg--${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="spc-msg-avatar">✦</div>
                )}
                <div className="spc-msg-body">
                  <p className="spc-msg-text">{msg.text}</p>
                  {msg.extracting && (
                    <div className="spc-msg-extracted">
                      <span className="spc-extracted-dot" />
                      {msg.extracting}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && !sending && (
                  <button
                    className="spc-msg-edit-btn"
                    onClick={() => editMessage(i)}
                    title="Edit this message"
                  >
                    ✎
                  </button>
                )}
              </div>
            ))}
            {sending && (
              <div className="spc-msg spc-msg--assistant">
                <div className="spc-msg-avatar">✦</div>
                <div className="spc-msg-body spc-thinking">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>

          {/* Context header (when inside ChapterJourney) */}
          {hideHeader && (
            <div className="spc-context-header">
              <span className="spc-context-icon">✦</span>
              <span className="spc-context-title">Planning Assistant</span>
              {activeChIdx !== null && plan.chapters[activeChIdx] && (
                <span className="spc-context-focus">
                  Focus: Ch {String(activeChIdx + 1).padStart(2, '0')} — {plan.chapters[activeChIdx].title || 'Untitled'}
                </span>
              )}
              <button
                className="spc-context-clear"
                onClick={clearChat}
                title="Start a new conversation"
              >↻</button>
            </div>
          )}

          {/* Input row */}
          <div className="spc-input-row">
            {voice.listening && (
              <div className="spc-voice-preview">
                <span className="spc-voice-dot" />
                Listening…
              </div>
            )}
            <div className="spc-input-wrap">
              <textarea
                ref={inputRef}
                className="spc-input"
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  if (voice.listening) voice.stop();
                }}
                onKeyDown={handleKey}
                placeholder={activeChIdx !== null
                  ? `Tell me about ${plan.chapters[activeChIdx]?.title || 'this chapter'}…`
                  : 'Describe your vision, or use the mic…'}
                rows={1}
                disabled={sending}
              />
              <div className="spc-input-actions">
                {voice.supported && (
                  <button
                    className={`spc-mic-btn${voice.listening ? ' listening' : ''}`}
                    onClick={toggleVoice}
                    title={voice.listening ? 'Stop recording' : 'Speak your answer'}
                  >
                    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                      <rect x="8" y="2" width="8" height="13" rx="4"
                        fill={voice.listening ? '#FAF7F0' : '#2F2A26'} />
                      <path d="M5 11c0 3.87 2.69 7 7 7s7-3.13 7-7"
                        stroke={voice.listening ? '#FAF7F0' : '#2F2A26'}
                        strokeWidth="1.8" strokeLinecap="round" fill="none"/>
                      <line x1="12" y1="18" x2="12" y2="21"
                        stroke={voice.listening ? '#FAF7F0' : '#2F2A26'}
                        strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
                <button
                  className="spc-send-btn"
                  onClick={() => send(input)}
                  disabled={sending || !input.trim()}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: LIVE STRUCTURE PANEL ═══ */}
        <div className={`spc-plan-col${mobileTab === 'plan' ? ' spc-mobile-show' : ' spc-mobile-hide'}`}>

          {/* Book concept */}
          <div className={`spc-plan-section${highlight === 'bookTitle' || highlight === 'bookConcept' || highlight === 'theme' || highlight === 'pov' || highlight === 'tone' || highlight === 'setting' || highlight === 'conflict' || highlight === 'stakes' ? ' spc-plan-section--flash' : ''}`}>
            <div className="spc-plan-section-label">Book</div>
            <div className="spc-plan-book-title-row">
              <div className="spc-plan-book-title">
                {plan.bookTitle || <span className="spc-plan-empty">Title not yet named…</span>}
              </div>
              <button
                className="spc-suggest-btn"
                onClick={suggestBookTitle}
                disabled={sending}
                title="Ask Claude to suggest a book title"
              >✦ Suggest title</button>
            </div>
            {plan.bookConcept && (
              <p className="spc-plan-concept">{plan.bookConcept}</p>
            )}
            {(plan.theme || plan.pov || plan.tone || plan.setting || plan.conflict || plan.stakes) && (
              <div className="spc-plan-book-meta">
                {plan.theme && (
                  <div className="spc-plan-ch-field">
                    <span className="spc-plan-ch-field-label">Theme</span>
                    <span className="spc-plan-ch-field-val">{plan.theme}</span>
                  </div>
                )}
                {plan.pov && (
                  <div className="spc-plan-ch-field">
                    <span className="spc-plan-ch-field-label">POV</span>
                    <span className="spc-plan-ch-field-val">{plan.pov}</span>
                  </div>
                )}
                {plan.tone && (
                  <div className="spc-plan-ch-field">
                    <span className="spc-plan-ch-field-label">Tone</span>
                    <span className="spc-plan-ch-field-val">{plan.tone}</span>
                  </div>
                )}
                {plan.setting && (
                  <div className="spc-plan-ch-field">
                    <span className="spc-plan-ch-field-label">World</span>
                    <span className="spc-plan-ch-field-val">{plan.setting}</span>
                  </div>
                )}
                {plan.conflict && (
                  <div className="spc-plan-ch-field">
                    <span className="spc-plan-ch-field-label">Conflict</span>
                    <span className="spc-plan-ch-field-val">{plan.conflict}</span>
                  </div>
                )}
                {plan.stakes && (
                  <div className="spc-plan-ch-field">
                    <span className="spc-plan-ch-field-label">Stakes</span>
                    <span className="spc-plan-ch-field-val">{plan.stakes}</span>
                  </div>
                )}
              </div>
            )}
            <div className="spc-plan-actions-row">
              <button
                className="spc-action-btn"
                onClick={brainstormPlots}
                disabled={sending}
                title="Ask Claude to brainstorm plot ideas for your characters"
              >✦ Brainstorm plots</button>
              <button
                className="spc-action-btn"
                onClick={generateTOC}
                disabled={sending}
                title="Generate a Table of Contents from your current plan"
              >📑 Generate TOC</button>
              <button
                className="spc-action-btn"
                onClick={generateDescription}
                disabled={sending}
                title="Have Claude write a book description/synopsis"
              >✏️ Description</button>
              <button
                className="spc-action-btn"
                onClick={generateBookLayout}
                disabled={sending}
                title="Get a full book layout proposal to approve"
              >📐 Book layout</button>
              <button
                className={`spc-action-btn spc-action-btn--outline${showStructure ? ' active' : ''}`}
                onClick={() => setShowStructure(s => !s)}
                title="Show/hide the standard book structure template"
              >🏗️ Structure</button>
              <button
                className={`spc-action-btn spc-action-btn--health${healthIssues.length > 0 ? ' has-issues' : ''}`}
                onClick={checkMyBook}
                disabled={sending}
                title="Ask your assistant to check your book for issues"
              >🩺 Check my book{healthIssues.length > 0 ? ` (${healthIssues.length})` : ''}</button>
              <button
                className={`spc-action-btn spc-action-btn--outline${showHealth ? ' active' : ''}`}
                onClick={() => setShowHealth(s => !s)}
                title="Show/hide the book health report"
              >📋 Health report</button>
            </div>
          </div>

          {/* Health Report (toggle) */}
          {showHealth && (
            <div className="spc-plan-section spc-health-report">
              <div className="spc-plan-section-label">
                Book Health Report
                {healthIssues.length > 0 && (
                  <span className="spc-health-count">{healthIssues.length}</span>
                )}
              </div>
              {healthIssues.length === 0 ? (
                <div className="spc-health-clean">
                  <span className="spc-health-clean-icon">✓</span>
                  <span>Everything looks great! No issues found.</span>
                </div>
              ) : (
                <div className="spc-health-issues">
                  {healthIssues.map((issue, i) => (
                    <div key={i} className={`spc-health-issue spc-health-issue--${issue.severity}`}>
                      <span className="spc-health-issue-icon">
                        {issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵'}
                      </span>
                      <span className="spc-health-issue-category">{issue.category}</span>
                      <span className="spc-health-issue-msg">{issue.message}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="spc-health-permissions">
                <div className="spc-health-permissions-title">What your assistant can do:</div>
                <div className="spc-health-perm spc-health-perm--auto">✅ Auto-apply: theme, POV, tone, setting, chapter fields, section tweaks</div>
                <div className="spc-health-perm spc-health-perm--approval">🔔 Needs your OK: book layout, TOC, descriptions, major restructuring, new characters</div>
                <div className="spc-health-perm spc-health-perm--diagnose">🔍 Can diagnose: missing content, structure gaps, character issues, emotional arcs</div>
                <div className="spc-health-perm spc-health-perm--suggest">💡 Can suggest: fixes for broken areas, plot ideas, name ideas, next steps</div>
                <div className="spc-health-perm spc-health-perm--no">🚫 Cannot: delete chapters, delete characters, change published status</div>
              </div>
            </div>
          )}

          {/* Book Structure Blueprint (toggle) */}
          {showStructure && (
            <div className="spc-plan-section spc-structure-blueprint">
              <div className="spc-plan-section-label">Book Structure Blueprint</div>
              <div className="spc-structure-group">
                <span className="spc-structure-label">Front Matter</span>
                <div className="spc-structure-items">
                  {BOOK_STRUCTURE.frontMatter.map((item, i) => (
                    <span key={i} className="spc-structure-item">{item}</span>
                  ))}
                </div>
              </div>
              <div className="spc-structure-group">
                <span className="spc-structure-label">Body</span>
                <p className="spc-structure-body-desc">{BOOK_STRUCTURE.body}</p>
              </div>
              <div className="spc-structure-group">
                <span className="spc-structure-label">Chapter Anatomy</span>
                <div className="spc-structure-items">
                  {BOOK_STRUCTURE.chapterAnatomy.map((item, i) => (
                    <span key={i} className="spc-structure-item spc-structure-item--anatomy">{item}</span>
                  ))}
                </div>
              </div>
              <div className="spc-structure-group">
                <span className="spc-structure-label">Back Matter</span>
                <div className="spc-structure-items">
                  {BOOK_STRUCTURE.backMatter.map((item, i) => (
                    <span key={i} className="spc-structure-item">{item}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Pending Approvals */}
          {pendingApprovals.length > 0 && (
            <div className="spc-plan-section spc-approvals-section">
              <div className="spc-plan-section-label">
                Needs Your Approval
                <span className="spc-approval-count">{pendingApprovals.length}</span>
              </div>
              {pendingApprovals.map(item => (
                <div key={item.id} className="spc-approval-card">
                  <div className="spc-approval-type">{item.type?.replace(/_/g, ' ')}</div>
                  <div className="spc-approval-title">{item.title}</div>
                  {item.summary && (
                    <p className="spc-approval-summary">{item.summary}</p>
                  )}
                  {item.details && (
                    <div className="spc-approval-details">
                      {typeof item.details === 'string'
                        ? <p>{item.details}</p>
                        : <pre className="spc-approval-pre">{JSON.stringify(item.details, null, 2)}</pre>
                      }
                    </div>
                  )}
                  <div className="spc-approval-actions">
                    <button
                      className="spc-approval-btn spc-approval-btn--approve"
                      onClick={() => approveItem(item.id)}
                    >✓ Approve</button>
                    <button
                      className="spc-approval-btn spc-approval-btn--edit"
                      onClick={() => {
                        setMobileTab('chat');
                        send(`I want to edit this proposal: "${item.title}". Here's what I'd like to change:`);
                      }}
                    >✎ Edit</button>
                    <button
                      className="spc-approval-btn spc-approval-btn--dismiss"
                      onClick={() => dismissItem(item.id)}
                    >✕ Skip</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Approved items badge */}
          {approvedCount > 0 && (
            <div className="spc-approved-badge">
              ✓ {approvedCount} item{approvedCount !== 1 ? 's' : ''} approved
            </div>
          )}

          {/* Parts (if any) */}
          {plan.parts?.length > 0 && (
            <div className={`spc-plan-section${highlight === 'parts' ? ' spc-plan-section--flash' : ''}`}>
              <div className="spc-plan-section-label">Structure</div>
              {plan.parts.map((part, pi) => (
                <div key={pi} className="spc-plan-part">
                  <span className="spc-plan-part-label">Part {pi + 1}</span>
                  <span className="spc-plan-part-title">{part.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* Chapters */}
          <div className="spc-plan-section spc-plan-chapters-section">
            <div className="spc-plan-section-label">
              Chapters
              <span className="spc-plan-chapter-count">{filledCount}/{totalCount}</span>
            </div>
            <div className="spc-plan-chapters">
              {plan.chapters.map((ch, i) => (
                <div
                  key={ch.id}
                  className={`spc-plan-chapter${ch.filled ? ' filled' : ''}${activeChIdx === i ? ' active' : ''}${highlight === `chapter-${i}` ? ' flash' : ''}${activeChapterId && ch.id === activeChapterId ? ' spc-ch-current' : ''}`}
                  onClick={() => setActiveChIdx(activeChIdx === i ? null : i)}
                >
                  <div className="spc-plan-ch-header">
                    <span className="spc-plan-ch-num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="spc-plan-ch-title">
                      {ch.title || <span className="spc-plan-empty">Chapter {i + 1}</span>}
                    </span>
                    {ch.filled && <span className="spc-plan-ch-dot" />}
                    <span className="spc-plan-ch-status">
                      {ch.filled ? 'Ready' : ch.what?.trim() ? 'Draft' : ''}
                    </span>
                    <button
                      className="spc-suggest-btn spc-suggest-btn--sm"
                      title="Suggest a chapter title"
                      onClick={(e) => { e.stopPropagation(); suggestChapterTitle(ch, i); }}
                      disabled={sending}
                    >✦</button>
                    <button
                      className="spc-plan-ch-focus-btn"
                      title={`Work on ${ch.title || 'Chapter ' + (i + 1)}`}
                      onClick={(e) => { e.stopPropagation(); focusChapter(ch, i); }}
                    >
                      ▶
                    </button>
                  </div>

                  {/* Expanded detail */}
                  {activeChIdx === i && (
                    <div className="spc-plan-ch-detail">
                      {ch.what && (
                        <div className="spc-plan-ch-field">
                          <span className="spc-plan-ch-field-label">What happens</span>
                          <span className="spc-plan-ch-field-val">{ch.what}</span>
                        </div>
                      )}
                      {(ch.emotionalStart || ch.emotionalEnd) && (
                        <div className="spc-plan-ch-field">
                          <span className="spc-plan-ch-field-label">Emotional arc</span>
                          <span className="spc-plan-ch-field-val">
                            {ch.emotionalStart}
                            {ch.emotionalStart && ch.emotionalEnd ? ' → ' : ''}
                            {ch.emotionalEnd}
                          </span>
                        </div>
                      )}
                      {ch.characters?.length > 0 && (
                        <div className="spc-plan-ch-field">
                          <span className="spc-plan-ch-field-label">Characters</span>
                          <div className="spc-plan-ch-chars">
                            {ch.characters.map((c, ci) => (
                              <span key={ci} className="spc-plan-ch-char">{c}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {(ch.theme || plan.theme) && (
                        <div className="spc-plan-ch-field">
                          <span className="spc-plan-ch-field-label">Theme</span>
                          <span className="spc-plan-ch-field-val">{ch.theme || plan.theme}</span>
                        </div>
                      )}
                      {(ch.pov || plan.pov) && (
                        <div className="spc-plan-ch-field">
                          <span className="spc-plan-ch-field-label">POV</span>
                          <span className="spc-plan-ch-field-val">{ch.pov || plan.pov}</span>
                        </div>
                      )}
                      {(ch.tone || plan.tone) && (
                        <div className="spc-plan-ch-field">
                          <span className="spc-plan-ch-field-label">Tone</span>
                          <span className="spc-plan-ch-field-val">{ch.tone || plan.tone}</span>
                        </div>
                      )}
                      {ch.setting && (
                        <div className="spc-plan-ch-field">
                          <span className="spc-plan-ch-field-label">Setting</span>
                          <span className="spc-plan-ch-field-val">{ch.setting}</span>
                        </div>
                      )}
                      {ch.conflict && (
                        <div className="spc-plan-ch-field">
                          <span className="spc-plan-ch-field-label">Conflict</span>
                          <span className="spc-plan-ch-field-val">{ch.conflict}</span>
                        </div>
                      )}
                      {ch.stakes && (
                        <div className="spc-plan-ch-field">
                          <span className="spc-plan-ch-field-label">Stakes</span>
                          <span className="spc-plan-ch-field-val">{ch.stakes}</span>
                        </div>
                      )}
                      {ch.hooks && (
                        <div className="spc-plan-ch-field">
                          <span className="spc-plan-ch-field-label">Hooks</span>
                          <span className="spc-plan-ch-field-val">{ch.hooks}</span>
                        </div>
                      )}
                      {ch.sections?.length > 0 && (
                        <div className="spc-plan-ch-field">
                          <span className="spc-plan-ch-field-label">Sections</span>
                          {ch.sections.map((s, si) => (
                            <div
                              key={si}
                              className="spc-plan-ch-section spc-plan-ch-section--clickable"
                              onClick={(e) => { e.stopPropagation(); focusSection(s, ch, i); }}
                              title="Work on this section"
                            >
                              <span className="spc-plan-ch-section-num">{si + 1}</span>
                              <span>{s.title || s.content}</span>
                              <button
                                className="spc-suggest-btn spc-suggest-btn--xs"
                                title="Suggest section name"
                                onClick={(e) => { e.stopPropagation(); suggestSectionTitle(s, ch, i); }}
                                disabled={sending}
                              >✦</button>
                              <span className="spc-plan-ch-section-go">▶</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {!ch.what && !ch.emotionalStart && !ch.characters?.length && (
                        <p className="spc-plan-ch-empty">Tell me about this chapter…</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>{/* end spc-plan-col */}
      </div>{/* end spc-body */}
    </div>
  );
}
