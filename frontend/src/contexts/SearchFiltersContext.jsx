/**
 * Search Filters Context
 * Manages search and filter state across pages
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

const SearchFiltersContext = createContext(null);

export const SearchFiltersProvider = ({ children }) => {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter state
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    category: [],
    sortBy: 'title',
    sortOrder: 'asc',
  });

  // Update search query
  const updateSearch = useCallback((query) => {
    setSearchQuery(query);
  }, []);

  // Update a single filter
  const updateFilter = useCallback((filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value,
    }));
  }, []);

  // Update multiple filters at once
  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
    }));
  }, []);

  // Reset all filters to defaults
  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setFilters({
      status: 'all',
      type: 'all',
      category: [],
      sortBy: 'title',
      sortOrder: 'asc',
    });
  }, []);

  // Toggle sort order
  const toggleSortOrder = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // Add category to filter
  const addCategory = useCallback((category) => {
    setFilters(prev => ({
      ...prev,
      category: [...prev.category, category],
    }));
  }, []);

  // Remove category from filter
  const removeCategory = useCallback((category) => {
    setFilters(prev => ({
      ...prev,
      category: prev.category.filter(cat => cat !== category),
    }));
  }, []);

  // Toggle category in filter
  const toggleCategory = useCallback((category) => {
    setFilters(prev => {
      const hasCategory = prev.category.includes(category);
      return {
        ...prev,
        category: hasCategory
          ? prev.category.filter(cat => cat !== category)
          : [...prev.category, category],
      };
    });
  }, []);

  // Clear categories
  const clearCategories = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      category: [],
    }));
  }, []);

  const value = {
    // Search
    searchQuery,
    updateSearch,
    
    // Filters
    filters,
    updateFilter,
    updateFilters,
    resetFilters,
    
    // Sort
    toggleSortOrder,
    
    // Categories
    addCategory,
    removeCategory,
    toggleCategory,
    clearCategories,
  };

  return (
    <SearchFiltersContext.Provider value={value}>
      {children}
    </SearchFiltersContext.Provider>
  );
};

export const useSearchFilters = () => {
  const context = useContext(SearchFiltersContext);
  if (!context) {
    throw new Error('useSearchFilters must be used within SearchFiltersProvider');
  }
  return context;
};

export default SearchFiltersContext;
