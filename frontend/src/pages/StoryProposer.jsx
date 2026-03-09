// StoryProposer.jsx
// Scene Intelligence Engine — UI
// The system proposes. You adjust. The story moves.

import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || '/api/v1';

const C = {
  bg: '#f7f4ef',
  bgDeep: '#f0ece4',
  surface: '#ffffff',
  surfaceAlt: '#faf8f5',
  border: '#e0d9ce',
  borderDark: '#c8bfb0',
  text: '#1a1714',
  textDim: '#6b6259',
  textFaint: '#a89f94',
  accent: '#b8863e',
  accentSoft: '#b8863e14',
  accentMid: '#b8863e33',
  red: '#b84040',
  redSoft: '#b8404014',
  green: '#3a8a60',
  greenSoft: '#3a8a6014',
  blue: '#3a6a8a',
  blueSoft: '#3a6a8a14',
  purple: '#6a3a8a',
  purpleSoft: '#6a3a8a14',
  gold: '#c9a96e',
};

const SCENE_TYPE_CONFIG = {
  production_breakdown: { label: 'Production Breakdown', color: C.red,    icon: '⧖', sub: 'The gap between vision and output' },
  creator_study:        { label: 'Creator Study',        color: C.blue,   icon: '◎', sub: 'Watching the TikTok creator shift' },
  interior_reckoning:   { label: 'Interior Reckoning',   color: C.purple, icon: '✦', sub: 'Alone at night — talking to God' },
  david_mirror:         { label: 'David Mirror',         color: C.green,  icon: '⬡', sub: 'He sees her before she can name it' },
  paying_man_pressure:  { label: 'Paying Man Pressure',  color: C.red,    icon: '◈', sub: 'The boundary being tested' },
  bestie_moment:        { label: 'Bestie Moment',        color: C.accent, icon: '◇', sub: 'Processing publicly with her audience' },
  lala_seed:            { label: 'Lala Seed',            color: C.gold,   icon: '✧', sub: 'The intrusive thought — the door left open' },
  general:              { label: 'General',              color: C.textDim,icon: '○', sub: 'Character or relationship advancement' },
};

const TONE_CONFIG = {
  longing:   { label: 'Longing',   color: C.blue },
  tension:   { label: 'Tension',   color: C.accent },
  sensual:   { label: 'Sensual',   color: C.purple },
  explicit:  { label: 'Explicit',  color: C.red },
  aftermath: { label: 'Aftermath', color: C.green },
};

const ARC_STAGES = ['establishment', 'pressure', 'crisis', 'integration'];

export default function StoryProposer({ bookId: bookIdProp, chapterId: chapterIdProp, registryId: registryIdProp, onProposalAccepted }) {
  // Use props if provided, otherwise fall back to localStorage / defaults
  const [localBookId, setLocalBookId] = useState(() => {
    if (bookIdProp) return bookIdProp;
    try { return localStorage.getItem('se_activeWorld') || 'book-1'; } catch { return 'book-1'; }
  });
  const bookId = bookIdProp || localBookId;
  const chapterId = chapterIdProp || undefined;
  const registryId = registryIdProp || undefined;

  const [proposal, setProposal] = useState(null);
  const [arcState, setArcState] = useState(null);
  const [proposing, setProposing] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);

  // Available registries for standalone mode
  const [registries, setRegistries] = useState([]);
  const [selectedRegistry, setSelectedRegistry] = useState(registryIdProp || '');

  // Editing state
  const [editingBrief, setEditingBrief] = useState(false);
  const [editedBrief, setEditedBrief] = useState('');
  const [editingChars, setEditingChars] = useState(false);
  const [removedChars, setRemovedChars] = useState([]);
  const [addedChar, setAddedChar] = useState('');
  const [selectedTone, setSelectedTone] = useState(null);

  // Force scene type
  const [forceType, setForceType] = useState('');
  const [authorNote, setAuthorNote] = useState('');
  const [showForcePanel, setShowForcePanel] = useState(false);

  // Growth flags
  const [growthFlags, setGrowthFlags] = useState([]);
  const [flagsLoaded, setFlagsLoaded] = useState(false);

  // Load registries when in standalone mode (no registryId prop)
  useEffect(() => {
    if (registryIdProp) return;
    (async () => {
      try {
        const res = await fetch(`${API}/registries`);
        if (res.ok) {
          const data = await res.json();
          const list = data.registries || data || [];
          setRegistries(list);
          if (list.length && !selectedRegistry) setSelectedRegistry(String(list[0].id));
        }
      } catch { /* non-fatal */ }
    })();
  }, [registryIdProp]);

  useEffect(() => {
    loadGrowthFlags();
  }, []);

  async function loadGrowthFlags() {
    try {
      const res = await fetch(`${API}/memories/character-growth/flagged`);
      const data = await res.json();
      setGrowthFlags(data.flags || []);
      setFlagsLoaded(true);
    } catch (err) {
      // non-fatal
    }
  }

  async function handlePropose() {
    setProposing(true);
    setError(null);
    setProposal(null);
    setRemovedChars([]);
    setEditingBrief(false);
    setEditingChars(false);

    try {
      const res = await fetch(`${API}/memories/propose-scene`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: bookId,
          chapter_id: chapterId,
          registry_id: registryId || selectedRegistry || undefined,
          force_scene_type: forceType || undefined,
          author_note: authorNote || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setProposal(data);
      setArcState(data.arc_state);
      setSelectedTone(data.proposal.suggested_tone);
      setEditedBrief(data.proposal.scene_brief);
    } catch (err) {
      setError(err.message);
    } finally {
      setProposing(false);
    }
  }

  async function handleSaveEdits() {
    if (!proposal) return;
    const currentChars = getActiveChars();
    try {
      await fetch(`${API}/memories/scene-proposals/${proposal.proposal_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene_brief: editedBrief,
          characters: currentChars,
          tone: selectedTone,
        }),
      });
      setEditingBrief(false);
      setEditingChars(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAccept() {
    if (!proposal) return;
    setAccepting(true);
    try {
      // Save edits first if any
      if (editingBrief || editingChars) await handleSaveEdits();

      const res = await fetch(`${API}/memories/scene-proposals/${proposal.proposal_id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone_override: selectedTone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (onProposalAccepted) onProposalAccepted(data.ready_to_generate);
    } catch (err) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  }

  async function handleDismiss() {
    if (!proposal) return;
    await fetch(`${API}/memories/scene-proposals/${proposal.proposal_id}/dismiss`, { method: 'POST' });
    setProposal(null);
  }

  async function reviewFlag(flagId, decision) {
    try {
      await fetch(`${API}/memories/character-growth/${flagId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      setGrowthFlags(prev => prev.filter(f => f.id !== flagId));
    } catch (err) {
      setError(err.message);
    }
  }

  function getActiveChars() {
    const base = proposal?.proposal?.proposed_characters || [];
    const filtered = base.filter(c => !removedChars.includes(c.character_name));
    if (addedChar.trim()) {
      filtered.push({ character_name: addedChar.trim(), role_in_scene: 'Added by author', why_now: 'Author addition' });
    }
    return filtered;
  }

  const activeChars = proposal ? getActiveChars() : [];
  const sceneConf = proposal ? SCENE_TYPE_CONFIG[proposal.proposal.scene_type] : null;
  const toneConf = selectedTone ? TONE_CONFIG[selectedTone] : null;

  return (
    <div style={{ fontFamily: "'Georgia', serif", background: C.bg, minHeight: '100vh', color: C.text }}>

      {/* ── Header ── */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.surface }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '2px', height: '22px', background: C.accent }} />
          <div>
            <div style={{ fontSize: '17px', fontWeight: '600', letterSpacing: '0.01em' }}>Scene Intelligence</div>
            <div style={{ fontSize: '11px', color: C.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'system-ui', marginTop: '2px' }}>
              The system proposes · You adjust · The story moves
            </div>
          </div>
        </div>

        {/* Growth flags badge */}
        {growthFlags.length > 0 && (
          <div style={{ padding: '6px 14px', background: C.redSoft, border: `1px solid ${C.red}44`, borderRadius: '2px', fontSize: '12px', color: C.red, fontFamily: 'system-ui', cursor: 'pointer' }}
            onClick={() => document.getElementById('growth-flags')?.scrollIntoView({ behavior: 'smooth' })}>
            {growthFlags.length} character contradiction{growthFlags.length > 1 ? 's' : ''} need review
          </div>
        )}
      </div>

      <div style={{ padding: '28px', maxWidth: '860px' }}>

        {/* ── Arc State ── */}
        {arcState && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '10px', color: C.textFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'system-ui', marginBottom: '10px' }}>
              Story Arc · Book 1
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {ARC_STAGES.map(stage => {
                const count = arcState.scores[stage] || 0;
                const isActive = arcState.stage === stage;
                const thresholds = { establishment: 8, pressure: 16, crisis: 22, integration: 30 };
                const max = thresholds[stage];
                const pct = Math.min(100, (count / max) * 100);
                return (
                  <div key={stage} style={{
                    background: isActive ? C.accentSoft : C.surface,
                    border: `1px solid ${isActive ? C.accent + '66' : C.border}`,
                    borderTop: `2px solid ${isActive ? C.accent : C.border}`,
                    borderRadius: '2px', padding: '12px 14px',
                  }}>
                    <div style={{ fontSize: '10px', fontFamily: 'system-ui', color: isActive ? C.accent : C.textFaint, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600', marginBottom: '6px' }}>
                      {stage} {isActive && '\u2190 now'}
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: isActive ? C.text : C.textDim, marginBottom: '6px' }}>{count}</div>
                    <div style={{ height: '3px', background: C.bgDeep, borderRadius: '2px' }}>
                      <div style={{ height: '100%', borderRadius: '2px', width: `${pct}%`, background: isActive ? C.accent : C.borderDark }} />
                    </div>
                    <div style={{ fontSize: '10px', color: C.textFaint, fontFamily: 'system-ui', marginTop: '4px' }}>{count}/{max} scenes</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Empty state / Propose Controls ── */}
        {!proposal && !proposing && (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: '2px', padding: '40px 32px', textAlign: 'center',
            marginBottom: '24px',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '16px', opacity: 0.25 }}>◈</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: '600', color: C.text, marginBottom: '8px' }}>
              What scene should happen next?
            </div>
            <div style={{ fontSize: '13px', color: C.textDim, fontFamily: 'system-ui', lineHeight: '1.65', maxWidth: '480px', margin: '0 auto 24px' }}>
              Scene Intelligence reads your arc progress, character wounds, unresolved tensions, and recent revelations — then proposes the next scene with cast, tone, and emotional stakes. You adjust anything before accepting.
            </div>

            {/* Book / Registry selectors in standalone mode */}
            {!bookIdProp && (
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
                <select
                  value={localBookId}
                  onChange={e => setLocalBookId(e.target.value)}
                  style={{ padding: '8px 12px', fontFamily: 'system-ui', fontSize: '13px', border: `1px solid ${C.border}`, borderRadius: '2px', background: C.surface, color: C.text }}
                >
                  <option value="book-1">Book 1 World</option>
                  <option value="lalaverse">LalaVerse</option>
                </select>
                {registries.length > 0 && (
                  <select
                    value={selectedRegistry}
                    onChange={e => setSelectedRegistry(e.target.value)}
                    style={{ padding: '8px 12px', fontFamily: 'system-ui', fontSize: '13px', border: `1px solid ${C.border}`, borderRadius: '2px', background: C.surface, color: C.text }}
                  >
                    {registries.map(r => (
                      <option key={r.id} value={r.id}>{r.name || `Registry ${r.id}`}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <button
              onClick={handlePropose}
              style={{
                padding: '14px 32px',
                background: C.text, border: 'none', borderRadius: '2px',
                color: C.bg, fontSize: '15px', fontFamily: 'Georgia, serif',
                fontWeight: '600', cursor: 'pointer', letterSpacing: '0.02em',
                marginBottom: '12px',
              }}
            >
              Propose Next Scene
            </button>
            <div style={{ fontSize: '11px', color: C.textFaint, fontFamily: 'system-ui' }}>
              Typically takes a few seconds
            </div>

            {/* Inline options toggle */}
            <div style={{ marginTop: '20px', borderTop: `1px solid ${C.border}`, paddingTop: '16px' }}>
              <button
                onClick={() => setShowForcePanel(!showForcePanel)}
                style={{ background: 'none', border: 'none', fontSize: '12px', color: C.textDim, fontFamily: 'system-ui', cursor: 'pointer', padding: 0 }}
              >
                {showForcePanel ? 'Hide options \u25B4' : 'Advanced options \u25BE'}
              </button>
            </div>

            {showForcePanel && (
              <div style={{ marginTop: '12px', padding: '16px', background: C.bgDeep, border: `1px solid ${C.border}`, borderRadius: '2px', textAlign: 'left' }}>
                <div style={{ fontSize: '11px', color: C.textFaint, fontFamily: 'system-ui', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Force scene type</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                  {Object.entries(SCENE_TYPE_CONFIG).map(([key, conf]) => (
                    <button key={key} onClick={() => setForceType(forceType === key ? '' : key)} style={{
                      padding: '6px 12px',
                      background: forceType === key ? `${conf.color}18` : 'transparent',
                      border: `1px solid ${forceType === key ? conf.color + '66' : C.border}`,
                      borderRadius: '2px', fontSize: '11px',
                      color: forceType === key ? conf.color : C.textDim,
                      fontFamily: 'system-ui', cursor: 'pointer',
                    }}>
                      {conf.icon} {conf.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: C.textFaint, fontFamily: 'system-ui', marginBottom: '6px' }}>Note to system</div>
                <input
                  value={authorNote}
                  onChange={e => setAuthorNote(e.target.value)}
                  placeholder="e.g. 'focus on the editing breakdown' or 'tonight should be interior reckoning'"
                  style={{ width: '100%', padding: '8px 10px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '2px', fontSize: '13px', color: C.text, fontFamily: 'Georgia, serif', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Propose again controls (after proposal exists) ── */}
        {proposal && !proposing && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={handlePropose}
                style={{
                  padding: '13px 28px',
                  background: C.text, border: 'none', borderRadius: '2px',
                  color: C.bg, fontSize: '14px', fontFamily: 'Georgia, serif',
                  fontWeight: '600', cursor: 'pointer', letterSpacing: '0.02em',
                }}
              >
                Propose a Different Scene
              </button>

              <button
                onClick={() => setShowForcePanel(!showForcePanel)}
                style={{ padding: '12px 16px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '2px', fontSize: '12px', color: C.textDim, fontFamily: 'system-ui', cursor: 'pointer' }}
              >
                {showForcePanel ? 'Hide options' : 'Options'}
              </button>
            </div>

            {showForcePanel && (
              <div style={{ marginTop: '12px', padding: '16px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '2px' }}>
                <div style={{ fontSize: '11px', color: C.textFaint, fontFamily: 'system-ui', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Force scene type</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                  {Object.entries(SCENE_TYPE_CONFIG).map(([key, conf]) => (
                    <button key={key} onClick={() => setForceType(forceType === key ? '' : key)} style={{
                      padding: '6px 12px',
                      background: forceType === key ? `${conf.color}18` : 'transparent',
                      border: `1px solid ${forceType === key ? conf.color + '66' : C.border}`,
                      borderRadius: '2px', fontSize: '11px',
                      color: forceType === key ? conf.color : C.textDim,
                      fontFamily: 'system-ui', cursor: 'pointer',
                    }}>
                      {conf.icon} {conf.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: C.textFaint, fontFamily: 'system-ui', marginBottom: '6px' }}>Note to system</div>
                <input
                  value={authorNote}
                  onChange={e => setAuthorNote(e.target.value)}
                  placeholder="e.g. 'I want this to involve the editing breakdown' or 'focus on the TikTok creator tonight'"
                  style={{ width: '100%', padding: '8px 10px', background: C.bgDeep, border: `1px solid ${C.border}`, borderRadius: '2px', fontSize: '13px', color: C.text, fontFamily: 'Georgia, serif', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 14px', background: C.redSoft, border: `1px solid ${C.red}44`, borderRadius: '2px', fontSize: '13px', color: C.red, fontFamily: 'system-ui', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        {proposing && (
          <div style={{ padding: '24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '2px', marginBottom: '20px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
              <Spin />
              <div>
                <div style={{ fontSize: '14px', color: C.text }}>Reading the story\u2026</div>
                <div style={{ fontSize: '12px', color: C.textFaint, fontFamily: 'system-ui', marginTop: '3px' }}>Arc stage · character wounds · unresolved tensions · recent revelations</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Proposal Display ── */}
        {proposal && !proposing && (
          <div>
            {/* Scene type header */}
            {sceneConf && (
              <div style={{
                padding: '18px 22px',
                background: `${sceneConf.color}0c`,
                border: `1px solid ${sceneConf.color}33`,
                borderLeft: `4px solid ${sceneConf.color}`,
                borderRadius: '2px',
                marginBottom: '20px',
                display: 'flex', alignItems: 'center', gap: '16px',
              }}>
                <div style={{ fontSize: '28px', lineHeight: 1 }}>{sceneConf.icon}</div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: sceneConf.color }}>{sceneConf.label}</div>
                  <div style={{ fontSize: '12px', color: C.textDim, fontFamily: 'system-ui', marginTop: '2px' }}>{sceneConf.sub}</div>
                </div>
                {proposal.proposal.lala_seed_potential && (
                  <div style={{ marginLeft: 'auto', padding: '5px 12px', background: `${C.gold}22`, border: `1px solid ${C.gold}55`, borderRadius: '2px', fontSize: '11px', color: C.gold, fontFamily: 'system-ui', fontWeight: '600', letterSpacing: '0.08em' }}>
                    LALA SEED POTENTIAL
                  </div>
                )}
                {proposal.proposal.interior_reckoning_moment && (
                  <div style={{ marginLeft: proposal.proposal.lala_seed_potential ? '8px' : 'auto', padding: '5px 12px', background: `${C.purple}18`, border: `1px solid ${C.purple}44`, borderRadius: '2px', fontSize: '11px', color: C.purple, fontFamily: 'system-ui' }}>
                    Interior Reckoning
                  </div>
                )}
              </div>
            )}

            {/* Emotional stakes + arc function */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <InfoCard label="Emotional Stakes" color={C.accent}>
                {proposal.proposal.emotional_stakes}
              </InfoCard>
              <InfoCard label="Arc Function" color={C.blue}>
                {proposal.proposal.arc_function}
              </InfoCard>
            </div>

            {/* Characters */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <Label>Characters in This Scene</Label>
                <button onClick={() => setEditingChars(!editingChars)} style={{ background: 'none', border: 'none', fontSize: '12px', color: C.textDim, fontFamily: 'system-ui', cursor: 'pointer', padding: 0 }}>
                  {editingChars ? 'Done editing' : 'Swap characters'}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                {activeChars.map((char, i) => {
                  const removed = removedChars.includes(char.character_name);
                  return (
                    <div key={i} style={{
                      background: removed ? C.bgDeep : C.surface,
                      border: `1px solid ${removed ? C.border : C.borderDark}`,
                      borderRadius: '2px', padding: '14px',
                      opacity: removed ? 0.4 : 1,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: C.text, marginBottom: '4px' }}>{char.character_name}</div>
                        {editingChars && !removed && (
                          <button onClick={() => setRemovedChars(p => [...p, char.character_name])} style={{ background: 'none', border: 'none', fontSize: '14px', color: C.textFaint, cursor: 'pointer', padding: 0, lineHeight: 1 }}>{'\u2715'}</button>
                        )}
                        {editingChars && removed && (
                          <button onClick={() => setRemovedChars(p => p.filter(n => n !== char.character_name))} style={{ background: 'none', border: 'none', fontSize: '11px', color: C.accent, cursor: 'pointer', padding: 0, fontFamily: 'system-ui' }}>restore</button>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: C.textDim, fontFamily: 'system-ui', lineHeight: '1.5', marginBottom: '6px' }}>{char.role_in_scene}</div>
                      <div style={{ fontSize: '11px', color: C.textFaint, fontFamily: 'system-ui', fontStyle: 'italic', lineHeight: '1.5', borderTop: `1px solid ${C.border}`, paddingTop: '6px' }}>{char.why_now}</div>
                    </div>
                  );
                })}
              </div>

              {editingChars && (
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                  <input
                    value={addedChar}
                    onChange={e => setAddedChar(e.target.value)}
                    placeholder="Add a character by name\u2026"
                    style={{ flex: 1, padding: '8px 10px', background: C.bgDeep, border: `1px solid ${C.border}`, borderRadius: '2px', fontSize: '13px', color: C.text, fontFamily: 'Georgia, serif', outline: 'none' }}
                  />
                  <button onClick={() => { if (addedChar.trim()) setAddedChar(''); }} style={{ padding: '8px 14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '2px', fontSize: '12px', color: C.textDim, fontFamily: 'system-ui', cursor: 'pointer' }}>Add</button>
                </div>
              )}
            </div>

            {/* Scene brief */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <Label>Scene Brief</Label>
                <button onClick={() => setEditingBrief(!editingBrief)} style={{ background: 'none', border: 'none', fontSize: '12px', color: C.textDim, fontFamily: 'system-ui', cursor: 'pointer', padding: 0 }}>
                  {editingBrief ? 'Preview' : 'Edit brief'}
                </button>
              </div>
              {editingBrief ? (
                <textarea
                  value={editedBrief}
                  onChange={e => setEditedBrief(e.target.value)}
                  style={{ width: '100%', minHeight: '160px', padding: '16px', background: C.surface, border: `1px solid ${C.borderDark}`, borderRadius: '2px', fontSize: '14px', color: C.text, fontFamily: 'Georgia, serif', lineHeight: '1.8', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              ) : (
                <div style={{ padding: '20px 22px', background: C.surface, border: `1px solid ${C.borderDark}`, borderLeft: `3px solid ${sceneConf?.color || C.accent}`, borderRadius: '2px', fontSize: '14px', color: C.text, lineHeight: '1.9' }}>
                  {editedBrief}
                </div>
              )}
            </div>

            {/* Why these characters */}
            {proposal.proposal.why_these_characters && (
              <div style={{ marginBottom: '20px', padding: '14px 16px', background: C.bgDeep, border: `1px solid ${C.border}`, borderRadius: '2px' }}>
                <div style={{ fontSize: '10px', color: C.textFaint, fontFamily: 'system-ui', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Why the system chose this cast</div>
                <p style={{ fontSize: '13px', color: C.textDim, lineHeight: '1.6', fontFamily: 'system-ui' }}>{proposal.proposal.why_these_characters}</p>
              </div>
            )}

            {/* What should NOT happen */}
            {proposal.proposal.what_should_not_happen && (
              <div style={{ marginBottom: '20px', padding: '14px 16px', background: C.redSoft, border: `1px solid ${C.red}33`, borderRadius: '2px' }}>
                <div style={{ fontSize: '10px', color: C.red, fontFamily: 'system-ui', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Franchise guard — what to protect against</div>
                <p style={{ fontSize: '13px', color: C.textDim, lineHeight: '1.6', fontFamily: 'system-ui' }}>{proposal.proposal.what_should_not_happen}</p>
              </div>
            )}

            {/* Tone selector */}
            <div style={{ marginBottom: '24px' }}>
              <Label>Tone</Label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Object.entries(TONE_CONFIG).map(([key, conf]) => (
                  <button key={key} onClick={() => setSelectedTone(key)} style={{
                    padding: '8px 16px',
                    background: selectedTone === key ? `${conf.color}18` : C.surface,
                    border: `1px solid ${selectedTone === key ? conf.color + '66' : C.border}`,
                    borderRadius: '2px', fontSize: '12px',
                    color: selectedTone === key ? conf.color : C.textDim,
                    fontFamily: 'system-ui', cursor: 'pointer',
                    fontWeight: selectedTone === key ? '600' : '400',
                  }}>
                    {conf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleAccept}
                disabled={accepting}
                style={{
                  flex: 1, padding: '15px',
                  background: accepting ? C.bgDeep : C.text,
                  border: 'none', borderRadius: '2px',
                  color: accepting ? C.textFaint : C.bg,
                  fontSize: '15px', fontFamily: 'Georgia, serif', fontWeight: '600',
                  cursor: accepting ? 'default' : 'pointer', letterSpacing: '0.02em',
                }}
              >
                {accepting ? 'Accepting\u2026' : 'Accept & Generate \u2192'}
              </button>
              <button onClick={handleDismiss} style={{ padding: '15px 20px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '2px', fontSize: '13px', color: C.textDim, fontFamily: 'system-ui', cursor: 'pointer' }}>
                Dismiss
              </button>
            </div>

            {/* Context used */}
            {proposal.context_used && (
              <div style={{ marginTop: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Characters read', value: proposal.context_used.characters_read },
                  { label: 'Relationships', value: proposal.context_used.relationships_read },
                  { label: 'Revelations', value: proposal.context_used.recent_revelations },
                  { label: 'Story beats', value: proposal.context_used.recent_beats },
                ].map(({ label, value }) => (
                  <div key={label} style={{ fontSize: '11px', color: C.textFaint, fontFamily: 'system-ui' }}>
                    <span style={{ color: C.textDim, fontWeight: '600' }}>{value}</span> {label}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Growth Flags ── */}
        {flagsLoaded && growthFlags.length > 0 && (
          <div id="growth-flags" style={{ marginTop: '40px' }}>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '28px' }}>
              <Label>Character Contradictions — Needs Your Review</Label>
              <p style={{ fontSize: '13px', color: C.textDim, fontFamily: 'system-ui', marginBottom: '16px', lineHeight: '1.6' }}>
                The story engine evolved your characters after recent scenes. These specific changes contradict what the registry says about them. You decide.
              </p>
              {growthFlags.map(flag => (
                <div key={flag.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderTop: `2px solid ${C.red}`, borderRadius: '2px', padding: '18px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: C.text }}>{flag.character?.selected_name || flag.character?.name || 'Character'}</span>
                        <span style={{ fontSize: '11px', color: C.textFaint, fontFamily: 'system-ui' }}>{'\u2192'}</span>
                        <span style={{ fontSize: '11px', color: C.red, fontFamily: 'system-ui', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>{flag.field_updated}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontSize: '10px', color: C.textFaint, fontFamily: 'system-ui', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Registry says</div>
                          <p style={{ fontSize: '13px', color: C.textDim, lineHeight: '1.5', fontStyle: 'italic' }}>{flag.previous_value || 'Not documented'}</p>
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', color: C.green, fontFamily: 'system-ui', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Scene revealed</div>
                          <p style={{ fontSize: '13px', color: C.text, lineHeight: '1.5' }}>{flag.new_value}</p>
                        </div>
                      </div>
                      <p style={{ fontSize: '12px', color: C.textFaint, fontFamily: 'system-ui', borderTop: `1px solid ${C.border}`, paddingTop: '8px', lineHeight: '1.5' }}>{flag.growth_source}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => reviewFlag(flag.id, 'accepted')} style={flagBtn(C.green)}>Update registry</button>
                      <button onClick={() => reviewFlag(flag.id, 'reverted')} style={flagBtn(C.textFaint, true)}>Keep original</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function Label({ children }) {
  return (
    <div style={{ fontSize: '10px', color: '#a89f94', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'system-ui', fontWeight: '600', marginBottom: '10px' }}>
      {children}
    </div>
  );
}

function InfoCard({ label, color, children }) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e0d9ce', borderTop: `2px solid ${color}`, borderRadius: '2px', padding: '14px 16px' }}>
      <div style={{ fontSize: '10px', color, fontFamily: 'system-ui', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: '600', marginBottom: '8px' }}>{label}</div>
      <p style={{ fontSize: '13px', color: '#6b6259', lineHeight: '1.6', fontFamily: 'system-ui' }}>{children}</p>
    </div>
  );
}

function Spin() {
  return (
    <>
      <div style={{ width: '20px', height: '20px', border: '2px solid #e0d9ce', borderTop: '2px solid #b8863e', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

function flagBtn(color, outline = false) {
  return {
    padding: '7px 14px',
    background: outline ? 'transparent' : `${color}18`,
    border: `1px solid ${color}55`,
    borderRadius: '2px', color,
    fontSize: '11px', fontFamily: 'system-ui',
    fontWeight: '600', cursor: 'pointer',
    letterSpacing: '0.04em',
  };
}
