// frontend/src/pages/Home.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { episodeService } from '../services/episodeService';
import './Home.css';

/**
 * Home - Momentum Dashboard
 * 
 * Priority Flow:
 * 1. 🔥 In Progress (dominant)
 * 2. ✅ Recently Completed
 * 3. ⚠️ Needs Attention
 * 4. 📊 Small stats
 */

function Home() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadDashboard();
  }, []);
  
  const loadDashboard = async () => {
    setLoading(true);
    try {
      // Fetch real episodes from API
      const response = await episodeService.getEpisodes(1, 50);
      const episodes = response?.data || [];
      
      // Calculate days since last update
      const daysSince = (dateStr) => {
        if (!dateStr) return 999;
        const diff = Date.now() - new Date(dateStr).getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
      };
      
      // Format relative time
      const formatRelativeTime = (dateStr) => {
        if (!dateStr) return 'Unknown';
        const days = daysSince(dateStr);
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        return `${Math.floor(days / 30)} months ago`;
      };
      
      // Categorize episodes
      const inProgress = episodes
        .filter(ep => ['in_build', 'in_progress', 'editing'].includes(ep.status))
        .map(ep => ({
          id: ep.id,
          title: ep.title,
          episodeNumber: ep.episode_number,
          status: ep.status,
          progress: 65, // Could calculate based on assets/scripts
          lastEdited: formatRelativeTime(ep.updated_at),
          nextStep: 'Continue editing',
          showName: ep.show?.name || 'Unknown Show'
        }));
      
      const recentlyCompleted = episodes
        .filter(ep => ['published', 'complete', 'completed'].includes(ep.status))
        .map(ep => ({
          id: ep.id,
          title: ep.title,
          episodeNumber: ep.episode_number,
          publishedDate: formatRelativeTime(ep.air_date || ep.updated_at),
          platforms: { youtube: 'live' },
          views: 0,
          showName: ep.show?.name || 'Unknown Show'
        }));
      
      const needsAttention = episodes
        .filter(ep => {
          const days = daysSince(ep.updated_at);
          return ['draft', 'review'].includes(ep.status) && days > 7;
        })
        .map(ep => ({
          id: ep.id,
          title: ep.title,
          episodeNumber: ep.episode_number,
          status: ep.status,
          daysStalled: daysSince(ep.updated_at),
          showName: ep.show?.name || 'Unknown Show'
        }));
      
      // If no in-progress, show recent drafts
      const drafts = episodes
        .filter(ep => ep.status === 'draft')
        .slice(0, 3)
        .map(ep => ({
          id: ep.id,
          title: ep.title,
          episodeNumber: ep.episode_number,
          status: ep.status,
          progress: 25,
          lastEdited: formatRelativeTime(ep.updated_at),
          nextStep: 'Continue working',
          showName: ep.show?.name || 'Unknown Show'
        }));
      
      setDashboard({
        inProgress: inProgress.length > 0 ? inProgress : drafts,
        recentlyCompleted,
        needsAttention,
        stats: {
          totalEpisodes: episodes.length,
          avgViews: 0,
          cadence: 'Weekly'
        }
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setDashboard({
        inProgress: [],
        recentlyCompleted: [],
        needsAttention: [],
        stats: { totalEpisodes: 0, avgViews: 0, cadence: 'N/A' }
      });
    } finally {
      setLoading(false);
    }
  };
  
  const getProgressColor = (progress) => {
    if (progress >= 80) return '#10b981';
    if (progress >= 50) return '#f59e0b';
    return '#667eea';
  };
  
  const getPlatformIcon = (status) => {
    if (status === 'live') return '✅';
    if (status === 'scheduled') return '📅';
    return '⏸️';
  };
  
  if (loading) {
    return (
      <div className="home-loading">
        <div className="loading-spinner"></div>
        <p>Loading your workspace...</p>
      </div>
    );
  }
  
  const hasInProgress = dashboard?.inProgress?.length > 0;
  const hasCompleted = dashboard?.recentlyCompleted?.length > 0;
  const hasStalled = dashboard?.needsAttention?.length > 0;
  
  return (
    <div className="home-page">
      <div className="home-container">
        {/* Welcome */}
        <div className="home-welcome">
          <h1>Welcome back! 👋</h1>
          <p>Let's keep the momentum going</p>
        </div>
      
        {/* 1. IN PROGRESS */}
        <section className="home-section in-progress-section">
          <div className="section-header">
            <span>🔥</span>
            <h2 className="section-title">In Progress</h2>
          </div>
        
          {hasInProgress ? (
            <div className="in-progress-grid">
              {dashboard.inProgress.slice(0, 3).map(episode => (
                <div key={episode.id} className="in-progress-card">
                <div className="card-header">
                  <div className="episode-info">
                      <span className="episode-number">Episode {episode.episodeNumber}</span>
                      <h3 className="episode-title">{episode.title}</h3>
                      <span className="show-name">{episode.showName}</span>
                    </div>
                    <div className="status-badge in-build">
                      {episode.status.replace('_', ' ')}
                    </div>
                  </div>
                  
                  <div className="progress-section">
                    <div className="progress-header">
                      <span className="progress-label">Progress</span>
                      <span className="progress-value">{episode.progress}%</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${episode.progress}%`,
                          backgroundColor: getProgressColor(episode.progress)
                        }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="card-meta">
                    <span className="last-edited">Last edited: {episode.lastEdited}</span>
                  </div>
                  
                  <div className="next-step">
                    <span className="next-step-label">Next Step:</span>
                    <span className="next-step-action">{episode.nextStep}</span>
                  </div>
                  
                  <button
                    className="continue-btn"
                    onClick={() => navigate(`/episodes/${episode.id}`)}
                  >
                    Continue Working →
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <p className="empty-message">You have no active episodes.</p>
              <button
                className="btn-primary"
                onClick={() => navigate('/episodes/create')}
              >
                Start New Episode →
              </button>
            </div>
          )}
        </section>
        
        {/* 2. RECENTLY COMPLETED */}
        {hasCompleted && (
          <section className="home-section completed-section">
            <div className="section-header">
              <span>✅</span>
              <h2 className="section-title">Recently Published</h2>
            </div>
            
            <div className="completed-list">
              {dashboard.recentlyCompleted.slice(0, 2).map(episode => (
                <div key={episode.id} className="completed-card">
                <div className="card-header">
                    <div className="episode-info">
                      <span className="episode-number">Episode {episode.episodeNumber}</span>
                      <h3 className="episode-title">{episode.title}</h3>
                    </div>
                    <div className="published-badge">
                      Published: {episode.publishedDate}
                    </div>
                  </div>
                  
                  <div className="platforms-status">
                  <div className="platform-item">
                      <span className="platform-icon">{getPlatformIcon(episode.platforms.youtube)}</span>
                      <span className="platform-name">YouTube</span>
                      <span className="platform-status">{episode.platforms.youtube}</span>
                    </div>
                    <div className="platform-item">
                      <span className="platform-icon">{getPlatformIcon(episode.platforms.tiktok)}</span>
                      <span className="platform-name">TikTok</span>
                      <span className="platform-status">{episode.platforms.tiktok}</span>
                    </div>
                    <div className="platform-item">
                      <span className="platform-icon">{getPlatformIcon(episode.platforms.instagram)}</span>
                      <span className="platform-name">Instagram</span>
                      <span className="platform-status">{episode.platforms.instagram}</span>
                    </div>
                  </div>
                  
                  <div className="views-count">
                    Views so far: <strong>{episode.views.toLocaleString()}</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        
        {/* 3. NEEDS ATTENTION */}
        {hasStalled && (
          <section className="home-section attention-section">
            <div className="section-header">
              <span>⚠️</span>
              <h2 className="section-title">Needs Attention</h2>
            </div>
            
            <div className="attention-list">
              {dashboard.needsAttention.map(episode => (
                <div key={episode.id} className="attention-card">
                  <div className="attention-icon">⚠️</div>
                  <div className="attention-content">
                    <p className="attention-message">
                      <strong>Episode {episode.episodeNumber}: "{episode.title}"</strong> has been in {episode.status} for {episode.daysStalled} days.
                    </p>
                    <button
                      className="btn-secondary"
                      onClick={() => navigate(`/episodes/${episode.id}`)}
                    >
                      Review Episode
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        
        {/* 4. MOMENTUM SNAPSHOT */}
        <section className="home-section stats-section">
          <div className="section-header">
            <span>📊</span>
            <h2 className="section-title">Show Momentum</h2>
          </div>
          
          <div className="stats-grid">
          <div className="stat-card">
              <div className="stat-value">{dashboard.stats.totalEpisodes}</div>
              <div className="stat-label">Total Episodes</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dashboard.stats.avgViews.toLocaleString()}</div>
              <div className="stat-label">Avg Views</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dashboard.stats.cadence}</div>
              <div className="stat-label">Cadence</div>
            </div>
          </div>
        </section>
        
        {/* Quick Actions */}
        <section className="home-section quick-actions-section">
          <div className="quick-actions">
            <button className="quick-action-btn" onClick={() => navigate('/episodes/create')}>
              ➕ New Episode
            </button>
            <button className="quick-action-btn" onClick={() => navigate('/shows')}>
              🎬 Manage Shows
            </button>
            <button className="quick-action-btn" onClick={() => navigate('/assets')}>
              📁 Upload Assets
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Home;
