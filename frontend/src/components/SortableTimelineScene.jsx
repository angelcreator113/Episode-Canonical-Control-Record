import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TimelineScene from './TimelineScene';

/**
 * SortableTimelineScene - Wrapper for TimelineScene with @dnd-kit sortable
 */
export const SortableTimelineScene = ({ 
  scene, 
  startTime, 
  widthPercent,
  isEditing,
  isDragging,
  onEdit,
  onSave,
  onCancel
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isThisDragging,
  } = useSortable({ 
    id: scene.id,
    disabled: isEditing, // Disable drag when editing
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isThisDragging ? 0.5 : 1,
    cursor: isEditing ? 'default' : 'grab',
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={isThisDragging ? 'timeline-scene-dragging' : ''}
    >
      <TimelineScene
        scene={scene}
        startTime={startTime}
        widthPercent={widthPercent}
        isEditing={isEditing}
        isDragging={isThisDragging}
        onEdit={onEdit}
        onSave={onSave}
        onCancel={onCancel}
      />
    </div>
  );
};

export default SortableTimelineScene;
