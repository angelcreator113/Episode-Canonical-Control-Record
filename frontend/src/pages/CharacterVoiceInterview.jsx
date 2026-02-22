/**
 * CharacterVoiceInterview.jsx
 * frontend/src/pages/CharacterVoiceInterview.jsx
 *
 * Conversational character interview that:
 * 1. Builds character profile from author's own words
 * 2. Asks adaptive follow-up questions based on answers
 * 3. Surfaces plot threads from what the author reveals
 * 4. Saves profile + threads to DB
 *
 * Usage:
 *   import CharacterVoiceInterview from './CharacterVoiceInterview';
 *
 *   <CharacterVoiceInterview
 *     character={character}
 *     bookId={bookId}
 *     open={!!interviewTarget}
 *     onClose={() => setInterviewTarget(null)}
 *     onComplete={(profile, threads) => {
 *       updateCharacter(character.id, profile);
 *       addPlotThreads(threads);
 *     }}
 *   />
 */

import { useState, useRef, useEffect } from 'react';

const MEMORIES_API    = '/api/v1/memories';
const REGISTRY_API    = '/api/v1/character-registry';

// ── Opening questions per character type ─────────────────────────────────
const OPENING_QUESTIONS = {
  special:  [
    "Tell me about this character like you're describing them to a friend who's never met them.",
    "What does this character want more than anything — not in the story, right now in their life?",
    "What's the one thing this character would never do? And why does that matter?",
    "How does this character make other people feel when they walk into a room?",
    "What does this character know that nobody else in the story knows yet?",
  ],
  pressure: [
    "Tell me about this character. Who are they and what do they mean to the protagonist?",
    "What does this character do — even with good intentions — that creates pressure?",
    "Does the protagonist love this character, fear them, or both? Why?",
    "What would this character say if they could be completely honest with the protagonist?",
    "What scene involving this character would make a reader feel the most?",
  ],
  mirror: [
    "Tell me about this character. What do they represent to the protagonist?",
    "Is the protagonist jealous of them, inspired by them, or something more complicated?",
    "What does this character have that the protagonist wants — and what does the protagonist have that this character might secretly want?",
    "What happens in the story when this character fails at something?",
    "What's the scene where these two characters are most honest with each other?",
  ],
  support: [
    "Tell me about this character. What role do they play in the protagonist's life?",
    "How does this character show up for the protagonist — what do they actually do?",
    "What does this character see in the protagonist that the protagonist can't see in herself?",
    "Is there a moment where this character's support becomes complicated or conditional?",
    "What would the protagonist lose if this character disappeared from the story?",
  ],
  shadow: [
    "Tell me about this character. What part of the protagonist do they represent?",
    "What does this character do that the protagonist secretly wishes she could do?",
    "How does encountering this character change the protagonist — even temporarily?",
    "Is this character aware of the effect they have? Do they use it?",
    "What's the scene where the protagonist has to confront what this character represents?",
  ],
  protagonist: [
    "Tell me about this character like you're describing them to a friend who's never met them.",
    "What does this character want more than anything — not in the story, right now in their life?",
    "What's the one thing this character would never do? And why does that matter?",
    "How does this character make other people feel when they walk into a room?",
    "What does this character know that nobody else in the story knows yet?",
  ],
};

const DEFAULT_QUESTIONS = OPENING_QUESTIONS.special;

export default function CharacterVoiceInterview({
  character,
  bookId,
  open,
  onClose,
  onComplete,
}) {
  const [messages, setMessages]       = useState([]); // { role: 'system'|'user', text }
  const [input, setInput]             = useState('');
  const [step, setStep]               = useState('intro'); // intro | interview | generating | complete
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers]         = useState([]);
  const [nextQuestion, setNextQuestion] = useState(null); // Claude-generated follow-up
  const [generating, setGenerating]   = useState(false);
  const [result, setResult]           = useState(null);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);
  const bottomRef = useRef(null);

  const roleType  = character?.role_type || 'special';
  const questions = OPENING_QUESTIONS[roleType] || DEFAULT_QUESTIONS;
  const charName  = character?.selected_name || character?.display_name || 'this character';

  // Reset state when character changes
  useEffect(() => {
    if (open) {
      setMessages([{
        role: 'system',
        text: `Let's talk about ${charName}.\n\nI'm going to ask you some questions. Answer like you're talking to a friend — no right answers, no wrong answers. The more specific and honest you are, the better the profile and the stronger the story.\n\nReady when you are.`,
      }]);
      setInput('');
      setStep('intro');
      setQuestionIndex(0);
      setAnswers([]);
      setNextQuestion(null);
      setGenerating(false);
      setResult(null);
      setSaving(false);
      setError(null);
    }
  }, [open, character?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleStart() {
    setStep('interview');
    const firstQ = questions[0];
    setMessages(prev => [...prev, { role: 'system', text: firstQ }]);
  }

  async function handleSend() {
    if (!input.trim()) return;
    const userAnswer = input.trim();
    setInput('');

    // Add user answer to messages
    const newMessages = [...messages, { role: 'user', text: userAnswer }];
    setMessages(newMessages);

    const newAnswers = [...answers, {
      question: nextQuestion || questions[questionIndex],
      answer: userAnswer,
    }];
    setAnswers(newAnswers);

    const isLastBaseQuestion = questionIndex >= questions.length - 1;

    if (isLastBaseQuestion && newAnswers.length >= questions.length) {
      // Generate profile + threads
      await generateProfile(newAnswers, newMessages);
    } else {
      // Get next question — either base or Claude-generated follow-up
      await getNextQuestion(newAnswers, newMessages);
    }
  }

  async function getNextQuestion(currentAnswers, currentMessages) {
    setGenerating(true);
    try {
      const nextIndex = questionIndex + 1;
      setQuestionIndex(nextIndex);

      // After 2 answers, start generating adaptive follow-ups
      if (currentAnswers.length >= 2) {
        const res = await fetch(`${MEMORIES_API}/character-interview-next`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            book_id:        bookId || null,
            character_name: charName,
            character_type: roleType,
            answers_so_far: currentAnswers,
            next_base_question: questions[nextIndex] || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const q = data.question;
        setNextQuestion(q);
        setMessages(prev => [...prev, { role: 'system', text: q }]);

        // If a plot thread was detected early, show it as a hint
        if (data.thread_hint) {
          setMessages(prev => [...prev, {
            role: 'thread_hint',
            text: `✦ Plot thread detected: ${data.thread_hint}`,
          }]);
        }
      } else {
        // Use base question
        const q = questions[nextIndex];
        if (q) {
          setNextQuestion(q);
          setMessages(prev => [...prev, { role: 'system', text: q }]);
        }
      }
    } catch (err) {
      // Fall back to next base question
      const fallbackIndex = questionIndex + 1;
      const q = questions[fallbackIndex];
      if (q) {
        setMessages(prev => [...prev, { role: 'system', text: q }]);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function generateProfile(finalAnswers) {
    setStep('generating');
    setGenerating(true);
    try {
      const res = await fetch(`${MEMORIES_API}/character-interview-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id:        bookId || null,
          character_id:   character.id,
          character_name: charName,
          character_type: roleType,
          answers:        finalAnswers,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setStep('complete');
    } catch (err) {
      setError(err.message);
      setStep('interview');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    try {
      // Update character profile
      await fetch(`${REGISTRY_API}/characters/${character.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.profile),
      });

      onComplete?.(result.profile, result.threads);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={st.modal}>

        {/* Header */}
        <div style={st.header}>
          <div>
            <div style={st.headerLabel}>CHARACTER VOICE INTERVIEW</div>
            <div style={st.headerTitle}>{charName}</div>
            {roleType && (
              <div style={{ ...st.typeBadge, color: typeColor(roleType) }}>
                {roleType}
              </div>
            )}
          </div>
          <button style={st.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Generating state */}
        {step === 'generating' && (
          <div style={st.generatingBlock}>
            <div style={st.generatingDots}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  ...st.dot,
                  animationDelay: `${i * 0.3}s`,
                }} />
              ))}
            </div>
            <div style={st.generatingTitle}>
              Building {charName}'s profile…
            </div>
            <div style={st.generatingSub}>
              Reading everything you said. Finding the threads. Writing the psychology.
            </div>
          </div>
        )}

        {/* Complete state */}
        {step === 'complete' && result && (
          <div style={st.completeBlock}>
            <div style={st.completeHeader}>
              <div style={st.completeLabel}>PROFILE READY</div>
              <div style={st.completeTitle}>{charName}</div>
            </div>

            {/* Profile preview */}
            <div style={st.profilePreview}>
              {result.profile?.description && (
                <ProfileSection label='WHO THEY ARE' text={result.profile.description} />
              )}
              {result.profile?.core_belief && (
                <ProfileSection label='CORE BELIEF' text={result.profile.core_belief} />
              )}
              {result.profile?.pressure_type && (
                <ProfileSection label='EMOTIONAL FUNCTION' text={result.profile.pressure_type} />
              )}
              {result.profile?.personality && (
                <ProfileSection label='WRITER NOTES' text={result.profile.personality} />
              )}
            </div>

            {/* Plot threads */}
            {result.threads?.length > 0 && (
              <div style={st.threadsBlock}>
                <div style={st.threadsLabel}>
                  ✦ {result.threads.length} PLOT THREAD{result.threads.length > 1 ? 'S' : ''} DISCOVERED
                </div>
                {result.threads.map((thread, i) => (
                  <ThreadCard key={i} thread={thread} />
                ))}
              </div>
            )}

            {error && <div style={st.error}>{error}</div>}

            <div style={st.completeActions}>
              <button style={st.secondaryBtn} onClick={onClose}>
                Review later
              </button>
              <button
                style={{ ...st.primaryBtn, opacity: saving ? 0.6 : 1 }}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Profile + Threads →'}
              </button>
            </div>
          </div>
        )}

        {/* Chat interface — intro + interview */}
        {(step === 'intro' || step === 'interview') && (
          <>
            <div style={st.chatWindow}>
              {messages.map((msg, i) => (
                <ChatMessage key={i} message={msg} charName={charName} />
              ))}
              {generating && (
                <div style={st.typingIndicator}>
                  <span style={st.typingDot} />
                  <span style={{ ...st.typingDot, animationDelay: '0.2s' }} />
                  <span style={{ ...st.typingDot, animationDelay: '0.4s' }} />
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {step === 'intro' ? (
              <div style={st.inputRow}>
                <button style={st.primaryBtn} onClick={handleStart}>
                  Let's talk about {charName} →
                </button>
              </div>
            ) : (
              <div style={st.inputRow}>
                <textarea
                  style={st.chatInput}
                  placeholder='Answer here — be as specific as you want…'
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
                  }}
                  rows={3}
                  autoFocus
                  spellCheck
                />
                <button
                  style={{
                    ...st.sendBtn,
                    opacity: !input.trim() || generating ? 0.5 : 1,
                  }}
                  onClick={handleSend}
                  disabled={!input.trim() || generating}
                >
                  →
                </button>
              </div>
            )}
            <div style={st.cmdHint}>Ctrl + Enter to send</div>
          </>
        )}

      </div>

      {/* Keyframe animation for dots */}
      <style>{`
        @keyframes cvi-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ChatMessage({ message }) {
  if (message.role === 'thread_hint') {
    return (
      <div style={st.threadHint}>
        {message.text}
      </div>
    );
  }

  return (
    <div style={{
      ...st.message,
      alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
    }}>
      {message.role === 'system' && (
        <div style={st.messageLabel}>✦ INTERVIEWER</div>
      )}
      <div style={{
        ...st.messageBubble,
        background: message.role === 'user'
          ? 'rgba(201,168,76,0.1)'
          : 'white',
        borderColor: message.role === 'user'
          ? 'rgba(201,168,76,0.2)'
          : 'rgba(30,25,20,0.08)',
      }}>
        {message.text}
      </div>
    </div>
  );
}

function ProfileSection({ label, text }) {
  return (
    <div style={st.profileSection}>
      <div style={st.profileSectionLabel}>{label}</div>
      <div style={st.profileSectionText}>{text}</div>
    </div>
  );
}

function ThreadCard({ thread }) {
  return (
    <div style={st.threadCard}>
      <div style={st.threadTitle}>{thread.title}</div>
      <div style={st.threadDesc}>{thread.description}</div>
      {thread.chapter_hint && (
        <div style={st.threadHintText}>
          Could become: {thread.chapter_hint}
        </div>
      )}
    </div>
  );
}

function typeColor(type) {
  const colors = {
    protagonist: '#C9A84C',
    pressure: '#B85C38',
    mirror:   '#7B5EA7',
    support:  '#4A7C59',
    shadow:   '#8B6914',
    special:  '#C9A84C',
  };
  return colors[type] || '#C9A84C';
}

// ── Styles ─────────────────────────────────────────────────────────────────

const st = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(20,16,12,0.6)',
    backdropFilter: 'blur(4px)',
    zIndex: 400,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    background: '#faf9f7',
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 4,
    width: 620,
    maxWidth: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '20px 24px 16px',
    borderBottom: '1px solid rgba(201,168,76,0.12)',
    flexShrink: 0,
  },
  headerLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    letterSpacing: '0.2em',
    color: '#C9A84C',
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 22,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.88)',
    marginBottom: 4,
  },
  typeBadge: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    letterSpacing: '0.1em',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(30,25,20,0.3)',
    fontSize: 15,
    cursor: 'pointer',
    padding: 4,
  },
  // Chat
  chatWindow: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    minHeight: 300,
    maxHeight: 420,
  },
  message: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    maxWidth: '85%',
  },
  messageLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 7,
    letterSpacing: '0.16em',
    color: '#C9A84C',
  },
  messageBubble: {
    border: '1px solid',
    borderRadius: 3,
    padding: '10px 14px',
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 14,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.8)',
    lineHeight: 1.65,
    whiteSpace: 'pre-wrap',
  },
  threadHint: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: '#C9A84C',
    background: 'rgba(201,168,76,0.06)',
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 2,
    padding: '6px 12px',
    letterSpacing: '0.06em',
    alignSelf: 'center',
  },
  typingIndicator: {
    display: 'flex',
    gap: 4,
    padding: '4px 0',
    alignSelf: 'flex-start',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'rgba(201,168,76,0.4)',
    display: 'inline-block',
    animation: 'cvi-pulse 1.2s ease-in-out infinite',
  },
  inputRow: {
    display: 'flex',
    gap: 8,
    padding: '12px 24px',
    borderTop: '1px solid rgba(201,168,76,0.1)',
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  chatInput: {
    flex: 1,
    background: '#f5f0e8',
    border: '1px solid rgba(30,25,20,0.1)',
    borderRadius: 2,
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 14,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.82)',
    padding: '10px 12px',
    outline: 'none',
    resize: 'none',
    lineHeight: 1.6,
  },
  sendBtn: {
    background: '#C9A84C',
    border: 'none',
    borderRadius: 2,
    color: '#14100c',
    fontSize: 18,
    fontWeight: 700,
    padding: '10px 16px',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'opacity 0.12s',
  },
  cmdHint: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(30,25,20,0.2)',
    letterSpacing: '0.06em',
    textAlign: 'right',
    padding: '4px 24px 10px',
    flexShrink: 0,
  },
  // Generating
  generatingBlock: {
    padding: '48px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  generatingDots: {
    display: 'flex',
    gap: 8,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: '50%',
    background: '#C9A84C',
    animation: 'cvi-pulse 1.2s ease-in-out infinite',
  },
  generatingTitle: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 18,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.75)',
  },
  generatingSub: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: 'rgba(30,25,20,0.3)',
    letterSpacing: '0.06em',
    lineHeight: 1.6,
    textAlign: 'center',
  },
  // Complete
  completeBlock: {
    padding: '20px 24px',
    overflowY: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  completeHeader: {
    borderBottom: '1px solid rgba(201,168,76,0.12)',
    paddingBottom: 12,
  },
  completeLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    letterSpacing: '0.2em',
    color: '#C9A84C',
    marginBottom: 4,
  },
  completeTitle: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 20,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.88)',
  },
  profilePreview: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  profileSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  profileSectionLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    letterSpacing: '0.16em',
    color: 'rgba(30,25,20,0.3)',
    textTransform: 'uppercase',
  },
  profileSectionText: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.75)',
    lineHeight: 1.65,
  },
  threadsBlock: {
    background: 'rgba(201,168,76,0.04)',
    border: '1px solid rgba(201,168,76,0.15)',
    borderRadius: 3,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  threadsLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    letterSpacing: '0.16em',
    color: '#C9A84C',
    marginBottom: 4,
  },
  threadCard: {
    background: 'white',
    border: '1px solid rgba(201,168,76,0.12)',
    borderRadius: 2,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  threadTitle: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 14,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.85)',
  },
  threadDesc: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: 'rgba(30,25,20,0.5)',
    letterSpacing: '0.03em',
    lineHeight: 1.5,
  },
  threadHintText: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: '#4A7C59',
    letterSpacing: '0.06em',
    borderLeft: '2px solid rgba(74,124,89,0.3)',
    paddingLeft: 8,
    marginTop: 2,
  },
  completeActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 4,
    borderTop: '1px solid rgba(201,168,76,0.1)',
    marginTop: 4,
  },
  error: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: '#B85C38',
    background: 'rgba(184,92,56,0.06)',
    border: '1px solid rgba(184,92,56,0.15)',
    borderRadius: 2,
    padding: '8px 12px',
  },
  primaryBtn: {
    background: '#C9A84C',
    border: 'none',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.12em',
    color: '#14100c',
    fontWeight: 600,
    padding: '10px 20px',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  secondaryBtn: {
    background: 'none',
    border: '1px solid rgba(30,25,20,0.15)',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.1em',
    color: 'rgba(30,25,20,0.45)',
    padding: '9px 16px',
    cursor: 'pointer',
  },
};
