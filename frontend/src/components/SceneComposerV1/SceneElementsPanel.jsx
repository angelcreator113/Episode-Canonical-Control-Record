import React from 'react';

/**
 * SceneElementsPanel - Shows the list of elements (layers) in the scene
 * 
 * Handles: selection, visibility, lock, reorder
 */
export default function SceneElementsPanel({ elements, selectedElementId, onSelect, onChange }) {
  const handleToggleVisibility = (elementId) => {
    const updated = elements.map(el =>
      el.id === elementId ? { ...el, hidden: !el.hidden } : el
    );
    onChange(updated);
  };

  const handleToggleLock = (elementId) => {
    const updated = elements.map(el =>
      el.id === elementId ? { ...el, locked: !el.locked } : el
    );
    onChange(updated);
  };

  const handleReorder = (elementId, direction) => {
    const index = elements.findIndex(el => el.id === elementId);
    if (index === -1) return;

    const newElements = [...elements];
    const element = newElements[index];

    if (direction === 'up' && index < newElements.length - 1) {
      // Swap with next element
      newElements[index] = newElements[index + 1];
      newElements[index + 1] = element;
      // Update zIndex
      const tempZ = newElements[index].zIndex;
      newElements[index].zIndex = newElements[index + 1].zIndex;
      newElements[index + 1].zIndex = tempZ;
    } else if (direction === 'down' && index > 0) {
      // Swap with previous element
      newElements[index] = newElements[index - 1];
      newElements[index - 1] = element;
      // Update zIndex
      const tempZ = newElements[index].zIndex;
      newElements[index].zIndex = newElements[index - 1].zIndex;
      newElements[index - 1].zIndex = tempZ;
    }

    onChange(newElements);
  };

  const getRoleIcon = (role) => {
    const icons = {
      'background': '🖼️',
      'hero': '⭐',
      'primary': '🎬',
      'overlay': '🔲',
      'lower-third': '📊',
      'b-roll': '🎞️',
      'costume': '👗'
    };
    return icons[role] || '📄';
  };

  return (
    <div className="scene-elements-panel">
      <div className="panel-header">
        <h3>Scene Elements</h3>
        <span className="element-count">{elements.length}</span>
      </div>

      <div className="elements-list">
        {elements.length === 0 ? (
          <div className="elements-empty">
            <span className="empty-icon">📋</span>
            <p>No elements yet. Drag from Asset Drawer to begin.</p>
          </div>
        ) : (
          [...elements]
            .sort((a, b) => b.zIndex - a.zIndex) // Show top layers first
            .map((element) => {
              const isSelected = element.id === selectedElementId;

              return (
                <div
                  key={element.id}
                  className={`element-item ${isSelected ? 'element-item-selected' : ''} ${element.hidden ? 'element-item-hidden' : ''}`}
                  onClick={() => onSelect(element.id)}
                >
                  <div className="element-icon">
                    {getRoleIcon(element.role)}
                  </div>

                  <div className="element-info">
                    <div className="element-role">{element.role}</div>
                    <div className="element-id">{element.id}</div>
                  </div>

                  <div className="element-actions">
                    <button
                      className={`btn-icon ${element.hidden ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleVisibility(element.id);
                      }}
                      title={element.hidden ? 'Show' : 'Hide'}
                    >
                      {element.hidden ? '👁️‍🗨️' : '👁️'}
                    </button>

                    <button
                      className={`btn-icon ${element.locked ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleLock(element.id);
                      }}
                      title={element.locked ? 'Unlock' : 'Lock'}
                    >
                      {element.locked ? '🔒' : '🔓'}
                    </button>

                    <button
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorder(element.id, 'up');
                      }}
                      title="Move up"
                    >
                      ↑
                    </button>

                    <button
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorder(element.id, 'down');
                      }}
                      title="Move down"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}
