/**
 * AssetManager Component - Enhanced
 * Upload and manage images/videos with labels, bulk operations, and search
 */

import React, { useState, useEffect, useRef } from 'react';
import AssetCard from '../components/AssetCard';
import AssetPreviewModal from '../components/AssetPreviewModal';
import assetService from '../services/assetService';
import './AssetManager.css';

const AssetManager = () => {
  // Asset state
  const [assets, setAssets] = useState([]);
  const [allLabels, setAllLabels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Upload state
  const [files, setFiles] = useState([]);
  const [assetType, setAssetType] = useState('PROMO_LALA');
  const [metadata, setMetadata] = useState('');
  const [description, setDescription] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMediaType, setFilterMediaType] = useState('all');
  const [filterLabels, setFilterLabels] = useState([]);
  const [sortBy, setSortBy] = useState('created_at');

  // Bulk operation state
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const [previewAsset, setPreviewAsset] = useState(null);

  const fileInputRef = useRef(null);

  const assetTypes = [
    { value: 'PROMO_LALA', label: '👩 Lala Promo', bgRecommended: true },
    { value: 'PROMO_JUSTAWOMANINHERPRIME', label: '💜 JustAWoman Promo', bgRecommended: true },
    { value: 'PROMO_GUEST', label: '👤 Guest Promo', bgRecommended: true },
    { value: 'BRAND_LOGO', label: '🏷️ Brand Logo', bgRecommended: false },
    { value: 'EPISODE_FRAME', label: '🖼️ Episode Frame', bgRecommended: false },
    { value: 'PROMO_VIDEO', label: '🎥 Promo Video', bgRecommended: false },
    { value: 'EPISODE_VIDEO', label: '📹 Episode Video', bgRecommended: false },
    { value: 'BACKGROUND_VIDEO', label: '🌄 Background Video', bgRecommended: false },
  ];

  // Load data
  useEffect(() => {
    loadAssets();
    loadLabels();
  }, []);

  const loadAssets = async (force = false) => {
    try {
      setLoading(true);
      // Add timestamp to force fresh data
      const timestamp = force ? `&_t=${Date.now()}` : '';
      const response = await assetService.searchAssets({
        query: searchQuery,
        assetType: assetType === 'ALL' ? null : assetType,
        mediaType: filterMediaType === 'all' ? null : filterMediaType,
        labelIds: filterLabels,
        sortBy: sortBy,
        sortOrder: 'DESC',
      });
      console.log('Loaded assets:', response.data.data?.length || 0);
      setAssets(response.data.data || []);
    } catch (err) {
      console.error('Error loading assets:', err);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLabels = async () => {
    try {
      const response = await assetService.getAllLabels();
      setAllLabels(response.data.data || []);
    } catch (err) {
      console.error('Error loading labels:', err);
    }
  };

  // Upload handlers
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setError(null);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      setFiles(droppedFiles);
      setError(null);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Please select at least one file');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setUploadProgress({});

      let successCount = 0;
      let failCount = 0;

      // Upload each file sequentially
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(prev => ({ ...prev, [file.name]: 'uploading' }));

        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('assetType', assetType);
          
          if (description) {
            const meta = { description };
            if (metadata) {
              try {
                Object.assign(meta, JSON.parse(metadata));
              } catch {}
            }
            formData.append('metadata', JSON.stringify(meta));
          } else if (metadata) {
            formData.append('metadata', metadata);
          }

          await assetService.uploadAsset(formData);
          setUploadProgress(prev => ({ ...prev, [file.name]: 'success' }));
          successCount++;
        } catch (err) {
          console.error(`Upload error for ${file.name}:`, err);
          setUploadProgress(prev => ({ ...prev, [file.name]: 'error' }));
          failCount++;
        }
      }

      if (successCount > 0) {
        setSuccess(`✅ Uploaded ${successCount} asset${successCount > 1 ? 's' : ''} successfully!${failCount > 0 ? ` (${failCount} failed)` : ''}`);
      } else {
        setError(`❌ All ${failCount} uploads failed`);
      }
      
      setFiles([]);
      setMetadata('');
      setDescription('');
      setUploadProgress({});
      document.getElementById('assetForm')?.reset();
      
      setTimeout(() => loadAssets(), 1000);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload assets');
    } finally {
      setLoading(false);
    }
  };

  // Bulk operation handlers
  const handleSelectAsset = (assetId, selected) => {
    setSelectedAssets(prev =>
      selected ? [...prev, assetId] : prev.filter(id => id !== assetId)
    );
  };

  const handleSelectAll = () => {
    if (selectedAssets.length === assets.length) {
      setSelectedAssets([]);
    } else {
      setSelectedAssets(assets.map(a => a.id));
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedAssets.length} assets? This cannot be undone.`)) return;

    setBulkProcessing(true);
    try {
      await assetService.bulkDelete(selectedAssets);
      setSuccess(`✅ Deleted ${selectedAssets.length} assets`);
      setSelectedAssets([]);
      loadAssets();
    } catch (err) {
      setError('Bulk delete failed');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkProcessBackground = async () => {
    if (!confirm(`Process background removal for ${selectedAssets.length} assets? This will use API credits.`)) return;

    setBulkProcessing(true);
    try {
      const result = await assetService.bulkProcessBackground(selectedAssets);
      setSuccess(`✅ Processed ${result.data.succeeded} assets successfully`);
      setSelectedAssets([]);
      loadAssets();
    } catch (err) {
      setError('Bulk processing failed');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkAddLabel = async (labelId) => {
    setBulkProcessing(true);
    try {
      await assetService.bulkAddLabels(selectedAssets, [labelId]);
      setSuccess(`✅ Added label to ${selectedAssets.length} assets`);
      setSelectedAssets([]);
      loadAssets();
    } catch (err) {
      setError('Failed to add labels');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkDownload = async () => {
    if (selectedAssets.length === 0) return;
    
    setBulkProcessing(true);
    try {
      setSuccess(`📥 Downloading ${selectedAssets.length} assets...`);
      
      for (const assetId of selectedAssets) {
        const asset = assets.find(a => a.id === assetId);
        if (!asset || asset.s3_url_raw?.includes('mock-s3.dev')) continue;
        
        try {
          const response = await fetch(asset.s3_url_raw);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = asset.name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          // Small delay between downloads
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
          console.error(`Failed to download ${asset.name}:`, err);
        }
      }
      
      setSuccess(`✅ Downloaded ${selectedAssets.length} assets`);
      setSelectedAssets([]);
    } catch (err) {
      setError('Bulk download failed');
    } finally {
      setBulkProcessing(false);
    }
  };

  // Filter handlers
  const handleSearch = (e) => {
    e.preventDefault();
    loadAssets();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setAssetType('PROMO_LALA');
    setFilterMediaType('all');
    setFilterLabels([]);
    setSortBy('created_at');
  };

  const currentAssetTypeLabel = assetTypes.find(t => t.value === assetType)?.label || 'Assets';

  return (
    <div className="asset-manager">
      <div className="asset-manager-container">
        {/* Header */}
        <div className="asset-manager-header">
          <div>
            <h1>📸 Asset Manager</h1>
            <p>Upload and manage images & videos with labels and bulk operations</p>
          </div>

          <div className="header-stats">
            <div className="stat-card">
              <div className="stat-label">Total Assets</div>
              <div className="stat-value">{assets.length}</div>
            </div>
            {selectedAssets.length > 0 && (
              <div className="stat-card selected">
                <div className="stat-label">Selected</div>
                <div className="stat-value">{selectedAssets.length}</div>
              </div>
            )}
          </div>
        </div>

        {/* Upload Section */}
        <div className="upload-section">
          <h2>📤 Upload New Asset</h2>

          <form id="assetForm" onSubmit={handleUpload} className="upload-form">
            {/* Drag & Drop Zone */}
            <div
              className={`dropzone ${dragActive ? 'active' : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                id="file"
                onChange={handleFileChange}
                accept="image/*,video/*"
                multiple
                hidden
              />
              
              {files.length > 0 ? (
                <div className="dropzone-files">
                  <div className="files-header">
                    <strong>{files.length} file{files.length > 1 ? 's' : ''} selected</strong>
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); setFiles([]); }}
                      className="btn-clear-files"
                    >
                      ✕ Clear
                    </button>
                  </div>
                  <div className="files-list">
                    {files.map((file, idx) => {
                      const isVideo = file.type.startsWith('video/');
                      const status = uploadProgress[file.name];
                      return (
                        <div key={idx} className={`file-item ${status || ''}`}>
                          <span className="file-icon">{isVideo ? '🎥' : '🖼️'}</span>
                          <div className="file-info">
                            <div className="file-name">{file.name}</div>
                            <div className="file-size">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </div>
                          </div>
                          {status === 'uploading' && <span className="spinner-sm"></span>}
                          {status === 'success' && <span>✅</span>}
                          {status === 'error' && <span>❌</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  <div className="dropzone-icon">📁</div>
                  <div className="dropzone-text">
                    <strong>Click to browse</strong> or drag and drop
                  </div>
                  <div className="dropzone-hint">
                    Images (JPG, PNG, GIF, WebP) or Videos (MP4, MOV, WebM)
                  </div>
                </>
              )}
            </div>

            {/* Form Fields */}
            <div className="form-grid">
              <div className="form-field">
                <label>Asset Type *</label>
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  required
                >
                  {assetTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the asset"
                />
              </div>
            </div>

            {/* Advanced Metadata */}
            <details className="metadata-details">
              <summary>Advanced Metadata (JSON)</summary>
              <textarea
                value={metadata}
                onChange={(e) => setMetadata(e.target.value)}
                placeholder='{"key": "value"}'
                rows="3"
              />
            </details>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || files.length === 0}
              className="btn-upload"
            >
              {loading ? (
                <>
                  <span className="spinner-sm"></span>
                  <span>Uploading {files.length} file{files.length > 1 ? 's' : ''}...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Upload {files.length > 0 ? `${files.length} ` : ''}Asset{files.length > 1 ? 's' : ''}</span>
                </>
              )}
            </button>
          </form>

          {/* Alerts */}
          {error && (
            <div className="alert alert-error">
              <span>❌</span>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="alert alert-success">
              <span>✅</span>
              <span>{success}</span>
            </div>
          )}
        </div>

        {/* Filters & Search */}
        <div className="filters-section">
          <form onSubmit={handleSearch} className="filters-form">
            <input
              type="text"
              placeholder="🔍 Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />

            <select
              value={filterMediaType}
              onChange={(e) => {
                setFilterMediaType(e.target.value);
                loadAssets();
              }}
            >
              <option value="all">All Media Types</option>
              <option value="image">🖼️ Images Only</option>
              <option value="video">🎥 Videos Only</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                loadAssets();
              }}
            >
              <option value="created_at">Newest First</option>
              <option value="name">Name A-Z</option>
              <option value="file_size_bytes">Largest First</option>
            </select>

            <button type="submit" className="btn-filter">
              Search
            </button>

            {(searchQuery || filterMediaType !== 'all' || filterLabels.length > 0) && (
              <button type="button" onClick={clearFilters} className="btn-clear">
                Clear
              </button>
            )}
          </form>

          {/* Label Filters */}
          <div className="label-filters">
            {allLabels.map(label => (
              <button
                key={label.id}
                className={`label-filter ${filterLabels.includes(label.id) ? 'active' : ''}`}
                style={{
                  '--label-color': label.color,
                  background: filterLabels.includes(label.id) ? label.color : 'transparent',
                  color: filterLabels.includes(label.id) ? 'white' : label.color,
                }}
                onClick={() => {
                  setFilterLabels(prev =>
                    prev.includes(label.id)
                      ? prev.filter(id => id !== label.id)
                      : [...prev, label.id]
                  );
                  setTimeout(loadAssets, 100);
                }}
              >
                {label.name}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedAssets.length > 0 && (
          <div className="bulk-actions-bar">
            <div className="bulk-info">
              <input
                type="checkbox"
                checked={selectedAssets.length === assets.length}
                onChange={handleSelectAll}
              />
              <span>{selectedAssets.length} selected</span>
            </div>

            <div className="bulk-buttons">
              <button
                onClick={handleBulkDownload}
                disabled={bulkProcessing}
                className="btn-bulk"
              >
                📥 Download
              </button>

              <button
                onClick={handleBulkProcessBackground}
                disabled={bulkProcessing}
                className="btn-bulk"
              >
                🎨 Remove BG
              </button>

              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkAddLabel(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="bulk-label-select"
                disabled={bulkProcessing}
              >
                <option value="">+ Add Label...</option>
                {allLabels.map(label => (
                  <option key={label.id} value={label.id}>
                    {label.name}
                  </option>
                ))}
              </select>

              <button
                onClick={handleBulkDelete}
                disabled={bulkProcessing}
                className="btn-bulk btn-danger"
              >
                🗑️ Delete
              </button>

              <button
                onClick={() => setSelectedAssets([])}
                className="btn-bulk"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Assets Grid/List */}
        <div className="assets-section">
          <div className="assets-header">
            <h2>
              {currentAssetTypeLabel}
              <span className="asset-count">{assets.length}</span>
            </h2>

            <div className="view-toggle">
              <button
                className={viewMode === 'grid' ? 'active' : ''}
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                ⊞
              </button>
              <button
                className={viewMode === 'list' ? 'active' : ''}
                onClick={() => setViewMode('list')}
                title="List view"
              >
                ☰
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading assets...</p>
            </div>
          ) : assets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <h3>No Assets Found</h3>
              <p>Upload your first asset to get started</p>
            </div>
          ) : (
            <div className={`assets-grid ${viewMode}`}>
              {assets.map(asset => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onRefresh={() => loadAssets(true)}
                  onSelect={handleSelectAsset}
                  isSelected={selectedAssets.includes(asset.id)}
                  showSelection={true}
                  showActions={true}
                  onPreview={setPreviewAsset}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewAsset && (
        <AssetPreviewModal
          asset={previewAsset}
          allAssets={assets}
          onClose={() => setPreviewAsset(null)}
          onRefresh={() => loadAssets(true)}
          onNavigate={(asset) => setPreviewAsset(asset)}
        />
      )}
    </div>
  );
};

export default AssetManager;
