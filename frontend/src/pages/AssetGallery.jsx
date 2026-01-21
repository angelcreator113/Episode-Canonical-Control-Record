import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './AssetGallery.css';

const AssetGallery = () => {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState('ALL');
  const [previewAsset, setPreviewAsset] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState('newest');
  const [viewSize, setViewSize] = useState('medium');
  const [selectedAssets, setSelectedAssets] = useState(new Set());
  const [renamingAsset, setRenamingAsset] = useState(null);
  const [newName, setNewName] = useState('');
  const [showProcessed, setShowProcessed] = useState(true);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/v1/assets', {
        params: { 
          limit: 500,
          approval_status: 'APPROVED'
        }
      });
      setAssets(response.data.data || []);
    } catch (err) {
      console.error('Failed to load assets:', err);
      setError('Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = [...e.dataTransfer.files];
    if (files.length > 0) {
      handleUpload(files);
    }
  };

  const handleFileSelect = (e) => {
    const files = [...e.target.files];
    if (files.length > 0) {
      handleUpload(files);
    }
  };

  const handleUpload = async (files) => {
    try {
      setUploading(true);
      setError(null);
      
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('assetType', 'PROMO_LALA');
        
        await api.post('/api/v1/assets', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      
      setSuccess(`✅ Uploaded ${files.length} asset(s)!`);
      setTimeout(() => setSuccess(null), 3000);
      loadAssets();
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (assetId) => {
    if (!confirm('Delete this asset? This cannot be undone.')) return;
    
    try {
      await api.delete(`/api/v1/assets/${assetId}`);
      setSuccess('✅ Asset deleted');
      setTimeout(() => setSuccess(null), 2000);
      loadAssets();
    } catch (err) {
      setError('Failed to delete asset');
    }
  };

  const handleCopyUrl = (asset) => {
    navigator.clipboard.writeText(asset.s3_url_processed || asset.s3_url_raw);
    setSuccess('✅ URL copied!');
    setTimeout(() => setSuccess(null), 2000);
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = !searchQuery || 
      asset.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.asset_type?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesGroup = filterGroup === 'ALL' || asset.asset_group === filterGroup;
    
    return matchesSearch && matchesGroup;
  });

  // Sort assets
  const sortedAssets = [...filteredAssets].sort((a, b) => {
    switch(sortBy) {
      case 'newest':
        return new Date(b.created_at) - new Date(a.created_at);
      case 'oldest':
        return new Date(a.created_at) - new Date(b.created_at);
      case 'name-asc':
        return (a.name || '').localeCompare(b.name || '');
      case 'name-desc':
        return (b.name || '').localeCompare(a.name || '');
      default:
        return 0;
    }
  });

  // Pagination
  const totalPages = Math.ceil(sortedAssets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAssets = sortedAssets.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterGroup, sortBy]);

  const handleSelectAsset = (assetId) => {
    setSelectedAssets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assetId)) {
        newSet.delete(assetId);
      } else {
        newSet.add(assetId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedAssets.size === paginatedAssets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(paginatedAssets.map(a => a.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedAssets.size} assets?`)) return;
    try {
      await Promise.all([...selectedAssets].map(id => api.delete(`/api/v1/assets/${id}`)));
      setSuccess(`✅ Deleted ${selectedAssets.size} assets`);
      setSelectedAssets(new Set());
      loadAssets();
    } catch (err) {
      setError('Failed to delete assets');
    }
  };

  const handleRenameStart = (asset) => {
    setRenamingAsset(asset.id);
    setNewName(asset.name);
  };

  const handleRenameCancel = () => {
    setRenamingAsset(null);
    setNewName('');
  };

  const handleRenameSave = async (assetId) => {
    if (!newName.trim()) {
      setError('Name cannot be empty');
      return;
    }
    try {
      await api.put(`/api/v1/assets/${assetId}`, { name: newName.trim() });
      setSuccess('✅ Asset renamed!');
      setRenamingAsset(null);
      setNewName('');
      loadAssets();
    } catch (err) {
      setError('Failed to rename asset');
    }
  };

  const getImageSrc = (asset) => {
    const url = asset.s3_url_processed || asset.s3_url_raw;
    if (!url || url.includes('mock-s3.dev') || url.includes('undefined')) {
      const typeLabel = asset.asset_type?.replace(/_/g, ' ') || 'Asset';
      const mediaIcon = asset.media_type === 'video' ? '🎥' : '🖼️';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#6366f1"/><text x="50%" y="45%" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">${typeLabel}</text><text x="50%" y="60%" font-family="Arial, sans-serif" font-size="32" fill="rgba(255,255,255,0.7)" text-anchor="middle" dominant-baseline="middle">${mediaIcon}</text></svg>`;
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }
    return url;
  };

  return (
    <div className="asset-gallery">
      {/* Header */}
      <div className="gallery-header">
        <div className="header-content">
          <div className="title-row">
            <button onClick={() => navigate(-1)} className="back-button" title="Go back">
              ← Back
            </button>
            <h1>📸 Asset Gallery</h1>
          </div>
          <div className="stats">
            <span className="stat-item">📊 {sortedAssets.length} total</span>
            <span className="stat-item">📄 Page {currentPage} of {totalPages}</span>
            <span className="stat-item">🎥 {assets.filter(a => a.media_type === 'video').length} videos</span>
            <span className="stat-item">🖼️ {assets.filter(a => a.media_type === 'image').length} images</span>
            {selectedAssets.size > 0 && (
              <span className="stat-item selected">✅ {selectedAssets.size} selected</span>
            )}
          </div>
        </div>

        {/* Search & Filters */}
        <div className="gallery-controls">
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filter-chips">
            {['ALL', 'LALA', 'SHOW', 'GUEST', 'EPISODE', 'WARDROBE'].map(group => (
              <button
                key={group}
                className={`filter-chip ${filterGroup === group ? 'active' : ''}`}
                onClick={() => setFilterGroup(group)}
              >
                {group === 'ALL' ? '🗂️ All' : group}
              </button>
            ))}
          </div>
          <select 
            className="sort-dropdown"
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">🕒 Newest First</option>
            <option value="oldest">🕐 Oldest First</option>
            <option value="name-asc">🔤 Name A-Z</option>
            <option value="name-desc">🔤 Name Z-A</option>
          </select>

          <select 
            className="view-dropdown"
            value={viewSize} 
            onChange={(e) => setViewSize(e.target.value)}
          >
            <option value="small">⚫ Small</option>
            <option value="medium">🔵 Medium</option>
            <option value="large">🟢 Large</option>
          </select>

          {selectedAssets.size > 0 && (
            <button className="bulk-delete-button" onClick={handleBulkDelete}>
              🗑️ Delete ({selectedAssets.size})
            </button>
          )}
          <button
            className="upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? '⏳ Uploading...' : '📤 Upload'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && <div className="toast success">{success}</div>}
      {error && <div className="toast error">{error}</div>}

      {/* Drag & Drop Zone */}
      <div
        className={`drop-zone ${dragActive ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="drop-content">
          <div className="drop-icon">📁</div>
          <p>Drop images or videos anywhere to upload</p>
        </div>
      </div>

      {/* Gallery Grid */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading assets...</p>
        </div>
      ) : (
        <div className={`gallery-grid view-${viewSize}`}>
          {paginatedAssets.map(asset => (
            <div key={asset.id} className="gallery-card">
              <input
                type="checkbox"
                className="asset-checkbox"
                checked={selectedAssets.has(asset.id)}
                onChange={() => handleSelectAsset(asset.id)}
                onClick={(e) => e.stopPropagation()}
              />
              {/* Image */}
              <div 
                className="card-image"
                onClick={() => setPreviewAsset(asset)}
              >
                {asset.media_type === 'video' ? (
                  <video
                    src={asset.s3_url_processed || asset.s3_url_raw}
                    className="video-thumbnail"
                    muted
                    playsInline
                    onMouseEnter={(e) => e.target.play()}
                    onMouseLeave={(e) => {
                      e.target.pause();
                      e.target.currentTime = 0;
                    }}
                  />
                ) : (
                  <img
                    src={getImageSrc(asset)}
                    alt={asset.name}
                    onError={(e) => {
                      const typeLabel = asset.asset_type?.replace(/_/g, ' ') || 'Asset';
                      const mediaIcon = asset.media_type === 'video' ? '🎥' : '🖼️';
                      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#6366f1"/><text x="50%" y="45%" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">${typeLabel}</text><text x="50%" y="60%" font-family="Arial, sans-serif" font-size="32" fill="rgba(255,255,255,0.7)" text-anchor="middle" dominant-baseline="middle">${mediaIcon}</text></svg>`;
                      e.target.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
                    }}
                  />
                )}
                
                {/* Video Badge */}
                {asset.media_type === 'video' && (
                  <div className="video-badge">
                    <span>🎥 VIDEO</span>
                  </div>
                )}
                
                {/* Hover Overlay */}
                <div className="card-overlay">
                  <div className="overlay-actions">
                    <button
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyUrl(asset);
                      }}
                      title="Copy URL"
                    >
                      📋
                    </button>
                    <button
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(asset.s3_url_processed || asset.s3_url_raw, '_blank');
                      }}
                      title="Open in new tab"
                    >
                      🔗
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(asset.id);
                      }}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>

              {/* Card Info */}
              <div className="card-info">
                <div className="card-badges">
                  {asset.asset_group && (
                    <span className={`badge group-${asset.asset_group.toLowerCase()}`}>
                      {asset.asset_group}
                    </span>
                  )}
                  {asset.is_global && (
                    <span className="badge global">🌐 Global</span>
                  )}
                </div>
                {renamingAsset === asset.id ? (
                  <div className="rename-input-group">
                    <input
                      type="text"
                      className="rename-input"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSave(asset.id);
                        if (e.key === 'Escape') handleRenameCancel();
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button 
                      className="rename-save-btn" 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleRenameSave(asset.id); 
                      }}
                    >
                      ✓
                    </button>
                    <button 
                      className="rename-cancel-btn" 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleRenameCancel(); 
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <h3 className="card-title">
                    <span className="card-title-text">{asset.name}</span>
                    <button 
                      className="rename-icon-btn" 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleRenameStart(asset); 
                      }}
                      title="Rename asset"
                    >
                      ✏️
                    </button>
                  </h3>
                )}
                <div className="card-meta">
                  <span>{asset.width}×{asset.height}</span>
                  <span>{(asset.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Preview */}
      {previewAsset && (
        <div className="lightbox" onClick={() => setPreviewAsset(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setPreviewAsset(null)}>✕</button>
            
            {/* Version Toggle */}
            {previewAsset.s3_url_processed && (
              <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 10, display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setShowProcessed(true)}
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
                  onClick={() => setShowProcessed(false)}
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
            />
            <div className="lightbox-info">
              <h2>{previewAsset.name}</h2>
              <div className="lightbox-badges">
                {previewAsset.asset_group && (
                  <span className={`badge group-${previewAsset.asset_group.toLowerCase()}`}>
                    {previewAsset.asset_group}
                  </span>
                )}
                {previewAsset.purpose && (
                  <span className="badge purpose">{previewAsset.purpose}</span>
                )}
                {previewAsset.is_global && (
                  <span className="badge global">🌐 Global</span>
                )}
              </div>
              {previewAsset.allowed_uses && previewAsset.allowed_uses.length > 0 && (
                <div className="allowed-uses">
                  <small>Can be used for:</small>
                  <div className="use-tags">
                    {previewAsset.allowed_uses.map(use => (
                      <span key={use} className="use-tag">{use}</span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Download Buttons */}
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a
                  href={previewAsset.s3_url_raw}
                  download
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#10b981',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  ⬇️ Download Original
                </a>
                {previewAsset.s3_url_processed && (
                  <a
                    href={previewAsset.s3_url_processed}
                    download
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#6366f1',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    ⬇️ Download Processed
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetGallery;
