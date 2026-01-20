import React, { useState, useEffect } from 'react';
import api from '../services/api';

const EpisodeAssetsTab = ({ episodeId }) => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [usageType, setUsageType] = useState('general');
  const [previewAsset, setPreviewAsset] = useState(null);

  useEffect(() => {
    loadAssets();
  }, [episodeId]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/v1/episodes/${episodeId}/assets`);
      setAssets(response.data.data || []);
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
        formData.append('assetType', 'PROMO_LALA'); // Default type
        formData.append('metadata', JSON.stringify({ episodeId }));

        const uploadResponse = await api.post('/api/v1/assets', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        // Link uploaded asset to episode
        const assetId = uploadResponse.data.data.id;
        await api.post(`/api/v1/episodes/${episodeId}/assets`, {
          assetId,
          usageType,
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
                {/* Image Preview */}
                <div style={{ position: 'relative', paddingTop: '66.67%', background: '#f3f4f6' }}>
                  {asset.s3_url_processed || asset.s3_url_raw ? (
                    <img
                      src={asset.s3_url_processed || asset.s3_url_raw}
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
                  ) : (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '3rem',
                      }}
                    >
                      📦
                    </div>
                  )}

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
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '700', color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {asset.name || 'Untitled'}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{asset.width}x{asset.height}</span>
                      <span>{formatFileSize(asset.file_size_bytes)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(asset.s3_url_processed || asset.s3_url_raw);
                          setSuccess('✅ URL copied!');
                          setTimeout(() => setSuccess(null), 2000);
                        }}
                        style={{
                          flex: 1,
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
                Usage Type
              </label>
              <select
                value={usageType}
                onChange={(e) => setUsageType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                }}
              >
                <option value="general">📦 General</option>
                <option value="thumbnail">🖼️ Thumbnail</option>
                <option value="promo">📢 Promo</option>
                <option value="scene_background">🎬 Scene Background</option>
              </select>
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
          <div style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
            <img
              src={previewAsset.s3_url_processed || previewAsset.s3_url_raw}
              alt={previewAsset.name}
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px' }}
            />
            <p style={{ color: 'white', textAlign: 'center', marginTop: '1rem', fontSize: '1.1rem', fontWeight: '600' }}>
              {previewAsset.name}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EpisodeAssetsTab;
