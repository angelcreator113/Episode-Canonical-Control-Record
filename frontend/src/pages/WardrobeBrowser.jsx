/**
 * Unified Wardrobe Browser
 * Handles both Library (reusable items) and Gallery (episode-specific items) modes
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import wardrobeLibraryService from '../services/wardrobeLibraryService';
import { API_URL } from '../config/api';
import LoadingSpinner from '../components/LoadingSpinner';
import './WardrobeBrowser.css';

const WardrobeBrowser = ({ mode = 'gallery' }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isLibraryMode = mode === 'library';
  
  // State
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  
  // Tab state (for gallery mode)
  const [activeTab, setActiveTab] = useState('gallery'); // 'staging' | 'gallery'
  const [stagingItems, setStagingItems] = useState([]);
  const [fullStagingItems, setFullStagingItems] = useState([]); // Full list for pagination
  const [galleryItems, setGalleryItems] = useState([]); // Separate state for gallery items
  
  // Upload form state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    character: '',
    clothingCategory: '',
    brand: '',
    website: '',
    purchaseLink: '',
    price: '',
    color: '',
    size: '',
    occasion: '',
    season: '',
    tags: [],
    isFavorite: false,
    showId: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  // Modal states
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [usageModalItem, setUsageModalItem] = useState(null);
  const [itemUsage, setItemUsage] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);
  const [editSelectedFile, setEditSelectedFile] = useState(null);
  const [openMenuItemId, setOpenMenuItemId] = useState(null);
  
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
  const itemsPerPage = isLibraryMode ? 20 : 4; // Reduced to 4 for gallery to show pagination
  
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
  
  // Usage tracking (gallery mode only)
  const [itemsWithUsage, setItemsWithUsage] = useState({});
  const [loadingUsage, setLoadingUsage] = useState(false);
  
  // Available filter options
  const [shows, setShows] = useState([]);
  const itemTypes = ['dress', 'top', 'bottom', 'shoes', 'accessory', 'jewelry', 'bag', 'outerwear'];
  const seasons = ['spring', 'summer', 'fall', 'winter'];
  const occasions = ['casual', 'formal', 'business', 'party', 'athletic'];
  const colors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'gray', 'brown', 'pink', 'purple'];
  const characters = ['Lala', 'Just a Woman in Her Prime', 'Guest 1', 'Guest 2'];
  const categories = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories', 'Jewelry'];
  
  // Load data on mount and when filters change
  useEffect(() => {
    loadShows();
    if (isLibraryMode) {
      loadStats();
    }
  }, [isLibraryMode]);
  
  // Note: useEffect for loading items/staging moved after function definitions
  
  // Load usage data for gallery mode items
  useEffect(() => {
    if (!isLibraryMode && items.length > 0) {
      loadUsageForItems(items);
    }
  }, [items, isLibraryMode]);
  
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
          setGalleryItems([]);
          return;
        }
        
        const data = await response.json();
        let wardrobeItems = data.data || [];
        
        // Calculate stats for gallery mode
        calculateGalleryStats(wardrobeItems);
        
        // Apply client-side filtering
        wardrobeItems = applyGalleryFilters(wardrobeItems);
        
        // Store full gallery items list
        setGalleryItems(wardrobeItems);
        
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
  
  // Load staging items (gallery mode only)
  const loadStagingItems = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/wardrobe/staging`);
      if (!response.ok) throw new Error('Failed to load staging items');
      const data = await response.json();
      const allStagingItems = data.data || [];
      setFullStagingItems(allStagingItems);
      
      // Apply pagination for staging items
      const stagingPages = Math.ceil(allStagingItems.length / itemsPerPage);
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      setStagingItems(allStagingItems.slice(startIndex, endIndex));
    } catch (err) {
      console.error('Error loading staging items:', err);
      setStagingItems([]);
      setFullStagingItems([]);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Handle file selection for upload
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  // Handle upload
  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.character || !formData.clothingCategory) {
      alert('Please fill in Name, Character, and Category (required fields)');
      return;
    }
    
    if (!selectedFile) {
      alert('Please select an image file');
      return;
    }
    
    try {
      setUploading(true);
      
      const uploadData = new FormData();
      uploadData.append('image', selectedFile);
      uploadData.append('name', formData.name);
      uploadData.append('character', formData.character);
      uploadData.append('clothingCategory', formData.clothingCategory);
      uploadData.append('isFavorite', formData.isFavorite);
      
      if (formData.brand) uploadData.append('brand', formData.brand);
      if (formData.website) uploadData.append('website', formData.website);
      if (formData.purchaseLink) uploadData.append('purchaseLink', formData.purchaseLink);
      if (formData.price) uploadData.append('price', formData.price);
      if (formData.color) uploadData.append('color', formData.color);
      if (formData.size) uploadData.append('size', formData.size);
      if (formData.occasion) uploadData.append('occasion', formData.occasion);
      if (formData.season) uploadData.append('season', formData.season);
      if (formData.showId) uploadData.append('showId', formData.showId);
      if (formData.tags.length > 0) uploadData.append('tags', JSON.stringify(formData.tags));
      
      const response = await fetch(`${API_URL}/wardrobe`, {
        method: 'POST',
        body: uploadData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      
      // Reset form
      setFormData({
        name: '',
        character: '',
        clothingCategory: '',
        brand: '',
        website: '',
        purchaseLink: '',
        price: '',
        color: '',
        size: '',
        occasion: '',
        season: '',
        tags: [],
        isFavorite: false,
        showId: ''
      });
      setSelectedFile(null);
      setImagePreview(null);
      setShowUploadForm(false);
      
      // Reload data
      if (activeTab === 'staging') {
        loadStagingItems();
      } else {
        loadItems();
      }
      
      alert('Item uploaded successfully!');
    } catch (err) {
      console.error('Upload error:', err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };
  
  // Open edit modal
  const openEditModal = (item) => {
    setEditingItem(item);
    setEditFormData({
      name: item.name || '',
      character: item.character || '',
      clothingCategory: item.clothing_category || '',
      brand: item.brand || '',
      website: item.website || '',
      purchaseLink: item.purchase_link || '',
      price: item.price || '',
      color: item.color || '',
      size: item.size || '',
      occasion: item.metadata?.occasion || '',
      season: item.metadata?.season || '',
      tags: item.tags || [],
      isFavorite: item.is_favorite || false,
      showId: item.show_id || ''
    });
    setEditImagePreview(item.s3_url || item.s3_url_processed || null);
    setEditSelectedFile(null);
  };
  
  // Handle edit form input changes
  const handleEditInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  // Handle edit file selection
  const handleEditFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setEditImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };
  
  // Handle edit submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    
    if (!editFormData.name || !editFormData.character || !editFormData.clothingCategory) {
      alert('Please fill in Name, Character, and Category (required fields)');
      return;
    }
    
    try {
      setUploading(true);
      
      const updateData = new FormData();
      if (editSelectedFile) {
        updateData.append('image', editSelectedFile);
      }
      updateData.append('name', editFormData.name);
      updateData.append('character', editFormData.character);
      updateData.append('clothingCategory', editFormData.clothingCategory);
      updateData.append('isFavorite', editFormData.isFavorite);
      
      if (editFormData.brand) updateData.append('brand', editFormData.brand);
      if (editFormData.website) updateData.append('website', editFormData.website);
      if (editFormData.purchaseLink) updateData.append('purchaseLink', editFormData.purchaseLink);
      if (editFormData.price) updateData.append('price', editFormData.price);
      if (editFormData.color) updateData.append('color', editFormData.color);
      if (editFormData.size) updateData.append('size', editFormData.size);
      if (editFormData.occasion) updateData.append('occasion', editFormData.occasion);
      if (editFormData.season) updateData.append('season', editFormData.season);
      if (editFormData.showId) updateData.append('showId', editFormData.showId);
      if (editFormData.tags.length > 0) updateData.append('tags', JSON.stringify(editFormData.tags));
      
      const response = await fetch(`${API_URL}/wardrobe/${editingItem.id}`, {
        method: 'PUT',
        body: updateData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Update failed');
      }
      
      // Close modal and reset
      setEditingItem(null);
      setEditFormData(null);
      setEditImagePreview(null);
      setEditSelectedFile(null);
      
      // Reload data
      if (activeTab === 'staging') {
        loadStagingItems();
      } else {
        loadItems();
      }
      
      alert('Item updated successfully!');
    } catch (err) {
      console.error('Update error:', err);
      alert(`Update failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };
  
  // Get item usage
  const loadItemUsage = async (itemId) => {
    try {
      const response = await fetch(`${API_URL}/wardrobe/${itemId}/usage`);
      if (!response.ok) throw new Error('Failed to load usage data');
      const data = await response.json();
      setItemUsage(data.data);
    } catch (err) {
      console.error('Error loading usage:', err);
      setItemUsage(null);
    }
  };
  
  // Handle delete
  const handleDelete = async (item) => {
    try {
      const response = await fetch(`${API_URL}/wardrobe/${item.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const error = await response.json();
        if (response.status === 400 && error.usageCount) {
          alert(`Cannot delete: This item is used in ${error.usageCount} episode(s).\n\nPlease view usage details to see where it's used.`);
          setUsageModalItem(item);
          loadItemUsage(item.id);
          return;
        }
        throw new Error(error.error || 'Delete failed');
      }
      
      alert('Item deleted successfully');
      setDeleteConfirmItem(null);
      
      // Reload items
      if (activeTab === 'staging') {
        loadStagingItems();
      } else {
        loadItems();
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert(`Delete failed: ${err.message}`);
    }
  };
  
  // Load items based on tab selection (placed here after function definitions)
  useEffect(() => {
    if (!isLibraryMode) {
      // In gallery mode, always load both datasets
      loadItems(); // This loads gallery items
      loadStagingItems(); // This loads staging items
    } else {
      // In library mode, just load items
      loadItems();
    }
  }, [currentPage, filters, sortBy, searchQuery, mode, isLibraryMode, loadStagingItems, loadItems]);
  
  // Load staging items on initial mount for correct tab count
  useEffect(() => {
    if (!isLibraryMode) {
      loadStagingItems();
    }
  }, [isLibraryMode, loadStagingItems]);
  
  // Check for upload query parameter
  useEffect(() => {
    if (searchParams.get('upload') === 'true' && !isLibraryMode) {
      setShowUploadForm(true);
      // Remove the parameter from URL after opening the form
      searchParams.delete('upload');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, isLibraryMode]);
  
  // Reload data when window regains focus (for cross-tab sync)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (activeTab === 'staging') {
          loadStagingItems();
        } else {
          loadItems();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [activeTab, loadStagingItems, loadItems]);
  
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
  
  // Reset to page 1 when switching tabs
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);
  
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
  
  const loadUsageForItems = async (itemsList) => {
    if (loadingUsage) return;
    
    try {
      setLoadingUsage(true);
      const usageData = {};
      
      // Load usage for first 20 items to avoid too many requests
      const itemsToLoad = itemsList.slice(0, 20);
      
      await Promise.all(
        itemsToLoad.map(async (item) => {
          try {
            const response = await fetch(`${API_URL}/wardrobe/${item.id}/usage`);
            if (response.ok) {
              const data = await response.json();
              usageData[item.id] = data.data;
            }
          } catch (err) {
            console.error(`Failed to load usage for ${item.id}:`, err);
          }
        })
      );
      
      setItemsWithUsage(usageData);
    } catch (err) {
      console.error('Error loading usage data:', err);
    } finally {
      setLoadingUsage(false);
    }
  };
  
  const handleItemClick = (item) => {
    if (isLibraryMode) {
      navigate(`/wardrobe-library/${item.id}`);
    } else {
      // For gallery mode, do nothing (menu handles actions)
      // Only staging items should open edit modal via explicit button
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
              <button className="back-button" onClick={() => navigate('/assets')}>
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
        
        {/* Tabs for Gallery Mode */}
        {!isLibraryMode && (
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'staging' ? 'active' : ''}`}
              onClick={() => setActiveTab('staging')}
            >
              📦 Staging ({fullStagingItems.length})
            </button>
            <button
              className={`tab ${activeTab === 'gallery' ? 'active' : ''}`}
              onClick={() => setActiveTab('gallery')}
            >
              📚 Gallery ({galleryItems.length})
            </button>
          </div>
        )}
        
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
          ) : !isLibraryMode && activeTab === 'staging' ? (
            // Staging Tab Content
            stagingItems.length === 0 ? (
              <div className="empty-state">
                <h3>📦 No items in staging</h3>
                <p>Upload new wardrobe items or all items are already assigned to episodes.</p>
              </div>
            ) : (
              <div className={`items-grid ${viewMode}`}>
                {stagingItems.map(item => (
                  <div 
                    key={item.id} 
                    className="item-card staging-item"
                  >
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
                      {/* 3-dot menu for staging items */}
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
                                openEditModal(item);
                                setOpenMenuItemId(null);
                              }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="menu-option"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUsageModalItem(item);
                                loadItemUsage(item.id);
                                setOpenMenuItemId(null);
                              }}
                            >
                              📊 View Usage
                            </button>
                            <button
                              className="menu-option delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmItem(item);
                                setOpenMenuItemId(null);
                              }}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="item-info">
                      <h3 className="item-name">{item.name}</h3>
                      
                      <div className="item-meta-row">
                        {item.character && (
                          <span className="character-badge">{item.character}</span>
                        )}
                        {item.clothing_category && (
                          <span className="category-badge">{item.clothing_category}</span>
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
                    </div>
                  </div>
                ))}
              </div>
            )
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
                    {!isLibraryMode && itemsWithUsage[item.id]?.episodeFavoriteCount > 0 && (
                      <div className="episode-favorite-badge" title={`Episode favorite in ${itemsWithUsage[item.id].episodeFavoriteCount} episode(s)`}>
                        ⭐ {itemsWithUsage[item.id].episodeFavoriteCount}
                      </div>
                    )}
                    {/* 3-dot menu for gallery items */}
                    {!isLibraryMode && activeTab === 'gallery' && (
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
                                setUsageModalItem(item);
                                loadItemUsage(item.id);
                                setOpenMenuItemId(null);
                              }}
                            >
                              📊 View Usage
                            </button>
                          </div>
                        )}
                      </div>
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
                    
                    {!isLibraryMode && itemsWithUsage[item.id] && (
                      <div className="item-usage-details">
                        {itemsWithUsage[item.id].totalEpisodes > 0 ? (
                          <>
                            <div className="usage-stat">
                              <span className="icon">📺</span>
                              <span>{itemsWithUsage[item.id].totalEpisodes} episode{itemsWithUsage[item.id].totalEpisodes !== 1 ? 's' : ''}</span>
                            </div>
                            {itemsWithUsage[item.id].totalShows > 1 && (
                              <div className="usage-stat cross-show">
                                <span className="icon">🎬</span>
                                <span>{itemsWithUsage[item.id].totalShows} shows</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="usage-stat unused">
                            <span className="icon">📦</span>
                            <span>Not used yet</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Pagination - Show for gallery tab, staging tab, or library mode */}
          {(!isLibraryMode && activeTab === 'staging' && Math.ceil(fullStagingItems.length / itemsPerPage) > 1) ||
           (!isLibraryMode && activeTab === 'gallery' && totalPages > 1) ||
           (isLibraryMode && totalPages > 1) ? (
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
          ) : null}
        </main>
      </div>
      
      {/* Upload Form Modal */}
      {showUploadForm && (
        <div className="modal-overlay" onClick={() => setShowUploadForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ Upload Wardrobe Item</h2>
              <button className="modal-close" onClick={() => setShowUploadForm(false)}>✕</button>
            </div>
            <form onSubmit={handleUpload} className="upload-form">
              <div className="form-section">
                <label>Image *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  required
                />
                {imagePreview && (
                  <div className="image-preview">
                    <img src={imagePreview} alt="Preview" />
                  </div>
                )}
              </div>
              
              <div className="form-section">
                <label>Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Red Blazer"
                  required
                />
              </div>
              
              <div className="form-section">
                <label>Character * (Required)</label>
                <select
                  name="character"
                  value={formData.character}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">-- Select Character --</option>
                  {characters.map(char => (
                    <option key={char} value={char}>{char}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-section">
                <label>Category *</label>
                <select
                  name="clothingCategory"
                  value={formData.clothingCategory}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">-- Select Category --</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-section">
                <label>Brand</label>
                <input
                  type="text"
                  name="brand"
                  value={formData.brand}
                  onChange={handleInputChange}
                  placeholder="e.g., Zara"
                />
              </div>
              
              <div className="form-section">
                <label>Price</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  placeholder="e.g., 89.99"
                  step="0.01"
                />
              </div>
              
              <div className="form-section">
                <label>Color</label>
                <input
                  type="text"
                  name="color"
                  value={formData.color}
                  onChange={handleInputChange}
                  placeholder="e.g., Red"
                />
              </div>
              
              <div className="form-section">
                <label>Size</label>
                <input
                  type="text"
                  name="size"
                  value={formData.size}
                  onChange={handleInputChange}
                  placeholder="e.g., M"
                />
              </div>
              
              <div className="form-section">
                <label>
                  <input
                    type="checkbox"
                    name="isFavorite"
                    checked={formData.isFavorite}
                    onChange={handleInputChange}
                  />
                  {' '}Mark as Global Favorite
                </label>
              </div>
              
              <div className="form-actions">
                <button type="button" onClick={() => setShowUploadForm(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={uploading} className="btn-primary">
                  {uploading ? 'Uploading...' : 'Upload Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmItem(null)}>
          <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚠️ Confirm Delete</h2>
              <button className="modal-close" onClick={() => setDeleteConfirmItem(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{deleteConfirmItem.name}</strong>?</p>
              <p className="warning-text">
                This will permanently delete the item. If it's used in any episodes, deletion will be blocked.
              </p>
            </div>
            <div className="modal-actions">
              <button onClick={() => setDeleteConfirmItem(null)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirmItem)} className="btn-danger">
                Delete Item
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Form Modal */}
      {editingItem && editFormData && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>✏️ Edit Wardrobe Item</h2>
              <button className="modal-close" onClick={() => setEditingItem(null)}>✕</button>
            </div>
            <form onSubmit={handleEditSubmit} className="upload-form">
              <div className="form-section">
                <label>Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleEditFileSelect}
                />
                {editImagePreview && (
                  <div className="image-preview">
                    <img src={editImagePreview} alt="Preview" />
                  </div>
                )}
                <small>Leave empty to keep current image</small>
              </div>
              
              <div className="form-section">
                <label>Name *</label>
                <input
                  type="text"
                  name="name"
                  value={editFormData.name}
                  onChange={handleEditInputChange}
                  placeholder="e.g., Red Blazer"
                  required
                />
              </div>
              
              <div className="form-section">
                <label>Character * (Required)</label>
                <select
                  name="character"
                  value={editFormData.character}
                  onChange={handleEditInputChange}
                  required
                >
                  <option value="">-- Select Character --</option>
                  {characters.map(char => (
                    <option key={char} value={char}>{char}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-section">
                <label>Category *</label>
                <select
                  name="clothingCategory"
                  value={editFormData.clothingCategory}
                  onChange={handleEditInputChange}
                  required
                >
                  <option value="">-- Select Category --</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-section">
                <label>Brand</label>
                <input
                  type="text"
                  name="brand"
                  value={editFormData.brand}
                  onChange={handleEditInputChange}
                  placeholder="e.g., Zara"
                />
              </div>
              
              <div className="form-section">
                <label>Price</label>
                <input
                  type="number"
                  name="price"
                  value={editFormData.price}
                  onChange={handleEditInputChange}
                  placeholder="e.g., 49.99"
                  step="0.01"
                  min="0"
                />
              </div>
              
              <div className="form-section">
                <label>Purchase Link</label>
                <input
                  type="url"
                  name="purchaseLink"
                  value={editFormData.purchaseLink}
                  onChange={handleEditInputChange}
                  placeholder="https://..."
                />
              </div>
              
              <div className="form-section">
                <label>Website</label>
                <input
                  type="url"
                  name="website"
                  value={editFormData.website}
                  onChange={handleEditInputChange}
                  placeholder="https://..."
                />
              </div>
              
              <div className="form-section">
                <label>Color</label>
                <input
                  type="text"
                  name="color"
                  value={editFormData.color}
                  onChange={handleEditInputChange}
                  placeholder="e.g., Red"
                />
              </div>
              
              <div className="form-section">
                <label>Size</label>
                <input
                  type="text"
                  name="size"
                  value={editFormData.size}
                  onChange={handleEditInputChange}
                  placeholder="e.g., M, 8, 38"
                />
              </div>
              
              <div className="form-section">
                <label>Season</label>
                <select
                  name="season"
                  value={editFormData.season}
                  onChange={handleEditInputChange}
                >
                  <option value="">-- Select Season --</option>
                  {seasons.map(season => (
                    <option key={season} value={season}>{season}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-section">
                <label>Occasion</label>
                <select
                  name="occasion"
                  value={editFormData.occasion}
                  onChange={handleEditInputChange}
                >
                  <option value="">-- Select Occasion --</option>
                  {occasions.map(occasion => (
                    <option key={occasion} value={occasion}>{occasion}</option>
                  ))}
                </select>
              </div>
              
              {shows.length > 0 && (
                <div className="form-section">
                  <label>Show</label>
                  <select
                    name="showId"
                    value={editFormData.showId}
                    onChange={handleEditInputChange}
                  >
                    <option value="">-- Select Show --</option>
                    {shows.map(show => (
                      <option key={show.id} value={show.id}>{show.title}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="form-section">
                <label>
                  <input
                    type="checkbox"
                    name="isFavorite"
                    checked={editFormData.isFavorite}
                    onChange={handleEditInputChange}
                  />
                  <span style={{ marginLeft: '8px' }}>Mark as favorite</span>
                </label>
              </div>
              
              <div className="modal-actions">
                <button type="button" onClick={() => setEditingItem(null)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={uploading}>
                  {uploading ? 'Updating...' : 'Update Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Usage Modal */}
      {usageModalItem && (
        <div className="modal-overlay" onClick={() => { setUsageModalItem(null); setItemUsage(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📊 Item Usage: {usageModalItem.name}</h2>
              <button className="modal-close" onClick={() => { setUsageModalItem(null); setItemUsage(null); }}>✕</button>
            </div>
            <div className="modal-body">
              {!itemUsage ? (
                <div className="loading">Loading usage data...</div>
              ) : itemUsage.totalEpisodes === 0 ? (
                <div className="empty-state">
                  <p>✅ This item is not used in any episodes yet.</p>
                  <p>It can be safely deleted.</p>
                </div>
              ) : (
                <div className="usage-details">
                  <div className="usage-summary">
                    <p><strong>Total Episodes:</strong> {itemUsage.totalEpisodes}</p>
                    <p><strong>Total Shows:</strong> {itemUsage.totalShows}</p>
                  </div>
                  <div className="usage-by-show">
                    <h3>Used In:</h3>
                    {itemUsage.shows.map(show => (
                      <div key={show.showId} className="show-usage">
                        <h4>{show.showName || 'Unknown Show'}</h4>
                        <ul>
                          {show.episodes.map(ep => (
                            <li key={ep.episodeId}>
                              Episode {ep.episodeNumber}: {ep.title}
                              {ep.isFavorite && <span className="favorite-badge">⭐</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={() => { setUsageModalItem(null); setItemUsage(null); }} className="btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WardrobeBrowser;
