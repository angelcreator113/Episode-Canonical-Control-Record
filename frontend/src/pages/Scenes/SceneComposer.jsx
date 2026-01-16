import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SceneProvider, useScenes } from '../../contexts/SceneContext';
import SceneList from '../../components/Scenes/SceneList';
import SceneFormModal from '../../components/Scenes/SceneFormModal';
import CanvasTimeline from '../../components/Scenes/CanvasTimeline';
import './SceneComposer.css';

const SceneComposerContent = () => {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  
  const {
    scenes,
    loading,
    error,
    stats,
    loadScenes,
    createScene,
    updateScene,
    deleteScene,
    updateStatus,
    clearError
  } = useScenes();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScene, setEditingScene] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Load scenes on mount
  useEffect(() => {
    if (episodeId) {
      loadScenes(episodeId);
    }
  }, [episodeId, loadScenes]);

  const handleCreateScene = () => {
    setEditingScene(null);
    setIsModalOpen(true);
  };

  const handleEditScene = (scene) => {
    setEditingScene(scene);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (sceneData) => {
    try {
      if (editingScene) {
        await updateScene(editingScene.id, sceneData);
      } else {
        await createScene(sceneData);
      }
      setIsModalOpen(false);
      setEditingScene(null);
      // Reload scenes to get updated list
      loadScenes(episodeId);
    } catch (err) {
      console.error('Failed to save scene:', err);
    }
  };

  const handleDeleteClick = (sceneId) => {
    setDeleteConfirm(sceneId);
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      try {
        await deleteScene(deleteConfirm);
        setDeleteConfirm(null);
        // Reload scenes
        loadScenes(episodeId);
      } catch (err) {
        console.error('Failed to delete scene:', err);
      }
    }
  };

  const handleStatusChange = async (sceneId, newStatus) => {
    try {
      await updateStatus(sceneId, newStatus);
      // Reload scenes
      loadScenes(episodeId);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  return (
    <div className="scene-composer">
      {/* Header */}
      <div className="composer-header">
        <div className="header-left">
          <button 
            className="back-btn"
            onClick={() => navigate(`/episodes/${episodeId}`)}
          >
            ← Back to Episode
          </button>
          <h1>Scene Composer</h1>
        </div>
        <button 
          className="create-scene-btn"
          onClick={handleCreateScene}
        >
          + Create Scene
        </button>
      </div>

      {/* Statistics Bar */}
      {stats && (
        <div className="stats-bar">
          <div className="stat-card">
            <span className="stat-label">Total Scenes</span>
            <span className="stat-value">{stats.total || 0}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Draft</span>
            <span className="stat-value draft">{stats.byStatus?.draft || 0}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">In Progress</span>
            <span className="stat-value progress">
              {(stats.byStatus?.storyboarded || 0) + (stats.byStatus?.recorded || 0) + (stats.byStatus?.edited || 0)}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Complete</span>
            <span className="stat-value complete">{stats.byStatus?.complete || 0}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Duration</span>
            <span className="stat-value">{formatDuration(stats.totalDuration || 0)}</span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={clearError} className="dismiss-btn">×</button>
        </div>
      )}

      {/* Timeline */}
      {scenes && scenes.length > 0 && (
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <CanvasTimeline 
            scenes={scenes} 
            onSceneUpdate={updateScene}
          />
        </div>
      )}

      {/* Scene List */}
      <SceneList
        scenes={scenes}
        loading={loading}
        error={null}
        onSceneEdit={handleEditScene}
        onSceneDelete={handleDeleteClick}
        onStatusChange={handleStatusChange}
      />

      {/* Create/Edit Modal */}
      <SceneFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingScene(null);
        }}
        onSubmit={handleFormSubmit}
        scene={editingScene}
        episodeId={episodeId}
        loading={loading}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Scene?</h3>
            <p>This action cannot be undone. The scene will be permanently deleted.</p>
            <div className="confirm-actions">
              <button 
                className="btn-secondary"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button 
                className="btn-danger"
                onClick={confirmDelete}
              >
                Delete Scene
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function
const formatDuration = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  } else if (mins > 0) {
    return `${mins}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

// Wrapper component with Provider
const SceneComposer = () => {
  return (
    <SceneProvider>
      <SceneComposerContent />
    </SceneProvider>
  );
};

export default SceneComposer;
