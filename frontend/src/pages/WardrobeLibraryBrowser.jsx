/**
 * Wardrobe Library Browser
 * Main page for browsing the wardrobe library
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import wardrobeLibraryService from '../services/wardrobeLibraryService';
import { API_URL } from '../config/api';
import LoadingSpinner from '../components/LoadingSpinner';
import './WardrobeLibraryBrowser.css';

const WardrobeLibraryBrowser = () => {
  const navigate = useNavigate();
  
  // State
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    item_type: '',
    color: '',
    season: '',
    occasion: '',
    show_id: '',
    status: '' // used, unused, all
  });
  
  // Sorting
  const [sortBy, setSortBy] = useState('newest'); // newest, name, most_used, last_used
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 20;
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    items: 0,
    sets: 0,
    recentUploads: 0
  });
  
  // Bulk selection
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  
  // Available filter options
  const [shows, setShows] = useState([]);
  const itemTypes = ['dress', 'top', 'bottom', 'shoes', 'accessory', 'jewelry', 'bag', 'outerwear'];
  const seasons = ['spring', 'summer', 'fall', 'winter'];
  const occasions = ['casual', 'formal', 'business', 'party', 'athletic'];
  const colors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'gray', 'brown', 'pink', 'purple'];
  
  // Load data
  useEffect(() => {
    loadShows();
    loadStats();
  }, []);
  
  useEffect(() => {
    loadLibrary();
  }, [currentPage, filters, sortBy, searchQuery]);
  
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
  Stats = async () => {
    try {
      const result = await wardrobeLibraryService.getStats();
      setStats(result);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };
  
  const load
  const loadLibrary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const queryFilters = {
        ...filters,
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
    } catch (err) {
      console.error('Error loading library:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters, sortBy, searchQuery]);
  
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page
  };
  
  const handleClearFilters = () => {
    setFilters({
      type: '',
      item_type: '',
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
      loadLibrary();
      loadStats();
    } catch (err) {
      setError('Failed to delete items: ' + err.message);
    }
  };
  
  const handleItemClick = (item) => {
    navigate(`/wardrobe-library/${item.id}`);
  };
  
  const getImageUrl = (item) => {
    if (item.image_url) {
      return item.image_url.startsWith('http') 
        ? item.image_url 
        : `${API_URL}${item.image_url}`;
    }
    return '/placeholder-wardrobe.png';
  };
  
  if (loading && items.length === 0) {
    return <LoadingSpinner />;
  }
  
  return (
    <div className="wardrobe-library-browser">
      <div className="library-header">
        <div className="header-top">
          <h1>Wardrobe Library</h1>
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/wardrobe-library/upload')}
          >
            + Upload Item
          </button>
        </div>
        
        <div className="header-controls">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search by name, color, tags..."
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
              <option value="newest">Newest</option>
              <option value="name">Name</option>
              <option value="most_used">Most Used</option>
              <option value="last_used">Last Used</option>
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
          </div>
        </div>
      </div>
      
      <div className="library-content">
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
          
          <div className="filter-section">
            <label>Show</label>
            <select 
              value={filters.show_id} 
              onChange={(e) => handleFilterChange('show_id', e.target.value)}
            >
              <option value="">All Shows</option>
              {shows.map(show => (
                <option key={show.id} value={show.id}>{show.name}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-section">
            <label>Usage Status</label>
            <select 
              value={filters.status} 
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Items</option>
              <option value="used">Used</option>
              <option value="unused">Never Used</option>
            </select>
          </div>
        </aside>
        
        <main className="library-items">
          {error && (
            <div className="error-message">
              Error loading library: {error}
            </div>
          )}
          
          {!loading && items.length === 0 && (
            <div className="empty-state">
              <p>No items found matching your criteria.</p>
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/wardrobe-library/upload')}
              >
                Upload First Item
              </button>
            </div>
          )}
          
          {items.length > 0 && (
            <>
              <div className="items-info">
                Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
              </div>
              
              <div className={`items-container ${viewMode}`}>
                {items.map(item => (
                  <div 
                    key={item.id} 
                    className={`library-item ${selectedItems.has(item.id) ? 'selected' : ''}`}
                    onClick={() => bulkMode ? toggleItemSelection(item.id) : handleItemClick(item)}
                  >
                    {bulkMode && (
                      <div className="item-checkbox">
                        <input 
                          type="checkbox" 
                          checked={selectedItems.has(item.id)}
                          onChange={() => toggleItemSelection(item.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                    
                    <div className="item-image">
                      <img 
                        src={getImageUrl(item)} 
                        alt={item.name}
                        onError={(e) => {
                          e.target.src = '/placeholder-wardrobe.png';
                        }}
                      />
                      {item.type === 'set' && (
                        <span className="item-badge">Outfit Set</span>
                      )}
                    </div>
                    
                    <div className="item-details">
                      <h3 className="item-name">{item.name}</h3>
                      
                      {viewMode === 'list' && (
                        <>
                          <p className="item-description">{item.description}</p>
                          <div className="item-meta">
                            {item.item_type && <span className="meta-tag">{item.item_type}</span>}
                            {item.color && <span className="meta-tag">{item.color}</span>}
                            {item.season && <span className="meta-tag">{item.season}</span>}
                          </div>
                        </>
                      )}
                      
                      <div className="item-stats">
                        <span title="Times used">👗 {item.usage_count || 0}</span>
                        {item.last_used_at && (
                          <span title="Last used">
                            🕒 {new Date(item.last_used_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {totalPages > 1 && (
                <div className="pagination">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="btn btn-secondary"
                  >
                    Previous
                  </button>
                  
                  <span className="page-info">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="btn btn-secondary"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
          
          {loading && items.length > 0 && (
            <div className="loading-overlay">
              <LoadingSpinner />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default WardrobeLibraryBrowser;
