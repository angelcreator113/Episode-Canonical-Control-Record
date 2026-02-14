import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SceneTimeline = ({ videoId }) => {
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (videoId) {
      loadScenes();
    }
  }, [videoId]);

  const loadScenes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/youtube/${videoId}/scenes`);
      setScenes(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load scenes');
      setScenes([]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSceneTypeColor = (type) => {
    const colors = {
      'intro': '#dbeafe',
      'main-content': '#dcfce7',
      'b-roll': '#f3e8ff',
      'transition': '#f3f4f6',
      'tutorial': '#fef3c7',
      'talking-head': '#fce7f3',
      'product-showcase': '#fed7aa',
      'outro': '#fecaca',
      'montage': '#e0e7ff'
    };
    return colors[type] || '#f3f4f6';
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block',
          width: '32px',
          height: '32px',
          border: '3px solid #f3f4f6',
          borderTopColor: '#667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ marginTop: '12px', color: '#6b7280' }}>Loading scenes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '16px',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        color: '#991b1b'
      }}>
        {error}
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div style={{
        padding: '24px',
        background: '#fffbeb',
        border: '1px solid #fef3c7',
        borderRadius: '12px',
        textAlign: 'center'
      }}>
        <p style={{ color: '#92400e', marginBottom: '8px', fontWeight: '600' }}>
          🎬 No Scenes Detected
        </p>
        <p style={{ color: '#78350f', fontSize: '14px' }}>
          Scene detection is available when analyzing videos with full download enabled.
        </p>
      </div>
    );
  }

  const totalDuration = scenes[scenes.length - 1]?.end_time || 0;

  return (
    <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '2px solid #e5e7eb' }}>
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
          🎬 Scene Timeline ({scenes.length} scenes)
        </h3>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          Automatically detected scene changes and types
        </p>
      </div>

      {/* Timeline visualization */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{
          position: 'relative',
          height: '64px',
          background: '#f3f4f6',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          {scenes.map((scene, index) => {
            const leftPercent = (scene.start_time / totalDuration) * 100;
            const widthPercent = (scene.duration / totalDuration) * 100;
            
            return (
              <div
                key={scene.id}
                style={{
                  position: 'absolute',
                  height: '100%',
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                  background: getSceneTypeColor(scene.scene_type),
                  borderRight: '2px solid white',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title={`Scene ${scene.scene_number}: ${scene.scene_type} (${scene.duration.toFixed(1)}s)`}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                  {scene.scene_number}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
          <span>0:00</span>
          <span>{formatTime(totalDuration)}</span>
        </div>
      </div>

      {/* Scene cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        {scenes.map((scene) => (
          <div
            key={scene.id}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              overflow: 'hidden',
              background: 'white',
              transition: 'box-shadow 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
          >
            {/* Thumbnail */}
            {scene.thumbnail_url && (
              <img
                src={scene.thumbnail_url}
                alt={`Scene ${scene.scene_number}`}
                style={{
                  width: '100%',
                  height: '160px',
                  objectFit: 'cover'
                }}
              />
            )}
            
            {/* Scene info */}
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ fontWeight: '700', color: '#111827' }}>
                  Scene {scene.scene_number}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  {scene.duration.toFixed(1)}s
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '16px',
                  fontSize: '11px',
                  fontWeight: '600',
                  background: getSceneTypeColor(scene.scene_type),
                  color: '#374151'
                }}>
                  {scene.scene_type}
                </span>
                {scene.shot_type && (
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontWeight: '500',
                    background: '#f3f4f6',
                    color: '#6b7280'
                  }}>
                    {scene.shot_type}
                  </span>
                )}
              </div>

              <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Time:</span>
                  <span style={{ fontWeight: '500', color: '#374151' }}>
                    {formatTime(scene.start_time)} - {formatTime(scene.end_time)}
                  </span>
                </div>
                
                {scene.brightness_level && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Brightness:</span>
                    <span style={{ fontWeight: '500', color: '#374151', textTransform: 'capitalize' }}>
                      {scene.brightness_level}
                    </span>
                  </div>
                )}

                {scene.analysis_result?.likely_content && (
                  <div style={{
                    marginTop: '12px',
                    padding: '8px',
                    background: '#f9fafb',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#374151'
                  }}>
                    {scene.analysis_result.likely_content}
                  </div>
                )}

                {scene.analysis_result?.confidence && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>
                      <span>Confidence</span>
                      <span>{(scene.analysis_result.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                      <div 
                        style={{
                          width: `${scene.analysis_result.confidence * 100}%`,
                          height: '100%',
                          background: '#10b981',
                          transition: 'width 0.3s'
                        }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SceneTimeline;
