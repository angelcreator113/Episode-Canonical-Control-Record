/**
 * CharacterDilemmaEngine.jsx
 * frontend/src/components/CharacterDilemmaEngine.jsx
 *
 * Five dilemmas. Both choices cost something real.
 * What they choose is who they are.
 *
 * API:
 *   GET  /api/v1/therapy/dilemmas?character_id=&count=5
 *   POST /api/v1/therapy/dilemma-profile
 *
 * Props:
 *   character: { id, name, selected_name, type, role, wound }
 *   onProfileBuilt: function(profile)
 */
import { useState, useEffect, useRef } from 'react';

const API_BASE = '/api/v1';
const TOTAL    = 5;

const TYPE_ACCENT = {
  pressure: '#B85C38',
  mirror:   '#9B7FD4',
  support:  '#4A9B6F',
  shadow:   '#E08C3A',
  special:  '#B8962E',
  default:  '#B8962E',
};

export default function CharacterDilemmaEngine({ character, onProfileBuilt }) {
  const [phase, setPhase]       = useState('loading');
  const [dilemmas, setDilemmas] = useState([]);
  const [current, setCurrent]   = useState(0);
  const [choices, setChoices]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [profile, setProfile]   = useState(null);
  const costRef = useRef(null);

  const accent   = TYPE_ACCENT[character?.type] || TYPE_ACCENT.default;
  const charName = character?.selected_name || character?.name || 'this character';

  useEffect(() => {
    if (!character?.id) return;
    (async () => {
      try {
        const res  = await fetch(`${API_BASE}/therapy/dilemmas?character_id=${character.id}&count=${TOTAL}`);
        const data = await res.json();
        setDilemmas(
          data.success && data.dilemmas?.length ? data.dilemmas : getFallbackDilemmas(character)
        );
      } catch {
        setDilemmas(getFallbackDilemmas(character));
      }
      setPhase('dilemma');
    })();
  }, [character?.id]);

  const handleChoice = (i) => {
    if (selected !== null) return;
    setSelected(i);
    setTimeout(() => {
      setRevealed(true);
      costRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 280);
  };

  const handleNext = () => {
    const d = dilemmas[current];
    const newChoices = [...choices, {
      dilemma_id:    d.id || `d_${current}`,
      prompt:        d.prompt,
      choice_text:   d.choices[selected].text,
      choice_index:  selected,
      cost_accepted: d.choices[selected].cost,
    }];
    setChoices(newChoices);
    if (current + 1 >= dilemmas.length) {
      buildProfile(newChoices);
    } else {
      setCurrent(current + 1);
      setSelected(null);
      setRevealed(false);
    }
  };

  const buildProfile = async (allChoices) => {
    setPhase('processing');
    try {
      const res  = await fetch(`${API_BASE}/therapy/dilemma-profile`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          character_id:   character.id,
          character_name: charName,
          wound:          character.wound || '',
          choices:        allChoices,
        }),
      });
      const data = await res.json();
      const p = data.success && data.profile ? data.profile : buildFallbackProfile(allChoices);
      setProfile(p);
      setPhase('complete');
      setTimeout(() => onProfileBuilt?.(p), 400);
    } catch {
      const p = buildFallbackProfile(allChoices);
      setProfile(p);
      setPhase('complete');
      setTimeout(() => onProfileBuilt?.(p), 400);
    }
  };

  // ── Loading ───────────────────────────────────────────────────
  if (phase === 'loading') return (
    <div style={s.root}>
      <div style={s.centered}>
        <div style={{ ...s.pulse, borderColor: accent }} />
        <div style={s.loadText}>Preparing dilemmas for {charName}…</div>
      </div>
    </div>
  );

  // ── Processing ────────────────────────────────────────────────
  if (phase === 'processing') return (
    <div style={s.root}>
      <div style={s.centered}>
        <div style={{ ...s.pulse, borderColor: accent }} />
        <div style={s.loadText}>Reading {charName}'s choices…</div>
        <div style={s.loadSub}>Building psychological baseline</div>
      </div>
    </div>
  );

  // ── Complete ──────────────────────────────────────────────────
  if (phase === 'complete' && profile) return (
    <div style={s.root}>
      <div style={s.completeWrap}>
        <div style={{ ...s.completeIcon, color: accent }}>◈</div>
        <div style={s.completeTitle}>Baseline established</div>
        <div style={s.completeDefense}>
          Defense: <span style={{ color: accent }}>{profile.primary_defense}</span>
        </div>
        {profile.belief_pressured && (
          <div style={s.completeBelief}>"{profile.belief_pressured}"</div>
        )}
        <div style={s.completeSummary}>
          {choices.map((c, i) => (
            <div key={i} style={s.completeRow}>
              <span style={{ ...s.completeNum, color: accent }}>{i + 1}</span>
              <span style={s.completeRowText}>{c.choice_text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Active dilemma ────────────────────────────────────────────
  const d = dilemmas[current];
  if (!d) return null;

  return (
    <div style={s.root}>
      <div style={s.progressRow}>
        <div style={s.progressTrack}>
          <div style={{ ...s.progressFill, width: `${(current / TOTAL) * 100}%`, background: accent }} />
        </div>
        <div style={s.progressLabel}>{current + 1} / {TOTAL}</div>
      </div>

      <div style={s.promptWrap}>
        {d.context && <div style={s.context}>{d.context}</div>}
        <div style={s.prompt}>{d.prompt}</div>
      </div>

      <div style={s.choicesWrap}>
        {d.choices.map((choice, i) => {
          const isSel   = selected === i;
          const isOther = selected !== null && !isSel;
          return (
            <button
              key={i}
              style={{
                ...s.choiceBtn,
                ...(isSel   ? { ...s.choiceSel, borderColor: accent } : {}),
                ...(isOther ? s.choiceFaded : {}),
                cursor: selected !== null ? 'default' : 'pointer',
              }}
              onClick={() => handleChoice(i)}
            >
              <div style={s.choiceLetter}>{String.fromCharCode(65 + i)}</div>
              <div style={s.choiceInner}>
                <div style={s.choiceText}>{choice.text}</div>
                {isSel && revealed && (
                  <div ref={costRef} style={{ ...s.choiceCost, color: accent }}>
                    Cost: {choice.cost}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {revealed && d.tension_note && (
        <div style={s.tensionNote}>{d.tension_note}</div>
      )}

      {revealed && (
        <div style={s.nextRow}>
          <button style={{ ...s.nextBtn, background: accent }} onClick={handleNext}>
            {current + 1 >= TOTAL ? 'Complete baseline' : 'Next dilemma →'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Fallbacks ──────────────────────────────────────────────────────────────

function getFallbackDilemmas(character) {
  const n = character?.selected_name || character?.name || 'they';
  return [
    {
      id: 'd0',
      context: `${n} is offered what they've wanted for a long time.`,
      prompt: 'Do you take it knowing someone who supported you will feel left behind?',
      choices: [
        { text: 'Take it. You earned this. They\'ll understand eventually.',        cost: 'You accepted that some loyalty has an expiration date.' },
        { text: 'Wait. You don\'t move until you can bring them with you.',        cost: 'You accepted that your timing will never be fully your own.' },
      ],
      tension_note: 'Both choices reveal something about who they are when it costs them.',
    },
    {
      id: 'd1',
      context: `Someone is saying something untrue about ${n} — and people believe it.`,
      prompt: 'Do you correct it publicly, or let silence protect something more important?',
      choices: [
        { text: 'Correct it. The record matters. Let people see the truth.',       cost: 'You accepted that being right sometimes costs more than being silent.' },
        { text: 'Stay silent. Some truths aren\'t worth the war they start.',      cost: 'You accepted that your reputation can be held hostage by your own restraint.' },
      ],
      tension_note: 'What they choose reveals their relationship with being misunderstood.',
    },
    {
      id: 'd2',
      context: `${n} has been carrying something for someone else for a long time.`,
      prompt: 'Do you put it down and let them handle the weight, or keep carrying it?',
      choices: [
        { text: 'Put it down. It was never yours to carry this long.',             cost: 'You accepted that letting go sometimes looks like abandonment.' },
        { text: 'Keep carrying. You chose this person. You don\'t stop now.',      cost: 'You accepted that love and resentment can live in the same hand.' },
      ],
      tension_note: 'Reveals whether they protect through presence or sacrifice.',
    },
    {
      id: 'd3',
      context: 'A room is divided. Taking a side will cost them with half of it.',
      prompt: 'Do you take the side you believe in, or hold the center to protect everyone?',
      choices: [
        { text: 'Take the side. You can\'t stand for something by standing nowhere.', cost: 'You accepted that conviction burns bridges it didn\'t build.' },
        { text: 'Hold the center. The room matters more than being right.',            cost: 'You accepted that some principles get filed away and called wisdom.' },
      ],
      tension_note: 'Their answer defines their operating logic under social pressure.',
    },
    {
      id: 'd4',
      context: `${n} is close to something that has cost them everything to build.`,
      prompt: 'Do you protect the thing you built, or the person who was there while you built it?',
      choices: [
        { text: 'Protect the thing. It represents everything you survived.',       cost: 'You accepted that some witnesses don\'t make it to the arrival.' },
        { text: 'Protect the person. The thing can be rebuilt. They cannot.',      cost: 'You accepted that the price of loyalty is sometimes the dream itself.' },
      ],
      tension_note: 'This is the dilemma that defines their ultimate hierarchy of value.',
    },
  ];
}

function buildFallbackProfile(choices) {
  const defenses = [
    'Quiet withdrawal', 'Deflection through competence', 'Controlled presentation',
    'Strategic silence', 'Selective vulnerability',
  ];
  return {
    primary_defense:  defenses[choices.length % defenses.length],
    belief_pressured: choices[choices.length - 1]?.choice_text || '',
    writer_notes:     `Baseline from dilemma session. ${choices.length} choices made.`,
    emotional_state:  { trust: 50, grief: 30, anger: 20, hope: 60, fear: 35, love: 50 },
  };
}

// ── Styles — parchment/ink/gold, matches TherapyDilemmaGate ──────────────
const PARCHMENT = '#FAF7F0';
const INK       = '#1C1814';
const INK_MID   = 'rgba(28,24,20,0.55)';
const INK_LIGHT = 'rgba(28,24,20,0.25)';
const CREAM     = '#F5F0E5';

const s = {
  root: {
    background:    PARCHMENT,
    padding:       '24px',
    display:       'flex',
    flexDirection: 'column',
    gap:           20,
    fontFamily:    "'DM Mono', 'Courier New', monospace",
    minHeight:     360,
  },
  centered: {
    flex:           1,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            14,
    padding:        '40px 0',
  },
  pulse: {
    width:       28,
    height:      28,
    borderRadius:'50%',
    border:      '2px solid',
    animation:   'therapyPulse 1.4s ease-in-out infinite',
  },
  loadText:  { fontSize: 12, color: INK_MID, letterSpacing: '0.04em' },
  loadSub:   { fontSize: 10, color: INK_LIGHT, letterSpacing: '0.08em' },
  completeWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 12, padding: '28px 0', textAlign: 'center',
  },
  completeIcon:    { fontSize: 26 },
  completeTitle:   { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, color: INK, letterSpacing: '0.02em' },
  completeDefense: { fontSize: 10, color: INK_LIGHT, letterSpacing: '0.08em' },
  completeBelief:  { fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', fontSize: 12, color: INK_MID, maxWidth: 380, lineHeight: 1.6 },
  completeSummary: { display: 'flex', flexDirection: 'column', gap: 5, width: '100%', maxWidth: 400, marginTop: 6 },
  completeRow:     { display: 'flex', alignItems: 'flex-start', gap: 8, textAlign: 'left' },
  completeNum:     { fontSize: 8, letterSpacing: '0.08em', marginTop: 2, flexShrink: 0, fontWeight: 600 },
  completeRowText: { fontSize: 10, color: INK_LIGHT, lineHeight: 1.5 },
  progressRow:   { display: 'flex', alignItems: 'center', gap: 10 },
  progressTrack: { flex: 1, height: 2, background: 'rgba(28,24,20,0.1)', borderRadius: 1, overflow: 'hidden' },
  progressFill:  { height: '100%', transition: 'width 0.4s ease' },
  progressLabel: { fontSize: 8, color: INK_LIGHT, letterSpacing: '0.12em', flexShrink: 0 },
  promptWrap: { display: 'flex', flexDirection: 'column', gap: 7 },
  context:    { fontSize: 9, letterSpacing: '0.1em', color: INK_LIGHT, textTransform: 'uppercase' },
  prompt:     { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 19, color: INK, lineHeight: 1.4, letterSpacing: '0.01em' },
  choicesWrap: { display: 'flex', flexDirection: 'column', gap: 10 },
  choiceBtn: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    background: CREAM, border: '1px solid rgba(28,24,20,0.1)',
    borderRadius: 4, padding: '14px 16px', textAlign: 'left',
    transition: 'border-color 0.2s, opacity 0.2s',
  },
  choiceSel:    { background: '#FAF7F0', border: '1px solid' },
  choiceFaded:  { opacity: 0.3 },
  choiceLetter: { fontSize: 9, color: INK_LIGHT, letterSpacing: '0.15em', marginTop: 2, flexShrink: 0 },
  choiceInner:  { flex: 1 },
  choiceText:   { fontSize: 13, color: INK, lineHeight: 1.5, fontFamily: "'Lora', Georgia, serif" },
  choiceCost:   { fontSize: 10, marginTop: 7, lineHeight: 1.4, fontStyle: 'italic', letterSpacing: '0.02em', animation: 'therapyFadeIn 0.4s ease' },
  tensionNote: {
    fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', fontSize: 11,
    color: INK_LIGHT, lineHeight: 1.6, padding: '8px 0',
    borderTop: '1px solid rgba(28,24,20,0.08)', animation: 'therapyFadeIn 0.5s ease',
  },
  nextRow: { display: 'flex', justifyContent: 'flex-end' },
  nextBtn: {
    border: 'none', borderRadius: 3, padding: '11px 20px',
    color: PARCHMENT, fontSize: 9, letterSpacing: '0.12em',
    cursor: 'pointer', fontFamily: "'DM Mono', monospace",
    fontWeight: 600, animation: 'therapyFadeIn 0.4s ease',
  },
};
