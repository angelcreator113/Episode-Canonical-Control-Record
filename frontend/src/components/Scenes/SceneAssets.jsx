import React, { useState, useEffect } from 'react';
import { HiPlus, HiTrash, HiPhotograph } from 'react-icons/hi';
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

  useEffect(() => {
    loadSceneAssets();
    loadAvailableAssets();
  }, [sceneId]);

  const loadSceneAssets = async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await sceneService.getSceneAssets(sceneId);
      const mockAssets = [
        {
          id: '1',
          asset_id: 'asset-1',
          asset_name: 'Lala Promo',
          asset_type: 'PROMO_LALA',
          asset_url: '/assets/lala-promo.png',
          start_time: 0,
          end_time: 5,
          display_duration: 5
        }
      ];
      setSceneAssets(mockAssets);
      setLoading(false);
    } catch (error) {
      console.error('Error loading scene assets:', error);
      setLoading(false);
    }
  };

  const loadAvailableAssets = async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await assetService.getEpisodeAssets(episodeId);
      const mockAssets = [
        {
          id: 'asset-1',
          name: 'Lala Promo',
          type: 'PROMO_LALA',
          url: '/assets/lala-promo.png',
          thumbnail_url: '/assets/lala-promo-thumb.png'
        },
        {
          id: 'asset-2',
          name: 'Guest Intro',
          type: 'PROMO_GUEST',
          url: '/assets/guest-promo.png',
          thumbnail_url: '/assets/guest-promo-thumb.png'
        },
        {
          id: 'asset-3',
          name: 'Brand Logo',
          type: 'BRAND_LOGO',
          url: '/assets/brand-logo.png',
          thumbnail_url: '/assets/brand-logo-thumb.png'
        }
      ];
      setAvailableAssets(mockAssets);
    } catch (error) {
      console.error('Error loading available assets:', error);
    }
  };

  const handleAddAsset = async (asset) => {
    try {
      // TODO: Replace with actual API call
      // await sceneService.linkAsset(sceneId, asset.id, { start_time: 0, end_time: 5 });
      
      const newSceneAsset = {
        id: `scene-asset-${Date.now()}`,
        asset_id: asset.id,
        asset_name: asset.name,
        asset_type: asset.type,
        asset_url: asset.url,
        start_time: 0,
        end_time: 5,
        display_duration: 5
      };

      setSceneAssets([...sceneAssets, newSceneAsset]);
      setShowAssetPicker(false);
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error adding asset to scene:', error);
      alert('Failed to add asset');
    }
  };

  const handleRemoveAsset = async (sceneAssetId) => {
    if (!window.confirm('Remove this asset from the scene?')) {
      return;
    }

    try {
      // TODO: Replace with actual API call
      // await sceneService.unlinkAsset(sceneId, sceneAssetId);
      
      setSceneAssets(sceneAssets.filter(sa => sa.id !== sceneAssetId));
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error removing asset:', error);
      alert('Failed to remove asset');
    }
  };

  const handleUpdateTiming = async (sceneAssetId, startTime, endTime) => {
    try {
      // TODO: Replace with actual API call
      // await sceneService.updateAssetTiming(sceneAssetId, { start_time: startTime, end_time: endTime });
      
      setSceneAssets(sceneAssets.map(sa => 
        sa.id === sceneAssetId 
          ? { ...sa, start_time: startTime, end_time: endTime, display_duration: endTime - startTime }
          : sa
      ));
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error updating asset timing:', error);
      alert('Failed to update timing');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getAssetTypeColor = (type) => {
    const colors = {
      'PROMO_LALA': '#ec4899',
      'PROMO_GUEST': '#f59e0b',
      'PROMO_WOMANINPRIME': '#8b5cf6',
      'BRAND_LOGO': '#3b82f6',
      'EPISODE_FRAME': '#10b981',
    };
    return colors[type] || '#6b7280';
  };

  if (loading) {
    return <div className="scene-assets-loading">Loading assets...</div>;
  }

  return (
    <div className="scene-assets">
      <div className="scene-assets-header">
        <h4>Scene Assets</h4>
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
                <img 
                  src={sceneAsset.asset_url} 
                  alt={sceneAsset.asset_name}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="thumbnail-placeholder" style={{ display: 'none' }}>
                  <HiPhotograph size={32} />
                </div>
              </div>

              <div className="asset-info">
                <h5>{sceneAsset.asset_name}</h5>
                <span className="asset-type" style={{ background: getAssetTypeColor(sceneAsset.asset_type) }}>
                  {sceneAsset.asset_type.replace('_', ' ')}
                </span>
              </div>

              <div className="asset-timing">
                <div className="timing-input">
                  <label>Start</label>
                  <input
                    type="number"
                    value={sceneAsset.start_time}
                    onChange={(e) => handleUpdateTiming(
                      sceneAsset.id,
                      parseInt(e.target.value) || 0,
                      sceneAsset.end_time
                    )}
                    min="0"
                  />
                  <span>s</span>
                </div>

                <div className="timing-input">
                  <label>End</label>
                  <input
                    type="number"
                    value={sceneAsset.end_time}
                    onChange={(e) => handleUpdateTiming(
                      sceneAsset.id,
                      sceneAsset.start_time,
                      parseInt(e.target.value) || 0
                    )}
                    min={sceneAsset.start_time}
                  />
                  <span>s</span>
                </div>

                <div className="timing-duration">
                  Duration: {sceneAsset.display_duration}s
                </div>
              </div>

              <button 
                onClick={() => handleRemoveAsset(sceneAsset.id)}
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
              <div className="asset-grid">
                {availableAssets.map(asset => (
                  <div 
                    key={asset.id}
                    className="asset-picker-item"
                    onClick={() => handleAddAsset(asset)}
                  >
                    <div className="asset-picker-thumbnail">
                      <img 
                        src={asset.thumbnail_url || asset.url} 
                        alt={asset.name}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      <div className="thumbnail-placeholder" style={{ display: 'none' }}>
                        <HiPhotograph size={32} />
                      </div>
                    </div>
                    <div className="asset-picker-info">
                      <h5>{asset.name}</h5>
                      <span className="asset-type" style={{ background: getAssetTypeColor(asset.type) }}>
                        {asset.type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SceneAssets;
