/**
 * SearchWithCategoryFilter Component
 * Enhanced search with category filtering capability
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import '../styles/SearchWithCategoryFilter.css';

const SearchWithCategoryFilter = ({ results = [], availableCategories = [] }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const categoryParams = searchParams.get('categories') || '';
  const [selectedCategories, setSelectedCategories] = useState(
    categoryParams ? categoryParams.split(',').filter(Boolean) : []
  );
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);

  // Update categories in URL when they change
  const updateCategoryFilter = (categories) => {
    setSelectedCategories(categories);
    const params = new URLSearchParams(searchParams);
    
    if (categories.length > 0) {
      params.set('categories', categories.join(','));
    } else {
      params.delete('categories');
    }
    
    navigate(`/search?${params.toString()}`);
  };

  const handleCategoryToggle = (category) => {
    let updated;
    if (selectedCategories.includes(category)) {
      updated = selectedCategories.filter((cat) => cat !== category);
    } else {
      updated = [...selectedCategories, category];
    }
    updateCategoryFilter(updated);
  };

  const handleClearCategories = () => {
    updateCategoryFilter([]);
  };

  // Filter results by selected categories
  const filteredResults = React.useMemo(() => {
    if (selectedCategories.length === 0) {
      return results;
    }

    return results.filter((episode) => {
      if (!episode.categories || !Array.isArray(episode.categories)) {
        return false;
      }
      return selectedCategories.some((cat) => episode.categories.includes(cat));
    });
  }, [results, selectedCategories]);

  // Extract categories from results
  const extractedCategories = React.useMemo(() => {
    const categories = new Set();
    results.forEach((episode) => {
      if (episode.categories && Array.isArray(episode.categories)) {
        episode.categories.forEach((cat) => {
          if (cat) categories.add(cat);
        });
      }
    });
    return Array.from(categories).sort();
  }, [results]);

  if (!query) {
    return null;
  }

  return (
    <div className="search-filter-section">
      <div className="search-filter-header">
        <button
          className={`filter-toggle ${showCategoryFilter ? 'open' : ''}`}
          onClick={() => setShowCategoryFilter(!showCategoryFilter)}
          aria-expanded={showCategoryFilter}
        >
          🏷️ Filter by Category {selectedCategories.length > 0 && `(${selectedCategories.length})`}
        </button>
        
        {selectedCategories.length > 0 && (
          <div className="active-filters">
            {selectedCategories.map((cat) => (
              <div
                key={cat}
                className="active-filter-tag"
                onClick={() => handleCategoryToggle(cat)}
                role="button"
                tabIndex="0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleCategoryToggle(cat);
                  }
                }}
              >
                {cat} <span className="remove">✕</span>
              </div>
            ))}
            <button
              onClick={handleClearCategories}
              className="clear-filters-btn"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {showCategoryFilter && extractedCategories.length > 0 && (
        <div className="search-filter-dropdown">
          <div className="filter-options">
            {extractedCategories.map((category) => (
              <label key={category} className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category)}
                  onChange={() => handleCategoryToggle(category)}
                  aria-label={`Filter by ${category}`}
                />
                <span className="checkbox-label">{category}</span>
                <span className="category-count">
                  {results.filter((ep) =>
                    ep.categories && ep.categories.includes(category)
                  ).length}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {filteredResults.length !== results.length && (
        <div className="filter-info">
          Showing {filteredResults.length} of {results.length} results
        </div>
      )}
    </div>
  );
};

export default SearchWithCategoryFilter;
