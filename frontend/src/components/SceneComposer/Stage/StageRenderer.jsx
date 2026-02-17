/**
 * StageRenderer - The actual scene rendering engine
 * 
 * Responsible for:
 * - Aspect-ratio scaling (16:9 contain)
 * - Rendering background, characters, UI elements
 * - Hit-testing and selection hit zones
 * - Interactive dragging, resizing, & rotating
 * - Timeline-based element visibility (enterTime / exitTime)
 * - Character name labels
 * - Snap-to-grid integration
 * - Read-only vs edit mode
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

function StageRenderer({ 
  platform,
  scene,
  currentTime = 0,
  interactionMode = 'view', // 'view' or 'edit'
  selected,
  onSelect,
  onUpdatePosition,
  onResizeElement,
  onRotateElement,
  onDeleteElement,
  snapPosition,       // from useSnapEngine
  onDragEnd,          // clear guides on mouse up
  showCharacterLabels = true
}) {
  const [hoveredElementId, setHoveredElementId] = useState(null);
  const [activeInteraction, setActiveInteraction] = useState(null); // 'drag' | 'resize' | 'rotate' | null
  const rendererRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const rotateRef = useRef(null);
  const isEditable = interactionMode === 'edit';

  // ── Timeline Visibility: filter elements by currentTime ──
  const isElementVisible = useCallback((element) => {
    // If no timing data, always visible
    const enter = parseFloat(element.enterTime ?? element.enter_time ?? -1);
    const exit = parseFloat(element.exitTime ?? element.exit_time ?? -1);
    if (enter < 0 && exit < 0) return true;
    const t = currentTime || 0;
    if (enter >= 0 && t < enter) return false;
    if (exit >= 0 && t >= exit) return false;
    return true;
  }, [currentTime]);

  // ── DRAG-TO-MOVE ──
  const handleDragStart = useCallback((e, type, id) => {
    if (!isEditable || !rendererRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const rect = rendererRef.current.getBoundingClientRect();
    let el;
    if (type === 'character') {
      const idx = scene?.characters?.findIndex((c, i) => (c.id || `char-${i}`) === id);
      el = scene?.characters?.[idx];
    } else if (type === 'ui') {
      const idx = scene?.ui_elements?.findIndex((u, i) => (u.id || `ui-${i}`) === id);
      el = scene?.ui_elements?.[idx];
    }
    if (!el) return;

    if (onSelect) onSelect({ type, id });

    dragRef.current = {
      type,
      id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPosX: parseFloat(el.position?.x) || 50,
      startPosY: parseFloat(el.position?.y) || 50,
      containerW: rect.width,
      containerH: rect.height
    };

    setActiveInteraction('drag');
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }, [isEditable, scene, onSelect]);

  // ── RESIZE ──
  const handleResizeStart = useCallback((e, type, id) => {
    if (!isEditable || !rendererRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const rect = rendererRef.current.getBoundingClientRect();
    let el;
    if (type === 'ui') {
      const idx = scene?.ui_elements?.findIndex((u, i) => (u.id || `ui-${i}`) === id);
      el = scene?.ui_elements?.[idx];
    } else if (type === 'character') {
      const idx = scene?.characters?.findIndex((c, i) => (c.id || `char-${i}`) === id);
      el = scene?.characters?.[idx];
    }
    if (!el) return;

    resizeRef.current = {
      type,
      id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startW: parseInt(el.width) || 100,
      startH: parseInt(el.height) || (type === 'character' ? 150 : 50),
      containerW: rect.width,
      containerH: rect.height
    };

    setActiveInteraction('resize');
    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
  }, [isEditable, scene]);

  // ── ROTATE ──
  const handleRotateStart = useCallback((e, type, id) => {
    if (!isEditable || !rendererRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    let el;
    if (type === 'character') {
      const idx = scene?.characters?.findIndex((c, i) => (c.id || `char-${i}`) === id);
      el = scene?.characters?.[idx];
    } else if (type === 'ui') {
      const idx = scene?.ui_elements?.findIndex((u, i) => (u.id || `ui-${i}`) === id);
      el = scene?.ui_elements?.[idx];
    }
    if (!el) return;

    // Get element center in viewport coords
    const rect = rendererRef.current.getBoundingClientRect();
    const posX = parseFloat(el.position?.x) || 50;
    const posY = parseFloat(el.position?.y) || 50;
    const centerX = rect.left + (posX / 100) * rect.width;
    const centerY = rect.top + (posY / 100) * rect.height;

    rotateRef.current = {
      type,
      id,
      centerX,
      centerY,
      startAngle: Math.atan2(e.clientY - centerY, e.clientX - centerX),
      startRotation: parseFloat(el.rotation) || 0,
    };

    setActiveInteraction('rotate');
    document.body.style.cursor = 'crosshair';
    document.body.style.userSelect = 'none';
  }, [isEditable, scene]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      // Handle drag
      if (dragRef.current) {
        const d = dragRef.current;
        const dx = e.clientX - d.startMouseX;
        const dy = e.clientY - d.startMouseY;
        let newX = Math.max(0, Math.min(100, d.startPosX + (dx / d.containerW) * 100));
        let newY = Math.max(0, Math.min(100, d.startPosY + (dy / d.containerH) * 100));
        
        // Apply snap if available
        if (snapPosition) {
          const snapped = snapPosition(newX, newY);
          newX = snapped.snappedX;
          newY = snapped.snappedY;
        }

        if (onUpdatePosition) {
          onUpdatePosition(d.type, d.id, {
            x: `${Math.round(newX * 10) / 10}%`,
            y: `${Math.round(newY * 10) / 10}%`
          });
        }
      }
      // Handle resize
      if (resizeRef.current) {
        const r = resizeRef.current;
        const dx = e.clientX - r.startMouseX;
        const dy = e.clientY - r.startMouseY;
        const maxW = Math.round(r.containerW * 0.95);
        const maxH = Math.round(r.containerH * 0.95);
        const newW = Math.max(20, Math.min(r.startW + dx, maxW));
        const newH = Math.max(20, Math.min(r.startH + dy, maxH));
        
        if (onResizeElement) {
          onResizeElement(r.type, r.id, {
            width: `${Math.round(newW)}px`,
            height: `${Math.round(newH)}px`
          });
        }
      }
      // Handle rotation
      if (rotateRef.current) {
        const rot = rotateRef.current;
        const angle = Math.atan2(e.clientY - rot.centerY, e.clientX - rot.centerX);
        const delta = ((angle - rot.startAngle) * 180) / Math.PI;
        let newRotation = rot.startRotation + delta;
        
        // Snap to 0/90/180/270 when close (within 5 degrees)
        const snapAngles = [0, 90, 180, 270, -90, -180, -270, 360];
        for (const snap of snapAngles) {
          if (Math.abs(newRotation - snap) < 5) {
            newRotation = snap;
            break;
          }
        }

        if (onRotateElement) {
          onRotateElement(rot.type, rot.id, Math.round(newRotation));
        }
      }
    };

    const handleMouseUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setActiveInteraction(null);
        if (onDragEnd) onDragEnd();
      }
      if (resizeRef.current) {
        resizeRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setActiveInteraction(null);
      }
      if (rotateRef.current) {
        rotateRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setActiveInteraction(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onUpdatePosition, onResizeElement, onRotateElement, snapPosition, onDragEnd]);

  const handleBackgroundClick = () => {
    if (isEditable && onSelect) {
      onSelect({ type: 'background', id: 'background' });
    }
  };

  const isSelectedBackground = selected?.type === 'background';
  const isSelectedCharacterId = selected?.type === 'character' ? selected.id : null;
  const isSelectedUiId = selected?.type === 'ui' ? selected.id : null;

  return (
    <div className="stage-renderer" ref={rendererRef}>
      {/* Background Layer */}
      {scene?.background_url ? (
        <div 
          className={`stage-background ${isSelectedBackground ? 'selected' : ''} ${isEditable ? 'editable' : ''}`}
          onClick={handleBackgroundClick}
          onMouseEnter={() => isEditable && setHoveredElementId('background')}
          onMouseLeave={() => setHoveredElementId(null)}
        >
          {scene.background_url.match(/\.(mp4|webm|ogg)$/i) ? (
            <video
              src={scene.background_url}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              controls
              autoPlay
              loop
              muted
              draggable={false}
            />
          ) : (
            <img 
              src={scene.background_url}
              alt="Scene Background"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              draggable={false}
            />
          )}
        </div>
      ) : (
        <div 
          className={`stage-empty-background ${isEditable ? 'editable' : ''}`}
          onClick={handleBackgroundClick}
        />
      )}

      {/* Character Layer */}
      {scene?.characters && scene.characters.map((character, idx) => {
        const charId = character.id || `char-${idx}`;
        if (!isElementVisible(character)) return null;

        const isSelected = isSelectedCharacterId === charId;
        const isHovered = hoveredElementId === charId;
        const charWidth = character.width || '100px';
        const charHeight = character.height || '150px';
        const rotation = parseFloat(character.rotation) || 0;
        const isDragging = activeInteraction && (dragRef.current?.id === charId || resizeRef.current?.id === charId || rotateRef.current?.id === charId);

        return (
          <div
            key={charId}
            className={`stage-character ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''} ${isEditable ? 'editable' : ''} ${isDragging ? 'dragging' : ''}`}
            style={{
              position: 'absolute',
              left: character.position?.x || '10%',
              top: character.position?.y || '50%',
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
              width: charWidth,
              height: charHeight,
              cursor: isEditable ? 'grab' : 'default',
              zIndex: character.layer != null ? character.layer : undefined
            }}
            onMouseDown={(e) => handleDragStart(e, 'character', charId)}
            onMouseEnter={() => isEditable && setHoveredElementId(charId)}
            onMouseLeave={() => setHoveredElementId(null)}
          >
            {character.imageUrl ? (
              <img 
                src={character.imageUrl}
                alt={character.name}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', margin: 'auto' }}
                draggable={false}
              />
            ) : (
              <div className="stage-character-placeholder">
                {character.name}
              </div>
            )}

            {/* Character Name Label */}
            {showCharacterLabels && character.name && character.imageUrl && (
              <div className="stage-character-label">
                {character.name}
              </div>
            )}

            {/* Resize handle + Rotate handle + Delete button */}
            {isEditable && isSelected && (
              <>
                <div
                  className="stage-resize-handle"
                  onMouseDown={(e) => handleResizeStart(e, 'character', charId)}
                />
                <div
                  className="stage-rotate-handle"
                  onMouseDown={(e) => handleRotateStart(e, 'character', charId)}
                  title="Rotate"
                />
                <div
                  className="stage-delete-handle"
                  onClick={(e) => { e.stopPropagation(); onDeleteElement && onDeleteElement('character', charId); }}
                  title="Delete (Del key)"
                >×</div>
              </>
            )}
          </div>
        );
      })}

      {/* UI Elements Layer */}
      {scene?.ui_elements && scene.ui_elements.map((element, idx) => {
        const uiId = element.id || `ui-${idx}`;
        if (!isElementVisible(element)) return null;

        const isSelected = isSelectedUiId === uiId;
        const isHovered = hoveredElementId === uiId;
        const rotation = parseFloat(element.rotation) || 0;
        const isDragging = activeInteraction && (dragRef.current?.id === uiId || resizeRef.current?.id === uiId || rotateRef.current?.id === uiId);

        return (
          <div
            key={uiId}
            className={`stage-ui-element ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''} ${isEditable ? 'editable' : ''} ${isDragging ? 'dragging' : ''}`}
            style={{
              position: 'absolute',
              left: element.position?.x || '50%',
              top: element.position?.y || '10%',
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
              backgroundColor: element.imageUrl ? 'transparent' : (element.backgroundColor || 'rgba(255, 255, 255, 0.1)'),
              padding: element.imageUrl ? '0' : (element.padding || '12px'),
              borderRadius: element.borderRadius || '8px',
              width: element.width || (element.imageUrl ? '120px' : 'auto'),
              height: element.height || (element.imageUrl ? '120px' : 'auto'),
              maxWidth: element.imageUrl ? (element.width || '300px') : (element.width || '300px'),
              maxHeight: element.imageUrl ? (element.height || '300px') : 'none',
              overflow: isSelected ? 'visible' : 'hidden',
              cursor: isEditable ? 'grab' : 'default',
              zIndex: element.layer != null ? element.layer : undefined
            }}
            onMouseDown={(e) => handleDragStart(e, 'ui', uiId)}
            onMouseEnter={() => isEditable && setHoveredElementId(uiId)}
            onMouseLeave={() => setHoveredElementId(null)}
          >
            {element.imageUrl ? (
              <img
                src={element.imageUrl}
                alt={element.label || 'UI Element'}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  margin: 'auto',
                  borderRadius: element.borderRadius || '0'
                }}
              />
            ) : (
              <span>{element.label || 'UI Element'}</span>
            )}

            {/* Resize handle + Rotate handle + Delete button */}
            {isEditable && isSelected && (
              <>
                <div
                  className="stage-resize-handle"
                  onMouseDown={(e) => handleResizeStart(e, 'ui', uiId)}
                />
                <div
                  className="stage-rotate-handle"
                  onMouseDown={(e) => handleRotateStart(e, 'ui', uiId)}
                  title="Rotate"
                />
                <div
                  className="stage-delete-handle"
                  onClick={(e) => { e.stopPropagation(); onDeleteElement && onDeleteElement('ui', uiId); }}
                  title="Delete (Del key)"
                >×</div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default StageRenderer;
