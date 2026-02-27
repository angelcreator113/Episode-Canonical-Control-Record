// frontend/src/components/Assets/AssetLinkModal.jsx
import React, { useState, useEffect } from 'react';
import { assetService } from '../../services/assetService';
import './AssetLinkModal.css';

/**
 * AssetLinkModal - Browse and link show assets to episode
 * 
 * Features:
 * - Browse all show assets
 * - Multi-select
 * - Category filter
 * - Search
 * - Preview
 */

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

// Generate placeholder thumbnail for assets without one
const generatePlaceholderThumbnail = (category) => {
  const icons = {
    logos: '🎬',
    backgrounds: '🖼️',
    intros: '🎵',
    outros: '🎬',
    music: '🎵',
    wardrobe: '👗',
    graphics: '✨',
    other: '📎'
  };
  const icon = icons[category] || '📎';
  return `data:image/svg+xml,${encodeURIComponent(`<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#64748b"/><text x="50%" y="50%" font-size="80" text-anchor="middle" dy=".3em">${icon}</text></svg>`)}`;
};

function AssetLinkModal({ show, episode, onLink, onClose }) {
  const [showAssets, setShowAssets] = useState([]);
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (show?.id) {
      fetchShowAssets();
    }
  }, [show?.id]);
  
  const fetchShowAssets = async () => {
    setLoading(true);
    try {
      // Fetch real show assets from API
      const response = await assetService.getAssets({
        show_id: show.id,
        asset_scope: 'SHOW'
      });
      
      // Map API response to component format
      const assetsArray = response.data?.data || response.data || [];
      const mappedAssets = assetsArray.map(asset => {
        const category = mapAssetTypeToCategory(asset.asset_type || asset.asset_role);
        return {
          id: asset.id,
          name: asset.name || asset.file_name || 'Untitled Asset',
          type: asset.media_type || (asset.content_type?.startsWith('video') ? 'video' : 'image'),
          category: category,
          url: asset.s3_url_raw || asset.url,
          thumbnail_url: asset.metadata?.thumbnail_url || asset.s3_url_raw || generatePlaceholderThumbnail(category),
          usage_count: asset.usage_count || 0
        };
      });
      
      setShowAssets(mappedAssets);
      console.log(`✅ AssetLinkModal: Loaded ${mappedAssets.length} show assets for show ${show.id}`);
    } catch (error) {
      console.error('Error fetching show assets:', error);
      setShowAssets([]);
    } finally {
      setLoading(false);
    }
  };
  
  const filteredAssets = showAssets.filter(asset => {
    const matchesCategory = categoryFilter === 'all' || asset.category === categoryFilter;
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  
  const toggleAssetSelection = (assetId) => {
    setSelectedAssets(prev =>
      prev.includes(assetId)
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };
  
  const handleLink = () => {
    if (selectedAssets.length === 0) {
      alert('Please select at least one asset to link');
      return;
    }
    
    onLink(selectedAssets);
  };
  
  // Safety check
  if (!show) {
    return (
      <div className="asset-link-modal" onClick={onClose}>
        <div className="link-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Error</h3>
            <button className="btn-close" onClick={onClose}>✕</button>
          </div>
          <div className="loading-state" style={{ padding: '2rem' }}>
            Show data not available. Please try again.
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="asset-link-modal" onClick={onClose}>
      <div className="link-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3>🔗 Link Show Assets</h3>
            <p className="modal-subtitle">Select assets from {show.name} to use in this episode</p>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        
        {/* Controls */}
        <div className="modal-controls">
          <input
            type="text"
            className="search-input"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          
          <select
            className="category-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="logos">🎬 Logos</option>
            <option value="backgrounds">🖼️ Backgrounds</option>
            <option value="intros">🎵 Intros</option>
            <option value="outros">🎬 Outros</option>
            <option value="music">🎵 Music</option>
            <option value="wardrobe">👗 Wardrobe</option>
          </select>
        </div>
        
        {/* Assets Grid */}
        <div className="modal-assets-grid">
          {loading ? (
            <div className="loading-state">Loading assets...</div>
          ) : filteredAssets.length === 0 ? (
            <div className="empty-state">
              <p>No assets found</p>
            </div>
          ) : (
            filteredAssets.map(asset => (
              <div
                key={asset.id}
                className={`link-asset-card ${selectedAssets.includes(asset.id) ? 'selected' : ''}`}
                onClick={() => toggleAssetSelection(asset.id)}
              >
                {selectedAssets.includes(asset.id) && (
                  <div className="selection-check">✓</div>
                )}
                
                <div className="link-asset-thumbnail">
                  <img src={asset.thumbnail_url} alt={asset.name} />
                </div>
                
                <div className="link-asset-info">
                  <h4 className="asset-name">{asset.name}</h4>
                  <div className="asset-meta">
                    <span className="meta-item">{asset.type}</span>
                    <span className="meta-separator">•</span>
                    <span className="meta-item usage">
                      Used in {asset.usage_count} episodes
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Footer */}
        <div className="modal-footer">
          <div className="selected-count">
            {selectedAssets.length} asset{selectedAssets.length !== 1 ? 's' : ''} selected
          </div>
          <div className="footer-actions">
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleLink}
              disabled={selectedAssets.length === 0}
            >
              Link {selectedAssets.length} Asset{selectedAssets.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AssetLinkModal;
