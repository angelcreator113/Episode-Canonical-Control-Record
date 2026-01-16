/**
 * ThumbnailSection Component
 * Display thumbnails for an episode
 */
import React, { useState, useEffect } from 'react';

const ThumbnailSection = ({ episodeId }) => {
  const [thumbnails, setThumbnails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!episodeId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadThumbnails = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(
          `http://localhost:3000/api/v1/thumbnails/episode/${episodeId}/all`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        
        if (isMounted) {
          if (response.ok) {
            const data = await response.json();
            setThumbnails(data.data || []);
          }
          setLoading(false);
        }
      } catch (error) {
        if (isMounted) setLoading(false);
      }
    };

    loadThumbnails();
    return () => { isMounted = false; };
  }, [episodeId]);

  if (!episodeId) {
    return (
      <div className="form-group">
        <label>Generated Thumbnails</label>
        <p className="help-text">Thumbnails will be available after creating the episode</p>
      </div>
    );
  }

  return (
    <div className="form-group">
      <label>Generated Thumbnails</label>
      {loading ? (
        <p className="help-text">Loading thumbnails...</p>
      ) : thumbnails.length > 0 ? (
        <div className="thumbnail-grid">
          {thumbnails.map((thumb) => (
            <div key={thumb.id} className="thumbnail-card">
              <img 
                src={thumb.url || '/placeholder-thumbnail.png'} 
                alt={thumb.composition_name || 'Thumbnail'} 
                style={{ width: '100%', height: 'auto', borderRadius: '4px' }}
              />
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#666' }}>
                {thumb.composition_name || 'Untitled'}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="help-text">No thumbnails generated yet</p>
      )}
    </div>
  );
};

export default ThumbnailSection;
