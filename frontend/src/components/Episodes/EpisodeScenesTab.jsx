import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ChevronDown, ChevronRight, Camera, Plus, Trash2, GripVertical, ExternalLink, Clapperboard, Film } from 'lucide-react';
import './EpisodeScenesTab.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const SCENE_TYPE_COLORS = {
  HOME_BASE: { bg: '#dbeafe', color: '#1d4ed8' },
  CLOSET: { bg: '#fce7f3', color: '#be185d' },
  EVENT_LOCATION: { bg: '#d1fae5', color: '#047857' },
  TRANSITION: { bg: '#fef3c7', color: '#92400e' },
  OTHER: { bg: '#f1f5f9', color: '#475569' },
};

const EpisodeScenesTab = ({ episode, onToast }) => {
  const navigate = useNavigate();
  const episodeId = episode?.id;

  // Scene Sets state
  const [sceneSets, setSceneSets] = useState([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [expandedSetId, setExpandedSetId] = useState(null);

  // Episode Scenes state
  const [scenes, setScenes] = useState([]);
  const [loadingScenes, setLoadingScenes] = useState(false);

  // Picker state
  const [showPicker, setShowPicker] = useState(false);
  const [allSets, setAllSets] = useState([]);
  const [loadingAllSets, setLoadingAllSets] = useState(false);
  const [selectedPickerIds, setSelectedPickerIds] = useState([]);

  // Creating scene from angle
  const [creatingSceneFor, setCreatingSceneFor] = useState(null);

  const toast = useCallback((msg, type = 'info') => {
    if (onToast) onToast(msg, type);
  }, [onToast]);

  // Fetch scene sets linked to this episode
  const fetchSceneSets = useCallback(async () => {
    if (!episodeId) return;
    setLoadingSets(true);
    try {
      const res = await fetch(`${API_BASE}/episodes/${episodeId}/scene-sets`);
      const data = await res.json();
      if (data.success) {
        setSceneSets(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load episode scene sets:', err);
    } finally {
      setLoadingSets(false);
    }
  }, [episodeId]);

  // Fetch episode scenes (compositions)
  const fetchScenes = useCallback(async () => {
    if (!episodeId) return;
    setLoadingScenes(true);
    try {
      const res = await fetch(`${API_BASE}/episodes/${episodeId}/scenes`);
      const data = await res.json();
      if (data.success) {
        setScenes(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load episode scenes:', err);
    } finally {
      setLoadingScenes(false);
    }
  }, [episodeId]);

  useEffect(() => {
    fetchSceneSets();
    fetchScenes();
  }, [fetchSceneSets, fetchScenes]);

  // ---- Scene Set Picker ----
  const openPicker = async () => {
    setShowPicker(true);
    setSelectedPickerIds([]);
    setLoadingAllSets(true);
    try {
      const res = await fetch(`${API_BASE}/scene-sets`);
      const data = await res.json();
      setAllSets(data.data || []);
    } catch (err) {
      console.error('Failed to load all scene sets:', err);
    } finally {
      setLoadingAllSets(false);
    }
  };

  const togglePickerSelection = (id) => {
    setSelectedPickerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const confirmPicker = async () => {
    if (selectedPickerIds.length === 0) return;
    try {
      const res = await fetch(`${API_BASE}/episodes/${episodeId}/scene-sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneSetIds: selectedPickerIds }),
      });
      const data = await res.json();
      if (data.success) {
        toast(`Linked ${selectedPickerIds.length} scene set(s)`, 'success');
        setShowPicker(false);
        fetchSceneSets();
      }
    } catch (err) {
      console.error('Failed to link scene sets:', err);
      toast('Failed to link scene sets', 'error');
    }
  };

  const unlinkSet = async (setId) => {
    try {
      await fetch(`${API_BASE}/episodes/${episodeId}/scene-sets/${setId}`, { method: 'DELETE' });
      setSceneSets((prev) => prev.filter((s) => s.id !== setId));
      toast('Scene set unlinked', 'info');
    } catch (err) {
      console.error('Failed to unlink scene set:', err);
    }
  };

  // ---- Create Scene from Angle ----
  const createSceneFromAngle = async (sceneSetId, angle) => {
    setCreatingSceneFor(angle.id);
    try {
      const res = await fetch(`${API_BASE}/episodes/${episodeId}/scenes/from-angle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneSetId, sceneAngleId: angle.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast('Scene created from angle', 'success');
        fetchScenes();
      } else {
        toast(data.error || 'Failed to create scene', 'error');
      }
    } catch (err) {
      console.error('Failed to create scene from angle:', err);
      toast('Failed to create scene', 'error');
    } finally {
      setCreatingSceneFor(null);
    }
  };

  // ---- Delete Scene ----
  const deleteScene = async (sceneId) => {
    try {
      await fetch(`${API_BASE}/scenes/${sceneId}`, { method: 'DELETE' });
      setScenes((prev) => prev.filter((s) => s.id !== sceneId));
      toast('Scene removed', 'info');
    } catch (err) {
      console.error('Failed to delete scene:', err);
    }
  };

  const linkedSetIds = sceneSets.map((s) => s.id);

  return (
    <div className="est-container">
      {/* ===== SECTION 1: Scene Sets (Locations) ===== */}
      <div className="est-section">
        <div className="est-section-header">
          <div className="est-section-title">
            <MapPin size={18} />
            <h3>Scene Sets (Locations)</h3>
            <span className="est-count">{sceneSets.length}</span>
          </div>
          <button className="est-btn est-btn-primary" onClick={openPicker}>
            <Plus size={14} /> Assign Set
          </button>
        </div>

        {loadingSets ? (
          <div className="est-loading">Loading scene sets...</div>
        ) : sceneSets.length === 0 ? (
          <div className="est-empty">
            <MapPin size={32} className="est-empty-icon" />
            <p>No scene sets assigned to this episode yet.</p>
            <p className="est-empty-hint">Assign scene sets (locations) to start building scenes.</p>
            <button className="est-btn est-btn-primary" onClick={openPicker}>
              <Plus size={14} /> Assign Your First Set
            </button>
          </div>
        ) : (
          <div className="est-sets-grid">
            {sceneSets.map((set) => {
              const isExpanded = expandedSetId === set.id;
              const angles = set.angles || [];
              const coverAngle = angles.find((a) => a.id === set.cover_angle_id) || angles[0];
              const thumbUrl = coverAngle?.still_image_url || coverAngle?.thumbnail_url || set.base_still_url;
              const typeColor = SCENE_TYPE_COLORS[set.scene_type] || SCENE_TYPE_COLORS.OTHER;

              return (
                <div key={set.id} className={`est-set-card ${isExpanded ? 'est-set-expanded' : ''}`}>
                  <div
                    className="est-set-header"
                    onClick={() => setExpandedSetId(isExpanded ? null : set.id)}
                  >
                    <div className="est-set-thumb">
                      {thumbUrl ? (
                        <img src={thumbUrl} alt={set.name} />
                      ) : (
                        <div className="est-set-thumb-empty"><MapPin size={20} /></div>
                      )}
                    </div>
                    <div className="est-set-info">
                      <div className="est-set-name">{set.name}</div>
                      <div className="est-set-meta">
                        <span className="est-type-badge" style={{ background: typeColor.bg, color: typeColor.color }}>
                          {(set.scene_type || 'OTHER').replace(/_/g, ' ')}
                        </span>
                        <span className="est-angle-count">
                          <Camera size={12} /> {angles.length} angle{angles.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="est-set-actions">
                      <button
                        className="est-btn-icon est-btn-danger"
                        onClick={(e) => { e.stopPropagation(); unlinkSet(set.id); }}
                        title="Unlink from episode"
                      >
                        <Trash2 size={14} />
                      </button>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="est-angles-grid">
                      {angles.length === 0 ? (
                        <p className="est-angles-empty">No angles generated yet. Open Scene Sets to add angles.</p>
                      ) : (
                        angles.map((angle) => {
                          const isCreating = creatingSceneFor === angle.id;
                          const imgUrl = angle.still_image_url || angle.thumbnail_url;
                          return (
                            <div key={angle.id} className="est-angle-card">
                              <div className="est-angle-thumb">
                                {imgUrl ? (
                                  <img src={imgUrl} alt={angle.angle_name} />
                                ) : (
                                  <div className="est-angle-thumb-empty"><Camera size={16} /></div>
                                )}
                              </div>
                              <div className="est-angle-info">
                                <span className="est-angle-name">{angle.angle_name}</span>
                                {angle.angle_label && (
                                  <span className="est-angle-label">{angle.angle_label}</span>
                                )}
                              </div>
                              <button
                                className="est-btn est-btn-sm est-btn-accent"
                                onClick={() => createSceneFromAngle(set.id, angle)}
                                disabled={isCreating}
                              >
                                {isCreating ? '...' : 'Use in Episode'}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== SECTION 2: Episode Scenes ===== */}
      <div className="est-section">
        <div className="est-section-header">
          <div className="est-section-title">
            <Clapperboard size={18} />
            <h3>Episode Scenes</h3>
            <span className="est-count">{scenes.length}</span>
          </div>
          <div className="est-section-actions">
            <button
              className="est-btn est-btn-outline"
              onClick={() => navigate(`/episodes/${episodeId}/scene-composer`)}
            >
              <Film size={14} /> Scene Composer
            </button>
            <button
              className="est-btn est-btn-outline"
              onClick={() => navigate(`/studio/timeline?episode_id=${episodeId}`)}
            >
              <ExternalLink size={14} /> Timeline Editor
            </button>
          </div>
        </div>

        {loadingScenes ? (
          <div className="est-loading">Loading scenes...</div>
        ) : scenes.length === 0 ? (
          <div className="est-empty">
            <Clapperboard size={32} className="est-empty-icon" />
            <p>No scenes composed yet.</p>
            <p className="est-empty-hint">
              Assign scene sets above, then click "Use in Episode" on an angle to create a scene.
            </p>
          </div>
        ) : (
          <div className="est-scenes-list">
            {scenes.map((scene, idx) => {
              const bgUrl = scene.background_url || scene.backgroundUrl;
              return (
                <div key={scene.id} className="est-scene-row">
                  <div className="est-scene-num">{idx + 1}</div>
                  <div className="est-scene-thumb">
                    {bgUrl ? (
                      <img src={bgUrl} alt={scene.title} />
                    ) : (
                      <div className="est-scene-thumb-empty"><Clapperboard size={14} /></div>
                    )}
                  </div>
                  <div className="est-scene-info">
                    <div className="est-scene-title">{scene.title || `Scene ${idx + 1}`}</div>
                    <div className="est-scene-meta">
                      {scene.duration_seconds != null && (
                        <span>{Number(scene.duration_seconds).toFixed(1)}s</span>
                      )}
                      {scene.location && <span>{scene.location}</span>}
                      {scene.production_status && (
                        <span className="est-status-badge">{scene.production_status}</span>
                      )}
                    </div>
                  </div>
                  <div className="est-scene-actions">
                    <button
                      className="est-btn est-btn-sm est-btn-outline"
                      onClick={() => navigate(`/studio/scene/${scene.id}`)}
                      title="Open in Scene Studio"
                    >
                      Studio
                    </button>
                    <button
                      className="est-btn-icon est-btn-danger"
                      onClick={() => deleteScene(scene.id)}
                      title="Remove scene"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== SCENE SET PICKER MODAL ===== */}
      {showPicker && (
        <div className="est-modal-overlay" onClick={() => setShowPicker(false)}>
          <div className="est-modal" onClick={(e) => e.stopPropagation()}>
            <div className="est-modal-header">
              <h3>Assign Scene Sets to Episode</h3>
              <button className="est-btn-icon" onClick={() => setShowPicker(false)}>&times;</button>
            </div>
            <div className="est-modal-body">
              {loadingAllSets ? (
                <div className="est-loading">Loading scene sets...</div>
              ) : allSets.length === 0 ? (
                <div className="est-empty">
                  <p>No scene sets found. Create scene sets first in the Scene Sets tab.</p>
                </div>
              ) : (
                <div className="est-picker-grid">
                  {allSets.map((set) => {
                    const isLinked = linkedSetIds.includes(set.id);
                    const isSelected = selectedPickerIds.includes(set.id);
                    const angles = set.angles || [];
                    const thumb = angles[0]?.still_image_url || angles[0]?.thumbnail_url || set.base_still_url;
                    const typeColor = SCENE_TYPE_COLORS[set.scene_type] || SCENE_TYPE_COLORS.OTHER;

                    return (
                      <div
                        key={set.id}
                        className={`est-picker-card ${isLinked ? 'est-picker-linked' : ''} ${isSelected ? 'est-picker-selected' : ''}`}
                        onClick={() => !isLinked && togglePickerSelection(set.id)}
                      >
                        <div className="est-picker-thumb">
                          {thumb ? (
                            <img src={thumb} alt={set.name} />
                          ) : (
                            <div className="est-picker-thumb-empty"><MapPin size={20} /></div>
                          )}
                          {isLinked && <div className="est-picker-linked-badge">Linked</div>}
                          {isSelected && <div className="est-picker-check">&#10003;</div>}
                        </div>
                        <div className="est-picker-info">
                          <div className="est-picker-name">{set.name}</div>
                          <span className="est-type-badge" style={{ background: typeColor.bg, color: typeColor.color }}>
                            {(set.scene_type || 'OTHER').replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="est-modal-footer">
              <button className="est-btn est-btn-outline" onClick={() => setShowPicker(false)}>Cancel</button>
              <button
                className="est-btn est-btn-primary"
                onClick={confirmPicker}
                disabled={selectedPickerIds.length === 0}
              >
                Assign {selectedPickerIds.length > 0 ? `(${selectedPickerIds.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EpisodeScenesTab;
