// frontend/src/components/Show/ShowAssetsTab.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AssetUploader from '../Assets/AssetUploader';
import './ShowAssetsTab.css';

/**
 * ShowAssetsTab - Show-level reusable asset library
 * 
 * Features:
 * - Categorized asset organization
 * - Upload with context ("Upload to Show Library")
 * - Usage tracking (used in X episodes)
 * - Grid/List view
 * - Search and filter
 * - Promote from episode assets
 * - Recommended defaults for empty state
 */

const SHOW_ASSET_CATEGORIES = {
  all: { icon: '📁', color: '#64748b', label: 'All Assets' },
  logos: { icon: '🎬', color: '#667eea', label: 'Logos & Branding' },
  backgrounds: { icon: '🖼️', color: '#10b981', label: 'Backgrounds' },
  intros: { icon: '🎵', color: '#f59e0b', label: 'Intros' },
  outros: { icon: '🎬', color: '#8b5cf6', label: 'Outros' },
  music: { icon: '🎵', color: '#ec4899', label: 'Music & Audio' },
  wardrobe: { icon: '👗', color: '#06b6d4', label: 'Wardrobe Library' },
  graphics: { icon: '✨', color: '#f59e0b', label: 'Graphics & Overlays' },
  other: { icon: '📎', color: '#94a3b8', label: 'Other Assets' }
};

function ShowAssetsTab({ show }) {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // grid | list
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploader, setShowUploader] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  
  useEffect(() => {
    fetchShowAssets();
  }, [show.id]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    if (openDropdownId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdownId]);
  
  const fetchShowAssets = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await assetService.getShowAssets(show.id);
      // setAssets(response.data);
      
      // Mock data for now
      setAssets([
        {
          id: '1',
          name: 'Show Logo',
          type: 'image',
          category: 'logos',
          url: '/placeholder-logo.png',
          thumbnail_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzY2N2VlYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+OrDwvdGV4dD48L3N2Zz4=',
          size: 245678,
          usage_count: 12,
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Intro Music',
          type: 'audio',
          category: 'intros',
          url: '/intro-music.mp3',
          thumbnail_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y1OWUwYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+OtTwvdGV4dD48L3N2Zz4=',
          size: 3456789,
          usage_count: 15,
          duration: 8,
          created_at: new Date().toISOString()
        },
        {
          id: '3',
          name: 'Studio Background',
          type: 'image',
          category: 'backgrounds',
          url: '/studio-bg.jpg',
          thumbnail_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzEwYjk4MSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+WvO+4jzwvdGV4dD48L3N2Zz4=',
          size: 1234567,
          usage_count: 8,
          created_at: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error('Error fetching show assets:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Filter assets
  const filteredAssets = assets.filter(asset => {
    const matchesCategory = selectedCategory === 'all' || asset.category === selectedCategory;
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  
  // Count assets per category
  const categoryCounts = assets.reduce((acc, asset) => {
    acc[asset.category] = (acc[asset.category] || 0) + 1;
    return acc;
  }, {});
  
  const handleUpload = async (files, category) => {
    try {
      // TODO: Implement actual upload
      console.log('Uploading to show library:', files, 'Category:', category);
      
      // Mock success
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh assets
      await fetchShowAssets();
      
      setShowUploader(false);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload assets');
    }
  };
  
  const handleDeleteAsset = async (assetId) => {
    if (!confirm('Delete this asset from show library? Episodes using it will be unlinked.')) {
      return;
    }
    
    try {
      // TODO: Implement actual delete
      setAssets(assets.filter(a => a.id !== assetId));
    } catch (error) {
      console.error('Delete error:', error);
    }
  };
  
  const handleLinkToEpisode = (asset) => {
    // Navigate to episode selection or show modal
    console.log('Link asset to episode:', asset);
    // TODO: Show episode selection modal
  };
  
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  
  const formatUsage = (count) => {
    if (count === 0) return 'Not used';
    if (count === 1) return 'Used in 1 episode';
    return `Used in ${count} episodes`;
  };
  
  if (loading) {
    return <div className="show-assets-loading">Loading assets...</div>;
  }
  
  return (
    <div className="show-assets-tab">
      {/* Header */}
      <div className="assets-header">
        <div className="header-left">
          <h2>Show Assets ({assets.length})</h2>
          <p className="header-subtitle">Reusable assets for all episodes</p>
        </div>
        <div className="header-actions">
          <button 
            className="btn-primary btn-upload"
            onClick={() => setShowUploader(true)}
          >
            📤 Upload to Show Library
          </button>
        </div>
      </div>
      
      {/* Empty State with Recommended Defaults */}
      {assets.length === 0 && (
        <div className="empty-state-recommended">
          <div className="empty-icon">📁</div>
          <h3>Build Your Show Library</h3>
          <p>Upload reusable assets that appear across all episodes</p>
          
          <div className="recommended-grid">
            <button 
              className="recommended-card"
              onClick={() => setShowUploader(true)}
            >
              <span className="rec-icon">🎬</span>
              <span className="rec-label">Upload Show Logo</span>
            </button>
            
            <button 
              className="recommended-card"
              onClick={() => setShowUploader(true)}
            >
              <span className="rec-icon">🎵</span>
              <span className="rec-label">Upload Intro Music</span>
            </button>
            
            <button 
              className="recommended-card"
              onClick={() => setShowUploader(true)}
            >
              <span className="rec-icon">🎬</span>
              <span className="rec-label">Upload Outro Music</span>
            </button>
            
            <button 
              className="recommended-card"
              onClick={() => setShowUploader(true)}
            >
              <span className="rec-icon">✨</span>
              <span className="rec-label">Upload Brand Overlay</span>
            </button>
            
            <button 
              className="recommended-card"
              onClick={() => setShowUploader(true)}
            >
              <span className="rec-icon">👗</span>
              <span className="rec-label">Create Wardrobe Library</span>
            </button>
            
            <button 
              className="recommended-card"
              onClick={() => setShowUploader(true)}
            >
              <span className="rec-icon">🖼️</span>
              <span className="rec-label">Upload Backgrounds</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Main Content (when assets exist) */}
      {assets.length > 0 && (
        <>
          {/* Controls */}
          <div className="assets-controls">
            {/* Category Filter */}
            <div className="category-filter">
              {Object.entries(SHOW_ASSET_CATEGORIES).map(([key, cat]) => (
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
                >
                  ⊞
                </button>
                <button
                  className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="List view"
                >
                  ≡
                </button>
              </div>
            </div>
          </div>
          
          {/* Assets Grid/List */}
          <div className={`assets-container view-${viewMode}`}>
            {filteredAssets.length === 0 ? (
              <div className="no-results">
                <p>No assets found</p>
              </div>
            ) : (
              filteredAssets.map(asset => {
                const category = SHOW_ASSET_CATEGORIES[asset.category] || SHOW_ASSET_CATEGORIES.other;
                
                return (
                  <div 
                    key={asset.id} 
                    className="show-asset-card"
                    onClick={() => setSelectedAsset(asset)}
                  >
                    <div className="asset-thumbnail">
                      <img src={asset.thumbnail_url} alt={asset.name} />
                    </div>
                    
                    <div className="asset-info">
                      <div className="asset-header">
                        <span 
                          className="asset-category-badge"
                          style={{ backgroundColor: category.color }}
                        >
                          {category.icon} {category.label}
                        </span>
                      </div>
                      
                      <h4 className="asset-name">{asset.name}</h4>
                      
                      <div className="asset-meta">
                        <span className="meta-item">{formatFileSize(asset.size)}</span>
                        <span className="meta-separator">•</span>
                        <span className="meta-item usage-count">
                          {formatUsage(asset.usage_count)}
                        </span>
                      </div>
                    </div>
                    
                    <button
                      className="asset-menu-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(openDropdownId === asset.id ? null : asset.id);
                      }}
                      title="More options"
                    >
                      ⋮
                    </button>
                    
                    {openDropdownId === asset.id && (
                      <div className="asset-dropdown-menu">
                        <button
                          className="menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLinkToEpisode(asset);
                            setOpenDropdownId(null);
                          }}
                        >
                          🔗 Link to Episode
                        </button>
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
        </>
      )}
      
      {/* Upload Modal */}
      {showUploader && (
        <AssetUploader
          context="show"
          contextLabel={`Upload to ${show.name}`}
          onUpload={handleUpload}
          onClose={() => setShowUploader(false)}
        />
      )}
    </div>
  );
}

export default ShowAssetsTab;
