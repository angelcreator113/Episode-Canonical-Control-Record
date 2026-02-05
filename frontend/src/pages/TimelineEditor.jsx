import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Timeline from '../components/Timeline';
import episodeService from '../services/episodeService';
import '../styles/editor-layout.css';
import './TimelineEditor.css';

const TimelineEditor = () => {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [episode, setEpisode] = useState(null);
  const [composition, setComposition] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load episode
        const episodeResponse = await episodeService.getEpisode(episodeId);
        setEpisode(episodeResponse.data);
        
        // Check if composition ID is in URL
        const params = new URLSearchParams(location.search);
        const compositionId = params.get('composition');
        
        if (compositionId) {
          // Load composition data
          const compositionResponse = await fetch(`/api/v1/episodes/${episodeId}/video-compositions/${compositionId}`);
          const compositionData = await compositionResponse.json();
          
          if (compositionData.success) {
            setComposition(compositionData.data);
            console.log('✅ Loaded composition for timeline:', compositionData.data);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [episodeId, location.search]);

  return (
    <div className="edRoot">
      <div className="edTopbar">
        <div className="edTopLeft">
          <button 
            onClick={() => navigate(`/episodes/${episodeId}`)} 
            className="edBack"
          >
            ← Back
          </button>
          <div>
            <div className="edTitle">
              {loading ? 'Loading...' : (episode?.title || 'Untitled Episode')}
            </div>
            <div className="edSub">
              {composition ? (
                <>🎬 {composition.name} • Video Editor</>
              ) : (
                <>Video Editor • {episode?.status || 'Draft'}</>
              )}
            </div>
          </div>
        </div>
        <div className="edTopRight">
          <button className="edGhost">Save</button>
          <button className="edPrimary">Export</button>
        </div>
      </div>

      <div className="timeline-editor-content">
        <Timeline episodeId={episodeId} composition={composition} />
      </div>
    </div>
  );
};

export default TimelineEditor;
