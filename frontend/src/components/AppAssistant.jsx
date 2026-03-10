/**
 * AppAssistant.jsx
 * Global AI assistant — bottom-right corner, always visible.
 * Sends every message with current app context so Claude knows
 * where you are and what's active.
 *
 * v2 — Voice input (STT) added via Web Speech API.
 * Push-to-talk: hold mic button → speak → release → Amber responds in voice.
 * Falls back gracefully if browser doesn't support SpeechRecognition.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import './AppAssistant.css';

const API = '/api/v1/memories/assistant-command';

const GREETING = {
  role: 'assistant',
  text: "Hey, I'm Amber. Ask me anything — about your characters, your book, navigation, or whatever you need.",
};

// ─── Speech Recognition singleton ────────────────────────────────────────────
const SpeechRecognition =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

function createRecognizer() {
  if (!SpeechRecognition) return null;
  const r = new SpeechRecognition();
  r.continuous      = false;   // stop after first pause
  r.interimResults  = true;    // show live transcript while speaking
  r.lang            = 'en-US';
  return r;
}

// ─── TTS helper ──────────────────────────────────────────────────────────────
function speak(text) {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate   = 1.0;
  utt.pitch  = 1.0;
  window.speechSynthesis.speak(utt);
}

export default function AppAssistant({ appContext = {}, onNavigate, onRefresh }) {
  const [open,       setOpen]       = useState(false);
  const [messages,   setMessages]   = useState([GREETING]);
  const [input,      setInput]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [minimized,  setMinimized]  = useState(() => {
    try { return localStorage.getItem('apa-minimized') === '1'; } catch { return false; }
  });

  // ── Voice state ─────────────────────────────────────────────────────────
  const [listening,      setListening]      = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const recognizerRef  = useRef(null);
  const voiceSupported = !!SpeechRecognition;

  const chatRef  = useRef(null);
  const inputRef = useRef(null);

  // Persist minimized preference
  const toggleMinimized = useCallback(() => {
    setMinimized(prev => {
      const next = !prev;
      try { localStorage.setItem('apa-minimized', next ? '1' : '0'); } catch {}
      if (next) setOpen(false);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--apa-trigger-size', '80px');
    return () => document.documentElement.style.removeProperty('--apa-trigger-size');
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  // ── Core send ────────────────────────────────────────────────────────────
  const send = useCallback(async (text) => {
    if (!text?.trim() || sending) return;

    const userMsg = { role: 'user', text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res  = await fetch(API, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message: text.trim(),
          history: messages.slice(-6),
          context: appContext,
        }),
      });

      const data = await res.json();

      setMessages(prev => [...prev, {
        role:   'assistant',
        text:   data.reply || 'Done.',
        action: data.action,
        error:  data.error,
      }]);

      if (data.navigate && onNavigate) {
        setTimeout(() => onNavigate(data.navigate), 400);
      }
      if (data.refresh && onRefresh) {
        onRefresh(data.refresh);
      }

    } catch {
      setMessages(prev => [...prev, {
        role:  'assistant',
        text:  "Something went wrong. Try again.",
        error: true,
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [sending, messages, appContext, onNavigate, onRefresh]);

  // ── Voice send — wraps send() and marks as voice-triggered ───────────────
  const sendVoice = useCallback(async (text) => {
    if (!text?.trim() || sending) return;

    const userMsg = { role: 'user', text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch(API, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message:         text.trim(),
          history:         messages.slice(-6),
          context:         appContext,
          _voiceTriggered: true,
        }),
      });

      const data  = await res.json();
      const reply = data.reply || 'Done.';

      setMessages(prev => [...prev, {
        role:   'assistant',
        text:   reply,
        action: data.action,
        error:  data.error,
      }]);

      // Voice-first: Amber speaks her reply
      if (!data.error) speak(reply);

      if (data.navigate && onNavigate) setTimeout(() => onNavigate(data.navigate), 400);
      if (data.refresh  && onRefresh)  onRefresh(data.refresh);

    } catch {
      setMessages(prev => [...prev, {
        role:  'assistant',
        text:  "Something went wrong. Try again.",
        error: true,
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [sending, messages, appContext, onNavigate, onRefresh]);

  // ── Voice: start listening ───────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!voiceSupported || listening || sending) return;

    const rec = createRecognizer();
    if (!rec) return;

    recognizerRef.current = rec;

    rec.onstart = () => {
      setListening(true);
      setLiveTranscript('');
    };

    rec.onresult = (e) => {
      let interim = '';
      let final   = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setLiveTranscript(final || interim);

      if (final) {
        setListening(false);
        setLiveTranscript('');
        rec.stop();
        sendVoice(final.trim());
      }
    };

    rec.onerror = (e) => {
      console.warn('SpeechRecognition error:', e.error);
      setListening(false);
      setLiveTranscript('');
    };

    rec.onend = () => {
      setListening(false);
    };

    rec.start();
  }, [voiceSupported, listening, sending, sendVoice]);

  // ── Voice: stop listening early (release before final) ──────────────────
  const stopListening = useCallback(() => {
    if (recognizerRef.current) {
      recognizerRef.current.stop();
      recognizerRef.current = null;
    }
    setListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognizerRef.current) recognizerRef.current.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const hasUnread = !open && messages.length > 1;

  return (
    <div className={`apa-root${open ? ' open' : ''}${minimized ? ' apa-minimized' : ''}`}>

      {open && (
        <div className="apa-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      {open && (
        <div className="apa-panel">
          <div className="apa-panel-header">
            <div className="apa-panel-title">
              <svg className="apa-panel-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Amber
              {listening && (
                <span className="apa-listening-badge">● listening</span>
              )}
            </div>
            <div className="apa-panel-context">
              {appContext.currentBook && (
                <span className="apa-ctx-pill">{appContext.currentBook.title}</span>
              )}
              {appContext.currentChapter && (
                <span className="apa-ctx-pill">{appContext.currentChapter.title}</span>
              )}
            </div>
            <button className="apa-close" onClick={() => setOpen(false)} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="apa-messages" ref={chatRef}>
            {messages.map((msg, i) => (
              <div key={i} className={`apa-msg apa-msg--${msg.role}${msg.error ? ' apa-msg--error' : ''}`}>
                {msg.role === 'assistant' && (
                  <span className="apa-msg-avatar">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </span>
                )}
                <div className="apa-msg-body">
                  <p className="apa-msg-text">{msg.text}</p>
                  {msg.action && !msg.error && (
                    <span className="apa-msg-tag">{msg.action.replace(/_/g, ' ')}</span>
                  )}
                </div>
              </div>
            ))}

            {/* Live transcript bubble — shows while speaking */}
            {listening && liveTranscript && (
              <div className="apa-msg apa-msg--user apa-msg--live">
                <div className="apa-msg-body">
                  <p className="apa-msg-text">{liveTranscript}</p>
                </div>
              </div>
            )}

            {sending && (
              <div className="apa-msg apa-msg--assistant">
                <span className="apa-msg-avatar">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </span>
                <div className="apa-thinking">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>

          {messages.length === 1 && (
            <div className="apa-quick-cmds">
              {[
                'What are the six franchise laws?',
                'Who is JustAWoman?',
                "What's deployed right now?",
                "What's next in the build queue?",
              ].map(cmd => (
                <button key={cmd} className="apa-quick-cmd" onClick={() => send(cmd)}>
                  {cmd}
                </button>
              ))}
            </div>
          )}

          <div className="apa-input-row">
            <textarea
              ref={inputRef}
              className="apa-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={listening ? 'Listening...' : 'Tell me what to do...'}
              rows={2}
              disabled={sending || listening}
            />

            {/* Mic button — only renders if browser supports STT */}
            {voiceSupported && (
              <button
                className={`apa-mic${listening ? ' apa-mic--active' : ''}`}
                onMouseDown={startListening}
                onMouseUp={stopListening}
                onTouchStart={(e) => { e.preventDefault(); startListening(); }}
                onTouchEnd={(e)   => { e.preventDefault(); stopListening();  }}
                disabled={sending}
                aria-label={listening ? 'Release to send' : 'Hold to speak'}
                title={listening ? 'Release to send' : 'Hold to speak'}
              >
                {listening ? (
                  /* Waveform icon while active */
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="2"  x2="12" y2="22" />
                    <line x1="7"  y1="6"  x2="7"  y2="18" />
                    <line x1="17" y1="6"  x2="17" y2="18" />
                    <line x1="3"  y1="10" x2="3"  y2="14" />
                    <line x1="21" y1="10" x2="21" y2="14" />
                  </svg>
                ) : (
                  /* Mic icon at rest */
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="2" width="6" height="11" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                    <line x1="9"  y1="22" x2="15" y2="22" />
                  </svg>
                )}
              </button>
            )}

            <button
              className="apa-send"
              onClick={() => send(input)}
              disabled={sending || !input.trim() || listening}
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>

          {/* Voice hint — shown once, below input */}
          {voiceSupported && messages.length === 1 && (
            <p className="apa-voice-hint">Hold the mic to speak. Amber will talk back.</p>
          )}
        </div>
      )}

      {minimized ? (
        <button
          className="apa-restore-tab"
          onClick={toggleMinimized}
          title="Show Amber assistant"
          aria-label="Show Amber assistant"
        >
          ✦
        </button>
      ) : (
        <>
          {!open && (
            <button
              className="apa-minimize-btn"
              onClick={toggleMinimized}
              title="Minimize assistant"
              aria-label="Minimize assistant"
            >
              ▾
            </button>
          )}
          <button
            className="apa-trigger"
            onClick={() => setOpen(o => !o)}
            title="Ask Amber"
            aria-label="Ask Amber"
          >
            {open ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {hasUnread && <span className="apa-unread-dot" />}
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
