/**
 * Home Page
 * Landing/dashboard page
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import episodeService from '../services/episodeService';
import '../styles/Home.css';

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ FIX 1: Separate auth check from data fetching
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // ✅ FIX 2: Fetch stats only when authenticated
  useEffect(() => {
    // Don't fetch if not authenticated or still loading auth
    if (!isAuthenticated || authLoading) {
      return;
    }

    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await episodeService.getEpisodes(1, 100);
        
        console.log('📊 Stats response:', response);
        
        // Handle different response formats
        const episodes = response.data || [];
        const total = response.pagination?.total || response.total || episodes.length;
        
        // Calculate stats
        const draftCount = episodes.filter((e) => e.status === 'draft').length;
        const publishedCount = episodes.filter((e) => e.status === 'published').length;
        const inProgressCount = episodes.filter((e) => e.status === 'in_progress').length;
        
        setStats({
          totalEpisodes: total,
          draftEpisodes: draftCount,
          publishedEpisodes: publishedCount,
          inProgressEpisodes: inProgressCount,
        });
      } catch (err) {
        console.error('❌ Failed to load stats:', err);
        setError(err.message || 'Failed to load statistics');
        
        // Set default stats on error
        setStats({
          totalEpisodes: 0,
          draftEpisodes: 0,
          publishedEpisodes: 0,
          inProgressEpisodes: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [isAuthenticated, authLoading]);

  // ✅ FIX 3: Add refresh function
  const handleRefresh = useCallback(() => {
    setLoading(true);
    setError(null);
    
    episodeService.getEpisodes(1, 100)
      .then((response) => {
        const episodes = response.data || [];
        const total = response.pagination?.total || response.total || episodes.length;
        
        setStats({
          totalEpisodes: total,
          draftEpisodes: episodes.filter((e) => e.status === 'draft').length,
          publishedEpisodes: episodes.filter((e) => e.status === 'published').length,
          inProgressEpisodes: episodes.filter((e) => e.status === 'in_progress').length,
        });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load statistics');
        setStats({
          totalEpisodes: 0,
          draftEpisodes: 0,
          publishedEpisodes: 0,
          inProgressEpisodes: 0,
        });
        setLoading(false);
      });
  }, []);

  if (authLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="home-page">
      <div className="home-container">
        <div className="home-header">
          <div className="home-header-text">
            <h1>Welcome to Episode Control</h1>
            <p className="subtitle">Manage your episode metadata and compositions</p>
          </div>
          
          {/* ✅ FIX 4: Add refresh button */}
          <button
            onClick={handleRefresh}
            className="btn btn-secondary btn-refresh"
            title="Refresh statistics"
            disabled={loading}
          >
            🔄 Refresh
          </button>
        </div>

        {error && (
          <ErrorMessage 
            message={error} 
            onDismiss={() => setError(null)}
          />
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📺</div>
            <div className="stat-content">
              <h3>Total Episodes</h3>
              <p className="stat-number">{stats?.totalEpisodes || 0}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📝</div>
            <div className="stat-content">
              <h3>Draft</h3>
              <p className="stat-number">{stats?.draftEpisodes || 0}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <h3>Published</h3>
              <p className="stat-number">{stats?.publishedEpisodes || 0}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🎬</div>
            <div className="stat-content">
              <h3>In Progress</h3>
              <p className="stat-number">{stats?.inProgressEpisodes || 0}</p>
            </div>
          </div>
        </div>

        <div className="action-cards">
          <div className="action-card">
            <h3>📺 Get Started</h3>
            <p>Create or manage your episodes</p>
            <button
              onClick={() => navigate('/episodes')}
              className="btn btn-primary"
            >
              View Episodes
            </button>
          </div>

          <div className="action-card">
            <h3>➕ Create New</h3>
            <p>Add a new episode to the system</p>
            <button
              onClick={() => navigate('/episodes/create')}
              className="btn btn-primary"
            >
              Create Episode
            </button>
          </div>

          <div className="action-card">
            <h3>🔍 Search</h3>
            <p>Find episodes by title or description</p>
            <button
              onClick={() => navigate('/search')}
              className="btn btn-primary"
            >
              Search Episodes
            </button>
          </div>

          <div className="action-card">
            <h3>🎨 Thumbnails</h3>
            <p>Create and manage episode thumbnails</p>
            <button
              onClick={() => navigate('/composer/default')}
              className="btn btn-primary"
            >
              Thumbnail Composer
            </button>
          </div>

          <div className="action-card">
            <h3>📸 Assets</h3>
            <p>Upload and manage promotional assets</p>
            <button
              onClick={() => navigate('/assets')}
              className="btn btn-primary"
            >
              Asset Manager
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;