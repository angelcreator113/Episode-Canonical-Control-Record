/**
 * AppAssistant.jsx
 * Global AI assistant — bottom-right corner, always visible.
 * Sends every message with current app context so Claude knows
 * where you are and what's active.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import './AppAssistant.css';

const API = '/api/v1/memories/assistant-command';

const GREETING = {
  role: 'assistant',
  text: "I'm here. Tell me what you need — navigate, create, approve, or ask anything about your book.",
};

export default function AppAssistant({ appContext = {}, onNavigate, onRefresh }) {
  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input,    setInput]    = useState('');
  const [sending,  setSending]  = useState(false);
  const chatRef  = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, open]);

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

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

      // Handle side effects
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

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  // Unread dot
  const hasUnread = !open && messages.length > 1;

  return (
    <div className={`apa-root${open ? ' open' : ''}`}>

      {/* Chat panel */}
      {open && (
        <div className="apa-panel">
          <div className="apa-panel-header">
            <div className="apa-panel-title">
              <svg className="apa-panel-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Assistant
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
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
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
            {sending && (
              <div className="apa-msg apa-msg--assistant">
                <span className="apa-msg-avatar">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                </span>
                <div className="apa-thinking">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>

          {/* Quick commands */}
          {messages.length === 1 && (
            <div className="apa-quick-cmds">
              {[
                'Approve all pending lines',
                'Go to character registry',
                'How many pending lines?',
                'Open story planner',
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
              placeholder="Tell me what to do..."
              rows={2}
              disabled={sending}
            />
            <button
              className="apa-send"
              onClick={() => send(input)}
              disabled={sending || !input.trim()}
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating trigger button */}
      <button
        className="apa-trigger"
        onClick={() => setOpen(o => !o)}
        title="AI Assistant"
        aria-label="Open AI Assistant"
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

    </div>
  );
}
