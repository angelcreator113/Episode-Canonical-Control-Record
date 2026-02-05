import React from 'react';

/**
 * ComposerHeader - Top bar with composition selector, tools, and controls
 */
export default function ComposerHeader({
  episode,
  compositions,
  activeCompositionId,
  onSelectComposition,
  snapEnabled,
  onToggleSnap,
  onCreateNew,
  canvasZoom,
  onZoomIn,
  onZoomOut,
  showGrid,
  onToggleGrid,
  showRulers,
  onToggleRulers
}) {
  const activeComposition = compositions.find(c => c.id === activeCompositionId);

  return (
    <div className="sc-header">
      <div className="sc-header-left">
        <h2 className="sc-title">Scene Composer</h2>
        {episode && (
          <span className="sc-episode-name">{episode.title || 'Untitled Episode'}</span>
        )}
      </div>

      <div className="sc-header-center">
        {/* Composition Selector */}
        <select
          className="sc-composition-select"
          value={activeCompositionId || ''}
          onChange={(e) => onSelectComposition(e.target.value)}
        >
          <option value="">Select Template...</option>
          {compositions.map(comp => (
            <option key={comp.id} value={comp.id}>
              {comp.name || 'Untitled'}
            </option>
          ))}
        </select>

        <button className="sc-btn sc-btn-primary" onClick={onCreateNew}>
          + New Template
        </button>
      </div>

      <div className="sc-header-right">
        {/* Canvas Controls */}
        <div className="sc-toolbar">
          <button
            className={`sc-tool-btn ${snapEnabled ? 'active' : ''}`}
            onClick={onToggleSnap}
            title="Snap to Grid"
          >
            🧲
          </button>

          <button
            className={`sc-tool-btn ${showGrid ? 'active' : ''}`}
            onClick={onToggleGrid}
            title="Show Grid"
          >
            #
          </button>

          <button
            className={`sc-tool-btn ${showRulers ? 'active' : ''}`}
            onClick={onToggleRulers}
            title="Show Rulers"
          >
            📏
          </button>

          <div className="sc-zoom-controls">
            <button onClick={onZoomOut} disabled={canvasZoom <= 0.25}>−</button>
            <span>{Math.round(canvasZoom * 100)}%</span>
            <button onClick={onZoomIn} disabled={canvasZoom >= 2}>+</button>
          </div>
        </div>
      </div>
    </div>
  );
}

