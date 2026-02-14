import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import './PreviewMonitor.css';

function PreviewMonitor({
  scenes = [],
  currentTime = 0,
  totalDuration = 0,
  platform,
  platformKey = 'youtube',
  canvasZoom = 1.0,
  showSafeZones = false,
  onZoomIn,
  onZoomOut,
  onFitToView,
  onPlatformChange,
  onToggleSafeZones,
  onUpdateElement,
  keyframeTransforms
}) {
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const [activeTool, setActiveTool] = useState('select'); // select | move | text
  const [selectedElement, setSelectedElement] = useState(null); // { type, index, id }
  const [dragging, setDragging] = useState(null); // { startX, startY, origX, origY }
  const [hoverElement, setHoverElement] = useState(null);

  // Calculate which scene is currently active based on currentTime
  const activeScene = useMemo(() => {
    let elapsed = 0;
    for (let scene of scenes) {
      const duration = parseFloat(scene.duration_seconds) || 0;
      if (currentTime >= elapsed && currentTime < elapsed + duration) {
        return {
          ...scene,
          startTime: elapsed,
          relativeTime: currentTime - elapsed
        };
      }
      elapsed += duration;
    }
    if (scenes.length > 0 && currentTime >= totalDuration - 0.01) {
      const lastScene = scenes[scenes.length - 1];
      let startTime = 0;
      for (let i = 0; i < scenes.length - 1; i++) {
        startTime += parseFloat(scenes[i].duration_seconds) || 0;
      }
      return { ...lastScene, startTime, relativeTime: currentTime - startTime };
    }
    return null;
  }, [scenes, currentTime, totalDuration]);

  // Aspect ratio from platform
  const [rw, rh] = (platform?.ratio || '16:9').split(':').map(Number);
  const aspectRatio = `${rw} / ${rh}`;

  // --- Canvas editing: drag to move elements ---
  const getCanvasRelativePos = useCallback((clientX, clientY) => {
    if (!canvasRef.current) return { px: 0, py: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    // Return position as percentage of canvas
    const px = ((clientX - rect.left) / rect.width) * 100;
    const py = ((clientY - rect.top) / rect.height) * 100;
    return { px: Math.round(px * 10) / 10, py: Math.round(py * 10) / 10 };
  }, []);

  const handleCanvasMouseDown = useCallback((e) => {
    // Only respond to left-click on select/move tool
    if (e.button !== 0 || activeTool === 'text') return;

    // Check if clicking on an element
    const target = e.target.closest('[data-element-type]');
    if (target) {
      const type = target.dataset.elementType;
      const index = parseInt(target.dataset.elementIndex, 10);
      const id = target.dataset.elementId;
      setSelectedElement({ type, index, id });

      // Start drag
      const { px, py } = getCanvasRelativePos(e.clientX, e.clientY);
      const origX = parseFloat(target.style.left) || 50;
      const origY = parseFloat(target.style.top) || 50;
      setDragging({ startPx: px, startPy: py, origX, origY });
      e.preventDefault();
    } else {
      // Clicked on empty canvas — deselect
      setSelectedElement(null);
    }
  }, [activeTool, getCanvasRelativePos]);

  const handleCanvasMouseMove = useCallback((e) => {
    if (!dragging || !selectedElement) return;
    const { px, py } = getCanvasRelativePos(e.clientX, e.clientY);
    const dx = px - dragging.startPx;
    const dy = py - dragging.startPy;
    const newX = Math.max(0, Math.min(100, dragging.origX + dx));
    const newY = Math.max(0, Math.min(100, dragging.origY + dy));

    // Find the DOM element and move it visually during drag
    const el = canvasRef.current?.querySelector(
      `[data-element-type="${selectedElement.type}"][data-element-index="${selectedElement.index}"]`
    );
    if (el) {
      el.style.left = `${newX}%`;
      el.style.top = `${newY}%`;
    }
  }, [dragging, selectedElement, getCanvasRelativePos]);

  const handleCanvasMouseUp = useCallback((e) => {
    if (!dragging || !selectedElement) {
      setDragging(null);
      return;
    }
    const { px, py } = getCanvasRelativePos(e.clientX, e.clientY);
    const dx = px - dragging.startPx;
    const dy = py - dragging.startPy;
    const newX = Math.max(0, Math.min(100, dragging.origX + dx));
    const newY = Math.max(0, Math.min(100, dragging.origY + dy));

    // If moved more than 1%, notify parent
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      if (onUpdateElement) {
        onUpdateElement({
          type: selectedElement.type,
          index: selectedElement.index,
          id: selectedElement.id,
          position: { x: `${newX}%`, y: `${newY}%` }
        });
      }
    }
    setDragging(null);
  }, [dragging, selectedElement, getCanvasRelativePos, onUpdateElement]);

  // Keyboard: Delete/Escape for selected elements
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedElement(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="preview-monitor">
      {/* Canvas toolbar — top bar inside preview */}
      <div className="canvas-top-bar">
        <div className="canvas-bar-left">
          {onPlatformChange && (
            <select
              className="platform-select"
              value={platformKey}
              onChange={(e) => onPlatformChange(e.target.value)}
            >
              <option value="youtube">📺 YouTube 16:9</option>
              <option value="instagram">📷 Instagram 1:1</option>
              <option value="reels">📱 Reels/TikTok 9:16</option>
              <option value="ig_feed">🖼️ IG Feed 4:5</option>
              <option value="shorts">⚡ YT Shorts 9:16</option>
              <option value="twitter">🐦 Twitter/X 16:9</option>
              <option value="facebook">📘 Facebook 16:9</option>
              <option value="ultrawide">🖥️ Ultrawide 21:9</option>
            </select>
          )}
          <span className="canvas-resolution">
            {platform?.width || 1920}×{platform?.height || 1080}
          </span>
        </div>
        <div className="canvas-bar-center">
          {selectedElement && (
            <span className="selection-info">
              Selected: {selectedElement.type} #{selectedElement.index + 1}
              <button className="deselect-btn" onClick={() => setSelectedElement(null)} title="Deselect (Esc)">✕</button>
            </span>
          )}
        </div>
        <div className="canvas-bar-right">
          <button
            className={`canvas-bar-btn ${showSafeZones ? 'active' : ''}`}
            onClick={onToggleSafeZones}
            title="Toggle Safe Zones"
          >
            ⊞ Safe
          </button>
          <div className="canvas-zoom-controls">
            <button className="canvas-bar-btn" onClick={onZoomOut} title="Zoom Out">−</button>
            <span className="canvas-zoom-pct">{Math.round(canvasZoom * 100)}%</span>
            <button className="canvas-bar-btn" onClick={onZoomIn} title="Zoom In">+</button>
            <button className="canvas-bar-btn fit" onClick={onFitToView} title="Fit canvas to window">Fit</button>
          </div>
        </div>
      </div>

      {/* Viewport — the canvas lives here */}
      <div className="preview-viewport" ref={viewportRef}>
        {/* Tools floating on left edge */}
        <div className="canvas-tools">
          <button
            className={`canvas-tool-btn ${activeTool === 'select' ? 'active' : ''}`}
            onClick={() => setActiveTool('select')}
            title="Select Tool (V)"
          >
            <span className="tool-icon">↖</span>
            <span className="tool-name">Select</span>
          </button>
          <button
            className={`canvas-tool-btn ${activeTool === 'move' ? 'active' : ''}`}
            onClick={() => setActiveTool('move')}
            title="Move Tool (M)"
          >
            <span className="tool-icon">✥</span>
            <span className="tool-name">Move</span>
          </button>
          <button
            className={`canvas-tool-btn ${activeTool === 'text' ? 'active' : ''}`}
            onClick={() => setActiveTool('text')}
            title="Text Tool (T)"
          >
            <span className="tool-icon">T</span>
            <span className="tool-name">Text</span>
          </button>
          <div className="tool-separator" />
          <button className="canvas-tool-btn" title="Add Shape (coming soon)" disabled>
            <span className="tool-icon">▢</span>
            <span className="tool-name">Shape</span>
          </button>
          <button className="canvas-tool-btn" title="Add Image (coming soon)" disabled>
            <span className="tool-icon">🖼</span>
            <span className="tool-name">Image</span>
          </button>
        </div>
          <div className="preview-canvas-scroll">
          <div
            className={`canvas-frame ${activeTool === 'select' ? 'tool-select' : activeTool === 'move' ? 'tool-move' : 'tool-text'}`}
            ref={canvasRef}
            style={{ aspectRatio, transform: `scale(${canvasZoom})` }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={() => { if (dragging) handleCanvasMouseUp({ clientX: 0, clientY: 0 }); }}
          >
            {/* Safe zone overlays */}
            {showSafeZones && (
              <>
                <div className="safe-zone action-safe" title="Action Safe (90%)">
                  <span className="safe-label">Action Safe</span>
                </div>
                <div className="safe-zone title-safe" title="Title Safe (80%)">
                  <span className="safe-label">Title Safe</span>
                </div>
                <div className="canvas-crosshair horizontal" />
                <div className="canvas-crosshair vertical" />
              </>
            )}

            {/* Scene content — apply keyframe transforms when present */}
            {activeScene ? (
              <div
                className="scene-content"
                style={keyframeTransforms ? {
                  transform: [
                    `translate(${(keyframeTransforms.x ?? 50) - 50}%, ${(keyframeTransforms.y ?? 50) - 50}%)`,
                    `scale(${keyframeTransforms.scale ?? 1})`,
                    `rotate(${keyframeTransforms.rotation ?? 0}deg)`
                  ].join(' '),
                  opacity: keyframeTransforms.opacity ?? 1,
                  transition: 'transform 0.05s ease-out, opacity 0.05s ease-out'
                } : undefined}
              >
                {activeScene.background_url && (
                  <div className="scene-background">
                    <img src={activeScene.background_url} alt="Background" draggable={false} />
                  </div>
                )}

                {activeScene.characters?.length > 0 &&
                  activeScene.characters.map((char, idx) => {
                    const isSelected = selectedElement?.type === 'character' && selectedElement.index === idx;
                    const isHovered = hoverElement?.type === 'character' && hoverElement.index === idx;
                    return (
                      <div
                        key={char.id || `char-${idx}`}
                        className={`scene-element scene-character ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                        data-element-type="character"
                        data-element-index={idx}
                        data-element-id={char.id || `char-${idx}`}
                        style={{ left: char.position?.x || '50%', top: char.position?.y || '50%' }}
                        onMouseEnter={() => setHoverElement({ type: 'character', index: idx })}
                        onMouseLeave={() => setHoverElement(null)}
                      >
                        {char.imageUrl ? (
                          <img src={char.imageUrl} alt={char.name} draggable={false} />
                        ) : (
                          <div className="character-placeholder-preview">{char.name}</div>
                        )}
                        <div className="character-label">{char.name}</div>
                        {isSelected && (
                          <div className="selection-handles">
                            <div className="sel-handle nw" /><div className="sel-handle ne" />
                            <div className="sel-handle sw" /><div className="sel-handle se" />
                          </div>
                        )}
                      </div>
                    );
                  })
                }

                {activeScene.ui_elements?.length > 0 &&
                  activeScene.ui_elements.map((ui, idx) => {
                    const isSelected = selectedElement?.type === 'ui' && selectedElement.index === idx;
                    const isHovered = hoverElement?.type === 'ui' && hoverElement.index === idx;
                    return (
                      <div
                        key={ui.id || `ui-${idx}`}
                        className={`scene-element scene-ui-element ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                        data-element-type="ui"
                        data-element-index={idx}
                        data-element-id={ui.id || `ui-${idx}`}
                        style={{
                          left: ui.position?.x || '50%',
                          top: ui.position?.y || '10%',
                          backgroundColor: ui.backgroundColor || 'rgba(102, 126, 234, 0.15)',
                          padding: ui.padding || '8px 12px',
                          borderRadius: ui.borderRadius || '6px',
                          width: ui.width || 'auto'
                        }}
                        onMouseEnter={() => setHoverElement({ type: 'ui', index: idx })}
                        onMouseLeave={() => setHoverElement(null)}
                      >
                        {ui.label || ui.content}
                        {isSelected && (
                          <div className="selection-handles">
                            <div className="sel-handle nw" /><div className="sel-handle ne" />
                            <div className="sel-handle sw" /><div className="sel-handle se" />
                          </div>
                        )}
                      </div>
                    );
                  })
                }

                {/* Empty scene placeholder */}
                {!activeScene.background_url && (!activeScene.characters || activeScene.characters.length === 0) && (
                  <div className="scene-empty-placeholder">
                    <div className="empty-scene-label">{activeScene.title || 'Scene'}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="no-scene">
                <span className="no-scene-icon">🎬</span>
                <p>No scene</p>
              </div>
            )}

            {/* Scene badge (bottom-left, minimal) */}
            {activeScene && (
              <div className="scene-badge">
                <span className="scene-badge-name">{activeScene.title}</span>
                <span className="scene-badge-time">{formatTime(activeScene.relativeTime || 0)} / {activeScene.duration_seconds}s</span>
              </div>
            )}
          </div>
        </div>
      </div>{/* end preview-viewport */}
    </div>
  );
}

export default PreviewMonitor;