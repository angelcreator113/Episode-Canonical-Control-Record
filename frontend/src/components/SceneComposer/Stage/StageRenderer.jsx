/**
 * StageRenderer - The actual scene rendering engine
 * 
 * Responsible for:
 * - Aspect-ratio scaling (16:9 contain)
 * - Rendering background, characters, UI elements
 * - Hit-testing and selection hit zones
 * - Interactive dragging & resizing
 * - Read-only vs edit mode
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

function StageRenderer({ 
  platform,
  scene,
  currentTime,
  interactionMode = 'view', // 'view' or 'edit'
  selected,
  onSelect,
  onUpdatePosition,
  onResizeElement
}) {
  const [hoveredElementId, setHoveredElementId] = useState(null);
  const rendererRef = useRef(null);
  const dragRef = useRef(null);   // { type, id, startX, startY, startPosX, startPosY }
  const resizeRef = useRef(null); // { type, id, startX, startY, startW, startH }
  const isEditable = interactionMode === 'edit';

  // ---- DRAG-TO-MOVE ----
  const handleDragStart = useCallback((e, type, id) => {
    if (!isEditable || !rendererRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const rect = rendererRef.current.getBoundingClientRect();
    // Find current element position
    let el;
    if (type === 'character') {
      const idx = scene?.characters?.findIndex((c, i) => (c.id || `char-${i}`) === id);
      el = scene?.characters?.[idx];
    } else if (type === 'ui') {
      const idx = scene?.ui_elements?.findIndex((u, i) => (u.id || `ui-${i}`) === id);
      el = scene?.ui_elements?.[idx];
    }
    if (!el) return;

    // Select the element on drag start
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

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }, [isEditable, scene, onSelect]);

  // ---- RESIZE ----
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

    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
  }, [isEditable, scene]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      // Handle drag
      if (dragRef.current) {
        const d = dragRef.current;
        const dx = e.clientX - d.startMouseX;
        const dy = e.clientY - d.startMouseY;
        const newX = Math.max(0, Math.min(100, d.startPosX + (dx / d.containerW) * 100));
        const newY = Math.max(0, Math.min(100, d.startPosY + (dy / d.containerH) * 100));
        
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
        const newW = Math.max(40, r.startW + dx);
        const newH = Math.max(30, r.startH + dy);
        
        if (onResizeElement) {
          onResizeElement(r.type, r.id, {
            width: `${Math.round(newW)}px`,
            height: `${Math.round(newH)}px`
          });
        }
      }
    };

    const handleMouseUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      if (resizeRef.current) {
        resizeRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onUpdatePosition, onResizeElement]);

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
          <img 
            src={scene.background_url}
            alt="Scene Background"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            draggable={false}
          />
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
        const isSelected = isSelectedCharacterId === charId;
        const isHovered = hoveredElementId === charId;
        const charWidth = character.width || '100px';
        const charHeight = character.height || '150px';

        return (
          <div
            key={charId}
            className={`stage-character ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''} ${isEditable ? 'editable' : ''}`}
            style={{
              position: 'absolute',
              left: character.position?.x || '10%',
              top: character.position?.y || '50%',
              transform: 'translate(-50%, -50%)',
              width: charWidth,
              height: charHeight,
              cursor: isEditable ? 'grab' : 'default'
            }}
            onMouseDown={(e) => handleDragStart(e, 'character', charId)}
            onMouseEnter={() => isEditable && setHoveredElementId(charId)}
            onMouseLeave={() => setHoveredElementId(null)}
          >
            {character.imageUrl ? (
              <img 
                src={character.imageUrl}
                alt={character.name}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                draggable={false}
              />
            ) : (
              <div className="stage-character-placeholder">
                {character.name}
              </div>
            )}
            {/* Resize handle */}
            {isEditable && isSelected && (
              <div
                className="stage-resize-handle"
                onMouseDown={(e) => handleResizeStart(e, 'character', charId)}
              />
            )}
          </div>
        );
      })}

      {/* UI Elements Layer */}
      {scene?.ui_elements && scene.ui_elements.map((element, idx) => {
        const uiId = element.id || `ui-${idx}`;
        const isSelected = isSelectedUiId === uiId;
        const isHovered = hoveredElementId === uiId;

        return (
          <div
            key={uiId}
            className={`stage-ui-element ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''} ${isEditable ? 'editable' : ''}`}
            style={{
              position: 'absolute',
              left: element.position?.x || '50%',
              top: element.position?.y || '10%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: element.backgroundColor || 'rgba(255, 255, 255, 0.1)',
              padding: element.padding || '12px',
              borderRadius: element.borderRadius || '8px',
              minWidth: element.width || 'auto',
              minHeight: element.height || 'auto',
              cursor: isEditable ? 'grab' : 'default'
            }}
            onMouseDown={(e) => handleDragStart(e, 'ui', uiId)}
            onMouseEnter={() => isEditable && setHoveredElementId(uiId)}
            onMouseLeave={() => setHoveredElementId(null)}
          >
            <span>{element.label || 'UI Element'}</span>
            {/* Resize handle */}
            {isEditable && isSelected && (
              <div
                className="stage-resize-handle"
                onMouseDown={(e) => handleResizeStart(e, 'ui', uiId)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default StageRenderer;
