/**
 * ConsciousnessLayer — The texture of existing with the wound
 *
 * Psychology describes what the wound is.
 * Consciousness describes what it's like to live with it.
 *
 * Location: frontend/src/components/ConsciousnessLayer.jsx
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import './ConsciousnessLayer.css';

const API = '/api/v1/consciousness';

/* ─── Field metadata (labels + icons) ── */
const FIELD_META = {
  interior_texture:           { label: 'Interior Texture',         icon: '◈', desc: 'How the mind moves' },
  body_consciousness:         { label: 'Body Consciousness',       icon: '◉', desc: 'Where emotion lives physically' },
  temporal_orientation:       { label: 'Temporal Orientation',     icon: '◎', desc: 'Past, present, or future' },
  social_perception:          { label: 'Social Perception',        icon: '◍', desc: 'How accurately she reads others' },
  self_awareness_calibration: { label: 'Self-Awareness',           icon: '◐', desc: 'Quality of self-examination' },
  change_mechanism:           { label: 'Change Mechanism',         icon: '◑', desc: 'What actually moves her' },
};

const INHERITED_META = {
  inherited_instincts:      { label: 'Inherited Instincts',       icon: '⟡', desc: 'Unexplained certainties' },
  confidence_without_origin:{ label: 'Confidence Without Origin', icon: '⟢', desc: 'Rootless confidence' },
  playbook_manifestations:  { label: 'Playbook Manifestations',   icon: '⟣', desc: 'Wisdom running unseen' },
  blind_spots:              { label: 'Blind Spots',               icon: '⟠', desc: 'What she can\'t see yet' },
  resonance_triggers:       { label: 'Resonance Triggers',        icon: '⟡', desc: 'The inexplicable pull' },
};

/* ─── Lala detection ── */
function detectLala(character) {
  return (
    character?.display_name === 'Lala' ||
    character?.selected_name === 'Lala' ||
    (character?.role_type === 'special' &&
     character?.appearance_mode?.includes?.('creation'))
  );
}

/* ─── Render individual consciousness field values (read-only) ── */
function FieldValue({ label, value }) {
  if (!value) return null;
  if (Array.isArray(value)) {
    return (
      <div className="cl-field-item">
        <span className="cl-field-key">{label}</span>
        <ul className="cl-field-list">
          {value.map((v, i) => <li key={i}>{v}</li>)}
        </ul>
      </div>
    );
  }
  return (
    <div className="cl-field-item">
      <span className="cl-field-key">{label}</span>
      <span className="cl-field-val">{value}</span>
    </div>
  );
}


/* ================================================================== */
export default function ConsciousnessLayer({ character, psychology, dilemmas }) {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genLala, setGenLala]       = useState(false);
  const [error, setError]           = useState(null);
  const [saved, setSaved]           = useState(false);
  const [genTriggers, setGenTriggers] = useState(false);

  /* ── Interview state ── */
  const [interviewMode, setInterviewMode]   = useState(false);
  const [interviewData, setInterviewData]   = useState(null);
  const [interviewInput, setInterviewInput] = useState('');
  const [interviewHistory, setInterviewHistory] = useState([]);
  const [interviewSending, setInterviewSending] = useState(false);
  const chatEndRef = useRef(null);

  const isLala = detectLala(character);

  /* ── Load existing consciousness ── */
  const loadData = useCallback(async () => {
    if (!character?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/${character.id}`);
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.warn('[ConsciousnessLayer] Load:', err.message);
    } finally {
      setLoading(false);
    }
  }, [character?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Generate consciousness ── */
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${API}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: {
            id: character.id,
            name: character.selected_name || character.display_name,
            selected_name: character.selected_name,
            display_name: character.display_name,
            role_type: character.role_type,
            belief_pressured: character.belief_pressured,
            emotional_function: character.emotional_function,
          },
          psychology: psychology || {},
          world: 'LalaVerse',
        }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const json = await res.json();

      /* Auto-save */
      const saveRes = await fetch(`${API}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character_id: character.id, profile: json.profile }),
      });
      if (saveRes.ok) setSaved(true);

      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  /* ── Generate Lala inherited ── */
  const handleGenerateLala = async () => {
    setGenLala(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${API}/generate-lala`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lala_character: {
            id: character.id,
            name: character.selected_name || character.display_name,
            role_type: character.role_type,
          },
          justawoman_consciousness: data?.consciousness || {},
          justawoman_psychology: psychology || {},
        }),
      });
      if (!res.ok) throw new Error('Lala generation failed');
      const json = await res.json();

      /* Auto-save */
      const saveRes = await fetch(`${API}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character_id: character.id, profile: json.profile, is_lala_profile: true }),
      });
      if (saveRes.ok) setSaved(true);

      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenLala(false);
    }
  };

  /* ── Interview: start ── */
  const startInterview = async () => {
    setInterviewMode(true);
    setInterviewHistory([]);
    setInterviewData(null);
    setError(null);
    try {
      const res = await fetch(`${API}/interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: {
            id: character.id,
            name: character.selected_name || character.display_name,
            selected_name: character.selected_name,
            display_name: character.display_name,
            role_type: character.role_type,
            belief_pressured: character.belief_pressured,
          },
          psychology: psychology || {},
        }),
      });
      const json = await res.json();
      setInterviewData(json);
      setInterviewHistory([{ role: 'assistant', content: json.message }]);
    } catch (err) {
      setError('Failed to start interview');
      setInterviewMode(false);
    }
  };

  /* ── Interview: send answer ── */
  const sendInterviewAnswer = async () => {
    if (!interviewInput.trim() || interviewSending) return;
    const answer = interviewInput.trim();
    setInterviewInput('');
    setInterviewSending(true);

    const newHistory = [...interviewHistory, { role: 'user', content: answer }];
    setInterviewHistory(newHistory);

    try {
      const res = await fetch(`${API}/interview-next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: {
            id: character.id,
            name: character.selected_name || character.display_name,
            selected_name: character.selected_name,
            display_name: character.display_name,
            role_type: character.role_type,
            belief_pressured: character.belief_pressured,
          },
          psychology: psychology || {},
          creator_answer: answer,
          current_field: interviewData?.current_field || interviewData?.next_field,
          field_index: interviewData?.next_field_index ?? interviewData?.field_index ?? 0,
          conversation_history: newHistory.map(m => ({ role: m.role, content: m.content })),
          extracted_so_far: interviewData?.extracted_this_turn || {},
        }),
      });
      const json = await res.json();
      setInterviewData(json);
      setInterviewHistory(prev => [...prev, { role: 'assistant', content: json.message }]);

      /* If complete — auto-save the profile */
      if (json.all_complete && json.consciousness_profile) {
        await fetch(`${API}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ character_id: character.id, profile: json.consciousness_profile }),
        });
        setSaved(true);
        await loadData();
        setTimeout(() => setInterviewMode(false), 2000);
      }
    } catch (err) {
      setInterviewHistory(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Tell me more about that.' }]);
    } finally {
      setInterviewSending(false);
    }
  };

  /* ── Auto-dismiss saved notification ── */
  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(t);
    }
  }, [saved]);

  /* ── Generate dilemma triggers ── */
  const handleGenerateTriggers = async () => {
    if (!data?.consciousness) return;
    setGenTriggers(true);
    setError(null);
    try {
      const res = await fetch(`${API}/dilemma-triggers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: {
            id: character.id,
            name: character.selected_name || character.display_name,
            selected_name: character.selected_name,
            display_name: character.display_name,
            role_type: character.role_type,
            psychology: psychology || {},
          },
          dilemmas: dilemmas || {
            active: psychology?.core_wound || character.belief_pressured || 'unnamed active dilemma',
            latent_1: psychology?.fear_line || character.core_fear || 'unnamed latent dilemma 1',
            latent_2: psychology?.desire_line || character.core_desire || 'unnamed latent dilemma 2',
          },
          consciousness: data.consciousness,
        }),
      });
      if (!res.ok) throw new Error('Trigger generation failed');
      setSaved(true);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenTriggers(false);
    }
  };

  /* ── Confirm regenerate ── */
  const confirmRegenerate = () => {
    if (!hasConsciousness || window.confirm('Regenerate consciousness profile? This will overwrite the existing one.')) {
      handleGenerate();
    }
  };

  const confirmRegenerateLala = () => {
    if (!data?.inherited_consciousness || window.confirm('Regenerate inherited consciousness? This will overwrite the existing one.')) {
      handleGenerateLala();
    }
  };

  /* Scroll to bottom of chat */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interviewHistory]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendInterviewAnswer(); }
  };

  /* ═══════════════════════════════════════════════════ */
  /*  RENDER                                             */
  /* ═══════════════════════════════════════════════════ */

  if (loading) {
    return (
      <div className="cl-wrap">
        <div className="cl-loading">
          <span className="cl-loading-icon">◈</span>
          Loading consciousness data…
        </div>
      </div>
    );
  }

  /* ── Interview Mode ── */
  if (interviewMode) {
    const progress = interviewData
      ? `${(interviewData.field_index ?? 0) + 1} / ${interviewData.total_fields || 6}`
      : '';
    const fieldLabel = interviewData?.current_field
      ? (FIELD_META[interviewData.current_field]?.label || interviewData.current_field)
      : '';

    return (
      <div className="cl-wrap">
        <div className="cl-interview">
          <header className="cl-interview-header">
            <div className="cl-interview-title">
              <span className="cl-interview-icon">◈</span>
              Consciousness Interview
            </div>
            <div className="cl-interview-meta">
              {fieldLabel && <span className="cl-interview-field">{fieldLabel}</span>}
              {progress && <span className="cl-interview-progress">{progress}</span>}
            </div>
            <button className="cl-btn cl-btn-ghost" onClick={() => setInterviewMode(false)}>
              ✕ Close
            </button>
          </header>

          <div className="cl-interview-chat">
            {interviewHistory.map((msg, i) => (
              <div key={i} className={`cl-chat-msg cl-chat-${msg.role}`}>
                <div className="cl-chat-bubble">{msg.content}</div>
              </div>
            ))}
            {interviewSending && (
              <div className="cl-chat-msg cl-chat-assistant">
                <div className="cl-chat-bubble cl-chat-typing">Thinking…</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="cl-interview-input-row">
            <textarea
              className="cl-interview-input"
              value={interviewInput}
              onChange={e => setInterviewInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Your answer…"
              rows={2}
              disabled={interviewSending}
            />
            <button
              className="cl-btn cl-btn-gold"
              onClick={sendInterviewAnswer}
              disabled={!interviewInput.trim() || interviewSending}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main View ── */
  const con = data?.consciousness;
  const inherited = data?.inherited_consciousness;
  const hasConsciousness = data?.has_consciousness;

  const charName = character?.selected_name || character?.display_name || 'Character';

  return (
    <div className="cl-wrap">

      {/* ── Header ── */}
      <div className="cl-header">
        <div className="cl-header-left">
          <span className="cl-header-icon">◈</span>
          <div>
            <h3 className="cl-title">Consciousness Layer</h3>
            <p className="cl-subtitle">How {charName} exists — not what she does, but the texture of being her</p>
          </div>
        </div>
        <div className="cl-header-actions">
          {!hasConsciousness ? (
            <>
              <button className="cl-btn cl-btn-gold" onClick={handleGenerate} disabled={generating}>
                {generating ? '◈ Generating…' : '◈ Generate'}
              </button>
              <button className="cl-btn cl-btn-outline" onClick={startInterview} disabled={generating}>
                ✦ Interview Mode
              </button>
            </>
          ) : (
            <>
              <button className="cl-btn cl-btn-outline" onClick={confirmRegenerate} disabled={generating}>
                {generating ? '◈ Regenerating…' : '↻ Regenerate'}
              </button>
              <button className="cl-btn cl-btn-outline" onClick={startInterview} disabled={generating}>
                ✦ Interview
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="cl-error">{error}</div>}
      {saved && <div className="cl-saved">✓ Saved to canon record</div>}

      {/* ── Empty State ── */}
      {!hasConsciousness && (
        <div className="cl-empty">
          <div className="cl-empty-icon">◈</div>
          <h4>No consciousness profile yet</h4>
          <p>
            Psychology describes the wound. Consciousness describes the texture of existing with it.
            Generate a profile or build one through interview.
          </p>
        </div>
      )}

      {/* ── Consciousness Fields ── */}
      {hasConsciousness && con && (
        <div className="cl-fields">
          {Object.entries(FIELD_META).map(([key, meta]) => {
            const field = con[key];
            if (!field) return null;
            return (
              <div key={key} className="cl-card">
                <div className="cl-card-header">
                  <span className="cl-card-icon">{meta.icon}</span>
                  <div>
                    <h4 className="cl-card-title">{meta.label}</h4>
                    <span className="cl-card-desc">{meta.desc}</span>
                  </div>
                </div>
                <div className="cl-card-body">
                  {Object.entries(field).map(([fk, fv]) => {
                    if (fk === 'story_engine_note') {
                      return (
                        <div key={fk} className="cl-engine-note">
                          <span className="cl-engine-label">Story Engine</span>
                          <span className="cl-engine-text">{fv}</span>
                        </div>
                      );
                    }
                    const label = fk.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    return <FieldValue key={fk} label={label} value={fv} />;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Lala: Inherited Consciousness ── */}
      {isLala && hasConsciousness && (
        <div className="cl-inherited-section">
          <div className="cl-inherited-header">
            <div className="cl-inherited-header-left">
              <span className="cl-inherited-icon">⟡</span>
              <div>
                <h3 className="cl-inherited-title">Inherited Consciousness</h3>
                <p className="cl-inherited-subtitle">What transferred from JustAWoman — Lala doesn't know</p>
              </div>
            </div>
            {!inherited && (
              <button className="cl-btn cl-btn-violet" onClick={handleGenerateLala} disabled={genLala}>
                {genLala ? '⟡ Generating…' : '⟡ Generate Inherited'}
              </button>
            )}
            {inherited && (
              <button className="cl-btn cl-btn-outline cl-btn-violet-outline" onClick={confirmRegenerateLala} disabled={genLala}>
                {genLala ? '⟡ Regenerating…' : '↻ Regenerate'}
              </button>
            )}
          </div>

          {inherited && (
            <div className="cl-fields cl-inherited-fields">
              {Object.entries(INHERITED_META).map(([key, meta]) => {
                const field = inherited[key];
                if (!field) return null;
                return (
                  <div key={key} className="cl-card cl-card-inherited">
                    <div className="cl-card-header">
                      <span className="cl-card-icon cl-icon-violet">{meta.icon}</span>
                      <div>
                        <h4 className="cl-card-title">{meta.label}</h4>
                        <span className="cl-card-desc">{meta.desc}</span>
                      </div>
                    </div>
                    <div className="cl-card-body">
                      {Object.entries(field).map(([fk, fv]) => {
                        if (fk === 'story_engine_note') {
                          return (
                            <div key={fk} className="cl-engine-note cl-engine-violet">
                              <span className="cl-engine-label">Story Engine</span>
                              <span className="cl-engine-text">{fv}</span>
                            </div>
                          );
                        }
                        const label = fk.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                        return <FieldValue key={fk} label={label} value={fv} />;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Dilemma Triggers ── */}
      {hasConsciousness && (
        <div className="cl-triggers-section">
          <div className="cl-triggers-header">
            <span className="cl-triggers-icon">⚡</span>
            <h3 className="cl-triggers-title">Dilemma Triggers</h3>
            <div className="cl-triggers-actions">
              {!data?.dilemma_triggers && (
                <button className="cl-btn cl-btn-gold" onClick={handleGenerateTriggers} disabled={genTriggers}>
                  {genTriggers ? '⚡ Generating…' : '⚡ Generate Triggers'}
                </button>
              )}
              {data?.dilemma_triggers && (
                <button className="cl-btn cl-btn-outline" onClick={handleGenerateTriggers} disabled={genTriggers}>
                  {genTriggers ? '⚡ Regenerating…' : '↻ Regenerate'}
                </button>
              )}
            </div>
          </div>
          <div className="cl-triggers-grid">
            {data.dilemma_triggers.active_dilemma && (
              <div className="cl-trigger-card cl-trigger-active">
                <span className="cl-trigger-badge active">ACTIVE</span>
                <p className="cl-trigger-dilemma">{data.dilemma_triggers.active_dilemma.dilemma}</p>
                <FieldValue label="What keeps it active" value={data.dilemma_triggers.active_dilemma.what_keeps_it_active} />
                <FieldValue label="What would resolve it" value={data.dilemma_triggers.active_dilemma.what_would_resolve_it} />
              </div>
            )}
            {data.dilemma_triggers.latent_1 && (
              <div className="cl-trigger-card cl-trigger-latent">
                <span className="cl-trigger-badge latent">LATENT</span>
                <p className="cl-trigger-dilemma">{data.dilemma_triggers.latent_1.dilemma}</p>
                <FieldValue label="Activation domain" value={data.dilemma_triggers.latent_1.activation_domain} />
                <FieldValue label="Activation signal" value={data.dilemma_triggers.latent_1.activation_signal} />
              </div>
            )}
            {data.dilemma_triggers.latent_2 && (
              <div className="cl-trigger-card cl-trigger-latent">
                <span className="cl-trigger-badge latent">LATENT</span>
                <p className="cl-trigger-dilemma">{data.dilemma_triggers.latent_2.dilemma}</p>
                <FieldValue label="Activation domain" value={data.dilemma_triggers.latent_2.activation_domain} />
                <FieldValue label="Activation signal" value={data.dilemma_triggers.latent_2.activation_signal} />
              </div>
            )}
          </div>

          {!data?.dilemma_triggers && (
            <div className="cl-triggers-empty">
              <p>No dilemma triggers yet. Generate them after consciousness is built to tell the Story Engine exactly when to deploy each dilemma.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
