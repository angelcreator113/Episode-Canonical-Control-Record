/**
 * FilterPanel.jsx
 * Advanced composition filtering interface
 * Features:
 * - Multi-select filters (format, status, template)
 * - Date range picker
 * - Text search
 * - Asset selector
 * - Sort options
 * - Save/load filter presets
 */

import React, { useState, useEffect } from 'react';
import './FilterPanel.css';

const FilterPanel = ({ episodeId, onFiltersApply, onFiltersReset }) => {
  const [filters, setFilters] = useState({
    formats: [],
    status: '',
    dateFrom: '',
    dateTo: '',
    assets: [],
    template: '',
    search: '',
    sortBy: 'created_at',
    sortOrder: 'DESC'
  });

  const [filterOptions, setFilterOptions] = useState({
    formats: [],
    statuses: [],
    templates: [],
    creators: [],
    dateRange: { earliest_date: null, latest_date: null }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load available filter options on mount
  useEffect(() => {
    loadFilterOptions();
  }, [episodeId]);

  const loadFilterOptions = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (episodeId) query.append('episodeId', episodeId);

      const response = await fetch(`/api/v1/compositions/search/filters/options?${query}`);
      const data = await response.json();

      if (response.ok && data.data) {
        setFilterOptions(data.data);
      }
    } catch (err) {
      console.error('Failed to load filter options:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  const handleFormatToggle = (format) => {
    setFilters(prev => ({
      ...prev,
      formats: prev.formats.includes(format)
        ? prev.formats.filter(f => f !== format)
        : [...prev.formats, format]
    }));
  };

  const handleAssetToggle = (asset) => {
    setFilters(prev => ({
      ...prev,
      assets: prev.assets.includes(asset)
        ? prev.assets.filter(a => a !== asset)
        : [...prev.assets, asset]
    }));
  };

  const handleApplyFilters = () => {
    onFiltersApply && onFiltersApply(filters);
  };

  const handleReset = () => {
    setFilters({
      formats: [],
      status: '',
      dateFrom: '',
      dateTo: '',
      assets: [],
      template: '',
      search: '',
      sortBy: 'created_at',
      sortOrder: 'DESC'
    });
    onFiltersReset && onFiltersReset();
  };

  const activeFilterCount = [
    filters.formats.length,
    filters.status ? 1 : 0,
    filters.dateFrom ? 1 : 0,
    filters.dateTo ? 1 : 0,
    filters.assets.length,
    filters.template ? 1 : 0,
    filters.search ? 1 : 0
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="filter-panel">
      <div className="filter-header">
        <h3>🔍 Filter Compositions</h3>
        {activeFilterCount > 0 && (
          <span className="filter-badge">{activeFilterCount} active</span>
        )}
      </div>

      {error && <div className="filter-error">{error}</div>}

      <div className="filter-section">
        <label className="filter-label">Search</label>
        <input
          type="text"
          placeholder="Search by name..."
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          className="filter-input"
        />
      </div>

      {/* Basic Filters */}
      <div className="filter-section">
        <label className="filter-label">Status</label>
        <select
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="filter-select"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Formats */}
      {filterOptions.formats.length > 0 && (
        <div className="filter-section">
          <label className="filter-label">Formats</label>
          <div className="filter-checkboxes">
            {filterOptions.formats.map(format => (
              <label key={format} className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={filters.formats.includes(format)}
                  onChange={() => handleFormatToggle(format)}
                />
                <span>{format}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Filters Toggle */}
      <button
        className="advanced-toggle"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? '▼' : '▶'} Advanced Filters
      </button>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="advanced-filters">
          {/* Date Range */}
          <div className="filter-section">
            <label className="filter-label">Date Range</label>
            <div className="date-range">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="filter-input"
                placeholder="From"
              />
              <span className="date-separator">to</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="filter-input"
                placeholder="To"
              />
            </div>
          </div>

          {/* Template */}
          {filterOptions.templates.length > 0 && (
            <div className="filter-section">
              <label className="filter-label">Template</label>
              <select
                value={filters.template}
                onChange={(e) => handleFilterChange('template', e.target.value)}
                className="filter-select"
              >
                <option value="">All Templates</option>
                {filterOptions.templates.map(template => (
                  <option key={template} value={template}>
                    {template}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort Options */}
          <div className="filter-section">
            <label className="filter-label">Sort By</label>
            <div className="sort-controls">
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="filter-select"
              >
                <option value="created_at">Created Date</option>
                <option value="updated_at">Modified Date</option>
                <option value="name">Name</option>
              </select>

              <select
                value={filters.sortOrder}
                onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                className="filter-select"
              >
                <option value="DESC">Newest First</option>
                <option value="ASC">Oldest First</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="filter-actions">
        <button
          className="filter-button apply"
          onClick={handleApplyFilters}
          disabled={loading}
        >
          🔎 Apply Filters
        </button>

        <button
          className="filter-button reset"
          onClick={handleReset}
          disabled={activeFilterCount === 0}
        >
          ↻ Clear All
        </button>
      </div>
    </div>
  );
};

export default FilterPanel;
