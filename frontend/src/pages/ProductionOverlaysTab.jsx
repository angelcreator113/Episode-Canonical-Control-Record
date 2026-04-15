/**
 * ProductionOverlaysTab — UI Overlays for Video Production
 *
 * Manages production overlay images (show titles, exit buttons, lower thirds, etc.)
 * that are used during the video editing process. User-defined types at 16:9 landscape.
 *
 * Reuses the same backend API as Phone Hub (/api/v1/ui-overlays/) with category='production'.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Loader, Upload, Trash2, Download, X, Plus, Info, Image } from 'lucide-react';
import api from '../services/api';
import './ProductionOverlaysTab.css';

export default function ProductionOverlaysTab({ showId: propShowId }) {
  const [showId, setShowId] = useState(propShowId || null);
  const [shows, setShows] = useState([]);
  const [overlays, setOverlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [generating, setGenerating] = useState(null);
  const [toast, setToast] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const fileInputRef = useRef(null);

  const flash = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Load shows if no propShowId
  useEffect(() => {
    if (propShowId) { setShowId(propShowId); return; }
    api.get('/api/v1/shows').then(r => {
      const s = r.data?.data || [];
      setShows(s);
      if (s.length > 0 && !showId) setShowId(s[0].id);
    }).catch(() => {});
  }, [propShowId]);

  // Load overlays — filter to production category only
  const loadOverlays = useCallback((showLoader) => {
    if (!showId) return;
    if (showLoader) setLoading(true);
    api.get(`/api/v1/ui-overlays/${showId}`)
      .then(r => {
        const data = (r.data?.data || []).filter(o => o.category === 'production');
        setOverlays(data);
      })
      .catch(() => setOverlays([]))
      .finally(() => setLoading(false));
  }, [showId]);

  useEffect(() => { loadOverlays(true); }, [loadOverlays]);

  // Generate one
  const handleGenerate = async (overlay) => {
    if (!showId || generating) return;
    setGenerating(overlay.id);
    try {
      await api.post(`/api/v1/ui-overlays/${showId}/generate/${overlay.id}`);
      flash('Generated!');
      loadOverlays(false);
    } catch (err) {
      flash(err.response?.data?.error || err.message, 'error');
    }
    setGenerating(null);
  };

  // Upload image
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selected?.id) return;
    try {
      const fd = new FormData();
      fd.append('image', file);
      await api.post(`/api/v1/ui-overlays/${showId}/upload/${selected.id}`, fd);
      flash('Uploaded!');
      loadOverlays(false);
    } catch (err) {
      flash(err.response?.data?.error || err.message, 'error');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Delete
  const handleDelete = async (overlay) => {
    if (!confirm(`Delete "${overlay.name}"?`)) return;
    try {
      if (overlay.custom && overlay.custom_id) {
        await api.delete(`/api/v1/ui-overlays/${showId}/types/${overlay.custom_id}`);
      }
      if (overlay.asset_id) {
        await api.delete(`/api/v1/ui-overlays/${showId}/asset/${overlay.asset_id}`);
      }
      setOverlays(prev => prev.filter(o => o.id !== overlay.id));
      if (selected?.id === overlay.id) setSelected(null);
      flash('Deleted');
    } catch (err) {
      flash(err.response?.data?.error || err.message, 'error');
    }
  };

  // Download
  const handleDownload = async (overlay) => {
    if (!overlay?.url) return;
    try {
      const resp = await fetch(overlay.url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${overlay.id || 'overlay'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(overlay.url, '_blank');
    }
  };

  // Create overlay type
  const handleCreate = async (form) => {
    try {
      const res = await api.post(`/api/v1/ui-overlays/${showId}/types`, {
        ...form,
        category: 'production',
      });
      const newType = res.data?.data;
      if (newType) {
        setOverlays(prev => [...prev, {
          id: newType.type_key, name: newType.name, category: 'production',
          beat: newType.beat, description: newType.description, prompt: newType.prompt,
          custom: true, custom_id: newType.id, generated: false, url: null,
        }]);
      } else {
        loadOverlays(false);
      }
      setShowCreateModal(false);
      flash('Overlay type created');
    } catch (err) {
      flash(err.response?.data?.error || err.message, 'error');
    }
  };

  const generatedCount = overlays.filter(o => o.generated).length;

  return (
    <div className="prod-overlays" style={{ padding: '20px 0' }}>
      {/* Toast */}
      {toast && (
        <div className={`prod-overlays-toast prod-overlays-toast--${toast.type === 'error' ? 'error' : 'success'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="prod-overlays-header">
        <div className="prod-overlays-header-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#2C2C2C', fontFamily: "'Lora', serif" }}>
                UI Overlays
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>
                {generatedCount}/{overlays.length} overlays ready
              </p>
            </div>
            {!propShowId && shows.length > 0 && (
              <select
                value={showId || ''}
                onChange={(e) => setShowId(e.target.value)}
                className="prod-overlays-select"
              >
                <option value="" disabled>Select show...</option>
                {shows.map(s => (
                  <option key={s.id} value={s.id}>{s.name || s.title}</option>
                ))}
              </select>
            )}
          </div>
          <div className="prod-overlays-header-actions">
            <button onClick={() => setShowSizeGuide(!showSizeGuide)} title="Upload size guide" className="prod-overlays-btn" style={{ color: '#aaa', border: '1px solid #eee' }}>
              <Info size={13} />
            </button>
            <button onClick={() => setShowCreateModal(true)} disabled={!showId} className="prod-overlays-btn" style={{ background: '#2C2C2C', color: '#fff', border: 'none' }}>
              <Plus size={13} /> New Overlay
            </button>
          </div>
        </div>

        {showSizeGuide && (
          <div className="prod-overlays-size-guide">
            <div style={{ fontSize: 10, fontWeight: 700, color: '#888', marginBottom: 6, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Recommended Upload Sizes
            </div>
            <div className="prod-overlays-size-guide-grid">
              <span style={{ color: '#999' }}>Standard (HD):</span><span><strong>1920 x 1080</strong> px (16:9)</span>
              <span style={{ color: '#999' }}>High-res (4K):</span><span><strong>3840 x 2160</strong> px (16:9)</span>
              <span style={{ color: '#999' }}>Square icons:</span><span><strong>512 x 512</strong> px (1:1)</span>
            </div>
            <div style={{ marginTop: 6, color: '#aaa', fontSize: 9 }}>PNG with transparency recommended. JPG for opaque overlays.</div>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="prod-overlays-loading">
          <Loader size={24} className="spin" />
          <p>Loading overlays...</p>
        </div>
      ) : overlays.length === 0 ? (
        <div className="prod-overlays-empty">
          <Image size={40} strokeWidth={1} color="#ccc" />
          <p style={{ fontSize: 15, fontWeight: 600, color: '#888', margin: '12px 0 4px' }}>No overlays yet</p>
          <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 16px' }}>
            Create overlay types for your show — titles, exit buttons, lower thirds, and more.
          </p>
          <button onClick={() => setShowCreateModal(true)} disabled={!showId} className="prod-overlays-btn" style={{ background: '#B8962E', color: '#fff', border: 'none', padding: '10px 20px', fontSize: 13 }}>
            <Plus size={14} /> Create First Overlay
          </button>
        </div>
      ) : (
        <div className="prod-overlays-grid">
          {overlays.map(overlay => (
            <div
              key={overlay.id}
              className={`prod-overlay-card${selected?.id === overlay.id ? ' selected' : ''}`}
              onClick={() => setSelected(overlay)}
            >
              {/* Thumbnail */}
              <div className="prod-overlay-card-thumb">
                {overlay.url ? (
                  <img src={overlay.url} alt={overlay.name} />
                ) : (
                  <div className="prod-overlay-card-placeholder">
                    <Image size={24} strokeWidth={1} color="#ccc" />
                  </div>
                )}
                {/* Status badge */}
                <div className={`prod-overlay-card-badge ${overlay.generated ? 'ready' : 'empty'}`}>
                  {overlay.generated ? 'Ready' : 'Empty'}
                </div>
              </div>

              {/* Info */}
              <div className="prod-overlay-card-info">
                <div className="prod-overlay-card-name">{overlay.name}</div>
                {overlay.description && (
                  <div className="prod-overlay-card-desc">{overlay.description.slice(0, 50)}</div>
                )}
              </div>

              {/* Actions */}
              <div className="prod-overlay-card-actions" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => handleGenerate(overlay)}
                  disabled={generating === overlay.id}
                  title="Generate with AI"
                  className="prod-overlay-action"
                  style={{ color: '#B8962E' }}
                >
                  {generating === overlay.id ? <Loader size={14} className="spin" /> : <Sparkles size={14} />}
                </button>
                <button
                  onClick={() => { setSelected(overlay); fileInputRef.current?.click(); }}
                  title="Upload image"
                  className="prod-overlay-action"
                  style={{ color: '#7ab3d4' }}
                >
                  <Upload size={14} />
                </button>
                {overlay.url && (
                  <button
                    onClick={() => handleDownload(overlay)}
                    title="Download"
                    className="prod-overlay-action"
                    style={{ color: '#6bba9a' }}
                  >
                    <Download size={14} />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(overlay)}
                  title="Delete"
                  className="prod-overlay-action"
                  style={{ color: '#dc2626' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />

      {/* Create Modal */}
      {showCreateModal && (
        <CreateOverlayModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

function CreateOverlayModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', description: '', prompt: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.prompt.trim()) return;
    setSaving(true);
    await onCreate(form);
    setSaving(false);
  };

  return (
    <div className="prod-overlays-modal-backdrop" onClick={onClose}>
      <div className="prod-overlays-modal" onClick={e => e.stopPropagation()}>
        <div className="prod-overlays-modal-header">
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: "'Lora', serif" }}>New UI Overlay</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 8, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="prod-overlays-modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="prod-overlays-label">Overlay Name</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Show Title Card, Exit Button, Lower Third"
                className="prod-overlays-field"
              />
            </div>
            <div>
              <label className="prod-overlays-label">Description</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What this overlay is used for"
                className="prod-overlays-field"
              />
            </div>
            <div>
              <label className="prod-overlays-label">Generation Prompt</label>
              <textarea
                value={form.prompt}
                onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
                rows={3}
                placeholder="Describe the overlay for AI generation..."
                className="prod-overlays-field"
                style={{ resize: 'vertical' }}
              />
            </div>
            <button
              type="submit"
              disabled={saving || !form.name.trim() || !form.prompt.trim()}
              className="prod-overlays-submit"
            >
              {saving ? 'Creating...' : 'Create Overlay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
