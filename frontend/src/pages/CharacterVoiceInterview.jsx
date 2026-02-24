/**
 * CharacterVoiceInterview.jsx
 * frontend/src/pages/CharacterVoiceInterview.jsx
 *
 * ════════════════════════════════════════════════════════════════════════
 * UPGRADES — 7 improvements to capture more detail from every interview
 * ════════════════════════════════════════════════════════════════════════
 *
 * 1. FIRST-ANSWER DEEP READ
 *    Adaptive Claude follow-ups now start from answer 1 (was answer 2).
 *    The first unguarded answer is always the most revealing.
 *
 * 2. SENSORY ANCHOR QUESTION
 *    Auto-injected after every first answer, every character type:
 *    "Give me one specific image — a scene, a detail, something physical
 *    — that captures this character for you. Not a theme. A moment."
 *    Specificity explodes from sensory anchors.
 *
 * 3. TRAILING-OFF CATCH
 *    Detects hedging, trailing off, "I don't know / it's complicated /
 *    sort of / maybe." Instead of moving on, sends a flag to Claude:
 *    respond to the unfinished thought, not the next base question.
 *    The richest details live in the moments the author can't finish.
 *
 * 4. CONTRADICTION DETECTION
 *    Every 3rd answer, Claude scans the full history for tensions between
 *    what was said. Surfaces them as: "Earlier you said X — but just now
 *    it sounds like Y. Which is true, or is it both?"
 *    Contradictions are the character. They are not problems to resolve.
 *
 * 5. PRIVATE LIFE QUESTION
 *    Auto-injected around answer 3:
 *    "What is [name] like when nobody is watching — not in a scene, just
 *    alone? What do they do, think about, avoid?"
 *    No plot-based question produces this detail. This one always does.
 *
 * 6. UNSPOKEN REACTION QUESTION (pressure + mirror types only)
 *    Auto-injected around answer 4:
 *    "What does JustAWoman think about [name] that she'd never say out loud?"
 *    The protagonist's silent reaction is often the most revealing thing
 *    in the whole interview.
 *
 * 7. ONE-MORE-THING CLOSER
 *    Always asked before profile generation — never skipped:
 *    "Is there anything about [name] you haven't said yet — something
 *    that doesn't fit neatly anywhere but feels true?"
 *    The most important detail consistently comes after the person thinks
 *    the conversation is over.
 *
 * ════════════════════════════════════════════════════════════════════════
 * PLUS all previous fixes:
 * ─ Single voice instance (no double recognizer)
 * ─ Auto-send on mic stop
 * ─ Clean transcript accumulation (ref not closure)
 * ════════════════════════════════════════════════════════════════════════
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useVoice, MicButton, SpeakButton } from '../hooks/VoiceLayer';
import NewCharacterDetected from './NewCharacterDetected';
import {
  DriftIndicator,
  RelationalNotesPanel,
  BridgeMomentPrompt,
} from '../components/DriftDetection';

const MEMORIES_API = '/api/v1/memories';
const REGISTRY_API = '/api/v1/character-registry';

// ── Hesitation / trailing-off detection ─────────────────────────────────
const HESITATION_PATTERNS = [
  /i don'?t know/i,
  /it'?s complicated/i,
  /\bsort of\b/i,
  /\bkind of\b/i,
  /i guess/i,
  /i think maybe/i,
  /hard to explain/i,
  /i'?m not sure/i,
  /\bsomething about\b/i,
  /it'?s like/i,
  /\bi mean\b/i,
  /\.\.\./,
  /—\s*$/,
];

function detectsHesitation(text) {
  if (!text) return false;
  const wordCount  = text.trim().split(/\s+/).length;
  const endsCleanly = /[.!?]$/.test(text.trim());
  if (wordCount < 10 && !endsCleanly) return true;
  return HESITATION_PATTERNS.some(p => p.test(text));
}

// ── Special injected questions ───────────────────────────────────────────
const SENSORY_ANCHOR_Q =
  `Give me one specific image — a scene, a detail, something physical — that captures this character for you. Not a theme, not a trait. A moment.`;

const PRIVATE_LIFE_Q = (name) =>
  `What is ${name} like when nobody is watching them — not in a scene, just alone? What do they do, think about, avoid?`;

const UNSPOKEN_REACTION_Q = (name) =>
  `What does JustAWoman think about ${name} that she would never actually say out loud?`;

const ONE_MORE_THING_Q = (name) =>
  `Before I build the profile — is there anything about ${name} you haven't said yet? Something that doesn't fit neatly anywhere but feels true?`;

// ── Opening questions per character type ─────────────────────────────────
const OPENING_QUESTIONS = {
  special: [
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

// ════════════════════════════════════════════════════════════════════════
export default function CharacterVoiceInterview({
  character,
  bookId,
  open,
  onClose,
  onComplete,
  registryId,
  characters = [],
}) {
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState('');
  const [step, setStep]                   = useState('intro');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers]             = useState([]);
  const [nextQuestion, setNextQuestion]   = useState(null);
  const [generating, setGenerating]       = useState(false);
  const [result, setResult]               = useState(null);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState(null);

  // Special question tracking
  const [sensoryAsked, setSensoryAsked]         = useState(false);
  const [privateLifeAsked, setPrivateLifeAsked] = useState(false);
  const [unspokenAsked, setUnspokenAsked]       = useState(false);
  const [oneMoreAsked, setOneMoreAsked]         = useState(false);
  const lastContradictionCheck                  = useRef(0);

  // Drift detection state
  const [driftHistory,    setDriftHistory]    = useState([]);
  const [relationalNotes, setRelationalNotes] = useState([]);
  const [currentDrift,    setCurrentDrift]    = useState(null);

  // Persistence: resume support
  const [resumeData, setResumeData]   = useState(null);  // loaded progress
  const [loadingProgress, setLoadingProgress] = useState(false);
  const savingProgress = useRef(false);

  const bottomRef = useRef(null);
  const { speak, startListening, stopListening, listening } = useVoice();

  const roleType  = character?.role_type || 'special';
  const questions = OPENING_QUESTIONS[roleType] || DEFAULT_QUESTIONS;
  const charName  = character?.selected_name || character?.display_name || 'this character';
  const needsUnspokenQ = ['pressure', 'mirror'].includes(roleType);

  // ── Helper: reset to fresh interview state ────────────────────────────
  function resetToFresh() {
    setMessages([{
      role: 'system',
      text: `Let's talk about ${charName}.\n\nAnswer like you're telling a friend — no right answers. The more specific and honest you are, the richer the character and the stronger the story.\n\nReady when you are.`,
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
    setSensoryAsked(false);
    setPrivateLifeAsked(false);
    setUnspokenAsked(false);
    setOneMoreAsked(false);
    lastContradictionCheck.current = 0;
    setDriftHistory([]);
    setRelationalNotes([]);
    setCurrentDrift(null);
    setResumeData(null);
  }

  // ── Helper: restore state from saved progress ─────────────────────────
  function restoreProgress(p) {
    setMessages(p.messages || []);
    setStep(p.step || 'interview');
    setQuestionIndex(p.question_index || 0);
    setAnswers(p.answers || []);
    setNextQuestion(p.next_question || null);
    setSensoryAsked(!!p.sensory_asked);
    setPrivateLifeAsked(!!p.private_life_asked);
    setUnspokenAsked(!!p.unspoken_asked);
    setOneMoreAsked(!!p.one_more_asked);
    lastContradictionCheck.current = p.last_contradiction_check || 0;
    setDriftHistory(p.drift_history || []);
    setRelationalNotes(p.relational_notes || []);
    setCurrentDrift(p.current_drift || null);
    setInput('');
    setGenerating(false);
    setResult(null);
    setSaving(false);
    setError(null);
    setResumeData(null);
  }

  // ── Load saved progress on open ───────────────────────────────────────
  useEffect(() => {
    if (open && character?.id) {
      setLoadingProgress(true);
      fetch(`${MEMORIES_API}/character-interview-progress/${character.id}`)
        .then(r => r.json())
        .then(data => {
          if (data.progress && data.progress.answers?.length > 0 && data.progress.step !== 'complete') {
            setResumeData(data.progress);
          } else {
            resetToFresh();
          }
        })
        .catch(() => resetToFresh())
        .finally(() => setLoadingProgress(false));
    } else if (open) {
      resetToFresh();
    }
  }, [open, character?.id]); // eslint-disable-line

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-speak system messages
  useEffect(() => {
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === 'system') speak(last.text);
    }
  }, [messages]); // eslint-disable-line

  // Auto-send on mic stop
  function handleMicResult(text, meta) {
    setInput(text);
    if (meta?.isFinal && text.trim() && step === 'interview' && !generating) {
      setTimeout(() => handleSendText(text.trim()), 80);
    }
  }

  // ── Auto-save progress after each answer ──────────────────────────────
  async function saveProgress(overrides = {}) {
    if (!character?.id || savingProgress.current) return;
    savingProgress.current = true;
    try {
      await fetch(`${MEMORIES_API}/character-interview-save-progress`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id:             character.id,
          messages:                 overrides.messages    ?? messages,
          answers:                  overrides.answers     ?? answers,
          question_index:           overrides.questionIndex ?? questionIndex,
          next_question:            overrides.nextQuestion  ?? nextQuestion,
          sensory_asked:            overrides.sensoryAsked  ?? sensoryAsked,
          private_life_asked:       overrides.privateLifeAsked ?? privateLifeAsked,
          unspoken_asked:           overrides.unspokenAsked ?? unspokenAsked,
          one_more_asked:           overrides.oneMoreAsked ?? oneMoreAsked,
          last_contradiction_check: lastContradictionCheck.current,
          drift_history:            overrides.driftHistory ?? driftHistory,
          relational_notes:         overrides.relationalNotes ?? relationalNotes,
          current_drift:            overrides.currentDrift ?? currentDrift,
          step:                     overrides.step ?? step,
        }),
      });
    } catch (e) {
      console.warn('Failed to save interview progress:', e);
    } finally {
      savingProgress.current = false;
    }
  }

  // ── Clear saved progress (after profile saved) ────────────────────────
  async function clearProgress() {
    if (!character?.id) return;
    try {
      await fetch(`${MEMORIES_API}/character-interview-save-progress`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: character.id,
          messages:     [],
          answers:      [],
          question_index: 0,
          next_question: null,
          sensory_asked: false,
          private_life_asked: false,
          unspoken_asked: false,
          one_more_asked: false,
          last_contradiction_check: 0,
          drift_history: [],
          relational_notes: [],
          current_drift: null,
          step: 'complete',
        }),
      });
    } catch (_) { /* non-critical */ }
  }

  function handleStart() {
    setStep('interview');
    setMessages(prev => [...prev, { role: 'system', text: questions[0] }]);
  }

  async function handleSend() {
    if (!input.trim()) return;
    await handleSendText(input.trim());
  }

  async function handleSendText(userAnswer) {
    if (!userAnswer) return;
    setInput('');

    const newMessages = [...messages, { role: 'user', text: userAnswer }];
    setMessages(newMessages);

    const newAnswers = [...answers, {
      question: nextQuestion || questions[questionIndex],
      answer:   userAnswer,
    }];
    setAnswers(newAnswers);

    // Auto-save progress after every answer
    saveProgress({ messages: newMessages, answers: newAnswers, step: 'interview' });

    await decideNextMove(newAnswers, newMessages, userAnswer);
  }

  // ── Core routing: what happens after every answer ──────────────────────
  async function decideNextMove(currentAnswers, currentMessages, latestAnswer) {
    const answerCount = currentAnswers.length;
    const isNearEnd   = questionIndex >= questions.length - 1;

    // 1. TRAILING-OFF CATCH — always first priority
    if (detectsHesitation(latestAnswer)) {
      await getAdaptiveQuestion(currentAnswers, currentMessages, {
        forceHesitationCatch: true,
      });
      return;
    }

    // 2. SENSORY ANCHOR — after first answer, no exceptions
    if (answerCount === 1 && !sensoryAsked) {
      setSensoryAsked(true);
      setNextQuestion(SENSORY_ANCHOR_Q);
      setMessages(prev => [...prev, { role: 'system', text: SENSORY_ANCHOR_Q }]);
      return;
    }

    // 3. CONTRADICTION CHECK — every 3rd answer
    if (
      answerCount >= 3 &&
      answerCount % 3 === 0 &&
      answerCount !== lastContradictionCheck.current
    ) {
      lastContradictionCheck.current = answerCount;
      await getAdaptiveQuestion(currentAnswers, currentMessages, {
        forceContradictionCheck: true,
      });
      return;
    }

    // 4. PRIVATE LIFE — around answer 3
    if (answerCount === 3 && !privateLifeAsked) {
      setPrivateLifeAsked(true);
      const q = PRIVATE_LIFE_Q(charName);
      setNextQuestion(q);
      setMessages(prev => [...prev, { role: 'system', text: q }]);
      return;
    }

    // 5. UNSPOKEN REACTION — pressure + mirror only, around answer 4
    if (answerCount === 4 && needsUnspokenQ && !unspokenAsked) {
      setUnspokenAsked(true);
      const q = UNSPOKEN_REACTION_Q(charName);
      setNextQuestion(q);
      setMessages(prev => [...prev, { role: 'system', text: q }]);
      return;
    }

    // 6. ONE-MORE-THING — always before closing
    if (isNearEnd && !oneMoreAsked) {
      setOneMoreAsked(true);
      const q = ONE_MORE_THING_Q(charName);
      setNextQuestion(q);
      setMessages(prev => [...prev, { role: 'system', text: q }]);
      return;
    }

    // 7. GENERATE PROFILE — everything has been asked
    if (isNearEnd && oneMoreAsked) {
      await generateProfile(currentAnswers);
      return;
    }

    // 8. DEFAULT — adaptive follow-up via Claude
    await getAdaptiveQuestion(currentAnswers, currentMessages, {});
  }

  async function getAdaptiveQuestion(currentAnswers, currentMessages, options = {}) {
    setGenerating(true);
    try {
      const nextIndex = questionIndex + 1;
      setQuestionIndex(nextIndex);

      const existingNames = characters
        .map(c => c.selected_name || c.display_name)
        .filter(Boolean);

      const knownChars = characters.map(c => ({
        id:            c.id,
        name:          c.selected_name || c.display_name,
        archetype:     c.character_archetype || c.display_name,
        role:          c.role_type,
        selected_name: c.selected_name,
      }));

      const res = await fetch(`${MEMORIES_API}/character-interview-next`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id:                   bookId || null,
          character_name:            charName,
          character_type:            roleType,
          answers_so_far:            currentAnswers,
          next_base_question:        questions[nextIndex] || null,
          existing_characters:       existingNames,
          force_hesitation_catch:    options.forceHesitationCatch    || false,
          force_contradiction_check: options.forceContradictionCheck || false,
          // Drift detection fields
          primary_character:         charName,
          known_characters:          knownChars,
          drift_history:             driftHistory,
          relational_notes:          relationalNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Handle drift state
      if (data.drift_detected) {
        setCurrentDrift({
          drifted_to:   data.drifted_to,
          drift_type:   data.drift_type,
          bridge_ready: data.bridge_question_ready,
        });
        setDriftHistory(prev => [...prev, {
          drifted_to: data.drifted_to,
          type:       data.drift_type,
          bridged:    data.bridge_question_ready,
        }]);
      } else {
        setCurrentDrift(null);
      }

      // Save relational note if captured
      if (data.relational_note?.observation) {
        setRelationalNotes(prev => [...prev, data.relational_note]);
      }

      setNextQuestion(data.question);
      setMessages(prev => [...prev, { role: 'system', text: data.question }]);

      if (data.thread_hint) {
        setMessages(prev => [...prev, {
          role: 'thread_hint',
          text: `✦ Plot thread: ${data.thread_hint}`,
        }]);
      }

      if (data.contradiction_detected) {
        setMessages(prev => [...prev, {
          role: 'contradiction_flag',
          text: `◈ Tension in the character: ${data.contradiction_detected}`,
        }]);
      }

      if (data.new_characters?.length) {
        for (const nc of data.new_characters) {
          setMessages(prev => [...prev, { role: 'new_character_detected', character: nc }]);
        }
      }
    } catch {
      const fallback = questions[questionIndex + 1];
      if (fallback) setMessages(prev => [...prev, { role: 'system', text: fallback }]);
    } finally {
      setGenerating(false);
    }
  }

  async function generateProfile(finalAnswers) {
    setStep('generating');
    setGenerating(true);
    try {
      const res = await fetch(`${MEMORIES_API}/character-interview-complete`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id:            bookId || null,
          character_id:       character?.id,
          character_name:     charName,
          character_type:     roleType,
          answers:            finalAnswers,
          relational_notes:   relationalNotes,
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
      await fetch(`${REGISTRY_API}/characters/${character?.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(result.profile),
      });
      // Clear saved progress now that the profile is saved
      await clearProgress();
      onComplete?.(result.profile, result.threads);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={st.modal} onClick={e => e.stopPropagation()}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={st.header}>
          <div>
            <div style={st.headerLabel}>CHARACTER VOICE INTERVIEW</div>
            <div style={st.headerTitle}>{charName}</div>
            {roleType && (
              <div style={{ ...st.typeBadge, color: typeColor(roleType) }}>{roleType}</div>
            )}
          </div>
          <button style={st.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* ── Loading saved progress ──────────────────────────────────── */}
        {loadingProgress && (
          <div style={st.generatingBlock}>
            <div style={st.generatingTitle}>Checking for saved progress…</div>
          </div>
        )}

        {/* ── Resume prompt ───────────────────────────────────────────── */}
        {!loadingProgress && resumeData && (
          <div style={{
            padding: '40px 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 16, textAlign: 'center',
          }}>
            <div style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 22, fontWeight: 600,
              color: 'rgba(30,25,20,0.85)',
            }}>
              You have a conversation in progress
            </div>
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 12, color: 'rgba(30,25,20,0.5)',
              letterSpacing: '0.03em',
            }}>
              {resumeData.answers?.length || 0} answer{(resumeData.answers?.length || 0) !== 1 ? 's' : ''} saved
              {resumeData.saved_at ? ` · ${new Date(resumeData.saved_at).toLocaleDateString()}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button
                style={st.secondaryBtn}
                onClick={() => { resetToFresh(); }}
              >
                Start Over
              </button>
              <button
                style={st.primaryBtn}
                onClick={() => restoreProgress(resumeData)}
              >
                Continue Where I Left Off →
              </button>
            </div>
          </div>
        )}

        {/* ── Generating ──────────────────────────────────────────────── */}
        {step === 'generating' && (
          <div style={st.generatingBlock}>
            <div style={st.generatingDots}>
              {[0,1,2].map(i => (
                <div key={i} style={{ ...st.dot, animationDelay: `${i * 0.3}s` }} />
              ))}
            </div>
            <div style={st.generatingTitle}>Building {charName}'s profile…</div>
            <div style={st.generatingSub}>
              Reading everything you said. Finding the contradictions. Writing the psychology.
            </div>
          </div>
        )}

        {/* ── Complete ─────────────────────────────────────────────────── */}
        {step === 'complete' && result && (
          <div style={st.completeBlock}>
            <div style={st.completeHeader}>
              <div style={st.completeLabel}>PROFILE READY</div>
              <div style={st.completeTitle}>{charName}</div>
            </div>

            <div style={st.profilePreview}>
              {result.profile?.description && (
                <ProfileSection label="WHO THEY ARE"            text={result.profile.description} />
              )}
              {result.profile?.core_belief && (
                <ProfileSection label="CORE BELIEF"             text={result.profile.core_belief} />
              )}
              {result.profile?.pressure_type && (
                <ProfileSection label="EMOTIONAL FUNCTION"      text={result.profile.pressure_type} />
              )}
              {result.profile?.sensory_anchor && (
                <ProfileSection label="SENSORY ANCHOR"          text={result.profile.sensory_anchor} />
              )}
              {result.profile?.private_self && (
                <ProfileSection label="WHEN NO ONE IS WATCHING" text={result.profile.private_self} />
              )}
              {result.profile?.unspoken_reaction && (
                <ProfileSection label="WHAT JUSTAWOMAN WON'T SAY" text={result.profile.unspoken_reaction} />
              )}
              {result.profile?.personality && (
                <ProfileSection label="WRITER NOTES"            text={result.profile.personality} />
              )}
            </div>

            {/* Contradictions = character gold */}
            {result.contradictions?.length > 0 && (
              <div style={st.contradictionsBlock}>
                <div style={st.contradictionsLabel}>◈ TENSIONS IN THE CHARACTER</div>
                <div style={st.contradictionsSub}>
                  These are not inconsistencies to fix. They are who this character is.
                </div>
                {result.contradictions.map((c, i) => (
                  <div key={i} style={st.contradictionItem}>{c}</div>
                ))}
              </div>
            )}

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
              <button style={st.secondaryBtn} onClick={onClose}>Review later</button>
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

        {/* ── Chat ─────────────────────────────────────────────────────── */}
        {!loadingProgress && !resumeData && (step === 'intro' || step === 'interview') && (
          <>
            <div style={st.chatWindow}>
              {/* Drift indicator — shows when drift is active */}
              <DriftIndicator
                drift={currentDrift}
                primaryCharacter={charName}
              />

              {/* Bridge moment prompt — when bridging back */}
              {currentDrift?.bridge_ready && (
                <BridgeMomentPrompt
                  primaryCharacter={charName}
                  driftedTo={currentDrift.drifted_to}
                />
              )}

              {messages.map((msg, i) => (
                <ChatMessage
                  key={i}
                  message={msg}
                  charName={charName}
                  registryId={registryId}
                  discoveredDuring={charName}
                />
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
              <>
                <div style={st.inputRow}>
                  <textarea
                    style={{
                      ...st.chatInput,
                      borderColor: listening ? 'rgba(184,92,56,0.45)' : 'rgba(30,25,20,0.1)',
                    }}
                    placeholder={listening
                      ? 'Listening… speak your answer'
                      : 'Answer here — be as specific as you want…'}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
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
                    style={{ ...st.sendBtn, opacity: !input.trim() || generating ? 0.5 : 1 }}
                    onClick={handleSend}
                    disabled={!input.trim() || generating}
                  >
                    →
                  </button>
                </div>
                <div style={st.cmdHint}>
                  {listening
                    ? '◼ Recording — tap mic to stop and send'
                    : 'Ctrl + Enter to send · 🎤 to speak'}
                </div>
              </>
            )}

            {/* Cross-character observations panel */}
            <RelationalNotesPanel
              notes={relationalNotes}
              primaryCharacter={charName}
            />
          </>
        )}
      </div>

      <style>{`
        @keyframes cvi-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50%       { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>,
    document.body
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ChatMessage({ message, registryId, discoveredDuring }) {
  if (message.role === 'new_character_detected') {
    return (
      <NewCharacterDetected
        character={message.character}
        registryId={registryId}
        discoveredDuring={discoveredDuring}
        onConfirm={created => console.log('Character added:', created)}
        onDismiss={() => {}}
      />
    );
  }

  if (message.role === 'thread_hint') {
    return <div style={st.threadHint}>{message.text}</div>;
  }

  if (message.role === 'contradiction_flag') {
    return <div style={st.contradictionHint}>{message.text}</div>;
  }

  return (
    <div style={{ ...st.message, alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start' }}>
      {message.role === 'system' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={st.messageLabel}>✦ INTERVIEWER</div>
          <SpeakButton text={message.text} size="small" />
        </div>
      )}
      <div style={{
        ...st.messageBubble,
        background:  message.role === 'user' ? 'rgba(201,168,76,0.1)' : 'white',
        borderColor: message.role === 'user' ? 'rgba(201,168,76,0.2)' : 'rgba(30,25,20,0.08)',
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
        <div style={st.threadHintText}>Could become: {thread.chapter_hint}</div>
      )}
    </div>
  );
}

function typeColor(type) {
  return { protagonist: '#C9A84C', pressure: '#B85C38', mirror: '#7B5EA7',
           support: '#4A7C59', shadow: '#8B6914', special: '#C9A84C' }[type] || '#C9A84C';
}

// ── Styles ──────────────────────────────────────────────────────────────────

const st = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(20,16,12,0.6)',
    backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
    zIndex: 10000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    pointerEvents: 'auto',
  },
  modal: {
    background: '#faf9f7', border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 4, width: 620, maxWidth: '100%', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden',
    pointerEvents: 'auto', position: 'relative', zIndex: 1,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '20px 24px 16px', borderBottom: '1px solid rgba(201,168,76,0.12)', flexShrink: 0,
  },
  headerLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 8, letterSpacing: '0.2em',
    color: '#C9A84C', marginBottom: 4,
  },
  headerTitle: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 22, fontStyle: 'italic', color: 'rgba(30,25,20,0.88)', marginBottom: 4,
  },
  typeBadge: { fontFamily: 'DM Mono, monospace', fontSize: 8, letterSpacing: '0.1em' },
  closeBtn: {
    background: 'none', border: 'none', color: 'rgba(30,25,20,0.3)',
    fontSize: 15, cursor: 'pointer', padding: 4,
  },
  chatWindow: {
    flex: 1, overflowY: 'auto', padding: '20px 24px',
    display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0, maxHeight: 420,
  },
  message: { display: 'flex', flexDirection: 'column', gap: 4, maxWidth: '85%' },
  messageLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 7, letterSpacing: '0.16em', color: '#C9A84C',
  },
  messageBubble: {
    border: '1px solid', borderRadius: 3, padding: '10px 14px',
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 14, fontStyle: 'italic', color: 'rgba(30,25,20,0.8)',
    lineHeight: 1.65, whiteSpace: 'pre-wrap',
  },
  threadHint: {
    fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#C9A84C',
    background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 2, padding: '6px 12px', letterSpacing: '0.06em', alignSelf: 'center',
  },
  contradictionHint: {
    fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#7B5EA7',
    background: 'rgba(123,94,167,0.06)', border: '1px solid rgba(123,94,167,0.2)',
    borderRadius: 2, padding: '6px 12px', letterSpacing: '0.06em', alignSelf: 'center',
  },
  typingIndicator: { display: 'flex', gap: 4, padding: '4px 0', alignSelf: 'flex-start' },
  typingDot: {
    width: 6, height: 6, borderRadius: '50%', background: 'rgba(201,168,76,0.4)',
    display: 'inline-block', animation: 'cvi-pulse 1.2s ease-in-out infinite',
  },
  inputRow: {
    display: 'flex', gap: 8, padding: '12px 24px',
    borderTop: '1px solid rgba(201,168,76,0.1)', alignItems: 'flex-end', flexShrink: 0,
  },
  chatInput: {
    flex: 1, background: '#f5f0e8', border: '1px solid', borderRadius: 2,
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 14, fontStyle: 'italic', color: 'rgba(30,25,20,0.82)',
    padding: '10px 12px', outline: 'none', resize: 'none', lineHeight: 1.6,
    transition: 'border-color 0.15s',
  },
  sendBtn: {
    background: '#C9A84C', border: 'none', borderRadius: 2, color: '#14100c',
    fontSize: 18, fontWeight: 700, padding: '10px 16px', cursor: 'pointer',
    flexShrink: 0, transition: 'opacity 0.12s',
  },
  cmdHint: {
    fontFamily: 'DM Mono, monospace', fontSize: 8, color: 'rgba(30,25,20,0.2)',
    letterSpacing: '0.06em', textAlign: 'right', padding: '4px 24px 10px', flexShrink: 0,
  },
  generatingBlock: {
    padding: '48px 32px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 14, flex: 1,
  },
  generatingDots: { display: 'flex', gap: 8 },
  dot: {
    width: 9, height: 9, borderRadius: '50%', background: '#C9A84C',
    animation: 'cvi-pulse 1.2s ease-in-out infinite',
  },
  generatingTitle: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 18, fontStyle: 'italic', color: 'rgba(30,25,20,0.75)',
  },
  generatingSub: {
    fontFamily: 'DM Mono, monospace', fontSize: 9, color: 'rgba(30,25,20,0.3)',
    letterSpacing: '0.06em', lineHeight: 1.6, textAlign: 'center',
  },
  completeBlock: {
    padding: '20px 24px', overflowY: 'auto', flex: 1,
    display: 'flex', flexDirection: 'column', gap: 16,
  },
  completeHeader: { borderBottom: '1px solid rgba(201,168,76,0.12)', paddingBottom: 12 },
  completeLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    letterSpacing: '0.2em', color: '#C9A84C', marginBottom: 4,
  },
  completeTitle: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 20, fontStyle: 'italic', color: 'rgba(30,25,20,0.88)',
  },
  profilePreview: { display: 'flex', flexDirection: 'column', gap: 12 },
  profileSection: { display: 'flex', flexDirection: 'column', gap: 5 },
  profileSectionLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    letterSpacing: '0.16em', color: 'rgba(30,25,20,0.3)', textTransform: 'uppercase',
  },
  profileSectionText: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 13, fontStyle: 'italic', color: 'rgba(30,25,20,0.75)', lineHeight: 1.65,
  },
  contradictionsBlock: {
    background: 'rgba(123,94,167,0.04)', border: '1px solid rgba(123,94,167,0.15)',
    borderRadius: 3, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
  },
  contradictionsLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    letterSpacing: '0.16em', color: '#7B5EA7',
  },
  contradictionsSub: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    color: 'rgba(123,94,167,0.6)', letterSpacing: '0.04em',
    lineHeight: 1.5, marginBottom: 4,
  },
  contradictionItem: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 13, fontStyle: 'italic', color: 'rgba(30,25,20,0.7)', lineHeight: 1.6,
    borderLeft: '2px solid rgba(123,94,167,0.35)', paddingLeft: 10,
  },
  threadsBlock: {
    background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)',
    borderRadius: 3, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
  },
  threadsLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    letterSpacing: '0.16em', color: '#C9A84C', marginBottom: 4,
  },
  threadCard: {
    background: 'white', border: '1px solid rgba(201,168,76,0.12)',
    borderRadius: 2, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5,
  },
  threadTitle: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 14, fontStyle: 'italic', color: 'rgba(30,25,20,0.85)',
  },
  threadDesc: {
    fontFamily: 'DM Mono, monospace', fontSize: 9,
    color: 'rgba(30,25,20,0.5)', letterSpacing: '0.03em', lineHeight: 1.5,
  },
  threadHintText: {
    fontFamily: 'DM Mono, monospace', fontSize: 8, color: '#4A7C59',
    letterSpacing: '0.06em', borderLeft: '2px solid rgba(74,124,89,0.3)',
    paddingLeft: 8, marginTop: 2,
  },
  completeActions: {
    display: 'flex', justifyContent: 'flex-end', gap: 8,
    paddingTop: 4, borderTop: '1px solid rgba(201,168,76,0.1)', marginTop: 4,
  },
  error: {
    fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#B85C38',
    background: 'rgba(184,92,56,0.06)', border: '1px solid rgba(184,92,56,0.15)',
    borderRadius: 2, padding: '8px 12px',
  },
  primaryBtn: {
    background: '#C9A84C', border: 'none', borderRadius: 2,
    fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.12em',
    color: '#14100c', fontWeight: 600, padding: '10px 20px',
    cursor: 'pointer', transition: 'opacity 0.15s',
  },
  secondaryBtn: {
    background: 'none', border: '1px solid rgba(30,25,20,0.15)', borderRadius: 2,
    fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.1em',
    color: 'rgba(30,25,20,0.45)', padding: '9px 16px', cursor: 'pointer',
  },
};
