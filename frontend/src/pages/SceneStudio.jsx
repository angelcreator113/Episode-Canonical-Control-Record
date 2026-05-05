/**
 * SceneStudio.jsx — Intimate Book Scene Studio (standalone page)
 *
 * Extracted from WorldStudio.jsx to run as its own route at /scene-studio.
 * Features:
 *  - Tension scanner (scans all active relationships for scene triggers)
 *  - Scene generator with type/location picker
 *  - Full scene reader with 3-beat display (approach/scene/aftermath)
 *  - Approve → write to StoryTeller
 *  - Scene history list
 *
 * Styling: WorldStudio.css (shares the ws4-* class namespace)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../services/api';
import './WorldStudio.css';

const API = '/api/v1';

// ─── Track 6 CP8 module-scope helpers (Pattern F prophylactic — Api suffix) ───
// 6 helpers covering 6 fetch sites on /world/* (characters listing, scenes
// listing with optional ?status=, tension-check, scene-generate, approve,
// delete). File-local per Track 6 convention.
export const listCharactersApi = () => apiClient.get(`${API}/world/characters`);
export const listScenesApi = (status) =>
  apiClient.get(status && status !== 'all' ? `${API}/world/scenes?status=${status}` : `${API}/world/scenes`);
export const getTensionCheckApi = () => apiClient.get(`${API}/world/tension-check`);
export const generateSceneApi = (payload) =>
  apiClient.post(`${API}/world/scenes/generate`, payload);
export const approveSceneApi = (sceneId) =>
  apiClient.post(`${API}/world/scenes/${sceneId}/approve`);
export const deleteSceneApi = (sceneId) =>
  apiClient.delete(`${API}/world/scenes/${sceneId}`);

/* ── Shared sub-components ─────────────────────────────────────────── */
function Badge({ variant = 'default', children }) {
  return <span className={`ws4-badge ws4-badge-${variant}`}>{children}</span>;
}

function SectionLabel({ children, color = '' }) {
  return <div className={`ws4-section-label ${color}`}>{children}</div>;
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════ */
export default function SceneStudio() {
  const navigate = useNavigate();
  const location = useLocation();

  /* ── Characters (for dropdowns) ─────────────────────────────────── */
  const [characters, setCharacters] = useState([]);

  /* ── Scenes ─────────────────────────────────────────────────────── */
  const [scenes,        setScenes]        = useState([]);
  const [tensionPairs,  setTensionPairs]  = useState([]);
  const [sceneGen,      setSceneGen]      = useState({ loading: false, charA: '', charB: '', sceneType: 'hook_up', location: '' });
  const [activeScene,   setActiveScene]   = useState(null);
  const [filterStatus,  setFilterStatus]  = useState('all');

  /* ── Toast ──────────────────────────────────────────────────────── */
  const [toast, setToast] = useState(null);
  const flash = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  /* ── Loaders ────────────────────────────────────────────────────── */
  const loadCharacters = useCallback(async () => {
    try {
      const r = await listCharactersApi();
      setCharacters(r.data?.characters || []);
    } catch { setCharacters([]); }
  }, []);

  const loadScenes = useCallback(async () => {
    try {
      const r = await listScenesApi(filterStatus);
      setScenes(r.data?.scenes || []);
    } catch { setScenes([]); }
  }, [filterStatus]);

  const loadTensionPairs = useCallback(async () => {
    try {
      const r = await getTensionCheckApi();
      const pairs = r.data?.pairs || [];
      setTensionPairs(pairs);
      flash(`Found ${pairs.length} tension triggers`);
    } catch { setTensionPairs([]); }
  }, [flash]);

  useEffect(() => {
    loadCharacters();
    loadScenes();

    // Auto-populate from StoryEngine eligibility check
    if (location.state?.autoPopulate) {
      const ap = location.state.autoPopulate;
      setSceneGen({
        loading: false,
        charA: ap.charA.id,
        charB: ap.charB?.id || '',
        sceneType: ap.scene_type,
        location: ap.location || '',
      });
      // Clear navigation state so refresh doesn't re-trigger
      window.history.replaceState({}, document.title);
    }
  }, []);
  useEffect(() => { loadScenes(); }, [filterStatus]);

  /* ── Scene actions ──────────────────────────────────────────────── */
  const generateScene = async () => {
    if (!sceneGen.charA) { flash('Select Character A', 'error'); return; }
    setSceneGen(p => ({ ...p, loading: true }));
    try {
      const r = await generateSceneApi({
        character_a_id: sceneGen.charA,
        character_b_id: sceneGen.charB || undefined,
        scene_type: sceneGen.sceneType,
        location: sceneGen.location || undefined,
      });
      const d = r.data;
      if (d.scene) { setActiveScene(d.scene); flash('Scene generated'); loadScenes(); }
      else flash(d.error || 'Scene generation failed', 'error');
    } catch (e) { flash(e.response?.data?.error || e.message, 'error'); }
    finally { setSceneGen(p => ({ ...p, loading: false })); }
  };

  const approveScene = async (sceneId) => {
    try {
      const r = await approveSceneApi(sceneId);
      const d = r.data;
      if (d.scene) { flash('Scene approved & written to StoryTeller'); setActiveScene(d.scene); loadScenes(); }
      else flash(d.error || 'Approve failed', 'error');
    } catch (e) { flash(e.response?.data?.error || e.message, 'error'); }
  };

  const deleteScene = async (sceneId) => {
    if (!window.confirm('Delete this scene draft?')) return;
    await deleteSceneApi(sceneId);
    flash('Scene deleted'); setActiveScene(null); loadScenes();
  };

  const eligibleChars = characters.filter(c => c.status === 'active' && c.intimate_eligible);

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="ws4-page">

      {/* Toast */}
      {toast && <div className={`ws4-toast ws4-toast-${toast.type}`}>{toast.msg}</div>}

      {/* Header */}
      <div className="ws4-page-header">
        <div className="ws4-header-row">
          <div className="ws4-header-title-block">
            <div className="ws4-breadcrumb">
              <span className="ws4-breadcrumb-link" onClick={() => navigate('/')}>Home</span>
              <span className="ws4-breadcrumb-sep">/</span>
              <span className="ws4-breadcrumb-link" onClick={() => navigate('/world-studio')}>World Studio</span>
              <span className="ws4-breadcrumb-sep">/</span>
              <span className="ws4-breadcrumb-current">Book Scene Studio</span>
            </div>
            <h1 className="ws4-page-title">Book Scene Studio</h1>
            <p className="ws4-page-subtitle">Generate, read, and approve intimate scenes between characters</p>
          </div>
        </div>
      </div>

      <div className="ws4-content" style={{ display: 'flex', gap: 20, padding: '0 20px 20px' }}>

        {/* ── LEFT: Scene list ─────────────────────────────────────── */}
        <div style={{ width: 320, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <SectionLabel>Scene Library</SectionLabel>
            <select className="ws4-select" style={{ width: 'auto', fontSize: 12 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="draft">Drafts</option>
              <option value="approved">Approved</option>
            </select>
          </div>

          {scenes.length === 0 ? (
            <div className="ws4-tab-empty">No scenes yet. Generate one below.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
              {scenes.map(s => (
                <div
                  key={s.id}
                  className={`ws4-scene-card ${activeScene?.id === s.id ? 'ws4-scene-card-active' : ''}`}
                  onClick={() => setActiveScene(s)}
                >
                  <div className="ws4-scene-card-top">
                    <Badge variant="default">{s.scene_type?.replace(/_/g, ' ')}</Badge>
                    <Badge variant="intimate">{s.intensity}</Badge>
                    <Badge variant={s.status === 'approved' ? 'primary' : 'draft'}>{s.status}</Badge>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13, margin: '4px 0 2px' }}>
                    {s.character_a_name}{s.character_b_name ? ` & ${s.character_b_name}` : ''}
                  </div>
                  <div className="ws4-scene-card-preview">{(s.approach_text || s.scene_text || '').substring(0, 100)}…</div>
                  <div className="ws4-scene-card-date">{new Date(s.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Reader + Generate ────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Tension scanner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <button className="ws4-btn ws4-btn-outline" onClick={loadTensionPairs}>Scan Tension</button>
            <span style={{ fontSize: 12, color: '#999' }}>{tensionPairs.length} pair(s) found</span>
          </div>

          {tensionPairs.length > 0 && (
            <div className="ws4-tension-grid" style={{ marginBottom: 20 }}>
              {tensionPairs.map((p, i) => (
                <div key={i} className="ws4-tension-card">
                  <div className="ws4-tension-names">{p.character_a_name} ↔ {p.character_b_name}</div>
                  <div className="ws4-tension-badges">
                    <Badge variant="intimate">{p.tension_state}</Badge>
                    <Badge variant="default">{p.relationship_type}</Badge>
                  </div>
                  {p.situation && <div className="ws4-tension-situation">{p.situation}</div>}
                  <button className="ws4-btn ws4-btn-primary ws4-btn-sm" onClick={() => {
                    setSceneGen(g => ({ ...g, charA: p.character_a_id, charB: p.character_b_id }));
                  }}>Use This Pair</button>
                </div>
              ))}
            </div>
          )}

          {/* Scene reader */}
          {activeScene ? (
            <div className="ws4-scene-reader">
              <div className="ws4-scene-reader-header">
                <h3>{activeScene.character_a_name} {activeScene.character_b_name ? `& ${activeScene.character_b_name}` : ''}</h3>
                <div className="ws4-scene-meta">
                  <Badge variant="default">{activeScene.scene_type?.replace(/_/g, ' ')}</Badge>
                  <Badge variant="intimate">{activeScene.intensity}</Badge>
                  <Badge variant={activeScene.status === 'approved' ? 'primary' : 'draft'}>{activeScene.status}</Badge>
                </div>
              </div>

              {activeScene.approach_text && (
                <div className="ws4-scene-beat">
                  <div className="ws4-scene-beat-label">The Approach</div>
                  <div className="ws4-scene-beat-text">{activeScene.approach_text}</div>
                </div>
              )}
              {activeScene.scene_text && (
                <div className="ws4-scene-beat ws4-scene-beat-main">
                  <div className="ws4-scene-beat-label">The Scene</div>
                  <div className="ws4-scene-beat-text">{activeScene.scene_text}</div>
                </div>
              )}
              {activeScene.aftermath_text && (
                <div className="ws4-scene-beat">
                  <div className="ws4-scene-beat-label">The Aftermath</div>
                  <div className="ws4-scene-beat-text">{activeScene.aftermath_text}</div>
                </div>
              )}

              {activeScene.relationship_shift && (
                <div className="ws4-scene-shift">
                  <strong>What shifted:</strong> {activeScene.relationship_shift}
                </div>
              )}

              <div className="ws4-scene-actions">
                {activeScene.status === 'draft' && (
                  <>
                    <button className="ws4-btn ws4-btn-primary ws4-btn-sm" onClick={() => approveScene(activeScene.id)}>
                      Approve & Write to StoryTeller
                    </button>
                    <button className="ws4-btn ws4-btn-danger ws4-btn-sm" onClick={() => deleteScene(activeScene.id)}>Delete</button>
                  </>
                )}
                {activeScene.status === 'approved' && (
                  <span className="ws4-scene-approved-note">Written to StoryTeller</span>
                )}
              </div>
            </div>
          ) : (
            <div className="ws4-tab-empty" style={{ marginBottom: 20 }}>
              Select a scene from the list, or generate a new one below.
            </div>
          )}

          {/* Generator */}
          <div className="ws4-scene-generate-box">
            <SectionLabel>Generate New Scene</SectionLabel>
            <div className="ws4-scene-gen-form">
              <select className="ws4-select" value={sceneGen.charA} onChange={e => setSceneGen(p => ({ ...p, charA: e.target.value }))}>
                <option value="">Character A…</option>
                {eligibleChars.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select className="ws4-select" value={sceneGen.charB} onChange={e => setSceneGen(p => ({ ...p, charB: e.target.value }))}>
                <option value="">Character B (optional)…</option>
                {eligibleChars.filter(c => c.id !== sceneGen.charA).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select className="ws4-select" value={sceneGen.sceneType} onChange={e => setSceneGen(p => ({ ...p, sceneType: e.target.value }))}>
                {['hook_up','first_encounter','charged_moment','recurring','one_night_stand'].map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <input className="ws4-input" placeholder="Location (optional)" value={sceneGen.location} onChange={e => setSceneGen(p => ({ ...p, location: e.target.value }))} />
              <button className="ws4-btn ws4-btn-primary" onClick={generateScene} disabled={sceneGen.loading}>
                {sceneGen.loading ? '⏳ Generating…' : '🔥 Generate Scene'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
