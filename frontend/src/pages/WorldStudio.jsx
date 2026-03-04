/**
 * WorldStudio v3 — Editorial cream theme (matches Character Generator)
 *
 * Tabs: Characters | Scenes | Triggers | Registry
 *
 * Characters tab: LalaVerse world characters with auto-generate + preview flow
 * Scenes tab: Intimate scenes between world characters
 * Triggers tab: Tension triggers + one-night candidates
 * Registry tab: PNOS psychological forces (canonical registry characters)
 *
 * Layout: Header (topbar) → Body (sidebar | main | inspector)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useRegistries from '../hooks/useRegistries';
import './WorldStudio.css';

const API = '/api/v1';

/* ── Type display helpers ───────────────────────────────────────────── */
const TYPES = {
  love_interest:   'Love Interest',
  industry_peer:   'Industry Peer',
  mentor:          'Mentor',
  antagonist:      'Antagonist',
  rival:           'Rival',
  collaborator:    'Collaborator',
  one_night_stand: 'One Night Stand',
  recurring:       'Recurring',
};

const TYPE_BADGE = {
  love_interest:   'ws-badge-love_interest',
  industry_peer:   'ws-badge-industry_peer',
  mentor:          'ws-badge-mentor',
  antagonist:      'ws-badge-antagonist',
  rival:           'ws-badge-rival',
  collaborator:    'ws-badge-collaborator',
  one_night_stand: 'ws-badge-one_night_stand',
  recurring:       'ws-badge-recurring',
};

const ROLE_LABELS = {
  protagonist: 'Protagonist',
  pressure:    'Antagonist',
  mirror:      'Mirror',
  support:     'Supporting',
  shadow:      'Shadow',
  special:     'Special',
};

const ROLE_BADGE = {
  protagonist: 'ws-badge-protagonist',
  pressure:    'ws-badge-pressure',
  mirror:      'ws-badge-mirror',
  support:     'ws-badge-support',
  shadow:      'ws-badge-shadow',
  special:     'ws-badge-special',
};

const ROLE_ICONS = {
  protagonist: '♛',
  pressure:    '⊗',
  mirror:      '◎',
  support:     '◉',
  shadow:      '◆',
  special:     '✦',
};

/* ── Small sub-components ────────────────────────────────────────── */

function Badge({ children, className = '' }) {
  return <span className={`ws-badge ${className}`}>{children}</span>;
}

function PreviewCard({ char, selected, onToggle }) {
  const badgeCls = TYPE_BADGE[char.character_type] || '';
  return (
    <div
      onClick={onToggle}
      className={`ws-preview-card ${selected ? 'ws-preview-card-selected' : ''}`}
    >
      <div className="ws-preview-card-top">
        <div className="ws-preview-card-name">{char.name}</div>
        <div className={`ws-preview-card-check ${selected ? 'ws-preview-card-check-active' : ''}`}>
          {selected && '✓'}
        </div>
      </div>
      <div className="ws-preview-card-meta">
        {char.age_range} · {char.occupation}
      </div>
      <div className="ws-preview-card-badges">
        <Badge className={badgeCls}>{TYPES[char.character_type] || char.character_type}</Badge>
        {char.intimate_eligible && <Badge className="ws-badge-intimate">♡ Intimate</Badge>}
      </div>
      {char.signature && (
        <div className="ws-preview-card-signature">
          &ldquo;{char.signature}&rdquo;
        </div>
      )}
      {char.dynamic && (
        <div className="ws-preview-card-dynamic">{char.dynamic}</div>
      )}
    </div>
  );
}

function CharCard({ char, selected, onClick }) {
  const badgeCls = TYPE_BADGE[char.character_type] || '';
  return (
    <div
      onClick={onClick}
      className={`ws-char-card ${selected ? 'ws-char-card-selected' : ''}`}
    >
      <div className="ws-char-card-top">
        <span className="ws-char-card-name">{char.name}</span>
        {char.intimate_eligible && <span className="ws-char-card-intimate">♡</span>}
        <span className={`ws-char-card-status ${char.status === 'active' ? 'ws-char-card-status-active' : 'ws-char-card-status-draft'}`}>
          {char.status}
        </span>
      </div>
      <div className="ws-char-card-occupation">{char.occupation}</div>
      <div className="ws-char-card-badges">
        <Badge className={badgeCls}>{TYPES[char.character_type] || char.character_type}</Badge>
        {char.current_tension && char.current_tension !== 'Stable' && (
          <Badge className="ws-badge-tension">{char.current_tension}</Badge>
        )}
      </div>
      {char.signature && (
        <div className="ws-char-card-signature">
          &ldquo;{char.signature}&rdquo;
        </div>
      )}
    </div>
  );
}

function SceneCard({ scene, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`ws-scene-card ${selected ? 'ws-scene-card-selected' : ''}`}
    >
      <div className="ws-scene-card-title">
        {scene.character_a_name}{scene.character_b_name ? ` & ${scene.character_b_name}` : ''}
      </div>
      <div className="ws-scene-card-meta">
        {TYPES[scene.scene_type] || scene.scene_type} · {scene.word_count || '—'} words
      </div>
      <div className="ws-scene-card-badges">
        <Badge className="ws-badge-intensity">{scene.intensity || 'medium'}</Badge>
        <Badge className={scene.status === 'approved' ? 'ws-badge-approved' : 'ws-badge-draft'}>{scene.status}</Badge>
      </div>
    </div>
  );
}

function RegistryCharCard({ char, onInterview, onTherapy, onDossier }) {
  const badgeCls = ROLE_BADGE[char.role_type] || '';
  const icon = ROLE_ICONS[char.role_type] || '✦';
  return (
    <div className="ws-registry-card">
      <div className="ws-registry-card-top">
        <span className="ws-registry-card-icon" style={{ color: `var(--ws-${char.role_type === 'protagonist' ? 'gold' : char.role_type === 'pressure' ? 'rose' : char.role_type === 'mirror' ? 'blue' : char.role_type === 'support' ? 'green' : char.role_type === 'shadow' ? 'purple' : 'teal'})` }}>
          {icon}
        </span>
        <span className="ws-registry-card-name">
          {char.selected_name || char.display_name}
        </span>
        <Badge className={badgeCls}>{ROLE_LABELS[char.role_type] || char.role_type}</Badge>
      </div>
      {char.subtitle && (
        <div className="ws-registry-card-subtitle">{char.subtitle}</div>
      )}
      <div className="ws-registry-card-traits">
        {char.core_desire && (
          <div className="ws-registry-card-trait ws-registry-card-trait-desire">
            <span className="ws-registry-card-trait-label">Desire:</span> {char.core_desire}
          </div>
        )}
        {char.core_fear && (
          <div className="ws-registry-card-trait ws-registry-card-trait-fear">
            <span className="ws-registry-card-trait-label">Fear:</span> {char.core_fear}
          </div>
        )}
      </div>
      {char.signature_trait && (
        <div className="ws-registry-card-signature">
          &ldquo;{char.signature_trait}&rdquo;
        </div>
      )}
      <div className="ws-registry-card-actions">
        <button className="ws-btn ws-btn-ghost" onClick={() => onDossier(char)}>
          📋 Dossier
        </button>
        <button className="ws-btn ws-btn-lavender" onClick={() => onInterview(char)}>
          🎤 Voice Interview
        </button>
        <button className="ws-btn ws-btn-teal" onClick={() => onTherapy(char)}>
          🛋️ Therapy
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════ */

export default function WorldStudio() {
  const navigate = useNavigate();

  /* ── Tab state ─────────────────────────────────────────────────────── */
  const [tab, setTab] = useState('characters');

  /* ── Characters ────────────────────────────────────────────────────── */
  const [characters, setCharacters]     = useState([]);
  const [selectedChar, setSelectedChar] = useState(null);
  const [charDetail, setCharDetail]     = useState(null);
  const [charFilter, setCharFilter]     = useState('all');

  /* ── Scenes ────────────────────────────────────────────────────────── */
  const [scenes, setScenes]             = useState([]);
  const [selectedScene, setSelectedScene] = useState(null);
  const [sceneDetail, setSceneDetail]   = useState(null);
  const [continuations, setContinuations] = useState([]);

  /* ── Triggers ──────────────────────────────────────────────────────── */
  const [triggered, setTriggered]             = useState([]);
  const [oneNightCandidates, setOneNightCandidates] = useState([]);

  /* ── Preview flow (generate → preview → select → confirm) ─────────── */
  const [previewChars, setPreviewChars]     = useState([]);
  const [previewSelected, setPreviewSelected] = useState(new Set());
  const [previewNotes, setPreviewNotes]     = useState('');
  const [showPreview, setShowPreview]       = useState(false);

  /* ── UI state ──────────────────────────────────────────────────────── */
  const [generating, setGenerating]         = useState(false);
  const [confirming, setConfirming]         = useState(false);
  const [generatingScene, setGeneratingScene] = useState(false);
  const [approving, setApproving]           = useState(false);
  const [showSceneModal, setShowSceneModal] = useState(false);
  const [toast, setToast]                   = useState(null);

  /* ── Scene form ────────────────────────────────────────────────────── */
  const [sceneForm, setSceneForm] = useState({
    character_a_id: '', character_b_id: '', scene_type: 'hook_up',
    location: '', world_context: '', career_stage: 'early_career',
  });

  /* ── Registry (for Registry tab) ───────────────────────────────────── */
  const { registries, loading: regLoading, refresh: refreshRegistries } = useRegistries();
  const [activeRegId, setActiveRegId]     = useState(null);
  const [regCharacters, setRegCharacters] = useState([]);
  const [regSearch, setRegSearch]         = useState('');
  const [regRoleFilter, setRegRoleFilter] = useState('all');

  /* ── Toast helper ──────────────────────────────────────────────────── */
  const flash = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  /* ══════════════════════════════════════════════════════════════════════
     DATA LOADERS
  ══════════════════════════════════════════════════════════════════════ */

  const loadCharacters = useCallback(async () => {
    try {
      const r = await fetch(`${API}/world/characters`);
      const d = await r.json();
      setCharacters(d.characters || []);
    } catch (e) { console.error(e); }
  }, []);

  const loadScenes = useCallback(async () => {
    try {
      const r = await fetch(`${API}/world/scenes`);
      const d = await r.json();
      setScenes(d.scenes || []);
    } catch (e) { console.error(e); }
  }, []);

  const loadTriggers = useCallback(async () => {
    try {
      const r = await fetch(`${API}/world/tension-check`);
      const d = await r.json();
      setTriggered(d.triggered || []);
      setOneNightCandidates(d.one_night_candidates || []);
    } catch (e) { console.error(e); }
  }, []);

  const loadCharDetail = useCallback(async (id) => {
    try {
      const r = await fetch(`${API}/world/characters/${id}`);
      const d = await r.json();
      setCharDetail(d.character || null);
    } catch (e) { console.error(e); }
  }, []);

  const loadSceneDetail = useCallback(async (id) => {
    try {
      const r = await fetch(`${API}/world/scenes/${id}`);
      const d = await r.json();
      setSceneDetail(d.scene || null);
      setContinuations(d.continuations || []);
    } catch (e) { console.error(e); }
  }, []);

  const loadRegistryChars = useCallback(async (regId) => {
    try {
      const r = await fetch(`${API}/character-registry/registries/${regId}`);
      const d = await r.json();
      setRegCharacters(d.registry?.characters || d.characters || []);
    } catch (e) { console.error(e); setRegCharacters([]); }
  }, []);

  /* ── Initial loads ─────────────────────────────────────────────────── */
  useEffect(() => { loadCharacters(); loadScenes(); loadTriggers(); }, []);

  useEffect(() => { if (selectedChar) loadCharDetail(selectedChar); }, [selectedChar]);
  useEffect(() => { if (selectedScene) loadSceneDetail(selectedScene); }, [selectedScene]);

  useEffect(() => {
    if (registries.length > 0 && !activeRegId) {
      setActiveRegId(registries[0].id);
    }
  }, [registries]);

  useEffect(() => {
    if (activeRegId) loadRegistryChars(activeRegId);
  }, [activeRegId]);

  /* ══════════════════════════════════════════════════════════════════════
     ACTIONS
  ══════════════════════════════════════════════════════════════════════ */

  const generatePreview = async () => {
    setGenerating(true);
    try {
      const r = await fetch(`${API}/world/generate-ecosystem-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const d = await r.json();
      if (d.characters?.length) {
        setPreviewChars(d.characters);
        setPreviewNotes(d.generation_notes || '');
        setPreviewSelected(new Set(d.characters.map((_, i) => i)));
        setShowPreview(true);
      } else {
        flash(d.error || 'Preview generation failed', 'error');
      }
    } catch (e) { flash(e.message, 'error'); }
    finally { setGenerating(false); }
  };

  const confirmPreview = async () => {
    const selected = previewChars.filter((_, i) => previewSelected.has(i));
    if (selected.length === 0) { flash('Select at least one character', 'error'); return; }
    setConfirming(true);
    try {
      const r = await fetch(`${API}/world/generate-ecosystem-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characters: selected, generation_notes: previewNotes }),
      });
      const d = await r.json();
      if (d.characters) {
        flash(`${d.count} characters committed`);
        setShowPreview(false);
        setPreviewChars([]);
        loadCharacters();
      } else {
        flash(d.error || 'Confirm failed', 'error');
      }
    } catch (e) { flash(e.message, 'error'); }
    finally { setConfirming(false); }
  };

  const togglePreview = (idx) => {
    setPreviewSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const activateChar = async (id) => {
    try {
      await fetch(`${API}/world/characters/${id}/activate`, { method: 'POST' });
      flash('Character activated');
      loadCharacters();
      if (selectedChar === id) loadCharDetail(id);
    } catch (e) { flash(e.message, 'error'); }
  };

  const generateScene = async () => {
    setGeneratingScene(true);
    try {
      const r = await fetch(`${API}/world/scenes/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sceneForm),
      });
      const d = await r.json();
      if (d.scene) {
        flash('Scene generated');
        setShowSceneModal(false);
        loadScenes();
        setTab('scenes');
        setSelectedScene(d.scene.id);
      } else {
        flash(d.error || 'Scene generation failed', 'error');
      }
    } catch (e) { flash(e.message, 'error'); }
    finally { setGeneratingScene(false); }
  };

  const approveScene = async (sceneId) => {
    setApproving(true);
    try {
      const r = await fetch(`${API}/world/scenes/${sceneId}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const d = await r.json();
      if (d.approved) {
        flash('Scene approved → StoryTeller');
        loadSceneDetail(sceneId); loadScenes(); loadTriggers();
      } else flash(d.error || 'Approve failed', 'error');
    } catch (e) { flash(e.message, 'error'); }
    finally { setApproving(false); }
  };

  const deleteScene = async (sceneId) => {
    try {
      await fetch(`${API}/world/scenes/${sceneId}`, { method: 'DELETE' });
      flash('Draft deleted');
      setSelectedScene(null); setSceneDetail(null); loadScenes();
    } catch (e) { flash(e.message, 'error'); }
  };

  const requestContinuation = async (sceneId) => {
    try {
      await fetch(`${API}/world/scenes/${sceneId}/continue`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ continuation_type: 'morning_after' }),
      });
      flash('Continuation generating…');
      setTimeout(() => loadSceneDetail(sceneId), 6000);
    } catch (e) { flash(e.message, 'error'); }
  };

  const approveContinuation = async (contId) => {
    try {
      await fetch(`${API}/world/continuations/${contId}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      flash('Continuation approved');
      if (selectedScene) loadSceneDetail(selectedScene);
    } catch (e) { flash(e.message, 'error'); }
  };

  const openSceneForChar = (charId) => {
    setSceneForm(f => ({ ...f, character_a_id: charId }));
    setShowSceneModal(true);
  };

  const openSceneFromTrigger = (char) => {
    setSceneForm(f => ({
      ...f, character_a_id: char.id,
      scene_type: char.character_type === 'one_night_stand' ? 'one_night_stand' : 'hook_up',
    }));
    setShowSceneModal(true);
  };

  /* ── Filtered characters ───────────────────────────────────────────── */
  const filtered = charFilter === 'all' ? characters : characters.filter(c => c.character_type === charFilter);
  const uniqueTypes = [...new Set(characters.map(c => c.character_type))];

  /* ── Filtered registry characters ──────────────────────────────────── */
  const filteredRegChars = regCharacters.filter(ch => {
    const name = (ch.selected_name || ch.display_name || '').toLowerCase();
    if (regSearch && !name.includes(regSearch.toLowerCase())) return false;
    if (regRoleFilter !== 'all' && ch.role_type !== regRoleFilter) return false;
    return true;
  });

  /* ══════════════════════════════════════════════════════════════════════
     TABS
  ══════════════════════════════════════════════════════════════════════ */
  const TABS = [
    { key: 'characters', icon: '✦', label: 'Characters', count: characters.length },
    { key: 'scenes',     icon: '♡', label: 'Scenes',     count: scenes.length },
    { key: 'triggers',   icon: '◇', label: 'Triggers',   count: triggered.length + oneNightCandidates.length },
    { key: 'registry',   icon: '📋', label: 'Registry',   count: regCharacters.length },
  ];

  /* ══════════════════════════════════════════════════════════════════════
     R E N D E R
  ══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="ws-page">

      {/* ── HEADER / TOPBAR ───────────────────────────────────────────── */}
      <header className="ws-header">
        <button className="ws-btn-back" onClick={() => navigate(-1)}>← Back</button>
        <div>
          <div className="ws-header-title">World Studio</div>
          <div className="ws-header-sub">Characters · Scenes · Triggers · Registry</div>
        </div>

        <div className="ws-tab-bar">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`ws-tab ${tab === t.key ? 'ws-tab-active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <span className="ws-tab-icon">{t.icon}</span>
              {t.label}
              <span className="ws-tab-count">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="ws-header-controls">
          {tab !== 'registry' && (
            <>
              <button className="ws-btn ws-btn-rose" onClick={() => setShowSceneModal(true)}>
                ♡ Write Scene
              </button>
              <button className="ws-btn ws-btn-gold" onClick={generatePreview} disabled={generating}>
                {generating ? '⏳ Generating…' : '✦ Generate Ecosystem'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── BODY ──────────────────────────────────────────────────────── */}
      <div className="ws-body">

        {/* ═══ LEFT SIDEBAR ══════════════════════════════════════════════ */}
        {tab !== 'registry' && (
          <aside className="ws-sidebar">
            <div className="ws-sidebar-title">
              {tab === 'characters' ? 'Characters' : tab === 'scenes' ? 'Scenes' : 'Triggers'}
            </div>

            {/* Characters sidebar */}
            {tab === 'characters' && (
              <>
                <div className="ws-filter-row">
                  <button
                    className={`ws-filter-pill ${charFilter === 'all' ? 'ws-filter-pill-active' : ''}`}
                    onClick={() => setCharFilter('all')}
                  >All</button>
                  {uniqueTypes.map(t => (
                    <button
                      key={t}
                      className={`ws-filter-pill ${charFilter === t ? 'ws-filter-pill-active' : ''}`}
                      onClick={() => setCharFilter(t)}
                    >{TYPES[t] || t}</button>
                  ))}
                </div>
                {filtered.length === 0 ? (
                  <div className="ws-empty ws-empty-small">
                    <div className="ws-empty-icon">✦</div>
                    <div className="ws-empty-text">No characters yet</div>
                    <div className="ws-empty-text">Generate an ecosystem to begin</div>
                  </div>
                ) : filtered.map(c => (
                  <CharCard
                    key={c.id} char={c}
                    selected={selectedChar === c.id}
                    onClick={() => setSelectedChar(c.id)}
                  />
                ))}
              </>
            )}

            {/* Scenes sidebar */}
            {tab === 'scenes' && (
              scenes.length === 0 ? (
                <div className="ws-empty ws-empty-small">
                  <div className="ws-empty-icon">♡</div>
                  <div className="ws-empty-text">No scenes yet</div>
                </div>
              ) : scenes.map(s => (
                <SceneCard
                  key={s.id} scene={s}
                  selected={selectedScene === s.id}
                  onClick={() => setSelectedScene(s.id)}
                />
              ))
            )}

            {/* Triggers sidebar */}
            {tab === 'triggers' && (
              <>
                {triggered.length > 0 && (
                  <>
                    <div className="ws-section-label ws-section-label-orange">Tension Triggers</div>
                    {triggered.map((t, i) => (
                      <div key={i} className="ws-trigger-card" onClick={() => openSceneFromTrigger(t)}>
                        <div className="ws-trigger-card-name">{t.name}</div>
                        <div className="ws-trigger-card-occupation">{t.occupation}</div>
                        <Badge className="ws-badge-tension" style={{ marginTop: 6 }}>{t.tension_state || 'High'}</Badge>
                      </div>
                    ))}
                  </>
                )}
                {oneNightCandidates.length > 0 && (
                  <>
                    <div className="ws-section-label ws-section-label-rose">One Night Candidates</div>
                    {oneNightCandidates.map(c => (
                      <div key={c.id} className="ws-trigger-card" onClick={() => openSceneFromTrigger(c)}>
                        <div className="ws-trigger-card-name">{c.name}</div>
                        <div className="ws-trigger-card-occupation">{c.occupation}</div>
                      </div>
                    ))}
                  </>
                )}
                {triggered.length === 0 && oneNightCandidates.length === 0 && (
                  <div className="ws-empty ws-empty-small">
                    <div className="ws-empty-icon">◇</div>
                    <div className="ws-empty-text">No triggers active</div>
                  </div>
                )}
              </>
            )}
          </aside>
        )}

        {/* ═══ MAIN CANVAS ═══════════════════════════════════════════════ */}
        <main className="ws-main">

          {/* ─── Characters: empty / detail ─── */}
          {tab === 'characters' && characters.length === 0 && (
            <div className="ws-empty">
              <div className="ws-empty-icon">✦</div>
              <div className="ws-empty-title">Start your World Ecosystem</div>
              <div className="ws-empty-text">
                Generate a full cast of world characters with one click.
                Preview them first, select who stays, then confirm.
              </div>
              <div className="ws-empty-actions">
                <button className="ws-btn ws-btn-gold" onClick={generatePreview} disabled={generating}>
                  {generating ? '⏳ Generating…' : '✨ Generate Ecosystem'}
                </button>
                <button className="ws-btn ws-btn-rose" onClick={() => setShowSceneModal(true)}>
                  ♡ Write Scene
                </button>
              </div>
            </div>
          )}

          {tab === 'characters' && characters.length > 0 && !charDetail && (
            <div className="ws-empty">
              <div className="ws-empty-icon">✦</div>
              <div className="ws-empty-title">Select a character</div>
              <div className="ws-empty-text">Choose from the sidebar to view their world profile</div>
            </div>
          )}

          {tab === 'characters' && charDetail && (
            <div key={charDetail.id} className="ws-detail">
              <div className="ws-detail-header-badges">
                <Badge className={TYPE_BADGE[charDetail.character_type]}>{TYPES[charDetail.character_type]}</Badge>
                {charDetail.intimate_eligible && <Badge className="ws-badge-intimate">♡ Intimate Eligible</Badge>}
                {charDetail.tension_type && <Badge className="ws-badge-tension">{charDetail.tension_type} tension</Badge>}
              </div>
              <h2 className="ws-detail-name">{charDetail.name}</h2>
              <div className="ws-detail-meta">
                {charDetail.age_range} · {charDetail.occupation} · {charDetail.world_location}
              </div>

              {charDetail.aesthetic && (
                <div className="ws-detail-section">
                  <div className="ws-section-label ws-section-label-gold">Aesthetic</div>
                  <div className="ws-detail-text">{charDetail.aesthetic}</div>
                </div>
              )}

              {charDetail.signature && (
                <blockquote className="ws-detail-blockquote">
                  {charDetail.signature}
                </blockquote>
              )}

              <div className="ws-section-label">What They Want</div>
              <div className="ws-detail-grid">
                <div className="ws-want-card">
                  <div className="ws-want-card-label ws-want-card-label-gold">Surface</div>
                  <div className="ws-want-card-text">{charDetail.surface_want}</div>
                </div>
                <div className="ws-want-card">
                  <div className="ws-want-card-label ws-want-card-label-rose">Real</div>
                  <div className="ws-want-card-text">{charDetail.real_want}</div>
                </div>
              </div>

              {charDetail.what_they_want_from_lala && (
                <div className="ws-detail-section" style={{ marginTop: 20 }}>
                  <div className="ws-section-label ws-section-label-teal">What They Want From Lala</div>
                  <div className="ws-inspector-card">{charDetail.what_they_want_from_lala}</div>
                </div>
              )}

              {charDetail.status === 'draft' && (
                <button className="ws-btn ws-btn-green" style={{ marginTop: 20 }}
                  onClick={() => activateChar(charDetail.id)}>
                  Activate Character
                </button>
              )}
            </div>
          )}

          {/* ─── Scenes: empty / detail ─── */}
          {tab === 'scenes' && scenes.length === 0 && (
            <div className="ws-empty">
              <div className="ws-empty-icon">♡</div>
              <div className="ws-empty-title">No scenes yet</div>
              <div className="ws-empty-text">Generate an intimate scene between two characters</div>
              <button className="ws-btn ws-btn-rose" onClick={() => setShowSceneModal(true)}>♡ Write Scene</button>
            </div>
          )}

          {tab === 'scenes' && scenes.length > 0 && !sceneDetail && (
            <div className="ws-empty">
              <div className="ws-empty-icon">♡</div>
              <div className="ws-empty-title">Select a scene</div>
            </div>
          )}

          {tab === 'scenes' && sceneDetail && (
            <div key={sceneDetail.id} className="ws-detail">
              <Badge className="ws-badge-intensity">{TYPES[sceneDetail.scene_type] || sceneDetail.scene_type}</Badge>
              <h2 className="ws-detail-name" style={{ marginTop: 8 }}>
                {sceneDetail.character_a_name}{sceneDetail.character_b_name ? ` & ${sceneDetail.character_b_name}` : ''}
              </h2>
              <div className="ws-detail-header-badges" style={{ marginBottom: 20 }}>
                <Badge className="ws-badge-intensity">{sceneDetail.intensity}</Badge>
                <Badge className={sceneDetail.status === 'approved' ? 'ws-badge-approved' : 'ws-badge-draft'}>{sceneDetail.status}</Badge>
                {sceneDetail.location && <Badge className="ws-badge-location">📍 {sceneDetail.location}</Badge>}
                <span style={{ fontSize: 11, color: 'var(--ws-muted)' }}>{sceneDetail.word_count} words</span>
              </div>

              {sceneDetail.approach_text && (
                <div className="ws-detail-section">
                  <div className="ws-section-label ws-section-label-gold">The Approach</div>
                  <div className="ws-scene-paragraphs">
                    {sceneDetail.approach_text.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                </div>
              )}
              {sceneDetail.scene_text && (
                <div className="ws-detail-section">
                  <div className="ws-section-label ws-section-label-rose">The Scene</div>
                  <div className="ws-scene-paragraphs">
                    {sceneDetail.scene_text.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                </div>
              )}
              {sceneDetail.aftermath_text && (
                <div className="ws-detail-section">
                  <div className="ws-section-label ws-section-label-lavender">The Aftermath</div>
                  <div className="ws-scene-paragraphs">
                    {sceneDetail.aftermath_text.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                </div>
              )}

              {sceneDetail.relationship_shift && (
                <blockquote className="ws-scene-shift">
                  {sceneDetail.relationship_shift}
                </blockquote>
              )}
            </div>
          )}

          {/* ─── Triggers: center prompt ─── */}
          {tab === 'triggers' && (
            <div className="ws-empty">
              <div className="ws-empty-icon">◇</div>
              <div className="ws-empty-title">
                {(triggered.length + oneNightCandidates.length) > 0
                  ? 'Tap a trigger from the sidebar'
                  : 'No triggers active'}
              </div>
              <div className="ws-empty-text">
                {(triggered.length + oneNightCandidates.length) > 0
                  ? 'Select a tension trigger to generate a scene'
                  : 'Activate characters and build tension first'}
              </div>
            </div>
          )}

          {/* ─── Registry tab: full-width grid ─── */}
          {tab === 'registry' && (
            <div>
              <div className="ws-registry-header">
                <select
                  className="ws-select"
                  style={{ width: 'auto', minWidth: 200 }}
                  value={activeRegId || ''}
                  onChange={e => setActiveRegId(e.target.value)}
                >
                  {registries.map(r => (
                    <option key={r.id} value={r.id}>{r.name || r.title || r.book_tag}</option>
                  ))}
                </select>

                <input
                  className="ws-input"
                  style={{ width: 'auto', flex: 1, maxWidth: 300 }}
                  placeholder="Search characters…"
                  value={regSearch}
                  onChange={e => setRegSearch(e.target.value)}
                />

                <div className="ws-filter-row" style={{ marginBottom: 0 }}>
                  {['all', 'protagonist', 'pressure', 'mirror', 'support', 'shadow', 'special'].map(r => (
                    <button
                      key={r}
                      className={`ws-filter-pill ${regRoleFilter === r ? 'ws-filter-pill-active' : ''}`}
                      onClick={() => setRegRoleFilter(r)}
                    >{r === 'all' ? 'All' : (ROLE_LABELS[r] || r)}</button>
                  ))}
                </div>
              </div>

              {regLoading ? (
                <div className="ws-empty">
                  <div className="ws-spinner ws-spinner-lg" />
                  <div className="ws-empty-text">Loading registries…</div>
                </div>
              ) : filteredRegChars.length === 0 ? (
                <div className="ws-empty ws-empty-small">
                  <div className="ws-empty-icon">📋</div>
                  <div className="ws-empty-title">No registry characters</div>
                  <div className="ws-empty-text">
                    {regSearch ? 'Try a different search' : 'Add characters in the Character Registry'}
                  </div>
                  <button className="ws-btn ws-btn-outline" onClick={() => navigate('/character-registry')}>
                    Open Full Registry →
                  </button>
                </div>
              ) : (
                <div className="ws-registry-grid">
                  {filteredRegChars.map(ch => (
                    <RegistryCharCard
                      key={ch.id}
                      char={ch}
                      onDossier={() => navigate(`/character-registry?highlight=${ch.id}`)}
                      onInterview={() => navigate(`/character-registry?highlight=${ch.id}&action=interview`)}
                      onTherapy={() => navigate(`/therapy/${activeRegId}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ═══ RIGHT INSPECTOR ════════════════════════════════════════════ */}
        {tab !== 'registry' && (
          <aside className="ws-inspector">
            <div className="ws-inspector-title">
              {tab === 'characters' ? 'World Profile' : tab === 'scenes' ? 'Scene Info' : 'Inspector'}
            </div>

            {/* Character inspector */}
            {tab === 'characters' && charDetail && (
              <>
                {charDetail.how_they_meet && (
                  <div className="ws-inspector-section">
                    <div className="ws-inspector-field-label ws-inspector-field-label-teal">How They Meet</div>
                    <div className="ws-inspector-card">{charDetail.how_they_meet}</div>
                  </div>
                )}
                {charDetail.dynamic && (
                  <div className="ws-inspector-section">
                    <div className="ws-inspector-field-label ws-inspector-field-label-lavender">Dynamic</div>
                    <div className="ws-inspector-card">{charDetail.dynamic}</div>
                  </div>
                )}
                {charDetail.intimate_eligible && (
                  <div className="ws-inspector-section">
                    <div className="ws-inspector-field-label ws-inspector-field-label-rose">Intimate Profile</div>
                    {charDetail.intimate_style && (
                      <div className="ws-inspector-field">
                        <div className="ws-inspector-field-label ws-inspector-field-label-rose">Intimate Style</div>
                        <div className="ws-inspector-card">{charDetail.intimate_style}</div>
                      </div>
                    )}
                    {charDetail.intimate_dynamic && (
                      <div className="ws-inspector-field">
                        <div className="ws-inspector-field-label ws-inspector-field-label-rose">Dynamic (Intimate)</div>
                        <div className="ws-inspector-card">{charDetail.intimate_dynamic}</div>
                      </div>
                    )}
                    {charDetail.what_lala_feels && (
                      <div className="ws-inspector-field">
                        <div className="ws-inspector-field-label ws-inspector-field-label-rose">What Lala Feels</div>
                        <div className="ws-inspector-card">{charDetail.what_lala_feels}</div>
                      </div>
                    )}
                    <button className="ws-btn ws-btn-rose ws-btn-full" style={{ marginTop: 8 }}
                      onClick={() => openSceneForChar(charDetail.id)}>
                      ♡ Write Intimate Scene
                    </button>
                  </div>
                )}
                {(charDetail.arc_role || charDetail.exit_reason) && (
                  <div className="ws-inspector-section">
                    <div className="ws-inspector-field-label ws-inspector-field-label-muted">Arc</div>
                    {charDetail.arc_role && (
                      <div className="ws-inspector-field">
                        <div className="ws-inspector-field-label ws-inspector-field-label-gold">Role in Lala's Arc</div>
                        <div className="ws-inspector-card">{charDetail.arc_role}</div>
                      </div>
                    )}
                    {charDetail.exit_reason && (
                      <div className="ws-inspector-field">
                        <div className="ws-inspector-field-label ws-inspector-field-label-muted">Exit</div>
                        <div className="ws-inspector-card">{charDetail.exit_reason}</div>
                      </div>
                    )}
                  </div>
                )}
                {charDetail.registry_character_id && (
                  <button className="ws-btn ws-btn-outline ws-btn-full"
                    onClick={() => navigate(`/character-registry?highlight=${charDetail.registry_character_id}`)}>
                    📋 View in Character Registry
                  </button>
                )}
              </>
            )}

            {/* Scene inspector */}
            {tab === 'scenes' && sceneDetail && (
              <>
                {continuations.length > 0 && (
                  <div className="ws-inspector-section">
                    <div className="ws-inspector-field-label ws-inspector-field-label-lavender">Morning After</div>
                    {continuations.map(cont => (
                      <div key={cont.id} className="ws-continuation">
                        <div className="ws-continuation-meta">
                          {cont.continuation_type?.replace(/_/g, ' ')} · {cont.status}
                        </div>
                        <div className="ws-continuation-text">
                          {cont.text?.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
                        </div>
                        {cont.status === 'draft' && (
                          <button className="ws-btn ws-btn-green" style={{ marginTop: 8 }}
                            onClick={() => approveContinuation(cont.id)}>
                            Approve Continuation
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sceneDetail.status === 'draft' && (
                    <>
                      <button className="ws-btn ws-btn-green ws-btn-full" disabled={approving}
                        onClick={() => approveScene(sceneDetail.id)}>
                        {approving ? 'Approving…' : '✓ Approve & Log'}
                      </button>
                      <button className="ws-btn ws-btn-danger ws-btn-full"
                        onClick={() => deleteScene(sceneDetail.id)}>
                        Delete Draft
                      </button>
                    </>
                  )}
                  {sceneDetail.status === 'approved' && !sceneDetail.continuation_generated && (
                    <button className="ws-btn ws-btn-lavender ws-btn-full"
                      onClick={() => requestContinuation(sceneDetail.id)}>
                      Generate Morning After
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Inspector empty */}
            {!((tab === 'characters' && charDetail) || (tab === 'scenes' && sceneDetail)) && (
              <div className="ws-empty ws-empty-small">
                <div className="ws-empty-icon">
                  {tab === 'characters' ? '✦' : tab === 'scenes' ? '♡' : '◇'}
                </div>
                <div className="ws-empty-text">
                  {tab === 'characters' ? 'Select a character' : tab === 'scenes' ? 'Select a scene' : 'Select a trigger'}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
         PREVIEW MODAL (Generate → Preview → Select → Confirm)
      ═══════════════════════════════════════════════════════════════════ */}
      {showPreview && (
        <div className="ws-modal-overlay" onClick={() => !confirming && setShowPreview(false)}>
          <div className="ws-modal ws-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="ws-modal-title">Preview Generated Characters</div>
            <div className="ws-modal-sub">
              {previewChars.length} characters generated. Deselect any you don&apos;t want, then confirm.
            </div>
            {previewNotes && (
              <div className="ws-modal-notes">{previewNotes}</div>
            )}
            <div className="ws-modal-grid">
              {previewChars.map((c, i) => (
                <PreviewCard
                  key={i} char={c}
                  selected={previewSelected.has(i)}
                  onToggle={() => togglePreview(i)}
                />
              ))}
            </div>
            <div className="ws-modal-footer">
              <div className="ws-modal-footer-info">
                {previewSelected.size} of {previewChars.length} selected
              </div>
              <div className="ws-modal-footer-actions">
                <button className="ws-btn ws-btn-ghost" onClick={() => setShowPreview(false)}>Cancel</button>
                <button className="ws-btn ws-btn-gold" disabled={confirming || previewSelected.size === 0}
                  onClick={confirmPreview}>
                  {confirming ? 'Committing…' : `Confirm ${previewSelected.size} Characters`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
         SCENE GENERATION MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {showSceneModal && (
        <div className="ws-modal-overlay" onClick={() => !generatingScene && setShowSceneModal(false)}>
          <div className="ws-modal" onClick={e => e.stopPropagation()}>
            <div className="ws-modal-title">Write Intimate Scene</div>
            <div className="ws-modal-sub">Generate a scene between two characters</div>

            <div className="ws-form-grid">
              <div className="ws-form-row">
                <div className="ws-form-label">Character A</div>
                <select className="ws-select" value={sceneForm.character_a_id}
                  onChange={e => setSceneForm(f => ({ ...f, character_a_id: e.target.value }))}>
                  <option value="">Select…</option>
                  {characters.filter(c => c.intimate_eligible).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="ws-form-row">
                <div className="ws-form-label">Character B (optional)</div>
                <select className="ws-select" value={sceneForm.character_b_id}
                  onChange={e => setSceneForm(f => ({ ...f, character_b_id: e.target.value }))}>
                  <option value="">Unknown / first encounter</option>
                  {characters.filter(c => c.id !== sceneForm.character_a_id).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ws-form-row">
              <div className="ws-form-label">Scene Type</div>
              <div className="ws-filter-row" style={{ marginBottom: 0 }}>
                {['first_encounter', 'hook_up', 'recurring', 'one_night_stand', 'charged_moment'].map(t => (
                  <button key={t}
                    className={`ws-filter-pill ${sceneForm.scene_type === t ? 'ws-filter-pill-active' : ''}`}
                    onClick={() => setSceneForm(f => ({ ...f, scene_type: t }))}>
                    {t.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="ws-form-row">
              <div className="ws-form-label">Location</div>
              <input className="ws-input" placeholder="e.g. her apartment, a hotel in Paris…"
                value={sceneForm.location}
                onChange={e => setSceneForm(f => ({ ...f, location: e.target.value }))} />
            </div>

            <div className="ws-form-row">
              <div className="ws-form-label">Context</div>
              <textarea className="ws-textarea" placeholder="What led to this moment…"
                value={sceneForm.world_context}
                onChange={e => setSceneForm(f => ({ ...f, world_context: e.target.value }))} />
            </div>

            <div className="ws-form-row">
              <div className="ws-form-label">Career Stage</div>
              <div className="ws-filter-row" style={{ marginBottom: 0 }}>
                {['early_career', 'rising', 'peak', 'established'].map(s => (
                  <button key={s}
                    className={`ws-filter-pill ${sceneForm.career_stage === s ? 'ws-filter-pill-active' : ''}`}
                    onClick={() => setSceneForm(f => ({ ...f, career_stage: s }))}>
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="ws-form-footer">
              <button className="ws-btn ws-btn-ghost" onClick={() => setShowSceneModal(false)}>Cancel</button>
              <button className="ws-btn ws-btn-rose"
                disabled={generatingScene || !sceneForm.character_a_id}
                onClick={generateScene}>
                {generatingScene ? 'Writing…' : '♡ Generate Scene'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`ws-toast ${toast.type === 'error' ? 'ws-toast-error' : 'ws-toast-success'}`}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}
    </div>
  );
}
