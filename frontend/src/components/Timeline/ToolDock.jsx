import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import './ToolDock.css';

/**
 * ToolDock - Horizontal tabbed tool panel for creation
 * Replaces left sidebar, sits between canvas and timeline
 */
const ToolDock = ({ 
  activeTab = 'media',
  onTabChange,
  libraryAssets = [],
  onAssetUpdate,
  episodeId 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const tabs = [
    { id: 'assets', label: 'Assets', icon: '🎬' },
    { id: 'wardrobe', label: 'Wardrobe', icon: '👗' },
    { id: 'templates', label: 'Templates', icon: '🧠' },
    { id: 'audio', label: 'Audio', icon: '🔊' },
    { id: 'effects', label: 'Effects', icon: '✨', disabled: true },
    { id: 'script', label: 'Script', icon: '📝', disabled: true },
    { id: 'transitions', label: 'Transitions', icon: '🔀', disabled: true },
  ];

  return (
    <div className={`tool-dock ${isExpanded ? 'expanded' : ''}`}>
      {/* Tab Bar */}
      <div className="tool-dock-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tool-tab ${activeTab === tab.id ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}`}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            disabled={tab.disabled}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
        
        <button 
          className="dock-expand-btn"
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? '▼' : '▲'}
        </button>
      </div>

      {/* Content Area */}
      <div className="tool-dock-content">
        {activeTab === 'assets' && (
          <AssetsTab 
            libraryAssets={libraryAssets}
            onAssetUpdate={onAssetUpdate}
            episodeId={episodeId}
          />
        )}
        {activeTab === 'wardrobe' && (
          <WardrobeTab 
            libraryAssets={libraryAssets}
            onAssetUpdate={onAssetUpdate}
            episodeId={episodeId}
          />
        )}
        {activeTab === 'templates' && <TemplatesTab />}
        {activeTab === 'audio' && <AudioTab libraryAssets={libraryAssets} />}
      </div>
    </div>
  );
};

/**
 * Assets Tab - Visual Objects (Video, Images, Backgrounds, Props)
 */
const AssetsTab = ({ libraryAssets = [], onAssetUpdate, episodeId }) => {
  const [assetFilter, setAssetFilter] = useState('all');
  const [expandedFolders, setExpandedFolders] = useState({});

  // Ensure libraryAssets is an array
  const assetsArray = Array.isArray(libraryAssets) ? libraryAssets : [];

  // Filter assets by type
  const assets = assetsArray.filter(asset => {
    // Exclude wardrobe items (they go in Wardrobe tab)
    if (asset.asset_category === 'wardrobe') return false;
    
    if (assetFilter === 'all') return true;
    if (assetFilter === 'video') return asset.asset_type === 'video';
    if (assetFilter === 'images') return asset.asset_type === 'image';
    if (assetFilter === 'backgrounds') return asset.asset_category === 'background';
    if (assetFilter === 'props') return asset.asset_category === 'prop';
    return true;
  });

  // Group assets by folder/category
  const folders = {
    locations: assets.filter(a => a.asset_category === 'location' || a.tags?.includes('location')),
    graphics: assets.filter(a => a.asset_category === 'graphic' || a.tags?.includes('graphic')),
    branding: assets.filter(a => a.tags?.includes('branding') || a.tags?.includes('brand')),
    stock: assets.filter(a => a.asset_category === 'stock' || a.tags?.includes('stock')),
    uncategorized: assets.filter(a => 
      !a.asset_category || 
      (!['location', 'graphic', 'stock', 'background', 'prop', 'wardrobe'].includes(a.asset_category) && 
      !a.tags?.some(t => ['location', 'graphic', 'branding', 'brand', 'stock'].includes(t)))
    )
  };

  const toggleFolder = (folder) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  return (
    <div className="assets-tab">
      {/* Filter Bar */}
      <div className="asset-filters">
        <button 
          className={`filter-btn ${assetFilter === 'all' ? 'active' : ''}`}
          onClick={() => setAssetFilter('all')}
        >
          All
        </button>
        <button 
          className={`filter-btn ${assetFilter === 'video' ? 'active' : ''}`}
          onClick={() => setAssetFilter('video')}
        >
          Video
        </button>
        <button 
          className={`filter-btn ${assetFilter === 'images' ? 'active' : ''}`}
          onClick={() => setAssetFilter('images')}
        >
          Images
        </button>
        <button 
          className={`filter-btn ${assetFilter === 'backgrounds' ? 'active' : ''}`}
          onClick={() => setAssetFilter('backgrounds')}
        >
          Backgrounds
        </button>
        <button 
          className={`filter-btn ${assetFilter === 'props' ? 'active' : ''}`}
          onClick={() => setAssetFilter('props')}
        >
          Props
        </button>
      </div>

      {/* Folder Sections */}
      <div className="asset-content">
        {folders.locations.length > 0 && (
          <FolderSection 
            title="Locations"
            icon="🏙️"
            assets={folders.locations}
            isExpanded={expandedFolders.locations !== false}
            onToggle={() => toggleFolder('locations')}
          />
        )}
        {folders.graphics.length > 0 && (
          <FolderSection 
            title="Graphics"
            icon="🎨"
            assets={folders.graphics}
            isExpanded={expandedFolders.graphics !== false}
            onToggle={() => toggleFolder('graphics')}
          />
        )}
        {folders.branding.length > 0 && (
          <FolderSection 
            title="Branding"
            icon="✨"
            assets={folders.branding}
            isExpanded={expandedFolders.branding !== false}
            onToggle={() => toggleFolder('branding')}
          />
        )}
        {folders.stock.length > 0 && (
          <FolderSection 
            title="Stock"
            icon="📦"
            assets={folders.stock}
            isExpanded={expandedFolders.stock !== false}
            onToggle={() => toggleFolder('stock')}
          />
        )}
        {folders.uncategorized.length > 0 && (
          <FolderSection 
            title="Uncategorized"
            icon="📁"
            assets={folders.uncategorized}
            isExpanded={expandedFolders.uncategorized !== false}
            onToggle={() => toggleFolder('uncategorized')}
          />
        )}
        {assets.length === 0 && (
          <div className="tab-empty">
            <p>No {assetFilter !== 'all' ? assetFilter : 'asset'} items found</p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Wardrobe Tab - Character-Specific Items (Outfits, Tops, Bottoms, Accessories)
 */
const WardrobeTab = ({ libraryAssets = [], onAssetUpdate, episodeId }) => {
  const [wardrobeFilter, setWardrobeFilter] = useState('all');
  const [expandedFolders, setExpandedFolders] = useState({});

  // Ensure libraryAssets is an array
  const assetsArray = Array.isArray(libraryAssets) ? libraryAssets : [];

  // Filter wardrobe items only
  const wardrobeItems = assetsArray.filter(asset => {
    if (asset.asset_category !== 'wardrobe') return false;
    
    if (wardrobeFilter === 'all') return true;
    if (wardrobeFilter === 'outfits') return asset.wardrobe_type === 'outfit';
    if (wardrobeFilter === 'tops') return asset.wardrobe_type === 'top';
    if (wardrobeFilter === 'bottoms') return asset.wardrobe_type === 'bottom';
    if (wardrobeFilter === 'accessories') return asset.wardrobe_type === 'accessory';
    return true;
  });

  // Group wardrobe by character
  const folders = {
    lala: wardrobeItems.filter(w => w.character_name === 'Lala' || w.tags?.includes('lala')),
    sunny: wardrobeItems.filter(w => w.character_name === 'Sunny' || w.tags?.includes('sunny')),
    icons: wardrobeItems.filter(w => w.tags?.includes('icon') || w.wardrobe_type === 'icon'),
    branding: wardrobeItems.filter(w => w.tags?.includes('branding') || w.tags?.includes('brand')),
    uncategorized: wardrobeItems.filter(w => 
      !w.character_name && 
      !w.tags?.some(t => ['lala', 'sunny', 'icon', 'branding', 'brand'].includes(t)) &&
      w.wardrobe_type !== 'icon'
    )
  };

  const toggleFolder = (folder) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  return (
    <div className="wardrobe-tab">
      {/* Filter Bar */}
      <div className="wardrobe-filters">
        <button 
          className={`filter-btn ${wardrobeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setWardrobeFilter('all')}
        >
          All
        </button>
        <button 
          className={`filter-btn ${wardrobeFilter === 'outfits' ? 'active' : ''}`}
          onClick={() => setWardrobeFilter('outfits')}
        >
          Outfits
        </button>
        <button 
          className={`filter-btn ${wardrobeFilter === 'tops' ? 'active' : ''}`}
          onClick={() => setWardrobeFilter('tops')}
        >
          Tops
        </button>
        <button 
          className={`filter-btn ${wardrobeFilter === 'bottoms' ? 'active' : ''}`}
          onClick={() => setWardrobeFilter('bottoms')}
        >
          Bottoms
        </button>
        <button 
          className={`filter-btn ${wardrobeFilter === 'accessories' ? 'active' : ''}`}
          onClick={() => setWardrobeFilter('accessories')}
        >
          Accessories
        </button>
      </div>

      {/* Character Folders */}
      <div className="wardrobe-content">
        {folders.lala.length > 0 && (
          <FolderSection 
            title="Lala"
            icon="👧"
            assets={folders.lala}
            isExpanded={expandedFolders.lala !== false}
            onToggle={() => toggleFolder('lala')}
          />
        )}
        {folders.sunny.length > 0 && (
          <FolderSection 
            title="Sunny"
            icon="🌞"
            assets={folders.sunny}
            isExpanded={expandedFolders.sunny !== false}
            onToggle={() => toggleFolder('sunny')}
          />
        )}
        {folders.icons.length > 0 && (
          <FolderSection 
            title="Icons"
            icon="⭐"
            assets={folders.icons}
            isExpanded={expandedFolders.icons !== false}
            onToggle={() => toggleFolder('icons')}
          />
        )}
        {folders.branding.length > 0 && (
          <FolderSection 
            title="Branding"
            icon="✨"
            assets={folders.branding}
            isExpanded={expandedFolders.branding !== false}
            onToggle={() => toggleFolder('branding')}
          />
        )}
        {folders.uncategorized.length > 0 && (
          <FolderSection 
            title="Characters"
            icon="👥"
            assets={folders.uncategorized}
            isExpanded={expandedFolders.uncategorized !== false}
            onToggle={() => toggleFolder('uncategorized')}
          />
        )}
        {wardrobeItems.length === 0 && (
          <div className="tab-empty">
            <p>No {wardrobeFilter !== 'all' ? wardrobeFilter : 'wardrobe'} items found</p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Folder Section - Collapsible folder with asset grid
 */
const FolderSection = ({ title, icon, assets, isExpanded, onToggle }) => {
  return (
    <div className="folder-section">
      <button className="folder-header" onClick={onToggle}>
        <span className="folder-icon">{icon}</span>
        <span className="folder-title">{title}</span>
        <span className="folder-count">{assets.length}</span>
        <span className="folder-toggle">{isExpanded ? '▼' : '▶'}</span>
      </button>
      {isExpanded && (
        <div className="folder-grid">
          {assets.map(asset => (
            <DraggableAsset key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Media Tab - Legacy (kept for backward compatibility if needed)
 */
const MediaTab = ({ libraryAssets = [], onAssetUpdate, episodeId }) => {
  const [mediaFilter, setMediaFilter] = useState('all');

  // Ensure libraryAssets is an array
  const assetsArray = Array.isArray(libraryAssets) ? libraryAssets : [];

  const assets = assetsArray.filter(asset => {
    if (mediaFilter === 'all') return true;
    if (mediaFilter === 'video') return asset.asset_type === 'video';
    if (mediaFilter === 'image') return asset.asset_type === 'image';
    if (mediaFilter === 'wardrobe') return asset.asset_category === 'wardrobe';
    if (mediaFilter === 'background') return asset.asset_category === 'background';
    return true;
  });

  return (
    <div className="media-tab">
      {/* Filter Bar */}
      <div className="media-filters">
        <button 
          className={`filter-btn ${mediaFilter === 'all' ? 'active' : ''}`}
          onClick={() => setMediaFilter('all')}
        >
          All
        </button>
        <button 
          className={`filter-btn ${mediaFilter === 'video' ? 'active' : ''}`}
          onClick={() => setMediaFilter('video')}
        >
          Video
        </button>
        <button 
          className={`filter-btn ${mediaFilter === 'image' ? 'active' : ''}`}
          onClick={() => setMediaFilter('image')}
        >
          Images
        </button>
        <button 
          className={`filter-btn ${mediaFilter === 'wardrobe' ? 'active' : ''}`}
          onClick={() => setMediaFilter('wardrobe')}
        >
          Wardrobe
        </button>
        <button 
          className={`filter-btn ${mediaFilter === 'background' ? 'active' : ''}`}
          onClick={() => setMediaFilter('background')}
        >
          Backgrounds
        </button>
      </div>

      {/* Asset Grid */}
      <div className="media-grid">
        {assets.map(asset => (
          <DraggableAsset key={asset.id} asset={asset} />
        ))}
        {assets.length === 0 && (
          <div className="media-empty">
            <p>No {mediaFilter !== 'all' ? mediaFilter : 'media'} assets found</p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Draggable Asset Card
 */
const DraggableAsset = ({ asset }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `asset-${asset.id}`,
    data: { type: 'asset', asset }
  });

  const thumbnail = asset.s3_url_processed || asset.s3_url_raw || asset.thumbnail_url;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`asset-card ${isDragging ? 'dragging' : ''}`}
    >
      {thumbnail ? (
        <img src={thumbnail} alt={asset.name} className="asset-thumbnail" />
      ) : (
        <div className="asset-placeholder">
          {asset.asset_type === 'video' ? '🎥' : '🖼️'}
        </div>
      )}
      <div className="asset-name">{asset.name}</div>
    </div>
  );
};

/**
 * Templates Tab - Stub for now
 */
const TemplatesTab = () => {
  return (
    <div className="templates-tab">
      <div className="tab-stub">
        <div className="stub-icon">🧠</div>
        <h3>Templates</h3>
        <p>Episode blueprints coming soon</p>
        <div className="stub-actions">
          <button className="stub-btn" disabled>Create Template</button>
          <button className="stub-btn" disabled>Apply Template</button>
        </div>
      </div>
    </div>
  );
};

/**
 * Audio Tab - Music, Voice, SFX
 */
const AudioTab = ({ libraryAssets = [] }) => {
  const [audioFilter, setAudioFilter] = useState('all');

  // Ensure libraryAssets is an array
  const assetsArray = Array.isArray(libraryAssets) ? libraryAssets : [];

  const audioAssets = assetsArray.filter(asset => {
    const isAudio = asset.asset_type === 'audio' || asset.asset_category === 'audio';
    if (!isAudio) return false;
    if (audioFilter === 'all') return true;
    // TODO: Add audio subcategories (music, voice, sfx)
    return true;
  });

  return (
    <div className="audio-tab">
      {/* Filter Bar */}
      <div className="audio-filters">
        <button 
          className={`filter-btn ${audioFilter === 'all' ? 'active' : ''}`}
          onClick={() => setAudioFilter('all')}
        >
          All Audio
        </button>
        <button className="filter-btn" disabled>Music</button>
        <button className="filter-btn" disabled>Voice</button>
        <button className="filter-btn" disabled>SFX</button>
      </div>

      {/* Audio List */}
      <div className="audio-list">
        {audioAssets.map(asset => (
          <DraggableAsset key={asset.id} asset={asset} />
        ))}
        {audioAssets.length === 0 && (
          <div className="audio-empty">
            <p>No audio assets found</p>
            <span>Add audio files to your library</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ToolDock;
