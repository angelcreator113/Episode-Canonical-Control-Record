import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import TimelineScene from './TimelineScene';

/**
 * SortableTimelineScene - Wrapper for TimelineScene with @dnd-kit sortable and droppable
 */
export const SortableTimelineScene = ({ 
  scene, 
  startTime, 
  widthPercent,
  isEditing,
  isDragging,
  placements = [],
  selectedPlacementId,
  onEdit,
  onSave,
  onCancel,
  onClick,
  onPlacementClick
}) => {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging: isThisDragging,
    setActivatorNodeRef,
  } = useSortable({ 
    id: scene.id,
    disabled: isEditing, // Disable drag when editing
  });

  // Add droppable for library assets
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `scene-${scene.id}`,
    data: {
      scene: scene,
      accepts: ['library-asset', 'wardrobe-item'],
    },
  });

  // Combine refs
  const setNodeRef = (node) => {
    setSortableRef(node);
    setDroppableRef(node);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isThisDragging ? 0.5 : 1,
    cursor: isEditing ? 'default' : 'grab',
    outline: isOver ? '2px solid #3b82f6' : 'none',
    outlineOffset: isOver ? '2px' : '0',
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`sortable-scene-wrapper ${isThisDragging ? 'timeline-scene-dragging' : ''} ${isOver ? 'timeline-scene-drop-target' : ''}`}
    >
      {/* Drag handle for reordering - only this has listeners */}
      <div 
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="scene-drag-handle"
        title="Drag to reorder"
      >
        ⋮⋮
      </div>
      
      <TimelineScene
        scene={scene}
        startTime={startTime}
        widthPercent={widthPercent}
        isEditing={isEditing}
        isDragging={isThisDragging}
        placements={placements}
        selectedPlacementId={selectedPlacementId}
        onEdit={onEdit}
        onSave={onSave}
        onCancel={onCancel}
        onClick={onClick}
        onPlacementClick={onPlacementClick}
      />
    </div>
  );
};

export default SortableTimelineScene;
