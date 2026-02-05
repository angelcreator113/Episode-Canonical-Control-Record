import React from 'react';

/**
 * InspectorPanel - Contextual properties for selected element
 * 
 * Shows transform properties, role assignment, etc.
 */
export default function InspectorPanel({ element, onChange, onDelete }) {
  if (!element) {
    return (
      <div className="inspector-panel">
        <div className="inspector-empty">
          <span className="empty-icon">🔍</span>
          <p>Select an element to edit properties</p>
        </div>
      </div>
    );
  }

  const handleTransformChange = (field, value) => {
    onChange({
      ...element,
      transform: {
        ...element.transform,
        [field]: parseFloat(value) || 0
      }
    });
  };

  const handleRoleChange = (role) => {
    const zMap = {
      'background': 0,
      'primary': 1,
      'hero': 2,
      'b-roll': 3,
      'costume': 3,
      'overlay': 4,
      'lower-third': 5
    };

    onChange({
      ...element,
      role,
      zIndex: zMap[role] || 2
    });
  };

  const roles = [
    { id: 'background', label: 'Background', icon: '🖼️' },
    { id: 'hero', label: 'Hero', icon: '⭐' },
    { id: 'primary', label: 'Primary', icon: '🎬' },
    { id: 'overlay', label: 'Overlay', icon: '🔲' },
    { id: 'lower-third', label: 'Lower Third', icon: '📊' },
    { id: 'b-roll', label: 'B-Roll', icon: '🎞️' },
    { id: 'costume', label: 'Costume', icon: '👗' }
  ];

  return (
    <div className="inspector-panel">
      <div className="panel-header">
        <h3>Inspector</h3>
      </div>

      <div className="inspector-content">
        {/* Role */}
        <div className="property-group">
          <label>Role</label>
          <select
            value={element.role}
            onChange={(e) => handleRoleChange(e.target.value)}
            className="role-select"
          >
            {roles.map(role => (
              <option key={role.id} value={role.id}>
                {role.icon} {role.label}
              </option>
            ))}
          </select>
        </div>

        {/* Position */}
        <div className="property-group">
          <label>Position</label>
          <div className="property-row">
            <div className="property-field">
              <span>X</span>
              <input
                type="number"
                value={Math.round(element.transform.x)}
                onChange={(e) => handleTransformChange('x', e.target.value)}
              />
            </div>
            <div className="property-field">
              <span>Y</span>
              <input
                type="number"
                value={Math.round(element.transform.y)}
                onChange={(e) => handleTransformChange('y', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Size */}
        <div className="property-group">
          <label>Size</label>
          <div className="property-row">
            <div className="property-field">
              <span>W</span>
              <input
                type="number"
                value={Math.round(element.transform.width)}
                onChange={(e) => handleTransformChange('width', e.target.value)}
              />
            </div>
            <div className="property-field">
              <span>H</span>
              <input
                type="number"
                value={Math.round(element.transform.height)}
                onChange={(e) => handleTransformChange('height', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Rotation */}
        <div className="property-group">
          <label>Rotation</label>
          <input
            type="number"
            value={element.transform.rotation}
            onChange={(e) => handleTransformChange('rotation', e.target.value)}
            min="0"
            max="360"
          />
          <span>°</span>
        </div>

        {/* Scale */}
        <div className="property-group">
          <label>Scale</label>
          <input
            type="number"
            value={element.transform.scale}
            onChange={(e) => handleTransformChange('scale', e.target.value)}
            min="0.1"
            max="5"
            step="0.1"
          />
        </div>

        {/* Z-Index */}
        <div className="property-group">
          <label>Z-Index</label>
          <input
            type="number"
            value={element.zIndex}
            onChange={(e) => onChange({ ...element, zIndex: parseInt(e.target.value) || 0 })}
            min="0"
            max="100"
          />
        </div>

        {/* Delete */}
        <div className="property-group">
          <button className="btn-delete" onClick={onDelete}>
            🗑️ Delete Element
          </button>
        </div>
      </div>
    </div>
  );
}
