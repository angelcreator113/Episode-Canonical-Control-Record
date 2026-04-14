/**
 * UIOverlaysTab — Phone Hub Design
 *
 * The phone is the show's interface. All overlays are phone screens.
 * Left: phone device preview showing active screen
 * Right: screen type grid + actions
 * Bottom: detail panel for selected screen (generate, upload, edit, delete)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Loader, Upload, Trash2, Download, RefreshCw, X, Eraser, Link2, Maximize } from 'lucide-react';
import api from '../services/api';
import PhoneHub, { SCREEN_TYPES } from '../components/PhoneHub';
import ScreenLinkEditor from '../components/ScreenLinkEditor';

export default function UIOverlaysTab({ showId: propShowId }) {
  const [showId, setShowId] = useState(propShowId || null);
  const [shows, setShows] = useState([]);
  const [overlays, setOverlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeScreen, setActiveScreen] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [phoneSkin, setPhoneSkin] = useState('rosegold');
  const [customFrameUrl, setCustomFrameUrl] = useState(null);
  const [editingLinks, setEditingLinks] = useState(false);
  const [navHistory, setNavHistory] = useState([]);  // stack of screen keys for back navigation
  const [globalFit, setGlobalFit] = useState({});    // device-level fit applied to all screens
  const [batchUploading, setBatchUploading] = useState(false);
  const fileInputRef = useRef(null);
  const frameInputRef = useRef(null);
  const batchInputRef = useRef(null);
  const pollRef = useRef(null);

  // Load phone skin preference
  useEffect(() => {
    const saved = localStorage.getItem('phone_hub_skin');
    if (saved) setPhoneSkin(saved);
  }, []);

  const handleChangeSkin = (skin) => {
    setPhoneSkin(skin);
    localStorage.setItem('phone_hub_skin', skin);
  };

  // Load saved phone frame + global fit settings
  useEffect(() => {
    if (!showId) return;
    api.get(`/api/v1/ui-overlays/${showId}/frame`).then(r => {
      if (r.data?.frame_url) setCustomFrameUrl(r.data.frame_url);
      if (r.data?.global_fit) setGlobalFit(r.data.global_fit);
    }).catch(err => {
      console.warn('[PhoneHub] Failed to load frame/fit settings:', err.message);
    });
  }, [showId]);

  // Upload custom phone frame (persists to S3)
  const handleFrameUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !showId) return;
    const prevUrl = customFrameUrl;
    const previewUrl = URL.createObjectURL(file);
    setCustomFrameUrl(previewUrl);
    try {
      const fd = new FormData();
      fd.append('frame', file);
      const res = await api.post(`/api/v1/ui-overlays/${showId}/frame`, fd);
      if (res.data?.frame_url) {
        setCustomFrameUrl(res.data.frame_url);
      }
      flash('Frame uploaded!');
    } catch (err) {
      // Revert to previous frame on failure
      setCustomFrameUrl(prevUrl);
      flash(err.response?.data?.error || 'Frame upload failed', 'error');
    }
    URL.revokeObjectURL(previewUrl);
    if (frameInputRef.current) frameInputRef.current.value = '';
  };

  const flash = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  // Batch upload — match files to screen types by filename
  const handleBatchUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !showId) return;
    setBatchUploading(true);
    let uploaded = 0;
    let failed = 0;
    const screenKeys = SCREEN_TYPES.filter(t => t.type === 'screen').map(t => t.key);

    for (const file of files) {
      const name = file.name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '_');
      // Try to match filename to a screen key
      const match = screenKeys.find(k => name.includes(k) || name.includes(k.replace(/_/g, '')));
      if (!match) {
        console.warn(`[BatchUpload] No screen match for: ${file.name}`);
        failed++;
        continue;
      }
      // Ensure overlay type exists
      const existing = overlays.find(o => o.id === match);
      if (!existing) {
        try {
          const st = SCREEN_TYPES.find(t => t.key === match);
          await api.post(`/api/v1/ui-overlays/${showId}/types`, {
            name: st?.label || match, beat: match, description: st?.desc || '',
            prompt: `Phone screen for ${st?.label || match}`, category: 'phone',
          });
        } catch { /* type may already exist */ }
      }
      // Upload
      try {
        const fd = new FormData();
        fd.append('image', file);
        await api.post(`/api/v1/ui-overlays/${showId}/upload/${match}`, fd);
        uploaded++;
      } catch { failed++; }
    }

    loadOverlays(false);
    setBatchUploading(false);
    flash(`Batch upload: ${uploaded} uploaded${failed ? `, ${failed} failed/unmatched` : ''}`, failed && !uploaded ? 'error' : 'success');
    if (batchInputRef.current) batchInputRef.current.value = '';
  };

  // Load shows
  useEffect(() => {
    if (propShowId) { setShowId(propShowId); return; }
    api.get('/api/v1/shows').then(r => {
      const s = r.data?.data || [];
      setShows(s);
      if (s.length > 0 && !showId) setShowId(s[0].id);
    }).catch(() => {});
  }, [propShowId]);

  // Load overlays
  const loadOverlays = useCallback((showLoader) => {
    if (!showId) return;
    if (showLoader) setLoading(true);
    api.get(`/api/v1/ui-overlays/${showId}`)
      .then(r => setOverlays(r.data?.data || []))
      .catch(() => setOverlays([]))
      .finally(() => setLoading(false));
  }, [showId]);

  useEffect(() => { loadOverlays(true); }, [loadOverlays]);
  useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  // Generate all
  const handleGenerateAll = async () => {
    if (!showId) return;
    setGenerating(true);
    try {
      await api.post(`/api/v1/ui-overlays/${showId}/generate-all`);
      pollRef.current = setInterval(() => {
        api.get(`/api/v1/ui-overlays/${showId}`).then(r => {
          const data = r.data?.data || [];
          setOverlays(data);
          if (data.filter(o => o.generated).length >= data.length) {
            clearInterval(pollRef.current); pollRef.current = null; setGenerating(false);
          }
        }).catch(() => {});
      }, 5000);
      setTimeout(() => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } setGenerating(false); }, 300000);
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); setGenerating(false); }
  };

  // Generate one
  const handleGenerateOne = async (overlayId, prompt) => {
    if (!showId) return;
    setGeneratingId(overlayId);
    try {
      const body = prompt ? { prompt } : {};
      await api.post(`/api/v1/ui-overlays/${showId}/generate/${overlayId}`, body);
      flash('Generated!');
      // Refresh this screen
      const res = await api.get(`/api/v1/ui-overlays/${showId}`);
      const all = res.data?.data || [];
      setOverlays(all);
      const updated = all.find(o => o.id === overlayId);
      if (updated) setActiveScreen(updated);
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
    setGeneratingId(null);
  };

  // Upload image for a screen
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeScreen?.id) return;
    // Confirm overwrite if screen already has an image
    if (activeScreen.url && activeScreen.generated) {
      if (!confirm(`"${activeScreen.name}" already has an image. Replace it?`)) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }
    try {
      const fd = new FormData();
      fd.append('image', file);
      await api.post(`/api/v1/ui-overlays/${showId}/upload/${activeScreen.id}`, fd);
      flash('Uploaded!');
      const res = await api.get(`/api/v1/ui-overlays/${showId}`);
      const all = res.data?.data || [];
      setOverlays(all);
      const updated = all.find(o => o.id === activeScreen.id);
      if (updated) setActiveScreen(updated);
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Remove background
  const handleRemoveBg = async () => {
    if (!activeScreen?.asset_id) return;
    try {
      await api.post(`/api/v1/ui-overlays/${showId}/remove-bg/${activeScreen.asset_id}`);
      flash('Background removed!');
      const res = await api.get(`/api/v1/ui-overlays/${showId}`);
      const all = res.data?.data || [];
      setOverlays(all);
      const updated = all.find(o => o.id === activeScreen.id);
      if (updated) setActiveScreen(updated);
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  // Delete screen + clean up any links pointing to it from other screens
  const handleDelete = async () => {
    if (!activeScreen) return;
    if (!confirm(`Delete "${activeScreen.name}"? Any links pointing to this screen from other screens will be removed.`)) return;
    try {
      const deletedKey = activeScreen.id;
      if (activeScreen.custom && activeScreen.custom_id) {
        await api.delete(`/api/v1/ui-overlays/${showId}/types/${activeScreen.custom_id}`);
      } else if (activeScreen.asset_id) {
        await api.delete(`/api/v1/assets/${activeScreen.asset_id}`);
      }
      // Clean orphaned links: remove any screen_links targeting the deleted screen
      for (const overlay of overlays) {
        const links = overlay.screen_links || overlay.metadata?.screen_links || [];
        const orphans = links.filter(l => l.target === deletedKey);
        if (orphans.length > 0 && overlay.asset_id) {
          const cleaned = links.filter(l => l.target !== deletedKey);
          api.put(`/api/v1/ui-overlays/${showId}/screen-links/${overlay.asset_id}`, { screen_links: cleaned }).catch(() => {});
        }
      }
      setActiveScreen(null);
      setEditingLinks(false);
      loadOverlays(false);
      flash('Deleted');
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  // Download
  const handleDownload = () => {
    if (!activeScreen?.url) return;
    const link = document.createElement('a');
    link.href = activeScreen.url;
    link.download = `${activeScreen.id || 'screen'}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Create custom screen
  const handleCreateScreen = async (form) => {
    try {
      await api.post(`/api/v1/ui-overlays/${showId}/types`, { ...form, category: 'phone' });
      loadOverlays(false);
      setShowCreateModal(false);
      flash('Screen type created');
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  // Auto-create a screen type from a placeholder, then trigger upload
  const handleAutoCreateAndUpload = async () => {
    if (!activeScreen?.placeholder || !showId) return;
    try {
      const res = await api.post(`/api/v1/ui-overlays/${showId}/types`, {
        name: activeScreen.name,
        beat: activeScreen.beat || activeScreen.key || '',
        description: activeScreen.description || activeScreen.desc || '',
        prompt: `A luxury phone screen overlay for "${activeScreen.name}". Dreamy glassmorphism aesthetic with soft pink and lavender gradients. Frosted glass UI elements with sparkle particle effects. Rose gold accents. Elegant typography. Premium mobile UI design. Isolated on plain background.`,
        category: 'phone',
      });
      // Reload overlays so the new type appears, then open file picker
      const listRes = await api.get(`/api/v1/ui-overlays/${showId}`);
      const all = listRes.data?.data || [];
      setOverlays(all);
      const created = all.find(o => o.name === activeScreen.name || o.id === (res.data?.data?.type_key));
      if (created) {
        setActiveScreen(created);
        // Small delay so state updates before file picker opens
        setTimeout(() => fileInputRef.current?.click(), 100);
      } else {
        fileInputRef.current?.click();
      }
    } catch (err) {
      // If type already exists (409), just proceed with upload
      if (err.response?.status === 409) {
        const listRes = await api.get(`/api/v1/ui-overlays/${showId}`);
        const all = listRes.data?.data || [];
        setOverlays(all);
        const existing = all.find(o => (o.name || '').toLowerCase().includes(activeScreen.name.toLowerCase()));
        if (existing) setActiveScreen(existing);
        setTimeout(() => fileInputRef.current?.click(), 100);
      } else {
        flash(err.response?.data?.error || err.message, 'error');
      }
    }
  };

  // Auto-create a screen type from a placeholder, then generate
  const handleAutoCreateAndGenerate = async () => {
    if (!activeScreen?.placeholder || !showId) return;
    try {
      const res = await api.post(`/api/v1/ui-overlays/${showId}/types`, {
        name: activeScreen.name,
        beat: activeScreen.beat || activeScreen.key || '',
        description: activeScreen.description || activeScreen.desc || '',
        prompt: `A luxury phone screen overlay for "${activeScreen.name}". Dreamy glassmorphism aesthetic with soft pink and lavender gradients. Frosted glass UI elements with sparkle particle effects. Rose gold accents. Elegant typography. Premium mobile UI design. Isolated on plain background.`,
        category: 'phone',
      });
      // Reload and generate
      const listRes = await api.get(`/api/v1/ui-overlays/${showId}`);
      const all = listRes.data?.data || [];
      setOverlays(all);
      const created = all.find(o => o.name === activeScreen.name || o.id === (res.data?.data?.type_key));
      if (created) {
        setActiveScreen(created);
        handleGenerateOne(created.id);
      }
    } catch (err) {
      if (err.response?.status === 409) {
        const listRes = await api.get(`/api/v1/ui-overlays/${showId}`);
        const all = listRes.data?.data || [];
        setOverlays(all);
        const existing = all.find(o => (o.name || '').toLowerCase().includes(activeScreen.name.toLowerCase()));
        if (existing) {
          setActiveScreen(existing);
          handleGenerateOne(existing.id);
        }
      } else {
        flash(err.response?.data?.error || err.message, 'error');
      }
    }
  };

  // ── Screen link navigation ──

  const handleNavigate = (targetKey) => {
    // Find the overlay matching the target screen key
    const target = overlays.find(o => {
      const id = (o.id || '').toLowerCase();
      const name = (o.name || '').toLowerCase();
      const key = targetKey.toLowerCase();
      return id === key || name.includes(key) || (o.overlay_type || '').toLowerCase() === key;
    });
    if (target) {
      // Push current screen to history for back navigation
      if (activeScreen) {
        setNavHistory(prev => [...prev, activeScreen.id || activeScreen.key]);
      }
      setActiveScreen(target);
    }
  };

  const handleBack = () => {
    if (navHistory.length === 0) return;
    const prevKey = navHistory[navHistory.length - 1];
    setNavHistory(prev => prev.slice(0, -1));
    const prevScreen = overlays.find(o => o.id === prevKey || (o.name || '').toLowerCase().includes(prevKey));
    if (prevScreen) setActiveScreen(prevScreen);
  };

  // ── Screen link editing ──

  const handleSaveLinks = async (links) => {
    if (!activeScreen?.asset_id || !showId) return;
    try {
      await api.put(`/api/v1/ui-overlays/${showId}/screen-links/${activeScreen.asset_id}`, { screen_links: links });
      // Update local state
      setOverlays(prev => prev.map(o => o.id === activeScreen.id ? { ...o, screen_links: links, metadata: { ...(o.metadata || {}), screen_links: links } } : o));
      setActiveScreen(prev => prev ? { ...prev, screen_links: links, metadata: { ...(prev.metadata || {}), screen_links: links } } : prev);
      flash('Links saved!');
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  const handleUploadIcon = async (linkId, file) => {
    if (!activeScreen?.asset_id || !showId) return;
    try {
      const fd = new FormData();
      fd.append('icon', file);
      fd.append('link_id', linkId);
      const res = await api.post(`/api/v1/ui-overlays/${showId}/screen-links/${activeScreen.asset_id}/icon`, fd);
      const iconUrl = res.data?.icon_url;
      if (iconUrl) {
        // Update the link's icon_url locally
        const currentLinks = activeScreen.screen_links || activeScreen.metadata?.screen_links || [];
        const updated = currentLinks.map(l => l.id === linkId ? { ...l, icon_url: iconUrl } : l);
        setOverlays(prev => prev.map(o => o.id === activeScreen.id ? { ...o, screen_links: updated, metadata: { ...(o.metadata || {}), screen_links: updated } } : o));
        setActiveScreen(prev => prev ? { ...prev, screen_links: updated, metadata: { ...(prev.metadata || {}), screen_links: updated } } : prev);
        flash('Icon uploaded!');
      }
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  // ── Image fit controls ──

  // Per-screen fit
  const handleUpdateFit = async (fitChanges) => {
    if (!activeScreen) return;
    const currentFit = activeScreen.image_fit || activeScreen.metadata?.image_fit || {};
    const newFit = { ...currentFit, ...fitChanges };
    setActiveScreen(prev => prev ? { ...prev, image_fit: newFit, metadata: { ...(prev.metadata || {}), image_fit: newFit } } : prev);
    setOverlays(prev => prev.map(o => o.id === activeScreen.id ? { ...o, image_fit: newFit, metadata: { ...(o.metadata || {}), image_fit: newFit } } : o));
  };

  const handleSaveFit = async () => {
    if (!activeScreen?.asset_id || !showId) return;
    const fit = activeScreen.image_fit || activeScreen.metadata?.image_fit || {};
    try {
      await api.put(`/api/v1/ui-overlays/${showId}/image-fit/${activeScreen.asset_id}`, { image_fit: fit });
      flash('Fit saved for this screen!');
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  const handleClearScreenFit = async () => {
    if (!activeScreen?.asset_id || !showId) return;
    setActiveScreen(prev => prev ? { ...prev, image_fit: null, metadata: { ...(prev.metadata || {}), image_fit: null } } : prev);
    setOverlays(prev => prev.map(o => o.id === activeScreen.id ? { ...o, image_fit: null, metadata: { ...(o.metadata || {}), image_fit: null } } : o));
    try {
      await api.put(`/api/v1/ui-overlays/${showId}/image-fit/${activeScreen.asset_id}`, { image_fit: null });
      flash('Using global fit');
    } catch { /* silent */ }
  };

  // Global fit (applies to all screens that don't have a per-screen override)
  const handleUpdateGlobalFit = (fitChanges) => {
    setGlobalFit(prev => ({ ...prev, ...fitChanges }));
  };

  const handleSaveGlobalFit = async () => {
    if (!showId) return;
    try {
      await api.put(`/api/v1/ui-overlays/${showId}/global-fit`, { global_fit: globalFit });
      flash('Global fit saved for all screens!');
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  // Change custom screen's type (screen vs icon)
  const handleChangeScreenType = async (category) => {
    if (!activeScreen?.custom || !activeScreen.custom_id || !showId) return;
    try {
      await api.put(`/api/v1/ui-overlays/${showId}/types/${activeScreen.custom_id}`, { category });
      setActiveScreen(prev => prev ? { ...prev, category } : prev);
      setOverlays(prev => prev.map(o => o.id === activeScreen.id ? { ...o, category } : o));
      flash(category === 'phone_icon' ? 'Set as Icon' : 'Set as Screen');
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  const generatedCount = overlays.filter(o => o.generated).length;

  return (
    <div style={{ padding: '20px 0' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: toast.type === 'error' ? '#ffebee' : '#e8f5e9', color: toast.type === 'error' ? '#c62828' : '#2e7d32', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#2C2C2C' }}>Phone Hub</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888', fontFamily: "'DM Mono', monospace" }}>
            {generatedCount}/{overlays.length} screens ready — the phone is the show's interface
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => frameInputRef.current?.click()} style={{
            padding: '8px 14px', border: '1px solid #e8e0d0', borderRadius: 8,
            background: '#fff', color: '#888', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}>{customFrameUrl ? 'Change Frame' : 'Upload Frame'}</button>
          <button onClick={() => setShowCreateModal(true)} disabled={!showId} style={{
            padding: '8px 14px', border: '1px solid #e8e0d0', borderRadius: 8,
            background: '#fff', color: '#2C2C2C', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}>+ New Screen</button>
          <button onClick={() => batchInputRef.current?.click()} disabled={batchUploading || !showId} style={{
            padding: '8px 14px', border: '1px solid #e8e0d0', borderRadius: 8,
            background: '#fff', color: '#2C2C2C', fontSize: 11, fontWeight: 600,
            cursor: batchUploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}>{batchUploading ? 'Uploading...' : 'Batch Upload'}</button>
          <input ref={batchInputRef} type="file" accept="image/*" multiple onChange={handleBatchUpload} style={{ display: 'none' }} />
          <input ref={frameInputRef} type="file" accept="image/*" onChange={handleFrameUpload} style={{ display: 'none' }} />
          <button onClick={handleGenerateAll} disabled={generating || !showId} style={{
            padding: '8px 16px', border: 'none', borderRadius: 8,
            background: generating ? '#eee' : '#2C2C2C', color: generating ? '#999' : '#fff',
            fontSize: 11, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            {generating ? <><Loader size={12} className="spin" /> Generating...</> : <><Sparkles size={12} /> Generate All</>}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          <Loader size={24} className="spin" />
          <p style={{ marginTop: 12, fontSize: 13 }}>Loading phone screens...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Left: Phone Hub (phone + grid) */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <PhoneHub
              screens={overlays}
              activeScreen={activeScreen}
              onSelectScreen={(s) => { setActiveScreen(s); setNavHistory([]); setEditingLinks(false); }}
              onNavigate={handleNavigate}
              navigationHistory={navHistory}
              onBack={handleBack}
              skin={phoneSkin}
              onChangeSkin={handleChangeSkin}
              customFrameUrl={customFrameUrl}
              globalFit={globalFit}
            />
          </div>

          {/* Right: Detail Panel (sticky sidebar) */}
          {activeScreen && (
            <div style={{
              width: 340, flexShrink: 0,
              position: 'sticky', top: 20, maxHeight: 'calc(100vh - 60px)', overflowY: 'auto',
              background: '#fff', border: '1px solid #e8e0d0',
              borderRadius: 12, padding: 14,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#2C2C2C' }}>{activeScreen.name}</div>
                    {/* Type badge */}
                    <span style={{
                      fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                      background: (activeScreen.category === 'phone_icon' || activeScreen.type === 'icon') ? '#a889c8' : '#B8962E',
                      color: '#fff',
                    }}>
                      {(activeScreen.category === 'phone_icon' || activeScreen.type === 'icon') ? 'ICON' : 'SCREEN'}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                    {activeScreen.beat && <span style={{ fontFamily: "'DM Mono', monospace", marginRight: 6 }}>{activeScreen.beat}</span>}
                    {activeScreen.description?.slice(0, 60)}
                  </div>
                </div>
                <button onClick={() => { setActiveScreen(null); setEditingLinks(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 2 }}>
                  <X size={14} />
                </button>
              </div>

              {/* Type selector for custom screens */}
              {activeScreen.custom && activeScreen.asset_id && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: '#888', fontFamily: "'DM Mono', monospace", marginBottom: 3 }}>TYPE</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleChangeScreenType('phone')} style={{
                      flex: 1, padding: '4px 0', fontSize: 9, fontWeight: 600, border: '1px solid #e0d9ce',
                      borderRadius: 4, cursor: 'pointer',
                      background: activeScreen.category !== 'phone_icon' ? '#B8962E' : '#fff',
                      color: activeScreen.category !== 'phone_icon' ? '#fff' : '#888',
                    }}>Screen</button>
                    <button onClick={() => handleChangeScreenType('phone_icon')} style={{
                      flex: 1, padding: '4px 0', fontSize: 9, fontWeight: 600, border: '1px solid #e0d9ce',
                      borderRadius: 4, cursor: 'pointer',
                      background: activeScreen.category === 'phone_icon' ? '#a889c8' : '#fff',
                      color: activeScreen.category === 'phone_icon' ? '#fff' : '#888',
                    }}>Icon</button>
                  </div>
                </div>
              )}

              {/* Thumbnail preview */}
              {activeScreen.url && (
                <div style={{
                  width: '100%', aspectRatio: (activeScreen.category === 'phone_icon' || activeScreen.type === 'icon') ? '1/1' : '9/16',
                  borderRadius: 8, overflow: 'hidden', marginBottom: 10, background: '#f5f3ee',
                  maxHeight: 200,
                }}>
                  <img src={activeScreen.url} alt={activeScreen.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              )}

              {/* Prompt */}
              {(activeScreen.prompt || activeScreen.custom_prompt) && (
                <div style={{ background: '#faf8f5', borderRadius: 6, padding: '6px 10px', marginBottom: 10, fontSize: 10, color: '#666', lineHeight: 1.5 }}>
                  <span style={{ fontSize: 8, fontWeight: 600, color: '#B8962E', fontFamily: "'DM Mono', monospace" }}>PROMPT</span>
                  <p style={{ margin: '3px 0 0' }}>{(activeScreen.custom_prompt || activeScreen.prompt || '').slice(0, 120)}...</p>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {!activeScreen.placeholder ? (
                  <>
                    <ActionBtn icon={Sparkles} label={generatingId === activeScreen.id ? 'Generating...' : 'Generate'} onClick={() => handleGenerateOne(activeScreen.id)} disabled={generatingId === activeScreen.id} color="#B8962E" />
                    <ActionBtn icon={Upload} label="Upload" onClick={() => fileInputRef.current?.click()} color="#7ab3d4" />
                    {activeScreen.url && <ActionBtn icon={Download} label="Download" onClick={handleDownload} color="#6bba9a" />}
                    {activeScreen.asset_id && <ActionBtn icon={Eraser} label="Remove BG" onClick={handleRemoveBg} color="#a889c8" />}
                    {activeScreen.url && <ActionBtn icon={Link2} label={editingLinks ? 'Done' : 'Links'} onClick={() => setEditingLinks(!editingLinks)} color={editingLinks ? '#2C2C2C' : '#b89060'} />}
                    <ActionBtn icon={Trash2} label="Delete" onClick={handleDelete} color="#dc2626" />
                  </>
                ) : (
                  <>
                    <ActionBtn icon={Upload} label="Upload" onClick={() => handleAutoCreateAndUpload()} color="#7ab3d4" />
                    <ActionBtn icon={Sparkles} label="Generate" onClick={() => handleAutoCreateAndGenerate()} disabled={generatingId === activeScreen.id} color="#B8962E" />
                  </>
                )}
              </div>

              {/* Image Fit Controls */}
              {activeScreen?.url && !activeScreen.placeholder && (
                <ImageFitControls
                  fit={activeScreen.image_fit || activeScreen.metadata?.image_fit || globalFit || {}}
                  hasScreenOverride={!!(activeScreen.image_fit || activeScreen.metadata?.image_fit)}
                  onChange={handleUpdateFit}
                  onSave={handleSaveFit}
                  onClearOverride={handleClearScreenFit}
                  globalFit={globalFit}
                  onChangeGlobal={handleUpdateGlobalFit}
                  onSaveGlobal={handleSaveGlobalFit}
                />
              )}

              {/* Screen Link Editor */}
              {editingLinks && activeScreen?.url && (
                <div style={{ marginTop: 12, padding: '12px 0', borderTop: '1px solid #f0ece4' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#b89060', fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>
                    SCREEN LINKS — Draw tap zones on the screen, assign targets, upload icon images
                  </div>
                  <ScreenLinkEditor
                    screenUrl={activeScreen.url}
                    links={activeScreen.screen_links || activeScreen.metadata?.screen_links || []}
                    screenTypes={SCREEN_TYPES.filter(t => t.type === 'screen')}
                    generatedScreenKeys={new Set(overlays.filter(o => o.generated && o.url).map(o => o.id))}
                    onSave={handleSaveLinks}
                    onUploadIcon={handleUploadIcon}
                  />
                </div>
              )}

              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
            </div>
          )}
        </div>
      )}

      {/* Create Screen Modal */}
      {showCreateModal && (
        <CreateScreenModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateScreen}
        />
      )}

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const FIT_MODES = [
  { key: 'cover', label: 'Fill & Crop' },
  { key: 'contain', label: 'Fit Inside' },
  { key: 'fill', label: 'Stretch' },
];

function ImageFitControls({ fit, hasScreenOverride, onChange, onSave, onClearOverride, globalFit, onChangeGlobal, onSaveGlobal }) {
  const [editMode, setEditMode] = useState(hasScreenOverride ? 'screen' : 'global');
  const activeFit = editMode === 'global' ? (globalFit || {}) : fit;
  const activeChange = editMode === 'global' ? onChangeGlobal : onChange;
  const activeSave = editMode === 'global' ? onSaveGlobal : onSave;

  const mode = activeFit.mode || 'cover';
  const scale = activeFit.scale || 100;
  const offsetX = activeFit.offsetX || 0;
  const offsetY = activeFit.offsetY || 0;

  return (
    <div style={{ marginTop: 10, padding: '10px 0', borderTop: '1px solid #f0ece4' }}>
      {/* Mode toggle: global vs per-screen */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setEditMode('global')} style={{
            padding: '3px 8px', fontSize: 9, fontWeight: 600, border: '1px solid #e0d9ce',
            borderRadius: 4, cursor: 'pointer',
            background: editMode === 'global' ? '#B8962E' : '#fff',
            color: editMode === 'global' ? '#fff' : '#888',
          }}>All Screens</button>
          <button onClick={() => setEditMode('screen')} style={{
            padding: '3px 8px', fontSize: 9, fontWeight: 600, border: '1px solid #e0d9ce',
            borderRadius: 4, cursor: 'pointer',
            background: editMode === 'screen' ? '#B8962E' : '#fff',
            color: editMode === 'screen' ? '#fff' : '#888',
          }}>This Screen Only</button>
        </div>
        <button onClick={activeSave} style={{
          padding: '3px 8px', fontSize: 9, fontWeight: 600, border: 'none',
          borderRadius: 5, background: '#B8962E', color: '#fff', cursor: 'pointer',
        }}>Save</button>
      </div>

      <div style={{ fontSize: 9, color: '#999', marginBottom: 6, fontFamily: "'DM Mono', monospace" }}>
        {editMode === 'global'
          ? 'These settings apply to all screens by default.'
          : hasScreenOverride
            ? 'This screen has a custom fit override.'
            : 'No override \u2014 using global fit. Change here to override.'}
      </div>

      {/* Fit mode */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {FIT_MODES.map(m => (
          <button
            key={m.key}
            onClick={() => activeChange({ mode: m.key })}
            style={{
              flex: 1, padding: '5px 0', fontSize: 10, fontWeight: 600, border: '1px solid #e0d9ce',
              borderRadius: 5, cursor: 'pointer',
              background: mode === m.key ? '#2C2C2C' : '#fff',
              color: mode === m.key ? '#fff' : '#888',
            }}
          >{m.label}</button>
        ))}
      </div>

      {/* Scale slider */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <span style={{ fontSize: 9, color: '#999', fontFamily: "'DM Mono', monospace" }}>Scale</span>
          <span style={{ fontSize: 9, color: '#666', fontFamily: "'DM Mono', monospace" }}>{scale}%</span>
        </div>
        <input type="range" min={50} max={200} value={scale} onChange={e => activeChange({ scale: parseInt(e.target.value) })}
          style={{ width: '100%', height: 4, cursor: 'pointer' }} />
      </div>

      {/* Position offsets */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 9, color: '#999', fontFamily: "'DM Mono', monospace" }}>X Offset</span>
            <span style={{ fontSize: 9, color: '#666', fontFamily: "'DM Mono', monospace" }}>{offsetX}%</span>
          </div>
          <input type="range" min={-50} max={50} value={offsetX} onChange={e => activeChange({ offsetX: parseInt(e.target.value) })}
            style={{ width: '100%', height: 4, cursor: 'pointer' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 9, color: '#999', fontFamily: "'DM Mono', monospace" }}>Y Offset</span>
            <span style={{ fontSize: 9, color: '#666', fontFamily: "'DM Mono', monospace" }}>{offsetY}%</span>
          </div>
          <input type="range" min={-50} max={50} value={offsetY} onChange={e => activeChange({ offsetY: parseInt(e.target.value) })}
            style={{ width: '100%', height: 4, cursor: 'pointer' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <button onClick={() => activeChange({ mode: 'cover', scale: 100, offsetX: 0, offsetY: 0 })} style={{
          padding: '3px 8px', fontSize: 9, color: '#999', background: 'none',
          border: '1px solid #eee', borderRadius: 4, cursor: 'pointer',
        }}>Reset</button>
        {editMode === 'screen' && hasScreenOverride && (
          <button onClick={onClearOverride} style={{
            padding: '3px 8px', fontSize: 9, color: '#B8962E', background: 'none',
            border: '1px solid #B8962E30', borderRadius: 4, cursor: 'pointer',
          }}>Use Global Fit</button>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, disabled, color }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '7px 14px', border: `1px solid ${color}20`, borderRadius: 8,
      background: `${color}08`, color, fontSize: 11, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    }}>
      <Icon size={13} /> {label}
    </button>
  );
}

function CreateScreenModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', beat: '', description: '', prompt: '' });
  const [saving, setSaving] = useState(false);
  const fieldStyle = { width: '100%', padding: '8px 10px', border: '1px solid #e8e0d0', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.prompt.trim()) return;
    setSaving(true);
    await onCreate(form);
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0ece4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>New Phone Screen</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Screen Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Feed View, DM Conversation" style={fieldStyle} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Beat / Trigger</label>
                <input value={form.beat} onChange={e => setForm(f => ({ ...f, beat: e.target.value }))} placeholder="e.g., Beat 2, Login" style={fieldStyle} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What the screen shows" style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Generation Prompt</label>
              <textarea value={form.prompt} onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))} rows={3} placeholder="Describe the screen for AI generation..." style={{ ...fieldStyle, resize: 'vertical' }} />
            </div>
            <button type="submit" disabled={saving || !form.name.trim() || !form.prompt.trim()} style={{
              padding: '10px 0', border: 'none', borderRadius: 8,
              background: '#2C2C2C', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}>{saving ? 'Creating...' : 'Create Screen'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
