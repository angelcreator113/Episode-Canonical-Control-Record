import { useState, useEffect } from 'react';
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
import scriptsService from '../services/scriptsService';

const SCRIPT_TYPES = [
  { id: 'main', label: 'Main Script', icon: FiFileText },
  { id: 'trailer', label: 'Trailer', icon: FiFilm },
  { id: 'shorts', label: 'Shorts', icon: FiVideo },
  { id: 'teaser', label: 'Teaser', icon: FiStar },
  { id: 'behind-the-scenes', label: 'Behind-the-Scenes', icon: FiCamera },
  { id: 'bonus-content', label: 'Bonus Content', icon: FiGift },
];

export default function EpisodeScripts({ episodeId }) {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeType, setActiveType] = useState('main');
  const [showNewScriptForm, setShowNewScriptForm] = useState(false);
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
      const response = await scriptsService.getScriptsByEpisode(episodeId, {
        includeAllVersions: true,
        includeContent: true
      });
      setScripts(response.data || []);
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
    // Open form with empty content - user can paste manually with Ctrl+V
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
    
    console.log('Saving script with formData:', formData);
    
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

      console.log('Sending to API:', { episodeId, scriptData });

      if (editingScript) {
        // Update creates a new version
        await scriptsService.updateScript(editingScript.id, scriptData);
      } else {
        // Create new script
        await scriptsService.createScript(episodeId, scriptData);
      }
      
      console.log('Script saved successfully');
      
      // Reload scripts and close form
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
                onEdit={handleEditScript}
                onUpdate={loadScripts}
                onDelete={loadScripts}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Temporary inline ScriptCard component (will be extracted later)
function ScriptCard({ script, onEdit, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleSetPrimary = async () => {
    if (confirm(`Set "${script.version_label || `Version ${script.version_number}`}" as the primary ${script.script_type}?`)) {
      try {
        await scriptsService.setPrimary(script.id);
        onUpdate();
      } catch (error) {
        alert('Failed to set as primary: ' + error.message);
      }
    }
  };

  const handleDelete = async () => {
    if (confirm(`Delete "${script.version_label || `Version ${script.version_number}`}"? This cannot be undone.`)) {
      try {
        await scriptsService.deleteScript(script.id);
        onDelete();
      } catch (error) {
        alert('Failed to delete script: ' + error.message);
      }
    }
  };

  const handleExport = () => {
    // Create a text file download
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

  return (
    <div className="ed-card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900 }}>
              {script.version_label || `Version ${script.version_number}`}
            </h4>
            {script.is_primary && (
              <span className="ed-badge ed-badge-success">
                <FiStar size={12} style={{ marginRight: '4px' }} />
                Primary
              </span>
            )}
            {script.is_latest && (
              <span className="ed-badge ed-badge-neutral">Latest</span>
            )}
            <span className={`ed-badge ed-badge-${scriptsService.getStatusColor(script.status)}`}>
              {script.status}
            </span>
          </div>

          <div className="ed-infogrid" style={{ marginTop: '0.75rem' }}>
            {script.author && (
              <div className="ed-info">
                <div className="k">Author</div>
                <div className="v">{script.author}</div>
              </div>
            )}
            {script.duration && (
              <div className="ed-info">
                <div className="k">Duration</div>
                <div className="v">{scriptsService.formatDuration(script.duration)}</div>
              </div>
            )}
            {script.scene_count > 0 && (
              <div className="ed-info">
                <div className="k">Scenes</div>
                <div className="v">{script.scene_count}</div>
              </div>
            )}
            <div className="ed-info">
              <div className="k">Created</div>
              <div className="v">{formatDate(script.created_at)}</div>
            </div>
          </div>

          {expanded && script.content && (
            <div style={{ marginTop: '1rem' }}>
              <div className="ed-codebox" style={{ maxHeight: '300px', overflow: 'auto' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{script.content}</pre>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button
            type="button"
            className="ed-btn ed-btn-ghost"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? 'Collapse' : 'Expand to view content'}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
          
          <button
            type="button"
            className="ed-btn ed-btn-ghost"
            onClick={() => onEdit(script)}
            title="Edit and create new version"
          >
            <FiEdit2 size={16} />
          </button>
          
          <button
            type="button"
            className="ed-btn ed-btn-ghost"
            onClick={handleExport}
            title="Download as text file"
          >
            <FiDownload size={16} />
          </button>

          {!script.is_primary && (
            <button
              type="button"
              className="ed-btn ed-btn-ghost"
              onClick={handleSetPrimary}
              title="Set as primary version"
            >
              <FiCheck size={16} />
            </button>
          )}

          <button
            type="button"
            className="ed-btn ed-btn-ghost"
            onClick={handleDelete}
            title="Delete this version"
            style={{ color: '#ef4444' }}
          >
            <FiTrash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
