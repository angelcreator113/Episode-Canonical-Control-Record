import React, { useState, useEffect } from 'react';
import sceneTemplateService from '../../services/sceneTemplateService';
import './TemplatePickerModal.css';

const TemplatePickerModal = ({ isOpen, onClose, onApplyTemplate }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen, filterType]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const filters = { isPublic: true };
      if (filterType !== 'all') {
        filters.sceneType = filterType;
      }
      
      const response = await sceneTemplateService.listTemplates(filters);
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (selectedTemplate) {
      onApplyTemplate(selectedTemplate);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="template-modal-overlay" onClick={onClose}>
      <div className="template-modal" onClick={(e) => e.stopPropagation()}>
        <div className="template-modal-header">
          <h2>Choose a Scene Template</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="template-modal-filters">
          <label>Scene Type:</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="intro">Intro</option>
            <option value="main">Main</option>
            <option value="outro">Outro</option>
            <option value="transition">Transition</option>
          </select>
        </div>

        <div className="template-modal-content">
          {loading ? (
            <div className="template-loading">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="template-empty">No templates found</div>
          ) : (
            <div className="template-grid">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <div className="template-card-header">
                    <span className="template-type-badge">{template.scene_type}</span>
                    {template.mood && <span className="template-mood-badge">{template.mood}</span>}
                  </div>
                  <h3 className="template-name">{template.name}</h3>
                  <p className="template-description">{template.description}</p>
                  {template.duration_seconds && (
                    <div className="template-duration">
                      ⏱️ {Math.floor(template.duration_seconds / 60)}:{(template.duration_seconds % 60).toString().padStart(2, '0')}
                    </div>
                  )}
                  {selectedTemplate?.id === template.id && (
                    <div className="template-selected-check">✓</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="template-modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button 
            className="btn-apply" 
            onClick={handleApply}
            disabled={!selectedTemplate}
          >
            Apply Template
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplatePickerModal;
