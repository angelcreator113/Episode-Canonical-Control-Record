import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './TimelineEditor.css';

const TimelineEditor = () => {
  const { episodeId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="timeline-editor-page">
      <div className="timeline-header">
        <button onClick={() => navigate(`/episodes/${episodeId}`)} style={{ background: '#f3f4f6', color: '#111827', border: '2px solid #d1d5db', padding: '0.625rem 1.25rem', borderRadius: '6px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
          ← Back to Episode
        </button>
        <h1>Timeline Editor</h1>
        <div className="timeline-actions">
          <button className="btn-secondary">Save Draft</button>
          <button className="btn-primary">Export Video</button>
        </div>
      </div>

      <div className="timeline-placeholder">
        <div className="placeholder-icon">🎬</div>
        <h2>Advanced Timeline Editor</h2>
        <p>Coming Soon: CapCut-style timeline with advanced editing features</p>
        <ul className="feature-list">
          <li>✨ Multi-track editing</li>
          <li>🎵 Audio waveforms</li>
          <li>✂️ Precision trimming</li>
          <li>🎨 Transitions & effects</li>
          <li>📝 Text overlays</li>
          <li>🎥 Real-time preview</li>
        </ul>
        <button 
          onClick={() => navigate(`/episodes/${episodeId}`)}
          className="btn-back-large"
        >
          Return to Episode
        </button>
      </div>
    </div>
  );
};

export default TimelineEditor;
