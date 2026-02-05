import React from 'react';
import TimelineLibraryPanel from './TimelineLibraryPanel';
import TimelineInspectorPanel from './TimelineInspectorPanel';
import './TimelineContextPanel.css';

/**
 * TimelineContextPanel - Contextual panel that changes based on active mode
 * Modes: timeline, assets, wardrobe, voice, effects, properties
 */
const TimelineContextPanel = ({
  mode,
  episodeId,
  libraryAssets,
  visible = false,
  onClose,
  onAssetUpdate,
  selectedScene,
  selectedPlacement,
  placements,
  onPlacementUpdate,
  onPlacementDelete,
}) => {
  // Don't render at all if mode is 'timeline' (no panel needed)
  if (mode === 'timeline') {
    return null;
  }

  const renderContent = () => {
    switch (mode) {
      case 'assets':
        return (
          <div className="context-panel-content">
            <div className="context-panel-header">
              <h3>📦 Assets</h3>
              <p className="context-subtitle">Drag assets onto timeline</p>
              <button
                className="panel-close-btn"
                onClick={onClose}
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>
            <TimelineLibraryPanel
              episodeId={episodeId}
              assets={libraryAssets}
              onAssetUpdate={onAssetUpdate}
              embedded={true}
            />
          </div>
        );
      
      case 'wardrobe':
        return (
          <div className="context-panel-content">
            <div className="context-panel-header">
              <h3>👗 Wardrobe</h3>
              <p className="context-subtitle">Episode outfit continuity</p>
              <button
                className="panel-close-btn"
                onClick={onClose}
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>
            <div className="context-placeholder">
              <div className="placeholder-icon">👗</div>
              <p>Wardrobe browser coming soon</p>
              <span className="placeholder-hint">Track outfit continuity across scenes</span>
            </div>
          </div>
        );
      
      case 'voice':
        return (
          <div className="context-panel-content">
            <div className="context-panel-header">
              <h3>🎤 Voice & Audio</h3>
              <p className="context-subtitle">Audio tracks and narration</p>
              <button
                className="panel-close-btn"
                onClick={onClose}
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>
            <div className="context-placeholder">
              <div className="placeholder-icon">🎤</div>
              <p>Voice tracks coming soon</p>
              <span className="placeholder-hint">Add narration and audio effects</span>
            </div>
          </div>
        );
      
      case 'effects':
        return (
          <div className="context-panel-content">
            <div className="context-panel-header">
              <h3>✨ Effects</h3>
              <p className="context-subtitle">Visual effects library</p>
              <button
                className="panel-close-btn"
                onClick={onClose}
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>
            <div className="context-placeholder">
              <div className="placeholder-icon">✨</div>
              <p>Effects library coming soon</p>
              <span className="placeholder-hint">Transitions, filters, and animations</span>
            </div>
          </div>
        );
      
      case 'properties':
        return (
          <div className="context-panel-content">
            <div className="context-panel-header">
              <h3>⚙️ Properties</h3>
              <p className="context-subtitle">Selection properties</p>
              <button
                className="panel-close-btn"
                onClick={onClose}
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>
            <TimelineInspectorPanel
              episodeId={episodeId}
              selectedScene={selectedScene}
              selectedPlacement={selectedPlacement}
              placements={placements}
              onPlacementUpdate={onPlacementUpdate}
              onPlacementDelete={onPlacementDelete}
              embedded={true}
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className={`timeline-context-panel ${visible ? 'visible' : ''}`}>
      {renderContent()}
    </div>
  );
};

export default TimelineContextPanel;
