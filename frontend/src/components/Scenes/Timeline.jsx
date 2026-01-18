import React, { useState, useRef, useEffect } from 'react';
import TimelineRuler from './TimelineRuler';
import TimelineScene from './TimelineScene';
import './Timeline.css';

const Timeline = ({ scenes = [], onSceneUpdate, onSceneReorder }) => {
  const [zoom, setZoom] = useState(100);
  const [editingSceneId, setEditingSceneId] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [draggedScene, setDraggedScene] = useState(null);
  const timelineRef = useRef(null);
  const playIntervalRef = useRef(null);

  // Calculate total duration and positions
  const totalDuration = scenes.reduce((sum, scene) => sum + (scene.durationSeconds || 0), 0);

  // Calculate scene positions and widths
  const scenePositions = [];
  let currentTimeAcc = 0;
  
  scenes.forEach((scene, index) => {
    const duration = scene.durationSeconds || 0;
    const widthPercent = totalDuration > 0 ? (duration / totalDuration) * 100 : 0;
    const leftPercent = totalDuration > 0 ? (currentTimeAcc / totalDuration) * 100 : 0;
    
    scenePositions.push({
      ...scene,
      index,
      startTime: currentTimeAcc,
      endTime: currentTimeAcc + duration,
      widthPercent,
      leftPercent
    });
    
    currentTimeAcc += duration;
  });

  // Playback controls
  const handlePlayPause = () => {
    if (isPlaying) {
      clearInterval(playIntervalRef.current);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      playIntervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + 0.1;
          if (next >= totalDuration) {
            clearInterval(playIntervalRef.current);
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }, 100);
    }
  };

  const handleReset = () => {
    clearInterval(playIntervalRef.current);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentX = (clickX / rect.width) * (100 / zoom) * 100;
    const newTime = (percentX / 100) * totalDuration;
    
    setCurrentTime(Math.max(0, Math.min(totalDuration, newTime)));
  };

  // Scene editing
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

  // Drag to resize
  const handleResizeStart = (sceneId, e) => {
    e.stopPropagation();
    setDraggedScene(sceneId);
  };

  const handleResizeMove = (e) => {
    if (!draggedScene || !timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const percentX = (mouseX / rect.width) * (100 / zoom) * 100;
    const time = (percentX / 100) * totalDuration;
    
    const scene = scenePositions.find(s => s.id === draggedScene);
    if (scene) {
      const newDuration = Math.max(1, time - scene.startTime);
      // Update in real-time (optimistic)
      handleSaveDuration(draggedScene, Math.round(newDuration));
    }
  };

  const handleResizeEnd = () => {
    setDraggedScene(null);
  };

  useEffect(() => {
    if (draggedScene) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [draggedScene]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, []);

  if (!scenes || scenes.length === 0) {
    return (
      <div className="timeline-container">
        <div className="timeline-header">
          <h3>📊 Episode Timeline</h3>
        </div>
        <div className="timeline-empty">
          <div className="timeline-empty-icon">🎬</div>
          <p>Add scenes to see them on the timeline</p>
          <p className="timeline-empty-hint">Scenes will appear as colored bars showing their duration and sequence</p>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <div className="timeline-header-left">
          <h3>📊 Episode Timeline</h3>
          <span className="timeline-duration-badge">
            Total: {Math.floor(totalDuration / 60)}:{(totalDuration % 60).toString().padStart(2, '0')}
          </span>
        </div>
        
        <div className="timeline-controls">
          {/* Playback controls */}
          <div className="playback-controls">
            <button 
              onClick={handlePlayPause}
              className={`playback-btn ${isPlaying ? 'playing' : ''}`}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button 
              onClick={handleReset}
              className="playback-btn"
              title="Reset to start"
            >
              ⏹
            </button>
            <span className="current-time-display">
              {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
            </span>
          </div>

          {/* Zoom control */}
          <div className="zoom-control">
            <button 
              onClick={() => setZoom(Math.max(50, zoom - 25))}
              className="zoom-btn"
              title="Zoom out"
            >
              −
            </button>
            <span className="zoom-label">{zoom}%</span>
            <button 
              onClick={() => setZoom(Math.min(400, zoom + 25))}
              className="zoom-btn"
              title="Zoom in"
            >
              +
            </button>
            <input
              type="range"
              min="50"
              max="400"
              step="25"
              value={zoom}
              onChange={(e) => setZoom(parseInt(e.target.value))}
              className="zoom-slider"
            />
          </div>

          {/* Reset zoom */}
          <button 
            onClick={() => setZoom(100)}
            className="reset-zoom-btn"
            title="Reset zoom to 100%"
          >
            ↻
          </button>
        </div>
      </div>

      <div 
        className="timeline-track"
        ref={timelineRef}
        onClick={handleSeek}
      >
        <TimelineRuler 
          totalDuration={totalDuration} 
          zoom={zoom}
          currentTime={currentTime}
        />
        
        <div className="timeline-scenes-container" style={{ width: `${zoom}%` }}>
          {scenePositions.map((scene) => (
            <div
              key={scene.id}
              className="timeline-scene-wrapper"
              style={{
                position: 'absolute',
                left: `${scene.leftPercent}%`,
                width: `${scene.widthPercent}%`,
                height: '60px',
                top: '40px'
              }}
            >
              <TimelineScene
                scene={scene}
                startTime={scene.startTime}
                widthPercent={100}
                isEditing={editingSceneId === scene.id}
                isActive={currentTime >= scene.startTime && currentTime <= scene.endTime}
                onEdit={() => handleEditScene(scene.id)}
                onSave={(duration) => handleSaveDuration(scene.id, duration)}
                onCancel={handleCancel}
                onResizeStart={(e) => handleResizeStart(scene.id, e)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Timeline legend */}
      <div className="timeline-legend">
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#3b82f6' }}></span>
          <span>Intro</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#10b981' }}></span>
          <span>Main</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#f59e0b' }}></span>
          <span>Transition</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#8b5cf6' }}></span>
          <span>Outro</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#ec4899' }}></span>
          <span>Montage</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#6b7280' }}></span>
          <span>B-Roll</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="timeline-instructions">
        <p>💡 <strong>Tips:</strong> Click scenes to edit duration • Drag right edge to resize • Click timeline to seek • Use playback controls to preview</p>
      </div>
    </div>
  );
};

export default Timeline;
