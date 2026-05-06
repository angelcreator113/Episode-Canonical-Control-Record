import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import './TemplateStudio.css';

// ─── Track 6 CP10 module-scope helpers (Pattern F prophylactic — Api suffix) ───
// 6 helpers covering 6 fetch sites on /template-studio/*. publishTemplateApi
// duplicated locally per v2.12 §9.11 (CP6 TemplateDesigner has it).
export const listTemplatesApi = (params) =>
  apiClient.get(params ? `/api/v1/template-studio?${params}` : '/api/v1/template-studio');
export const cloneTemplateApi = (id) =>
  apiClient.post(`/api/v1/template-studio/${id}/clone`);
export const publishTemplateApi = (id) =>
  apiClient.post(`/api/v1/template-studio/${id}/publish`);
export const lockTemplateApi = (id) =>
  apiClient.post(`/api/v1/template-studio/${id}/lock`);
export const archiveTemplateApi = (id) =>
  apiClient.post(`/api/v1/template-studio/${id}/archive`);
export const deleteTemplateApi = (id) =>
  apiClient.delete(`/api/v1/template-studio/${id}`);

/**
 * TemplateStudio - Template Management Dashboard
 * List, filter, and manage thumbnail templates
 */

function TemplateStudio() {
  const navigate = useNavigate();
  
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recently_used');
  
  useEffect(() => {
    loadTemplates();
  }, [statusFilter]);
  
  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }

      const response = await listTemplatesApi(params.toString());
      setTemplates(response.data?.data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreateNew = () => {
    navigate('/template-studio/designer');
  };
  
  const handleEdit = (template) => {
    if (template.status !== 'DRAFT') {
      alert('Only DRAFT templates can be edited. Clone this template to create a new version.');
      return;
    }
    navigate(`/template-studio/designer/${template.id}`);
  };
  
  const handleClone = async (template) => {
    if (!confirm(`Clone "${template.name}" to create version ${template.version + 1}?`)) {
      return;
    }

    try {
      const response = await cloneTemplateApi(template.id);
      alert(`✅ Template cloned successfully! New version: ${response.data?.data?.version}`);
      loadTemplates();
    } catch (err) {
      alert(`❌ ${err.response?.data?.message || err.message || 'Failed to clone template'}`);
    }
  };

  const handlePublish = async (template) => {
    if (!confirm(`Publish "${template.name}"? This will make it available for use.`)) {
      return;
    }

    try {
      await publishTemplateApi(template.id);
      alert('✅ Template published successfully!');
      loadTemplates();
    } catch (err) {
      alert(`❌ ${err.response?.data?.message || err.message || 'Failed to publish template'}`);
    }
  };

  const handleLock = async (template) => {
    if (!confirm(`Lock "${template.name}"? This will prevent any future edits.`)) {
      return;
    }

    try {
      await lockTemplateApi(template.id);
      alert('✅ Template locked successfully!');
      loadTemplates();
    } catch (err) {
      alert(`❌ ${err.response?.data?.message || err.message || 'Failed to lock template'}`);
    }
  };

  const handleArchive = async (template) => {
    if (!confirm(`Archive "${template.name}"? It will no longer be available for new compositions.`)) {
      return;
    }

    try {
      await archiveTemplateApi(template.id);
      alert('✅ Template archived successfully!');
      loadTemplates();
    } catch (err) {
      alert(`❌ ${err.response?.data?.message || err.message || 'Failed to archive template'}`);
    }
  };

  const handleDelete = async (template) => {
    if (template.status !== 'DRAFT') {
      alert('Only DRAFT templates can be deleted. Use Archive instead.');
      return;
    }

    if (!confirm(`Delete "${template.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteTemplateApi(template.id);
      alert('✅ Template deleted successfully!');
      loadTemplates();
    } catch (err) {
      alert(`❌ ${err.response?.data?.message || err.message || 'Failed to delete template'}`);
    }
  };
  
  // Filter templates by search query
  const filteredTemplates = templates.filter(template => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      template.name.toLowerCase().includes(query) ||
      (template.description || '').toLowerCase().includes(query)
    );
  });
  
  // Sort templates
  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    switch (sortBy) {
      case 'alphabetical':
        return a.name.localeCompare(b.name);
      case 'newest':
        return new Date(b.created_at) - new Date(a.created_at);
      case 'most_used':
        return (b.usage_count || 0) - (a.usage_count || 0);
      case 'recently_used':
      default:
        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    }
  });
  
  return (
    <div className="template-studio">
      <div className="studio-header">
        <div className="header-content">
          <h1>🎨 Template Studio</h1>
          <p>Design reusable thumbnail templates with role-based layouts</p>
        </div>
        <button onClick={handleCreateNew} className="btn-create-new">
          + New Template
        </button>
      </div>
      
      {/* Filters - Compact Single Row */}
      <div className="studio-filters">
        <div className="filter-group filter-tabs-group">
          <div className="status-tabs-compact">
            {['ALL', 'PUBLISHED', 'DRAFT', 'ARCHIVED'].map(status => (
              <button
                key={status}
                className={`status-tab-compact ${statusFilter === status ? 'active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                {status !== 'ALL' && (
                  <span className="tab-count-compact">
                    {templates.filter(t => t.status === status).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        
        <div className="filter-group">
          <label>Sort:</label>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="recently_used">Recently Used</option>
            <option value="alphabetical">Alphabetical</option>
            <option value="most_used">Most Used</option>
            <option value="newest">Newest First</option>
          </select>
        </div>
        
        <div className="filter-group search-group">
          <input
            type="text"
            placeholder="🔍 Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>
      
      {/* Loading State */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading templates...</p>
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <div className="error-state">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
          <button onClick={loadTemplates} className="btn-retry">Retry</button>
        </div>
      )}
      
      {/* Empty State */}
      {!loading && !error && sortedTemplates.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🎨</div>
          <h3>No Templates Found</h3>
          <p>
            {searchQuery 
              ? 'Try adjusting your search or filters'
              : 'Create your first template to get started'
            }
          </p>
          {!searchQuery && (
            <button onClick={handleCreateNew} className="btn-primary">
              Create First Template
            </button>
          )}
        </div>
      )}
      
      {/* Templates List - Redesigned */}
      {!loading && !error && sortedTemplates.length > 0 && (
        <div className="templates-list">
          {filteredTemplates.map(template => {
            const requiredCount = template.required_roles?.length || 0;
            const optionalCount = template.optional_roles?.length || 0;
            const primaryFormat = template.formats_supported?.[0] || 'YouTube';
            const additionalFormats = template.formats_supported?.slice(1) || [];
            
            return (
              <div 
                key={template.id} 
                className={`template-card status-${template.status.toLowerCase()}`}
              >
                {/* LEFT: Identity */}
                <div className="card-identity">
                  <div className="identity-name">
                    {template.name}
                    {template.description && (
                      <span className="identity-subtitle">{template.description}</span>
                    )}
                  </div>
                  <div className="identity-badges">
                    <span className="version-badge">v{template.version}</span>
                    <span className={`status-badge status-${template.status.toLowerCase()}`}>
                      {template.status === 'PUBLISHED' && '✓ '}
                      {template.status === 'DRAFT' && '⚡ '}
                      {template.status === 'ARCHIVED' && '📦 '}
                      {template.status}
                    </span>
                    {template.locked && (
                      <span className="locked-badge">🔒 Locked</span>
                    )}
                  </div>
                </div>

                {/* MIDDLE: Capabilities */}
                <div className="card-capabilities">
                  <div className="capability-item capability-primary">
                    <span className="cap-icon">📐</span>
                    <span className="cap-text">
                      {primaryFormat} ({template.canvas_config?.width}×{template.canvas_config?.height})
                    </span>
                  </div>
                  <div className="capability-item">
                    <span className="cap-icon">🎭</span>
                    <span className="cap-text">
                      {requiredCount} required · {optionalCount} optional
                    </span>
                  </div>
                  {additionalFormats.length > 0 && (
                    <div className="capability-item capability-muted">
                      <span className="cap-text">
                        + {additionalFormats.join(' · ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* RIGHT: Actions */}
                <div className="card-actions">
                  {template.status === 'DRAFT' && !template.locked && (
                    <>
                      <button 
                        onClick={() => handleEdit(template)}
                        className="btn-action-primary"
                      >
                        Edit Template
                      </button>
                      <button 
                        onClick={() => handlePublish(template)}
                        className="btn-action-secondary"
                      >
                        Publish
                      </button>
                      <button 
                        onClick={() => handleDelete(template)}
                        className="btn-action-menu"
                        title="Delete"
                      >
                        ⋯
                      </button>
                    </>
                  )}
                  
                  {template.status === 'PUBLISHED' && (
                    <>
                      <button 
                        onClick={() => navigate(`/composer?template=${template.id}`)}
                        className="btn-action-primary"
                      >
                        Use Template
                      </button>
                      <button 
                        onClick={() => handleClone(template)}
                        className="btn-action-secondary"
                      >
                        Clone
                      </button>
                      <button 
                        onClick={() => handleArchive(template)}
                        className="btn-action-menu"
                        title="More actions"
                      >
                        ⋯
                      </button>
                    </>
                  )}
                  
                  {template.status === 'ARCHIVED' && (
                    <>
                      <button 
                        onClick={() => handleClone(template)}
                        className="btn-action-primary"
                      >
                        Clone
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TemplateStudio;
