// frontend/src/components/Show/ShowWardrobeTab.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { wardrobeLibraryService } from '../../services/wardrobeLibraryService';
import './ShowWardrobeTab.css';

/**
 * ShowWardrobeTab - Show-level wardrobe library management
 * 
 * Features:
 * - Categorized wardrobe organization (Tops, Dresses, Bottoms, Shoes, Accessories, Jewelry)
 * - Upload with context ("Upload to Wardrobe Library")
 * - Usage tracking (worn in X episodes)
 * - Grid/List view
 * - Search and filter by category/character
 * - Link to episodes
 * - Character assignment tracking
 */

const WARDROBE_CATEGORIES = {
  all: { icon: '👗', color: '#64748b', label: 'All Wardrobe' },
  tops: { icon: '👕', color: '#667eea', label: 'Tops' },
  dresses: { icon: '👗', color: '#ec4899', label: 'Dresses' },
  bottoms: { icon: '👖', color: '#10b981', label: 'Bottoms' },
  shoes: { icon: '👠', color: '#f59e0b', label: 'Shoes' },
  accessories: { icon: '👜', color: '#8b5cf6', label: 'Accessories' },
  jewelry: { icon: '💍', color: '#06b6d4', label: 'Jewelry' }
};

function ShowWardrobeTab({ show }) {
  const navigate = useNavigate();
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // grid | list
  const [searchQuery, setSearchQuery] = useState('');
  const [characterFilter, setCharacterFilter] = useState('all');
  const [showUploader, setShowUploader] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    itemType: 'dresses',
    color: '',
    character: 'LaLa',
    notes: ''
  });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const fileInputRef = useRef(null);
  
  useEffect(() => {
    fetchWardrobeItems();
  }, [show.id]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openDropdownId && !e.target.closest('.item-menu-btn') && !e.target.closest('.item-dropdown')) {
        setOpenDropdownId(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openDropdownId]);
  
  const fetchWardrobeItems = async () => {
    setLoading(true);
    try {
      const response = await wardrobeLibraryService.getLibrary({ showId: show.id }, 1, 100);
      const items = response.data || [];
      
      // Map API response to component format
      const mappedItems = items.map(item => ({
        id: item.id,
        name: item.name,
        category: item.itemType || 'other',
        character: item.defaultCharacter || 'LaLa',
        url: item.imageUrl,
        thumbnail_url: item.thumbnailUrl || item.imageUrl,
        size: 0,
        usage_count: item.usageCount || 0,
        color: item.color,
        notes: item.description,
        created_at: item.createdAt
      }));
      
      setWardrobeItems(mappedItems);
      console.log(`✅ Loaded ${mappedItems.length} wardrobe items`);
    } catch (error) {
      console.error('Error fetching wardrobe items:', error);
      // Fall back to mock data if API fails
      setWardrobeItems([
        {
          id: '1',
          name: 'LaLa Pink Dress',
          category: 'dresses',
          character: 'LaLa',
          url: '/wardrobe/pink-dress.jpg',
          thumbnail_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VjNDg5OSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+RlzwvdGV4dD48L3N2Zz4=',
          size: 345678,
          usage_count: 8,
          color: 'Pink',
          size_info: 'S',
          brand: 'Custom',
          notes: 'Signature look for special episodes',
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          name: 'LaLa Blue Top',
          category: 'tops',
          character: 'LaLa',
          url: '/wardrobe/blue-top.jpg',
          thumbnail_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzY2N2VlYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+RlTwvdGV4dD48L3N2Zz4=',
          size: 234567,
          usage_count: 12,
          color: 'Blue',
          size_info: 'M',
          brand: 'Zara',
          created_at: new Date().toISOString()
        },
        {
          id: '3',
          name: 'Gold Statement Necklace',
          category: 'jewelry',
          character: 'LaLa',
          url: '/wardrobe/gold-necklace.jpg',
          thumbnail_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzA2YjZkNCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+SjTwvdGV4dD48L3N2Zz4=',
          size: 123456,
          usage_count: 15,
          color: 'Gold',
          brand: 'Custom',
          created_at: new Date().toISOString()
        },
        {
          id: '4',
          name: 'Black Ankle Boots',
          category: 'shoes',
          character: 'LaLa',
          url: '/wardrobe/black-boots.jpg',
          thumbnail_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y1OWUwYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+RoDwvdGV4dD48L3N2Zz4=',
          size: 456789,
          usage_count: 10,
          color: 'Black',
          size_info: '7.5',
          brand: 'Steve Madden',
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };
  
  // Get unique characters
  const characters = ['all', ...new Set(wardrobeItems.map(item => item.character).filter(Boolean))];
  
  // Filter wardrobe items
  const filteredItems = wardrobeItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesCharacter = characterFilter === 'all' || item.character === characterFilter;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.character?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.color?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesCharacter && matchesSearch;
  });
  
  // Count items per category
  const categoryCounts = wardrobeItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
  
  const handleUpload = async (files) => {
    try {
      // TODO: Implement actual upload
      console.log('Uploading to wardrobe library:', files);
      
      // Mock success
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh items
      await fetchWardrobeItems();
      
      setShowUploader(false);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload wardrobe items');
    }
  };
  
  const handleDeleteItem = async (itemId) => {
    if (!confirm('Delete this wardrobe item? Episodes using it will be unlinked.')) {
      return;
    }
    
    try {
      // TODO: Implement actual delete
      setWardrobeItems(wardrobeItems.filter(i => i.id !== itemId));
    } catch (error) {
      console.error('Delete error:', error);
    }
  };
  
  const handleLinkToEpisode = (item) => {
    // Navigate to episode selection or show modal
    console.log('Link wardrobe item to episode:', item);
    // TODO: Show episode selection modal
  };
  
  const handleViewItemDetails = (item) => {
    setSelectedItem(item);
    // TODO: Show detailed view modal with all item info
  };
  
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  
  const formatUsage = (count) => {
    if (count === 0) return 'Never worn';
    if (count === 1) return 'Worn in 1 episode';
    return `Worn in ${count} episodes`;
  };
  
  if (loading) {
    return <div className="show-wardrobe-loading">Loading wardrobe...</div>;
  }
  
  return (
    <div className="show-wardrobe-tab">
      {/* Header */}
      <div className="wardrobe-header">
        <div className="header-left">
          <h2>👗 Wardrobe Library ({wardrobeItems.length})</h2>
          <p className="header-subtitle">Reusable wardrobe items for all episodes</p>
        </div>
        <div className="header-actions">
          <button 
            className="btn-primary btn-upload"
            onClick={() => setShowUploader(true)}
          >
            👗 Add Wardrobe Item
          </button>
        </div>
      </div>
      
      {/* Empty State */}
      {wardrobeItems.length === 0 && (
        <div className="empty-state-recommended">
          <div className="empty-icon">👗</div>
          <h3>Build Your Wardrobe Library</h3>
          <p>Upload and organize wardrobe items that appear across episodes</p>
          
          <div className="recommended-grid">
            <button 
              className="recommended-card"
              onClick={() => setShowUploader(true)}
            >
              <span className="rec-icon">👗</span>
              <span className="rec-label">Add Dresses</span>
            </button>
            
            <button 
              className="recommended-card"
              onClick={() => setShowUploader(true)}
            >
              <span className="rec-icon">👕</span>
              <span className="rec-label">Add Tops</span>
            </button>
            
            <button 
              className="recommended-card"
              onClick={() => setShowUploader(true)}
            >
              <span className="rec-icon">👖</span>
              <span className="rec-label">Add Bottoms</span>
            </button>
            
            <button 
              className="recommended-card"
              onClick={() => setShowUploader(true)}
            >
              <span className="rec-icon">👠</span>
              <span className="rec-label">Add Shoes</span>
            </button>
            
            <button 
              className="recommended-card"
              onClick={() => setShowUploader(true)}
            >
              <span className="rec-icon">💍</span>
              <span className="rec-label">Add Jewelry</span>
            </button>
            
            <button 
              className="recommended-card"
              onClick={() => setShowUploader(true)}
            >
              <span className="rec-icon">👜</span>
              <span className="rec-label">Add Accessories</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Main Content (when items exist) */}
      {wardrobeItems.length > 0 && (
        <>
          {/* Controls */}
          <div className="wardrobe-controls">
            {/* Category Filter */}
            <div className="category-filter">
              {Object.entries(WARDROBE_CATEGORIES).map(([key, cat]) => (
                <button
                  key={key}
                  className={`category-btn ${selectedCategory === key ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(key)}
                  style={{ 
                    borderColor: selectedCategory === key ? cat.color : 'transparent',
                    color: selectedCategory === key ? cat.color : '#64748b'
                  }}
                >
                  <span className="cat-icon">{cat.icon}</span>
                  <span className="cat-label">{cat.label}</span>
                  {key !== 'all' && categoryCounts[key] && (
                    <span className="cat-count">({categoryCounts[key]})</span>
                  )}
                </button>
              ))}
            </div>
            
            {/* Search, Character Filter & View Toggle */}
            <div className="controls-right">
              <select
                className="character-filter"
                value={characterFilter}
                onChange={(e) => setCharacterFilter(e.target.value)}
              >
                {characters.map(char => (
                  <option key={char} value={char}>
                    {char === 'all' ? 'All Characters' : char}
                  </option>
                ))}
              </select>
              
              <input
                type="text"
                className="search-input"
                placeholder="Search wardrobe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              
              <div className="view-toggle">
                <button
                  className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid view"
                >
                  ⊞
                </button>
                <button
                  className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="List view"
                >
                  ≡
                </button>
              </div>
            </div>
          </div>
          
          {/* Wardrobe Grid/List */}
          <div className={`wardrobe-container view-${viewMode}`}>
            {filteredItems.length === 0 ? (
              <div className="no-results">
                <p>No wardrobe items found</p>
              </div>
            ) : (
              filteredItems.map(item => {
                const category = WARDROBE_CATEGORIES[item.category] || WARDROBE_CATEGORIES.all;
                
                return (
                  <div 
                    key={item.id} 
                    className="wardrobe-item-card"
                  >
                    {/* 3-Dot Menu Button */}
                    <button
                      className="item-menu-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(openDropdownId === item.id ? null : item.id);
                      }}
                      title="Options"
                    >
                      ⋮
                    </button>
                    
                    {/* Dropdown Menu */}
                    {openDropdownId === item.id && (
                      <div className="item-dropdown">
                        <button
                          className="dropdown-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewItemDetails(item);
                            setOpenDropdownId(null);
                          }}
                        >
                          <span className="dropdown-icon">👁️</span>
                          <span>View Details</span>
                        </button>
                        <button
                          className="dropdown-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLinkToEpisode(item);
                            setOpenDropdownId(null);
                          }}
                        >
                          <span className="dropdown-icon">🔗</span>
                          <span>Link to Episode</span>
                        </button>
                        <div className="dropdown-divider"></div>
                        <button
                          className="dropdown-item dropdown-item-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item.id);
                            setOpenDropdownId(null);
                          }}
                        >
                          <span className="dropdown-icon">🗑️</span>
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                    
                    <div className="item-thumbnail">
                      <img src={item.thumbnail_url} alt={item.name} />
                    </div>
                    
                    <div className="item-info">
                      <div className="item-main">
                        <div className="item-header">
                          <span 
                            className="item-category-badge"
                            style={{ backgroundColor: category.color }}
                          >
                            {category.icon} {category.label}
                          </span>
                        </div>
                        
                        <h4 className="item-name">{item.name}</h4>
                        
                        <div className="item-details">
                          {item.color && (
                            <span className="detail-item">🎨 {item.color}</span>
                          )}
                          {item.size_info && (
                            <span className="detail-item">📏 {item.size_info}</span>
                          )}
                          {item.brand && (
                            <span className="detail-item">🏷️ {item.brand}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="item-side">
                        {item.character && (
                          <div className="item-character">
                            <span className="character-label">👤 {item.character}</span>
                          </div>
                        )}
                        
                        <div className="item-meta">
                          <span className="usage-count">
                            {formatUsage(item.usage_count)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
      
      {/* Upload Modal */}
      {showUploader && (
        <div className="wardrobe-uploader-modal">
          <div className="modal-overlay" onClick={() => !uploading && setShowUploader(false)} />
          <div className="modal-content wardrobe-upload-form">
            <div className="modal-header">
              <h2>👗 Add Wardrobe Item</h2>
              <button 
                className="btn-close"
                onClick={() => !uploading && setShowUploader(false)}
                disabled={uploading}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {/* Image Upload */}
              <div className="form-group">
                <label>Item Image *</label>
                <div 
                  className={`image-drop-zone ${uploadPreview ? 'has-image' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploadFile(file);
                        setUploadPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                  {uploadPreview ? (
                    <img src={uploadPreview} alt="Preview" className="upload-preview" />
                  ) : (
                    <div className="upload-placeholder">
                      <span className="upload-icon">📸</span>
                      <span>Click to upload image</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Name */}
              <div className="form-group">
                <label>Item Name *</label>
                <input
                  type="text"
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                  placeholder="e.g., Red Cocktail Dress"
                />
              </div>
              
              {/* Category */}
              <div className="form-group">
                <label>Category *</label>
                <select
                  value={uploadForm.itemType}
                  onChange={(e) => setUploadForm({ ...uploadForm, itemType: e.target.value })}
                >
                  <option value="tops">👕 Tops</option>
                  <option value="dresses">👗 Dresses</option>
                  <option value="bottoms">👖 Bottoms</option>
                  <option value="shoes">👠 Shoes</option>
                  <option value="accessories">👜 Accessories</option>
                  <option value="jewelry">💍 Jewelry</option>
                </select>
              </div>
              
              {/* Character */}
              <div className="form-group">
                <label>Character</label>
                <select
                  value={uploadForm.character}
                  onChange={(e) => setUploadForm({ ...uploadForm, character: e.target.value })}
                >
                  <option value="LaLa">LaLa</option>
                  <option value="Guest">Guest</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              {/* Color */}
              <div className="form-group">
                <label>Color</label>
                <input
                  type="text"
                  value={uploadForm.color}
                  onChange={(e) => setUploadForm({ ...uploadForm, color: e.target.value })}
                  placeholder="e.g., Red, Navy Blue"
                />
              </div>
              
              {/* Notes */}
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={uploadForm.notes}
                  onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                  placeholder="Any special notes about this item..."
                  rows={2}
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button
                className="btn-cancel"
                onClick={() => setShowUploader(false)}
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                className="btn-upload"
                onClick={async () => {
                  if (!uploadFile) {
                    alert('Please select an image');
                    return;
                  }
                  if (!uploadForm.name.trim()) {
                    alert('Please enter an item name');
                    return;
                  }
                  
                  setUploading(true);
                  try {
                    const formData = new FormData();
                    formData.append('image', uploadFile);
                    formData.append('name', uploadForm.name);
                    formData.append('type', 'item');
                    formData.append('itemType', uploadForm.itemType);
                    formData.append('color', uploadForm.color);
                    formData.append('defaultCharacter', uploadForm.character);
                    formData.append('description', uploadForm.notes);
                    formData.append('showId', show.id);
                    
                    await wardrobeLibraryService.uploadToLibrary(formData);
                    
                    // Reset form
                    setUploadForm({ name: '', itemType: 'dresses', color: '', character: 'LaLa', notes: '' });
                    setUploadFile(null);
                    setUploadPreview(null);
                    setShowUploader(false);
                    
                    // Refresh list
                    await fetchWardrobeItems();
                    alert('✅ Wardrobe item added successfully!');
                  } catch (error) {
                    console.error('Upload error:', error);
                    alert('Failed to upload: ' + error.message);
                  } finally {
                    setUploading(false);
                  }
                }}
                disabled={uploading || !uploadFile || !uploadForm.name.trim()}
              >
                {uploading ? 'Uploading...' : '✅ Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShowWardrobeTab;
