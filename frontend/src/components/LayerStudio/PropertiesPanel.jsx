import React, { useState } from 'react';

const PropertiesPanel = ({
  selectedLayer,
  selectedAsset,
  onLayerUpdate,
  onAssetUpdate,
  onAssetRemove
}) => {
  const [activeTab, setActiveTab] = useState('properties');

  if (!selectedLayer && !selectedAsset) {
    return (
      <div className="p-6 text-center">
        <div className="text-6xl mb-4">👆</div>
        <h3 className="text-lg font-semibold text-white mb-2">
          Properties Panel
        </h3>
        <p className="text-sm text-gray-400 mb-6">
          Select a layer or asset to view and edit properties
        </p>
        
        <div className="mt-6 bg-gray-700 rounded-lg p-4 text-left">
          <h4 className="text-sm font-semibold text-white mb-3">💡 Quick Tips</h4>
          <div className="text-xs text-gray-300 space-y-2">
            <div>• Drag assets from library to layers</div>
            <div>• Click layer to select it</div>
            <div>• Click asset on canvas to transform</div>
            <div>• Use sliders to adjust opacity</div>
            <div>• Toggle 👁️ to show/hide layers</div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedAsset) {
    return <AssetPropertiesContent asset={selectedAsset} onUpdate={onAssetUpdate} onRemove={onAssetRemove} />;
  }

  return <LayerPropertiesContent layer={selectedLayer} onUpdate={onLayerUpdate} />;
};

const LayerPropertiesContent = ({ layer, onUpdate }) => {
  const handleChange = (field, value) => {
    onUpdate(layer.id, { [field]: value });
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Layer Properties</h3>
      
      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Layer Name
          </label>
          <input
            type="text"
            value={layer.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder={`Layer ${layer.layer_number}`}
            className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Opacity */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">
              Opacity
            </label>
            <span className="text-sm text-white font-mono">
              {Math.round((layer.opacity || 1.0) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={layer.opacity || 1.0}
            onChange={(e) => handleChange('opacity', parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Blend Mode */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Blend Mode
          </label>
          <select
            value={layer.blend_mode || 'normal'}
            onChange={(e) => handleChange('blend_mode', e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="normal">Normal</option>
            <option value="multiply">Multiply</option>
            <option value="screen">Screen</option>
            <option value="overlay">Overlay</option>
          </select>
        </div>

        {/* Visibility Toggle */}
        <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
          <label className="text-sm font-medium text-gray-300">Visible</label>
          <button
            onClick={() => handleChange('is_visible', !layer.is_visible)}
            className={`
              px-4 py-2 rounded-lg font-medium transition
              ${layer.is_visible 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }
            `}
          >
            {layer.is_visible ? '👁️ Visible' : '🚫 Hidden'}
          </button>
        </div>

        {/* Lock Toggle */}
        <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
          <label className="text-sm font-medium text-gray-300">Locked</label>
          <button
            onClick={() => handleChange('is_locked', !layer.is_locked)}
            className={`
              px-4 py-2 rounded-lg font-medium transition
              ${layer.is_locked 
                ? 'bg-red-600 text-white hover:bg-red-700' 
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }
            `}
          >
            {layer.is_locked ? '🔒 Locked' : '🔓 Unlocked'}
          </button>
        </div>
      </div>
    </div>
  );
};

const AssetPropertiesContent = ({ asset, onUpdate, onRemove }) => {
  const handleChange = (field, value) => {
    onUpdate(asset.id, { [field]: value });
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Asset Properties</h3>
      
      {/* Asset Info */}
      <div className="bg-gray-700 p-3 rounded-lg mb-4">
        <div className="text-xs text-gray-400 mb-1">Asset Name</div>
        <div className="text-sm font-medium text-white">
          {asset.asset?.name}
        </div>
      </div>

      <div className="space-y-4">
        {/* Position */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Position
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">X (px)</label>
              <input
                type="number"
                value={asset.position_x || 0}
                onChange={(e) => handleChange('position_x', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Y (px)</label>
              <input
                type="number"
                value={asset.position_y || 0}
                onChange={(e) => handleChange('position_y', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Size */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Size
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Width (px)</label>
              <input
                type="number"
                value={asset.width || ''}
                onChange={(e) => handleChange('width', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Auto"
                className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Height (px)</label>
              <input
                type="number"
                value={asset.height || ''}
                onChange={(e) => handleChange('height', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Auto"
                className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Rotation */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">
              Rotation
            </label>
            <span className="text-sm text-white font-mono">
              {asset.rotation || 0}°
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            value={asset.rotation || 0}
            onChange={(e) => handleChange('rotation', parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Scale */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Scale
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                X: {(asset.scale_x || 1.0).toFixed(2)}
              </label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={asset.scale_x || 1.0}
                onChange={(e) => handleChange('scale_x', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Y: {(asset.scale_y || 1.0).toFixed(2)}
              </label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={asset.scale_y || 1.0}
                onChange={(e) => handleChange('scale_y', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Opacity */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">
              Opacity
            </label>
            <span className="text-sm text-white font-mono">
              {Math.round((asset.opacity || 1.0) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={asset.opacity || 1.0}
            onChange={(e) => handleChange('opacity', parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Remove Button */}
        <button
          onClick={() => {
            if (window.confirm('Remove this asset from the layer?')) {
              onRemove(asset.id);
            }
          }}
          className="w-full mt-6 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition font-medium"
        >
          🗑️ Remove from Layer
        </button>
      </div>
    </div>
  );
};

export default PropertiesPanel;
