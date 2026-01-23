/**
 * Outfit Set Composer
 * Build and manage outfit sets from library items
 */

import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import wardrobeLibraryService from '../services/wardrobeLibraryService';
import { API_URL } from '../config/api';
import LoadingSpinner from './LoadingSpinner';
import './OutfitSetComposer.css';

const SortableItem = ({ id, item, onRemove, onUpdateLayer, onToggleOptional }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  const layers = ['base', 'mid', 'outer', 'accessory'];
  
  return (
    <div ref={setNodeRef} style={style} className="outfit-item">
      <div className="drag-handle" {...attributes} {...listeners}>
        ⋮⋮
      </div>
      
      <div className="item-preview">
        <img 
          src={item.image_url || '/placeholder-wardrobe.png'} 
          alt={item.name}
        />
      </div>
      
      <div className="item-details">
        <h4>{item.name}</h4>
        <span className="item-type">{item.item_type}</span>
      </div>
      
      <div className="item-controls">
        <select 
          value={item.layer || 'base'}
          onChange={(e) => onUpdateLayer(id, e.target.value)}
          className="layer-select"
        >
          {layers.map(layer => (
            <option key={layer} value={layer}>{layer}</option>
          ))}
        </select>
        
        <label className="optional-checkbox">
          <input 
            type="checkbox"
            checked={item.is_optional || false}
            onChange={(e) => onToggleOptional(id, e.target.checked)}
          />
          Optional
        </label>
        
        <button 
          className="btn-remove"
          onClick={() => onRemove(id)}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

const OutfitSetComposer = ({ outfitSet, onSave, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [libraryItems, setLibraryItems] = useState([]);
  const [outfitItems, setOutfitItems] = useState([]);
  const [outfitName, setOutfitName] = useState(outfitSet?.name || '');
  const [outfitDescription, setOutfitDescription] = useState(outfitSet?.description || '');
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  useEffect(() => {
    loadLibraryItems();
    
    if (outfitSet?.id) {
      loadOutfitItems();
    }
  }, [outfitSet]);
  
  const loadLibraryItems = async () => {
    try {
      const result = await wardrobeLibraryService.getLibrary({ type: 'item' }, 1, 100);
      setLibraryItems(result.data || []);
    } catch (err) {
      console.error('Error loading library items:', err);
    }
  };
  
  const loadOutfitItems = async () => {
    try {
      const items = await wardrobeLibraryService.getOutfitItems(outfitSet.id);
      setOutfitItems(items || []);
    } catch (err) {
      console.error('Error loading outfit items:', err);
    }
  };
  
  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      setOutfitItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };
  
  const handleAddItem = (item) => {
    if (outfitItems.find(i => i.id === item.id)) {
      setError('Item already added to outfit');
      return;
    }
    
    setOutfitItems(prev => [...prev, {
      ...item,
      layer: 'base',
      is_optional: false
    }]);
    setError(null);
  };
  
  const handleRemoveItem = (itemId) => {
    setOutfitItems(prev => prev.filter(item => item.id !== itemId));
  };
  
  const handleUpdateLayer = (itemId, layer) => {
    setOutfitItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, layer } : item
    ));
  };
  
  const handleToggleOptional = (itemId, isOptional) => {
    setOutfitItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, is_optional: isOptional } : item
    ));
  };
  
  const handleSave = async () => {
    if (!outfitName.trim()) {
      setError('Please enter an outfit name');
      return;
    }
    
    if (outfitItems.length === 0) {
      setError('Please add at least one item to the outfit');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const outfitData = {
        name: outfitName,
        description: outfitDescription,
        items: outfitItems.map((item, index) => ({
          wardrobe_id: item.id,
          sort_order: index,
          layer: item.layer,
          is_optional: item.is_optional
        }))
      };
      
      if (outfitSet?.id) {
        // Update existing outfit
        await wardrobeLibraryService.updateLibraryItem(outfitSet.id, outfitData);
      } else {
        // Create new outfit
        await wardrobeLibraryService.uploadToLibrary({
          ...outfitData,
          type: 'set'
        });
      }
      
      if (onSave) {
        onSave();
      }
    } catch (err) {
      console.error('Error saving outfit:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const filteredLibraryItems = libraryItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.item_type?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <div className="outfit-set-composer">
      <div className="composer-header">
        <h2>{outfitSet?.id ? 'Edit Outfit Set' : 'Create Outfit Set'}</h2>
        <button className="btn-close" onClick={onClose}>✕</button>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="composer-content">
        <div className="outfit-details">
          <div className="form-group">
            <label>Outfit Name *</label>
            <input 
              type="text"
              value={outfitName}
              onChange={(e) => setOutfitName(e.target.value)}
              placeholder="e.g., Summer Casual Look"
            />
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea 
              value={outfitDescription}
              onChange={(e) => setOutfitDescription(e.target.value)}
              placeholder="Describe this outfit set..."
              rows="3"
            />
          </div>
          
          <div className="outfit-items-section">
            <h3>Outfit Items ({outfitItems.length})</h3>
            
            {outfitItems.length === 0 ? (
              <div className="empty-outfit">
                <p>No items added yet. Add items from the library below.</p>
              </div>
            ) : (
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={outfitItems.map(item => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="outfit-items-list">
                    {outfitItems.map(item => (
                      <SortableItem 
                        key={item.id}
                        id={item.id}
                        item={item}
                        onRemove={handleRemoveItem}
                        onUpdateLayer={handleUpdateLayer}
                        onToggleOptional={handleToggleOptional}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
        
        <div className="library-browser">
          <h3>Add from Library</h3>
          
          <div className="search-box">
            <input 
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="library-items-grid">
            {filteredLibraryItems.map(item => (
              <div key={item.id} className="library-item">
                <img 
                  src={item.image_url || '/placeholder-wardrobe.png'} 
                  alt={item.name}
                />
                <div className="library-item-info">
                  <h4>{item.name}</h4>
                  <span className="item-type">{item.item_type}</span>
                </div>
                <button 
                  className="btn-add"
                  onClick={() => handleAddItem(item)}
                  disabled={outfitItems.find(i => i.id === item.id)}
                >
                  {outfitItems.find(i => i.id === item.id) ? 'Added' : '+ Add'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="composer-footer">
        <button 
          className="btn btn-secondary"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </button>
        
        <button 
          className="btn btn-primary"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? (
            <>
              <LoadingSpinner size="small" /> Saving...
            </>
          ) : (
            'Save Outfit Set'
          )}
        </button>
      </div>
    </div>
  );
};

export default OutfitSetComposer;
