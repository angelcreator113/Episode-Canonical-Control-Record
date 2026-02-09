import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SceneInfoPanel = ({ episodeId, currentComposition, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sceneData, setSceneData] = useState({
    name: '',
    description: '',
    scene_number: 1,
    duration_seconds: 0
  });

  useEffect(() => {
    if (currentComposition?.scene_id) {
      loadSceneData(currentComposition.scene_id);
    }
  }, [currentComposition]);

  const loadSceneData = async (sceneId) => {
    try {
      const response = await axios.get(`/api/v1/scenes/${sceneId}`);
      setSceneData(response.data.data);
    } catch (error) {
      console.error('Failed to load scene:', error);
    }
  };

  const handleSave = async () => {
    try {
      if (currentComposition?.scene_id) {
        await axios.put(`/api/v1/scenes/${currentComposition.scene_id}`, sceneData);
      } else {
        const response = await axios.post('/api/v1/scenes', {
          ...sceneData,
          episode_id: episodeId
        });
        if (onUpdate) onUpdate(response.data.data);
      }
    } catch (error) {
      console.error('Failed to save scene:', error);
    }
  };

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-2 py-2 bg-slate-700 hover:bg-slate-600 rounded text-xs font-medium transition"
      >
        <div className="flex items-center gap-2">
          <span>🎬</span>
          <span className="text-gray-200">Scene Info</span>
        </div>
        <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
      </button>

      {isExpanded && (
        <div className="mt-1 bg-slate-700 rounded p-2 space-y-2 border border-slate-600">
          <div>
            <label className="text-gray-300 text-xs font-semibold block mb-1">Name</label>
            <input
              type="text"
              value={sceneData.name}
              onChange={(e) => setSceneData({ ...sceneData, name: e.target.value })}
              placeholder="Scene name"
              className="w-full bg-slate-800 text-white px-2 py-1 rounded text-xs border border-slate-600"
            />
          </div>

          <div>
            <label className="text-gray-300 text-xs font-semibold block mb-1">Notes</label>
            <textarea
              value={sceneData.description}
              onChange={(e) => setSceneData({ ...sceneData, description: e.target.value })}
              placeholder="Add notes..."
              rows={2}
              className="w-full bg-slate-800 text-white px-2 py-1 rounded text-xs border border-slate-600 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-gray-300 text-xs font-semibold block mb-1">#</label>
              <input
                type="number"
                value={sceneData.scene_number}
                onChange={(e) => setSceneData({ ...sceneData, scene_number: parseInt(e.target.value) || 1 })}
                className="w-full bg-slate-800 text-white px-2 py-1 rounded text-xs border border-slate-600"
              />
            </div>
            <div>
              <label className="text-gray-300 text-xs font-semibold block mb-1">Duration</label>
              <input
                type="number"
                value={sceneData.duration_seconds}
                onChange={(e) => setSceneData({ ...sceneData, duration_seconds: parseInt(e.target.value) || 0 })}
                placeholder="seconds"
                className="w-full bg-slate-800 text-white px-2 py-1 rounded text-xs border border-slate-600"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-semibold transition"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
};

export default SceneInfoPanel;
