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
      text: `I can see "${title}" already has ${chapters.length} chapter${chapters.length > 1 ? 's' : ''}, with ${filled} planned so far. Let's go deeper — pick a chapter you want to develop, or tell me what's still unclear in your head about this story. What's the part that excites you most right now?`,
      extracting: null,
    };
  }
  if (title && hasChs) {
    return {
      role: 'assistant',
      text: `"${title}" — I love it. You've got ${chapters.length} chapter${chapters.length > 1 ? 's' : ''} created but they're waiting to be filled. Before we plan them out, tell me: what is this book really about? Not the plot — the feeling. What do you want someone to carry with them after they finish reading?`,
      extracting: null,
    };
  }
  if (title) {
    return {
      role: 'assistant',
      text: `"${title}" — that's a strong start. Now tell me what pulled you to write this. What's the core idea, the itch that won't leave you alone? Give me as much or as little as you want.`,
      extracting: null,
    };
  }
  return {
    role: 'assistant',
    text: "Let's build your book together. Tell me — what's this book about? Not the summary, the heart of it. What made you sit down and say 'I need to write this'?",
    extracting: null,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function planEmpty(chapters, book) {
  return {
    bookTitle:   book?.title || '',
    bookConcept: book?.description || '',
    parts:       [],
    chapters:    (chapters || []).map(ch => ({
      id:               ch.id,
      title:            ch.title || '',
      what:             ch.scene_goal || ch.chapter_notes || '',
      emotionalStart:   ch.emotional_state_start || '',
      emotionalEnd:     ch.emotional_state_end || '',
      characters:       Array.isArray(ch.characters_present) ? ch.characters_present : (typeof ch.characters_present === 'string' ? ch.characters_present.split(',').map(s => s.trim()).filter(Boolean) : []),
      sections:         Array.isArray(ch.sections) ? ch.sections : [],
      filled:           false,
    })),
  };
}

function useVoiceInput() {
  const [listening,   setListening]   = useState(false);
  const [transcript,  setTranscript]  = useState('');
  const [supported,   setSupported]   = useState(false);
  const recRef = useRef(null);

  useEffect(() => {
    setSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  const start = useCallback((onResult) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.lang            = 'en-US';
    recRef.current      = rec;

    rec.onresult = (e) => {
      let full = '';
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript;
      }
      setTranscript(full);
      if (onResult) onResult(full);
    };
    rec.onerror = () => { setListening(false); };
    rec.onend   = () => { setListening(false); };

    rec.start();
    setListening(true);
    setTranscript('');
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
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
}) {
  const [messages,    setMessages]    = useState(() => [makeOpeningMessage(book, chapters)]);
  const [input,       setInput]       = useState('');
  const [sending,     setSending]     = useState(false);
  const [plan,        setPlan]        = useState(() => planEmpty(chapters, book));
  const [applying,    setApplying]    = useState(false);
  const [activeChIdx, setActiveChIdx] = useState(null);
  const [highlight,   setHighlight]   = useState(null);
  const [mobileTab,   setMobileTab]   = useState('chat'); // 'chat' | 'plan'
  const chatRef   = useRef(null);
  const inputRef  = useRef(null);
  const voice     = useVoiceInput();

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
    const userMsg = { role: 'user', text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    voice.setTranscript('');
    setSending(true);

    try {
      const res  = await fetch(`${API}/memories/story-planner-chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message:    text.trim(),
          history:    messages,
          book:       { id: book?.id, title: book?.title },
          plan:       plan,
          characters: characters.map(c => ({
            id:   c.id,
            name: c.selected_name || c.name,
            type: c.type,
          })),
        }),
      });

      const data = await res.json();

      // Update plan with extracted fields
      if (data.planUpdates && Object.keys(data.planUpdates).length > 0) {
        setPlan(prev => mergeUpdates(prev, data.planUpdates));
        if (data.planUpdates.highlightField) {
          setHighlight(data.planUpdates.highlightField);
        }
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
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Something went wrong. Try again.',
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
    if (updates.parts)       next.parts       = updates.parts;

    if (updates.chapters) {
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
          filled:         true,
        };
      });
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
      for (const ch of plan.chapters) {
        if (!ch.filled && !ch.title) continue;
        await fetch(`${API}/storyteller/chapters/${ch.id}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            title:                 ch.title          || undefined,
            scene_goal:            ch.what           || undefined,
            emotional_state_start: ch.emotionalStart || undefined,
            emotional_state_end:   ch.emotionalEnd   || undefined,
            characters_present:    ch.characters?.join(', ') || undefined,
            chapter_notes:         ch.what           || undefined,
          }),
        });
        saved++;
      }
      toast?.add(`Plan applied — ${saved} chapters updated`, 'success');
      onApply?.();
    } catch {
      toast?.add('Error saving plan', 'error');
    } finally {
      setApplying(false);
    }
  }, [plan, onApply, toast]);

  // ── Voice toggle ──────────────────────────────────────────────────────

  const toggleVoice = () => {
    if (voice.listening) {
      voice.stop();
      if (voice.transcript.trim()) send(voice.transcript);
    } else {
      voice.start((t) => setInput(t));
    }
  };

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
      ? `Let's dive deeper into "${label}". What else should I know about this chapter?`
      : `Let's work on "${label}". Tell me what happens in this chapter.`;
    send(msg);
  }, [sending, send]);

  // ── Focus on a section within a chapter ─────────────────────────

  const focusSection = useCallback((section, ch, chIdx) => {
    if (sending) return;
    setMobileTab('chat'); // switch to chat on mobile
    const chLabel = ch.title || `Chapter ${chIdx + 1}`;
    const secLabel = section.title || section.content || 'this section';
    send(`In "${chLabel}", let's talk about the section "${secLabel}". What should happen here?`);
  }, [sending, send]);
  // ── Filled chapters count ─────────────────────────────────────────────

  const filledCount  = plan.chapters.filter(c => c.filled || c.title).length;
  const totalCount   = plan.chapters.length;
  const planProgress = totalCount > 0 ? (filledCount / totalCount) * 100 : 0;

  // ── RENDER ────────────────────────────────────────────────────────────

  return (
    <div className="spc-root">

      {/* ── HEADER ── */}
      <header className="spc-header">
        <div className="spc-header-left">
          <span className="spc-header-title">Story Planner</span>
          <span className="spc-header-book">{book?.title || 'Untitled'}</span>
        </div>
        <div className="spc-header-right">
          {filledCount > 0 && (
            <button
              className="spc-apply-btn"
              onClick={applyPlan}
              disabled={applying}
            >
              {applying ? 'Saving…' : `Apply Plan (${filledCount}/${totalCount})`}
            </button>
          )}
          <button className="spc-close-btn" onClick={onClose}>✕</button>
        </div>
      </header>

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

          {/* Input row */}
          <div className="spc-input-row">
            {voice.listening && (
              <div className="spc-voice-preview">
                <span className="spc-voice-dot" />
                {voice.transcript || 'Listening…'}
              </div>
            )}
            <div className="spc-input-wrap">
              <textarea
                ref={inputRef}
                className="spc-input"
                value={voice.listening ? voice.transcript : input}
                onChange={e => !voice.listening && setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Answer here, or use the mic…"
                rows={2}
                disabled={sending}
              />
              <div className="spc-input-actions">
                {voice.supported && (
                  <button
                    className={`spc-mic-btn${voice.listening ? ' listening' : ''}`}
                    onClick={toggleVoice}
                    title={voice.listening ? 'Stop & send' : 'Speak your answer'}
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
                  onClick={() => send(voice.listening ? voice.transcript : input)}
                  disabled={sending || (!input.trim() && !voice.transcript.trim())}
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
          <div className={`spc-plan-section${highlight === 'bookTitle' || highlight === 'bookConcept' ? ' spc-plan-section--flash' : ''}`}>
            <div className="spc-plan-section-label">Book</div>
            <div className="spc-plan-book-title">
              {plan.bookTitle || <span className="spc-plan-empty">Title not yet named…</span>}
            </div>
            {plan.bookConcept && (
              <p className="spc-plan-concept">{plan.bookConcept}</p>
            )}
          </div>

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
                  className={`spc-plan-chapter${ch.filled ? ' filled' : ''}${activeChIdx === i ? ' active' : ''}${highlight === `chapter-${i}` ? ' flash' : ''}`}
                  onClick={() => setActiveChIdx(activeChIdx === i ? null : i)}
                >
                  <div className="spc-plan-ch-header">
                    <span className="spc-plan-ch-num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="spc-plan-ch-title">
                      {ch.title || <span className="spc-plan-empty">Chapter {i + 1}</span>}
                    </span>
                    {ch.filled && <span className="spc-plan-ch-dot" />}
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
