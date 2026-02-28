/**
 * WorldView.jsx
 * 
 * Route: /world
 * 
 * The LalaVerse neighborhood map. Every character is a living card.
 * Claude generates their current state from approved manuscript lines.
 * You confirm what's right.
 * 
 * Phase 1 (this build):
 *   - World grid with living character cards
 *   - Current state: what she knows, wants, what's unresolved
 *   - Last chapter appearance + arc momentum
 *   - Character type color system
 *   - Relationship preview (who she's connected to)
 *   - Claude generates state from manuscript — you approve
 * 
 * Phase 2 (next build):
 *   - Click-through to Character Home
 *   - Full Relationship Web (visual node graph)
 *   - World Clock (scrub through chapters)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './WorldView.css';

// ── Type system ────────────────────────────────────────────────────────────
// Field: character.role_type (enum in registry_characters)

const TYPE_META = {
  protagonist: { label: 'Protagonist', color: '#0d9488', bg: 'rgba(13,148,136,0.08)',  ring: 'rgba(13,148,136,0.3)' },
  special:     { label: 'Special',     color: '#C6A85E', bg: 'rgba(198,168,94,0.08)',   ring: 'rgba(198,168,94,0.3)' },
  pressure:    { label: 'Pressure',    color: '#e07070', bg: 'rgba(224,112,112,0.08)',  ring: 'rgba(224,112,112,0.3)' },
  mirror:      { label: 'Mirror',      color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', ring: 'rgba(167,139,250,0.3)' },
  support:     { label: 'Support',     color: '#34d399', bg: 'rgba(52,211,153,0.08)',   ring: 'rgba(52,211,153,0.3)' },
  shadow:      { label: 'Shadow',      color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', ring: 'rgba(148,163,184,0.3)' },
};

const STATUS_META = {
  draft:     { label: 'Draft',     dot: '#94a3b8' },
  accepted:  { label: 'Accepted',  dot: '#34d399' },
  declined:  { label: 'Declined',  dot: '#f87171' },
  finalized: { label: 'Finalized', dot: '#C6A85E' },
};

// ── Momentum arrows ────────────────────────────────────────────────────────

const MOMENTUM = {
  rising:  { symbol: '↑', color: '#34d399', label: 'Rising' },
  steady:  { symbol: '→', color: '#94a3b8', label: 'Steady' },
  falling: { symbol: '↓', color: '#f87171', label: 'Falling' },
  dormant: { symbol: '·', color: '#64748b', label: 'Dormant' },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function getDisplayName(character) {
  return character?.selected_name || character?.display_name || 'Unnamed';
}

function getTypeMeta(character) {
  return TYPE_META[character?.role_type] || TYPE_META.support;
}

// ── Character Avatar ───────────────────────────────────────────────────────

function CharacterAvatar({ name, roleType, size = 56 }) {
  const meta = TYPE_META[roleType] || TYPE_META.support;
  const initials = (name || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="wv-avatar"
      style={{
        width: size,
        height: size,
        background: meta.bg,
        border: `2px solid ${meta.ring}`,
        color: meta.color,
        fontSize: size * 0.3,
      }}
    >
      {initials}
    </div>
  );
}

// ── Living State Panel ────────────────────────────────────────────────────

function LivingStatePanel({ character, state, onGenerate, onConfirm, onEdit, isGenerating }) {
  const meta = getTypeMeta(character);
  const momentum = MOMENTUM[state?.momentum || 'dormant'];
  const charName = getDisplayName(character);

  if (!state?.isGenerated) {
    return (
      <div className="wv-state-empty">
        <p>No living state yet.</p>
        <button
          className="wv-generate-btn"
          style={{ borderColor: meta.color, color: meta.color }}
          onClick={() => onGenerate(character.id)}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <span className="wv-generating">
              <span className="wv-gen-dot" style={{ background: meta.color }} />
              Generating…
            </span>
          ) : (
            `✦ Generate ${charName}'s State`
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="wv-state-body">
      {/* Three state fields */}
      <div className="wv-state-fields">
        <div className="wv-state-field">
          <span className="wv-state-label">KNOWS</span>
          <span className="wv-state-value">{state.currentKnows || '—'}</span>
        </div>
        <div className="wv-state-field">
          <span className="wv-state-label">WANTS</span>
          <span className="wv-state-value">{state.currentWants || '—'}</span>
        </div>
        <div className="wv-state-field">
          <span className="wv-state-label">UNRESOLVED</span>
          <span className="wv-state-value wv-unresolved">{state.unresolved || '—'}</span>
        </div>
      </div>

      {/* Momentum + last appearance */}
      <div className="wv-state-meta">
        <span
          className="wv-momentum"
          style={{ color: momentum.color }}
          title={`Arc momentum: ${momentum.label}`}
        >
          {momentum.symbol} {momentum.label}
        </span>
        {state.lastChapter && (
          <span className="wv-last-chapter">Last seen: {state.lastChapter}</span>
        )}
      </div>

      {/* Confirm / regenerate actions */}
      {!state.isConfirmed ? (
        <div className="wv-state-actions">
          <button
            className="wv-confirm-btn"
            style={{ background: meta.color, color: meta.color === '#C6A85E' ? '#1A1714' : '#fff' }}
            onClick={() => onConfirm(character.id)}
          >
            ✓ Confirm State
          </button>
          <button
            className="wv-regen-btn"
            onClick={() => onGenerate(character.id)}
            disabled={isGenerating}
          >
            ↺ Regenerate
          </button>
          <button className="wv-edit-btn" onClick={() => onEdit(character.id)}>
            Edit
          </button>
        </div>
      ) : (
        <div className="wv-confirmed-badge">
          <span style={{ color: meta.color }}>✓ State confirmed</span>
          <button className="wv-regen-btn small" onClick={() => onGenerate(character.id)}>
            Update
          </button>
        </div>
      )}
    </div>
  );
}

// ── Relationship Preview ──────────────────────────────────────────────────

function RelationshipPreview({ relationships, allCharacters }) {
  if (!relationships || relationships.length === 0) {
    return <p className="wv-no-rel">No relationships mapped yet.</p>;
  }

  return (
    <div className="wv-rel-list">
      {relationships.slice(0, 3).map((rel, i) => {
        const other = allCharacters.find(c => c.id === rel.characterId);
        const otherName = getDisplayName(other);
        const otherMeta = other ? getTypeMeta(other) : TYPE_META.support;

        return (
          <div key={i} className="wv-rel-item">
            <span className="wv-rel-dot" style={{ background: otherMeta.color }} />
            <span className="wv-rel-name">{otherName}</span>
            <span className="wv-rel-type">{rel.type}</span>
            {rel.asymmetric && (
              <span className="wv-rel-asymmetric" title="One-way — they don't know">⇢</span>
            )}
          </div>
        );
      })}
      {relationships.length > 3 && (
        <p className="wv-rel-more">+{relationships.length - 3} more</p>
      )}
    </div>
  );
}

// ── Character Card ────────────────────────────────────────────────────────

function CharacterCard({
  character,
  livingState,
  allCharacters,
  onGenerate,
  onConfirm,
  onEdit,
  onOpenHome,
  isGenerating,
  animIndex,
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = getTypeMeta(character);
  const statusMeta = STATUS_META[character.status] || STATUS_META.draft;
  const name = getDisplayName(character);

  return (
    <div
      className={`wv-card ${expanded ? 'wv-card--expanded' : ''}`}
      style={{
        '--card-accent': meta.color,
        '--card-bg': meta.bg,
        '--card-ring': meta.ring,
        animationDelay: `${animIndex * 60}ms`,
      }}
    >
      {/* Card header */}
      <div className="wv-card-header" onClick={() => setExpanded(e => !e)}>
        <CharacterAvatar name={name} roleType={character.role_type} size={48} />

        <div className="wv-card-title">
          <div className="wv-card-name">{name}</div>
          <div className="wv-card-role">{character.role_label || character.belief_pressured || '—'}</div>
          <div className="wv-card-badges">
            <span
              className="wv-type-badge"
              style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.ring}` }}
            >
              {meta.label}
            </span>
            <span className="wv-status-badge">
              <span className="wv-status-dot" style={{ background: statusMeta.dot }} />
              {statusMeta.label}
            </span>
          </div>
        </div>

        {/* Quick state preview — visible even when collapsed */}
        {livingState?.isGenerated && !expanded && (
          <div className="wv-card-preview">
            <span
              className="wv-momentum-mini"
              style={{ color: MOMENTUM[livingState.momentum || 'dormant'].color }}
            >
              {MOMENTUM[livingState.momentum || 'dormant'].symbol}
            </span>
            {livingState.isConfirmed && (
              <span className="wv-confirmed-mini" style={{ color: meta.color }}>✓</span>
            )}
          </div>
        )}

        <button
          className="wv-expand-btn"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '−' : '+'}
        </button>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="wv-card-body">
          <div className="wv-card-section">
            <div className="wv-section-label">LIVING STATE</div>
            <LivingStatePanel
              character={character}
              state={livingState}
              onGenerate={onGenerate}
              onConfirm={onConfirm}
              onEdit={onEdit}
              isGenerating={isGenerating}
            />
          </div>

          <div className="wv-card-section">
            <div className="wv-section-label">RELATIONSHIPS</div>
            <RelationshipPreview
              relationships={livingState?.relationships}
              allCharacters={allCharacters}
            />
          </div>

          <div className="wv-card-footer">
            <button
              className="wv-open-home-btn"
              style={{ borderColor: meta.color, color: meta.color }}
              onClick={() => onOpenHome(character.id)}
            >
              Open Character Home →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────

function FilterBar({ activeType, onTypeChange, counts }) {
  const types = ['all', 'protagonist', 'special', 'pressure', 'mirror', 'support', 'shadow'];

  return (
    <div className="wv-filters">
      {types.map(t => {
        const meta = t === 'all' ? null : TYPE_META[t];
        const count = t === 'all'
          ? Object.values(counts).reduce((a, b) => a + b, 0)
          : (counts[t] || 0);

        return (
          <button
            key={t}
            className={`wv-filter-btn ${activeType === t ? 'active' : ''}`}
            style={activeType === t && meta ? {
              background: meta.bg,
              color: meta.color,
              borderColor: meta.ring,
            } : {}}
            onClick={() => onTypeChange(t)}
          >
            {t === 'all' ? 'All' : meta.label}
            <span className="wv-filter-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Generate all states banner ─────────────────────────────────────────────

function GenerateAllBanner({ onGenerateAll, isGenerating, total, generated }) {
  if (generated >= total) return null;

  return (
    <div className="wv-generate-all-banner">
      <div className="wv-gen-all-text">
        <span className="wv-gen-all-count">{total - generated}</span> character{total - generated !== 1 ? 's' : ''} don't have a living state yet.
      </div>
      <button
        className="wv-gen-all-btn"
        onClick={onGenerateAll}
        disabled={isGenerating}
      >
        {isGenerating ? '✦ Generating…' : '✦ Generate All States'}
      </button>
    </div>
  );
}

// ── Main WorldView ────────────────────────────────────────────────────────

export default function WorldView() {
  const navigate = useNavigate();
  const [characters, setCharacters]       = useState([]);
  const [livingStates, setLivingStates]   = useState({});   // { charId: livingStateObj }
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [activeType, setActiveType]       = useState('all');
  const [generatingId, setGeneratingId]   = useState(null);
  const [generatingAll, setGeneratingAll] = useState(false);

  // ── Load characters ────────────────────────────────────────────────────

  const loadCharacters = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load registries, then flatten characters
      const res = await fetch('/api/v1/character-registry/registries', { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}`);

      const data = await res.json();
      const registries = data.registries || data || [];

      // Flatten all characters across all registries
      const allChars = [];
      for (const reg of registries) {
        const regRes = await fetch(
          `/api/v1/character-registry/registries/${reg.id}`,
          { credentials: 'include' }
        );
        if (regRes.ok) {
          const regData = await regRes.json();
          const chars = regData.registry?.characters || regData.characters || [];
          allChars.push(...chars);
        }
      }

      setCharacters(allChars);

      // Load any saved living states from localStorage (temporary — will be DB in Phase 2)
      const saved = JSON.parse(localStorage.getItem('wv_living_states') || '{}');
      setLivingStates(saved);

    } catch (err) {
      setError(err.message || 'Failed to load characters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCharacters(); }, [loadCharacters]);

  // ── Generate living state via Claude ─────────────────────────────────

  const generateState = useCallback(async (charId) => {
    const character = characters.find(c => c.id === charId);
    if (!character) return;

    setGeneratingId(charId);

    try {
      const charName = getDisplayName(character);
      const res = await fetch('/api/v1/memories/generate-living-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          character_id: charId,
          character_name: charName,
          character_type: character.role_type,
          character_role: character.role_label,
          belief_pressured: character.belief_pressured,
        }),
      });

      let newState;

      if (res.ok) {
        const data = await res.json();
        newState = {
          currentKnows:  data.knows  || `${charName} knows the world she's been given.`,
          currentWants:  data.wants  || `${charName} wants something she can't name yet.`,
          unresolved:    data.unresolved || 'Something between her and what she\'s after.',
          lastChapter:   data.lastChapter || null,
          momentum:      data.momentum || 'steady',
          relationships: data.relationships || [],
          isGenerated:   true,
          isConfirmed:   false,
        };
      } else {
        newState = generateFallbackState(character);
      }

      const updated = { ...livingStates, [charId]: newState };
      setLivingStates(updated);
      localStorage.setItem('wv_living_states', JSON.stringify(updated));

    } catch {
      const newState = generateFallbackState(character);
      const updated = { ...livingStates, [charId]: newState };
      setLivingStates(updated);
      localStorage.setItem('wv_living_states', JSON.stringify(updated));
    } finally {
      setGeneratingId(null);
    }
  }, [characters, livingStates]);

  // Graceful fallback state when API not yet connected
  function generateFallbackState(character) {
    const name = getDisplayName(character);
    const typeDefaults = {
      protagonist: { knows: `${name} understands more than she lets on.`, wants: `To become what she was always becoming.`, unresolved: `The gap between who she is and who she's building.`, momentum: 'rising' },
      special:     { knows: `${name} understands more than she lets on.`, wants: `To become what she was always becoming.`, unresolved: `The gap between who she is and who she's building.`, momentum: 'rising' },
      pressure:    { knows: `${name} sees the risk before the possibility.`, wants: `To protect what's already been built.`, unresolved: `Whether his caution is wisdom or fear.`, momentum: 'steady' },
      mirror:      { knows: `${name} has done what JustAWoman is trying to do.`, wants: `Nothing — she's already there.`, unresolved: `Whether she'd have gotten there differently.`, momentum: 'steady' },
      support:     { knows: `${name} holds the thread of consistency.`, wants: `To see the pattern resolved.`, unresolved: `Whether she's been seen for her steadiness.`, momentum: 'steady' },
      shadow:      { knows: `${name} appeared at exactly the right moment.`, wants: `To be the answer someone needed.`, unresolved: `Whether the rescue was real.`, momentum: 'falling' },
    };
    const defaults = typeDefaults[character.role_type] || typeDefaults.support;
    return {
      ...defaults,
      relationships: [],
      isGenerated: true,
      isConfirmed: false,
    };
  }

  const confirmState = useCallback((charId) => {
    const updated = {
      ...livingStates,
      [charId]: { ...livingStates[charId], isConfirmed: true },
    };
    setLivingStates(updated);
    localStorage.setItem('wv_living_states', JSON.stringify(updated));
  }, [livingStates]);

  const editState = useCallback((charId) => {
    // In Phase 2 this opens an inline edit form — for now, regenerate
    generateState(charId);
  }, [generateState]);

  const generateAllStates = useCallback(async () => {
    setGeneratingAll(true);
    const ungenerated = characters.filter(c => !livingStates[c.id]?.isGenerated);
    for (const char of ungenerated) {
      await generateState(char.id);
    }
    setGeneratingAll(false);
  }, [characters, livingStates, generateState]);

  // ── Filter ────────────────────────────────────────────────────────────

  const filtered = activeType === 'all'
    ? characters
    : characters.filter(c => c.role_type === activeType);

  const typeCounts = characters.reduce((acc, c) => {
    acc[c.role_type] = (acc[c.role_type] || 0) + 1;
    return acc;
  }, {});

  const generatedCount = characters.filter(c => livingStates[c.id]?.isGenerated).length;

  // ── Navigate to Character Home ─────────────────────────────────────────

  const openCharacterHome = useCallback((charId) => {
    navigate(`/character/${charId}`);
  }, [navigate]);

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="wv-loading">
      <div className="wv-loading-orbs">
        {['#C6A85E', '#e07070', '#a78bfa', '#34d399'].map((c, i) => (
          <span key={i} style={{ background: c, animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
      <p>The world is waking up…</p>
    </div>
  );

  if (error) return (
    <div className="wv-error">
      <p>Couldn't load the world.</p>
      <small>{error}</small>
      <button onClick={loadCharacters}>Try again</button>
    </div>
  );

  return (
    <div className="wv-root">
      {/* Header */}
      <div className="wv-header">
        <div className="wv-header-left">
          <h1 className="wv-title">LalaVerse</h1>
          <p className="wv-subtitle">
            {characters.length} character{characters.length !== 1 ? 's' : ''} · {generatedCount} alive
          </p>
        </div>
        <div className="wv-header-right">
          <button className="wv-refresh-btn" onClick={loadCharacters} title="Refresh">
            ↺
          </button>
        </div>
      </div>

      {/* Generate all banner */}
      <GenerateAllBanner
        onGenerateAll={generateAllStates}
        isGenerating={generatingAll}
        total={characters.length}
        generated={generatedCount}
      />

      {/* Filter bar */}
      <FilterBar
        activeType={activeType}
        onTypeChange={setActiveType}
        counts={typeCounts}
      />

      {/* Character grid */}
      {filtered.length === 0 ? (
        <div className="wv-empty">
          <p>No {activeType === 'all' ? '' : activeType} characters yet.</p>
        </div>
      ) : (
        <div className="wv-grid">
          {filtered.map((char, i) => (
            <CharacterCard
              key={char.id}
              character={char}
              livingState={livingStates[char.id] || null}
              allCharacters={characters}
              onGenerate={generateState}
              onConfirm={confirmState}
              onEdit={editState}
              onOpenHome={openCharacterHome}
              isGenerating={generatingId === char.id || generatingAll}
              animIndex={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}
