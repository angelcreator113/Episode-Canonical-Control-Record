import React, { useCallback } from 'react';
import './KeyframePropertyEditor.css';

/**
 * KeyframePropertyEditor — inline panel for editing a selected keyframe's
 * transform properties: position (x / y), scale, opacity, rotation.
 *
 * Props:
 *   keyframe           - the selected keyframe object { id, time, properties }
 *   onUpdateProperties - (id, newProperties) => void
 *   onDelete           - (id) => void
 *   onClose            - () => void   (deselect)
 */
function KeyframePropertyEditor({ keyframe, onUpdateProperties, onDelete, onClose }) {
  if (!keyframe) return null;

  const { id, time, properties } = keyframe;
  const { x = 50, y = 50, scale = 1, opacity = 1, rotation = 0 } = properties || {};

  const update = useCallback((key, value) => {
    onUpdateProperties(id, { ...properties, [key]: value });
  }, [id, properties, onUpdateProperties]);

  const handleReset = useCallback(() => {
    onUpdateProperties(id, { x: 50, y: 50, scale: 1.0, opacity: 1.0, rotation: 0 });
  }, [id, onUpdateProperties]);

  return (
    <div className="kpe-panel">
      <div className="kpe-header">
        <span className="kpe-title">◆ Keyframe @ {time.toFixed(2)}s</span>
        <div className="kpe-header-actions">
          <button className="kpe-reset-btn" onClick={handleReset} title="Reset to defaults">↺</button>
          <button className="kpe-close-btn" onClick={onClose} title="Close panel">✕</button>
        </div>
      </div>

      <div className="kpe-body">
        {/* Position X */}
        <div className="kpe-row">
          <label className="kpe-label">X</label>
          <input
            type="range"
            className="kpe-slider"
            min={0} max={100} step={0.5}
            value={x}
            onChange={(e) => update('x', parseFloat(e.target.value))}
          />
          <input
            type="number"
            className="kpe-number"
            min={0} max={100} step={0.5}
            value={Math.round(x * 10) / 10}
            onChange={(e) => update('x', parseFloat(e.target.value) || 0)}
          />
          <span className="kpe-unit">%</span>
        </div>

        {/* Position Y */}
        <div className="kpe-row">
          <label className="kpe-label">Y</label>
          <input
            type="range"
            className="kpe-slider"
            min={0} max={100} step={0.5}
            value={y}
            onChange={(e) => update('y', parseFloat(e.target.value))}
          />
          <input
            type="number"
            className="kpe-number"
            min={0} max={100} step={0.5}
            value={Math.round(y * 10) / 10}
            onChange={(e) => update('y', parseFloat(e.target.value) || 0)}
          />
          <span className="kpe-unit">%</span>
        </div>

        {/* Scale */}
        <div className="kpe-row">
          <label className="kpe-label">Scale</label>
          <input
            type="range"
            className="kpe-slider"
            min={0.1} max={3} step={0.05}
            value={scale}
            onChange={(e) => update('scale', parseFloat(e.target.value))}
          />
          <input
            type="number"
            className="kpe-number"
            min={0.1} max={5} step={0.05}
            value={Math.round(scale * 100) / 100}
            onChange={(e) => update('scale', parseFloat(e.target.value) || 1)}
          />
          <span className="kpe-unit">×</span>
        </div>

        {/* Opacity */}
        <div className="kpe-row">
          <label className="kpe-label">Opacity</label>
          <input
            type="range"
            className="kpe-slider kpe-slider-opacity"
            min={0} max={1} step={0.01}
            value={opacity}
            onChange={(e) => update('opacity', parseFloat(e.target.value))}
          />
          <input
            type="number"
            className="kpe-number"
            min={0} max={1} step={0.01}
            value={Math.round(opacity * 100) / 100}
            onChange={(e) => update('opacity', Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)))}
          />
        </div>

        {/* Rotation */}
        <div className="kpe-row">
          <label className="kpe-label">Rotate</label>
          <input
            type="range"
            className="kpe-slider"
            min={-360} max={360} step={1}
            value={rotation}
            onChange={(e) => update('rotation', parseFloat(e.target.value))}
          />
          <input
            type="number"
            className="kpe-number"
            min={-360} max={360} step={1}
            value={Math.round(rotation)}
            onChange={(e) => update('rotation', parseFloat(e.target.value) || 0)}
          />
          <span className="kpe-unit">°</span>
        </div>
      </div>

      <div className="kpe-footer">
        <button className="kpe-delete-btn" onClick={() => onDelete(id)}>
          🗑 Delete Keyframe
        </button>
      </div>
    </div>
  );
}

export default KeyframePropertyEditor;
