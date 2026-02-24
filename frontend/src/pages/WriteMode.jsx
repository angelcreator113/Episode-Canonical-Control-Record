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
      navigate(`/storyteller?book=${bookId}&chapter=${chapterId}`);
    } catch (err) {
      console.error('sendToReview error:', err);
    }
    setSaving(false);
  }, [prose, chapterId, bookId, navigate]);

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
    <div className="wm-root">
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
          {wordCount > 0 && (
            <div className="wm-word-count">{wordCount}w</div>
          )}
          <div className="wm-save-status">
            {saving ? '\u00B7\u00B7 saving' : saved ? '' : '\u00B7 unsaved'}
          </div>
          <button
            className={`wm-mode-btn${editMode ? ' active' : ''}`}
            style={{ opacity: prose.length > 10 ? 1 : 0.3 }}
            onClick={() => prose.length > 10 && setEditMode(!editMode)}
          >
            {editMode ? 'Write' : 'Edit'}
          </button>
        </div>
      </header>

      {/* ── PROSE AREA ── */}
      <div className="wm-prose-wrap" ref={proseRef}>
        <textarea
          className="wm-prose-area"
          value={prose}
          onChange={handleProseChange}
          placeholder={editMode ? '' : "Start speaking or type here \u2014 your story will appear."}
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
            <div className="wm-generating-label">writing</div>
          </div>
        )}

        {hint && !generating && (
          <div className="wm-hint">
            <div className="wm-hint-dot" />
            <div className="wm-hint-text">{hint}</div>
          </div>
        )}
      </div>

      {/* ── TRANSCRIPT PREVIEW (while listening) ── */}
      {listening && transcript && (
        <div className="wm-transcript">
          <div className="wm-transcript-text">{transcript}</div>
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
              ? 'Writing your story\u2026'
              : prose
              ? 'Hold to keep going'
              : 'Hold to speak \u2014 release to write'}
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
                navigate(`/storyteller?book=${bookId}&chapter=${chapterId}`);
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
