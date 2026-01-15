/**
 * Template Management Page
 * Create, edit, and manage episode templates
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import templateService from '../services/templateService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import '../styles/TemplateManagement.css';

const TemplateManagement = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    defaultStatus: 'draft',
    defaultCategories: [],
    config: {},
  });
  
  const [categoryInput, setCategoryInput] = useState('');

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Check if user is admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      setError('Access denied. Admin privileges required.');
      setTimeout(() => navigate('/'), 2000);
    }
  }, [user, navigate]);

  // Load templates
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const templates = await templateService.getTemplates();
      setTemplates(templates);
      setError(null);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError('Failed to load templates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = () => {
    if (categoryInput.trim() && !formData.defaultCategories.includes(categoryInput.trim())) {
      setFormData({
        ...formData,
        defaultCategories: [...formData.defaultCategories, categoryInput.trim()],
      });
      setCategoryInput('');
    }
  };

  const handleRemoveCategory = (category) => {
    setFormData({
      ...formData,
      defaultCategories: formData.defaultCategories.filter((c) => c !== category),
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      defaultStatus: 'draft',
      defaultCategories: [],
      config: {},
    });
    setCategoryInput('');
    setEditingTemplate(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Template name is required');
      return;
    }

    try {
      setError(null);
      
      if (editingTemplate) {
        await templateService.updateTemplate(editingTemplate.id, formData);
        alert('Template updated successfully!');
      } else {
        await templateService.createTemplate(formData);
        alert('Template created successfully!');
      }

      // Refresh templates
      await fetchTemplates();
      resetForm();
    } catch (err) {
      console.error('Error saving template:', err);
      setError(err.message || `Failed to ${editingTemplate ? 'update' : 'create'} template`);
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      defaultStatus: template.defaultStatus || template.default_status || 'draft',
      defaultCategories: template.defaultCategories || template.default_categories || [],
      config: template.config || {},
    });
    setShowForm(true);
  };

  const handleDelete = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;

    try {
      setError(null);
      await templateService.deleteTemplate(templateId);

      // Refresh templates
      await fetchTemplates();
      alert('Template deleted successfully!');
    } catch (err) {
      console.error('Error deleting template:', err);
      setError(err.message || 'Failed to delete template');
    }
  };

  if (authLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="template-management-page">
      <div className="template-container">
        <div className="template-header">
          <h1>📋 Template Management</h1>
          <p className="template-subtitle">Create and manage episode templates</p>
          <button
            onClick={() => {
              if (showForm) {
                resetForm();
              } else {
                setShowForm(true);
              }
            }}
            className="btn-primary"
          >
            {showForm ? 'Cancel' : '+ Create Template'}
          </button>
        </div>

        {error && <ErrorMessage message={error} />}

        {/* Template Form */}
        {showForm && (
          <div className="template-form-container">
            <h2>{editingTemplate ? 'Edit Template' : 'Create New Template'}</h2>
            <form onSubmit={handleSubmit} className="template-form">
              <div className="form-group">
                <label htmlFor="name">Template Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Documentary, Interview, News"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe what this template is for..."
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label htmlFor="defaultStatus">Default Status</label>
                <select
                  id="defaultStatus"
                  name="defaultStatus"
                  value={formData.defaultStatus}
                  onChange={handleInputChange}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>

              <div className="form-group">
                <label>Default Categories</label>
                <div className="category-input-group">
                  <input
                    type="text"
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    placeholder="Add category and press button..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCategory();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="btn-add-category"
                  >
                    Add
                  </button>
                </div>

                {formData.defaultCategories.length > 0 && (
                  <div className="categories-display">
                    {formData.defaultCategories.map((cat) => (
                      <div key={cat} className="category-badge">
                        {cat}
                        <button
                          type="button"
                          onClick={() => handleRemoveCategory(cat)}
                          className="category-remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
                <button type="button" onClick={resetForm} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Templates List */}
        <div className="templates-list">
          {loading && <LoadingSpinner />}
          
          {!loading && templates.length === 0 && (
            <div className="empty-state">
              <p>📭 No templates yet</p>
              <p className="empty-text">Create your first template to get started</p>
            </div>
          )}

          {!loading && templates.length > 0 && (
            <>
              <h2>Available Templates ({templates.length})</h2>
              <div className="templates-grid">
                {templates.map((template) => (
                  <div key={template.id} className="template-card">
                    <div className="template-card-header">
                      <h3>{template.name}</h3>
                      <div className="template-actions">
                        <button
                          onClick={() => handleEdit(template)}
                          className="btn-edit"
                          title="Edit template"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          className="btn-delete"
                          title="Delete template"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <p className="template-desc">{template.description}</p>

                    <div className="template-meta">
                      <span className="status-badge">
                        Status: <strong>{template.defaultStatus || template.default_status || 'draft'}</strong>
                      </span>
                    </div>

                    {(template.defaultCategories || template.default_categories) && (
                      <div className="template-categories">
                        <p className="categories-label">Default Categories:</p>
                        <div className="categories-list">
                          {(template.defaultCategories || template.default_categories).map((cat) => (
                            <span key={cat} className="category-tag">
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="template-footer">
                      <small>Created: {new Date(template.createdAt).toLocaleDateString()}</small>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateManagement;
