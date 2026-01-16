import React, { useRef, useEffect, useState, useCallback } from 'react';
import './Timeline.css';

const CanvasTimeline = ({ scenes, onSceneUpdate }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(100);
  const [panOffset, setPanOffset] = useState(0);
  const [hoveredScene, setHoveredScene] = useState(null);
  const [selectedScene, setSelectedScene] = useState(null);
  const [draggingScene, setDraggingScene] = useState(null);
  const [resizingScene, setResizingScene] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Canvas dimensions
  const CANVAS_HEIGHT = 200;
  const RULER_HEIGHT = 30;
  const TRACK_HEIGHT = 60;
  const TRACK_TOP = RULER_HEIGHT + 20;

  // Scene type colors
  const SCENE_COLORS = {
    intro: '#3b82f6',
    main: '#10b981',
    transition: '#f59e0b',
    outro: '#8b5cf6',
    montage: '#ec4899',
    broll: '#6b7280'
  };

  // Calculate total duration and scene positions
  const totalDuration = scenes.reduce((sum, scene) => sum + (scene.durationSeconds || 0), 0);
  
  const scenePositions = useCallback(() => {
    const positions = [];
    let currentTime = 0;
    
    scenes.forEach(scene => {
      const duration = scene.durationSeconds || 0;
      positions.push({
        ...scene,
        startTime: currentTime,
        endTime: currentTime + duration,
        duration
      });
      currentTime += duration;
    });
    
    return positions;
  }, [scenes]);

  // Convert time to pixel position
  const timeToX = useCallback((time, canvasWidth) => {
    if (totalDuration === 0) return 0;
    const baseX = (time / totalDuration) * canvasWidth;
    return (baseX * zoom / 100) + panOffset;
  }, [totalDuration, zoom, panOffset]);

  // Convert pixel position to time
  const xToTime = useCallback((x, canvasWidth) => {
    if (totalDuration === 0) return 0;
    const adjustedX = (x - panOffset) / (zoom / 100);
    return (adjustedX / canvasWidth) * totalDuration;
  }, [totalDuration, zoom, panOffset]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Draw the timeline
  const drawTimeline = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, width, height);

    // Draw ruler
    drawRuler(ctx, width);

    // Draw scenes
    const positions = scenePositions();
    positions.forEach((scene, index) => {
      drawScene(ctx, scene, index, width);
    });

    // Draw hover tooltip
    if (hoveredScene !== null) {
      drawTooltip(ctx, positions[hoveredScene], width);
    }
  }, [scenes, zoom, panOffset, hoveredScene, scenePositions]);

  // Draw ruler with time markers
  const drawRuler = (ctx, width) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, RULER_HEIGHT);
    
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, RULER_HEIGHT);
    ctx.lineTo(width, RULER_HEIGHT);
    ctx.stroke();

    // Calculate interval based on total duration and zoom
    const getInterval = () => {
      const visibleDuration = totalDuration / (zoom / 100);
      if (visibleDuration <= 120) return 15;
      if (visibleDuration <= 300) return 30;
      if (visibleDuration <= 600) return 60;
      return 120;
    };

    const interval = getInterval();
    
    for (let time = 0; time <= totalDuration; time += interval) {
      const x = timeToX(time, width);
      if (x < 0 || x > width) continue;

      // Draw tick
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, RULER_HEIGHT - 10);
      ctx.lineTo(x, RULER_HEIGHT);
      ctx.stroke();

      // Draw time label
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(formatTime(time), x, RULER_HEIGHT - 15);
    }
  };

  // Draw individual scene
  const drawScene = (ctx, scene, index, width) => {
    const x1 = timeToX(scene.startTime, width);
    const x2 = timeToX(scene.endTime, width);
    const sceneWidth = x2 - x1;

    // Skip if scene is off-screen
    if (x2 < 0 || x1 > width) return;

    const isHovered = hoveredScene === index;
    const isSelected = selectedScene === index;

    // Draw scene bar
    const color = SCENE_COLORS[scene.sceneType] || SCENE_COLORS.main;
    ctx.fillStyle = color;
    
    if (isSelected) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 10;
    }
    
    ctx.fillRect(x1, TRACK_TOP, sceneWidth, TRACK_HEIGHT);
    ctx.shadowBlur = 0;

    // Draw border
    ctx.strokeStyle = isHovered || isSelected ? '#1f2937' : 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = isHovered || isSelected ? 2 : 1;
    ctx.strokeRect(x1, TRACK_TOP, sceneWidth, TRACK_HEIGHT);

    // Draw scene content if wide enough
    if (sceneWidth > 60) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      
      // Scene number
      ctx.fillText(`#${scene.sceneNumber || scene.id}`, x1 + 8, TRACK_TOP + 18);
      
      // Scene title (truncated)
      ctx.font = '10px sans-serif';
      const title = scene.title || 'Untitled';
      const maxWidth = sceneWidth - 16;
      ctx.fillText(truncateText(ctx, title, maxWidth), x1 + 8, TRACK_TOP + 33);
      
      // Duration
      ctx.fillText(formatTime(scene.duration), x1 + 8, TRACK_TOP + 48);
    }

    // Draw resize handles if selected
    if (isSelected) {
      // Left handle
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x1, TRACK_TOP, 4, TRACK_HEIGHT);
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1;
      ctx.strokeRect(x1, TRACK_TOP, 4, TRACK_HEIGHT);
      
      // Right handle
      ctx.fillRect(x2 - 4, TRACK_TOP, 4, TRACK_HEIGHT);
      ctx.strokeRect(x2 - 4, TRACK_TOP, 4, TRACK_HEIGHT);
    }
  };

  // Draw tooltip for hovered scene
  const drawTooltip = (ctx, scene, width) => {
    if (!scene) return;

    const x = timeToX(scene.startTime + scene.duration / 2, width);
    const y = TRACK_TOP - 10;

    const tooltipText = `${scene.title} (${formatTime(scene.duration)})`;
    ctx.font = '12px sans-serif';
    const textWidth = ctx.measureText(tooltipText).width;
    const padding = 8;
    const tooltipWidth = textWidth + padding * 2;
    const tooltipHeight = 26;

    // Position tooltip
    let tooltipX = x - tooltipWidth / 2;
    if (tooltipX < 5) tooltipX = 5;
    if (tooltipX + tooltipWidth > width - 5) tooltipX = width - tooltipWidth - 5;

    // Draw tooltip background
    ctx.fillStyle = '#1f2937';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 8;
    roundRect(ctx, tooltipX, y - tooltipHeight, tooltipWidth, tooltipHeight, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw tooltip text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(tooltipText, tooltipX + tooltipWidth / 2, y - 9);
  };

  // Truncate text to fit width
  const truncateText = (ctx, text, maxWidth) => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    
    let truncated = text;
    while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  };

  // Draw rounded rectangle
  const roundRect = (ctx, x, y, width, height, radius) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  // Handle mouse events
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    // Check if hovering over a scene
    if (y >= TRACK_TOP && y <= TRACK_TOP + TRACK_HEIGHT) {
      const positions = scenePositions();
      let foundIndex = null;

      positions.forEach((scene, index) => {
        const x1 = timeToX(scene.startTime, canvas.width);
        const x2 = timeToX(scene.endTime, canvas.width);
        
        if (x >= x1 && x <= x2) {
          foundIndex = index;
        }
      });

      setHoveredScene(foundIndex);
      canvas.style.cursor = foundIndex !== null ? 'pointer' : 'default';
    } else {
      setHoveredScene(null);
      canvas.style.cursor = 'default';
    }

    // Handle panning
    if (isDragging) {
      setPanOffset(prev => prev + e.movementX);
    }
  };

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on a scene
    if (y >= TRACK_TOP && y <= TRACK_TOP + TRACK_HEIGHT && hoveredScene !== null) {
      setSelectedScene(hoveredScene);
    } else {
      setSelectedScene(null);
      setIsDragging(true);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    
    if (e.ctrlKey || e.metaKey) {
      // Zoom with Ctrl/Cmd + wheel
      const delta = e.deltaY > 0 ? -10 : 10;
      setZoom(prev => Math.max(50, Math.min(400, prev + delta)));
    } else {
      // Pan with wheel
      setPanOffset(prev => prev - e.deltaY);
    }
  };

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = CANVAS_HEIGHT;
      drawTimeline();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawTimeline]);

  // Redraw when dependencies change
  useEffect(() => {
    drawTimeline();
  }, [drawTimeline]);

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
              max="400"
              value={zoom}
              onChange={(e) => setZoom(parseInt(e.target.value))}
              className="zoom-slider"
            />
            <span className="zoom-label">{zoom}%</span>
          </div>
          <button 
            className="timeline-btn"
            onClick={() => { setZoom(100); setPanOffset(0); }}
            title="Reset view"
          >
            🔄 Reset
          </button>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="canvas-timeline-wrapper"
        style={{ 
          width: '100%', 
          height: `${CANVAS_HEIGHT}px`,
          overflow: 'hidden',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { setHoveredScene(null); setIsDragging(false); }}
          onWheel={handleWheel}
          style={{ display: 'block' }}
        />
      </div>

      <div className="timeline-info" style={{ 
        marginTop: '12px', 
        fontSize: '12px', 
        color: '#6b7280',
        textAlign: 'center'
      }}>
        💡 Click scenes to select • Scroll to pan • Ctrl+Scroll to zoom • Drag to pan
      </div>
    </div>
  );
};

export default CanvasTimeline;
