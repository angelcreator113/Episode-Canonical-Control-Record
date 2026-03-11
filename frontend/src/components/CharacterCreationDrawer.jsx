/**
 * CharacterCreationDrawer.jsx — Right-slide drawer for character creation
 *
 * Flow: Spark → Generate → Edit inline → Confirm
 *
 * State 1 (Spark): Name, Vibe, Role. World and Book auto-populated.
 * State 2 (Generating): Amber narrates what she's building while Claude runs.
 * State 3 (Proposal): Full interior in collapsible sections. Inline editing.
 *                      Want architecture as 3-card row. Feed profile toggle.
 *                      Ghost characters at the bottom. Confirm writes everything.
 *
 * Props:
 *   open            — boolean
 *   onClose         — callback
 *   registryId      — UUID of current registry
 *   registryTitle   — string, for context display
 *   bookTag         — string (e.g. 'book1', 'lalaverse')
 *   existingCast    — array of { id, name, role_type } for cast context
 *   onCommitted     — callback(character) after successful commit
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ROLE_OPTIONS, ROLE_COLORS, ROLE_LABELS } from '../constants/characterConstants';
import './CharacterCreationDrawer.css';

const API = '/api/v1/character-generator';
const REGISTRY_API = '/api/v1/character-registry';

// ── Amber's narration lines (cycled during generation) ──
const AMBER_LINES = [
  name => `Building the want architecture for ${name}. The desire she'll say out loud — and the one she won't.`,
  name => `Seeding the wound. Something broke ${name} once, and the scar tissue became her operating system.`,
  name => `Checking the existing cast. Every new person changes the constellation — where does ${name} pull gravity?`,
  name => `Constructing the mask. The version of herself ${name} shows the world. The version she hides.`,
  name => `Writing the dilemma. A binary choice with no clean answer — both options cost something real.`,
  name => `Reading the voice. How ${name} speaks when she's honest. How she speaks when she's not.`,
  name => `Mapping the aesthetic. What she wears, what her space looks like, what the camera sees first.`,
  name => `Wiring the relationships. Who ${name} calls at 2am. Who she avoids. Who she doesn't know she needs yet.`,
];

// ── Generate step labels ──
const GEN_STEPS = [
  'Want architecture',
  'Wound & psychology',
  'Cast relationships',
  'Voice & aesthetic',
  'Dilemma engine',
  'Deep profile',
];

export default function CharacterCreationDrawer({
  open, onClose, registryId, registryTitle, bookTag, existingCast = [], onCommitted,
}) {
  // ── Phase: 'spark' | 'generating' | 'proposal' ──
  const [phase, setPhase] = useState('spark');

  // Spark fields
  const [name, setName] = useState('');
  const [vibe, setVibe] = useState('');
  const [role, setRole] = useState('support');

  // Generation state
  const [amberLine, setAmberLine] = useState('');
  const [genStepIdx, setGenStepIdx] = useState(0);
  const [profile, setProfile] = useState(null);

  // Proposal inline editing
  const [editingField, setEditingField] = useState(null); // 'psychology.core_wound' etc.
  const [editValue, setEditValue] = useState('');
  const [openSections, setOpenSections] = useState({
    want: true, wound: true, mask: false, dilemma: true,
    aesthetic: false, career: false, voice: false, relationships: false,
    story: false, deep: false,
  });

  // Feed profile toggle
  const [feedEnabled, setFeedEnabled] = useState(false);
  const [feedHandle, setFeedHandle] = useState('');
  const [feedBio, setFeedBio] = useState('');

  // Error & loading
  const [error, setError] = useState(null);
  const [committing, setCommitting] = useState(false);

  const amberInterval = useRef(null);
  const genStepInterval = useRef(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setPhase('spark');
      setName(''); setVibe(''); setRole('support');
      setProfile(null); setError(null);
      setEditingField(null); setCommitting(false);
      setFeedEnabled(false); setFeedHandle(''); setFeedBio('');
      setOpenSections({ want: true, wound: true, mask: false, dilemma: true,
        aesthetic: false, career: false, voice: false, relationships: false,
        story: false, deep: false });
    }
  }, [open]);

  // Cleanup intervals
  useEffect(() => {
    return () => {
      clearInterval(amberInterval.current);
      clearInterval(genStepInterval.current);
    };
  }, []);

  const worldLabel = bookTag === 'lalaverse' ? 'LalaVerse' : 'Book 1';

  // ── Amber narration ticker ──
  const startAmberNarration = useCallback((charName) => {
    let idx = 0;
    setAmberLine(AMBER_LINES[0](charName));
    amberInterval.current = setInterval(() => {
      idx = (idx + 1) % AMBER_LINES.length;
      setAmberLine(AMBER_LINES[idx](charName));
    }, 4500);
  }, []);

  const startGenSteps = useCallback(() => {
    setGenStepIdx(0);
    let step = 0;
    genStepInterval.current = setInterval(() => {
      step++;
      if (step >= GEN_STEPS.length) {
        clearInterval(genStepInterval.current);
      }
      setGenStepIdx(step);
    }, 3000);
  }, []);

  // ── Generate ──
  const handleGenerate = useCallback(async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setError(null);
    setPhase('generating');

    const charName = name.trim();
    startAmberNarration(charName);
    startGenSteps();

    try {
      // Build a seed in the format the backend expects
      const seed = {
        name: charName,
        age: 32, // default — Claude will calibrate from vibe
        gender: 'female',
        pronouns: 'she/her',
        world: bookTag || 'book1',
        role_type: role,
        career: vibe.trim() || 'unspecified',
        tension: vibe.trim() || `The tension of being ${charName}`,
      };

      const existingChars = existingCast.map(c => ({
        name: c.selected_name || c.display_name || c.name,
        role_type: c.role_type || 'support',
        tension: c.tension || '',
      }));

      const res = await fetch(`${API}/generate-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seeds: [seed], existingCharacters: existingChars }),
      });

      const data = await res.json();

      clearInterval(amberInterval.current);
      clearInterval(genStepInterval.current);

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Generation failed');
      }

      // generate-batch returns { results: [{ seed, status, profile }] }
      const result = data.results?.[0];
      if (!result?.profile) {
        throw new Error('No profile returned from generation');
      }

      setProfile(result.profile);
      setGenStepIdx(GEN_STEPS.length);

      // Pre-populate feed fields from profile if available
      const aestheticDna = result.profile.aesthetic_dna;
      if (aestheticDna?.social_media_aesthetic) {
        setFeedBio(aestheticDna.social_media_aesthetic);
      }
      setFeedHandle(`@${charName.toLowerCase().replace(/\s+/g, '')}`);

      // Transition to proposal after a beat
      setTimeout(() => setPhase('proposal'), 600);
    } catch (err) {
      clearInterval(amberInterval.current);
      clearInterval(genStepInterval.current);
      setError(err.message);
      setPhase('spark');
    }
  }, [name, vibe, role, bookTag, existingCast, startAmberNarration, startGenSteps]);

  // ── Inline editing ──
  const startEdit = useCallback((path, currentValue) => {
    setEditingField(path);
    setEditValue(currentValue || '');
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingField || !profile) return;
    const parts = editingField.split('.');
    const updated = JSON.parse(JSON.stringify(profile));
    let target = updated;
    for (let i = 0; i < parts.length - 1; i++) {
      target = target[parts[i]];
    }
    target[parts[parts.length - 1]] = editValue;
    setProfile(updated);
    setEditingField(null);
  }, [editingField, editValue, profile]);

  const cancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  // ── Toggle section ──
  const toggleSection = useCallback((key) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Commit ──
  const handleCommit = useCallback(async () => {
    if (!profile || !registryId) return;
    setCommitting(true);
    setError(null);

    try {
      const res = await fetch(`${API}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registryId,
          character: profile,
          feedProfile: feedEnabled ? { handle: feedHandle, bio: feedBio } : null,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Commit failed');
      }

      onCommitted?.(data.character || data);
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setCommitting(false);
    }
  }, [profile, registryId, feedEnabled, feedHandle, feedBio, onCommitted, onClose]);

  // ── Render helpers ──
  const EditableField = ({ path, label, value }) => {
    const isEditing = editingField === path;
    if (isEditing) {
      return (
        <div className="ccd-editable">
          <div className="ccd-editable-label">{label}</div>
          <textarea
            className="ccd-editable-input"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            rows={2}
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
              if (e.key === 'Escape') cancelEdit();
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button className="ccd-btn ccd-btn-primary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={saveEdit}>Save</button>
            <button className="ccd-btn ccd-btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={cancelEdit}>Cancel</button>
          </div>
        </div>
      );
    }
    return (
      <div className="ccd-editable" onClick={() => startEdit(path, value)}>
        <div className="ccd-editable-label">{label}</div>
        <div className="ccd-editable-value">{value || <span style={{ color: '#ccc', fontStyle: 'italic' }}>Click to add</span>}</div>
      </div>
    );
  };

  const Section = ({ sectionKey, title, children }) => (
    <div className={`ccd-section ${openSections[sectionKey] ? 'open' : ''}`}>
      <div className="ccd-section-header" onClick={() => toggleSection(sectionKey)}>
        <span className="ccd-section-title">{title}</span>
        <span className="ccd-section-chevron">▾</span>
      </div>
      {openSections[sectionKey] && <div className="ccd-section-body">{children}</div>}
    </div>
  );

  // ── Ghost characters from proposed_connections ──
  const ghostCharacters = profile?.relationships?.proposed_connections?.filter(conn => {
    const targetName = conn.to_character;
    return !existingCast.some(c =>
      (c.selected_name || c.display_name || c.name || '').toLowerCase() === targetName?.toLowerCase()
    );
  }) || [];

  if (!open) return null;

  const stepIndex = phase === 'spark' ? 0 : phase === 'generating' ? 1 : 2;

  return (
    <>
      {/* Backdrop */}
      <div className={`ccd-backdrop ${open ? 'open' : ''}`} onClick={onClose} />

      {/* Drawer */}
      <div className={`ccd-drawer ${open ? 'open' : ''}`}>
        {/* Header */}
        <div className="ccd-header">
          <div className="ccd-header-top">
            <div>
              <h2 className="ccd-header-title">
                {phase === 'spark' && 'New Character'}
                {phase === 'generating' && 'Generating...'}
                {phase === 'proposal' && (profile?.identity?.name || 'Proposal')}
              </h2>
              <div className="ccd-header-sub">
                {phase === 'spark' && 'Spark a character. Amber builds the rest.'}
                {phase === 'generating' && 'Amber is constructing the interior.'}
                {phase === 'proposal' && 'Review and edit before confirming.'}
              </div>
            </div>
            <button className="ccd-close-btn" onClick={onClose}>✕</button>
          </div>

          {/* Step indicator */}
          <div className="ccd-steps">
            {['Spark', 'Generate', 'Proposal'].map((label, i) => (
              <div key={label} className={`ccd-step ${i === stepIndex ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`}>
                <div className="ccd-step-bar" />
                <span className="ccd-step-label">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="ccd-body">
          {error && <div className="ccd-error">{error}</div>}

          {/* ═══ STATE 1: SPARK ═══ */}
          {phase === 'spark' && (
            <div className="ccd-spark-fields">
              <div className="ccd-field">
                <label className="ccd-label">Name</label>
                <input
                  className="ccd-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Who is she?"
                  autoFocus
                />
              </div>

              <div className="ccd-field">
                <label className="ccd-label">Vibe</label>
                <input
                  className="ccd-input"
                  value={vibe}
                  onChange={e => setVibe(e.target.value)}
                  placeholder="Content creator burning out. Corporate lawyer who paints at 2am. Mother of three, hiding something."
                />
              </div>

              <div className="ccd-field">
                <label className="ccd-label">Role</label>
                <select className="ccd-select" value={role} onChange={e => setRole(e.target.value)}>
                  {ROLE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Auto-populated context */}
              <div className="ccd-context-row">
                <div className="ccd-context-chip">
                  <span>World</span>
                  <strong>{worldLabel}</strong>
                </div>
                {registryTitle && (
                  <div className="ccd-context-chip">
                    <span>Book</span>
                    <strong>{registryTitle}</strong>
                  </div>
                )}
                <div className="ccd-context-chip">
                  <span>Cast</span>
                  <strong>{existingCast.length} characters</strong>
                </div>
              </div>
            </div>
          )}

          {/* ═══ STATE 2: GENERATING ═══ */}
          {phase === 'generating' && (
            <div className="ccd-generating">
              {/* Amber's voice */}
              <div className="ccd-amber-voice">
                <div className="ccd-amber-label">Amber</div>
                <div className="ccd-amber-text">
                  {amberLine}
                  <span className="ccd-amber-cursor" />
                </div>
              </div>

              {/* Step progress */}
              <div className="ccd-gen-progress">
                {GEN_STEPS.map((step, i) => (
                  <div key={step} className={`ccd-gen-step ${i < genStepIdx ? 'done' : ''} ${i === genStepIdx ? 'active' : ''}`}>
                    <span className="ccd-gen-dot" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ STATE 3: PROPOSAL ═══ */}
          {phase === 'proposal' && profile && (
            <div className="ccd-proposal">
              {/* Name & meta */}
              <div>
                <div className="ccd-proposal-name">{profile.identity?.name}</div>
                <div className="ccd-proposal-meta">
                  <span className="ccd-meta-tag" style={{
                    background: `${ROLE_COLORS[profile.identity?.role_type] || '#999'}18`,
                    color: ROLE_COLORS[profile.identity?.role_type] || '#999',
                    border: `1px solid ${ROLE_COLORS[profile.identity?.role_type] || '#999'}40`,
                  }}>
                    {ROLE_LABELS[profile.identity?.role_type] || profile.identity?.role_type}
                  </span>
                  {profile.identity?.age && (
                    <span className="ccd-meta-tag" style={{ background: '#f0ede6', color: '#666', border: '1px solid #e0ddd6' }}>
                      Age {profile.identity.age}
                    </span>
                  )}
                  {profile.career?.job_title && (
                    <span className="ccd-meta-tag" style={{ background: '#f0ede6', color: '#666', border: '1px solid #e0ddd6' }}>
                      {profile.career.job_title}
                    </span>
                  )}
                </div>
              </div>

              {/* Want Architecture — 3-card row */}
              <Section sectionKey="want" title="Want Architecture">
                <div className="ccd-want-row">
                  <div className="ccd-want-card" onClick={() => startEdit('psychology.desire_line', profile.psychology?.desire_line)}>
                    <div className="ccd-want-card-label desire">Desire</div>
                    <div className="ccd-want-card-value">
                      {editingField === 'psychology.desire_line' ? (
                        <textarea className="ccd-editable-input" value={editValue} onChange={e => setEditValue(e.target.value)}
                          autoFocus rows={3}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === 'Escape') cancelEdit(); }}
                        />
                      ) : (
                        profile.psychology?.desire_line || '—'
                      )}
                    </div>
                  </div>
                  <div className="ccd-want-card" onClick={() => startEdit('psychology.hidden_want', profile.psychology?.hidden_want)}>
                    <div className="ccd-want-card-label hidden">Hidden Want</div>
                    <div className="ccd-want-card-value">
                      {editingField === 'psychology.hidden_want' ? (
                        <textarea className="ccd-editable-input" value={editValue} onChange={e => setEditValue(e.target.value)}
                          autoFocus rows={3}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === 'Escape') cancelEdit(); }}
                        />
                      ) : (
                        profile.psychology?.hidden_want || '—'
                      )}
                    </div>
                  </div>
                  <div className="ccd-want-card" onClick={() => startEdit('psychology.fear_line', profile.psychology?.fear_line)}>
                    <div className="ccd-want-card-label fear">Fear</div>
                    <div className="ccd-want-card-value">
                      {editingField === 'psychology.fear_line' ? (
                        <textarea className="ccd-editable-input" value={editValue} onChange={e => setEditValue(e.target.value)}
                          autoFocus rows={3}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === 'Escape') cancelEdit(); }}
                        />
                      ) : (
                        profile.psychology?.fear_line || '—'
                      )}
                    </div>
                  </div>
                </div>
              </Section>

              {/* Wound & Psychology */}
              <Section sectionKey="wound" title="Wound & Psychology">
                <EditableField path="psychology.core_wound" label="Core Wound" value={profile.psychology?.core_wound} />
                <EditableField path="psychology.coping_mechanism" label="Coping Mechanism" value={profile.psychology?.coping_mechanism} />
                <EditableField path="psychology.self_deception" label="Self-Deception (Mask)" value={profile.psychology?.self_deception} />
                <EditableField path="psychology.at_their_best" label="At Their Best" value={profile.psychology?.at_their_best} />
                <EditableField path="psychology.at_their_worst" label="At Their Worst" value={profile.psychology?.at_their_worst} />
              </Section>

              {/* Mask */}
              <Section sectionKey="mask" title="Mask & Self-Deception">
                <EditableField path="psychology.self_deception" label="The Story She Tells Herself" value={profile.psychology?.self_deception} />
                <EditableField path="living_state.current_emotional_state" label="Current Emotional State" value={profile.living_state?.current_emotional_state} />
                <EditableField path="living_state.momentum" label="Momentum" value={profile.living_state?.momentum} />
              </Section>

              {/* Dilemma */}
              <Section sectionKey="dilemma" title="Dilemma">
                <div className="ccd-dilemma-card">
                  <div className="ccd-dilemma-label">Active Dilemma</div>
                  <EditableField path="dilemma.active" label="" value={profile.dilemma?.active} />
                </div>
                {profile.dilemma?.latent_1 && (
                  <div className="ccd-dilemma-card" style={{ opacity: 0.75 }}>
                    <div className="ccd-dilemma-label">Latent</div>
                    <EditableField path="dilemma.latent_1" label="" value={profile.dilemma?.latent_1} />
                  </div>
                )}
                {profile.dilemma?.latent_2 && (
                  <div className="ccd-dilemma-card" style={{ opacity: 0.6 }}>
                    <div className="ccd-dilemma-label">Latent</div>
                    <EditableField path="dilemma.latent_2" label="" value={profile.dilemma?.latent_2} />
                  </div>
                )}
                {profile.dilemma?.collision_potential && (
                  <div style={{ fontSize: 11, color: '#8a8680', marginTop: 6, fontStyle: 'italic' }}>
                    Collision: {profile.dilemma.collision_potential}
                  </div>
                )}
              </Section>

              {/* Aesthetic DNA */}
              <Section sectionKey="aesthetic" title="Aesthetic DNA">
                <EditableField path="aesthetic_dna.visual_signature" label="Visual Signature" value={profile.aesthetic_dna?.visual_signature} />
                <EditableField path="aesthetic_dna.style" label="Style" value={profile.aesthetic_dna?.style} />
                <EditableField path="aesthetic_dna.signature_object" label="Signature Object" value={profile.aesthetic_dna?.signature_object} />
                <EditableField path="aesthetic_dna.room_presence" label="Room Presence" value={profile.aesthetic_dna?.room_presence} />
              </Section>

              {/* Career */}
              <Section sectionKey="career" title="Career">
                <EditableField path="career.job_title" label="Title" value={profile.career?.job_title} />
                <EditableField path="career.industry" label="Industry" value={profile.career?.industry} />
                <EditableField path="career.career_wound" label="Career Wound" value={profile.career?.career_wound} />
                <EditableField path="career.job_antagonist" label="Job Antagonist" value={profile.career?.job_antagonist} />
              </Section>

              {/* Voice */}
              <Section sectionKey="voice" title="Voice">
                <EditableField path="voice.how_they_speak" label="How They Speak" value={profile.voice?.how_they_speak} />
                <EditableField path="voice.their_tell" label="Their Tell" value={profile.voice?.their_tell} />
                <EditableField path="voice.signature_sentence_structure" label="Signature Sentence" value={profile.voice?.signature_sentence_structure} />
                <EditableField path="voice.what_silence_means_for_them" label="What Silence Means" value={profile.voice?.what_silence_means_for_them} />
              </Section>

              {/* Relationships */}
              <Section sectionKey="relationships" title="Relationships">
                <EditableField path="relationships.romantic_status" label="Romantic Status" value={profile.relationships?.romantic_status} />
                <EditableField path="relationships.romantic_detail" label="Detail" value={profile.relationships?.romantic_detail} />
                <EditableField path="relationships.who_they_call_at_2am" label="2am Call" value={profile.relationships?.who_they_call_at_2am} />
                <EditableField path="relationships.how_they_fight" label="How They Fight" value={profile.relationships?.how_they_fight} />
              </Section>

              {/* Feed Profile Toggle */}
              <div className="ccd-feed-toggle">
                <div
                  className={`ccd-toggle-switch ${feedEnabled ? 'on' : ''}`}
                  onClick={() => setFeedEnabled(!feedEnabled)}
                >
                  <div className="ccd-toggle-knob" />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>Feed Profile</div>
                  <div style={{ fontSize: 10.5, color: '#999' }}>Create a social media presence for this character</div>
                </div>
              </div>
              {feedEnabled && (
                <div className="ccd-feed-fields">
                  <div className="ccd-field">
                    <label className="ccd-label">Handle</label>
                    <input className="ccd-input" value={feedHandle} onChange={e => setFeedHandle(e.target.value)}
                      placeholder="@handle" />
                  </div>
                  <div className="ccd-field">
                    <label className="ccd-label">Bio</label>
                    <input className="ccd-input" value={feedBio} onChange={e => setFeedBio(e.target.value)}
                      placeholder="What their feed looks like" />
                  </div>
                </div>
              )}

              {/* Ghost Characters */}
              {ghostCharacters.length > 0 && (
                <div className="ccd-ghost-section">
                  <div className="ccd-ghost-title">
                    These people exist in her world — promote any of them
                  </div>
                  {ghostCharacters.map((ghost, i) => (
                    <div key={i} className="ccd-ghost-item">
                      <span className="ccd-ghost-name">{ghost.to_character}</span>
                      <span className="ccd-ghost-rel">{ghost.relationship_type} — {ghost.from_feels}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ccd-footer">
          {phase === 'spark' && (
            <>
              <button className="ccd-btn ccd-btn-ghost" onClick={onClose}>Cancel</button>
              <button
                className="ccd-btn ccd-btn-primary"
                onClick={handleGenerate}
                disabled={!name.trim()}
              >
                Generate
              </button>
            </>
          )}
          {phase === 'generating' && (
            <button className="ccd-btn ccd-btn-ghost" onClick={() => { setPhase('spark'); clearInterval(amberInterval.current); clearInterval(genStepInterval.current); }}>
              Cancel
            </button>
          )}
          {phase === 'proposal' && (
            <>
              <button className="ccd-btn ccd-btn-discard" onClick={onClose}>
                Discard
              </button>
              <button
                className="ccd-btn ccd-btn-confirm"
                onClick={handleCommit}
                disabled={committing}
              >
                {committing ? 'Writing...' : 'Confirm — Make Canon'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
