import React, { useMemo } from 'react';
import {
  Settings, Move, RotateCw, Maximize2, Eye, EyeOff, Lock, Unlock,
  FlipHorizontal, FlipVertical, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown,
  Trash2, Copy, Layers, GitBranch, ImageIcon, Box, Loader2, RefreshCw,
} from 'lucide-react';

/**
 * InspectorPanel — Right panel showing properties of selected object(s).
 * Shows transform, appearance, layer controls, variant info.
 * When nothing selected, shows canvas-level settings.
 */

function NumberInput({ label, value, onChange, min, max, step = 1, unit = '' }) {
  return (
    <div className="scene-studio-input-row">
      <label>{label}</label>
      <div className="scene-studio-input-group">
        <input
          type="number"
          value={Math.round(value * 100) / 100}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
        />
        {unit && <span className="scene-studio-unit">{unit}</span>}
      </div>
    </div>
  );
}

function SliderInput({ label, value, onChange, min = 0, max = 1, step = 0.01 }) {
  return (
    <div className="scene-studio-input-row">
      <label>{label}</label>
      <div className="scene-studio-slider-group">
        <input
          type="range"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          min={min}
          max={max}
          step={step}
        />
        <span className="scene-studio-slider-value">{Math.round(value * 100)}%</span>
      </div>
    </div>
  );
}

export default function InspectorPanel({
  objects,
  selectedIds,
  canvasSettings,
  variantGroups,
  angles,
  activeAngleId,
  onUpdateObject,
  onReorder,
  onDelete,
  onDuplicate,
  onToggleVisibility,
  onToggleLock,
  onUpdateCanvasSettings,
  onActivateVariant,
  onSetActiveAngle,
  contextType,
  backgroundSelected,
  backgroundUrl,
  depthMapUrl,
  depthEffects,
  isGeneratingDepth,
  onGenerateDepth,
  onUpdateDepthEffects,
}) {
  const selectedObjects = useMemo(
    () => objects.filter((o) => selectedIds.has(o.id)),
    [objects, selectedIds]
  );

  const selected = selectedObjects.length === 1 ? selectedObjects[0] : null;

  // Background selected — show background info
  if (backgroundSelected && backgroundUrl && selectedObjects.length === 0) {
    return (
      <div className="scene-studio-inspector">
        <div className="scene-studio-panel-header">
          <ImageIcon size={14} />
          <span>Background</span>
        </div>

        <div className="scene-studio-section">
          <div className="scene-studio-bg-preview">
            <img src={backgroundUrl} alt="Background" />
          </div>
          <p className="scene-studio-bg-hint">
            This is the scene background image. Use the Generate tab to create objects to layer on top, or the Library tab to add existing assets.
          </p>
        </div>

        <div className="scene-studio-section">
          <h4><Box size={12} style={{ marginRight: 4 }} /> 3D & Depth</h4>
          {!depthMapUrl && !isGeneratingDepth && (
            <button
              className="scene-studio-depth-btn"
              onClick={onGenerateDepth}
            >
              <Box size={14} />
              Generate Depth Map
            </button>
          )}
          {isGeneratingDepth && (
            <div className="scene-studio-depth-generating">
              <Loader2 size={14} className="scene-studio-spinner" />
              <span>Generating depth map...</span>
            </div>
          )}
          {depthMapUrl && !isGeneratingDepth && (
            <>
              <div className="scene-studio-depth-preview">
                <img src={depthMapUrl} alt="Depth map" />
                <button
                  className="scene-studio-depth-regen"
                  onClick={onGenerateDepth}
                  title="Regenerate depth map"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
              <div className="scene-studio-input-row">
                <label>Parallax</label>
                <button
                  className={`scene-studio-toggle ${depthEffects?.parallaxEnabled ? 'active' : ''}`}
                  onClick={() => onUpdateDepthEffects({ parallaxEnabled: !depthEffects?.parallaxEnabled })}
                >
                  {depthEffects?.parallaxEnabled ? 'On' : 'Off'}
                </button>
              </div>
              <div className="scene-studio-input-row">
                <label>Focus Depth</label>
                <div className="scene-studio-slider-group">
                  <input
                    type="range"
                    value={depthEffects?.focusDepth ?? 50}
                    onChange={(e) => onUpdateDepthEffects({ focusDepth: parseInt(e.target.value) })}
                    min={0}
                    max={100}
                    step={1}
                  />
                  <span className="scene-studio-slider-value">{depthEffects?.focusDepth ?? 50}</span>
                </div>
              </div>
              <div className="scene-studio-input-row">
                <label>DoF Blur</label>
                <div className="scene-studio-slider-group">
                  <input
                    type="range"
                    value={depthEffects?.blurIntensity ?? 0}
                    onChange={(e) => onUpdateDepthEffects({ blurIntensity: parseInt(e.target.value) })}
                    min={0}
                    max={20}
                    step={1}
                  />
                  <span className="scene-studio-slider-value">{depthEffects?.blurIntensity ?? 0}px</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="scene-studio-section">
          <h4>Canvas</h4>
          <div className="scene-studio-input-row">
            <label>Grid</label>
            <button
              className={`scene-studio-toggle ${canvasSettings.gridVisible ? 'active' : ''}`}
              onClick={() => onUpdateCanvasSettings({ gridVisible: !canvasSettings.gridVisible })}
            >
              {canvasSettings.gridVisible ? 'On' : 'Off'}
            </button>
          </div>
          <div className="scene-studio-input-row">
            <label>Snap</label>
            <button
              className={`scene-studio-toggle ${canvasSettings.snapEnabled ? 'active' : ''}`}
              onClick={() => onUpdateCanvasSettings({ snapEnabled: !canvasSettings.snapEnabled })}
            >
              {canvasSettings.snapEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No selection — show canvas settings
  if (selectedObjects.length === 0) {
    return (
      <div className="scene-studio-inspector">
        <div className="scene-studio-panel-header">
          <Settings size={14} />
          <span>Canvas Settings</span>
        </div>

        <div className="scene-studio-section">
          <div className="scene-studio-input-row">
            <label>Grid</label>
            <button
              className={`scene-studio-toggle ${canvasSettings.gridVisible ? 'active' : ''}`}
              onClick={() => onUpdateCanvasSettings({ gridVisible: !canvasSettings.gridVisible })}
            >
              {canvasSettings.gridVisible ? 'On' : 'Off'}
            </button>
          </div>

          <div className="scene-studio-input-row">
            <label>Snap</label>
            <button
              className={`scene-studio-toggle ${canvasSettings.snapEnabled ? 'active' : ''}`}
              onClick={() => onUpdateCanvasSettings({ snapEnabled: !canvasSettings.snapEnabled })}
            >
              {canvasSettings.snapEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        {/* Angle selector for scene sets */}
        {contextType === 'sceneSet' && angles && angles.length > 0 && (
          <div className="scene-studio-section">
            <h4>Camera Angles</h4>
            <div className="scene-studio-angle-list">
              {angles.map((angle) => (
                <button
                  key={angle.id}
                  className={`scene-studio-angle-btn ${activeAngleId === angle.id ? 'active' : ''}`}
                  onClick={() => onSetActiveAngle && onSetActiveAngle(angle.id)}
                >
                  {angle.still_image_url && (
                    <img src={angle.still_image_url} alt="" />
                  )}
                  <span>{angle.angle_label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Multi-selection — show limited controls
  if (selectedObjects.length > 1) {
    return (
      <div className="scene-studio-inspector">
        <div className="scene-studio-panel-header">
          <Layers size={14} />
          <span>{selectedObjects.length} objects selected</span>
        </div>
        <div className="scene-studio-section">
          <button
            className="scene-studio-btn danger"
            onClick={() => selectedObjects.forEach((o) => onDelete(o.id))}
          >
            <Trash2 size={14} /> Delete All
          </button>
        </div>
      </div>
    );
  }

  // Single selection
  const obj = selected;

  return (
    <div className="scene-studio-inspector">
      <div className="scene-studio-panel-header">
        <Settings size={14} />
        <span>{obj.label || 'Object'}</span>
      </div>

      {/* Transform */}
      <div className="scene-studio-section">
        <h4><Move size={12} /> Position</h4>
        <div className="scene-studio-input-grid">
          <NumberInput label="X" value={obj.x || 0} onChange={(v) => onUpdateObject(obj.id, { x: v })} unit="px" />
          <NumberInput label="Y" value={obj.y || 0} onChange={(v) => onUpdateObject(obj.id, { y: v })} unit="px" />
        </div>
      </div>

      <div className="scene-studio-section">
        <h4><Maximize2 size={12} /> Size</h4>
        <div className="scene-studio-input-grid">
          <NumberInput label="W" value={obj.width || 0} onChange={(v) => onUpdateObject(obj.id, { width: Math.max(20, v) })} min={20} unit="px" />
          <NumberInput label="H" value={obj.height || 0} onChange={(v) => onUpdateObject(obj.id, { height: Math.max(20, v) })} min={20} unit="px" />
        </div>
      </div>

      <div className="scene-studio-section">
        <h4><RotateCw size={12} /> Rotation</h4>
        <NumberInput label="°" value={obj.rotation || 0} onChange={(v) => onUpdateObject(obj.id, { rotation: v })} min={-360} max={360} unit="°" />
        <div className="scene-studio-quick-actions">
          {[0, 90, 180, 270].map((deg) => (
            <button key={deg} className="scene-studio-chip" onClick={() => onUpdateObject(obj.id, { rotation: deg })}>
              {deg}°
            </button>
          ))}
        </div>
      </div>

      {/* Appearance */}
      <div className="scene-studio-section">
        <h4>Appearance</h4>
        <SliderInput label="Opacity" value={obj.opacity != null ? obj.opacity : 1} onChange={(v) => onUpdateObject(obj.id, { opacity: v })} />

        <div className="scene-studio-quick-actions">
          <button
            className={`scene-studio-icon-btn ${obj.flipX ? 'active' : ''}`}
            onClick={() => onUpdateObject(obj.id, { flipX: !obj.flipX })}
            title="Flip Horizontal"
          >
            <FlipHorizontal size={14} />
          </button>
          <button
            className={`scene-studio-icon-btn ${obj.flipY ? 'active' : ''}`}
            onClick={() => onUpdateObject(obj.id, { flipY: !obj.flipY })}
            title="Flip Vertical"
          >
            <FlipVertical size={14} />
          </button>
        </div>
      </div>

      {/* Layer */}
      <div className="scene-studio-section">
        <h4><Layers size={12} /> Layer</h4>
        <div className="scene-studio-quick-actions">
          <button className="scene-studio-chip" onClick={() => onReorder(obj.id, 'front')} title="Bring to Front">
            <ChevronsUp size={12} /> Front
          </button>
          <button className="scene-studio-chip" onClick={() => onReorder(obj.id, 'up')} title="Bring Forward">
            <ArrowUp size={12} /> Up
          </button>
          <button className="scene-studio-chip" onClick={() => onReorder(obj.id, 'down')} title="Send Backward">
            <ArrowDown size={12} /> Down
          </button>
          <button className="scene-studio-chip" onClick={() => onReorder(obj.id, 'back')} title="Send to Back">
            <ChevronsDown size={12} /> Back
          </button>
        </div>
      </div>

      {/* Visibility & Lock */}
      <div className="scene-studio-section">
        <div className="scene-studio-quick-actions">
          <button className="scene-studio-chip" onClick={() => onToggleVisibility(obj.id)}>
            {obj.isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
            {obj.isVisible ? 'Visible' : 'Hidden'}
          </button>
          <button className="scene-studio-chip" onClick={() => onToggleLock(obj.id)}>
            {obj.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
            {obj.isLocked ? 'Locked' : 'Unlocked'}
          </button>
        </div>
      </div>

      {/* Variants */}
      {obj.variantGroupId && (
        <div className="scene-studio-section">
          <h4><GitBranch size={12} /> Variants</h4>
          <div className="scene-studio-variant-list">
            {objects
              .filter((o) => o.variantGroupId === obj.variantGroupId)
              .map((v) => (
                <button
                  key={v.id}
                  className={`scene-studio-variant-item ${v.isActiveVariant ? 'active' : ''}`}
                  onClick={() => onActivateVariant && onActivateVariant(obj.variantGroupId, v.id)}
                >
                  {v.variantLabel || v.label}
                  {v.isActiveVariant && <span className="scene-studio-active-dot" />}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="scene-studio-section">
        <div className="scene-studio-quick-actions">
          <button className="scene-studio-chip" onClick={() => onDuplicate(obj.id)}>
            <Copy size={12} /> Duplicate
          </button>
          <button className="scene-studio-chip danger" onClick={() => onDelete(obj.id)}>
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>

      {/* Asset Info (read-only) */}
      {obj._asset && (
        <div className="scene-studio-section scene-studio-asset-info">
          <h4>Asset Info</h4>
          <div className="scene-studio-info-row">
            <span>Type</span>
            <span>{obj._asset.content_type || obj.type}</span>
          </div>
          {obj._asset.width && (
            <div className="scene-studio-info-row">
              <span>Source Size</span>
              <span>{obj._asset.width} × {obj._asset.height}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
