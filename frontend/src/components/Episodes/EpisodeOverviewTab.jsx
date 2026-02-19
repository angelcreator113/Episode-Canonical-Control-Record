// frontend/src/components/Episodes/EpisodeOverviewTab.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EpisodeStatusBadge from './EpisodeStatusBadge';
import { calculateProgress } from '../../utils/workflowRouter';
import './EpisodeOverviewTab.css';

/**
 * EpisodeOverviewTab - Lightweight cover page
 * 
 * Shows: Title, Logline, Status, Date, Guest, Intent, Progress, Creative Notes
 * Philosophy: Episode's cover page - not crowded, just essentials
 */

function EpisodeOverviewTab({ episode, show, onUpdate }) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: episode.title || '',
    logline: episode.logline || episode.description || '',
    publish_date: episode.air_date || '',
    guest: episode.guest || '',
    episode_intent: episode.episode_intent || '',
    creative_notes: episode.creative_notes || ''
  });
  
  const progress = calculateProgress(episode);
  
  const handleSave = async () => {
    try {
      await onUpdate(formData);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating episode:', error);
      alert('Failed to update episode');
    }
  };
  
  const handleStatusChange = async (newStatus) => {
    try {
      await onUpdate({ status: newStatus });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };
  
  if (isEditing) {
    return (
      <div className="episode-overview-tab editing">
        <div className="overview-header">
          <h2>Edit Episode Overview</h2>
          <div className="header-actions">
            <button className="btn-secondary" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSave}>
              Save Changes
            </button>
          </div>
        </div>
        
        <div className="overview-form">
          <div className="form-group">
            <label>Episode Title *</label>
            <input
              type="text"
              className="form-input"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter episode title..."
            />
          </div>
          
          <div className="form-group">
            <label>Logline</label>
            <textarea
              className="form-textarea"
              rows="3"
              value={formData.logline}
              onChange={(e) => setFormData({ ...formData, logline: e.target.value })}
              placeholder="Short description of this episode (1-2 sentences)..."
            />
            <small className="form-hint">Keep it concise - this is the elevator pitch</small>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Publish Target Date</label>
              <input
                type="date"
                className="form-input"
                value={formData.publish_date}
                onChange={(e) => setFormData({ ...formData, publish_date: e.target.value })}
              />
            </div>
            
            <div className="form-group">
              <label>Guest (if any)</label>
              <input
                type="text"
                className="form-input"
                value={formData.guest}
                onChange={(e) => setFormData({ ...formData, guest: e.target.value })}
                placeholder="Guest name..."
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Episode Intent</label>
            <input
              type="text"
              className="form-input"
              value={formData.episode_intent}
              onChange={(e) => setFormData({ ...formData, episode_intent: e.target.value })}
              placeholder="1-line internal goal (e.g., 'Strengthen LaLa's networking arc')"
            />
            <small className="form-hint">What's the purpose of this episode? (helps AI later)</small>
          </div>
          
          <div className="form-group">
            <label>Creative Notes</label>
            <textarea
              className="form-textarea"
              rows="6"
              value={formData.creative_notes}
              onChange={(e) => setFormData({ ...formData, creative_notes: e.target.value })}
              placeholder="Intent, emotional goal, tone direction, canon reminders, things to remember in edit..."
            />
            <small className="form-hint">Lightweight notes - not a lore system (yet)</small>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="episode-overview-tab">
      {/* Header */}
      <div className="overview-header">
        <h2>Episode Overview</h2>
        <button className="btn-edit" onClick={() => setIsEditing(true)}>
          ✏️ Edit
        </button>
      </div>
      
      {/* Cover Page */}
      <div className="overview-cover">
        {/* Title Section */}
        <div className="cover-section title-section">
          <h1 className="episode-title">{episode.title}</h1>
          {formData.logline && (
            <p className="episode-logline">{formData.logline}</p>
          )}
        </div>
        
        {/* Meta Grid */}
        <div className="cover-meta-grid">
          <div className="meta-card">
            <span className="meta-label">Status</span>
            <div className="meta-value">
              <EpisodeStatusBadge
                episode={episode}
                onStatusChange={handleStatusChange}
                size="medium"
              />
            </div>
          </div>
          
          {formData.publish_date && (
            <div className="meta-card">
              <span className="meta-label">Publish Date</span>
              <div className="meta-value date">
                📅 {new Date(formData.publish_date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
            </div>
          )}
          
          {formData.guest && (
            <div className="meta-card">
              <span className="meta-label">Guest</span>
              <div className="meta-value guest">
                👤 {formData.guest}
              </div>
            </div>
          )}
          
          {show && (
            <div className="meta-card">
              <span className="meta-label">Show</span>
              <div className="meta-value show">
                <button
                  className="show-link"
                  onClick={() => navigate(`/shows/${show.id}`)}
                >
                  🎬 {show.name}
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Episode Intent */}
        {formData.episode_intent && (
          <div className="cover-section intent-section">
            <h3 className="section-title">
              <span className="section-icon">🎯</span>
              Episode Intent
            </h3>
            <p className="intent-text">{formData.episode_intent}</p>
          </div>
        )}
        
        {/* Progress Snapshot */}
        <div className="cover-section progress-section">
          <h3 className="section-title">
            <span className="section-icon">📊</span>
            Progress
          </h3>
          
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress.total}%` }}
              />
              <span className="progress-label">{progress.total}% Complete</span>
            </div>
          </div>
          
          {progress.checks && progress.checks.length > 0 && (
            <div className="progress-checklist">
              {progress.checks.map((check, idx) => (
                <div key={idx} className="check-item">
                  <span className="check-icon">✓</span>
                  <span className="check-label">{check.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Creative Notes */}
        {formData.creative_notes && (
          <div className="cover-section notes-section">
            <h3 className="section-title">
              <span className="section-icon">💭</span>
              Creative Notes
            </h3>
            <div className="notes-content">
              {formData.creative_notes.split('\n').map((line, idx) => (
                <p key={idx}>{line}</p>
              ))}
            </div>
          </div>
        )}
        
        {/* Empty States */}
        {!formData.logline && !formData.episode_intent && !formData.creative_notes && (
          <div className="empty-prompt">
            <p>📝 Add more details to make this cover page complete</p>
            <button className="btn-primary" onClick={() => setIsEditing(true)}>
              Complete Overview
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default EpisodeOverviewTab;
