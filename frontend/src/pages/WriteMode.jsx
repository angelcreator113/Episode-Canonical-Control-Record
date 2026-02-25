/**
 * WriteMode.jsx
 * frontend/src/pages/WriteMode.jsx
 *
 * Voice-first writing mode. You talk, the story appears.
 * Light theme. Mobile-first. No approve/reject while writing.
 *
 * ROUTE: /write/:bookId/:chapterId
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LoadingSkeleton from '../components/LoadingSkeleton';
import './WriteMode.css';

const API = '/api/v1';

// ── MAIN COMPONENT ────────────────────────────────────────────────────────

export default function WriteMode() {
  const { bookId, chapterId } = useParams();
  const navigate = useNavigate();

  // Chapter / book state
  const [chapter,    setChapter]    = useState(null);
  const [book,       setBook]       = useState(null);
  const [loading,    setLoading]    = useState(true);

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

  const recognitionRef  = useRef(null);
  const editRecRef      = useRef(null);
  const proseRef        = useRef(null);
  const autoSaveRef     = useRef(null);
  const transcriptRef   = useRef('');
  const editTransRef    = useRef('');

  // ── LOAD CHAPTER ─────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [chRes] = await Promise.all([
          fetch(`${API}/storyteller/books/${bookId}`),
        ]);
        const data = await chRes.json();
        const bookData = data?.book || data;
        setBook(bookData);
        const ch = bookData.chapters?.find(c => c.id === chapterId);
        setChapter(ch || { id: chapterId, title: 'Chapter' });
        // Load any existing draft prose
        if (ch?.draft_prose) {
          setProse(ch.draft_prose);
          setWordCount(ch.draft_prose.split(/\s+/).filter(Boolean).length);
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
        }).catch(() => {}); // Fire-and-forget — never block navigation
      }

      navigate(`/book/${bookId}`);
    } catch (err) {
      console.error('sendToReview error:', err);
    }
    setSaving(false);
  }, [prose, chapterId, bookId, navigate, selectedCharacter]);

  // ── PROSE EDIT (direct typing) ────────────────────────────────────────

  const handleProseChange = (e) => {
    const val = e.target.value;
    setProse(val);
    setWordCount(val.split(/\s+/).filter(Boolean).length);
    setSaved(false);
  };

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
        if (focusMode) { setFocusMode(false); return; }
        if (selectedParagraph !== null) { setSelectedParagraph(null); setParaAction(null); return; }
      }
      // F11 → toggle focus mode (prevent browser fullscreen)
      if (e.key === 'F11') {
        e.preventDefault();
        setFocusMode(f => !f);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [editMode, prose, generating, focusMode, showHistory, showGoalInput, selectedParagraph, handleContinue, handleDeepen, saveDraft]);

  // ── RENDER ────────────────────────────────────────────────────────────

  if (loading) return <div className="wm-load-screen"><LoadingSkeleton variant="editor" /></div>;

  return (
    <div className={`wm-root${focusMode ? ' wm-focus-mode' : ''}`}>
      {/* ── FOCUS MODE EXIT ── */}
      {focusMode && (
        <button className="wm-focus-exit" onClick={() => setFocusMode(false)} title="Exit focus mode (F11)">
          {'\u2715'}
        </button>
      )}

      {/* ── TOP BAR ── */}
      <header className="wm-topbar">
        <button className="wm-back-btn" onClick={() => setShowExit(true)}>
          {'\u2190'}
        </button>
        <div className="wm-chapter-info">
          <div className="wm-chapter-title">{chapter?.title || 'Untitled'}</div>
          <div className="wm-book-title">{book?.title || book?.character || ''}</div>
        </div>

        {/* ── Session timer ── */}
        <div className="wm-session-timer">
          <span className="wm-timer-icon">{'\u23F1'}</span>
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
              <span>{selectedCharacter?.icon || '\uD83D\uDC64'}</span>
              <span className="wm-quick-char-caret">{showCharQuick ? '\u25B2' : '\u25BC'}</span>
            </button>
            {showCharQuick && (
              <div className="wm-quick-char-dropdown">
                <div
                  className={`wm-quick-char-option${!selectedCharacter ? ' selected' : ''}`}
                  onClick={() => { setSelectedCharacter(null); setShowCharQuick(false); }}
                >
                  <span className="wm-quick-char-option-icon">{'\u2014'}</span>
                  <span>No character voice</span>
                </div>
                {characters.map(c => (
                  <div
                    key={c.id}
                    className={`wm-quick-char-option${selectedCharacter?.id === c.id ? ' selected' : ''}`}
                    onClick={() => { setSelectedCharacter(c); setShowCharQuick(false); }}
                  >
                    <span className="wm-quick-char-option-icon">{c.icon || '\uD83D\uDC64'}</span>
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
            {saving ? '\u00B7\u00B7 saving' : saved ? '' : '\u00B7 unsaved'}
          </div>

          <button
            className={`wm-history-btn${showHistory ? ' active' : ''}`}
            onClick={() => setShowHistory(h => !h)}
            title={`Snapshots (${history.length})`}
          >
            {'\uD83D\uDCDC'}{history.length > 0 && <span className="wm-history-badge">{history.length}</span>}
          </button>

          <button
            className={`wm-focus-btn${focusMode ? ' active' : ''}`}
            onClick={() => setFocusMode(f => !f)}
            title="Focus mode (F11)"
          >
            {focusMode ? '\u26F6' : '\u26F6'}
          </button>

          <button
            className={`wm-mode-btn${editMode ? ' active' : ''}`}
            style={{ opacity: prose.length > 10 ? 1 : 0.3 }}
            onClick={() => prose.length > 10 && setEditMode(!editMode)}
          >
            {editMode ? 'Write' : 'Edit'}
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
          <button className="wm-goal-input-close" onClick={() => setShowGoalInput(false)}>{'\u2713'}</button>
        </div>
      )}

      {/* ── MAIN CONTENT AREA ── */}
      <div className="wm-content-row">
        {/* ── PROSE SECTION ── */}
        <div className="wm-prose-wrap" ref={proseRef}>
          <textarea
            className="wm-prose-area"
            value={streamingText ? (prose ? prose.trimEnd() + '\n\n' + streamingText : streamingText) : prose}
            onChange={handleProseChange}
            placeholder={editMode ? '' : "Type your story here, or use the AI tools below \u2014 Continue, Deepen, Nudge."}
            spellCheck={false}
            readOnly={generating}
          />

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
              {'\u00B6'}
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
                        {generating && paraAction === 'rewrite' ? 'Rewriting\u2026' : '\u270E Rewrite'}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleParagraphAction('expand'); }} disabled={generating}>
                        {generating && paraAction === 'expand' ? 'Expanding\u2026' : '\u2194 Expand'}
                      </button>
                      <button className="wm-para-delete" onClick={(e) => { e.stopPropagation(); handleParagraphAction('delete'); }} disabled={generating}>
                        {'\u2717 Delete'}
                      </button>
                      <button className="wm-para-cancel" onClick={(e) => { e.stopPropagation(); setSelectedParagraph(null); setParaAction(null); }}>
                        {'\u2715'}
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
          <div className="wm-nudge-icon">{"\uD83D\uDCA1"}</div>
          <div className="wm-nudge-text">{nudgeText}</div>
          <button className="wm-nudge-close" onClick={() => setNudgeText(null)}>{"\u00D7"}</button>
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
            <span className="wm-ai-icon">{"\u2728"}</span> Continue
          </button>
          <button
            className={`wm-ai-btn${aiAction === 'deepen' ? ' active' : ''}`}
            onClick={handleDeepen}
            disabled={generating || !prose.trim()}
          >
            <span className="wm-ai-icon">{"\uD83D\uDD0D"}</span> Deepen
          </button>
          <button
            className={`wm-ai-btn${aiAction === 'nudge' ? ' active' : ''}`}
            onClick={handleNudge}
            disabled={generating}
          >
            <span className="wm-ai-icon">{"\uD83D\uDCA1"}</span> Nudge
          </button>
          {proseBeforeAi !== null && !generating && (
            <button className="wm-ai-btn wm-undo-ai" onClick={undoAi}>
              <span className="wm-ai-icon">{"\u21A9"}</span> Undo
            </button>
          )}
          <button
            className={`wm-len-toggle${genLength === 'sentence' ? ' sentence' : ''}`}
            onClick={() => setGenLength(g => g === 'paragraph' ? 'sentence' : 'paragraph')}
            title={genLength === 'sentence' ? 'Generating one sentence at a time' : 'Generating full paragraphs'}
          >
            {genLength === 'sentence' ? '1\u2009line' : '\u00B6\u2009full'}
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
              <span className="wm-ai-icon">{'\u00B6'}</span> Paragraphs
            </button>
          )}
        </div>
      )}

      {/* ── HISTORY PANEL ── */}
      {showHistory && (
        <div className="wm-history-panel">
          <div className="wm-history-header">
            <span className="wm-history-title">Snapshots</span>
            <button className="wm-history-close" onClick={() => setShowHistory(false)}>{'\u00D7'}</button>
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
                      <span className="wm-history-item-meta">{timeStr} \u00B7 {snap.wordCount}w</span>
                    </div>
                    <div className="wm-history-item-preview">
                      {snap.prose.length > 200 ? snap.prose.slice(0, 200) + '\u2026' : snap.prose}
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
                ? <span className="wm-mic-active-ring">{'\uD83C\uDF99'}</span>
                : '\uD83C\uDF99'}
            </button>
          </div>
          <button
            className="wm-apply-btn"
            style={{ opacity: editNote.trim() ? 1 : 0.35 }}
            onClick={applyEdit}
            disabled={!editNote.trim() || generating}
          >
            {generating ? 'Rewriting\u2026' : 'Apply \u2192'}
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
              ? (aiAction === 'continue' ? 'Continuing\u2026' : aiAction === 'deepen' ? 'Deepening\u2026' : 'Writing your story\u2026')
              : prose
              ? 'Tap mic to speak \u2014 or use AI tools above'
              : 'Tap mic to speak, or type and use AI tools'}
          </div>

          {prose.length > 20 && (
            <button
              className="wm-send-btn"
              onClick={sendToReview}
              disabled={saving}
            >
              {saving ? '\u2026' : '\u2192 Review'}
            </button>
          )}
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
    </div>
  );
}
