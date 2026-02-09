import React, { useState, useEffect } from 'react';
import axios from 'axios';
import useKeyboardShortcuts from './useKeyboardShortcuts';
import useSnapToGrid from './useSnapToGrid';
import KeyboardShortcutsPanel from './KeyboardShortcutsPanel';
import CanvasPresetSelector from './CanvasPresetSelector';
import SceneSelector from './SceneSelector';
import FirstTimeOverlay from './FirstTimeOverlay';
import { CANVAS_PRESETS } from './CanvasPresets';
import decisionLogger from '../../utils/decisionLogger';

const LayerStudioProfessional = ({ episodeId }) => {
  // ===== STATE =====
  const [layers, setLayers] = useState([]);
  const [episodeAssets, setEpisodeAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [currentScene, setCurrentScene] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canvasZoom, setCanvasZoom] = useState(0.5);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showGrid, setShowGrid] = useState(false); // Default OFF for calm
  const [canvasPreset, setCanvasPreset] = useState(CANVAS_PRESETS.youtube);
  const [showFirstTimeOverlay, setShowFirstTimeOverlay] = useState(false);
  const [mediaBinOpen, setMediaBinOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const { snapPosition } = useSnapToGrid(50, snapEnabled);

  const LAYER_CONFIG = {
    5: { name: 'Audio/Music', icon: '🎵', color: '#7c3aed' },
    4: { name: 'Text/Captions', icon: '📝', color: '#2563eb' },
    3: { name: 'Assets/Wardrobe', icon: '🎨', color: '#059669' },
    2: { name: 'Raw Footage', icon: '🎬', color: '#d97706' },
    1: { name: 'Background', icon: '🖼️', color: '#64748b' }
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

  useEffect(() => {
    if (selectedAsset) setInspectorOpen(true);
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

  // ===== HANDLERS =====
  const handleSceneChange = (scene) => {
    setCurrentScene(scene);
    decisionLogger.setContext(episodeId, scene.id);
    loadLayers();
  };

  const handleSceneCreate = (scene) => {
    decisionLogger.logSceneCreated(scene.id, scene.name, scene.scene_number);
  };

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

  // ===== KEYBOARD SHORTCUTS =====
  useKeyboardShortcuts({
    layers,
    selectedLayer: null,
    selectedAsset,
    setSelectedLayer: () => {},
    setSelectedAsset,
    onLayerUpdate: () => {},
    onAssetUpdate: handleAssetUpdate,
    onAssetRemove: handleAssetRemove,
    canvasZoom,
    setCanvasZoom
  });

  // ===== LOADING =====
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-3"></div>
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // ===== INITIALIZATION =====
  if (layers.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <div className="bg-[#1a1a1a] rounded-lg p-10 text-center max-w-sm border border-gray-800">
          <div className="text-5xl mb-4">🎬</div>
          <h2 className="text-2xl font-semibold text-white mb-2">Scene Composer</h2>
          <p className="text-gray-500 text-sm mb-6">
            {currentScene ? `Scene: ${currentScene.name || 'Untitled'}` : 'No scene selected'}
          </p>
          <button
            onClick={initializeLayers}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition font-medium"
          >
            Initialize Layers
          </button>
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
    <div className="h-screen flex flex-col bg-[#0a0a0a]">
      {/* ===== CALM HEADER ===== */}
      <div className="h-11 bg-[#1a1a1a] border-b border-gray-900 px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-6">
          {/* Scene Group */}
          <div className="flex items-center gap-2">
            <SceneSelector
              episodeId={episodeId}
              currentSceneId={currentScene?.id}
              onSceneChange={handleSceneChange}
              onCreateScene={handleSceneCreate}
            />
          </div>

          {/* Playback Group */}
          <div className="flex items-center gap-1 border-l border-gray-800 pl-6">
            <button
              onClick={() => setMediaBinOpen(true)}
              className="p-1.5 hover:bg-gray-800 rounded transition text-lg"
              title="Media"
            >
              📁
            </button>
          </div>

          {/* View Group */}
          <div className="flex items-center gap-1 border-l border-gray-800 pl-6">
            <CanvasPresetSelector currentPreset={canvasPreset} onPresetChange={setCanvasPreset} />
          </div>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`px-2.5 py-1 rounded text-xs transition ${
              snapEnabled ? 'bg-purple-600/20 text-purple-400' : 'text-gray-500 hover:text-gray-400'
            }`}
          >
            Snap
          </button>

          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`px-2.5 py-1 rounded text-xs transition ${
              showGrid ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 hover:text-gray-400'
            }`}
          >
            Grid
          </button>

          <div className="flex items-center gap-0.5 text-gray-500 ml-2">
            <button
              onClick={() => setCanvasZoom(Math.max(0.25, canvasZoom - 0.25))}
              className="hover:text-gray-400 px-1.5"
            >−</button>
            <span className="text-xs font-mono w-10 text-center">
              {Math.round(canvasZoom * 100)}%
            </span>
            <button
              onClick={() => setCanvasZoom(Math.min(3, canvasZoom + 0.25))}
              className="hover:text-gray-400 px-1.5"
            >+</button>
          </div>
        </div>
      </div>

      {/* ===== MAIN LAYOUT ===== */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* CENTERED CANVAS */}
        <div className="flex-1 flex flex-col items-center" style={{ backgroundColor: '#0f0f0f' }}>
          <CenteredCanvas
            allAssets={allAssets}
            zoom={canvasZoom}
            selectedAsset={selectedAsset}
            showGrid={showGrid}
            snapEnabled={snapEnabled}
            canvasWidth={canvasPreset.width}
            canvasHeight={canvasPreset.height}
            presetName={canvasPreset.name}
            onAssetSelect={(asset) => {
              setSelectedAsset(asset);
              if (asset) setInspectorOpen(true);
            }}
            onAssetUpdate={handleAssetUpdate}
            onAssetDrop={handleAssetDrop}
            layers={sortedLayers}
          />

          {/* ATTACHED TIMELINE */}
          <div className="w-full max-w-[1400px] border-t border-gray-900">
            <HorizontalTimeline
              layers={sortedLayers}
              selectedAsset={selectedAsset}
              onAssetSelect={(asset) => {
                setSelectedAsset(asset);
                setInspectorOpen(true);
              }}
              onAssetUpdate={handleAssetUpdate}
              sceneDuration={currentScene?.duration_seconds || 60}
              config={LAYER_CONFIG}
            />
          </div>
        </div>

        {/* MEDIA BIN DRAWER */}
        <MediaBinDrawer
          isOpen={mediaBinOpen}
          onClose={() => setMediaBinOpen(false)}
          assets={episodeAssets}
          onAssetDrop={handleAssetDrop}
          layers={sortedLayers}
        />

        {/* INSPECTOR DRAWER */}
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

// ===== CENTERED CANVAS =====
const CenteredCanvas = ({ 
  allAssets, zoom, selectedAsset, showGrid, snapEnabled, canvasWidth, canvasHeight, presetName, 
  onAssetSelect, onAssetUpdate, onAssetDrop, layers 
}) => {
  const [dragOver, setDragOver] = useState(false);

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const assetData = e.dataTransfer.getData('asset');
    if (assetData) {
      const asset = JSON.parse(assetData);
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      
      // Find first available layer or default to layer 3
      const targetLayer = layers.find(l => l.layer_number === 3) || layers[0];
      if (targetLayer) {
        onAssetDrop(targetLayer.id, asset, { x, y });
      }
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8 max-w-[1400px] w-full">
      <div
        className="relative bg-black rounded-sm shadow-2xl border border-gray-900"
        style={{
          width: canvasWidth * zoom,
          height: canvasHeight * zoom
        }}
        onDrop={handleCanvasDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
      >
        {/* SUBTLE GRID */}
        {showGrid && (
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: `
                linear-gradient(to right, #fff 1px, transparent 1px),
                linear-gradient(to bottom, #fff 1px, transparent 1px)
              `,
              backgroundSize: `${50 * zoom}px ${50 * zoom}px`
            }}
          />
        )}

        {/* EMPTY STATE (SILENT) */}
        {allAssets.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2 opacity-10">🎬</div>
              <div className="text-xs text-gray-700">Drag media here</div>
            </div>
          </div>
        )}

        {/* ASSETS */}
        {allAssets.map(asset => {
          if (!asset.layer_visible) return null;
          const isSelected = selectedAsset?.id === asset.id;

          return (
            <div
              key={asset.id}
              onClick={() => onAssetSelect(asset)}
              className={`absolute cursor-move ${isSelected ? 'ring-2 ring-purple-500 z-10' : 'hover:ring-1 hover:ring-gray-700'}`}
              style={{
                left: asset.position_x * zoom,
                top: asset.position_y * zoom,
                width: asset.width * zoom,
                height: asset.height * zoom,
                transform: `rotate(${asset.rotation || 0}deg) scale(${asset.scale_x || 1}, ${asset.scale_y || 1})`,
                opacity: (asset.opacity || 1) * (asset.layer_opacity || 1),
                zIndex: asset.layer_number * 10
              }}
            >
              {asset.asset?.type === 'image' && (
                <img src={asset.asset.url} alt="" className="w-full h-full object-cover" />
              )}
              {asset.asset?.type === 'video' && (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center text-4xl">
                  🎥
                </div>
              )}
            </div>
          );
        })}

        {/* DRAG OVERLAY */}
        {dragOver && (
          <div className="absolute inset-0 bg-purple-500/10 border-2 border-purple-500 rounded-sm flex items-center justify-center">
            <span className="text-purple-400 font-semibold">Drop to add</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ===== HORIZONTAL TIMELINE =====
const HorizontalTimeline = ({ layers, selectedAsset, onAssetSelect, onAssetUpdate, sceneDuration, config }) => {
  const maxDuration = Math.max(sceneDuration, 
    ...layers.flatMap(l => l.assets || []).map(a => a.out_point_seconds || 0)
  );

  return (
    <div className="bg-[#1a1a1a] h-52">
      <div className="h-7 bg-[#141414] px-4 flex items-center justify-between border-b border-gray-900">
        <span className="text-xs text-gray-600 font-medium uppercase tracking-wide">Timeline</span>
        <span className="text-xs text-gray-600 font-mono">{formatDuration(maxDuration)}</span>
      </div>

      <div className="p-2 space-y-1">
        {layers.map(layer => {
          const layerAssets = layer.assets || [];
          const cfg = config[layer.layer_number];

          return (
            <div key={layer.id} className="flex items-center gap-2">
              <div className="w-16 flex items-center gap-1 flex-shrink-0">
                <span className="text-base">{cfg.icon}</span>
                <span className="text-xs text-gray-600">L{layer.layer_number}</span>
              </div>
              <div className="flex-1 h-8 bg-[#0f0f0f] rounded relative">
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
                        isSelected ? 'ring-1 ring-purple-500 z-10' : 'hover:opacity-90'
                      }`}
                      style={{
                        left: `${(inPoint / maxDuration) * 100}%`,
                        width: `${(duration / maxDuration) * 100}%`,
                        backgroundColor: cfg.color,
                        opacity: isSelected ? 1 : 0.7
                      }}
                    >
                      {asset.asset?.type === 'image' && asset.asset.url && (
                        <img 
                          src={asset.asset.url} 
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover rounded opacity-20"
                        />
                      )}
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-white text-xs font-medium drop-shadow truncate">
                          {asset.asset?.name}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ===== MEDIA BIN =====
const MediaBinDrawer = ({ isOpen, onClose, assets, onAssetDrop, layers }) => {
  const [filter, setFilter] = useState('all');
  const filteredAssets = filter === 'all' ? assets : assets.filter(a => a.type === filter);

  const handleDragStart = (e, asset) => {
    e.dataTransfer.setData('asset', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (!isOpen) return null;

  return (
    <div className="absolute left-0 top-0 bottom-0 w-72 bg-[#1a1a1a] border-r border-gray-900 z-20 flex flex-col">
      <div className="h-11 bg-[#141414] px-4 flex items-center justify-between border-b border-gray-900">
        <span className="text-white text-sm font-medium">Media</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">✕</button>
      </div>

      <div className="p-2 border-b border-gray-900">
        <div className="flex gap-1">
          {['all', 'image', 'video'].map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition ${
                filter === type
                  ? 'bg-purple-600/20 text-purple-400'
                  : 'text-gray-500 hover:text-gray-400'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2">
        <div className="grid grid-cols-2 gap-2">
          {filteredAssets.map(asset => (
            <div
              key={asset.id}
              draggable
              onDragStart={(e) => handleDragStart(e, asset)}
              className="cursor-move group"
            >
              <div className="bg-[#0f0f0f] rounded overflow-hidden border border-gray-900 hover:border-gray-700 transition">
                <div className="h-20 bg-black flex items-center justify-center">
                  {asset.type === 'image' ? (
                    <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-2xl">🎥</div>
                  )}
                </div>
                <div className="p-1.5 bg-[#0f0f0f]">
                  <div className="text-xs text-gray-400 truncate">{asset.name}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ===== INSPECTOR =====
const InspectorDrawer = ({ isOpen, onClose, selectedAsset, onAssetUpdate, onAssetRemove }) => {
  if (!isOpen || !selectedAsset) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-72 bg-[#1a1a1a] border-l border-gray-900 z-20 flex flex-col">
      <div className="h-11 bg-[#141414] px-4 flex items-center justify-between border-b border-gray-900">
        <span className="text-white text-sm font-medium">Inspector</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">✕</button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div>
          <div className="text-xs text-gray-600 mb-1 uppercase tracking-wide">Asset</div>
          <div className="text-sm text-white font-medium">{selectedAsset.asset?.name}</div>
        </div>

        {/* Timing */}
        <div className="bg-[#0f0f0f] rounded-lg p-3 border border-gray-900">
          <div className="text-xs font-semibold text-purple-400 mb-3 uppercase tracking-wide">Timing</div>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Start</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={selectedAsset.in_point_seconds || 0}
                onChange={(e) => onAssetUpdate(selectedAsset.id, { in_point_seconds: parseFloat(e.target.value) })}
                className="w-full bg-black text-white px-2 py-1.5 rounded text-sm border border-gray-800 focus:border-purple-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">End</label>
              <input
                type="number"
                min={selectedAsset.in_point_seconds || 0}
                step="0.1"
                value={selectedAsset.out_point_seconds || 10}
                onChange={(e) => onAssetUpdate(selectedAsset.id, { out_point_seconds: parseFloat(e.target.value) })}
                className="w-full bg-black text-white px-2 py-1.5 rounded text-sm border border-gray-800 focus:border-purple-500 outline-none"
              />
            </div>

            <div className="bg-black rounded p-2">
              <div className="text-xs text-gray-600">Duration</div>
              <div className="text-base font-bold text-white font-mono">
                {formatDuration((selectedAsset.out_point_seconds || 10) - (selectedAsset.in_point_seconds || 0))}
              </div>
            </div>
          </div>
        </div>

        {/* Transform */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">Opacity</label>
              <span className="text-xs text-gray-400 font-mono">
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">Rotation</label>
              <span className="text-xs text-gray-400 font-mono">
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
        </div>

        <button
          onClick={() => {
            if (window.confirm('Remove this asset?')) {
              onAssetRemove(selectedAsset.id);
            }
          }}
          className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-900 px-3 py-2 rounded transition text-sm font-medium mt-4"
        >
          Remove Asset
        </button>
      </div>
    </div>
  );
};

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default LayerStudioProfessional;
