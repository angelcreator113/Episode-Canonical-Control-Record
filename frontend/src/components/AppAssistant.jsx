/**
 * AppAssistant.jsx
 * Global AI assistant — bottom-right corner, always visible.
 * Sends every message with current app context so Claude knows
 * where you are and what's active.
 *
 * v2 — Voice input (STT) added via Web Speech API.
 * Push-to-talk: hold mic button → speak → release → Amber responds in voice.
 * Falls back gracefully if browser doesn't support SpeechRecognition.
 *
 * TTS: ElevenLabs via /api/v1/memories/assistant-speak (backend proxies to ElevenLabs).
 * The browser's speechSynthesis is NOT used — Amber's voice is ElevenLabs only.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import AmberPromptLibrary from './AmberPromptLibrary';
import './AppAssistant.css';

const API = '/api/v1/memories/assistant-command';

const GREETING = {
  role: 'assistant',
  text: "hey it's amber. whatever you're working on rn — characters, the book, the feed, navigation — just tell me and i'll pull it up. i've been watching the world while you were gone.",
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

// ─── TTS via ElevenLabs (backend proxy) ──────────────────────────────────────
// Backend route: POST /api/v1/memories/assistant-speak
// Body: { text: string }
// Returns: audio/mpeg stream — we create a Blob URL and play it.
const SPEAK_API = '/api/v1/memories/assistant-speak';

let currentAudio = null;

async function speak(text) {
  if (!text) return;
  try {
    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    const res = await fetch(SPEAK_API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
    });

    if (!res.ok) {
      console.warn('ElevenLabs TTS failed:', res.status);
      return;
    }

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
    };

    await audio.play();
  } catch (err) {
    console.warn('TTS error:', err);
  }
}

export default function AppAssistant({ appContext = {}, onNavigate, onRefresh }) {
  const [open,       setOpen]       = useState(false);
  const [messages,   setMessages]   = useState([GREETING]);
  const [input,      setInput]      = useState('');
  const [sending,    setSending]    = useState(false);

  // ── Voice state ─────────────────────────────────────────────────────────
  const [listening,      setListening]      = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const recognizerRef  = useRef(null);
  const voiceSupported = !!SpeechRecognition;

  // ── Voice-response toggle — Amber speaks ALL replies when on ────────────
  const [voiceResponse, setVoiceResponse] = useState(() => {
    try { return localStorage.getItem('amber-voice-response') !== '0'; } catch { return true; }
  });

  const chatRef  = useRef(null);
  const inputRef = useRef(null);

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
          history: messages.slice(-20),
          context: appContext,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages(prev => [...prev, {
          role:  'assistant',
          text:  data.reply || `Something went wrong: ${data.error}`,
          error: true,
        }]);
      } else {
        const reply = data.reply || 'Done.';
        setMessages(prev => [...prev, {
          role:           'assistant',
          text:           reply,
          action:         data.action,
          nextBestAction: data.nextBestAction || null,
        }]);
        // Speak reply when voice-response is enabled
        if (voiceResponse) speak(reply);
      }

      if (data.navigate && onNavigate) {
        setTimeout(() => onNavigate(data.navigate), 400);
      }
      if (data.refresh && onRefresh) {
        onRefresh(data.refresh);
      }

    } catch {
      setMessages(prev => [...prev, {
        role:  'assistant',
        text:  "Can't reach Amber right now. Check your connection and try again.",
        error: true,
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [sending, messages, appContext, onNavigate, onRefresh, voiceResponse]);

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
          history:         messages.slice(-20),
          context:         appContext,
          _voiceTriggered: true,
        }),
      });

      const data  = await res.json();

      if (data.error) {
        setMessages(prev => [...prev, {
          role:  'assistant',
          text:  data.reply || `Something went wrong: ${data.error}`,
          error: true,
        }]);
      } else {
        const reply = data.reply || 'Done.';
        setMessages(prev => [...prev, {
          role:           'assistant',
          text:           reply,
          action:         data.action,
          nextBestAction: data.nextBestAction || null,
        }]);
        // Voice-first: Amber speaks her reply
        speak(reply);
      }

      if (data.navigate && onNavigate) setTimeout(() => onNavigate(data.navigate), 400);
      if (data.refresh  && onRefresh)  onRefresh(data.refresh);

    } catch {
      setMessages(prev => [...prev, {
        role:  'assistant',
        text:  "Can't reach Amber right now. Check your connection and try again.",
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
        // Final result came in — fire immediately
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
      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    };
  }, []);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const hasUnread = !open && messages.length > 1;

  const toggleVoiceResponse = useCallback(() => {
    setVoiceResponse(prev => {
      const next = !prev;
      try { localStorage.setItem('amber-voice-response', next ? '1' : '0'); } catch {}
      if (!next && currentAudio) { currentAudio.pause(); currentAudio = null; }
      return next;
    });
  }, []);

  return (
    <div className={`apa-root${open ? ' open' : ''}`}>

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
              {appContext.pageName && appContext.pageName !== appContext.currentView && (
                <span className="apa-ctx-pill">{appContext.pageName}</span>
              )}
              {appContext.activeTab && (
                <span className="apa-ctx-pill">tab: {appContext.activeTab}</span>
              )}
              {appContext.activeCharacterId && (
                <span className="apa-ctx-pill">char: {appContext.activeCharacterId.slice(0, 8)}</span>
              )}
              {appContext.activeBookId && (
                <span className="apa-ctx-pill">book: {appContext.activeBookId.slice(0, 8)}</span>
              )}
              {appContext.activeShowId && (
                <span className="apa-ctx-pill">show: {appContext.activeShowId.slice(0, 8)}</span>
              )}
              {appContext.activeRegistryId && (
                <span className="apa-ctx-pill">registry: {appContext.activeRegistryId.slice(0, 8)}</span>
              )}
              {appContext.currentBook && (
                <span className="apa-ctx-pill">{appContext.currentBook.title}</span>
              )}
              {appContext.currentChapter && (
                <span className="apa-ctx-pill">{appContext.currentChapter.title}</span>
              )}
            </div>
            <button
              className={`apa-voice-toggle${voiceResponse ? ' apa-voice-toggle--on' : ''}`}
              onClick={toggleVoiceResponse}
              title={voiceResponse ? 'Voice on — Amber speaks replies' : 'Voice off — text only'}
              aria-label={voiceResponse ? 'Turn voice off' : 'Turn voice on'}
            >
              {voiceResponse ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              )}
              <span className="apa-voice-toggle__label">{voiceResponse ? 'voice on' : 'voice off'}</span>
            </button>
            <button className="apa-close" onClick={() => window.location.reload()} aria-label="Refresh page" title="Refresh page" style={{ marginLeft: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
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
                  {msg.nextBestAction && (
                    <p className="apa-msg-nba">→ {msg.nextBestAction}</p>
                  )}
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
                'what are the six franchise laws?',
                'tell me about JustAWoman',
                "what's deployed rn?",
                "what should i work on next?",
              ].map(cmd => (
                <button key={cmd} className="apa-quick-cmd" onClick={() => send(cmd)}>
                  {cmd}
                </button>
              ))}
            </div>
          )}

          <AmberPromptLibrary onSelect={(text) => {
            setInput(text);
            inputRef.current?.focus();
          }} />

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

      {!open && (
        <button
          className="apa-trigger"
          onClick={() => setOpen(true)}
          title="Talk to Amber"
          aria-label="Talk to Amber"
        >
          <span className="apa-trigger-letter">A</span>
          {hasUnread && <span className="apa-unread-dot" />}
        </button>
      )}
    </div>
  );
}
