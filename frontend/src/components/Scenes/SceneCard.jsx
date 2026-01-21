import React from 'react';
import './SceneCard.css';

const SceneCard = ({ 
  scene, 
  onEdit, 
  onDelete, 
  onStatusChange,
  onDuplicate,
  isDragging = false 
}) => {
  const statusColors = {
    draft: 'status-draft',
    storyboarded: 'status-storyboarded',
    recorded: 'status-recorded',
    edited: 'status-edited',
    complete: 'status-complete'
  };

  const sceneTypeIcons = {
    intro: '🎬',
    main: '📽️',
    transition: '🔄',
    outro: '👋',
    montage: '🎞️',
    broll: '📹'
  };

  const moodEmojis = {
    upbeat: '😊',
    serious: '😐',
    comedic: '😄',
    dramatic: '😱',
    suspenseful: '😰',
    neutral: '😶'
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimecode = (tc) => {
    return tc || '--:--:--';
  };

  // NEW: Generate thumbnail URL or fallback
  const getThumbnailStyle = () => {
    if (scene.thumbnail && scene.thumbnail.url) {
      return {
        backgroundImage: `url(${scene.thumbnail.url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
    // Fallback gradient based on scene type
    const gradients = {
      intro: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      main: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      transition: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      outro: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      montage: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      broll: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)'
    };
    return {
      background: gradients[scene.sceneType] || gradients.main
    };
  };

  return (
    <div 
      className={`scene-card ${isDragging ? 'dragging' : ''} ${scene.isLocked ? 'locked' : ''}`}
      data-scene-id={scene.id}
    >
      {/* NEW: Thumbnail Preview */}
      <div 
        className="scene-thumbnail-preview"
        style={getThumbnailStyle()}
      >
        {!scene.thumbnail?.url && (
          <div className="thumbnail-placeholder">
            <span className="placeholder-icon">
              {sceneTypeIcons[scene.sceneType] || '🎬'}
            </span>
          </div>
        )}
        {scene.isLocked && (
          <div className="locked-overlay">
            <span className="lock-icon">🔒</span>
          </div>
        )}
      </div>

      {/* Scene Header */}
      <div className="scene-header">
        <div className="scene-number-badge">
          #{scene.sceneNumber || scene.id}
        </div>
        <div className="scene-type-badge">
          <span className="type-icon">{sceneTypeIcons[scene.sceneType] || '📽️'}</span>
          <span className="type-label">{scene.sceneType}</span>
        </div>
      </div>

      {/* Scene Title */}
      <h3 className="scene-title">{scene.title || 'Untitled Scene'}</h3>

      {/* Scene Description */}
      {scene.description && (
        <p className="scene-description">{scene.description}</p>
      )}

      {/* Scene Metadata Grid */}
      <div className="scene-metadata-grid">
        <div className="metadata-item">
          <span className="metadata-icon">⏱️</span>
          <div>
            <div className="metadata-label">Duration</div>
            <div className="metadata-value">{formatDuration(scene.durationSeconds)}</div>
          </div>
        </div>

        {scene.location && (
          <div className="metadata-item">
            <span className="metadata-icon">📍</span>
            <div>
              <div className="metadata-label">Location</div>
              <div className="metadata-value">{scene.location}</div>
            </div>
          </div>
        )}

        {scene.mood && (
          <div className="metadata-item">
            <span className="metadata-icon">{moodEmojis[scene.mood]}</span>
            <div>
              <div className="metadata-label">Mood</div>
              <div className="metadata-value">{scene.mood}</div>
            </div>
          </div>
        )}

        {scene.startTimecode && (
          <div className="metadata-item">
            <span className="metadata-icon">🎬</span>
            <div>
              <div className="metadata-label">Timecode</div>
              <div className="metadata-value">{formatTimecode(scene.startTimecode)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Characters */}
      {scene.characters && scene.characters.length > 0 && (
        <div className="scene-characters">
          <span className="characters-label">Characters:</span>
          <div className="characters-list">
            {scene.characters.slice(0, 3).map((char, idx) => (
              <span key={idx} className="character-tag">{char}</span>
            ))}
            {scene.characters.length > 3 && (
              <span className="character-tag more">+{scene.characters.length - 3}</span>
            )}
          </div>
        </div>
      )}

      {/* Footer with Status and Actions */}
      <div className="scene-footer">
        <select
          id={`status-${scene.id}`}
          value={scene.productionStatus || 'draft'}
          onChange={(e) => onStatusChange && onStatusChange(scene.id, e.target.value)}
          className={`status-select ${statusColors[scene.productionStatus] || 'status-draft'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="draft">Draft</option>
          <option value="storyboarded">Storyboarded</option>
          <option value="recorded">Recorded</option>
          <option value="edited">Edited</option>
          <option value="complete">Complete</option>
        </select>

        <div className="scene-actions">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit && onEdit(scene);
            }}
            className="btn-edit"
            title="Edit scene"
          >
            ✏️ Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate && onDuplicate(scene.id);
            }}
            className="btn-duplicate"
            title="Duplicate scene"
          >
            📋 Duplicate
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete && onDelete(scene.id);
            }}
            className="btn-delete"
            title="Delete scene"
          >
            🗑️ Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default SceneCard;
