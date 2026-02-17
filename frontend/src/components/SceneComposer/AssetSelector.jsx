// frontend/src/components/SceneComposer/AssetSelector.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { assetsAPI, wardrobeAPI, characterAPI } from '../../services/api';
import './AssetSelector.css';

/**
 * AssetSelector — Modal component for browsing and selecting assets
 *
 * Used by Scene Composer to add characters, backgrounds, UI elements, etc.
 *
 * Props:
 * - show_id      : (string) filter assets to this show
 * - assetType    : (string) pre-filter: 'character' | 'background' | 'ui_element' | 'all'
 * - onSelect     : (fn) called with the selected asset object
 * - onClose      : (fn) close the modal
 * - multiSelect  : (bool) allow picking multiple assets (default false)
 */

const CATEGORY_GROUPS = {
  character: {
    label: 'Characters',
    icon: '👤',
    categories: [
      'wardrobe_outfit',      // ← Main category
      'wardrobe_accessory',
      'wardrobe_shoes',
      'wardrobe_hairstyle',
      'wardrobe_pose',
    ],
  },
  background: {
    label: 'Backgrounds',
    icon: '🖼️',
    categories: ['background'],
  },
  ui_element: {
    label: 'UI & Overlays',
    icon: '✨',
    categories: ['ui_element', 'overlay'],
  },
  prop: {
    label: 'Props',
    icon: '🎭',
    categories: ['prop'],
  },
  audio: {
    label: 'Audio',
    icon: '🎵',
    categories: ['music', 'sfx'],
  },
};

function AssetSelector({
  show_id,
  assetType = 'all',
  onSelect,
  onClose,
  multiSelect = false,
}) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState(assetType);
  const [selected, setSelected] = useState([]); // array of asset ids

  // Character list + sub-filter for wardrobe queries
  const [characters, setCharacters] = useState([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState(null);

  // Fetch character list on mount (for character sub-filter pills)
  useEffect(() => {
    if (show_id && show_id !== 'undefined') {
      characterAPI.getAll({ show_id })
        .then(res => {
          const data = res.data?.data || [];
          setCharacters(data);
          console.log(`👤 Loaded ${data.length} characters for show ${show_id}`);
        })
        .catch(err => console.warn('Could not load characters:', err.message));
    }
  }, [show_id]);

  // Fetch assets on mount and when filters change
  useEffect(() => {
    fetchAssets();
  }, [show_id, activeType, selectedCharacterId]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      console.log('📂 AssetSelector fetch — type:', activeType, 'show_id:', show_id);

      // =============================================
      // CHARACTERS → Query WARDROBE table, not assets
      // =============================================
      if (activeType === 'character') {
        const filters = { limit: 200 };
        if (selectedCharacterId) {
          // Find the character name from our list to pass to wardrobe API
          const char = characters.find(c => c.id === selectedCharacterId);
          if (char) filters.character = char.name;
        }
        if (search.trim()) filters.search = search.trim();

        console.log('👗 Fetching wardrobe items:', filters);
        const res = await wardrobeAPI.getAll(filters);
        const items = res.data?.data || [];

        // Transform wardrobe items to match asset card display format
        const wardrobeAsAssets = items.map(item => ({
          id: item.id,
          name: item.name,
          s3_url_raw: item.s3_url || item.thumbnail_url,
          s3_url_processed: item.s3_url_processed,
          thumbnail_url: item.thumbnail_url || item.s3_url,
          category: item.clothing_category || 'wardrobe',
          character_name: item.character || item.Character?.name || null,
          character_id: item.character_id,
          entity_type: 'character',
          source: 'wardrobe',
          clothing_category: item.clothing_category,
          color: item.color,
          tags: item.tags,
          is_favorite: item.is_favorite,
        }));

        console.log(`✅ Wardrobe loaded: ${wardrobeAsAssets.length} items`);
        setAssets(wardrobeAsAssets);
      }
      // =============================================
      // ALL OTHER TYPES → Query ASSETS table
      // =============================================
      else {
        const filters = { limit: 500 };

        if (show_id && show_id !== 'undefined') {
          filters.show_id = show_id;
          filters.include_global = true;
        }

        if (activeType !== 'all') {
          const categoryMap = {
            background: 'background',
            ui_element: 'ui_element,overlay',
            prop: 'prop',
            audio: 'music,sfx',
          };
          const dbCategory = categoryMap[activeType] || activeType;
          filters.category = dbCategory;
        }

        const res = await assetsAPI.getAll(filters);
        let data = res.data?.data || res.data || [];

        if (show_id && show_id !== 'undefined') {
          data = data.filter(a =>
            a.asset_scope === 'GLOBAL' || a.show_id === show_id || !a.show_id
          );
        }

        console.log(`✅ Assets loaded: ${data.length} items`);
        setAssets(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('❌ AssetSelector fetch error:', err.message);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter by search (wardrobe search is done server-side, but also filter client-side for assets)
  const filtered = useMemo(() => {
    if (!search.trim()) return assets;
    // For wardrobe (character type), search was already done server-side
    if (activeType === 'character') return assets;
    const q = search.toLowerCase();
    return assets.filter(a =>
      (a.name || '').toLowerCase().includes(q) ||
      (a.character_name || '').toLowerCase().includes(q) ||
      (a.outfit_name || '').toLowerCase().includes(q) ||
      (a.location_name || '').toLowerCase().includes(q)
    );
  }, [assets, search, activeType]);

  // Group by location (backgrounds) or character_name (wardrobe)
  const grouped = useMemo(() => {
    console.log(`📊 Grouping ${filtered.length} filtered assets by type: ${activeType}`);
    console.log('📋 All filtered assets:', filtered.map(a => ({ name: a.name, loc: a.location_name, scope: a.asset_scope })));
    let result;
    if (activeType === 'background') {
      result = groupBy(filtered, a => a.location_name || 'Ungrouped');
      console.log('📍 Background groups:', Object.keys(result));
      Object.entries(result).forEach(([k, v]) => {
        console.log(`   "${k}": ${v.length} assets ->`, v.map(a => a.name));
      });
    } else if (activeType === 'character') {
      result = groupBy(filtered, a => a.character_name || 'Unknown Character');
    } else {
      result = { 'All Assets': filtered };
    }
    console.log('📁 Grouped result:', Object.entries(result).map(([k, v]) => `${k}: ${v.length}`));
    return result;
  }, [filtered, activeType]);

  function groupBy(arr, keyFn) {
    const map = {};
    arr.forEach(item => {
      const key = keyFn(item);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }

  const toggleSelect = (asset) => {
    if (multiSelect) {
      setSelected(prev =>
        prev.includes(asset.id)
          ? prev.filter(id => id !== asset.id)
          : [...prev, asset.id]
      );
    } else {
      // Single select — include source flag so Scene Composer knows the origin
      onSelect({ ...asset, source: asset.source || 'assets' });
    }
  };

  const handleConfirm = () => {
    if (multiSelect) {
      const selectedAssets = assets.filter(a => selected.includes(a.id));
      onSelect(selectedAssets);
    }
  };

  const getThumbnail = (asset) => {
    // Prefer raw (full resolution) > processed > thumbnail
    return asset.s3_url_raw || asset.s3_url_processed || asset.metadata?.thumbnail_url;
  };

  const parsePalette = (palette) => {
    if (!palette) return [];
    if (Array.isArray(palette)) return palette;
    if (typeof palette === 'string') {
      return palette.split(',').map(c => c.trim()).filter(Boolean);
    }
    return [];
  };

  const parseMoodTags = (tags) => {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags;
    if (typeof tags === 'string') {
      return tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    return [];
  };

  const getTypeIcon = (type) => {
    const group = CATEGORY_GROUPS[type];
    return group ? group.icon : '📁';
  };

  return (
    <div className="asset-selector-overlay" onClick={onClose}>
      <div className="asset-selector-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="as-header">
          <h3>
            {getTypeIcon(activeType)} Select{' '}
            {activeType !== 'all'
              ? CATEGORY_GROUPS[activeType]?.label || 'Asset'
              : 'Asset'}
          </h3>
          <button className="as-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Filters */}
        <div className="as-filters">
          <div className="as-filter-group">
            <span className="as-filter-label">Type:</span>
            <button
              className={`as-filter-btn ${activeType === 'all' ? 'active' : ''}`}
              onClick={() => setActiveType('all')}
            >
              All
            </button>
            {Object.entries(CATEGORY_GROUPS).map(([key, group]) => (
              <button
                key={key}
                className={`as-filter-btn ${activeType === key ? 'active' : ''}`}
                onClick={() => setActiveType(key)}
              >
                {group.icon} {group.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            className="as-search-input"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Character sub-filter pills (only when Characters tab is active) */}
        {activeType === 'character' && characters.length > 0 && (
          <div className="as-character-pills">
            <button
              className={`as-char-pill ${!selectedCharacterId ? 'active' : ''}`}
              onClick={() => setSelectedCharacterId(null)}
            >
              All Characters
            </button>
            {characters.map(char => (
              <button
                key={char.id}
                className={`as-char-pill ${selectedCharacterId === char.id ? 'active' : ''}`}
                onClick={() => setSelectedCharacterId(char.id)}
              >
                {char.display_name || char.name}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className="as-grid-container">
          {loading ? (
            <div className="as-loading">Loading assets...</div>
          ) : filtered.length === 0 ? (
          <div className="as-empty">
            <div className="as-empty-icon">📁</div>
            <p>No {activeType !== 'all' ? (CATEGORY_GROUPS[activeType]?.label || activeType) : ''} assets found</p>
            {activeType !== 'all' && (
              <button
                className="as-show-all-btn"
                onClick={() => setActiveType('all')}
              >
                Show All Assets Instead
              </button>
            )}
            <p className="as-empty-hint">
              Upload assets in the Show Assets tab, or click "Upload New" in the side panel
            </p>
          </div>
          ) : (
            <>
              {Object.entries(grouped).map(([groupName, groupAssets]) => (
              <div key={groupName} className="as-location-group">
                {Object.keys(grouped).length > 1 && (
                  <div className="as-location-header">
                    <span className="as-location-icon">
                      {activeType === 'background' ? '📍' : '👤'}
                    </span>
                    <span className="as-location-name">{groupName}</span>
                    <span className="as-location-count">
                      {groupAssets.length} asset{groupAssets.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                <div className="as-asset-grid">
                  {groupAssets.map(asset => {
                    const thumb = getThumbnail(asset);
                    const palette = parsePalette(asset.color_palette);
                    const moodTags = parseMoodTags(asset.mood_tags);
                    const isSelected = selected.includes(asset.id);

                    return (
                      <div
                        key={asset.id}
                        className={`as-asset-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleSelect(asset)}
                      >
                        <div className="as-card-thumb">
                          {thumb ? (
                            <img src={thumb} alt={asset.name} loading="lazy" />
                          ) : (
                            <div className="as-no-thumb">
                              {getTypeIcon(activeType)}
                            </div>
                          )}

                          {/* Version badge */}
                          {asset.location_version && (
                            <span className="as-version-badge">
                              {asset.location_version}
                            </span>
                          )}

                          {/* Era badge */}
                          {asset.outfit_era && (
                            <span className="as-era-badge">
                              {asset.outfit_era}
                            </span>
                          )}

                          {/* Transformation stage */}
                          {asset.transformation_stage &&
                           asset.transformation_stage !== 'neutral' && (
                            <span className={`as-stage-badge ${asset.transformation_stage}`}>
                              {asset.transformation_stage}
                            </span>
                          )}
                        </div>

                        {/* Color palette strip */}
                        {palette.length > 0 && (
                          <div className="as-palette-strip">
                            {palette.map((color, i) => (
                              <div
                                key={i}
                                className="as-palette-swatch"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        )}

                        <div className="as-card-info">
                          <div className="as-card-name">
                            {asset.outfit_name || asset.name || 'Untitled'}
                          </div>
                          {/* Show clothing category + color for wardrobe items */}
                          {asset.source === 'wardrobe' && (
                            <div className="as-card-wardrobe-meta">
                              {asset.clothing_category && (
                                <span className="as-clothing-cat">{asset.clothing_category}</span>
                              )}
                              {asset.color && (
                                <span className="as-clothing-color">{asset.color}</span>
                              )}
                              {asset.is_favorite && (
                                <span className="as-fav-badge">★</span>
                              )}
                            </div>
                          )}
                          <div className="as-card-meta">
                            {moodTags.slice(0, 3).map(tag => (
                              <span key={tag} className="as-mood-tag">{tag}</span>
                            ))}
                            {asset.usage_count > 0 && (
                              <span className="as-usage-badge">
                                ×{asset.usage_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="as-footer">
          <span className="as-selection-info">
            {multiSelect
              ? `${selected.length} selected`
              : 'Click an asset to select it'}
          </span>
          <div className="as-footer-actions">
            <button className="as-btn-cancel" onClick={onClose}>Cancel</button>
            {multiSelect && (
              <button
                className="as-btn-select"
                disabled={selected.length === 0}
                onClick={handleConfirm}
              >
                Add {selected.length} Asset{selected.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AssetSelector;
