import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import EnhancedAssetPicker from './Assets/EnhancedAssetPicker';

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
        formData.append('assetType', assetType);
        formData.append('metadata', JSON.stringify({ episodeId }));

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
      return { label: '4K', color: '#10b981' };
    } else if (width >= 1920 && height >= 1080) {
      return { label: 'HD', color: '#3b82f6' };
    } else if (width >= 1280 && height >= 720) {
      return { label: 'HD', color: '#f59e0b' };
    }
    return { label: 'SD', color: '#9ca3af' };
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <div className="spinner-large"></div>
        <p>Loading assets...</p>
      </div>
    );
  }

  return (
    <div className="episode-assets-tab">
      {/* Header */}
      <div className="content-card" style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>📸 Episode Assets</h2>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.95rem' }}>
              {assets.length} asset{assets.length !== 1 ? 's' : ''} linked to this episode
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => navigate('/assets')}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              🗂️ Asset Manager
            </button>
            <button
              onClick={() => setShowAssetPicker(true)}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              🔗 Link Existing
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              ⬆️ Upload Files
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div style={{ padding: '1rem', background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '8px', color: '#991b1b', marginBottom: '1rem' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '1rem', background: '#d1fae5', border: '1px solid #10b981', borderRadius: '8px', color: '#065f46', marginBottom: '1rem' }}>
            {success}
          </div>
        )}
      </div>

      {/* Assets Grid */}
      {assets.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {assets.map((asset) => {
            const usageData = asset.EpisodeAsset || {};
            const quality = getQualityBadge(asset);

            return (
              <div
                key={asset.id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  overflow: 'hidden',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                }}
                onClick={() => setPreviewAsset(asset)}
              >
                {/* Image/Video Preview */}
                <div style={{ position: 'relative', paddingTop: '66.67%', background: '#f3f4f6' }}>
                  {(() => {
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
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
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
                            console.error('❌ Video load failed for:', asset.name, url);
                            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#6366f1"/><text x="50%" y="45%" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">🎥 VIDEO</text><text x="50%" y="60%" font-family="Arial, sans-serif" font-size="12" fill="rgba(255,255,255,0.7)" text-anchor="middle" dominant-baseline="middle">Hover to play</text></svg>`;
                            // Create an img element to show placeholder
                            const img = document.createElement('img');
                            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
                            img.style.cssText = e.target.style.cssText;
                            e.target.parentNode.replaceChild(img, e.target);
                          }}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
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
                          console.error('❌ Image load failed for:', asset.name, url);
                          const typeLabel = asset.asset_type?.replace(/_/g, ' ') || 'Asset';
                          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#6366f1"/><text x="50%" y="45%" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">${typeLabel}</text><text x="50%" y="60%" font-family="Arial, sans-serif" font-size="32" fill="rgba(255,255,255,0.7)" text-anchor="middle" dominant-baseline="middle">🖼️</text></svg>`;
                          e.target.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    );
                  })()}

                  {/* Usage Badge */}
                  <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem' }}>
                    {getUsageBadge(usageData.usage_type)}
                  </div>

                  {/* Quality Badge */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '0.75rem',
                      right: '0.75rem',
                      padding: '0.25rem 0.75rem',
                      background: quality.color,
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                    }}
                  >
                    {quality.label}
                  </div>
                </div>

                {/* Asset Info */}
                <div style={{ padding: '1rem' }}>
                  <h3 style={{ 
                    margin: '0 0 0.5rem 0', 
                    fontSize: '1rem', 
                    fontWeight: '700', 
                    color: '#1f2937'
                  }}>
                    {asset.name || 'Untitled'}
                  </h3>

                  {/* Organization Badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.5rem' }}>
                    {asset.asset_group && (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.025em',
                        background: asset.asset_group === 'LALA' ? '#e9d5ff' : asset.asset_group === 'SHOW' ? '#fce7f3' : asset.asset_group === 'GUEST' ? '#d1fae5' : asset.asset_group === 'EPISODE' ? '#fed7aa' : '#ddd6fe',
                        color: asset.asset_group === 'LALA' ? '#7c3aed' : asset.asset_group === 'SHOW' ? '#db2777' : asset.asset_group === 'GUEST' ? '#059669' : asset.asset_group === 'EPISODE' ? '#ea580c' : '#7c3aed'
                      }}>
                        {asset.asset_group}
                      </span>
                    )}
                    {asset.purpose && (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.025em',
                        background: '#bfdbfe',
                        color: '#2563eb'
                      }}>
                        {asset.purpose}
                      </span>
                    )}
                    {asset.is_global && (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        background: '#ccfbf1',
                        color: '#0f766e'
                      }}>
                        🌐 Global
                      </span>
                    )}
                  </div>

                  {/* Allowed Uses */}
                  {asset.allowed_uses && asset.allowed_uses.length > 0 && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem', fontWeight: '500' }}>
                        Can be used for:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {asset.allowed_uses.slice(0, 3).map(use => (
                          <span key={use} style={{
                            padding: '0.125rem 0.375rem',
                            background: '#f3f4f6',
                            color: '#4b5563',
                            borderRadius: '3px',
                            fontSize: '0.6875rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.025em',
                            border: '1px solid #e5e7eb'
                          }}>
                            {use}
                          </span>
                        ))}
                        {asset.allowed_uses.length > 3 && (
                          <span style={{
                            padding: '0.125rem 0.375rem',
                            background: '#e5e7eb',
                            color: '#6b7280',
                            borderRadius: '3px',
                            fontSize: '0.6875rem',
                            fontWeight: '600'
                          }}>
                            +{asset.allowed_uses.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{asset.width}x{asset.height}</span>
                      <span>{formatFileSize(asset.file_size_bytes)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditAsset(asset);
                        }}
                        style={{
                          flex: 1,
                          minWidth: '90px',
                          padding: '0.5rem',
                          background: '#f3f4f6',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#374151',
                          cursor: 'pointer',
                        }}
                      >
                        ✏️ Edit
                      </button>
                      {!asset.s3_url_processed && asset.media_type !== 'video' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveBackground(asset.id);
                          }}
                          disabled={processingAssets.has(asset.id)}
                          style={{
                            flex: 1,
                            minWidth: '120px',
                            padding: '0.5rem',
                            background: processingAssets.has(asset.id) 
                              ? '#9ca3af' 
                              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: 'white',
                            cursor: processingAssets.has(asset.id) ? 'not-allowed' : 'pointer',
                            opacity: processingAssets.has(asset.id) ? 0.7 : 1,
                          }}
                        >
                          {processingAssets.has(asset.id) ? '⏳ Processing...' : '✨ Remove BG'}
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(asset.s3_url_processed || asset.s3_url_raw);
                          setSuccess('✅ URL copied!');
                          setTimeout(() => setSuccess(null), 2000);
                        }}
                        style={{
                          flex: 1,
                          minWidth: '90px',
                          padding: '0.5rem',
                          background: '#f3f4f6',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#374151',
                          cursor: 'pointer',
                        }}
                      >
                        📋 Copy URL
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveAsset(asset.id);
                        }}
                        style={{
                          flex: 1,
                          minWidth: '90px',
                          padding: '0.5rem',
                          background: '#fee2e2',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#991b1b',
                          cursor: 'pointer',
                        }}
                      >
                        🗑️ Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="content-card" style={{ background: 'white', padding: '3rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>🖼️</span>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>No Assets Yet</h3>
          <p style={{ margin: '0 0 1.5rem 0', color: '#6b7280', fontSize: '1rem' }}>Upload images, videos, and other media for this episode</p>
          <button
            onClick={() => setShowUploadModal(true)}
            style={{
              padding: '0.875rem 1.75rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            📤 Upload First Asset
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
                Asset Type
              </label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                }}
              >
                <optgroup label="LALA Platform">
                  <option value="PROMO_LALA">📸 Lala Promo</option>
                  <option value="BRAND_LOGO">🏷️ Brand Logo</option>
                </optgroup>
                <optgroup label="Show">
                  <option value="PROMO_JUSTAWOMANINHERPRIME">💜 Show Promo</option>
                  <option value="BRAND_BANNER">🎨 Brand Banner</option>
                </optgroup>
                <optgroup label="Guest">
                  <option value="PROMO_GUEST">👤 Guest Promo</option>
                  <option value="GUEST_HEADSHOT">📷 Guest Headshot</option>
                </optgroup>
                <optgroup label="Episode">
                  <option value="EPISODE_FRAME">🖼️ Episode Frame</option>
                  <option value="BACKGROUND_VIDEO">🎥 Background Video</option>
                  <option value="BACKGROUND_IMAGE">🌄 Background Image</option>
                </optgroup>
              </select>
              <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                Auto-tagged with group, purpose & allowed uses
              </p>
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
