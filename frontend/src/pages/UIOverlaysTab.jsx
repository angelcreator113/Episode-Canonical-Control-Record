/**
 * UIOverlaysTab — Phone Hub Design
 *
 * The phone is the show's interface. All overlays are phone screens.
 * Left: phone device preview showing active screen
 * Right: screen type grid + actions
 * Bottom: detail panel for selected screen (generate, upload, edit, delete)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Loader, Upload, Trash2, Download, RefreshCw, X, Eraser, Link2, Maximize, Layers, Play, Copy, Info, Monitor, Undo2, ChevronDown, ChevronRight, GitBranch } from 'lucide-react';
import api from '../services/api';
import PhoneHub, { SCREEN_TYPES } from '../components/PhoneHub';
import ScreenLinkEditor from '../components/ScreenLinkEditor';
import ContentZoneEditor from '../components/ContentZoneEditor';
import PhonePreviewMode, { ScreenFlowMap } from '../components/PhonePreviewMode';
import './UIOverlaysTab.css';

export default function UIOverlaysTab({ showId: propShowId }) {
  const [showId, setShowId] = useState(propShowId || null);
  const [shows, setShows] = useState([]);
  const [overlays, setOverlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeScreen, setActiveScreen] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState('phone'); // 'phone' or 'phone_icon'
  const [phoneSkin, setPhoneSkin] = useState('rosegold');
  const [customFrameUrl, setCustomFrameUrl] = useState(null);
  const [editingLinks, setEditingLinks] = useState(false);
  const [navHistory, setNavHistory] = useState([]);  // stack of screen keys for back navigation
  const [globalFit, setGlobalFit] = useState({});    // device-level fit applied to all screens
  const [activeVariantIdx, setActiveVariantIdx] = useState(0);
  const [addingVariant, setAddingVariant] = useState(false);
  const [newVariantLabel, setNewVariantLabel] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [showFlowMap, setShowFlowMap] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ actions: true, fit: false, links: false, content: false, variants: true });
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const undoStackRef = useRef([]);  // undo history for activeScreen changes
  const frameRemovedRef = useRef(false);  // tracks if user explicitly removed the custom frame
  const [batchUploading, setBatchUploading] = useState(false);
  const [hiddenScreens, setHiddenScreens] = useState(() => {
    try { return JSON.parse(localStorage.getItem('phone_hub_hidden') || '[]'); } catch { return []; }
  });
  const [showHidden, setShowHidden] = useState(false);
  const fileInputRef = useRef(null);
  const variantInputRef = useRef(null);
  const frameInputRef = useRef(null);
  const batchInputRef = useRef(null);
  const pollRef = useRef(null);

  // Load phone skin preference
  useEffect(() => {
    const saved = localStorage.getItem('phone_hub_skin');
    if (saved) setPhoneSkin(saved);
  }, []);

  const handleHideScreen = (key) => {
    setHiddenScreens(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      localStorage.setItem('phone_hub_hidden', JSON.stringify(next));
      return next;
    });
  };

  const handleChangeSkin = (skin) => {
    setPhoneSkin(skin);
    localStorage.setItem('phone_hub_skin', skin);
  };

  // ── Undo system ──
  const pushUndo = useCallback(() => {
    if (activeScreen) {
      undoStackRef.current.push(JSON.parse(JSON.stringify(activeScreen)));
      if (undoStackRef.current.length > 20) undoStackRef.current.shift();
    }
  }, [activeScreen]);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current.pop();
    setActiveScreen(prev);
    setOverlays(ov => ov.map(o => o.id === prev.id ? { ...o, ...prev } : o));
    flash('Undone');
  }, []);

  // Close detail panel — revert phone display to home screen
  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setEditingLinks(false);
    undoStackRef.current = [];
    const home = overlays.find(o => o.id === 'home' && o.generated && o.url);
    if (home) setActiveScreen(home);
  }, [overlays]);

  // Ctrl+Z and Escape listener
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if (e.key === 'Escape' && panelOpen) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        closePanel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, panelOpen, closePanel]);

  // Lock body scroll when detail panel is open — mobile only (bottom sheet)
  useEffect(() => {
    if (panelOpen && window.innerWidth <= 768) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [panelOpen]);

  const toggleSection = (key) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  // Load saved phone frame + global fit settings
  useEffect(() => {
    if (!showId) return;
    frameRemovedRef.current = false;  // reset on show change
    api.get(`/api/v1/ui-overlays/${showId}/frame`).then(r => {
      if (!frameRemovedRef.current && r.data?.frame_url) setCustomFrameUrl(r.data.frame_url);
      if (r.data?.global_fit) setGlobalFit(r.data.global_fit);
    }).catch(err => {
      console.warn('[PhoneHub] Failed to load frame/fit settings:', err.message);
    });
  }, [showId]);

  // Upload custom phone frame (persists to S3)
  const handleFrameUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !showId) return;
    frameRemovedRef.current = false;
    const prevUrl = customFrameUrl;
    const previewUrl = URL.createObjectURL(file);
    // Revoke old blob URL to prevent memory leak
    if (prevUrl && prevUrl.startsWith('blob:')) URL.revokeObjectURL(prevUrl);
    setCustomFrameUrl(previewUrl);
    flash('Uploading frame...');
    try {
      const fd = new FormData();
      fd.append('frame', file);
      const res = await api.post(`/api/v1/ui-overlays/${showId}/frame`, fd, { timeout: 30000 });
      if (res.data?.frame_url) {
        setCustomFrameUrl(res.data.frame_url);
        flash('Frame uploaded!');
      } else {
        flash('Frame preview set (upload may still be processing)');
      }
    } catch (err) {
      // Keep the preview URL so the user can still see the frame locally
      console.error('[PhoneHub] Frame upload failed:', err.message);
      flash(err.response?.data?.error || 'Frame upload failed — preview only', 'error');
    }
    if (frameInputRef.current) frameInputRef.current.value = '';
  };

  const flash = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  // Batch upload — match files to screen types by filename
  const handleBatchUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !showId) return;
    // Warn if any existing screens will be overwritten
    const screenKeys = SCREEN_TYPES.filter(t => t.type === 'screen').map(t => t.key);
    const matchCount = files.filter(f => {
      const name = f.name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '_');
      return screenKeys.find(k => name.includes(k) || name.includes(k.replace(/_/g, '')));
    }).length;
    if (matchCount > 0 && overlays.some(o => o.generated)) {
      if (!confirm(`Upload ${files.length} files? This may overwrite ${matchCount} existing screens.`)) {
        if (batchInputRef.current) batchInputRef.current.value = '';
        return;
      }
    }
    setBatchUploading(true);
    let uploaded = 0;
    let failed = 0;

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

  // Load overlays — auto-select home screen as default
  const loadOverlays = useCallback((showLoader) => {
    if (!showId) return;
    if (showLoader) setLoading(true);
    api.get(`/api/v1/ui-overlays/${showId}`)
      .then(r => {
        const data = r.data?.data || [];
        setOverlays(data);
        // Auto-select home screen on first load if nothing is selected
        if (!activeScreen) {
          const home = data.find(o => o.id === 'home' && o.generated && o.url);
          if (home) setActiveScreen(home);
        }
      })
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

  // Upload variant
  const handleVariantUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeScreen?.id || !newVariantLabel.trim() || !showId) return;
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('variant_label', newVariantLabel.trim());
      await api.post(`/api/v1/ui-overlays/${showId}/upload/${activeScreen.id}`, fd);
      flash(`Variant "${newVariantLabel.trim()}" uploaded!`);
      setNewVariantLabel('');
      setAddingVariant(false);
      const res = await api.get(`/api/v1/ui-overlays/${showId}`);
      const all = res.data?.data || [];
      setOverlays(all);
      const updated = all.find(o => o.id === activeScreen.id);
      if (updated) {
        setActiveScreen(updated);
        // Switch to the new variant
        if (updated.variants) setActiveVariantIdx(updated.variants.length - 1);
      }
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
    if (variantInputRef.current) variantInputRef.current.value = '';
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
  const handleDeleteScreen = async (screen) => {
    if (!screen) return;
    if (!confirm(`Delete "${screen.name}"? Any links pointing to this screen will be removed.`)) return;
    try {
      const deletedKey = screen.id;
      if (screen.custom && screen.custom_id) {
        // Custom screen: delete the type definition (removes it from the list entirely)
        await api.delete(`/api/v1/ui-overlays/${showId}/types/${screen.custom_id}`);
      }
      if (screen.asset_id) {
        // Delete the asset (image)
        await api.delete(`/api/v1/ui-overlays/${showId}/asset/${screen.asset_id}`);
      }
      // For built-in screen types, hide them so they don't reappear as placeholders
      if (!screen.custom) {
        handleHideScreen(deletedKey);
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
      if (activeScreen?.id === deletedKey) { closePanel(); }
      loadOverlays(false);
      flash('Deleted');
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };
  const handleDelete = () => handleDeleteScreen(activeScreen);

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

  // Create custom screen or icon
  const handleCreateScreen = async (form) => {
    try {
      await api.post(`/api/v1/ui-overlays/${showId}/types`, { ...form, category: createMode });
      loadOverlays(false);
      setShowCreateModal(false);
      flash(createMode === 'phone_icon' ? 'Icon type created' : 'Screen type created');
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

  // ── Content zones (live data rendering on templates) ──

  const handleSaveContentZones = async (zones) => {
    if (!activeScreen?.asset_id || !showId) return;
    try {
      await api.put(`/api/v1/ui-overlays/${showId}/content-zones/${activeScreen.asset_id}`, { content_zones: zones });
      setOverlays(prev => prev.map(o => o.id === activeScreen.id ? { ...o, content_zones: zones, metadata: { ...(o.metadata || {}), content_zones: zones } } : o));
      setActiveScreen(prev => prev ? { ...prev, content_zones: zones, metadata: { ...(prev.metadata || {}), content_zones: zones } } : prev);
      flash('Content zones saved!');
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  // ── Image fit controls ──

  // Per-screen fit
  const handleUpdateFit = async (fitChanges) => {
    if (!activeScreen) return;
    pushUndo();
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

  // Rename screen
  const handleRename = async (newName) => {
    if (!newName?.trim() || !activeScreen || !showId) return;
    const trimmed = newName.trim();
    pushUndo();
    try {
      if (activeScreen.custom && activeScreen.custom_id) {
        await api.put(`/api/v1/ui-overlays/${showId}/types/${activeScreen.custom_id}`, { name: trimmed });
      }
      if (activeScreen.asset_id) {
        // Update asset name in metadata
        await api.put(`/api/v1/ui-overlays/${showId}/category/${activeScreen.asset_id}`, { category: activeScreen.category || 'phone' });
      }
      setActiveScreen(prev => prev ? { ...prev, name: trimmed } : prev);
      setOverlays(prev => prev.map(o => o.id === activeScreen.id ? { ...o, name: trimmed } : o));
      flash(`Renamed to "${trimmed}"`);
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
    setEditingName(false);
  };

  // Change screen's type (screen vs icon)
  const handleChangeScreenType = async (category) => {
    if (!activeScreen || !showId) return;
    pushUndo();
    try {
      if (activeScreen.custom && activeScreen.custom_id) {
        await api.put(`/api/v1/ui-overlays/${showId}/types/${activeScreen.custom_id}`, { category });
      }
      if (activeScreen.asset_id) {
        await api.put(`/api/v1/ui-overlays/${showId}/category/${activeScreen.asset_id}`, { category });
      }
      const typeField = category === 'phone_icon' ? 'icon' : 'screen';
      setActiveScreen(prev => prev ? { ...prev, category, type: typeField } : prev);
      setOverlays(prev => prev.map(o => o.id === activeScreen.id ? { ...o, category, type: typeField } : o));
      flash(category === 'phone_icon' ? 'Set as Icon' : 'Set as Screen');
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  // Duplicate screen settings to another screen
  const handleDuplicateSettings = async (targetScreenId) => {
    if (!activeScreen || !showId) return;
    const target = overlays.find(o => o.id === targetScreenId);
    if (!target?.asset_id) { flash('Target screen has no asset', 'error'); return; }
    const fit = activeScreen.image_fit || activeScreen.metadata?.image_fit;
    const links = activeScreen.screen_links || activeScreen.metadata?.screen_links;
    try {
      if (fit) await api.put(`/api/v1/ui-overlays/${showId}/image-fit/${target.asset_id}`, { image_fit: fit });
      if (links?.length) await api.put(`/api/v1/ui-overlays/${showId}/screen-links/${target.asset_id}`, { screen_links: links });
      loadOverlays(false);
      flash(`Settings copied to ${target.name}!`);
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  // Export contact sheet — download all screen thumbnails
  const handleExportContactSheet = async () => {
    const generated = overlays.filter(o => o.generated && o.url);
    if (!generated.length) { flash('No screens to export', 'error'); return; }
    // Create a simple HTML table of images and download as page
    const html = `<!DOCTYPE html><html><head><title>Phone Screens - Contact Sheet</title>
<style>body{background:#1a1a2e;margin:40px;font-family:'DM Mono',monospace;color:#fff}
h1{color:#B8962E;font-size:20px;margin-bottom:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.card{background:#2a2a4a;border-radius:12px;overflow:hidden;text-align:center}
.card img{width:100%;aspect-ratio:9/16;object-fit:cover}
.card p{padding:8px;font-size:11px;color:#aaa;margin:0}</style></head>
<body><h1>Phone Screens Contact Sheet</h1><div class="grid">
${generated.map(s => `<div class="card"><img src="${s.url}"/><p>${s.name}</p></div>`).join('')}
</div></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'phone-screens-contact-sheet.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    flash('Contact sheet downloaded!');
  };

  const generatedCount = overlays.filter(o => o.generated).length;

  const headerBtnStyle = {
    padding: '8px 14px', border: '1px solid #e8e0d0', borderRadius: 8,
    background: '#fff', color: '#2C2C2C', fontSize: 11, fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
    fontFamily: "'DM Mono', monospace", minHeight: 36, whiteSpace: 'nowrap',
  };

  return (
    <div style={{ padding: '20px 0' }}>
      {/* Toast */}
      {toast && (
        <div className={`overlays-toast overlays-toast--${toast.type === 'error' ? 'error' : 'success'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="overlays-header">
        <div className="overlays-header-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#2C2C2C', fontFamily: "'Lora', serif" }}>Phone Hub</h2>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>
                {generatedCount}/{overlays.length} screens ready
              </p>
            </div>
            {/* Show selector — visible when no propShowId so user can switch shows */}
            {!propShowId && shows.length > 0 && (
              <select
                value={showId || ''}
                onChange={(e) => setShowId(e.target.value)}
                style={{
                  padding: '6px 10px', border: '1px solid #e8e0d0', borderRadius: 8,
                  fontSize: 12, fontFamily: "'DM Mono', monospace", color: '#2C2C2C',
                  background: '#fff', cursor: 'pointer', minHeight: 36,
                }}
              >
                <option value="" disabled>Select show...</option>
                {shows.map(s => (
                  <option key={s.id} value={s.id}>{s.name || s.title}</option>
                ))}
              </select>
            )}
          </div>
          <div className="overlays-header-actions">
            <button onClick={() => setShowSizeGuide(!showSizeGuide)} title="Upload size guide" aria-label="Toggle upload size guide" style={{ ...headerBtnStyle, color: '#aaa', border: '1px solid #eee' }}>
              <Info size={13} />
            </button>
            <button onClick={() => setShowFlowMap(true)} disabled={!generatedCount} title="Screen flow map" style={{ ...headerBtnStyle, color: '#a889c8', border: '1px solid #a889c830' }}>
              <GitBranch size={13} /> <span className="btn-label">Flow Map</span>
            </button>
            <button onClick={() => setPreviewMode(true)} disabled={!generatedCount} title="Preview mode" style={{ ...headerBtnStyle, color: '#B8962E', border: '1px solid #B8962E30' }}>
              <Play size={13} /> <span className="btn-label">Preview</span>
            </button>
            <button onClick={handleExportContactSheet} disabled={!generatedCount} title="Export contact sheet" style={{ ...headerBtnStyle, color: '#6bba9a', border: '1px solid #6bba9a30' }}>
              <Download size={13} /> <span className="btn-label">Export</span>
            </button>
          </div>
        </div>

        {/* Size guide */}
        {showSizeGuide && (
          <div style={{ background: '#faf8f5', border: '1px solid #e8e0d0', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#666' }}>
            <div style={{ fontWeight: 700, color: '#B8962E', marginBottom: 6, fontSize: 12 }}>Recommended Upload Sizes</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 12px' }}>
              <span style={{ color: '#999' }}>Screens (HD):</span><span><strong>1080 x 1920</strong> px (9:16)</span>
              <span style={{ color: '#999' }}>Screens (Retina):</span><span><strong>1170 x 2532</strong> px (iPhone 15 Pro)</span>
              <span style={{ color: '#999' }}>App Icons:</span><span><strong>512 x 512</strong> px (square)</span>
              <span style={{ color: '#999' }}>Phone Frame:</span><span><strong>1170 x 2532</strong> px (match screen)</span>
            </div>
            <div style={{ marginTop: 6, color: '#aaa', fontSize: 9 }}>PNG with transparency recommended for icons. JPG/PNG for screens.</div>
          </div>
        )}

        {/* Action buttons row */}
        <div className="overlays-toolbar">
          <button onClick={() => frameInputRef.current?.click()} style={headerBtnStyle}>
            <Monitor size={13} /> <span className="btn-label">{customFrameUrl ? 'Change Frame' : 'Upload Frame'}</span>
          </button>
          {customFrameUrl && (
            <button onClick={async () => {
              if (!confirm('Remove custom phone frame?')) return;
              frameRemovedRef.current = true;
              setCustomFrameUrl(null);
              flash('Using built-in frame');
              if (showId) {
                try { await api.delete(`/api/v1/ui-overlays/${showId}/frame`); } catch (err) {
                  console.warn('[PhoneHub] Failed to delete frame:', err.message);
                }
              }
            }} style={{ ...headerBtnStyle, color: '#dc2626', border: '1px solid #dc262620' }}>
              <X size={13} /> <span className="btn-label">Remove Frame</span>
            </button>
          )}
          <button onClick={() => { setCreateMode('phone'); setShowCreateModal(true); }} disabled={!showId} style={headerBtnStyle}>
            + <span className="btn-label">New Screen</span>
          </button>
          <button onClick={() => { setCreateMode('phone_icon'); setShowCreateModal(true); }} disabled={!showId} style={headerBtnStyle}>
            + <span className="btn-label">New Icon</span>
          </button>
          <button onClick={() => batchInputRef.current?.click()} disabled={batchUploading || !showId} style={headerBtnStyle}>
            <Upload size={13} /> <span className="btn-label">{batchUploading ? 'Uploading...' : 'Batch Upload'}</span>
          </button>
          <input ref={batchInputRef} type="file" accept="image/*" multiple onChange={handleBatchUpload} style={{ display: 'none' }} />
          <input ref={frameInputRef} type="file" accept="image/*" onChange={handleFrameUpload} style={{ display: 'none' }} />
          <button onClick={handleGenerateAll} disabled={generating || !showId} style={{
            ...headerBtnStyle, background: generating ? '#eee' : '#2C2C2C',
            color: generating ? '#999' : '#fff', border: 'none',
          }}>
            {generating ? <><Loader size={13} className="spin" /> Generating...</> : <><Sparkles size={13} /> Generate All</>}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          <Loader size={24} className="spin" />
          <p style={{ marginTop: 12, fontSize: 13 }}>Loading phone screens...</p>
        </div>
      ) : (
        <>
        <div className={`phone-hub-layout${panelOpen ? ' panel-open' : ''}`}>
          {/* Phone Hub (phone + grid) — takes full width now */}
          <div className="phone-hub-main">
            <PhoneHub
              screens={overlays}
              activeScreen={activeScreen}
              onSelectScreen={(s) => { setActiveScreen(s); setPanelOpen(true); setNavHistory([]); setEditingLinks(false); setActiveVariantIdx(0); setAddingVariant(false); setEditingName(false); }}
              onDelete={handleDeleteScreen}
              onHideScreen={handleHideScreen}
              hiddenScreens={hiddenScreens}
              showHidden={showHidden}
              onToggleShowHidden={() => setShowHidden(h => !h)}
              onNavigate={handleNavigate}
              navigationHistory={navHistory}
              onBack={handleBack}
              skin={phoneSkin}
              onChangeSkin={handleChangeSkin}
              customFrameUrl={customFrameUrl}
              globalFit={globalFit}
            />
          </div>
        </div>

      {/* ── Slide-over Detail Panel ── */}
      {activeScreen && panelOpen && (
        <>
          {/* Scrim — mobile only (bottom sheet needs backdrop), desktop has no scrim so grid stays clickable */}
          <div className="panel-scrim" onClick={closePanel} />

          {/* Panel */}
          <div className="detail-panel detail-panel-open">
            {/* Mobile drag handle */}
            <div className="detail-panel-drag-handle"><div className="drag-bar" /></div>

            {/* ── Header: thumbnail + name + close ── */}
            <div className="detail-panel-header">
              {(() => {
                const displayUrl = activeScreen.variants?.[activeVariantIdx]?.url || activeScreen.url;
                const isIcon = activeScreen.category === 'phone_icon' || activeScreen.type === 'icon';
                return displayUrl ? (
                  <div style={{
                    width: 48, height: isIcon ? 48 : 80, borderRadius: 8, overflow: 'hidden',
                    background: '#f5f3ee', border: '1px solid #eee', flexShrink: 0,
                  }}>
                    <img src={displayUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{
                    width: 48, height: 80, borderRadius: 8, background: '#f0ece4', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>📱</div>
                );
              })()}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {editingName ? (
                    <input
                      autoFocus
                      value={editNameValue}
                      onChange={e => setEditNameValue(e.target.value)}
                      onBlur={() => handleRename(editNameValue)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(editNameValue);
                        if (e.key === 'Escape') setEditingName(false);
                      }}
                      style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2C', fontFamily: "'Lora', serif", border: '1px solid #B8962E', borderRadius: 6, padding: '4px 8px', outline: 'none', width: '100%' }}
                    />
                  ) : (
                    <div
                      onClick={() => { setEditNameValue(activeScreen.name || ''); setEditingName(true); }}
                      title="Click to rename"
                      style={{ fontSize: 16, fontWeight: 700, color: '#2C2C2C', fontFamily: "'Lora', serif", cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >{activeScreen.name}</div>
                  )}
                  <span style={{
                    fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    background: (activeScreen.category === 'phone_icon' || activeScreen.type === 'icon') ? '#a889c8' : '#B8962E',
                    color: '#fff', letterSpacing: 0.5, flexShrink: 0,
                  }}>
                    {(activeScreen.category === 'phone_icon' || activeScreen.type === 'icon') ? 'ICON' : 'SCREEN'}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 2, fontFamily: "'DM Mono', monospace" }}>
                  {activeScreen.beat && <span style={{ marginRight: 6 }}>{activeScreen.beat}</span>}
                  {activeScreen.description?.slice(0, 60)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                <button onClick={handleUndo} disabled={undoStackRef.current.length === 0} title={undoStackRef.current.length > 0 ? `Undo (${undoStackRef.current.length} changes)` : 'Nothing to undo'} aria-label="Undo" style={{
                  background: 'none', border: '1px solid #eee', borderRadius: 8, cursor: 'pointer',
                  color: undoStackRef.current.length > 0 ? '#B8962E' : '#ddd', padding: '8px', minWidth: 44, minHeight: 44,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><Undo2 size={18} /></button>
                <button onClick={closePanel} aria-label="Close panel" style={{
                  background: 'none', border: '1px solid #eee', borderRadius: 8, cursor: 'pointer', color: '#999', padding: '8px', minWidth: 44, minHeight: 44,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><X size={18} /></button>
              </div>
            </div>

            {/* ── Scrollable body ── */}
            <div className="detail-panel-body">

              {/* Placeholder indicator */}
              {activeScreen.placeholder && (
                <div style={{ fontSize: 11, background: '#f3e8ff', color: '#7c3aed', padding: '6px 10px', borderRadius: 6, marginBottom: 10, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                  New screen — upload an image or generate one to get started
                </div>
              )}

              {/* ── Primary Actions ── */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {!activeScreen.placeholder ? (
                  <>
                    <ActionBtn icon={Sparkles} label={generatingId === activeScreen.id ? '...' : 'Generate'} onClick={() => handleGenerateOne(activeScreen.id)} disabled={generatingId === activeScreen.id} color="#B8962E" primary />
                    <ActionBtn icon={Upload} label="Upload" onClick={() => fileInputRef.current?.click()} color="#7ab3d4" primary />
                  </>
                ) : (
                  <>
                    <ActionBtn icon={Upload} label="Upload" onClick={() => handleAutoCreateAndUpload()} color="#7ab3d4" primary />
                    <ActionBtn icon={Sparkles} label="Generate" onClick={() => handleAutoCreateAndGenerate()} disabled={generatingId === activeScreen.id} color="#B8962E" primary />
                  </>
                )}
              </div>

              {/* ── Type Toggle ── */}
              {activeScreen.asset_id && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <button onClick={() => handleChangeScreenType('phone')} style={{
                    flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, border: '1px solid #e0d9ce',
                    borderRadius: 8, cursor: 'pointer', minHeight: 44,
                    background: activeScreen.category !== 'phone_icon' ? '#B8962E' : '#fff',
                    color: activeScreen.category !== 'phone_icon' ? '#fff' : '#888',
                  }}>Screen</button>
                  <button onClick={() => handleChangeScreenType('phone_icon')} style={{
                    flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, border: '1px solid #e0d9ce',
                    borderRadius: 8, cursor: 'pointer', minHeight: 44,
                    background: activeScreen.category === 'phone_icon' ? '#a889c8' : '#fff',
                    color: activeScreen.category === 'phone_icon' ? '#fff' : '#888',
                  }}>Icon</button>
                </div>
              )}

              {/* ── Variants ── */}
              {(activeScreen.variants?.length > 1 || activeScreen.url) && (
                <div style={{ marginBottom: 12 }}>
                  {activeScreen.variants?.length > 1 && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      {activeScreen.variants.map((v, i) => (
                        <button key={v.asset_id} onClick={() => setActiveVariantIdx(i)} style={{
                          padding: '8px 14px', fontSize: 12, fontWeight: 600,
                          border: `1px solid ${activeVariantIdx === i ? '#B8962E' : '#e0d9ce'}`,
                          borderRadius: 8, cursor: 'pointer', minHeight: 36,
                          background: activeVariantIdx === i ? '#B8962E' : '#fff',
                          color: activeVariantIdx === i ? '#fff' : '#888',
                          maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{v.variant_label}</button>
                      ))}
                      <button onClick={() => setAddingVariant(!addingVariant)} style={{
                        padding: '8px 12px', fontSize: 14, fontWeight: 600,
                        border: '1px dashed #ccc', borderRadius: 8, cursor: 'pointer',
                        background: 'transparent', color: '#aaa', minHeight: 36, minWidth: 36,
                      }}>+</button>
                    </div>
                  )}
                  {addingVariant && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                      <input value={newVariantLabel} onChange={e => setNewVariantLabel(e.target.value)} placeholder="e.g. Locked, Dark Mode" style={{ flex: 1, padding: '8px 10px', border: '1px solid #e0d9ce', borderRadius: 6, fontSize: 13, minHeight: 36 }} />
                      <button onClick={() => newVariantLabel.trim() && variantInputRef.current?.click()} disabled={!newVariantLabel.trim()} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, minHeight: 36, background: newVariantLabel.trim() ? '#b89060' : '#eee', color: newVariantLabel.trim() ? '#fff' : '#ccc', cursor: newVariantLabel.trim() ? 'pointer' : 'not-allowed' }}>Upload</button>
                      <button onClick={() => { setAddingVariant(false); setNewVariantLabel(''); }} style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', color: '#ccc', minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                    </div>
                  )}
                  {!activeScreen.variants && activeScreen.url && !addingVariant && (
                    <button onClick={() => setAddingVariant(true)} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, border: '1px dashed #b89060', borderRadius: 8, cursor: 'pointer', background: 'transparent', color: '#b89060', display: 'flex', alignItems: 'center', gap: 6, minHeight: 36 }}><Layers size={14} /> Add Variant</button>
                  )}
                  <input ref={variantInputRef} type="file" accept="image/*" onChange={handleVariantUpload} style={{ display: 'none' }} />
                </div>
              )}

              {/* ── Image Fit ── */}
              {activeScreen?.url && !activeScreen.placeholder && (
                <>
                  <SectionHeader label="Image Fit" expanded={expandedSections.fit} onToggle={() => toggleSection('fit')} />
                  {expandedSections.fit && (
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
                </>
              )}

              {/* ── Screen Links ── */}
              {activeScreen?.url && !activeScreen.placeholder && (
                <>
                  <SectionHeader label="Tap Zone Links" expanded={expandedSections.links} onToggle={() => toggleSection('links')} badge={(activeScreen.screen_links || activeScreen.metadata?.screen_links || []).length || null} />
                  {expandedSections.links && (
                    <div style={{ marginBottom: 8 }}>
                      <ScreenLinkEditor
                        screenUrl={activeScreen.url}
                        links={activeScreen.screen_links || activeScreen.metadata?.screen_links || []}
                        screenTypes={SCREEN_TYPES.filter(t => t.type === 'screen')}
                        generatedScreenKeys={new Set(overlays.filter(o => o.generated && o.url).map(o => o.id))}
                        iconOverlays={overlays.filter(o => {
                          if (!o.generated || !o.url) return false;
                          // Match by category, type, id prefix, or name pattern
                          return o.category === 'phone_icon'
                            || o.type === 'icon'
                            || (o.id && o.id.startsWith('icon_'))
                            || (o.name && /icon$/i.test(o.name.trim()));
                        })}
                        onSave={handleSaveLinks}
                        onUploadIcon={handleUploadIcon}
                      />
                    </div>
                  )}
                </>
              )}

              {/* ── Content Zones (Live Data Templates) ── */}
              {activeScreen?.url && !activeScreen.placeholder && (
                <>
                  <SectionHeader
                    label="Live Content Zones"
                    expanded={expandedSections.content}
                    onToggle={() => toggleSection('content')}
                    badge={(activeScreen.content_zones || activeScreen.metadata?.content_zones || []).length || null}
                  />
                  {expandedSections.content && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: '#999', marginBottom: 8, lineHeight: 1.5, fontFamily: "'DM Mono', monospace" }}>
                        Draw zones on the template to render live show data (feed posts, profiles, DMs, wardrobe, etc.)
                      </div>
                      <ContentZoneEditor
                        screenUrl={activeScreen.url}
                        zones={activeScreen.content_zones || activeScreen.metadata?.content_zones || []}
                        showId={showId}
                        onSave={handleSaveContentZones}
                      />
                    </div>
                  )}
                </>
              )}

              {/* ── Secondary Actions ── */}
              {!activeScreen.placeholder && (activeScreen.url || activeScreen.asset_id) && (
                <div style={{ borderTop: '1px solid #f0ece4', paddingTop: 12, marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {activeScreen.url && <ActionBtn icon={Download} label="Download" onClick={handleDownload} color="#6bba9a" />}
                  {activeScreen.asset_id && <ActionBtn icon={Eraser} label="Remove BG" onClick={handleRemoveBg} color="#a889c8" />}
                  {activeScreen.url && <ActionBtn icon={Link2} label={editingLinks ? 'Done' : 'Links'} onClick={() => setEditingLinks(!editingLinks)} color={editingLinks ? '#2C2C2C' : '#b89060'} />}
                  {/* Duplicate fit + link settings to another screen */}
                  {activeScreen.url && overlays.filter(o => o.id !== activeScreen.id && o.generated).length > 0 && (
                    <DuplicateSettingsBtn
                      screens={overlays.filter(o => o.id !== activeScreen.id && o.generated)}
                      onDuplicate={handleDuplicateSettings}
                    />
                  )}
                  <ActionBtn icon={Trash2} label="Delete" onClick={handleDelete} color="#dc2626" />
                </div>
              )}
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
          </div>
        </>
      )}
      </>
      )}

      {/* Preview Mode */}
      {previewMode && (
        <PhonePreviewMode
          screens={overlays}
          initialScreen={overlays.find(o => o.id === 'home' && o.generated) || overlays.find(o => o.generated)}
          onClose={() => setPreviewMode(false)}
          globalFit={globalFit}
          phoneSkin={phoneSkin}
        />
      )}

      {/* Flow Map — visual graph of screen-to-screen links */}
      {showFlowMap && (
        <ScreenFlowMap
          screens={overlays}
          onClose={() => setShowFlowMap(false)}
          onSelectScreen={(s) => { setActiveScreen(s); setShowFlowMap(false); }}
        />
      )}

      {/* Create Screen Modal */}
      {showCreateModal && (
        <CreateScreenModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateScreen}
          isIcon={createMode === 'phone_icon'}
        />
      )}

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setEditMode('global')} style={{
            padding: '6px 10px', fontSize: 10, fontWeight: 600, border: '1px solid #e0d9ce',
            borderRadius: 6, cursor: 'pointer', minHeight: 32,
            background: editMode === 'global' ? '#B8962E' : '#fff',
            color: editMode === 'global' ? '#fff' : '#888',
          }}>All Screens</button>
          <button onClick={() => setEditMode('screen')} style={{
            padding: '6px 10px', fontSize: 10, fontWeight: 600, border: '1px solid #e0d9ce',
            borderRadius: 6, cursor: 'pointer', minHeight: 32,
            background: editMode === 'screen' ? '#B8962E' : '#fff',
            color: editMode === 'screen' ? '#fff' : '#888',
          }}>This Screen</button>
        </div>
        <button onClick={activeSave} style={{
          padding: '6px 12px', fontSize: 10, fontWeight: 600, border: 'none',
          borderRadius: 6, background: '#B8962E', color: '#fff', cursor: 'pointer', minHeight: 32,
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
              flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 600, border: '1px solid #e0d9ce',
              borderRadius: 6, cursor: 'pointer', minHeight: 34,
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

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={() => activeChange({ mode: 'cover', scale: 100, offsetX: 0, offsetY: 0 })} style={{
          padding: '6px 10px', fontSize: 10, color: '#999', background: 'none',
          border: '1px solid #eee', borderRadius: 6, cursor: 'pointer', minHeight: 32,
        }}>Reset</button>
        {editMode === 'screen' && hasScreenOverride && (
          <button onClick={onClearOverride} style={{
            padding: '6px 10px', fontSize: 10, color: '#B8962E', background: 'none',
            border: '1px solid #B8962E30', borderRadius: 6, cursor: 'pointer', minHeight: 32,
          }}>Use Global Fit</button>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ label, expanded, onToggle, badge }) {
  return (
    <button onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: 6, width: '100%',
      padding: '10px 0', border: 'none', background: 'none', cursor: 'pointer',
      borderTop: '1px solid #f0ece4', marginTop: 4, minHeight: 36,
    }}>
      {expanded ? <ChevronDown size={12} color="#aaa" /> : <ChevronRight size={12} color="#aaa" />}
      <span style={{ fontSize: 10, fontWeight: 700, color: '#888', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </span>
      {badge && <span style={{ fontSize: 9, background: '#B8962E20', color: '#B8962E', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>{badge}</span>}
    </button>
  );
}

function ActionBtn({ icon: Icon, label, onClick, disabled, color, primary }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', justifyContent: primary ? 'center' : 'flex-start', gap: 6,
      padding: primary ? '10px 16px' : '8px 14px',
      border: primary ? 'none' : `1px solid ${color}20`, borderRadius: 8,
      background: primary ? color : `${color}08`,
      color: primary ? '#fff' : color,
      fontSize: primary ? 13 : 12, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      minHeight: primary ? 42 : 36, whiteSpace: 'nowrap',
      flex: primary ? 1 : undefined,
    }}>
      <Icon size={primary ? 16 : 14} /> {label}
    </button>
  );
}

function DuplicateSettingsBtn({ screens, onDuplicate }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <ActionBtn icon={Copy} label="Copy To" onClick={() => setOpen(!open)} color="#7ab3d4" />
      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
          background: '#fff', border: '1px solid #e8e0d0', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100,
          maxHeight: 200, overflowY: 'auto', minWidth: 180,
        }}>
          <div style={{ padding: '6px 10px', fontSize: 9, fontWeight: 700, color: '#aaa', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #f0ece4' }}>
            Copy fit & links to:
          </div>
          {screens.map(s => (
            <button key={s.id} onClick={() => { onDuplicate(s.id); setOpen(false); }} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
              border: 'none', background: 'none', cursor: 'pointer', fontSize: 12,
              fontWeight: 500, color: '#2C2C2C', minHeight: 36,
            }}>
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateScreenModal({ onClose, onCreate, isIcon = false }) {
  const [form, setForm] = useState({ name: '', beat: '', description: '', prompt: '' });
  const [saving, setSaving] = useState(false);
  const fieldStyle = { width: '100%', padding: '10px 12px', border: '1px solid #e8e0d0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', minHeight: 44 };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.prompt.trim()) return;
    setSaving(true);
    await onCreate(form);
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%', overflow: 'hidden', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0ece4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{isIcon ? 'New App Icon' : 'New Phone Screen'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 8, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>{isIcon ? 'Icon Name' : 'Screen Name'}</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={isIcon ? 'e.g., Spotify, TikTok, Custom App' : 'e.g., Feed View, DM Conversation'} style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Beat / Trigger</label>
              <input value={form.beat} onChange={e => setForm(f => ({ ...f, beat: e.target.value }))} placeholder="e.g., Beat 2, Login" style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What the screen shows" style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Generation Prompt</label>
              <textarea value={form.prompt} onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))} rows={3} placeholder="Describe the screen for AI generation..." style={{ ...fieldStyle, resize: 'vertical' }} />
            </div>
            <button type="submit" disabled={saving || !form.name.trim() || !form.prompt.trim()} style={{
              padding: '12px 0', border: 'none', borderRadius: 8,
              background: '#2C2C2C', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer', minHeight: 44,
            }}>{saving ? 'Creating...' : 'Create Screen'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
