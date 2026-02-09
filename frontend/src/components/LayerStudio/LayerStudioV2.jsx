import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CompactLayerList from './CompactLayerList';
import PreviewCanvas from './PreviewCanvas';
import RightPanel from './RightPanel';

const LayerStudioV2 = ({ episodeId }) => {
  const [layers, setLayers] = useState([]);
  const [episodeAssets, setEpisodeAssets] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canvasZoom, setCanvasZoom] = useState(1.0);

  console.log('🎬 LayerStudioV2 mounted with episodeId:', episodeId);
  console.log('🎬 Layers:', layers.length, 'Assets:', episodeAssets.length);

  useEffect(() => {
    loadLayers();
    loadEpisodeAssets();
    
    // Debug drag-and-drop
    console.log('🎬 Layer Studio V2 initialized');
  }, [episodeId]);

  const loadLayers = async () => {
    try {
      const response = await axios.get(`/api/v1/layers?episode_id=${episodeId}`);
      const layersData = response.data.data || [];
      
      // Deduplicate layers by layer_number (keep only first occurrence)
      const uniqueLayers = layersData.reduce((acc, layer) => {
        if (!acc.find(l => l.layer_number === layer.layer_number)) {
          acc.push(layer);
        }
        return acc;
      }, []);
      
      setLayers(uniqueLayers);
    } catch (error) {
      console.error('Failed to load layers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeAssets = async () => {
    try {
      const response = await axios.get(`/api/v1/episodes/${episodeId}/assets`);
      setEpisodeAssets(response.data.data || []);
    } catch (error) {
      console.error('Failed to load assets:', error);
    }
  };

  const initializeLayers = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/v1/layers/bulk-create', {
        episode_id: episodeId
      });
      setLayers(response.data.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to initialize layers:', error);
      setLoading(false);
    }
  };

  const handleAssetDrop = async (layerId, asset, position = null) => {
    try {
      console.log('📥 Dropping asset:', asset.name || asset.id, 'on layer:', layerId, 'at position:', position);
      await axios.post(`/api/v1/layers/${layerId}/assets`, {
        asset_id: asset.id,
        position_x: position?.x || 0,
        position_y: position?.y || 0,
        opacity: 1.0,
        order_index: 0
      });
      loadLayers();
      console.log('✅ Asset added successfully');
    } catch (error) {
      console.error('❌ Failed to add asset to layer:', error);
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
    console.log('🎬 LayerStudioV2: Loading state');
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-white">Loading Layer Studio V2...</p>
        </div>
      </div>
    );
  }

  if (layers.length === 0) {
    console.log('🎬 LayerStudioV2: No layers, showing init screen');
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="bg-gray-800 rounded-lg shadow-lg p-12 text-center max-w-md border border-gray-700">
          <div className="text-7xl mb-6">🎬</div>
          <h2 className="text-2xl font-bold mb-3 text-white">Initialize Layer Studio</h2>
          <p className="text-gray-400 mb-8">
            Set up the 5-layer composition system to start building your episode.
          </p>
          <button
            onClick={initializeLayers}
            className="bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transition text-lg font-semibold shadow-lg"
          >
            🚀 Initialize 5 Layers
          </button>
          <div className="mt-6 text-sm text-gray-500">
            <p>Creates: Background • Main Content • Overlays • Text • Audio</p>
          </div>
        </div>
      </div>
    );
  }

  console.log('🎬 LayerStudioV2: Rendering main interface');

  return (
    <div className="layer-studio-v2 h-full w-full flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 border-b border-gray-700 px-6 py-4 flex items-center justify-between flex-shrink-0 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="text-2xl">🎬</div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Layer Studio V2</h2>
              <div className="text-xs text-white/80 font-medium">
                Professional Composition System
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Zoom Controls */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
            <button
              onClick={() => setCanvasZoom(Math.max(0.25, canvasZoom - 0.25))}
              className="text-white hover:text-blue-200 transition text-lg font-bold w-6 h-6 flex items-center justify-center hover:scale-110"
              title="Zoom Out"
            >
              −
            </button>
            <span className="text-white text-sm font-mono w-14 text-center font-bold">
              {Math.round(canvasZoom * 100)}%
            </span>
            <button
              onClick={() => setCanvasZoom(Math.min(3, canvasZoom + 0.25))}
              className="text-white hover:text-blue-200 transition text-lg font-bold w-6 h-6 flex items-center justify-center hover:scale-110"
              title="Zoom In"
            >
              +
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={loadLayers}
            className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition text-sm font-semibold border border-white/30 hover:scale-105"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* LEFT: Canvas (70%) */}
        <div className="flex-1 bg-gradient-to-b from-gray-900 to-black flex flex-col min-w-0">
          <PreviewCanvas
            layers={layers}
            selectedAsset={selectedAsset}
            zoom={canvasZoom}
            onAssetSelect={setSelectedAsset}
            onAssetUpdate={handleAssetUpdate}
            onAssetDrop={handleAssetDrop}
          />
        </div>

        {/* RIGHT: Tabbed Panel (30%) - Assets & Properties */}
        <div className="w-[30%] min-w-[400px] max-w-[500px] bg-gradient-to-b from-gray-800 to-gray-850 border-l-2 border-gray-700/50 flex flex-col shadow-2xl">
          <RightPanel
            episodeAssets={episodeAssets}
            selectedLayer={selectedLayer}
            selectedAsset={selectedAsset}
            onLayerUpdate={handleLayerUpdate}
            onAssetUpdate={handleAssetUpdate}
            onAssetRemove={handleAssetRemove}
          />
        </div>
      </div>

      {/* BOTTOM: Timeline-Style Layers (20% height) */}
      <div className="h-[20%] min-h-[180px] max-h-[240px] bg-gradient-to-r from-gray-800 via-gray-850 to-gray-800 border-t-2 border-gray-700/50 flex-shrink-0 shadow-2xl">
        <CompactLayerList
          layers={layers}
          selectedLayer={selectedLayer}
          selectedAsset={selectedAsset}
          onLayerSelect={setSelectedLayer}
          onAssetSelect={setSelectedAsset}
          onAssetDrop={handleAssetDrop}
          onLayerUpdate={handleLayerUpdate}
        />
      </div>
    </div>
  );
};

export default LayerStudioV2;
