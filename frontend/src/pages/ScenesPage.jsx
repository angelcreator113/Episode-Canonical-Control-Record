import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ClipSequenceManager from '../components/Episodes/ClipSequenceManager';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Scenes Page - Scene Management & Sequencing
 * Route: /episodes/:episodeId/scenes
 * 
 * This is the dedicated scene management page.
 * One job: Browse, add, reorder, and configure scenes for this episode.
 */
export default function ScenesPage() {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const [episode, setEpisode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadEpisode() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/episodes/${episodeId}`);
        if (!response.ok) throw new Error('Failed to load episode');
        
        const data = await response.json();
        setEpisode(data.episode || data);
        setError(null);
      } catch (err) {
        console.error('Error loading episode:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (episodeId) {
      loadEpisode();
    }
  }, [episodeId]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading episode...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{ 
          background: '#fef2f2', 
          border: '1px solid #fca5a5', 
          borderRadius: '8px',
          padding: '1rem',
          color: '#dc2626'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0' }}>Error</h3>
          <p style={{ margin: 0 }}>{error}</p>
          <button 
            onClick={() => navigate('/episodes')}
            style={{ marginTop: '1rem' }}
          >
            Back to Episodes
          </button>
        </div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Episode not found</p>
        <button onClick={() => navigate('/episodes')}>
          Back to Episodes
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Page Header */}
      <div style={{ 
        padding: '1rem 1.5rem',
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <button
          onClick={() => navigate(`/episodes/${episodeId}`)}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            background: 'white',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600
          }}
        >
          ← Back to Episode
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
            Scene Management
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            {episode.title || 'Untitled Episode'}
          </p>
        </div>
      </div>

      {/* Scene Manager */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ClipSequenceManager 
          episodeId={episodeId} 
          episode={episode} 
        />
      </div>
    </div>
  );
}
