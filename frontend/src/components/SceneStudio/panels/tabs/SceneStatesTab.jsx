import React, { useState, useCallback } from 'react';
import { GitBranch, Plus, Trash2, Check, Edit3 } from 'lucide-react';

/**
 * SceneStatesTab — Manage scene states (Day/Night, Bed Made/Unmade, etc.)
 *
 * Scene states snapshot all current objects. Switching states activates
 * the stored variant for each object. Uses canvas_settings.sceneStates
 * for persistence — no new backend endpoints needed.
 */

export default function SceneStatesTab({
  sceneStates = [],
  activeSceneState,
  onCreateState,
  onActivateState,
  onDeleteState,
  onRenameState,
}) {
  const [newStateName, setNewStateName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleCreate = useCallback(() => {
    if (!newStateName.trim()) return;
    onCreateState(newStateName.trim());
    setNewStateName('');
  }, [newStateName, onCreateState]);

  const handleRename = useCallback((stateId) => {
    if (!editValue.trim()) return;
    onRenameState(stateId, editValue.trim());
    setEditingId(null);
    setEditValue('');
  }, [editValue, onRenameState]);

  return (
    <div className="scene-studio-states-tab">
      <div className="scene-studio-section-label">
        <GitBranch size={12} /> Scene States
      </div>
      <p className="scene-studio-hint-text">
        Create states like "Day" and "Night". Each state snapshots your current objects.
        Switch between states to swap the entire scene.
      </p>

      {/* Create new state */}
      <div className="scene-studio-state-create">
        <input
          type="text"
          className="scene-studio-state-input"
          placeholder="State name (e.g., Night)"
          value={newStateName}
          onChange={(e) => setNewStateName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button
          className="scene-studio-btn primary"
          onClick={handleCreate}
          disabled={!newStateName.trim()}
        >
          <Plus size={12} /> Create
        </button>
      </div>

      {/* State list */}
      <div className="scene-studio-state-list">
        {sceneStates.length === 0 && (
          <div className="scene-studio-empty-state">
            No states yet. Create one to snapshot your scene.
          </div>
        )}

        {sceneStates.map((st) => (
          <div
            key={st.id}
            className={`scene-studio-state-item ${st.id === activeSceneState ? 'active' : ''}`}
          >
            {editingId === st.id ? (
              <input
                className="scene-studio-state-input inline"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleRename(st.id)}
                onKeyDown={(e) => e.key === 'Enter' && handleRename(st.id)}
                autoFocus
              />
            ) : (
              <button
                className="scene-studio-state-name"
                onClick={() => onActivateState(st.id)}
              >
                {st.id === activeSceneState && <Check size={10} />}
                {st.name}
                <span className="scene-studio-state-count">{st.objectCount || 0} obj</span>
              </button>
            )}
            <div className="scene-studio-state-actions">
              <button
                className="scene-studio-icon-btn"
                onClick={() => { setEditingId(st.id); setEditValue(st.name); }}
                title="Rename"
              >
                <Edit3 size={10} />
              </button>
              <button
                className="scene-studio-icon-btn danger"
                onClick={() => onDeleteState(st.id)}
                title="Delete state"
              >
                <Trash2 size={10} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
