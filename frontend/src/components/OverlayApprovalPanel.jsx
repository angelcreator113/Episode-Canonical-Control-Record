import { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * OverlayApprovalPanel — Reusable generate → preview → edit → approve/reject workflow
 *
 * Used for wardrobe shopping lists and social task overlays in the event panel.
 * Follows the same pattern as InvitationButton but for task-based PNG overlays.
 *
 * Props:
 *   event     — The world event object
 *   showId    — Current show UUID
 *   overlayType — 'wardrobe' | 'social'
 *   onGenerated — Callback(imageUrl, assetId, tasks) after approve
 *   existingUrl — Existing overlay image URL (from event automation data)
 *   existingAssetId — Existing approved asset ID
 *   existingTasks — Existing tasks array (for display)
 */
export default function OverlayApprovalPanel({ event, showId, overlayType, onGenerated, existingUrl, existingAssetId, existingTasks }) {
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [imageUrl, setImageUrl] = useState(existingUrl || null);
  const [pendingAssetId, setPendingAssetId] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState(null);
  const [modalTab, setModalTab] = useState('preview');
  const [editTasks, setEditTasks] = useState([]);
  const [rerendering, setRerendering] = useState(false);
  const [toast, setToast] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [tasks, setTasks] = useState(existingTasks || []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (existingUrl && !pendingAssetId) setImageUrl(existingUrl);
  }, [existingUrl]);

  useEffect(() => {
    if (existingTasks?.length > 0) {
      setTasks(existingTasks);
      setEditTasks(existingTasks.map(t => ({ ...t })));
    }
  }, [existingTasks]);

  const isWardrobe = overlayType === 'wardrobe';
  const title = isWardrobe ? 'Wardrobe Shopping List' : 'Social Tasks';
  const accentColor = isWardrobe ? '#B8962E' : '#6366f1';
  const displayUrl = imageUrl || existingUrl;
  const hasOverlay = !!existingAssetId || !!displayUrl;
  const isPending = !!pendingAssetId;

  // ─── Generate ──────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${event.id}/generate-overlay/${overlayType}`);
      const data = res.data.data;
      setImageUrl(data.imageUrl);
      setPendingAssetId(data.assetId);
      setTasks(data.tasks || []);
      setEditTasks((data.tasks || []).map(t => ({ ...t })));
      setModalTab('preview');
      setShowPreview(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  // ─── Approve ───────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!pendingAssetId) return;
    setApproving(true);
    try {
      await api.post(`/api/v1/world/${showId}/events/${event.id}/approve-overlay`, { assetId: pendingAssetId });
      const approvedId = pendingAssetId;
      setPendingAssetId(null);
      setShowPreview(false);
      if (onGenerated) onGenerated(imageUrl, approvedId, tasks);
      showToast(`${title} approved`);
    } catch (err) {
      setError(err.response?.data?.error || 'Approval failed');
    } finally {
      setApproving(false);
    }
  };

  // ─── Reject ────────────────────────────────────────────────────────
  const handleReject = async () => {
    if (!pendingAssetId) return;
    try {
      await api.post(`/api/v1/world/${showId}/events/${event.id}/reject-overlay`, { assetId: pendingAssetId });
    } catch { /* non-blocking */ }
    setPendingAssetId(null);
    setImageUrl(existingUrl || null);
    setTasks(existingTasks || []);
    setShowPreview(false);
  };

  // ─── Re-render with edited tasks ──────────────────────────────────
  const handleRerender = async () => {
    setRerendering(true);
    setError(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${event.id}/re-render-overlay`, {
        tasks: editTasks,
        overlayType,
      });
      setImageUrl(res.data.imageUrl);
      const updatedTasks = editTasks.map(t => ({ ...t }));
      setTasks(updatedTasks);
      setEditTasks(updatedTasks.map(t => ({ ...t })));
      setModalTab('preview');
      showToast('Overlay re-rendered with your edits');
    } catch (err) {
      setError(err.response?.data?.error || 'Re-render failed');
    } finally {
      setRerendering(false);
    }
  };

  // ─── Load tasks for editing ────────────────────────────────────────
  const loadTasks = async () => {
    try {
      const res = await api.get(`/api/v1/world/${showId}/events/${event.id}/overlay-tasks/${overlayType}`);
      if (res.data.tasks) {
        setEditTasks(res.data.tasks.map(t => ({ ...t })));
      } else if (tasks.length > 0) {
        setEditTasks(tasks.map(t => ({ ...t })));
      }
    } catch {
      if (tasks.length > 0) setEditTasks(tasks.map(t => ({ ...t })));
    }
  };

  // ─── Version history ───────────────────────────────────────────────
  const fetchVersions = async () => {
    setLoadingVersions(true);
    try {
      const res = await api.get(`/api/v1/world/${showId}/events/${event.id}/overlay-history/${overlayType}`);
      setVersions(res.data?.data || []);
    } catch {
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  // ─── Update a single task field ────────────────────────────────────
  const updateTaskField = (index, field, value) => {
    setEditTasks(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  // ─── Styles ────────────────────────────────────────────────────────
  const btn = (bg, color, border) => ({
    borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: border || 'none', background: bg, color,
  });
  const accentBtn = btn(accentColor, '#FFF');
  const outlineBtn = btn('#FAF7F0', accentColor, `1px solid ${accentColor}`);
  const greenBtn = btn('#16a34a', '#FFF');
  const redBtn = btn('#FFF', '#DC2626', '1px solid #FECACA');
  const grayBtn = btn('#F5F5F5', '#666', '1px solid #EEE');

  // ─── Timing phase colors (social tasks) ────────────────────────────
  const TIMING_COLORS = { before: '#f59e0b', during: '#6366f1', after: '#16a34a' };
  const TIMING_LABELS = { before: 'Before', during: 'During', after: 'After' };

  return (
    <div style={{ position: 'relative' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 10000,
          background: toast.type === 'error' ? '#FFEBEE' : '#E8F5E9',
          color: toast.type === 'error' ? '#C62828' : '#1A7A40',
          border: `1px solid ${toast.type === 'error' ? '#FFCDD2' : '#A5D6A7'}`,
          borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* ═══ Full-screen Preview Modal ═══ */}
      {showPreview && displayUrl && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 20,
        }} onClick={() => setShowPreview(false)}>
          <div style={{
            background: '#FAF7F0', borderRadius: 18, width: '100%', maxWidth: 540,
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding: '18px 22px 0', borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1A1A1A' }}>{title}</h3>
                <button onClick={() => setShowPreview(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#999', cursor: 'pointer' }}>x</button>
              </div>
              {isPending && (
                <div style={{ padding: '4px 12px', background: '#FEF3C7', color: '#92400E', borderRadius: 8, fontSize: 11, fontWeight: 600, marginBottom: 10, display: 'inline-block' }}>
                  Pending your approval
                </div>
              )}
              <div style={{ display: 'flex', gap: 0 }}>
                {[{ key: 'preview', label: 'Preview' }, { key: 'edit', label: 'Edit Tasks' }, { key: 'history', label: 'History' }].map(tab => (
                  <button key={tab.key} onClick={() => {
                    setModalTab(tab.key);
                    if (tab.key === 'history') fetchVersions();
                    if (tab.key === 'edit') loadTasks();
                  }} style={{
                    background: 'none', border: 'none',
                    borderBottom: modalTab === tab.key ? `2px solid ${accentColor}` : '2px solid transparent',
                    padding: '6px 16px', fontSize: 13,
                    fontWeight: modalTab === tab.key ? 700 : 400,
                    color: modalTab === tab.key ? accentColor : '#888',
                    cursor: 'pointer',
                  }}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
              {/* ── Preview Tab ── */}
              {modalTab === 'preview' && (
                <div>
                  <img
                    src={displayUrl}
                    alt={`${title} overlay`}
                    style={{ width: '100%', maxHeight: 520, objectFit: 'contain', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
                  />
                  {tasks.length > 0 && (
                    <div style={{ marginTop: 14, fontSize: 11, color: '#888', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span>{tasks.length} tasks{tasks.filter(t => t.required).length > 0 && ` · ${tasks.filter(t => t.required).length} required`}</span>
                      {isWardrobe && tasks.some(t => t.wardrobe_id) && (
                        <span style={{ padding: '1px 8px', background: '#eef2ff', color: '#6366f1', borderRadius: 6, fontWeight: 600 }}>From outfit picker</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Edit Tasks Tab ── */}
              {modalTab === 'edit' && (
                <div>
                  <p style={{ margin: '0 0 16px', fontSize: 12, color: '#888', lineHeight: 1.5 }}>
                    Edit task labels and descriptions, then re-render. No AI call — fast and free.
                  </p>
                  {editTasks.map((task, i) => {
                    const timingColor = TIMING_COLORS[task.timing] || accentColor;
                    return (
                      <div key={i} style={{
                        marginBottom: 12, padding: '10px 12px', background: '#fff',
                        borderRadius: 8, border: `1px solid ${timingColor}30`,
                        borderLeft: !isWardrobe ? `3px solid ${timingColor}` : undefined,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: timingColor, textTransform: 'uppercase' }}>
                            {isWardrobe ? (task.slot || `Task ${i + 1}`) : (TIMING_LABELS[task.timing] || task.slot || `Task ${i + 1}`)}
                          </span>
                          {task.required && <span style={{ fontSize: 9, padding: '1px 6px', background: `${timingColor}20`, color: timingColor, borderRadius: 4, fontWeight: 700 }}>required</span>}
                          {!isWardrobe && task.platform && <span style={{ fontSize: 9, color: '#999' }}>{task.platform}</span>}
                        </div>
                        <input
                          value={task.label || ''}
                          onChange={e => updateTaskField(i, 'label', e.target.value)}
                          placeholder="Task label..."
                          style={{
                            width: '100%', padding: '5px 8px', boxSizing: 'border-box',
                            border: '1px solid #e0ddd5', borderRadius: 6, fontSize: 12,
                            fontWeight: 600, outline: 'none', background: '#FAFAFA',
                          }}
                        />
                        {isWardrobe && (
                          <input
                            value={task.description || ''}
                            onChange={e => updateTaskField(i, 'description', e.target.value)}
                            placeholder="Description..."
                            style={{
                              width: '100%', padding: '4px 8px', boxSizing: 'border-box',
                              border: '1px solid #e0ddd5', borderRadius: 6, fontSize: 11,
                              outline: 'none', background: '#FAFAFA', marginTop: 4, color: '#666',
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                  {error && (
                    <div style={{ background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>
                      {error}
                    </div>
                  )}
                  <button onClick={handleRerender} disabled={rerendering} style={{
                    ...accentBtn, width: '100%', padding: '10px 0',
                    opacity: rerendering ? 0.6 : 1, cursor: rerendering ? 'not-allowed' : 'pointer',
                  }}>
                    {rerendering ? 'Re-rendering...' : `Re-render ${title}`}
                  </button>
                </div>
              )}

              {/* ── History Tab ── */}
              {modalTab === 'history' && (
                <div>
                  {loadingVersions && <p style={{ fontSize: 12, color: '#888' }}>Loading versions...</p>}
                  {!loadingVersions && versions.length === 0 && <p style={{ fontSize: 12, color: '#888' }}>No versions found.</p>}
                  {versions.map((v, i) => {
                    const isCurrent = v.id === existingAssetId;
                    return (
                      <div key={v.id} style={{
                        display: 'flex', gap: 12, padding: '10px 0',
                        borderBottom: i < versions.length - 1 ? '1px solid #F0EDE6' : 'none',
                        opacity: isCurrent ? 1 : 0.85,
                      }}>
                        <img
                          src={v.image_url} alt={`v${v.version}`}
                          style={{
                            width: 60, height: 90, objectFit: 'cover', borderRadius: 6,
                            border: isCurrent ? `2px solid ${accentColor}` : '1px solid #EEE',
                            cursor: 'pointer',
                          }}
                          onClick={() => { setImageUrl(v.image_url); setModalTab('preview'); }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
                            Version {v.version || i + 1}
                            {isCurrent && (
                              <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', background: '#E8F5E9', color: '#16a34a', borderRadius: 4, fontWeight: 700 }}>CURRENT</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                            <span>{v.approval_status}</span>
                            {v.task_count && <span style={{ marginLeft: 8 }}>{v.task_count} tasks</span>}
                          </div>
                          <div style={{ fontSize: 10, color: '#AAA', marginTop: 2 }}>
                            {new Date(v.created_at).toLocaleDateString()} {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
                          <a href={v.image_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 10, color: accentColor, textDecoration: 'none', fontWeight: 600 }}>
                            Open
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 22px', borderTop: '1px solid rgba(0,0,0,0.08)', background: '#FAF7F0' }}>
              {isPending ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleReject} style={{ ...redBtn, flex: 1 }}>Reject</button>
                  <button onClick={handleGenerate} disabled={generating} style={{ ...grayBtn, flex: 1, opacity: generating ? 0.6 : 1 }}>
                    {generating ? '...' : 'Regenerate'}
                  </button>
                  <button onClick={handleApprove} disabled={approving} style={{ ...greenBtn, flex: 2, opacity: approving ? 0.6 : 1 }}>
                    {approving ? 'Approving...' : `Approve ${title}`}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                  <button onClick={handleGenerate} disabled={generating} style={{ ...grayBtn, fontSize: 11, padding: '6px 10px', opacity: generating ? 0.6 : 1 }}>
                    {generating ? '...' : 'Regenerate'}
                  </button>
                  <button onClick={() => setShowPreview(false)} style={{ ...accentBtn, padding: '6px 18px' }}>Done</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Inline Section (when modal is closed) ═══ */}
      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, marginTop: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e' }}>
            {title}
            {tasks.length > 0 && (
              <span style={{ fontWeight: 400, color: '#888', marginLeft: 6 }}>
                ({tasks.length} tasks{tasks.filter(t => t.required).length > 0 && `, ${tasks.filter(t => t.required).length} required`})
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(hasOverlay || imageUrl) && (
              <button onClick={() => { setModalTab('preview'); setShowPreview(true); }} style={outlineBtn}>
                View
              </button>
            )}
            <button onClick={handleGenerate} disabled={generating} style={{
              ...((hasOverlay || imageUrl) ? outlineBtn : accentBtn),
              opacity: generating ? 0.6 : 1, cursor: generating ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}>
              {generating ? 'Generating...' : (hasOverlay || imageUrl) ? 'Regenerate' : `Generate ${title}`}
            </button>
          </div>
        </div>

        {/* Inline image preview (small) */}
        {displayUrl && (
          <div style={{ marginBottom: 10, textAlign: 'center', cursor: 'pointer' }} onClick={() => { setModalTab('preview'); setShowPreview(true); }}>
            <img
              src={displayUrl}
              alt={title}
              style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, border: '1px solid #e8e0d0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
            />
          </div>
        )}

        {/* Inline task summary */}
        {tasks.length > 0 && !isWardrobe && (() => {
          const grouped = {};
          tasks.forEach(t => {
            const k = t.timing || 'during';
            if (!grouped[k]) grouped[k] = [];
            grouped[k].push(t);
          });
          return (
            <div>
              {['before', 'during', 'after'].filter(p => grouped[p]).map(phase => (
                <div key={phase} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: TIMING_COLORS[phase], textTransform: 'uppercase', marginBottom: 3 }}>
                    {TIMING_LABELS[phase]}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 3 }}>
                    {grouped[phase].map(t => (
                      <div key={t.slot} style={{
                        padding: '3px 8px', background: '#f8f8f8', borderRadius: 5,
                        borderLeft: `3px solid ${TIMING_COLORS[phase]}`, fontSize: 10,
                      }}>
                        <span style={{ fontWeight: 600, color: '#333' }}>{t.label}</span>
                        <span style={{ color: '#aaa', marginLeft: 4 }}>{t.platform}</span>
                        {t.required && <span style={{ color: TIMING_COLORS[phase], marginLeft: 4, fontSize: 8, fontWeight: 700 }}>req</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {tasks.length > 0 && isWardrobe && (() => {
          const hasRealPieces = tasks.some(t => t.wardrobe_id || t.price > 0);
          const ownedCount = tasks.filter(t => t.completed).length;
          const totalCost = tasks.reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0);
          return (
            <div>
              {hasRealPieces && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 10 }}>
                  <span style={{ padding: '2px 8px', background: '#f0fdf4', color: '#16a34a', borderRadius: 6, fontWeight: 600 }}>
                    {ownedCount}/{tasks.length} owned
                  </span>
                  {totalCost > 0 && (
                    <span style={{ padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: 6, fontWeight: 600 }}>
                      Total: {totalCost.toLocaleString()} coins
                    </span>
                  )}
                  <span style={{ padding: '2px 8px', background: '#eef2ff', color: '#6366f1', borderRadius: 6, fontWeight: 600 }}>
                    From outfit picker
                  </span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 3 }}>
                {tasks.map(t => (
                  <div key={t.slot || t.order} style={{
                    padding: '4px 8px', background: t.completed ? '#f0fdf4' : '#f8f8f8', borderRadius: 5,
                    borderLeft: `3px solid ${t.completed ? '#16a34a' : accentColor}`, fontSize: 10,
                  }}>
                    <span style={{ fontWeight: 600, color: '#333' }}>{t.label}</span>
                    {t.description && <span style={{ color: '#999', marginLeft: 4 }}>{t.description}</span>}
                    {t.required && <span style={{ color: accentColor, marginLeft: 4, fontSize: 8, fontWeight: 700 }}>req</span>}
                    {t.completed && <span style={{ color: '#16a34a', marginLeft: 4, fontSize: 8, fontWeight: 700 }}>owned</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {tasks.length === 0 && !displayUrl && (
          <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
            {isWardrobe
              ? 'Pick wardrobe items via the outfit picker first, then generate the shopping list. Or generate with AI-written tasks.'
              : `No ${title.toLowerCase()} generated yet. Click "Generate ${title}" to create tasks and a visual overlay.`}
          </div>
        )}
      </div>

      {/* Error display */}
      {error && !showPreview && (
        <div style={{
          background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2',
          borderRadius: 6, padding: '6px 10px', fontSize: 11, marginTop: 4,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
