/**
 * AssetManager Component - UPDATED for Canonical Roles Integration
 * 
 * KEY CHANGES:
 * 1. Updated role suggestions to match canonical roles
 * 2. Import CANONICAL_ROLES from constants
 * 3. Better role validation and suggestions
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AssetCard from '../components/AssetCard';
import AssetPreviewModal from '../components/AssetPreviewModal';
import assetService from '../services/assetService';
import { CANONICAL_ROLES } from '../constants/canonicalRoles';
import './AssetManager.css';

const AssetManager = () => {
  const navigate = React.useRef(null);
  
  // Get navigate function from react-router-dom
  React.useEffect(() => {
    const { useNavigate } = require('react-router-dom');
    const nav = useNavigate();
    navigate.current = nav;
  }, []);
  
  // Asset state
  const [assets, setAssets] = useState([]);
  const [allLabels, setAllLabels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Upload state
  const [files, setFiles] = useState([]);
  const [mainCategory, setMainCategory] = useState('LALA');
  const [assetType, setAssetType] = useState('PROMO_LALA');
  const [description, setDescription] = useState('');
  const [assetRole, setAssetRole] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  // Add these new state variables at the top with other useState declarations
  const [episodes, setEpisodes] = useState([]);
  const [selectedEpisode, setSelectedEpisode] = useState(null);

  // Add this function to load episodes
  const loadEpisodes = async () => {
    try {
      const response = await fetch('/api/v1/episodes?limit=100&sortBy=episode_number&sortOrder=DESC');
      const data = await response.json();
      setEpisodes(data.data || []);
    } catch (err) {
      console.error('Error loading episodes:', err);
    }
  };

  // Update the wardrobe data state to include episode tracking and advanced features
  const [wardrobeData, setWardrobeData] = useState({
    // Basic Info
    clothingCategory: '',
    brand: '',
    website: '',
    purchaseLink: '',
    price: '',
    color: '',
    size: '',
    occasion: '',
    season: '',
    character: 'lala', // lala, justawoman, guest
    // Episode tracking
    episodeId: '',
    episodeNumber: '',
    episodeTitle: '',
    scene: '',
    timesWorn: 0,
    lastWorn: null,
    // Advanced Features
    outfitNotes: '', // Styling notes and special instructions
    isFavorite: false, // Mark favorite/frequently worn items
    outfitSetId: '', // Group items that go together
    outfitSetName: '', // Name of the outfit set
    previousEpisodes: [], // Array of episode IDs where this was worn
    plannedForEpisodes: [], // Array of future episode IDs
    tags: [] // Additional tags for organization
  });

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterMediaType, setFilterMediaType] = useState('all');
  const [filterLabels, setFilterLabels] = useState([]);
  const [sortBy, setSortBy] = useState('created_at');

  // Bulk operation state
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState('grid');
  const [previewAsset, setPreviewAsset] = useState(null);

  const fileInputRef = useRef(null);

  // Main categories structure (FIXED: icon separated from label to prevent duplicates)
  const mainCategories = {
    ALL: { label: 'All Assets', icon: '🗂️' },
    BACKGROUND: { label: 'Backgrounds', icon: '🌄' },
    LALA: { label: 'Lala', icon: '👩' },
    JUSTAWOMAN: { label: 'JustAWoman', icon: '💜' },
    GUEST: { label: 'Guest', icon: '👤' },
    WARDROBE: { label: 'Wardrobe', icon: '👗' }
  };

  // ✅ UPDATED: Category to canonical role mapping
  const suggestRoleFromCategory = (category) => {
    const suggestions = {
      'BACKGROUND': 'BG.MAIN',
      'LALA': 'CHAR.HOST.LALA',                           // ✅ UPDATED
      'JUSTAWOMAN': 'CHAR.HOST.JUSTAWOMANINHERPRIME',     // ✅ UPDATED
      'GUEST': 'CHAR.GUEST.1',                            // ✅ UPDATED
      'WARDROBE': 'WARDROBE.ITEM.1'
    };
    return suggestions[category] || '';
  };

  // ✅ NEW: Get suggested roles for current category
  const getSuggestedRolesForCategory = (category) => {
    switch(category) {
      case 'LALA':
        return [
          'CHAR.HOST.LALA',
          'BRAND.SHOW.TITLE_GRAPHIC',
          'BG.MAIN'
        ];
      case 'JUSTAWOMAN':
        return [
          'CHAR.HOST.JUSTAWOMANINHERPRIME',
          'BRAND.SHOW.TITLE_GRAPHIC'
        ];
      case 'GUEST':
        return [
          'CHAR.GUEST.1',
          'CHAR.GUEST.2'
        ];
      case 'BACKGROUND':
        return ['BG.MAIN'];
      case 'WARDROBE':
        return [
          'WARDROBE.ITEM.1',
          'WARDROBE.ITEM.2',
          'WARDROBE.ITEM.3',
          'WARDROBE.ITEM.4',
          'WARDROBE.ITEM.5',
          'WARDROBE.ITEM.6',
          'WARDROBE.ITEM.7',
          'WARDROBE.ITEM.8',
          'WARDROBE.PANEL'
        ];
      default:
        return [];
    }
  };

  // Asset types organized by main category
  const assetTypesByCategory = {
    BACKGROUND: [
      { value: 'BACKGROUND_VIDEO', label: '🎥 Background Video' },
      { value: 'BACKGROUND_IMAGE', label: '🖼️ Background Image' }
    ],
    LALA: [
      { value: 'PROMO_LALA', label: '📸 Lala Promo' },
      { value: 'LALA_VIDEO', label: '🎬 Lala Video' },
      { value: 'LALA_HEADSHOT', label: '👤 Lala Headshot' },
      { value: 'LALA_FULLBODY', label: '🧍 Lala Full Body' }
    ],
    JUSTAWOMAN: [
      { value: 'PROMO_JUSTAWOMANINHERPRIME', label: '💜 JustAWoman Promo' },
      { value: 'BRAND_LOGO', label: '🏷️ Brand Logo' },
      { value: 'BRAND_BANNER', label: '🎨 Brand Banner' },
      { value: 'BRAND_SOCIAL', label: '📱 Social Media Asset' }
    ],
    GUEST: [
      { value: 'PROMO_GUEST', label: '📸 Guest Promo' },
      { value: 'GUEST_VIDEO', label: '🎬 Guest Video' },
      { value: 'GUEST_HEADSHOT', label: '👤 Guest Headshot' }
    ],
    WARDROBE: [
      { value: 'CLOTHING_DRESS', label: '👗 Dress' },
      { value: 'CLOTHING_TOP', label: '👚 Top' },
      { value: 'CLOTHING_BOTTOM', label: '👖 Bottom' },
      { value: 'CLOTHING_SHOES', label: '👠 Shoes' },
      { value: 'CLOTHING_ACCESSORIES', label: '👜 Accessories' },
      { value: 'CLOTHING_JEWELRY', label: '💍 Jewelry' },
      { value: 'CLOTHING_PERFUME', label: '🌸 Perfume' }
    ]
  };

  // Clothing categories for wardrobe items
  const clothingCategories = [
    { value: 'dress', label: '👗 Dress' },
    { value: 'top', label: '👚 Top/Blouse' },
    { value: 'bottom', label: '👖 Pants/Skirt' },
    { value: 'shoes', label: '👠 Shoes' },
    { value: 'accessories', label: '👜 Accessories' },
    { value: 'jewelry', label: '💍 Jewelry' },
    { value: 'perfume', label: '🌸 Perfume' }
  ];

  const occasions = [
    { value: 'casual', label: 'Casual' },
    { value: 'formal', label: 'Formal' },
    { value: 'business', label: 'Business' },
    { value: 'evening', label: 'Evening' },
    { value: 'athletic', label: 'Athletic' }
  ];

  const seasons = [
    { value: 'spring', label: 'Spring' },
    { value: 'summer', label: 'Summer' },
    { value: 'fall', label: 'Fall' },
    { value: 'winter', label: 'Winter' },
    { value: 'all-season', label: 'All Season' }
  ];

  // Get current asset types based on selected category
  const currentAssetTypes = assetTypesByCategory[mainCategory] || [];

  // Get suggested roles for current category
  const suggestedRoles = getSuggestedRolesForCategory(mainCategory);

  // Update useEffect to load episodes
  useEffect(() => {
    loadAssets();
    loadLabels();
    loadEpisodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update asset type when upload category changes
  useEffect(() => {
    if (currentAssetTypes.length > 0) {
      setAssetType(currentAssetTypes[0].value);
    }
    // Auto-suggest role based on category
    const suggestedRole = suggestRoleFromCategory(mainCategory);
    if (suggestedRole) {
      setAssetRole(suggestedRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainCategory]);

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

      // NOTE: category tabs are handled client-side via getCategoryBadge.
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

  // Upload handlers
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setError(null);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      setFiles(droppedFiles);
      setError(null);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Please select at least one file');
      return;
    }

    // ✅ NEW: Validate asset role
    if (!assetRole) {
      setError('Please select or enter an asset role');
      return;
    }

    // ✅ NEW: Check if role is valid
    if (!CANONICAL_ROLES[assetRole]) {
      if (!window.confirm(`"${assetRole}" is not a standard canonical role. Upload anyway?`)) {
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setUploadProgress({});

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(prev => ({ ...prev, [file.name]: 'uploading' }));

        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('assetType', assetType);
          formData.append('assetRole', assetRole);

          // Build enhanced metadata
          const meta = {
            description,
            mainCategory,
            ...wardrobeData
          };

          // Clean empty values
          Object.keys(meta).forEach(key => {
            if (!meta[key]) delete meta[key];
          });

          formData.append('metadata', JSON.stringify(meta));

          await assetService.uploadAsset(formData);
          setUploadProgress(prev => ({ ...prev, [file.name]: 'success' }));
          successCount++;
        } catch (err) {
          console.error(`Upload error for ${file.name}:`, err);
          setUploadProgress(prev => ({ ...prev, [file.name]: 'error' }));
          failCount++;
        }
      }

      if (successCount > 0) {
        setSuccess(
          `✅ Uploaded ${successCount} asset${successCount > 1 ? 's' : ''} successfully!` +
          (failCount > 0 ? ` (${failCount} failed)` : '')
        );
      } else {
        setError(`❌ All ${failCount} uploads failed`);
      }

      // Reset form
      setFiles([]);
      setDescription('');
      setAssetRole('');
      setWardrobeData({
        clothingCategory: '',
        brand: '',
        website: '',
        purchaseLink: '',
        price: '',
        color: '',
        size: '',
        occasion: '',
        season: '',
        // NEW: Episode tracking
        episodeId: '',
        episodeNumber: '',
        episodeTitle: '',
        scene: '',
        timesWorn: 0,
        lastWorn: null
      });
      setSelectedEpisode(null);
      setUploadProgress({});
      document.getElementById('assetForm')?.reset();

      setTimeout(() => loadAssets(), 600);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload assets');
    } finally {
      setLoading(false);
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
    if (!confirm(`Delete ${selectedAssets.length} assets? This cannot be undone.`)) return;

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

  const handleBulkProcessBackground = async () => {
    if (!confirm(`Process background removal for ${selectedAssets.length} assets? This will use API credits.`)) return;

    setBulkProcessing(true);
    try {
      const result = await assetService.bulkProcessBackground(selectedAssets);
      setSuccess(`✅ Processed ${result.data.succeeded} assets successfully`);
      setSelectedAssets([]);
      loadAssets();
    } catch (err) {
      setError('Bulk processing failed');
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

  const clearFilters = () => {
    setSearchQuery('');
    setFilterMediaType('all');
    setFilterLabels([]);
    setSortBy('created_at');
  };

  // Get category badge for asset
  const getCategoryBadge = (asset) => {
    const type = asset.asset_type || '';
    if (type.includes('BACKGROUND')) return { icon: '🌄', label: 'Background' };
    if (type.includes('LALA')) return { icon: '👩', label: 'Lala' };
    if (type.includes('JUSTAWOMAN') || type.includes('BRAND')) return { icon: '💜', label: 'JustAWoman' };
    if (type.includes('GUEST')) return { icon: '👤', label: 'Guest' };
    if (type.includes('CLOTHING')) return { icon: '👗', label: 'Wardrobe' };
    return { icon: '📦', label: 'Other' };
  };

  const categoryCounts = useMemo(() => {
    const counts = { ALL: assets.length, BACKGROUND: 0, LALA: 0, JUSTAWOMAN: 0, GUEST: 0, WARDROBE: 0 };
    for (const a of assets) {
      const badge = getCategoryBadge(a).label.toUpperCase();
      if (counts[badge] !== undefined) counts[badge] += 1;
    }
    return counts;
  }, [assets]);

  // Filter assets by selected category (tabs)
  const filteredAssets = useMemo(() => {
    if (filterCategory === 'ALL') return assets;
    return assets.filter(asset => getCategoryBadge(asset).label.toUpperCase() === filterCategory);
  }, [assets, filterCategory]);

  const isWardrobeCategory = mainCategory === 'WARDROBE';

  const hasActiveFilters =
    !!searchQuery || filterMediaType !== 'all' || filterLabels.length > 0 || sortBy !== 'created_at';

  const currentCategoryTitle = mainCategories[filterCategory]
    ? `${mainCategories[filterCategory].icon} ${mainCategories[filterCategory].label}`
    : 'Assets';

  return (
    <div className="asset-manager">
      <div className="asset-manager-container">
        {/* Header */}
        <div className="asset-manager-header">
          <div>
            <h1>📸 Asset Manager</h1>
            <p>Organized asset library with wardrobe database and shopping links</p>
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

        {/* Unified Command Bar */}
        <div className="commandbar">
          <div className="commandbar-row">
            <div className="commandbar-search">
              <span className="search-icon">🔎</span>
              <input
                type="text"
                placeholder="Search by name, description, brand, etc…"
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
                  Search: “{searchQuery}” <span className="chip-x">✕</span>
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

        {/* Upload Section */}
        <div className="upload-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>📤 Upload New Asset</h2>
            <button 
              type="button" 
              onClick={() => navigate(-1)} 
              className="btn-secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              ← Back
            </button>
          </div>

          <form id="assetForm" onSubmit={handleUpload} className="upload-form">
            {/* Main Category Selection */}
            <div className="form-field">
              <label>Main Category *</label>
              <select
                value={mainCategory}
                onChange={(e) => setMainCategory(e.target.value)}
                required
                className="category-select"
              >
                {Object.entries(mainCategories)
                  .filter(([key]) => key !== 'ALL')
                  .map(([key, cat]) => (
                    <option key={key} value={key}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
              </select>
            </div>

            {/* Drag & Drop Zone */}
            <div
              className={`dropzone ${dragActive ? 'active' : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                id="file"
                onChange={handleFileChange}
                accept="image/*,video/*"
                multiple
                hidden
              />

              {files.length > 0 ? (
                <div className="dropzone-files">
                  <div className="files-header">
                    <strong>{files.length} file{files.length > 1 ? 's' : ''} selected</strong>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFiles([]);
                      }}
                      className="btn-clear-files"
                    >
                      ✕ Clear
                    </button>
                  </div>
                  <div className="files-list">
                    {files.map((file, idx) => {
                      const isVideo = file.type.startsWith('video/');
                      const status = uploadProgress[file.name];
                      return (
                        <div key={idx} className={`file-item ${status || ''}`}>
                          <span className="file-icon">{isVideo ? '🎥' : '🖼️'}</span>
                          <div className="file-info">
                            <div className="file-name">{file.name}</div>
                            <div className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                          </div>
                          {status === 'uploading' && <span className="spinner-sm"></span>}
                          {status === 'success' && <span>✅</span>}
                          {status === 'error' && <span>❌</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  <div className="dropzone-icon">📁</div>
                  <div className="dropzone-text">
                    <strong>Click to browse</strong> or drag and drop
                  </div>
                  <div className="dropzone-hint">Images (JPG, PNG, GIF, WebP) or Videos (MP4, MOV, WebM)</div>
                </>
              )}
            </div>

            {/* Form Fields */}
            <div className="form-grid">
              <div className="form-field">
                <label>Asset Type *</label>
                <select value={assetType} onChange={(e) => setAssetType(e.target.value)} required>
                  {currentAssetTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* ✅ UPDATED: Asset Role field with suggestions */}
              <div className="form-field">
                <label>
                  Asset Role * 
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 'normal' }}>
                    {' '}(Canonical role for thumbnail system)
                  </span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={assetRole}
                    onChange={(e) => setAssetRole(e.target.value)}
                    placeholder="e.g., CHAR.HOST.LALA, BG.MAIN"
                    title="Canonical role name (must match template roles)"
                    list="role-suggestions"
                    required
                    style={{ 
                      fontFamily: 'Monaco, monospace', 
                      fontSize: '0.875rem',
                      color: CANONICAL_ROLES[assetRole] ? '#065f46' : '#6b7280'
                    }}
                  />
                  <datalist id="role-suggestions">
                    {suggestedRoles.map(role => (
                      <option key={role} value={role}>
                        {CANONICAL_ROLES[role]?.label}
                      </option>
                    ))}
                  </datalist>
                  {assetRole && CANONICAL_ROLES[assetRole] && (
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: '#065f46', 
                      marginTop: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      ✓ Valid role: {CANONICAL_ROLES[assetRole].icon} {CANONICAL_ROLES[assetRole].label}
                    </div>
                  )}
                  {assetRole && !CANONICAL_ROLES[assetRole] && (
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: '#dc2626', 
                      marginTop: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      ⚠️ Not a standard canonical role
                    </div>
                  )}
                </div>
                {suggestedRoles.length > 0 && (
                  <div style={{ 
                    marginTop: '0.5rem', 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '0.5rem'
                  }}>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Suggested:</span>
                    {suggestedRoles.slice(0, 3).map(role => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setAssetRole(role)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          background: assetRole === role ? '#dbeafe' : '#f3f4f6',
                          border: '1px solid ' + (assetRole === role ? '#3b82f6' : '#e5e7eb'),
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontFamily: 'Monaco, monospace'
                        }}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-field">
                <label>Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the asset"
                />
              </div>
            </div>

            {/* Wardrobe/Clothing Details (only for WARDROBE category) */}
            {isWardrobeCategory && (
              <details className="wardrobe-details" open>
                <summary>👗 Wardrobe Details & Shopping Info</summary>

                <div className="form-grid wardrobe-grid">
                  <div className="form-field">
                    <label>Clothing Category</label>
                    <select
                      value={wardrobeData.clothingCategory}
                      onChange={(e) => setWardrobeData({ ...wardrobeData, clothingCategory: e.target.value })}
                    >
                      <option value="">Select category...</option>
                      {clothingCategories.map(cat => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Brand</label>
                    <input
                      type="text"
                      value={wardrobeData.brand}
                      onChange={(e) => setWardrobeData({ ...wardrobeData, brand: e.target.value })}
                      placeholder="e.g., Zara, H&M, Gucci"
                    />
                  </div>

                  <div className="form-field">
                    <label>Website/Store</label>
                    <input
                      type="text"
                      value={wardrobeData.website}
                      onChange={(e) => setWardrobeData({ ...wardrobeData, website: e.target.value })}
                      placeholder="e.g., www.zara.com"
                    />
                  </div>

                  <div className="form-field">
                    <label>Purchase/Affiliate Link</label>
                    <input
                      type="url"
                      value={wardrobeData.purchaseLink}
                      onChange={(e) => setWardrobeData({ ...wardrobeData, purchaseLink: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>

                  <div className="form-field">
                    <label>Price</label>
                    <input
                      type="text"
                      value={wardrobeData.price}
                      onChange={(e) => setWardrobeData({ ...wardrobeData, price: e.target.value })}
                      placeholder="$99.99"
                    />
                  </div>

                  <div className="form-field">
                    <label>Color</label>
                    <input
                      type="text"
                      value={wardrobeData.color}
                      onChange={(e) => setWardrobeData({ ...wardrobeData, color: e.target.value })}
                      placeholder="e.g., Black, Red, Floral"
                    />
                  </div>

                  <div className="form-field">
                    <label>Size</label>
                    <input
                      type="text"
                      value={wardrobeData.size}
                      onChange={(e) => setWardrobeData({ ...wardrobeData, size: e.target.value })}
                      placeholder="e.g., S, M, L, 8"
                    />
                  </div>

                  <div className="form-field">
                    <label>Occasion</label>
                    <select
                      value={wardrobeData.occasion}
                      onChange={(e) => setWardrobeData({ ...wardrobeData, occasion: e.target.value })}
                    >
                      <option value="">Select occasion...</option>
                      {occasions.map(occ => (
                        <option key={occ.value} value={occ.value}>
                          {occ.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Season</label>
                    <select
                      value={wardrobeData.season}
                      onChange={(e) => setWardrobeData({ ...wardrobeData, season: e.target.value })}
                    >
                      <option value="">Select season...</option>
                      {seasons.map(season => (
                        <option key={season.value} value={season.value}>
                          {season.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* NEW: Episode Tracking Section */}
                <div className="episode-tracking-section">
                  <h4 className="section-title">📺 Episode Tracking</h4>
                  <div className="form-grid wardrobe-grid">
                    <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                      <label>Worn in Episode (Optional)</label>
                      <select
                        value={wardrobeData.episodeId}
                        onChange={(e) => {
                          const ep = episodes.find(episode => episode.id === e.target.value);
                          setSelectedEpisode(ep || null);
                          setWardrobeData({
                            ...wardrobeData,
                            episodeId: e.target.value,
                            episodeNumber: ep?.episode_number || '',
                            episodeTitle: ep?.title || ''
                          });
                        }}
                      >
                        <option value="">Not worn yet / Select episode...</option>
                        {episodes.map(ep => (
                          <option key={ep.id} value={ep.id}>
                            Episode {ep.episode_number}: {ep.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {wardrobeData.episodeId && (
                      <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                        <label>Scene/Context (Optional)</label>
                        <input
                          type="text"
                          value={wardrobeData.scene}
                          onChange={(e) => setWardrobeData({ ...wardrobeData, scene: e.target.value })}
                          placeholder="e.g., Opening segment, Interview with guest, Closing"
                        />
                      </div>
                    )}
                  </div>

                  <div className="episode-tracking-info">
                    <div className="info-item">
                      <span className="info-icon">👕</span>
                      <span className="info-text">Track which episodes this item appears in</span>
                    </div>
                    <div className="info-item">
                      <span className="info-icon">📊</span>
                      <span className="info-text">Prevent outfit repetition and plan future looks</span>
                    </div>
                  </div>
                </div>

                {/* NEW: Advanced Features Section */}
                <div className="advanced-features-section">
                  <h4 className="section-title">✨ Advanced Features</h4>
                  
                  {/* Character Assignment */}
                  <div className="form-field" style={{ marginBottom: '1.5rem' }}>
                    <label>👤 Character/Person</label>
                    <select
                      value={wardrobeData.character}
                      onChange={(e) => setWardrobeData({ ...wardrobeData, character: e.target.value })}
                      style={{ width: '100%' }}
                    >
                      <option value="lala">💜 Lala</option>
                      <option value="justawoman">👩 Just a Woman in Her Prime</option>
                      <option value="guest">🎭 Guest</option>
                    </select>
                  </div>

                  {/* Outfit Notes */}
                  <div className="form-field" style={{ marginBottom: '1.5rem' }}>
                    <label>📝 Outfit Notes & Styling Tips</label>
                    <textarea
                      value={wardrobeData.outfitNotes}
                      onChange={(e) => setWardrobeData({ ...wardrobeData, outfitNotes: e.target.value })}
                      placeholder="Add styling notes, special instructions, or outfit context..."
                      rows="3"
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    />
                  </div>

                  {/* Favorite Item */}
                  <div className="form-field" style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={wardrobeData.isFavorite}
                        onChange={(e) => setWardrobeData({ ...wardrobeData, isFavorite: e.target.checked })}
                        style={{ width: 'auto' }}
                      />
                      <span>⭐ Mark as Favorite/Frequently Worn</span>
                    </label>
                  </div>

                  {/* Outfit Set */}
                  <div className="form-grid wardrobe-grid" style={{ marginBottom: '1.5rem' }}>
                    <div className="form-field">
                      <label>👔 Outfit Set ID</label>
                      <input
                        type="text"
                        value={wardrobeData.outfitSetId}
                        onChange={(e) => setWardrobeData({ ...wardrobeData, outfitSetId: e.target.value })}
                        placeholder="e.g., outfit-001"
                      />
                      <small style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                        Group items that go together (same ID for all pieces)
                      </small>
                    </div>
                    <div className="form-field">
                      <label>Outfit Set Name</label>
                      <input
                        type="text"
                        value={wardrobeData.outfitSetName}
                        onChange={(e) => setWardrobeData({ ...wardrobeData, outfitSetName: e.target.value })}
                        placeholder="e.g., Spring Business Look"
                      />
                    </div>
                  </div>

                  {/* Tags Input */}
                  <div className="form-field" style={{ marginBottom: '1.5rem' }}>
                    <label>🏷️ Tags (comma-separated)</label>
                    <input
                      type="text"
                      value={wardrobeData.tags.join(', ')}
                      onChange={(e) => setWardrobeData({ 
                        ...wardrobeData, 
                        tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag) 
                      })}
                      placeholder="e.g., sparkly, vintage, designer, casual-chic"
                    />
                    <small style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      Add custom tags to organize and search wardrobe items
                    </small>
                  </div>

                  {/* Feature Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
                    <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fbbf24' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔁</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#92400e' }}>Repeat Prevention</div>
                      <div style={{ fontSize: '0.75rem', color: '#78350f', marginTop: '0.25rem' }}>
                        Automatically tracks previous episodes
                      </div>
                    </div>
                    <div style={{ padding: '1rem', background: '#dbeafe', borderRadius: '8px', border: '1px solid #3b82f6' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📅</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e40af' }}>Outfit Planning</div>
                      <div style={{ fontSize: '0.75rem', color: '#1e3a8a', marginTop: '0.25rem' }}>
                        Plan outfits for upcoming episodes
                      </div>
                    </div>
                    <div style={{ padding: '1rem', background: '#d1fae5', borderRadius: '8px', border: '1px solid #10b981' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>💰</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#065f46' }}>Budget Tracking</div>
                      <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: '0.25rem' }}>
                        Track spending per episode/character
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            )}

            {/* Submit Button */}
            <button type="submit" disabled={loading || files.length === 0} className="btn-upload">
              {loading ? (
                <>
                  <span className="spinner-sm"></span>
                  <span>Uploading {files.length} file{files.length > 1 ? 's' : ''}...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>
                    Upload {files.length > 0 ? `${files.length} ` : ''}Asset{files.length > 1 ? 's' : ''}
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Alerts */}
          {error && (
            <div className="alert alert-error">
              <span>❌</span>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="alert alert-success">
              <span>✅</span>
              <span>{success}</span>
            </div>
          )}
        </div>

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

              <button onClick={handleBulkProcessBackground} disabled={bulkProcessing} className="btn-bulk">
                🎨 Remove BG
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
              <p>Try adjusting filters or upload your first asset.</p>
            </div>
          ) : (
            <div className={`assets-grid ${viewMode}`}>
              {filteredAssets.map(asset => {
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
    </div>
  );
};

export default AssetManager;
