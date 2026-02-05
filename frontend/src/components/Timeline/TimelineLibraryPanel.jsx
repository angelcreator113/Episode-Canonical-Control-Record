import React, { useState, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import episodeAssetsService from '../../services/episodeAssetsService';
import wardrobeService from '../../services/wardrobeService';
import './TimelineLibraryPanel.css';

/**
 * TimelineLibraryPanel - Left sidebar for browsing episode assets and wardrobe
 * Users can drag items from here onto the timeline
 */
const TimelineLibraryPanel = ({ episodeId, onClose, embedded = false }) => {
  const [activeTab, setActiveTab] = useState('assets');
  const [assets, setAssets] = useState([]);
  const [wardrobe, setWardrobe] = useState([]);
  const [folders, setFolders] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set(['Promo', 'Overlays']));
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load assets
  useEffect(() => {
    if (episodeId && activeTab === 'assets') {
      loadAssets();
    }
  }, [episodeId, activeTab, searchQuery]);

  // Load wardrobe
  useEffect(() => {
    if (episodeId && activeTab === 'wardrobe') {
      loadWardrobe();
    }
  }, [episodeId, activeTab]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await episodeAssetsService.listEpisodeAssets(episodeId, {
        search: searchQuery || undefined,
      });
      
      // Handle response structure: { success, data: { total, folders, assets } }
      const assetsArray = response.data?.assets || [];
      setAssets(assetsArray);
      
      // Extract unique folders
      const uniqueFolders = [...new Set(assetsArray.map(a => a.folder || 'Uncategorized'))];
      setFolders(uniqueFolders);
    } catch (err) {
      console.error('Error loading assets:', err);
      setError('Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  const loadWardrobe = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await wardrobeService.getEpisodeWardrobe(episodeId);
      // Handle different response structures
      const wardrobeData = response.data?.data || response.data || [];
      setWardrobe(Array.isArray(wardrobeData) ? wardrobeData : []);
    } catch (err) {
      console.error('Error loading wardrobe:', err);
      setError('Failed to load wardrobe');
      setWardrobe([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (folderName) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderName)) {
        next.delete(folderName);
      } else {
        next.add(folderName);
      }
      return next;
    });
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  // Group assets by folder
  const assetsByFolder = Array.isArray(assets) ? assets.reduce((acc, asset) => {
    const folder = asset.folder || 'Uncategorized';
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(asset);
    return acc;
  }, {}) : {};

  // Group wardrobe by character
  const wardrobeByCharacter = Array.isArray(wardrobe) ? wardrobe.reduce((acc, item) => {
    const char = item.character || 'Unassigned';
    if (!acc[char]) acc[char] = [];
    acc[char].push(item);
    return acc;
  }, {}) : {};

  return (
    <div className="timeline-library-panel">
      {/* Header - hide if embedded */}
      {!embedded && (
        <div className="library-panel-header">
          <h3>📚 Episode Library</h3>
          {onClose && (
            <button onClick={onClose} className="close-btn" title="Close panel">
              ✕
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="library-tabs">
        <button
          className={`library-tab ${activeTab === 'assets' ? 'active' : ''}`}
          onClick={() => setActiveTab('assets')}
        >
          🎨 Assets
        </button>
        <button
          className={`library-tab ${activeTab === 'wardrobe' ? 'active' : ''}`}
          onClick={() => setActiveTab('wardrobe')}
        >
          👗 Wardrobe
        </button>
      </div>

      {/* Search */}
      <div className="library-search">
        <input
          type="text"
          placeholder={`Search ${activeTab}...`}
          value={searchQuery}
          onChange={handleSearch}
          className="library-search-input"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="clear-search-btn">
            ✕
          </button>
        )}
      </div>

      {/* Content */}
      <div className="library-content">
        {loading && <div className="library-loading">Loading...</div>}
        {error && <div className="library-error">{error}</div>}

        {!loading && !error && activeTab === 'assets' && (
          <div className="library-assets">
            {assets.length === 0 ? (
              <div className="library-empty">
                <p>No assets in episode library</p>
                <p className="library-empty-hint">Add assets from the asset manager</p>
              </div>
            ) : (
              Object.entries(assetsByFolder).map(([folderName, folderAssets]) => (
                <AssetFolder
                  key={folderName}
                  name={folderName}
                  assets={folderAssets}
                  expanded={expandedFolders.has(folderName)}
                  onToggle={() => toggleFolder(folderName)}
                />
              ))
            )}
          </div>
        )}

        {!loading && !error && activeTab === 'wardrobe' && (
          <div className="library-wardrobe">
            {wardrobe.length === 0 ? (
              <div className="library-empty">
                <p>No wardrobe items</p>
                <p className="library-empty-hint">Add wardrobe for this episode</p>
              </div>
            ) : (
              Object.entries(wardrobeByCharacter).map(([character, items]) => (
                <WardrobeGroup
                  key={character}
                  character={character}
                  items={items}
                  expanded={expandedFolders.has(character)}
                  onToggle={() => toggleFolder(character)}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="library-instructions">
        <p>💡 Drag items onto scenes to add them to the timeline</p>
      </div>
    </div>
  );
};

/**
 * AssetFolder - Collapsible folder of assets
 */
const AssetFolder = ({ name, assets, expanded, onToggle }) => {
  return (
    <div className="library-folder">
      <div className="library-folder-header" onClick={onToggle}>
        <span className="folder-icon">{expanded ? '▼' : '▶'}</span>
        <span className="folder-name">{name}</span>
        <span className="folder-count">{assets.length}</span>
      </div>
      {expanded && (
        <div className="library-folder-content">
          {assets.map(episodeAsset => (
            <DraggableAssetItem
              key={episodeAsset.id}
              episodeAsset={episodeAsset}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * DraggableAssetItem - Individual asset that can be dragged
 */
const DraggableAssetItem = ({ episodeAsset }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `asset-${episodeAsset.asset_id}`,
    data: {
      type: 'library-asset',
      item: episodeAsset.asset,
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`library-item ${isDragging ? 'dragging' : ''}`}
      title={episodeAsset.asset?.description || episodeAsset.asset?.name}
    >
      <div className="library-item-icon">
        {episodeAsset.asset?.s3_url_processed || episodeAsset.asset?.s3_url_raw ? (
          <img 
            src={episodeAsset.asset.s3_url_processed || episodeAsset.asset.s3_url_raw} 
            alt={episodeAsset.asset.name}
            className="library-item-thumbnail"
          />
        ) : (
          getAssetIcon(episodeAsset.asset?.type)
        )}
      </div>
      <div className="library-item-content">
        <div className="library-item-name">
          {episodeAsset.asset?.name || 'Unnamed Asset'}
        </div>
        <div className="library-item-meta">
          {episodeAsset.asset?.type}
        </div>
      </div>
    </div>
  );
};

/**
 * WardrobeGroup - Collapsible group of wardrobe items by character
 */
const WardrobeGroup = ({ character, items, expanded, onToggle }) => {
  return (
    <div className="library-folder">
      <div className="library-folder-header" onClick={onToggle}>
        <span className="folder-icon">{expanded ? '▼' : '▶'}</span>
        <span className="folder-name">{character}</span>
        <span className="folder-count">{items.length}</span>
      </div>
      {expanded && (
        <div className="library-folder-content">
          {items.map(wardrobeItem => (
            <DraggableWardrobeItem
              key={wardrobeItem.id}
              wardrobeItem={wardrobeItem}
              character={character}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * DraggableWardrobeItem - Individual wardrobe item that can be dragged
 */
const DraggableWardrobeItem = ({ wardrobeItem, character }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `wardrobe-${wardrobeItem.id}`,
    data: {
      type: 'wardrobe-item',
      item: wardrobeItem,
      character,
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`library-item ${isDragging ? 'dragging' : ''}`}
      title={wardrobeItem.description}
    >
      <div className="library-item-icon">
        {wardrobeItem.thumbnail_url || wardrobeItem.s3_url_processed || wardrobeItem.s3_url ? (
          <img 
            src={wardrobeItem.thumbnail_url || wardrobeItem.s3_url_processed || wardrobeItem.s3_url} 
            alt={wardrobeItem.name}
            className="library-item-thumbnail"
          />
        ) : (
          '👗'
        )}
      </div>
      <div className="library-item-content">
        <div className="library-item-name">
          {wardrobeItem.name || wardrobeItem.description || 'Unnamed Outfit'}
        </div>
        {wardrobeItem.variant && (
          <div className="library-item-meta">
            Variant: {wardrobeItem.variant}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function for asset icons
const getAssetIcon = (type) => {
  const icons = {
    'PROMO_LALA': '👗',
    'PROMO_GUEST': '🎤',
    'PROMO_WOMANINPRIME': '👸',
    'BRAND_LOGO': '🏷️',
    'EPISODE_FRAME': '🎬',
    'LOWER_THIRD': '📝',
    'CTA': '👆',
  };
  return icons[type] || '📎';
};

export default TimelineLibraryPanel;
