import React, { useState, useEffect } from 'react';
import axios from 'axios';
import useKeyboardShortcuts from './useKeyboardShortcuts';
import useSnapToGrid from './useSnapToGrid';
import KeyboardShortcutsPanel from './KeyboardShortcutsPanel';
import CanvasPresetSelector from './CanvasPresetSelector';
import SceneSelector from './SceneSelector';
import FirstTimeOverlay from './FirstTimeOverlay';
import BigCanvasEnhanced from './BigCanvasEnhanced';
import { CANVAS_PRESETS } from './canvasPresets';
import decisionLogger from '../../utils/decisionLogger';

const LayerStudioCanvasFirst = ({ episodeId }) => {
  // ===== STATE =====
  const [layers, setLayers] = useState([]);
  const [episodeAssets, setEpisodeAssets] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [currentScene, setCurrentScene] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canvasZoom, setCanvasZoom] = useState(0.5);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [canvasPreset, setCanvasPreset] = useState(CANVAS_PRESETS.youtube);
  const [showFirstTimeOverlay, setShowFirstTimeOverlay] = useState(false);
  
  // DRAWER STATES
  const [mediaBinOpen, setMediaBinOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [timelineMinimized, setTimelineMinimized] = useState(false);

  const { snapPosition } = useSnapToGrid(50, snapEnabled);

  const LAYER_CONFIG = {
    5: { name: 'Audio/Music', icon: '🎵', color: '#9333ea' },
    4: { name: 'Text/Captions', icon: '📝', color: '#3b82f6' },
    3: { name: 'Assets/Wardrobe', icon: '🎨', color: '#10b981' },
    2: { name: 'Raw Footage', icon: '🎬', color: '#f59e0b' },
    1: { name: 'Background', icon: '🖼️', color: '#6b7280' }
  };

  // ===== LIFECYCLE =====
  useEffect(() => {
    decisionLogger.setContext(episodeId, currentScene?.id);
    loadLayers();
    loadEpisodeAssets();
    
    const hasSeenTour = localStorage.getItem('layerStudioTourComplete');
    if (!hasSeenTour) {
      setTimeout(() => setShowFirstTimeOverlay(true), 1000);
    }
  }, [episodeId, currentScene?.id]);

  // Auto-open inspector when asset selected
  useEffect(() => {
    if (selectedAsset) {
      setInspectorOpen(true);
    }
  }, [selectedAsset]);

  // ===== DATA LOADING =====
  const loadLayers = async () => {
    try {
      const params = new URLSearchParams({ episode_id: episodeId });
      if (currentScene?.id) params.append('scene_id', currentScene.id);
      
      const response = await axios.get(`/api/v1/layers?${params}`);
      const layersData = response.data.data || [];
      const uniqueLayers = layersData.reduce((acc, layer) => {
        if (!acc.find(l => l.layer_number === layer.layer_number)) {
          acc.push(layer);
        }
        return acc;
      }, []);
      setLayers(uniqueLayers);
    } catch (error) {
      console.error('❌ Failed to load layers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeAssets = async () => {
    try {
      const response = await axios.get(`/api/v1/episodes/${episodeId}/assets`);
      setEpisodeAssets(response.data.data || []);
    } catch (error) {
      console.error('❌ Failed to load assets:', error);
    }
  };

  const initializeLayers = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/v1/layers/bulk-create', { 
        episode_id: episodeId,
        scene_id: currentScene?.id 
      });
      setLayers(response.data.data || []);
      
      response.data.data?.forEach(layer => {
        decisionLogger.logLayerCreated(layer.id, layer.layer_number, LAYER_CONFIG[layer.layer_number].name);
      });
    } catch (error) {
      console.error('Failed to initialize layers:', error);
    } finally {
      setLoading(false);
    }
  };

  // ===== SCENE HANDLERS =====
  const handleSceneChange = (scene) => {
    setCurrentScene(scene);
    decisionLogger.setContext(episodeId, scene.id);
    loadLayers();
  };

  const handleSceneCreate = (scene) => {
    decisionLogger.logSceneCreated(scene.id, scene.name, scene.scene_number);
  };

  // ===== ASSET OPERATIONS =====
  const handleAssetDrop = async (layerId, asset, position = null) => {
    try {
      const snappedPos = position ? snapPosition(position.x, position.y) : snapPosition(100, 100);
      const layer = layers.find(l => l.id === layerId);
      
      await axios.post(`/api/v1/layers/${layerId}/assets`, {
        asset_id: asset.id,
        position_x: snappedPos.x,
        position_y: snappedPos.y,
        width: 400,
        height: 400,
        opacity: 1.0,
        scale_x: 1.0,
        scale_y: 1.0,
        in_point_seconds: 0,
        out_point_seconds: currentScene?.duration_seconds || 10
      });

      decisionLogger.logAssetPositioned(
        asset.id,
        { x: snappedPos.x, y: snappedPos.y },
        { width: 400, height: 400 },
        layer?.layer_number
      );

      await loadLayers();
    } catch (error) {
      console.error('❌ Failed to add asset:', error);
    }
  };

  const handleAssetUpdate = async (assetId, updates) => {
    try {
      const asset = layers.flatMap(l => l.assets || []).find(a => a.id === assetId);
      
      if (updates.position_x !== undefined || updates.position_y !== undefined) {
        if (asset && snapEnabled) {
          const snapped = snapPosition(
            updates.position_x ?? asset.position_x,
            updates.position_y ?? asset.position_y
          );
          updates = { ...updates, position_x: snapped.x, position_y: snapped.y };
        }
      }

      await axios.put(`/api/v1/layers/assets/${assetId}`, updates);

      if (asset) {
        Object.entries(updates).forEach(([property, newValue]) => {
          const oldValue = asset[property];
          if (oldValue !== newValue) {
            decisionLogger.logAssetPropertyChanged(assetId, property, oldValue, newValue);
          }
        });

        if (updates.in_point_seconds !== undefined || updates.out_point_seconds !== undefined) {
          decisionLogger.logTimingSet(
            assetId,
            updates.in_point_seconds ?? asset.in_point_seconds,
            updates.out_point_seconds ?? asset.out_point_seconds,
            (updates.out_point_seconds ?? asset.out_point_seconds) - (updates.in_point_seconds ?? asset.in_point_seconds)
          );
        }
      }

      loadLayers();
    } catch (error) {
      console.error('Failed to update asset:', error);
    }
  };

  const handleAssetRemove = async (assetId) => {
    try {
      await axios.delete(`/api/v1/layers/assets/${assetId}`);
      decisionLogger.log('ASSET_REMOVED', 'asset', assetId, {});
      setSelectedAsset(null);
      loadLayers();
    } catch (error) {
      console.error('Failed to remove asset:', error);
    }
  };

  const handleLayerUpdate = async (layerId, updates) => {
    try {
      await axios.put(`/api/v1/layers/${layerId}`, updates);
      loadLayers();
    } catch (error) {
      console.error('Failed to update layer:', error);
    }
  };

  // ===== KEYBOARD SHORTCUTS =====
  useKeyboardShortcuts({
    layers,
    selectedLayer,
    selectedAsset,
    setSelectedLayer,
    setSelectedAsset,
    onLayerUpdate: handleLayerUpdate,
    onAssetUpdate: handleAssetUpdate,
    onAssetRemove: handleAssetRemove,
    canvasZoom,
    setCanvasZoom
  });

  // ===== LOADING STATE =====
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white font-semibold">Loading Scene Composer...</p>
        </div>
      </div>
    );
  }

  // ===== INITIALIZATION STATE =====
  if (layers.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <div className="bg-gray-900 rounded-xl shadow-2xl p-12 text-center max-w-md border border-gray-800">
          <div className="text-7xl mb-6">🎬</div>
          <h2 className="text-3xl font-bold text-white mb-3">Scene Composer</h2>
          <p className="text-gray-400 mb-2">Professional 5-Layer Composition System</p>
          <p className="text-gray-500 text-sm mb-8">
            {currentScene ? `Scene: ${currentScene.name || 'Untitled'}` : 'No scene selected'}
          </p>
          <button
            onClick={initializeLayers}
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-lg transition text-lg font-semibold"
          >
            🚀 Initialize Layers
          </button>
          <div className="mt-6 text-sm text-gray-500">
            Creates: Background • Raw Footage • Assets/Wardrobe • Text • Audio
          </div>
        </div>
      </div>
    );
  }

  const sortedLayers = [...layers].sort((a, b) => b.layer_number - a.layer_number);
  const allAssets = sortedLayers.flatMap(layer => 
    (layer.assets || []).map(asset => ({
      ...asset,
      layer_number: layer.layer_number,
      layer_visible: layer.is_visible,
      layer_opacity: layer.opacity
    }))
  );

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      {/* ===== MINIMAL HEADER ===== */}
      <div className="h-12 bg-gray-900 border-b border-gray-800 px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* Scene Selector */}
          <SceneSelector
            episodeId={episodeId}
            currentSceneId={currentScene?.id}
            onSceneChange={handleSceneChange}
            onCreateScene={handleSceneCreate}
          />

          {/* Quick Add */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMediaBinOpen(true)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition"
              title="Add background"
            >
              🖼️
            </button>
            <button
              onClick={() => setMediaBinOpen(true)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition"
              title="Add footage"
            >
              🎬
            </button>
            <button
              onClick={() => setMediaBinOpen(true)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition"
              title="Add assets"
            >
              ✍️
            </button>
          </div>

          {/* Preset Selector */}
          <CanvasPresetSelector currentPreset={canvasPreset} onPresetChange={setCanvasPreset} />
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`px-3 py-1.5 rounded text-sm transition ${
              snapEnabled ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {snapEnabled ? '🔲' : '□'} Snap
          </button>

          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`px-3 py-1.5 rounded text-sm transition ${
              showGrid ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Grid
          </button>

          <div className="flex items-center gap-1 bg-gray-800 rounded px-2">
            <button
              onClick={() => setCanvasZoom(Math.max(0.25, canvasZoom - 0.25))}
              className="text-white hover:text-purple-400 px-2 py-1"
            >−</button>
            <span className="text-white text-xs font-mono w-12 text-center">
              {Math.round(canvasZoom * 100)}%
            </span>
            <button
              onClick={() => setCanvasZoom(Math.min(3, canvasZoom + 0.25))}
              className="text-white hover:text-purple-400 px-2 py-1"
            >+</button>
          </div>
        </div>
      </div>

      {/* ===== MAIN LAYOUT ===== */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* CANVAS (DOMINANT) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <BigCanvasEnhanced
            allAssets={allAssets}
            zoom={canvasZoom}
            selectedAsset={selectedAsset}
            showGrid={showGrid}
            snapEnabled={snapEnabled}
            canvasWidth={canvasPreset.width}
            canvasHeight={canvasPreset.height}
            presetName={canvasPreset.name}
            presetIcon={canvasPreset.icon}
            onAssetSelect={(asset) => {
              setSelectedAsset(asset);
              if (asset) setInspectorOpen(true);
            }}
            onAssetUpdate={handleAssetUpdate}
            onAssetDrop={handleAssetDrop}
            layers={sortedLayers}
          />

          {/* TIMELINE (HORIZONTAL, BOTTOM) */}
          <div className={`border-t border-gray-800 bg-gray-900 transition-all ${
            timelineMinimized ? 'h-8' : 'h-64'
          }`}>
            {timelineMinimized ? (
              <button
                onClick={() => setTimelineMinimized(false)}
                className="w-full h-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-800 transition"
              >
                ▲ Timeline
              </button>
            ) : (
              <HorizontalTimeline
                layers={sortedLayers}
                selectedAsset={selectedAsset}
                onAssetSelect={(asset) => {
                  setSelectedAsset(asset);
                  setInspectorOpen(true);
                }}
                onAssetUpdate={handleAssetUpdate}
                sceneDuration={currentScene?.duration_seconds || 60}
                onMinimize={() => setTimelineMinimized(true)}
                config={LAYER_CONFIG}
              />
            )}
          </div>
        </div>

        {/* MEDIA BIN DRAWER (LEFT) */}
        <MediaBinDrawer
          isOpen={mediaBinOpen}
          onClose={() => setMediaBinOpen(false)}
          assets={episodeAssets}
          onAssetDrop={handleAssetDrop}
          layers={sortedLayers}
        />

        {/* INSPECTOR DRAWER (RIGHT) */}
        <InspectorDrawer
          isOpen={inspectorOpen}
          onClose={() => {
            setInspectorOpen(false);
            setSelectedAsset(null);
          }}
          selectedAsset={selectedAsset}
          onAssetUpdate={handleAssetUpdate}
          onAssetRemove={handleAssetRemove}
        />
      </div>

      {/* ===== OVERLAYS ===== */}
      {showFirstTimeOverlay && (
        <FirstTimeOverlay onClose={() => {
          setShowFirstTimeOverlay(false);
          localStorage.setItem('layerStudioTourComplete', 'true');
        }} />
      )}

      <KeyboardShortcutsPanel />
    </div>
  );
};

// ===== HORIZONTAL TIMELINE =====
const HorizontalTimeline = ({ layers, selectedAsset, onAssetSelect, onAssetUpdate, sceneDuration, onMinimize, config }) => {
  const maxDuration = Math.max(sceneDuration, 
    ...layers.flatMap(l => l.assets || []).map(a => a.out_point_seconds || 0)
  );

  return (
    <div className="h-full flex flex-col">
      <div className="h-8 bg-gray-800 px-4 flex items-center justify-between border-b border-gray-700">
        <span className="text-xs text-gray-400 font-semibold uppercase">Timeline</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-mono">{formatDuration(maxDuration)}</span>
          <button
            onClick={onMinimize}
            className="text-gray-500 hover:text-white text-xs"
          >
            ▼
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {layers.map(layer => {
          const layerAssets = layer.assets || [];
          const cfg = config[layer.layer_number];

          return (
            <div key={layer.id} className="mb-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-20 flex items-center gap-1">
                  <span className="text-lg">{cfg.icon}</span>
                  <span className="text-xs text-gray-400">L{layer.layer_number}</span>
                </div>
                <div className="flex-1 h-10 bg-gray-800 rounded relative">
                  {layerAssets.map(asset => {
                    const inPoint = asset.in_point_seconds || 0;
                    const outPoint = asset.out_point_seconds || inPoint + 10;
                    const duration = outPoint - inPoint;
                    const isSelected = selectedAsset?.id === asset.id;

                    return (
                      <div
                        key={asset.id}
                        onClick={() => onAssetSelect(asset)}
                        className={`absolute h-full rounded cursor-pointer transition ${
                          isSelected ? 'ring-2 ring-purple-500 z-10' : 'hover:ring-1 hover:ring-gray-600'
                        }`}
                        style={{
                          left: `${(inPoint / maxDuration) * 100}%`,
                          width: `${(duration / maxDuration) * 100}%`,
                          backgroundColor: cfg.color,
                          opacity: isSelected ? 1 : 0.8
                        }}
                      >
                        {asset.asset?.type === 'image' && asset.asset.url && (
                          <img 
                            src={asset.asset.url} 
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover rounded opacity-20"
                          />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-white text-xs font-bold drop-shadow truncate px-1">
                            {asset.asset?.name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ===== MEDIA BIN DRAWER =====
const MediaBinDrawer = ({ isOpen, onClose, assets, onAssetDrop, layers }) => {
  const [filter, setFilter] = useState('all');
  
  const filteredAssets = filter === 'all' 
    ? assets 
    : assets.filter(a => a.type === filter);

  const handleDragStart = (e, asset) => {
    e.dataTransfer.setData('asset', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (!isOpen) return null;

  return (
    <div className="absolute left-0 top-0 bottom-0 w-80 bg-gray-900 border-r border-gray-800 z-20 flex flex-col">
      <div className="h-12 bg-gray-800 px-4 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
        <span className="text-white font-semibold">Media Bin</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="p-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex gap-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'image', label: 'Images' },
            { id: 'video', label: 'Videos' }
          ].map(type => (
            <button
              key={type.id}
              onClick={() => setFilter(type.id)}
              className={`flex-1 px-3 py-2 rounded text-xs font-semibold transition ${
                filter === type.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        <div className="grid grid-cols-2 gap-2">
          {filteredAssets.map(asset => (
            <div
              key={asset.id}
              draggable
              onDragStart={(e) => handleDragStart(e, asset)}
              className="cursor-move group"
            >
              <div className="bg-gray-800 rounded overflow-hidden border border-gray-700 hover:border-purple-500 transition">
                <div className="h-24 bg-gray-900 flex items-center justify-center">
                  {asset.type === 'image' ? (
                    <img 
                      src={asset.url} 
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-3xl">
                      {asset.type === 'video' ? '🎥' : '🎵'}
                    </div>
                  )}
                </div>
                <div className="p-2 bg-gray-800">
                  <div className="text-xs text-white truncate font-medium">
                    {asset.name}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ===== INSPECTOR DRAWER =====
const InspectorDrawer = ({ isOpen, onClose, selectedAsset, onAssetUpdate, onAssetRemove }) => {
  if (!isOpen || !selectedAsset) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-gray-900 border-l border-gray-800 z-20 flex flex-col">
      <div className="h-12 bg-gray-800 px-4 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
        <span className="text-white font-semibold">Inspector</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="mb-4">
          <div className="text-xs text-gray-500 mb-1">ASSET</div>
          <div className="text-sm font-semibold text-white break-words">
            {selectedAsset.asset?.name}
          </div>
        </div>

        {/* Timing */}
        <div className="mb-6 bg-gray-800 rounded-lg p-3">
          <div className="text-xs font-bold text-purple-400 mb-3 uppercase">⏱️ Timing</div>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Start Time</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={selectedAsset.in_point_seconds || 0}
                onChange={(e) => onAssetUpdate(selectedAsset.id, { in_point_seconds: parseFloat(e.target.value) })}
                className="w-full bg-gray-900 text-white px-3 py-2 rounded text-sm border border-gray-700 focus:border-purple-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">End Time</label>
              <input
                type="number"
                min={selectedAsset.in_point_seconds || 0}
                step="0.1"
                value={selectedAsset.out_point_seconds || 10}
                onChange={(e) => onAssetUpdate(selectedAsset.id, { out_point_seconds: parseFloat(e.target.value) })}
                className="w-full bg-gray-900 text-white px-3 py-2 rounded text-sm border border-gray-700 focus:border-purple-500 outline-none"
              />
            </div>

            <div className="bg-gray-900 rounded p-2">
              <div className="text-xs text-gray-500">Duration</div>
              <div className="text-lg font-bold text-white font-mono">
                {formatDuration((selectedAsset.out_point_seconds || 10) - (selectedAsset.in_point_seconds || 0))}
              </div>
            </div>
          </div>
        </div>

        {/* Transform */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-400 font-semibold">Opacity</label>
              <span className="text-xs text-white font-mono bg-gray-800 px-2 py-1 rounded">
                {Math.round((selectedAsset.opacity || 1.0) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={selectedAsset.opacity || 1.0}
              onChange={(e) => onAssetUpdate(selectedAsset.id, { opacity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-400 font-semibold">Rotation</label>
              <span className="text-xs text-white font-mono bg-gray-800 px-2 py-1 rounded">
                {selectedAsset.rotation || 0}°
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={selectedAsset.rotation || 0}
              onChange={(e) => onAssetUpdate(selectedAsset.id, { rotation: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          <button
            onClick={() => {
              if (window.confirm('Remove this asset?')) {
                onAssetRemove(selectedAsset.id);
              }
            }}
            className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition font-semibold mt-6"
          >
            🗑️ Remove Asset
          </button>
        </div>
      </div>
    </div>
  );
};

// ===== HELPER FUNCTIONS =====
const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default LayerStudioCanvasFirst;
