import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useNavigate } from 'react-router-dom';
import ClipSequenceItem from './ClipSequenceItem';
import ClipPreviewPanel from './ClipPreviewPanel';
import SceneLibraryPicker from '../SceneLibraryPicker';
import './ClipSequenceManager.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const ClipSequenceManager = ({ episodeId, episode }) => {
  const [clips, setClips] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClip, setSelectedClip] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const navigate = useNavigate();

  // Load clips from API
  const loadClips = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/episodes/${episodeId}/library-scenes`);
      if (!response.ok) throw new Error('Failed to load clips');
      
      const data = await response.json();
      setClips(data.data || []);
      setStats(data.stats || null);
      setError(null);
    } catch (err) {
      console.error('Error loading clips:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  // Initial load
  useEffect(() => {
    loadClips();
  }, [loadClips]);

  // Polling for status updates (every 5 seconds, paused during drag)
  useEffect(() => {
    if (isDragging) return; // Don't poll while dragging
    
    const interval = setInterval(loadClips, 5000);
    return () => clearInterval(interval);
  }, [loadClips, isDragging]);

  // Handle drag start
  const handleDragStart = () => {
    setIsDragging(true);
  };

  // Handle drag end
  const handleDragEnd = async (result) => {
    setIsDragging(false);
    
    if (!result.destination) return;
    
    const { source, destination } = result;
    if (source.index === destination.index) return;

    // Optimistic update
    const reorderedClips = Array.from(clips);
    const [removed] = reorderedClips.splice(source.index, 1);
    reorderedClips.splice(destination.index, 0, removed);
    setClips(reorderedClips);

    // Send to backend
    try {
      const itemIds = reorderedClips.map(clip => clip.id);
      const response = await fetch(
        `${API_BASE_URL}/api/v1/episodes/${episodeId}/sequence-items/reorder`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemIds }),
        }
      );

      if (!response.ok) throw new Error('Failed to reorder');
      
      const data = await response.json();
      setClips(data.data || []);
      setStats(data.stats || null);
    } catch (err) {
      console.error('Error reordering:', err);
      // Rollback on error
      loadClips();
    }
  };

  // Handle clip selection
  const handleSelectClip = (clip) => {
    setSelectedClip(clip);
    setShowPreview(true);
  };

  // Handle add clip from library
  const handleAddClip = async (sceneData) => {
    try {
      // Extract sceneLibraryId - handle both string ID and full object
      const librarySceneId = typeof sceneData === 'string' ? sceneData : sceneData?.id;
      
      if (!librarySceneId) {
        throw new Error('Invalid scene data');
      }

      const response = await fetch(
        `${API_BASE_URL}/api/v1/episodes/${episodeId}/library-scenes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sceneLibraryId: librarySceneId }),
        }
      );

      if (!response.ok) throw new Error('Failed to add clip');
      
      setShowLibraryPicker(false);
      await loadClips();
    } catch (err) {
      console.error('Error adding clip:', err);
      alert('Failed to add clip: ' + err.message);
    }
  };

  // Handle add note
  const handleAddNote = async () => {
    const noteText = prompt('Enter note text:');
    if (!noteText) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/episodes/${episodeId}/sequence-items/note`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            noteText,
            manualDurationSeconds: 0,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to add note');
      
      await loadClips();
    } catch (err) {
      console.error('Error adding note:', err);
      alert('Failed to add note: ' + err.message);
    }
  };

  // Handle remove clip
  const handleRemoveClip = async (clipId) => {
    if (!confirm('Remove this item from the sequence?')) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/episodes/${episodeId}/library-scenes/${clipId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Failed to remove clip');
      
      await loadClips();
      if (selectedClip?.id === clipId) {
        setSelectedClip(null);
        setShowPreview(false);
      }
    } catch (err) {
      console.error('Error removing clip:', err);
      alert('Failed to remove clip: ' + err.message);
    }
  };

  // Handle update trim
  const handleUpdateTrim = async (clipId, trimStart, trimEnd) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/episodes/${episodeId}/library-scenes/${clipId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trimStart, trimEnd }),
        }
      );

      if (!response.ok) throw new Error('Failed to update trim');
      
      await loadClips();
    } catch (err) {
      console.error('Error updating trim:', err);
      throw err;
    }
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="clip-sequence-manager">
        <div className="csm-loading">
          <div className="spinner"></div>
          <p>Loading clip sequence...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="clip-sequence-manager">
        <div className="csm-error">
          <div className="error-icon">⚠️</div>
          <h3>Failed to Load Clips</h3>
          <p>{error}</p>
          <button onClick={loadClips} className="btn-retry">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="clip-sequence-manager">
      {/* Header with stats and actions */}
      <div className="csm-header">
        {/* Navigation */}
        <div className="csm-nav">
          <button onClick={() => navigate(`/episodes/${episodeId}`)} className="btn-back">
            ← Back
          </button>
        </div>

        {/* Compact Stats Card */}
        <div className="csm-stats-card">
          <div className="stat-pill">
            <span className="stat-icon">🎬</span>
            <span className="stat-text">{stats?.totalClips || 0} Clips</span>
          </div>
          <div className="stat-pill">
            <span className="stat-icon">⏱</span>
            <span className="stat-text">{formatTime(stats?.readyDuration || 0)} Ready</span>
          </div>
          <div className="stat-pill">
            <span className="stat-icon">📊</span>
            <span className="stat-text">{formatTime(stats?.totalDuration || 0)} Total</span>
          </div>
          {stats?.processingClips > 0 && (
            <div className="stat-pill stat-processing">
              <span className="stat-icon">⚙️</span>
              <span className="stat-text">{stats.processingClips} Processing</span>
            </div>
          )}
        </div>

        {/* Actions Panel */}
        <div className="csm-actions-panel">
          {/* Primary Action */}
          <button onClick={() => setShowLibraryPicker(true)} className="btn-primary-action">
            ➕ Add Clip
          </button>
          
          {/* Secondary Actions Row */}
          <div className="csm-secondary-actions">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="btn-icon-action"
              title={showPreview ? 'Hide Preview' : 'Show Preview'}
            >
              👁️ <span className="btn-label">Preview</span>
            </button>
            <button onClick={handleAddNote} className="btn-icon-action" title="Add Note">
              📝 <span className="btn-label">Note</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className={`csm-content ${showPreview ? 'with-preview' : ''}`}>
        {/* Clip sequence list */}
        <div className="csm-sequence">
          {clips.length === 0 ? (
            <div className="csm-empty">
              <div className="empty-icon">🎬</div>
              <h3>No clips in sequence</h3>
              <p>Start building your episode by adding clips from the library</p>
              <button onClick={() => setShowLibraryPicker(true)} className="btn-add-clip-large">
                ➕ Add First Clip
              </button>
            </div>
          ) : (
            <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} key="clip-dnd">
              <Droppable droppableId="clip-sequence" type="CLIP">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`clip-list ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                  >
                    {clips.map((clip, index) => (
                      <Draggable key={clip.id} draggableId={clip.id} index={index}>
                        {(provided, snapshot) => (
                          <ClipSequenceItem
                            clip={clip}
                            index={index}
                            isSelected={selectedClip?.id === clip.id}
                            isDragging={snapshot.isDragging}
                            onSelect={() => handleSelectClip(clip)}
                            onRemove={() => handleRemoveClip(clip.id)}
                            onUpdateTrim={handleUpdateTrim}
                            dragHandleProps={provided.dragHandleProps}
                            innerRef={provided.innerRef}
                            draggableProps={provided.draggableProps}
                          />
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>

        {/* Preview panel */}
        {showPreview && selectedClip && (
          <ClipPreviewPanel
            clip={selectedClip}
            onClose={() => {
              setShowPreview(false);
              setSelectedClip(null);
            }}
            onUpdateTrim={handleUpdateTrim}
          />
        )}
      </div>

      {/* Scene Library Picker Modal */}
      {showLibraryPicker && (
        <SceneLibraryPicker
          isOpen={showLibraryPicker}
          onClose={() => setShowLibraryPicker(false)}
          onSelect={handleAddClip}
          episodeId={episodeId}
        />
      )}
    </div>
  );
};

export default ClipSequenceManager;
