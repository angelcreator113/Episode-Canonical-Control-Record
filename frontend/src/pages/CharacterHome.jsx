/**
 * CharacterHome.jsx
 * 
 * Route: /character/:charId
 * 
 * The individual character page. Everything about one person.
 * 
 * Six sections:
 *   1. Living State — hero card, what she knows/wants/unresolved
 *   2. Arc Timeline — chapter-by-chapter journey (generated from manuscript)
 *   3. Relationships — who she's connected to (from registry)
 *   4. Plot Threads — active threads involving this character
 *   5. Full Dossier — the existing CharacterDossier component (8 sections)
 *   6. Therapy — link to therapy room for this character
 * 
 * Data flow:
 *   - Loads character from GET /character-registry/characters/:id
 *   - Living state from localStorage (Phase 1) or DB (Phase 2)
 *   - Arc generated via POST /memories/generate-character-arc
 *   - Dossier embedded as <CharacterDossier character={character} />
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CharacterDossier from './CharacterDossier';
import './CharacterHome.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

// ── Type colors (same as WorldView) ────────────────────────────────────

const TYPE_META = {
  protagonist: { label: 'Protagonist', color: '#0d9488', bg: 'rgba(13,148,136,0.08)' },
  special:     { label: 'Special',     color: '#C6A85E', bg: 'rgba(198,168,94,0.08)'   },
  pressure:    { label: 'Pressure',    color: '#e07070', bg: 'rgba(224,112,112,0.08)'  },
  mirror:      { label: 'Mirror',      color: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
  support:     { label: 'Support',     color: '#34d399', bg: 'rgba(52,211,153,0.08)'   },
  shadow:      { label: 'Shadow',      color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
};

const MOMENTUM = {
  rising:  { symbol: '↑', color: '#34d399', label: 'Rising' },
  steady:  { symbol: '→', color: '#94a3b8', label: 'Steady' },
  falling: { symbol: '↓', color: '#f87171', label: 'Falling' },
  dormant: { symbol: '·', color: '#64748b', label: 'Dormant' },
};

// ── Section Nav ────────────────────────────────────────────────────────

const SECTIONS = [
  { key: 'living',    icon: '✦', label: 'Living State' },
  { key: 'arc',       icon: '📈', label: 'Arc Timeline' },
  { key: 'relations', icon: '🔗', label: 'Relationships' },
  { key: 'threads',   icon: '🧵', label: 'Plot Threads' },
  { key: 'dossier',   icon: '📋', label: 'Full Dossier' },
  { key: 'therapy',   icon: '🛋️', label: 'Therapy Room' },
];

// ════════════════════════════════════════════════════════════════════════

export default function CharacterHome() {
  const { charId } = useParams();
  const navigate = useNavigate();

  const [character, setCharacter]     = useState(null);
  const [livingState, setLivingState] = useState(null);
  const [arc, setArc]                 = useState(null);
  const [plotThreads, setPlotThreads] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [activeSection, setActiveSection] = useState('living');
  const [generatingArc, setGeneratingArc] = useState(false);

  // ── Load character ──────────────────────────────────────────────────

  const loadCharacter = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}/character-registry/characters/${charId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Failed to load character (${res.status})`);
      const data = await res.json();
      setCharacter(data.character || data);

      // Load living state from localStorage
      const saved = JSON.parse(localStorage.getItem('wv_living_states') || '{}');
      if (saved[charId]) setLivingState(saved[charId]);

      // Load plot threads (graceful if endpoint doesn't exist yet)
      try {
        const threadsRes = await fetch(`${API_BASE}/character-registry/characters/${charId}/plot-threads`, {
          credentials: 'include',
        });
        if (threadsRes.ok) {
          const threadsData = await threadsRes.json();
          setPlotThreads(threadsData.threads || []);
        }
      } catch { /* fine — Phase 2 */ }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [charId]);

  useEffect(() => { loadCharacter(); }, [loadCharacter]);

  // ── Generate arc ───────────────────────────────────────────────────

  const generateArc = useCallback(async () => {
    if (!character) return;
    setGeneratingArc(true);

    try {
      const res = await fetch(`${API_BASE}/memories/generate-character-arc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          character_id: character.id,
          character_name: character.selected_name || character.display_name,
          character_type: character.role_type,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setArc(data.arc || data);
      } else {
        // Fallback arc
        setArc({
          chapters: [
            { chapter: 'Ch 1', event: 'Introduction', shift: 'Belief intact' },
            { chapter: 'Ch 5', event: 'First pressure', shift: 'Cracks forming' },
          ],
          summary: `${character.selected_name || character.display_name}'s arc is still being written.`,
        });
      }
    } catch {
      setArc({
        chapters: [],
        summary: 'Unable to generate arc. Connect to a manuscript first.',
      });
    } finally {
      setGeneratingArc(false);
    }
  }, [character]);

  // ── Dossier callbacks ─────────────────────────────────────────────

  const onDossierSave = useCallback(async (id, fields) => {
    try {
      const res = await fetch(`${API_BASE}/character-registry/characters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(fields),
      });
      if (res.ok) loadCharacter();
    } catch { /* silent */ }
  }, [loadCharacter]);

  const onDossierStatusChange = useCallback(async (id, status) => {
    try {
      const res = await fetch(`${API_BASE}/character-registry/characters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (res.ok) loadCharacter();
    } catch { /* silent */ }
  }, [loadCharacter]);

  const onDossierInterview = useCallback((char) => {
    navigate(`/therapy?character=${char.id}`);
  }, [navigate]);

  // ── Render helpers ────────────────────────────────────────────────

  const meta  = character ? (TYPE_META[character.role_type] || TYPE_META.support) : TYPE_META.support;
  const name  = character ? (character.selected_name || character.display_name || 'Unknown') : 'Loading…';
  const momentum = MOMENTUM[livingState?.momentum || 'dormant'];

  // ── Loading / Error ───────────────────────────────────────────────

  if (loading) return (
    <div className="ch-loading">
      <div className="ch-loading-ring" style={{ borderTopColor: meta.color }} />
      <p>Loading character…</p>
    </div>
  );

  if (error || !character) return (
    <div className="ch-error">
      <p>{error || 'Character not found.'}</p>
      <button className="ch-btn-generate" style={{ borderColor: meta.color, color: meta.color }} onClick={() => navigate('/world')}>
        ← Back to World
      </button>
    </div>
  );

  // Section header helper
  const SectionHeader = ({ label, color }) => (
    <div className="ch-section-header">
      <span className="ch-section-label" style={{ color }}>{label}</span>
      <hr className="ch-section-rule" style={{ background: color }} />
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────

  return (
    <div className="ch-page">
      {/* Topbar */}
      <div className="ch-topbar">
        <button className="ch-btn-back" onClick={() => navigate('/world')}>
          ← World View
        </button>
        <span className="ch-breadcrumb">/ {name}</span>
      </div>

      {/* Hero Header */}
      <div className="ch-hero" style={{ borderLeftColor: meta.color }}>
        <div className="ch-hero-left">
          <h1 className="ch-hero-name">{name}</h1>
          {character.belief_pressured && (
            <span className="ch-hero-archetype">"{character.belief_pressured}"</span>
          )}
          <div className="ch-hero-badges">
            <span className="ch-badge" style={{ borderColor: meta.color, color: meta.color, background: meta.bg }}>
              {meta.label}
            </span>
            {character.status === 'finalized' && (
              <span className="ch-badge" style={{ borderColor: '#9c9890', color: '#9c9890' }}>Finalized</span>
            )}
          </div>
        </div>

        <div className="ch-hero-right">
          {/* Momentum indicator */}
          {livingState?.isGenerated && (
            <div className="ch-hero-momentum" style={{ color: momentum.color }}>
              <span className="ch-hero-momentum-icon">{momentum.symbol}</span>
              <span className="ch-hero-momentum-label">{momentum.label}</span>
            </div>
          )}
          {character.role_label && (
            <span className="ch-hero-role">{character.role_label}</span>
          )}
          {character.status === 'finalized' && (
            <span className="ch-finalized-lock">🔒</span>
          )}
        </div>
      </div>

      {/* Section Nav */}
      <nav className="ch-section-nav">
        {SECTIONS.map(s => (
          <button
            key={s.key}
            className={`ch-nav-pill ${activeSection === s.key ? 'active' : ''}`}
            style={activeSection === s.key ? { color: meta.color, borderColor: meta.color } : {}}
            onClick={() => setActiveSection(s.key)}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </nav>

      {/* Section Content */}
      <div className="ch-content">
        {/* ── 1. Living State ──────────────────────────────────────── */}
        {activeSection === 'living' && (
          <div className="ch-section">
            <SectionHeader label="Living State" color={meta.color} />
            <div className="ch-living-state-panel">
              {livingState?.isGenerated ? (
                <>
                  <div className="ch-living-state-header">
                    <div className="ch-momentum-pill" style={{ color: momentum.color }}>
                      {momentum.symbol} {momentum.label}
                    </div>
                    <div className="ch-living-state-actions">
                      <button
                        className="ch-btn-generate"
                        style={{ borderColor: meta.color, color: meta.color }}
                        onClick={() => navigate('/world')}
                      >
                        ↻ Regenerate
                      </button>
                    </div>
                  </div>
                  <div className="ch-living-state-grid">
                    <div className="ch-living-slot">
                      <div className="ch-living-slot-label">Knows</div>
                      <div className="ch-living-slot-text">{livingState.currentKnows}</div>
                    </div>
                    <div className="ch-living-slot">
                      <div className="ch-living-slot-label">Wants</div>
                      <div className="ch-living-slot-text">{livingState.currentWants}</div>
                    </div>
                    <div className="ch-living-slot ch-living-slot-full">
                      <div className="ch-living-slot-label" style={{ color: '#e07070' }}>Unresolved</div>
                      <div className="ch-living-slot-text">{livingState.unresolved}</div>
                    </div>
                  </div>
                  {livingState.lastChapter && (
                    <div className="ch-living-state-footer">Last seen: {livingState.lastChapter}</div>
                  )}
                </>
              ) : (
                <div className="ch-living-state-empty">
                  <p>No living state generated yet.</p>
                  <button
                    className="ch-btn-generate-primary"
                    style={{ background: meta.color }}
                    onClick={() => navigate('/world')}
                  >
                    Generate from World View
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 2. Arc Timeline ──────────────────────────────────────── */}
        {activeSection === 'arc' && (
          <div className="ch-section">
            <SectionHeader label="Arc Timeline" color={meta.color} />
            {arc?.summary && <p className="ch-section-description">{arc.summary}</p>}
            {arc && (arc.chapters || []).length > 0 ? (
              <div className="ch-arc-strip">
                {(arc.chapters || []).map((ch, i) => (
                  <React.Fragment key={i}>
                    <div className="ch-arc-beat">
                      <div className="ch-arc-beat-header">
                        <span className="ch-arc-chapter-label">{ch.chapter}</span>
                        {ch.title && <span className="ch-arc-chapter-title">{ch.title}</span>}
                        <span className="ch-arc-momentum">{momentum.symbol}</span>
                      </div>
                      <div className="ch-arc-what-happened">{ch.event}</div>
                      {ch.shift && (
                        <div className="ch-arc-belief-shift">
                          <span className="ch-arc-belief-label">Belief shift</span>
                          {ch.shift}
                        </div>
                      )}
                    </div>
                    {i < (arc.chapters || []).length - 1 && (
                      <div className="ch-arc-connector" style={{ background: meta.color }} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            ) : !arc ? (
              <div className="ch-arc-empty">
                <p>No arc data yet.</p>
                <button
                  className="ch-btn-generate-primary"
                  style={{ background: meta.color }}
                  onClick={generateArc}
                  disabled={generatingArc}
                >
                  {generatingArc ? '✦ Generating…' : '✦ Generate Arc from Manuscript'}
                </button>
              </div>
            ) : (
              <div className="ch-arc-empty">
                <p>Arc generated but no chapter beats found yet.</p>
              </div>
            )}
          </div>
        )}

        {/* ── 3. Relationships ─────────────────────────────────────── */}
        {activeSection === 'relations' && (
          <div className="ch-section">
            <SectionHeader label="Relationships" color={meta.color} />
            <div className="ch-relationships-panel">
              {character.relationships_map && Object.keys(character.relationships_map).length > 0 ? (
                <div className="ch-relationships-list">
                  {Object.entries(character.relationships_map).map(([key, rel]) => (
                    <div key={key} className="ch-relationship-entry">
                      <div className="ch-relationship-name">{rel.name || key}</div>
                      <div className="ch-relationship-desc">
                        {rel.type || rel.relationship || '—'}
                        {rel.dynamic && ` · ${rel.dynamic}`}
                        {rel.notes && ` — ${rel.notes}`}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ch-relationships-empty">
                  No relationships mapped yet. Add them in the Dossier section.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 4. Plot Threads ──────────────────────────────────────── */}
        {activeSection === 'threads' && (
          <div className="ch-section">
            <SectionHeader label="Plot Threads" color={meta.color} />
            {plotThreads.length > 0 ? (
              <div className="ch-threads-list">
                {plotThreads.map((thread, i) => {
                  const dotColor = thread.status === 'active' ? '#34d399'
                    : thread.status === 'resolved' ? '#94a3b8' : '#C6A85E';
                  return (
                    <div key={i} className="ch-thread-entry">
                      <div className="ch-thread-status-dot" style={{ background: dotColor }} />
                      <div className="ch-thread-body">
                        <div className="ch-thread-desc">{thread.title || thread.description}</div>
                        <div className="ch-thread-meta">
                          <span style={{ color: dotColor }}>{thread.status || 'open'}</span>
                          {thread.source && <span className="ch-thread-source">{thread.source}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ch-threads-empty">
                No plot threads tracked yet. This will be available in Phase 2.
              </div>
            )}
          </div>
        )}

        {/* ── 5. Full Dossier ──────────────────────────────────────── */}
        {activeSection === 'dossier' && (
          <div className="ch-section">
            <SectionHeader label="Full Dossier" color={meta.color} />
            <div className="ch-dossier-wrapper">
              {CharacterDossier ? (
                <CharacterDossier
                  character={character}
                  onSave={onDossierSave}
                  onStatusChange={onDossierStatusChange}
                  onInterview={onDossierInterview}
                  onRefresh={loadCharacter}
                />
              ) : (
                <div className="ch-dossier-fallback">
                  <div className="ch-dossier-field ch-dossier-field-full">
                    <div className="ch-dossier-label">Name</div>
                    <div className="ch-dossier-value">{name}</div>
                  </div>
                  <div className="ch-dossier-field">
                    <div className="ch-dossier-label">Type</div>
                    <div className="ch-dossier-value">{meta.label}</div>
                  </div>
                  <div className="ch-dossier-field">
                    <div className="ch-dossier-label">Role</div>
                    <div className="ch-dossier-value">{character.role_label || '—'}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 6. Therapy Room ──────────────────────────────────────── */}
        {activeSection === 'therapy' && (
          <div className="ch-section">
            <SectionHeader label="Therapy Room" color={meta.color} />
            <div className="ch-therapy-list">
              <div className="ch-therapy-session">
                <div className="ch-therapy-session-date">Session Available</div>
                <div className="ch-therapy-wound">
                  <span className="ch-therapy-wound-label">Focus</span>
                  Beliefs, fears, and growth
                </div>
                <div className="ch-therapy-summary">
                  Have a deep conversation with {name} — explore their internal world, challenge their beliefs, and uncover hidden truths.
                </div>
              </div>
            </div>
            <button
              className="ch-btn-ghost ch-btn-full"
              style={{ borderColor: meta.color, color: meta.color }}
              onClick={() => navigate(`/therapy?character=${charId}`)}
            >
              Start Therapy Session →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
