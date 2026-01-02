import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './ThumbnailComposer.css';

/**
 * ThumbnailComposer Component
 * Minimal form for creating composite thumbnails
 */

const ThumbnailComposer = () => {
  const { episodeId } = useParams();
  const [templates, setTemplates] = useState([]);
  const [assets, setAssets] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [templateId, setTemplateId] = useState('');
  const [lalaAssetId, setLalaAssetId] = useState('');
  const [guestAssetId, setGuestAssetId] = useState('');
  const [frameAssetId, setFrameAssetId] = useState('');

  // Load templates and assets
  useEffect(() => {
    loadTemplates();
    loadAssets();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/v1/templates');
      if (!response.ok) throw new Error('Failed to load templates');
      const data = await response.json();
      setTemplates(data.data || []);
      if (data.data?.length > 0) {
        setTemplateId(data.data[0].id);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load templates');
    }
  };

  const loadAssets = async () => {
    try {
      const assetTypes = ['PROMO_LALA', 'PROMO_GUEST', 'EPISODE_FRAME'];
      const newAssets = {};

      for (const type of assetTypes) {
        const response = await fetch(`/api/v1/assets/approved/${type}`);
        if (!response.ok) throw new Error(`Failed to load ${type} assets`);
        const data = await response.json();
        newAssets[type] = data.data || [];
      }

      setAssets(newAssets);

      // Auto-select first asset of each type
      if (newAssets['PROMO_LALA']?.length > 0) setLalaAssetId(newAssets['PROMO_LALA'][0].id);
      if (newAssets['PROMO_GUEST']?.length > 0) setGuestAssetId(newAssets['PROMO_GUEST'][0].id);
      if (newAssets['EPISODE_FRAME']?.length > 0) setFrameAssetId(newAssets['EPISODE_FRAME'][0].id);
    } catch (err) {
      console.error('Error loading assets:', err);
      setError('Failed to load assets');
    }
  };

  const handleCompose = async (e) => {
    e.preventDefault();

    if (!templateId || !lalaAssetId || !guestAssetId || !frameAssetId) {
      setError('Please select all required assets');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/v1/compositions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          episode_id: episodeId,
          template_id: templateId,
          lala_asset_id: lalaAssetId,
          guest_asset_id: guestAssetId,
          background_frame_asset_id: frameAssetId,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to create composition');
      }

      const data = await response.json();
      setSuccess(`Composition created successfully: ${data.data.id}`);

      // Reset form
      setLalaAssetId('');
      setGuestAssetId('');
      setFrameAssetId('');
    } catch (err) {
      console.error('Error creating composition:', err);
      setError(err.message || 'Failed to create composition');
    } finally {
      setLoading(false);
    }
  };

  const getSelectedTemplate = () => {
    return templates.find(t => t.id === templateId);
  };

  const template = getSelectedTemplate();

  return (
    <div className="thumbnail-composer">
      <div className="composer-container">
        <h1>🎨 Thumbnail Composer</h1>
        <p className="subtitle">Create composite thumbnails for Episode {episodeId}</p>

        <div className="composer-grid">
          {/* Form Section */}
          <div className="composer-form-section">
            <h2>Compose Thumbnail</h2>
            <form onSubmit={handleCompose} className="composer-form">
              <div className="form-group">
                <label htmlFor="template">Template</label>
                <select
                  id="template"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  required
                >
                  <option value="">Select a template</option>
                  {templates.map(tmpl => (
                    <option key={tmpl.id} value={tmpl.id}>
                      {tmpl.name} ({tmpl.width}x{tmpl.height})
                    </option>
                  ))}
                </select>
              </div>

              {template && (
                <div className="template-info">
                  <p><strong>Platform:</strong> {template.platform}</p>
                  <p><strong>Dimensions:</strong> {template.width}x{template.height}px</p>
                  <p><strong>Aspect Ratio:</strong> {template.aspect_ratio}</p>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="lala">Lala Asset</label>
                <select
                  id="lala"
                  value={lalaAssetId}
                  onChange={(e) => setLalaAssetId(e.target.value)}
                  required
                >
                  <option value="">Select Lala asset</option>
                  {assets['PROMO_LALA']?.map(asset => (
                    <option key={asset.id} value={asset.id}>
                      {asset.id.substring(0, 8)}... ({(asset.file_size_bytes / 1024).toFixed(0)}KB)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="guest">Guest Asset</label>
                <select
                  id="guest"
                  value={guestAssetId}
                  onChange={(e) => setGuestAssetId(e.target.value)}
                  required
                >
                  <option value="">Select Guest asset</option>
                  {assets['PROMO_GUEST']?.map(asset => (
                    <option key={asset.id} value={asset.id}>
                      {asset.id.substring(0, 8)}... ({(asset.file_size_bytes / 1024).toFixed(0)}KB)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="frame">Background Frame</label>
                <select
                  id="frame"
                  value={frameAssetId}
                  onChange={(e) => setFrameAssetId(e.target.value)}
                  required
                >
                  <option value="">Select Frame asset</option>
                  {assets['EPISODE_FRAME']?.map(asset => (
                    <option key={asset.id} value={asset.id}>
                      {asset.id.substring(0, 8)}... ({(asset.file_size_bytes / 1024).toFixed(0)}KB)
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" disabled={loading} className="btn-compose">
                {loading ? '⏳ Creating...' : '🎨 Create Composition'}
              </button>
            </form>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}
          </div>

          {/* Preview Section */}
          <div className="composer-preview-section">
            <h2>Preview</h2>
            <div className="preview-box">
              {template ? (
                <div className="preview-content">
                  <div className="preview-template">
                    <p>{template.name}</p>
                    <p className="preview-dims">{template.width}x{template.height}px</p>
                  </div>

                  <div className="preview-layers">
                    <div className="layer-item">
                      <span className="layer-label">🖼️ Background</span>
                      <span className="layer-value">
                        {frameAssetId ? frameAssetId.substring(0, 8) + '...' : 'Select'}
                      </span>
                    </div>
                    <div className="layer-item">
                      <span className="layer-label">👩 Lala</span>
                      <span className="layer-value">
                        {lalaAssetId ? lalaAssetId.substring(0, 8) + '...' : 'Select'}
                      </span>
                    </div>
                    <div className="layer-item">
                      <span className="layer-label">👨 Guest</span>
                      <span className="layer-value">
                        {guestAssetId ? guestAssetId.substring(0, 8) + '...' : 'Select'}
                      </span>
                    </div>
                  </div>

                  <div className="preview-status">
                    {lalaAssetId && guestAssetId && frameAssetId ? (
                      <span className="status-ready">✅ Ready to Compose</span>
                    ) : (
                      <span className="status-pending">⏳ Select all assets</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="preview-placeholder">
                  <p>Select a template to preview composition</p>
                </div>
              )}
            </div>

            <div className="preview-info">
              <h3>How it works:</h3>
              <ol>
                <li>Select a template (YouTube, Instagram, etc.)</li>
                <li>Choose assets for Lala, Guest, and background frame</li>
                <li>Click "Create Composition" to generate</li>
                <li>Admin approves composition to make it live</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThumbnailComposer;
