// frontend/src/components/Show/StudioTab.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  getWorkUrl, 
  calculateProgress, 
  suggestStatusAdvance,
  getStatusConfig,
  EPISODE_STATUSES 
} from '../../utils/workflowRouter';
import './StudioTab.css';

/**
 * StudioTab - Command Center for Show Production
 * 
 * Displays:
 * - Current work in progress
 * - AI-powered suggestions
 * - Show health metrics
 * - Quick actions
 * 
 * This is the creator's landing page when they open a show.
 */
function StudioTab({ show, episodes = [] }) {
  const navigate = useNavigate();
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [showHealth, setShowHealth] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  
  useEffect(() => {
    calculateShowMetrics();
  }, [episodes]);
  
  const calculateShowMetrics = () => {
    // Find current episode in progress
    const inProgress = episodes.find(ep => 
      ['draft', 'scripted', 'in_build', 'in_review'].includes(ep.status)
    );
    setCurrentEpisode(inProgress);
    
    // Calculate show health
    const published = episodes.filter(ep => ep.status === 'published').length;
    const draft = episodes.filter(ep => ep.status === 'draft').length;
    const inProduction = episodes.filter(ep => 
      ['scripted', 'in_build', 'in_review'].includes(ep.status)
    ).length;
    
    // Calculate avg views (mock for now)
    const totalViews = episodes.reduce((sum, ep) => sum + (ep.views || 0), 0);
    const avgViews = published > 0 ? Math.round(totalViews / published) : 0;
    
    // Calculate publishing cadence
    const publishedEpisodes = episodes
      .filter(ep => ep.status === 'published' && ep.publish_date)
      .sort((a, b) => new Date(b.publish_date) - new Date(a.publish_date));
    
    let cadence = 'Not enough data';
    if (publishedEpisodes.length >= 2) {
      const daysBetween = Math.abs(
        new Date(publishedEpisodes[0].publish_date) - 
        new Date(publishedEpisodes[1].publish_date)
      ) / (1000 * 60 * 60 * 24);
      
      if (daysBetween <= 7) cadence = 'Weekly';
      else if (daysBetween <= 14) cadence = 'Bi-weekly';
      else if (daysBetween <= 31) cadence = 'Monthly';
      else cadence = 'Irregular';
    }
    
    setShowHealth({
      totalEpisodes: episodes.length,
      published,
      draft,
      inProduction,
      avgViews,
      cadence,
      growth: '+15%' // Mock - would come from analytics
    });
    
    // Generate AI suggestions (smart logic)
    generateSuggestions(episodes);
  };
  
  const generateSuggestions = (eps) => {
    const suggestions = [];
    
    // Suggest follow-ups to popular episodes
    const topEpisode = eps
      .filter(e => e.status === 'published')
      .sort((a, b) => (b.views || 0) - (a.views || 0))[0];
    
    if (topEpisode && topEpisode.views > 1000) {
      suggestions.push({
        icon: '🔥',
        text: `Follow-up to "${topEpisode.title}" trending (+${Math.round((topEpisode.views || 0) / 100)}% views)`,
        action: 'Create Follow-up',
        onClick: () => navigate(`/episodes/create?show_id=${show.id}&template=follow-up`)
      });
    }
    
    // Suggest repurposing old drafts
    const oldDrafts = eps.filter(e => {
      if (e.status !== 'draft') return false;
      const daysOld = (Date.now() - new Date(e.created_at)) / (1000 * 60 * 60 * 24);
      return daysOld > 30;
    });
    
    if (oldDrafts.length > 0) {
      suggestions.push({
        icon: '⚠️',
        text: `${oldDrafts.length} episode${oldDrafts.length > 1 ? 's' : ''} in Draft > 30 days`,
        action: 'Review Drafts',
        onClick: () => navigate(`/shows/${show.id}?tab=episodes&filter=draft`)
      });
    }
    
    // Suggest best publish time (mock AI)
    suggestions.push({
      icon: '📅',
      text: 'Publish on Tuesday for max engagement (AI insight)',
      action: 'View Calendar',
      onClick: () => navigate(`/shows/${show.id}?tab=calendar`)
    });
    
    // Suggest TikTok cutdowns for popular episodes
    const recentPopular = eps
      .filter(e => e.status === 'published' && (e.views || 0) > 500)
      .slice(0, 1)[0];
    
    if (recentPopular) {
      suggestions.push({
        icon: '📱',
        text: `Create TikTok cutdown of "${recentPopular.title}" (high clip potential)`,
        action: 'Start Cutdown',
        onClick: () => navigate(`/episodes/${recentPopular.id}/distribution`)
      });
    }
    
    setSuggestions(suggestions);
  };
  
  const getNextSteps = (episode) => {
    if (!episode) return [];
    
    const steps = {
      'draft': [
        { done: false, label: 'Write script', action: 'script' },
        { done: false, label: 'Design scenes', action: 'scenes' },
        { done: false, label: 'Create thumbnail', action: 'thumbnail' },
        { done: false, label: 'Schedule publish', action: 'schedule' }
      ],
      'scripted': [
        { done: true, label: 'Script complete', action: null },
        { done: false, label: 'Design scenes', action: 'scenes' },
        { done: false, label: 'Create thumbnail', action: 'thumbnail' },
        { done: false, label: 'Schedule publish', action: 'schedule' }
      ],
      'in_build': [
        { done: true, label: 'Script complete', action: null },
        { done: true, label: 'Scenes designed', action: null },
        { done: false, label: 'Create thumbnail', action: 'thumbnail' },
        { done: false, label: 'Schedule publish', action: 'schedule' }
      ],
      'in_review': [
        { done: true, label: 'Script complete', action: null },
        { done: true, label: 'Scenes designed', action: null },
        { done: true, label: 'Thumbnail ready', action: null },
        { done: false, label: 'Final approval needed', action: 'review' }
      ]
    };
    
    return steps[episode.status] || [];
  };
  
  const handleContinueWork = () => {
    if (!currentEpisode) return;
    
    // Use smart routing from workflowRouter
    const url = getWorkUrl(currentEpisode);
    navigate(url);
  };
  
  if (!showHealth) {
    return <div className="studio-loading">Loading studio...</div>;
  }
  
  // Calculate smart progress for current episode
  const progress = currentEpisode ? calculateProgress(currentEpisode) : null;
  const statusConfig = currentEpisode ? getStatusConfig(currentEpisode.status) : null;
  
  return (
    <div className="studio-tab">
      {/* SECTION 1: CURRENT WORK */}
      <section className="studio-section current-work">
        <h2 className="section-title">
          <span className="section-icon">🎬</span>
          Current Work
        </h2>
        
        {currentEpisode ? (
          <div className="current-episode-card">
            <div className="episode-header">
              <div className="episode-info">
                <h3 className="episode-title">{currentEpisode.title}</h3>
                <div className="episode-meta">
                  <span className={`status-badge status-${currentEpisode.status}`}>
                    {statusConfig?.label || currentEpisode.status}
                  </span>
                  <span className="progress-text">
                    {progress?.total || 0}% Complete
                  </span>
                </div>
              </div>
            </div>
            
            <div className="progress-bar" title={`Base: ${progress?.base || 0}% + Bonus: ${progress?.bonus || 0}%`}>
              <div 
                className="progress-fill"
                style={{ width: `${progress?.total || 0}%` }}
              />
            </div>
            
            <div className="next-steps">
              {getNextSteps(currentEpisode).map((step, idx) => (
                <div key={idx} className={`step-item ${step.done ? 'done' : ''}`}>
                  <span className="step-icon">
                    {step.done ? '✅' : '⏳'}
                  </span>
                  <span className="step-label">{step.label}</span>
                </div>
              ))}
            </div>
            
            <div className="episode-actions">
              <button 
                className="btn-primary btn-continue"
                onClick={handleContinueWork}
              >
                Continue Working →
              </button>
              <Link 
                to={`/episodes/${currentEpisode.id}`}
                className="btn-secondary"
              >
                View Details
              </Link>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🎬</div>
            <p className="empty-text">No episode currently in progress</p>
            <Link 
              to={`/episodes/create?show_id=${show.id}`}
              className="btn-primary"
            >
              + Create New Episode
            </Link>
          </div>
        )}
      </section>
      
      {/* SECTION 2: SMART SUGGESTIONS */}
      {suggestions.length > 0 && (
        <section className="studio-section suggestions">
          <h2 className="section-title">
            <span className="section-icon">💡</span>
            Smart Suggestions
          </h2>
          
          <div className="suggestions-list">
            {suggestions.map((suggestion, idx) => (
              <div key={idx} className="suggestion-card">
                <span className="suggestion-icon">{suggestion.icon}</span>
                <p className="suggestion-text">{suggestion.text}</p>
                {suggestion.action && (
                  <button 
                    className="btn-suggestion"
                    onClick={suggestion.onClick}
                  >
                    {suggestion.action}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      
      {/* SECTION 3: SHOW HEALTH */}
      <section className="studio-section show-health">
        <h2 className="section-title">
          <span className="section-icon">📊</span>
          Show Health
        </h2>
        
        <div className="health-cards">
          <div className="health-card">
            <div className="health-value">{showHealth.totalEpisodes}</div>
            <div className="health-label">Total Episodes</div>
          </div>
          
          <div className="health-card">
            <div className="health-value">
              {showHealth.avgViews >= 1000 
                ? `${(showHealth.avgViews / 1000).toFixed(1)}K`
                : showHealth.avgViews
              }
            </div>
            <div className="health-label">Avg Views</div>
          </div>
          
          <div className="health-card">
            <div className="health-value">{showHealth.cadence}</div>
            <div className="health-label">Cadence</div>
          </div>
          
          <div className="health-card highlight">
            <div className="health-value growth">{showHealth.growth}</div>
            <div className="health-label">Growth</div>
          </div>
        </div>
        
        <div className="health-alerts">
          {showHealth.draft > 2 && (
            <div className="alert alert-warning">
              <span className="alert-icon">⚠️</span>
              <span className="alert-text">
                {showHealth.draft} episodes in Draft
              </span>
            </div>
          )}
          
          {showHealth.cadence !== 'Irregular' && (
            <div className="alert alert-success">
              <span className="alert-icon">✅</span>
              <span className="alert-text">
                Publishing consistently
              </span>
            </div>
          )}
        </div>
      </section>
      
      {/* SECTION 4: QUICK ACTIONS */}
      <section className="studio-section quick-actions">
        <h2 className="section-title">
          <span className="section-icon">⚡</span>
          Quick Actions
        </h2>
        
        <div className="actions-grid">
          <Link 
            to={`/episodes/create?show_id=${show.id}`}
            className="action-card"
          >
            <span className="action-icon">➕</span>
            <span className="action-label">New Episode</span>
          </Link>
          
          <Link 
            to={`/shows/${show.id}?tab=assets`}
            className="action-card"
          >
            <span className="action-icon">📁</span>
            <span className="action-label">Asset Library</span>
          </Link>
          
          <Link 
            to={`/shows/${show.id}?tab=insights`}
            className="action-card"
          >
            <span className="action-icon">📊</span>
            <span className="action-label">Full Analytics</span>
          </Link>
          
          <Link 
            to={`/shows/${show.id}?tab=distribution`}
            className="action-card"
          >
            <span className="action-icon">🚀</span>
            <span className="action-label">Distribution</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

export default StudioTab;
