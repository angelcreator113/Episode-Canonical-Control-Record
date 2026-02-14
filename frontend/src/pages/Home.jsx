// frontend/src/pages/Home.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
      // TODO: Replace with actual API call
      // const response = await dashboardService.getDashboard();
      
      // Mock data
      setDashboard({
        inProgress: [
          {
            id: '6',
            title: 'Brunch Invite',
            episodeNumber: 6,
            status: 'in_build',
            progress: 65,
            lastEdited: '2 hours ago',
            nextStep: 'Add final scene',
            showName: 'Just a Woman in Her Prime'
          }
        ],
        recentlyCompleted: [
          {
            id: '5',
            title: 'Spring Wardrobe',
            episodeNumber: 5,
            publishedDate: '3 days ago',
            platforms: {
              youtube: 'live',
              tiktok: 'live',
              instagram: 'scheduled'
            },
            views: 1240,
            showName: 'Just a Woman in Her Prime'
          }
        ],
        needsAttention: [
          {
            id: '4',
            title: 'Winter Fashion Haul',
            episodeNumber: 4,
            status: 'draft',
            daysStalled: 28,
            showName: 'Just a Woman in Her Prime'
          }
        ],
        stats: {
          totalEpisodes: 12,
          avgViews: 2500,
          cadence: 'Weekly'
        }
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
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
          <h1>Welcome back, LaLa! 👋</h1>
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
