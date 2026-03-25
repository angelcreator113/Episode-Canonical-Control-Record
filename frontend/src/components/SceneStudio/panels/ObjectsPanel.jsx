import React, { useCallback, useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, Trash2, Copy, GripVertical, Image, Video, Type, Square, Layers, ChevronDown, ChevronRight } from 'lucide-react';

/**
 * ObjectsPanel — Left panel showing all objects as a layer list.
 * Supports visibility/lock toggles, selection, reorder, delete.
 * Groups objects by depth layer: Foreground > Midground > Background.
 */

const LAYER_ORDER = ['foreground', 'midground', 'background'];
const LAYER_LABELS = { foreground: 'Foreground', midground: 'Midground', background: 'Background' };

export default function ObjectsPanel({
  objects,
  selectedIds,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onReorder,
  onDelete,
  onDuplicate,
  onUpdateObject,
  embedded,
  hasBackground,
}) {
  // Sort by layer order descending (top layer first in the list)
  const sorted = [...objects].sort((a, b) => (b.layerOrder || 0) - (a.layerOrder || 0));
  const [collapsedLayers, setCollapsedLayers] = useState({});

  const toggleLayerCollapse = useCallback((layer) => {
    setCollapsedLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  // Group by depth layer
  const grouped = LAYER_ORDER.map((layer) => ({
    layer,
    label: LAYER_LABELS[layer],
    items: sorted.filter((o) => (o.depthLayer || 'midground') === layer),
  }));

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
    // List is sorted descending — higher layerOrder = higher in the list
    const target = objects.find((o) => o.id === targetId);
    if (target) {
      const dragObj = objects.find((o) => o.id === dragId);
      if (dragObj && dragObj.layerOrder > target.layerOrder) {
        onReorder(dragId, 'down');
      } else {
        onReorder(dragId, 'up');
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

        {sorted.length > 0 && grouped.map(({ layer, label, items }) => (
          <div key={layer} className="scene-studio-layer-group">
            {/* Layer header — only show when there are objects across multiple layers */}
            <div
              className="scene-studio-layer-header"
              onClick={() => toggleLayerCollapse(layer)}
            >
              {collapsedLayers[layer] ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
              <span>{label}</span>
              <span className="scene-studio-layer-count">{items.length}</span>
            </div>

            {!collapsedLayers[layer] && items.map((obj) => {
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
        ))}
      </div>
    </div>
  );
}
