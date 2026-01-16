import React, { createContext, useContext, useState, useCallback } from 'react';
import sceneService from '../services/sceneService';

const SceneContext = createContext();

export const useScenes = () => {
  const context = useContext(SceneContext);
  if (!context) {
    throw new Error('useScenes must be used within SceneProvider');
  }
  return context;
};

export const SceneProvider = ({ children }) => {
  const [scenes, setScenes] = useState([]);
  const [selectedScene, setSelectedScene] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  // Load scenes for an episode
  const loadScenes = useCallback(async (episodeId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await sceneService.getScenes(episodeId);
      setScenes(response.data || []);
      setStats(response.stats || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load scenes');
    } finally {
      setLoading(false);
    }
  }, []);

  // Create scene
  const createScene = useCallback(async (sceneData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await sceneService.createScene(sceneData);
      setScenes(prev => [...prev, response.data]);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create scene');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update scene
  const updateScene = useCallback(async (sceneId, sceneData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await sceneService.updateScene(sceneId, sceneData);
      setScenes(prev => prev.map(s => s.id === sceneId ? response.data : s));
      if (selectedScene?.id === sceneId) {
        setSelectedScene(response.data);
      }
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update scene');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedScene]);

  // Delete scene
  const deleteScene = useCallback(async (sceneId) => {
    setLoading(true);
    setError(null);
    try {
      await sceneService.deleteScene(sceneId);
      setScenes(prev => prev.filter(s => s.id !== sceneId));
      if (selectedScene?.id === sceneId) {
        setSelectedScene(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete scene');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedScene]);

  // Reorder scenes
  const reorderScenes = useCallback(async (episodeId, newOrder) => {
    setLoading(true);
    setError(null);
    try {
      await sceneService.reorderScenes(episodeId, newOrder);
      // Optimistic update
      const reordered = newOrder.map(id => scenes.find(s => s.id === id)).filter(Boolean);
      setScenes(reordered);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reorder scenes');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [scenes]);

  // Update scene status
  const updateStatus = useCallback(async (sceneId, status) => {
    try {
      const response = await sceneService.updateSceneStatus(sceneId, status);
      setScenes(prev => prev.map(s => s.id === sceneId ? response.data : s));
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
      throw err;
    }
  }, []);

  const value = {
    scenes,
    selectedScene,
    loading,
    error,
    stats,
    setSelectedScene,
    loadScenes,
    createScene,
    updateScene,
    deleteScene,
    reorderScenes,
    updateStatus,
    clearError: () => setError(null)
  };

  return <SceneContext.Provider value={value}>{children}</SceneContext.Provider>;
};
