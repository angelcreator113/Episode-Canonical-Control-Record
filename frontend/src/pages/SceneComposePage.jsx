import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SceneComposer from '../components/SceneComposer/SceneComposer';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Scene Compose Page - Canvas Editor
 * Route: /episodes/:episodeId/scene/:sceneId/compose
 * 
 * This is the dedicated composition canvas page.
 * One job: Visual composition of a single scene with layers, assets, and effects.
 */
export default function SceneComposePage() {
  const { episodeId, sceneId } = useParams();
  const navigate = useNavigate();
  const [episode, setEpisode] = useState(null);
  const [episodeScenes, setEpisodeScenes] = useState([]);
  const [episodeAssets, setEpisodeAssets] = useState([]);
  const [episodeWardrobes, setEpisodeWardrobes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        // Load episode data
        const episodeResponse = await fetch(`${API_BASE_URL}/api/v1/episodes/${episodeId}`);
        if (!episodeResponse.ok) throw new Error('Failed to load episode');
        const episodeData = await episodeResponse.json();
        setEpisode(episodeData.episode || episodeData);

        // Load episode scenes
        const scenesResponse = await fetch(`${API_BASE_URL}/api/v1/episodes/${episodeId}/library-scenes`);
        if (scenesResponse.ok) {
          const scenesData = await scenesResponse.json();
          setEpisodeScenes(scenesData.data || scenesData.scenes || []);
        }

        // Load episode assets
        const assetsResponse = await fetch(`${API_BASE_URL}/api/v1/episodes/${episodeId}/assets`);
        if (assetsResponse.ok) {
          const assetsData = await assetsResponse.json();
          setEpisodeAssets(assetsData.data || assetsData.assets || []);
        }

        // Load episode wardrobe
        const wardrobeResponse = await fetch(`${API_BASE_URL}/api/v1/episodes/${episodeId}/wardrobe`);
        if (wardrobeResponse.ok) {
          const wardrobeData = await wardrobeResponse.json();
          setEpisodeWardrobes(wardrobeData.data || wardrobeData.items || wardrobeData.wardrobe || []);
        }

        setError(null);
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (episodeId) {
      loadData();
    }
  }, [episodeId]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        height: '100vh',
        background: '#f9fafb'
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '1.125rem', color: '#6b7280' }}>Loading composer...</p>
        </div>
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
          padding: '1.5rem',
          color: '#dc2626',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>Error Loading Composer</h3>
          <p style={{ margin: '0 0 1rem 0' }}>{error}</p>
          <button 
            onClick={() => navigate(`/episodes/${episodeId}`)}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #dc2626',
              borderRadius: '6px',
              background: 'white',
              color: '#dc2626',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Back to Episode
          </button>
        </div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Episode not found</p>
        <button 
          onClick={() => navigate('/episodes')}
          style={{ marginTop: '1rem' }}
        >
          Back to Episodes
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SceneComposer
        episodeId={episodeId}
        sceneId={sceneId}
        episode={episode}
        episodeScenes={episodeScenes}
        episodeAssets={episodeAssets}
        episodeWardrobes={episodeWardrobes}
      />
    </div>
  );
}
