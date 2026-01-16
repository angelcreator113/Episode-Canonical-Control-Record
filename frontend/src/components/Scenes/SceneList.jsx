import React from 'react';
import SceneCard from './SceneCard';
import './SceneList.css';

const SceneList = ({ 
  scenes, 
  loading, 
  error,
  onSceneEdit,
  onSceneDelete,
  onStatusChange,
  onSceneSelect,
  emptyMessage = "No scenes yet. Create your first scene!"
}) => {
  if (loading) {
    return (
      <div className="scene-list-loading">
        <div className="spinner"></div>
        <p>Loading scenes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="scene-list-error">
        <span className="error-icon">⚠️</span>
        <p>{error}</p>
      </div>
    );
  }

  if (!scenes || scenes.length === 0) {
    return (
      <div className="scene-list-empty">
        <span className="empty-icon">🎬</span>
        <h3>No Scenes Yet</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="scene-list">
      <div className="scene-list-header">
        <h2>Scenes ({scenes.length})</h2>
        <div className="scene-list-stats">
          <span className="stat">
            📊 Total Duration: {formatTotalDuration(scenes)}
          </span>
        </div>
      </div>

      <div className="scene-grid">
        {scenes.map((scene, index) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            onEdit={onSceneEdit}
            onDelete={onSceneDelete}
            onStatusChange={onStatusChange}
            onClick={() => onSceneSelect && onSceneSelect(scene)}
          />
        ))}
      </div>
    </div>
  );
};

// Helper function to calculate total duration
const formatTotalDuration = (scenes) => {
  const totalSeconds = scenes.reduce((sum, scene) => {
    return sum + (scene.durationSeconds || 0);
  }, 0);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};

export default SceneList;
