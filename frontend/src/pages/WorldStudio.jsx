import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './WorldStudio.css';

const API = '/api/v1';

/* ── Type display helpers ───────────────────────────────────────────── */
const TYPES = {
  love_interest: 'Love Interest',
  industry_peer: 'Industry Peer',
  mentor: 'Mentor',
  antagonist: 'Antagonist',
  rival: 'Rival',
  collaborator: 'Collaborator',
  one_night_stand: 'One Night Stand',
  recurring: 'Recurring',
};

const tensionClass = t => {
  if (!t) return 'stable';
  const k = t.toLowerCase().replace(/\s+/g, '_');
  if (k.includes('friction')) return 'friction';
  if (k.includes('unresolved')) return 'unresolved';
  if (k.includes('broken')) return 'broken';
  return 'stable';
};

/* ── Small components ───────────────────────────────────────────────── */
function TypeBadge({ type, small }) {
  const cls = type?.toLowerCase().replace(/\s+/g, '_') || 'mentor';
  return (
    <span className={`ws-type-badge ${cls}${small ? ' small' : ''}`}>
      {TYPES[type] || type}
    </span>
  );
}

function TensionDot({ tension }) {
  const cls = tensionClass(tension);
  return (
    <span className="ws-tension-dot-group">
      <span className={`ws-tension-dot ${cls}`}>●</span>
      <span className={`ws-tension-label ${cls}`}>{tension || 'Stable'}</span>
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
export default function WorldStudio() {
  const navigate = useNavigate();
  /* ── State ─────────────────────────────────────────────────────────── */
  const [tab, setTab] = useState('characters');

  // Characters
  const [characters, setCharacters] = useState([]);
  const [selectedChar, setSelectedChar] = useState(null);
  const [charDetail, setCharDetail] = useState(null);
  const [charFilter, setCharFilter] = useState('all');

  // Scenes
  const [scenes, setScenes] = useState([]);
  const [selectedScene, setSelectedScene] = useState(null);
  const [sceneDetail, setSceneDetail] = useState(null);
  const [continuations, setContinuations] = useState([]);

  // Triggers
  const [triggered, setTriggered] = useState([]);
  const [oneNightCandidates, setOneNightCandidates] = useState([]);

  // UI state
  const [generating, setGenerating] = useState(false);
  const [generatingScene, setGeneratingScene] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showEcoModal, setShowEcoModal] = useState(false);
  const [showSceneModal, setShowSceneModal] = useState(false);
  const [toast, setToast] = useState(null);

  // Ecosystem form
  const [ecoForm, setEcoForm] = useState({
    city: '', industry: '', career_stage: 'early_career', character_count: 8,
  });

  // Scene form
  const [sceneForm, setSceneForm] = useState({
    character_a_id: '', character_b_id: '', scene_type: 'hook_up',
    location: '', world_context: '', career_stage: 'early_career',
  });

  /* ── Toast helper ──────────────────────────────────────────────────── */
  const flash = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  /* ── Data loaders ──────────────────────────────────────────────────── */
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

  useEffect(() => {
    loadCharacters();
    loadScenes();
    loadTriggers();
  }, [loadCharacters, loadScenes, loadTriggers]);

  useEffect(() => {
    if (selectedChar) loadCharDetail(selectedChar);
  }, [selectedChar, loadCharDetail]);

  useEffect(() => {
    if (selectedScene) loadSceneDetail(selectedScene);
  }, [selectedScene, loadSceneDetail]);

  /* ── Actions ───────────────────────────────────────────────────────── */
  const generateEcosystem = async () => {
    setGenerating(true);
    try {
      const r = await fetch(`${API}/world/generate-ecosystem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          world_context: {
            city: ecoForm.city || 'a major city',
            industry: ecoForm.industry || 'content creation and fashion',
            career_stage: ecoForm.career_stage,
          },
          character_count: ecoForm.character_count,
        }),
      });
      const d = await r.json();
      if (d.characters) {
        flash(`${d.count} characters generated`);
        setShowEcoModal(false);
        loadCharacters();
      } else {
        flash(d.error || 'Generation failed', 'error');
      }
    } catch (e) {
      flash(e.message, 'error');
    } finally { setGenerating(false); }
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
    } catch (e) {
      flash(e.message, 'error');
    } finally { setGeneratingScene(false); }
  };

  const approveScene = async (sceneId) => {
    setApproving(true);
    try {
      const r = await fetch(`${API}/world/scenes/${sceneId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const d = await r.json();
      if (d.approved) {
        flash('Scene approved → StoryTeller + continuation generating');
        loadSceneDetail(sceneId);
        loadScenes();
        loadTriggers();
      } else {
        flash(d.error || 'Approve failed', 'error');
      }
    } catch (e) { flash(e.message, 'error'); }
    finally { setApproving(false); }
  };

  const deleteScene = async (sceneId) => {
    try {
      await fetch(`${API}/world/scenes/${sceneId}`, { method: 'DELETE' });
      flash('Draft deleted');
      setSelectedScene(null);
      setSceneDetail(null);
      loadScenes();
    } catch (e) { flash(e.message, 'error'); }
  };

  const requestContinuation = async (sceneId) => {
    try {
      await fetch(`${API}/world/scenes/${sceneId}/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ continuation_type: 'morning_after' }),
      });
      flash('Continuation generating…');
      setTimeout(() => loadSceneDetail(sceneId), 6000);
    } catch (e) { flash(e.message, 'error'); }
  };

  const approveContinuation = async (contId) => {
    try {
      await fetch(`${API}/world/continuations/${contId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      flash('Continuation approved');
      if (selectedScene) loadSceneDetail(selectedScene);
    } catch (e) { flash(e.message, 'error'); }
  };

  /* ── Filtered characters ───────────────────────────────────────────── */
  const filtered = charFilter === 'all'
    ? characters
    : characters.filter(c => c.character_type === charFilter);

  const uniqueTypes = [...new Set(characters.map(c => c.character_type))];

  /* ── Open scene modal pre-filled ───────────────────────────────────── */
  const openSceneForChar = (charId) => {
    setSceneForm(f => ({ ...f, character_a_id: charId }));
    setShowSceneModal(true);
  };

  const openSceneFromTrigger = (char) => {
    setSceneForm(f => ({
      ...f,
      character_a_id: char.id,
      scene_type: char.character_type === 'one_night_stand' ? 'one_night_stand' : 'hook_up',
    }));
    setShowSceneModal(true);
  };

  /* ══════════════════════════════════════════════════════════════════════
     R E N D E R
  ══════════════════════════════════════════════════════════════════════ */

  return (
    <div className="ws-page">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="ws-header">
        <button className="ws-btn-back" onClick={() => navigate('/universe')}>
          ← Universe
        </button>
        <div className="ws-header-title">World Studio</div>

        <div className="ws-tab-indicator">
          {['characters', 'scenes', 'triggers'].map(t => (
            <button
              key={t}
              className={`ws-tab-step${tab === t ? ' ws-tab-active' : ''}`}
              onClick={() => setTab(t)}
            >
              <span className="ws-tab-step-icon">
                {t === 'characters' ? '✦' : t === 'scenes' ? '♡' : '◇'}
              </span>
              {t === 'characters' ? `Characters (${characters.length})`
                : t === 'scenes' ? `Scenes (${scenes.length})`
                : `Triggers (${triggered.length + oneNightCandidates.length})`}
            </button>
          ))}
        </div>

        <div className="ws-header-controls">
          <button className="ws-btn ws-btn-scene-cta" onClick={() => setShowSceneModal(true)}>
            ♡ Write Scene
          </button>
          <button className="ws-btn ws-btn-generate-cta" onClick={() => setShowEcoModal(true)}>
            ✦ Generate Ecosystem
          </button>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="ws-body">

        {/* ── Left sidebar ───────────────────────────────────────────── */}
        <div className="ws-left">
          <div className="ws-panel-title">
            {tab === 'characters' ? 'Characters' : tab === 'scenes' ? 'Scenes' : 'Triggers'}
          </div>

          {/* Characters tab sidebar */}
          {tab === 'characters' && (
            <>
              <div className="ws-filter-row">
                <button
                  className={`ws-filter-pill${charFilter === 'all' ? ' active' : ''}`}
                  onClick={() => setCharFilter('all')}
                >All</button>
                {uniqueTypes.map(t => (
                  <button
                    key={t}
                    className={`ws-filter-pill${charFilter === t ? ' active' : ''}`}
                    onClick={() => setCharFilter(t)}
                  >{TYPES[t] || t}</button>
                ))}
              </div>

              {filtered.length === 0 ? (
                <div className="ws-empty-state">
                  <div className="ws-empty-icon">✦</div>
                  <div>No characters yet</div>
                  <div style={{ marginTop: 4 }}>Generate an ecosystem to begin</div>
                </div>
              ) : filtered.map(c => (
                <div
                  key={c.id}
                  className={`ws-char-card${selectedChar === c.id ? ' selected' : ''}`}
                  onClick={() => setSelectedChar(c.id)}
                >
                  <div className="ws-char-card-top">
                    <span className="ws-char-card-name">{c.name}</span>
                    <div className="ws-char-card-meta">
                      {c.intimate_eligible && <span className="ws-char-intimate-dot">♡</span>}
                      <span className={`ws-char-status ${c.status}`}>{c.status}</span>
                    </div>
                  </div>
                  <div className="ws-char-card-occ">{c.occupation}</div>
                  <div className="ws-char-card-tags">
                    <TypeBadge type={c.character_type} small />
                    <TensionDot tension={c.current_tension} />
                  </div>
                  {c.signature && (
                    <div className="ws-char-card-sig">"{c.signature}"</div>
                  )}
                  {c.status === 'draft' && (
                    <button
                      className="ws-btn-activate"
                      onClick={(e) => { e.stopPropagation(); activateChar(c.id); }}
                    >Activate</button>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Scenes tab sidebar */}
          {tab === 'scenes' && (
            <>
              {scenes.length === 0 ? (
                <div className="ws-empty-state">
                  <div className="ws-empty-icon">♡</div>
                  <div>No scenes yet</div>
                  <div style={{ marginTop: 4 }}>Generate a scene from a character or trigger</div>
                </div>
              ) : scenes.map(s => (
                <div
                  key={s.id}
                  className={`ws-scene-card${selectedScene === s.id ? ' selected' : ''}`}
                  onClick={() => setSelectedScene(s.id)}
                >
                  <div className="ws-scene-card-names">
                    {s.character_a_name}{s.character_b_name ? ` & ${s.character_b_name}` : ''}
                  </div>
                  <div className="ws-scene-card-meta">
                    {TYPES[s.scene_type] || s.scene_type} · {s.word_count || '—'} words
                  </div>
                  <div className="ws-scene-card-tags">
                    <span className={`ws-intensity ${s.intensity}`}>{s.intensity}</span>
                    <span style={{ fontSize: 11, color: s.status === 'approved' ? '#0d9668' : '#b0922e' }}>
                      {s.status}
                    </span>
                  </div>
                  {s.relationship_shift && (
                    <div className="ws-scene-card-shift">"{s.relationship_shift}"</div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Triggers tab sidebar */}
          {tab === 'triggers' && (
            <>
              {triggered.length > 0 && (
                <>
                  <div className="ws-sidebar-section-label">Tension Triggers</div>
                  {triggered.map((t, i) => (
                    <div key={i} className="ws-trigger-card" onClick={() => openSceneFromTrigger(t)}>
                      <div className="ws-trigger-name">{t.name}</div>
                      <div className="ws-trigger-occ">{t.occupation}</div>
                      <div className="ws-trigger-tension">
                        <TensionDot tension={t.tension_state} />
                      </div>
                      {t.situation && (
                        <div className="ws-trigger-situation">{t.situation}</div>
                      )}
                      <button className="ws-trigger-btn">Write Scene →</button>
                    </div>
                  ))}
                </>
              )}
              {oneNightCandidates.length > 0 && (
                <>
                  <div className="ws-sidebar-section-label" style={{ marginTop: triggered.length > 0 ? 18 : 0 }}>
                    One Night Candidates
                  </div>
                  {oneNightCandidates.map(c => (
                    <div key={c.id} className="ws-trigger-card" onClick={() => openSceneFromTrigger(c)}>
                      <div className="ws-trigger-name">{c.name}</div>
                      <div className="ws-trigger-occ">{c.occupation}</div>
                      <button className="ws-trigger-btn">Write Scene →</button>
                    </div>
                  ))}
                </>
              )}
              {triggered.length === 0 && oneNightCandidates.length === 0 && (
                <div className="ws-empty-state">
                  <div className="ws-empty-icon">◇</div>
                  <div>No triggers active</div>
                  <div style={{ marginTop: 4 }}>Activate characters and build tension first</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right detail panel ─────────────────────────────────────── */}
        <div className="ws-right">

          {/* Character detail */}
          {tab === 'characters' && charDetail && (
            <div className="ws-detail-inner" key={charDetail.id}>
              <div className="ws-char-detail-badges">
                <TypeBadge type={charDetail.character_type} />
                {charDetail.intimate_eligible && <span className="ws-badge-intimate">♡ Intimate Eligible</span>}
                {charDetail.tension_type && <span className="ws-badge-tension-type">{charDetail.tension_type} tension</span>}
              </div>
              <h2 className="ws-char-detail-name">{charDetail.name}</h2>
              <div className="ws-char-detail-info">
                {charDetail.age_range} · {charDetail.occupation} · {charDetail.world_location}
              </div>
              <TensionDot tension={charDetail.current_tension} />

              {/* Aesthetic */}
              {charDetail.aesthetic && (
                <div style={{ marginTop: 20 }}>
                  <div className="ws-section-label gold">Aesthetic</div>
                  <div className="ws-aesthetic-text">{charDetail.aesthetic}</div>
                </div>
              )}

              {/* Signature */}
              {charDetail.signature && (
                <blockquote className="ws-signature-quote">
                  {charDetail.signature}
                </blockquote>
              )}

              {/* Wants */}
              <div className="ws-section-label">What They Want</div>
              <div className="ws-want-grid">
                <div className="ws-want-card">
                  <div className="ws-section-label" style={{ marginBottom: 4 }}>Surface</div>
                  <div className="ws-want-card-value">{charDetail.surface_want}</div>
                </div>
                <div className="ws-want-card">
                  <div className="ws-section-label" style={{ marginBottom: 4 }}>Real</div>
                  <div className="ws-want-card-value">{charDetail.real_want}</div>
                </div>
              </div>

              {/* From Lala */}
              {charDetail.what_they_want_from_lala && (
                <>
                  <div className="ws-section-label">What They Want From Lala</div>
                  <div className="ws-dynamic-card">
                    <div className="ws-dynamic-text">{charDetail.what_they_want_from_lala}</div>
                  </div>
                </>
              )}

              {/* How They Meet */}
              {charDetail.how_they_meet && (
                <>
                  <div className="ws-section-label teal">How They Meet</div>
                  <div className="ws-dynamic-card">
                    <div className="ws-dynamic-text">{charDetail.how_they_meet}</div>
                  </div>
                </>
              )}

              {/* Dynamic */}
              {charDetail.dynamic && (
                <>
                  <div className="ws-section-label lavender">Dynamic</div>
                  <div className="ws-dynamic-card">
                    <div className="ws-dynamic-text">{charDetail.dynamic}</div>
                  </div>
                </>
              )}

              {/* Intimate Profile */}
              {charDetail.intimate_eligible && (
                <>
                  <div className="ws-section-label rose">Intimate Profile</div>
                  <div className="ws-intimate-profile">
                    {charDetail.intimate_style && (
                      <div className="ws-intimate-field">
                        <div className="ws-intimate-field-label">Intimate Style</div>
                        <div className="ws-intimate-field-text">{charDetail.intimate_style}</div>
                      </div>
                    )}
                    {charDetail.intimate_dynamic && (
                      <div className="ws-intimate-field">
                        <div className="ws-intimate-field-label">Dynamic</div>
                        <div className="ws-intimate-field-text">{charDetail.intimate_dynamic}</div>
                      </div>
                    )}
                    {charDetail.what_lala_feels && (
                      <div className="ws-intimate-field">
                        <div className="ws-intimate-field-label">What Lala Feels</div>
                        <div className="ws-intimate-field-text">{charDetail.what_lala_feels}</div>
                      </div>
                    )}
                    <button
                      className="ws-btn-write-scene"
                      onClick={() => openSceneForChar(charDetail.id)}
                    >♡ Write Intimate Scene</button>
                  </div>
                </>
              )}

              {/* Arc */}
              <div className="ws-section-label">Arc</div>
              <div className="ws-arc-grid">
                {charDetail.arc_role && (
                  <div className="ws-want-card">
                    <div className="ws-section-label" style={{ marginBottom: 4 }}>Role in Lala's Arc</div>
                    <div className="ws-want-card-value">{charDetail.arc_role}</div>
                  </div>
                )}
                {charDetail.exit_reason && (
                  <div className="ws-want-card">
                    <div className="ws-section-label" style={{ marginBottom: 4 }}>Exit</div>
                    <div className="ws-want-card-value">{charDetail.exit_reason}</div>
                  </div>
                )}
              </div>

              {/* Registry link */}
              {charDetail.registry_character_id && (
                <div style={{ marginTop: 20 }}>
                  <button
                    className="ws-btn-registry-link"
                    onClick={() => navigate(`/character-registry?highlight=${charDetail.registry_character_id}`)}
                  >
                    📋 View in Character Registry
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Scene detail */}
          {tab === 'scenes' && sceneDetail && (
            <div className="ws-detail-inner" key={sceneDetail.id}>
              <div className="ws-scene-header-type">
                {TYPES[sceneDetail.scene_type] || sceneDetail.scene_type}
              </div>
              <h2 className="ws-scene-header-names">
                {sceneDetail.character_a_name}
                {sceneDetail.character_b_name ? ` & ${sceneDetail.character_b_name}` : ''}
              </h2>
              <div className="ws-scene-header-tags">
                <span className={`ws-intensity ${sceneDetail.intensity}`}>{sceneDetail.intensity}</span>
                <span className={`ws-scene-status ${sceneDetail.status}`}>{sceneDetail.status}</span>
                {sceneDetail.location && <span className="ws-scene-location">📍 {sceneDetail.location}</span>}
                <span style={{ fontSize: 11, color: '#8A8278' }}>{sceneDetail.word_count} words</span>
              </div>

              {/* Three beats */}
              {sceneDetail.approach_text && (
                <div className="ws-beat">
                  <div className="ws-section-label gold">The Approach</div>
                  <div className="ws-beat-text">
                    {sceneDetail.approach_text.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                </div>
              )}
              {sceneDetail.scene_text && (
                <div className="ws-beat">
                  <div className="ws-section-label rose">The Scene</div>
                  <div className="ws-beat-text">
                    {sceneDetail.scene_text.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                </div>
              )}
              {sceneDetail.aftermath_text && (
                <div className="ws-beat">
                  <div className="ws-section-label lavender">The Aftermath</div>
                  <div className="ws-beat-text">
                    {sceneDetail.aftermath_text.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                </div>
              )}

              {/* Relationship shift */}
              {sceneDetail.relationship_shift && (
                <blockquote className="ws-shift-quote">
                  {sceneDetail.relationship_shift}
                </blockquote>
              )}

              {/* Continuations */}
              {continuations.length > 0 && (
                <>
                  <div className="ws-section-label lavender">Morning After</div>
                  {continuations.map(cont => (
                    <div key={cont.id} className="ws-continuation">
                      <div className="ws-continuation-label">
                        {cont.continuation_type?.replace(/_/g, ' ')} · {cont.status}
                      </div>
                      <div className="ws-continuation-text">
                        {cont.text?.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
                      </div>
                      {cont.status === 'draft' && (
                        <button
                          className="ws-btn-continuation"
                          onClick={() => approveContinuation(cont.id)}
                        >Approve Continuation</button>
                      )}
                    </div>
                  ))}
                </>
              )}

              {/* Actions */}
              <div className="ws-actions">
                {sceneDetail.status === 'draft' && (
                  <>
                    <button
                      className="ws-btn-approve"
                      disabled={approving}
                      onClick={() => approveScene(sceneDetail.id)}
                    >{approving ? 'Approving…' : '✓ Approve & Log'}</button>
                    <button
                      className="ws-btn-delete"
                      onClick={() => deleteScene(sceneDetail.id)}
                    >Delete Draft</button>
                  </>
                )}
                {sceneDetail.status === 'approved' && !sceneDetail.continuation_generated && (
                  <button
                    className="ws-btn-continuation"
                    onClick={() => requestContinuation(sceneDetail.id)}
                  >Generate Morning After</button>
                )}
              </div>
            </div>
          )}

          {/* Triggers — detail is the same as character detail when a trigger is selected */}
          {tab === 'triggers' && !selectedChar && !selectedScene && (
            <div className="ws-empty-detail">
              <div className="ws-empty-detail-icon">◇</div>
              <div className="ws-empty-detail-text">Select a trigger to preview the character</div>
            </div>
          )}

          {/* Empty states */}
          {tab === 'characters' && !charDetail && (
            <div className="ws-empty-detail">
              <div className="ws-empty-detail-icon">✦</div>
              <div className="ws-empty-detail-text">Select a character to view their world profile</div>
            </div>
          )}
          {tab === 'scenes' && !sceneDetail && (
            <div className="ws-empty-detail">
              <div className="ws-empty-detail-icon">♡</div>
              <div className="ws-empty-detail-text">Select a scene to read</div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
         M O D A L S
      ═══════════════════════════════════════════════════════════════════ */}

      {/* Ecosystem Generation Modal */}
      {showEcoModal && (
        <div className="ws-modal-overlay" onClick={() => !generating && setShowEcoModal(false)}>
          <div className="ws-modal eco" onClick={e => e.stopPropagation()}>
            <div className="ws-modal-title">Generate Character Ecosystem</div>
            <div className="ws-modal-subtitle">Claude builds a full cast of world characters from a single prompt</div>

            <div className="ws-form-field">
              <div className="ws-form-label">City / Setting</div>
              <input
                className="ws-form-input"
                placeholder="e.g. Los Angeles, Paris, a fictional city…"
                value={ecoForm.city}
                onChange={e => setEcoForm(f => ({ ...f, city: e.target.value }))}
              />
            </div>

            <div className="ws-form-field">
              <div className="ws-form-label">Industry</div>
              <input
                className="ws-form-input"
                placeholder="e.g. fashion, music, tech, art…"
                value={ecoForm.industry}
                onChange={e => setEcoForm(f => ({ ...f, industry: e.target.value }))}
              />
            </div>

            <div className="ws-form-field">
              <div className="ws-form-label">Career Stage</div>
              <div className="ws-career-row">
                {['early_career', 'rising', 'peak', 'established'].map(s => (
                  <button
                    key={s}
                    className={`ws-career-btn${ecoForm.career_stage === s ? ' active' : ''}`}
                    onClick={() => setEcoForm(f => ({ ...f, career_stage: s }))}
                  >{s.replace(/_/g, ' ')}</button>
                ))}
              </div>
            </div>

            <div className="ws-form-field">
              <div className="ws-form-label">Characters</div>
              <div className="ws-count-row">
                {[4, 6, 8, 10, 12].map(n => (
                  <button
                    key={n}
                    className={`ws-count-btn${ecoForm.character_count === n ? ' active' : ''}`}
                    onClick={() => setEcoForm(f => ({ ...f, character_count: n }))}
                  >{n}</button>
                ))}
              </div>
            </div>

            <div className="ws-modal-actions">
              <button className="ws-modal-cancel" onClick={() => setShowEcoModal(false)}>Cancel</button>
              <button
                className="ws-btn-generate"
                disabled={generating}
                onClick={generateEcosystem}
              >{generating ? 'Generating…' : `Generate ${ecoForm.character_count} Characters`}</button>
            </div>
          </div>
        </div>
      )}

      {/* Scene Generation Modal */}
      {showSceneModal && (
        <div className="ws-modal-overlay" onClick={() => !generatingScene && setShowSceneModal(false)}>
          <div className="ws-modal scene" onClick={e => e.stopPropagation()}>
            <div className="ws-modal-title">Write Intimate Scene</div>
            <div className="ws-modal-subtitle">Generate a scene between two characters</div>

            <div className="ws-modal-grid">
              <div className="ws-form-field">
                <div className="ws-form-label">Character A</div>
                <select
                  className="ws-form-select"
                  value={sceneForm.character_a_id}
                  onChange={e => setSceneForm(f => ({ ...f, character_a_id: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {characters.filter(c => c.intimate_eligible).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="ws-form-field">
                <div className="ws-form-label">Character B (optional)</div>
                <select
                  className="ws-form-select"
                  value={sceneForm.character_b_id}
                  onChange={e => setSceneForm(f => ({ ...f, character_b_id: e.target.value }))}
                >
                  <option value="">Unknown / first encounter</option>
                  {characters.filter(c => c.id !== sceneForm.character_a_id).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ws-form-field">
              <div className="ws-form-label">Scene Type</div>
              <div className="ws-scene-type-row">
                {['first_encounter', 'hook_up', 'recurring', 'one_night_stand', 'charged_moment'].map(t => (
                  <button
                    key={t}
                    className={`ws-scene-type-btn${sceneForm.scene_type === t ? ' active' : ''}`}
                    onClick={() => setSceneForm(f => ({ ...f, scene_type: t }))}
                  >{t.replace(/_/g, ' ')}</button>
                ))}
              </div>
            </div>

            <div className="ws-form-field">
              <div className="ws-form-label">Location</div>
              <input
                className="ws-form-input"
                placeholder="e.g. her apartment, a hotel in Paris…"
                value={sceneForm.location}
                onChange={e => setSceneForm(f => ({ ...f, location: e.target.value }))}
              />
            </div>

            <div className="ws-form-field">
              <div className="ws-form-label">Context</div>
              <textarea
                className="ws-form-textarea"
                placeholder="What led to this moment…"
                value={sceneForm.world_context}
                onChange={e => setSceneForm(f => ({ ...f, world_context: e.target.value }))}
              />
            </div>

            <div className="ws-form-field">
              <div className="ws-form-label">Career Stage</div>
              <div className="ws-career-row">
                {['early_career', 'rising', 'peak', 'established'].map(s => (
                  <button
                    key={s}
                    className={`ws-career-btn${sceneForm.career_stage === s ? ' active' : ''}`}
                    onClick={() => setSceneForm(f => ({ ...f, career_stage: s }))}
                  >{s.replace(/_/g, ' ')}</button>
                ))}
              </div>
            </div>

            <div className="ws-modal-actions">
              <button className="ws-modal-cancel" onClick={() => setShowSceneModal(false)}>Cancel</button>
              <button
                className="ws-btn-scene"
                disabled={generatingScene || !sceneForm.character_a_id}
                onClick={generateScene}
                style={{ opacity: generatingScene || !sceneForm.character_a_id ? 0.5 : 1 }}
              >{generatingScene ? 'Writing…' : '♡ Generate Scene'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`ws-toast ${toast.type}`}>
          <span>{toast.type === 'success' ? '✓' : '✕'}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
