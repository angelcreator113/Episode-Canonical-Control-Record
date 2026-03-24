import React from 'react';
import {
  MousePointer2, Hand, Type, Square, ZoomIn, ZoomOut, Maximize,
  Undo2, Redo2, Save, Download, Grid3X3,
} from 'lucide-react';

/**
 * Toolbar — Top toolbar for Scene Studio.
 * Tools, zoom controls, undo/redo, save status.
 */

const PLATFORM_PRESETS = {
  youtube: { width: 1920, height: 1080, label: 'YouTube 16:9' },
  instagram: { width: 1080, height: 1920, label: 'Instagram 9:16' },
  tiktok: { width: 1080, height: 1920, label: 'TikTok 9:16' },
  square: { width: 1080, height: 1080, label: 'Square 1:1' },
  cinema: { width: 2560, height: 1440, label: 'Cinema 16:9' },
};

export default function Toolbar({
  activeTool,
  onSetTool,
  zoom,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  undoCount,
  redoCount,
  onUndo,
  onRedo,
  isDirty,
  isSaving,
  onSave,
  onExport,
  title,
  platform,
  onPlatformChange,
  gridVisible,
  onToggleGrid,
  onBack,
}) {
  return (
    <div className="scene-studio-toolbar">
      {/* Left: Back + Title */}
      <div className="scene-studio-toolbar-left">
        {onBack && (
          <button className="scene-studio-btn ghost" onClick={onBack}>
            ← Back
          </button>
        )}
        <span className="scene-studio-toolbar-title">{title || 'Scene Studio'}</span>
      </div>

      {/* Center: Tools */}
      <div className="scene-studio-toolbar-center">
        <div className="scene-studio-tool-group">
          <button
            className={`scene-studio-tool-btn ${activeTool === 'select' ? 'active' : ''}`}
            onClick={() => onSetTool('select')}
            title="Select (V)"
          >
            <MousePointer2 size={16} />
          </button>
          <button
            className={`scene-studio-tool-btn ${activeTool === 'hand' ? 'active' : ''}`}
            onClick={() => onSetTool('hand')}
            title="Pan (H)"
          >
            <Hand size={16} />
          </button>
          <button
            className={`scene-studio-tool-btn ${activeTool === 'text' ? 'active' : ''}`}
            onClick={() => onSetTool('text')}
            title="Text (T)"
          >
            <Type size={16} />
          </button>
          <button
            className={`scene-studio-tool-btn ${activeTool === 'shape' ? 'active' : ''}`}
            onClick={() => onSetTool('shape')}
            title="Shape (S)"
          >
            <Square size={16} />
          </button>
        </div>

        <div className="scene-studio-divider" />

        {/* Zoom */}
        <div className="scene-studio-tool-group">
          <button className="scene-studio-tool-btn" onClick={onZoomOut} title="Zoom Out">
            <ZoomOut size={16} />
          </button>
          <span className="scene-studio-zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="scene-studio-tool-btn" onClick={onZoomIn} title="Zoom In">
            <ZoomIn size={16} />
          </button>
          <button className="scene-studio-tool-btn" onClick={onFitToScreen} title="Fit to Screen">
            <Maximize size={16} />
          </button>
        </div>

        <div className="scene-studio-divider" />

        {/* Grid */}
        <button
          className={`scene-studio-tool-btn ${gridVisible ? 'active' : ''}`}
          onClick={onToggleGrid}
          title="Toggle Grid"
        >
          <Grid3X3 size={16} />
        </button>

        <div className="scene-studio-divider" />

        {/* Undo/Redo */}
        <div className="scene-studio-tool-group">
          <button
            className="scene-studio-tool-btn"
            onClick={onUndo}
            disabled={undoCount === 0}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            className="scene-studio-tool-btn"
            onClick={onRedo}
            disabled={redoCount === 0}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={16} />
          </button>
        </div>
      </div>

      {/* Right: Platform, Save, Export */}
      <div className="scene-studio-toolbar-right">
        {onPlatformChange && (
          <select
            className="scene-studio-platform-select"
            value={platform || 'youtube'}
            onChange={(e) => onPlatformChange(e.target.value)}
          >
            {Object.entries(PLATFORM_PRESETS).map(([key, preset]) => (
              <option key={key} value={key}>{preset.label}</option>
            ))}
          </select>
        )}

        <button
          className={`scene-studio-btn ${isDirty ? 'primary' : 'ghost'}`}
          onClick={onSave}
          disabled={isSaving}
        >
          <Save size={14} />
          {isSaving ? 'Saving...' : isDirty ? 'Save' : 'Saved'}
        </button>

        {onExport && (
          <button className="scene-studio-btn ghost" onClick={onExport}>
            <Download size={14} /> Export
          </button>
        )}
      </div>
    </div>
  );
}

export { PLATFORM_PRESETS };
