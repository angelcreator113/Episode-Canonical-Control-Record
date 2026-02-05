import React, { useState } from 'react';
import './Timeline.css';

/**
 * TimelineScene - Individual scene bar on timeline
 */
const TimelineScene = ({ 
  scene, 
  startTime, 
  widthPercent,
  isEditing,
  placements = [],
  selectedPlacementId,
  onEdit,
  onSave,
  onCancel,
  onPlacementClick
}) => {
  const [durationInput, setDurationInput] = useState('');

  const handleEditClick = () => {
    // Handle null/undefined/0 duration
    const duration = scene.duration_seconds || 0;
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    setDurationInput(`${mins}:${secs.toString().padStart(2, '0')}`);
    onEdit();
  };

  const handleSave = () => {
    // Parse MM:SS format
    const parts = durationInput.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0]) || 0;
      const secs = parseInt(parts[1]) || 0;
      const totalSeconds = (mins * 60) + secs;
      
      if (totalSeconds > 0 && totalSeconds <= 3600) { // Max 1 hour
        onSave(totalSeconds);
      } else {
        alert('Duration must be between 0:01 and 60:00');
      }
    } else {
      alert('Invalid format. Use MM:SS (e.g., 2:30)');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  // Scene type colors
  const getSceneColor = () => {
    const colors = {
      intro: '#3b82f6',      // Blue
      standard: '#10b981',   // Green
      main: '#10b981',       // Green (alias)
      transition: '#f59e0b', // Orange
      outro: '#8b5cf6',      // Purple
      montage: '#ec4899',    // Pink
      broll: '#6b7280'       // Gray
    };
    return colors[scene.type] || colors.standard;
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatStartTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className="timeline-scene"
      style={{ 
        width: `${widthPercent}%`,
        background: scene.libraryScene?.thumbnail_url 
          ? `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${scene.libraryScene.thumbnail_url}) center/cover`
          : getSceneColor()
      }}
      onClick={!isEditing ? handleEditClick : undefined}
      title={`${scene.title_override || 'Untitled'} - Click to edit duration`}
    >
      <div className="scene-content">
        <span className="scene-number">#{scene.scene_order}</span>
        <span className="scene-title">{scene.title_override || 'Untitled'}</span>
        
        {isEditing ? (
          <div className="scene-duration-edit" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={durationInput}
              onChange={(e) => setDurationInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="MM:SS"
              autoFocus
              className="duration-input"
            />
            <button onClick={handleSave} className="save-btn">✓</button>
            <button onClick={onCancel} className="cancel-btn">✕</button>
          </div>
        ) : (
          <span className="scene-duration">
            {formatDuration(scene.duration_seconds || 0)}
          </span>
        )}
      </div>

      {/* Placement badges - render at bottom of scene */}
      {placements.length > 0 && (
        <div className="scene-placements" onClick={(e) => e.stopPropagation()}>
          {placements.map(placement => {
            const isWardrobe = placement.placement_type === 'wardrobe';
            const icon = isWardrobe ? '👗' : '📎';
            const label = isWardrobe 
              ? placement.wardrobeItem?.name || 'Wardrobe'
              : placement.asset?.name || 'Asset';
            const isSelected = placement.id === selectedPlacementId;
            
            // Get thumbnail
            const thumbnail = isWardrobe
              ? (placement.wardrobeItem?.thumbnail_url || placement.wardrobeItem?.s3_url_processed || placement.wardrobeItem?.s3_url)
              : (placement.asset?.s3_url_processed || placement.asset?.s3_url_raw);

            return (
              <div
                key={placement.id}
                className={`scene-placement-badge ${isSelected ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onPlacementClick?.(placement);
                }}
                title={label}
              >
                {thumbnail ? (
                  <img src={thumbnail} alt={label} className="scene-badge-thumbnail" />
                ) : (
                  icon
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="scene-tooltip">
        <strong>{scene.title_override || 'Untitled'}</strong><br />
        Type: {scene.type}<br />
        Start: {formatStartTime(startTime)}<br />
        Duration: {formatDuration(scene.duration_seconds || 0)}<br />
        {placements.length > 0 && <>Placements: {placements.length}</>}
      </div>
    </div>
  );
};

export default TimelineScene;
