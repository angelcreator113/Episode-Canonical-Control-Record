import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import './SetupWizard.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export const startOnboardingApi = (payload = {}) =>
  apiClient.post(`${API_BASE}/onboarding/start`, payload).then((r) => r.data);
export const respondOnboardingApi = (payload) =>
  apiClient.post(`${API_BASE}/onboarding/respond`, payload).then((r) => r.data);
export const confirmOnboardingApi = (payload) =>
  apiClient.post(`${API_BASE}/onboarding/confirm`, payload).then((r) => r.data);

// ─── Beat metadata ────────────────────────────────────────────────────────────
const BEATS = [
  { id: 1, name: 'The World',       icon: '◎' },
  { id: 2, name: 'The Protagonist', icon: '♛' },
  { id: 3, name: 'The Wound',       icon: '◈' },
  { id: 4, name: 'The People',      icon: '⊕' },
  { id: 5, name: 'The Engine',      icon: '◆' },
  { id: 6, name: 'The Franchise',   icon: '✦' },
  { id: 7, name: 'Confirmation',    icon: '✓' },
];

// ─── Build panel item ─────────────────────────────────────────────────────────
function BuildItem({ item, index }) {
  return (
    <div
      className="sw-build-item"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className={`sw-build-icon sw-build-type-${item.type}`}>
        {item.type === 'universe'     && '◎'}
        {item.type === 'protagonist'  && '♛'}
        {item.type === 'character'    && '◉'}
        {item.type === 'relationship' && '⊕'}
        {item.type === 'world'        && '◆'}
        {item.type === 'book'         && '📖'}
      </div>
      <div className="sw-build-label">{item.label}</div>
    </div>
  );
}

// ─── Beat progress strip ──────────────────────────────────────────────────────
function BeatStrip({ currentBeat, completedBeats }) {
  return (
    <div className="sw-beat-strip">
      {BEATS.map((beat) => {
        const isComplete = completedBeats.includes(beat.id);
        const isCurrent  = currentBeat === beat.id;
        return (
          <div
            key={beat.id}
            className={`sw-beat-pip ${isComplete ? 'complete' : ''} ${isCurrent ? 'current' : ''}`}
            title={beat.name}
          >
            <div className="sw-beat-pip-dot">
              {isComplete ? '✓' : beat.icon}
            </div>
            <div className="sw-beat-pip-label">{beat.name}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function Message({ msg }) {
  return (
    <div className={`sw-message sw-message-${msg.role}`}>
      {msg.role === 'assistant' && (
        <div className="sw-message-avatar">P</div>
      )}
      <div className="sw-message-bubble">
        {msg.content}
      </div>
    </div>
  );
}

// ─── Session Launcher (post-setup) ───────────────────────────────────────────
function SessionLauncher({ built, extracted, onEnter }) {
  return (
    <div className="sw-launcher">
      <div className="sw-launcher-glow" />

      <div className="sw-launcher-universe">
        {extracted?.universe_name || 'Your Universe'}
      </div>

      <div className="sw-launcher-title">
        Your world is ready.
      </div>

      <div className="sw-launcher-protagonist">
        <span className="sw-launcher-icon">♛</span>
        {extracted?.protagonist_name || 'Your protagonist'} is waiting.
      </div>

      {built?.cast_shells?.length > 0 && (
        <div className="sw-launcher-cast">
          {built.cast_shells.map((c, i) => (
            <div key={i} className="sw-launcher-cast-pill">
              <span className="sw-launcher-cast-name">{c.name}</span>
              <span className="sw-launcher-cast-role">{c.role_type}</span>
            </div>
          ))}
        </div>
      )}

      <div className="sw-launcher-next">
        <div className="sw-launcher-next-label">Your first step</div>
        <div className="sw-launcher-next-action">Write Chapter 1</div>
      </div>

      <button className="sw-launcher-btn" onClick={onEnter}>
        Enter Prime Studios →
      </button>
    </div>
  );
}

// ─── Main SetupWizard ─────────────────────────────────────────────────────────
export default function SetupWizard({ showId, registryId, onComplete }) {
  const navigate = useNavigate();

  // Conversation state
  const [messages, setMessages]             = useState([]);
  const [input, setInput]                   = useState('');
  const [sending, setSending]               = useState(false);
  const [conversationId, setConversationId] = useState(null);

  // Beat tracking
  const [currentBeat, setCurrentBeat]       = useState(1);
  const [completedBeats, setCompletedBeats] = useState([]);

  // Extraction accumulator
  const [extracted, setExtracted]           = useState({});

  // Build panel
  const [buildItems, setBuildItems]         = useState([]);

  // Phase: 'conversation' | 'confirming' | 'building' | 'done'
  const [phase, setPhase]                   = useState('conversation');
  const [built, setBuilt]                   = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start wizard on mount
  useEffect(() => {
    startWizard();
  }, []);

  async function startWizard() {
    setSending(true);
    try {
      const data = await startOnboardingApi({});
      setConversationId(data.conversation_id);
      setMessages([{ role: 'assistant', content: data.message }]);
      setCurrentBeat(data.beat || 1);
    } catch (e) {
      setMessages([{
        role: 'assistant',
        content: "Let's start with the world your story lives in. Not what happens in it — just what it feels like to be inside it. How would you describe it?",
      }]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  // Build message history for API
  function buildHistory() {
    const history = [];
    for (const msg of messages) {
      history.push({ role: msg.role, content: msg.content });
    }
    return history;
  }

  async function handleSend() {
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput('');
    setSending(true);

    const updatedMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(updatedMessages);

    try {
      const data = await respondOnboardingApi({
        creator_message: userMessage,
        current_beat: currentBeat,
        conversation_history: buildHistory(),
        extracted_so_far: extracted,
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);

      if (data.extracted && Object.keys(data.extracted).length > 0) {
        setExtracted((prev) => ({ ...prev, ...data.extracted }));
      }

      if (data.build_update?.type) {
        setBuildItems((prev) => [...prev, {
          type:  data.build_update.type,
          label: data.build_update.label,
          data:  data.build_update.data,
        }]);
      }

      if (data.beat_complete) {
        setCompletedBeats((prev) => [...new Set([...prev, currentBeat])]);
        if (data.next_beat) {
          setCurrentBeat(data.next_beat);
        }
      }

      if (data.beat === 7 && data.beat_complete) {
        setPhase('confirming');
      }

    } catch (e) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: "Tell me more about that.",
      }]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleConfirm() {
    setPhase('building');

    try {
      const data = await confirmOnboardingApi({
        extracted,
        show_id:      showId,
        registry_id:  registryId,
      });
      setBuilt(data.built);
      setPhase('done');

    } catch (e) {
      console.error('confirm error:', e);
      setPhase('done');
      setBuilt({});
    }
  }

  function handleEnter() {
    if (onComplete) onComplete(built);
    else navigate('/storyteller');
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="sw-page">

      {/* ── Done: Session Launcher ─────────────────────────────────────── */}
      {phase === 'done' && (
        <SessionLauncher built={built} extracted={extracted} onEnter={handleEnter} />
      )}

      {/* ── Building: animated progress ────────────────────────────────── */}
      {phase === 'building' && (
        <div className="sw-building">
          <div className="sw-building-ring" />
          <div className="sw-building-title">Building your world…</div>
          <div className="sw-building-sub">
            {extracted.universe_name && <span>{extracted.universe_name} · </span>}
            {extracted.protagonist_name && <span>{extracted.protagonist_name} · </span>}
            <span>Setting everything up</span>
          </div>
        </div>
      )}

      {/* ── Conversation + build panel ──────────────────────────────────── */}
      {(phase === 'conversation' || phase === 'confirming') && (
        <>
          <BeatStrip currentBeat={currentBeat} completedBeats={completedBeats} />

          <div className="sw-body">

            {/* Left: conversation */}
            <div className="sw-conversation-col">
              <div className="sw-conversation-header">
                <div className="sw-conversation-title">
                  {BEATS.find((b) => b.id === currentBeat)?.icon}{' '}
                  {BEATS.find((b) => b.id === currentBeat)?.name}
                </div>
                <div className="sw-conversation-step">
                  {currentBeat} of {BEATS.length}
                </div>
              </div>

              <div className="sw-messages">
                {messages.map((msg, i) => (
                  <Message key={i} msg={msg} />
                ))}
                {sending && (
                  <div className="sw-message sw-message-assistant">
                    <div className="sw-message-avatar">P</div>
                    <div className="sw-message-bubble sw-typing">
                      <span /><span /><span />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {phase === 'conversation' && (
                <div className="sw-input-area">
                  <textarea
                    ref={inputRef}
                    className="sw-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Tell me…"
                    rows={3}
                    disabled={sending}
                  />
                  <button
                    className="sw-send-btn"
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                  >
                    {sending ? '…' : '→'}
                  </button>
                </div>
              )}

              {phase === 'confirming' && (
                <div className="sw-confirm-area">
                  <div className="sw-confirm-prompt">
                    Does that sound like your story?
                  </div>
                  <div className="sw-confirm-actions">
                    <button
                      className="sw-btn sw-btn-edit"
                      onClick={() => setPhase('conversation')}
                    >
                      Something's wrong — keep going
                    </button>
                    <button
                      className="sw-btn sw-btn-confirm"
                      onClick={handleConfirm}
                    >
                      Yes — build my world
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: build panel */}
            <div className="sw-build-col">
              <div className="sw-build-header">Your world, assembling</div>

              {buildItems.length === 0 && (
                <div className="sw-build-empty">
                  As you talk, your world appears here.
                </div>
              )}

              <div className="sw-build-items">
                {buildItems.map((item, i) => (
                  <BuildItem key={i} item={item} index={i} />
                ))}
              </div>

              {completedBeats.includes(2) && (
                <div className="sw-extracted-summary">
                  {extracted.universe_name && (
                    <div className="sw-extracted-field">
                      <div className="sw-extracted-label">Universe</div>
                      <div className="sw-extracted-value">{extracted.universe_name}</div>
                    </div>
                  )}
                  {extracted.protagonist_name && (
                    <div className="sw-extracted-field">
                      <div className="sw-extracted-label">Protagonist</div>
                      <div className="sw-extracted-value">{extracted.protagonist_name}</div>
                    </div>
                  )}
                  {extracted.protagonist_wound && (
                    <div className="sw-extracted-field">
                      <div className="sw-extracted-label">Her wound</div>
                      <div className="sw-extracted-value sw-italic">{extracted.protagonist_wound}</div>
                    </div>
                  )}
                  {extracted.desire_line && (
                    <div className="sw-extracted-field">
                      <div className="sw-extracted-label">What she wants</div>
                      <div className="sw-extracted-value">{extracted.desire_line}</div>
                    </div>
                  )}
                  {extracted.fear_line && (
                    <div className="sw-extracted-field">
                      <div className="sw-extracted-label">What she fears</div>
                      <div className="sw-extracted-value">{extracted.fear_line}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
