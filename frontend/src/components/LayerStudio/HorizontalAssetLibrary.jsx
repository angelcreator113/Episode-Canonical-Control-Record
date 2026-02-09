import React, { useState } from 'react';

const HorizontalAssetLibrary = ({ assets, selectedLayer }) => {
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

  const filteredAssets = assets.filter(asset => {
    const assetType = asset.asset_type || asset.media_type || asset.type || '';
    const matchesType = filter === 'all' || assetType === filter;
    const matchesSearch = !searchTerm || 
      (asset.name && asset.name.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesType && matchesSearch;
  });

  return (
    <div className="h-full flex flex-col bg-gray-800">
      {/* Header */}
      <div className="border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold text-white">
            📁 Asset Library
            <span className="ml-2 text-sm text-gray-400">
              ({filteredAssets.length} assets)
            </span>
          </h3>
          
          {/* Filter Buttons */}
          <div className="flex gap-2">
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
                  px-3 py-1 rounded text-sm transition
                  ${filter === type.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }
                `}
              >
                {type.icon} {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search assets..."
            className="px-3 py-1 bg-gray-700 text-white border border-gray-600 rounded-lg text-sm w-48 focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Asset Grid (Horizontal Scroll) */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {filteredAssets.length > 0 ? (
          <div className="flex gap-3 h-full">
            {filteredAssets.map(asset => (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) => handleDragStart(e, asset)}
                onDragEnd={handleDragEnd}
                className="flex-shrink-0 w-32 cursor-move group transition-opacity"
              >
                <div className="bg-gray-700 rounded-lg overflow-hidden border-2 border-gray-600 hover:border-blue-500 transition h-full flex flex-col">
                  {/* Thumbnail */}
                  <div className="h-24 bg-gray-900 flex items-center justify-center">
                    {(asset.asset_type === 'image' || asset.media_type === 'image' || asset.type === 'image') ? (
                      <img
                        src={asset.s3_url_processed || asset.s3_url_raw || asset.url}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-4xl">
                        {(asset.asset_type === 'video' || asset.media_type === 'video' || asset.type === 'video') ? '🎥' : 
                         (asset.asset_type === 'audio' || asset.media_type === 'audio' || asset.type === 'audio') ? '🎵' : '📄'}
                      </div>
                    )}
                  </div>
                  
                  {/* Name */}
                  <div className="p-2 bg-gray-700">
                    <div className="text-xs text-white truncate" title={asset.name}>
                      {asset.name}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {asset.asset_type || asset.media_type || asset.type || 'unknown'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-2">📁</div>
              <div className="text-sm">
                {searchTerm ? 'No assets match your search' : `No ${filter !== 'all' ? filter : ''} assets available`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HorizontalAssetLibrary;
