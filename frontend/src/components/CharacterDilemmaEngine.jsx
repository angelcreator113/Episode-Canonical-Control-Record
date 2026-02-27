/**
 * CharacterDilemmaEngine.jsx — "The Pressure Room"
 *
 * "A character is not what they say under comfort.
 *  A character is what they choose under pressure."
 *
 * This component generates dilemmas that reveal character through forced choices.
 * Each dilemma presents two defensible options — both costly.
 * After 5 answers, a profile is compiled from the pattern of choices.
 *
 * Light theme — parchment ground, ink text, gold accents.
 *
 * Props:
 *   character   — { id, name, character_type, role, story_context }
 *   onProfileBuilt — callback when profile is compiled
 */

import React, { useState, useCallback } from 'react';

const API = '/api/v1/memories';

/* ── Palette ── */
const PARCHMENT   = '#FAF7F0';
const INK         = '#1C1814';
const GOLD        = '#B8962E';
const WARM_BORDER = 'rgba(28,24,20,0.10)';
const WARM_HOVER  = 'rgba(28,24,20,0.04)';
const SUBTLE_BG   = 'rgba(28,24,20,0.02)';

export default function CharacterDilemmaEngine({ character, onProfileBuilt }) {
  const [dilemmas, setDilemmas]       = useState([]);
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [answers, setAnswers]         = useState([]);
  const [loading, setLoading]         = useState(false);
  const [profile, setProfile]         = useState(null);
  const [phase, setPhase]             = useState('intro');  // intro | dilemma | cost | profile
  const [selectedOption, setSelected] = useState(null);
  const [costAnswer, setCostAnswer]   = useState('');
  const [error, setError]             = useState(null);

  /* ── Generate dilemmas ── */
  const generateDilemmas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/character-dilemma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id:     character.id,
          character_name:   character.name,
          character_type:   character.character_type || 'pressure',
          character_role:   character.role || '',
          story_context:    character.story_context || '',
          existing_answers: answers,
        }),
      });
      const data = await res.json();
      if (data.dilemmas) {
        setDilemmas(data.dilemmas);
        setCurrentIdx(0);
        setPhase('dilemma');
      }
    } catch (err) {
      setError('Failed to generate dilemmas. Try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [character, answers]);

  /* ── Submit choice + cost answer ── */
  const submitAnswer = useCallback(() => {
    const dilemma = dilemmas[currentIdx];
    const newAnswer = {
      dilemma:       dilemma.setup,
      dilemma_setup: dilemma.setup,
      choice:        selectedOption === 'a' ? dilemma.option_a : dilemma.option_b,
      cost:          costAnswer,
      option_chosen: selectedOption,
    };
    const updated = [...answers, newAnswer];
    setAnswers(updated);
    setSelected(null);
    setCostAnswer('');

    if (currentIdx < dilemmas.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setPhase('dilemma');
    } else {
      // Done — compile profile
      compileProfile(updated);
    }
  }, [dilemmas, currentIdx, selectedOption, costAnswer, answers]);

  /* ── Compile profile from answers ── */
  const compileProfile = useCallback(async (finalAnswers) => {
    setLoading(true);
    setPhase('profile');
    try {
      const res = await fetch(`${API}/character-dilemma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id:     character.id,
          character_name:   character.name,
          character_type:   character.character_type || 'pressure',
          character_role:   character.role || '',
          generate_profile: true,
          existing_answers: finalAnswers,
        }),
      });
      const data = await res.json();
      if (data.profile) {
        setProfile(data.profile);
        if (onProfileBuilt) onProfileBuilt(data.profile);
      }
    } catch (err) {
      setError('Profile compilation failed.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [character, onProfileBuilt]);

  /* ── Current dilemma ── */
  const dilemma = dilemmas[currentIdx];

  /* ════════════════════════════════════════
     RENDER
     ════════════════════════════════════════ */

  return (
    <div style={{
      fontFamily: "'Lora', 'Georgia', serif",
      color: INK,
      background: PARCHMENT,
      borderRadius: 10,
      border: `1px solid ${WARM_BORDER}`,
      padding: 32,
      maxWidth: 640,
      margin: '0 auto',
    }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28, borderBottom: `1px solid ${WARM_BORDER}`, paddingBottom: 16 }}>
        <div style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: GOLD,
          marginBottom: 6,
        }}>
          The Pressure Room
        </div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>
          {character?.name || 'Character'} — Dilemma Engine
        </div>
        <div style={{ fontSize: 13, color: 'rgba(28,24,20,0.55)', marginTop: 4 }}>
          {answers.length} of {dilemmas.length || 5} dilemmas answered
        </div>
      </div>

      {/* ── Progress dots ── */}
      {dilemmas.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, justifyContent: 'center' }}>
          {dilemmas.map((_, i) => (
            <div key={i} style={{
              width: 10, height: 10, borderRadius: '50%',
              background: i < answers.length ? GOLD : i === currentIdx ? INK : WARM_BORDER,
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      )}

      {/* ── INTRO PHASE ── */}
      {phase === 'intro' && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(28,24,20,0.7)', marginBottom: 24 }}>
            Five dilemmas. No right answers.<br />
            Both choices cost something real.<br />
            What {character?.name || 'they'} choose under pressure <em>is</em> who they are.
          </p>
          <button
            onClick={generateDilemmas}
            disabled={loading}
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background: INK,
              color: PARCHMENT,
              border: 'none',
              padding: '12px 32px',
              borderRadius: 6,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? 'Generating…' : 'Begin'}
          </button>
        </div>
      )}

      {/* ── DILEMMA PHASE ── */}
      {phase === 'dilemma' && dilemma && (
        <div>
          <div style={{
            fontSize: 15,
            lineHeight: 1.8,
            marginBottom: 24,
            fontStyle: 'italic',
            color: 'rgba(28,24,20,0.75)',
          }}>
            {dilemma.setup}
          </div>

          {/* Option A */}
          <button
            onClick={() => setSelected('a')}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '16px 20px',
              marginBottom: 12,
              background: selectedOption === 'a' ? 'rgba(184,150,46,0.10)' : SUBTLE_BG,
              border: `1.5px solid ${selectedOption === 'a' ? GOLD : WARM_BORDER}`,
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: "'Lora', serif",
              fontSize: 14,
              lineHeight: 1.6,
              color: INK,
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: GOLD, marginRight: 10 }}>A</span>
            {dilemma.option_a}
          </button>

          {/* Option B */}
          <button
            onClick={() => setSelected('b')}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '16px 20px',
              marginBottom: 20,
              background: selectedOption === 'b' ? 'rgba(184,150,46,0.10)' : SUBTLE_BG,
              border: `1.5px solid ${selectedOption === 'b' ? GOLD : WARM_BORDER}`,
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: "'Lora', serif",
              fontSize: 14,
              lineHeight: 1.6,
              color: INK,
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: GOLD, marginRight: 10 }}>B</span>
            {dilemma.option_b}
          </button>

          {/* After selecting, show cost question */}
          {selectedOption && (
            <div style={{
              marginTop: 8,
              padding: 20,
              background: SUBTLE_BG,
              borderRadius: 8,
              border: `1px solid ${WARM_BORDER}`,
            }}>
              <div style={{
                fontSize: 14,
                fontStyle: 'italic',
                marginBottom: 12,
                color: 'rgba(28,24,20,0.7)',
              }}>
                {dilemma.cost_question}
              </div>
              <textarea
                value={costAnswer}
                onChange={e => setCostAnswer(e.target.value)}
                placeholder="What does this choice cost?"
                rows={2}
                style={{
                  width: '100%',
                  background: PARCHMENT,
                  border: `1px solid ${WARM_BORDER}`,
                  borderRadius: 6,
                  padding: 12,
                  fontFamily: "'Lora', serif",
                  fontSize: 14,
                  color: INK,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={submitAnswer}
                disabled={!costAnswer.trim()}
                style={{
                  marginTop: 12,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 12,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  background: costAnswer.trim() ? INK : WARM_BORDER,
                  color: PARCHMENT,
                  border: 'none',
                  padding: '10px 28px',
                  borderRadius: 6,
                  cursor: costAnswer.trim() ? 'pointer' : 'default',
                }}
              >
                {currentIdx < dilemmas.length - 1 ? 'Next Dilemma →' : 'Compile Profile'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── PROFILE PHASE ── */}
      {phase === 'profile' && (
        <div>
          {loading && (
            <div style={{ textAlign: 'center', padding: 32, color: 'rgba(28,24,20,0.5)', fontStyle: 'italic' }}>
              Compiling profile from pressure responses…
            </div>
          )}
          {profile && !profile.raw && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ProfileField label="Core Belief" value={profile.core_belief} />
              <ProfileField label="Primary Defense" value={profile.primary_defense} />
              <ProfileField label="Wound" value={profile.wound} />
              <ProfileField label="Operating Logic" value={profile.operating_logic} />
              <ProfileField label="Relationship to Protagonist" value={profile.relationship_to_protagonist} />

              <div style={{
                marginTop: 16,
                padding: 16,
                background: 'rgba(184,150,46,0.06)',
                borderRadius: 8,
                border: `1px solid rgba(184,150,46,0.18)`,
                textAlign: 'center',
              }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: GOLD, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Profile saved to registry
                </div>
              </div>
            </div>
          )}
          {profile && profile.raw && (
            <div style={{ fontStyle: 'italic', color: 'rgba(28,24,20,0.6)', fontSize: 14, lineHeight: 1.7 }}>
              {profile.raw}
            </div>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div style={{
          marginTop: 16,
          padding: 12,
          background: 'rgba(180,60,60,0.06)',
          border: '1px solid rgba(180,60,60,0.15)',
          borderRadius: 6,
          color: '#8B3030',
          fontSize: 13,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

/* ── Profile field display ── */
function ProfileField({ label, value }) {
  return (
    <div style={{
      padding: '14px 18px',
      background: 'rgba(28,24,20,0.02)',
      borderRadius: 8,
      border: '1px solid rgba(28,24,20,0.08)',
    }}>
      <div style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#B8962E',
        marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'Lora', serif",
        fontSize: 14,
        lineHeight: 1.6,
        color: '#1C1814',
      }}>
        {value}
      </div>
    </div>
  );
}
