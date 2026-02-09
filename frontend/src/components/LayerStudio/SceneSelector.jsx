import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SceneSelector = ({ episodeId, currentSceneId, onSceneChange, onCreateScene }) => {
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingSceneId, setEditingSceneId] = useState(null);
  const [editingSceneName, setEditingSceneName] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    loadScenes();
  }, [episodeId]);

  const loadScenes = async () => {
    try {
      const response = await axios.get(`/api/v1/scenes?episode_id=${episodeId}`);
      const scenesData = response.data.data || [];
      setScenes(scenesData.sort((a, b) => a.scene_number - b.scene_number));
      
      // Auto-select first scene if none selected
      if (!currentSceneId && scenesData.length > 0) {
        onSceneChange(scenesData[0]);
      }
    } catch (error) {
      console.error('Failed to load scenes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSceneName = async (sceneId, newName) => {
    if (!newName.trim()) return;
    
    try {
      await axios.patch(`/api/v1/scenes/${sceneId}`, {
        name: newName
      });
      
      setScenes(scenes.map(s => 
        s.id === sceneId ? { ...s, name: newName } : s
      ));
      setEditingSceneId(null);
    } catch (error) {
      console.error('Failed to update scene name:', error);
    }
  };

  const handleCreateScene = async () => {
    try {
      const response = await axios.post('/api/v1/scenes', {
        episode_id: episodeId,
        name: `Scene ${scenes.length + 1}`,
        scene_number: scenes.length + 1,
        type: 'main',
        duration_seconds: 0
      });
      
      const newScene = response.data.data;
      setScenes([...scenes, newScene]);
      setShowDropdown(false);
      onSceneChange(newScene);
      if (onCreateScene) onCreateScene(newScene);
    } catch (error) {
      console.error('Failed to create scene:', error);
    }
  };

  const currentScene = scenes.find(s => s.id === currentSceneId);

  return (
    <div className="relative flex-1">
      {/* Scene Display & Edit */}
      <div className="relative">
        <div className="flex items-center gap-2">
          {editingSceneId === currentSceneId ? (
            <>
              <input
                type="text"
                value={editingSceneName}
                onChange={(e) => setEditingSceneName(e.target.value)}
                onBlur={() => {
                  if (editingSceneName.trim() !== currentScene?.name) {
                    handleUpdateSceneName(currentSceneId, editingSceneName);
                  } else {
                    setEditingSceneId(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleUpdateSceneName(currentSceneId, editingSceneName);
                  } else if (e.key === 'Escape') {
                    setEditingSceneId(null);
                  }
                }}
                autoFocus
                className="flex-1 bg-blue-600 text-white px-3 py-2.5 rounded-lg font-semibold border-2 border-blue-400 focus:outline-none"
                placeholder="Scene name..."
              />
              <button
                onClick={() => handleUpdateSceneName(currentSceneId, editingSceneName)}
                className="px-2.5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition text-sm"
              >
                ✓
              </button>
            </>
          ) : (
            <>
              <div 
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-lg font-semibold border-2 border-slate-600 hover:border-blue-500 transition cursor-pointer"
              >
                {currentScene ? `${currentScene.name || 'Untitled'}` : 'Select Scene'}
              </div>
              {currentScene && (
                <button
                  onClick={() => {
                    setEditingSceneId(currentSceneId);
                    setEditingSceneName(currentScene.name);
                  }}
                  className="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg transition text-sm font-semibold"
                  title="Edit scene name"
                >
                  ✏️
                </button>
              )}
            </>
          )}
        </div>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border-2 border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              {scenes.map(scene => (
                <button
                  key={scene.id}
                  onClick={() => {
                    onSceneChange(scene);
                    setShowDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-3 font-medium transition border-b border-slate-700 last:border-b-0 ${
                    scene.id === currentSceneId
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                  }`}
                >
                  <div className="font-semibold">Scene {scene.scene_number}: {scene.name || 'Untitled'}</div>
                  <div className="text-xs text-gray-400 mt-1">Duration: {scene.duration_seconds}s</div>
                </button>
              ))}
            </div>
            <button
              onClick={handleCreateScene}
              className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold transition text-left"
            >
              + Create New Scene
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SceneSelector;
