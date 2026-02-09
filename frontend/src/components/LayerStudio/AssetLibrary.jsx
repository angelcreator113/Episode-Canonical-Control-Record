import React, { useState } from 'react';

const AssetLibrary = ({ assets }) => {
  const [filter, setFilter] = useState('all');

  const handleDragStart = (e, asset) => {
    e.dataTransfer.setData('asset', JSON.stringify(asset));
  };

  const filteredAssets = filter === 'all'
    ? assets
    : assets.filter(a => (a.asset_type || a.media_type) === filter);

  return (
    <div className="h-full flex flex-col bg-gradient-to-r from-gray-800 via-gray-850 to-gray-800">
      {/* Header */}
      <div className="border-b-2 border-gray-700/50 px-6 py-3 flex items-center justify-between bg-gradient-to-r from-gray-800 to-gray-850">
        <div className="flex items-center gap-2">
          <span className="text-base">📁</span>
          <h3 className="text-sm font-black text-white uppercase tracking-wider">Asset Library</h3>
          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] rounded-full font-bold border border-blue-500/30">{assets.length} assets</span>
        </div>
        
        {/* Filter Buttons */}
        <div className="flex gap-2">
          {['all', 'image', 'video', 'audio'].map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`
                px-3 py-1.5 rounded-lg text-[11px] transition-all duration-200 font-bold shadow-md
                ${filter === type
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-blue-500/50 scale-105'
                  : 'bg-gradient-to-r from-gray-700 to-gray-600 text-gray-300 hover:from-gray-600 hover:to-gray-500'
                }
              `}
            >
              {type === 'all' ? '📁 All' : 
               type === 'image' ? '🖼️ Images' :
               type === 'video' ? '🎥 Videos' : '🎵 Audio'}
            </button>
          ))}
        </div>
      </div>

      {/* Asset Grid - Horizontal Scroll */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {filteredAssets.length > 0 ? (
          <div className="inline-flex gap-4 h-full items-start">
            {filteredAssets.map(asset => (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) => handleDragStart(e, asset)}
                className="border-2 border-gray-600/50 rounded-xl p-2 cursor-move hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/30 transition-all duration-200 bg-gradient-to-br from-gray-750 to-gray-800 group flex-shrink-0 hover:scale-105"
                style={{ width: '110px', height: '135px' }}
              >
                <div className="asset-thumbnail-wrapper rounded-lg overflow-hidden" style={{ height: '90px' }}>
                  {(asset.asset_type === 'image' || asset.media_type === 'image') ? (
                    <img
                      src={asset.s3_url_processed || asset.s3_url_raw || asset.url}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center border border-gray-600/50 rounded-lg">
                      <span className="text-3xl">
                        {(asset.asset_type === 'video' || asset.media_type === 'video') ? '🎥' : 
                         (asset.asset_type === 'audio' || asset.media_type === 'audio') ? '🎵' : '📄'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-1.5 text-[10px] text-gray-300 truncate font-semibold leading-tight px-1" title={asset.name}>
                  {asset.name}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-3">📁</div>
              <div className="text-sm font-semibold">No {filter !== 'all' ? filter : ''} assets available</div>
              <div className="text-xs text-gray-600 mt-1">Upload assets to get started</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetLibrary;
