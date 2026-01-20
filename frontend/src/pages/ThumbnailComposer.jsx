import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './ThumbnailComposer.css';
import { mockEpisodes, mockAssets } from '../mocks/mockEpisodes';

/**
 * ThumbnailComposer Component
 * Create compositions and generate thumbnails for multiple formats
 */

function ThumbnailComposer() {
  const { episodeId: paramEpisodeId } = useParams();
  const navigate = useNavigate();
  
  // Multi-step form state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  
  const [episodeId, setEpisodeId] = useState(paramEpisodeId || '');
  const [episodeName, setEpisodeName] = useState('');
  const [lalaAssetId, setLalaAssetId] = useState('');
  const [guestAssetId, setGuestAssetId] = useState('');
  const [justawomanAssetId, setJustawomanAssetId] = useState('');
  const [backgroundFrameAssetId, setBackgroundFrameAssetId] = useState('');
  
  const [episodes, setEpisodes] = useState([]);
  const [lalaAssets, setLalaAssets] = useState([]);
  const [guestAssets, setGuestAssets] = useState([]);
  const [justawomanAssets, setJustawomanAssets] = useState([]);
  const [backgroundFrameAssets, setBackgroundFrameAssets] = useState([]);
  
  const [selectedFormats, setSelectedFormats] = useState({
    YOUTUBE: true,
    YOUTUBE_MOBILE: false,
    INSTAGRAM_FEED: false,
    INSTAGRAM_STORY: false,
    TIKTOK: false,
    FACEBOOK: false,
    TWITTER: false,
    PINTEREST: false
  });

  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [compositions, setCompositions] = useState([]);
  const [showGallery, setShowGallery] = useState(false);
  const [thumbnails, setThumbnails] = useState({});

  // Load data on mount
  useEffect(() => {
    const savedEpisodeId = localStorage.getItem('selectedEpisodeId');
    if (savedEpisodeId && !paramEpisodeId) {
      setEpisodeId(savedEpisodeId);
    }
    
    if (paramEpisodeId) {
      loadSingleEpisode(paramEpisodeId);
    } else {
      loadEpisodes();
    }
    
    loadLalaAssets();
    loadGuestAssets();
    loadJustawomanAssets();
    loadBackgroundFrameAssets();
  }, [paramEpisodeId]);

  // Save episode selection
  useEffect(() => {
    if (episodeId && episodeId !== 'default') {
      localStorage.setItem('selectedEpisodeId', episodeId);
      localStorage.setItem('selectedEpisodeName', episodeName);
    }
  }, [episodeId, episodeName]);

  // Load compositions when episode changes
  useEffect(() => {
    if (episodeId && episodeId !== 'default') {
      loadCompositions();
    }
  }, [episodeId]);

  // Load saved compositions from localStorage
  useEffect(() => {
    try {
      const savedCompositions = localStorage.getItem('compositions');
      if (savedCompositions) {
        const parsed = JSON.parse(savedCompositions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCompositions(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load saved compositions:', e);
    }
  }, []);

  // Save compositions to localStorage
  useEffect(() => {
    if (compositions.length > 0) {
      localStorage.setItem('compositions', JSON.stringify(compositions));
    }
  }, [compositions]);

  const loadEpisodes = async () => {
    try {
      const response = await fetch('/api/v1/episodes');
      const data = await response.json();
      
      let episodeList = [];
      if (data.data && Array.isArray(data.data)) {
        episodeList = data.data;
      } else if (Array.isArray(data)) {
        episodeList = data;
      } else if (data.episodes && Array.isArray(data.episodes)) {
        episodeList = data.episodes;
      }
      
      setEpisodes(episodeList.length > 0 ? episodeList : mockEpisodes);
    } catch (error) {
      setEpisodes(mockEpisodes);
    }
  };

  const loadSingleEpisode = async (id) => {
    try {
      if (id === 'default') {
        const response = await fetch('/api/v1/episodes?limit=1');
        const data = await response.json();
        if (data.data && data.data.length > 0) {
          const episode = data.data[0];
          setEpisodeId(episode.id);
          setEpisodeName(episode.title || `Episode ${episode.episode_number}`);
          return;
        }
        
        const episode = mockEpisodes[0];
        if (episode) {
          setEpisodeId(episode.id);
          setEpisodeName(episode.episodeTitle || `Episode ${episode.episodeNumber}`);
        }
      } else {
        const response = await fetch(`/api/v1/episodes/${id}`);
        if (response.ok) {
          const data = await response.json();
          const episode = data.data;
          if (episode) {
            setEpisodeId(episode.id);
            setEpisodeName(episode.title || `Episode ${episode.episode_number}`);
            return;
          }
        }
        
        const episode = mockEpisodes.find(e => e.id === id) || mockEpisodes[0];
        if (episode) {
          setEpisodeId(episode.id);
          setEpisodeName(episode.episodeTitle || `Episode ${episode.episodeNumber}`);
        }
      }
    } catch (error) {
      const episode = mockEpisodes[0];
      if (episode) {
        setEpisodeId(episode.id);
        setEpisodeName(episode.episodeTitle || `Episode ${episode.episodeNumber}`);
      }
    }
  };

  const loadLalaAssets = async () => {
    try {
      const response = await fetch('/api/v1/assets/approved/PROMO_LALA');
      if (response.ok) {
        const data = await response.json();
        const assets = data.data || data.assets || [];
        setLalaAssets(assets);
        if (assets.length > 0) setLalaAssetId(assets[0].id);
      } else {
        throw new Error('Failed to load');
      }
    } catch (error) {
      setLalaAssets(mockAssets.PROMO_LALA);
      if (mockAssets.PROMO_LALA.length > 0) {
        setLalaAssetId(mockAssets.PROMO_LALA[0].id);
      }
    }
  };

  const loadGuestAssets = async () => {
    try {
      const response = await fetch('/api/v1/assets/approved/PROMO_GUEST');
      if (response.ok) {
        const data = await response.json();
        setGuestAssets(data.data || data.assets || []);
      } else {
        throw new Error('Failed to load');
      }
    } catch (error) {
      setGuestAssets(mockAssets.PROMO_GUEST);
    }
  };

  const loadJustawomanAssets = async () => {
    try {
      const response = await fetch('/api/v1/assets/approved/PROMO_JUSTAWOMANINHERPRIME');
      if (response.ok) {
        const data = await response.json();
        const assets = data.data || data.assets || [];
        setJustawomanAssets(assets);
        if (assets.length > 0) setJustawomanAssetId(assets[0].id);
      } else {
        throw new Error('Failed to load');
      }
    } catch (error) {
      setJustawomanAssets(mockAssets.PROMO_JUSTAWOMANINHERPRIME);
      if (mockAssets.PROMO_JUSTAWOMANINHERPRIME.length > 0) {
        setJustawomanAssetId(mockAssets.PROMO_JUSTAWOMANINHERPRIME[0].id);
      }
    }
  };

  const loadBackgroundFrameAssets = async () => {
    try {
      const response = await fetch('/api/v1/assets/approved/EPISODE_FRAME');
      if (response.ok) {
        const data = await response.json();
        const assets = data.data || data.assets || [];
        setBackgroundFrameAssets(assets);
        if (assets.length > 0) setBackgroundFrameAssetId(assets[0].id);
      } else {
        throw new Error('Failed to load');
      }
    } catch (error) {
      setBackgroundFrameAssets(mockAssets.EPISODE_FRAME);
      if (mockAssets.EPISODE_FRAME.length > 0) {
        setBackgroundFrameAssetId(mockAssets.EPISODE_FRAME[0].id);
      }
    }
  };

  const loadCompositions = async () => {
    try {
      if (!episodeId || episodeId === 'default') return;

      const response = await fetch(`/api/v1/compositions/episode/${episodeId}`);
      if (response.ok) {
        const data = await response.json();
        setCompositions(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load compositions:', error);
    }
  };

  // Navigation functions
  const canProceedToStep = (step) => {
    switch(step) {
      case 1:
        return true; // Can always access step 1
      case 2:
        return episodeId && episodeId !== 'default';
      case 3:
        return episodeId && lalaAssetId && justawomanAssetId && backgroundFrameAssetId;
      case 4:
        return episodeId && lalaAssetId && justawomanAssetId && backgroundFrameAssetId && Object.values(selectedFormats).some(v => v);
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps && canProceedToStep(currentStep + 1)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step) => {
    if (step >= 1 && step <= totalSteps && canProceedToStep(step)) {
      setCurrentStep(step);
    }
  };

  const handleFormatToggle = (format) => {
    setSelectedFormats(prev => ({
      ...prev,
      [format]: !prev[format]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const formats = Object.keys(selectedFormats).filter(key => selectedFormats[key]);
    
    // Validation
    if (!episodeId || episodeId === 'default' || episodeId === '') {
      setStatus('❌ Please select a valid episode');
      return;
    }
    
    if (!lalaAssetId) {
      setStatus('❌ Please select a Lala asset');
      return;
    }
    
    if (!justawomanAssetId) {
      setStatus('❌ Please select a JustAWoman asset');
      return;
    }

    if (!backgroundFrameAssetId) {
      setStatus('❌ Please select a background frame');
      return;
    }
    
    if (formats.length === 0) {
      setStatus('❌ Please select at least one format');
      return;
    }

    setStatus('⏳ Creating composition and generating thumbnails...');
    setLoading(true);

    try {
      const response = await fetch('/api/v1/compositions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episode_id: episodeId,
          lala_asset_id: lalaAssetId,
          guest_asset_id: guestAssetId || null,
          justawomen_asset_id: justawomanAssetId,
          background_frame_asset_id: backgroundFrameAssetId,
          include_justawomaninherprime: !!justawomanAssetId,
          selected_formats: formats
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setStatus(`✅ Composition created! Generating ${formats.length} thumbnail(s)...`);
        setTimeout(() => {
          loadCompositions();
          setStatus('');
        }, 2000);
      } else {
        const errorMsg = data.error || data.message || 'Failed to create composition';
        throw new Error(errorMsg);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateThumbnails = async (composition) => {
    try {
      setLoading(true);
      const episodeName = composition.episodeName || composition.episode?.episodeTitle || 'Unknown Episode';
      setStatus(`⏳ Generating thumbnails: ${episodeName}...`);
      
      const response = await fetch(`/api/v1/compositions/${composition.id}/generate-thumbnails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok && data.thumbnails) {
        setThumbnails(prev => ({
          ...prev,
          [composition.id]: data.thumbnails
        }));
        setStatus(`✅ Generated ${data.thumbnails.length} thumbnails: ${episodeName}`);
      } else if (response.ok) {
        setStatus(`✅ Thumbnails generated: ${episodeName}`);
      } else {
        const errorMsg = data?.message || data?.error || 'Unknown error';
        setStatus(`❌ Failed to generate: ${errorMsg}`);
      }
    } catch (error) {
      setStatus(`⚠️ Generation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComposition = async (composition) => {
    const episodeName = composition.episodeName || composition.episode?.episodeTitle || 'Unknown Episode';
    if (!window.confirm(`🗑️ Delete composition: ${episodeName}?\n\nThis cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      setStatus(`⏳ Deleting: ${episodeName}...`);
      
      const response = await fetch(`/api/v1/compositions/${composition.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok || response.status === 404 || response.status === 401 || response.status === 403) {
        setCompositions(prev => prev.filter(c => c.id !== composition.id));
        setStatus(`✅ Deleted: ${episodeName}`);
      } else {
        const data = await response.json();
        const errorMsg = data?.message || data?.error || 'Unknown error';
        setStatus(`❌ Failed to delete: ${errorMsg}`);
      }
    } catch (error) {
      setStatus(`⚠️ Delete failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getFormatLabel = (format) => {
    const labels = {
      YOUTUBE: 'YouTube',
      YOUTUBE_MOBILE: 'YouTube Mobile',
      INSTAGRAM_FEED: 'Instagram Feed',
      INSTAGRAM_STORY: 'Instagram Story',
      TIKTOK: 'TikTok',
      FACEBOOK: 'Facebook',
      TWITTER: 'Twitter',
      PINTEREST: 'Pinterest'
    };
    return labels[format] || format;
  };

  const getFormatDimensions = (format) => {
    const dimensions = {
      YOUTUBE: '1920×1080',
      YOUTUBE_MOBILE: '1280×720',
      INSTAGRAM_FEED: '1080×1080',
      INSTAGRAM_STORY: '1080×1920',
      TIKTOK: '1080×1920',
      FACEBOOK: '1200×630',
      TWITTER: '1200×675',
      PINTEREST: '1000×1500'
    };
    return dimensions[format] || '';
  };

  const selectedCount = Object.values(selectedFormats).filter(Boolean).length;

  // Workflow step states
  const isEpisodeSelected = !!episodeId && episodeId !== 'default';
  const areAssetsSelected = !!(lalaAssetId && justawomanAssetId && backgroundFrameAssetId);
  const areFormatsSelected = selectedCount > 0;

  return (
    <div className="thumbnail-composer">
      {/* Header */}
      <div className="composer-header">
        <div className="composer-header-content">
          <div className="composer-title">
            <h1>🎨 Thumbnail Composer</h1>
            <p className="subtitle">Step-by-step thumbnail creation wizard</p>
          </div>
          <button 
            onClick={() => setShowGallery(!showGallery)}
            style={{
              padding: '0.75rem 1.5rem',
              background: showGallery ? '#6b7280' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transition: 'all 0.2s'
            }}
          >
            {showGallery ? '✏️ Back to Wizard' : '🖼️ View Compositions'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="composer-body">
        {!showGallery ? (
          <>
            {/* Progress Bar */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>
                  Step {currentStep} of {totalSteps}
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#667eea' }}>
                  {Math.round((currentStep / totalSteps) * 100)}% Complete
                </span>
              </div>
              <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(currentStep / totalSteps) * 100}%`,
                  background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                  transition: 'width 0.3s ease',
                  borderRadius: '999px'
                }}></div>
              </div>
            </div>

            {/* Step Indicators */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              {[
                { num: 1, label: '📺 Episode', desc: 'Select episode' },
                { num: 2, label: '🖼️ Assets', desc: 'Choose images' },
                { num: 3, label: '📱 Formats', desc: 'Pick platforms' },
                { num: 4, label: '🎬 Review', desc: 'Generate thumbnails' }
              ].map(step => (
                <button
                  key={step.num}
                  onClick={() => goToStep(step.num)}
                  disabled={!canProceedToStep(step.num)}
                  style={{
                    flex: '1 1 200px',
                    maxWidth: '220px',
                    padding: '1rem',
                    background: currentStep === step.num 
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : canProceedToStep(step.num) && currentStep > step.num
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : '#f3f4f6',
                    color: currentStep === step.num || (canProceedToStep(step.num) && currentStep > step.num) ? 'white' : '#9ca3af',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: canProceedToStep(step.num) ? 'pointer' : 'not-allowed',
                    textAlign: 'center',
                    boxShadow: currentStep === step.num ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none',
                    transition: 'all 0.2s',
                    opacity: canProceedToStep(step.num) ? 1 : 0.5
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                    {currentStep > step.num && canProceedToStep(step.num + 1) ? '✅' : step.label.split(' ')[0]}
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                    {step.label.split(' ').slice(1).join(' ')}
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                    {step.desc}
                  </div>
                </button>
              ))}
            </div>

            {/* Status Message */}
            {status && (
              <div style={{
                padding: '1rem 1.5rem',
                background: status.includes('✅') ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                border: `2px solid ${status.includes('✅') ? '#10b981' : '#ef4444'}`,
                borderRadius: '12px',
                marginBottom: '2rem',
                fontSize: '1rem',
                fontWeight: '600',
                color: status.includes('✅') ? '#065f46' : '#991b1b',
                textAlign: 'center'
              }}>
                {status}
              </div>
            )}

            {/* Step Content */}
            <div style={{
              background: 'white',
              padding: '2.5rem',
              borderRadius: '16px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              minHeight: '500px'
            }}>
              {/* STEP 1: Select Episode */}
              {currentStep === 1 && (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📺</div>
                    <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: '700', color: '#1f2937' }}>
                      Choose Your Episode
                    </h2>
                    <p style={{ margin: 0, fontSize: '1.1rem', color: '#6b7280' }}>
                      Select which episode you want to create thumbnails for
                    </p>
                  </div>

                  {paramEpisodeId && paramEpisodeId !== 'default' ? (
                    <div style={{
                      maxWidth: '600px',
                      margin: '0 auto',
                      padding: '2rem',
                      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                      border: '2px solid #3b82f6',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                      <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: '700', color: '#1e3a8a' }}>
                        Episode Pre-Selected
                      </h3>
                      <p style={{ margin: 0, fontSize: '1.1rem', color: '#1e40af' }}>
                        {episodeName || `Episode ID: ${paramEpisodeId.substring(0, 12)}...`}
                      </p>
                    </div>
                  ) : (
                    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '1rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.75rem'
                      }}>
                        Select Episode <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        value={episodeId}
                        onChange={(e) => {
                          setEpisodeId(e.target.value);
                          const selected = episodes.find(ep => ep.id === e.target.value);
                          if (selected) {
                            setEpisodeName(selected.title || selected.episodeTitle || `Episode ${selected.episode_number}`);
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '1rem 1.25rem',
                          fontSize: '1.1rem',
                          border: '2px solid #d1d5db',
                          borderRadius: '10px',
                          background: 'white',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          marginBottom: '1rem'
                        }}
                      >
                        <option value="">-- Choose an Episode --</option>
                        {episodes.map(ep => (
                          <option key={ep.id} value={ep.id}>
                            {ep.episode_number ? `Episode ${ep.episode_number}` : ''} - {ep.title || ep.episodeTitle || 'Untitled'}
                          </option>
                        ))}
                      </select>
                      
                      {episodes.length === 0 && (
                        <div style={{
                          padding: '1.5rem',
                          background: '#fef3c7',
                          border: '2px solid #f59e0b',
                          borderRadius: '8px',
                          marginTop: '1rem'
                        }}>
                          <p style={{ margin: 0, color: '#92400e', fontSize: '0.95rem' }}>
                            ⚠️ No episodes available. Please create an episode first.
                          </p>
                        </div>
                      )}

                      {episodes.length > 0 && (
                        <div style={{
                          padding: '1.5rem',
                          background: '#d1fae5',
                          border: '2px solid #10b981',
                          borderRadius: '8px',
                          marginTop: '1rem'
                        }}>
                          <p style={{ margin: 0, color: '#065f46', fontSize: '0.95rem' }}>
                            ✅ {episodes.length} episode(s) available
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: Select Assets */}
              {currentStep === 2 && (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🖼️</div>
                    <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: '700', color: '#1f2937' }}>
                      Choose Your Assets
                    </h2>
                    <p style={{ margin: 0, fontSize: '1.1rem', color: '#6b7280' }}>
                      Select the images that will be used in your thumbnail composition
                    </p>
                  </div>

                  <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Lala Asset */}
                    <div style={{ padding: '1.5rem', background: '#f9fafb', borderRadius: '12px', border: '2px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '2rem' }}>👩</span>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>
                            Lala Image <span style={{ color: '#ef4444', fontSize: '1rem' }}>*</span>
                          </h3>
                          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>Main host image</p>
                        </div>
                      </div>
                      <select
                        value={lalaAssetId}
                        onChange={(e) => setLalaAssetId(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '0.875rem 1rem',
                          fontSize: '1rem',
                          border: '2px solid #d1d5db',
                          borderRadius: '8px',
                          background: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">Select Lala Image...</option>
                        {lalaAssets.map(asset => (
                          <option key={asset.id} value={asset.id}>
                            Asset ID: {asset.id.substring(0, 12)}...
                          </option>
                        ))}
                      </select>
                      {lalaAssets.length > 0 && (
                        <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.875rem', color: '#10b981' }}>
                          ✓ {lalaAssets.length} asset(s) available
                        </p>
                      )}
                    </div>

                    {/* JustAWoman Asset */}
                    <div style={{ padding: '1.5rem', background: '#faf5ff', borderRadius: '12px', border: '2px solid #e9d5ff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '2rem' }}>💜</span>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>
                            JustAWoman Logo <span style={{ color: '#ef4444', fontSize: '1rem' }}>*</span>
                          </h3>
                          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>Brand watermark</p>
                        </div>
                      </div>
                      <select
                        value={justawomanAssetId}
                        onChange={(e) => setJustawomanAssetId(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '0.875rem 1rem',
                          fontSize: '1rem',
                          border: '2px solid #d1d5db',
                          borderRadius: '8px',
                          background: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">Select JustAWoman Image...</option>
                        {justawomanAssets.map(asset => (
                          <option key={asset.id} value={asset.id}>
                            Asset ID: {asset.id.substring(0, 12)}...
                          </option>
                        ))}
                      </select>
                      {justawomanAssets.length > 0 && (
                        <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.875rem', color: '#10b981' }}>
                          ✓ {justawomanAssets.length} asset(s) available
                        </p>
                      )}
                    </div>

                    {/* Background Frame */}
                    <div style={{ padding: '1.5rem', background: '#eff6ff', borderRadius: '12px', border: '2px solid #bfdbfe' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '2rem' }}>🎨</span>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>
                            Background Frame <span style={{ color: '#ef4444', fontSize: '1rem' }}>*</span>
                          </h3>
                          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>Thumbnail background</p>
                        </div>
                      </div>
                      <select
                        value={backgroundFrameAssetId}
                        onChange={(e) => setBackgroundFrameAssetId(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '0.875rem 1rem',
                          fontSize: '1rem',
                          border: '2px solid #d1d5db',
                          borderRadius: '8px',
                          background: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">Select Background Frame...</option>
                        {backgroundFrameAssets.map(asset => (
                          <option key={asset.id} value={asset.id}>
                            Asset ID: {asset.id.substring(0, 12)}...
                          </option>
                        ))}
                      </select>
                      {backgroundFrameAssets.length > 0 && (
                        <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.875rem', color: '#10b981' }}>
                          ✓ {backgroundFrameAssets.length} asset(s) available
                        </p>
                      )}
                    </div>

                    {/* Guest Asset (Optional) */}
                    <div style={{ padding: '1.5rem', background: '#fef3c7', borderRadius: '12px', border: '2px dashed #fbbf24' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '2rem' }}>👤</span>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>
                            Guest Image <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: '400' }}>(Optional)</span>
                          </h3>
                          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>Add if episode features a guest</p>
                        </div>
                      </div>
                      <select
                        value={guestAssetId}
                        onChange={(e) => setGuestAssetId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.875rem 1rem',
                          fontSize: '1rem',
                          border: '2px solid #d1d5db',
                          borderRadius: '8px',
                          background: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">Select Guest Image (Optional)...</option>
                        {guestAssets.map(asset => (
                          <option key={asset.id} value={asset.id}>
                            Asset ID: {asset.id.substring(0, 12)}...
                          </option>
                        ))}
                      </select>
                      {guestAssets.length > 0 && (
                        <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.875rem', color: '#10b981' }}>
                          ✓ {guestAssets.length} asset(s) available
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Select Formats */}
              {currentStep === 3 && (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📱</div>
                    <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: '700', color: '#1f2937' }}>
                      Select Platform Formats
                    </h2>
                    <p style={{ margin: 0, fontSize: '1.1rem', color: '#6b7280' }}>
                      Choose which social media platforms you want thumbnails for ({selectedCount} selected)
                    </p>
                  </div>

                  <div style={{ maxWidth: '900px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {Object.keys(selectedFormats).map(format => (
                      <div
                        key={format}
                        onClick={() => setSelectedFormats(prev => ({ ...prev, [format]: !prev[format] }))}
                        style={{
                          padding: '1.5rem',
                          background: selectedFormats[format]
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : 'white',
                          color: selectedFormats[format] ? 'white' : '#1f2937',
                          border: `3px solid ${selectedFormats[format] ? '#667eea' : '#e5e7eb'}`,
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: selectedFormats[format] ? '0 4px 12px rgba(102, 126, 234, 0.3)' : '0 2px 4px rgba(0,0,0,0.05)',
                          transform: selectedFormats[format] ? 'scale(1.02)' : 'scale(1)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>
                            {getFormatLabel(format)}
                          </h3>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: selectedFormats[format] ? 'white' : '#e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1rem'
                          }}>
                            {selectedFormats[format] ? '✅' : ''}
                          </div>
                        </div>
                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600', opacity: selectedFormats[format] ? 1 : 0.7 }}>
                          {getFormatDimensions(format)}
                        </p>
                        {format === 'YOUTUBE' && (
                          <span style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.75rem',
                            background: selectedFormats[format] ? 'rgba(255,255,255,0.2)' : '#fbbf24',
                            color: selectedFormats[format] ? 'white' : '#78350f',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            marginTop: '0.5rem'
                          }}>
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {selectedCount === 0 && (
                    <div style={{
                      maxWidth: '600px',
                      margin: '2rem auto 0',
                      padding: '1.5rem',
                      background: '#fef3c7',
                      border: '2px solid #f59e0b',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <p style={{ margin: 0, color: '#92400e', fontSize: '1rem' }}>
                        ⚠️ Please select at least one format to continue
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: Review & Generate */}
              {currentStep === 4 && (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎬</div>
                    <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: '700', color: '#1f2937' }}>
                      Review & Generate
                    </h2>
                    <p style={{ margin: 0, fontSize: '1.1rem', color: '#6b7280' }}>
                      Confirm your selections and create your thumbnails
                    </p>
                  </div>

                  <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                    {/* Summary Cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                      {/* Episode Summary */}
                      <div style={{ padding: '1.5rem', background: '#eff6ff', borderRadius: '12px', border: '2px solid #3b82f6' }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          📺 Episode
                        </h3>
                        <p style={{ margin: 0, fontSize: '1.1rem', color: '#1e40af' }}>
                          {episodeName || `ID: ${episodeId.substring(0, 12)}...`}
                        </p>
                      </div>

                      {/* Assets Summary */}
                      <div style={{ padding: '1.5rem', background: '#f0fdf4', borderRadius: '12px', border: '2px solid #10b981' }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          🖼️ Assets Selected
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>✅</span>
                            <span style={{ color: '#047857' }}>Lala Image</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>✅</span>
                            <span style={{ color: '#047857' }}>JustAWoman Logo</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>✅</span>
                            <span style={{ color: '#047857' }}>Background Frame</span>
                          </div>
                          {guestAssetId && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>✅</span>
                              <span style={{ color: '#047857' }}>Guest Image</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Formats Summary */}
                      <div style={{ padding: '1.5rem', background: '#faf5ff', borderRadius: '12px', border: '2px solid #a855f7' }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#6b21a8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          📱 Formats ({selectedCount})
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {Object.entries(selectedFormats)
                            .filter(([_, selected]) => selected)
                            .map(([format]) => (
                              <span
                                key={format}
                                style={{
                                  padding: '0.5rem 1rem',
                                  background: '#a855f7',
                                  color: 'white',
                                  borderRadius: '8px',
                                  fontSize: '0.875rem',
                                  fontWeight: '600'
                                }}
                              >
                                {getFormatLabel(format)}
                              </span>
                            ))}
                        </div>
                      </div>
                    </div>

                    {/* Generate Button */}
                    <button
                      onClick={handleSubmit}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '1.5rem',
                        background: loading ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '1.25rem',
                        fontWeight: '700',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem'
                      }}
                    >
                      {loading ? (
                        <>
                          <span>⏳</span>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <span>🚀</span>
                          <span>Generate {selectedCount} Thumbnail{selectedCount !== 1 ? 's' : ''}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '1rem',
              marginTop: '2rem',
              maxWidth: '800px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
              <button
                onClick={prevStep}
                disabled={currentStep === 1}
                style={{
                  flex: '1',
                  padding: '1rem 2rem',
                  background: currentStep === 1 ? '#e5e7eb' : 'white',
                  color: currentStep === 1 ? '#9ca3af' : '#374151',
                  border: '2px solid #d1d5db',
                  borderRadius: '10px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                ← Previous
              </button>
              
              {currentStep < totalSteps && (
                <button
                  onClick={nextStep}
                  disabled={!canProceedToStep(currentStep + 1)}
                  style={{
                    flex: '1',
                    padding: '1rem 2rem',
                    background: canProceedToStep(currentStep + 1)
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : '#e5e7eb',
                    color: canProceedToStep(currentStep + 1) ? 'white' : '#9ca3af',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: canProceedToStep(currentStep + 1) ? 'pointer' : 'not-allowed',
                    boxShadow: canProceedToStep(currentStep + 1) ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  Next Step →
                </button>
              )}
            </div>
          </>
        ) : (
          /* Compositions Gallery */
          <div style={{ padding: '2rem 0' }}>
            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: '700', color: '#1f2937' }}>
                📸 Thumbnail Gallery
              </h2>
              <p style={{ margin: 0, fontSize: '1.1rem', color: '#6b7280' }}>
                View and manage your created compositions
              </p>
            </div>
            
            {compositions.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '4rem 2rem',
                background: 'white',
                borderRadius: '16px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
              }}>
                <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🎨</div>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                  No Compositions Yet
                </h3>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '1.1rem' }}>
                  Create your first composition using the wizard!
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {compositions.map(comp => {
                  const episodeName = comp.episodeName || comp.episode?.episodeTitle || comp.episode?.title || 'Unknown Episode';
                  const status = comp.approval_status || comp.status || 'DRAFT';
                  const createdDate = comp.created_at || comp.createdAt;
                  const formatsArray = Array.isArray(comp.selected_formats) 
                    ? comp.selected_formats 
                    : (Array.isArray(comp.formats) 
                      ? comp.formats 
                      : []);
                  const thumbnailCount = comp.thumbnails_generated || formatsArray.length || 0;
                  
                  return (
                    <div key={comp.id} style={{
                      background: 'white',
                      border: '2px solid var(--gray-200)',
                      borderRadius: 'var(--radius)',
                      overflow: 'hidden',
                      transition: 'all 0.3s',
                    }}>
                      <div style={{
                        width: '100%',
                        aspectRatio: '16 / 9',
                        background: comp.preview_url ? `url(${comp.preview_url})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        padding: '1.5rem',
                        textAlign: 'center',
                      }}>
                        {!comp.preview_url && (
                          <>
                            <div>📺 {episodeName}</div>
                            <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.9 }}>
                              {thumbnailCount} {thumbnailCount === 1 ? 'format' : 'formats'}
                            </div>
                          </>
                        )}
                      </div>
                      
                      <div style={{ padding: '1.5rem' }}>
                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: '700', color: 'var(--gray-900)' }}>
                          {episodeName}
                        </p>
                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--gray-700)' }}>
                          {thumbnailCount} {thumbnailCount === 1 ? 'format' : 'formats'}
                        </p>
                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
                          <strong>Status:</strong>{' '}
                          <span style={{ 
                            padding: '0.25rem 0.625rem', 
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            background: status === 'APPROVED' ? '#10b981' : '#f59e0b',
                            color: 'white'
                          }}>
                            {status}
                          </span>
                        </p>
                        <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--gray-700)' }}>
                          <strong>Created:</strong> {createdDate ? new Date(createdDate).toLocaleDateString() : 'Just now'}
                        </p>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button 
                            onClick={() => handleGenerateThumbnails(comp)}
                            style={{
                              padding: '0.5rem 1rem',
                              background: '#9c27b0',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              fontWeight: '700',
                              transition: 'all 0.2s'
                            }}
                          >
                            🎬 Generate
                          </button>
                          <button 
                            onClick={() => handleDeleteComposition(comp)}
                            style={{
                              padding: '0.5rem 1rem',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              fontWeight: '700',
                              transition: 'all 0.2s'
                            }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>

                      {thumbnails[comp.id] && thumbnails[comp.id].length > 0 && (
                        <div style={{ padding: '0 1.5rem 1.5rem' }}>
                          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '700' }}>
                            📸 Generated Thumbnails ({thumbnails[comp.id].length})
                          </h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {thumbnails[comp.id].map((thumb, idx) => (
                              <div key={idx} style={{
                                flex: '1 1 auto',
                                minWidth: '120px',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                background: '#f9fafb'
                              }}>
                                <a 
                                  href={thumb.s3_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                >
                                  <img 
                                    src={thumb.s3_url} 
                                    alt={thumb.formatName} 
                                    style={{
                                      width: '100%',
                                      height: '80px',
                                      objectFit: 'cover',
                                      cursor: 'pointer'
                                    }}
                                  />
                                </a>
                                <p style={{ 
                                  fontSize: '0.75rem', 
                                  padding: '0.25rem 0.5rem',
                                  margin: 0,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {thumb.formatName || thumb.format}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ThumbnailComposer;
