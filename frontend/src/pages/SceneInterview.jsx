/**
 * SceneInterview.jsx
 * frontend/src/pages/SceneInterview.jsx
 *
 * Auto-pops when a chapter has no lines yet.
 * Conversational 7-question interview → Claude generates a scene brief.
 * Brief is saved to the chapter and shown above the manuscript permanently.
 */

import { useState, useEffect } from 'react';

const STORYTELLER_API = '/api/v1/storyteller';
const MEMORIES_API    = '/api/v1/memories';

// ── The 7 interview questions ──────────────────────────────────────────────
const QUESTIONS = [
  {
    id: 'location',
    question: "Where does this scene open?",
    hint: "Describe it like you're telling a friend. Don't overthink it.",
    placeholder: "She's sitting in her car outside a coffee shop. It's still running. She hasn't gone in yet.",
    field: null,
  },
  {
    id: 'time_weather',
    question: "What time is it and what's the weather doing?",
    hint: "Time of day, season, light, temperature — whatever feels right.",
    placeholder: "Tuesday, 11am. Sunny. The kind of day that makes you feel like you should be doing something meaningful.",
    field: null,
  },
  {
    id: 'who_present',
    question: "Who is physically present besides JustAWoman?",
    hint: "Could be nobody. Could be Chloe. Could be strangers in the background.",
    placeholder: "Just her. Her friends are all at work. She posted an hour ago and she's been alone with her phone ever since.",
    field: null,
  },
  {
    id: 'relationships',
    question: "If someone else is present — how does she know them and what's the energy?",
    hint: "Skip this if she's alone. If someone's there, describe the dynamic honestly.",
    placeholder: "Chloe is her girl. No pretending with her. She can be happy for Chloe without it costing her anything. Most of the time.",
    field: null,
  },
  {
    id: 'just_happened',
    question: "What just happened before this scene started?",
    hint: "10 minutes ago, an hour ago — what did she do or experience that led to this moment?",
    placeholder: "She posted the most beautiful photo she's ever taken. Pink checkered dress. Brown skin glowing in the sun. She pressed post and immediately started waiting.",
    field: null,
  },
  {
    id: 'wants_right_now',
    question: "What does she want right now — in this moment, not in life?",
    hint: "Not her big dream. Right now, in this scene. What is she looking for?",
    placeholder: "She wants the photo to do something. Not just likes. She wants someone to see her and say — I see where you're going.",
    field: null,
  },
  {
    id: 'afraid_of',
    question: "What is she afraid of right now?",
    hint: "The thing underneath. The fear she wouldn't say out loud.",
    placeholder: "That the photo is just pretty. That pretty is all it will ever be. That she'll keep posting beautiful things into silence.",
    field: null,
  },
];

export default function SceneInterview({ chapter, book, characters, onComplete, onSkip }) {
  const [step, setStep]         = useState(0); // 0 = intro, 1-7 = questions, 8 = generating, 9 = review
  const [answers, setAnswers]   = useState({});
  const [current, setCurrent]   = useState('');
  const [generating, setGenerating] = useState(false);
  const [brief, setBrief]       = useState(null);
  const [error, setError]       = useState(null);
  const [saving, setSaving]     = useState(false);
  const [openingCopied, setOpeningCopied] = useState(false);
  const [addingOpening, setAddingOpening] = useState(false);
  const [openingAdded, setOpeningAdded]   = useState(false);
  const [savedAnswers, setSavedAnswers]   = useState(null); // loaded from DB
  const [viewingPrevious, setViewingPrevious] = useState(false);

  const questionIndex = step - 1; // step 1 = question 0
  const totalQuestions = QUESTIONS.length;
  const isLastQuestion = questionIndex === totalQuestions - 1;

  // Load any previously saved interview answers
  useEffect(() => {
    if (chapter.interview_answers && Object.keys(chapter.interview_answers).length > 0) {
      setSavedAnswers(chapter.interview_answers);
    }
  }, [chapter.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNext() {
    if (step === 0) {
      setStep(1);
      setCurrent(answers[QUESTIONS[0].id] || '');
      return;
    }

    // Save current answer
    const q = QUESTIONS[questionIndex];
    const newAnswers = { ...answers, [q.id]: current.trim() };
    setAnswers(newAnswers);

    if (isLastQuestion) {
      setCurrent('');
      generateBrief(newAnswers);
    } else {
      const nextQ = QUESTIONS[questionIndex + 1];
      setCurrent(newAnswers[nextQ.id] || '');
      setStep(prev => prev + 1);
    }
  }

  function handleBack() {
    if (step <= 1) return;
    // Restore previous answer
    const prevQ = QUESTIONS[step - 2];
    setCurrent(answers[prevQ.id] || '');
    setStep(prev => prev - 1);
  }

  async function generateBrief(finalAnswers) {
    setStep(8);
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${MEMORIES_API}/scene-interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id:    book.id,
          chapter_id: chapter.id,
          chapter_title: chapter.title,
          answers:    finalAnswers,
          characters: characters.map(c => ({ name: c.name || c.display_name, type: c.type || c.role_type })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setBrief(data.brief);
      setStep(9);
    } catch (err) {
      setError(err.message);
      setStep(7); // back to last question
    } finally {
      setGenerating(false);
    }
  }

  async function saveBrief() {
    setSaving(true);
    try {
      // Save brief fields + interview answers to chapter
      const res = await fetch(`${STORYTELLER_API}/chapters/${chapter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme:                 brief.theme,
          scene_goal:            brief.scene_goal,
          emotional_state_start: brief.emotional_state_start,
          emotional_state_end:   brief.emotional_state_end,
          chapter_notes:         brief.scene_setting, // setting stored in notes
          pov:                   brief.pov || chapter.pov || 'first_person',
          interview_answers:     answers, // persist the raw Q&A
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      onComplete?.({
        theme:                 brief.theme,
        scene_goal:            brief.scene_goal,
        emotional_state_start: brief.emotional_state_start,
        emotional_state_end:   brief.emotional_state_end,
        chapter_notes:         brief.scene_setting,
        generated_brief:       brief,
        interview_answers:     answers,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Viewing previous answers ────────────────────────────────────────────
  if (viewingPrevious && savedAnswers) {
    return (
      <div style={s.shell}>
        <div style={s.reviewBlock}>
          <div style={s.reviewHeader}>
            <div style={s.reviewLabel}>PREVIOUS INTERVIEW ANSWERS</div>
            <div style={s.reviewTitle}>{chapter.title}</div>
          </div>
          {QUESTIONS.map(q => {
            const answer = savedAnswers[q.id];
            if (!answer) return null;
            return (
              <div key={q.id} style={s.briefSection}>
                <div style={s.briefSectionLabel}>{q.question.toUpperCase()}</div>
                <div style={s.briefSectionText}>{answer}</div>
              </div>
            );
          })}
          <div style={s.reviewActions}>
            <button style={s.backBtn} onClick={() => setViewingPrevious(false)} type='button'>
              ← Back
            </button>
            <button
              style={s.startBtn}
              onClick={() => {
                setAnswers({ ...savedAnswers });
                setViewingPrevious(false);
                setStep(1);
                setCurrent(savedAnswers[QUESTIONS[0].id] || '');
              }}
              type='button'
            >
              Edit these answers →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Intro screen ───────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div style={s.shell}>
        <div style={s.introBlock}>
          <div style={s.introIcon}>✦</div>
          <div style={s.introTitle}>Let's set the scene.</div>
          <div style={s.introSub}>
            Before you write a single line, I need to understand where we are.
            Seven quick questions. Answer like you're telling a friend.
            I'll build the scene brief from your answers.
          </div>
          <div style={s.introChapter}>
            Chapter: <em>{chapter.title}</em>
          </div>
          {savedAnswers && (
            <div style={{ marginTop: 10, marginBottom: 4 }}>
              <button
                style={s.viewPrevBtn}
                onClick={() => setViewingPrevious(true)}
                type='button'
              >
                View previous answers
              </button>
            </div>
          )}
          <div style={s.introBtns}>
            <button style={s.skipBtn} onClick={onSkip} type='button'>
              Skip — I'll write directly
            </button>
            {savedAnswers && (
              <button
                style={s.reuseBtn}
                onClick={() => {
                  setAnswers({ ...savedAnswers });
                  setStep(1);
                  setCurrent(savedAnswers[QUESTIONS[0].id] || '');
                }}
                type='button'
              >
                Start from previous ↻
              </button>
            )}
            <button style={s.startBtn} onClick={handleNext} type='button'>
              {savedAnswers ? 'Start fresh →' : 'Start Scene Interview →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Generating screen ──────────────────────────────────────────────────
  if (step === 8) {
    return (
      <div style={s.shell}>
        <div style={s.generatingBlock}>
          <div style={s.generatingDots}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                ...s.dot,
                animationDelay: `${i * 0.3}s`,
              }} />
            ))}
          </div>
          <div style={s.generatingTitle}>Building your scene brief…</div>
          <div style={s.generatingSub}>
            Reading your answers. Setting the room. Finding the emotional stakes.
          </div>
        </div>
      </div>
    );
  }

  // ── Review brief screen ────────────────────────────────────────────────
  if (step === 9 && brief) {
    return (
      <div style={s.shell}>
        <div style={s.reviewBlock}>
          <div style={s.reviewHeader}>
            <div style={s.reviewLabel}>SCENE BRIEF READY</div>
            <div style={s.reviewTitle}>{chapter.title}</div>
          </div>

          {/* Scene setting */}
          <div style={s.briefSection}>
            <div style={s.briefSectionLabel}>THE SCENE</div>
            <div style={s.briefSectionText}>{brief.scene_setting}</div>
          </div>

          {/* Theme */}
          {brief.theme && (
            <div style={s.briefSection}>
              <div style={s.briefSectionLabel}>THEME</div>
              <div style={s.briefSectionText}>{brief.theme}</div>
            </div>
          )}

          {/* Scene goal */}
          {brief.scene_goal && (
            <div style={s.briefSection}>
              <div style={s.briefSectionLabel}>WHAT MUST HAPPEN</div>
              <div style={s.briefSectionText}>{brief.scene_goal}</div>
            </div>
          )}

          {/* Emotional arc */}
          {(brief.emotional_state_start || brief.emotional_state_end) && (
            <div style={s.briefSection}>
              <div style={s.briefSectionLabel}>EMOTIONAL ARC</div>
              <div style={s.arcRow}>
                <span style={s.arcStart}>{brief.emotional_state_start}</span>
                <span style={s.arcArrow}>→</span>
                <span style={s.arcEnd}>{brief.emotional_state_end}</span>
              </div>
            </div>
          )}

          {/* Characters present */}
          {brief.characters_present?.length > 0 && (
            <div style={s.briefSection}>
              <div style={s.briefSectionLabel}>CHARACTERS PRESENT</div>
              <div style={s.charRow}>
                {brief.characters_present.map(c => (
                  <span key={c} style={s.charChip}>{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Opening line suggestion */}
          {brief.opening_suggestion && (
            <div style={{ ...s.briefSection, background: 'rgba(201,168,76,0.06)', borderRadius: 3, padding: '12px 14px' }}>
              <div style={s.briefSectionLabel}>SUGGESTED OPENING LINE</div>
              <div style={{ ...s.briefSectionText, fontStyle: 'italic', color: 'rgba(30,25,20,0.7)' }}>
                "{brief.opening_suggestion}"
              </div>
              <div style={s.openingHint}>Use it, rewrite it, or ignore it — it's just a door in.</div>
              <div style={s.openingActions}>
                <button
                  style={s.openingCopyBtn}
                  type='button'
                  onClick={() => {
                    navigator.clipboard.writeText(brief.opening_suggestion).then(() => {
                      setOpeningCopied(true);
                      setTimeout(() => setOpeningCopied(false), 2000);
                    });
                  }}
                >
                  {openingCopied ? '✓ Copied' : 'Copy'}
                </button>
                <button
                  style={{ ...s.openingUseBtn, opacity: addingOpening ? 0.6 : 1 }}
                  type='button'
                  disabled={addingOpening || openingAdded}
                  onClick={async () => {
                    setAddingOpening(true);
                    try {
                      const res = await fetch(`${STORYTELLER_API}/chapters/${chapter.id}/lines`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          text: brief.opening_suggestion,
                          group_label: 'Scene Interview opening',
                          status: 'pending',
                        }),
                      });
                      if (!res.ok) throw new Error('Failed to add line');
                      setOpeningAdded(true);
                    } catch (err) {
                      console.error('Add opening line error:', err);
                    } finally {
                      setAddingOpening(false);
                    }
                  }}
                >
                  {openingAdded ? '✓ Added as pending' : addingOpening ? 'Adding…' : '+ Use as first line'}
                </button>
              </div>
            </div>
          )}

          {error && <div style={s.error}>{error}</div>}

          <div style={s.reviewActions}>
            <button style={s.backBtn} onClick={() => { setStep(7); setCurrent(answers[QUESTIONS[6].id] || ''); }} type='button'>
              ← Revise answers
            </button>
            <button
              style={{ ...s.startBtn, opacity: saving ? 0.6 : 1 }}
              onClick={saveBrief}
              disabled={saving}
              type='button'
            >
              {saving ? 'Saving…' : 'Start Writing →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Question screens ───────────────────────────────────────────────────
  const q = QUESTIONS[questionIndex];

  return (
    <div style={s.shell}>
      <div style={s.questionBlock}>

        {/* Progress */}
        <div style={s.progressRow}>
          <div style={s.progressBar}>
            <div style={{
              ...s.progressFill,
              width: `${(step / totalQuestions) * 100}%`,
            }} />
          </div>
          <span style={s.progressLabel}>{step} of {totalQuestions}</span>
        </div>

        {/* Question */}
        <div style={s.questionText}>{q.question}</div>
        {q.hint && <div style={s.questionHint}>{q.hint}</div>}

        {/* Answer */}
        <textarea
          style={s.answerInput}
          placeholder={q.placeholder}
          value={current}
          onChange={e => setCurrent(e.target.value)}
          rows={4}
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter' && e.metaKey) handleNext();
          }}
        />
        <div style={s.cmdHint}>⌘ + Enter to continue</div>

        {error && <div style={s.error}>{error}</div>}

        {/* Navigation */}
        <div style={s.navRow}>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 1 && (
              <button style={s.backBtn} onClick={handleBack} type='button'>
                ← Back
              </button>
            )}
            <button style={s.skipBtn} onClick={onSkip} type='button'>
              Skip interview
            </button>
          </div>
          <button
            style={{
              ...s.nextBtn,
              opacity: !current.trim() && !answers[q.id] ? 0.5 : 1,
            }}
            onClick={handleNext}
            type='button'
          >
            {isLastQuestion ? 'Build Scene Brief →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = {
  shell: {
    background: '#faf9f7',
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 4,
    marginBottom: 20,
    overflow: 'hidden',
  },
  // Intro
  introBlock: {
    padding: '36px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 12,
  },
  introIcon: {
    fontSize: 24,
    color: '#C6A85E',
    marginBottom: 4,
  },
  introTitle: {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 22,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.85)',
  },
  introSub: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 13,
    color: 'rgba(30,25,20,0.45)',
    letterSpacing: '0.04em',
    lineHeight: 1.7,
    maxWidth: 480,
  },
  introChapter: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: '#C6A85E',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  introBtns: {
    display: 'flex',
    gap: 10,
    marginTop: 8,
  },
  // Question
  questionBlock: {
    padding: '28px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  progressBar: {
    flex: 1,
    height: 2,
    background: 'rgba(201,168,76,0.15)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#C6A85E',
    borderRadius: 1,
    transition: 'width 0.3s ease',
  },
  progressLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'rgba(30,25,20,0.3)',
    letterSpacing: '0.1em',
    flexShrink: 0,
  },
  questionText: {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 20,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.88)',
    lineHeight: 1.4,
  },
  questionHint: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: 'rgba(30,25,20,0.35)',
    letterSpacing: '0.04em',
    lineHeight: 1.5,
    marginTop: -4,
  },
  answerInput: {
    background: '#f5f0e8',
    border: '1px solid rgba(30,25,20,0.1)',
    borderRadius: 2,
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 15,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.82)',
    padding: '12px 14px',
    outline: 'none',
    resize: 'vertical',
    lineHeight: 1.65,
    width: '100%',
    boxSizing: 'border-box',
    spellCheck: true,
  },
  cmdHint: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'rgba(30,25,20,0.2)',
    letterSpacing: '0.06em',
    marginTop: -4,
  },
  navRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  // Generating
  generatingBlock: {
    padding: '48px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  generatingDots: {
    display: 'flex',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#C6A85E',
    animation: 'pulse 1.2s ease-in-out infinite',
  },
  generatingTitle: {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 18,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.75)',
  },
  generatingSub: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: 'rgba(30,25,20,0.3)',
    letterSpacing: '0.06em',
    lineHeight: 1.6,
    textAlign: 'center',
  },
  // Review
  reviewBlock: {
    padding: '24px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  reviewHeader: {
    borderBottom: '1px solid rgba(201,168,76,0.15)',
    paddingBottom: 12,
    marginBottom: 4,
  },
  reviewLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.2em',
    color: '#C6A85E',
    marginBottom: 4,
  },
  reviewTitle: {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 20,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.85)',
  },
  briefSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  briefSectionLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.16em',
    color: 'rgba(30,25,20,0.3)',
    textTransform: 'uppercase',
  },
  briefSectionText: {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 14,
    color: 'rgba(30,25,20,0.75)',
    lineHeight: 1.6,
  },
  arcRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  arcStart: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 13,
    color: '#B85C38',
    letterSpacing: '0.04em',
  },
  arcArrow: {
    color: 'rgba(30,25,20,0.2)',
  },
  arcEnd: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 13,
    color: '#4A7C59',
    letterSpacing: '0.04em',
  },
  charRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  charChip: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: '#8B6914',
    background: 'rgba(201,168,76,0.1)',
    borderRadius: 2,
    padding: '3px 8px',
    letterSpacing: '0.06em',
  },
  openingHint: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'rgba(30,25,20,0.25)',
    letterSpacing: '0.06em',
    marginTop: 4,
  },
  openingActions: {
    display: 'flex',
    gap: 8,
    marginTop: 10,
  },
  openingCopyBtn: {
    background: 'none',
    border: '1px solid rgba(30,25,20,0.15)',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.08em',
    color: 'rgba(30,25,20,0.45)',
    padding: '5px 12px',
    cursor: 'pointer',
    transition: 'all 0.12s',
  },
  openingUseBtn: {
    background: '#7A9B7E',
    border: 'none',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.08em',
    color: 'white',
    padding: '5px 12px',
    cursor: 'pointer',
    transition: 'opacity 0.12s',
  },
  reviewActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTop: '1px solid rgba(201,168,76,0.1)',
    marginTop: 4,
  },
  // Buttons
  startBtn: {
    background: '#C6A85E',
    border: 'none',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 13,
    letterSpacing: '0.12em',
    color: '#14100c',
    fontWeight: 600,
    padding: '10px 22px',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  nextBtn: {
    background: '#C6A85E',
    border: 'none',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 13,
    letterSpacing: '0.12em',
    color: '#14100c',
    fontWeight: 600,
    padding: '9px 20px',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  backBtn: {
    background: 'none',
    border: '1px solid rgba(30,25,20,0.12)',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    letterSpacing: '0.1em',
    color: 'rgba(30,25,20,0.4)',
    padding: '8px 14px',
    cursor: 'pointer',
  },
  skipBtn: {
    background: 'none',
    border: 'none',
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    letterSpacing: '0.08em',
    color: 'rgba(30,25,20,0.3)',
    padding: '8px 4px',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  viewPrevBtn: {
    background: 'none',
    border: '1px solid rgba(201,168,76,0.3)',
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    letterSpacing: '0.08em',
    color: '#C6A85E',
    padding: '6px 12px',
    borderRadius: 3,
    cursor: 'pointer',
  },
  reuseBtn: {
    fontFamily: 'DM Sans, sans-serif',
    fontSize: 13,
    fontWeight: 600,
    background: 'rgba(201,168,76,0.1)',
    border: '1px solid rgba(201,168,76,0.35)',
    color: '#8B7A3E',
    borderRadius: 3,
    padding: '10px 20px',
    cursor: 'pointer',
    letterSpacing: '0.02em',
  },
  error: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: '#B85C38',
    background: 'rgba(184,92,56,0.06)',
    border: '1px solid rgba(184,92,56,0.15)',
    borderRadius: 2,
    padding: '8px 12px',
    letterSpacing: '0.04em',
  },
};
