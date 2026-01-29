import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AssetRolePicker.css';

/**
 * AssetRolePicker Component
 * 
 * Shows assets matching a specific role with inline upload capability.
 * 
 * Props:
 * - role: string - Asset role to filter (e.g., "CHAR.HOST.LALA", "UI.ICON.CLOSET")
 * - roleLabel: string - Human-readable label for the role
 * - episodeId: string - Episode UUID for filtering
 * - showId: string - Show UUID
 * - selectedAssetId: string - Currently selected asset ID
 * - onChange: (assetId) => void - Callback when selection changes
 * - onProcessAsset: (role, assetId, options) => Promise<void> - Callback to process asset
 * - processingStatus: string - 'idle'|'processing'|'done'|'error'
 * - processedAsset: object - Processed asset details { processedUrl, useProcessed }
 * - templateSlot: object - Template slot configuration with processing requirements
 * - required: boolean - Whether this role is required
 * - disabled: boolean - Whether picker is disabled
 * - refreshKey: any - Change this to trigger a refresh of assets
 */
const AssetRolePicker = ({
  role,
  roleLabel,
  episodeId,
  showId,
  selectedAssetId,
  onChange,
  onProcessAsset,
  processingStatus = 'idle',
  processedAsset = null,
  templateSlot = null,
  required = false,
  disabled = false,
  refreshKey = 0
}) => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showProcessingOptions, setShowProcessingOptions] = useState(false);

  useEffect(() => {
    if (role && episodeId) {
      fetchAssets();
    }
  }, [role, episodeId, refreshKey]);

  const fetchAssets = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!episodeId) {
        setError('Episode ID required');
        setAssets([]);
        setLoading(false);
        return;
      }
      
      // Fetch assets linked to this episode
      const response = await axios.get(`/api/v1/episodes/${episodeId}/assets`);
      const allLinkedAssets = response.data.data || [];
      
      // Filter to exact role matches only
      const matchingAssets = allLinkedAssets.filter(asset => asset.asset_role === role);
      
      console.log(`📦 Found ${matchingAssets.length} assets for role: ${role}`);
      setAssets(matchingAssets);
    } catch (err) {
      console.error('❌ Error fetching assets:', err);
      setError('Failed to load assets: ' + (err.response?.data?.message || err.message));
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAsset = (assetId) => {
    onChange(assetId === selectedAssetId ? null : assetId);
  };

  const handleProcessAsset = async () => {
    if (!onProcessAsset || !selectedAssetId) return;
    
    const processingOptions = {
      removeBackground: templateSlot?.processing?.removeBackground || false,
      smoothSkin: templateSlot?.processing?.smoothSkin || false,
      autoEnhance: templateSlot?.processing?.autoEnhance || false
    };

    await onProcessAsset(role, selectedAssetId, processingOptions);
    setShowProcessingOptions(false);
  };

  // Check if processing is needed for this slot
  const needsProcessing = templateSlot?.processing && (
    templateSlot.processing.removeBackground ||
    templateSlot.processing.smoothSkin ||
    templateSlot.processing.autoEnhance
  );

  return (
    <div className="asset-role-picker">
      {/* Processing Status Banner */}
      {needsProcessing && selectedAssetId && (
        <div style={{
          padding: '12px',
          marginBottom: '12px',
          borderRadius: '8px',
          background: processingStatus === 'processing' ? '#fef3c7' :
                      processingStatus === 'done' ? '#d1fae5' :
                      processingStatus === 'error' ? '#fee2e2' :
                      '#e0e7ff',
          border: `1px solid ${processingStatus === 'processing' ? '#fbbf24' :
                      processingStatus === 'done' ? '#10b981' :
                      processingStatus === 'error' ? '#ef4444' :
                      '#818cf8'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>
              {processingStatus === 'processing' ? '⏳' :
               processingStatus === 'done' ? '✅' :
               processingStatus === 'error' ? '❌' :
               '🔧'}
            </span>
            <span style={{ fontWeight: '600' }}>
              {processingStatus === 'processing' ? 'Processing...' :
               processingStatus === 'done' ? 'Processed' :
               processingStatus === 'error' ? 'Processing Failed' :
               'Processing Available'}
            </span>
          </div>
          {processingStatus !== 'processing' && processingStatus !== 'done' && (
            <button
              onClick={() => setShowProcessingOptions(true)}
              style={{
                padding: '6px 12px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Process Asset
            </button>
          )}
          {processedAsset?.useProcessed && (
            <div style={{ fontSize: '11px', color: '#059669' }}>
              Using processed version
            </div>
          )}
        </div>
      )}

      {/* Processing Options Modal */}
      {showProcessingOptions && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }} onClick={() => setShowProcessingOptions(false)}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '90%'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0' }}>🔧 Process Asset for {roleLabel || role}</h3>
            <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: '14px' }}>
              This template requires the following processing:
            </p>
            <div style={{ marginBottom: '20px' }}>
              {templateSlot?.processing?.removeBackground && (
                <div style={{ padding: '8px', background: '#f3f4f6', borderRadius: '6px', marginBottom: '8px' }}>
                  <strong>✂️ Remove Background</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                    Removes background using AI (Runway ML or Remove.bg)
                  </p>
                </div>
              )}
              {templateSlot?.processing?.smoothSkin && (
                <div style={{ padding: '8px', background: '#f3f4f6', borderRadius: '6px', marginBottom: '8px' }}>
                  <strong>✨ Smooth Skin</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                    Applies subtle smoothing effect
                  </p>
                </div>
              )}
              {templateSlot?.processing?.autoEnhance && (
                <div style={{ padding: '8px', background: '#f3f4f6', borderRadius: '6px', marginBottom: '8px' }}>
                  <strong>🎨 Auto Enhance</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                    Auto-adjusts brightness, contrast, and saturation
                  </p>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowProcessingOptions(false)}
                style={{
                  padding: '10px 20px',
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleProcessAsset}
                style={{
                  padding: '10px 20px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                🚀 Start Processing
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Loading State */}
      {loading && (
        <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
          <div>Loading assets...</div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={{
          padding: '16px',
          background: '#fee2e2',
          borderRadius: '8px',
          color: '#991b1b',
          fontSize: '14px',
          border: '1px solid #fecaca'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Empty State with Upload Button */}
      {!loading && !error && assets.length === 0 && (
        <div style={{
          padding: '32px 24px',
          textAlign: 'center',
          background: '#f9fafb',
          borderRadius: '12px',
          border: '2px dashed #d1d5db',
          margin: '12px 0'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>📁</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
            No assets found for {roleLabel || role}
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
            Upload an asset with role: <code style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: '4px' }}>{role}</code>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            style={{
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>📤</span>
            <span>Upload Asset</span>
          </button>
        </div>
      )}

      {/* Assets Grid */}
      {!loading && assets.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '12px',
          padding: '12px 4px'
        }}>
          {assets.map(asset => {
            const isSelected = asset.id === selectedAssetId;
            const thumbnailUrl = asset.s3_url_processed || asset.s3_url_raw || '/placeholder.png';
            
            // Debug: Log thumbnail URL to console
            if (!thumbnailUrl.startsWith('/placeholder')) {
              console.log(`🖼️ Asset ${asset.name}: ${thumbnailUrl}`);
            }

            return (
              <div
                key={asset.id}
                onClick={() => !disabled && handleSelectAsset(asset.id)}
                style={{
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  border: isSelected ? '3px solid #3b82f6' : '2px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '8px',
                  background: isSelected ? '#eff6ff' : 'white',
                  transition: 'all 0.2s',
                  opacity: disabled ? 0.5 : 1,
                  boxShadow: isSelected ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
                }}
              >
                <img
                  src={thumbnailUrl}
                  alt={asset.name}
                  style={{
                    width: '100%',
                    height: '100px',
                    objectFit: 'cover',
                    borderRadius: '6px',
                    background: '#f3f4f6'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div style={{
                  display: 'none',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100px',
                  background: '#f3f4f6',
                  borderRadius: '6px',
                  fontSize: '32px'
                }}>
                  🖼️
                </div>

                <div style={{
                  marginTop: '6px',
                  fontSize: '11px',
                  color: '#666',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }} title={asset.name}>
                  {asset.name}
                </div>

                {/* Role Badge */}
                {asset.asset_role && (
                  <div style={{
                    marginTop: '4px',
                    display: 'inline-block',
                    padding: '2px 6px',
                    background: '#e5e7eb',
                    borderRadius: '4px',
                    fontSize: '9px',
                    color: '#374151',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px'
                  }}>
                    {asset.asset_role}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }} onClick={() => setShowUploadModal(false)}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '90%'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0' }}>Upload Asset for {roleLabel || role}</h3>
            <p style={{ margin: '0 0 16px 0', color: '#6b7280' }}>
              This will open the asset upload interface. Upload an asset with role: <strong>{role}</strong>
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{
                  padding: '10px 20px',
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  window.location.href = `/episodes/${episodeId}?tab=assets&upload=${role}`;
                }}
                style={{
                  padding: '10px 20px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Go to Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetRolePicker;
