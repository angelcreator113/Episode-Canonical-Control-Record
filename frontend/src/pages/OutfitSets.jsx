/**
 * Outfit Sets Feature
 * Create and manage outfit combinations
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './OutfitSets.css';

const OutfitSets = () => {
  const navigate = useNavigate();
  const [outfitSets, setOutfitSets] = useState([]);
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSet, setSelectedSet] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    character: '',
    occasion: '',
    season: '',
    items: []
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCharacter, setFilterCharacter] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load outfit sets
      const setsResponse = await fetch(import.meta.env.VITE_API_URL || '/api/v1/outfit-sets');
      if (setsResponse.ok) {
        const setsData = await setsResponse.json();
        setOutfitSets(setsData.data || []);
      }
      
      // Load wardrobe items
      const itemsResponse = await fetch(import.meta.env.VITE_API_URL || '/api/v1/wardrobe?limit=1000');
      if (itemsResponse.ok) {
        const itemsData = await itemsResponse.json();
        setWardrobeItems(itemsData.data || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSet = () => {
    setSelectedSet(null);
    setFormData({
      name: '',
      description: '',
      character: '',
      occasion: '',
      season: '',
      items: []
    });
    setShowCreateModal(true);
  };

  const handleEditSet = (set) => {
    setSelectedSet(set);
    setFormData({
      name: set.name || '',
      description: set.description || '',
      character: set.character || '',
      occasion: set.occasion || '',
      season: set.season || '',
      items: set.items || []
    });
    setShowCreateModal(true);
  };

  const handleSaveSet = async () => {
    try {
      const url = selectedSet 
        ? `${API_URL}/outfit-sets/${selectedSet.id}`
        : `${API_URL}/outfit-sets`;
      
      const method = selectedSet ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await loadData();
        setShowCreateModal(false);
      } else {
        alert('Failed to save outfit set');
      }
    } catch (err) {
      console.error('Error saving outfit set:', err);
      alert('Error saving outfit set');
    }
  };

  const handleDeleteSet = async (setId) => {
    if (!confirm('Are you sure you want to delete this outfit set?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/outfit-sets/${setId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadData();
      } else {
        alert('Failed to delete outfit set');
      }
    } catch (err) {
      console.error('Error deleting outfit set:', err);
      alert('Error deleting outfit set');
    }
  };

  const toggleItemInSet = (itemId) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.includes(itemId)
        ? prev.items.filter(id => id !== itemId)
        : [...prev.items, itemId]
    }));
  };

  const getItemById = (itemId) => {
    return wardrobeItems.find(item => item.id === itemId);
  };

  const getFilteredSets = () => {
    return outfitSets.filter(set => {
      const matchesSearch = !searchTerm || 
        set.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        set.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCharacter = !filterCharacter || set.character === filterCharacter;
      
      return matchesSearch && matchesCharacter;
    });
  };

  const characters = [...new Set(wardrobeItems.map(item => item.character).filter(Boolean))];

  if (loading) {
    return <div className="outfit-loading">Loading outfit sets...</div>;
  }

  return (
    <div className="outfit-sets-page">
      {/* Header */}
      <div className="outfit-header">
        <div className="header-content">
          <button className="back-button" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h1>👔 Outfit Sets</h1>
          <p>Create and manage complete outfit combinations</p>
        </div>
      </div>

      {/* Controls */}
      <div className="outfit-controls">
        <button className="btn-create-outfit" onClick={handleCreateSet}>
          ➕ Create Outfit Set
        </button>
        
        <div className="controls-filters">
          <input
            type="text"
            placeholder="🔍 Search outfits..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          
          <select
            value={filterCharacter}
            onChange={(e) => setFilterCharacter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Characters</option>
            {characters.map(char => (
              <option key={char} value={char}>{char}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Outfit Sets Grid */}
      <div className="outfit-sets-container">
        {getFilteredSets().length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👔</div>
            <h3>No outfit sets yet</h3>
            <p>Create your first outfit set to combine wardrobe items into complete looks</p>
            <button className="btn-create-first" onClick={handleCreateSet}>
              Create Outfit Set
            </button>
          </div>
        ) : (
          <div className="outfit-sets-grid">
            {getFilteredSets().map(set => (
              <div key={set.id} className="outfit-set-card">
                <div className="outfit-set-header">
                  <h3>{set.name}</h3>
                  <div className="outfit-actions">
                    <button className="btn-icon" onClick={() => handleEditSet(set)} title="Edit">
                      ✏️
                    </button>
                    <button className="btn-icon" onClick={() => handleDeleteSet(set.id)} title="Delete">
                      🗑️
                    </button>
                  </div>
                </div>
                
                {set.description && (
                  <p className="outfit-description">{set.description}</p>
                )}
                
                <div className="outfit-meta">
                  {set.character && <span className="meta-tag character">{set.character}</span>}
                  {set.occasion && <span className="meta-tag occasion">{set.occasion}</span>}
                  {set.season && <span className="meta-tag season">{set.season}</span>}
                </div>
                
                <div className="outfit-items">
                  {set.items && set.items.length > 0 ? (
                    <div className="items-preview">
                      {set.items.map(itemId => {
                        const item = getItemById(itemId);
                        return item ? (
                          <div key={itemId} className="preview-item">
                            {item.s3_url ? (
                              <img src={item.s3_url} alt={item.name} title={item.name} />
                            ) : (
                              <div className="preview-placeholder" title={item.name}>👗</div>
                            )}
                          </div>
                        ) : null;
                      })}
                    </div>
                  ) : (
                    <p className="no-items">No items in this set</p>
                  )}
                  <div className="items-count">
                    {set.items?.length || 0} {set.items?.length === 1 ? 'item' : 'items'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedSet ? 'Edit Outfit Set' : 'Create Outfit Set'}</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Outfit Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Summer Beach Look"
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Describe this outfit set..."
                  className="form-textarea"
                  rows="3"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Character</label>
                  <select
                    value={formData.character}
                    onChange={(e) => setFormData({...formData, character: e.target.value})}
                    className="form-select"
                  >
                    <option value="">Select character</option>
                    {characters.map(char => (
                      <option key={char} value={char}>{char}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Occasion</label>
                  <select
                    value={formData.occasion}
                    onChange={(e) => setFormData({...formData, occasion: e.target.value})}
                    className="form-select"
                  >
                    <option value="">Select occasion</option>
                    <option value="casual">Casual</option>
                    <option value="formal">Formal</option>
                    <option value="work">Work</option>
                    <option value="party">Party</option>
                    <option value="sport">Sport</option>
                    <option value="beach">Beach</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Season</label>
                  <select
                    value={formData.season}
                    onChange={(e) => setFormData({...formData, season: e.target.value})}
                    className="form-select"
                  >
                    <option value="">Select season</option>
                    <option value="spring">Spring</option>
                    <option value="summer">Summer</option>
                    <option value="fall">Fall</option>
                    <option value="winter">Winter</option>
                    <option value="all">All Seasons</option>
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label>Select Items ({formData.items.length} selected)</label>
                <div className="items-selector">
                  {wardrobeItems.map(item => (
                    <div
                      key={item.id}
                      className={`selector-item ${formData.items.includes(item.id) ? 'selected' : ''}`}
                      onClick={() => toggleItemInSet(item.id)}
                    >
                      <div className="selector-image">
                        {item.s3_url ? (
                          <img src={item.s3_url} alt={item.name} />
                        ) : (
                          <div className="selector-placeholder">👗</div>
                        )}
                      </div>
                      <div className="selector-info">
                        <div className="selector-name">{item.name}</div>
                        <div className="selector-meta">{item.clothing_category}</div>
                      </div>
                      {formData.items.includes(item.id) && (
                        <div className="selector-check">✓</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleSaveSet}
                disabled={!formData.name}
              >
                {selectedSet ? 'Update Set' : 'Create Set'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutfitSets;
