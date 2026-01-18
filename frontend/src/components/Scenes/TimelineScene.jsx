import React, { useState } from 'react';
import './Timeline.css';

/**
 * TimelineScene - Individual scene bar on timeline
 * Enhanced with drag-to-resize and better visuals
 */
const TimelineScene = ({ 
  scene, 
  startTime, 
  widthPercent,
  isEditing,
  isActive,
  onEdit,
  onSave,
  onCancel,
  onResizeStart
}) => {
  const [durationInput, setDurationInput] = useState('');

  const handleEditClick = (e) => {
    e.stopPropagation();
    const duration = scene.durationSeconds || 0;
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    setDurationInput(`${mins}:${secs.toString().padStart(2, '0')}`);
    onEdit();
  };

  const handleSave = () => {
    const parts = durationInput.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0]) || 0;
      const secs = parseInt(parts[1]) || 0;
      const totalSeconds = (mins * 60) + secs;
      
      if (totalSeconds > 0 && totalSeconds <= 3600) {
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

  const getSceneColor = () => {
    const colors = {
      intro: '#3b82f6',
      main: '#10b981',
      transition: '#f59e0b',
      outro: '#8b5cf6',
      montage: '#ec4899',
      broll: '#6b7280'
    };
    return colors[scene.sceneType] || colors.main;
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
      className={`timeline-scene ${isActive ? 'active' : ''} ${isEditing ? 'editing' : ''}`}
      style={{ 
        width: '100%',
        height: '100%',
        background: getSceneColor(),
        position: 'relative'
      }}
      onClick={!isEditing ? handleEditClick : undefined}
      title={`${scene.title} - Click to edit`}
    >
      {/* Scene content */}
      <div className="scene-content">
        <span className="scene-number">#{scene.sceneNumber || scene.index + 1}</span>
        <span className="scene-title">{scene.title}</span>
        
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
            {formatDuration(scene.durationSeconds || 0)}
          </span>
        )}
      </div>

      {/* Resize handle */}
      {!isEditing && (
        <div 
          className="scene-resize-handle"
          onMouseDown={onResizeStart}
          onClick={(e) => e.stopPropagation()}
          title="Drag to resize"
        >
          <div className="resize-handle-icon">⋮</div>
        </div>
      )}

      {/* Tooltip */}
      <div className="scene-tooltip">
        <strong>{scene.title}</strong><br />
        Type: {scene.sceneType}<br />
        Start: {formatStartTime(startTime)}<br />
        Duration: {formatDuration(scene.durationSeconds || 0)}<br />
        {scene.location && <><br />📍 {scene.location}</>}
        {scene.characters && scene.characters.length > 0 && (
          <><br />👥 {scene.characters.join(', ')}</>
        )}
      </div>
    </div>
  );
};

export default TimelineScene;
