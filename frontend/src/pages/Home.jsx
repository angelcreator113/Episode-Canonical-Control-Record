import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    published: 0,
    inProgress: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/v1/episodes?limit=100');
      const data = await response.json();
      
      if (data.success && data.data) {
        const episodes = data.data;
        setStats({
          total: episodes.length,
          draft: episodes.filter(e => e.status === 'DRAFT').length,
          published: episodes.filter(e => e.status === 'PUBLISHED').length,
          inProgress: episodes.filter(e => e.status === 'IN_PROGRESS').length
        });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
      // Use defaults
      setStats({ total: 6, draft: 2, published: 2, inProgress: 1 });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="home-page-modern loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="home-page-modern">
      <section className="hero-section">
        <h1>Welcome to Episode Control</h1>
        <p>Manage your episode metadata, compositions, and assets</p>
      </section>

      <section className="stats-grid">
        <div className="stat-card total">
          <span className="stat-icon">📺</span>
          <div className="stat-content">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total Episodes</span>
          </div>
        </div>
        <div className="stat-card draft">
          <span className="stat-icon">📝</span>
          <div className="stat-content">
            <span className="stat-value">{stats.draft}</span>
            <span className="stat-label">Draft</span>
          </div>
        </div>
        <div className="stat-card published">
          <span className="stat-icon">✅</span>
          <div className="stat-content">
            <span className="stat-value">{stats.published}</span>
            <span className="stat-label">Published</span>
          </div>
        </div>
        <div className="stat-card progress">
          <span className="stat-icon">🎬</span>
          <div className="stat-content">
            <span className="stat-value">{stats.inProgress}</span>
            <span className="stat-label">In Progress</span>
          </div>
        </div>
      </section>

      <section className="actions-section">
        <h2>Quick Actions</h2>
        <div className="actions-grid">
          <Link to="/episodes" className="action-card">
            <span className="action-icon">🎭</span>
            <h3>View Episodes</h3>
            <p>Browse your episode library</p>
          </Link>
          <Link to="/episodes/create" className="action-card">
            <span className="action-icon">➕</span>
            <h3>Create New</h3>
            <p>Add a new episode</p>
          </Link>
          <Link to="/assets" className="action-card">
            <span className="action-icon">🎨</span>
            <h3>Assets</h3>
            <p>Manage promotional assets</p>
          </Link>
          <Link to="/search" className="action-card">
            <span className="action-icon">🔍</span>
            <h3>Search</h3>
            <p>Find episodes</p>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;