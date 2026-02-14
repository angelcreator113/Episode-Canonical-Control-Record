/**
 * CategoryFilter Component
 * Displays available categories as filter checkboxes
 * Allows filtering episodes by one or multiple categories
 */

import React, { useState, useEffect } from 'react';
import '../styles/CategoryFilter.css';

const CategoryFilter = ({ episodes = [], selectedCategories = [], onCategoryChange = () => {} }) => {
  const [showFilter, setShowFilter] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([]);

  // Extract unique categories from all episodes
  useEffect(() => {
    if (!episodes || episodes.length === 0) {
      setAvailableCategories([]);
      return;
    }

    const categoriesSet = new Set();
    episodes.forEach((episode) => {
      if (episode.categories && Array.isArray(episode.categories)) {
        episode.categories.forEach((cat) => {
          if (cat) categoriesSet.add(cat);
        });
      }
    });

    const sortedCategories = Array.from(categoriesSet).sort();
    setAvailableCategories(sortedCategories);
  }, [episodes]);

  const handleCategoryToggle = (category) => {
    let updated;
    if (selectedCategories.includes(category)) {
      updated = selectedCategories.filter((cat) => cat !== category);
    } else {
      updated = [...selectedCategories, category];
    }
    onCategoryChange(updated);
  };

  const handleClearAll = () => {
    onCategoryChange([]);
  };

  if (availableCategories.length === 0) {
    return null;
  }

  return (
    <div className="category-filter">
      <button
        className={`filter-toggle ${showFilter ? 'open' : ''}`}
        onClick={() => setShowFilter(!showFilter)}
        aria-expanded={showFilter}
      >
        🏷️ Categories {selectedCategories.length > 0 && `(${selectedCategories.length})`}
      </button>

      {showFilter && (
        <div className="category-filter-dropdown">
          <div className="filter-header">
            <h4>Filter by Categories</h4>
            {selectedCategories.length > 0 && (
              <button
                onClick={handleClearAll}
                className="clear-btn"
                aria-label="Clear all category filters"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="filter-options">
            {availableCategories.map((category) => (
              <label key={category} className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category)}
                  onChange={() => handleCategoryToggle(category)}
                  aria-label={`Filter by ${category}`}
                />
                <span className="checkbox-label">{category}</span>
                <span className="category-count">
                  {episodes.filter((ep) =>
                    ep.categories && ep.categories.includes(category)
                  ).length}
                </span>
              </label>
            ))}
          </div>

          {selectedCategories.length > 0 && (
            <div className="selected-categories">
              <p className="selected-label">Selected:</p>
              <div className="category-tags">
                {selectedCategories.map((category) => (
                  <div
                    key={category}
                    className="category-tag"
                    onClick={() => handleCategoryToggle(category)}
                    role="button"
                    tabIndex="0"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleCategoryToggle(category);
                      }
                    }}
                  >
                    {category}
                    <span className="remove-tag">✕</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CategoryFilter;
