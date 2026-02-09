import React, { useState, useEffect } from 'react';
import axios from 'axios';
import LayerPanel from './LayerPanel';
import AssetLibrary from './AssetLibrary';
import PropertyPanel from './PropertyPanel';
import './LayerStudio.css';

const LayerStudio = ({ episodeId }) => {
  const [layers, setLayers] = useState([]);
  const [episodeAssets, setEpisodeAssets] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load layers and assets on mount
  useEffect(() => {
    loadLayers();
    loadEpisodeAssets();
  }, [episodeId]);

  const loadLayers = async () => {
    try {
      const response = await axios.get(`/api/v1/layers?episode_id=${episodeId}&include_assets=true`);
      setLayers(response.data.data || []);
    } catch (error) {
      console.error('Failed to load layers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeAssets = async () => {
    try {
      const response = await axios.get(`/api/v1/assets?episode_id=${episodeId}`);
      setEpisodeAssets(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to load assets:', error);
    }
  };

  const initializeLayers = async () => {
    try {
      setLoading(true);
      const layerConfigs = [
        { layer_number: 1, layer_type: 'background', name: 'Background/B-Roll', opacity: 1.00, blend_mode: 'normal', is_visible: true, is_locked: false },
        { layer_number: 2, layer_type: 'main', name: 'Main Content', opacity: 1.00, blend_mode: 'normal', is_visible: true, is_locked: false },
        { layer_number: 3, layer_type: 'overlay', name: 'Overlays/Graphics', opacity: 1.00, blend_mode: 'normal', is_visible: true, is_locked: false },
        { layer_number: 4, layer_type: 'text', name: 'Text/Captions', opacity: 1.00, blend_mode: 'normal', is_visible: true, is_locked: false },
        { layer_number: 5, layer_type: 'audio', name: 'Audio/Music', opacity: 1.00, blend_mode: 'normal', is_visible: true, is_locked: false }
      ];
      
      const response = await axios.post('/api/v1/layers/bulk-create', {
        episode_id: episodeId,
        layers: layerConfigs
      });
      setLayers(response.data.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to initialize layers:', error);
      setLoading(false);
    }
  };

  const handleAssetDrop = async (layerId, asset) => {
    try {
      await axios.post(`/api/v1/layers/${layerId}/assets`, {
        asset_id: asset.id,
        position_x: 0,
        position_y: 0,
        opacity: 1.0,
        order_index: 0
      });
      loadLayers(); // Reload to show new asset
    } catch (error) {
      console.error('Failed to add asset to layer:', error);
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

  const handleAssetUpdate = async (assetId, updates) => {
    try {
      await axios.put(`/api/v1/layers/assets/${assetId}`, updates);
      loadLayers();
    } catch (error) {
      console.error('Failed to update asset:', error);
    }
  };

  const handleAssetRemove = async (assetId) => {
    try {
      await axios.delete(`/api/v1/layers/assets/${assetId}`);
      loadLayers();
      setSelectedAsset(null);
    } catch (error) {
      console.error('Failed to remove asset:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading layer studio...</p>
        </div>
      </div>
    );
  }

  if (layers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-6xl mb-4">🎬</div>
        <h3 className="text-xl font-semibold mb-2">No Layers Yet</h3>
        <p className="text-gray-600 mb-6">
          Initialize the 5-layer system to start composing your episode.
        </p>
        <button
          onClick={initializeLayers}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
        >
          Initialize 5 Layers
        </button>
      </div>
    );
  }

  return (
    <div className="layer-studio h-full flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 border-b border-gray-700 px-6 py-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="text-2xl">🎬</div>
              <div>
                <h2 className="text-xl font-black text-white tracking-tight">Layer Studio V2</h2>
                <p className="text-xs text-white/80 font-medium">Professional Composition System</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-xs text-white font-medium border border-white/20">
              Preview Canvas • 1920 × 1080
            </div>
            <button
              onClick={loadLayers}
              className="px-4 py-2 text-xs bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition-all duration-200 font-semibold border border-white/30 hover:scale-105"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - 3 Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Layer List (30%) */}
        <div className="w-[30%] border-r-2 border-gray-700/50 bg-gradient-to-b from-gray-800 to-gray-850 overflow-y-auto shadow-2xl">
          <LayerPanel
            layers={layers}
            selectedLayer={selectedLayer}
            selectedAsset={selectedAsset}
            onLayerSelect={setSelectedLayer}
            onAssetSelect={setSelectedAsset}
            onAssetDrop={handleAssetDrop}
            onLayerUpdate={handleLayerUpdate}
          />
        </div>

        {/* CENTER: Preview Canvas (45%) */}
        <div className="w-[45%] border-r-2 border-gray-700/50 bg-gradient-to-b from-gray-900 to-black overflow-auto flex flex-col">
          <div className="border-b-2 border-gray-700/50 px-6 py-3 bg-gradient-to-r from-gray-800 to-gray-850 flex items-center justify-between backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">📺</span>
              <h3 className="text-sm font-bold text-white">Preview Canvas</h3>
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] rounded-full font-semibold border border-blue-500/30">LIVE</span>
            </div>
            <div className="flex gap-2 items-center">
              <button className="px-3 py-1.5 text-[11px] bg-gradient-to-r from-gray-700 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-500 transition-all shadow-md font-semibold">🔍 Fit</button>
              <button className="px-3 py-1.5 text-[11px] bg-gradient-to-r from-gray-700 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-500 transition-all shadow-md font-semibold">100%</button>
              <button className="px-3 py-1.5 text-[11px] bg-gradient-to-r from-gray-700 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-500 transition-all shadow-md font-semibold">⚡ Grid</button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="relative w-full max-w-5xl aspect-video">
              {/* Checkerboard pattern for transparency */}
              <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-2xl border-2 border-gray-700/50" 
                   style={{ backgroundImage: 'repeating-conic-gradient(#374151 0% 25%, #1f2937 0% 50%) 50% / 20px 20px' }}>
              </div>
              {/* Canvas content */}
              <div className="absolute inset-0 flex items-center justify-center rounded-xl backdrop-blur-sm">
                <div className="text-center text-gray-400">
                  <div className="text-6xl mb-4 animate-pulse">🎬</div>
                  <p className="text-base font-semibold text-gray-300">Visual Composition Preview</p>
                  <p className="text-sm text-gray-500 mt-2">Layers will render here in real-time</p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-gray-400">Ready to compose</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t-2 border-gray-700/50 px-6 py-3 bg-gradient-to-r from-gray-800 to-gray-850">
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-semibold">X:</span>
                <span className="text-white font-mono bg-gray-700 px-2 py-0.5 rounded">0</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-semibold">Y:</span>
                <span className="text-white font-mono bg-gray-700 px-2 py-0.5 rounded">0</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-semibold">W:</span>
                <span className="text-blue-400 font-mono bg-gray-700 px-2 py-0.5 rounded">1920</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-semibold">H:</span>
                <span className="text-blue-400 font-mono bg-gray-700 px-2 py-0.5 rounded">1080</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Properties Panel (25%) */}
        <div className="w-[25%] bg-gradient-to-b from-gray-800 to-gray-850 overflow-y-auto shadow-2xl">
          <PropertyPanel
            selectedLayer={selectedLayer}
            selectedAsset={selectedAsset}
            onLayerUpdate={handleLayerUpdate}
            onAssetUpdate={handleAssetUpdate}
            onAssetRemove={handleAssetRemove}
          />
        </div>
      </div>

      {/* BOTTOM: Asset Library (Horizontal) */}
      <div className="h-52 border-t-2 border-gray-700/50 bg-gradient-to-r from-gray-800 via-gray-850 to-gray-800 shadow-2xl">
        <AssetLibrary assets={episodeAssets} />
      </div>
    </div>
  );
};

export default LayerStudio;
