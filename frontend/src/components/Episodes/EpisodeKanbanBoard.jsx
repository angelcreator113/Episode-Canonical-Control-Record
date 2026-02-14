// frontend/src/components/Episodes/EpisodeKanbanBoard.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStatusConfig } from '../../utils/workflowRouter';
import './EpisodeKanbanBoard.css';

/**
 * EpisodeKanbanBoard - Modern Pipeline View
 * 
 * Features:
 * - Compact 260px columns with progress bars
 * - Slim, readable episode cards
 * - WIP limits and progress tracking
 * - Drag & drop between stages
 */
function EpisodeKanbanBoard({ episodes = [], onStatusChange, onEpisodeClick }) {
  const navigate = useNavigate();
  const [draggedEpisode, setDraggedEpisode] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  
  // Pipeline configuration with colors and WIP limits
  const pipelineStages = [
    { status: 'draft', label: 'Draft', colorClass: 'bg-slate-400', wipLimit: 5, icon: '✏️' },
    { status: 'scripted', label: 'Scripted', colorClass: 'bg-sky-500', wipLimit: 3, icon: '📝' },
    { status: 'in_build', label: 'In Build', colorClass: 'bg-indigo-500', wipLimit: 3, icon: '🎬' },
    { status: 'review', label: 'In Review', colorClass: 'bg-violet-500', wipLimit: 2, icon: '👀' },
    { status: 'scheduled', label: 'Scheduled', colorClass: 'bg-emerald-500', wipLimit: 5, icon: '📅' },
    { status: 'published', label: 'Published', colorClass: 'bg-emerald-600', wipLimit: 999, icon: '✨' },
  ];
  
  // Group episodes by status
  const episodesByStatus = episodes.reduce((acc, episode) => {
    const status = episode.status || 'draft';
    if (!acc[status]) acc[status] = [];
    acc[status].push(episode);
    return acc;
  }, {});
  
  // Drag handlers
  const handleDragStart = (e, episode) => {
    setDraggedEpisode(episode);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget);
  };
  
  const handleDragOver = (e, status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };
  
  const handleDragLeave = (e) => {
    const relatedTarget = e.relatedTarget;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null);
    }
  };
  
  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    
    if (draggedEpisode && draggedEpisode.status !== newStatus) {
      if (onStatusChange) {
        onStatusChange(draggedEpisode.id, newStatus);
      }
    }
    
    setDraggedEpisode(null);
    setDragOverColumn(null);
  };
  
  const handleDragEnd = () => {
    setDraggedEpisode(null);
    setDragOverColumn(null);
  };
  
  const handleEpisodeClick = (episode) => {
    if (onEpisodeClick) {
      onEpisodeClick(episode);
    } else {
      navigate(`/episodes/${episode.id}`);
    }
  };
  
  return (
    <div className="pipeline-board">
      <div className="pipeline-grid">
        {pipelineStages.map(stage => {
            const columnEpisodes = episodesByStatus[stage.status] || [];
            const count = columnEpisodes.length;
            const pct = Math.min(100, Math.round((count / stage.wipLimit) * 100));
            const isDragOver = dragOverColumn === stage.status;
            const isDraggingFrom = draggedEpisode?.status === stage.status;
            
            // Determine progress bar state
            let progressClass = stage.colorClass;
            if (pct >= 100) {
              progressClass = 'danger';
            } else if (pct >= 80) {
              progressClass = 'warning';
            }
            
            return (
              <div
                key={stage.status}
                className={`pipeline-column ${isDragOver ? 'drag-over' : ''} ${isDraggingFrom ? 'dragging-from' : ''}`}
                onDragOver={(e) => handleDragOver(e, stage.status)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.status)}
              >
                {/* Accent line at top */}
                <div className={`column-accent ${stage.colorClass}`}></div>
                
                {/* Column Header with Progress */}
                <div className="column-header">
                  <div className="header-top">
                    <div className="header-title">
                      <span className="stage-icon">{stage.icon}</span>
                      <h3 className="column-title">{stage.label}</h3>
                    </div>
                    <span className="wip-count">
                      {count} / {stage.wipLimit}
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="progress-track">
                    <div 
                      className={`progress-bar ${progressClass}`}
                    ></div>
                  </div>
                </div>
                
                {/* Column Body */}
                <div className="column-body">
                  {columnEpisodes.length === 0 ? (
                    <div className="empty-lane">
                      <div className="empty-icon">📭</div>
                      <div className="empty-title">Empty</div>
                      <div className="empty-subtitle">Drag an episode here</div>
                    </div>
                  ) : (
                    columnEpisodes.map(episode => (
                      <div
                        key={episode.id}
                        className={`episode-card ${draggedEpisode?.id === episode.id ? 'dragging' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, episode)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleEpisodeClick(episode)}
                      >
                        <div className="card-content">
                          <div className="card-main">
                            <div className="card-title">{episode.title || 'Untitled'}</div>
                            <div className="card-meta">
                              {episode.episode_number && (
                                <span className="meta-badge">Ep {episode.episode_number}</span>
                              )}
                              {episode.air_date && (
                                <>
                                  {episode.episode_number && <span className="meta-sep">•</span>}
                                  <span className="meta-date">
                                    {new Date(episode.air_date).toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric' 
                                    })}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          <button
                            className="card-action"
                            onClick={(e) => {
                              e.stopPropagation();
                              const config = getStatusConfig(stage.status);
                              navigate(config.route(episode.id));
                            }}
                            title="Continue working"
                          >
                            →
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

export default EpisodeKanbanBoard;
