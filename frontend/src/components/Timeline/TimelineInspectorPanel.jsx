import React, { useState } from 'react';
import timelinePlacementsService from '../../services/timelinePlacementsService';
import './TimelineInspectorPanel.css';

/**
 * TimelineInspectorPanel - Right sidebar showing properties for selected scene/placement
 */
const TimelineInspectorPanel = ({ 
  episodeId,
  selectedScene, 
  selectedPlacement,
  placements,
  onPlacementUpdate,
  onPlacementDelete,
  onClose,
  embedded = false
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get placements for selected scene
  const scenePlacements = selectedScene 
    ? placements.filter(p => p.scene_id === selectedScene.id)
    : [];

  const handleDeletePlacement = async (placementId) => {
    if (!window.confirm('Remove this placement from the timeline?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await timelinePlacementsService.deletePlacement(episodeId, placementId);
      onPlacementDelete(placementId);
    } catch (err) {
      console.error('Error deleting placement:', err);
      setError('Failed to delete placement');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePlacement = async (placementId, updates) => {
    try {
      setLoading(true);
      setError(null);
      const response = await timelinePlacementsService.updatePlacement(episodeId, placementId, updates);
      onPlacementUpdate(response.data);
    } catch (err) {
      console.error('Error updating placement:', err);
      setError('Failed to update placement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="timeline-inspector-panel">
      {/* Header - hide if embedded */}
      {!embedded && (
        <div className="inspector-panel-header">
          <h3>📋 Properties</h3>
          {onClose && (
            <button onClick={onClose} className="close-btn" title="Close panel">
              ✕
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="inspector-content">
        {error && (
          <div className="inspector-error">
            {error}
          </div>
        )}

        {/* Selected Scene */}
        {selectedScene && (
          <div className="inspector-section">
            <h4>Scene {selectedScene.scene_order || 'N/A'}</h4>
            <div className="inspector-field">
              <label>Title:</label>
              <div className="field-value">{selectedScene.title_override || 'Untitled'}</div>
            </div>
            <div className="inspector-field">
              <label>Type:</label>
              <div className="field-value">{selectedScene.type || 'standard'}</div>
            </div>
            <div className="inspector-field">
              <label>Duration:</label>
              <div className="field-value">
                {formatDuration(selectedScene.duration_seconds || 0)}
              </div>
            </div>

            {/* Scene Placements */}
            <div className="inspector-subsection">
              <div className="subsection-header">
                <h5>Placed Assets ({scenePlacements.length})</h5>
              </div>
              {scenePlacements.length === 0 ? (
                <div className="inspector-empty">
                  No assets placed on this scene
                </div>
              ) : (
                <div className="placements-list">
                  {scenePlacements.map(placement => (
                    <PlacementCard
                      key={placement.id}
                      placement={placement}
                      isSelected={selectedPlacement?.id === placement.id}
                      onDelete={() => handleDeletePlacement(placement.id)}
                      onUpdate={(updates) => handleUpdatePlacement(placement.id, updates)}
                      loading={loading}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected Placement Details */}
        {selectedPlacement && (
          <div className="inspector-section">
            <h4>Placement Details</h4>
            <PlacementDetailsForm
              placement={selectedPlacement}
              onUpdate={(updates) => handleUpdatePlacement(selectedPlacement.id, updates)}
              loading={loading}
            />
          </div>
        )}

        {/* No selection */}
        {!selectedScene && !selectedPlacement && (
          <div className="inspector-empty-state">
            <div className="empty-icon">📋</div>
            <p>Select a scene or placement to view properties</p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * PlacementCard - Compact view of a placement
 */
const PlacementCard = ({ placement, isSelected, onDelete, loading }) => {
  const getPlacementIcon = () => {
    if (placement.placement_type === 'wardrobe') return '👗';
    if (placement.placement_type === 'asset') {
      const assetType = placement.asset?.type;
      const icons = {
        'PROMO_LALA': '👗',
        'PROMO_GUEST': '🎤',
        'BRAND_LOGO': '🏷️',
        'LOWER_THIRD': '📝',
      };
      return icons[assetType] || '📎';
    }
    return '🎵';
  };

  const getLabel = () => {
    if (placement.label) return placement.label;
    if (placement.placement_type === 'wardrobe') {
      return placement.wardrobeItem?.name || 'Wardrobe';
    }
    if (placement.placement_type === 'asset') {
      return placement.asset?.name || 'Asset';
    }
    return 'Placement';
  };

  const getThumbnail = () => {
    if (placement.placement_type === 'wardrobe') {
      return placement.wardrobeItem?.thumbnail_url || placement.wardrobeItem?.s3_url_processed || placement.wardrobeItem?.s3_url;
    }
    if (placement.placement_type === 'asset') {
      return placement.asset?.s3_url_processed || placement.asset?.s3_url_raw;
    }
    return null;
  };

  const thumbnail = getThumbnail();

  return (
    <div className={`placement-card ${isSelected ? 'selected' : ''}`}>
      <div className="placement-card-header">
        <span className="placement-card-icon">
          {thumbnail ? (
            <img src={thumbnail} alt={getLabel()} className="placement-card-thumbnail" />
          ) : (
            getPlacementIcon()
          )}
        </span>
        <span className="placement-card-label">{getLabel()}</span>
        <button
          onClick={onDelete}
          disabled={loading}
          className="delete-placement-btn"
          title="Remove from timeline"
        >
          ✕
        </button>
      </div>
      <div className="placement-card-meta">
        <span className={`visual-role-badge ${placement.visual_role === 'primary-visual' ? 'primary' : 'overlay'}`}>
          {placement.visual_role === 'primary-visual' ? '🎬 Primary' : '📐 Overlay'}
        </span>
        {placement.attachment_point} + {placement.offset_seconds || 0}s
        {placement.duration && ` • ${placement.duration}s`}
      </div>
    </div>
  );
};

/**
 * PlacementDetailsForm - Detailed editing form for placement
 */
const PlacementDetailsForm = ({ placement, onUpdate, loading }) => {
  const [offsetSeconds, setOffsetSeconds] = useState(placement.offset_seconds || 0);
  const [duration, setDuration] = useState(placement.duration || '');
  const [attachmentPoint, setAttachmentPoint] = useState(placement.attachment_point || 'scene-start');
  const [visualRole, setVisualRole] = useState(placement.visual_role || 'overlay');

  const handleSave = () => {
    onUpdate({
      attachment_point: attachmentPoint,
      offset_seconds: parseFloat(offsetSeconds) || 0,
      duration: duration ? parseFloat(duration) : null,
      visualRole: visualRole,
    });
  };

  return (
    <div className="placement-details-form">
      <div className="form-field">
        <label>Visual Role:</label>
        <select
          value={visualRole}
          onChange={(e) => setVisualRole(e.target.value)}
          className="form-select"
        >
          <option value="primary-visual">🎬 Primary Visual (replaces main video)</option>
          <option value="overlay">📐 Overlay (layers on top)</option>
        </select>
        <div className="form-hint">
          Primary visuals like B-roll replace the main footage, while overlays layer on top
        </div>
      </div>

      <div className="form-field">
        <label>Attachment Point:</label>
        <select
          value={attachmentPoint}
          onChange={(e) => setAttachmentPoint(e.target.value)}
          className="form-select"
        >
          <option value="scene-start">Scene Start</option>
          <option value="scene-middle">Scene Middle</option>
          <option value="scene-end">Scene End</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      <div className="form-field">
        <label>Offset (seconds):</label>
        <input
          type="number"
          value={offsetSeconds}
          onChange={(e) => setOffsetSeconds(e.target.value)}
          step="0.1"
          className="form-input"
        />
      </div>

      {placement.placement_type !== 'wardrobe' && (
        <div className="form-field">
          <label>Duration (seconds):</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            step="0.1"
            placeholder="Auto"
            className="form-input"
          />
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={loading}
        className="save-btn"
      >
        {loading ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
};

// Helper function
const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default TimelineInspectorPanel;
