import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { createAuthenticatedAxios } from '../services/authService';
import '../styles/CompositionEditor.css';

/**
 * Composition Editor Component
 * Allows editing and updating composition metadata with automatic versioning
 */
export default function CompositionEditor({ compositionId, onSave }) {
  const [composition, setComposition] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetchComposition();
  }, [compositionId]);

  const fetchComposition = async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000'
        : '';
      const response = await axios.get(
        `${apiUrl}/api/v1/compositions/${compositionId}`
      );
      setComposition(response.data.data);
      setFormData(response.data.data);
    } catch (err) {
      setError('Failed to load composition: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setError(null);
      
      // Only send changed fields
      const changes = {};
      Object.keys(formData).forEach(key => {
        if (JSON.stringify(formData[key]) !== JSON.stringify(composition[key])) {
          changes[key] = formData[key];
        }
      });

      if (Object.keys(changes).length === 0) {
        setSuccess('No changes to save');
        return;
      }

      const authAxios = createAuthenticatedAxios();
      const response = await authAxios.put(
        `/compositions/${compositionId}`,
        changes
      );

      if (response.data.status === 'SUCCESS') {
        setSuccess('Composition saved successfully! Version created.');
        setComposition(response.data.data);
        setFormData(response.data.data);
        
        if (onSave) {
          onSave(response.data.data);
        }

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setError('You are not logged in. Please login to save changes.');
      } else {
        setError('Failed to save composition: ' + err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormData(composition);
    setError(null);
  };

  if (loading) return <div className="editor-loading">Loading composition...</div>;
  if (!composition) return <div className="editor-error">Failed to load composition</div>;

  return (
    <div className="composition-editor">
      <div className="editor-header">
        <h2>Edit Composition</h2>
        <p className="subtitle">Changes will automatically create a new version</p>
      </div>

      {error && <div className="editor-alert error">{error}</div>}
      {success && <div className="editor-alert success">{success}</div>}

      <form onSubmit={handleSave} className="editor-form">
        <div className="form-section">
          <h3>Basic Information</h3>

          <div className="form-group">
            <label htmlFor="name">Composition Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name || ''}
              onChange={handleInputChange}
              placeholder="Enter composition name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description || ''}
              onChange={handleInputChange}
              placeholder="Enter composition description"
              rows="3"
            />
          </div>

          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              name="status"
              value={formData.status || 'draft'}
              onChange={handleSelectChange}
            >
              <option value="draft">Draft</option>
              <option value="review">In Review</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="form-section">
          <h3>Assets</h3>

          <div className="asset-info">
            <p className="info-text">
              Current assets and formats are displayed below. To change assets, please use the asset management section.
            </p>
          </div>

          {formData.selected_formats && (
            <div className="form-group">
              <label>Selected Formats</label>
              <div className="format-tags">
                {Array.isArray(formData.selected_formats) ? (
                  formData.selected_formats.map((format, idx) => (
                    <span key={idx} className="format-tag">{format}</span>
                  ))
                ) : (
                  Object.keys(formData.selected_formats).map((format, idx) => (
                    <span key={idx} className="format-tag">{format}</span>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="form-section">
          <h3>Metadata</h3>

          <div className="metadata-display">
            {formData.metadata && typeof formData.metadata === 'object' ? (
              <pre className="metadata-json">
                {JSON.stringify(formData.metadata, null, 2)}
              </pre>
            ) : (
              <p className="no-metadata">No additional metadata</p>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleReset}
            disabled={saving}
          >
            Reset
          </button>
        </div>
      </form>

      {composition && (
        <div className="composition-info">
          <h4>Composition Info</h4>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">ID:</span>
              <code>{composition.id}</code>
            </div>
            <div className="info-item">
              <span className="label">Current Version:</span>
              <strong>{composition.current_version}</strong>
            </div>
            <div className="info-item">
              <span className="label">Created:</span>
              <span>{new Date(composition.created_at).toLocaleString()}</span>
            </div>
            <div className="info-item">
              <span className="label">Last Modified:</span>
              <span>{new Date(composition.modification_timestamp || composition.updated_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
