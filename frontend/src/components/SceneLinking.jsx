import { useState, useEffect } from 'react';
import { FiCheckCircle, FiAlertCircle, FiVideo, FiClock, FiZap, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import scriptsService from '../services/scriptsService';
import footageService from '../services/footageService';
import sceneLinksService from '../services/sceneLinksService';

// Add spinner animation
const spinnerStyle = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

// Inject the style if not already present
if (typeof document !== 'undefined' && !document.getElementById('scene-linking-styles')) {
  const style = document.createElement('style');
  style.id = 'scene-linking-styles';
  style.textContent = spinnerStyle;
  document.head.appendChild(style);
}

/**
 * Scene Linking Component
 * Links uploaded footage to AI-detected scenes
 */
export default function SceneLinking({ episodeId, scriptId }) {
  const [aiScenes, setAiScenes] = useState([]);
  const [uploadedScenes, setUploadedScenes] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedScenes, setExpandedScenes] = useState({});

  useEffect(() => {
    if (episodeId && scriptId) {
      loadData();
    }
  }, [episodeId, scriptId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load AI-detected scenes from script metadata
      const scriptMetadata = await scriptsService.getScriptMetadata(scriptId);
      setAiScenes(scriptMetadata.metadata || []);

      // Load uploaded footage scenes
      const footageScenes = await footageService.getScenes(episodeId);
      console.log('🎬 Footage scenes loaded:', footageScenes.scenes);
      if (footageScenes.scenes?.length > 0) {
        console.log('📹 First footage item:', footageScenes.scenes[0]);
      }
      setUploadedScenes(footageScenes.scenes || []);

      // Load existing links
      const existingLinks = await sceneLinksService.getLinksByEpisode(episodeId);
      setLinks(existingLinks || []);

      // Auto-expand first scene
      if (scriptMetadata.metadata?.length > 0) {
        setExpandedScenes({ [scriptMetadata.metadata[0].scene_id]: true });
      }
    } catch (error) {
      console.error('Failed to load scene data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleScene = (sceneId) => {
    setExpandedScenes(prev => ({
      ...prev,
      [sceneId]: !prev[sceneId]
    }));
  };

  const getLinkedFootage = (aiSceneId) => {
    const link = links.find(l => l.scene_id === aiSceneId);
    if (!link) return null;
    return uploadedScenes.find(s => s.id === link.footage_id);
  };

  const handleLinkFootage = async (aiSceneId, footageId) => {
    try {
      const newLink = await sceneLinksService.createLink(aiSceneId, footageId);
      setLinks([...links, newLink]);
    } catch (error) {
      console.error('Failed to link footage:', error);
      alert('Failed to link footage. This scene may already be linked.');
    }
  };

  const handleUnlinkFootage = async (aiSceneId) => {
    try {
      const link = links.find(l => l.scene_id === aiSceneId);
      if (link) {
        await sceneLinksService.deleteLink(link.id);
        setLinks(links.filter(l => l.id !== link.id));
      }
    } catch (error) {
      console.error('Failed to unlink footage:', error);
    }
  };

  const handleAutoMatch = async () => {
    if (!episodeId || !scriptId) return;
    
    try {
      const result = await sceneLinksService.autoMatch(episodeId, scriptId);
      alert(`Auto-matched ${result.matched} scenes!\n${result.suggested} additional suggestions available.`);
      // Reload data to show new links
      await loadData();
    } catch (error) {
      console.error('Failed to auto-match:', error);
      alert('Failed to auto-match scenes. Please check the console for details.');
    }
  };

  const getMatchingClips = (aiScene) => {
    // Try to match uploaded clips to AI scene by name
    return uploadedScenes.filter(scene => 
      scene.title?.toLowerCase().includes(aiScene.scene_id?.toLowerCase()) ||
      scene.scene_type === aiScene.scene_type
    );
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getVideoUrl = (footage) => {
    console.log('🔍 Getting video URL for footage:', footage.title, footage);
    // Get S3 URL from raw_footage_s3_key (snake_case) or rawFootageS3Key (camelCase)
    const s3Key = footage.raw_footage_s3_key || footage.rawFootageS3Key;
    if (s3Key) {
      const bucketUrl = 'https://episode-metadata-raw-footage-dev.s3.us-east-1.amazonaws.com';
      const url = `${bucketUrl}/${s3Key}`;
      console.log('✅ Video URL constructed:', url);
      return url;
    }
    console.log('❌ No raw_footage_s3_key or rawFootageS3Key found for footage');
    return null;
  };

  const getEnergyColor = (level) => {
    switch (level) {
      case 'high': return '#ef4444 #fef2f2';
      case 'medium': return '#f59e0b #fef3c7';
      case 'low': return '#3b82f6 #eff6ff';
      default: return '#6b7280 #f9fafb';
    }
  };

  const getCompletionStatus = (aiScene) => {
    const linkedFootage = getLinkedFootage(aiScene.id);
    
    if (linkedFootage) return { status: 'complete', color: '#10b981', icon: FiCheckCircle };
    return { status: 'missing', color: '#ef4444', icon: FiAlertCircle };
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 0' }}>
        <div style={{ 
          animation: 'spin 1s linear infinite', 
          borderRadius: '50%', 
          height: '3rem', 
          width: '3rem', 
          borderWidth: '2px',
          borderStyle: 'solid',
          borderColor: '#9b59b6 transparent',
          margin: '0 auto'
        }}></div>
        <p style={{ color: '#6b7280', marginTop: '1rem' }}>Loading scene data...</p>
      </div>
    );
  }

  if (aiScenes.length === 0) {
    return (
      <div style={{ 
        backgroundColor: '#fef3c7', 
        border: '1px solid #fde68a', 
        borderRadius: '8px', 
        padding: '1.5rem', 
        textAlign: 'center' 
      }}>
        <FiAlertCircle style={{ margin: '0 auto', fontSize: '3rem', color: '#f59e0b', marginBottom: '0.75rem' }} />
        <p style={{ color: '#92400e', fontWeight: '500', marginBottom: '0.5rem' }}>No AI scenes detected</p>
        <p style={{ fontSize: '0.875rem', color: '#b45309' }}>
          Go to the Scripts tab and run AI analysis to detect scenes first.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
            Scene Linking ({aiScenes.length} scenes)
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            AI-detected scenes from script analysis with uploaded footage
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            {uploadedScenes.length} clip{uploadedScenes.length !== 1 ? 's' : ''} uploaded
          </div>
          <button
            onClick={handleAutoMatch}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <FiZap />
            Auto-Match
          </button>
        </div>
      </div>

      {/* Scene Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {aiScenes.map((aiScene) => {
          const matchingClips = getMatchingClips(aiScene);
          const completion = getCompletionStatus(aiScene);
          const isExpanded = expandedScenes[aiScene.scene_id];
          const [textColor, bgColor] = getEnergyColor(aiScene.energy_level).split(' ');

          return (
            <div
              key={aiScene.id}
              style={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e7eb', 
                borderRadius: '8px', 
                overflow: 'hidden',
                transition: 'border-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#c084fc'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
            >
              {/* Scene Header */}
              <div
                onClick={() => toggleScene(aiScene.scene_id)}
                style={{ 
                  padding: '1rem', 
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                    {/* Status Icon */}
                    <completion.icon style={{ fontSize: '1.25rem', color: completion.color }} />

                    {/* Scene Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <h4 style={{ fontWeight: '600', color: '#111827', margin: 0 }}>{aiScene.scene_id}</h4>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          backgroundColor: '#f3e8ff', 
                          color: '#7c3aed', 
                          padding: '0.125rem 0.5rem', 
                          borderRadius: '4px',
                          textTransform: 'capitalize'
                        }}>
                          {aiScene.scene_type}
                        </span>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          padding: '0.125rem 0.5rem', 
                          borderRadius: '4px',
                          textTransform: 'capitalize',
                          backgroundColor: bgColor,
                          color: textColor,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          <FiZap style={{ display: 'inline' }} />
                          {aiScene.energy_level}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <FiClock />
                          Target: {formatDuration(aiScene.duration_target_seconds)}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <FiVideo />
                          {matchingClips.length} / {aiScene.estimated_clips_needed || 1} clips
                        </span>
                      </div>
                    </div>

                    {/* Expand Icon */}
                    {isExpanded ? (
                      <FiChevronUp style={{ color: '#9ca3af' }} />
                    ) : (
                      <FiChevronDown style={{ color: '#9ca3af' }} />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div style={{ 
                  borderTop: '1px solid #e5e7eb', 
                  padding: '1rem', 
                  backgroundColor: '#f9fafb',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  {/* Visual Requirements */}
                  {aiScene.visual_requirements?.requirements && (
                    <div>
                      <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        Visual Requirements:
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {aiScene.visual_requirements.requirements.map((req, idx) => (
                          <span
                            key={idx}
                            style={{ 
                              fontSize: '0.75rem', 
                              backgroundColor: '#dbeafe', 
                              color: '#1e40af', 
                              padding: '0.25rem 0.5rem', 
                              borderRadius: '4px' 
                            }}
                          >
                            {req}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Linked Footage */}
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                      Linked Footage:
                    </p>
                    {(() => {
                      const linkedFootage = getLinkedFootage(aiScene.id);
                      if (linkedFootage) {
                        return (
                          <div
                            style={{ 
                              backgroundColor: '#f0fdf4', 
                              border: '1px solid #86efac', 
                              borderRadius: '8px', 
                              padding: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem'
                            }}
                          >
                            {getVideoUrl(linkedFootage) ? (
                              <video
                                src={`${getVideoUrl(linkedFootage)}#t=0.1`}
                                style={{
                                  width: '80px',
                                  height: '60px',
                                  objectFit: 'cover',
                                  borderRadius: '4px',
                                  flexShrink: 0,
                                  backgroundColor: '#000'
                                }}
                                crossOrigin="anonymous"
                                preload="metadata"
                                muted
                                playsInline
                                onError={(e) => console.error('❌ Video load error:', linkedFootage.title, e.target.src)}
                                onLoadedMetadata={(e) => console.log('✅ Video loaded:', linkedFootage.title, e.target.src)}
                              />
                            ) : (
                              <FiVideo style={{ color: '#16a34a', fontSize: '1.25rem', flexShrink: 0 }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ 
                                fontSize: '0.875rem', 
                                fontWeight: '500', 
                                color: '#111827',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                margin: 0
                              }}>
                                {linkedFootage.title}
                              </p>
                              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                                {linkedFootage.duration_seconds 
                                  ? `Duration: ${formatDuration(linkedFootage.duration_seconds)}` 
                                  : 'Duration: Pending extraction'}
                              </p>
                            </div>
                            <button
                              onClick={() => handleUnlinkFootage(aiScene.id)}
                              style={{
                                padding: '0.375rem 0.75rem',
                                fontSize: '0.75rem',
                                backgroundColor: '#fee2e2',
                                color: '#991b1b',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: '500'
                              }}
                            >
                              Unlink
                            </button>
                          </div>
                        );
                      } else {
                        // Show available clips to link
                        const availableClips = uploadedScenes.filter(
                          scene => !links.some(l => l.footage_id === scene.id)
                        );
                        
                        if (availableClips.length > 0) {
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {availableClips.map((clip) => (
                                <div
                                  key={clip.id}
                                  style={{ 
                                    backgroundColor: '#fff', 
                                    border: '1px solid #e5e7eb', 
                                    borderRadius: '8px', 
                                    padding: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem'
                                  }}
                                >
                                  {getVideoUrl(clip) ? (
                                    <video
                                      src={getVideoUrl(clip)}
                                      style={{
                                        width: '80px',
                                        height: '60px',
                                        objectFit: 'cover',
                                        borderRadius: '4px',
                                        flexShrink: 0,
                                        backgroundColor: '#000'
                                      }}
                                      crossOrigin="anonymous"
                                      preload="metadata"
                                      muted
                                      playsInline
                                      onError={(e) => console.error('❌ Video load error:', clip.title, e.target.src)}
                                      onLoadedMetadata={(e) => console.log('✅ Video loaded:', clip.title, e.target.src)}
                                    />
                                  ) : (
                                    <FiVideo style={{ color: '#9b59b6', fontSize: '1.25rem', flexShrink: 0 }} />
                                  )}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ 
                                      fontSize: '0.875rem', 
                                      fontWeight: '500', 
                                      color: '#111827',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      margin: 0
                                    }}>
                                      {clip.title}
                                    </p>
                                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                                      {clip.duration_seconds 
                                        ? `Duration: ${formatDuration(clip.duration_seconds)}` 
                                        : 'Duration: Pending extraction'}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleLinkFootage(aiScene.id, clip.id)}
                                    style={{
                                      padding: '0.375rem 0.75rem',
                                      fontSize: '0.75rem',
                                      backgroundColor: '#dbeafe',
                                      color: '#1e40af',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontWeight: '500'
                                    }}
                                  >
                                    Link
                                  </button>
                                </div>
                              ))}
                            </div>
                          );
                        } else {
                          return (
                            <div style={{ 
                              backgroundColor: '#fef3c7', 
                              border: '1px solid #fde68a', 
                              borderRadius: '8px', 
                              padding: '0.75rem',
                              textAlign: 'center'
                            }}>
                              <FiAlertCircle style={{ margin: '0 auto', color: '#f59e0b', marginBottom: '0.25rem' }} />
                              <p style={{ fontSize: '0.875rem', color: '#92400e', margin: 0 }}>
                                No footage available to link
                              </p>
                              <p style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '0.25rem', margin: 0 }}>
                                Upload footage first or all footage is already linked
                              </p>
                            </div>
                          );
                        }
                      }
                    })()}
                  </div>

                  {/* Suggestions */}
                  {aiScene.visual_requirements?.suggestions?.length > 0 && (
                    <div style={{ 
                      backgroundColor: '#eff6ff', 
                      border: '1px solid #bfdbfe', 
                      borderRadius: '8px', 
                      padding: '0.75rem' 
                    }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#1e40af', marginBottom: '0.25rem' }}>
                        💡 AI Suggestions:
                      </p>
                      <ul style={{ fontSize: '0.75rem', color: '#1e40af', margin: 0, paddingLeft: '1.25rem' }}>
                        {aiScene.visual_requirements.suggestions.slice(0, 2).map((suggestion, idx) => (
                          <li key={idx}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div style={{ 
        background: 'linear-gradient(to right, #f3e8ff, #eff6ff)', 
        borderRadius: '8px', 
        padding: '1rem',
        border: '1px solid #c084fc'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>
              {aiScenes.filter(s => getCompletionStatus(s).status === 'complete').length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Complete</div>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f59e0b' }}>
              {aiScenes.filter(s => getCompletionStatus(s).status === 'partial').length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Partial</div>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ef4444' }}>
              {aiScenes.filter(s => getCompletionStatus(s).status === 'missing').length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Missing</div>
          </div>
        </div>
      </div>
    </div>
  );
}
