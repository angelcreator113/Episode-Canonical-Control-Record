import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * usePageData — loads page constants from DB, falls back to defaults.
 *
 * @param {string} pageName  e.g. 'cultural_calendar'
 * @param {Object} defaultsMap  e.g. { CELEBRITY_HIERARCHY: [...], FASHION_TIERS: [...] }
 * @returns {{ data, updateItems, addItem, removeItem, resetKey, saving, editMode, setEditMode }}
 */
export default function usePageData(pageName, defaultsMap) {
  const [overrides, setOverrides] = useState({});
  const [saving, setSaving]       = useState(false);
  const [editMode, setEditMode]   = useState(false);
  const defaultsRef = useRef(defaultsMap);
  defaultsRef.current = defaultsMap;

  // Load saved data from DB on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/page-content/${encodeURIComponent(pageName)}`);
        if (res.ok) {
          const saved = await res.json();
          if (!cancelled) setOverrides(saved);
        }
      } catch (err) {
        console.error(`[usePageData] load error for ${pageName}:`, err);
      }
    })();
    return () => { cancelled = true; };
  }, [pageName]);

  // Merged data: DB overrides win, else defaults
  const data = {};
  for (const key of Object.keys(defaultsRef.current)) {
    data[key] = overrides[key] || defaultsRef.current[key];
  }

  // Persist a full array for a constant key
  const persistKey = useCallback(async (constantKey, newData) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/v1/page-content/${encodeURIComponent(pageName)}/${encodeURIComponent(constantKey)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: newData }),
        }
      );
      if (res.ok) {
        setOverrides(prev => ({ ...prev, [constantKey]: newData }));
      }
    } catch (err) {
      console.error(`[usePageData] save error:`, err);
    } finally {
      setSaving(false);
    }
  }, [pageName]);

  // Replace entire array for a key
  const updateItems = useCallback((constantKey, newItems) => {
    persistKey(constantKey, newItems);
  }, [persistKey]);

  // Update a single item at index
  const updateItem = useCallback((constantKey, index, updatedItem) => {
    const current = overrides[constantKey] || defaultsRef.current[constantKey] || [];
    const copy = [...current];
    copy[index] = updatedItem;
    persistKey(constantKey, copy);
  }, [overrides, persistKey]);

  // Add a new item
  const addItem = useCallback((constantKey, newItem) => {
    const current = overrides[constantKey] || defaultsRef.current[constantKey] || [];
    persistKey(constantKey, [...current, newItem]);
  }, [overrides, persistKey]);

  // Remove item at index
  const removeItem = useCallback((constantKey, index) => {
    const current = overrides[constantKey] || defaultsRef.current[constantKey] || [];
    const copy = current.filter((_, i) => i !== index);
    persistKey(constantKey, copy);
  }, [overrides, persistKey]);

  // Reset a key back to defaults (delete from DB)
  const resetKey = useCallback(async (constantKey) => {
    setSaving(true);
    try {
      await fetch(
        `/api/v1/page-content/${encodeURIComponent(pageName)}/${encodeURIComponent(constantKey)}`,
        { method: 'DELETE' }
      );
      setOverrides(prev => {
        const copy = { ...prev };
        delete copy[constantKey];
        return copy;
      });
    } catch (err) {
      console.error(`[usePageData] reset error:`, err);
    } finally {
      setSaving(false);
    }
  }, [pageName]);

  return { data, updateItems, updateItem, addItem, removeItem, resetKey, saving, editMode, setEditMode };
}
