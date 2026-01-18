/**
 * Template Selector Component
 * Allows users to select from predefined episode templates
 */

import React, { useState, useEffect } from 'react';
import '../styles/TemplateSelector.css';

const TemplateSelector = ({ onTemplateSelected = () => {}, readOnly = false }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('authToken');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      const response = await fetch('http://localhost:3002/api/v1/templates', { headers });
      if (!response.ok) throw new Error('Failed to load templates');

      const data = await response.json();
      setTemplates(data.data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
      setError(err.message);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    onTemplateSelected(template);
  };

  if (loading) {
    return <div className="template-selector loading">📋 Loading templates...</div>;
  }

  if (error) {
    return <div className="template-selector error">❌ {error}</div>;
  }

  if (!templates.length) {
    return (
      <div className="template-selector empty">
        <p>📋 No templates available</p>
        <p className="empty-text">Create templates to get started</p>
      </div>
    );
  }

  return (
    <div className="template-selector">
      <h3>📋 Episode Templates</h3>
      <div className="templates-grid">
        {templates.map((template) => (
          <div
            key={template.id}
            className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
            onClick={() => !readOnly && handleSelectTemplate(template)}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleSelectTemplate(template);
            }}
          >
            <div className="template-header">
              <h4>{template.name}</h4>
              <span className="template-status">
                {template.isActive ? '✓ Active' : '○ Inactive'}
              </span>
            </div>
            {template.description && (
              <p className="template-description">{template.description}</p>
            )}
            <div className="template-details">
              <span className="badge">Default: {template.defaultStatus}</span>
              {template.defaultCategories?.length > 0 && (
                <span className="badge">{template.defaultCategories.length} categories</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TemplateSelector;
