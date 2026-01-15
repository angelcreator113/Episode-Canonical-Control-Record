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
            <p className="subtitle">Create thumbnails for multiple formats from a single composition</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="composer-body">
        {/* Workflow Steps */}
        <div className="workflow-steps">
          <div className={`workflow-step ${isEpisodeSelected ? 'active completed' : 'active'}`}>
            <div className="step-number">1</div>
            <div className="step-label">Select Episode</div>
          </div>
          <div className={`workflow-step ${isEpisodeSelected ? 'active' : ''} ${areAssetsSelected ? 'completed' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">Choose Assets</div>
          </div>
          <div className={`workflow-step ${areAssetsSelected ? 'active' : ''} ${areFormatsSelected ? 'completed' : ''}`}>
            <div className="step-number">3</div>
            <div className="step-label">Pick Formats</div>
          </div>
          <div className={`workflow-step ${areFormatsSelected && areAssetsSelected && isEpisodeSelected ? 'active' : ''}`}>
            <div className="step-number">4</div>
            <div className="step-label">Generate</div>
          </div>
        </div>

        {/* Status Message */}
        {status && (
          <div className={`status-banner ${status.includes('✅') ? 'success' : 'error'}`}>
            {status}
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit}>
          <div className="composer-main-grid">
            {/* Left Panel - Assets */}
            <div className="composer-panel">
              <div className="panel-header">
                <h2 className="panel-title">📸 Select Assets</h2>
              </div>
              <div className="panel-body">
                {/* Episode Select */}
                <div className="form-field">
                  <label className="form-label">
                    Episode <span className="required">*</span>
                  </label>
                  {paramEpisodeId && paramEpisodeId !== 'default' ? (
                    <div className="episode-display">
                      <span className="episode-badge">📺</span>
                      <span>{episodeName || paramEpisodeId.substring(0, 8)}...</span>
                    </div>
                  ) : (
                    <>
                      <select 
                        className="form-select"
                        value={episodeId}
                        onChange={(e) => setEpisodeId(e.target.value)}
                        required
                      >
                        <option value="">Select Episode...</option>
                        {episodes.map(ep => (
                          <option key={ep.id} value={ep.id}>
                            {ep.episode_number ? `Episode ${ep.episode_number}` : ep.id} - {ep.title || ep.episodeTitle || 'Untitled'}
                          </option>
                        ))}
                      </select>
                      {episodes.length > 0 && (
                        <p className="form-help success">✅ {episodes.length} episode(s) loaded</p>
                      )}
                      {episodes.length === 0 && (
                        <p className="form-help error">⚠️ No episodes available</p>
                      )}
                    </>
                  )}
                </div>

                {/* Lala Asset */}
                <div className="form-field">
                  <label className="form-label">
                    Lala Asset <span className="required">*</span>
                  </label>
                  <select 
                    className="form-select"
                    value={lalaAssetId}
                    onChange={(e) => setLalaAssetId(e.target.value)}
                    required
                  >
                    <option value="">Select Lala Image...</option>
                    {lalaAssets.map(asset => (
                      <option key={asset.id} value={asset.id}>
                        {asset.id.substring(0, 8)}...
                      </option>
                    ))}
                  </select>
                  {lalaAssets.length > 0 && (
                    <p className="form-help">✓ {lalaAssets.length} asset(s) available</p>
                  )}
                </div>

                {/* Guest Asset */}
                <div className="form-field">
                  <label className="form-label">Guest Asset (Optional)</label>
                  <select 
                    className="form-select"
                    value={guestAssetId}
                    onChange={(e) => setGuestAssetId(e.target.value)}
                  >
                    <option value="">Select Guest Image (Optional)...</option>
                    {guestAssets.map(asset => (
                      <option key={asset.id} value={asset.id}>
                        {asset.id.substring(0, 8)}...
                      </option>
                    ))}
                  </select>
                </div>

                {/* JustAWoman Asset */}
                <div className="form-field">
                  <label className="form-label">
                    JustAWoman Asset <span className="required">*</span>
                  </label>
                  <select 
                    className="form-select"
                    value={justawomanAssetId}
                    onChange={(e) => setJustawomanAssetId(e.target.value)}
                    required
                  >
                    <option value="">Select JustAWoman Image...</option>
                    {justawomanAssets.map(asset => (
                      <option key={asset.id} value={asset.id}>
                        {asset.id.substring(0, 8)}...
                      </option>
                    ))}
                  </select>
                  {justawomanAssets.length > 0 && (
                    <p className="form-help">✓ {justawomanAssets.length} asset(s) available</p>
                  )}
                </div>

                {/* Background Frame */}
                <div className="form-field">
                  <label className="form-label">
                    Background Frame <span className="required">*</span>
                  </label>
                  <select 
                    className="form-select"
                    value={backgroundFrameAssetId}
                    onChange={(e) => setBackgroundFrameAssetId(e.target.value)}
                    required
                  >
                    <option value="">Select Background Frame...</option>
                    {backgroundFrameAssets.map(asset => (
                      <option key={asset.id} value={asset.id}>
                        {asset.id.substring(0, 8)}...
                      </option>
                    ))}
                  </select>
                  {backgroundFrameAssets.length > 0 && (
                    <p className="form-help">✓ {backgroundFrameAssets.length} asset(s) available</p>
                  )}
                </div>
              </div>
            </div>

            {/* Center Panel - Preview */}
            <div className="composer-panel preview-panel">
              <div className="panel-header">
                <h2 className="panel-title">🎬 Live Preview (16:9)</h2>
              </div>
              <div className="panel-body">
                <div className="preview-canvas">
                  <div className="preview-layers">
                    <div className="preview-layer">
                      <span className="layer-icon">🖼️</span>
                      <span>Background</span>
                      {backgroundFrameAssetId && <span className="layer-status">✅</span>}
                    </div>
                    
                    <div className="preview-layer">
                      <span className="layer-icon">👩</span>
                      <span>Lala</span>
                      {lalaAssetId && <span className="layer-status">✅</span>}
                    </div>
                    
                    {justawomanAssetId && (
                      <div className="preview-layer">
                        <span className="layer-icon">💜</span>
                        <span>JustAWoman</span>
                        <span className="layer-status">✅</span>
                      </div>
                    )}
                    
                    {guestAssetId && (
                      <div className="preview-layer">
                        <span className="layer-icon">👤</span>
                        <span>Guest</span>
                        <span className="layer-status">✅</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="preview-dimensions-badge">
                    1920 × 1080px (16:9)
                  </div>
                </div>

                <div className="assets-checklist">
                  <h3 className="checklist-title">✓ Assets Selected</h3>
                  <ul className="checklist-items">
                    <li className={`checklist-item ${lalaAssetId ? 'selected' : ''}`}>
                      {lalaAssetId ? '✅' : '⬜'} Lala
                    </li>
                    <li className={`checklist-item ${justawomanAssetId ? 'selected' : ''}`}>
                      {justawomanAssetId ? '✅' : '⬜'} JustAWoman
                    </li>
                    <li className={`checklist-item ${guestAssetId ? 'selected' : ''}`}>
                      {guestAssetId ? '✅' : '⭕'} Guest (optional)
                    </li>
                    <li className={`checklist-item ${backgroundFrameAssetId ? 'selected' : ''}`}>
                      {backgroundFrameAssetId ? '✅' : '⬜'} Background Frame
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Right Panel - Formats */}
            <div className="composer-panel">
              <div className="panel-header">
                <h2 className="panel-title">
                  📱 Select Formats
                  {selectedCount > 0 && (
                    <span className="panel-badge">{selectedCount} selected</span>
                  )}
                </h2>
              </div>
              <div className="panel-body">
                <div className="format-list">
                  {Object.keys(selectedFormats).map(format => (
                    <label 
                      key={format} 
                      className={`format-item ${selectedFormats[format] ? 'checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="format-checkbox"
                        checked={selectedFormats[format]}
                        onChange={() => handleFormatToggle(format)}
                      />
                      <div className="format-info">
                        <div className="format-name">
                          {getFormatLabel(format)}
                          {format === 'YOUTUBE' && (
                            <span className="format-badge-primary">PRIMARY</span>
                          )}
                        </div>
                        <div className="format-dimensions">
                          {getFormatDimensions(format)}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <div style={{ 
                  marginTop: '1.5rem', 
                  padding: '1rem', 
                  background: 'linear-gradient(135deg, #fffbea 0%, #fef3c7 100%)',
                  borderLeft: '4px solid #f59e0b',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  color: '#92400e',
                  lineHeight: '1.6'
                }}>
                  <strong style={{ display: 'block', marginBottom: '0.25rem' }}>ℹ️ Note:</strong>
                  YouTube thumbnail will be set as the primary video thumbnail. Other formats are for promotional use.
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="composer-footer">
        <div className="footer-content">
          <div className="footer-info">
            {selectedCount > 0 ? (
              `Ready to generate ${selectedCount} thumbnail format${selectedCount === 1 ? '' : 's'}`
            ) : (
              'Select at least one format to continue'
            )}
          </div>
          <div className="footer-actions">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => setShowGallery(!showGallery)}
            >
              {showGallery ? '📋 Hide Gallery' : '🖼️ View Gallery'}
            </button>
            <button 
              type="submit"
              onClick={handleSubmit}
              className="btn btn-primary" 
              disabled={loading || !isEpisodeSelected || !areAssetsSelected || !areFormatsSelected}
            >
              {loading ? '⏳ Creating...' : '✨ Generate Thumbnails'}
            </button>
          </div>
        </div>
      </div>

      {/* Gallery */}
      {showGallery && (
        <div className="composer-body">
          <div className="gallery-section">
            <div className="gallery-header">
              <h2>📸 Thumbnail Gallery</h2>
            </div>
            
            {compositions.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '4rem 2rem', 
                color: '#9ca3af',
                fontSize: '1.1rem'
              }}>
                <p style={{ margin: '0 0 1rem 0' }}>No compositions yet.</p>
                <p style={{ margin: 0 }}>Create your first composition to get started!</p>
              </div>
            ) : (
              <div className="gallery-grid">
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
        </div>
      )}
    </div>
  );
}

export default ThumbnailComposer;