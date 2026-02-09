import React from 'react';

const AssetPreviewModal = ({ asset, onClose }) => {
  if (!asset) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-2xl max-w-4xl max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gray-900 p-4 flex items-center justify-between border-b border-gray-700">
          <h3 className="text-white font-semibold">{asset.asset?.name}</h3>
          <button 
            onClick={onClose}
            className="text-white hover:text-gray-300 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {asset.asset?.type === 'image' ? (
            <img 
              src={asset.asset.url} 
              alt={asset.asset.name}
              className="max-w-full h-auto rounded-lg"
            />
          ) : asset.asset?.type === 'video' ? (
            <video 
              src={asset.asset.url} 
              controls
              className="max-w-full h-auto rounded-lg"
            />
          ) : (
            <div className="text-center text-gray-400 py-12">
              <div className="text-6xl mb-4">📄</div>
              <div>Preview not available for this file type</div>
            </div>
          )}
        </div>

        <div className="bg-gray-900 p-4 border-t border-gray-700">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Type</div>
              <div className="text-white">{asset.asset?.type}</div>
            </div>
            <div>
              <div className="text-gray-400">Position</div>
              <div className="text-white">{asset.position_x}, {asset.position_y}</div>
            </div>
            <div>
              <div className="text-gray-400">Size</div>
              <div className="text-white">{asset.width || 'Auto'} × {asset.height || 'Auto'}</div>
            </div>
            <div>
              <div className="text-gray-400">Opacity</div>
              <div className="text-white">{Math.round((asset.opacity || 1.0) * 100)}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetPreviewModal;
