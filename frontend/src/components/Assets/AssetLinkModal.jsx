// frontend/src/components/Assets/AssetLinkModal.jsx
import React, { useState, useEffect } from 'react';
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
      // TODO: Replace with API call
      // const response = await assetService.getShowAssets(show.id);
      
      // Mock data
      setShowAssets([
        {
          id: 'show-1',
          name: 'Show Logo',
          type: 'image',
          category: 'logos',
          thumbnail_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzY2N2VlYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+OrDwvdGV4dD48L3N2Zz4=',
          usage_count: 12
        },
        {
          id: 'show-2',
          name: 'Intro Music',
          type: 'audio',
          category: 'intros',
          thumbnail_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y1OWUwYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+OtTwvdGV4dD48L3N2Zz4=',
          usage_count: 15
        },
        {
          id: 'show-3',
          name: 'Studio Background',
          type: 'image',
          category: 'backgrounds',
          thumbnail_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzEwYjk4MSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+WvO+4jzwvdGV4dD48L3N2Zz4=',
          usage_count: 8
        },
        {
          id: 'show-4',
          name: 'Outro Music',
          type: 'audio',
          category: 'outros',
          thumbnail_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzhiNWNmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+OrDwvdGV4dD48L3N2Zz4=',
          usage_count: 10
        }
      ]);
    } catch (error) {
      console.error('Error fetching show assets:', error);
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
