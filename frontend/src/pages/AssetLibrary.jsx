// frontend/src/pages/AssetLibrary.jsx - Global Asset Library Page
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { assetService } from '../services/assetService';
import showService from '../services/showService';
import AssetUploader from '../components/Assets/AssetUploader';
import './AssetLibrary.css';

const ASSET_CATEGORIES = {
  all: { icon: '📁', color: '#64748b', label: 'All Assets' },
  logos: { icon: '🎬', color: '#667eea', label: 'Logos & Branding' },
  backgrounds: { icon: '🖼️', color: '#10b981', label: 'Backgrounds' },
  intros: { icon: '🎵', color: '#f59e0b', label: 'Intros' },
  outros: { icon: '🎬', color: '#8b5cf6', label: 'Outros' },
  music: { icon: '🎵', color: '#ec4899', label: 'Music & Audio' },
  wardrobe: { icon: '👗', color: '#06b6d4', label: 'Wardrobe' },
  graphics: { icon: '✨', color: '#f59e0b', label: 'Graphics & Overlays' },
  other: { icon: '📎', color: '#94a3b8', label: 'Other' }
};

function AssetLibrary({ embedded = false }) {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [shows, setShows] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedShow, setSelectedShow] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploader, setShowUploader] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openDropdownId, setOpenDropdownId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    if (openDropdownId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdownId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assetsResponse, showsResponse] = await Promise.all([
        assetService.getAssets({}),
        showService.getAllShows()
      ]);

      const assetsArray = assetsResponse.data?.data || assetsResponse.data || [];
      const mappedAssets = assetsArray.map(asset => ({
        id: asset.id,
        name: asset.name || asset.file_name || 'Untitled Asset',
        type: asset.media_type || (asset.content_type?.startsWith('video') ? 'video' : 'image'),
        category: mapAssetTypeToCategory(asset.asset_type || asset.asset_role),
        url: asset.s3_url_raw || asset.url,
        thumbnail_url: asset.s3_url_raw || asset.metadata?.thumbnail_url,
        size: asset.file_size_bytes || 0,
        show_id: asset.show_id,
        show_name: asset.show_name || null,
        episode_id: asset.episode_id,
        asset_scope: asset.asset_scope,
        created_at: asset.created_at
      }));

      setAssets(mappedAssets);

      const showsArray = showsResponse.data || showsResponse || [];
      setShows(showsArray);
    } catch (error) {
      console.error('Error fetching assets:', error);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  const mapAssetTypeToCategory = (assetType) => {
    if (!assetType) return 'other';
    const type = assetType.toUpperCase();
    if (type.includes('LOGO') || type.includes('BRAND')) return 'logos';
    if (type.includes('BACKGROUND') || type.includes('BG')) return 'backgrounds';
    if (type.includes('INTRO')) return 'intros';
    if (type.includes('OUTRO')) return 'outros';
    if (type.includes('MUSIC') || type.includes('AUDIO')) return 'music';
    if (type.includes('WARDROBE') || type.includes('OUTFIT')) return 'wardrobe';
    if (type.includes('GRAPHIC') || type.includes('OVERLAY')) return 'graphics';
    return 'other';
  };

  const categoryToAssetType = (category) => {
    const mapping = {
      logos: 'BRAND_LOGO',
      backgrounds: 'BACKGROUND_IMAGE',
      intros: 'PROMO_VIDEO',
      outros: 'PROMO_VIDEO',
      music: 'PROMO_VIDEO',
      wardrobe: 'PROMO_LALA',
      graphics: 'EPISODE_FRAME',
      other: 'EPISODE_FRAME'
    };
    return mapping[category] || 'EPISODE_FRAME';
  };

  const filteredAssets = assets.filter(asset => {
    const matchesCategory = selectedCategory === 'all' || asset.category === selectedCategory;
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesShow = selectedShow === 'all' || asset.show_id === selectedShow;
    return matchesCategory && matchesSearch && matchesShow;
  });

  const categoryCounts = assets.reduce((acc, asset) => {
    acc[asset.category] = (acc[asset.category] || 0) + 1;
    return acc;
  }, {});

  const handleUpload = async (files, category, destination, extraMeta = {}) => {
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('assetType', categoryToAssetType(category));

        // If a show is selected, attach it
        if (selectedShow !== 'all') {
          formData.append('show_id', selectedShow);
          formData.append('metadata', JSON.stringify({
            show_id: selectedShow,
            asset_scope: 'SHOW',
            purpose: category,
            uploadedFrom: 'AssetLibrary'
          }));
        } else {
          formData.append('metadata', JSON.stringify({
            asset_scope: 'GLOBAL',
            purpose: category,
            uploadedFrom: 'AssetLibrary'
          }));
        }

        // Append extra metadata fields
        if (extraMeta.category) formData.append('category', extraMeta.category);
        if (extraMeta.entity_type) formData.append('entity_type', extraMeta.entity_type);
        if (extraMeta.character_name) formData.append('character_name', extraMeta.character_name);

        await assetService.uploadAsset(formData);
        console.log(`✅ Uploaded: ${file.name}`);
      }

      await fetchData();
      setShowUploader(false);
      alert(`Successfully uploaded ${files.length} asset(s)!`);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload assets: ' + error.message);
    }
  };

  const handleDeleteAsset = async (assetId) => {
    if (!confirm('Delete this asset permanently?')) return;
    try {
      await assetService.deleteAsset(assetId);
      setAssets(assets.filter(a => a.id !== assetId));
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete asset');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className={`asset-library-page${embedded ? ' asset-library-embedded' : ''}`}>
        <div className="asset-library-loading">
          <div className="loading-spinner"></div>
          <p>Loading assets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`asset-library-page${embedded ? ' asset-library-embedded' : ''}`}>
      {/* Page Header */}
      {!embedded && (
      <div className="asset-library-header">
        <div className="header-left">
          <h1>📁 Asset Library</h1>
          <p className="header-subtitle">
            {assets.length} asset{assets.length !== 1 ? 's' : ''} across {shows.length} show{shows.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="header-actions">
          <button
            className="btn-primary btn-upload-main"
            onClick={() => setShowUploader(true)}
          >
            📤 Upload Assets
          </button>
        </div>
      </div>
      )}
      {embedded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.08em', color: 'rgba(26,21,16,0.4)' }}>
            {assets.length} asset{assets.length !== 1 ? 's' : ''}
          </span>
          <button
            className="btn-primary btn-upload-main"
            onClick={() => setShowUploader(true)}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            📤 Upload
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="asset-library-filters">
        {/* Show Filter */}
        <div className="filter-group">
          <label className="filter-label">Show:</label>
          <select
            className="filter-select"
            value={selectedShow}
            onChange={(e) => setSelectedShow(e.target.value)}
          >
            <option value="all">All Shows</option>
            {shows.map(show => (
              <option key={show.id} value={show.id}>{show.name}</option>
            ))}
          </select>
        </div>

        {/* Category Pills */}
        <div className="category-filter">
          {Object.entries(ASSET_CATEGORIES).map(([key, cat]) => (
            <button
              key={key}
              className={`category-btn ${selectedCategory === key ? 'active' : ''}`}
              onClick={() => setSelectedCategory(key)}
              style={{
                borderColor: selectedCategory === key ? cat.color : 'transparent',
                color: selectedCategory === key ? cat.color : '#64748b'
              }}
            >
              <span className="cat-icon">{cat.icon}</span>
              <span className="cat-label">{cat.label}</span>
              {key !== 'all' && categoryCounts[key] && (
                <span className="cat-count">({categoryCounts[key]})</span>
              )}
            </button>
          ))}
        </div>

        {/* Search & View Toggle */}
        <div className="controls-right">
          <input
            type="text"
            className="search-input"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >⊞</button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >≡</button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {assets.length === 0 && (
        <div className="asset-library-empty">
          <div className="empty-icon">📁</div>
          <h3>No Assets Yet</h3>
          <p>Upload your first asset to get started</p>
          <div className="empty-actions">
            <button className="btn-primary" onClick={() => setShowUploader(true)}>
              📤 Upload Assets
            </button>
            {shows.length > 0 && (
              <button
                className="btn-secondary"
                onClick={() => navigate(`/shows/${shows[0].id}?tab=assets`)}
              >
                📁 Go to Show Assets
              </button>
            )}
          </div>
        </div>
      )}

      {/* Assets Grid/List */}
      {assets.length > 0 && (
        <div className={`asset-library-container view-${viewMode}`}>
          {filteredAssets.length === 0 ? (
            <div className="no-results">
              <p>No assets match your filters</p>
              <button className="btn-text" onClick={() => {
                setSelectedCategory('all');
                setSelectedShow('all');
                setSearchQuery('');
              }}>Clear filters</button>
            </div>
          ) : (
            filteredAssets.map(asset => {
              const category = ASSET_CATEGORIES[asset.category] || ASSET_CATEGORIES.other;
              const showInfo = shows.find(s => s.id === asset.show_id);

              return (
                <div key={asset.id} className="asset-library-card">
                  <div className="asset-thumbnail">
                    {asset.type === 'video' ? (
                      <video
                        src={asset.url}
                        width="100%"
                        height="100%"
                        style={{ objectFit: 'cover' }}
                        controls={false}
                        muted
                      />
                    ) : (
                      <img
                        src={asset.url || asset.thumbnail_url}
                        alt={asset.name}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `data:image/svg+xml,${encodeURIComponent(`<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="${category.color}"/><text x="50%" y="50%" font-size="60" text-anchor="middle" dy=".3em" fill="white">${category.icon}</text></svg>`)}`;
                        }}
                      />
                    )}
                  </div>

                  <div className="asset-info">
                    <span
                      className="asset-category-badge"
                      style={{ backgroundColor: category.color }}
                    >
                      {category.icon} {category.label}
                    </span>
                    <h4 className="asset-name">{asset.name}</h4>
                    <div className="asset-meta">
                      <span className="meta-item">{formatFileSize(asset.size)}</span>
                      {showInfo && (
                        <>
                          <span className="meta-separator">•</span>
                          <span
                            className="meta-item show-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/shows/${showInfo.id}?tab=assets`);
                            }}
                          >
                            🎬 {showInfo.name}
                          </span>
                        </>
                      )}
                      {asset.created_at && (
                        <>
                          <span className="meta-separator">•</span>
                          <span className="meta-item">{formatDate(asset.created_at)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    className="asset-menu-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDropdownId(openDropdownId === asset.id ? null : asset.id);
                    }}
                    title="More options"
                  >⋮</button>

                  {openDropdownId === asset.id && (
                    <div className="asset-dropdown-menu">
                      {showInfo && (
                        <button
                          className="menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/shows/${showInfo.id}?tab=assets`);
                            setOpenDropdownId(null);
                          }}
                        >
                          🎬 View in Show
                        </button>
                      )}
                      <button
                        className="menu-item menu-item-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAsset(asset.id);
                          setOpenDropdownId(null);
                        }}
                      >
                        🗑️ Delete Asset
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploader && (
        <AssetUploader
          context="show"
          contextLabel="Upload to Asset Library"
          onUpload={handleUpload}
          onClose={() => setShowUploader(false)}
        />
      )}
    </div>
  );
}

export default AssetLibrary;
