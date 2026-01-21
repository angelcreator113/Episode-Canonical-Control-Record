import React, { useState, useEffect } from 'react';
import assetService from '../../services/assetService';
import './EnhancedAssetPicker.css';

/**
 * Enhanced Asset Picker with filtering by:
 * - allowed_uses (what can this asset be used for)
 * - purpose (MAIN, TITLE, ICON, BACKGROUND)
 * - asset_group (LALA, SHOW, GUEST, EPISODE, WARDROBE)
 * - scope (global, show, episode)
 */
const EnhancedAssetPicker = ({ 
  isOpen, 
  onClose, 
  onSelect,
  // Filter constraints
  requiredUse = null,       // e.g., 'THUMBNAIL', 'SCENE', 'UI'
  purposeFilter = null,     // e.g., 'MAIN', 'BACKGROUND'
  groupFilter = null,       // e.g., 'LALA', 'SHOW'
  scopeFilter = null,       // 'global', 'show', 'episode'
  episodeId = null,         // For episode-scoped filtering
  showId = null,            // For show-scoped filtering
  multiSelect = false,
  title = 'Select Asset'
}) => {
  const [assets, setAssets] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAssets, setSelectedAssets] = useState([]);

  // Additional UI filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(groupFilter || '');
  const [selectedPurpose, setSelectedPurpose] = useState(purposeFilter || '');
  const [selectedScope, setSelectedScope] = useState(scopeFilter || '');

  useEffect(() => {
    if (isOpen) {
      fetchAssets();
    }
  }, [isOpen, episodeId, showId]);

  useEffect(() => {
    filterAssets();
  }, [assets, searchQuery, selectedGroup, selectedPurpose, selectedScope, requiredUse]);

  const fetchAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      // Build query params based on scope
      const params = {};
      
      if (scopeFilter === 'episode' && episodeId) {
        params.episodeId = episodeId;
      } else if (scopeFilter === 'show' && showId) {
        params.showId = showId;
      }

      const response = await assetService.searchAssets(params);
      setAssets(response.assets || []);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
      setError('Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  const filterAssets = () => {
    let filtered = [...assets];

    // Filter by required use (what this asset CAN be used for)
    if (requiredUse) {
      filtered = filtered.filter(asset => 
        asset.allowed_uses && asset.allowed_uses.includes(requiredUse)
      );
    }

    // Filter by purpose
    if (selectedPurpose) {
      filtered = filtered.filter(asset => asset.purpose === selectedPurpose);
    }

    // Filter by group
    if (selectedGroup) {
      filtered = filtered.filter(asset => asset.asset_group === selectedGroup);
    }

    // Filter by scope
    if (selectedScope) {
      if (selectedScope === 'global') {
        filtered = filtered.filter(asset => asset.is_global === true);
      } else if (selectedScope === 'show') {
        filtered = filtered.filter(asset => 
          asset.is_global === false && asset.shows && asset.shows.length > 0
        );
      } else if (selectedScope === 'episode') {
        filtered = filtered.filter(asset => 
          asset.is_global === false && asset.episodes && asset.episodes.length > 0
        );
      }
    }

    // Search by name
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(asset =>
        asset.name?.toLowerCase().includes(query) ||
        asset.asset_type?.toLowerCase().includes(query)
      );
    }

    setFilteredAssets(filtered);
  };

  const handleSelectAsset = (asset) => {
    if (multiSelect) {
      const isSelected = selectedAssets.find(a => a.id === asset.id);
      if (isSelected) {
        setSelectedAssets(selectedAssets.filter(a => a.id !== asset.id));
      } else {
        setSelectedAssets([...selectedAssets, asset]);
      }
    } else {
      onSelect(asset);
      onClose();
    }
  };

  const handleConfirmSelection = () => {
    onSelect(selectedAssets);
    setSelectedAssets([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="enhanced-asset-picker-overlay" onClick={onClose}>
      <div className="enhanced-asset-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="enhanced-asset-picker-header">
          <h2>{title}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {/* Filters */}
        <div className="enhanced-asset-picker-filters">
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />

          {!groupFilter && (
            <select 
              value={selectedGroup} 
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="filter-select"
            >
              <option value="">All Groups</option>
              <option value="LALA">LALA</option>
              <option value="SHOW">Show</option>
              <option value="GUEST">Guest</option>
              <option value="EPISODE">Episode</option>
              <option value="WARDROBE">Wardrobe</option>
            </select>
          )}

          {!purposeFilter && (
            <select 
              value={selectedPurpose} 
              onChange={(e) => setSelectedPurpose(e.target.value)}
              className="filter-select"
            >
              <option value="">All Purposes</option>
              <option value="MAIN">Main</option>
              <option value="TITLE">Title</option>
              <option value="ICON">Icon</option>
              <option value="BACKGROUND">Background</option>
            </select>
          )}

          {!scopeFilter && (
            <select 
              value={selectedScope} 
              onChange={(e) => setSelectedScope(e.target.value)}
              className="filter-select"
            >
              <option value="">All Scopes</option>
              <option value="global">Global</option>
              <option value="show">Show</option>
              <option value="episode">Episode</option>
            </select>
          )}
        </div>

        {/* Active filters badge */}
        {requiredUse && (
          <div className="active-filter-badge">
            Required for: <strong>{requiredUse}</strong>
          </div>
        )}

        {/* Asset grid */}
        <div className="enhanced-asset-picker-body">
          {loading && <div className="loading">Loading assets...</div>}
          
          {error && <div className="error-message">{error}</div>}

          {!loading && !error && filteredAssets.length === 0 && (
            <div className="no-assets">No assets match your criteria</div>
          )}

          {!loading && filteredAssets.length > 0 && (
            <div className="asset-grid">
              {filteredAssets.map((asset) => {
                const isSelected = selectedAssets.find(a => a.id === asset.id);
                return (
                  <div
                    key={asset.id}
                    className={`asset-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectAsset(asset)}
                  >
                    <div className="asset-thumbnail">
                      {asset.media_type === 'video' ? (
                        <div className="video-placeholder">
                          <span>🎬</span>
                        </div>
                      ) : (
                        <img 
                          src={asset.s3_url_raw || asset.metadata?.thumbnail_url} 
                          alt={asset.name}
                          onError={(e) => e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E'}
                        />
                      )}
                    </div>
                    
                    <div className="asset-info">
                      <div className="asset-name">{asset.name}</div>
                      
                      <div className="asset-badges">
                        {asset.asset_group && (
                          <span className={`badge badge-${asset.asset_group.toLowerCase()}`}>
                            {asset.asset_group}
                          </span>
                        )}
                        {asset.purpose && (
                          <span className="badge badge-purpose">
                            {asset.purpose}
                          </span>
                        )}
                        {asset.is_global && (
                          <span className="badge badge-global">🌐 Global</span>
                        )}
                      </div>

                      {asset.allowed_uses && asset.allowed_uses.length > 0 && (
                        <div className="asset-uses">
                          {asset.allowed_uses.slice(0, 3).map(use => (
                            <span key={use} className="use-tag">{use}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {isSelected && <div className="selection-indicator">✓</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="enhanced-asset-picker-footer">
          <div className="asset-count">
            {filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''}
            {selectedAssets.length > 0 && ` (${selectedAssets.length} selected)`}
          </div>
          
          <div className="footer-actions">
            <button className="cancel-button" onClick={onClose}>
              Cancel
            </button>
            {multiSelect && selectedAssets.length > 0 && (
              <button className="confirm-button" onClick={handleConfirmSelection}>
                Add {selectedAssets.length} Asset{selectedAssets.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedAssetPicker;
