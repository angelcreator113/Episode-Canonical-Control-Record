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
      <button onClick={() => navigate('/world')}>← Back to World</button>
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────

  return (
    <div className="ch-root">
      {/* Hero Header */}
      <div className="ch-hero" style={{ '--hero-accent': meta.color, '--hero-bg': meta.bg }}>
        <button className="ch-back-btn" onClick={() => navigate('/world')}>
          ← World View
        </button>

        <div className="ch-hero-main">
          <div className="ch-hero-avatar" style={{ background: meta.bg, borderColor: meta.color, color: meta.color }}>
            {(name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="ch-hero-info">
            <h1 className="ch-hero-name">{name}</h1>
            <div className="ch-hero-meta">
              <span className="ch-type-badge" style={{ background: meta.bg, color: meta.color }}>
                {meta.label}
              </span>
              {character.role_label && (
                <span className="ch-role">{character.role_label}</span>
              )}
              {character.belief_pressured && (
                <span className="ch-belief">"{character.belief_pressured}"</span>
              )}
            </div>
          </div>

          {/* Momentum indicator */}
          {livingState?.isGenerated && (
            <div className="ch-hero-momentum" style={{ color: momentum.color }}>
              <span className="ch-momentum-symbol">{momentum.symbol}</span>
              <span className="ch-momentum-label">{momentum.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* Section Nav */}
      <nav className="ch-section-nav">
        {SECTIONS.map(s => (
          <button
            key={s.key}
            className={`ch-nav-btn ${activeSection === s.key ? 'active' : ''}`}
            style={activeSection === s.key ? { color: meta.color, borderBottomColor: meta.color } : {}}
            onClick={() => setActiveSection(s.key)}
          >
            <span className="ch-nav-icon">{s.icon}</span>
            {s.label}
          </button>
        ))}
      </nav>

      {/* Section Content */}
      <div className="ch-content">
        {/* ── 1. Living State ──────────────────────────────────────── */}
        {activeSection === 'living' && (
          <div className="ch-section ch-living">
            {livingState?.isGenerated ? (
              <>
                <div className="ch-state-grid">
                  <div className="ch-state-card">
                    <span className="ch-state-label" style={{ color: meta.color }}>KNOWS</span>
                    <p>{livingState.currentKnows}</p>
                  </div>
                  <div className="ch-state-card">
                    <span className="ch-state-label" style={{ color: meta.color }}>WANTS</span>
                    <p>{livingState.currentWants}</p>
                  </div>
                  <div className="ch-state-card ch-state-unresolved">
                    <span className="ch-state-label">UNRESOLVED</span>
                    <p>{livingState.unresolved}</p>
                  </div>
                </div>
                {livingState.lastChapter && (
                  <p className="ch-last-seen">Last seen: {livingState.lastChapter}</p>
                )}
              </>
            ) : (
              <div className="ch-state-empty">
                <p>No living state generated yet.</p>
                <button
                  className="ch-gen-btn"
                  style={{ borderColor: meta.color, color: meta.color }}
                  onClick={() => navigate('/world')}
                >
                  Generate from World View
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── 2. Arc Timeline ──────────────────────────────────────── */}
        {activeSection === 'arc' && (
          <div className="ch-section ch-arc">
            {arc ? (
              <>
                {arc.summary && <p className="ch-arc-summary">{arc.summary}</p>}
                <div className="ch-arc-timeline">
                  {(arc.chapters || []).map((ch, i) => (
                    <div key={i} className="ch-arc-node" style={{ '--node-color': meta.color }}>
                      <div className="ch-arc-dot" />
                      <div className="ch-arc-content">
                        <span className="ch-arc-chapter">{ch.chapter}</span>
                        <span className="ch-arc-event">{ch.event}</span>
                        {ch.shift && <span className="ch-arc-shift">{ch.shift}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="ch-arc-empty">
                <p>No arc data yet.</p>
                <button
                  className="ch-gen-btn"
                  style={{ borderColor: meta.color, color: meta.color }}
                  onClick={generateArc}
                  disabled={generatingArc}
                >
                  {generatingArc ? '✦ Generating arc…' : '✦ Generate Arc from Manuscript'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── 3. Relationships ─────────────────────────────────────── */}
        {activeSection === 'relations' && (
          <div className="ch-section ch-relations">
            {character.relationships_map && Object.keys(character.relationships_map).length > 0 ? (
              <div className="ch-rel-grid">
                {Object.entries(character.relationships_map).map(([key, rel]) => (
                  <div key={key} className="ch-rel-card">
                    <div className="ch-rel-name">{rel.name || key}</div>
                    <div className="ch-rel-type">{rel.type || rel.relationship || '—'}</div>
                    {rel.dynamic && <div className="ch-rel-dynamic">{rel.dynamic}</div>}
                    {rel.notes && <div className="ch-rel-notes">{rel.notes}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="ch-empty-msg">No relationships mapped yet. Add them in the Dossier section.</p>
            )}
          </div>
        )}

        {/* ── 4. Plot Threads ──────────────────────────────────────── */}
        {activeSection === 'threads' && (
          <div className="ch-section ch-threads">
            {plotThreads.length > 0 ? (
              <div className="ch-thread-list">
                {plotThreads.map((thread, i) => (
                  <div key={i} className="ch-thread-card">
                    <div className="ch-thread-title">{thread.title}</div>
                    <div className="ch-thread-status">{thread.status}</div>
                    {thread.description && <p className="ch-thread-desc">{thread.description}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="ch-empty-msg">No plot threads tracked yet. This will be available in Phase 2.</p>
            )}
          </div>
        )}

        {/* ── 5. Full Dossier ──────────────────────────────────────── */}
        {activeSection === 'dossier' && (
          <div className="ch-section ch-dossier-wrap">
            {CharacterDossier ? (
              <CharacterDossier
                character={character}
                onSave={onDossierSave}
                onStatusChange={onDossierStatusChange}
                onInterview={onDossierInterview}
                onRefresh={loadCharacter}
              />
            ) : (
              <p className="ch-empty-msg">
                Character Dossier component not available. Check your project setup.
              </p>
            )}
          </div>
        )}

        {/* ── 6. Therapy Room ──────────────────────────────────────── */}
        {activeSection === 'therapy' && (
          <div className="ch-section ch-therapy">
            <div className="ch-therapy-card" style={{ borderColor: meta.color }}>
              <div className="ch-therapy-icon">🛋️</div>
              <h3>Therapy Session</h3>
              <p>Have a deep conversation with {name} about their beliefs, fears, and growth.</p>
              <button
                className="ch-therapy-btn"
                style={{ background: meta.color, color: '#fff' }}
                onClick={() => navigate(`/therapy?character=${charId}`)}
              >
                Start Therapy Session →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
