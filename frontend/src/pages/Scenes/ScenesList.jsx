import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useScenes } from '../../contexts/SceneContext';
import SceneCard from '../../components/Scenes/SceneCard';
import './ScenesList.css';

const ScenesList = () => {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const { 
    scenes, 
    loading, 
    error, 
    stats,
    loadScenes, 
    deleteScene, 
    updateStatus,
    reorderScenes,
    clearError 
  } = useScenes();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [draggedScene, setDraggedScene] = useState(null);

  useEffect(() => {
    if (episodeId) {
      loadScenes(episodeId);
    }
  }, [episodeId, loadScenes]);

  const filteredScenes = scenes.filter(scene => {
    const matchesSearch = 
      scene.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scene.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || scene.productionStatus === filterStatus;
    const matchesType = filterType === 'all' || scene.sceneType === filterType;

    return matchesSearch && matchesStatus && matchesType;
  });

  const handleEdit = (scene) => {
    navigate(`/episodes/${episodeId}/scenes/${scene.id}/edit`);
  };

  const handleDelete = async (sceneId) => {
    if (!window.confirm('Delete this scene? This cannot be undone.')) return;

    try {
      await deleteScene(sceneId);
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete scene');
    }
  };

  const handleStatusChange = async (sceneId, newStatus) => {
    try {
      await updateStatus(sceneId, newStatus);
    } catch (err) {
      console.error('Status update failed:', err);
      alert('Failed to update status');
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e, scene) => {
    setDraggedScene(scene);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetScene) => {
    e.preventDefault();
    
    if (!draggedScene || draggedScene.id === targetScene.id) {
      setDraggedScene(null);
      return;
    }

    const reordered = [...scenes];
    const draggedIndex = reordered.findIndex(s => s.id === draggedScene.id);
    const targetIndex = reordered.findIndex(s => s.id === targetScene.id);

    // Remove dragged scene and insert at target position
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    try {
      const newOrder = reordered.map(s => s.id);
      await reorderScenes(episodeId, newOrder);
    } catch (err) {
      console.error('Reorder failed:', err);
      alert('Failed to reorder scenes');
    }

    setDraggedScene(null);
  };

  if (loading) {
    return (
      <div className="scenes-page loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="scenes-page">
      <div className="scenes-header">
        <div className="header-top">
          <h1>Scenes</h1>
          <Link to={`/episodes/${episodeId}`} className="btn-back">
            ← Back to Episode
          </Link>
        </div>

        {stats && (
          <div className="scenes-stats">
            <div className="stat-card">
              <span className="stat-value">{stats.totalScenes}</span>
              <span className="stat-label">Total Scenes</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.totalDuration}s</span>
              <span className="stat-label">Total Duration</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.byStatus?.complete || 0}</span>
              <span className="stat-label">Complete</span>
            </div>
          </div>
        )}
        
        <div className="header-actions">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search scenes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="storyboarded">Storyboarded</option>
            <option value="recorded">Recorded</option>
            <option value="edited">Edited</option>
            <option value="complete">Complete</option>
          </select>

          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Types</option>
            <option value="intro">Intro</option>
            <option value="main">Main</option>
            <option value="transition">Transition</option>
            <option value="outro">Outro</option>
            <option value="montage">Montage</option>
            <option value="broll">B-Roll</option>
          </select>

          <Link 
            to={`/episodes/${episodeId}/scenes/create`} 
            className="btn-create"
          >
            + Create Scene
          </Link>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}

      {filteredScenes.length === 0 ? (
        <div className="no-scenes">
          <p>No scenes found</p>
          <Link 
            to={`/episodes/${episodeId}/scenes/create`} 
            className="btn-create"
          >
            Create Your First Scene
          </Link>
        </div>
      ) : (
        <div className="scenes-list">
          <div className="drag-hint">
            💡 Drag and drop scenes to reorder
          </div>
          {filteredScenes.map((scene) => (
            <div
              key={scene.id}
              draggable={!scene.isLocked}
              onDragStart={(e) => handleDragStart(e, scene)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, scene)}
            >
              <SceneCard
                scene={scene}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                isDragging={draggedScene?.id === scene.id}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScenesList;
