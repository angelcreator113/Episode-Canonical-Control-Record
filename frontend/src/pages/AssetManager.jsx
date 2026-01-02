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

  const assetTypes = ['PROMO_LALA', 'PROMO_GUEST', 'BRAND_LOGO', 'EPISODE_FRAME'];

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
      setAssets(data.data || []);
    } catch (err) {
      console.error('Error fetching assets:', err);
      setError('Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingAssets = async () => {
    try {
      const response = await fetch('/api/v1/assets/pending', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPendingAssets(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching pending assets:', err);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
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

      const formData = new FormData();
      formData.append('file', file);
      formData.append('assetType', assetType);
      if (metadata) {
        formData.append('metadata', metadata);
      }

      const response = await fetch('/api/v1/assets/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Upload failed');
      }

      const data = await response.json();
      setSuccess(`Asset uploaded! Pending background removal processing.`);
      setFile(null);
      setMetadata('');

      // Reload assets and pending
      await fetchPendingAssets();
      document.getElementById('assetForm')?.reset();
    } catch (err) {
      console.error('Error uploading asset:', err);
      setError(err.message || 'Failed to upload asset');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessBackground = async (assetId) => {
    if (!window.confirm('Process background removal with Runway ML?')) {
      return;
    }

    try {
      setProcessingId(assetId);
      setError(null);

      const response = await fetch(`/api/v1/assets/${assetId}/process`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Processing failed');
      }

      const data = await response.json();
      setSuccess(`Asset processed and approved! Ready for compositions.`);
      await fetchPendingAssets();
      await fetchAssets();
    } catch (err) {
      console.error('Error processing asset:', err);
      setError(err.message || 'Failed to process asset');
    } finally {
      setProcessingId(null);
    }
  };


  return (
    <div className="asset-manager">
      <div className="asset-manager-container">
        <h1>📸 Asset Manager</h1>
        <p className="subtitle">Upload promotional assets for composite thumbnails</p>

        {/* Upload Form */}
        <div className="upload-section">
          <h2>Upload New Asset</h2>
          <form id="assetForm" onSubmit={handleUpload} className="upload-form">
            <div className="form-group">
              <label htmlFor="assetType">Asset Type</label>
              <select
                id="assetType"
                value={assetType}
                onChange={handleAssetTypeChange}
                required
              >
                {assetTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="file">Image File</label>
              <input
                id="file"
                type="file"
                onChange={handleFileChange}
                accept="image/*"
                required
              />
              {file && <p className="file-selected">Selected: {file.name}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="metadata">Metadata (JSON, optional)</label>
              <textarea
                id="metadata"
                value={metadata}
                onChange={(e) => setMetadata(e.target.value)}
                placeholder='{"description": "Lala promo image"}'
                rows={3}
              />
            </div>

            <button type="submit" disabled={loading} className="btn-upload">
              {loading ? '⏳ Uploading...' : '📤 Upload Asset'}
            </button>
          </form>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
        </div>

        {/* Assets List */}
        <div className="assets-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>Assets ({showPending ? 'Pending' : 'Approved'})</h2>
            <button
              onClick={() => setShowPending(!showPending)}
              className="btn-refresh"
              style={{ background: showPending ? '#667eea' : 'white', color: showPending ? 'white' : '#667eea' }}
            >
              {showPending ? '✅ Approved Assets' : '⏳ Pending Assets'}
              {pendingAssets.length > 0 && ` (${pendingAssets.length})`}
            </button>
          </div>

          {loading && <p className="loading">Loading assets...</p>}

          {showPending ? (
            // Pending Assets
            pendingAssets.length === 0 ? (
              <div className="empty-state">
                <p>No pending assets</p>
                <small>All assets have been processed or approved</small>
              </div>
            ) : (
              <div className="assets-grid">
                {pendingAssets.map(asset => (
                  <div key={asset.id} className="asset-card" style={{ position: 'relative' }}>
                    <div className="asset-preview">
                      {asset.s3_url && (
                        <img
                          src={asset.s3_url}
                          alt={asset.asset_type}
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/150?text=Image';
                          }}
                        />
                      )}
                    </div>
                    <div className="asset-info">
                      <p className="asset-id" title={asset.id}>{asset.id.substring(0, 8)}...</p>
                      <p className="asset-type">{asset.asset_type}</p>
                      <p className="asset-status" style={{ color: '#f59e0b' }}>⏳ PENDING</p>
                      <button
                        onClick={() => handleProcessBackground(asset.id)}
                        disabled={processingId === asset.id}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          marginTop: '0.5rem',
                          background: '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                        }}
                      >
                        {processingId === asset.id ? '🎨 Processing...' : '🎨 Process Background'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // Approved Assets
            assets.length === 0 ? (
              <div className="empty-state">
                <p>No approved assets found for {assetType}</p>
                <small>Upload an asset and process it with Runway ML to use here</small>
              </div>
            ) : (
              <div className="assets-grid">
                {assets.map(asset => (
                  <div key={asset.id} className="asset-card">
                    <div className="asset-preview">
                      {asset.s3_url && (
                        <img
                          src={asset.s3_url}
                          alt={asset.asset_type}
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/150?text=Image';
                          }}
                        />
                      )}
                    </div>
                    <div className="asset-info">
                      <p className="asset-id" title={asset.id}>{asset.id.substring(0, 8)}...</p>
                      <p className="asset-type">{asset.asset_type}</p>
                      <p className="asset-status">✅ APPROVED</p>
                      <small className="asset-size">
                        {asset.file_size_bytes ? `${(asset.file_size_bytes / 1024).toFixed(0)}KB` : 'N/A'}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetManager;
