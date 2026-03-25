import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer2, Hand, Eraser, ZoomIn, ZoomOut, Maximize,
  Undo2, Redo2, Save, Download, Grid3X3, Check, Film,
} from 'lucide-react';

/**
 * Toolbar — Top toolbar for Scene Studio.
 * Tools, zoom controls, undo/redo, save status, editable title, export.
 */

const PLATFORM_PRESETS = {
  youtube: { width: 1920, height: 1080, label: 'YouTube 16:9' },
  instagram: { width: 1080, height: 1920, label: 'Instagram 9:16' },
  tiktok: { width: 1080, height: 1920, label: 'TikTok 9:16' },
  square: { width: 1080, height: 1080, label: 'Square 1:1' },
  cinema: { width: 2560, height: 1440, label: 'Cinema 16:9' },
};

const TOOLS = [
  { key: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { key: 'hand', icon: Hand, label: 'Pan', shortcut: 'H' },
  { key: 'erase', icon: Eraser, label: 'Erase', shortcut: 'E' },
];

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
  saveStatus,
  onSave,
  onExport,
  title,
  rawTitle,
  onTitleChange,
  platform,
  onPlatformChange,
  gridVisible,
  onToggleGrid,
  onBack,
  onUseInTimeline,
  productionStatus,
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editValue, setEditValue] = useState('');
  const titleInputRef = useRef(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleClick = () => {
    if (!onTitleChange) return;
    setEditValue(rawTitle || '');
    setIsEditingTitle(true);
  };

  const commitTitle = () => {
    setIsEditingTitle(false);
    if (editValue.trim() && editValue.trim() !== (rawTitle || '')) {
      onTitleChange(editValue.trim());
    }
  };

  const cancelTitle = () => {
    setIsEditingTitle(false);
    setEditValue('');
  };

  return (
    <div className="scene-studio-toolbar">
      {/* Left: Back + Title */}
      <div className="scene-studio-toolbar-left">
        {onBack && (
          <button className="scene-studio-btn ghost" onClick={onBack}>
            ← Back
          </button>
        )}
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            className="scene-studio-toolbar-title-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') cancelTitle();
            }}
          />
        ) : (
          <span
            className={`scene-studio-toolbar-title ${onTitleChange ? 'editable' : ''}`}
            onClick={handleTitleClick}
            title={onTitleChange ? 'Click to edit title' : undefined}
          >
            {title || 'Scene Studio'}
          </span>
        )}
      </div>

      {/* Center: Tools */}
      <div className="scene-studio-toolbar-center">
        <div className="scene-studio-tool-group">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.key}
                className={`scene-studio-tool-btn-labeled ${activeTool === tool.key ? 'active' : ''}`}
                onClick={() => onSetTool(tool.key)}
                title={`${tool.label} (${tool.shortcut})`}
              >
                <Icon size={16} />
                <span className="scene-studio-tool-label">{tool.label}</span>
              </button>
            );
          })}
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

      {/* Right: Fit, Platform, Save, Export */}
      <div className="scene-studio-toolbar-right">
        <button className="scene-studio-tool-btn" onClick={onFitToScreen} title="Fit to Screen">
          <Maximize size={16} />
        </button>

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
          className={`scene-studio-btn ${
            saveStatus === 'error' ? 'danger' :
            saveStatus === 'saved' ? 'success' :
            isDirty ? 'primary' : 'ghost'
          }`}
          style={isDirty ? { fontWeight: 600 } : undefined}
          onClick={onSave}
          disabled={saveStatus === 'saving'}
          title={saveStatus === 'error' ? 'Save failed — click to retry' : 'Save (Ctrl+S)'}
        >
          {saveStatus === 'saving' ? (
            <><Save size={14} className="scene-studio-spin-icon" /> Saving...</>
          ) : saveStatus === 'saved' ? (
            <><Check size={14} /> Saved</>
          ) : saveStatus === 'error' ? (
            <><Save size={14} /> Retry</>
          ) : (
            <><Save size={14} /> Save</>
          )}
        </button>

        {onUseInTimeline && (
          <button
            className={`scene-studio-btn ${productionStatus === 'ready' ? 'success' : 'primary'}`}
            onClick={onUseInTimeline}
            title={productionStatus === 'ready' ? 'Already ready for timeline' : 'Mark as ready and add to timeline'}
          >
            <Film size={14} /> {productionStatus === 'ready' ? 'In Timeline' : 'Use in Timeline'}
          </button>
        )}

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
