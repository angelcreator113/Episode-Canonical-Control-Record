/**
 * Wardrobe Item Drawer
 * Right-side drawer for viewing and editing item details
 * Opens from wardrobe item cards without leaving context
 */

import React, { useState, useEffect } from 'react';
import './WardrobeItemDrawer.css';

const WardrobeItemDrawer = ({ item, isOpen, onClose, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        character: item.character || '',
        brand: item.brand || '',
        color: item.color || '',
        category: item.category || '',
        item_type: item.item_type || '',
        cost: item.cost || '',
        notes: item.notes || '',
        tags: item.tags || []
      });
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(item.id, formData);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`drawer-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`wardrobe-item-drawer ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="drawer-header">
          <h2 className="drawer-title">
            {isEditing ? '✏️ Edit Item' : '👗 Item Details'}
          </h2>
          <button 
            className="drawer-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="drawer-content">
          {/* Image */}
          <div className="drawer-image-section">
            {item.image_url ? (
              <img 
                src={item.image_url} 
                alt={item.name}
                className="drawer-image"
              />
            ) : (
              <div className="drawer-image-placeholder">
                <span className="placeholder-icon">👗</span>
                <span className="placeholder-text">No image</span>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="drawer-metadata">
            {isEditing ? (
              <>
                {/* Edit Form */}
                <div className="form-group">
                  <label>Item Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Character</label>
                    <input
                      type="text"
                      name="character"
                      value={formData.character}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Brand</label>
                    <input
                      type="text"
                      name="brand"
                      value={formData.brand}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="form-input"
                    >
                      <option value="">Select...</option>
                      <option value="tops">Tops</option>
                      <option value="bottoms">Bottoms</option>
                      <option value="dresses">Dresses</option>
                      <option value="shoes">Shoes</option>
                      <option value="accessories">Accessories</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Color</label>
                    <input
                      type="text"
                      name="color"
                      value={formData.color}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Cost</label>
                  <input
                    type="number"
                    name="cost"
                    value={formData.cost}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    className="form-textarea"
                    rows="3"
                    placeholder="Add notes..."
                  />
                </div>
              </>
            ) : (
              <>
                {/* View Mode */}
                <div className="metadata-group">
                  <h3 className="metadata-title">{item.name || 'Untitled Item'}</h3>
                  {item.character && (
                    <div className="metadata-badge">{item.character}</div>
                  )}
                </div>

                <div className="metadata-grid">
                  {item.brand && (
                    <div className="metadata-item">
                      <span className="metadata-label">Brand</span>
                      <span className="metadata-value">{item.brand}</span>
                    </div>
                  )}
                  {item.color && (
                    <div className="metadata-item">
                      <span className="metadata-label">Color</span>
                      <span className="metadata-value">{item.color}</span>
                    </div>
                  )}
                  {item.category && (
                    <div className="metadata-item">
                      <span className="metadata-label">Category</span>
                      <span className="metadata-value">{item.category}</span>
                    </div>
                  )}
                  {item.item_type && (
                    <div className="metadata-item">
                      <span className="metadata-label">Type</span>
                      <span className="metadata-value">{item.item_type}</span>
                    </div>
                  )}
                  {item.cost && (
                    <div className="metadata-item">
                      <span className="metadata-label">Cost</span>
                      <span className="metadata-value">${item.cost}</span>
                    </div>
                  )}
                </div>

                {item.notes && (
                  <div className="metadata-notes">
                    <span className="metadata-label">Notes</span>
                    <p className="notes-text">{item.notes}</p>
                  </div>
                )}

                {/* Episode Usage (if available) */}
                {item.episode_count > 0 && (
                  <div className="metadata-usage">
                    <span className="metadata-label">Used in Episodes</span>
                    <span className="usage-count">{item.episode_count} episode{item.episode_count !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="drawer-footer">
          {isEditing ? (
            <>
              <button 
                className="btn-drawer btn-secondary"
                onClick={() => setIsEditing(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                className="btn-drawer btn-primary"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              <button 
                className="btn-drawer btn-secondary"
                onClick={onClose}
              >
                Close
              </button>
              <button 
                className="btn-drawer btn-primary"
                onClick={() => setIsEditing(true)}
              >
                ✏️ Edit
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default WardrobeItemDrawer;
