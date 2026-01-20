/**
 * Wardrobe Gallery - Browse all wardrobe items across all episodes
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './WardrobeGallery.css';

const WardrobeGallery = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCharacter, setFilterCharacter] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSeason, setFilterSeason] = useState('all');
  const [filterOccasion, setFilterOccasion] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12); // Show 12 items per page
  const [stats, setStats] = useState({
    totalItems: 0,
    totalSpent: 0,
    characters: {},
    categories: {}
  });

  useEffect(() => {
    loadAllWardrobe();
  }, []);

  const loadAllWardrobe = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3002/api/v1/wardrobe?limit=1000');
      
      if (!response.ok) {
        console.error('Failed to load wardrobe:', response.status);
        setItems([]);
        return;
      }

      const data = await response.json();
      const wardrobeItems = data.data || [];
      setItems(wardrobeItems);
      
      // Calculate stats
      calculateStats(wardrobeItems);
    } catch (err) {
      console.error('Error loading wardrobe:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (wardrobeItems) => {
    const characters = {};
    const categories = {};
    let totalSpent = 0;

    wardrobeItems.forEach(item => {
      // Count by character
      if (item.character) {
        characters[item.character] = (characters[item.character] || 0) + 1;
      }
      
      // Count by category
      if (item.clothing_category) {
        categories[item.clothing_category] = (categories[item.clothing_category] || 0) + 1;
      }
      
      // Sum prices
      if (item.price) {
        totalSpent += parseFloat(item.price);
      }
    });

    setStats({
      totalItems: wardrobeItems.length,
      totalSpent,
      characters,
      categories
    });
  };

  const getFilteredAndSortedItems = () => {
    let filtered = [...items];

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

    // Reset to page 1 when filters change
    if (currentPage > 1) {
      setCurrentPage(1);
    }

    // Character filter
    if (filterCharacter !== 'all') {
      filtered = filtered.filter(item => item.character === filterCharacter);
    }

    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(item => item.clothing_category === filterCategory);
    }

    // Season filter
    if (filterSeason !== 'all') {
      filtered = filtered.filter(item => item.season === filterSeason);
    }

    // Occasion filter
    if (filterOccasion !== 'all') {
      filtered = filtered.filter(item => item.occasion === filterOccasion);
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
      case 'recent':
      default:
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
    }

    return filtered;
  };

  const filteredItems = getFilteredAndSortedItems();
  
  // Pagination calculations
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);
  
  const uniqueCharacters = [...new Set(items.map(i => i.character).filter(Boolean))];
  const uniqueCategories = [...new Set(items.map(i => i.clothing_category).filter(Boolean))];
  const uniqueSeasons = [...new Set(items.map(i => i.season).filter(Boolean))];
  const uniqueOccasions = [...new Set(items.map(i => i.occasion).filter(Boolean))];

  return (
    <div className="wardrobe-gallery-page">
      {/* Header */}
      <div className="gallery-header">
        <div className="header-content">
          <button className="back-button" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h1>👗 Wardrobe Gallery</h1>
          <p>Browse all wardrobe items across all episodes</p>
          <div className="header-actions">
            <button 
              className="btn-header-action analytics"
              onClick={() => navigate('/wardrobe/analytics')}
              title="View Analytics Dashboard"
            >
              📊 Analytics
            </button>
            <button 
              className="btn-header-action outfits"
              onClick={() => navigate('/wardrobe/outfits')}
              title="Manage Outfit Sets"
            >
              👔 Outfit Sets
            </button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-card">
          <span className="stat-value">{stats.totalItems}</span>
          <span className="stat-label">Total Items</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">${stats.totalSpent.toFixed(2)}</span>
          <span className="stat-label">Total Spent</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{Object.keys(stats.characters).length}</span>
          <span className="stat-label">Characters</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{Object.keys(stats.categories).length}</span>
          <span className="stat-label">Categories</span>
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="controls-section">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by name, brand, color, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filters-row">
          <select value={filterCharacter} onChange={(e) => setFilterCharacter(e.target.value)}>
            <option value="all">All Characters</option>
            {uniqueCharacters.map(char => (
              <option key={char} value={char}>{char}</option>
            ))}
          </select>

          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="all">All Categories</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select value={filterSeason} onChange={(e) => setFilterSeason(e.target.value)}>
            <option value="all">All Seasons</option>
            {uniqueSeasons.map(season => (
              <option key={season} value={season}>{season}</option>
            ))}
          </select>

          <select value={filterOccasion} onChange={(e) => setFilterOccasion(e.target.value)}>
            <option value="all">All Occasions</option>
            {uniqueOccasions.map(occasion => (
              <option key={occasion} value={occasion}>{occasion}</option>
            ))}
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recent">Recently Added</option>
            <option value="name">Name (A-Z)</option>
            <option value="price-asc">Price (Low to High)</option>
            <option value="price-desc">Price (High to Low)</option>
          </select>

          <div className="view-toggles">
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
        </div>
      </div>

      {/* Results Count */}
      <div className="results-info">
        Showing {startIndex + 1}-{Math.min(endIndex, filteredItems.length)} of {filteredItems.length} items
        {filteredItems.length !== items.length && ` (${items.length} total)`}
        {(searchQuery || filterCharacter !== 'all' || filterCategory !== 'all') && (
          <button className="clear-filters" onClick={() => {
            setSearchQuery('');
            setFilterCharacter('all');
            setFilterCategory('all');
            setFilterSeason('all');
            setFilterOccasion('all');
            setCurrentPage(1);
          }}>
            Clear Filters
          </button>
        )}
      </div>

      {/* Gallery Grid */}
      {loading ? (
        <div className="loading-state">Loading wardrobe...</div>
      ) : filteredItems.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">👗</span>
          <p>No wardrobe items found</p>
          {searchQuery && <small>Try adjusting your search or filters</small>}
        </div>
      ) : (
        <>
        <div className={`gallery-grid ${viewMode}`}>
          {paginatedItems.map(item => (
            <div key={item.id} className="gallery-item-card">
              <div className="item-image">
                {item.s3_url ? (
                  <img
                    src={item.s3_url}
                    alt={item.name}
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect fill="%23e0e0e0" width="150" height="150"/><text x="75" y="75" text-anchor="middle" fill="%23999" font-size="40" dy=".3em">👗</text></svg>';
                    }}
                  />
                ) : (
                  <div className="placeholder-image">👗</div>
                )}
                {item.is_favorite && <div className="favorite-badge">⭐</div>}
              </div>

              <div className="item-info">
                <h3 className="item-name">{item.name}</h3>
                
                <div className="item-meta-row">
                  <span className="character-badge">{item.character}</span>
                  <span className="category-badge">{item.clothing_category}</span>
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
                // Show first, last, current, and pages around current
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
  );
};

export default WardrobeGallery;
