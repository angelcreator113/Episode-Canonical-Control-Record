import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Loader, CheckCircle2, Image, Layout, AlertTriangle, RefreshCw, X, Download, Upload, Eraser, RotateCcw, Eye, Edit3, Plus, Trash2 } from 'lucide-react';
import api from '../services/api';

// ── Overlay Detail Modal ────────────────────────────────────────────────────

function OverlayModal({ overlay: initialOverlay, showId, onClose, onUpdate }) {
  const [overlay, setOverlay] = useState(initialOverlay);
  const [editPrompt, setEditPrompt] = useState(initialOverlay.custom_prompt || initialOverlay.prompt || '');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const fileInputRef = useRef(null);

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 4000); };

  // Refresh this overlay's data without closing the modal
  const refreshOverlay = async () => {
    try {
      const res = await api.get(`/api/v1/ui-overlays/${showId}`);
      const all = res.data?.data || [];
      const updated = all.find(o => o.id === overlay.id);
      if (updated) setOverlay(updated);
    } catch { /* silent */ }
  };

  const handleDeleteCustom = async () => {
    if (!overlay.custom || !overlay.custom_id) return;
    if (!confirm(`Delete custom overlay "${overlay.name}"? This cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/v1/ui-overlays/${showId}/types/${overlay.custom_id}`);
      onUpdate();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setIsDeleting(false);
  };

  const handleRegenerate = async (prompt) => {
    setIsRegenerating(true);
    setError(null);
    try {
      const body = prompt ? { prompt } : {};
      await api.post(`/api/v1/ui-overlays/${showId}/generate/${overlay.id}`, body);
      showSuccess('Generated! Preview updated.');
      await refreshOverlay();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setIsRegenerating(false);
  };

  const handleRemoveBg = async () => {
    if (!overlay.asset_id) return;
    setIsRemovingBg(true);
    setError(null);
    try {
      await api.post(`/api/v1/ui-overlays/${showId}/remove-bg/${overlay.asset_id}`);
      showSuccess('Background removed!');
      await refreshOverlay();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setIsRemovingBg(false);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      await api.post(`/api/v1/ui-overlays/${showId}/upload/${overlay.id}`, formData);
      showSuccess('Image uploaded!');
      await refreshOverlay();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = () => {
    if (!overlay.url) return;
    const link = document.createElement('a');
    link.href = overlay.url;
    link.download = `${overlay.id}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const busy = isRegenerating || isRemovingBg || isUploading || isDeleting;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 16, maxWidth: 560, width: '100%',
        maxHeight: '90vh', overflow: 'auto', position: 'relative',
      }} onClick={e => e.stopPropagation()}>
        {/* Close button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 12, right: 12, zIndex: 2,
          border: 'none', background: 'rgba(255,255,255,0.9)', borderRadius: '50%',
          width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        }}>
          <X size={16} />
        </button>

        {/* Success/Error banners */}
        {successMsg && (
          <div style={{ position: 'absolute', top: 12, left: 12, right: 52, zIndex: 3, background: '#e8f5e9', color: '#2e7d32', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600 }}>{successMsg}</div>
        )}
        {error && (
          <div style={{ position: 'absolute', top: 12, left: 12, right: 52, zIndex: 3, background: '#ffebee', color: '#c62828', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600 }}>{error}</div>
        )}

        {/* Preview */}
        <div style={{
          background: '#f5f3ee', display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 280, borderRadius: '16px 16px 0 0', position: 'relative',
          backgroundImage: overlay.generated && overlay.url ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'20\' height=\'20\'%3E%3Crect width=\'10\' height=\'10\' fill=\'%23eee\'/%3E%3Crect x=\'10\' y=\'10\' width=\'10\' height=\'10\' fill=\'%23eee\'/%3E%3C/svg%3E")' : 'none',
        }}>
          {overlay.generated && overlay.url ? (
            <img src={overlay.url} alt={overlay.name} style={{
              maxWidth: '100%', maxHeight: 400, objectFit: 'contain', padding: 16,
            }} />
          ) : (
            <div style={{ textAlign: 'center', color: '#ccc', padding: 40 }}>
              <Sparkles size={48} />
              <div style={{ fontSize: 13, marginTop: 8, fontFamily: "'DM Mono', monospace" }}>Not generated yet</div>
            </div>
          )}
          {/* Category + BG status badges */}
          <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 4 }}>
            <span style={{
              padding: '3px 8px', borderRadius: 4, fontSize: 9,
              fontFamily: "'DM Mono', monospace", textTransform: 'uppercase',
              background: overlay.category === 'frame' ? '#dbeafe' : '#fef3c7',
              color: overlay.category === 'frame' ? '#1e40af' : '#92400e',
            }}>{overlay.category}</span>
            {overlay.bg_removed && (
              <span style={{
                padding: '3px 8px', borderRadius: 4, fontSize: 9,
                fontFamily: "'DM Mono', monospace", background: '#dcfce7', color: '#166534',
              }}>BG removed</span>
            )}
          </div>
        </div>

        {/* Info + Actions */}
        <div style={{ padding: '16px 20px 20px' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>{overlay.name}</h3>
          <div style={{ fontSize: 11, color: '#aaa', fontFamily: "'DM Mono', monospace", margin: '4px 0 6px' }}>{overlay.beat}</div>
          <p style={{ fontSize: 12, color: '#666', lineHeight: 1.4, margin: '0 0 16px' }}>{overlay.description}</p>

          {/* Error banner */}
          {error && (
            <div style={{
              padding: '8px 12px', borderRadius: 6, marginBottom: 12,
              background: '#fef2f2', border: '1px solid #fecaca', fontSize: 11,
              color: '#991b1b', fontFamily: "'DM Mono', monospace",
            }}>
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {overlay.generated ? (
              <>
                <ActionBtn icon={RotateCcw} label="Regenerate" loading={isRegenerating} disabled={busy}
                  onClick={() => handleRegenerate(null)} color="#B8962E" />
                <ActionBtn icon={Eraser} label={overlay.bg_removed ? 'BG Already Removed' : 'Remove Background'}
                  loading={isRemovingBg} disabled={busy || overlay.bg_removed}
                  onClick={handleRemoveBg} color="#6366f1" />
                <ActionBtn icon={Download} label="Download" disabled={busy}
                  onClick={handleDownload} color="#2C2C2C" />
                <ActionBtn icon={Upload} label="Replace (Upload)" loading={isUploading} disabled={busy}
                  onClick={() => fileInputRef.current?.click()} color="#2C2C2C" />
              </>
            ) : (
              <>
                <ActionBtn icon={Sparkles} label="Generate" loading={isRegenerating} disabled={busy}
                  onClick={() => handleRegenerate(null)} color="#B8962E" />
                <ActionBtn icon={Upload} label="Upload Custom" loading={isUploading} disabled={busy}
                  onClick={() => fileInputRef.current?.click()} color="#2C2C2C" />
              </>
            )}
            {overlay.custom && (
              <ActionBtn icon={Trash2} label="Delete Overlay Type" loading={isDeleting} disabled={busy}
                onClick={handleDeleteCustom} color="#dc2626" />
            )}
          </div>

          {/* Edit prompt section */}
          <div style={{ borderTop: '1px solid #f0ece4', paddingTop: 12 }}>
            <button onClick={() => setShowPromptEditor(!showPromptEditor)} style={{
              border: 'none', background: 'none', cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 600, color: '#888',
            }}>
              <Edit3 size={14} /> {showPromptEditor ? 'Hide prompt editor' : 'Edit prompt & regenerate'}
            </button>

            {showPromptEditor && (
              <div style={{ marginTop: 10 }}>
                <textarea
                  value={editPrompt}
                  onChange={e => setEditPrompt(e.target.value)}
                  rows={5}
                  style={{
                    width: '100%', padding: '10px 12px', border: '1px solid #e0d9cc',
                    borderRadius: 8, fontSize: 12, fontFamily: "'DM Mono', monospace",
                    resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box',
                    color: '#2C2C2C', background: '#faf9f6',
                  }}
                  placeholder="Edit the generation prompt..."
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditPrompt(overlay.prompt)} style={{
                    padding: '6px 14px', border: '1px solid #e0d9cc', borderRadius: 6,
                    background: '#fff', fontSize: 11, cursor: 'pointer', color: '#666',
                  }}>
                    Reset to default
                  </button>
                  <button
                    onClick={() => handleRegenerate(editPrompt)}
                    disabled={busy || !editPrompt.trim()}
                    style={{
                      padding: '6px 14px', border: 'none', borderRadius: 6,
                      background: '#B8962E', color: '#fff', fontSize: 11,
                      fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer',
                      opacity: busy ? 0.5 : 1,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    {isRegenerating ? <Loader size={12} className="spin" /> : <Sparkles size={12} />}
                    Generate with this prompt
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hidden file input for upload */}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload}
          style={{ display: 'none' }} />
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, disabled, loading, color }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '7px 14px', border: `1px solid ${color}20`, borderRadius: 8,
      background: `${color}10`, color, fontSize: 11, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
      transition: 'opacity 0.15s',
    }}>
      {loading ? <Loader size={13} className="spin" /> : <Icon size={13} />} {label}
    </button>
  );
}

// ── Create New Overlay Modal ────────────────────────────────────────────────

function CreateOverlayModal({ showId, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', category: 'icon', beat: '', description: '', prompt: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.prompt.trim()) {
      setError('Name and prompt are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/v1/ui-overlays/${showId}/types`, form);
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setSaving(false);
  };

  const fieldStyle = {
    width: '100%', padding: '8px 12px', border: '1px solid #e0d9cc',
    borderRadius: 8, fontSize: 12, fontFamily: "'DM Mono', monospace",
    boxSizing: 'border-box', background: '#faf9f6', color: '#2C2C2C',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 16, maxWidth: 480, width: '100%',
        maxHeight: '90vh', overflow: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0ece4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#2C2C2C' }}>New UI Overlay Type</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color="#999" />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '16px 24px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Shopping Cart Icon" style={fieldStyle} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  style={{ ...fieldStyle, cursor: 'pointer' }}>
                  <option value="icon">Icon</option>
                  <option value="frame">Frame</option>
                  <option value="phone">Phone Screen</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Beat</label>
                <input value={form.beat} onChange={e => setForm(f => ({ ...f, beat: e.target.value }))}
                  placeholder="e.g., Beat 5" style={fieldStyle} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of this overlay" style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Generation Prompt *</label>
              <textarea value={form.prompt} onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
                rows={4} placeholder="Describe the image to generate... (the luxury style prefix is added automatically)"
                style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.5 }} />
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: 12, padding: '8px 12px', borderRadius: 6,
              background: '#fef2f2', border: '1px solid #fecaca', fontSize: 11,
              color: '#991b1b', fontFamily: "'DM Mono', monospace",
            }}>{error}</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" onClick={onClose} style={{
              padding: '8px 16px', border: '1px solid #e0d9cc', borderRadius: 8,
              background: '#fff', fontSize: 12, cursor: 'pointer', color: '#666',
            }}>Cancel</button>
            <button type="submit" disabled={saving} style={{
              padding: '8px 20px', border: 'none', borderRadius: 8,
              background: '#B8962E', color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              {saving ? <Loader size={12} className="spin" /> : <Plus size={12} />}
              Create Overlay Type
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Tab Component ──────────────────────────────────────────────────────

export default function UIOverlaysTab() {
  const [overlays, setOverlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);
  const [showId, setShowId] = useState(null);
  const [shows, setShows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [genProgress, setGenProgress] = useState(null);
  const [selectedOverlay, setSelectedOverlay] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const pollRef = useRef(null);

  // Load shows
  useEffect(() => {
    api.get('/api/v1/shows').then(r => {
      const list = r.data?.data || [];
      setShows(list);
      if (list.length > 0) setShowId(list[0].id);
    }).catch(() => {});
  }, []);

  // Load overlays
  const loadOverlays = useCallback((showLoader) => {
    if (!showId) return;
    if (showLoader) setLoading(true);
    api.get(`/api/v1/ui-overlays/${showId}`)
      .then(r => {
        setOverlays(r.data?.data || []);
        if (r.data?.generation_status) {
          setGenProgress(r.data.generation_status);
        }
      })
      .catch(() => setOverlays([]))
      .finally(() => setLoading(false));
  }, [showId]);

  useEffect(() => { loadOverlays(true); }, [loadOverlays]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleGenerateAll = async () => {
    if (!showId) return;
    setGenerating(true);
    setGenProgress(null);
    try {
      const postRes = await api.post(`/api/v1/ui-overlays/${showId}/generate-all`);
      if (postRes.data?.error) {
        setGenProgress({ status: 'failed', errors: [postRes.data.error] });
        setGenerating(false);
        return;
      }
      pollRef.current = setInterval(() => {
        api.get(`/api/v1/ui-overlays/${showId}`)
          .then(r => {
            const data = r.data?.data || [];
            setOverlays(data);
            const genStatus = r.data?.generation_status;
            if (genStatus) setGenProgress(genStatus);
            const done = data.filter(o => o.generated).length;
            if (done >= data.length || genStatus?.status === 'done' || genStatus?.status === 'failed') {
              clearInterval(pollRef.current);
              pollRef.current = null;
              setGenerating(false);
            }
          })
          .catch(() => {});
      }, 5000);
      setTimeout(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setGenerating(false);
      }, 300000);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message;
      setGenProgress({ status: 'failed', errors: [errMsg] });
      setGenerating(false);
    }
  };

  const handleGenerateOne = async (overlayId, e) => {
    e?.stopPropagation();
    if (!showId) return;
    setGeneratingId(overlayId);
    try {
      await api.post(`/api/v1/ui-overlays/${showId}/generate/${overlayId}`);
      loadOverlays();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.error || err.message));
    }
    setGeneratingId(null);
  };

  const filtered = filter === 'all' ? overlays : overlays.filter(o => o.category === filter);
  const generatedCount = overlays.filter(o => o.generated).length;

  return (
    <div style={{ padding: '20px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#2C2C2C' }}>UI Overlays</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888', fontFamily: "'DM Mono', monospace" }}>
            {generatedCount}/{overlays.length} generated — show-level assets for episode production
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {shows.length > 1 && (
            <select value={showId || ''} onChange={e => setShowId(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #e0d9cc', borderRadius: 6, fontSize: 12 }}>
              {shows.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button
            onClick={handleGenerateAll}
            disabled={generating || !showId}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', border: 'none', borderRadius: 8,
              background: '#B8962E', color: '#fff', fontSize: 12,
              fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer',
              opacity: generating ? 0.6 : 1,
            }}
          >
            {generating ? <><Loader size={14} className="spin" /> Generating all...</> : <><Sparkles size={14} /> Generate All ({overlays.length - generatedCount} missing)</>}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!showId}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '8px 14px', border: '1px solid #e0d9cc', borderRadius: 8,
              background: '#fff', color: '#2C2C2C', fontSize: 12,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={14} /> New Overlay
          </button>
        </div>
      </div>

      {/* Generation Progress / Error Banner */}
      {genProgress && (genProgress.status === 'generating' || genProgress.status === 'failed' || genProgress.status === 'done') && (
        <div style={{
          marginBottom: 12, padding: '10px 14px', borderRadius: 8,
          background: genProgress.status === 'failed' ? '#fef2f2' : genProgress.status === 'done' ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${genProgress.status === 'failed' ? '#fecaca' : genProgress.status === 'done' ? '#bbf7d0' : '#fde68a'}`,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          {genProgress.status === 'failed' ? (
            <AlertTriangle size={16} style={{ color: '#dc2626', marginTop: 1, flexShrink: 0 }} />
          ) : genProgress.status === 'done' ? (
            <CheckCircle2 size={16} style={{ color: '#16a34a', marginTop: 1, flexShrink: 0 }} />
          ) : (
            <Loader size={16} className="spin" style={{ color: '#d97706', marginTop: 1, flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, fontSize: 12 }}>
            {genProgress.status === 'generating' && (
              <span style={{ color: '#92400e' }}>
                Generating: {genProgress.completed || 0} completed, {genProgress.failed || 0} failed of {genProgress.total || '...'} total
              </span>
            )}
            {genProgress.status === 'done' && (
              <span style={{ color: '#166534' }}>
                Generation complete: {genProgress.completed || 0} generated{genProgress.failed > 0 ? `, ${genProgress.failed} failed` : ''}
              </span>
            )}
            {genProgress.status === 'failed' && (
              <span style={{ color: '#991b1b' }}>
                Generation failed{genProgress.completed > 0 ? ` (${genProgress.completed} succeeded)` : ''}
              </span>
            )}
            {genProgress.errors?.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 11, color: '#666', fontFamily: "'DM Mono', monospace" }}>
                {genProgress.errors.slice(-3).map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
          </div>
          {(genProgress.status === 'done' || genProgress.status === 'failed') && (
            <button onClick={() => { setGenProgress(null); loadOverlays(); }} style={{
              border: 'none', background: 'none', cursor: 'pointer', padding: 4,
              color: '#666', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
            }}>
              <RefreshCw size={12} /> Refresh
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[
          { key: 'all', label: 'All', icon: null },
          { key: 'frame', label: 'Frames', icon: Layout },
          { key: 'icon', label: 'Icons', icon: Image },
          { key: 'phone', label: 'Phone Screens', icon: Sparkles },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '5px 14px', border: '1px solid #e0d9cc', borderRadius: 20,
            background: filter === f.key ? '#2C2C2C' : '#fff',
            color: filter === f.key ? '#fff' : '#666',
            fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {f.icon && <f.icon size={12} />} {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {filtered.map(overlay => (
            <div key={overlay.id}
              onClick={() => setSelectedOverlay(overlay)}
              style={{
                background: '#fff', border: '1px solid #e8e0d0', borderRadius: 12,
                overflow: 'hidden', transition: 'box-shadow 0.2s, transform 0.15s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
            >
              {/* Image */}
              <div style={{
                aspectRatio: '1', background: overlay.generated ? '#faf9f6' : '#f5f3ee',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', position: 'relative',
              }}>
                {overlay.generated && overlay.url ? (
                  <img src={overlay.url} alt={overlay.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
                ) : (
                  <div style={{ textAlign: 'center', color: '#ccc' }}>
                    <Sparkles size={24} />
                    <div style={{ fontSize: 9, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>Not generated</div>
                  </div>
                )}
                {overlay.generated && (
                  <div style={{ position: 'absolute', top: 6, right: 6 }}>
                    <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
                  </div>
                )}
                <div style={{ position: 'absolute', top: 6, left: 6, display: 'flex', gap: 3 }}>
                  <span style={{
                    padding: '2px 6px', borderRadius: 4, fontSize: 8,
                    fontFamily: "'DM Mono', monospace", textTransform: 'uppercase',
                    background: overlay.category === 'frame' ? '#dbeafe' : overlay.category === 'phone' ? '#fce8f0' : '#fef3c7',
                    color: overlay.category === 'frame' ? '#1e40af' : overlay.category === 'phone' ? '#9c3d62' : '#92400e',
                  }}>{overlay.category}</span>
                  {overlay.custom && <span style={{
                    padding: '2px 6px', borderRadius: 4, fontSize: 8,
                    fontFamily: "'DM Mono', monospace", background: '#f3e8ff', color: '#7c3aed',
                  }}>CUSTOM</span>}
                  {overlay.lifecycle && overlay.lifecycle !== 'permanent' && (
                    <span style={{
                      padding: '2px 6px', borderRadius: 4, fontSize: 8,
                      fontFamily: "'DM Mono', monospace",
                      background: overlay.lifecycle === 'per_episode' ? '#fef3c7' : '#e0f2fe',
                      color: overlay.lifecycle === 'per_episode' ? '#92400e' : '#0369a1',
                    }}>
                      {overlay.lifecycle === 'per_episode' ? 'PER EPISODE' : 'VARIANT'}
                    </span>
                  )}
                </div>
                {/* Hover overlay with action hint */}
                {overlay.generated && (
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0, transition: 'opacity 0.2s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                  >
                    <Eye size={24} style={{ color: '#fff' }} />
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#2C2C2C', marginBottom: 2 }}>{overlay.name}</div>
                <div style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>{overlay.beat}</div>
                <div style={{ fontSize: 10, color: '#888', lineHeight: 1.3, marginBottom: 6,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{overlay.description}</div>

                {!overlay.generated && (
                  <button
                    onClick={(e) => handleGenerateOne(overlay.id, e)}
                    disabled={generatingId === overlay.id}
                    style={{
                      width: '100%', padding: '6px 0',
                      border: 'none', borderRadius: 6,
                      background: '#B8962E', color: '#fff',
                      fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      opacity: generatingId === overlay.id ? 0.5 : 1,
                    }}
                  >
                    {generatingId === overlay.id ? 'Generating...' : 'Generate'}
                  </button>
                )}

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!confirm(`Delete overlay "${overlay.name}"?`)) return;
                    (async () => {
                      try {
                        if (overlay.custom && overlay.custom_id) {
                          await api.delete(`/api/v1/ui-overlays/${showId}/types/${overlay.custom_id}`);
                        } else if (overlay.asset_id) {
                          await api.delete(`/api/v1/assets/${overlay.asset_id}`);
                        } else if (overlay.id) {
                          await api.delete(`/api/v1/ui-overlays/${showId}/types/${overlay.id}`).catch(() => {});
                        }
                        loadOverlays(false);
                      } catch (err) {
                        console.warn('[overlay] delete failed:', err?.message);
                        alert('Delete failed: ' + (err?.response?.data?.error || err?.message));
                      }
                    })();
                  }}
                  style={{
                    width: '100%', padding: '4px 0', border: 'none', borderRadius: 4,
                    background: 'transparent', color: '#dc2626', fontSize: 10,
                    cursor: 'pointer', fontWeight: 500, marginTop: 4,
                    opacity: 0.5, transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>
          <Sparkles size={32} />
          <p style={{ fontSize: 13, marginTop: 8 }}>No overlays yet. Select a show and generate.</p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedOverlay && (
        <OverlayModal
          overlay={selectedOverlay}
          showId={showId}
          onClose={() => { setSelectedOverlay(null); loadOverlays(); }}
          onUpdate={loadOverlays}
        />
      )}

      {/* Create Overlay Type Modal */}
      {showCreateModal && (
        <CreateOverlayModal
          showId={showId}
          onClose={() => setShowCreateModal(false)}
          onCreated={loadOverlays}
        />
      )}
    </div>
  );
}
