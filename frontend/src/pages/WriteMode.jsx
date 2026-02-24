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

  if (loading) return <div style={st.loadScreen}>Loading...</div>;

  return (
    <div style={st.root}>
      {/* ── TOP BAR ── */}
      <header style={st.topBar}>
        <button style={st.backBtn} onClick={() => setShowExit(true)}>
          ←
        </button>
        <div style={st.chapterInfo}>
          <div style={st.chapterTitle}>{chapter?.title || 'Untitled'}</div>
          <div style={st.bookTitle}>{book?.title || book?.character || ''}</div>
        </div>
        <div style={st.topRight}>
          <div style={st.wordCount}>
            {wordCount > 0 ? `${wordCount}w` : ''}
          </div>
          <div style={st.saveStatus}>
            {saving ? '·· saving' : saved ? '' : '· unsaved'}
          </div>
          <button
            style={{ ...st.reviewBtn, opacity: prose.length > 10 ? 1 : 0.3 }}
            onClick={() => prose.length > 10 && setEditMode(!editMode)}
          >
            {editMode ? 'Write' : 'Edit'}
          </button>
        </div>
      </header>

      {/* ── PROSE AREA ── */}
      <div style={st.proseWrap} ref={proseRef}>
        <textarea
          style={st.proseArea}
          value={prose}
          onChange={handleProseChange}
          placeholder={editMode ? '' : "Start speaking or type here \u2014 your story will appear."}
          spellCheck={false}
          readOnly={generating}
        />

        {generating && (
          <div style={st.generatingOverlay}>
            <div style={st.generatingDots}>
              <span style={{ ...st.dot, animationDelay: '0s' }} />
              <span style={{ ...st.dot, animationDelay: '0.2s' }} />
              <span style={{ ...st.dot, animationDelay: '0.4s' }} />
            </div>
            <div style={st.generatingLabel}>writing</div>
          </div>
        )}

        {hint && !generating && (
          <div style={st.hintBar}>
            <div style={st.hintDot} />
            <div style={st.hintText}>{hint}</div>
          </div>
        )}
      </div>

      {/* ── TRANSCRIPT PREVIEW (while listening) ── */}
      {listening && transcript && (
        <div style={st.transcriptBar}>
          <div style={st.transcriptText}>{transcript}</div>
        </div>
      )}

      {/* ── EDIT MODE PANEL ── */}
      {editMode && (
        <div style={st.editPanel}>
          <div style={st.editLabel}>What needs to change?</div>
          <div style={st.editInputRow}>
            <textarea
              style={st.editInput}
              value={editNote}
              onChange={e => setEditNote(e.target.value)}
              placeholder="That part is right but she wouldn't say it that way..."
              rows={3}
            />
            <button
              style={st.editMicBtn}
              onPointerDown={startEditListening}
              onPointerUp={stopEditListening}
            >
              {editListening
                ? <span style={st.micActiveRing}>{'\uD83C\uDF99'}</span>
                : '\uD83C\uDF99'}
            </button>
          </div>
          <button
            style={{ ...st.applyBtn, opacity: editNote.trim() ? 1 : 0.35 }}
            onClick={applyEdit}
            disabled={!editNote.trim() || generating}
          >
            {generating ? 'Rewriting\u2026' : 'Apply \u2192'}
          </button>
        </div>
      )}

      {/* ── MIC ERROR ── */}
      {micError && (
        <div style={st.micError}>{micError}</div>
      )}

      {/* ── BOTTOM BAR ── */}
      {!editMode && (
        <div style={st.bottomBar}>
          <button
            style={{
              ...st.micBtn,
              background:   listening ? '#1a1a1a' : '#F5F0E8',
              boxShadow:    listening ? '0 0 0 8px rgba(26,26,26,0.08)' : 'none',
              transform:    listening ? 'scale(1.08)' : 'scale(1)',
            }}
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

          <div style={st.bottomHint}>
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
              style={st.sendBtn}
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
        <div style={st.modalOverlay} onClick={() => setShowExit(false)}>
          <div style={st.modal} onClick={e => e.stopPropagation()}>
            <div style={st.modalTitle}>Leave Write Mode?</div>
            <div style={st.modalSub}>
              {prose ? 'Your draft is saved. You can come back.' : 'Nothing written yet.'}
            </div>
            <div style={st.modalBtns}>
              <button style={st.modalCancel} onClick={() => setShowExit(false)}>Stay</button>
              <button style={st.modalLeave} onClick={async () => {
                if (prose) await saveDraft(prose);
                navigate(-1);
              }}>
                {prose ? 'Save & Leave' : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes micRing {
          0%   { box-shadow: 0 0 0 0 rgba(26,26,26,0.3); }
          100% { box-shadow: 0 0 0 14px rgba(26,26,26,0); }
        }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        textarea:focus { outline: none; }
        textarea { -webkit-user-select: text; user-select: text; }
      `}</style>
    </div>
  );
}

// ── STYLES — light theme, mobile-first ───────────────────────────────────

const PARCHMENT   = '#FAF7F0';
const INK         = '#1C1814';
const INK_LIGHT   = 'rgba(28,24,20,0.35)';
const INK_FAINT   = 'rgba(28,24,20,0.1)';
const GOLD        = '#B8962E';
const GOLD_LIGHT  = 'rgba(184,150,46,0.12)';

const st = {
  root: {
    display: 'flex', flexDirection: 'column',
    minHeight: '100dvh', height: '100dvh',
    background: PARCHMENT,
    fontFamily: "'Lora', 'Georgia', serif",
    overflow: 'hidden',
    position: 'relative',
  },
  loadScreen: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100dvh', background: PARCHMENT,
    fontFamily: "'DM Mono', monospace",
    fontSize: 11, letterSpacing: '0.15em', color: INK_LIGHT,
  },

  // Top bar
  topBar: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 16px 10px',
    borderBottom: `1px solid ${INK_FAINT}`,
    background: PARCHMENT,
    flexShrink: 0,
    zIndex: 10,
  },
  backBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: "'DM Mono', monospace", fontSize: 16,
    color: INK_LIGHT, padding: '4px 8px 4px 0',
    flexShrink: 0,
  },
  chapterInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 1 },
  chapterTitle: {
    fontFamily: "'Lora', 'Georgia', serif",
    fontStyle: 'italic', fontSize: 15,
    color: INK, lineHeight: 1.2,
  },
  bookTitle: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 8, letterSpacing: '0.15em',
    color: INK_LIGHT, textTransform: 'uppercase',
  },
  topRight: {
    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
  },
  wordCount: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 9, letterSpacing: '0.1em', color: INK_LIGHT,
  },
  saveStatus: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 8, letterSpacing: '0.08em', color: GOLD,
  },
  reviewBtn: {
    background: 'none',
    border: `1px solid ${INK_FAINT}`,
    borderRadius: 2,
    fontFamily: "'DM Mono', monospace",
    fontSize: 9, letterSpacing: '0.12em',
    color: INK, padding: '5px 10px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },

  // Prose area
  proseWrap: {
    flex: 1, overflow: 'auto',
    position: 'relative',
    WebkitOverflowScrolling: 'touch',
  },
  proseArea: {
    width: '100%', minHeight: '100%',
    background: 'transparent', border: 'none',
    padding: '24px 20px 120px',
    fontFamily: "'Lora', 'Georgia', serif",
    fontSize: 17, lineHeight: 1.85,
    color: INK,
    resize: 'none',
    display: 'block',
    WebkitTextSizeAdjust: '100%',
  },

  // Generating overlay
  generatingOverlay: {
    position: 'absolute', bottom: 80, left: 0, right: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 8,
    padding: '12px',
    pointerEvents: 'none',
  },
  generatingDots: { display: 'flex', gap: 6 },
  dot: {
    width: 6, height: 6, borderRadius: '50%',
    background: GOLD, display: 'inline-block',
    animation: 'dotPulse 1.2s ease-in-out infinite',
  },
  generatingLabel: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 8, letterSpacing: '0.2em',
    color: GOLD, textTransform: 'uppercase',
  },

  // Hint bar
  hintBar: {
    position: 'absolute', bottom: 70, left: 16, right: 16,
    display: 'flex', alignItems: 'flex-start', gap: 8,
    background: GOLD_LIGHT,
    border: '1px solid rgba(184,150,46,0.2)',
    borderRadius: 3, padding: '8px 12px',
    animation: 'fadeIn 0.3s ease',
    pointerEvents: 'none',
  },
  hintDot: {
    width: 5, height: 5, borderRadius: '50%',
    background: GOLD, flexShrink: 0, marginTop: 4,
  },
  hintText: {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 13, fontStyle: 'italic',
    color: 'rgba(28,24,20,0.6)', lineHeight: 1.5,
  },

  // Transcript preview
  transcriptBar: {
    background: 'rgba(28,24,20,0.03)',
    borderTop: `1px solid ${INK_FAINT}`,
    padding: '10px 20px',
    flexShrink: 0, maxHeight: 80, overflowY: 'auto',
  },
  transcriptText: {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 13, fontStyle: 'italic',
    color: INK_LIGHT, lineHeight: 1.5,
  },

  // Edit panel
  editPanel: {
    borderTop: `1px solid ${INK_FAINT}`,
    padding: '14px 16px 16px',
    background: '#FDFAF4',
    flexShrink: 0,
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  editLabel: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 8, letterSpacing: '0.2em',
    color: INK_LIGHT, textTransform: 'uppercase',
  },
  editInputRow: { display: 'flex', gap: 8, alignItems: 'flex-end' },
  editInput: {
    flex: 1,
    background: 'white',
    border: `1px solid ${INK_FAINT}`,
    borderRadius: 3,
    padding: '10px 12px',
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 16, fontStyle: 'italic',
    color: INK, lineHeight: 1.5, resize: 'none',
  },
  editMicBtn: {
    width: 44, height: 44, borderRadius: '50%',
    background: '#F0EBE0', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, cursor: 'pointer', flexShrink: 0,
    WebkitUserSelect: 'none', userSelect: 'none',
  },
  micActiveRing: {
    display: 'inline-block',
    animation: 'micRing 0.8s ease-out infinite',
    borderRadius: '50%',
  },
  applyBtn: {
    background: INK, color: PARCHMENT,
    border: 'none', borderRadius: 3,
    fontFamily: "'DM Mono', monospace",
    fontSize: 10, letterSpacing: '0.15em',
    padding: '11px 20px', cursor: 'pointer',
    transition: 'opacity 0.15s', alignSelf: 'flex-end',
  },

  // Mic error
  micError: {
    padding: '8px 16px',
    fontFamily: "'DM Mono', monospace",
    fontSize: 9, letterSpacing: '0.08em',
    color: '#B85C38', background: 'rgba(184,92,56,0.06)',
    borderTop: '1px solid rgba(184,92,56,0.15)',
    flexShrink: 0,
  },

  // Bottom bar
  bottomBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 16, padding: '16px 20px 20px',
    borderTop: `1px solid ${INK_FAINT}`,
    background: PARCHMENT, flexShrink: 0,
    paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
  },
  micBtn: {
    width: 64, height: 64, borderRadius: '50%',
    border: `1.5px solid ${INK_FAINT}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0,
    transition: 'all 0.15s ease',
    WebkitUserSelect: 'none', userSelect: 'none',
    touchAction: 'none',
  },
  bottomHint: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 9, letterSpacing: '0.1em',
    color: INK_LIGHT, flex: 1, lineHeight: 1.5,
  },
  sendBtn: {
    background: 'none',
    border: `1px solid ${INK_FAINT}`,
    borderRadius: 2, flexShrink: 0,
    fontFamily: "'DM Mono', monospace",
    fontSize: 9, letterSpacing: '0.12em',
    color: INK, padding: '8px 12px',
    cursor: 'pointer', transition: 'all 0.15s',
  },

  // Exit modal
  modalOverlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(28,24,20,0.35)',
    display: 'flex', alignItems: 'flex-end',
    zIndex: 100,
  },
  modal: {
    background: PARCHMENT, width: '100%',
    borderRadius: '12px 12px 0 0',
    padding: '24px 20px',
    paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  modalTitle: {
    fontFamily: "'Lora', Georgia, serif",
    fontStyle: 'italic', fontSize: 19, color: INK,
  },
  modalSub: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 9, letterSpacing: '0.08em', color: INK_LIGHT,
  },
  modalBtns: { display: 'flex', gap: 10, paddingTop: 4 },
  modalCancel: {
    flex: 1, padding: '13px',
    background: '#F0EBE0', border: 'none', borderRadius: 3,
    fontFamily: "'DM Mono', monospace",
    fontSize: 10, letterSpacing: '0.12em', color: INK,
    cursor: 'pointer',
  },
  modalLeave: {
    flex: 1, padding: '13px',
    background: INK, border: 'none', borderRadius: 3,
    fontFamily: "'DM Mono', monospace",
    fontSize: 10, letterSpacing: '0.12em', color: PARCHMENT,
    cursor: 'pointer',
  },
};
