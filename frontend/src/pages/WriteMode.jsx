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

  // Character sidebar state
  const [characters,        setCharacters]        = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [charPanelOpen,     setCharPanelOpen]     = useState(() => window.innerWidth >= 768);
  const [charLoading,       setCharLoading]       = useState(false);

  // UI state
  const [showExit,   setShowExit]   = useState(false);
  const [hint,       setHint]       = useState(null);
  const [sessionLog, setSessionLog] = useState([]);

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

  const stopListeningAndGenerate = useCallback(async () => {
    recognitionRef.current?.stop();
    setListening(false);
    const spoken = transcriptRef.current.trim();
    if (!spoken) return;
    setTranscript('');
    await generateProse(spoken);
  }, [chapter, book, prose]);

  // ── GENERATE PROSE FROM SPEECH ────────────────────────────────────────

  const generateProse = useCallback(async (spoken) => {
    setGenerating(true);
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
        }),
      });
      const data = await res.json();
      if (data.prose) {
        const newProse = prose
          ? prose.trimEnd() + '\n\n' + data.prose
          : data.prose;
        setProse(newProse);
        setWordCount(newProse.split(/\s+/).filter(Boolean).length);
        setSaved(false);
        setSessionLog(prev => [...prev, { spoken, generated: data.prose }]);
        if (data.hint) {
          setHint(data.hint);
          setTimeout(() => setHint(null), 6000);
        }
        setTimeout(() => {
          if (proseRef.current) {
            proseRef.current.scrollTop = proseRef.current.scrollHeight;
          }
        }, 100);
      }
    } catch (err) {
      console.error('voice-to-story error:', err);
    }
    setGenerating(false);
  }, [prose, chapter, book, sessionLog]);

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
  }, [prose, editNote, chapter]);

  // ── AI TOOLBAR ACTIONS ─────────────────────────────────────────────────

  const handleContinue = useCallback(async () => {
    if (!prose.trim() || generating) return;
    setAiAction('continue');
    setGenerating(true);
    setProseBeforeAi(prose);
    setNudgeText(null);
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
        }),
      });
      const data = await res.json();
      if (data.prose) {
        const newProse = prose.trimEnd() + '\n\n' + data.prose;
        setProse(newProse);
        setWordCount(newProse.split(/\s+/).filter(Boolean).length);
        setSaved(false);
        setTimeout(() => {
          if (proseRef.current) proseRef.current.scrollTop = proseRef.current.scrollHeight;
        }, 100);
      } else if (data.error) {
        setHint(data.error);
        setTimeout(() => setHint(null), 5000);
      }
    } catch (err) {
      console.error('story-continue error:', err);
    }
    setGenerating(false);
    setAiAction(null);
  }, [prose, chapter, book, generating]);

  const handleDeepen = useCallback(async () => {
    if (!prose.trim() || generating) return;
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
  }, [prose, chapter, generating]);

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

  // ── RENDER ────────────────────────────────────────────────────────────

  if (loading) return <div className="wm-load-screen">Loading...</div>;

  return (
    <div className={`wm-root${charPanelOpen ? ' wm-panel-open' : ''}`}>
      {/* ── TOP BAR ── */}
      <header className="wm-topbar">
        <button className="wm-back-btn" onClick={() => setShowExit(true)}>
          {'\u2190'}
        </button>
        <div className="wm-chapter-info">
          <div className="wm-chapter-title">{chapter?.title || 'Untitled'}</div>
          <div className="wm-book-title">{book?.title || book?.character || ''}</div>
        </div>
        <div className="wm-top-right">
          {selectedCharacter && (
            <div className="wm-active-char-pill" onClick={() => setCharPanelOpen(!charPanelOpen)}>
              <span className="wm-active-char-icon">{selectedCharacter.icon || '\uD83D\uDC64'}</span>
              <span className="wm-active-char-name">{selectedCharacter.display_name || selectedCharacter.selected_name}</span>
            </div>
          )}
          {wordCount > 0 && (
            <div className="wm-word-count">{wordCount}w</div>
          )}
          <div className="wm-save-status">
            {saving ? '\u00B7\u00B7 saving' : saved ? '' : '\u00B7 unsaved'}
          </div>
          <button
            className={`wm-char-toggle${charPanelOpen ? ' active' : ''}`}
            onClick={() => setCharPanelOpen(!charPanelOpen)}
            title="Characters"
          >
            {'\uD83D\uDC65'}
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

      {/* ── MAIN CONTENT AREA ── */}
      <div className="wm-content-row">
        {/* ── PROSE SECTION ── */}
        <div className="wm-prose-wrap" ref={proseRef}>
          <textarea
            className="wm-prose-area"
            value={prose}
            onChange={handleProseChange}
            placeholder={editMode ? '' : "Type your story here, or use the AI tools below \u2014 Continue, Deepen, Nudge."}
            spellCheck={false}
            readOnly={generating}
          />

          {generating && (
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

        {/* ── CHARACTER SIDEBAR ── */}
        <aside className={`wm-char-sidebar${charPanelOpen ? ' open' : ''}`}>
          <div className="wm-char-sidebar-header">
            <span className="wm-char-sidebar-title">Characters</span>
            <button className="wm-char-sidebar-close" onClick={() => setCharPanelOpen(false)}>{'\u00D7'}</button>
          </div>

          {/* Active voice card */}
          {selectedCharacter && (
            <div className="wm-voice-card">
              <div className="wm-voice-card-name">
                <span className="wm-voice-card-icon">{selectedCharacter.icon || '\uD83D\uDC64'}</span>
                {selectedCharacter.display_name || selectedCharacter.selected_name}
              </div>
              {selectedCharacter.character_archetype && (
                <div className="wm-voice-card-archetype">{selectedCharacter.character_archetype}</div>
              )}
              {selectedCharacter.voice_signature?.speech_pattern && (
                <div className="wm-voice-card-field">
                  <span className="wm-voice-card-label">Speech</span>
                  <span className="wm-voice-card-value">{selectedCharacter.voice_signature.speech_pattern}</span>
                </div>
              )}
              {selectedCharacter.emotional_baseline && (
                <div className="wm-voice-card-field">
                  <span className="wm-voice-card-label">Baseline</span>
                  <span className="wm-voice-card-value">{selectedCharacter.emotional_baseline}</span>
                </div>
              )}
              {selectedCharacter.signature_trait && (
                <div className="wm-voice-card-field">
                  <span className="wm-voice-card-label">Trait</span>
                  <span className="wm-voice-card-value">{selectedCharacter.signature_trait}</span>
                </div>
              )}
              {selectedCharacter.voice_signature?.vocabulary_tone && (
                <div className="wm-voice-card-field">
                  <span className="wm-voice-card-label">Tone</span>
                  <span className="wm-voice-card-value">{selectedCharacter.voice_signature.vocabulary_tone}</span>
                </div>
              )}
              {selectedCharacter.voice_signature?.catchphrases?.length > 0 && (
                <div className="wm-voice-card-field">
                  <span className="wm-voice-card-label">Catchphrases</span>
                  <span className="wm-voice-card-value">
                    {selectedCharacter.voice_signature.catchphrases.slice(0, 3).map((c, i) => (
                      <span key={i} className="wm-voice-catchphrase">{'\u201C'}{c}{'\u201D'}</span>
                    ))}
                  </span>
                </div>
              )}
              <button className="wm-voice-card-clear" onClick={() => setSelectedCharacter(null)}>
                Clear voice
              </button>
            </div>
          )}

          {/* Character list */}
          <div className="wm-char-list">
            {charLoading ? (
              <div className="wm-char-loading">Loading characters{'\u2026'}</div>
            ) : characters.length === 0 ? (
              <div className="wm-char-empty">No characters found. Create characters in the Character Registry.</div>
            ) : (
              characters.map(c => (
                <div
                  key={c.id}
                  className={`wm-char-item${selectedCharacter?.id === c.id ? ' selected' : ''}`}
                  onClick={() => setSelectedCharacter(selectedCharacter?.id === c.id ? null : c)}
                >
                  <span className="wm-char-item-icon">{c.icon || '\uD83D\uDC64'}</span>
                  <div className="wm-char-item-info">
                    <div className="wm-char-item-name">{c.display_name || c.selected_name}</div>
                    {c.story_role && <div className="wm-char-item-role">{c.story_role}</div>}
                    {c._registryTitle && <div className="wm-char-item-registry">{c._registryTitle}</div>}
                  </div>
                  {selectedCharacter?.id === c.id && (
                    <span className="wm-char-item-check">{'\u2713'}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </aside>
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
            onPointerDown={startListening}
            onPointerUp={stopListeningAndGenerate}
            onPointerLeave={listening ? stopListeningAndGenerate : undefined}
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
              ? 'Release to write'
              : generating
              ? (aiAction === 'continue' ? 'Continuing\u2026' : aiAction === 'deepen' ? 'Deepening\u2026' : 'Writing your story\u2026')
              : prose
              ? 'Hold mic to speak \u2014 or use AI tools above'
              : 'Hold to speak, or type and use AI tools'}
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
