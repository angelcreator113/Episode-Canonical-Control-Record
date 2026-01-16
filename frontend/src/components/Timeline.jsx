import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import TimelineRuler from './TimelineRuler';
import { SortableTimelineScene } from './SortableTimelineScene';
import AssetOverlay from './AssetOverlay';
import sceneService from '../services/sceneService';
import './Timeline.css';

/**
 * Timeline Component - Visual timeline editor for episode scenes
 * Shows scenes as horizontal bars with duration visualization
 */
const Timeline = ({ episodeId }) => {
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(100); // Zoom percentage
  const [editingSceneId, setEditingSceneId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [assets, setAssets] = useState([]); // NEW: Episode assets
  const [showAssets, setShowAssets] = useState(true); // NEW: Toggle asset overlay

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement to activate drag
      },
    })
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Don't trigger if editing
      if (editingSceneId) return;

      switch(e.key) {
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
        case '_':
          handleZoomOut();
          break;
        case '0':
          handleZoomReset();
          break;
        case 'e':
        case 'E':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleExportTimeline();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [editingSceneId, zoom]);

  // Load scenes
  useEffect(() => {
    if (episodeId) {
      loadScenes();
      loadAssets();
    }
  }, [episodeId]);

  const loadScenes = async () => {
    setLoading(true);
    try {
      const response = await sceneService.getEpisodeScenes(episodeId);
      setScenes(response.data || []);
    } catch (error) {
      console.error('Error loading scenes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAssets = async () => {
    try {
      // Mock assets for now - replace with actual API call
      // const response = await assetService.getEpisodeAssets(episodeId);
      const mockAssets = [
        {
          id: '1',
          name: 'Lala Promo',
          type: 'PROMO_LALA',
          start_time: 0,
          url: '/assets/lala-promo.png'
        },
        {
          id: '2',
          name: 'Guest Intro',
          type: 'PROMO_GUEST',
          start_time: 120,
          url: '/assets/guest-promo.png'
        },
        {
          id: '3',
          name: 'Brand Logo',
          type: 'BRAND_LOGO',
          start_time: 300,
          url: '/assets/brand-logo.png'
        }
      ];
      setAssets(mockAssets);
    } catch (error) {
      console.error('Error loading assets:', error);
    }
  };

  // Calculate total episode duration
  const totalDuration = scenes.reduce((sum, scene) => {
    return sum + (scene.duration_seconds || 0);
  }, 0);

  // Format duration (seconds to MM:SS)
  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle zoom
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50));
  };

  const handleZoomReset = () => {
    setZoom(100);
  };

  // Handle scene duration edit
  const handleEditDuration = async (sceneId, newDuration) => {
    try {
      await sceneService.updateScene(sceneId, {
        duration_seconds: newDuration
      });
      await loadScenes(); // Reload to get updated data
      setEditingSceneId(null);
    } catch (error) {
      console.error('Error updating scene duration:', error);
      alert('Failed to update scene duration');
    }
  };

  // Handle drag start
  const handleDragStart = () => {
    setIsDragging(true);
  };

  // Handle drag end - reorder scenes
  const handleDragEnd = async (event) => {
    setIsDragging(false);
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = scenes.findIndex((scene) => scene.id === active.id);
    const newIndex = scenes.findIndex((scene) => scene.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Reorder locally (optimistic update)
    const reorderedScenes = arrayMove(scenes, oldIndex, newIndex);

    // Update scene numbers
    const updatedScenes = reorderedScenes.map((scene, index) => ({
      ...scene,
      scene_number: index + 1,
    }));

    setScenes(updatedScenes);
    setIsReordering(true);

    try {
      // Call API to save new order
      const sceneIds = updatedScenes.map(s => s.id);
      await sceneService.reorderScenes(episodeId, sceneIds);
      
      // Reload to get server-side state
      await loadScenes();
    } catch (error) {
      console.error('Error reordering scenes:', error);
      alert(`Failed to reorder scenes: ${error.message}`);
      // Reload to revert to server state
      await loadScenes();
    } finally {
      setIsReordering(false);
    }
  };

  // Calculate scene position (cumulative duration)
  const getScenePosition = (sceneIndex) => {
    return scenes.slice(0, sceneIndex).reduce((sum, scene) => {
      return sum + (scene.duration_seconds || 0);
    }, 0);
  };

  // Export timeline as JSON
  const handleExportTimeline = () => {
    const timelineData = {
      episode_id: episodeId,
      total_duration: totalDuration,
      exported_at: new Date().toISOString(),
      scenes: scenes.map((scene, index) => ({
        scene_number: scene.scene_number,
        id: scene.id,
        title: scene.title,
        scene_type: scene.scene_type,
        start_time: getScenePosition(index),
        duration_seconds: scene.duration_seconds,
        end_time: getScenePosition(index) + (scene.duration_seconds || 0),
      })),
      assets: assets.map(asset => ({
        id: asset.id,
        name: asset.name,
        type: asset.type,
        start_time: asset.start_time,
      }))
    };

    // Download as JSON
    const blob = new Blob([JSON.stringify(timelineData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timeline-${episodeId}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="timeline-loading">
        <div className="spinner"></div>
        <p>Loading timeline...</p>
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className="timeline-empty">
        <p>📽️ No scenes yet. Add scenes to see the timeline.</p>
      </div>
    );
  }

  return (
    <div className="timeline-container">
      {/* Header */}
      <div className="timeline-header">
        <div className="timeline-info">
          <h3>Episode Timeline</h3>
          <span className="timeline-duration">
            Total: {formatDuration(totalDuration)}
          </span>
          <span className="timeline-count">
            {scenes.length} scene{scenes.length !== 1 ? 's' : ''}
          </span>
          {assets.length > 0 && (
            <button 
              onClick={() => setShowAssets(!showAssets)}
              className={`asset-toggle ${showAssets ? 'active' : ''}`}
              title="Toggle asset overlay"
            >
              📎 Assets {showAssets ? '✓' : ''}
            </button>
          )}
        </div>

        <div className="timeline-controls">
          <button 
            onClick={handleExportTimeline}
            className="export-btn"
            title="Export timeline (Ctrl+E)"
          >
            💾 Export
          </button>
          <button 
            onClick={handleZoomOut}
            className="zoom-btn"
            disabled={zoom <= 50}
            title="Zoom out (-)"
          >
            −
          </button>
          <span className="zoom-level" onClick={handleZoomReset}>
            {zoom}%
          </span>
          <button 
            onClick={handleZoomIn}
            className="zoom-btn"
            disabled={zoom >= 200}
            title="Zoom in (+)"
          >
            +
          </button>
        </div>
      </div>

      {/* Timeline Ruler */}
      <TimelineRuler 
        totalDuration={totalDuration}
        zoom={zoom}
      />

      {/* Asset Overlay */}
      {showAssets && assets.length > 0 && (
        <AssetOverlay 
          assets={assets}
          totalDuration={totalDuration}
          zoom={zoom}
        />
      )}

      {/* Reordering indicator */}
      {isReordering && (
        <div className="timeline-reordering">
          💾 Saving new order...
        </div>
      )}

      {/* Timeline Track with Drag-Drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={scenes.map(s => s.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className={`timeline-track ${isDragging ? 'dragging' : ''}`} style={{ width: `${zoom}%` }}>
            {scenes.map((scene, index) => {
              const startTime = getScenePosition(index);
              const duration = scene.duration_seconds || 0;
              const widthPercent = totalDuration > 0 
                ? (duration / totalDuration) * 100 
                : 0;

              return (
                <SortableTimelineScene
                  key={scene.id}
                  scene={scene}
                  startTime={startTime}
                  widthPercent={widthPercent}
                  isEditing={editingSceneId === scene.id}
                  isDragging={isDragging}
                  onEdit={() => setEditingSceneId(scene.id)}
                  onSave={(newDuration) => handleEditDuration(scene.id, newDuration)}
                  onCancel={() => setEditingSceneId(null)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Timeline Footer */}
      <div className="timeline-footer">
        <span>💡 Click to edit • Drag to reorder • +/- to zoom • Ctrl+E to export</span>
      </div>
    </div>
  );
};

export default Timeline;
