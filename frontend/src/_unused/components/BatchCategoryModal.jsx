/**
 * BatchCategoryModal Component
 * Modal for adding/removing categories from multiple episodes at once
 */

import React, { useState, useEffect } from 'react';
import '../styles/BatchCategoryModal.css';

const BatchCategoryModal = ({
  isOpen,
  selectedCount,
  availableCategories = [],
  onClose,
  onApply,
  isLoading = false,
}) => {
  const [action, setAction] = useState('add'); // 'add', 'remove', or 'replace'
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [error, setError] = useState(null);

  const handleCategoryToggle = (category) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter((cat) => cat !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
    setError(null);
  };

  const handleSelectAll = () => {
    if (selectedCategories.length === availableCategories.length) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories([...availableCategories]);
    }
  };

  const handleApply = async () => {
    if (selectedCategories.length === 0) {
      setError('Please select at least one category');
      return;
    }

    try {
      await onApply({
        action,
        categories: selectedCategories,
      });
      // Reset form on success
      setSelectedCategories([]);
      setAction('add');
      setError(null);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to apply category changes');
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="batch-category-modal-overlay">
      <div className="batch-category-modal">
        <div className="modal-header">
          <h2>Batch Category Operations</h2>
          <button
            onClick={onClose}
            className="close-btn"
            aria-label="Close modal"
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        <div className="modal-content">
          <p className="selected-info">
            Applying changes to <strong>{selectedCount} episode(s)</strong>
          </p>

          <div className="action-selection">
            <h3>Select Action:</h3>
            <div className="action-options">
              <label className="action-radio">
                <input
                  type="radio"
                  name="action"
                  value="add"
                  checked={action === 'add'}
                  onChange={(e) => setAction(e.target.value)}
                  disabled={isLoading}
                />
                <span className="action-label">
                  <strong>Add</strong> selected categories to all episodes
                </span>
              </label>

              <label className="action-radio">
                <input
                  type="radio"
                  name="action"
                  value="remove"
                  checked={action === 'remove'}
                  onChange={(e) => setAction(e.target.value)}
                  disabled={isLoading}
                />
                <span className="action-label">
                  <strong>Remove</strong> selected categories from all episodes
                </span>
              </label>

              <label className="action-radio">
                <input
                  type="radio"
                  name="action"
                  value="replace"
                  checked={action === 'replace'}
                  onChange={(e) => setAction(e.target.value)}
                  disabled={isLoading}
                />
                <span className="action-label">
                  <strong>Replace</strong> all categories with selected ones
                </span>
              </label>
            </div>
          </div>

          <div className="category-selection">
            <div className="category-header">
              <h3>Select Categories:</h3>
              <button
                onClick={handleSelectAll}
                className="select-all-btn"
                disabled={isLoading}
              >
                {selectedCategories.length === availableCategories.length
                  ? 'Clear All'
                  : 'Select All'}
              </button>
            </div>

            <div className="categories-list">
              {availableCategories.length === 0 ? (
                <p className="no-categories">No categories available</p>
              ) : (
                availableCategories.map((category) => (
                  <label key={category} className="category-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category)}
                      onChange={() => handleCategoryToggle(category)}
                      disabled={isLoading}
                    />
                    <span className="checkbox-label">{category}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {selectedCategories.length > 0 && (
            <div className="selected-tags">
              <p className="selected-label">
                Selected ({selectedCategories.length}):
              </p>
              <div className="tags-container">
                {selectedCategories.map((cat) => (
                  <div key={cat} className="selected-tag">
                    {cat}
                    <button
                      onClick={() => handleCategoryToggle(cat)}
                      className="tag-remove"
                      disabled={isLoading}
                      aria-label={`Remove ${cat}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="btn btn-primary"
            disabled={isLoading || selectedCategories.length === 0}
          >
            {isLoading ? 'Applying...' : 'Apply Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchCategoryModal;
