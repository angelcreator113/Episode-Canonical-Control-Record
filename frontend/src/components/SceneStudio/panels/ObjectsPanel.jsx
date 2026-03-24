import React, { useCallback } from 'react';
import { Eye, EyeOff, Lock, Unlock, Trash2, Copy, GripVertical, Image, Video, Type, Square, Layers } from 'lucide-react';

/**
 * ObjectsPanel — Left panel showing all objects as a layer list.
 * Supports visibility/lock toggles, selection, reorder, delete.
 */
export default function ObjectsPanel({
  objects,
  selectedIds,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onReorder,
  onDelete,
  onDuplicate,
  embedded,
  hasBackground,
}) {
  // Sort by layer order descending (top layer first in the list)
  const sorted = [...objects].sort((a, b) => (b.layerOrder || 0) - (a.layerOrder || 0));

  const typeIcons = {
    image: Image,
    video: Video,
    text: Type,
    shape: Square,
    decor: Image,
    overlay: Layers,
  };

  const handleDragStart = useCallback((e, id) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e, targetId) => {
    e.preventDefault();
    const dragId = e.dataTransfer.getData('text/plain');
    if (!dragId || dragId === targetId || !onReorder) return;

    // Find target layer order and move dragged item there
    const target = objects.find((o) => o.id === targetId);
    if (target) {
      // Moving to the target's position; direction depends on relative position
      const dragObj = objects.find((o) => o.id === dragId);
      if (dragObj && dragObj.layerOrder < target.layerOrder) {
        onReorder(dragId, 'up');
      } else {
        onReorder(dragId, 'down');
      }
    }
  }, [objects, onReorder]);

  return (
    <div className={`scene-studio-objects-panel ${embedded ? 'embedded' : ''}`}>
      {!embedded && (
        <div className="scene-studio-panel-header">
          <Layers size={14} />
          <span>Objects</span>
          <span className="scene-studio-badge">{objects.length}</span>
        </div>
      )}

      <div className="scene-studio-objects-list">
        {sorted.length === 0 && (
          <div className="scene-studio-empty-state">
            {hasBackground
              ? 'Background set. Add objects using the tabs above.'
              : 'No objects yet. Use the tabs to add content.'}
          </div>
        )}

        {sorted.map((obj) => {
          const isSelected = selectedIds.has(obj.id);
          const TypeIcon = typeIcons[obj.type] || Image;
          const isVariant = !!obj.variantGroupId;
          const isInactiveVariant = isVariant && !obj.isActiveVariant;

          return (
            <div
              key={obj.id}
              className={`scene-studio-object-row ${isSelected ? 'selected' : ''} ${isInactiveVariant ? 'inactive-variant' : ''}`}
              onClick={() => onSelect && onSelect(obj.id)}
              draggable
              onDragStart={(e) => handleDragStart(e, obj.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, obj.id)}
            >
              <GripVertical size={12} className="scene-studio-drag-handle" />

              <TypeIcon size={14} className="scene-studio-type-icon" />

              <span className="scene-studio-object-label" title={obj.label}>
                {obj.label || 'Untitled'}
                {isVariant && (
                  <span className="scene-studio-variant-badge">
                    {obj.variantLabel || 'variant'}
                  </span>
                )}
              </span>

              <div className="scene-studio-object-actions">
                <button
                  className="scene-studio-icon-btn"
                  onClick={(e) => { e.stopPropagation(); onToggleVisibility && onToggleVisibility(obj.id); }}
                  title={obj.isVisible ? 'Hide' : 'Show'}
                >
                  {obj.isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>

                <button
                  className="scene-studio-icon-btn"
                  onClick={(e) => { e.stopPropagation(); onToggleLock && onToggleLock(obj.id); }}
                  title={obj.isLocked ? 'Unlock' : 'Lock'}
                >
                  {obj.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>

                <button
                  className="scene-studio-icon-btn"
                  onClick={(e) => { e.stopPropagation(); onDuplicate && onDuplicate(obj.id); }}
                  title="Duplicate"
                >
                  <Copy size={12} />
                </button>

                <button
                  className="scene-studio-icon-btn danger"
                  onClick={(e) => { e.stopPropagation(); onDelete && onDelete(obj.id); }}
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
