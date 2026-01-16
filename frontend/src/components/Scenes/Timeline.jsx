import React, { useState } from 'react';
import TimelineRuler from './TimelineRuler';
import TimelineScene from './TimelineScene';
import './Timeline.css';

const Timeline = ({ scenes, onSceneUpdate }) => {
  const [zoom, setZoom] = useState(100);
  const [editingSceneId, setEditingSceneId] = useState(null);

  // Calculate total duration and positions
  const totalDuration = scenes.reduce((sum, scene) => sum + (scene.durationSeconds || 0), 0);

  // Calculate scene positions and widths
  const scenePositions = [];
  let currentTime = 0;
  
  scenes.forEach(scene => {
    const duration = scene.durationSeconds || 0;
    const widthPercent = totalDuration > 0 ? (duration / totalDuration) * 100 : 0;
    const leftPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
    
    scenePositions.push({
      ...scene,
      startTime: currentTime,
      widthPercent,
      leftPercent
    });
    
    currentTime += duration;
  });

  const handleEditScene = (sceneId) => {
    setEditingSceneId(sceneId);
  };

  const handleSaveDuration = async (sceneId, newDuration) => {
    try {
      await onSceneUpdate(sceneId, { durationSeconds: newDuration });
      setEditingSceneId(null);
    } catch (error) {
      console.error('Failed to update duration:', error);
      alert('Failed to update duration');
    }
  };

  const handleCancel = () => {
    setEditingSceneId(null);
  };

  if (!scenes || scenes.length === 0) {
    return (
      <div className="timeline-container">
        <div className="timeline-header">
          <h3>📊 Episode Timeline</h3>
        </div>
        <div className="timeline-empty">
          <div className="timeline-empty-icon">🎬</div>
          <p>Add scenes to see them on the timeline</p>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <h3>📊 Episode Timeline</h3>
        <div className="timeline-controls">
          <div className="zoom-control">
            <span className="zoom-label">Zoom:</span>
            <input
              type="range"
              min="50"
              max="200"
              value={zoom}
              onChange={(e) => setZoom(parseInt(e.target.value))}
              className="zoom-slider"
            />
            <span className="zoom-label">{zoom}%</span>
          </div>
        </div>
      </div>

      <div className="timeline-track">
        <TimelineRuler totalDuration={totalDuration} zoom={zoom} />
        
        <div className="timeline-scenes-container" style={{ width: `${zoom}%` }}>
          {scenePositions.map((scene) => (
            <div
              key={scene.id}
              style={{
                position: 'absolute',
                left: `${scene.leftPercent}%`,
                width: `${scene.widthPercent}%`,
                height: '50px'
              }}
            >
              <TimelineScene
                scene={scene}
                startTime={scene.startTime}
                widthPercent={100}
                isEditing={editingSceneId === scene.id}
                onEdit={() => handleEditScene(scene.id)}
                onSave={(duration) => handleSaveDuration(scene.id, duration)}
                onCancel={handleCancel}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Timeline;
