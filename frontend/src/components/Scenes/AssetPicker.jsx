import React, { useState, useEffect } from 'react';
import thumbnailService from '../../services/thumbnailService';
import './AssetPicker.css';

const AssetPicker = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  multiSelect = false, 
  selectedIds = [],
  allowUpload = true 
}) => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(selectedIds);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAssets();
      setSelected(selectedIds);
    }
  }, [isOpen, selectedIds]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const data = await thumbnailService.getThumbnails();
      setAssets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load assets:', error);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (assetId) => {
    if (multiSelect) {
      const newSelected = selected.includes(assetId)
        ? selected.filter(id => id !== assetId)
        : [...selected, assetId];
      setSelected(newSelected);
    } else {
      onSelect(assetId);
      onClose();
    }
  };

  const handleConfirm = () => {
    if (multiSelect) {
      onSelect(selected);
    }
    onClose();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const result = await thumbnailService.uploadThumbnail(file, {
        title: file.name
      });
      
      // Reload assets to show the new one
      await loadAssets();
      
      // Auto-select the newly uploaded asset
      if (!multiSelect) {
        onSelect(result.id);
        onClose();
      } else {
        setSelected([...selected, result.id]);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="asset-picker-overlay" onClick={onClose}>
      <div className="asset-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="asset-picker-header">
          <h3>📁 Select {multiSelect ? 'Assets' : 'Thumbnail'}</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        {allowUpload && (
          <div className="asset-picker-upload">
            <label className="upload-btn" style={{ opacity: uploading ? 0.5 : 1 }}>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                disabled={uploading}
                style={{ display: 'none' }}
              />
              {uploading ? '⏳ Uploading...' : '⬆️ Upload New Asset'}
            </label>
          </div>
        )}

        <div className="asset-picker-content">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading assets...</p>
            </div>
          ) : assets.length === 0 ? (
            <div className="empty-state">
              <span style={{fontSize: '48px'}}>🖼️</span>
              <p>No assets found. Upload some first!</p>
            </div>
          ) : (
            <div className="asset-grid">
              {assets.map(asset => (
                <div
                  key={asset.id}
                  className={`asset-item ${selected.includes(asset.id) ? 'selected' : ''}`}
                  onClick={() => handleSelect(asset.id)}
                >
                  <div className="asset-image-container">
                    <img 
                      src={asset.url || asset.s3Url || asset.thumbnailUrl} 
                      alt={asset.title || 'Asset'} 
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect fill="%23ddd" width="200" height="150"/><text x="50%" y="50%" text-anchor="middle" fill="%23999" font-size="14">No Preview</text></svg>';
                      }}
                    />
                  </div>
                  {selected.includes(asset.id) && (
                    <div className="selected-badge">✓</div>
                  )}
                  <div className="asset-info">
                    <span className="asset-title" title={asset.title || 'Untitled'}>
                      {asset.title || 'Untitled'}
                    </span>
                    {asset.fileType && (
                      <span className="asset-type">{asset.fileType}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {multiSelect && (
          <div className="asset-picker-footer">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={handleConfirm} className="btn-primary">
              Select {selected.length} Asset{selected.length !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetPicker;
