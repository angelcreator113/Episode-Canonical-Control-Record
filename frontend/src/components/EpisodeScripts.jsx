import React, { useState, useEffect } from 'react';
import { 
  FiFileText, 
  FiPlus, 
  FiClipboard,
  FiUpload, 
  FiFilm, 
  FiVideo, 
  FiStar, 
  FiCamera, 
  FiGift,
  FiEdit2,
  FiTrash2,
  FiDownload,
  FiClock,
  FiCheck
} from 'react-icons/fi';
import axios from 'axios';
import ScriptGeneratorSmart from './ScriptGeneratorSmart';
import LalaScriptGenerator from './LalaScriptGenerator';

const SCRIPT_TYPES = [
  { id: 'main', label: 'Main Script', icon: FiFileText },
  { id: 'trailer', label: 'Trailer', icon: FiFilm },
  { id: 'shorts', label: 'Shorts', icon: FiVideo },
  { id: 'teaser', label: 'Teaser', icon: FiStar },
  { id: 'behind-the-scenes', label: 'Behind-the-Scenes', icon: FiCamera },
  { id: 'bonus-content', label: 'Bonus Content', icon: FiGift },
];

export default function EpisodeScripts({ episodeId, showId }) {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeType, setActiveType] = useState('main');
  const [showNewScriptForm, setShowNewScriptForm] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [generatorTab, setGeneratorTab] = useState('smart'); // 'smart' or 'lala'
  const [editingScript, setEditingScript] = useState(null);
  const [formData, setFormData] = useState({
    content: '',
    versionLabel: '',
    author: '',
    status: 'draft',
    duration: '',
    sceneCount: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (episodeId) {
      loadScripts();
    }
  }, [episodeId]);

  const loadScripts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/v1/episodes/${episodeId}/scripts`, {
        params: { includeAllVersions: true, includeContent: true }
      });
      setScripts(response.data.data || response.data.scripts || []);
    } catch (err) {
      console.error('Failed to load scripts:', err);
      setError(err.message || 'Failed to load scripts');
    } finally {
      setLoading(false);
    }
  };

  const getScriptsByType = (type) => {
    return scripts.filter((s) => s.script_type === type);
  };

  const handleCreateScript = (e) => {
    e?.preventDefault();
    setFormData({
      content: '',
      versionLabel: '',
      author: '',
      status: 'draft',
      duration: '',
      sceneCount: '',
    });
    setShowNewScriptForm(true);
  };

  const handlePasteScript = (e) => {
    e?.preventDefault();
    setFormData({
      content: '',
      versionLabel: '',
      author: '',
      status: 'draft',
      duration: '',
      sceneCount: '',
    });
    setShowNewScriptForm(true);
  };

  const handleEditScript = (script) => {
    setEditingScript(script);
    setFormData({
      content: script.content || '',
      versionLabel: '',
      author: script.author || '',
      status: script.status || 'draft',
      duration: script.duration || '',
      sceneCount: script.scene_count || '',
    });
    setShowNewScriptForm(true);
  };

  const handleSaveScript = async (e) => {
    e.preventDefault();
    
    if (!formData.content.trim()) {
      alert('Please enter script content');
      return;
    }

    try {
      setSaving(true);
      const scriptData = {
        scriptType: activeType,
        content: formData.content,
        versionLabel: formData.versionLabel || undefined,
        author: formData.author || undefined,
        status: formData.status,
        duration: formData.duration ? parseInt(formData.duration) : undefined,
        sceneCount: formData.sceneCount ? parseInt(formData.sceneCount) : undefined,
      };

      if (editingScript) {
        await axios.put(`/api/v1/scripts/${editingScript.id}`, scriptData);
      } else {
        await axios.post('/api/v1/scripts', { episode_id: episodeId, ...scriptData });
      }
      
      await loadScripts();
      setShowNewScriptForm(false);
      setEditingScript(null);
      setFormData({
        content: '',
        versionLabel: '',
        author: '',
        status: 'draft',
        duration: '',
        sceneCount: '',
      });
    } catch (err) {
      console.error('Failed to save script:', err);
      alert('Failed to save script: ' + (err.response?.data?.message || err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancelForm = () => {
    setShowNewScriptForm(false);
    setEditingScript(null);
    setFormData({
      content: '',
      versionLabel: '',
      author: '',
      status: 'draft',
      duration: '',
      sceneCount: '',
    });
  };

  const handleScriptGenerated = (generatedScript, metadata) => {
    setFormData({
      ...formData,
      content: generatedScript,
      duration: metadata?.estimated_duration || '',
      sceneCount: metadata?.scene_count || ''
    });
    setShowGenerator(false);
    setShowNewScriptForm(true);
  };

  if (loading) {
    return (
      <div className="ed-state">
        <div className="ed-spinner"></div>
        <p>Loading scripts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ed-state ed-state-error">
        <div className="ed-error-icon">⚠️</div>
        <h2>Error Loading Scripts</h2>
        <p>{error}</p>
        <button className="ed-btn ed-btn-primary" onClick={loadScripts}>
          Try Again
        </button>
      </div>
    );
  }

  const currentScripts = getScriptsByType(activeType);
  const currentTypeData = SCRIPT_TYPES.find((t) => t.id === activeType);
  const Icon = currentTypeData?.icon || FiFileText;

  return (
    <div className="ed-stack">
      {/* Script Type Tabs */}
      <div className="ed-card">
        <div className="ed-tabs">
          {SCRIPT_TYPES.map((type) => {
            const TypeIcon = type.icon;
            const count = getScriptsByType(type.id).length;
            return (
              <button
                key={type.id}
                className={`ed-tab ${activeType === type.id ? 'is-active' : ''}`}
                onClick={() => setActiveType(type.id)}
              >
                <span className="ed-tab-ic">
                  <TypeIcon size={16} />
                </span>
                <span className="ed-tab-tx">
                  {type.label}
                  {count > 0 && ` (${count})`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Current Type Scripts */}
      <div className="ed-card">
        <div className="ed-cardhead">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Icon size={20} />
            <h3 className="ed-cardtitle">{currentTypeData?.label}</h3>
          </div>
          {!showNewScriptForm && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                type="button" 
                className="ed-btn ed-btn-ghost"
                onClick={() => setShowGenerator(true)}
                style={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  fontWeight: '600'
                }}
              >
                <span>🤖</span>
                <span>Generate with AI</span>
              </button>
              <button type="button" className="ed-btn ed-btn-primary" onClick={handleCreateScript}>
                <FiPlus size={16} />
                <span>New Script</span>
              </button>
              <button type="button" className="ed-btn ed-btn-ghost" onClick={handlePasteScript}>
                <FiClipboard size={16} />
                <span>Paste</span>
              </button>
            </div>
          )}
        </div>

        {showNewScriptForm ? (
          <form onSubmit={handleSaveScript} className="ed-stack">
            <div className="ed-card" style={{ background: '#f0f9ff', borderColor: '#bfdbfe' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 900 }}>
                {editingScript ? `Edit ${currentTypeData?.label} (New Version)` : `New ${currentTypeData?.label}`}
              </h4>

              <div style={{ display: 'grid', gap: '1rem' }}>
                {/* Script Content */}
                <div>
                  <label style={{ display: 'block', fontWeight: 800, marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    Script Content *
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Paste or type your script here..."
                    required
                    rows={10}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      resize: 'vertical',
                    }}
                  />
                </div>

                {/* Metadata Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 800, marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                      Version Label
                    </label>
                    <input
                      type="text"
                      value={formData.versionLabel}
                      onChange={(e) => setFormData({ ...formData, versionLabel: e.target.value })}
                      placeholder="e.g., First Draft"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 800, marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                      Author
                    </label>
                    <input
                      type="text"
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      placeholder="Writer name"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 800, marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                      }}
                    >
                      <option value="draft">Draft</option>
                      <option value="final">Final</option>
                      <option value="approved">Approved</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 800, marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                      Duration (seconds)
                    </label>
                    <input
                      type="number"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      placeholder="e.g., 1800"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 800, marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                      Scene Count
                    </label>
                    <input
                      type="number"
                      value={formData.sceneCount}
                      onChange={(e) => setFormData({ ...formData, sceneCount: e.target.value })}
                      placeholder="e.g., 15"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                      }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="submit"
                    disabled={saving}
                    className="ed-btn ed-btn-primary"
                    style={{ flex: 1 }}
                  >
                    {saving ? 'Saving...' : (editingScript ? 'Save New Version' : 'Create Script')}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    disabled={saving}
                    className="ed-btn ed-btn-ghost"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : currentScripts.length === 0 ? (
          <div className="ed-empty ed-empty-tight">
            <div className="ed-empty-ic">
              <Icon size={48} />
            </div>
            <h3>No {currentTypeData?.label} Yet</h3>
            <p>
              Create a new script by clicking the button above, or paste content from your clipboard.
            </p>
            <button className="ed-btn ed-btn-primary ed-btn-lg" onClick={handleCreateScript}>
              <FiPlus size={18} />
              <span>Create {currentTypeData?.label}</span>
            </button>
          </div>
        ) : (
          <div className="ed-stack">
            {currentScripts.map((script) => (
              <ScriptCard
                key={script.id}
                script={script}
                episodeId={episodeId}
                onEdit={handleEditScript}
                onUpdate={loadScripts}
                onDelete={loadScripts}
              />
            ))}
          </div>
        )}
      </div>

      {/* AI Generator Modal */}
      {showGenerator && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          zIndex: 1000,
          overflowY: 'auto',
          padding: '24px'
        }}>
          <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>AI Script Generator</h2>
              <button
                onClick={() => setShowGenerator(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  color: '#111827',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                ✕ Close
              </button>
            </div>

            {/* Generator Tabs */}
            <div style={{
              display: 'flex',
              gap: '0',
              borderBottom: '1px solid #e5e7eb',
              marginBottom: '24px'
            }}>
              <button
                onClick={() => setGeneratorTab('smart')}
                style={{
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: generatorTab === 'smart' ? '600' : '500',
                  color: generatorTab === 'smart' ? '#ec4899' : '#6b7280',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderBottom: generatorTab === 'smart' ? '2px solid #ec4899' : '1px solid transparent',
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                📝 Smart Script Generator
              </button>
              <button
                onClick={() => setGeneratorTab('lala')}
                style={{
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: generatorTab === 'lala' ? '600' : '500',
                  color: generatorTab === 'lala' ? '#ec4899' : '#6b7280',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderBottom: generatorTab === 'lala' ? '2px solid #ec4899' : '1px solid transparent',
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                ✨ Lala Formula Generator
              </button>
            </div>
            
            {generatorTab === 'smart' && (
              <ScriptGeneratorSmart
                episodeId={episodeId}
                showId={showId}
                onScriptGenerated={handleScriptGenerated}
              />
            )}

            {generatorTab === 'lala' && (
              <LalaScriptGenerator
                episodeId={episodeId}
                onGenerated={handleScriptGenerated}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Script Card Component
function ScriptCard({ script, episodeId, onEdit, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleSetPrimary = async () => {
    setShowActionsMenu(false);
    if (confirm(`Set "${script.version_label || `Version ${script.version_number}`}" as the primary?`)) {
      try {
        await axios.put(`/api/v1/scripts/${script.id}/primary`);
        onUpdate();
      } catch (error) {
        alert('Failed to set as primary: ' + error.message);
      }
    }
  };

  const handleDelete = async () => {
    setShowActionsMenu(false);
    if (confirm(`Delete "${script.version_label || `Version ${script.version_number}`}"? This cannot be undone.`)) {
      try {
        await axios.delete(`/api/v1/scripts/${script.id}`);
        onDelete();
      } catch (error) {
        alert('Failed to delete script: ' + error.message);
      }
    }
  };

  const handleExport = () => {
    setShowActionsMenu(false);
    const blob = new Blob([script.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.script_type}-${script.version_label || `v${script.version_number}`}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEdit = () => {
    setShowActionsMenu(false);
    onEdit(script);
  };

  return (
    <div className="ed-card script-card" style={{ padding: '1rem', position: 'relative' }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900 }}>
                {script.version_label || `Version ${script.version_number}`}
              </h4>
              {script.is_primary && (
                <span className="ed-badge ed-badge-success">Primary</span>
              )}
              {script.is_latest && (
                <span className="ed-badge ed-badge-neutral">Latest</span>
              )}
              <span className={`ed-badge ed-badge-${script.status === 'approved' ? 'success' : script.status === 'final' ? 'warning' : 'neutral'}`}>
                {script.status}
              </span>
            </div>
            <div style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {formatDate(script.created_at)}
            </div>
          </div>

          <div style={{ position: 'relative', marginLeft: '1rem' }}>
            <button
              type="button"
              className="ed-btn ed-btn-ghost"
              onClick={(e) => {
                e.stopPropagation();
                setShowActionsMenu(!showActionsMenu);
              }}
              style={{ padding: '0.5rem', minWidth: '36px' }}
              title="More actions"
            >
              ⋯
            </button>
            
            {showActionsMenu && (
              <>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowActionsMenu(false);
                  }}
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 100,
                  }}
                />
                <div
                  className="script-actions-menu"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 0.5rem)',
                    right: 0,
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    boxShadow: '0 10px 26px rgba(0,0,0,0.12)',
                    minWidth: '180px',
                    zIndex: 101,
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleEdit}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      padding: '0.875rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontWeight: 600,
                      color: '#1f2937',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      textAlign: 'left',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <FiEdit2 size={16} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleExport}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      padding: '0.875rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontWeight: 600,
                      color: '#1f2937',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      textAlign: 'left',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <FiDownload size={16} />
                    Download
                  </button>
                  {!script.is_primary && (
                    <button
                      type="button"
                      onClick={handleSetPrimary}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        padding: '0.875rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        fontWeight: 600,
                        color: '#1f2937',
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        textAlign: 'left',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <FiCheck size={16} />
                      Mark as Primary
                    </button>
                  )}
                  <div style={{ borderTop: '1px solid #e5e7eb' }}>
                    <button
                      type="button"
                      onClick={handleDelete}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        padding: '0.875rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        fontWeight: 600,
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        textAlign: 'left',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#fef2f2'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <FiTrash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
          <span>{expanded ? '⌄' : '›'}</span>
          <span>{expanded ? 'Hide details' : 'Show details'}</span>
        </div>
      </div>

      {expanded && (
        <>
          <div className="ed-infogrid" style={{ marginTop: '1rem' }}>
            {script.author && (
              <div className="ed-info">
                <div className="k">Author</div>
                <div className="v">{script.author}</div>
              </div>
            )}
            {script.duration && (
              <div className="ed-info">
                <div className="k">Duration</div>
                <div className="v">{Math.floor(script.duration / 60)}:{(script.duration % 60).toString().padStart(2, '0')}</div>
              </div>
            )}
            {script.scene_count > 0 && (
              <div className="ed-info">
                <div className="k">Scenes</div>
                <div className="v">{script.scene_count}</div>
              </div>
            )}
          </div>

          {script.content && (
            <div style={{ marginTop: '1rem' }}>
              <div className="ed-codebox" style={{ maxHeight: '300px', overflow: 'auto' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{script.content}</pre>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
