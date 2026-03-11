import { useState, useEffect, useRef } from 'react';
import './CharacterCreationDrawer.css';
const API = import.meta.env.VITE_API_BASE || '';
// ─── helpers ─────────────────────────────────────────────────────────────────
function apiFetch(path, opts = {}) {
  return fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...opts,
  }).then(r => r.json());
}
const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'twitter'];
const FOLLOWER_RANGES = ['nano (1k–10k)', 'micro (10k–100k)', 'mid (100k–500k)', 'macro (500k+)'];
const TIME_ORIENTATIONS = ['past_anchored', 'future_obsessed', 'impulsive_present', 'waiting'];
const DEPTH_COLORS = {
  sparked:   '#f4b942',
  breathing: '#7ab3d4',
  active:    '#a889c8',
  alive:     '#d4789a',
};
// ─── sub-components ───────────────────────────────────────────────────────────
function EditableField({ label, value, onChange, multiline = false, italic = false, hint }) {
  return (
    <div className="ccd-field">
      {label && <span className="ccd-field-label">{label}</span>}
      {hint && <span className="ccd-field-hint">{hint}</span>}
      {multiline ? (
        <textarea
          className={`ccd-textarea${italic ? ' ccd-italic' : ''}`}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          rows={4}
        />
      ) : (
        <input
          className="ccd-input"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
function Section({ title, defaultOpen = true, children, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="ccd-section">
      <button className="ccd-section-header" onClick={() => setOpen(o => !o)}>
        <span className="ccd-section-title">{title}</span>
        {badge && <span className="ccd-section-badge">{badge}</span>}
        <span className="ccd-section-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="ccd-section-body">{children}</div>}
    </div>
  );
}
// ─── main component ───────────────────────────────────────────────────────────
export default function CharacterCreationDrawer({ open, onClose, onCreated, worldId }) {
  // registry
  const [registryId, setRegistryId]     = useState(null);
  const [registryError, setRegistryError] = useState(false);
  // spark phase
  const [spark, setSpark]   = useState({ name: '', vibe: '', role: '' });
  const [phase, setPhase]   = useState('spark'); // spark | generating | proposal | confirming | done
  const [error, setError]   = useState(null);
  // proposal
  const [proposal, setProposal]         = useState(null);
  const [feedProposal, setFeedProposal] = useState(null);
  const [ghosts, setGhosts]             = useState([]);
  const drawerRef = useRef(null);
  // fetch registry on mount
  useEffect(() => {
    if (!open) return;
    apiFetch('/api/v1/character-registry/registries')
      .then(data => {
        const list = Array.isArray(data) ? data : data.registries || [];
        if (list.length > 0) setRegistryId(list[0].id);
        else setRegistryError(true);
      })
      .catch(() => setRegistryError(true));
  }, [open]);
  // reset when drawer closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setPhase('spark');
        setSpark({ name: '', vibe: '', role: '' });
        setProposal(null);
        setFeedProposal(null);
        setGhosts([]);
        setError(null);
      }, 300);
    }
  }, [open]);
  // close on overlay click
  function handleOverlay(e) {
    if (e.target === e.currentTarget) onClose();
  }
  // ── spark → generate ─────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!spark.name.trim() || !spark.vibe.trim()) {
      setError('Name and vibe are required.');
      return;
    }
    setError(null);
    setPhase('generating');
    try {
      const result = await apiFetch('/api/v1/character-generation/generate', {
        method: 'POST',
        body: JSON.stringify({
          spark,
          world_id: worldId || null,
        }),
      });
      if (result.error) throw new Error(result.error);
      setProposal(result.proposed);
      setFeedProposal(result.feed_profile || null);
      setGhosts(result.ghost_characters || []);
      setPhase('proposal');
    } catch (err) {
      setError(err.message || 'Generation failed. Try again.');
      setPhase('spark');
    }
  }
  // ── proposal field helpers ────────────────────────────────────────────────
  function updateProposal(path, value) {
    setProposal(prev => {
      const next = { ...prev };
      const keys = path.split('.');
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = { ...cur[keys[i]] };
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  }
  function updateFeed(key, value) {
    setFeedProposal(prev => ({ ...prev, [key]: value }));
  }
  // ── confirm ───────────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!registryId) {
      setError('Registry not found — check Universe setup.');
      return;
    }
    setPhase('confirming');
    setError(null);
    try {
      // 1. Confirm character
      const charResult = await apiFetch('/api/v1/character-generation/confirm', {
        method: 'POST',
        body: JSON.stringify({ proposed: proposal, registry_id: registryId }),
      });
      if (charResult.error) throw new Error(charResult.error);
      const newChar = charResult.character;
      // 2. Confirm feed profile if social_presence = true
      if (proposal.social_presence && feedProposal) {
        await apiFetch('/api/v1/character-generation/confirm-feed', {
          method: 'POST',
          body: JSON.stringify({
            character_id: newChar.id,
            feed_proposal: feedProposal,
          }),
        }).catch(() => {}); // non-fatal
      }
      setPhase('done');
      setTimeout(() => {
        onCreated?.(newChar);
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
      setPhase('proposal');
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={`ccd-overlay${open ? ' ccd-overlay--open' : ''}`} onClick={handleOverlay}>
      <aside className={`ccd-drawer${open ? ' ccd-drawer--open' : ''}`} ref={drawerRef}>
        {/* ── header ── */}
        <div className="ccd-drawer-header">
          <div className="ccd-drawer-header-left">
            <span className="ccd-drawer-eyebrow">Character Registry</span>
            <h2 className="ccd-drawer-title">
              {phase === 'spark'      && 'New Character'}
              {phase === 'generating' && `Building ${spark.name || 'character'}…`}
              {phase === 'proposal'   && proposal?.selected_name}
              {phase === 'confirming' && 'Saving…'}
              {phase === 'done'       && '✓ Character Created'}
            </h2>
          </div>
          <button className="ccd-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {/* ── error banner ── */}
        {error && <div className="ccd-error">{error}</div>}
        {/* ── registry error ── */}
        {registryError && phase !== 'proposal' && (
          <div className="ccd-registry-warning">
            Registry not found — check Universe setup before confirming.
          </div>
        )}
        {/* ══════════════════════════════════════════════════════════════════
            PHASE: SPARK
        ══════════════════════════════════════════════════════════════════ */}
        {phase === 'spark' && (
          <div className="ccd-spark-phase">
            <p className="ccd-spark-intro">
              Three fields. That's all it takes to build a complete interior architecture.
            </p>
            <div className="ccd-spark-fields">
              <div className="ccd-spark-field">
                <label className="ccd-spark-label">Name</label>
                <input
                  className="ccd-spark-input"
                  placeholder="What are you calling her right now"
                  value={spark.name}
                  onChange={e => setSpark(s => ({ ...s, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                  autoFocus
                />
              </div>
              <div className="ccd-spark-field">
                <label className="ccd-spark-label">Vibe</label>
                <input
                  className="ccd-spark-input"
                  placeholder="Who is she in one sentence — energy, aesthetic, presence"
                  value={spark.vibe}
                  onChange={e => setSpark(s => ({ ...s, vibe: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                />
              </div>
              <div className="ccd-spark-field">
                <label className="ccd-spark-label">Role</label>
                <input
                  className="ccd-spark-input"
                  placeholder="Her relationship to JustAWoman's world"
                  value={spark.role}
                  onChange={e => setSpark(s => ({ ...s, role: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                />
              </div>
            </div>
            <button
              className="ccd-generate-btn"
              onClick={handleGenerate}
              disabled={!spark.name.trim() || !spark.vibe.trim()}
            >
              Generate
            </button>
          </div>
        )}
        {/* ══════════════════════════════════════════════════════════════════
            PHASE: GENERATING
        ══════════════════════════════════════════════════════════════════ */}
        {phase === 'generating' && (
          <div className="ccd-generating">
            <div className="ccd-generating-orb" />
            <p className="ccd-generating-label">
              Building {spark.name}'s interior architecture
            </p>
            <p className="ccd-generating-sub">
              Wound · Want · Mask · Dilemma · Family · Feed
            </p>
          </div>
        )}
        {/* ══════════════════════════════════════════════════════════════════
            PHASE: PROPOSAL
        ══════════════════════════════════════════════════════════════════ */}
        {phase === 'proposal' && proposal && (
          <div className="ccd-proposal">
            {/* depth pill */}
            <div className="ccd-depth-row">
              <span
                className="ccd-depth-pill"
                style={{ background: DEPTH_COLORS[proposal.depth_level] || '#ccc' }}
              >
                {proposal.depth_level || 'breathing'}
              </span>
              <span className="ccd-depth-hint">
                Depth auto-calculated from what was generated
              </span>
            </div>
            {/* ── OVERVIEW ── */}
            <Section title="Overview" defaultOpen>
              <EditableField
                label="Prose Overview"
                hint="80–120 words · will appear on character profile"
                value={proposal.prose_overview}
                onChange={v => updateProposal('prose_overview', v)}
                multiline
                italic
              />
              <div className="ccd-row-2">
                <div className="ccd-field">
                  <span className="ccd-field-label">Time Orientation</span>
                  <select
                    className="ccd-select"
                    value={proposal.time_orientation || ''}
                    onChange={e => updateProposal('time_orientation', e.target.value)}
                  >
                    <option value="">— select —</option>
                    {TIME_ORIENTATIONS.map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Section>
            {/* ── INTERIOR ── */}
            <Section title="Interior" defaultOpen>
              {/* want architecture */}
              <div className="ccd-field-label ccd-sublabel">Want Architecture</div>
              <div className="ccd-want-row">
                {['surface_want', 'real_want', 'forbidden_want'].map(key => (
                  <div
                    key={key}
                    className={`ccd-want-card${key === 'forbidden_want' ? ' ccd-want-card--forbidden' : ''}`}
                  >
                    <span className="ccd-want-card-label">
                      {key === 'surface_want'   && 'Surface'}
                      {key === 'real_want'       && 'Real'}
                      {key === 'forbidden_want'  && 'Forbidden'}
                    </span>
                    <textarea
                      className="ccd-want-textarea"
                      value={proposal.want_architecture?.[key] || ''}
                      onChange={e => updateProposal(`want_architecture.${key}`, e.target.value)}
                      rows={3}
                    />
                  </div>
                ))}
              </div>
              {/* wound */}
              <div className="ccd-sublabel-row">
                <span className="ccd-field-label ccd-sublabel">Wound</span>
              </div>
              <EditableField
                label="Description"
                value={proposal.wound?.description}
                onChange={v => updateProposal('wound.description', v)}
                multiline
              />
              <EditableField
                label="Origin Period"
                value={proposal.wound?.origin_period}
                onChange={v => updateProposal('wound.origin_period', v)}
              />
              {/* mask */}
              <div className="ccd-sublabel-row">
                <span className="ccd-field-label ccd-sublabel">The Mask</span>
              </div>
              <EditableField
                label="Description"
                value={proposal.the_mask?.description}
                onChange={v => updateProposal('the_mask.description', v)}
                multiline
              />
              <label className="ccd-toggle-row">
                <input
                  type="checkbox"
                  checked={!!proposal.the_mask?.feed_profile_is_mask}
                  onChange={e => updateProposal('the_mask.feed_profile_is_mask', e.target.checked)}
                />
                <span>Feed profile IS the mask</span>
              </label>
              {/* dilemma */}
              <div className="ccd-sublabel-row">
                <span className="ccd-field-label ccd-sublabel">Dilemma</span>
              </div>
              <EditableField
                label="Central Tension"
                value={proposal.dilemma?.central_tension}
                onChange={v => updateProposal('dilemma.central_tension', v)}
                multiline
              />
              <div className="ccd-row-2">
                <EditableField
                  label="Option A"
                  value={proposal.dilemma?.option_a}
                  onChange={v => updateProposal('dilemma.option_a', v)}
                  multiline
                />
                <EditableField
                  label="Option B"
                  value={proposal.dilemma?.option_b}
                  onChange={v => updateProposal('dilemma.option_b', v)}
                  multiline
                />
              </div>
              {/* blind spot */}
              <EditableField
                label="Blind Spot"
                hint="Author only — never shown to readers"
                value={proposal.blind_spot}
                onChange={v => updateProposal('blind_spot', v)}
                multiline
              />
              {/* triggers */}
              {Array.isArray(proposal.triggers) && proposal.triggers.length > 0 && (
                <div className="ccd-field">
                  <span className="ccd-field-label">Triggers</span>
                  <div className="ccd-triggers">
                    {proposal.triggers.map((t, i) => (
                      <div key={i} className="ccd-trigger-pill">{t}</div>
                    ))}
                  </div>
                </div>
              )}
            </Section>
            {/* ── ONLINE ── */}
            <Section title="Online Presence" defaultOpen={!!proposal.social_presence}>
              <label className="ccd-toggle-row ccd-toggle-row--large">
                <input
                  type="checkbox"
                  checked={!!proposal.social_presence}
                  onChange={e => updateProposal('social_presence', e.target.checked)}
                />
                <span>This character exists online</span>
              </label>
              {proposal.social_presence && feedProposal ? (
                <div className="ccd-feed-fields">
                  <div className="ccd-row-2">
                    <EditableField
                      label="Handle"
                      value={feedProposal.handle}
                      onChange={v => updateFeed('handle', v)}
                    />
                    <div className="ccd-field">
                      <span className="ccd-field-label">Platform</span>
                      <select
                        className="ccd-select"
                        value={feedProposal.platform || ''}
                        onChange={e => updateFeed('platform', e.target.value)}
                      >
                        {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <EditableField
                    label="Bio"
                    value={feedProposal.bio}
                    onChange={v => updateFeed('bio', v)}
                    multiline
                  />
                  <div className="ccd-row-2">
                    <div className="ccd-field">
                      <span className="ccd-field-label">Follower Range</span>
                      <select
                        className="ccd-select"
                        value={feedProposal.follower_range || ''}
                        onChange={e => updateFeed('follower_range', e.target.value)}
                      >
                        {FOLLOWER_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <EditableField
                    label="Content Posture"
                    hint="What they post about — their performed self"
                    value={feedProposal.content_posture}
                    onChange={v => updateFeed('content_posture', v)}
                    multiline
                  />
                  {feedProposal.gap_from_deep_profile && (
                    <div className="ccd-persona-gap">
                      <div className="ccd-persona-gap-label">Persona Gap</div>
                      <p className="ccd-persona-gap-text">{feedProposal.gap_from_deep_profile}</p>
                    </div>
                  )}
                </div>
              ) : !proposal.social_presence && proposal.social_presence_reason ? (
                <p className="ccd-offline-reason">{proposal.social_presence_reason}</p>
              ) : null}
            </Section>
            {/* ── FAMILY ── */}
            {proposal.family_tree && (
              <Section
                title="Family"
                defaultOpen={false}
                badge={ghosts.length > 0 ? `${ghosts.length} ghost${ghosts.length > 1 ? 's' : ''}` : null}
              >
                {proposal.family_tree.generational_wound && (
                  <div className="ccd-field">
                    <span className="ccd-field-label">Generational Wound</span>
                    <p className="ccd-static-text">{proposal.family_tree.generational_wound}</p>
                  </div>
                )}
                {Array.isArray(proposal.family_tree.members) && (
                  <div className="ccd-family-list">
                    {proposal.family_tree.members.map((m, i) => (
                      <div key={i} className="ccd-family-member">
                        <span className="ccd-family-name">{m.name}</span>
                        <span className="ccd-family-relation">{m.relation}</span>
                        {m.personality_sketch && (
                          <span className="ccd-family-sketch">{m.personality_sketch}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {ghosts.length > 0 && (
                  <div className="ccd-ghosts">
                    <div className="ccd-ghosts-header">
                      Ghost Characters — mentioned but not in registry
                    </div>
                    {ghosts.map((g, i) => (
                      <div key={i} className="ccd-ghost-row">
                        <span className="ccd-ghost-name">{g.name}</span>
                        <span className="ccd-ghost-relation">{g.relation}</span>
                        <button className="ccd-ghost-promote" disabled title="Coming soon">
                          Promote
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            )}
            {/* ── BELONGING ── */}
            {proposal.belonging_map && (
              <Section title="Belonging" defaultOpen={false}>
                {Array.isArray(proposal.belonging_map.belongs_to) && (
                  <div className="ccd-field">
                    <span className="ccd-field-label">Belongs To</span>
                    {proposal.belonging_map.belongs_to.map((b, i) => (
                      <div key={i} className="ccd-belonging-item">
                        <span className="ccd-belonging-name">{b.name}</span>
                        <span className="ccd-belonging-type">{b.type}</span>
                      </div>
                    ))}
                  </div>
                )}
                {Array.isArray(proposal.belonging_map.excluded_from) &&
                  proposal.belonging_map.excluded_from.length > 0 && (
                  <div className="ccd-field">
                    <span className="ccd-field-label">Excluded From</span>
                    {proposal.belonging_map.excluded_from.map((e, i) => (
                      <div key={i} className="ccd-belonging-item ccd-belonging-item--excluded">
                        <span className="ccd-belonging-name">{e.name}</span>
                        <span className="ccd-belonging-why">{e.why}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            )}
            {/* spacer so sticky footer doesn't cover content */}
            <div style={{ height: 80 }} />
          </div>
        )}
        {/* ══════════════════════════════════════════════════════════════════
            PHASE: DONE
        ══════════════════════════════════════════════════════════════════ */}
        {phase === 'done' && (
          <div className="ccd-done">
            <div className="ccd-done-check">✓</div>
            <p className="ccd-done-label">{proposal?.selected_name} is in the registry.</p>
          </div>
        )}
        {/* ── sticky footer ── */}
        {phase === 'proposal' && (
          <div className="ccd-footer">
            <button className="ccd-back-btn" onClick={() => setPhase('spark')}>
              ← Back
            </button>
            <button
              className="ccd-confirm-btn"
              onClick={handleConfirm}
              disabled={!registryId}
              title={!registryId ? 'Registry not found — check Universe setup' : ''}
            >
              Confirm Character
              {proposal?.social_presence ? ' + Feed Profile' : ''}
            </button>
          </div>
        )}
        {phase === 'confirming' && (
          <div className="ccd-footer">
            <button className="ccd-confirm-btn" disabled>Saving…</button>
          </div>
        )}
      </aside>
    </div>
  );
}
