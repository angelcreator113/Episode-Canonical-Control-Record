/**
 * LabelSelector Component
 * Manage labels for an asset
 */

import React, { useState, useEffect, useRef } from 'react';
import assetService from '../services/assetService';
import './LabelSelector.css';

const LabelSelector = ({ assetId, currentLabels = [], onUpdate }) => {
  const [allLabels, setAllLabels] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6366f1');
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchLabels();
    
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
        setCreating(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchLabels = async () => {
    try {
      const response = await assetService.getAllLabels();
      setAllLabels(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch labels:', error);
    }
  };

  const addLabel = async (labelId) => {
    setLoading(true);
    try {
      await assetService.addLabels(assetId, [labelId]);
      onUpdate && onUpdate();
      setShowDropdown(false);
    } catch (error) {
      console.error('Failed to add label:', error);
      alert('Failed to add label');
    } finally {
      setLoading(false);
    }
  };

  const removeLabel = async (labelId) => {
    setLoading(true);
    try {
      await assetService.removeLabel(assetId, labelId);
      onUpdate && onUpdate();
    } catch (error) {
      console.error('Failed to remove label:', error);
      alert('Failed to remove label');
    } finally {
      setLoading(false);
    }
  };

  const createNewLabel = async () => {
    if (!newLabelName.trim()) return;

    setLoading(true);
    try {
      const response = await assetService.createLabel({
        name: newLabelName.trim(),
        color: newLabelColor,
      });

      await fetchLabels();
      await addLabel(response.data.data.id);
      setNewLabelName('');
      setNewLabelColor('#6366f1');
      setCreating(false);
    } catch (error) {
      console.error('Failed to create label:', error);
      alert(error.response?.data?.message || 'Failed to create label');
    } finally {
      setLoading(false);
    }
  };

  const availableLabels = allLabels.filter(
    (label) => !currentLabels.find((cl) => cl.id === label.id)
  );

  return (
    <div className="label-selector">
      {/* Current Labels */}
      <div className="current-labels">
        {currentLabels.map((label) => (
          <span
            key={label.id}
            className="label-badge"
            style={{ background: label.color }}
          >
            {label.name}
            <button
              onClick={() => removeLabel(label.id)}
              disabled={loading}
              className="label-remove"
              title="Remove label"
            >
              ×
            </button>
          </span>
        ))}

        {/* Add Label Button */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="label-add-btn"
          disabled={loading}
        >
          + Add Label
        </button>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="label-dropdown" ref={dropdownRef}>
          <div className="label-dropdown-header">
            <span>Select a label</span>
            <button
              onClick={() => setShowDropdown(false)}
              className="label-dropdown-close"
            >
              ×
            </button>
          </div>

          {/* Create New Label Form */}
          {creating ? (
            <div className="label-create-form">
              <input
                type="text"
                placeholder="Label name"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && createNewLabel()}
                autoFocus
              />
              <input
                type="color"
                value={newLabelColor}
                onChange={(e) => setNewLabelColor(e.target.value)}
              />
              <div className="label-create-actions">
                <button onClick={createNewLabel} disabled={loading || !newLabelName.trim()}>
                  Create
                </button>
                <button onClick={() => setCreating(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {/* Available Labels */}
              <div className="label-dropdown-list">
                {availableLabels.length === 0 ? (
                  <div className="label-dropdown-empty">
                    No more labels available
                  </div>
                ) : (
                  availableLabels.map((label) => (
                    <div
                      key={label.id}
                      onClick={() => addLabel(label.id)}
                      className="label-option"
                    >
                      <span
                        className="label-color-dot"
                        style={{ background: label.color }}
                      />
                      <span className="label-option-name">{label.name}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Create New Button */}
              <button
                onClick={() => setCreating(true)}
                className="label-create-btn"
              >
                + Create New Label
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default LabelSelector;
