/**
 * EpisodeWardrobe Component
 * Shows all wardrobe items used in a specific episode
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config/api';
import WardrobeCalendarView from './WardrobeCalendarView';
import wardrobeEnhancements from '../utils/wardrobeEnhancements';
import './EpisodeWardrobe.css';

const EpisodeWardrobe = ({ episodeId, episodeNumber }) => {
  const navigate = useNavigate();
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCharacter, setActiveCharacter] = useState('all');
  
  // Select existing items modal
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [availableItems, setAvailableItems] = useState([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 10000 });
  const [sortBy, setSortBy] = useState('name'); // name, price-asc, price-desc, recent

  // View mode states
  const [viewMode, setViewMode] = useState('grid'); // grid, calendar
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  // 3-dot menu state
  const [openMenuItemId, setOpenMenuItemId] = useState(null);

  const loadEpisodeWardrobe = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/episodes/${episodeId}/wardrobe`);

      if (!response.ok) {
        console.error('Failed to load wardrobe:', response.status);
        setWardrobeItems([]);
        return;
      }

      const text = await response.text();
      if (!text) {
        setWardrobeItems([]);
        return;
      }

      const data = JSON.parse(text);
      const items = data.data || [];
      console.log('Loaded wardrobe items:', items.length);
      // Log items with processed URLs for debugging
      const processedItems = items.filter(item => item.s3_url_processed);
      if (processedItems.length > 0) {
        console.log('Items with processed backgrounds:', processedItems.map(i => ({ id: i.id, name: i.name, url: i.s3_url_processed })));
      }
      setWardrobeItems(items);
    } catch (err) {
      console.error('Error loading episode wardrobe:', err);
      setWardrobeItems([]);
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => {
    loadEpisodeWardrobe();
  }, [loadEpisodeWardrobe]);

  // Reload data when window regains focus (for cross-tab/page sync)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadEpisodeWardrobe();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadEpisodeWardrobe]);
  
  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openMenuItemId && !e.target.closest('.item-menu-container')) {
        setOpenMenuItemId(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuItemId]);

  const openSelectModal = async () => {
    try {
      setLoadingAvailable(true);
      setShowSelectModal(true);
      
      // Load staging items (unassigned items)
      const response = await fetch(`${API_URL}/wardrobe/staging`);
      if (!response.ok) throw new Error('Failed to load available items');
      const data = await response.json();
      setAvailableItems(data.data || []);
    } catch (err) {
      console.error('Error loading available items:', err);
      setAvailableItems([]);
    } finally {
      setLoadingAvailable(false);
    }
  };

  // Link existing item to this episode
  const linkExistingItem = async (wardrobeId) => {
    try {
      const response = await fetch(`${API_URL}/episodes/${episodeId}/wardrobe/${wardrobeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene: null, notes: null })
      });

      if (!response.ok) throw new Error('Failed to link item');

      // Reload wardrobe
      await loadEpisodeWardrobe();
      setShowSelectModal(false);
      setSelectedItemId(null);
    } catch (err) {
      console.error('Error linking item:', err);
      alert(`Failed to link item: ${err.message}`);
    }
  };

  // Toggle episode-level favorite
  const toggleFavorite = async (item) => {
    try {
      const newFavoriteState = !item.is_episode_favorite;
      
      const response = await fetch(`${API_URL}/episodes/${episodeId}/wardrobe/${item.id}/favorite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: newFavoriteState })
      });

      if (!response.ok) throw new Error('Failed to toggle favorite');

      // Update local state
      setWardrobeItems(prev => prev.map(w => 
        w.id === item.id ? { ...w, is_episode_favorite: newFavoriteState } : w
      ));
    } catch (err) {
      console.error('Error toggling favorite:', err);
      alert(`Failed to toggle favorite: ${err.message}`);
    }
  };

  // Unlink item from episode (not global delete)
  const handleDelete = async (item) => {
    if (!window.confirm(`Unlink "${item.name}" from this episode?\n\nThis will NOT delete the item globally - it will only remove it from this episode. The item will remain available for other episodes.`)) {
      return;
    }

    try {
      // Unlink from this episode
      const response = await fetch(`${API_URL}/episodes/${episodeId}/wardrobe/${item.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to unlink item from episode');

      // Reload wardrobe items
      await loadEpisodeWardrobe();
    } catch (err) {
      console.error('Error removing wardrobe item:', err);
      alert('Failed to remove wardrobe item from episode. Please try again.');
    }
  };

  const handleDownloadImage = async (item, useProcessed = false) => {
    const imageUrl = useProcessed && item.s3_url_processed ? item.s3_url_processed : item.s3_url;
    if (!imageUrl) {
      alert('No image available to download');
      return;
    }

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const suffix = useProcessed ? '_no_bg' : '';
      a.download = `${item.name.replace(/[^a-z0-9]/gi, '_')}${suffix}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download image. You can right-click and save the image directly.');
    }
  };

  const handlePrintItem = (item) => {
    const printWindow = window.open('', '_blank');
    const imageUrl = item.s3_url_processed || item.s3_url;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print: ${item.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .image { text-align: center; margin: 20px 0; }
            .image img { max-width: 400px; max-height: 500px; }
            .details { margin-top: 20px; }
            .detail-row { margin: 10px 0; display: flex; }
            .detail-label { font-weight: bold; min-width: 120px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${item.name}</h1>
            <p><strong>Character:</strong> ${item.character}</p>
          </div>
          ${imageUrl ? `<div class="image"><img src="${imageUrl}" alt="${item.name}" /></div>` : ''}
          <div class="details">
            ${item.brand ? `<div class="detail-row"><span class="detail-label">Brand:</span><span>${item.brand}</span></div>` : ''}
            ${item.clothing_category ? `<div class="detail-row"><span class="detail-label">Category:</span><span>${item.clothing_category}</span></div>` : ''}
            ${item.price ? `<div class="detail-row"><span class="detail-label">Price:</span><span>$${item.price}</span></div>` : ''}
            ${item.color ? `<div class="detail-row"><span class="detail-label">Color:</span><span>${item.color}</span></div>` : ''}
            ${item.size ? `<div class="detail-row"><span class="detail-label">Size:</span><span>${item.size}</span></div>` : ''}
            ${item.metadata?.season ? `<div class="detail-row"><span class="detail-label">Season:</span><span>${item.metadata.season}</span></div>` : ''}
            ${item.metadata?.occasion ? `<div class="detail-row"><span class="detail-label">Occasion:</span><span>${item.metadata.occasion}</span></div>` : ''}
            ${item.metadata?.outfitNotes ? `<div class="detail-row"><span class="detail-label">Notes:</span><span>${item.metadata.outfitNotes}</span></div>` : ''}
            ${item.purchase_link ? `<div class="detail-row"><span class="detail-label">Purchase Link:</span><span>${item.purchase_link}</span></div>` : ''}
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  // Navigate to wardrobe page to edit item
  const openEditForm = (item) => {
    navigate('/wardrobe');
  };

  // Group by character first
  const groupedByCharacter = wardrobeItems.reduce((acc, item) => {
    const character = item.character || 'unassigned';
    if (!acc[character]) acc[character] = [];
    acc[character].push(item);
    return acc;
  }, {});

  // Apply all filters
  let filteredItems = wardrobeItems;

  // Character filter
  if (activeCharacter !== 'all') {
    filteredItems = filteredItems.filter((item) => (item.character || 'unassigned') === activeCharacter);
  }

  // Search filter (name, brand, color, tags)
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredItems = filteredItems.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const brand = (item.brand || '').toLowerCase();
      const color = (item.color || '').toLowerCase();
      const tags = (item.tags || []).join(' ').toLowerCase();
      return name.includes(query) || brand.includes(query) || color.includes(query) || tags.includes(query);
    });
  }

  // Category filter
  if (filterCategory !== 'all') {
    filteredItems = filteredItems.filter((item) => item.clothing_category === filterCategory);
  }

  // Price range filter
  filteredItems = filteredItems.filter((item) => {
    const price = parseFloat(item.price || 0);
    return price >= priceRange.min && price <= priceRange.max;
  });

  // Sort items
  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.name || '').localeCompare(b.name || '');
      case 'price-asc':
        return (
          parseFloat(a.price || 0) -
          parseFloat(b.price || 0)
        );
      case 'price-desc':
        return (
          parseFloat(b.price || 0) -
          parseFloat(a.price || 0)
        );
      case 'recent':
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      default:
        return 0;
    }
  });

  filteredItems = sortedItems;
  
  // Apply pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  const groupedByCategory = paginatedItems.reduce((acc, item) => {
    const category = item.clothing_category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  const categoryLabels = {
    dress: '👗 Dresses',
    top: '👚 Tops',
    bottom: '👖 Bottoms',
    shoes: '👠 Shoes',
    accessories: '👜 Accessories',
    jewelry: '💍 Jewelry',
    perfume: '🌸 Perfume',
    other: '📦 Other'
  };

  // Calculate budget statistics
  const totalBudget = wardrobeItems.reduce((sum, item) => {
    const price = parseFloat(item.price || 0);
    return sum + price;
  }, 0);

  const budgetByCharacter = wardrobeItems.reduce((acc, item) => {
    const character = item.character || 'unassigned';
    const price = parseFloat(item.price || 0);
    acc[character] = (acc[character] || 0) + price;
    return acc;
  }, {});

  // Group items by outfit set
  const outfitSets = wardrobeItems.reduce((acc, item) => {
    const setId = item.outfit_set_id;
    if (setId) {
      if (!acc[setId]) {
        acc[setId] = {
          id: setId,
          name: item.outfit_set_name || `Outfit Set ${setId}`,
          items: []
        };
      }
      acc[setId].items.push(item);
    }
    return acc;
  }, {});

  // Find favorite items
  const favoriteItems = wardrobeItems.filter((item) => item.is_favorite);

  // ✅ UPDATED loading + empty handling (no early return for empty)
  if (loading) {
    return (
      <div className="episode-wardrobe loading">
        <div className="spinner"></div>
        <p>Loading wardrobe...</p>
      </div>
    );
  }

  const isEmpty = wardrobeItems.length === 0;

  return (
    <>
      {isEmpty ? (
        <div className="episode-wardrobe empty">
          <div className="empty-icon">👗</div>
          <h3>No Wardrobe Items</h3>
          <p>No clothing items have been linked to this episode yet</p>
          <button className="btn-add-wardrobe" onClick={openSelectModal}>
            ➕ Select Existing Items
          </button>
          <button 
            className="btn-upload-redirect" 
            onClick={() => navigate('/wardrobe/manager')}
            style={{ marginTop: '1rem' }}
          >
            📦 Upload New Items (Wardrobe Manager)
          </button>
        </div>
      ) : (
        <div className="episode-wardrobe">
          {/* Compact Toolbar 1: Title + Stats + Actions */}
          <div className="wardrobe-toolbar-main">
            <div className="toolbar-left">
              <h2 className="wardrobe-title">👗 Episode {episodeNumber} Wardrobe</h2>
              <div className="stats-inline">
                <span className="stat-inline">{wardrobeItems.length} items</span>
                <span className="stat-divider">·</span>
                <span className="stat-inline">{Object.keys(groupedByCharacter).length} characters</span>
                <span className="stat-divider">·</span>
                <span className="stat-inline">${totalBudget.toFixed(2)}</span>
                {favoriteItems.length > 0 && (
                  <>
                    <span className="stat-divider">·</span>
                    <span className="stat-inline">⭐ {favoriteItems.length}</span>
                  </>
                )}
              </div>
            </div>
            <div className="toolbar-right">
              <button
                className="btn-compact btn-secondary"
                onClick={() => navigate('/wardrobe')}
                title="Gallery"
              >
                🖼️
              </button>
              <button
                className="btn-compact btn-secondary"
                onClick={() => navigate('/wardrobe/analytics')}
                title="Analytics"
              >
                📊
              </button>
              <button
                className="btn-compact btn-secondary"
                onClick={() => wardrobeEnhancements.exportToPDF(wardrobeItems, {
                  title: `Episode ${episodeNumber} Wardrobe`,
                  character: activeCharacter === 'all' ? 'All' : activeCharacter,
                  includeDetails: true
                })}
                title="Export PDF"
              >
                📄
              </button>
              <button
                className="btn-compact btn-primary"
                onClick={openSelectModal}
              >
                ➕ Select Items
              </button>
              <button
                className="btn-compact"
                onClick={() => navigate('/wardrobe')}
                style={{ background: '#9b59b6', color: 'white', border: 'none' }}
              >
                📦 Upload New
              </button>
              <div className="view-mode-compact">
                <button
                  className={`view-btn-mini ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid"
                >
                  ⊞
                </button>
                <button
                  className={`view-btn-mini ${viewMode === 'calendar' ? 'active' : ''}`}
                  onClick={() => setViewMode('calendar')}
                  title="Calendar"
                >
                  📅
                </button>
              </div>
            </div>
          </div>

          {/* Compact Toolbar 2: Character Tabs + Search + Filters */}
          <div className="wardrobe-toolbar-controls">
            <div className="character-tabs-compact">
              <button
                className={`char-tab ${activeCharacter === 'all' ? 'active' : ''}`}
                onClick={() => setActiveCharacter('all')}
              >
                All
              </button>
              <button
                className={`char-tab ${activeCharacter === 'lala' ? 'active' : ''}`}
                onClick={() => setActiveCharacter('lala')}
              >
                💜 Lala {groupedByCharacter.lala && `(${groupedByCharacter.lala.length})`}
              </button>
              <button
                className={`char-tab ${activeCharacter === 'justawoman' ? 'active' : ''}`}
                onClick={() => setActiveCharacter('justawoman')}
              >
                👩 Just a Woman {groupedByCharacter.justawoman && `(${groupedByCharacter.justawoman.length})`}
              </button>
              <button
                className={`char-tab ${activeCharacter === 'guest' ? 'active' : ''}`}
                onClick={() => setActiveCharacter('guest')}
              >
                🎭 Guest {groupedByCharacter.guest && `(${groupedByCharacter.guest.length})`}
              </button>
            </div>

            <div className="search-compact">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search wardrobe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-search" onClick={() => setSearchQuery('')}>✕</button>
              )}
            </div>

            <div className="filters-compact">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="filter-compact"
              >
                <option value="all">All Categories</option>
                <option value="dress">Dresses</option>
                <option value="top">Tops</option>
                <option value="bottom">Bottoms</option>
                <option value="shoes">Shoes</option>
                <option value="accessories">Accessories</option>
                <option value="jewelry">Jewelry</option>
                <option value="perfume">Perfume</option>
              </select>

              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)} 
                className="filter-compact"
              >
                <option value="name">A-Z</option>
                <option value="price-asc">Price ↑</option>
                <option value="price-desc">Price ↓</option>
                <option value="recent">Recent</option>
              </select>

              <div className="price-range-compact" title={`$${priceRange.min} - $${priceRange.max}`}>
                <span>💰</span>
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="100"
                  value={priceRange.max}
                  onChange={(e) => setPriceRange({ ...priceRange, max: parseInt(e.target.value) })}
                />
                <span className="price-label">${priceRange.max}</span>
              </div>
            </div>
          </div>

          {/* Calendar View */}
          {viewMode === 'calendar' && <WardrobeCalendarView items={filteredItems} onEditItem={openEditForm} />}

          {/* Grid View (default) */}
          {viewMode === 'grid' && (
            <>
              {/* Favorites Section */}
              {favoriteItems.length > 0 && activeCharacter === 'all' && (
                <div className="favorites-section">
                  <h3 className="section-title">⭐ Favorite Items</h3>
                  <div className="wardrobe-items-grid">
                    {favoriteItems.map((item) => (
                      <div key={item.id} className="wardrobe-item-card favorite">
                        <div className="favorite-badge">⭐</div>

                        <div className="item-image">
                          {item.s3_url ? (
                            <img
                              src={item.s3_url}
                              alt={item.name}
                              onError={(e) => {
                                e.target.src =
                                  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect fill="%23e0e0e0" width="150" height="150"/><text x="75" y="75" text-anchor="middle" fill="%23999" font-size="14" dy=".3em" dominant-baseline="middle">👗</text></svg>';
                              }}
                            />
                          ) : (
                            <div className="placeholder-image">👗</div>
                          )}
                        </div>

                        <div className="item-details">
                          <h4 className="item-name">{item.name}</h4>
                          {item.brand && <p className="item-brand">{item.brand}</p>}
                          <span className="item-category-badge">
                            {item.clothing_category || 'Uncategorized'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Outfit Sets Section */}
              {Object.keys(outfitSets).length > 0 && activeCharacter === 'all' && (
                <div className="outfit-sets-section">
                  <h3 className="section-title">👔 Complete Outfit Sets</h3>
                  {Object.entries(outfitSets).map(([setId, set]) => (
                    <div key={setId} className="outfit-set">
                      <h4 className="outfit-set-name">
                        {set.name || `Outfit Set ${setId}`}
                        <span className="item-count">{set.items.length} items</span>
                      </h4>
                      <div className="wardrobe-items-grid">
                        {set.items.map((item) => (
                          <div key={item.id} className="wardrobe-item-card outfit-set-item">
                            <div className="outfit-set-badge">👔 {set.name || `Set ${setId}`}</div>

                            <div className="item-image">
                              {item.s3_url ? (
                                <img
                                  src={item.s3_url}
                                  alt={item.name}
                                  onError={(e) => {
                                    e.target.src =
                                      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect fill="%23e0e0e0" width="150" height="150"/><text x="75" y="75" text-anchor="middle" fill="%23999" font-size="14" dy=".3em" dominant-baseline="middle">👗</text></svg>';
                                  }}
                                />
                              ) : (
                                <div className="placeholder-image">👗</div>
                              )}
                            </div>

                            <div className="item-details">
                              <h4 className="item-name">{item.name}</h4>
                              {item.metadata?.brand && <p className="item-brand">{item.metadata.brand}</p>}
                              <span className="item-category-badge">
                                {item.metadata?.clothingCategory || 'Uncategorized'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="wardrobe-categories">
                {Object.entries(groupedByCategory).map(([category, items]) => (
                  <div key={category} className="wardrobe-category">
                    <h3 className="category-title">{categoryLabels[category] || category}</h3>

                    <div className="wardrobe-items-grid">
                      {items.map((item) => {
                        // Calculate price per wear
                        const timesWorn = item.times_worn || 0;
                        const ppw = item.price && timesWorn > 0 ? (item.price / timesWorn).toFixed(2) : null;
                        const ppwClass = ppw ? (ppw < 10 ? 'excellent' : ppw < 25 ? 'good' : 'fair') : null;
                        
                        // Determine popularity badge
                        const popularityBadge = timesWorn >= 10 ? { text: `${timesWorn}x`, type: 'classic', icon: '👑' } :
                                                timesWorn >= 5 ? { text: `${timesWorn}x`, type: 'trending', icon: '🔥' } :
                                                timesWorn >= 3 ? { text: `${timesWorn}x`, type: 'popular', icon: '⭐' } : null;
                        
                        return (
                        <div
                          key={item.id}
                          className={`wardrobe-item-card ${item.metadata?.isFavorite ? 'favorite' : ''}`}
                        >
                          {item.metadata?.isFavorite && <div className="favorite-badge">⭐</div>}
                          {popularityBadge && (
                            <div className={`popularity-badge ${popularityBadge.type}`}>
                              {popularityBadge.icon} {popularityBadge.text}
                            </div>
                          )}
                          {item.metadata?.previousEpisodes?.length > 0 && (
                            <div className="repeat-warning">🔁 Worn {item.metadata.previousEpisodes.length}x before</div>
                          )}
                          {item.metadata?.outfitSetId && (
                            <div className="outfit-set-badge">
                              👔 {item.metadata.outfitSetName || `Set ${item.metadata.outfitSetId}`}
                            </div>
                          )}

                          <div className="item-image">
                            {item.s3_url ? (
                              <img
                                src={item.s3_url_processed || item.s3_url}
                                alt={item.name}
                                className={item.s3_url_processed ? 'has-transparent-bg' : ''}
                                onError={(e) => {
                                  e.target.src =
                                    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect fill="%23e0e0e0" width="150" height="150"/><text x="75" y="75" text-anchor="middle" fill="%23999" font-size="14" dy=".3em" dominant-baseline="middle">👗</text></svg>';
                                }}
                              />
                            ) : (
                              <div className="placeholder-image">👗</div>
                            )}
                            {/* 3-dot menu */}
                            <div className="item-menu-container">
                              <button 
                                className="item-menu-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuItemId(openMenuItemId === item.id ? null : item.id);
                                }}
                                title="More options"
                              >
                                ⋮
                              </button>
                              {openMenuItemId === item.id && (
                                <div className="item-dropdown-menu">
                                  <button
                                    className="menu-option"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleFavorite(item);
                                      setOpenMenuItemId(null);
                                    }}
                                  >
                                    {item.is_episode_favorite ? '⭐ Unfavorite' : '☆ Favorite'}
                                  </button>
                                  {item.s3_url && (
                                    <button
                                      className="menu-option"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadImage(item, false);
                                        setOpenMenuItemId(null);
                                      }}
                                    >
                                      💾 Download
                                    </button>
                                  )}
                                  <button
                                    className="menu-option"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePrintItem(item);
                                      setOpenMenuItemId(null);
                                    }}
                                  >
                                    🖨️ Print
                                  </button>
                                  <button
                                    className="menu-option delete"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(item);
                                      setOpenMenuItemId(null);
                                    }}
                                  >
                                    🔗 Unlink
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="item-details">
                            <h4 className="item-name">{item.name}</h4>

                            {item.brand && (
                              <div className="item-meta">
                                <span className="meta-icon">🏷️</span>
                                <span className="meta-text">{item.brand}</span>
                              </div>
                            )}

                            {item.price && (
                              <div className="item-meta price-meta">
                                <span className="meta-icon">💰</span>
                                <span className="meta-text">${item.price}</span>
                                {ppw && (
                                  <span className={`price-per-wear ${ppwClass}`}>
                                    ${ppw}/wear
                                  </span>
                                )}
                              </div>
                            )}

                            {item.color && (
                              <div className="item-meta">
                                <span className="meta-icon">🎨</span>
                                <span className="meta-text">{item.color}</span>
                              </div>
                            )}

                            {item.size && (
                              <div className="item-meta">
                                <span className="meta-icon">📏</span>
                                <span className="meta-text">Size: {item.size}</span>
                              </div>
                            )}

                            {item.metadata?.scene && (
                              <div className="item-meta">
                                <span className="meta-icon">🎬</span>
                                <span className="meta-text">{item.metadata.scene}</span>
                              </div>
                            )}

                            {item.metadata?.outfitNotes && (
                              <div className="outfit-notes">
                                <strong>📝 Notes:</strong> {item.metadata.outfitNotes}
                              </div>
                            )}

                            {(item.metadata?.season || item.metadata?.occasion) && (
                              <div className="season-occasion">
                                {item.metadata?.season && <span className="season-tag">🌡️ {item.metadata.season}</span>}
                                {item.metadata?.occasion && (
                                  <span className="occasion-tag">📅 {item.metadata.occasion}</span>
                                )}
                              </div>
                            )}

                            {item.metadata?.tags?.length > 0 && (
                              <div className="item-tags">
                                {item.metadata.tags.map((tag, idx) => (
                                  <span key={idx} className="item-tag">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            {item.metadata?.timesWorn > 0 && (
                              <div className="wear-info">
                                👔 Worn {item.metadata.timesWorn}x
                                {item.metadata?.lastWorn && ` • Last: ${new Date(item.metadata.lastWorn).toLocaleDateString()}`}
                              </div>
                            )}

                            {item.metadata?.purchaseLink && (
                              <a
                                href={item.metadata.purchaseLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shop-link"
                              >
                                🛍️ Shop Item
                              </a>
                            )}
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="pagination-controls">
                  <button 
                    className="pagination-btn"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    «
                  </button>
                  <button 
                    className="pagination-btn"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    ‹ Previous
                  </button>
                  
                  <div className="pagination-numbers">
                    {[...Array(totalPages)].map((_, index) => {
                      const pageNum = index + 1;
                      if (
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={pageNum}
                            className={`pagination-number ${currentPage === pageNum ? 'active' : ''}`}
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (
                        pageNum === currentPage - 2 ||
                        pageNum === currentPage + 2
                      ) {
                        return <span key={pageNum} className="pagination-ellipsis">...</span>;
                      }
                      return null;
                    })}
                  </div>
                  
                  <button 
                    className="pagination-btn"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next ›
                  </button>
                  <button 
                    className="pagination-btn"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    »
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ✅ Modal Form - Always available when showForm is true (outside all conditionals) */}
      {/* Select Existing Items Modal */}
      {showSelectModal && (
        <div className="modal-overlay" onClick={() => setShowSelectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2>➕ Select Existing Wardrobe Items</h2>
              <button className="modal-close" onClick={() => setShowSelectModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <p style={{ marginBottom: '1rem', color: '#666' }}>
                Select items from your wardrobe to add to this episode. 
                Need to upload new items? Go to <button 
                  onClick={() => navigate('/wardrobe/manager')}
                  style={{ color: '#4a90e2', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >Wardrobe Manager</button>.
              </p>

              {loadingAvailable ? (
                <div className="loading" style={{ padding: '3rem', textAlign: 'center' }}>
                  Loading available items...
                </div>
              ) : availableItems.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
                  <p>📦 No items available in staging.</p>
                  <p>All items may already be assigned to episodes.</p>
                  <button 
                    onClick={() => navigate('/wardrobe/manager')}
                    style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', background: '#4a90e2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Go to Wardrobe Manager
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', maxHeight: '500px', overflowY: 'auto' }}>
                  {availableItems.map(item => (
                    <div 
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      style={{
                        border: selectedItemId === item.id ? '3px solid #4a90e2' : '1px solid #ddd',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: 'white'
                      }}
                    >
                      <div style={{ height: '150px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.s3_url ? (
                          <img src={item.s3_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span>No Image</span>
                        )}
                      </div>
                      <div style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{item.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#4a90e2' }}>👤 {item.character}</div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>{item.clothing_category}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowSelectModal(false)}>
                Cancel
              </button>
              <button
                className="btn-save"
                onClick={() => selectedItemId && linkExistingItem(selectedItemId)}
                disabled={!selectedItemId}
                style={{ opacity: selectedItemId ? 1 : 0.5 }}
              >
                ➕ Add Selected Item
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EpisodeWardrobe;


