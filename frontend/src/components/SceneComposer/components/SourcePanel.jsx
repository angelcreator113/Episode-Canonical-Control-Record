import React, { useState, useMemo, useRef, useEffect } from 'react';

/**
 * SourcePanel - Enhanced left panel with search, filter, multi-select, and preview
 */
function SourcePanel({
  episodeScenes = [],
  episodeAssets = [],
  episodeWardrobes = [],
  onAddScene,
  onAddAsset,
  onAddWardrobe
}) {
  // Track which sections are expanded (all open by default)
  const [expandedSections, setExpandedSections] = useState({
    scenes: true,
    assets: true,
    wardrobes: true
  });

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all, scenes, assets, wardrobes

  // View & Sort
  const [viewMode, setViewMode] = useState('grid'); // grid, list
  const [sortBy, setSortBy] = useState('name'); // name, date, recent, duration

  // Multi-select
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  // Preview
  const [previewItem, setPreviewItem] = useState(null);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const previewTimeoutRef = useRef(null);

  // Drag state
  const [draggedItem, setDraggedItem] = useState(null);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Search & Filter logic
  const filterItems = (items, type) => {
    if (!searchQuery) return items;
    
    return items.filter(item => {
      const entity = item.libraryScene || item.scene || item.asset || item.wardrobe || item;
      const searchText = (entity.title || entity.name || '').toLowerCase();
      const metaText = (entity.description || entity.asset_type || entity.type || '').toLowerCase();
      return searchText.includes(searchQuery.toLowerCase()) || 
             metaText.includes(searchQuery.toLowerCase());
    });
  };

  // Sort logic
  const sortItems = (items, type) => {
    return [...items].sort((a, b) => {
      const entityA = a.libraryScene || a.scene || a.asset || a.wardrobe || a;
      const entityB = b.libraryScene || b.scene || b.asset || b.wardrobe || b;

      switch (sortBy) {
        case 'name':
          return ((entityA.title || entityA.name || '').localeCompare(entityB.title || entityB.name || ''));
        case 'date':
          return new Date(entityB.created_at || 0) - new Date(entityA.created_at || 0);
        case 'duration':
          if (type === 'scenes') {
            return (entityB.duration_seconds || 0) - (entityA.duration_seconds || 0);
          }
          return 0;
        default:
          return 0;
      }
    });
  };

  // Filtered and sorted data
  const filteredScenes = useMemo(() => sortItems(filterItems(episodeScenes, 'scenes'), 'scenes'), 
    [episodeScenes, searchQuery, sortBy]);
  const filteredAssets = useMemo(() => sortItems(filterItems(episodeAssets, 'assets'), 'assets'), 
    [episodeAssets, searchQuery, sortBy]);
  const filteredWardrobes = useMemo(() => sortItems(filterItems(episodeWardrobes, 'wardrobes'), 'wardrobes'), 
    [episodeWardrobes, searchQuery, sortBy]);

  // Multi-select handlers
  const toggleSelection = (id, event) => {
    if (event.ctrlKey || event.metaKey || selectionMode) {
      event.stopPropagation();
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
    }
  };

  const selectAll = (items, type) => {
    const ids = items.map(item => {
      const entity = item.libraryScene || item.scene || item.asset || item.wardrobe || item;
      return `${type}-${entity.id}`;
    });
    setSelectedItems(new Set(ids));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
    setSelectionMode(false);
  };

  const addSelectedToComposition = () => {
    // Add all selected items to composition
    selectedItems.forEach(id => {
      const [type, itemId] = id.split('-');
      if (type === 'scenes') {
        const scene = episodeScenes.find(s => {
          const entity = s.libraryScene || s.scene || s;
          return entity.id === itemId;
        });
        if (scene) onAddScene(scene.libraryScene || scene.scene || scene);
      } else if (type === 'assets') {
        const asset = episodeAssets.find(a => {
          const entity = a.asset || a;
          return entity.id === itemId;
        });
        if (asset) onAddAsset(asset.asset || asset);
      } else if (type === 'wardrobes') {
        const wardrobe = episodeWardrobes.find(w => {
          const entity = w.wardrobe || w;
          return entity.id === itemId;
        });
        if (wardrobe) onAddWardrobe(wardrobe.wardrobe || wardrobe);
      }
    });
    clearSelection();
  };

  // Preview handlers
  const showPreview = (item, event) => {
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    
    previewTimeoutRef.current = setTimeout(() => {
      const rect = event.currentTarget.getBoundingClientRect();
      setPreviewPosition({ x: rect.right + 10, y: rect.top });
      setPreviewItem(item);
    }, 500);
  };

  const hidePreview = () => {
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    setPreviewItem(null);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    };
  }, []);

  // Drag handlers
  const handleDragStart = (item, type, event) => {
    setDraggedItem({ item, type });
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', JSON.stringify({ item, type }));
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const CollapsibleSection = ({ title, icon, count, section, children }) => {
    const isExpanded = expandedSections[section];
    
    return (
      <div className="sc-collapsible-section">
        <button 
          className="sc-section-header"
          onClick={() => toggleSection(section)}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${title} section`}
        >
          <span className="sc-section-icon">{icon}</span>
          <span className="sc-section-title">{title}</span>
          <span className="sc-section-count">{count}</span>
          <span className={`sc-section-chevron ${isExpanded ? 'expanded' : ''}`}>
            ▼
          </span>
        </button>
        {isExpanded && (
          <div className="sc-section-content">
            {children}
          </div>
        )}
      </div>
    );
  };

  const SourceItem = ({ item, type, onAdd }) => {
    const entity = item.libraryScene || item.scene || item.asset || item.wardrobe || item;
    const itemId = `${type}-${entity.id}`;
    const isSelected = selectedItems.has(itemId);
    const isDragging = draggedItem?.item === item;

    const handleClick = (e) => {
      if (e.ctrlKey || e.metaKey || selectionMode) {
        toggleSelection(itemId, e);
      } else {
        onAdd(entity);
      }
    };

    return (
      <div
        className={`sc-source-item ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
        onClick={handleClick}
        onMouseEnter={(e) => showPreview(entity, e)}
        onMouseLeave={hidePreview}
        draggable
        onDragStart={(e) => handleDragStart(entity, type, e)}
        onDragEnd={handleDragEnd}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(e);
          }
        }}
        aria-label={`${entity.title || entity.name || 'Untitled'} - ${type}`}
      >
        {selectionMode && (
          <div className="sc-source-item-checkbox">
            <input 
              type="checkbox" 
              checked={isSelected} 
              onChange={(e) => toggleSelection(itemId, e)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select ${entity.title || entity.name}`}
            />
          </div>
        )}
        <div className="sc-source-thumb">
          {(entity.thumbnail_url || entity.s3_url_processed || entity.s3_url_raw || entity.image_url) ? (
            <img 
              src={entity.thumbnail_url || entity.s3_url_processed || entity.s3_url_raw || entity.image_url} 
              alt={entity.title || entity.name || 'Thumbnail'} 
              loading="lazy"
            />
          ) : (
            <div className="sc-source-thumb-fallback">
              {type === 'scenes' ? '🎬' : type === 'assets' ? '🖼️' : '👗'}
            </div>
          )}
          {isDragging && <div className="sc-drag-overlay">↗️</div>}
        </div>
        <div className="sc-source-info">
          <div className="sc-source-title">{entity.title || entity.name || 'Untitled'}</div>
          <div className="sc-source-meta">
            {type === 'scenes' && `${entity.duration_seconds || 0}s`}
            {type === 'assets' && (entity.asset_type || 'Asset')}
            {type === 'wardrobes' && (entity.type || 'Wardrobe')}
          </div>
        </div>
      </div>
    );
  };

  const renderScenes = () => (
    <div className={`sc-source-list ${viewMode}`}>
      {filteredScenes.length === 0 ? (
        <div className="sc-empty-state">
          <div className="sc-empty-icon">🎬</div>
          <div className="sc-empty-title">No scenes found</div>
          <div className="sc-empty-hint">
            {searchQuery ? 'Try a different search term' : 'Add scenes to your episode to get started'}
          </div>
        </div>
      ) : (
        filteredScenes.map(sceneItem => (
          <SourceItem
            key={sceneItem.id || (sceneItem.libraryScene || sceneItem.scene || sceneItem).id}
            item={sceneItem}
            type="scenes"
            onAdd={onAddScene}
          />
        ))
      )}
    </div>
  );

  const renderAssets = () => (
    <div className={`sc-source-list ${viewMode}`}>
      {filteredAssets.length === 0 ? (
        <div className="sc-empty-state">
          <div className="sc-empty-icon">🖼️</div>
          <div className="sc-empty-title">No assets found</div>
          <div className="sc-empty-hint">
            {searchQuery ? 'Try a different search term' : 'Upload or add assets to your episode'}
          </div>
          {!searchQuery && (
            <button className="sc-empty-action" onClick={() => console.log('Open asset uploader')}>
              ⬆️ Upload Assets
            </button>
          )}
        </div>
      ) : (
        filteredAssets.map(assetItem => (
          <SourceItem
            key={assetItem.id || (assetItem.asset || assetItem).id}
            item={assetItem}
            type="assets"
            onAdd={onAddAsset}
          />
        ))
      )}
    </div>
  );

  const renderWardrobes = () => (
    <div className={`sc-source-list ${viewMode}`}>
      {filteredWardrobes.length === 0 ? (
        <div className="sc-empty-state">
          <div className="sc-empty-icon">👗</div>
          <div className="sc-empty-title">No wardrobe items found</div>
          <div className="sc-empty-hint">
            {searchQuery ? 'Try a different search term' : 'Add wardrobe items to your episode'}
          </div>
        </div>
      ) : (
        filteredWardrobes.map(wardrobeItem => (
          <SourceItem
            key={wardrobeItem.id || (wardrobeItem.wardrobe || wardrobeItem).id}
            item={wardrobeItem}
            type="wardrobes"
            onAdd={onAddWardrobe}
          />
        ))
      )}
    </div>
  );

  return (
    <div className="sc-source-panel">
      <div className="sc-panel-header">
        <h3 className="sc-panel-title">Sources</h3>
        
        {/* Toolbar */}
        <div className="sc-panel-toolbar">
          {/* Search */}
          <div className="sc-search-box">
            <span className="sc-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sc-search-input"
              aria-label="Search sources"
            />
            {searchQuery && (
              <button 
                className="sc-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* View & Sort Controls */}
          <div className="sc-controls">
            <div className="sc-control-group">
              <button
                className={`sc-control-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
                aria-label="Grid view"
              >
                ⊞
              </button>
              <button
                className={`sc-control-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List view"
                aria-label="List view"
              >
                ☰
              </button>
            </div>

            <select
              className="sc-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort by"
            >
              <option value="name">Name</option>
              <option value="date">Date Added</option>
              <option value="duration">Duration</option>
            </select>

            <button
              className={`sc-control-btn ${selectionMode ? 'active' : ''}`}
              onClick={() => setSelectionMode(!selectionMode)}
              title="Multi-select mode"
              aria-label="Toggle multi-select"
            >
              ☑
            </button>
          </div>
        </div>

        {/* Selection Bar */}
        {selectedItems.size > 0 && (
          <div className="sc-selection-bar">
            <span className="sc-selection-count">{selectedItems.size} selected</span>
            <div className="sc-selection-actions">
              <button 
                className="sc-selection-btn"
                onClick={addSelectedToComposition}
                aria-label="Add selected items"
              >
                ➕ Add All
              </button>
              <button 
                className="sc-selection-btn"
                onClick={clearSelection}
                aria-label="Clear selection"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="sc-panel-content" style={{ padding: 0 }}>
        <CollapsibleSection 
          title="Scenes" 
          icon="🎬" 
          count={filteredScenes.length}
          section="scenes"
        >
          {renderScenes()}
        </CollapsibleSection>

        <CollapsibleSection 
          title="Assets" 
          icon="🖼️" 
          count={filteredAssets.length}
          section="assets"
        >
          {renderAssets()}
        </CollapsibleSection>

        <CollapsibleSection 
          title="Wardrobe" 
          icon="👗" 
          count={filteredWardrobes.length}
          section="wardrobes"
        >
          {renderWardrobes()}
        </CollapsibleSection>
      </div>

      {/* Quick Preview Tooltip */}
      {previewItem && (
        <div 
          className="sc-preview-tooltip"
          style={{
            position: 'fixed',
            left: `${previewPosition.x}px`,
            top: `${previewPosition.y}px`,
            zIndex: 10000
          }}
        >
          <div className="sc-preview-thumb">
            {(previewItem.thumbnail_url || previewItem.s3_url_processed || previewItem.image_url) ? (
              <img 
                src={previewItem.thumbnail_url || previewItem.s3_url_processed || previewItem.image_url} 
                alt="Preview" 
              />
            ) : (
              <div className="sc-preview-fallback">No preview</div>
            )}
          </div>
          <div className="sc-preview-info">
            <div className="sc-preview-title">{previewItem.title || previewItem.name || 'Untitled'}</div>
            {previewItem.description && (
              <div className="sc-preview-desc">{previewItem.description}</div>
            )}
            <div className="sc-preview-meta">
              {previewItem.duration_seconds && `Duration: ${previewItem.duration_seconds}s`}
              {previewItem.asset_type && `Type: ${previewItem.asset_type}`}
              {previewItem.type && `Type: ${previewItem.type}`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(SourcePanel);
