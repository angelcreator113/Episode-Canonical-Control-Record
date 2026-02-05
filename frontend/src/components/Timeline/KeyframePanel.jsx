import React, { useState } from 'react';
import './KeyframePanel.css';

/**
 * KeyframePanel - Animation keyframe editor
 * Allows setting position, scale, opacity, rotation keyframes
 */
const KeyframePanel = ({ isOpen, onClose, selectedItem, onUpdateKeyframes }) => {
  const [activeProperty, setActiveProperty] = useState('position');
  const [keyframes, setKeyframes] = useState(selectedItem?.keyframes || []);

  if (!isOpen) return null;

  const properties = [
    { id: 'position', label: 'Position', icon: '📍', unit: 'px' },
    { id: 'scale', label: 'Scale', icon: '🔍', unit: '%' },
    { id: 'opacity', label: 'Opacity', icon: '👁️', unit: '%' },
    { id: 'rotation', label: 'Rotation', icon: '🔄', unit: '°' }
  ];

  const handleAddKeyframe = (time) => {
    const newKeyframe = {
      id: Date.now().toString(),
      time,
      property: activeProperty,
      value: getDefaultValue(activeProperty)
    };
    const updated = [...keyframes, newKeyframe].sort((a, b) => a.time - b.time);
    setKeyframes(updated);
    onUpdateKeyframes?.(updated);
  };

  const handleUpdateKeyframe = (id, updates) => {
    const updated = keyframes.map(kf => kf.id === id ? { ...kf, ...updates } : kf);
    setKeyframes(updated);
    onUpdateKeyframes?.(updated);
  };

  const handleDeleteKeyframe = (id) => {
    const updated = keyframes.filter(kf => kf.id !== id);
    setKeyframes(updated);
    onUpdateKeyframes?.(updated);
  };

  const getDefaultValue = (property) => {
    switch (property) {
      case 'position': return { x: 0, y: 0 };
      case 'scale': return 100;
      case 'opacity': return 100;
      case 'rotation': return 0;
      default: return 0;
    }
  };

  const formatValue = (keyframe) => {
    const prop = properties.find(p => p.id === keyframe.property);
    if (keyframe.property === 'position') {
      return `X: ${keyframe.value.x}, Y: ${keyframe.value.y}`;
    }
    return `${keyframe.value}${prop?.unit || ''}`;
  };

  return (
    <div className="keyframe-panel-overlay" onClick={onClose}>
      <div className="keyframe-panel" onClick={(e) => e.stopPropagation()}>
        <div className="keyframe-panel-header">
          <h2>🎬 Keyframe Animation</h2>
          <button onClick={onClose} className="keyframe-close-btn">✕</button>
        </div>

        <div className="keyframe-panel-body">
          {/* Property Selector */}
          <div className="keyframe-properties">
            {properties.map(prop => (
              <button
                key={prop.id}
                className={`property-btn ${activeProperty === prop.id ? 'active' : ''}`}
                onClick={() => setActiveProperty(prop.id)}
              >
                <span className="property-icon">{prop.icon}</span>
                <span>{prop.label}</span>
              </button>
            ))}
          </div>

          {/* Keyframe Timeline */}
          <div className="keyframe-timeline">
            <div className="timeline-header">
              <span>Time</span>
              <span>Value</span>
              <span>Actions</span>
            </div>

            <div className="keyframe-list">
              {keyframes
                .filter(kf => kf.property === activeProperty)
                .map(kf => (
                  <div key={kf.id} className="keyframe-item">
                    <input
                      type="number"
                      value={kf.time}
                      onChange={(e) => handleUpdateKeyframe(kf.id, { time: parseFloat(e.target.value) })}
                      className="keyframe-time-input"
                      step="0.1"
                      min="0"
                    />
                    <div className="keyframe-value">
                      {activeProperty === 'position' ? (
                        <div className="position-inputs">
                          <input
                            type="number"
                            placeholder="X"
                            value={kf.value.x}
                            onChange={(e) => handleUpdateKeyframe(kf.id, {
                              value: { ...kf.value, x: parseFloat(e.target.value) }
                            })}
                          />
                          <input
                            type="number"
                            placeholder="Y"
                            value={kf.value.y}
                            onChange={(e) => handleUpdateKeyframe(kf.id, {
                              value: { ...kf.value, y: parseFloat(e.target.value) }
                            })}
                          />
                        </div>
                      ) : (
                        <input
                          type="number"
                          value={kf.value}
                          onChange={(e) => handleUpdateKeyframe(kf.id, { value: parseFloat(e.target.value) })}
                          className="keyframe-value-input"
                        />
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteKeyframe(kf.id)}
                      className="keyframe-delete-btn"
                      title="Delete keyframe"
                    >
                      🗑️
                    </button>
                  </div>
                ))}

              {keyframes.filter(kf => kf.property === activeProperty).length === 0 && (
                <div className="keyframe-empty">
                  <p>No keyframes for {activeProperty}</p>
                  <button onClick={() => handleAddKeyframe(0)} className="add-keyframe-btn">
                    + Add First Keyframe
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Visual Timeline */}
          <div className="keyframe-visual-timeline">
            <div className="timeline-track">
              {keyframes
                .filter(kf => kf.property === activeProperty)
                .map(kf => (
                  <div
                    key={kf.id}
                    className="timeline-marker"
                    style={{ left: `${(kf.time / 10) * 100}%` }}
                    title={`${kf.time}s: ${formatValue(kf)}`}
                  >
                    <div className="marker-diamond">◆</div>
                  </div>
                ))}
            </div>
            <div className="timeline-ruler">
              {Array.from({ length: 11 }).map((_, i) => (
                <span key={i} className="ruler-tick">{i}s</span>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="keyframe-actions">
            <button
              onClick={() => handleAddKeyframe(0)}
              className="action-btn"
            >
              + Add at Start
            </button>
            <button
              onClick={() => handleAddKeyframe(5)}
              className="action-btn"
            >
              + Add at 5s
            </button>
            <button
              onClick={() => setKeyframes([])}
              className="action-btn danger"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="keyframe-panel-footer">
          <div className="footer-info">
            <span>{keyframes.length} total keyframes</span>
          </div>
          <button onClick={onClose} className="footer-btn">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeyframePanel;
