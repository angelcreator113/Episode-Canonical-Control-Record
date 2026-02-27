/**
 * CharacterVoiceMode.jsx
 * frontend/src/pages/CharacterVoiceMode.jsx
 *
 * ════════════════════════════════════════════════════════════════════════
 * TWO MODES IN ONE COMPONENT
 * ════════════════════════════════════════════════════════════════════════
 *
 * MODE 1 — CHARACTER VOICE (deep session)
 * ─────────────────────────────────────────
 * The character plays itself. Claude loads everything confirmed in the
 * profile — dossier, memories, sensory anchor, contradictions, private
 * self — and speaks as the character in their own voice.
 *
 * You stop describing the character. You talk TO them.
 * "Chloe, what did you actually think when you saw JustAWoman's numbers?"
 *
 * When the character says something wrong, you correct it:
 * "No — she wouldn't say it like that."
 * That correction is the most revealing thing in the whole session.
 * It goes straight into the profile as a voice calibration note.
 *
 * When the character reveals something new — a detail you didn't know —
 * you can confirm it and it writes to their profile.
 *
 * MODE 2 — CHARACTER CHECK-IN (pre-writing warm-up)
 * ─────────────────────────────────────────────────
 * 3–5 exchanges before writing a chapter. Quick. Purposeful.
 * The character reminds you how they think. You go into the scene
 * already inside their head.
 *
 * Triggered from the Book Editor "Who's in this scene?" panel.
 * Shorter session, no profile updates. Just re-entry.
 *
 * ════════════════════════════════════════════════════════════════════════
 * CANON PROTECTION
 * ════════════════════════════════════════════════════════════════════════
 * Everything the character "says" is clearly framed as AI playing the
 * character. Nothing enters the manuscript automatically. Nothing enters
 * the profile without explicit confirmation. The author always decides
 * what is true.
 *
 * ════════════════════════════════════════════════════════════════════════
 * USAGE
 * ════════════════════════════════════════════════════════════════════════
 *
 * From Character Registry (deep session):
 *   <CharacterVoiceMode
 *     character={character}
 *     mode="voice"
 *     open={voiceOpen}
 *     onClose={() => setVoiceOpen(false)}
 *     onProfileUpdate={(updates) => refreshCharacter()}
 *   />
 *
 * From Book Editor (check-in):
 *   <CharacterVoiceMode
 *     character={character}
 *     mode="checkin"
 *     chapterContext={chapterBrief}
 *     open={checkinOpen}
 *     onClose={() => setCheckinOpen(false)}
 *   />
 */

import { useState, useRef, useEffect } from 'react';
import { useVoice, MicButton, SpeakButton } from '../hooks/VoiceLayer';

const MEMORIES_API = '/api/v1/memories';
const REGISTRY_API = '/api/v1/character-registry';

// ── Type color map ────────────────────────────────────────────────────────
function typeColor(type) {
  return {
    protagonist: '#C9A84C',
    pressure:    '#B85C38',
    mirror:      '#7B5EA7',
    support:     '#4A7C59',
    shadow:      '#8B6914',
    special:     '#C9A84C',
  }[type] || '#C9A84C';
}

// ════════════════════════════════════════════════════════════════════════
export default function CharacterVoiceMode({
  character,
  mode = 'voice',       // 'voice' | 'checkin'
  chapterContext = null, // only used in checkin mode
  open,
  onClose,
  onProfileUpdate,
}) {
  const [messages, setMessages]               = useState([]);
  const [input, setInput]                     = useState('');
  const [step, setStep]                       = useState('intro'); // intro | active | correction | newdetail | closing
  const [sending, setSending]                 = useState(false);
  const [exchangeCount, setExchangeCount]     = useState(0);
  const [pendingCorrection, setPendingCorrection] = useState(null);
  const [pendingNewDetail, setPendingNewDetail]   = useState(null);
  const [saving, setSaving]                   = useState(false);
  const [sessionNotes, setSessionNotes]       = useState([]);

  const bottomRef = useRef(null);
  const { speak, startListening, stopListening, listening } = useVoice();

  const charName  = character?.selected_name || character?.display_name || 'this character';
  const roleType  = character?.role_type || 'special';
  const accentColor = typeColor(roleType);

  const isCheckin  = mode === 'checkin';
  const maxExchanges = isCheckin ? 5 : 999; // checkin caps at 5

  // ── Reset on open ────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      const intro = isCheckin
        ? `You’re about to write a scene with ${charName}.\n\nI’m going to be ${charName} for the next few minutes. Ask me anything — what I’m thinking, how I’d react, what I’d say. Let’s make sure you’re inside my head before you start writing.`
        : `I’m going to speak as ${charName} now.\n\nEverything I say is drawn from their confirmed profile — but I’m still an AI playing a role. When I get something wrong, tell me. That correction is more valuable than anything I could get right.\n\nAsk me anything. I’m ${charName}.`;

      setMessages([{ role: 'character', text: intro }]);
      setInput('');
      setStep('intro');
      setExchangeCount(0);
      setPendingCorrection(null);
      setPendingNewDetail(null);
      setSaving(false);
      setSessionNotes([]);
    }
  }, [open, character?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-speak character messages
  useEffect(() => {
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === 'character' && last.text) {
        speak(last.text);
      }
    }
  }, [messages]); // eslint-disable-line

  function handleMicResult(text, meta) {
    setInput(text);
    if (meta?.isFinal && text.trim() && step === 'active' && !sending) {
      setTimeout(() => handleSendText(text.trim()), 80);
    }
  }

  function handleStart() {
    setStep('active');
  }

  async function handleSend() {
    if (!input.trim()) return;
    await handleSendText(input.trim());
  }

  async function handleSendText(userMessage) {
    if (!userMessage || sending) return;
    setInput('');
    setSending(true);

    const newMessages = [...messages, { role: 'author', text: userMessage }];
    setMessages(newMessages);

    const newCount = exchangeCount + 1;
    setExchangeCount(newCount);

    // Check-in mode: wrap up after max exchanges
    if (isCheckin && newCount >= maxExchanges) {
      await getCharacterResponse(newMessages, userMessage, { isClosing: true });
      setStep('closing');
    } else {
      await getCharacterResponse(newMessages, userMessage, {});
    }

    setSending(false);
  }

  async function getCharacterResponse(currentMessages, latestAuthorMessage, options = {}) {
    try {
      const history = currentMessages
        .filter(m => m.role === 'author' || m.role === 'character')
        .map(m => ({ role: m.role, text: m.text }));

      const res = await fetch(`${MEMORIES_API}/character-voice-session`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id:      character.id,
          character_name:    charName,
          character_type:    roleType,
          character_profile: buildProfileSummary(character),
          mode,
          chapter_context:   chapterContext || null,
          conversation:      history,
          latest_message:    latestAuthorMessage,
          is_closing:        options.isClosing || false,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Add character's response to chat
      setMessages(prev => [...prev, {
        role:    'character',
        text:    data.response,
        meta:    data.meta || null,
      }]);

      // If character revealed a new detail, surface it for confirmation
      if (data.new_detail_detected) {
        setPendingNewDetail(data.new_detail_detected);
        setStep('newdetail');
      }

    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'character',
        text: `[Voice interrupted — ${err.message}]`,
      }]);
    }
  }

  // ── Correction flow ──────────────────────────────────────────────────
  function handleCorrectionStart() {
    setStep('correction');
    setMessages(prev => [...prev, {
      role: 'system_prompt',
      text: `Tell me what I got wrong. How would ${charName} actually respond?`,
    }]);
  }

  async function handleCorrectionSubmit() {
    if (!input.trim()) return;
    const correction = input.trim();
    setInput('');

    // Save as voice calibration note
    const note = { type: 'voice_correction', text: correction, timestamp: new Date().toISOString() };
    setSessionNotes(prev => [...prev, note]);

    setMessages(prev => [...prev, {
      role: 'author',
      text: correction,
    }, {
      role: 'system_note',
      text: `✓ Voice correction noted. Continuing as ${charName} with that calibration.`,
    }]);

    setStep('active');

    // Send the correction back as context so Claude adjusts
    await getCharacterResponse([...messages, { role: 'author', text: correction }], correction, {
      isCorrectionContext: true,
    });
  }

  // ── New detail confirmation ──────────────────────────────────────────
  async function confirmNewDetail() {
    if (!pendingNewDetail) return;
    setSaving(true);
    try {
      // Write to character profile as a writer_note addition
      const currentNotes = character.personality || '';
      const updated = currentNotes
        ? `${currentNotes}\n\n[Voice session discovery] ${pendingNewDetail}`
        : `[Voice session discovery] ${pendingNewDetail}`;

      await fetch(`${REGISTRY_API}/characters/${character.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ personality: updated }),
      });

      setMessages(prev => [...prev, {
        role: 'system_note',
        text: `✓ Added to ${charName}’s profile: “${pendingNewDetail}”`,
      }]);

      onProfileUpdate?.();
    } catch (err) {
      console.error('Failed to save detail:', err);
    } finally {
      setSaving(false);
      setPendingNewDetail(null);
      setStep('active');
    }
  }

  function dismissNewDetail() {
    setPendingNewDetail(null);
    setStep('active');
  }

  // ── Session close — save voice calibration notes ─────────────────────
  async function handleClose() {
    if (sessionNotes.length > 0 && !isCheckin) {
      // Batch-save all voice calibration notes to character profile
      try {
        const currentNotes = character.personality || '';
        const newNotes = sessionNotes
          .map(n => `[${n.type === 'voice_correction' ? 'Voice calibration' : 'Note'}] ${n.text}`)
          .join('\n');
        const updated = currentNotes
          ? `${currentNotes}\n\n${newNotes}`
          : newNotes;

        await fetch(`${REGISTRY_API}/characters/${character.id}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ personality: updated }),
        });
        onProfileUpdate?.();
      } catch (err) {
        console.error('Failed to save session notes:', err);
      }
    }
    onClose();
  }

  if (!open) return null;

  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && handleClose()}>
      <div style={st.modal}>

        {/* ── Header ────────────────────────────────────────────────── */}
        <div style={{ ...st.header, borderBottomColor: `${accentColor}22` }}>
          <div>
            <div style={{ ...st.headerMode, color: accentColor }}>
              {isCheckin ? 'CHARACTER CHECK-IN' : 'CHARACTER VOICE MODE'}
            </div>
            <div style={st.headerTitle}>{charName}</div>
            <div style={{ ...st.headerRole, color: accentColor }}>{roleType}</div>
          </div>
          <div style={st.headerRight}>
            {!isCheckin && step === 'active' && (
              <button
                style={{ ...st.correctionBtn, borderColor: `${accentColor}40`, color: accentColor }}
                onClick={handleCorrectionStart}
              >
                Wrong voice — correct it
              </button>
            )}
            <button style={st.closeBtn} onClick={handleClose}>{'✕'}</button>
          </div>
        </div>

        {/* ── Canon reminder strip ───────────────────────────────────── */}
        <div style={st.canonStrip}>
          <span style={st.canonDot} />
          <span style={st.canonText}>
            AI is playing {charName} from their confirmed profile.
            Nothing enters the manuscript or profile without your confirmation.
          </span>
        </div>

        {/* ── Chat window ───────────────────────────────────────────── */}
        <div style={st.chatWindow}>
          {messages.map((msg, i) => (
            <VoiceMessage
              key={i}
              message={msg}
              charName={charName}
              accentColor={accentColor}
            />
          ))}

          {/* New detail confirmation card */}
          {step === 'newdetail' && pendingNewDetail && (
            <div style={{ ...st.detailCard, borderColor: `${accentColor}40` }}>
              <div style={{ ...st.detailLabel, color: accentColor }}>
                {'✦'} NEW DETAIL EMERGED
              </div>
              <div style={st.detailText}>{'“'}{pendingNewDetail}{'”'}</div>
              <div style={st.detailSub}>
                {charName} revealed something that isn{'’'}t in their profile yet.
                Confirm to add it. Dismiss if it doesn{'’'}t feel true.
              </div>
              <div style={st.detailActions}>
                <button style={st.secondaryBtn} onClick={dismissNewDetail}>
                  Doesn{'’'}t feel right
                </button>
                <button
                  style={{ ...st.primaryBtn, background: accentColor, opacity: saving ? 0.6 : 1 }}
                  onClick={confirmNewDetail}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : `Add to ${charName}’s profile →`}
                </button>
              </div>
            </div>
          )}

          {/* Check-in closing */}
          {step === 'closing' && (
            <div style={st.closingCard}>
              <div style={{ ...st.closingLabel, color: accentColor }}>
                YOU{'’'}RE READY
              </div>
              <div style={st.closingText}>
                You{'’'}ve been inside {charName}{'’'}s head. Go write the scene.
              </div>
              <button
                style={{ ...st.primaryBtn, background: accentColor, marginTop: 12 }}
                onClick={handleClose}
              >
                Start writing {'→'}
              </button>
            </div>
          )}

          {sending && (
            <div style={st.typingRow}>
              <div style={{ ...st.typingLabel, color: accentColor }}>{charName}</div>
              <div style={st.typingIndicator}>
                {[0,1,2].map(i => (
                  <span key={i} style={{ ...st.typingDot, animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input ─────────────────────────────────────────────────── */}
        {step === 'intro' && (
          <div style={st.inputRow}>
            <button
              style={{ ...st.primaryBtn, background: accentColor }}
              onClick={handleStart}
            >
              {isCheckin
                ? `Talk to ${charName} before writing →`
                : `Talk to ${charName} →`}
            </button>
          </div>
        )}

        {(step === 'active' || step === 'correction') && (
          <>
            <div style={st.inputRow}>
              <textarea
                style={{
                  ...st.chatInput,
                  borderColor: listening
                    ? 'rgba(184,92,56,0.45)'
                    : 'rgba(30,25,20,0.1)',
                }}
                placeholder={
                  step === 'correction'
                    ? `How would ${charName} actually respond?`
                    : listening
                      ? 'Listening…'
                      : `Talk to ${charName}…`
                }
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    step === 'correction' ? handleCorrectionSubmit() : handleSend();
                  }
                }}
                rows={3}
                autoFocus
                spellCheck
              />
              <MicButton
                listening={listening}
                onStart={() => startListening(handleMicResult)}
                onStop={stopListening}
              />
              <button
                style={{
                  ...st.sendBtn,
                  background: accentColor,
                  opacity: !input.trim() || sending ? 0.5 : 1,
                }}
                onClick={step === 'correction' ? handleCorrectionSubmit : handleSend}
                disabled={!input.trim() || sending}
              >
                {'→'}
              </button>
            </div>
            <div style={st.cmdHint}>
              {isCheckin
                ? `${Math.max(0, maxExchanges - exchangeCount)} exchanges left · Ctrl + Enter to send`
                : 'Ctrl + Enter to send · 🎤 to speak'}
            </div>
          </>
        )}

      </div>

      <style>{`
        @keyframes cvm-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50%       { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ── Build a profile summary for the system prompt ────────────────────────
function buildProfileSummary(character) {
  const parts = [];
  if (character.description)       parts.push(`WHO THEY ARE: ${character.description}`);
  if (character.core_belief)       parts.push(`CORE BELIEF: ${character.core_belief}`);
  if (character.pressure_type)     parts.push(`EMOTIONAL FUNCTION: ${character.pressure_type}`);
  if (character.sensory_anchor)    parts.push(`SENSORY ANCHOR: ${character.sensory_anchor}`);
  if (character.private_self)      parts.push(`PRIVATE SELF: ${character.private_self}`);
  if (character.unspoken_reaction) parts.push(`WHAT JUSTAWOMAN WON'T SAY ABOUT THEM: ${character.unspoken_reaction}`);
  if (character.personality)       parts.push(`WRITER NOTES: ${character.personality}`);
  if (character.role_type)         parts.push(`TYPE: ${character.role_type}`);
  if (character.appearance_mode)   parts.push(`APPEARANCE MODE: ${character.appearance_mode}`);
  return parts.join('\n\n');
}

// ── VoiceMessage sub-component ───────────────────────────────────────────
function VoiceMessage({ message, charName, accentColor }) {
  if (message.role === 'system_note') {
    return (
      <div style={{
        ...st.systemNote,
        color: accentColor,
        borderLeftColor: `${accentColor}50`,
        background: `${accentColor}08`,
      }}>
        {message.text}
      </div>
    );
  }

  if (message.role === 'system_prompt') {
    return (
      <div style={st.systemPrompt}>{message.text}</div>
    );
  }

  const isCharacter = message.role === 'character';

  return (
    <div style={{
      ...st.message,
      alignSelf: isCharacter ? 'flex-start' : 'flex-end',
    }}>
      {isCharacter && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <div style={{ ...st.speakerLabel, color: accentColor }}>{charName}</div>
          <SpeakButton text={message.text} size="small" />
        </div>
      )}
      {!isCharacter && (
        <div style={st.authorLabel}>YOU</div>
      )}
      <div style={{
        ...st.messageBubble,
        background:   isCharacter ? 'white' : 'rgba(201,168,76,0.08)',
        borderColor:  isCharacter ? `${accentColor}25` : 'rgba(201,168,76,0.2)',
        borderLeftWidth: isCharacter ? 3 : 1,
        borderLeftColor: isCharacter ? accentColor : 'rgba(201,168,76,0.2)',
      }}>
        {message.text}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const st = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(14,10,8,0.72)',
    backdropFilter: 'blur(6px)',
    zIndex: 500,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24,
  },
  modal: {
    background: '#0f0c09',
    border: '1px solid rgba(201,168,76,0.15)',
    borderRadius: 4,
    width: 660, maxWidth: '100%', maxHeight: '88vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '20px 24px 16px',
    borderBottom: '1px solid',
    flexShrink: 0,
  },
  headerMode: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    letterSpacing: '0.2em', marginBottom: 4,
  },
  headerTitle: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 22, fontStyle: 'italic', color: 'rgba(245,240,232,0.9)', marginBottom: 3,
  },
  headerRole: {
    fontFamily: 'DM Mono, monospace', fontSize: 8, letterSpacing: '0.1em',
  },
  headerRight: {
    display: 'flex', alignItems: 'center', gap: 10,
  },
  correctionBtn: {
    background: 'none', border: '1px solid',
    borderRadius: 2, cursor: 'pointer',
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    letterSpacing: '0.08em', padding: '5px 10px',
    transition: 'opacity 0.15s',
  },
  closeBtn: {
    background: 'none', border: 'none',
    color: 'rgba(245,240,232,0.25)', fontSize: 15,
    cursor: 'pointer', padding: 4,
  },
  canonStrip: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 24px',
    background: 'rgba(201,168,76,0.04)',
    borderBottom: '1px solid rgba(201,168,76,0.08)',
    flexShrink: 0,
  },
  canonDot: {
    width: 5, height: 5, borderRadius: '50%',
    background: 'rgba(201,168,76,0.4)', flexShrink: 0,
  },
  canonText: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    color: 'rgba(201,168,76,0.5)', letterSpacing: '0.05em', lineHeight: 1.5,
  },
  chatWindow: {
    flex: 1, overflowY: 'auto', padding: '20px 24px',
    display: 'flex', flexDirection: 'column', gap: 16,
    minHeight: 300, maxHeight: 440,
  },
  message: {
    display: 'flex', flexDirection: 'column', gap: 3, maxWidth: '88%',
  },
  speakerLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 7, letterSpacing: '0.16em',
  },
  authorLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 7, letterSpacing: '0.16em',
    color: 'rgba(201,168,76,0.5)', alignSelf: 'flex-end',
  },
  messageBubble: {
    border: '1px solid', borderRadius: 3, padding: '10px 14px',
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 14, fontStyle: 'italic', color: 'rgba(245,240,232,0.82)',
    lineHeight: 1.7, whiteSpace: 'pre-wrap',
  },
  systemNote: {
    fontFamily: 'DM Mono, monospace', fontSize: 8.5,
    letterSpacing: '0.05em', lineHeight: 1.5,
    borderLeft: '2px solid', paddingLeft: 10,
    padding: '6px 10px', borderRadius: 2, alignSelf: 'center',
  },
  systemPrompt: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 13, fontStyle: 'italic',
    color: 'rgba(245,240,232,0.45)', alignSelf: 'center',
    textAlign: 'center', maxWidth: 400, lineHeight: 1.6,
  },
  typingRow: {
    display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
  },
  typingLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 7, letterSpacing: '0.12em',
  },
  typingIndicator: { display: 'flex', gap: 4 },
  typingDot: {
    width: 5, height: 5, borderRadius: '50%',
    background: 'rgba(201,168,76,0.5)', display: 'inline-block',
    animation: 'cvm-pulse 1.1s ease-in-out infinite',
  },
  detailCard: {
    border: '1px solid', borderRadius: 3,
    padding: '14px 16px',
    background: 'rgba(14,10,8,0.8)',
    display: 'flex', flexDirection: 'column', gap: 8,
    alignSelf: 'stretch',
  },
  detailLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 8, letterSpacing: '0.16em',
  },
  detailText: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 15, fontStyle: 'italic', color: 'rgba(245,240,232,0.85)',
    lineHeight: 1.65,
  },
  detailSub: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    color: 'rgba(245,240,232,0.35)', letterSpacing: '0.04em', lineHeight: 1.5,
  },
  detailActions: {
    display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4,
  },
  closingCard: {
    padding: '20px 24px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    alignSelf: 'stretch',
  },
  closingLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 8, letterSpacing: '0.2em',
  },
  closingText: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 15, fontStyle: 'italic', color: 'rgba(245,240,232,0.7)', lineHeight: 1.6,
  },
  inputRow: {
    display: 'flex', gap: 8, padding: '12px 24px',
    borderTop: '1px solid rgba(201,168,76,0.1)',
    alignItems: 'flex-end', flexShrink: 0,
  },
  chatInput: {
    flex: 1, background: 'rgba(255,255,255,0.04)',
    border: '1px solid', borderRadius: 2,
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 14, fontStyle: 'italic', color: 'rgba(245,240,232,0.82)',
    padding: '10px 12px', outline: 'none', resize: 'none', lineHeight: 1.6,
    transition: 'border-color 0.15s',
  },
  sendBtn: {
    border: 'none', borderRadius: 2,
    color: '#0f0c09', fontSize: 18, fontWeight: 700,
    padding: '10px 16px', cursor: 'pointer', flexShrink: 0,
    transition: 'opacity 0.12s',
  },
  cmdHint: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    color: 'rgba(245,240,232,0.18)', letterSpacing: '0.06em',
    textAlign: 'right', padding: '4px 24px 10px', flexShrink: 0,
  },
  primaryBtn: {
    border: 'none', borderRadius: 2,
    fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.12em',
    color: '#0f0c09', fontWeight: 600, padding: '10px 20px',
    cursor: 'pointer', transition: 'opacity 0.15s',
  },
  secondaryBtn: {
    background: 'none', border: '1px solid rgba(245,240,232,0.15)', borderRadius: 2,
    fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.1em',
    color: 'rgba(245,240,232,0.4)', padding: '9px 16px', cursor: 'pointer',
  },
};
