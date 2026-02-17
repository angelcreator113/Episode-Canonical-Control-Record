import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import Stage from './Stage';
import SceneControlsPanel from './SceneControlsPanel';
import SaveIndicator from '../SaveIndicator/SaveIndicator';
import SceneExportDropdown from './SceneExportDropdown';
import { episodeAPI, platformAPI, sceneAPI, saveEpisodeData, wardrobeDefaultsAPI, sceneAssetsAPI } from '../../services/api';
import useSaveManager from '../../hooks/useSaveManager';
import LandscapeRequired from '../LandscapeRequired';
import SceneWardrobePicker from './SceneWardrobePicker';
import AssetUploadModal from './AssetUploadModal';
import AssetSelector from './AssetSelector';
import thumbnailService from '../../services/thumbnailService';
import { startExport, getExportStatus, subscribeToExportProgress, getExportDownload, cancelExport, disconnectSocket } from '../../services/exportService';
import './SceneComposerFull.css';

function SceneComposerFull() {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  
  // Platform selection with multiple format presets
  const [platform, setPlatform] = useState('youtube');
  const platforms = {
    youtube: { width: 1920, height: 1080, ratio: '16:9', name: 'YouTube', icon: '📺' },
    instagram: { width: 1080, height: 1920, ratio: '9:16', name: 'Instagram', icon: '📱' },
    tiktok: { width: 1080, height: 1920, ratio: '9:16', name: 'TikTok', icon: '🎵' },
    twitter: { width: 1200, height: 675, ratio: '16:9', name: 'Twitter', icon: '𝕏' },
    square: { width: 1080, height: 1080, ratio: '1:1', name: 'Square', icon: '⬛' },
    cinema: { width: 2560, height: 1440, ratio: '16:9', name: '4K', icon: '🎬' }
  };
  const currentPlatform = platforms[platform];
  
  // State
  const [showPlatformMenu, setShowPlatformMenu] = useState(false);
  const [episode, setEpisode] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);

  // Selection & Edit Mode State
  const [selected, setSelected] = useState(null); // { type: 'character' | 'ui' | 'background', id }
  const [editLayoutEnabled, setEditLayoutEnabled] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(true); // Safe zones toggle

  // Drag-and-drop state for scene reordering
  const [draggedSceneIndex, setDraggedSceneIndex] = useState(null);
  const [dragOverSceneIndex, setDragOverSceneIndex] = useState(null);
  const [showWardrobePicker, setShowWardrobePicker] = useState(false);
  const [uploadModal, setUploadModal] = useState(null); // null | 'background' | 'character' | 'ui_element'

  // Asset Selector state (library-first flow)
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [assetSelectorType, setAssetSelectorType] = useState('all');
  const [wardrobeDefaults, setWardrobeDefaults] = useState([]); // per-episode character outfit defaults

  // Thumbnail preview state
  const [thumbnailPreview, setThumbnailPreview] = useState(null); // { url, filename, blob }
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [thumbnailSaved, setThumbnailSaved] = useState(false);

  // Video export state
  const [videoExportState, setVideoExportState] = useState('idle'); // idle | saving | exporting | completed | failed
  const [videoExportProgress, setVideoExportProgress] = useState(0);
  const [videoExportStage, setVideoExportStage] = useState('');
  const [videoExportJobId, setVideoExportJobId] = useState(null);
  const [videoExportResult, setVideoExportResult] = useState(null);
  const [videoExportError, setVideoExportError] = useState(null);
  const [videoExportPreview, setVideoExportPreview] = useState(null); // data URL of stage snapshot
  const videoExportUnsubRef = useRef(null);

  // ── Undo / Redo history ──
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const MAX_UNDO = 50;

  // Auto-save + manual save
  const getSavePayload = useCallback(() => ({
    episode: episode ? { title: episode.title, episode_number: episode.episode_number } : {},
    platform: {
      platform,
      width: currentPlatform.width,
      height: currentPlatform.height,
      aspect_ratio: currentPlatform.ratio,
    },
    scenes: scenes.map((scene, idx) => ({
      id: scene.id,
      scene_number: scene.scene_number || idx + 1,
      title: scene.title,
      duration_seconds: scene.duration_seconds,
      background_url: scene.background_url,
      characters: scene.characters,
      ui_elements: scene.ui_elements,
      dialogue_clips: scene.dialogue_clips,
    })),
  }), [episode, platform, scenes, currentPlatform]);

  const { saveStatus, lastSaved, errorMessage, save, markDirty } = useSaveManager({
    episodeId,
    getSavePayload,
    autoSaveDelay: 3000,
    enabled: true
  });

  // Undo / Redo helpers — must be after useSaveManager so markDirty is available
  const getSnapshot = useCallback(() => ({
    scenes: JSON.parse(JSON.stringify(scenes)),
    currentSceneIndex,
  }), [scenes, currentSceneIndex]);

  const pushHistory = useCallback(() => {
    undoStackRef.current.push(getSnapshot());
    if (undoStackRef.current.length > MAX_UNDO) undoStackRef.current.shift();
    redoStackRef.current = [];
    setUndoCount(undoStackRef.current.length);
    setRedoCount(0);
  }, [getSnapshot]);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    redoStackRef.current.push(getSnapshot());
    const prev = undoStackRef.current.pop();
    setScenes(prev.scenes);
    setCurrentSceneIndex(prev.currentSceneIndex);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
    markDirty();
  }, [getSnapshot, markDirty]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    undoStackRef.current.push(getSnapshot());
    const next = redoStackRef.current.pop();
    setScenes(next.scenes);
    setCurrentSceneIndex(next.currentSceneIndex);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
    markDirty();
  }, [getSnapshot, markDirty]);

  const handleDeleteElement = useCallback((type, id) => {
    pushHistory();
    setScenes(prev => {
      const next = [...prev];
      const scene = { ...next[currentSceneIndex] };
      if (type === 'character') {
        scene.characters = (scene.characters || []).filter((c, i) => (c.id || `char-${i}`) !== id);
      } else if (type === 'ui') {
        scene.ui_elements = (scene.ui_elements || []).filter((u, i) => (u.id || `ui-${i}`) !== id);
      } else if (type === 'background') {
        scene.background_url = null;
      }
      next[currentSceneIndex] = scene;
      return next;
    });
    setSelected(null);
    markDirty();
  }, [currentSceneIndex, pushHistory, markDirty]);

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z / Delete / Escape
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y')) {
        e.preventDefault(); handleRedo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !e.target.closest('input, textarea, [contenteditable]')) {
        e.preventDefault();
        handleDeleteElement(selected.type, selected.id);
      } else if (e.key === 'Escape') {
        setSelected(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleUndo, handleRedo, handleDeleteElement, selected]);

  useEffect(() => {
    loadEpisodeData();
  }, [episodeId]);


  const loadEpisodeData = async () => {
    setLoading(true);

    // Load each resource independently so one failure doesn't wipe everything
    let ep = null;
    let plat = null;
    let loadedScenes = null;

    // 1. Load episode
    try {
      const episodeRes = await episodeAPI.getById(episodeId);
      ep = episodeRes.data.data || episodeRes.data.episode || episodeRes.data;
      console.log('📺 Episode loaded:', ep?.title, 'show_id:', ep?.show_id || ep?.showId);
      setEpisode(ep);
    } catch (err) {
      console.warn('⚠️ Episode load failed:', err.message);
      setEpisode({ id: episodeId, title: 'Untitled Episode', episode_number: 1 });
    }

    // 2. Load platform (independent of episode/scenes)
    try {
      const platformRes = await platformAPI.get(episodeId);
      plat = platformRes.data;
      setPlatform(plat.platform || 'youtube');
    } catch (err) {
      console.warn('⚠️ Platform load failed, using default:', err.message);
      setPlatform('youtube');
    }

    // 3. Load scenes (CRITICAL — never lose saved scenes due to other API errors)
    try {
      const scenesRes = await sceneAPI.getAll(episodeId);
      loadedScenes = scenesRes.data.data || scenesRes.data;
      console.log('🎬 Scenes loaded from API:', loadedScenes?.length || 0);
      if (loadedScenes && loadedScenes.length > 0) {
        const mapped = loadedScenes.map((s, i) => ({
          id: s.id,
          scene_number: s.sceneNumber || s.scene_number || i + 1,
          title: s.title || `Scene ${i + 1}`,
          duration_seconds: parseFloat(s.durationSeconds || s.duration_seconds) || 5.0,
          background_url: s.background_url || s.backgroundUrl || null,
          characters: s.characters || [],
          ui_elements: s.uiElements || s.ui_elements || [],
          dialogue_clips: s.dialogueClips || s.dialogue_clips || [],
        }));
        setScenes(mapped);
        console.log('✅ Scenes set:', mapped.map(s => `#${s.scene_number} "${s.title}"`).join(', '));
      } else {
        console.log('ℹ️ No scenes found, creating default starter scene');
        setScenes([{
          id: 'scene-new-1',
          scene_number: 1,
          title: 'Scene 1',
          duration_seconds: 5,
          background_url: null,
          characters: [],
          ui_elements: [],
          dialogue_clips: [],
        }]);
      }
    } catch (err) {
      console.error('❌ Scenes load FAILED:', err.message);
      setScenes([{
        id: 'scene-new-1',
        scene_number: 1,
        title: 'Scene 1',
        duration_seconds: 5,
        background_url: null,
        characters: [],
        ui_elements: [],
        dialogue_clips: [],
      }]);
    }

    // 4. Load wardrobe defaults (non-critical)
    try {
      const wdRes = await wardrobeDefaultsAPI.getAll(episodeId);
      const wdData = wdRes.data?.data || [];
      setWardrobeDefaults(wdData);
      if (wdData.length > 0) console.log(`✅ Loaded ${wdData.length} wardrobe defaults`);
    } catch (wdErr) {
      console.warn('Wardrobe defaults not available:', wdErr.message);
    }

    setLoading(false);
  };

  const handlePlatformChange = async (newPlatform) => {
    setPlatform(newPlatform);
    
    // Save platform choice to episode
    try {
      console.log('✅ Platform saved:', newPlatform);
      markDirty();
    } catch (error) {
      console.error('Failed to save platform:', error);
    }
  };

  const handleSetBackground = () => {
    setUploadModal('background');
  };

  const handleUploadComplete = (url, assetData) => {
    const type = uploadModal;
    setUploadModal(null);
    pushHistory();

    if (type === 'background') {
      setScenes(prev => {
        const next = [...prev];
        const scene = { ...next[currentSceneIndex] };
        scene.background_url = url;
        next[currentSceneIndex] = scene;
        return next;
      });
      console.log('✅ Background set:', url);
    } else if (type === 'character') {
      setScenes(prev => {
        const next = [...prev];
        const scene = { ...next[currentSceneIndex] };
        const chars = [...(scene.characters || [])];
        chars.push({
          id: `char-${Date.now()}`,
          name: assetData?.originalName || 'Character',
          imageUrl: url,
          position: { x: `${30 + Math.random() * 40}%`, y: '60%' }
        });
        scene.characters = chars;
        next[currentSceneIndex] = scene;
        return next;
      });
      console.log('✅ Character added with image:', url);
    } else if (type === 'ui_element') {
      setScenes(prev => {
        const next = [...prev];
        const scene = { ...next[currentSceneIndex] };
        const uiElements = [...(scene.ui_elements || [])];
        uiElements.push({
          id: `ui-${Date.now()}`,
          label: assetData?.originalName || 'UI Element',
          imageUrl: url,
          position: { x: '50%', y: `${10 + Math.random() * 80}%` },
          backgroundColor: 'rgba(102, 126, 234, 0.2)',
          padding: '12px 24px',
          borderRadius: '8px',
          width: '300px',
          height: 'auto'
        });
        scene.ui_elements = uiElements;
        next[currentSceneIndex] = scene;
        return next;
      });
      console.log('✅ UI Element added with image:', url);
    }
    markDirty();
  };

  const handleAddCharacterWithUndo = () => {
    setUploadModal('character');
  };

  const handleAddUIElement = () => {
    setUploadModal('ui_element');
  };

  // ── Asset Selector (Library-First) Flow ──
  const openAssetSelector = (type) => {
    setAssetSelectorType(type);
    setShowAssetSelector(true);
  };

  const handleAssetSelected = (asset) => {
    setShowAssetSelector(false);
    pushHistory();

    const imageUrl = asset.s3_url || asset.s3_url_raw || asset.s3_url_processed
      || asset.thumbnail_url || asset.metadata?.thumbnail_url || asset.metadata?.s3_url;

    if (assetSelectorType === 'background') {
      setScenes(prev => {
        const next = [...prev];
        const scene = { ...next[currentSceneIndex] };
        scene.background_url = imageUrl;
        next[currentSceneIndex] = scene;
        return next;
      });
      console.log('✅ Background set from library:', asset.name);
    } else if (assetSelectorType === 'character') {
      setScenes(prev => {
        const next = [...prev];
        const scene = { ...next[currentSceneIndex] };
        const chars = [...(scene.characters || [])];
        chars.push({
          id: `char-${Date.now()}`,
          name: asset.character_name || asset.outfit_name || asset.name || 'Character',
          imageUrl,
          assetId: asset.id,
          position: { x: `${30 + Math.random() * 40}%`, y: '60%' },
          outfit_era: asset.outfit_era,
          transformation_stage: asset.transformation_stage,
        });
        scene.characters = chars;
        next[currentSceneIndex] = scene;
        return next;
      });
      console.log('✅ Character added from library:', asset.character_name || asset.name);
    } else if (assetSelectorType === 'ui_element' || assetSelectorType === 'prop') {
      setScenes(prev => {
        const next = [...prev];
        const scene = { ...next[currentSceneIndex] };
        const uiElements = [...(scene.ui_elements || [])];
        uiElements.push({
          id: `ui-${Date.now()}`,
          label: asset.name || 'UI Element',
          imageUrl,
          assetId: asset.id,
          position: { x: '50%', y: `${10 + Math.random() * 80}%` },
          backgroundColor: 'rgba(102, 126, 234, 0.2)',
          padding: '12px 24px',
          borderRadius: '8px',
          width: '300px',
          height: 'auto',
        });
        scene.ui_elements = uiElements;
        next[currentSceneIndex] = scene;
        return next;
      });
      console.log('✅ UI Element added from library:', asset.name);
    }

    // Log usage to backend (non-blocking)
    if (currentScene?.id && asset.id) {
      sceneAssetsAPI.add(currentScene.id, {
        assetId: asset.id,
        usageType: assetSelectorType === 'background' ? 'background' : 'overlay',
      }).catch(err => console.warn('Usage log failed:', err.message));
    }

    markDirty();
  };

  // Update element position on canvas (drag-to-move)
  const handleUpdatePosition = (type, id, newPosition) => {
    setScenes(prev => {
      const next = [...prev];
      const scene = { ...next[currentSceneIndex] };
      if (type === 'character') {
        scene.characters = scene.characters.map((c, i) => {
          const cid = c.id || `char-${i}`;
          return cid === id ? { ...c, position: newPosition } : c;
        });
      } else if (type === 'ui') {
        scene.ui_elements = scene.ui_elements.map((u, i) => {
          const uid = u.id || `ui-${i}`;
          return uid === id ? { ...u, position: newPosition } : u;
        });
      }
      next[currentSceneIndex] = scene;
      return next;
    });
    markDirty();
  };

  // Resize element on canvas
  const handleResizeElement = (type, id, newSize) => {
    setScenes(prev => {
      const next = [...prev];
      const scene = { ...next[currentSceneIndex] };
      if (type === 'character') {
        scene.characters = scene.characters.map((c, i) => {
          const cid = c.id || `char-${i}`;
          return cid === id ? { ...c, ...newSize } : c;
        });
      } else if (type === 'ui') {
        scene.ui_elements = scene.ui_elements.map((u, i) => {
          const uid = u.id || `ui-${i}`;
          return uid === id ? { ...u, ...newSize } : u;
        });
      }
      next[currentSceneIndex] = scene;
      return next;
    });
    markDirty();
  };

  // Change layer (z-index) of an element
  const handleLayerChange = (type, id, direction) => {
    setScenes(prev => {
      const next = [...prev];
      const scene = { ...next[currentSceneIndex] };
      const listKey = type === 'character' ? 'characters' : 'ui_elements';
      const defaultZ = type === 'character' ? 5 : 4;
      const list = [...(scene[listKey] || [])];

      // Collect all current layers
      const allLayers = [
        ...(scene.characters || []).map(c => c.layer ?? 5),
        ...(scene.ui_elements || []).map(u => u.layer ?? 4),
      ];
      const maxLayer = Math.max(...allLayers, 1);
      const minLayer = Math.min(...allLayers, 1);

      scene[listKey] = list.map((el, i) => {
        const eid = el.id || `${type === 'character' ? 'char' : 'ui'}-${i}`;
        if (eid !== id) return el;
        const cur = el.layer ?? defaultZ;
        let newLayer = cur;
        if (direction === 'up') newLayer = cur + 1;
        else if (direction === 'down') newLayer = Math.max(1, cur - 1);
        else if (direction === 'front') newLayer = maxLayer + 1;
        else if (direction === 'back') newLayer = Math.max(1, minLayer - 1);
        return { ...el, layer: newLayer };
      });
      next[currentSceneIndex] = scene;
      return next;
    });
    markDirty();
  };

  // ── Helper: load a single image with CORS support ──
  // ── Helper: rewrite S3 URL to go through Vite proxy (avoids CORS) ──
  const S3_BUCKET_URL = 'https://episode-metadata-storage-dev.s3.amazonaws.com';
  const proxyS3Url = (url) => {
    if (!url) return url;
    if (url.startsWith(S3_BUCKET_URL)) {
      return url.replace(S3_BUCKET_URL, '/s3-proxy');
    }
    return url;
  };

  // ── Helper: load a single image for canvas capture ──
  const loadImageCORS = (src) => new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    // Use proxy URL — no CORS needed since it's same-origin through Vite proxy
    const proxiedSrc = proxyS3Url(src);
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn('[capture] Failed to load image:', src?.substring(0, 80));
      resolve(null);
    };
    img.src = proxiedSrc;
  });

  // ── Render scene directly to canvas (bypasses html2canvas entirely) ──
  const renderSceneToCanvas = async (sceneData, scale = 2) => {
    const plat = platforms[platform] || platforms.youtube;
    const W = plat.width;
    const H = plat.height;
    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // Fill black background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Draw background image (object-fit: cover)
    if (sceneData?.background_url) {
      const bgImg = await loadImageCORS(sceneData.background_url);
      if (bgImg) {
        const imgR = bgImg.naturalWidth / bgImg.naturalHeight;
        const canvasR = W / H;
        let sw, sh, sx, sy;
        if (imgR > canvasR) {
          sh = bgImg.naturalHeight;
          sw = sh * canvasR;
          sx = (bgImg.naturalWidth - sw) / 2;
          sy = 0;
        } else {
          sw = bgImg.naturalWidth;
          sh = sw / canvasR;
          sx = 0;
          sy = (bgImg.naturalHeight - sh) / 2;
        }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, W, H);
      }
    }

    // Helper: draw an element image with object-fit: contain inside a box
    const drawContainImage = (img, boxX, boxY, boxW, boxH) => {
      const imgR = img.naturalWidth / img.naturalHeight;
      const boxR = boxW / boxH;
      let dw, dh;
      if (imgR > boxR) {
        dw = boxW;
        dh = boxW / imgR;
      } else {
        dh = boxH;
        dw = boxH * imgR;
      }
      const dx = boxX + (boxW - dw) / 2;
      const dy = boxY + (boxH - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    };

    // Collect all layers (characters + UI elements) and sort by layer order
    const layers = [];

    if (sceneData?.characters) {
      for (const char of sceneData.characters) {
        layers.push({ type: 'character', data: char, layer: char.layer ?? 5 });
      }
    }
    if (sceneData?.ui_elements) {
      for (const el of sceneData.ui_elements) {
        layers.push({ type: 'ui', data: el, layer: el.layer ?? 4 });
      }
    }
    layers.sort((a, b) => a.layer - b.layer);

    for (const item of layers) {
      const el = item.data;
      const imgSrc = item.type === 'character' ? el.imageUrl : el.imageUrl;
      if (!imgSrc) continue;

      const img = await loadImageCORS(imgSrc);
      if (!img) continue;

      // Parse position (percentage) and size (px)
      const posX = parseFloat(el.position?.x) || (item.type === 'character' ? 10 : 50);
      const posY = parseFloat(el.position?.y) || (item.type === 'character' ? 50 : 10);
      const elW = parseInt(el.width) || (item.type === 'character' ? 100 : 120);
      const elH = parseInt(el.height) || (item.type === 'character' ? 150 : 120);

      // Convert percentage position to canvas pixels, then center (translate -50% -50%)
      const canvasElW = elW * (W / 960); // Scale element sizes relative to 960px stage width
      const canvasElH = elH * (W / 960);
      const cx = (posX / 100) * W - canvasElW / 2;
      const cy = (posY / 100) * H - canvasElH / 2;

      drawContainImage(img, cx, cy, canvasElW, canvasElH);
    }

    return canvas;
  };

  // ── Export scene as image ──
  const handleExportSceneAsImage = async (format = 'png') => {
    try {
      const sceneData = scenes[currentSceneIndex];
      if (!sceneData) { alert('No scene to export'); return; }
      const canvas = await renderSceneToCanvas(sceneData, 2);

      canvas.toBlob((blob) => {
        if (!blob) { alert('Failed to generate image'); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const sceneName = sceneData?.title || `Scene_${currentSceneIndex + 1}`;
        const episodeName = episode?.title || 'Episode';
        const platName = platforms[platform]?.name || platform || 'export';
        a.href = url;
        a.download = `${episodeName}_${sceneName}_${platName}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log(`✅ Scene exported as ${format}: ${a.download}`);
      }, `image/${format}`, 0.95);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed: ' + err.message);
    }
  };

  const handleSetAsThumbnail = async () => {
    try {
      const sceneData = scenes[currentSceneIndex];
      if (!sceneData) return;
      const canvas = await renderSceneToCanvas(sceneData, 2);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const filename = `thumbnail_scene${currentSceneIndex + 1}.png`;
        setThumbnailPreview({ url, filename, blob });
        setThumbnailSaved(false);
        console.log('✅ Thumbnail preview ready');
      }, 'image/png');
    } catch (err) {
      console.error('Thumbnail generation failed:', err);
    }
  };

  const handleThumbnailClose = () => {
    if (thumbnailPreview?.url) {
      URL.revokeObjectURL(thumbnailPreview.url);
    }
    setThumbnailPreview(null);
    setThumbnailUploading(false);
    setThumbnailSaved(false);
  };

  const handleThumbnailDownload = () => {
    if (!thumbnailPreview) return;
    const a = document.createElement('a');
    a.href = thumbnailPreview.url;
    a.download = thumbnailPreview.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleThumbnailUpload = async () => {
    if (!thumbnailPreview?.blob || !episodeId) return;
    setThumbnailUploading(true);
    try {
      const res = await thumbnailService.uploadThumbnail(
        episodeId,
        thumbnailPreview.blob,
        thumbnailPreview.filename
      );
      const newUrl = res.data?.data?.thumbnail_url || res.data?.thumbnail_url;
      if (newUrl) {
        setEpisode(prev => prev ? { ...prev, thumbnail_url: newUrl } : prev);
      }
      setThumbnailSaved(true);
      console.log('✅ Thumbnail saved to episode:', newUrl);
    } catch (err) {
      console.error('Thumbnail upload failed:', err);
      alert('Failed to save thumbnail: ' + (err.response?.data?.error || err.message));
    } finally {
      setThumbnailUploading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      const sceneData = scenes[currentSceneIndex];
      if (!sceneData) return;
      const canvas = await renderSceneToCanvas(sceneData, 2);
      canvas.toBlob(async (blob) => {
        if (!blob) { alert('Failed to copy'); return; }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          console.log('\u2705 Scene copied to clipboard');
        } catch (clipErr) {
          console.error('Clipboard write failed:', clipErr);
          alert('Clipboard access denied — try Save as PNG instead.');
        }
      }, 'image/png');
    } catch (err) {
      console.error('Copy to clipboard failed:', err);
    }
  };

  const handleExportAllScenes = async () => {
    for (let i = 0; i < scenes.length; i++) {
      try {
        const sceneData = scenes[i];
        if (!sceneData) continue;
        const canvas = await renderSceneToCanvas(sceneData, 2);
        await new Promise((resolve) => {
          canvas.toBlob((blob) => {
            if (!blob) { resolve(); return; }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const sceneName = sceneData?.title || `Scene_${i + 1}`;
            const episodeName = episode?.title || 'Episode';
            a.href = url;
            a.download = `${episodeName}_${sceneName}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            resolve();
          }, 'image/png');
        });
      } catch (err) {
        console.error(`Export scene ${i + 1} failed:`, err);
      }
    }
    console.log(`\u2705 Exported ${scenes.length} scenes`);
  };


  // ── Video Export ──
  const handleExportVideo = async ({ format, quality }) => {
    // Capture a preview snapshot of the current stage before starting
    try {
      const sceneData = scenes[currentSceneIndex];
      if (sceneData) {
        const snapCanvas = await renderSceneToCanvas(sceneData, 1);
        setVideoExportPreview(snapCanvas.toDataURL('image/jpeg', 0.85));
      }
    } catch (snapErr) {
      console.warn('Could not capture preview snapshot:', snapErr.message);
    }

    // First, auto-save so backend has the latest scenes
    try {
      setVideoExportState('saving');
      setVideoExportProgress(0);
      setVideoExportStage('Saving scenes…');
      setVideoExportError(null);
      setVideoExportResult(null);
      await save();
    } catch (saveErr) {
      console.warn('Auto-save before export failed (continuing):', saveErr.message);
    }

    try {
      setVideoExportState('exporting');
      setVideoExportStage('Queuing export…');

      const result = await startExport(episodeId, {
        platform,
        quality,
        format,
      });

      const jobId = result.jobId;
      setVideoExportJobId(jobId);
      setVideoExportStage('Queued');
      console.log('🎬 Video export job queued:', jobId);

      // Subscribe to real-time progress via Socket.io
      const unsub = subscribeToExportProgress(jobId, {
        onProgress: (data) => {
          setVideoExportProgress(data.percent || data.progress || 0);
          setVideoExportStage(data.stage || 'Processing…');
        },
        onComplete: (data) => {
          setVideoExportState('completed');
          setVideoExportProgress(100);
          setVideoExportStage('Complete');
          setVideoExportResult(data);
          console.log('✅ Video export completed:', data);
        },
        onFailed: (data) => {
          setVideoExportState('failed');
          setVideoExportStage('Failed');
          setVideoExportError(data?.error || data?.message || 'Export failed');
          console.error('❌ Video export failed:', data);
        },
      });
      videoExportUnsubRef.current = unsub;

      // Also poll status as a fallback (socket may not fire)
      const pollInterval = setInterval(async () => {
        try {
          const status = await getExportStatus(jobId);
          if (status.state === 'completed') {
            clearInterval(pollInterval);
            setVideoExportState('completed');
            setVideoExportProgress(100);
            setVideoExportStage('Complete');
            setVideoExportResult(status.result);
          } else if (status.state === 'failed') {
            clearInterval(pollInterval);
            setVideoExportState('failed');
            setVideoExportStage('Failed');
            setVideoExportError(status.error || 'Export failed');
          } else {
            setVideoExportProgress(status.progress || 0);
            if (status.stage) setVideoExportStage(status.stage);
          }
        } catch (pollErr) {
          // Polling error — non-fatal, socket may still work
        }
      }, 3000);

      // Store interval so we can clear on unmount / cancel
      videoExportUnsubRef.current = () => {
        unsub();
        clearInterval(pollInterval);
      };
    } catch (err) {
      console.error('Video export request failed:', err);
      setVideoExportState('failed');
      setVideoExportStage('Failed');
      setVideoExportError(err.response?.data?.message || err.message || 'Failed to start export');
    }
  };

  const handleCancelVideoExport = async () => {
    if (videoExportJobId) {
      try {
        await cancelExport(videoExportJobId);
        console.log('🛑 Video export cancelled:', videoExportJobId);
      } catch (err) {
        console.warn('Cancel request failed:', err.message);
      }
    }
    if (videoExportUnsubRef.current) {
      videoExportUnsubRef.current();
      videoExportUnsubRef.current = null;
    }
    setVideoExportState('idle');
    setVideoExportProgress(0);
    setVideoExportStage('');
    setVideoExportJobId(null);
    setVideoExportError(null);
    setVideoExportResult(null);
    setVideoExportPreview(null);
  };

  const handleDownloadExport = async () => {
    if (!videoExportJobId) return;
    try {
      // Stream through our backend proxy to avoid S3 CORS issues
      const proxyUrl = `/api/v1/export/file/${videoExportJobId}`;
      const a = document.createElement('a');
      a.href = proxyUrl;
      a.download = `export-${videoExportJobId}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      console.log('⬇️ Export download started via proxy for job:', videoExportJobId);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Download failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDismissVideoExport = () => {
    if (videoExportUnsubRef.current) {
      videoExportUnsubRef.current();
      videoExportUnsubRef.current = null;
    }
    setVideoExportState('idle');
    setVideoExportProgress(0);
    setVideoExportStage('');
    setVideoExportJobId(null);
    setVideoExportError(null);
    setVideoExportResult(null);
    setVideoExportPreview(null);
  };

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      if (videoExportUnsubRef.current) videoExportUnsubRef.current();
      disconnectSocket();
    };
  }, []);

  // Scene drag-and-drop handlers
  const handleSceneDragStart = (e, index) => {
    setDraggedSceneIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    e.currentTarget.style.opacity = '0.4';
  };

  const handleSceneDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedSceneIndex(null);
    setDragOverSceneIndex(null);
  };

  const handleSceneDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSceneIndex !== index) {
      setDragOverSceneIndex(index);
    }
  };

  const handleSceneDragLeave = () => {
    setDragOverSceneIndex(null);
  };

  const handleSceneDrop = (e, toIndex) => {
    e.preventDefault();
    e.stopPropagation();
    pushHistory();
    const fromIndex = draggedSceneIndex;
    setDraggedSceneIndex(null);
    setDragOverSceneIndex(null);

    if (fromIndex === null || fromIndex === toIndex) return;

    setScenes(prev => {
      const reordered = [...prev];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      // Re-number scenes and update auto-generated titles
      return reordered.map((s, i) => ({
        ...s,
        scene_number: i + 1,
        title: /^Scene \d+$/.test(s.title) ? `Scene ${i + 1}` : s.title
      }));
    });

    // Update currentSceneIndex to follow the moved scene
    if (currentSceneIndex === fromIndex) {
      setCurrentSceneIndex(toIndex);
    } else if (fromIndex < currentSceneIndex && toIndex >= currentSceneIndex) {
      setCurrentSceneIndex(currentSceneIndex - 1);
    } else if (fromIndex > currentSceneIndex && toIndex <= currentSceneIndex) {
      setCurrentSceneIndex(currentSceneIndex + 1);
    }

    console.log('✅ Scenes reordered:', fromIndex, '→', toIndex);
    markDirty();
  };

  const handleDeleteScene = (index, e) => {
    e.stopPropagation();
    if (scenes.length <= 1) {
      alert('Cannot delete the last scene');
      return;
    }
    if (!confirm(`Delete "${scenes[index].title}"?`)) return;
    pushHistory();
    
    setScenes(prev => {
      const updated = prev.filter((_, i) => i !== index)
        .map((s, i) => ({
          ...s,
          scene_number: i + 1,
          title: /^Scene \d+$/.test(s.title) ? `Scene ${i + 1}` : s.title
        }));
      return updated;
    });
    if (currentSceneIndex >= scenes.length - 1) {
      setCurrentSceneIndex(Math.max(0, scenes.length - 2));
    } else if (index < currentSceneIndex) {
      setCurrentSceneIndex(currentSceneIndex - 1);
    }
    console.log('✅ Scene deleted');
    markDirty();
  };

  const totalDuration = scenes.reduce((sum, scene) => 
    sum + (parseFloat(scene.duration_seconds) || 0), 0
  );

  const currentScene = scenes[currentSceneIndex] || null;

  if (loading) {
    return (
      <div className="scene-composer-full">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading episode...</p>
        </div>
      </div>
    );
  }

  return (
    <LandscapeRequired>
    <div className="scene-composer-full">
      {/* Header with Platform Selector and Export Dropdown */}
      <header className="composer-header">
        <div className="header-left">
          <button className="back-button" onClick={() => navigate(`/episodes/${episodeId}`)}>
            ← Back
          </button>
          <div className="episode-info">
            <h1>Scene Composer</h1>
            <span className="episode-meta">
              Episode {episode?.episode_number} · Scene {currentSceneIndex + 1}/{scenes.length}
            </span>
          </div>
        </div>

        {/* Platform Selector Dropdown */}
        <div className="header-center">
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Undo / Redo */}
            <div className="undo-redo-group">
              <button
                className="undo-redo-btn"
                onClick={handleUndo}
                disabled={undoCount === 0}
                title="Undo (Ctrl+Z)"
              >↩</button>
              <button
                className="undo-redo-btn"
                onClick={handleRedo}
                disabled={redoCount === 0}
                title="Redo (Ctrl+Shift+Z)"
              >↪</button>
            </div>

            {/* Platform Selector Dropdown */}
            <div className="platform-dropdown-wrapper">
              <button 
                className="platform-dropdown-btn"
                onClick={() => setShowPlatformMenu(!showPlatformMenu)}
                title={currentPlatform.name}
              >
                <span className="platform-icon">{currentPlatform.icon}</span>
                <span className="platform-dropdown-label">Format</span>
                <span className="dropdown-arrow">▼</span>
              </button>
              
              {showPlatformMenu && (
                <div className="platform-menu">
                  {Object.entries(platforms).map(([key, p]) => (
                    <button
                      key={key}
                      className={`platform-menu-item ${platform === key ? 'active' : ''}`}
                      onClick={() => {
                        handlePlatformChange(key);
                        setShowPlatformMenu(false);
                      }}
                    >
                      <span className="menu-icon">{p.icon}</span>
                      <span className="menu-text">
                        <span className="menu-name">{p.name}</span>
                        <span className="menu-ratio">{p.ratio}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Export Dropdown */}
        <div className="header-right">
          <SceneExportDropdown
            onSaveAsImage={() => handleExportSceneAsImage('png')}
            onSaveAsJpeg={() => handleExportSceneAsImage('jpeg')}
            onSetAsThumbnail={handleSetAsThumbnail}
            onCopyToClipboard={handleCopyToClipboard}
            onExportAllScenes={handleExportAllScenes}
            onExportVideo={handleExportVideo}
            videoExporting={videoExportState === 'exporting' || videoExportState === 'saving'}
          />
        </div>
      </header>

      {/* BUILD MODE */}
      <div className="build-mode">
        {/* Scene Flow (Left) */}
        <aside className="scene-flow-panel">
          <div className="panel-header">
            <h3>Scene Flow</h3>
            <button className="add-scene-btn" onClick={() => {
              pushHistory();
              const nextNum = scenes.length + 1;
              const newScene = {
                id: `scene-${Date.now()}`,
                scene_number: nextNum,
                title: `Scene ${nextNum}`,
                duration_seconds: 5,
                background_url: null,
                characters: [],
                ui_elements: [],
                dialogue_clips: []
              };
              setScenes([...scenes, newScene]);
              setCurrentSceneIndex(scenes.length);
              markDirty();
            }}>
              + Add Scene
            </button>
          </div>
          <div className="scene-list">
            {scenes.map((scene, index) => (
              <div 
                key={scene.id}
                className={`scene-card ${index === currentSceneIndex ? 'active' : ''} ${dragOverSceneIndex === index ? 'drag-over' : ''} ${draggedSceneIndex === index ? 'dragging' : ''}`}
                onClick={() => setCurrentSceneIndex(index)}
                draggable
                onDragStart={(e) => handleSceneDragStart(e, index)}
                onDragEnd={handleSceneDragEnd}
                onDragOver={(e) => handleSceneDragOver(e, index)}
                onDragLeave={handleSceneDragLeave}
                onDrop={(e) => handleSceneDrop(e, index)}
              >
                <div className="scene-drag-grip" title="Drag to reorder">⠿</div>
                <div className="scene-number">{scene.scene_number}</div>
                <div className="scene-details">
                  <div className="scene-title">{scene.title}</div>
                  <div className="scene-meta">{scene.duration_seconds}s</div>
                </div>
                {scenes.length > 1 && (
                  <button
                    className="scene-delete-btn"
                    onClick={(e) => handleDeleteScene(index, e)}
                    title="Delete scene"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* Canvas (Center) - Uses reusable Stage component */}
        <main className="scene-canvas">
          {currentScene ? (
            <Stage
              platform={currentPlatform}
              scene={currentScene}
              currentTime={currentTime}
              interactionMode="edit"
              selected={selected}
              onSelect={setSelected}
              onUpdatePosition={handleUpdatePosition}
              onResizeElement={handleResizeElement}
              onDeleteElement={handleDeleteElement}
              showPlatformBadge={true}
              showSafeZones={showSafeZones}
            />
          ) : (
            <div className="stage-no-scene">
              <p>No scenes yet</p>
              <button onClick={() => {/* add scene */}}>Create First Scene</button>
            </div>
          )}
        </main>

        {/* Controls (Right) - Reusable control panel */}
        <SceneControlsPanel
          currentScene={currentScene}
          scenes={scenes}
          currentSceneIndex={currentSceneIndex}
          onSetBackground={() => openAssetSelector('background')}
          onAddCharacter={() => openAssetSelector('character')}
          onAddUIElement={() => openAssetSelector('ui_element')}
          onUploadBackground={handleSetBackground}
          onUploadCharacter={handleAddCharacterWithUndo}
          onUploadUIElement={handleAddUIElement}
          onDeleteElement={handleDeleteElement}
          onResizeElement={handleResizeElement}
          onLayerChange={handleLayerChange}
          onAssignWardrobe={() => {
            if (!currentScene?.characters || currentScene.characters.length === 0) {
              alert('Please add a character first');
              return;
            }
            setShowWardrobePicker(true);
          }}
          onDurationChange={(e) => {
            setScenes(prev => {
              const next = [...prev];
              const scene = { ...next[currentSceneIndex] };
              scene.duration_seconds = parseInt(e.target.value) || 5;
              next[currentSceneIndex] = scene;
              return next;
            });
            markDirty();
          }}
          selected={selected}
          showSafeZones={showSafeZones}
          onToggleSafeZones={() => setShowSafeZones(!showSafeZones)}
        />
      </div>

      {/* Wardrobe Picker Modal */}
      {showWardrobePicker && (
        <SceneWardrobePicker
          episodeId={episodeId}
          showId={episode?.show_id || episode?.showId}
          characters={currentScene?.characters || []}
          onAssign={(characterId, outfitId, imageUrl) => {
            setScenes(prev => {
              const next = [...prev];
              const scene = { ...next[currentSceneIndex] };
              scene.characters = (scene.characters || []).map(c =>
                c.id === characterId ? { ...c, outfitId, imageUrl: imageUrl || c.imageUrl } : c
              );
              next[currentSceneIndex] = scene;
              return next;
            });
            markDirty();
            setShowWardrobePicker(false);
          }}
          onClose={() => setShowWardrobePicker(false)}
        />
      )}

      {/* Asset Upload Modal (fallback when uploading new) */}
      {uploadModal && (
        <AssetUploadModal
          assetType={uploadModal}
          onUploadComplete={handleUploadComplete}
          onClose={() => setUploadModal(null)}
        />
      )}

      {/* Asset Selector Modal (library-first flow) */}
      {showAssetSelector && (
        <AssetSelector
          show_id={episode?.show_id || episode?.showId}
          assetType={assetSelectorType}
          onSelect={handleAssetSelected}
          onClose={() => setShowAssetSelector(false)}
        />
      )}

      {/* Video Export Progress Modal */}
      {videoExportState !== 'idle' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={(e) => { if (videoExportState === 'completed' || videoExportState === 'failed') handleDismissVideoExport(); }}
        >
          <div
            style={{
              background: 'rgba(22, 22, 34, 0.98)',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              padding: '28px',
              maxWidth: '640px',
              width: '90vw',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              animation: 'exportSlideDown 0.2s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 600 }}>
                🎬 Video Export
              </h3>
              {(videoExportState === 'completed' || videoExportState === 'failed') && (
                <button
                  onClick={handleDismissVideoExport}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    color: '#999',
                    fontSize: '18px',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >×</button>
              )}
            </div>

            {/* Preview area — snapshot during export, video player when complete */}
            <div style={{
              borderRadius: '10px',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.08)',
              background: '#000',
              position: 'relative',
              aspectRatio: `${currentPlatform?.width || 16} / ${currentPlatform?.height || 9}`,
              maxHeight: '340px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {videoExportState === 'completed' && videoExportJobId ? (
                <video
                  src={`/api/v1/export/file/${videoExportJobId}?preview=true`}
                  controls
                  autoPlay
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                />
              ) : videoExportPreview ? (
                <>
                  <img
                    src={videoExportPreview}
                    alt="Export preview"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', opacity: 0.6 }}
                  />
                  {/* Animated overlay during processing */}
                  {(videoExportState === 'saving' || videoExportState === 'exporting') && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0,0,0,0.4)',
                    }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        border: '3px solid rgba(255,255,255,0.15)',
                        borderTopColor: '#764ba2',
                        borderRadius: '50%',
                        animation: 'exportSpin 1s linear infinite',
                      }} />
                      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginTop: '12px', fontWeight: 500 }}>
                        Rendering…
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                  Preparing export…
                </div>
              )}
            </div>

            {/* Stage label */}
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', textTransform: 'capitalize' }}>
              {videoExportStage || (videoExportState === 'saving' ? 'Saving scenes…' : 'Initializing…')}
            </div>

            {/* Progress bar */}
            <div style={{
              width: '100%',
              height: '6px',
              background: 'rgba(255,255,255,0.08)',
              borderRadius: '3px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.max(videoExportProgress, videoExportState === 'saving' ? 5 : 0)}%`,
                height: '100%',
                borderRadius: '3px',
                background: videoExportState === 'failed'
                  ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                  : videoExportState === 'completed'
                    ? 'linear-gradient(90deg, #10b981, #059669)'
                    : 'linear-gradient(90deg, #667eea, #764ba2)',
                transition: 'width 0.4s ease',
              }} />
            </div>

            {/* Progress text */}
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textAlign: 'center' }}>
              {videoExportState === 'saving' && 'Auto-saving before export…'}
              {videoExportState === 'exporting' && `${Math.round(videoExportProgress)}% — Job #${videoExportJobId || '…'}`}
              {videoExportState === 'completed' && '✅ Export completed — preview your video above'}
              {videoExportState === 'failed' && `❌ ${videoExportError || 'Export failed'}`}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              {(videoExportState === 'saving' || videoExportState === 'exporting') && (
                <button
                  onClick={handleCancelVideoExport}
                  style={{
                    padding: '8px 20px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    color: '#aaa',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >Cancel</button>
              )}
              {videoExportState === 'completed' && (
                <>
                  <button
                    onClick={handleDismissVideoExport}
                    style={{
                      padding: '8px 20px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      color: '#aaa',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >Dismiss</button>
                  <button
                    onClick={handleDownloadExport}
                    style={{
                      padding: '8px 20px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >⬇️ Download Video</button>
                </>
              )}
              {videoExportState === 'failed' && (
                <>
                  <button
                    onClick={handleDismissVideoExport}
                    style={{
                      padding: '8px 20px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      color: '#aaa',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >Dismiss</button>
                  <button
                    onClick={() => handleExportVideo({ format: 'mp4', quality: '1080p' })}
                    style={{
                      padding: '8px 20px',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >🔄 Retry</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Thumbnail Preview Modal */}
      {thumbnailPreview && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={handleThumbnailClose}
        >
          <div
            style={{
              background: 'rgba(22, 22, 34, 0.98)',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              padding: '24px',
              maxWidth: '720px',
              width: '90vw',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              animation: 'exportSlideDown 0.2s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 600 }}>
                🎞️ Thumbnail Preview
              </h3>
              <button
                onClick={handleThumbnailClose}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: 'none',
                  color: '#999',
                  fontSize: '18px',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >×</button>
            </div>

            {/* Preview Image */}
            <div
              style={{
                borderRadius: '10px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.08)',
                background: '#000',
              }}
            >
              <img
                src={thumbnailPreview.url}
                alt="Thumbnail preview"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                }}
              />
            </div>

            {/* Info */}
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
              {thumbnailPreview.filename}
              {episode?.thumbnail_url && (
                <span style={{ marginLeft: '12px', color: 'rgba(255,255,255,0.3)' }}>
                  Current: {episode.thumbnail_url.split('/').pop()}
                </span>
              )}
            </div>

            {/* Saved confirmation */}
            {thumbnailSaved && (
              <div style={{
                padding: '8px 12px',
                background: 'rgba(16,185,129,0.15)',
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '8px',
                color: '#34d399',
                fontSize: '13px',
                fontWeight: 500,
              }}>
                ✅ Thumbnail saved to episode successfully!
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleThumbnailClose}
                style={{
                  padding: '8px 20px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  color: '#aaa',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >Cancel</button>
              <button
                onClick={handleThumbnailDownload}
                style={{
                  padding: '8px 20px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >⬇️ Download</button>
              <button
                onClick={handleThumbnailUpload}
                disabled={thumbnailUploading || thumbnailSaved}
                style={{
                  padding: '8px 20px',
                  background: thumbnailSaved
                    ? 'rgba(16,185,129,0.2)'
                    : 'linear-gradient(135deg, #667eea, #764ba2)',
                  border: thumbnailSaved ? '1px solid rgba(16,185,129,0.4)' : 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: thumbnailUploading || thumbnailSaved ? 'default' : 'pointer',
                  opacity: thumbnailUploading ? 0.7 : 1,
                }}
              >{thumbnailUploading ? '⏳ Uploading…' : thumbnailSaved ? '✅ Saved' : '🚀 Save to Episode'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
    </LandscapeRequired>
  );
}

export default SceneComposerFull;
