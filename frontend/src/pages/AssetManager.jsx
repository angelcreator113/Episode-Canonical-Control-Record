/**
 * AssetManager Component - BROWSE ONLY VERSION
 * 
 * Upload functionality removed - users must upload via Episode Assets tab
 * This enforces that all assets are linked to episodes
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AssetCard from '../components/AssetCard';
import AssetPreviewModal from '../components/AssetPreviewModal';
import assetService from '../services/assetService';
import './AssetManager.css';

const AssetManager = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Asset state
  const [assets, setAssets] = useState([]);
  const [allLabels, setAllLabels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterMediaType, setFilterMediaType] = useState('all');
  const [filterLabels, setFilterLabels] = useState([]);
  const [sortBy, setSortBy] = useState('created_at');

  // Bulk operation state
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [selectedAssetTypes, setSelectedAssetTypes] = useState([]);
  const [batchChangeType, setBatchChangeType] = useState('');
  const [showTypeChangeModal, setShowTypeChangeModal] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState('grid');
  const [previewAsset, setPreviewAsset] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Get referrer episode ID from location state
  const referrerEpisodeId = location.state?.episodeId;

  // Main categories structure - based on asset_group
  const mainCategories = {
    ALL: { label: 'All Assets', icon: '📦' },
    CHARACTERS: { label: 'Characters', icon: '👥' },
    ICONS: { label: 'Icons', icon: '🎨' },
    BRANDING: { label: 'Branding', icon: '🏷️' },
    BACKGROUNDS: { label: 'Backgrounds', icon: '🖼️' }
  };

  // Asset types organized by main category (for type change modal) - using asset_role
  const assetTypesByCategory = {
    CHARACTERS: [
      { value: 'CHAR.HOST.LALA', label: '👩 Lala (Host)' },
      { value: 'CHAR.HOST.JUSTAWOMANINHERPRIME', label: '👩 Just a Woman in Her Prime (Host)' },
      { value: 'CHAR.GUEST.1', label: '👤 Guest 1' },
      { value: 'CHAR.GUEST.2', label: '👤 Guest 2' }
    ],
    ICONS: [
      { value: 'UI.ICON.CLOSET', label: '🗂️ Closet Icon' },
      { value: 'UI.ICON.JEWELRY_BOX', label: '💍 Jewelry Box Icon' },
      { value: 'UI.ICON.TODO_LIST', label: '📋 To-Do List Icon' },
      { value: 'UI.ICON.SPEECH', label: '💬 Speech Bubble Icon' },
      { value: 'UI.ICON.LOCATION', label: '📍 Location Pin Icon' },
      { value: 'UI.ICON.PERFUME', label: '🌸 Perfume Icon' },
      { value: 'UI.ICON.POSE', label: '🧍 Pose Icon' },
      { value: 'UI.ICON.RESERVED', label: '🔒 Reserved Icon' },
      { value: 'UI.ICON.HOLDER.MAIN', label: '📦 Icon Holder' }
    ],
    BRANDING: [
      { value: 'BRAND.SHOW.TITLE_GRAPHIC', label: '🏷️ Show Title Graphic' }
    ],
    BACKGROUNDS: [
      { value: 'BG.MAIN', label: '🖼️ Background Image' },
      { value: 'UI.MOUSE.CURSOR', label: '🖱️ Mouse Cursor' },
      { value: 'UI.BUTTON.EXIT', label: '❌ Exit Button' },
      { value: 'UI.BUTTON.MINIMIZE', label: '➖ Minimize Button' }
    ]
  };

  // Load data on mount
  useEffect(() => {
    loadAssets();
    loadLabels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced reload for filters/search
  useEffect(() => {
    const t = setTimeout(() => {
      loadAssets();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filterMediaType, sortBy, filterLabels]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await assetService.searchAssets({
        query: searchQuery || null,
        assetType: null,
        mediaType: filterMediaType === 'all' ? null : filterMediaType,
        labelIds: filterLabels,
        sortBy,
        sortOrder: 'DESC',
      });

      setAssets(response.data.data || []);
    } catch (err) {
      console.error('Error loading assets:', err);
      setError('Failed to load assets');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLabels = async () => {
    try {
      const response = await assetService.getAllLabels();
      setAllLabels(response.data.data || []);
    } catch (err) {
      console.error('Error loading labels:', err);
    }
  };

  // Bulk operation handlers
  const handleSelectAsset = (assetId, selected) => {
    setSelectedAssets(prev =>
      selected ? [...prev, assetId] : prev.filter(id => id !== assetId)
    );
  };

  const handleSelectAll = () => {
    if (selectedAssets.length === filteredAssets.length) {
      setSelectedAssets([]);
    } else {
      setSelectedAssets(filteredAssets.map(a => a.id));
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedAssets.length} assets? This cannot be undone.`)) return;

    setBulkProcessing(true);
    try {
      await assetService.bulkDelete(selectedAssets);
      setSuccess(`✅ Deleted ${selectedAssets.length} assets`);
      setSelectedAssets([]);
      loadAssets();
    } catch (err) {
      setError('Bulk delete failed');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkAddLabel = async (labelId) => {
    setBulkProcessing(true);
    try {
      await assetService.bulkAddLabels(selectedAssets, [labelId]);
      setSuccess(`✅ Added label to ${selectedAssets.length} assets`);
      setSelectedAssets([]);
      loadAssets();
    } catch (err) {
      setError('Failed to add labels');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkDownload = async () => {
    if (selectedAssets.length === 0) return;

    setBulkProcessing(true);
    try {
      setSuccess(`📥 Downloading ${selectedAssets.length} assets...`);

      for (const assetId of selectedAssets) {
        const asset = assets.find(a => a.id === assetId);
        if (!asset || asset.s3_url_raw?.includes('mock-s3.dev')) continue;

        try {
          const response = await fetch(asset.s3_url_raw);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = asset.name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
          console.error(`Failed to download ${asset.name}:`, err);
        }
      }

      setSuccess(`✅ Downloaded ${selectedAssets.length} assets`);
      setSelectedAssets([]);
    } catch (err) {
      setError('Bulk download failed');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkChangeType = async () => {
    if (!batchChangeType) {
      setError('Please select a new asset type');
      return;
    }

    if (!window.confirm(`Change asset type for ${selectedAssets.length} assets to ${batchChangeType}?`)) {
      return;
    }

    setBulkProcessing(true);
    try {
      await assetService.bulkChangeType(selectedAssets, batchChangeType);
      setSuccess(`✅ Changed type for ${selectedAssets.length} assets`);
      setSelectedAssets([]);
      setBatchChangeType('');
      setShowTypeChangeModal(false);
      loadAssets();
    } catch (err) {
      setError('Bulk type change failed');
    } finally {
      setBulkProcessing(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterMediaType('all');
    setFilterLabels([]);
    setSortBy('created_at');
  };

  // Get category badge for asset
  const getCategoryBadge = (asset) => {
    let group = '';
    
    // Check asset_group only if it matches our expected categories
    const assetGroup = (asset.asset_group || '').toUpperCase();
    if (['CHARACTERS', 'ICONS', 'BRANDING', 'BACKGROUNDS'].includes(assetGroup)) {
      group = assetGroup;
    }
    
    // If no valid group, derive from asset_role or asset_type
    if (!group) {
      // asset_role might be the string "undefined", check for that
      const role = asset.asset_role && asset.asset_role !== 'undefined' ? asset.asset_role : '';
      const type = asset.asset_type || '';
      const roleOrType = (role || type).toUpperCase();
      
      if (roleOrType.includes('BG.') || roleOrType.includes('BACKGROUND')) {
        group = 'BACKGROUNDS';
      } else if (roleOrType.includes('CHAR.') || roleOrType.includes('PROMO_') || roleOrType.includes('LALA') || roleOrType.includes('JUSTAWOMAN') || roleOrType.includes('GUEST') || roleOrType.includes('CHARACTER')) {
        group = 'CHARACTERS';
      } else if (roleOrType.includes('UI.') || roleOrType.includes('ICON') || roleOrType.includes('BRAND_LOGO')) {
        group = 'ICONS';
      } else if (roleOrType.includes('BRAND') || roleOrType.includes('BANNER') || roleOrType.includes('SOCIAL')) {
        group = 'BRANDING';
      }
    }
    
    if (group === 'CHARACTERS') return { icon: '👥', label: 'Characters' };
    if (group === 'ICONS') return { icon: '🎨', label: 'Icons' };
    if (group === 'BRANDING') return { icon: '🏷️', label: 'Branding' };
    if (group === 'BACKGROUNDS') return { icon: '🖼️', label: 'Backgrounds' };
    return { icon: '📦', label: 'Other' };
  };

  const categoryCounts = useMemo(() => {
    const counts = { ALL: assets.length, CHARACTERS: 0, ICONS: 0, BRANDING: 0, BACKGROUNDS: 0, OTHER: 0 };
    for (const a of assets) {
      const badge = getCategoryBadge(a);
      const category = badge.label.toUpperCase();
      console.log(`"${a.name}": type="${a.asset_type}" -> ${category}`);
      if (counts[category] !== undefined) {
        counts[category] += 1;
      }
    }
    console.log('📊 Final counts:', counts);
    return counts;
  }, [assets]);

  // Filter assets by selected category (tabs)
  const filteredAssets = useMemo(() => {
    let filtered = filterCategory === 'ALL' ? assets : assets.filter(asset => getCategoryBadge(asset).label.toUpperCase() === filterCategory);
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(asset => 
        asset.name?.toLowerCase().includes(query) ||
        asset.description?.toLowerCase().includes(query) ||
        asset.asset_group?.toLowerCase().includes(query) ||
        asset.purpose?.toLowerCase().includes(query) ||
        (asset.labels && asset.labels.some(label => label.name?.toLowerCase().includes(query)))
      );
    }

    // Filter by selected asset types
    if (selectedAssetTypes.length > 0) {
      filtered = filtered.filter(asset => 
        selectedAssetTypes.includes(asset.asset_type)
      );
    }

    return filtered;
  }, [assets, filterCategory, searchQuery, selectedAssetTypes]);

  const hasActiveFilters = !!searchQuery || filterMediaType !== 'all' || filterLabels.length > 0 || sortBy !== 'created_at';
  const currentCategoryTitle = mainCategories[filterCategory]
    ? `${mainCategories[filterCategory].icon} ${mainCategories[filterCategory].label}`
    : 'Assets';

  return (
    <div className="asset-manager">
      <div className="asset-manager-container">
        {/* Header */}
        <div className="asset-manager-header">
          <div>
            <h1>📸 Asset Library</h1>
            <p>Browse and manage all your uploaded assets</p>
          </div>

          <div className="header-stats">
            <div className="stat-card">
              <div className="stat-label">Total Assets</div>
              <div className="stat-value">{assets.length}</div>
            </div>
            {selectedAssets.length > 0 && (
              <div className="stat-card selected">
                <div className="stat-label">Selected</div>
                <div className="stat-value">{selectedAssets.length}</div>
              </div>
            )}
          </div>
        </div>

        {/* Info Banner - How to Upload */}
        <div className="info-banner">
          <div className="info-banner-icon">💡</div>
          <div className="info-banner-content">
            <strong>Want to upload assets?</strong> Go to an episode's Assets tab to upload files. All assets must be linked to episodes.
          </div>
          <button 
            className="info-banner-btn"
            onClick={() => {
              if (referrerEpisodeId) {
                navigate(`/episodes/${referrerEpisodeId}`, { state: { tab: 'assets' } });
              } else {
                navigate('/episodes');
              }
            }}
          >
            {referrerEpisodeId ? '← Back to Assets Tab' : 'Go to Assets →'}
          </button>
        </div>

        {/* Category Tabs */}
        <div className="category-tabs">
          {Object.entries(mainCategories).map(([key, cat]) => (
            <button
              key={key}
              className={`category-tab ${filterCategory === key ? 'active' : ''}`}
              onClick={() => setFilterCategory(key)}
            >
              <span className="tab-icon">{cat.icon}</span>
              <span className="tab-label">{cat.label}</span>
              {key !== 'ALL' && <span className="tab-count">{categoryCounts[key] || 0}</span>}
            </button>
          ))}
        </div>

        {/* Command Bar */}
        <div className="commandbar">
          <div className="commandbar-row">
            <div className="commandbar-search">
              <span className="search-icon">🔎</span>
              <input
                type="text"
                placeholder="Search by name, tags, description, or folder..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input unified"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="icon-btn"
                  title="Clear search"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="commandbar-controls">
              <details className="labels-dropdown">
                <summary className="control labels-summary">
                  🎨 Asset Types {selectedAssetTypes.length > 0 ? `(${selectedAssetTypes.length})` : ''}
                </summary>
                <div className="labels-panel" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {Object.values(assetTypesByCategory).flatMap(types => types).map(type => {
                    const active = selectedAssetTypes.includes(type.value);
                    return (
                      <button
                        type="button"
                        key={type.value}
                        className={`label-option ${active ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedAssetTypes(prev =>
                            prev.includes(type.value)
                              ? prev.filter(t => t !== type.value)
                              : [...prev, type.value]
                          );
                        }}
                      >
                        <span className="label-name">{type.label}</span>
                        {active && <span className="label-check">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </details>

              <select
                value={filterMediaType}
                onChange={(e) => setFilterMediaType(e.target.value)}
                className="control"
                title="Media type"
              >
                <option value="all">All Media</option>
                <option value="image">🖼️ Images</option>
                <option value="video">🎥 Videos</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="control"
                title="Sort"
              >
                <option value="created_at">Newest</option>
                <option value="name">Name A–Z</option>
                <option value="file_size_bytes">Largest</option>
              </select>

              <details className="labels-dropdown">
                <summary className="control labels-summary">
                  🏷️ Labels {filterLabels.length > 0 ? `(${filterLabels.length})` : ''}
                </summary>
                <div className="labels-panel">
                  {allLabels.length === 0 ? (
                    <div className="labels-empty">No labels yet</div>
                  ) : (
                    allLabels.map(label => {
                      const active = filterLabels.includes(label.id);
                      return (
                        <button
                          type="button"
                          key={label.id}
                          className={`label-option ${active ? 'active' : ''}`}
                          onClick={() => {
                            setFilterLabels(prev =>
                              prev.includes(label.id)
                                ? prev.filter(id => id !== label.id)
                                : [...prev, label.id]
                            );
                          }}
                        >
                          <span className="label-dot" style={{ background: label.color }} />
                          <span className="label-name">{label.name}</span>
                          {active && <span className="label-check">✓</span>}
                        </button>
                      );
                    })
                  )}
                </div>
              </details>

              <div className="view-toggle compact" title="View mode">
                <button
                  type="button"
                  className={viewMode === 'grid' ? 'active' : ''}
                  onClick={() => setViewMode('grid')}
                >
                  ⊞
                </button>
                <button
                  type="button"
                  className={viewMode === 'list' ? 'active' : ''}
                  onClick={() => setViewMode('list')}
                >
                  ☰
                </button>
              </div>

              {hasActiveFilters && (
                <button type="button" className="btn-clear compact" onClick={clearFilters}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="commandbar-chips">
              {searchQuery && (
                <button type="button" className="chip" onClick={() => setSearchQuery('')}>
                  Search: "{searchQuery}" <span className="chip-x">✕</span>
                </button>
              )}
              {filterMediaType !== 'all' && (
                <button type="button" className="chip" onClick={() => setFilterMediaType('all')}>
                  Media: {filterMediaType} <span className="chip-x">✕</span>
                </button>
              )}
              {sortBy !== 'created_at' && (
                <button type="button" className="chip" onClick={() => setSortBy('created_at')}>
                  Sort: {sortBy} <span className="chip-x">✕</span>
                </button>
              )}
              {filterLabels.map(id => {
                const label = allLabels.find(l => l.id === id);
                if (!label) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    className="chip"
                    onClick={() => setFilterLabels(prev => prev.filter(x => x !== id))}
                  >
                    <span className="chip-dot" style={{ background: label.color }} />
                    {label.name}
                    <span className="chip-x">✕</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <div className="alert alert-error">
            <span>❌</span>
            <span>{error}</span>
            <button className="alert-close" onClick={() => setError(null)}>✕</button>
          </div>
        )}
        {success && (
          <div className="alert alert-success">
            <span>✅</span>
            <span>{success}</span>
            <button className="alert-close" onClick={() => setSuccess(null)}>✕</button>
          </div>
        )}

        {/* Bulk Actions Toolbar */}
        {selectedAssets.length > 0 && (
          <div className="bulk-actions-bar">
            <div className="bulk-info">
              <input
                type="checkbox"
                checked={selectedAssets.length === filteredAssets.length}
                onChange={handleSelectAll}
              />
              <span>{selectedAssets.length} selected</span>
            </div>

            <div className="bulk-buttons">
              <button onClick={handleBulkDownload} disabled={bulkProcessing} className="btn-bulk">
                📥 Download
              </button>

              <button onClick={() => setShowTypeChangeModal(true)} disabled={bulkProcessing} className="btn-bulk">
                🏷️ Change Type
              </button>

              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkAddLabel(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="bulk-label-select"
                disabled={bulkProcessing}
              >
                <option value="">+ Add Label...</option>
                {allLabels.map(label => (
                  <option key={label.id} value={label.id}>
                    {label.name}
                  </option>
                ))}
              </select>

              <button onClick={handleBulkDelete} disabled={bulkProcessing} className="btn-bulk btn-danger">
                🗑️ Delete
              </button>

              <button onClick={() => setSelectedAssets([])} className="btn-bulk">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Assets Grid/List */}
        <div className="assets-section">
          <div className="assets-header compact">
            <h2>
              {currentCategoryTitle}
              <span className="asset-count">{filteredAssets.length}</span>
            </h2>

            <button className="btn-refresh" type="button" onClick={loadAssets} disabled={loading}>
              ↻ Refresh
            </button>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading assets...</p>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <h3>No Assets Found</h3>
              {assets.length === 0 ? (
                <div>
                  <p>You haven't uploaded any assets yet.</p>
                  <button 
                    className="btn-primary"
                    onClick={() => navigate('/episodes')}
                    style={{ marginTop: '1rem' }}
                  >
                    Go to Episodes to Upload
                  </button>
                </div>
              ) : (
                <p>Try adjusting your filters.</p>
              )}
            </div>
          ) : (
            <>
              <div className={`assets-grid ${viewMode}`}>
                {filteredAssets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(asset => {
                  const badge = getCategoryBadge(asset);
                  return (
                    <div key={asset.id} className="asset-wrapper">
                      {filterCategory === 'ALL' && (
                        <div className="asset-category-badge" title={badge.label}>
                          {badge.icon}
                        </div>
                      )}
                      <AssetCard
                        asset={asset}
                        onRefresh={() => loadAssets()}
                        onSelect={handleSelectAsset}
                        isSelected={selectedAssets.includes(asset.id)}
                        showSelection={true}
                        showActions={true}
                        onPreview={setPreviewAsset}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {filteredAssets.length > itemsPerPage && (
                <div className="pagination-controls">
                  <div className="pagination-info">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredAssets.length)} of {filteredAssets.length} assets
                  </div>
                  
                  <div className="pagination-buttons">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="pagination-btn"
                    >
                      ⟨⟨
                    </button>
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="pagination-btn"
                    >
                      ⟨ Prev
                    </button>
                    
                    <div className="pagination-pages">
                      {Array.from({ length: Math.ceil(filteredAssets.length / itemsPerPage) }, (_, i) => i + 1)
                        .filter(page => {
                          // Show first, last, current, and 2 on each side of current
                          const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
                          return page === 1 || page === totalPages || (page >= currentPage - 2 && page <= currentPage + 2);
                        })
                        .map((page, idx, arr) => (
                          <React.Fragment key={page}>
                            {idx > 0 && arr[idx - 1] !== page - 1 && <span className="pagination-ellipsis">...</span>}
                            <button
                              onClick={() => setCurrentPage(page)}
                              className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                            >
                              {page}
                            </button>
                          </React.Fragment>
                        ))}
                    </div>

                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage >= Math.ceil(filteredAssets.length / itemsPerPage)}
                      className="pagination-btn"
                    >
                      Next ⟩
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.ceil(filteredAssets.length / itemsPerPage))}
                      disabled={currentPage >= Math.ceil(filteredAssets.length / itemsPerPage)}
                      className="pagination-btn"
                    >
                      ⟩⟩
                    </button>
                  </div>

                  <div className="pagination-per-page">
                    <label>Per page:</label>
                    <select 
                      value={itemsPerPage} 
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="per-page-select"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewAsset && (
        <AssetPreviewModal
          asset={previewAsset}
          allAssets={filteredAssets}
          onClose={() => setPreviewAsset(null)}
          onRefresh={() => loadAssets()}
          onNavigate={(asset) => setPreviewAsset(asset)}
        />
      )}

      {/* Bulk Change Type Modal */}
      {showTypeChangeModal && (
        <div className="modal-backdrop" onClick={() => setShowTypeChangeModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Change Asset Type</h3>
              <button className="modal-close" onClick={() => setShowTypeChangeModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Select a new type for {selectedAssets.length} asset{selectedAssets.length > 1 ? 's' : ''}:</p>
              
              <div className="form-group">
                <label>New Asset Type</label>
                <select 
                  value={batchChangeType} 
                  onChange={(e) => setBatchChangeType(e.target.value)}
                  className="form-control"
                >
                  <option value="">Select type...</option>
                  {Object.entries(assetTypesByCategory).map(([category, types]) => (
                    <optgroup key={category} label={category}>
                      {types.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setShowTypeChangeModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleBulkChangeType}
                disabled={!batchChangeType || bulkProcessing}
              >
                {bulkProcessing ? 'Changing...' : 'Change Type'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetManager;