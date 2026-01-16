/**
 * Bulk Selection Context
 * Manages bulk selection state for episodes and assets
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

const BulkSelectionContext = createContext(null);

export const BulkSelectionProvider = ({ children }) => {
  const [selectedItems, setSelectedItems] = useState(new Set());

  // Toggle selection for a single item
  const toggleItem = useCallback((itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  // Select all items from a list
  const selectAll = useCallback((itemIds) => {
    setSelectedItems(new Set(itemIds));
  }, []);

  // Deselect all items
  const deselectAll = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  // Check if an item is selected
  const isSelected = useCallback((itemId) => {
    return selectedItems.has(itemId);
  }, [selectedItems]);

  // Get array of selected IDs
  const getSelectedIds = useCallback(() => {
    return Array.from(selectedItems);
  }, [selectedItems]);

  // Get count of selected items
  const getSelectionCount = useCallback(() => {
    return selectedItems.size;
  }, [selectedItems]);

  // Episode-specific helpers
  const toggleEpisode = useCallback((episodeId) => {
    toggleItem(episodeId);
  }, [toggleItem]);

  // Asset-specific helpers
  const toggleAsset = useCallback((assetId) => {
    toggleItem(assetId);
  }, [toggleItem]);

  const value = {
    // Generic selection methods
    selectedItems,
    toggleItem,
    selectAll,
    deselectAll,
    isSelected,
    getSelectedIds,
    getSelectionCount,
    
    // Episode-specific methods
    toggleEpisode,
    
    // Asset-specific methods
    toggleAsset,
  };

  return (
    <BulkSelectionContext.Provider value={value}>
      {children}
    </BulkSelectionContext.Provider>
  );
};

export const useBulkSelection = () => {
  const context = useContext(BulkSelectionContext);
  if (!context) {
    throw new Error('useBulkSelection must be used within BulkSelectionProvider');
  }
  return context;
};

export default BulkSelectionContext;
