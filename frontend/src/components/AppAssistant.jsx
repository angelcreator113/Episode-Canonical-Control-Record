/**
 * AppAssistant.jsx
 * Global AI assistant — bottom-right corner, always visible.
 * v3 — Streaming responses, expandable panel, clear chat, timestamps,
 *       copy message, stop generating, Escape to close, scroll-to-bottom.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import AmberPromptLibrary from './AmberPromptLibrary';
import './AppAssistant.css';

const API        = '/api/v1/memories/assistant-command';
const STREAM_API = '/api/v1/memories/assistant-command-stream';

// ─── Lightweight inline markdown → HTML (bold, italic, code) ────────────────
function renderMarkdown(text) {
  if (!text) return text;
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .replace(/`([^`]+)`/g, '<code style="background:#f3f0f8;padding:1px 5px;border-radius:4px;font-size:11px">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

// ─── Relative time helper ───────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return '';
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

const GREETING = {
  role: 'assistant',
  text: "hey it's amber. whatever you're working on rn — characters, the book, the feed, navigation — just tell me and i'll pull it up. i've been watching the world while you were gone.",
  ts: Date.now(),
};

// ─── Speech Recognition singleton ──────────────────────────────────────────
const SpeechRecognition =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

function createRecognizer() {
  if (!SpeechRecognition) return null;
  const r = new SpeechRecognition();
  r.continuous     = false;
  r.interimResults = true;
  r.lang           = 'en-US';
  return r;
}

// How long to wait after Amber finishes speaking before resuming mic
const RESUME_DELAY_MS = 600;

// ─── TTS via ElevenLabs (backend proxy) ────────────────────────────────────
const SPEAK_API = '/api/v1/amber/speak';
let currentAudio = null;

async function speak(text, onDone) {
  if (!text) { onDone?.(); return; }
  try {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    const res = await fetch(SPEAK_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) { console.warn('TTS failed:', res.status); onDone?.(); return; }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    audio.onended = () => { URL.revokeObjectURL(url); currentAudio = null; onDone?.(); };
    audio.onerror = () => { currentAudio = null; onDone?.(); };
    await audio.play();
  } catch (err) {
    console.warn('TTS error:', err);
    onDone?.();
  }
}


export default function AppAssistant({ appContext = {}, onNavigate, onRefresh }) {
  const [open,       setOpen]       = useState(false);
  const [expanded,   setExpanded]   = useState(false);
  const [messages,   setMessages]   = useState(() => {
    try {
      const saved = sessionStorage.getItem('amber-chat');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return [GREETING];
  });
  const [input,      setInput]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [streamText, setStreamText] = useState('');

  // Voice state — conversation mode (toggle, not push-to-talk)
  const [listening,      setListening]      = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [conversing,     setConversing]     = useState(false); // conversation mode active
  const recognizerRef    = useRef(null);
  const wantListeningRef = useRef(false);
  const restartCountRef  = useRef(0);
  const voiceSupported   = !!SpeechRecognition;

  // Refs to break circular dependency: send → resume → startRecSession → send
  const startRecSessionRef      = useRef(null);
  const resumeListeningAfterReplyRef = useRef(null);

  // Voice-response toggle
  const [voiceResponse, setVoiceResponse] = useState(() => {
    try { return localStorage.getItem('amber-voice-response') !== '0'; } catch { return true; }
  });

  // Scroll-to-bottom state
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const chatRef    = useRef(null);
  const inputRef   = useRef(null);
  const abortRef   = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, open, streamText]);

  // Persist chat to sessionStorage
  useEffect(() => {
    try { sessionStorage.setItem('amber-chat', JSON.stringify(messages)); } catch { /* ignore */ }
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  // ── Escape key closes panel ──────────────────────────────────────────────
  useEffect(() => {
    function handleGlobalKey(e) {
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        wantListeningRef.current = false;
        setConversing(false);
        if (recognizerRef.current) { try { recognizerRef.current.stop(); } catch {} }
        setListening(false);
        setOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    }
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [open]);

  // ── Scroll detection for jump-to-bottom ──────────────────────────────────
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    function onScroll() {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBtn(distFromBottom > 80);
    }
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [open]);

  // ── Streaming send ─────────────────────────────────────────────────────
  const send = useCallback(async (text, { forceVoice = false } = {}) => {
    if (!text?.trim() || sending) return;

    const userMsg = { role: 'user', text: text.trim(), ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);
    setStreamText('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const body = {
        message: text.trim(),
        history: messages.slice(-20),
        context: appContext,
      };
      if (forceVoice) body._voiceTriggered = true;

      const res = await fetch(STREAM_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        // Fall back to non-streaming endpoint
        const fallback = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await fallback.json();
        const reply = data.reply || 'Done.';
        setMessages(prev => [...prev, {
          role: 'assistant', text: reply, ts: Date.now(),
          action: data.action, nextBestAction: data.nextBestAction || null,
          error: !!data.error,
        }]);
        if (forceVoice || voiceResponse) speak(reply, () => resumeListeningAfterReplyRef.current?.());
        else resumeListeningAfterReplyRef.current?.();
        if (data.navigate && onNavigate) setTimeout(() => onNavigate(data.navigate), 400);
        if (data.refresh && onRefresh) onRefresh(data.refresh);
        return;
      }

      // SSE streaming
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullReply = '';
      let metadata = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'token') {
              fullReply += event.text;
              setStreamText(fullReply);
            } else if (event.type === 'done') {
              metadata = event;
              fullReply = event.reply || fullReply;
            } else if (event.type === 'error') {
              fullReply = event.reply || event.error;
              metadata = { error: true };
            }
          } catch { /* skip malformed lines */ }
        }
      }

      // Commit final message
      setStreamText('');
      setMessages(prev => [...prev, {
        role: 'assistant', text: fullReply, ts: Date.now(),
        action: metadata.action || null,
        nextBestAction: metadata.nextBestAction || null,
        error: !!metadata.error,
      }]);

      if (forceVoice || voiceResponse) speak(fullReply, () => resumeListeningAfterReplyRef.current?.());
      else resumeListeningAfterReplyRef.current?.();
      if (metadata.navigate && onNavigate) setTimeout(() => onNavigate(metadata.navigate), 400);
      if (metadata.refresh && onRefresh) onRefresh(metadata.refresh);

    } catch (err) {
      if (err.name === 'AbortError') {
        // User stopped generation — commit what we have
        if (streamText) {
          setMessages(prev => [...prev, {
            role: 'assistant', text: streamText + ' [stopped]', ts: Date.now(),
          }]);
        }
        setStreamText('');
        return;
      }
      setStreamText('');
      setMessages(prev => [...prev, {
        role: 'assistant', ts: Date.now(),
        text: "Can't reach Amber right now. Check your connection and try again.",
        error: true,
      }]);
    } finally {
      setSending(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [sending, messages, appContext, onNavigate, onRefresh, voiceResponse, streamText]);

  // ── Stop generating ───────────────────────────────────────────────────
  const stopGenerating = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  // ── Clear chat ────────────────────────────────────────────────────────
  const clearChat = useCallback(() => {
    setMessages([{ ...GREETING, ts: Date.now() }]);
    setStreamText('');
    try { sessionStorage.removeItem('amber-chat'); } catch { /* ignore */ }
  }, []);

  // ── Copy message ──────────────────────────────────────────────────────
  const [copiedIdx, setCopiedIdx] = useState(null);
  const copyMessage = useCallback(async (text, idx) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch { /* clipboard may not be available */ }
  }, []);

  // ── Voice: conversation mode — click once, keep talking ──────────────
  const startRecSession = useCallback(() => {
    const rec = createRecognizer();
    if (!rec) return;

    if (recognizerRef.current) {
      try { recognizerRef.current.onend = null; recognizerRef.current.abort(); } catch {}
    }
    recognizerRef.current = rec;
    let committed = false;

    rec.onstart = () => { setListening(true); setLiveTranscript(''); };

    rec.onresult = (e) => {
      if (committed) return;
      const last = e.results[e.results.length - 1];
      if (last.isFinal) {
        const text = last[0].transcript.trim();
        committed = true;
        setListening(false);
        setLiveTranscript('');
        if (text) send(text, { forceVoice: true });
      } else {
        setLiveTranscript(last[0].transcript);
      }
      restartCountRef.current = 0;
    };

    rec.onerror = (e) => {
      if (wantListeningRef.current && (e.error === 'no-speech' || e.error === 'aborted')) {
        return; // will auto-restart via onend
      }
      wantListeningRef.current = false;
      setConversing(false);
      setListening(false);
      setLiveTranscript('');
    };

    rec.onend = () => {
      if (wantListeningRef.current) {
        restartCountRef.current++;
        if (restartCountRef.current > 20) {
          wantListeningRef.current = false;
          setConversing(false);
          setListening(false);
          return;
        }
        setTimeout(() => {
          if (wantListeningRef.current) {
            try { startRecSession(); } catch {
              wantListeningRef.current = false;
              setConversing(false);
              setListening(false);
            }
          }
        }, 120);
        return;
      }
      setListening(false);
    };

    rec.start();
    setListening(true);
  }, [send]);

  // Toggle conversation mode on/off
  const toggleConversation = useCallback(() => {
    if (conversing) {
      // Stop conversation mode
      wantListeningRef.current = false;
      setConversing(false);
      if (recognizerRef.current) {
        try { recognizerRef.current.stop(); } catch {}
        recognizerRef.current = null;
      }
      setListening(false);
      setLiveTranscript('');
    } else {
      // Start conversation mode
      wantListeningRef.current = true;
      restartCountRef.current = 0;
      setConversing(true);
      startRecSession();
    }
  }, [conversing, startRecSession]);

  // Keep refs current — breaks the circular dep chain
  startRecSessionRef.current = startRecSession;
  resumeListeningAfterReplyRef.current = () => {
    if (!wantListeningRef.current || !voiceSupported) return;
    restartCountRef.current = 0;
    setTimeout(() => {
      if (wantListeningRef.current) startRecSessionRef.current?.();
    }, RESUME_DELAY_MS);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      if (recognizerRef.current) { try { recognizerRef.current.stop(); } catch {} }
      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
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

  const scrollToBottom = () => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  };

  const panelClass = `apa-panel${expanded ? ' apa-panel--expanded' : ''}`;

  return (
    <div className={`apa-root${open ? ' open' : ''}`}>

      {open && (
        <div className="apa-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      {open && (
        <div className={panelClass}>
          <div className="apa-panel-header">
            <div className="apa-panel-title">
              <svg className="apa-panel-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Amber
              {conversing && <span className="apa-listening-badge">{listening ? '● listening' : '● conversing'}</span>}
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

            {/* Expand / collapse */}
            <button
              className="apa-close"
              onClick={() => setExpanded(e => !e)}
              aria-label={expanded ? 'Collapse' : 'Expand'}
              title={expanded ? 'Collapse panel' : 'Expand to full screen'}
              style={{ marginLeft: 0 }}
            >
              {expanded ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              )}
            </button>

            {/* Clear chat */}
            <button
              className="apa-close"
              onClick={clearChat}
              aria-label="Clear chat"
              title="Clear conversation"
              style={{ marginLeft: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>

            <button className="apa-close" onClick={() => setOpen(false)} aria-label="Close" title="Close (Esc)">
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
                  {msg.role === 'assistant' ? (
                    <p className="apa-msg-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                  ) : (
                    <p className="apa-msg-text">{msg.text}</p>
                  )}
                  {msg.nextBestAction && (
                    <p className="apa-msg-nba">{'\u2192'} {msg.nextBestAction}</p>
                  )}
                  <div className="apa-msg-meta">
                    {msg.ts && <span className="apa-msg-time">{timeAgo(msg.ts)}</span>}
                    {msg.action && !msg.error && (
                      <span className="apa-msg-tag">{msg.action.replace(/_/g, ' ')}</span>
                    )}
                    {msg.role === 'assistant' && !msg.error && i > 0 && (
                      <button
                        className="apa-msg-copy"
                        onClick={() => copyMessage(msg.text, i)}
                        title="Copy message"
                      >
                        {copiedIdx === i ? '\u2713' : '\u2398'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Streaming text — shown while Amber is typing */}
            {sending && streamText && (
              <div className="apa-msg apa-msg--assistant">
                <span className="apa-msg-avatar">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </span>
                <div className="apa-msg-body">
                  <p className="apa-msg-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(streamText) }} />
                </div>
              </div>
            )}

            {/* Thinking dots — shown before any tokens arrive */}
            {sending && !streamText && (
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

            {/* Live transcript bubble — voice input */}
            {listening && liveTranscript && (
              <div className="apa-msg apa-msg--user apa-msg--live">
                <div className="apa-msg-body">
                  <p className="apa-msg-text">{liveTranscript}</p>
                </div>
              </div>
            )}
          </div>

          {/* Scroll-to-bottom indicator */}
          {showScrollBtn && (
            <button className="apa-scroll-bottom" onClick={scrollToBottom} title="Jump to latest">
              {'\u2193'}
            </button>
          )}

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

          <AmberPromptLibrary onSelect={(text) => send(text)} />

          <div className="apa-input-row">
            <textarea
              ref={inputRef}
              className="apa-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={conversing ? (listening ? 'Listening...' : 'Amber is thinking...') : 'Tell me what to do...'}
              rows={2}
              disabled={sending || conversing}
            />

            {/* Stop button — shown while streaming */}
            {sending && (
              <button
                className="apa-stop"
                onClick={stopGenerating}
                aria-label="Stop generating"
                title="Stop generating"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            )}

            {/* Mic button — click to toggle conversation mode */}
            {voiceSupported && !sending && (
              <button
                className={`apa-mic${conversing ? ' apa-mic--active' : ''}${listening ? ' apa-mic--listening' : ''}`}
                onClick={toggleConversation}
                disabled={sending}
                aria-label={conversing ? 'End conversation' : 'Start conversation'}
                title={conversing ? 'Click to end conversation' : 'Click to start voice conversation'}
              >
                {conversing ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="2"  x2="12" y2="22" />
                    <line x1="7"  y1="6"  x2="7"  y2="18" />
                    <line x1="17" y1="6"  x2="17" y2="18" />
                    <line x1="3"  y1="10" x2="3"  y2="14" />
                    <line x1="21" y1="10" x2="21" y2="14" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="2" width="6" height="11" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                    <line x1="9"  y1="22" x2="15" y2="22" />
                  </svg>
                )}
              </button>
            )}

            {!sending && (
              <button
                className="apa-send"
                onClick={() => send(input)}
                disabled={!input.trim() || conversing}
                aria-label="Send"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Voice hint — shown once, below input */}
          {voiceSupported && messages.length === 1 && (
            <p className="apa-voice-hint">Click the mic to start a conversation. Amber listens, replies, then listens again. Click to stop.</p>
          )}
        </div>
      )}

      {!open && (
        <button
          className="apa-trigger"
          onClick={() => setOpen(true)}
          title="Talk to Amber (Ctrl+Shift+A)"
          aria-label="Talk to Amber"
        >
          <span className="apa-trigger-letter">A</span>
          {hasUnread && <span className="apa-unread-dot" />}
        </button>
      )}
    </div>
  );
}
