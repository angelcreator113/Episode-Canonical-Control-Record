/**
 * EpisodeWardrobe Component
 * Shows all wardrobe items used in a specific episode
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config/api';
import WardrobeCalendarView from './WardrobeCalendarView';
import WardrobeTimelineView from './WardrobeTimelineView';
import wardrobeEnhancements from '../utils/wardrobeEnhancements';
import './EpisodeWardrobe.css';

const EpisodeWardrobe = ({ episodeId, episodeNumber }) => {
  const navigate = useNavigate();
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCharacter, setActiveCharacter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    clothingCategory: '',
    brand: '',
    website: '',
    purchaseLink: '',
    price: '',
    color: '',
    size: '',
    occasion: '',
    season: '',
    character: '',
    scene: '',
    outfitNotes: '',
    isFavorite: false,
    outfitSetId: '',
    outfitSetName: '',
    tags: [],
    additionalEpisodes: [] // For linking to multiple episodes
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 10000 });
  const [sortBy, setSortBy] = useState('name'); // name, price-asc, price-desc, recent

  // View mode states
  const [viewMode, setViewMode] = useState('grid'); // grid, calendar, timeline
  
  // Background processing state
  const [processingBg, setProcessingBg] = useState(null);
  const [processingStatus, setProcessingStatus] = useState(''); // Track processing stage
  const [showProcessed, setShowProcessed] = useState({}); // Track which items show processed version

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

  const openAddForm = () => {
    setEditingItem(null);
    setSelectedFile(null);
    setImagePreview(null);
    setFormData({
      name: '',
      clothingCategory: '',
      brand: '',
      website: '',
      purchaseLink: '',
      price: '',
      color: '',
      size: '',
      occasion: '',
      season: '',
      character: '',
      scene: '',
      outfitNotes: '',
      isFavorite: false,
      outfitSetId: '',
      outfitSetName: '',
      tags: [],
      additionalEpisodes: []
    });
    setShowForm(true);
  };

  const openEditForm = (item) => {
    setEditingItem(item);
    setSelectedFile(null);
    setImagePreview(item.s3_url || null);
    setFormData({
      name: item.name || '',
      clothingCategory: item.clothing_category || '',
      brand: item.brand || '',
      website: item.website || '',
      purchaseLink: item.purchase_link || '',
      price: item.price || '',
      color: item.color || '',
      size: item.size || '',
      occasion: item.occasion || '',
      season: item.season || '',
      character: item.character || '',
      scene: item.episodeLinks?.[0]?.scene || '',
      outfitNotes: item.outfit_notes || '',
      isFavorite: item.is_favorite || false,
      outfitSetId: item.outfit_set_id || '',
      outfitSetName: item.outfit_set_name || '',
      tags: item.tags || [],
      additionalEpisodes: []
    });
    setShowForm(true);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Prepare form data for multipart upload
      const uploadData = new FormData();

      // Add file if selected
      if (selectedFile) {
        uploadData.append('file', selectedFile);
      }

      // Add wardrobe item data (matching new schema)
      uploadData.append('name', formData.name);
      uploadData.append('character', formData.character);
      uploadData.append('clothingCategory', formData.clothingCategory);
      uploadData.append('brand', formData.brand || '');
      uploadData.append('price', formData.price || '');
      uploadData.append('purchaseLink', formData.purchaseLink || '');
      uploadData.append('website', formData.website || '');
      uploadData.append('color', formData.color || '');
      uploadData.append('size', formData.size || '');
      uploadData.append('season', formData.season || '');
      uploadData.append('occasion', formData.occasion || '');
      uploadData.append('outfitSetId', formData.outfitSetId || '');
      uploadData.append('outfitSetName', formData.outfitSetName || '');
      uploadData.append('sceneDescription', formData.scene || '');
      uploadData.append('outfitNotes', formData.outfitNotes || '');
      uploadData.append('isFavorite', formData.isFavorite || false);
      uploadData.append('tags', JSON.stringify(formData.tags || []));

      if (editingItem) {
        // Update existing wardrobe item
        const response = await fetch(`${API_URL}/wardrobe/${editingItem.id}`, {
          method: 'PUT',
          body: uploadData
        });

        if (!response.ok) throw new Error('Failed to update item');
      } else {
        // Create new wardrobe item
        console.log('Creating wardrobe item with data:', {
          name: formData.name,
          character: formData.character,
          clothingCategory: formData.clothingCategory
        });
        
        const createResponse = await fetch(`${API_URL}/wardrobe`, {
          method: 'POST',
          body: uploadData
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.error('Server response:', createResponse.status, errorText);
          throw new Error(`Failed to create wardrobe item: ${createResponse.status} - ${errorText}`);
        }

        const { data: newItem } = await createResponse.json();

        // Link the new wardrobe item to this episode
        const linkResponse = await fetch(`${API_URL}/episodes/${episodeId}/wardrobe/${newItem.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scene: formData.scene || null,
            notes: formData.outfitNotes || null
          })
        });

        if (!linkResponse.ok) {
          console.warn('Failed to link wardrobe to episode, but item was created');
        }

        // Link to additional episodes if specified
        if (formData.additionalEpisodes && formData.additionalEpisodes.length > 0) {
          for (const additionalEpisodeId of formData.additionalEpisodes) {
            try {
              await fetch(`${API_URL}/episodes/${additionalEpisodeId}/wardrobe/${newItem.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scene: null, notes: null })
              });
            } catch (err) {
              console.warn(`Failed to link to episode ${additionalEpisodeId}:`, err);
            }
          }
        }
      }

      // Reload wardrobe items
      await loadEpisodeWardrobe();
      closeForm();
    } catch (err) {
      console.error('Error saving wardrobe item:', err);
      console.error('Form data at time of error:', formData);
      alert(`Failed to save wardrobe item: ${err.message}\n\nCheck console for details.`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Remove "${item.name}" from this episode? This will unlink it but not delete the wardrobe item.`)) {
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

  const handleRemoveBackground = async (item) => {
    if (!item.s3_url) {
      alert('This item has no image to process.');
      return;
    }

    if (!window.confirm(`Remove background from "${item.name}"? This may take 30-60 seconds.`)) {
      return;
    }

    setProcessingBg(item.id);
    setProcessingStatus('Downloading image from S3...');

    try {
      // Call the background removal API with extended timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout

      setTimeout(() => setProcessingStatus('Sending to AI background remover...'), 1000);
      setTimeout(() => setProcessingStatus('AI processing your image...'), 3000);
      setTimeout(() => setProcessingStatus('Almost done, uploading result...'), 25000);

      const response = await fetch(`${API_URL}/wardrobe/${item.id}/process-background`, {
        method: 'POST',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      setProcessingStatus('Finalizing...');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to process' }));
        throw new Error(errorData.message || 'Failed to remove background');
      }

      const result = await response.json();
      console.log('Background removal result:', result);
      
      if (result.success && result.data?.s3_url_processed) {
        console.log('✅ Processed image URL:', result.data.s3_url_processed);
      }

      // Reload wardrobe items to show updated version
      await loadEpisodeWardrobe();
      
      // Automatically show the processed version
      setShowProcessed(prev => ({ ...prev, [item.id]: true }));
      
      alert('✅ Background removed successfully! Toggle the "✨ No BG" button to compare.');
    } catch (err) {
      console.error('Error removing background:', err);
      if (err.name === 'AbortError') {
        alert('⏱️ Background removal timed out. The image may be too large or the service is busy. Please try again.');
      } else {
        alert(`❌ Failed to remove background: ${err.message}`);
      }
    } finally {
      setProcessingBg(null);
      setProcessingStatus('');
    }
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

  const groupedByCategory = filteredItems.reduce((acc, item) => {
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
          <button className="btn-add-wardrobe" onClick={openAddForm}>
            ➕ Add Wardrobe Item
          </button>
        </div>
      ) : (
        <div className="episode-wardrobe">
          <div className="wardrobe-header">
            <div>
              <h2>👗 Episode {episodeNumber} Wardrobe</h2>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <button
                className="btn-view-gallery"
                onClick={() => navigate('/wardrobe')}
                title="View all wardrobe items across episodes"
              >
                🖼️ View Gallery
              </button>
              <button
                className="btn-view-gallery"
                onClick={() => navigate('/wardrobe/analytics')}
                title="View analytics and insights"
              >
                📊 Analytics
              </button>
              <button
                className="btn-add-wardrobe"
                onClick={openAddForm}
                title="Add wardrobe items for this episode"
              >
                ➕ Add Item
              </button>
              <button
                className="btn-add-wardrobe"
                onClick={() => wardrobeEnhancements.exportToPDF(wardrobeItems, {
                  title: `Episode ${episodeNumber} Wardrobe`,
                  character: activeCharacter === 'all' ? 'All' : activeCharacter,
                  includeDetails: true
                })}
                title="Export to PDF lookbook"
              >
                📄 Export PDF
              </button>
              <div className="wardrobe-stats" style={{ display: 'flex', gap: '2rem' }}>
                <div className="stat">
                  <span className="stat-value">{wardrobeItems.length}</span>
                  <span className="stat-label">Total Items</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{Object.keys(groupedByCharacter).length}</span>
                  <span className="stat-label">Characters</span>
                </div>
                <div className="stat budget-stat">
                  <span className="stat-value">${totalBudget.toFixed(2)}</span>
                  <span className="stat-label">Total Budget</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{favoriteItems.length}</span>
                  <span className="stat-label">⭐ Favorites</span>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="search-filter-bar">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by name, brand, color, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button className="clear-search" onClick={() => setSearchQuery('')} title="Clear search">
                  ✕
                </button>
              )}
            </div>

            <div className="filter-controls">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Categories</option>
                <option value="dress">👗 Dresses</option>
                <option value="top">👚 Tops</option>
                <option value="bottom">👖 Bottoms</option>
                <option value="shoes">👠 Shoes</option>
                <option value="accessories">👜 Accessories</option>
                <option value="jewelry">💎 Jewelry</option>
                <option value="perfume">🌸 Perfume</option>
              </select>

              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="filter-select">
                <option value="name">Sort: A-Z</option>
                <option value="price-asc">Sort: Price ↑</option>
                <option value="price-desc">Sort: Price ↓</option>
                <option value="recent">Sort: Recent</option>
              </select>

              <div className="price-filter">
                <label>
                  💰 ${priceRange.min} - ${priceRange.max}
                </label>
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="100"
                  value={priceRange.max}
                  onChange={(e) => setPriceRange({ ...priceRange, max: parseInt(e.target.value) })}
                  className="price-slider"
                />
              </div>
            </div>

            {/* View Mode Toggle (moved here for better mobile UX) */}
            <div className="view-mode-toggle">
              <button
                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                🔲 Grid
              </button>
              <button
                className={`view-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                onClick={() => setViewMode('calendar')}
                title="Calendar View"
              >
                📅 Calendar
              </button>
              <button
                className={`view-btn ${viewMode === 'timeline' ? 'active' : ''}`}
                onClick={() => setViewMode('timeline')}
                title="Timeline View"
              >
                📊 Timeline
              </button>
            </div>
          </div>

          {/* Budget Breakdown by Character */}
          {Object.keys(budgetByCharacter).length > 0 && (
            <div className="budget-breakdown">
              <h3 className="breakdown-title">💰 Budget by Character</h3>
              <div className="budget-bars">
                {Object.entries(budgetByCharacter).map(([character, amount]) => {
                  const percentage = totalBudget > 0 ? (amount / totalBudget) * 100 : 0;
                  return (
                    <div key={character} className="budget-bar-item">
                      <div className="budget-bar-label">
                        <span className="character-name">
                          {character === 'lala' && '💜 Lala'}
                          {character === 'justawoman' && '👩 Just a Woman'}
                          {character === 'guest' && '🎭 Guest'}
                          {!['lala', 'justawoman', 'guest'].includes(character) && `👤 ${character}`}
                        </span>
                        <span className="budget-amount">${amount.toFixed(2)}</span>
                      </div>
                      <div className="budget-bar-container">
                        <div
                          className="budget-bar-fill"
                          style={{ width: `${percentage}%` }}
                          data-character={character}
                        ></div>
                      </div>
                      <div className="budget-percentage">{percentage.toFixed(1)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Character Filter Tabs */}
          <div className="character-tabs">
            <button
              className={`character-tab ${activeCharacter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCharacter('all')}
            >
              🌟 All
            </button>
            <button
              className={`character-tab ${activeCharacter === 'lala' ? 'active' : ''}`}
              onClick={() => setActiveCharacter('lala')}
            >
              💜 Lala
              {groupedByCharacter.lala && <span className="tab-count">{groupedByCharacter.lala.length}</span>}
            </button>
            <button
              className={`character-tab ${activeCharacter === 'justawoman' ? 'active' : ''}`}
              onClick={() => setActiveCharacter('justawoman')}
            >
              👩 Just a Woman
              {groupedByCharacter.justawoman && (
                <span className="tab-count">{groupedByCharacter.justawoman.length}</span>
              )}
            </button>
            <button
              className={`character-tab ${activeCharacter === 'guest' ? 'active' : ''}`}
              onClick={() => setActiveCharacter('guest')}
            >
              🎭 Guest
              {groupedByCharacter.guest && <span className="tab-count">{groupedByCharacter.guest.length}</span>}
            </button>
          </div>

          {/* Calendar View */}
          {viewMode === 'calendar' && <WardrobeCalendarView items={filteredItems} onEditItem={openEditForm} />}

          {/* Timeline View */}
          {viewMode === 'timeline' && <WardrobeTimelineView items={filteredItems} onEditItem={openEditForm} />}

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
                              <>
                                <img
                                  src={showProcessed[item.id] === false ? item.s3_url : (item.s3_url_processed || item.s3_url)}
                                  alt={item.name}
                                  className={item.s3_url_processed && showProcessed[item.id] !== false ? 'has-transparent-bg' : ''}
                                  onError={(e) => {
                                    e.target.src =
                                      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect fill="%23e0e0e0" width="150" height="150"/><text x="75" y="75" text-anchor="middle" fill="%23999" font-size="14" dy=".3em" dominant-baseline="middle">👗</text></svg>';
                                  }}
                                />
                                {item.s3_url_processed && (
                                  <button 
                                    className="btn-toggle-processed"
                                    onClick={() => setShowProcessed(prev => ({ ...prev, [item.id]: prev[item.id] === false ? undefined : false }))}
                                    title={showProcessed[item.id] === false ? "Show processed" : "Show original"}
                                  >
                                    {showProcessed[item.id] === false ? '✨ No BG' : '🖼️ Original'}
                                  </button>
                                )}
                              </>
                            ) : (
                              <div className="placeholder-image">👗</div>
                            )}
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

                            {/* Edit/Delete Actions */}
                            <div className="item-actions">
                              <button className="btn-edit-item" onClick={() => openEditForm(item)} title="Edit item">
                                ✏️ Edit
                              </button>
                              {item.s3_url && (
                                <>
                                  <button 
                                    className="btn-remove-bg" 
                                    onClick={() => handleRemoveBackground(item)} 
                                    title="Remove background"
                                    disabled={processingBg === item.id}
                                  >
                                    {processingBg === item.id ? (
                                      <>⏳ Processing...</>
                                    ) : (
                                      <>🪄 Remove BG</>
                                    )}
                                  </button>
                                  <button 
                                    className="btn-download" 
                                    onClick={() => handleDownloadImage(item, false)}
                                    title="Download original image"
                                  >
                                    💾 Download
                                  </button>
                                  {item.s3_url_processed && (
                                    <button 
                                      className="btn-download-processed" 
                                      onClick={() => handleDownloadImage(item, true)}
                                      title="Download without background"
                                    >
                                      💾 No BG
                                    </button>
                                  )}
                                </>
                              )}
                              <button className="btn-print" onClick={() => handlePrintItem(item)} title="Print item details">
                                🖨️ Print
                              </button>
                              <button className="btn-delete-item" onClick={() => handleDelete(item)} title="Delete item">
                                🗑️ Delete
                              </button>
                            </div>
                            
                            {/* Processing Progress Bar */}
                            {processingBg === item.id && (
                              <div className="bg-processing-overlay">
                                <div className="processing-spinner"></div>
                                <div className="processing-text">{processingStatus || 'Removing background...'}</div>
                                <div className="progress-bar">
                                  <div className="progress-bar-fill"></div>
                                </div>
                                <div className="processing-hint">This may take 30-60 seconds</div>
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ✅ Modal Form - Always available when showForm is true (outside all conditionals) */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content wardrobe-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingItem ? '✏️ Edit Wardrobe Item' : '➕ Add Wardrobe Item'}</h2>
              <button className="modal-close" onClick={closeForm}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                {/* Image Upload */}
                <div className="form-field full-width">
                  <label>Item Image</label>
                  <div className="image-upload-area">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      id="wardrobe-image-upload"
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="wardrobe-image-upload" className="upload-label">
                      {imagePreview ? (
                        <div className="image-preview-container">
                          <img src={imagePreview} alt="Preview" className="image-preview" />
                          <div className="change-image-overlay">
                            <span>📷 Change Image</span>
                          </div>
                        </div>
                      ) : (
                        <div className="upload-placeholder">
                          <span className="upload-icon">📷</span>
                          <span>Click to upload image</span>
                          <small>PNG, JPG up to 10MB</small>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Item Name */}
                <div className="form-field full-width">
                  <label>Item Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Purple Sequin Blazer"
                    required
                  />
                </div>

                {/* Character */}
                <div className="form-field">
                  <label>Character *</label>
                  <select
                    value={formData.character}
                    onChange={(e) => setFormData({ ...formData, character: e.target.value })}
                    required
                  >
                    <option value="">Select character...</option>
                    <option value="lala">💜 Lala</option>
                    <option value="justawoman">👩 Just a Woman</option>
                    <option value="guest">🎭 Guest</option>
                  </select>
                </div>

                {/* Clothing Category */}
                <div className="form-field">
                  <label>Category *</label>
                  <select
                    value={formData.clothingCategory}
                    onChange={(e) => setFormData({ ...formData, clothingCategory: e.target.value })}
                    required
                  >
                    <option value="">Select category...</option>
                    <option value="dress">👗 Dress</option>
                    <option value="top">👚 Top</option>
                    <option value="bottom">👖 Bottom</option>
                    <option value="shoes">👠 Shoes</option>
                    <option value="accessories">👜 Accessories</option>
                    <option value="jewelry">💎 Jewelry</option>
                    <option value="perfume">🌸 Perfume</option>
                  </select>
                </div>

                {/* Brand */}
                <div className="form-field">
                  <label>Brand</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="e.g., Balmain"
                  />
                </div>

                {/* Price */}
                <div className="form-field">
                  <label>Price</label>
                  <input
                    type="text"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="e.g., 2450.00"
                  />
                </div>

                {/* Color */}
                <div className="form-field">
                  <label>Color</label>
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="e.g., Purple"
                  />
                </div>

                {/* Size */}
                <div className="form-field">
                  <label>Size</label>
                  <input
                    type="text"
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    placeholder="e.g., S, M, L, 8"
                  />
                </div>

                {/* Season */}
                <div className="form-field">
                  <label>Season</label>
                  <select value={formData.season} onChange={(e) => setFormData({ ...formData, season: e.target.value })}>
                    <option value="">Select season...</option>
                    <option value="spring">🌸 Spring</option>
                    <option value="summer">☀️ Summer</option>
                    <option value="fall">🍂 Fall</option>
                    <option value="winter">❄️ Winter</option>
                    <option value="all-season">🌍 All Season</option>
                  </select>
                </div>

                {/* Occasion */}
                <div className="form-field">
                  <label>Occasion</label>
                  <select
                    value={formData.occasion}
                    onChange={(e) => setFormData({ ...formData, occasion: e.target.value })}
                  >
                    <option value="">Select occasion...</option>
                    <option value="casual">👕 Casual</option>
                    <option value="formal">🎩 Formal</option>
                    <option value="party">🎉 Party</option>
                    <option value="red-carpet">⭐ Red Carpet</option>
                    <option value="everyday">📅 Everyday</option>
                  </select>
                </div>

                {/* Scene */}
                <div className="form-field">
                  <label>Scene</label>
                  <input
                    type="text"
                    value={formData.scene}
                    onChange={(e) => setFormData({ ...formData, scene: e.target.value })}
                    placeholder="e.g., Opening Interview"
                  />
                </div>

                {/* Purchase Link */}
                <div className="form-field full-width">
                  <label>Purchase Link</label>
                  <input
                    type="url"
                    value={formData.purchaseLink}
                    onChange={(e) => setFormData({ ...formData, purchaseLink: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                {/* Outfit Set ID */}
                <div className="form-field">
                  <label>Outfit Set ID</label>
                  <input
                    type="text"
                    value={formData.outfitSetId}
                    onChange={(e) => setFormData({ ...formData, outfitSetId: e.target.value })}
                    placeholder="e.g., set-001"
                  />
                </div>

                {/* Outfit Set Name */}
                <div className="form-field">
                  <label>Outfit Set Name</label>
                  <input
                    type="text"
                    value={formData.outfitSetName}
                    onChange={(e) => setFormData({ ...formData, outfitSetName: e.target.value })}
                    placeholder="e.g., Purple Power Look"
                  />
                </div>

                {/* Outfit Notes */}
                <div className="form-field full-width">
                  <label>Outfit Notes</label>
                  <textarea
                    value={formData.outfitNotes}
                    onChange={(e) => setFormData({ ...formData, outfitNotes: e.target.value })}
                    placeholder="Add styling notes, care instructions, etc."
                    rows="3"
                  />
                </div>

                {/* Tags */}
                <div className="form-field full-width">
                  <label>Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.tags.join(', ')}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tags: e.target.value
                          .split(',')
                          .map((tag) => tag.trim())
                          .filter((tag) => tag)
                      })
                    }
                    placeholder="e.g., sparkly, vintage, designer"
                  />
                </div>

                {/* Favorite Checkbox */}
                <div className="form-field full-width">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.isFavorite}
                      onChange={(e) => setFormData({ ...formData, isFavorite: e.target.checked })}
                    />
                    <span>⭐ Mark as Favorite</span>
                  </label>
                </div>

                {/* Additional Episodes */}
                <div className="form-field full-width">
                  <label>
                    Link to Additional Episodes
                    <small style={{ fontWeight: 'normal', color: '#6b7280', marginLeft: '0.5rem' }}>
                      (Automatically linked to Episode {episodeNumber})
                    </small>
                  </label>
                  <input
                    type="text"
                    value={formData.additionalEpisodes.join(', ')}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        additionalEpisodes: e.target.value
                          .split(',')
                          .map((id) => id.trim())
                          .filter((id) => id)
                      })
                    }
                    placeholder="Enter episode IDs separated by commas (e.g., ep-002, ep-005)"
                  />
                  <small
                    style={{
                      fontSize: '0.75rem',
                      color: '#6b7280',
                      marginTop: '0.25rem',
                      display: 'block'
                    }}
                  >
                    Use this to link the same item to multiple episodes for tracking
                  </small>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeForm} disabled={saving}>
                Cancel
              </button>
              <button
                className="btn-save"
                onClick={handleSave}
                disabled={saving || !formData.name || !formData.character || !formData.clothingCategory}
              >
                {saving ? '💾 Saving...' : editingItem ? '💾 Update Item' : '➕ Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EpisodeWardrobe;


