import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Group, Transformer } from 'react-konva';
import useImage from 'use-image';
import './CanvasEditor.css';

// Logical canvas dimensions (fixed)
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

/**
 * CanvasEditor - Spatial editor with 1920x1080 logical coordinate system
 * Not just a preview - this is where visual editing happens
 */
const CanvasEditor = ({ 
  scenes = [], 
  placements = [],
  selectedScene,
  selectedPlacement,
  currentTime,
  totalDuration,
  isPlaying,
  onSeek,
  onPlayPause,
  onStepForward,
  onStepBackward,
  onOverlayUpdate,
  onOverlaySelect
}) => {
  const stageRef = useRef(null);
  const viewportRef = useRef(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0, scale: 1 });

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate viewport scale to fit 1920x1080 canvas
  useEffect(() => {
    const updateSize = () => {
      if (!viewportRef.current) return;
      
      const containerWidth = viewportRef.current.offsetWidth;
      const containerHeight = viewportRef.current.offsetHeight;
      
      // Calculate scale to fit canvas while maintaining aspect ratio
      const scaleX = containerWidth / CANVAS_WIDTH;
      const scaleY = containerHeight / CANVAS_HEIGHT;
      const scale = Math.min(scaleX, scaleY);
      
      setViewportSize({
        width: containerWidth,
        height: containerHeight,
        scale: scale
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Get current scene based on currentTime (using absolute start_time_seconds)
  const getCurrentScene = () => {
    // Find scene that spans currentTime
    for (const scene of scenes) {
      const startTime = scene.start_time_seconds || 0;
      const duration = scene.effectiveDuration || scene.duration_seconds || 0;
      const endTime = startTime + duration;
      
      if (currentTime >= startTime && currentTime < endTime) {
        return scene;
      }
    }
    
    // If no scene found, return the scene closest to currentTime
    if (scenes.length === 0) return null;
    
    // Find closest scene
    let closestScene = scenes[0];
    let minDistance = Math.abs(currentTime - (scenes[0].start_time_seconds || 0));
    
    for (const scene of scenes) {
      const startTime = scene.start_time_seconds || 0;
      const distance = Math.abs(currentTime - startTime);
      if (distance < minDistance) {
        minDistance = distance;
        closestScene = scene;
      }
    }
    
    return closestScene;
  };

  // Get overlays visible at current time
  const getVisibleOverlays = () => {
    const visible = placements.filter(placement => {
      const startTime = placement.start_time_seconds || 0;
      const duration = placement.duration_seconds || 0;
      const endTime = startTime + duration;
      
      // For zero-duration items, show them if currentTime matches startTime
      const isInTimeRange = duration === 0 
        ? currentTime === startTime
        : (currentTime >= startTime && currentTime < endTime);
      
      const hasVisualRole = placement.visual_role && placement.visual_role !== 'none';
      
      return isInTimeRange && hasVisualRole;
    });
    
    return visible;
  };

  const currentScene = getCurrentScene();
  const visibleOverlays = getVisibleOverlays();

  // Get background image/video
  const getBackgroundUrl = () => {
    if (!currentScene?.libraryScene) return null;
    return currentScene.libraryScene.thumbnail_url || currentScene.libraryScene.video_asset_url;
  };

  const backgroundUrl = getBackgroundUrl();
  
  // Handle overlay selection on canvas - sync with timeline
  const handleOverlayClick = (overlay) => {
    if (onOverlaySelect) {
      onOverlaySelect(overlay);
    }
  };

  // Handle overlay drag
  const handleOverlayDragEnd = (overlay, e) => {
    const node = e.target;
    const newTransform = {
      ...overlay.transform,
      x: node.x(),
      y: node.y()
    };
    
    if (onOverlayUpdate) {
      onOverlayUpdate(overlay.id, { transform: newTransform });
    }
  };

  return (
    <div className="canvas-editor">
      {/* Canvas Header */}
      <div className="canvas-header">
        <div className="canvas-title">
          <span className="canvas-label">Canvas</span>
          <span className="canvas-separator">—</span>
          <span className="canvas-context">
            {currentScene ? `Scene ${currentScene.scene_order}` : 'No scene'}
          </span>
        </div>
        <div className="canvas-info">
          <span className="canvas-resolution">1920 × 1080</span>
        </div>
      </div>

      {/* Konva Stage - Logical 1920x1080 canvas */}
      <div className="canvas-viewport" ref={viewportRef}>
        {viewportSize.width > 0 && (
          <Stage
            ref={stageRef}
            width={CANVAS_WIDTH * viewportSize.scale}
            height={CANVAS_HEIGHT * viewportSize.scale}
            scaleX={viewportSize.scale}
            scaleY={viewportSize.scale}
          >
            <Layer>
              {/* Background Layer - Scene thumbnail/video */}
              {backgroundUrl && (
                <BackgroundImage
                  url={backgroundUrl}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                />
              )}

              {/* Overlay Layer - Placements */}
              {visibleOverlays.map(overlay => (
                <OverlayElement
                  key={overlay.id}
                  overlay={overlay}
                  isSelected={selectedPlacement?.id === overlay.id}
                  onClick={() => handleOverlayClick(overlay)}
                  onDragEnd={(e) => handleOverlayDragEnd(overlay, e)}
                />
              ))}
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  );
};

/**
 * Background Image Component
 */
const BackgroundImage = ({ url, width, height }) => {
  const [image] = useImage(url);
  
  return (
    <KonvaImage
      image={image}
      width={width}
      height={height}
      listening={false}
    />
  );
};

/**
 * Overlay Element Component
 */
const OverlayElement = ({ overlay, isSelected, onClick, onDragEnd }) => {
  const transformerRef = useRef(null);
  const imageRef = useRef(null);

  // Get overlay image URL
  const asset = overlay.asset || overlay.wardrobeItem;
  const imageUrl = asset?.s3_url_processed || asset?.s3_url_raw || asset?.thumbnail_url;
  
  const [image] = useImage(imageUrl || '');

  // Get transform data (with defaults)
  const transform = overlay.transform || {
    x: 960,
    y: 540,
    width: 400,
    height: 300,
    rotation: 0,
    scale: 1.0
  };

  // Attach transformer when selected
  useEffect(() => {
    if (isSelected && transformerRef.current && imageRef.current) {
      transformerRef.current.nodes([imageRef.current]);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  if (!image) return null;

  return (
    <>
      <KonvaImage
        ref={imageRef}
        image={image}
        x={transform.x}
        y={transform.y}
        width={transform.width}
        height={transform.height}
        rotation={transform.rotation}
        scaleX={transform.scale}
        scaleY={transform.scale}
        offsetX={transform.width / 2}
        offsetY={transform.height / 2}
        draggable
        onClick={onClick}
        onDragEnd={onDragEnd}
      />
      {isSelected && (
        <Transformer
          ref={transformerRef}
          rotateEnabled={true}
          borderStroke="#3b82f6"
          borderStrokeWidth={2}
          anchorFill="#3b82f6"
          anchorStroke="#fff"
          anchorSize={8}
        />
      )}
    </>
  );
};

export default CanvasEditor;
