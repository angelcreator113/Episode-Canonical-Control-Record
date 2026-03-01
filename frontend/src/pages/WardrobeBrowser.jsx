/**
 * Unified Wardrobe Browser
 * Handles both Library (reusable items) and Gallery (episode-specific items) modes
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import wardrobeLibraryService from '../services/wardrobeLibraryService';
import { API_URL } from '../config/api';
import LoadingSpinner from '../components/LoadingSpinner';
import './WardrobeBrowser.css';

const WardrobeBrowser = ({ mode = 'gallery', embedded = false }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isLibraryMode = mode === 'library';
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);
  
  // State
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [isDragging, setIsDragging] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
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
  const itemsPerPage = isLibraryMode ? 20 : 20;
  
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
  
  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0] && files[0].type.startsWith('image/')) {
      setSelectedFile(files[0]);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(files[0]);
      setShowUploadForm(true);
    }
  };

  // Count active filters
  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

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
  
  // Get unique values for filter dropdowns from full gallery data
  const allCharacters = isLibraryMode ? [] : [...new Set(galleryItems.map(i => i.character).filter(Boolean))];
  const allCategories = isLibraryMode ? [] : [...new Set(galleryItems.map(i => i.clothing_category).filter(Boolean))];
  const allColors = isLibraryMode ? [] : [...new Set(galleryItems.map(i => i.color).filter(Boolean))];
  
  if (loading && items.length === 0) {
    return <LoadingSpinner />;
  }

  // Color swatches map
  const colorSwatchMap = {
    red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
    black: '#1f2937', white: '#f9fafb', gray: '#9ca3af', grey: '#9ca3af',
    brown: '#92400e', pink: '#ec4899', purple: '#a855f7', orange: '#f97316',
    navy: '#1e3a5f', beige: '#d4b896', cream: '#fffdd0', gold: '#d4a017',
    silver: '#c0c0c0', teal: '#14b8a6', coral: '#f87171', maroon: '#7f1d1d',
    olive: '#84cc16', burgundy: '#800020', lavender: '#a78bfa', mint: '#6ee7b7',
    tan: '#d2b48c', ivory: '#fffff0', nude: '#e8c39e', champagne: '#f7e7ce',
  };

  return (
    <div 
      className={`wardrobe-browser ${mode}-mode`}
      ref={dropZoneRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="drag-overlay">
          <div className="drag-overlay-content">
            <span className="drag-icon">+</span>
            <p>Drop image to add wardrobe item</p>
          </div>
        </div>
      )}

      {/* Header — hidden when embedded in UniversePage */}
      {!embedded && (
        <div className="browser-header">
          <div className="header-top">
            <div className="header-title-section">
              {!isLibraryMode && (
                <button className="back-button" onClick={() => navigate('/assets')}>
                  ← Back
                </button>
              )}
              <h1>{isLibraryMode ? 'Wardrobe Library' : 'Wardrobe Gallery'}</h1>
              <p>{isLibraryMode ? 'Manage your reusable wardrobe collection' : 'Browse all wardrobe items across episodes'}</p>
            </div>
            {isLibraryMode && (
              <button className="btn btn-primary" onClick={() => navigate('/wardrobe-library/upload')}>
                + Upload Item
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats Dashboard Cards */}
      {!isLibraryMode && stats.total > 0 && (
        <div className="stats-dashboard">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Items</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{Object.keys(stats.characters || {}).length}</div>
            <div className="stat-label">Characters</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{Object.keys(stats.categories || {}).length}</div>
            <div className="stat-label">Categories</div>
          </div>
          <div className="stat-card accent">
            <div className="stat-value">${stats.totalSpent > 0 ? stats.totalSpent.toFixed(0) : '0'}</div>
            <div className="stat-label">Total Spent</div>
          </div>
        </div>
      )}

      {/* Toolbar: Search + Filters + Upload + View toggle */}
      <div className="wardrobe-toolbar">
        <div className="toolbar-row">
          <div className="search-bar">
            <svg className="search-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => { setSearchQuery(''); setCurrentPage(1); }}>
                ×
              </button>
            )}
          </div>

          <div className="toolbar-actions">
            {!isLibraryMode && (
              <button 
                className={`toolbar-btn filter-btn ${showFilters ? 'active' : ''}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                Filters
                {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
              </button>
            )}
            
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
                  <option value="price-asc">Price (Low-High)</option>
                  <option value="price-desc">Price (High-Low)</option>
                </>
              )}
            </select>

            <div className="view-mode-toggle">
              <button 
                className={viewMode === 'grid' ? 'active' : ''}
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              </button>
              <button 
                className={viewMode === 'list' ? 'active' : ''}
                onClick={() => setViewMode('list')}
                title="List view"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="4" width="18" height="3" rx="1"/><rect x="3" y="10.5" width="18" height="3" rx="1"/>
                  <rect x="3" y="17" width="18" height="3" rx="1"/>
                </svg>
              </button>
            </div>

            {!isLibraryMode && (
              <button 
                className="toolbar-btn upload-btn"
                onClick={() => setShowUploadForm(true)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Upload
              </button>
            )}

            {isLibraryMode && (
              <button 
                className={`toolbar-btn ${bulkMode ? 'active' : ''}`}
                onClick={toggleBulkMode}
              >
                {bulkMode ? 'Exit Bulk' : 'Bulk Select'}
              </button>
            )}
          </div>
        </div>

        {/* Gallery Filter Bar */}
        {!isLibraryMode && showFilters && (
          <div className="gallery-filter-bar">
            <select value={filters.character} onChange={(e) => handleFilterChange('character', e.target.value)}>
              <option value="">All Characters</option>
              {(allCharacters.length > 0 ? allCharacters : characters).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select value={filters.category} onChange={(e) => handleFilterChange('category', e.target.value)}>
              <option value="">All Categories</option>
              {(allCategories.length > 0 ? allCategories : categories).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select value={filters.color} onChange={(e) => handleFilterChange('color', e.target.value)}>
              <option value="">All Colors</option>
              {(allColors.length > 0 ? allColors : colors).map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>

            <select value={filters.season} onChange={(e) => handleFilterChange('season', e.target.value)}>
              <option value="">All Seasons</option>
              {seasons.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>

            <select value={filters.occasion} onChange={(e) => handleFilterChange('occasion', e.target.value)}>
              <option value="">All Occasions</option>
              {occasions.map(o => (
                <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
              ))}
            </select>

            {activeFilterCount > 0 && (
              <button className="clear-filters-btn" onClick={handleClearFilters}>
                Clear All
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs for Gallery Mode: Staging / Gallery */}
      {!isLibraryMode && (
        <div className="gallery-tabs">
          <button
            className={`gallery-tab ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => setActiveTab('gallery')}
          >
            Gallery <span className="tab-count">{galleryItems.length}</span>
          </button>
          <button
            className={`gallery-tab ${activeTab === 'staging' ? 'active' : ''}`}
            onClick={() => setActiveTab('staging')}
          >
            Staging <span className="tab-count">{fullStagingItems.length}</span>
          </button>
        </div>
      )}  

      <div className="browser-content">
        {/* Filter Sidebar - Only show in Library mode */}
        {isLibraryMode && (
          <aside className="filter-sidebar">
            <div className="filter-header">
              <h3>Filters</h3>
              <button className="btn-text" onClick={handleClearFilters}>Clear All</button>
            </div>
          
            <div className="filter-section">
              <label>Type</label>
              <select value={filters.type} onChange={(e) => handleFilterChange('type', e.target.value)}>
                <option value="">All Types</option>
                <option value="item">Individual Item</option>
                <option value="set">Outfit Set</option>
              </select>
            </div>
            
            <div className="filter-section">
              <label>Item Type</label>
              <select value={filters.item_type} onChange={(e) => handleFilterChange('item_type', e.target.value)}>
                <option value="">All Items</option>
                {itemTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          
            <div className="filter-section">
              <label>Color</label>
              <select value={filters.color} onChange={(e) => handleFilterChange('color', e.target.value)}>
                <option value="">All Colors</option>
                {colors.map(color => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
            </div>
          
            <div className="filter-section">
              <label>Season</label>
              <select value={filters.season} onChange={(e) => handleFilterChange('season', e.target.value)}>
                <option value="">All Seasons</option>
                {seasons.map(season => (
                  <option key={season} value={season}>{season}</option>
                ))}
              </select>
            </div>
          
            <div className="filter-section">
              <label>Occasion</label>
              <select value={filters.occasion} onChange={(e) => handleFilterChange('occasion', e.target.value)}>
                <option value="">All Occasions</option>
                {occasions.map(occasion => (
                  <option key={occasion} value={occasion}>{occasion}</option>
                ))}
              </select>
            </div>
          
            {shows.length > 0 && (
              <div className="filter-section">
                <label>Show</label>
                <select value={filters.show_id} onChange={(e) => handleFilterChange('show_id', e.target.value)}>
                  <option value="">All Shows</option>
                  {shows.map(show => (
                    <option key={show.id} value={show.id}>{show.title}</option>
                  ))}
                </select>
              </div>
            )}
          
            <div className="filter-section">
              <label>Status</label>
              <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
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
                <button className="btn-danger" onClick={handleBulkDelete}>Delete Selected</button>
              </div>
            </div>
          )}
          
          {/* Results Info */}
          <div className="results-info">
            Showing {items.length > 0 ? ((currentPage - 1) * itemsPerPage + 1) : 0}–{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          {loading ? (
            <div className="loading-state">Loading items...</div>
          ) : !isLibraryMode && activeTab === 'staging' ? (
            // Staging Tab Content
            stagingItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon-wrap">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  </svg>
                </div>
                <h3>No items in staging</h3>
                <p>Upload new wardrobe items or all items are already assigned to episodes.</p>
                <button className="empty-cta" onClick={() => setShowUploadForm(true)}>Upload Item</button>
              </div>
            ) : (
              <div className={`items-grid ${viewMode}`}>
                {stagingItems.map(item => renderItemCard(item, true))}
              </div>
            )
          ) : items.length === 0 ? (
            <div className="empty-state wardrobe-welcome">
              <div className="empty-icon-wrap">
                <span style={{ fontSize: '2.5rem' }}>👗</span>
              </div>
              <h3>Wardrobe Gallery</h3>
              {searchQuery ? (
                <p>No items match your search. Try adjusting your filters.</p>
              ) : (
                <>
                  <p>Track costumes, accessories, and wardrobe pieces across your episodes.</p>
                  <div className="welcome-features">
                    <div className="welcome-feature">
                      <span className="feature-icon">📸</span>
                      <span>Upload photos of wardrobe items</span>
                    </div>
                    <div className="welcome-feature">
                      <span className="feature-icon">🏷️</span>
                      <span>Tag by character, color &amp; category</span>
                    </div>
                    <div className="welcome-feature">
                      <span className="feature-icon">👔</span>
                      <span>Build outfit sets for scenes</span>
                    </div>
                  </div>
                </>
              )}
              <button className="empty-cta" onClick={() => setShowUploadForm(true)}>
                + Upload First Item
              </button>
            </div>
          ) : (
            <div className={`items-grid ${viewMode}`}>
              {items.map(item => renderItemCard(item, false))}
            </div>
          )}
          
          {/* Pagination */}
          {((!isLibraryMode && activeTab === 'staging' && Math.ceil(fullStagingItems.length / itemsPerPage) > 1) ||
            (!isLibraryMode && activeTab === 'gallery' && totalPages > 1) ||
            (isLibraryMode && totalPages > 1)) && (
            <div className="pagination-controls">
              <button className="pagination-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>«</button>
              <button className="pagination-btn" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>‹ Prev</button>
              
              <div className="pagination-numbers">
                {[...Array(totalPages)].map((_, index) => {
                  const pageNum = index + 1;
                  if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                    return (
                      <button key={pageNum} className={`pagination-number ${currentPage === pageNum ? 'active' : ''}`} onClick={() => setCurrentPage(pageNum)}>
                        {pageNum}
                      </button>
                    );
                  } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                    return <span key={pageNum} className="pagination-ellipsis">...</span>;
                  }
                  return null;
                })}
              </div>
              
              <button className="pagination-btn" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>Next ›</button>
              <button className="pagination-btn" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>»</button>
            </div>
          )}
        </main>
      </div>
      
      {/* Upload Form Modal */}
      {showUploadForm && (
        <div className="modal-overlay" onClick={() => setShowUploadForm(false)}>
          <div className="modal-content upload-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Wardrobe Item</h2>
              <button className="modal-close" onClick={() => setShowUploadForm(false)}>×</button>
            </div>
            <form onSubmit={handleUpload} className="upload-form">
              {/* Drag-drop image area */}
              <div className="form-section">
                <label>Image *</label>
                <div 
                  className={`upload-drop-area ${imagePreview ? 'has-image' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith('image/')) {
                      setSelectedFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => setImagePreview(reader.result);
                      reader.readAsDataURL(file);
                    }
                  }}
                >
                  {imagePreview ? (
                    <div className="upload-preview">
                      <img src={imagePreview} alt="Preview" />
                      <button type="button" className="remove-preview" onClick={(e) => {
                        e.stopPropagation();
                        setImagePreview(null);
                        setSelectedFile(null);
                      }}>×</button>
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <p>Click or drag image here</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-section">
                  <label>Name *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g., Red Blazer" required />
                </div>
                <div className="form-section">
                  <label>Brand</label>
                  <input type="text" name="brand" value={formData.brand} onChange={handleInputChange} placeholder="e.g., Zara" />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-section">
                  <label>Character *</label>
                  <select name="character" value={formData.character} onChange={handleInputChange} required>
                    <option value="">Select Character</option>
                    {characters.map(char => <option key={char} value={char}>{char}</option>)}
                  </select>
                </div>
                <div className="form-section">
                  <label>Category *</label>
                  <select name="clothingCategory" value={formData.clothingCategory} onChange={handleInputChange} required>
                    <option value="">Select Category</option>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-section">
                  <label>Price</label>
                  <input type="number" name="price" value={formData.price} onChange={handleInputChange} placeholder="49.99" step="0.01" />
                </div>
                <div className="form-section">
                  <label>Color</label>
                  <input type="text" name="color" value={formData.color} onChange={handleInputChange} placeholder="e.g., Red" />
                </div>
                <div className="form-section">
                  <label>Size</label>
                  <input type="text" name="size" value={formData.size} onChange={handleInputChange} placeholder="e.g., M" />
                </div>
              </div>
              
              <div className="form-section">
                <label>
                  <input type="checkbox" name="isFavorite" checked={formData.isFavorite} onChange={handleInputChange} />
                  <span style={{ marginLeft: 8 }}>Mark as Favorite</span>
                </label>
              </div>
              
              <div className="form-actions">
                <button type="button" onClick={() => setShowUploadForm(false)} className="btn-secondary">Cancel</button>
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
              <h2>Confirm Delete</h2>
              <button className="modal-close" onClick={() => setDeleteConfirmItem(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{deleteConfirmItem.name}</strong>?</p>
              <p className="warning-text">This will permanently delete the item. If it's used in episodes, deletion will be blocked.</p>
            </div>
            <div className="modal-actions">
              <button onClick={() => setDeleteConfirmItem(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirmItem)} className="btn-danger">Delete Item</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Form Modal */}
      {editingItem && editFormData && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Edit Wardrobe Item</h2>
              <button className="modal-close" onClick={() => setEditingItem(null)}>×</button>
            </div>
            <form onSubmit={handleEditSubmit} className="upload-form">
              <div className="form-section">
                <label>Image</label>
                <input type="file" accept="image/*" onChange={handleEditFileSelect} />
                {editImagePreview && (
                  <div className="image-preview">
                    <img src={editImagePreview} alt="Preview" />
                  </div>
                )}
                <small>Leave empty to keep current image</small>
              </div>
              
              <div className="form-row">
                <div className="form-section">
                  <label>Name *</label>
                  <input type="text" name="name" value={editFormData.name} onChange={handleEditInputChange} required />
                </div>
                <div className="form-section">
                  <label>Brand</label>
                  <input type="text" name="brand" value={editFormData.brand} onChange={handleEditInputChange} placeholder="e.g., Zara" />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-section">
                  <label>Character *</label>
                  <select name="character" value={editFormData.character} onChange={handleEditInputChange} required>
                    <option value="">Select Character</option>
                    {characters.map(char => <option key={char} value={char}>{char}</option>)}
                  </select>
                </div>
                <div className="form-section">
                  <label>Category *</label>
                  <select name="clothingCategory" value={editFormData.clothingCategory} onChange={handleEditInputChange} required>
                    <option value="">Select Category</option>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-section">
                  <label>Price</label>
                  <input type="number" name="price" value={editFormData.price} onChange={handleEditInputChange} step="0.01" min="0" />
                </div>
                <div className="form-section">
                  <label>Color</label>
                  <input type="text" name="color" value={editFormData.color} onChange={handleEditInputChange} />
                </div>
                <div className="form-section">
                  <label>Size</label>
                  <input type="text" name="size" value={editFormData.size} onChange={handleEditInputChange} />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-section">
                  <label>Season</label>
                  <select name="season" value={editFormData.season} onChange={handleEditInputChange}>
                    <option value="">Select Season</option>
                    {seasons.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-section">
                  <label>Occasion</label>
                  <select name="occasion" value={editFormData.occasion} onChange={handleEditInputChange}>
                    <option value="">Select Occasion</option>
                    {occasions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-section">
                  <label>Purchase Link</label>
                  <input type="url" name="purchaseLink" value={editFormData.purchaseLink} onChange={handleEditInputChange} placeholder="https://..." />
                </div>
                <div className="form-section">
                  <label>Website</label>
                  <input type="url" name="website" value={editFormData.website} onChange={handleEditInputChange} placeholder="https://..." />
                </div>
              </div>
              
              {shows.length > 0 && (
                <div className="form-section">
                  <label>Show</label>
                  <select name="showId" value={editFormData.showId} onChange={handleEditInputChange}>
                    <option value="">Select Show</option>
                    {shows.map(show => <option key={show.id} value={show.id}>{show.title}</option>)}
                  </select>
                </div>
              )}
              
              <div className="form-section">
                <label>
                  <input type="checkbox" name="isFavorite" checked={editFormData.isFavorite} onChange={handleEditInputChange} />
                  <span style={{ marginLeft: 8 }}>Mark as favorite</span>
                </label>
              </div>
              
              <div className="modal-actions">
                <button type="button" onClick={() => setEditingItem(null)} className="btn-secondary">Cancel</button>
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
              <h2>Item Usage: {usageModalItem.name}</h2>
              <button className="modal-close" onClick={() => { setUsageModalItem(null); setItemUsage(null); }}>×</button>
            </div>
            <div className="modal-body">
              {!itemUsage ? (
                <div className="loading">Loading usage data...</div>
              ) : itemUsage.totalEpisodes === 0 ? (
                <div className="empty-state compact">
                  <p>This item is not used in any episodes yet.</p>
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
                              {ep.isFavorite && <span className="favorite-badge-inline">★</span>}
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
              <button onClick={() => { setUsageModalItem(null); setItemUsage(null); }} className="btn-primary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render a single item card
  function renderItemCard(item, isStaging) {
    const imgUrl = getImageUrl(item);
    const usage = itemsWithUsage[item.id];
    const colorHex = colorSwatchMap[(item.color || '').toLowerCase()];
    
    return (
      <div 
        key={item.id} 
        className={`item-card ${bulkMode ? 'bulk-mode' : ''} ${selectedItems.has(item.id) ? 'selected' : ''} ${!imgUrl ? 'placeholder-card' : ''}`}
      >
        {bulkMode && (
          <div className="selection-checkbox">
            <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleItemSelection(item.id)} />
          </div>
        )}
        
        <div className="item-image">
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={item.name}
              loading="lazy"
              onError={(e) => {
                e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect fill="%23f3f4f6" width="150" height="150"/><text x="75" y="80" text-anchor="middle" fill="%239ca3af" font-size="14">No Image</text></svg>';
              }}
            />
          ) : (
            <div className="placeholder-image">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
          )}
          
          {item.is_favorite && <div className="favorite-badge">★</div>}
          
          {!isLibraryMode && usage?.episodeFavoriteCount > 0 && (
            <div className="episode-favorite-badge" title={`Favorite in ${usage.episodeFavoriteCount} episode(s)`}>
              ★ {usage.episodeFavoriteCount}
            </div>
          )}

          {/* Hover overlay with quick actions */}
          <div className="card-hover-overlay">
            <button className="overlay-action" title="Edit" onClick={(e) => { e.stopPropagation(); openEditModal(item); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button className="overlay-action" title="View Usage" onClick={(e) => { e.stopPropagation(); setUsageModalItem(item); loadItemUsage(item.id); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button className="overlay-action danger" title="Delete" onClick={(e) => { e.stopPropagation(); setDeleteConfirmItem(item); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div className="item-info">
          <h3 className="item-name">{item.name}</h3>
          
          <div className="item-meta-row">
            {!isLibraryMode && item.character && (
              <span className="character-badge">{item.character}</span>
            )}
            {(item.clothing_category || item.item_type) && (
              <span className="category-badge">{item.clothing_category || item.item_type}</span>
            )}
          </div>
          
          <div className="item-details-row">
            {item.brand && <span className="detail-chip brand-chip">{item.brand}</span>}
            {item.price && <span className="detail-chip price-chip">${item.price}</span>}
            {item.color && (
              <span className="detail-chip color-chip">
                {colorHex && <span className="color-dot" style={{ background: colorHex }} />}
                {item.color}
              </span>
            )}
          </div>
          
          {(item.season || item.occasion) && (
            <div className="item-tags-row">
              {item.season && <span className="mini-tag">{item.season}</span>}
              {item.occasion && <span className="mini-tag">{item.occasion}</span>}
            </div>
          )}
          
          {!isLibraryMode && usage && (
            <div className="item-usage-strip">
              {usage.totalEpisodes > 0 ? (
                <span className="usage-info">{usage.totalEpisodes} ep{usage.totalEpisodes !== 1 ? 's' : ''}{usage.totalShows > 1 ? ` · ${usage.totalShows} shows` : ''}</span>
              ) : (
                <span className="usage-info unused">Not used yet</span>
              )}
            </div>
          )}
          
          {isLibraryMode && item.total_usage_count > 0 && (
            <div className="item-usage-strip">
              <span className="usage-info">Used {item.total_usage_count} times</span>
            </div>
          )}
        </div>
      </div>
    );
  }
};

export default WardrobeBrowser;
