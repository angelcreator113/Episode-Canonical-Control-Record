import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import EnhancedAssetPicker from './Assets/EnhancedAssetPicker';
import './EpisodeAssetsTab.css';

const EpisodeAssetsTab = ({ episodeId }) => {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [assetType, setAssetType] = useState('PROMO_LALA');
  const [assetRole, setAssetRole] = useState('CHAR.HOST.LALA');
  const [previewAsset, setPreviewAsset] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    asset_group: '',
    purpose: '',
    is_global: false,
    allowed_uses: []
  });
  const [processingAssets, setProcessingAssets] = useState(new Set());
  const [showProcessed, setShowProcessed] = useState(true);
  const [openMenuAssetId, setOpenMenuAssetId] = useState(null);
  const [showMobileActions, setShowMobileActions] = useState(false);

  // Map asset role to appropriate asset type
  const getAssetTypeFromRole = (role) => {
    if (role.startsWith('CHAR.HOST.LALA')) return 'PROMO_LALA';
    if (role.startsWith('CHAR.HOST.JUSTAWOMANINHERPRIME')) return 'PROMO_JUSTAWOMANINHERPRIME';
    if (role.startsWith('CHAR.GUEST')) return 'PROMO_GUEST';
    if (role.startsWith('GUEST')) return 'PROMO_GUEST';
    if (role.startsWith('UI.ICON')) return 'BRAND_LOGO';
    if (role.startsWith('BRAND.SHOW')) return 'PROMO_JUSTAWOMANINHERPRIME';
    if (role.startsWith('BRAND.')) return 'BRAND_LOGO';
    if (role.startsWith('BG.')) return 'BACKGROUND_IMAGE';
    if (role.startsWith('UI.MOUSE')) return 'BACKGROUND_IMAGE';
    if (role.startsWith('UI.BUTTON')) return 'BACKGROUND_IMAGE';
    if (role.startsWith('TEXT.')) return 'BACKGROUND_IMAGE';
    return 'PROMO_LALA'; // Default fallback
  };

  useEffect(() => {
    loadAssets();
  }, [episodeId]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/v1/episodes/${episodeId}/assets`);
      const loadedAssets = response.data.data || [];
      console.log('📸 Loaded Episode Assets:', loadedAssets.map(a => ({
        id: a.id,
        name: a.name,
        s3_url_raw: a.s3_url_raw,
        s3_url_processed: a.s3_url_processed,
        asset_group: a.asset_group,
        purpose: a.purpose
      })));
      setAssets(loadedAssets);
    } catch (err) {
      console.error('Failed to load assets:', err);
      setError('Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    setSelectedFiles(Array.from(e.target.files));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      // Upload files to asset manager first
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        
        // Automatically derive asset type from selected role
        const derivedAssetType = getAssetTypeFromRole(assetRole);
        formData.append('assetType', derivedAssetType);
        formData.append('assetRole', assetRole);
        formData.append('metadata', JSON.stringify({ episodeId }));

        console.log('📤 Uploading with:', { 
          role: assetRole, 
          derivedType: derivedAssetType,
          fileName: file.name 
        });

        const uploadResponse = await api.post('/api/v1/assets', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        // Link uploaded asset to episode
        const assetId = uploadResponse.data.data.id;
        await api.post(`/api/v1/episodes/${episodeId}/assets`, {
          assetIds: [assetId],
          usageType: 'general',
        });
      }

      setSuccess(`✅ Uploaded ${selectedFiles.length} asset(s)`);
      setSelectedFiles([]);
      setShowUploadModal(false);
      loadAssets();
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAsset = async (assetId) => {
    if (!confirm('Remove this asset from the episode?')) return;

    try {
      await api.delete(`/api/v1/episodes/${episodeId}/assets/${assetId}`);
      setSuccess('✅ Asset removed');
      loadAssets();
    } catch (err) {
      setError('Failed to remove asset');
    }
  };

  const handleRemoveBackground = async (assetId) => {
    try {
      setProcessingAssets(prev => new Set(prev).add(assetId));
      setSuccess('🔄 Processing background removal...');
      await api.post(`/api/v1/assets/${assetId}/process-background`);
      setSuccess('✅ Background removed successfully!');
      loadAssets(); // Reload to show updated asset
    } catch (err) {
      console.error('Background removal failed:', err);
      setError(err.response?.data?.message || 'Failed to remove background');
    } finally {
      setProcessingAssets(prev => {
        const newSet = new Set(prev);
        newSet.delete(assetId);
        return newSet;
      });
    }
  };

  const handleDownload = async (assetId, type) => {
    try {
      console.log(`📥 Requesting download URL for asset ${assetId}, type: ${type}`);
      const response = await api.get(`/api/v1/assets/${assetId}/download/${type}`);
      const downloadUrl = response.data.data.downloadUrl;
      
      // Open download URL in new tab to trigger download
      window.open(downloadUrl, '_blank');
    } catch (err) {
      console.error('Download failed:', err);
      setError('Failed to generate download link');
    }
  };

  const handleEditAsset = (asset) => {
    setEditingAsset(asset.id);
    setEditForm({
      name: asset.name || '',
      asset_group: asset.asset_group || '',
      purpose: asset.purpose || '',
      is_global: asset.is_global || false,
      allowed_uses: asset.allowed_uses || []
    });
  };

  const handleSaveEdit = async () => {
    try {
      await api.put(`/api/v1/assets/${editingAsset}`, editForm);
      setSuccess('✅ Asset updated!');
      setEditingAsset(null);
      loadAssets();
    } catch (err) {
      console.error('Update failed:', err);
      setError('Failed to update asset');
    }
  };

  const handleCancelEdit = () => {
    setEditingAsset(null);
    setEditForm({ name: '', asset_group: '', purpose: '', is_global: false, allowed_uses: [] });
  };

  const toggleAllowedUse = (use) => {
    setEditForm(prev => ({
      ...prev,
      allowed_uses: prev.allowed_uses.includes(use)
        ? prev.allowed_uses.filter(u => u !== use)
        : [...prev.allowed_uses, use]
    }));
  };

  const handleLinkExistingAsset = async (selectedAsset) => {
    try {
      // Handle single asset or array of assets
      const assetsToLink = Array.isArray(selectedAsset) ? selectedAsset : [selectedAsset];
      
      for (const asset of assetsToLink) {
        await api.post(`/api/v1/episodes/${episodeId}/assets`, {
          assetIds: [asset.id],
          usageType: 'general',
        });
      }

      setSuccess(`✅ Linked ${assetsToLink.length} asset(s) to episode`);
      loadAssets();
      setShowAssetPicker(false);
    } catch (err) {
      console.error('Failed to link asset:', err);
      setError('Failed to link asset');
    }
  };

  const getUsageBadge = (usage) => {
    const badges = {
      thumbnail: { icon: '🖼️', label: 'Thumbnail', color: '#10b981' },
      promo: { icon: '📢', label: 'Promo', color: '#f59e0b' },
      scene_background: { icon: '🎬', label: 'Scene BG', color: '#8b5cf6' },
      general: { icon: '📦', label: 'General', color: '#6b7280' },
    };
    const badge = badges[usage] || badges.general;
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.25rem 0.75rem',
          background: badge.color,
          color: 'white',
          borderRadius: '12px',
          fontSize: '0.75rem',
          fontWeight: '600',
        }}
      >
        {badge.icon} {badge.label}
      </span>
    );
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
  };

  const getQualityBadge = (asset) => {
    const width = asset.width || 0;
    const height = asset.height || 0;
    
    if (width >= 3840 && height >= 2160) {
      return { label: '4K', color: '#10b981', type: 'hd' };
    } else if (width >= 1920 && height >= 1080) {
      return { label: 'HD', color: '#3b82f6', type: 'hd' };
    } else if (width >= 1280 && height >= 720) {
      return { label: 'HD', color: '#f59e0b', type: 'sd' };
    }
    return { label: 'SD', color: '#9ca3af', type: 'sd' };
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner-large"></div>
        <p>Loading assets...</p>
      </div>
    );
  }

  return (
    <div className="episode-assets-tab">
      {/* Header */}
      <div className="assets-header">
        <div className="assets-header-top">
          <div className="header-title">
            <h2>📸 Episode Assets</h2>
            <p className="header-subtitle">
              {assets.length} asset{assets.length !== 1 ? 's' : ''} linked to this episode
            </p>
          </div>
          
          {/* Mobile: Single Add Asset button */}
          <button 
            onClick={() => setShowMobileActions(true)} 
            className="btn-add-asset-mobile"
          >
            <span className="btn-icon">➕</span>
            <span className="btn-text">Add Asset</span>
          </button>

          {/* Desktop: Three action buttons */}
          <div className="header-actions">
            <button onClick={() => navigate('/assets')} className="btn-asset-manager">
              <span className="btn-icon">🗂️</span>
              <span className="btn-text">Asset Manager</span>
            </button>
            <button onClick={() => setShowAssetPicker(true)} className="btn-link-existing">
              <span className="btn-icon">🔗</span>
              <span className="btn-text">Link Existing</span>
            </button>
            <button onClick={() => setShowUploadModal(true)} className="btn-upload-files">
              <span className="btn-icon">⬆️</span>
              <span className="btn-text">Upload Files</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="message message-error">
            {error}
          </div>
        )}
        {success && (
          <div className="message message-success">
            {success}
          </div>
        )}
      </div>

      {/* Assets Grid */}
      {assets.length > 0 ? (
        <div className="assets-grid">
          {assets.map((asset) => {
            const usageData = asset.EpisodeAsset || {};
            const quality = getQualityBadge(asset);
            const showActionsMenu = openMenuAssetId === asset.id;

            return (
              <div
                key={asset.id}
                className="asset-card"
              >
                {/* Image Preview - Tappable */}
                <div
                  className="asset-preview"
                  onClick={() => setPreviewAsset(asset)}
                  style={{ cursor: 'pointer', height: '180px', maxHeight: '180px', overflow: 'hidden' }}
                >{(() => {
                    const url = asset.s3_url_processed || asset.s3_url_raw;
                    
                    // Check for invalid or mock URLs
                    if (!url || url.includes('mock-s3.dev') || url.includes('undefined')) {
                      const typeLabel = asset.asset_type?.replace(/_/g, ' ') || 'Asset';
                      const mediaIcon = asset.media_type === 'video' ? '🎥' : '🖼️';
                      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#6366f1"/><text x="50%" y="45%" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">${typeLabel}</text><text x="50%" y="60%" font-family="Arial, sans-serif" font-size="32" fill="rgba(255,255,255,0.7)" text-anchor="middle" dominant-baseline="middle">${mediaIcon}</text></svg>`;
                      
                      return (
                        <img
                          src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)}
                          alt={asset.name}
                        />
                      );
                    }
                    
                    // Render video element for videos
                    if (asset.media_type === 'video') {
                      return (
                        <video
                          src={url}
                          muted
                          playsInline
                          onMouseEnter={(e) => e.target.play()}
                          onMouseLeave={(e) => {
                            e.target.pause();
                            e.target.currentTime = 0;
                          }}
                          onError={(e) => {
                            // Only warn for unexpected video load failures
                            if (!url.includes('_processed')) {
                              console.warn('⚠️ Video load failed:', asset.name);
                            }
                            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#6366f1"/><text x="50%" y="45%" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">🎥 VIDEO</text><text x="50%" y="60%" font-family="Arial, sans-serif" font-size="12" fill="rgba(255,255,255,0.7)" text-anchor="middle" dominant-baseline="middle">Hover to play</text></svg>`;
                            // Create an img element to show placeholder
                            const img = document.createElement('img');
                            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
                            img.style.cssText = e.target.style.cssText;
                            e.target.parentNode.replaceChild(img, e.target);
                          }}
                        />
                      );
                    }
                    
                    // Render image element for images
                    return (
                      <img
                        src={url}
                        alt={asset.name}
                        onError={(e) => {
                          // Only log if it's not a known missing processed image
                          if (!url.includes('_processed.png')) {
                            console.warn('⚠️ Image load failed:', asset.name, url);
                          }
                          const typeLabel = asset.asset_type?.replace(/_/g, ' ') || 'Asset';
                          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#6366f1"/><text x="50%" y="45%" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">${typeLabel}</text><text x="50%" y="60%" font-family="Arial, sans-serif" font-size="32" fill="rgba(255,255,255,0.7)" text-anchor="middle" dominant-baseline="middle">🖼️</text></svg>`;
                          e.target.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
                        }}
                      />
                    );
                  })()}

                  {/* Quality Badge */}
                  <div className="asset-badges">
                    <span className={`badge badge-quality-${quality.type || 'unknown'}`}>
                      {quality.label}
                    </span>
                  </div>

                  {/* Overflow Menu Button */}
                  <div className="asset-menu-trigger" style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn-asset-menu"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuAssetId(showActionsMenu ? null : asset.id);
                      }}
                      style={{
                        background: 'rgba(0, 0, 0, 0.6)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.5rem',
                        color: 'white',
                        fontSize: '1.25rem',
                        cursor: 'pointer',
                        fontWeight: 700,
                        minWidth: '36px',
                        minHeight: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="More actions"
                    >
                      ⋯
                    </button>
                    
                    {showActionsMenu && (
                      <>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuAssetId(null);
                          }}
                          style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 100,
                          }}
                        />
                        <div
                          className="asset-actions-menu"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 0.5rem)',
                            right: 0,
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            boxShadow: '0 10px 26px rgba(0,0,0,0.12)',
                            minWidth: '180px',
                            zIndex: 101,
                            overflow: 'hidden',
                          }}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuAssetId(null);
                              window.open(asset.s3_url_processed || asset.s3_url_raw, '_blank');
                            }}
                            style={{
                              width: '100%',
                              background: 'transparent',
                              border: 'none',
                              padding: '0.875rem 1rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              fontWeight: 600,
                              color: '#1f2937',
                              cursor: 'pointer',
                              fontSize: '0.95rem',
                              textAlign: 'left',
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            👁️ View Full Size
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuAssetId(null);
                              setPreviewAsset(asset);
                            }}
                            style={{
                              width: '100%',
                              background: 'transparent',
                              border: 'none',
                              padding: '0.875rem 1rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              fontWeight: 600,
                              color: '#1f2937',
                              cursor: 'pointer',
                              fontSize: '0.95rem',
                              textAlign: 'left',
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            ℹ️ View Details
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuAssetId(null);
                              navigate(`/analytics/assets/${asset.id}`);
                            }}
                            style={{
                              width: '100%',
                              background: 'transparent',
                              border: 'none',
                              padding: '0.875rem 1rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              fontWeight: 600,
                              color: '#1f2937',
                              cursor: 'pointer',
                              fontSize: '0.95rem',
                              textAlign: 'left',
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            📊 Analytics
                          </button>
                          <div style={{ borderTop: '1px solid #e5e7eb' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuAssetId(null);
                                handleRemoveAsset(asset.id);
                              }}
                              style={{
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                padding: '0.875rem 1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                fontWeight: 600,
                                color: '#ef4444',
                                cursor: 'pointer',
                                fontSize: '0.95rem',
                                textAlign: 'left',
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = '#fef2f2'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              🗑️ Remove from Episode
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Asset Info - Simplified */}
                <div className="asset-info">
                  <h3 className="asset-name">
                    {asset.name || 'Untitled'}
                  </h3>

                  <div className="asset-details">
                    <span>{asset.width}×{asset.height}</span>
                    <span>·</span>
                    <span>{formatFileSize(asset.file_size_bytes)}</span>
                  </div>

                  {/* Compact category chips - show max 2 */}
                  {(asset.asset_group || asset.purpose) && (
                    <div className="asset-chips">
                      {asset.asset_group && (
                        <span className="chip">{asset.asset_group}</span>
                      )}
                      {asset.purpose && (
                        <span className="chip">{asset.purpose}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">🖼️</div>
          <h3>No Assets Yet</h3>
          <p>Upload images, videos, and other media for this episode</p>
          <button onClick={() => setShowUploadModal(true)} className="btn-upload-files">
            <span className="btn-icon">📤</span>
            <span className="btn-text">Upload First Asset</span>
          </button>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setShowUploadModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', fontWeight: '700' }}>Upload Assets</h2>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
                Asset Role
              </label>
              <select
                value={assetRole}
                onChange={(e) => setAssetRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #667eea',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  background: '#f8f9ff'
                }}
              >
                <optgroup label="🎭 CHARACTERS">
                  <option value="CHAR.HOST.LALA">Lala (Host)</option>
                  <option value="CHAR.HOST.JUSTAWOMANINHERPRIME">Just a Woman in Her Prime (Host)</option>
                  <option value="CHAR.GUEST.1">Guest 1</option>
                  <option value="CHAR.GUEST.2">Guest 2</option>
                </optgroup>
                <optgroup label="🎯 ICONS">
                  <option value="UI.ICON.CLOSET">Icon: Closet</option>
                  <option value="UI.ICON.JEWELRY_BOX">Icon: Jewelry Box</option>
                  <option value="UI.ICON.TODO_LIST">Icon: To-Do List</option>
                  <option value="UI.ICON.SPEECH">Icon: Speech Bubble</option>
                  <option value="UI.ICON.LOCATION">Icon: Location Pin</option>
                  <option value="UI.ICON.PERFUME">Icon: Perfume</option>
                  <option value="UI.ICON.POSE">Icon: Pose</option>
                  <option value="UI.ICON.RESERVED">Icon: Reserved</option>
                  <option value="UI.ICON.HOLDER.MAIN">Icon Holder</option>
                </optgroup>
                <optgroup label="🏷️ BRANDING">
                  <option value="BRAND.SHOW.TITLE_GRAPHIC">Show Title Graphic</option>
                </optgroup>
                <optgroup label="🖼️ BACKGROUNDS & CHROME">
                  <option value="BG.MAIN">Background Image</option>
                  <option value="UI.MOUSE.CURSOR">Mouse Cursor</option>
                  <option value="UI.BUTTON.EXIT">Exit Button</option>
                  <option value="UI.BUTTON.MINIMIZE">Minimize Button</option>
                </optgroup>
              </select>
              
              {/* Show derived asset type */}
              <div style={{ 
                marginTop: '0.5rem', 
                padding: '0.5rem 0.75rem',
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '6px',
                fontSize: '0.875rem',
                color: '#0369a1'
              }}>
                <span style={{ fontWeight: '600' }}>📦 Will be saved as:</span>{' '}
                <span style={{ fontFamily: 'monospace' }}>{getAssetTypeFromRole(assetRole)}</span>
                {' → '}
                <span style={{ fontWeight: '600' }}>
                  {assetRole.startsWith('CHAR.HOST.LALA') && '👩 LALA folder'}
                  {assetRole.startsWith('CHAR.HOST.JUSTAWOMANINHERPRIME') && '💜 SHOW folder'}
                  {(assetRole.startsWith('CHAR.GUEST') || assetRole.startsWith('GUEST')) && '👤 GUEST folder'}
                  {assetRole.startsWith('UI.ICON') && '🎨 SHOW folder (icons)'}
                  {assetRole.startsWith('BRAND.') && '💜 SHOW folder (branding)'}
                  {assetRole.startsWith('BG.') && '🖼️ EPISODE folder (backgrounds)'}
                  {assetRole.startsWith('UI.MOUSE') && '🖼️ EPISODE folder (UI)'}
                  {assetRole.startsWith('UI.BUTTON') && '🖼️ EPISODE folder (UI)'}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
                Select Files
              </label>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileSelect}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              {selectedFiles.length > 0 && (
                <p style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
                  {selectedFiles.length} file(s) selected
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleUpload}
                disabled={selectedFiles.length === 0 || uploading}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: selectedFiles.length === 0 || uploading ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: selectedFiles.length === 0 || uploading ? 'not-allowed' : 'pointer',
                }}
              >
                {uploading ? '⏳ Uploading...' : '⬆️ Upload'}
              </button>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Preview Modal */}
      {previewAsset && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '2rem',
          }}
          onClick={() => setPreviewAsset(null)}
        >
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }}>
            {/* Version Toggle */}
            {previewAsset.s3_url_processed && (
              <div style={{ position: 'absolute', top: '-3rem', left: '0', display: 'flex', gap: '0.5rem', zIndex: 10 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowProcessed(true); }}
                  style={{
                    padding: '0.5rem 1rem',
                    background: showProcessed ? '#6366f1' : '#e5e7eb',
                    color: showProcessed ? 'white' : '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                  }}
                >
                  ✨ Processed
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowProcessed(false); }}
                  style={{
                    padding: '0.5rem 1rem',
                    background: !showProcessed ? '#6366f1' : '#e5e7eb',
                    color: !showProcessed ? 'white' : '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                  }}
                >
                  🖼️ Original
                </button>
              </div>
            )}
            
            <img
              src={(showProcessed && previewAsset.s3_url_processed) ? previewAsset.s3_url_processed : previewAsset.s3_url_raw}
              alt={previewAsset.name}
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px' }}
            />
            
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <p style={{ color: 'white', fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                {previewAsset.name}
              </p>
              
              {/* Download Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(previewAsset.id, 'raw');
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  ⬇️ Download Original
                </button>
                {previewAsset.s3_url_processed && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(previewAsset.id, 'processed');
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#6366f1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                    }}
                  >
                    ⬇️ Download Processed
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      {editingAsset && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem',
          }}
          onClick={handleCancelEdit}
        >
          <div
            style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', fontWeight: '700' }}>Edit Asset</h2>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
                Name
              </label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Enter asset name"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
                Asset Group
              </label>
              <select
                value={editForm.asset_group}
                onChange={(e) => setEditForm({ ...editForm, asset_group: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                }}
              >
                <option value="">Select Group</option>
                <option value="LALA">LALA</option>
                <option value="SHOW">SHOW</option>
                <option value="GUEST">GUEST</option>
                <option value="EPISODE">EPISODE</option>
                <option value="WARDROBE">WARDROBE</option>
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
                Purpose
              </label>
              <select
                value={editForm.purpose}
                onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                }}
              >
                <option value="">Select Purpose</option>
                <option value="MAIN">MAIN</option>
                <option value="TITLE">TITLE</option>
                <option value="ICON">ICON</option>
                <option value="BACKGROUND">BACKGROUND</option>
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editForm.is_global}
                  onChange={(e) => setEditForm({ ...editForm, is_global: e.target.checked })}
                  style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: '600', color: '#374151' }}>Global Asset (Available everywhere)</span>
              </label>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }}>
                Allowed Uses
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {['THUMBNAIL', 'SCENE', 'UI', 'SOCIAL', 'BACKGROUND_PLATE'].map(use => (
                  <label
                    key={use}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      background: editForm.allowed_uses.includes(use) ? '#dbeafe' : '#f3f4f6',
                      border: `2px solid ${editForm.allowed_uses.includes(use) ? '#3b82f6' : '#e5e7eb'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editForm.allowed_uses.includes(use)}
                      onChange={() => toggleAllowedUse(use)}
                      style={{ cursor: 'pointer' }}
                    />
                    {use}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancelEdit}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Action Sheet */}
      {showMobileActions && (
        <div className="mobile-action-sheet-overlay" onClick={() => setShowMobileActions(false)}>
          <div className="mobile-action-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="action-sheet-header">
              <h3>Add Asset</h3>
              <button onClick={() => setShowMobileActions(false)} className="btn-close">✕</button>
            </div>
            <div className="action-sheet-options">
              <button 
                onClick={() => {
                  setShowMobileActions(false);
                  setShowUploadModal(true);
                }}
                className="action-option"
              >
                <span className="option-icon">📤</span>
                <div className="option-content">
                  <div className="option-title">Upload New Asset</div>
                  <div className="option-subtitle">Upload files from your device</div>
                </div>
              </button>
              <button 
                onClick={() => {
                  setShowMobileActions(false);
                  setShowAssetPicker(true);
                }}
                className="action-option"
              >
                <span className="option-icon">🔗</span>
                <div className="option-content">
                  <div className="option-title">Link Existing Asset</div>
                  <div className="option-subtitle">Choose from asset library</div>
                </div>
              </button>
              <button 
                onClick={() => {
                  setShowMobileActions(false);
                  navigate('/assets');
                }}
                className="action-option"
              >
                <span className="option-icon">🗂️</span>
                <div className="option-content">
                  <div className="option-title">Open Asset Manager</div>
                  <div className="option-subtitle">Manage all assets</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Asset Picker */}
      <EnhancedAssetPicker
        isOpen={showAssetPicker}
        onClose={() => setShowAssetPicker(false)}
        onSelect={handleLinkExistingAsset}
        scopeFilter="episode"
        episodeId={episodeId}
        multiSelect={true}
        title="Link Assets to Episode"
      />
    </div>
  );
};

export default EpisodeAssetsTab;
