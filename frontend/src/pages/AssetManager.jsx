import React, { useState, useEffect } from 'react';
import './AssetManager.css';

/**
 * AssetManager Component
 * Minimal form for uploading and managing promotional assets
 */

const AssetManager = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [file, setFile] = useState(null);
  const [assetType, setAssetType] = useState('PROMO_LALA');
  const [metadata, setMetadata] = useState('');

  const assetTypes = ['PROMO_LALA', 'PROMO_GUEST', 'BRAND_LOGO', 'EPISODE_FRAME'];

  // Load approved assets
  useEffect(() => {
    fetchApprovedAssets();
  }, []);

  const fetchApprovedAssets = async () => {
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

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleAssetTypeChange = (e) => {
    setAssetType(e.target.value);
    setAssets([]); // Clear assets when switching type
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
      setSuccess(`Asset uploaded successfully: ${data.data.id}`);
      setFile(null);
      setMetadata('');

      // Reload assets
      await fetchApprovedAssets();

      // Clear form
      document.getElementById('assetForm')?.reset();
    } catch (err) {
      console.error('Error uploading asset:', err);
      setError(err.message || 'Failed to upload asset');
    } finally {
      setLoading(false);
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
          <h2>Approved Assets ({assetType})</h2>
          <div className="assets-filter">
            <select value={assetType} onChange={handleAssetTypeChange} className="filter-select">
              {assetTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <button onClick={fetchApprovedAssets} className="btn-refresh" disabled={loading}>
              🔄 Refresh
            </button>
          </div>

          {loading && <p className="loading">Loading assets...</p>}

          {assets.length === 0 ? (
            <div className="empty-state">
              <p>No approved assets found for {assetType}</p>
              <small>Upload an asset and have an admin approve it to use here</small>
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
                    <p className="asset-status">{asset.approval_status}</p>
                    <small className="asset-size">
                      {asset.file_size_bytes ? `${(asset.file_size_bytes / 1024).toFixed(0)}KB` : 'N/A'}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetManager;
