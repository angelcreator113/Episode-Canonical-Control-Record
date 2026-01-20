/**
 * EpisodeTemplateSelector Component
 * Allows selection of episode templates from API with auto-fill functionality
 */

import React, { useState, useEffect } from 'react';
import '../styles/EpisodeTemplateSelector.css';

const EpisodeTemplateSelector = ({
  onTemplateSelect = () => {},
  selectedTemplate = null,
}) => {
  const [templates, setTemplates] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch templates from API on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(import.meta.env.VITE_API_URL || '/api/v1/templates', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error('Failed to fetch templates');
        
        const data = await response.json();
        setTemplates(data.data || []);
      } catch (err) {
        console.error('Error fetching templates:', err);
        setError('Unable to load templates');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  const handleSelectTemplate = (template) => {
    onTemplateSelect({
      ...template,
      // Ensure categories is an array for auto-fill
      defaultCategories: template.defaultCategories || template.default_categories || [],
      defaultStatus: template.defaultStatus || template.default_status || 'draft',
    });
    setExpanded(false);
  };

  const selected = selectedTemplate ? selectedTemplate : null;

  return (
    <div className="episode-template-selector">
      <div className="template-header">
        <h3>📋 Episode Template</h3>
        <p className="template-subtitle">Choose a template to auto-fill form fields</p>
      </div>

      {/* Selected Template Display */}
      <div
        className="template-display"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex="0"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setExpanded(!expanded);
          }
        }}
      >
        {selected ? (
          <>
            <div className="template-display-info">
              <p className="template-display-name">{selected.name}</p>
              <p className="template-display-desc">{selected.description}</p>
            </div>
            <span className="expand-icon">{expanded ? '▲' : '▼'}</span>
          </>
        ) : (
          <>
            <span className="no-template">No template selected</span>
            <span className="expand-icon">{expanded ? '▲' : '▼'}</span>
          </>
        )}
      </div>

      {/* Template List */}
      {expanded && (
        <div className="template-list">
          {loading && <p className="loading-text">Loading templates...</p>}
          {error && <p className="error-text">{error}</p>}
          {!loading && templates.length === 0 && (
            <p className="no-templates-text">No templates available</p>
          )}
          {templates.map((template) => (
            <div
              key={template.id}
              className={`template-card ${
                selected?.id === template.id ? 'selected' : ''
              }`}
              onClick={() => handleSelectTemplate(template)}
              role="button"
              tabIndex="0"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleSelectTemplate(template);
                }
              }}
            >
              <div className="template-card-header">
                <h4>{template.name}</h4>
              </div>

              <p className="template-card-desc">{template.description}</p>

              {(template.defaultCategories || template.default_categories) && (
                <div className="template-categories">
                  {(template.defaultCategories || template.default_categories).map((cat) => (
                    <span key={cat} className="template-category">
                      {cat}
                    </span>
                  ))}
                </div>
              )}

              {selected?.id === template.id && (
                <div className="template-selected-badge">✓ Selected</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Selected Template Categories */}
      {selected && !expanded && (
        <div className="template-categories-preview">
          <p className="categories-label">Auto-filled Categories:</p>
          <div className="categories-list">
            {(selected.defaultCategories || selected.default_categories || []).map((cat) => (
              <span key={cat} className="category-badge">
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Clear Template */}
      {selected && (
        <button
          onClick={() => {
            onTemplateSelect(null);
            setExpanded(false);
          }}
          className="clear-template-btn"
        >
          Clear Template
        </button>
      )}
    </div>
  );
};

export default EpisodeTemplateSelector;
