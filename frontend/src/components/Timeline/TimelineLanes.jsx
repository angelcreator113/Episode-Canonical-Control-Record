import React, { useState, useEffect } from 'react';
import { useDroppable, useDraggable, useDndContext } from '@dnd-kit/core';
import './TimelineLanes.css';

/**
 * TimelineLanes - Lane-based timeline visualization (CapCut-style)
 * One lane per asset type: Scenes, Primary Visuals, Overlays, Voice, Effects
 * Items stack vertically within lanes when overlapping
 */

/**
 * TrackHeader - Left rail track header with name, icons, and add button
 */
const TrackHeader = ({ title, icon, count, isEmpty, onAdd, canMute = false, canSolo = false, canLock = false }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isSolo, setIsSolo] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  return (
    <div className="track-header">
      <div className="track-header-name">
        <span className="track-icon">{icon}</span>
        <span className="track-title">{title}</span>
      </div>
      <div className="track-header-controls">
        {canMute && (
          <button 
            className={`track-icon-btn ${isMuted ? 'active' : ''}`}
            onClick={() => setIsMuted(!isMuted)}
            title="Mute track"
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
        )}
        {canSolo && (
          <button 
            className={`track-icon-btn ${isSolo ? 'active' : ''}`}
            onClick={() => setIsSolo(!isSolo)}
            title="Solo track"
          >
            S
          </button>
        )}
        {canLock && (
          <button 
            className={`track-icon-btn ${isLocked ? 'active' : ''}`}
            onClick={() => setIsLocked(!isLocked)}
            title="Lock track"
          >
            {isLocked ? '🔒' : '🔓'}
          </button>
        )}
        {isEmpty && onAdd && (
          <button className="track-add-btn" onClick={onAdd} title={`Add ${title}`}>
            +
          </button>
        )}
      </div>
    </div>
  );
};
const TimelineLanes = ({ 
  layers = [],
  onLayerUpdate,
  scenes, 
  placements,
  totalDuration,
  zoom,
  selectedScene,
  selectedPlacementId,
  onPlacementClick,
  onPlacementResize,
  onSceneClick,
  onSceneDrag,
  onPlacementDrag,
  currentTime,
  onSeek
}) => {
  const [editingLayerId, setEditingLayerId] = useState(null);
  const [editingLayerName, setEditingLayerName] = useState('');
  const [draggedLayerId, setDraggedLayerId] = useState(null);
  const [dropTargetLayerId, setDropTargetLayerId] = useState(null);
  
  // Group all clips by layer_id
  const getClipsByLayer = (layerId) => {
    const allClips = [
      ...scenes.map(s => ({ ...s, type: 'scene', layer_id: s.layer_id || 1 })),
      ...placements.map(p => ({ ...p, type: 'placement', layer_id: p.layer_id || 2 }))
    ];
    return allClips.filter(clip => clip.layer_id === layerId);
  };
  
  // Handle layer rename
  const handleStartRename = (layer) => {
    setEditingLayerId(layer.id);
    setEditingLayerName(layer.name);
  };
  
  const handleFinishRename = (layerId) => {
    if (editingLayerName.trim()) {
      onLayerUpdate?.(layerId, { name: editingLayerName.trim() });
    }
    setEditingLayerId(null);
  };
  
  // Handle layer reorder
  const handleMoveLayer = (layerId, direction) => {
    const currentIndex = layers.findIndex(l => l.id === layerId);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex >= 0 && newIndex < layers.length) {
      const newLayers = [...layers];
      [newLayers[currentIndex], newLayers[newIndex]] = [newLayers[newIndex], newLayers[currentIndex]];
      onLayerUpdate?.('reorder', newLayers);
    }
  };
  
  // Handle layer delete
  const handleDeleteLayer = (layerId) => {
    if (layers.length <= 1) {
      alert('Cannot delete the last layer');
      return;
    }
    if (confirm('Delete this layer? Clips on this layer will be moved to Layer 1.')) {
      onLayerUpdate?.('delete', layerId);
    }
  };

  // Group placements by visual_role and audio_role
  const primaryVisuals = placements.filter(p => p.visual_role === 'primary-visual');
  const overlays = placements.filter(p => p.visual_role === 'overlay' || p.placement_type === 'wardrobe');
  const voicePlacements = placements.filter(p => p.audio_role === 'voice' || p.placement_type === 'voice');
  const musicPlacements = placements.filter(p => p.audio_role === 'music' || p.placement_type === 'music');
  const effectsPlacements = placements.filter(p => p.placement_type === 'effect' || p.placement_type === 'sfx');

  // Start with all tracks visible by default (CapCut style)
  const toggleLane = (laneId) => {
    setCollapsedLanes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(laneId)) {
        newSet.delete(laneId);
      } else {
        newSet.add(laneId);
      }
      return newSet;
    });
  };

  const getTimePosition = (seconds) => {
    return (seconds / totalDuration) * 100;
  };

  const getScenePosition = (scene) => {
    // ABSOLUTE POSITIONING: Use start_time_seconds, not cumulative scene order
    const startTime = scene.start_time_seconds || 0;
    const duration = scene.duration_seconds || 0;
    const position = {
      left: getTimePosition(startTime),
      width: getTimePosition(duration),
    };
    return position;
  };

  const getPlacementPosition = (placement) => {
    // FREE PLACEMENT: Use absolute timeline time, NOT scene-relative
    const startTime = placement.start_time_seconds || 0;
    const duration = placement.duration_seconds || placement.duration || 5;
    
    return {
      left: getTimePosition(startTime),
      width: getTimePosition(duration),
      startTime: startTime,
      endTime: startTime + duration,
    };
  };

  // Detect overlaps and calculate vertical stacking positions
  const calculateStackPositions = (items) => {
    const positioned = items.map(item => ({
      ...item,
      position: getPlacementPosition(item),
    }));

    // Sort by start time
    positioned.sort((a, b) => a.position.startTime - b.position.startTime);

    // Assign stack rows (tracks within the lane)
    const tracks = [];
    positioned.forEach(item => {
      // Find first available track where this item doesn't overlap
      let trackIndex = tracks.findIndex(track => {
        const lastItem = track[track.length - 1];
        return lastItem.position.endTime <= item.position.startTime;
      });

      if (trackIndex === -1) {
        // No available track, create new one
        trackIndex = tracks.length;
        tracks.push([]);
      }

      tracks[trackIndex].push(item);
      item.trackIndex = trackIndex;
    });

    return { items: positioned, trackCount: tracks.length };
  };

  // Validate if a drag item is compatible with a drop target track
  const isValidDrop = (dragType, dragData, targetTrack) => {
    // If dragging an existing clip (repositioning), it must stay on same track type
    if (dragType === 'scene-clip') {
      return targetTrack === 'video';
    }
    
    if (dragType === 'placement-clip') {
      const placement = dragData.placement;
      // Visual placements can only go on OVERLAYS
      if (placement.visual_role && placement.visual_role !== 'none') {
        return targetTrack === 'overlays';
      }
      // Audio placements can go on VOICE, MUSIC, or SFX
      if (placement.audio_role) {
        return ['voice', 'music', 'sfx'].includes(targetTrack);
      }
      return false;
    }
    
    // Library assets being dropped for the first time
    if (dragType === 'library-asset') {
      const asset = dragData.item;
      const assetType = asset.asset_type || asset.type;
      
      if (assetType === 'video' || assetType === 'image') {
        return targetTrack === 'video' || targetTrack === 'overlays';
      }
      if (assetType === 'audio') {
        return ['voice', 'music', 'sfx'].includes(targetTrack);
      }
    }
    
    if (dragType === 'wardrobe-item') {
      return targetTrack === 'overlays';
    }
    
    return false;
  };

  return (
    <div className="timeline-split-layout">
      {/* Left Rail: Layer Headers (Fixed 180px) */}
      <div className="track-headers-rail">
        {layers.map((layer, index) => (
          <div 
            key={layer.id}
            className={`track-header ${dropTargetLayerId === layer.id ? 'drop-target' : ''}`}
            style={{ borderLeftColor: layer.color }}
            onDragOver={(e) => {
              e.preventDefault();
              if (dropTargetLayerId !== layer.id) {
                setDropTargetLayerId(layer.id);
              }
            }}
            onDragLeave={(e) => {
              // Only clear if actually leaving the element
              if (!e.currentTarget.contains(e.relatedTarget)) {
                setDropTargetLayerId(null);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              // Handle clip drop to change layer
              const clipData = e.dataTransfer.getData('application/json');
              if (clipData) {
                const clip = JSON.parse(clipData);
                onLayerUpdate?.('moveClip', { clipId: clip.id, clipType: clip.type, targetLayerId: layer.id });
              }
              setDropTargetLayerId(null);
            }}
          >
            <div className="track-header-name">
              {editingLayerId === layer.id ? (
                <input
                  type="text"
                  className="layer-name-input"
                  value={editingLayerName}
                  onChange={(e) => setEditingLayerName(e.target.value)}
                  onBlur={() => handleFinishRename(layer.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishRename(layer.id);
                    if (e.key === 'Escape') setEditingLayerId(null);
                  }}
                  autoFocus
                />
              ) : (
                <span 
                  className="track-title"
                  onDoubleClick={() => handleStartRename(layer)}
                  title="Double-click to rename"
                >
                  {layer.name}
                </span>
              )}
              <span className="track-count">{getClipsByLayer(layer.id).length}</span>
            </div>
            <div className="track-header-controls">
              <button 
                className="track-icon-btn track-icon-btn-sm"
                onClick={() => handleMoveLayer(layer.id, 'up')}
                disabled={index === 0}
                title="Move layer up"
              >
                ▲
              </button>
              <button 
                className="track-icon-btn track-icon-btn-sm"
                onClick={() => handleMoveLayer(layer.id, 'down')}
                disabled={index === layers.length - 1}
                title="Move layer down"
              >
                ▼
              </button>
              <button 
                className={`track-icon-btn ${layer.muted ? 'active' : ''}`}
                onClick={() => onLayerUpdate?.(layer.id, { muted: !layer.muted })}
                title={layer.muted ? 'Unmute' : 'Mute'}
              >
                {layer.muted ? '🔇' : '🔊'}
              </button>
              <button 
                className={`track-icon-btn ${layer.locked ? 'active' : ''}`}
                onClick={() => onLayerUpdate?.(layer.id, { locked: !layer.locked })}
                title={layer.locked ? 'Unlock' : 'Lock'}
              >
                {layer.locked ? '🔒' : '🔓'}
              </button>
              <button 
                className="track-icon-btn track-delete-btn"
                onClick={() => handleDeleteLayer(layer.id)}
                title="Delete layer"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
        
        {/* Add Layer Button */}
        <button 
          className="add-layer-btn"
          onClick={() => {
            const newId = Math.max(...layers.map(l => l.id)) + 1;
            onLayerUpdate?.(null, {
              id: newId,
              name: `Layer ${newId}`,
              color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
              muted: false,
              locked: false
            });
          }}
          title="Add new layer"
        >
          + Add Layer
        </button>
      </div>

      {/* Right Side: Timeline Clips Area (Scrollable) */}
      <div className="timeline-clips-area" style={{ transform: `scale(${zoom / 100}, 1)` }}>
        {/* Playhead Line - Positioned with clips */}
        {currentTime !== null && currentTime !== undefined && (
          <div 
            className="timeline-playhead-line"
            style={{ left: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%` }}
          >
            <div className="playhead-handle" title="Drag to scrub">
              <div className="playhead-triangle" />
            </div>
            <div className="playhead-line" />
          </div>
        )}

        {/* Render each layer */}
        {layers.map(layer => {
          const layerClips = getClipsByLayer(layer.id);
          
          return (
            <div 
              key={layer.id}
              className={`timeline-layer ${dropTargetLayerId === layer.id ? 'drop-target' : ''}`}
              style={{ height: '56px', minHeight: '56px', maxHeight: '56px', position: 'relative' }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dropTargetLayerId !== layer.id) {
                  setDropTargetLayerId(layer.id);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setDropTargetLayerId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const clipData = e.dataTransfer.getData('application/json');
                if (clipData) {
                  const clip = JSON.parse(clipData);
                  onLayerUpdate?.('moveClip', { clipId: clip.id, clipType: clip.type, targetLayerId: layer.id });
                }
                setDropTargetLayerId(null);
              }}
            >
              {layerClips.map(clip => {
                if (clip.type === 'scene') {
                  const pos = getScenePosition(clip);
                  const hasVideo = clip.libraryScene?.id;
                  const thumbnail = clip.libraryScene?.thumbnail_url || clip.libraryScene?.s3_url;
                  const duration = clip.duration_seconds || 0;
                  
                  return (
                    <div
                      key={clip.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/json', JSON.stringify({ id: clip.id, type: 'scene' }));
                      }}
                    >
                      <SceneClip
                        scene={clip}
                        position={pos}
                        isSelected={selectedScene?.id === clip.id}
                        hasVideo={hasVideo}
                        thumbnail={thumbnail}
                        duration={duration}
                        onClick={() => onSceneClick?.(clip)}
                        onDrag={onSceneDrag}
                        layerColor={layer.color}
                      />
                    </div>
                  );
                } else {
                  const pos = getPlacementPosition(clip);
                  return (
                    <div
                      key={clip.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/json', JSON.stringify({ id: clip.id, type: 'placement' }));
                      }}
                    >
                      <PlacementBar
                        placement={clip}
                        position={pos}
                        trackIndex={0}
                        isSelected={clip.id === selectedPlacementId}
                        onClick={() => onPlacementClick?.(clip)}
                        onResize={onPlacementResize}
                        totalDuration={totalDuration}
                        layerColor={layer.color}
                      />
                    </div>
                  );
                }
              })}
              
              {layerClips.length === 0 && (
                <div className="layer-empty-hint">
                  Drop any media here
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Lane - Base lane component with header and content area
 * Supports always-visible lanes with collapsible/expanded states
 * Now supports drag-and-drop from asset browser
 */
const Lane = ({ 
  id, 
  title, 
  icon, 
  count, 
  isCollapsed, 
  onToggle, 
  alwaysVisible, 
  alwaysExpanded,
  isEmpty,
  hideHeader,
  children,
  isValidDrop
}) => {
  const canToggle = !alwaysVisible && !alwaysExpanded;
  const { active } = useDndContext();
  
  // Make lane droppable for asset browser items
  const { setNodeRef, isOver } = useDroppable({
    id: `lane-${id}`,
    data: {
      type: 'lane',
      laneId: id,
      laneTitle: title
    }
  });
  
  // Check if current drag is valid for this lane
  const dragData = active?.data?.current;
  const dragType = dragData?.type;
  const isValidDropTarget = !active || isValidDrop(dragType, dragData, id);
  const showInvalidState = active && isOver && !isValidDropTarget;
  
  return (
    <div 
      ref={setNodeRef}
      className={`timeline-lane-container ${isCollapsed ? 'collapsed' : 'expanded'} ${alwaysExpanded ? 'always-expanded' : ''} ${hideHeader ? 'no-header' : ''} ${isOver && isValidDropTarget ? 'lane-drop-target' : ''} ${showInvalidState ? 'lane-drop-invalid' : ''}`}
    >
      {!hideHeader && (
        <div 
          className={`lane-header ${canToggle ? 'clickable' : ''}`}
          onClick={canToggle ? onToggle : undefined}
        >
          {canToggle && (
            <span className="lane-toggle">
              {isCollapsed ? '▶' : '▼'}
            </span>
          )}
          <span className="lane-icon">{icon}</span>
          <span className="lane-title">{title}</span>
          {count !== undefined && <span className="lane-count">{count}</span>}
          {isCollapsed && !isEmpty && count > 0 && (
            <div className="lane-collapsed-indicators">
              {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
                <span key={i} className="lane-dot" />
              ))}
              {count > 5 && <span className="lane-more">+{count - 5}</span>}
            </div>
          )}
        </div>
      )}
      {!isCollapsed && (
        <div className="lane-content">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * StackedLane - Lane with vertical stacking for overlapping items
 * Now supports drag-and-drop from asset browser
 */
const StackedLane = ({ 
  id, 
  title, 
  icon, 
  items, 
  isCollapsed, 
  onToggle,
  calculateStackPositions,
  selectedPlacementId,
  onPlacementClick,
  onPlacementResize,
  totalDuration,
  hideHeader
}) => {
  const { items: stackedItems, trackCount } = calculateStackPositions(items);
  const MAX_VISIBLE_TRACKS = 4;
  const hasOverflow = trackCount > MAX_VISIBLE_TRACKS;

  // Make lane droppable for asset browser items
  const { setNodeRef, isOver } = useDroppable({
    id: `lane-${id}`,
    data: {
      type: 'lane',
      laneId: id,
      laneTitle: title
    }
  });

  return (
    <div 
      ref={setNodeRef}
      className={`timeline-lane-container stacked ${isCollapsed ? 'collapsed' : ''} ${hideHeader ? 'no-header' : ''} ${isOver ? 'lane-drop-target' : ''}`}
    >
      {!hideHeader && (
        <div className="lane-header clickable" onClick={onToggle}>
          <span className="lane-toggle">{isCollapsed ? '▶' : '▼'}</span>
          <span className="lane-icon">{icon}</span>
          <span className="lane-title">{title}</span>
          <span className="lane-count">{items.length}</span>
          {isCollapsed && items.length > 0 && (
            <div className="lane-collapsed-indicators">
              {Array.from({ length: Math.min(items.length, 5) }).map((_, i) => (
                <span key={i} className="lane-dot" />
              ))}
              {items.length > 5 && <span className="lane-more">+{items.length - 5}</span>}
            </div>
          )}
        </div>
      )}
      {!isCollapsed && (
        <div 
          className="lane-content stacked-content"
          style={{ 
            height: `${Math.min(trackCount, MAX_VISIBLE_TRACKS) * 56}px` 
          }}
        >
          {stackedItems.slice(0, MAX_VISIBLE_TRACKS * 10).map(item => (
            <PlacementBar
              key={item.id}
              placement={item}
              position={item.position}
              trackIndex={item.trackIndex}
              isSelected={item.id === selectedPlacementId}
              onClick={() => onPlacementClick(item)}
              onResize={onPlacementResize}
              totalDuration={totalDuration}
            />
          ))}
          {hasOverflow && (
            <div className="lane-overflow-indicator">
              +{trackCount - MAX_VISIBLE_TRACKS} more overlapping
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * PlacementBar - Individual placement bar within a stacked lane
 */
const PlacementBar = ({ placement, position, trackIndex, isSelected, onClick, onResize, totalDuration }) => {
  const [isResizing, setIsResizing] = useState(null); // 'left' or 'right'
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [resizeStartLeft, setResizeStartLeft] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Make placement draggable for repositioning
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `drag-placement-${placement.id}`,
    data: {
      type: 'placement-clip',
      placement: placement,
      trackType: placement.visual_role || placement.audio_role
    }
  });

  const getLabel = () => {
    if (placement.label) return placement.label;
    if (placement.placement_type === 'wardrobe') {
      return placement.wardrobeItem?.name || 'Wardrobe';
    }
    if (placement.placement_type === 'asset') {
      return placement.asset?.name || 'Asset';
    }
    return 'Placement';
  };

  const getThumbnail = () => {
    if (placement.placement_type === 'wardrobe') {
      return placement.wardrobeItem?.thumbnail_url || placement.wardrobeItem?.s3_url_processed || placement.wardrobeItem?.s3_url;
    }
    if (placement.placement_type === 'asset') {
      return placement.asset?.s3_url_processed || placement.asset?.s3_url_raw;
    }
    return null;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimingInfo = () => {
    return {
      start: formatTime(position.startTime),
      duration: formatTime(position.endTime - position.startTime),
      end: formatTime(position.endTime)
    };
  };

  const handleResizeStart = (e, side) => {
    e.stopPropagation();
    setIsResizing(side);
    setResizeStartX(e.clientX);
    setResizeStartWidth(position.width);
    setResizeStartLeft(position.left);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - resizeStartX;
      const container = document.querySelector('.timeline-lanes');
      if (!container) return;

      const containerWidth = container.offsetWidth;
      const deltaPercent = (deltaX / containerWidth) * 100;

      if (isResizing === 'right') {
        // Resize from right edge - change duration
        const newWidth = Math.max(5, resizeStartWidth + deltaPercent);
        onResize?.(placement.id, newWidth, 'duration');
      } else if (isResizing === 'left') {
        // Resize from left edge - change offset
        const newLeft = Math.max(0, resizeStartLeft + deltaPercent);
        const newWidth = Math.max(5, resizeStartWidth - deltaPercent);
        onResize?.(placement.id, { left: newLeft, width: newWidth }, 'offset');
      }
    };

    const handleMouseUp = () => {
      setIsResizing(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeStartX, resizeStartWidth, resizeStartLeft, placement.id, onResize]);

  const thumbnail = getThumbnail();
  const timingInfo = getTimingInfo();
  
  // Apply drag transform
  const dragStyle = transform ? {
    transform: `translate3d(${transform.x}px, 0px, 0)`,
    zIndex: 1000,
  } : {};

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`placement-bar ${isSelected ? 'selected' : ''} ${isResizing ? 'resizing' : ''} ${isDragging ? 'placement-bar-dragging' : ''}`}
      style={{
        left: `${position.left}%`,
        width: `${position.width}%`,
        top: `${trackIndex * 56}px`,
        height: '56px',
        position: 'absolute',
        ...dragStyle,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onClick={onClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {thumbnail && (
        <div 
          className="placement-bar-thumbnail"
          style={{ backgroundImage: `url(${thumbnail})` }}
        />
      )}

      {/* Audio waveform visualization */}
      {(placement.visual_role === 'voice' || placement.visual_role === 'music' || placement.visual_role === 'sfx') && (
        <div className="placement-bar-waveform">
          {Array.from({ length: 32 }).map((_, i) => (
            <div
              key={i}
              className="waveform-bar"
              style={{
                height: `${Math.random() * 70 + 30}%`,
                opacity: 0.6 + Math.random() * 0.4
              }}
            />
          ))}
        </div>
      )}

      {/* Professional NLE Features */}
      <div className="clip-trim-handle clip-trim-handle-left" title="Trim start" />
      <div className="clip-trim-handle clip-trim-handle-right" title="Trim end" />
      <div className="clip-duration-display">
        {Math.floor(placement.duration_seconds || placement.duration || 0)}s
      </div>

      <div className="placement-bar-content">
        <span className="placement-bar-label">{getLabel()}</span>
      </div>
      
      {/* Timing tooltip */}
      {showTooltip && (
        <div className="placement-tooltip">
          <strong>{getLabel()}</strong>
          <div className="tooltip-timing">
            <div>Start: {timingInfo.start}</div>
            <div>Duration: {timingInfo.duration}</div>
            <div>End: {timingInfo.end}</div>
          </div>
        </div>
      )}
      
      {/* Resize handles */}
      <div 
        className="placement-resize-handle left"
        onMouseDown={(e) => handleResizeStart(e, 'left')}
      >
        <span className="resize-grip">⋮</span>
      </div>
      <div 
        className="placement-resize-handle right"
        onMouseDown={(e) => handleResizeStart(e, 'right')}
      >
        <span className="resize-grip">⋮</span>
      </div>
    </div>
  );
};

/**
 * SceneClip - Video/image clip representation on Scenes lane (Track 1)
 * Shows thumbnail, metadata, trim handles
 * Now draggable for repositioning on timeline
 */
const SceneClip = ({ scene, position, isSelected, hasVideo, isImage, thumbnail, duration, onClick, onDrag }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isTrimming, setIsTrimming] = useState(null); // 'left' or 'right'
  
  // Make scene droppable for receiving assets from library
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `scene-${scene.id}`,
    data: {
      type: 'scene',
      scene: scene
    }
  });
  
  // Make scene draggable for repositioning
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: `drag-scene-${scene.id}`,
    data: {
      type: 'scene-clip',
      scene: scene,
      trackType: 'video'
    },
    disabled: !hasVideo // Only draggable if has video
  });
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getMediaTypeIcon = () => {
    if (!hasVideo) return null;
    return isImage ? '📷' : '🎥';
  };

  // Empty state (no primary video/image) - droppable but not draggable
  if (!hasVideo) {
    return (
      <div
        ref={setDropRef}
        className={`scene-clip scene-clip-empty ${isOver ? 'scene-clip-drop-target' : ''}`}
        style={{
          left: `${position.left}%`,
          width: `${position.width}%`,
        }}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="scene-clip-empty-content">
          <div className="scene-clip-empty-icon">📹</div>
          <div className="scene-clip-empty-text">Drop Video Here</div>
        </div>
        <div className="scene-clip-metadata">
          <span className="scene-clip-number">#{scene.scene_order}</span>
        </div>
        {showTooltip && (
          <div className="scene-clip-tooltip">
            <strong>Empty Scene Slot</strong>
            <div>Drag a video or image from the library to set the primary clip for this scene.</div>
          </div>
        )}
      </div>
    );
  }

  // Video/image clip state - both droppable and draggable
  const dragStyle = transform ? {
    transform: `translate3d(${transform.x}px, 0px, 0)`,
    zIndex: 1000,
  } : {};
  
  return (
    <div
      ref={(node) => {
        setDropRef(node);
        setDragRef(node);
      }}
      {...attributes}
      {...listeners}
      className={`scene-clip ${isSelected ? 'scene-clip-selected' : ''} ${isTrimming ? 'scene-clip-trimming' : ''} ${isOver ? 'scene-clip-drop-target' : ''} ${isDragging ? 'scene-clip-dragging' : ''}`}
      style={{
        left: `${position.left}%`,
        width: `${position.width}%`,
        ...dragStyle,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onClick={onClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Filmstrip thumbnail background */}
      {thumbnail && (
        <div className="scene-clip-filmstrip">
          {/* Generate multiple thumbnail tiles for filmstrip effect */}
          {Array.from({ length: Math.max(1, Math.ceil(duration / 5)) }).map((_, index) => (
            <div
              key={index}
              className="filmstrip-frame"
              style={{
                backgroundImage: `url(${thumbnail})`,
                backgroundPosition: `${index * -10}% center`,
                backgroundSize: 'cover'
              }}
            />
          ))}
        </div>
      )}

      {/* Dark overlay for readability */}
      <div className="scene-clip-overlay" />

      {/* Professional NLE Features */}
      <div className="clip-trim-handle clip-trim-handle-left" title="Trim start" />
      <div className="clip-trim-handle clip-trim-handle-right" title="Trim end" />
      <div className="clip-duration-display">
        {Math.floor(duration)}s
      </div>

      {/* Metadata overlay */}
      <div className="scene-clip-metadata">
        <span className="scene-clip-number">#{scene.scene_order}</span>
      </div>

      {/* Duration badge */}
      <div className="scene-clip-duration-badge">
        {getMediaTypeIcon()} {formatTime(duration)}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="scene-clip-tooltip">
          <strong>{scene.title_override || `Scene ${scene.scene_order}`}</strong>
          <div className="tooltip-timing">
            <div>Duration: {formatTime(duration)}</div>
            <div>Type: {isImage ? 'Image' : 'Video'}</div>
            {scene.libraryScene?.name && <div>Source: {scene.libraryScene.name}</div>}
          </div>
        </div>
      )}

      {/* Trim handles */}
      <div 
        className="scene-clip-trim-handle scene-clip-trim-left"
        onMouseDown={(e) => {
          e.stopPropagation();
          setIsTrimming('left');
        }}
        title="Trim start"
      >
        <span className="trim-grip">[</span>
      </div>
      <div 
        className="scene-clip-trim-handle scene-clip-trim-right"
        onMouseDown={(e) => {
          e.stopPropagation();
          setIsTrimming('right');
        }}
        title="Trim end"
      >
        <span className="trim-grip">]</span>
      </div>
    </div>
  );
};

export default TimelineLanes;
