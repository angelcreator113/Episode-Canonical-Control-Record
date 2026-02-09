import React, { useState } from 'react';
import PropertiesPanel from './PropertiesPanel';

const RightPanel = ({
  episodeAssets,
  selectedLayer,
  selectedAsset,
  onLayerUpdate,
  onAssetUpdate,
  onAssetRemove
}) => {
  const [activeTab, setActiveTab] = useState('assets');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const handleDragStart = (e, asset) => {
    e.dataTransfer.setData('asset', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
    e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
  };

  const filteredAssets = episodeAssets.filter(asset => {
    const assetType = asset.asset_type || asset.media_type || asset.type || '';
    const matchesType = filter === 'all' || assetType === filter;
    const matchesSearch = !searchTerm || 
      (asset.name && asset.name.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesType && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Tab Headers */}
      <div className="flex border-b border-gray-700 bg-gray-900">
        <button
          onClick={() => setActiveTab('assets')}
          className={`
            flex-1 px-4 py-3 text-sm font-medium transition-colors
            ${activeTab === 'assets'
              ? 'bg-gray-800 text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }
          `}
        >
          📁 Assets ({filteredAssets.length})
        </button>
        <button
          onClick={() => setActiveTab('properties')}
          className={`
            flex-1 px-4 py-3 text-sm font-medium transition-colors
            ${activeTab === 'properties'
              ? 'bg-gray-800 text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }
          `}
        >
          ⚙️ Properties
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'assets' ? (
          <div className="h-full flex flex-col">
            {/* Asset Controls */}
            <div className="p-4 bg-gray-900 border-b border-gray-700 space-y-3">
              {/* Search */}
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="🔍 Search assets..."
                className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {/* Filter Buttons */}
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'All', icon: '📁' },
                  { id: 'image', label: 'Images', icon: '🖼️' },
                  { id: 'video', label: 'Videos', icon: '🎥' },
                  { id: 'audio', label: 'Audio', icon: '🎵' }
                ].map(type => (
                  <button
                    key={type.id}
                    onClick={() => setFilter(type.id)}
                    className={`
                      px-3 py-1.5 rounded text-xs font-medium transition-all
                      ${filter === type.id
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }
                    `}
                  >
                    {type.icon} {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Asset Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredAssets.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {filteredAssets.map(asset => (
                    <div
                      key={asset.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, asset)}
                      onDragEnd={handleDragEnd}
                      className="cursor-move group transition-all hover:scale-105"
                    >
                      <div className="bg-gray-700 rounded-lg overflow-hidden border-2 border-gray-600 hover:border-blue-500 transition-all shadow-lg">
                        {/* Thumbnail */}
                        <div className="h-32 bg-gray-900 flex items-center justify-center relative overflow-hidden group-hover:bg-gray-800 transition">
                          {(asset.type === 'image' || asset.asset_type === 'image' || asset.media_type === 'image') ? (
                            <img
                              src={asset.url || asset.s3_url_processed || asset.s3_url_raw || asset.thumbnail_url}
                              alt={asset.name}
                              className="w-full h-full object-cover"
                              draggable={false}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = '<div class="text-4xl">🖼️</div>';
                              }}
                            />
                          ) : (
                            <div className="text-5xl">
                              {asset.type === 'video' ? '🎥' : 
                               asset.type === 'audio' ? '🎵' : '📄'}
                            </div>
                          )}
                          {/* Drag Indicator */}
                          <div className="absolute inset-0 bg-blue-600 bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                            <span className="text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                              ✋
                            </span>
                          </div>
                        </div>
                        
                        {/* Info */}
                        <div className="p-2 bg-gray-700">
                          <div className="text-xs text-white truncate font-medium" title={asset.name}>
                            {asset.name}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {asset.type}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <div className="text-5xl mb-3">🔍</div>
                    <div className="text-sm">
                      {searchTerm ? 'No assets match your search' : `No ${filter !== 'all' ? filter : ''} assets available`}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <PropertiesPanel
              selectedLayer={selectedLayer}
              selectedAsset={selectedAsset}
              onLayerUpdate={onLayerUpdate}
              onAssetUpdate={onAssetUpdate}
              onAssetRemove={onAssetRemove}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default RightPanel;
