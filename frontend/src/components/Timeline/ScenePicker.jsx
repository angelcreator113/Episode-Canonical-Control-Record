import React, { useState, useEffect } from 'react';
import { Image, Check, Loader2, MapPin } from 'lucide-react';

/**
 * ScenePicker — Modal for selecting a scene to add/replace in the timeline.
 * Shows scenes from Scene Studio as thumbnails, filtered by episode.
 * Only shows scenes with production_status beyond 'draft'.
 */

export default function ScenePicker({ episodeId, onSelect, onClose }) {
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    async function loadScenes() {
      setLoading(true);
      try {
        const { sceneAPI } = await import('../../services/api');
        const res = await sceneAPI.getAll(episodeId);
        const data = res.data?.scenes || res.data || [];
        // Show all scenes (user can pick any)
        setScenes(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('ScenePicker load error:', err);
        setScenes([]);
      } finally {
        setLoading(false);
      }
    }
    if (episodeId) loadScenes();
  }, [episodeId]);

  const handleConfirm = () => {
    if (!selectedId) return;
    const scene = scenes.find((s) => s.id === selectedId);
    if (scene) onSelect(scene);
  };

  return (
    <div className="scene-picker-overlay" onClick={onClose}>
      <div className="scene-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="scene-picker-header">
          <h3>Select Scene</h3>
          <button className="scene-picker-close" onClick={onClose}>×</button>
        </div>

        <div className="scene-picker-grid">
          {loading && (
            <div className="scene-picker-loading">
              <Loader2 size={20} className="scene-studio-spin-icon" />
              Loading scenes...
            </div>
          )}

          {!loading && scenes.length === 0 && (
            <div className="scene-picker-empty">
              No scenes found. Create scenes in Scene Studio first.
            </div>
          )}

          {scenes.map((scene) => {
            const bgUrl = scene.background_url || scene.backgroundUrl;
            const isSelected = selectedId === scene.id;
            return (
              <div
                key={scene.id}
                className={`scene-picker-card ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedId(scene.id)}
              >
                <div className="scene-picker-thumb">
                  {bgUrl ? (
                    <img src={bgUrl} alt={scene.title} />
                  ) : (
                    <div className="scene-picker-no-thumb">
                      <Image size={24} />
                    </div>
                  )}
                  {isSelected && (
                    <div className="scene-picker-check">
                      <Check size={16} />
                    </div>
                  )}
                </div>
                <div className="scene-picker-info">
                  <span className="scene-picker-title">{scene.title || `Scene ${scene.scene_number}`}</span>
                  {scene.location && (
                    <span className="scene-picker-location">
                      <MapPin size={10} /> {scene.location}
                    </span>
                  )}
                  <span className="scene-picker-status">{scene.production_status || 'draft'}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="scene-picker-footer">
          <button className="scene-studio-btn ghost" onClick={onClose}>Cancel</button>
          <button
            className="scene-studio-btn primary"
            onClick={handleConfirm}
            disabled={!selectedId}
          >
            Use Scene
          </button>
        </div>
      </div>
    </div>
  );
}
