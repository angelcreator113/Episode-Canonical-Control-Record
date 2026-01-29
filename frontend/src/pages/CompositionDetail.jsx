import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LayoutEditor from '../components/LayoutEditor';
import './CompositionDetail.css';

/**
 * CompositionDetail Component
 * View and manage a single composition with tabs for Outputs, Adjust Layout, and History
 */
export default function CompositionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [composition, setComposition] = useState(null);
  const [outputs, setOutputs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('outputs');
  const [selectedFormat, setSelectedFormat] = useState('');

  useEffect(() => {
    loadComposition();
    loadOutputs();
  }, [id]);

  const loadComposition = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/compositions/${id}`);
      if (!response.ok) throw new Error('Composition not found');
      
      const data = await response.json();
      const comp = data.data || data;
      setComposition(comp);
      
      // Set default format
      if (comp.selected_formats && comp.selected_formats.length > 0) {
        setSelectedFormat(comp.selected_formats[0]);
      }
    } catch (err) {
      console.error('Failed to load composition:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadOutputs = async () => {
    try {
      const response = await fetch(`/api/v1/compositions/${id}/outputs`);
      if (!response.ok) throw new Error('Failed to load outputs');
      
      const data = await response.json();
      setOutputs(data.data || []);
    } catch (err) {
      console.error('Failed to load outputs:', err);
    }
  };

  const handleDeleteOutput = async (outputId) => {
    if (!window.confirm('Delete this output?')) return;

    try {
      const response = await fetch(`/api/v1/outputs/${outputId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete output');
      
      setOutputs(prev => prev.filter(o => o.id !== outputId));
    } catch (err) {
      console.error('Failed to delete output:', err);
      alert('Failed to delete output: ' + err.message);
    }
  };

  const handleRegenerateOutput = async (format) => {
    try {
      const response = await fetch(`/api/v1/compositions/${id}/outputs/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          formats: [format], 
          regenerate: true 
        }),
      });

      if (!response.ok) throw new Error('Failed to regenerate');
      
      alert(`Queued ${format} for regeneration`);
      loadOutputs();
    } catch (err) {
      console.error('Failed to regenerate:', err);
      alert('Failed to regenerate: ' + err.message);
    }
  };

  const handleRetryFailed = async () => {
    const failedOutputs = outputs.filter(o => o.status === 'FAILED');
    const formats = failedOutputs.map(o => o.format);
    
    if (formats.length === 0) return;

    try {
      const response = await fetch(`/api/v1/compositions/${id}/outputs/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          formats, 
          regenerate: true 
        }),
      });

      if (!response.ok) throw new Error('Failed to retry');
      
      alert(`Retrying ${formats.length} failed output(s)`);
      loadOutputs();
    } catch (err) {
      console.error('Failed to retry:', err);
      alert('Failed to retry: ' + err.message);
    }
  };

  const handleSetPrimary = async () => {
    if (composition?.is_primary) {
      alert('This composition is already the primary thumbnail for this episode');
      return;
    }

    if (!window.confirm('Set this composition as the primary thumbnail for this episode? This will update the episode cover image.')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/compositions/${id}/primary`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to set as primary');
      
      const data = await response.json();
      setComposition(data.data);
      alert('✅ Set as primary thumbnail! Episode cover updated.');
    } catch (err) {
      console.error('Failed to set as primary:', err);
      alert('Failed to set as primary: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="composition-detail">
        <div className="composition-detail__loading">
          <div className="composition-detail__loading-spinner"></div>
          <p>Loading composition...</p>
        </div>
            </div>
    );
  }

  if (error || !composition) {
    return (
      <div className="composition-detail">
        <div className="composition-detail__error">
          <h2>❌ {error || 'Composition not found'}</h2>
          <button onClick={() => navigate('/library')}>Back to Library</button>
        </div>
      </div>
    );
  }

  const episodeName = composition.episode?.episodeTitle || composition.episode?.title || 'Unknown Episode';
  const showName = composition.episode?.show?.name || 'Unknown Show';
  const templateName = composition.template?.name || 'Default Template';
  const version = composition.current_version || 1;
  const hasDraft = composition.has_unsaved_changes || false;
  
  const readyOutputs = outputs.filter(o => o.status === 'READY');
  const failedOutputs = outputs.filter(o => o.status === 'FAILED');
  const processingOutputs = outputs.filter(o => o.status === 'PROCESSING');
  
  const currentFormatOutput = outputs.find(o => o.format === selectedFormat);

  return (
    <div className="composition-detail">
      {/* Header */}
      <div className="composition-detail__header">
        <button 
          className="composition-detail__back-btn"
          onClick={() => navigate('/library')}
        >
          ← Back to Library
        </button>

        <div className="composition-detail__header-content">
          <div className="composition-detail__title-section">
            <h1 className="composition-detail__title">
              {composition.name || episodeName}
            </h1>
            <div className="composition-detail__badges">
              {composition.is_primary && (
                <span className="composition-detail__badge composition-detail__badge--primary">
                  ⭐ Primary
                </span>
              )}
              <span className="composition-detail__badge composition-detail__badge--version">
                v{version}
              </span>
              <span className={`composition-detail__badge composition-detail__badge--status composition-detail__badge--status-${composition.status?.toLowerCase() || 'draft'}`}>
                {composition.status || 'DRAFT'}
              </span>
              {hasDraft && (
                <span className="composition-detail__badge composition-detail__badge--draft">
                  Unsaved Changes
                </span>
              )}
              {failedOutputs.length > 0 && (
                <span className="composition-detail__badge composition-detail__badge--failed">
                  {failedOutputs.length} Failed
                </span>
              )}
            </div>
          </div>

          <div className="composition-detail__header-actions">
            {!composition.is_primary && (
              <button 
                className="composition-detail__action-btn"
                onClick={handleSetPrimary}
                disabled={readyOutputs.length === 0}
                title={readyOutputs.length === 0 ? 'Generate outputs first' : 'Set as primary thumbnail for episode'}
              >
                ⭐ Set as Primary
              </button>
            )}
            <button 
              className="composition-detail__action-btn composition-detail__action-btn--primary"
              onClick={() => setActiveTab('adjust')}
            >
              ✏️ Adjust Layout
            </button>
          </div>
        </div>
      </div>

      {/* Metadata Strip */}
      <div className="composition-detail__metadata">
        <div className="composition-detail__metadata-item">
          <span className="composition-detail__metadata-label">Show</span>
          <span className="composition-detail__metadata-value">{showName}</span>
        </div>
        <div className="composition-detail__metadata-item">
          <span className="composition-detail__metadata-label">Episode</span>
          <span className="composition-detail__metadata-value">{episodeName}</span>
        </div>
        <div className="composition-detail__metadata-item">
          <span className="composition-detail__metadata-label">Template</span>
          <span className="composition-detail__metadata-value">{templateName}</span>
        </div>
        <div className="composition-detail__metadata-item">
          <span className="composition-detail__metadata-label">Created</span>
          <span className="composition-detail__metadata-value">
            {new Date(composition.created_at).toLocaleDateString()}
          </span>
        </div>
        {composition.last_modified_by && (
          <div className="composition-detail__metadata-item">
            <span className="composition-detail__metadata-label">Last Edited</span>
            <span className="composition-detail__metadata-value">
              {composition.last_modified_by} on {new Date(composition.modification_timestamp).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="composition-detail__tabs">
        <button
          className={`composition-detail__tab ${activeTab === 'outputs' ? 'composition-detail__tab--active' : ''}`}
          onClick={() => setActiveTab('outputs')}
        >
          📸 Outputs ({readyOutputs.length})
        </button>
        <button
          className={`composition-detail__tab ${activeTab === 'adjust' ? 'composition-detail__tab--active' : ''}`}
          onClick={() => setActiveTab('adjust')}
        >
          ✏️ Adjust Layout
        </button>
        <button
          className={`composition-detail__tab ${activeTab === 'history' ? 'composition-detail__tab--active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 History
        </button>
      </div>

      {/* Tab Content */}
      <div className="composition-detail__tab-content">
        {/* Outputs Tab */}
        {activeTab === 'outputs' && (
          <div className="composition-detail__outputs">
            {/* Format Selector */}
            {composition.selected_formats && composition.selected_formats.length > 0 && (
              <div className="composition-detail__format-selector">
                <label>View Format:</label>
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="composition-detail__format-select"
                >
                  {composition.selected_formats.map(format => (
                    <option key={format} value={format}>{format}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Retry Failed Button */}
            {failedOutputs.length > 0 && (
              <div className="composition-detail__failed-banner">
                <span>{failedOutputs.length} output(s) failed to generate</span>
                <button onClick={handleRetryFailed} className="composition-detail__retry-btn">
                  🔄 Retry Failed
                </button>
              </div>
            )}

            {/* Current Format Output */}
            {currentFormatOutput ? (
              <div className="composition-detail__output-display">
                <div className="composition-detail__output-card">
                  <h3 className="composition-detail__output-title">{selectedFormat}</h3>
                  
                  {currentFormatOutput.status === 'READY' && currentFormatOutput.image_url && (
                    <div className="composition-detail__output-preview">
                      <img src={currentFormatOutput.image_url} alt={selectedFormat} />
                    </div>
                  )}

                  {currentFormatOutput.status === 'PROCESSING' && (
                    <div className="composition-detail__output-processing">
                      <div className="composition-detail__loading-spinner"></div>
                      <p>Generating {selectedFormat}...</p>
                    </div>
                  )}

                  {currentFormatOutput.status === 'FAILED' && (
                    <div className="composition-detail__output-failed">
                      <p>❌ Generation Failed</p>
                      {currentFormatOutput.error_message && (
                        <p className="composition-detail__error-message">
                          {currentFormatOutput.error_message}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Output Metadata */}
                  <div className="composition-detail__output-meta">
                    <div className="composition-detail__output-meta-item">
                      <span>Resolution:</span>
                      <span>{currentFormatOutput.width} × {currentFormatOutput.height}</span>
                    </div>
                    {currentFormatOutput.generated_at && (
                      <div className="composition-detail__output-meta-item">
                        <span>Generated:</span>
                        <span>{new Date(currentFormatOutput.generated_at).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="composition-detail__output-actions">
                    {currentFormatOutput.status === 'READY' && currentFormatOutput.image_url && (
                      <>
                        <a
                          href={currentFormatOutput.image_url}
                          download
                          className="composition-detail__output-action-btn"
                        >
                          ⬇️ Download
                        </a>
                        <button
                          onClick={() => navigator.clipboard.writeText(currentFormatOutput.image_url)}
                          className="composition-detail__output-action-btn"
                        >
                          📋 Copy URL
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleRegenerateOutput(selectedFormat)}
                      className="composition-detail__output-action-btn"
                    >
                      🔄 Regenerate
                    </button>
                    <button
                      onClick={() => handleDeleteOutput(currentFormatOutput.id)}
                      className="composition-detail__output-action-btn composition-detail__output-action-btn--danger"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="composition-detail__output-empty">
                <p>No output generated for {selectedFormat}</p>
                <button
                  onClick={() => handleRegenerateOutput(selectedFormat)}
                  className="composition-detail__generate-btn"
                >
                  Generate {selectedFormat}
                </button>
              </div>
            )}

            {/* All Outputs Summary */}
            {outputs.length > 0 && (
              <div className="composition-detail__outputs-summary">
                <h3>All Outputs</h3>
                <div className="composition-detail__outputs-grid">
                  {outputs.map(output => (
                    <div 
                      key={output.id} 
                      className={`composition-detail__output-thumb composition-detail__output-thumb--${output.status.toLowerCase()}`}
                      onClick={() => setSelectedFormat(output.format)}
                    >
                      {output.status === 'READY' && output.image_url ? (
                        <img src={output.image_url} alt={output.format} />
                      ) : (
                        <div className="composition-detail__output-thumb-placeholder">
                          {output.status === 'PROCESSING' ? '⏳' : '❌'}
                        </div>
                      )}
                      <div className="composition-detail__output-thumb-label">
                        {output.format}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Adjust Layout Tab */}
        {activeTab === 'adjust' && (
          <div className="composition-detail__adjust">
            <LayoutEditor 
              composition={composition}
              onSave={loadComposition}
              onDiscard={() => setActiveTab('outputs')}
            />
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="composition-detail__history">
            <h2>Version History</h2>
            {composition.version_history && Object.keys(composition.version_history).length > 0 ? (
              <div className="composition-detail__history-list">
                {Object.entries(composition.version_history)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([versionKey, versionData]) => (
                    <div key={versionKey} className="composition-detail__history-item">
                      <div className="composition-detail__history-header">
                        <span className="composition-detail__history-version">{versionKey}</span>
                        <span className="composition-detail__history-date">
                          {new Date(versionData.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="composition-detail__history-details">
                        <p><strong>By:</strong> {versionData.user}</p>
                        <p><strong>Type:</strong> {versionData.changes?.type || 'unknown'}</p>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="composition-detail__history-empty">
                <p>No version history yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
