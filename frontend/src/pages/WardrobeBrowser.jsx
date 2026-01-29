/**
 * Unified Wardrobe Browser
 * Handles both Library (reusable items) and Gallery (episode-specific items) modes
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import wardrobeLibraryService from '../services/wardrobeLibraryService';
import { API_URL } from '../config/api';
import LoadingSpinner from '../components/LoadingSpinner';
import './WardrobeBrowser.css';

const WardrobeBrowser = ({ mode = 'gallery' }) => {
  const navigate = useNavigate();
  const isLibraryMode = mode === 'library';
  
  // State
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    item_type: '',
    character: '',
    category: '',
    color: '',
    season: '',
    occasion: '',
    show_id: '',
    status: ''
  });
  
  // Sorting
  const [sortBy, setSortBy] = useState(isLibraryMode ? 'newest' : 'recent');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = isLibraryMode ? 20 : 12;
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    items: 0,
    sets: 0,
    recentUploads: 0,
    totalSpent: 0,
    characters: {},
    categories: {}
  });
  
  // Bulk selection (library mode only)
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  
  // Available filter options
  const [shows, setShows] = useState([]);
  const itemTypes = ['dress', 'top', 'bottom', 'shoes', 'accessory', 'jewelry', 'bag', 'outerwear'];
  const seasons = ['spring', 'summer', 'fall', 'winter'];
  const occasions = ['casual', 'formal', 'business', 'party', 'athletic'];
  const colors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'gray', 'brown', 'pink', 'purple'];
  
  // Load data on mount and when filters change
  useEffect(() => {
    loadShows();
    if (isLibraryMode) {
      loadStats();
    }
  }, [isLibraryMode]);
  
  useEffect(() => {
    loadItems();
  }, [currentPage, filters, sortBy, searchQuery, mode]);
  
  const loadShows = async () => {
    try {
      const response = await fetch(`${API_URL}/shows`);
      if (response.ok) {
        const data = await response.json();
        setShows(data.data || []);
      }
    } catch (err) {
      console.error('Error loading shows:', err);
    }
  };
  
  const loadStats = async () => {
    try {
      const result = await wardrobeLibraryService.getStats();
      setStats(prev => ({ ...prev, ...result }));
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };
  
  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (isLibraryMode) {
        // Load from library API
        const queryFilters = {
          type: filters.type,
          item_type: filters.item_type,
          color: filters.color,
          season: filters.season,
          occasion: filters.occasion,
          show_id: filters.show_id,
          status: filters.status,
          search: searchQuery,
          sortBy
        };
        
        // Remove empty filters
        Object.keys(queryFilters).forEach(key => {
          if (!queryFilters[key]) delete queryFilters[key];
        });
        
        const result = await wardrobeLibraryService.getLibrary(queryFilters, currentPage, itemsPerPage);
        setItems(result.data || []);
        setTotalPages(result.pagination?.totalPages || 1);
        setTotalItems(result.pagination?.total || 0);
      } else {
        // Load from wardrobe API (gallery mode)
        const response = await fetch(`${API_URL}/wardrobe?limit=1000`);
        
        if (!response.ok) {
          console.error('Failed to load wardrobe:', response.status);
          setItems([]);
          return;
        }
        
        const data = await response.json();
        let wardrobeItems = data.data || [];
        
        // Calculate stats for gallery mode
        calculateGalleryStats(wardrobeItems);
        
        // Apply client-side filtering
        wardrobeItems = applyGalleryFilters(wardrobeItems);
        
        // Pagination for gallery mode
        setTotalItems(wardrobeItems.length);
        const pages = Math.ceil(wardrobeItems.length / itemsPerPage);
        setTotalPages(pages);
        
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        setItems(wardrobeItems.slice(startIndex, endIndex));
      }
    } catch (err) {
      console.error('Error loading items:', err);
      setError(err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters, sortBy, searchQuery, isLibraryMode, itemsPerPage]);
  
  const calculateGalleryStats = (wardrobeItems) => {
    const characters = {};
    const categories = {};
    let totalSpent = 0;
    
    wardrobeItems.forEach(item => {
      if (item.character) {
        characters[item.character] = (characters[item.character] || 0) + 1;
      }
      if (item.clothing_category) {
        categories[item.clothing_category] = (categories[item.clothing_category] || 0) + 1;
      }
      if (item.price) {
        totalSpent += parseFloat(item.price);
      }
    });
    
    setStats({
      total: wardrobeItems.length,
      totalSpent,
      characters,
      categories
    });
  };
  
  const applyGalleryFilters = (wardrobeItems) => {
    let filtered = [...wardrobeItems];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.name?.toLowerCase().includes(query) ||
        item.brand?.toLowerCase().includes(query) ||
        item.color?.toLowerCase().includes(query) ||
        item.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    // Character filter
    if (filters.character) {
      filtered = filtered.filter(item => item.character === filters.character);
    }
    
    // Category filter
    if (filters.category) {
      filtered = filtered.filter(item => item.clothing_category === filters.category);
    }
    
    // Season filter
    if (filters.season) {
      filtered = filtered.filter(item => item.season === filters.season);
    }
    
    // Occasion filter
    if (filters.occasion) {
      filtered = filtered.filter(item => item.occasion === filters.occasion);
    }
    
    // Color filter
    if (filters.color) {
      filtered = filtered.filter(item => item.color === filters.color);
    }
    
    // Sort
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'price-asc':
        filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price-desc':
        filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'most_used':
        filtered.sort((a, b) => (b.times_worn || 0) - (a.times_worn || 0));
        break;
      case 'recent':
      case 'newest':
      default:
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
    }
    
    return filtered;
  };
  
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };
  
  const handleClearFilters = () => {
    setFilters({
      type: '',
      item_type: '',
      character: '',
      category: '',
      color: '',
      season: '',
      occasion: '',
      show_id: '',
      status: ''
    });
    setSearchQuery('');
    setCurrentPage(1);
  };
  
  const toggleBulkMode = () => {
    setBulkMode(!bulkMode);
    setSelectedItems(new Set());
  };
  
  const toggleItemSelection = (itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };
  
  const selectAll = () => {
    setSelectedItems(new Set(items.map(i => i.id)));
  };
  
  const deselectAll = () => {
    setSelectedItems(new Set());
  };
  
  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Delete ${selectedItems.size} items?`)) return;
    
    try {
      await wardrobeLibraryService.bulkDelete(Array.from(selectedItems));
      setSelectedItems(new Set());
      setBulkMode(false);
      loadItems();
      if (isLibraryMode) loadStats();
    } catch (err) {
      setError('Failed to delete items: ' + err.message);
    }
  };
  
  const handleItemClick = (item) => {
    if (isLibraryMode) {
      navigate(`/wardrobe-library/${item.id}`);
    }
  };
  
  const getImageUrl = (item) => {
    const url = isLibraryMode ? item.image_url : item.s3_url;
    if (url) {
      return url.startsWith('http') ? url : `${API_URL}${url}`;
    }
    return null;
  };
  
  const switchMode = (newMode) => {
    if (newMode === 'library') {
      navigate('/wardrobe-library');
    } else {
      navigate('/wardrobe');
    }
  };
  
  // Get unique values for filter dropdowns (gallery mode)
  const uniqueCharacters = isLibraryMode ? [] : [...new Set(items.map(i => i.character).filter(Boolean))];
  const uniqueCategories = isLibraryMode ? [] : [...new Set(items.map(i => i.clothing_category).filter(Boolean))];
  
  if (loading && items.length === 0) {
    return <LoadingSpinner />;
  }
  
  return (
    <div className={`wardrobe-browser ${mode}-mode`}>
      {/* Header */}
      <div className="browser-header">
        <div className="header-top">
          <div className="header-title-section">
            {!isLibraryMode && (
              <button className="back-button" onClick={() => navigate(-1)}>
                ← Back
              </button>
            )}
            <h1>{isLibraryMode ? '📚 Wardrobe Library' : '👗 Wardrobe Gallery'}</h1>
            <p>{isLibraryMode ? 'Manage your reusable wardrobe collection' : 'Browse all wardrobe items across episodes'}</p>
          </div>
          
          {isLibraryMode && (
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/wardrobe-library/upload')}
            >
              + Upload Item
            </button>
          )}
        </div>
        
        {/* Mode Switcher - Quiet, Secondary */}
        <div className="mode-switcher-quiet">
          <button
            className={mode === 'library' ? 'active' : ''}
            onClick={() => switchMode('library')}
          >
            Library
          </button>
          <button
            className={mode === 'gallery' ? 'active' : ''}
            onClick={() => switchMode('gallery')}
          >
            Gallery
          </button>
        </div>
        
        {/* Stats Summary - Inline */}
        {!isLibraryMode && stats.total > 0 && (
          <div className="stats-summary-inline">
            {stats.total} item{stats.total !== 1 ? 's' : ''}
            {Object.keys(stats.characters || {}).length > 0 && ` · ${Object.keys(stats.characters || {}).length} character${Object.keys(stats.characters || {}).length !== 1 ? 's' : ''}`}
            {Object.keys(stats.categories || {}).length > 0 && ` · ${Object.keys(stats.categories || {}).length} categor${Object.keys(stats.categories || {}).length !== 1 ? 'ies' : 'y'}`}
            {stats.totalSpent > 0 && ` · $${stats.totalSpent.toFixed(2)} spent`}
          </div>
        )}
        
        {/* Search and Controls */}
        <div className="header-controls">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder={`Search by name, ${isLibraryMode ? 'color, tags' : 'brand, color, or tags'}...`}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          
          <div className="view-controls">
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value={isLibraryMode ? 'newest' : 'recent'}>Recently Added</option>
              <option value="name">Name (A-Z)</option>
              {isLibraryMode ? (
                <>
                  <option value="most_used">Most Used</option>
                  <option value="last_used">Last Used</option>
                </>
              ) : (
                <>
                  <option value="price-asc">Price (Low to High)</option>
                  <option value="price-desc">Price (High to Low)</option>
                </>
              )}
            </select>
            
            <div className="view-mode-toggle">
              <button 
                className={viewMode === 'grid' ? 'active' : ''}
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                ⊞
              </button>
              <button 
                className={viewMode === 'list' ? 'active' : ''}
                onClick={() => setViewMode('list')}
                title="List view"
              >
                ☰
              </button>
            </div>
            
            {isLibraryMode && (
              <button 
                className={`btn-bulk ${bulkMode ? 'active' : ''}`}
                onClick={toggleBulkMode}
              >
                {bulkMode ? '✓ Bulk Mode' : 'Bulk Select'}
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="browser-content">
        {/* Filter Sidebar - Only show in Library mode */}
        {isLibraryMode && (
          <aside className="filter-sidebar">
            <div className="filter-header">
              <h3>Filters</h3>
              <button 
                className="btn-text"
                onClick={handleClearFilters}
              >
                Clear All
              </button>
            </div>
          
            <div className="filter-section">
              <label>Type</label>
              <select 
                value={filters.type} 
                onChange={(e) => handleFilterChange('type', e.target.value)}
              >
                <option value="">All Types</option>
                <option value="item">Individual Item</option>
                <option value="set">Outfit Set</option>
              </select>
            </div>
            
            <div className="filter-section">
              <label>Item Type</label>
              <select 
                value={filters.item_type} 
                onChange={(e) => handleFilterChange('item_type', e.target.value)}
              >
                <option value="">All Items</option>
                {itemTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          
          <div className="filter-section">
            <label>Color</label>
            <select 
              value={filters.color} 
              onChange={(e) => handleFilterChange('color', e.target.value)}
            >
              <option value="">All Colors</option>
              {colors.map(color => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-section">
            <label>Season</label>
            <select 
              value={filters.season} 
              onChange={(e) => handleFilterChange('season', e.target.value)}
            >
              <option value="">All Seasons</option>
              {seasons.map(season => (
                <option key={season} value={season}>{season}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-section">
            <label>Occasion</label>
            <select 
              value={filters.occasion} 
              onChange={(e) => handleFilterChange('occasion', e.target.value)}
            >
              <option value="">All Occasions</option>
              {occasions.map(occasion => (
                <option key={occasion} value={occasion}>{occasion}</option>
              ))}
            </select>
          </div>
          
          {shows.length > 0 && (
            <div className="filter-section">
              <label>Show</label>
              <select 
                value={filters.show_id} 
                onChange={(e) => handleFilterChange('show_id', e.target.value)}
              >
                <option value="">All Shows</option>
                {shows.map(show => (
                  <option key={show.id} value={show.id}>{show.title}</option>
                ))}
              </select>
            </div>
          )}
          
          <div className="filter-section">
            <label>Status</label>
            <select 
              value={filters.status} 
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Items</option>
              <option value="used">Used</option>
              <option value="unused">Unused</option>
            </select>
          </div>
          </aside>
        )}
        
        {/* Main Content */}
        <main className="browser-main">
          {/* Bulk Actions Bar */}
          {bulkMode && selectedItems.size > 0 && (
            <div className="bulk-actions-bar">
              <span>{selectedItems.size} items selected</span>
              <div className="bulk-actions">
                <button onClick={selectAll}>Select All</button>
                <button onClick={deselectAll}>Deselect All</button>
                <button className="btn-danger" onClick={handleBulkDelete}>
                  Delete Selected
                </button>
              </div>
            </div>
          )}
          
          {/* Results Info */}
          <div className="results-info">
            Showing {items.length > 0 ? ((currentPage - 1) * itemsPerPage + 1) : 0}-{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
          </div>
          
          {/* Items Grid */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          {loading ? (
            <div className="loading-state">Loading items...</div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">👗</span>
              <p>No items found</p>
              {searchQuery && <small>Try adjusting your search or filters</small>}
            </div>
          ) : (
            <div className={`items-grid ${viewMode}`}>
              {items.map(item => (
                <div 
                  key={item.id} 
                  className={`item-card ${bulkMode ? 'bulk-mode' : ''} ${selectedItems.has(item.id) ? 'selected' : ''} ${!getImageUrl(item) ? 'placeholder-card' : ''}`}
                  onClick={() => bulkMode ? toggleItemSelection(item.id) : handleItemClick(item)}
                >
                  {bulkMode && (
                    <div className="selection-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                      />
                    </div>
                  )}
                  
                  <div className="item-image">
                    {getImageUrl(item) ? (
                      <img
                        src={getImageUrl(item)}
                        alt={item.name}
                        onError={(e) => {
                          e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect fill="%23e0e0e0" width="150" height="150"/><text x="75" y="75" text-anchor="middle" fill="%23999" font-size="40" dy=".3em">👗</text></svg>';
                        }}
                      />
                    ) : (
                      <div className="placeholder-image">👗</div>
                    )}
                    {item.is_favorite && <div className="favorite-badge">⭐</div>}
                    {isLibraryMode && item.type === 'set' && (
                      <div className="type-badge">Set</div>
                    )}
                  </div>
                  
                  <div className="item-info">
                    <h3 className="item-name">{item.name}</h3>
                    
                    <div className="item-meta-row">
                      {!isLibraryMode && item.character && (
                        <span className="character-badge">{item.character}</span>
                      )}
                      {item.clothing_category && (
                        <span className="category-badge">{item.clothing_category}</span>
                      )}
                      {isLibraryMode && item.item_type && (
                        <span className="category-badge">{item.item_type}</span>
                      )}
                    </div>
                    
                    {item.brand && (
                      <div className="item-detail">
                        <span className="icon">🏷️</span>
                        <span>{item.brand}</span>
                      </div>
                    )}
                    
                    {item.price && (
                      <div className="item-detail price">
                        <span className="icon">💰</span>
                        <span>${item.price}</span>
                      </div>
                    )}
                    
                    {item.color && (
                      <div className="item-detail">
                        <span className="icon">🎨</span>
                        <span>{item.color}</span>
                      </div>
                    )}
                    
                    {(item.season || item.occasion) && (
                      <div className="item-tags">
                        {item.season && <span className="tag">🌡️ {item.season}</span>}
                        {item.occasion && <span className="tag">📅 {item.occasion}</span>}
                      </div>
                    )}
                    
                    {isLibraryMode && item.total_usage_count > 0 && (
                      <div className="item-usage">
                        Used {item.total_usage_count} times
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Pagination */}
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
        </main>
      </div>
    </div>
  );
};

export default WardrobeBrowser;
