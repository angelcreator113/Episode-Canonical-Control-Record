import React, { useState, useEffect } from 'react';
import './AssetManager.css';

/**
 * AssetManager Component
 * Upload and manage promotional assets with background removal
 */

const AssetManager = () => {
  const [assets, setAssets] = useState([]);
  const [pendingAssets, setPendingAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [file, setFile] = useState(null);
  const [assetType, setAssetType] = useState('PROMO_LALA');
  const [metadata, setMetadata] = useState('');
  const [showPending, setShowPending] = useState(false);

  const assetTypes = [
    { value: 'PROMO_LALA', label: '👩 Lala Promo' },
    { value: 'PROMO_JUSTAWOMANINHERPRIME', label: '💜 JustAWoman Promo' },
    { value: 'PROMO_GUEST', label: '👤 Guest Promo' },
    { value: 'BRAND_LOGO', label: '🏷️ Brand Logo' },
    { value: 'EPISODE_FRAME', label: '🖼️ Episode Frame' }
  ];

  // Load assets
  useEffect(() => {
    fetchAssets();
    fetchPendingAssets();
  }, [assetType]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/assets/approved/${assetType}`);
      if (!response.ok) throw new Error('Failed to fetch assets');
      const data = await response.json();
      setAssets(data.data || data.assets || []);
    } catch (err) {
      console.error('Error fetching assets:', err);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingAssets = async () => {
    try {
      const response = await fetch('/api/v1/assets/pending');
      if (response.ok) {
        const data = await response.json();
        setPendingAssets(data.data || data.assets || []);
      }
    } catch (err) {
      console.error('Error fetching pending assets:', err);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError(null);
  };

  const handleAssetTypeChange = (e) => {
    setAssetType(e.target.value);
    setAssets([]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      if (metadata && metadata.trim()) {
        try {
          JSON.parse(metadata);
        } catch (parseErr) {
          setError('Invalid JSON in metadata');
          setLoading(false);
          return;
        }
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('assetType', assetType);
      if (metadata && metadata.trim()) {
        formData.append('metadata', metadata);
      }

      const response = await fetch('/api/v1/assets', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Upload failed');
      }

      const data = await response.json();
      setSuccess(`✅ Asset uploaded successfully! Processing background removal...`);
      setFile(null);
      setMetadata('');

      await fetchPendingAssets();
      await fetchAssets();
      document.getElementById('assetForm')?.reset();
    } catch (err) {
      console.error('Error uploading asset:', err);
      setError(err.message || 'Failed to upload asset');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessBackground = async (assetId) => {
    if (!window.confirm('Process background removal with Runway ML?\n\nThis will use Runway API credits.')) {
      return;
    }

    try {
      setProcessingId(assetId);
      setError(null);

      const response = await fetch(`/api/v1/assets/${assetId}/process`, {
        method: 'PUT',
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Processing failed');
      }

      const data = await response.json();
      setSuccess(`✅ Asset processed and approved! Ready for use in compositions.`);
      await fetchPendingAssets();
      await fetchAssets();
    } catch (err) {
      console.error('Error processing asset:', err);
      setError(err.message || 'Failed to process asset');
    } finally {
      setProcessingId(null);
    }
  };

  const getImageUrl = (asset) => {
    if (asset.s3_url_processed) return asset.s3_url_processed;
    if (asset.s3_url_raw) return asset.s3_url_raw;
    
    if (asset.s3_key_raw) {
      const bucket = process.env.REACT_APP_S3_PRIMARY_BUCKET || 'episode-metadata-dev';
      
      if (process.env.REACT_APP_USE_LOCALSTACK === 'true') {
        const endpoint = process.env.REACT_APP_AWS_ENDPOINT || 'http://localhost:4566';
        return `${endpoint}/${bucket}/${asset.s3_key_raw}`;
      }
      
      const region = process.env.REACT_APP_AWS_REGION || 'us-east-1';
      return `https://${bucket}.s3.${region}.amazonaws.com/${asset.s3_key_raw}`;
    }
    
    return null;
  };

  const AssetCard = ({ asset, isPending = false }) => {
    const [imageError, setImageError] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    const imageUrl = getImageUrl(asset);

    return (
      <div className="asset-card">
        <div className="asset-preview">
          {imageLoading && !imageError && (
            <div className="asset-loading">
              <div className="spinner"></div>
              <span>Loading...</span>
            </div>
          )}

          {imageError && (
            <div className="asset-error">
              <span>⚠️</span>
              <span>Failed to load</span>
            </div>
          )}

          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={asset.asset_type}
              onLoad={() => {
                setImageLoading(false);
                setImageError(false);
              }}
              onError={(e) => {
                // Suppress console error for missing S3 assets - they don't have valid keys
                setImageError(true);
                setImageLoading(false);
              }}
              style={{ 
                display: imageLoading ? 'none' : 'block',
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          ) : (
            !imageLoading && (
              <div className="asset-placeholder">
                <span style={{ fontSize: '2rem' }}>🖼️</span>
                <span style={{ fontSize: '0.8rem' }}>No Preview</span>
              </div>
            )
          )}

          <div className="asset-status-badge">
            {isPending ? '⏳ PENDING' : '✅ APPROVED'}
          </div>
        </div>

        <div className="asset-info">
          <p className="asset-type">{asset.asset_type}</p>
          <p className="asset-id" title={asset.id}>
            ID: {asset.id.substring(0, 8)}...
          </p>
          
          {asset.file_size_bytes && (
            <small className="asset-size">
              {(asset.file_size_bytes / 1024).toFixed(0)} KB
            </small>
          )}

          {isPending && (
            <button
              onClick={() => handleProcessBackground(asset.id)}
              disabled={processingId === asset.id}
              className="btn-process"
            >
              {processingId === asset.id ? (
                <>
                  <span className="spinner-sm"></span>
                  Processing...
                </>
              ) : (
                '🎨 Process Background'
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  const currentAssetTypeLabel = assetTypes.find(t => t.value === assetType)?.label || assetType;

  return (
    <div className="asset-manager">
      <div className="asset-manager-container">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1>📸 Asset Manager</h1>
            <p className="subtitle">Upload and manage promotional assets with AI background removal</p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="upload-section">
          <div className="section-header-inline">
            <h2>📤 Upload New Asset</h2>
          </div>

          <form id="assetForm" onSubmit={handleUpload} className="upload-form-compact">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="assetType">Asset Type</label>
                <select
                  id="assetType"
                  value={assetType}
                  onChange={handleAssetTypeChange}
                  required
                >
                  {assetTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group form-group-file">
                <label htmlFor="file">Image File (PNG, JPG)</label>
                <div className="file-input-wrapper">
                  <input
                    id="file"
                    type="file"
                    onChange={handleFileChange}
                    accept="image/*"
                    required
                  />
                  {file && (
                    <div className="file-selected">
                      ✅ {file.name}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group-action">
                <button type="submit" disabled={loading || !file} className="btn-upload">
                  {loading ? (
                    <>
                      <span className="spinner-sm"></span>
                      Uploading...
                    </>
                  ) : (
                    <>
                      📤 Upload Asset
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="form-row-metadata">
              <div className="form-group">
                <label htmlFor="metadata">
                  Metadata (Optional JSON)
                  <span className="label-hint">e.g., {"{"}"description": "Lala winter promo"{"}"}</span>
                </label>
                <textarea
                  id="metadata"
                  value={metadata}
                  onChange={(e) => setMetadata(e.target.value)}
                  placeholder='{"description": "Asset description", "tags": ["tag1", "tag2"]}'
                  rows={2}
                />
              </div>
            </div>
          </form>

          {error && (
            <div className="alert alert-error">
              <span className="alert-icon">❌</span>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="alert alert-success">
              <span className="alert-icon">✅</span>
              <span>{success}</span>
            </div>
          )}
        </div>

        {/* Assets Grid */}
        <div className="assets-section">
          <div className="section-header-inline">
            <h2>
              {showPending ? '⏳ Pending Assets' : `✅ ${currentAssetTypeLabel}`}
              {showPending && pendingAssets.length > 0 && (
                <span className="badge">{pendingAssets.length}</span>
              )}
              {!showPending && assets.length > 0 && (
                <span className="badge badge-success">{assets.length}</span>
              )}
            </h2>
            
            <div className="section-actions">
              <button 
                onClick={() => {
                  setShowPending(!showPending);
                  setError(null);
                  setSuccess(null);
                }} 
                className="btn-toggle"
              >
                {showPending ? (
                  <>✅ View Approved</>
                ) : (
                  <>
                    ⏳ View Pending
                    {pendingAssets.length > 0 && (
                      <span className="btn-badge">{pendingAssets.length}</span>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>

          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading assets...</p>
            </div>
          )}

          {!loading && (
            <>
              {showPending ? (
                pendingAssets.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">✨</span>
                    <h3>No Pending Assets</h3>
                    <p>All uploaded assets have been processed</p>
                  </div>
                ) : (
                  <div className="assets-grid">
                    {pendingAssets.map(asset => (
                      <AssetCard key={asset.id} asset={asset} isPending={true} />
                    ))}
                  </div>
                )
              ) : (
                assets.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">📦</span>
                    <h3>No Assets Yet</h3>
                    <p>Upload your first {currentAssetTypeLabel.toLowerCase()} asset to get started</p>
                    <small>Assets will appear here after background removal processing</small>
                  </div>
                ) : (
                  <div className="assets-grid">
                    {assets.map(asset => (
                      <AssetCard key={asset.id} asset={asset} isPending={false} />
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetManager;