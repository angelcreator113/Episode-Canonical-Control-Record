import React, { useState, useEffect } from 'react';
import { HiPlus, HiTrash, HiPhotograph } from 'react-icons/hi';
import sceneService from '../../services/sceneService';
import api from '../../services/api';
import './SceneAssets.css';

/**
 * SceneAssets - Manage assets linked to a scene
 * Allows adding/removing assets and setting their timing
 */
const SceneAssets = ({ sceneId, episodeId, onUpdate }) => {
  const [sceneAssets, setSceneAssets] = useState([]);
  const [availableAssets, setAvailableAssets] = useState([]);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSceneAssets();
    loadAvailableAssets();
  }, [sceneId]);

  const loadSceneAssets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await sceneService.getSceneAssets(sceneId);
      
      // Transform data to match component expectations
      const assets = (response.data || []).map(asset => ({
        id: asset.SceneAsset?.id || asset.id,
        asset_id: asset.id,
        asset_name: asset.name,
        asset_type: asset.asset_type,
        asset_url: asset.s3_url_processed || asset.s3_url_raw,
        usage_type: asset.SceneAsset?.usage_type || 'overlay',
        start_timecode: asset.SceneAsset?.start_timecode,
        end_timecode: asset.SceneAsset?.end_timecode,
        layer_order: asset.SceneAsset?.layer_order || 0,
        opacity: asset.SceneAsset?.opacity || 1.0,
        position: asset.SceneAsset?.position,
        width: asset.width,
        height: asset.height,
      }));
      
      setSceneAssets(assets);
      setLoading(false);
    } catch (error) {
      console.error('Error loading scene assets:', error);
      setError('Failed to load scene assets');
      setLoading(false);
    }
  };

  const loadAvailableAssets = async () => {
    try {
      // Load episode assets
      const response = await api.get(`/api/v1/episodes/${episodeId}/assets`);
      const assets = (response.data.data || []).map(asset => ({
        id: asset.id,
        name: asset.name,
        type: asset.asset_type,
        url: asset.s3_url_processed || asset.s3_url_raw,
        thumbnail_url: asset.s3_url_processed || asset.s3_url_raw,
        width: asset.width,
        height: asset.height,
      }));
      setAvailableAssets(assets);
    } catch (error) {
      console.error('Error loading available assets:', error);
    }
  };

  const handleAddAsset = async (asset) => {
    try {
      await sceneService.addSceneAsset(sceneId, {
        assetId: asset.id,
        usageType: 'overlay',
        startTimecode: '00:00:00:00',
        endTimecode: '00:00:05:00',
        layerOrder: sceneAssets.length,
        opacity: 1.0,
      });

      setShowAssetPicker(false);
      await loadSceneAssets();
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error adding asset to scene:', error);
      alert('Failed to add asset: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleRemoveAsset = async (sceneAssetId, assetId) => {
    if (!window.confirm('Remove this asset from the scene?')) {
      return;
    }

    try {
      await sceneService.removeSceneAsset(sceneId, assetId);
      await loadSceneAssets();
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error removing asset:', error);
      alert('Failed to remove asset: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleUpdateTiming = async (assetId, startTimecode, endTimecode) => {
    try {
      await sceneService.updateSceneAssetDetails(sceneId, assetId, {
        startTimecode,
        endTimecode,
      });
      
      await loadSceneAssets();
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error updating asset timing:', error);
      alert('Failed to update timing: ' + (error.response?.data?.message || error.message));
    }
  };

  const getAssetTypeColor = (type) => {
    const colors = {
      'image': '#ec4899',
      'video': '#f59e0b',
      'logo': '#8b5cf6',
      'graphic': '#3b82f6',
      'thumbnail': '#10b981',
    };
    return colors[type?.toLowerCase()] || '#6b7280';
  };

  const getQualityBadge = (width, height) => {
    if (!width || !height) return null;
    if (width >= 3840 || height >= 2160) return '4K';
    if (width >= 1920 || height >= 1080) return 'HD';
    return 'SD';
  };

  if (loading) {
    return <div className="scene-assets-loading">Loading assets...</div>;
  }

  if (error) {
    return (
      <div className="scene-assets-error">
        <p>{error}</p>
        <button onClick={loadSceneAssets}>Retry</button>
      </div>
    );
  }

  return (
    <div className="scene-assets">
      <div className="scene-assets-header">
        <h4>Scene Assets ({sceneAssets.length})</h4>
        <button 
          onClick={() => setShowAssetPicker(true)}
          className="btn-add-asset"
        >
          <HiPlus size={16} />
          Add Asset
        </button>
      </div>

      {sceneAssets.length === 0 ? (
        <div className="scene-assets-empty">
          <HiPhotograph size={48} />
          <p>No assets in this scene</p>
          <button 
            onClick={() => setShowAssetPicker(true)}
            className="btn-add-asset-large"
          >
            <HiPlus size={20} />
            Add First Asset
          </button>
        </div>
      ) : (
        <div className="scene-assets-list">
          {sceneAssets.map(sceneAsset => (
            <div key={sceneAsset.id} className="scene-asset-item">
              <div 
                className="asset-thumbnail"
                style={{ borderColor: getAssetTypeColor(sceneAsset.asset_type) }}
              >
                {sceneAsset.asset_url ? (
                  <img 
                    src={sceneAsset.asset_url} 
                    alt={sceneAsset.asset_name}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className="thumbnail-placeholder" style={{ display: sceneAsset.asset_url ? 'none' : 'flex' }}>
                  <HiPhotograph size={32} />
                </div>
                {getQualityBadge(sceneAsset.width, sceneAsset.height) && (
                  <span className="quality-badge">{getQualityBadge(sceneAsset.width, sceneAsset.height)}</span>
                )}
              </div>

              <div className="asset-info">
                <h5>{sceneAsset.asset_name}</h5>
                <div className="asset-meta">
                  <span className="asset-type" style={{ background: getAssetTypeColor(sceneAsset.asset_type) }}>
                    {sceneAsset.asset_type?.toUpperCase() || 'UNKNOWN'}
                  </span>
                  <span className="usage-type">{sceneAsset.usage_type}</span>
                  <span className="layer-order">Layer {sceneAsset.layer_order}</span>
                </div>
              </div>

              <div className="asset-timing">
                <div className="timing-input">
                  <label>Start</label>
                  <input
                    type="text"
                    value={sceneAsset.start_timecode || '00:00:00:00'}
                    onChange={(e) => handleUpdateTiming(
                      sceneAsset.asset_id,
                      e.target.value,
                      sceneAsset.end_timecode
                    )}
                    placeholder="HH:MM:SS:FF"
                  />
                </div>

                <div className="timing-input">
                  <label>End</label>
                  <input
                    type="text"
                    value={sceneAsset.end_timecode || '00:00:05:00'}
                    onChange={(e) => handleUpdateTiming(
                      sceneAsset.asset_id,
                      sceneAsset.start_timecode,
                      e.target.value
                    )}
                    placeholder="HH:MM:SS:FF"
                  />
                </div>
              </div>

              <button 
                onClick={() => handleRemoveAsset(sceneAsset.id, sceneAsset.asset_id)}
                className="btn-remove-asset"
                title="Remove asset"
              >
                <HiTrash size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Asset Picker Modal */}
      {showAssetPicker && (
        <div className="asset-picker-modal">
          <div className="modal-overlay" onClick={() => setShowAssetPicker(false)} />
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add Asset to Scene</h3>
              <button 
                onClick={() => setShowAssetPicker(false)}
                className="modal-close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {availableAssets.length === 0 ? (
                <div className="no-assets">
                  <HiPhotograph size={48} />
                  <p>No assets available</p>
                  <p className="help-text">Add assets to this episode first</p>
                </div>
              ) : (
                <div className="asset-grid">
                  {availableAssets.map(asset => (
                    <div 
                      key={asset.id}
                      className="asset-picker-item"
                      onClick={() => handleAddAsset(asset)}
                    >
                      <div className="asset-picker-thumbnail">
                        {asset.url ? (
                          <img 
                            src={asset.thumbnail_url || asset.url} 
                            alt={asset.name}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className="thumbnail-placeholder" style={{ display: asset.url ? 'none' : 'flex' }}>
                          <HiPhotograph size={32} />
                        </div>
                        {getQualityBadge(asset.width, asset.height) && (
                          <span className="quality-badge">{getQualityBadge(asset.width, asset.height)}</span>
                        )}
                      </div>
                      <div className="asset-picker-info">
                        <h5>{asset.name}</h5>
                        <span className="asset-type" style={{ background: getAssetTypeColor(asset.type) }}>
                          {asset.type?.toUpperCase() || 'UNKNOWN'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SceneAssets;

