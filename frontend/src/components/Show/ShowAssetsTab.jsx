import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AssetUploader from '../Assets/AssetUploader';

function AssetEditModal({ asset, onSave, onClose }) {
  const [name, setName] = useState(asset.name || '');
  const [locationName, setLocationName] = useState(asset.location_name || asset.metadata?.location_name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...asset, name, location_name: locationName });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="asset-edit-modal-overlay" onClick={onClose}>
      <div className="asset-edit-modal" onClick={e => e.stopPropagation()}>
        <h3>Edit Asset</h3>
        <div className="edit-field">
          <label>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="edit-field">
          <label>Location Name (for backgrounds)</label>
          <input value={locationName} onChange={e => setLocationName(e.target.value)} />
        </div>
        <div className="edit-actions">
          <button onClick={onClose} disabled={saving}>Cancel</button>
          <button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
import { assetService } from '../../services/assetService';
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
  const [editingAsset, setEditingAsset] = useState(null);
    // Open edit modal for asset
    const handleEditAsset = (asset) => {
      console.log('[ShowAssetsTab] handleEditAsset called for', asset);
      setEditingAsset(asset);
      setOpenDropdownId(null);
    };

    // Save asset edits
    const handleSaveEdit = async (updatedAsset) => {
      try {
        await assetService.updateAsset(updatedAsset.id, {
          name: updatedAsset.name,
          location_name: updatedAsset.location_name,
        });
        // Update asset in local state
        setAssets((prev) => prev.map(a => a.id === updatedAsset.id ? { ...a, ...updatedAsset } : a));
        setEditingAsset(null);
      } catch (err) {
        alert('Failed to update asset');
      }
    };
  
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
      // Fetch assets that belong to this show
      const response = await assetService.getAssets({
        show_id: show.id,
        asset_scope: 'SHOW'
      });
      
      // Map API response to component format
      // Backend returns { status, data: assets[], count }
      const assetsArray = response.data?.data || response.data || [];
      const showAssets = assetsArray.map(asset => ({
        id: asset.id,
        name: asset.name || asset.file_name || 'Untitled Asset',
        type: asset.media_type || (asset.content_type?.startsWith('video') ? 'video' : 'image'),
        category: mapAssetTypeToCategory(asset.asset_type || asset.asset_role),
        url: asset.s3_url_raw || asset.url,
        thumbnail_url: asset.s3_url_raw || asset.metadata?.thumbnail_url || generatePlaceholderThumbnail(asset.asset_type),
        size: asset.file_size_bytes || 0,
        usage_count: asset.usage_count || 0,
        created_at: asset.created_at
      }));
      
      setAssets(showAssets);
      console.log(`✅ Loaded ${showAssets.length} show assets`);
    } catch (error) {
      console.error('Error fetching show assets:', error);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Map asset type/role to UI category
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
  
  // Generate placeholder thumbnail based on type
  const generatePlaceholderThumbnail = (assetType) => {
    const colors = {
      logos: '#667eea',
      backgrounds: '#10b981', 
      intros: '#f59e0b',
      outros: '#8b5cf6',
      music: '#ec4899',
      wardrobe: '#06b6d4',
      graphics: '#f59e0b',
      other: '#94a3b8'
    };
    const category = mapAssetTypeToCategory(assetType);
    const color = colors[category] || '#94a3b8';
    return `data:image/svg+xml,${encodeURIComponent(`<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="${color}"/><text x="50%" y="50%" font-size="60" text-anchor="middle" dy=".3em" fill="white">📁</text></svg>`)}`;
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
  
  // Map UI category to asset type for API
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
  
  const handleUpload = async (files, category, destination, extraMeta = {}) => {
    try {
      console.log('Uploading to show library:', files, 'Category:', category, 'ExtraMeta:', extraMeta);
      
      // Upload each file
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('assetType', categoryToAssetType(category));
        formData.append('show_id', show.id); // Explicit show_id field
        formData.append('metadata', JSON.stringify({
          showId: show.id,
          show_id: show.id,
          asset_scope: 'SHOW',
          purpose: category,
          uploadedFrom: 'ShowAssetsTab'
        }));

        // Append wardrobe/background fields for the asset system
        if (extraMeta.category) formData.append('category', extraMeta.category);
        if (extraMeta.entity_type) formData.append('entity_type', extraMeta.entity_type);
        if (extraMeta.character_name) formData.append('character_name', extraMeta.character_name);
        if (extraMeta.outfit_name) formData.append('outfit_name', extraMeta.outfit_name);
        if (extraMeta.outfit_era) formData.append('outfit_era', extraMeta.outfit_era);
        if (extraMeta.transformation_stage) formData.append('transformation_stage', extraMeta.transformation_stage);
        if (extraMeta.location_name) formData.append('location_name', extraMeta.location_name);
        if (extraMeta.location_version) formData.append('location_version', extraMeta.location_version);
        if (extraMeta.mood_tags) formData.append('mood_tags', extraMeta.mood_tags);
        if (extraMeta.color_palette) formData.append('color_palette', extraMeta.color_palette);
        
        // Debug: Log what's in FormData
        console.log('📦 FormData contents:', {
          show_id: show.id,
          entity_type: extraMeta.entity_type,
          category: extraMeta.category,
          entries: Array.from(formData.entries()).map(([k, v]) => [k, typeof v === 'object' ? '[Object/File]' : v])
        });
        
        await assetService.uploadAsset(formData);
        console.log(`✅ Uploaded: ${file.name}`);
      }
      
      // Refresh assets
      await fetchShowAssets();
      
      setShowUploader(false);
      alert(`Successfully uploaded ${files.length} asset(s) to show library!`);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload assets: ' + error.message);
    }
  };
  
  const handleDeleteAsset = async (assetId) => {
    if (!confirm('Delete this asset from show library? Episodes using it will be unlinked.')) {
      return;
    }
    
    try {
      await assetService.deleteAsset(assetId);
      setAssets(assets.filter(a => a.id !== assetId));
      console.log(`✅ Deleted asset: ${assetId}`);
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete asset');
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
                      {asset.type === 'video' ? (
                        <video
                          src={asset.url}
                          poster={
                            asset.thumbnail_url && !asset.thumbnail_url.startsWith('data:image/svg+xml')
                              ? asset.thumbnail_url
                              : 'data:image/svg+xml,' + encodeURIComponent('<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#64748b"/><text x="50%" y="50%" font-size="60" text-anchor="middle" dy=".3em" fill="white">🎬</text></svg>')
                          }
                          width="100%"
                          height="100%"
                          style={{ objectFit: 'cover' }}
                          controls={false}
                          muted
                        />
                      ) : (
                        <img src={asset.url || asset.thumbnail_url} alt={asset.name} />
                      )}
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
                            handleEditAsset(asset);
                          }}
                        >
                          ✏️ Edit Asset
                        </button>
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
      
      {/* Edit Asset Modal */}
      {editingAsset && (
        (() => { console.log('[ShowAssetsTab] Rendering AssetEditModal for', editingAsset); return null; })() ||
        <AssetEditModal
          asset={editingAsset}
          onSave={handleSaveEdit}
          onClose={() => setEditingAsset(null)}
        />
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
