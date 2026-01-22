import React, { useState } from 'react';
import './AdvancedSearchFilters.css';

export default function AdvancedSearchFilters({ onFilterChange, initialFilters = {} }) {
  const [filters, setFilters] = useState({
    status: initialFilters.status || '',
    scriptType: initialFilters.scriptType || '',
    dateFrom: initialFilters.dateFrom || '',
    dateTo: initialFilters.dateTo || '',
    author: initialFilters.author || '',
    ...initialFilters,
  });

  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleReset = () => {
    const resetFilters = {
      status: '',
      scriptType: '',
      dateFrom: '',
      dateTo: '',
      author: '',
    };
    setFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  const activeFilterCount = Object.values(filters).filter(v => v).length;

  return (
    <div className="advanced-search-filters">
      <button
        className="filters-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>Advanced Filters</span>
        {activeFilterCount > 0 && (
          <span className="filter-badge">{activeFilterCount}</span>
        )}
        <span className={`arrow ${isExpanded ? 'up' : 'down'}`}>▼</span>
      </button>

      {isExpanded && (
        <div className="filters-panel">
          <div className="filter-group">
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Script Type</label>
            <select
              value={filters.scriptType}
              onChange={(e) => handleFilterChange('scriptType', e.target.value)}
            >
              <option value="">All</option>
              <option value="main">Main</option>
              <option value="trailer">Trailer</option>
              <option value="shorts">Shorts</option>
              <option value="teaser">Teaser</option>
              <option value="behind-the-scenes">Behind the Scenes</option>
              <option value="bonus-content">Bonus Content</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Date Range</label>
            <div className="date-range">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                placeholder="From"
              />
              <span>to</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                placeholder="To"
              />
            </div>
          </div>

          <div className="filter-group">
            <label>Author</label>
            <input
              type="text"
              value={filters.author}
              onChange={(e) => handleFilterChange('author', e.target.value)}
              placeholder="Filter by author name..."
            />
          </div>

          <div className="filter-actions">
            <button onClick={handleReset} className="btn-secondary">
              Reset Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
