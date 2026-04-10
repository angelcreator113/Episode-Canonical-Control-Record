import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Play, Lock, Sparkles, Loader, AlertCircle, Plus, X, Clock, CheckCircle2, Trash2, RotateCcw, RefreshCw, Upload, Pencil, Save, MoreVertical, Eye, ChevronLeft, ChevronRight, Heart, Tv, Film, Search, Grid3X3, FileText, ShieldCheck, ShieldAlert, MapPin, Box } from 'lucide-react';
import './SceneSetsTab.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

// ─── STATUS PILL ─────────────────────────────────────────────────────────────

function StatusPill({ status }) {
  const config = {
    complete:   { label: 'Ready',      bg: '#E8F5E9', color: '#1A7A40', dotColor: '#1A7A40' },
    generating: { label: 'Generating', bg: '#FFF8E1', color: '#B8960C', dotColor: '#B8960C' },
    pending:    { label: 'Pending',    bg: '#F5F5F5', color: '#888',    dotColor: '#CCC'    },
    failed:     { label: 'Failed',     bg: '#FFEBEE', color: '#C62828', dotColor: '#C62828' },
  };
  const c = config[status] || config.pending;
  return (
    <span className="scene-sets-status-pill" style={{ background: c.bg, color: c.color }}>
      <span
        className={`scene-sets-status-dot${status === 'generating' ? ' pulse' : ''}`}
        style={{ background: c.dotColor }}
      />
      {c.label}
    </span>
  );
}

// ─── SCENE TYPE BADGE ─────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  const config = {
    HOME_BASE:      { label: 'Home Base',  color: '#5C3D8F', bg: '#EDE7F6' },
    CLOSET:         { label: 'Closet',     color: '#1A5276', bg: '#D6EAF8' },
    EVENT_LOCATION: { label: 'Event',      color: '#7B3F00', bg: '#FDEBD0' },
    TRANSITION:     { label: 'Transition', color: '#145A32', bg: '#D5F5E3' },
    OTHER:          { label: 'Other',      color: '#616161', bg: '#F5F5F5' },
  };
  const c = config[type] || config.OTHER;
  return (
    <span className="scene-sets-type-badge" style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

// ─── IMAGE LIGHTBOX (base image) ──────────────────────────────────────────────

function ImageLightbox({ images: initialImages, initialIndex, onClose, onDeleteAngle, onPromoteToBase, setId }) {
  const [images, setImages] = useState(initialImages);
  const [idx, setIdx] = useState(initialIndex || 0);
  const current = images[idx] || images[0];

  // Sync if parent passes new images
  useEffect(() => { setImages(initialImages); }, [initialImages]);


  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIdx(i => (i > 0 ? i - 1 : images.length - 1));
      if (e.key === 'ArrowRight') setIdx(i => (i < images.length - 1 ? i + 1 : 0));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, images.length]);

  const goPrev = (e) => { e.stopPropagation(); setIdx(i => (i > 0 ? i - 1 : images.length - 1)); };
  const goNext = (e) => { e.stopPropagation(); setIdx(i => (i < images.length - 1 ? i + 1 : 0)); };

  const handleDelete = () => {
    if (!current?.angleId || !onDeleteAngle) return;
    if (!window.confirm(`Delete angle "${current.label}"? This cannot be undone.`)) return;
    onDeleteAngle(current.angleId);
    const newImages = images.filter((_, i) => i !== idx);
    if (newImages.length === 0) { onClose(); return; }
    setImages(newImages);
    setIdx(i => Math.min(i, newImages.length - 1));
  };

  return createPortal(
    <div className="scene-sets-lightbox-overlay" onClick={onClose}>
      <div className="scene-sets-lightbox" onClick={e => e.stopPropagation()}>
        <button className="scene-sets-lightbox-close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="scene-sets-lightbox-stage">
          {images.length > 1 && (
            <button className="scene-sets-lightbox-nav prev" onClick={goPrev}>
              <ChevronLeft size={24} />
            </button>
          )}

          <div className="scene-sets-lightbox-media">
            {current.videoUrl ? (
              <video src={current.videoUrl} className="scene-sets-lightbox-video" controls autoPlay loop muted />
            ) : (
              <img src={current.src} alt={current.label} className="scene-sets-lightbox-img" />
            )}
          </div>

          {images.length > 1 && (
            <button className="scene-sets-lightbox-nav next" onClick={goNext}>
              <ChevronRight size={24} />
            </button>
          )}
        </div>

        {/* Bottom info + actions */}
        <div className="scene-sets-lightbox-info">
          <span className="scene-sets-lightbox-label">{current.label}</span>
          <span className="scene-sets-lightbox-counter">{idx + 1} / {images.length}</span>
          {current.angleId && onPromoteToBase && (
            <button className="scene-sets-lightbox-promote" onClick={async () => {
              if (!confirm(`Use "${current.label}" as the new base image? All other angles will be reset.`)) return;
              try {
                const r = await fetch(`${(typeof API_BASE !== 'undefined' ? API_BASE : '/api/v1')}/scene-sets/${setId}/promote-to-base`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ angle_id: current.angleId }),
                });
                const d = await r.json();
                if (d.success) { onPromoteToBase(); onClose(); }
              } catch { /* handled by caller */ }
            }} title="Use this image as the base">
              <Heart size={14} /> Use as Base
            </button>
          )}
          {current.angleId && onDeleteAngle && (
            <button className="scene-sets-lightbox-delete" onClick={handleDelete} title="Delete this angle">
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>

        {images.length > 1 && (
          <div className="scene-sets-lightbox-thumbstrip">
            {images.map((img, i) => (
              <button
                key={i}
                className={`scene-sets-lightbox-thumb${i === idx ? ' active' : ''}`}
                onClick={() => setIdx(i)}
              >
                <img src={img.thumbSrc || img.src} alt={img.label} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── ARTIFACT REVIEW MODAL + CATEGORIES ──────────────────────────────────────
// ─── ARTIFACT REVIEW MODAL ───────────────────────────────────────────────────

const ARTIFACT_CATEGORIES = {
  FURNITURE_DISTORTION: { label: 'Furniture Distortion', description: 'Warped legs, impossible geometry on chairs/tables' },
  OBJECT_BLOBBING: { label: 'Blobby Objects', description: 'Small surface objects lack defined shapes' },
  REFLECTION_ERROR: { label: 'Reflection Error', description: 'Mirrors show incoherent reflections' },
  FABRIC_ANOMALY: { label: 'Fabric Anomaly', description: 'Unnatural stiff folds or melting edges' },
  HARDWARE_INCONSISTENCY: { label: 'Hardware Inconsistency', description: 'Drawer handles vary in size/shape' },
  FLOOR_DISTORTION: { label: 'Floor Distortion', description: 'Floor patterns warp near furniture' },
  HAND_BODY: { label: 'Hand/Body Error', description: 'Malformed hands or anatomy' },
  TEXT_BLEED: { label: 'Text Bleed', description: 'Phantom text or symbols in the image' },
};

function ArtifactReviewModal({ angle, setId, onClose, onSubmit }) {
  const [selected, setSelected] = useState([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const toggle = (cat) => {
    setSelected(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const handleSubmitReview = async () => {
    if (selected.length === 0) return;
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/scene-sets/${setId}/angles/${angle.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: selected, notes: notes.trim() || null }),
      });
      onSubmit('review');
    } catch {
      onSubmit('error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerate = async () => {
    if (selected.length === 0) return;
    setSubmitting(true);
    try {
      // Submit review first, then regenerate
      await fetch(`${API_BASE}/scene-sets/${setId}/angles/${angle.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: selected, notes: notes.trim() || null }),
      });
      await fetch(`${API_BASE}/scene-sets/${setId}/angles/${angle.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: selected }),
      });
      onSubmit('regenerate');
    } catch {
      onSubmit('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="scene-sets-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="scene-sets-artifact-modal">
        <div className="scene-sets-artifact-modal-header">
          <h3>Quality Review: {angle.angle_name}</h3>
          <button onClick={onClose} className="scene-sets-modal-close"><X size={16} /></button>
        </div>

        {angle.still_image_url && (
          <div className="scene-sets-artifact-preview">
            <img
              src={angle.still_image_url}
              alt={angle.angle_name}
              onClick={() => setPreviewOpen(!previewOpen)}
              className={previewOpen ? 'expanded' : ''}
            />
            {angle.quality_score != null && (
              <div className="scene-sets-artifact-score">
                Quality: {angle.quality_score}/100 · Attempt #{angle.generation_attempt || 1}
              </div>
            )}
          </div>
        )}

        {/* Existing auto-detected flags */}
        {angle.artifact_flags && angle.artifact_flags.length > 0 && (
          <div className="scene-sets-artifact-auto-flags">
            <p className="scene-sets-artifact-section-label">Auto-detected issues:</p>
            {angle.artifact_flags.filter(f => f.auto).map((flag, i) => (
              <span key={i} className={`scene-sets-artifact-flag ${flag.severity}`}>
                {flag.label}
              </span>
            ))}
          </div>
        )}

        <div className="scene-sets-artifact-categories">
          <p className="scene-sets-artifact-section-label">Flag visible artifacts:</p>
          <div className="scene-sets-artifact-grid">
            {Object.entries(ARTIFACT_CATEGORIES).map(([key, cat]) => (
              <button
                key={key}
                className={`scene-sets-artifact-cat${selected.includes(key) ? ' selected' : ''}`}
                onClick={() => toggle(key)}
              >
                <span className="scene-sets-artifact-cat-label">{cat.label}</span>
                <span className="scene-sets-artifact-cat-desc">{cat.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="scene-sets-artifact-notes">
          <label>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe specific issues you see..."
            rows={2}
          />
        </div>

        <div className="scene-sets-artifact-actions">
          <button
            onClick={handleSubmitReview}
            disabled={submitting || selected.length === 0}
            className="scene-sets-btn-review"
          >
            {submitting ? <Loader size={12} className="spin" /> : <Eye size={12} />}
            Save Review
          </button>
          <button
            onClick={handleRegenerate}
            disabled={submitting || selected.length === 0}
            className="scene-sets-btn-generate"
          >
            {submitting ? <Loader size={12} className="spin" /> : <RefreshCw size={12} />}
            Refine & Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── GENERATION PROGRESS ──────────────────────────────────────────────────────

function GenerationProgress({ progress }) {
  if (!progress) return null;
  const { angles, currentIndex, startTime, completedCount, failedCount } = progress;
  const total = angles.length;
  const elapsed = useElapsedTime(startTime, completedCount + failedCount >= total);
  // ~45s per angle (still image ~20s + video ~25s)
  const perAngle = 45;
  const estimatedTotal = total * perAngle;
  const remaining = Math.max(0, estimatedTotal - elapsed);
  const pct = total > 0 ? Math.round(((completedCount + failedCount) / total) * 100) : 0;

  return (
    <div className="scene-sets-progress-panel">
      <div className="scene-sets-progress-header">
        <div className="scene-sets-progress-title">
          <Loader size={14} className="spin" />
          <span>Generating {total} angle{total !== 1 ? 's' : ''}...</span>
        </div>
        <div className="scene-sets-progress-timing">
          <Clock size={12} />
          <span>{formatTime(elapsed)} elapsed</span>
          <span className="scene-sets-progress-sep">·</span>
          <span>~{formatTime(remaining)} remaining</span>
        </div>
      </div>

      <div className="scene-sets-progress-bar-track">
        <div className="scene-sets-progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="scene-sets-progress-angles">
        {angles.map((a, i) => {
          const isDone = a.status === 'done';
          const isFailed = a.status === 'failed';
          const isCurrent = a.status === 'generating' || (i === currentIndex && !isDone && !isFailed && a.status !== 'queued');
          return (
            <div key={a.id} className={`scene-sets-progress-angle ${
              isDone ? 'done' : isFailed ? 'failed' : isCurrent ? 'current' : 'queued'
            }`}>
              {isDone ? <CheckCircle2 size={12} /> : isFailed ? <AlertCircle size={12} /> : isCurrent ? <Loader size={12} className="spin" /> : <span className="scene-sets-progress-dot" />}
              <span>{a.label}</span>
              {isCurrent && <span className="scene-sets-progress-step">generating...</span>}
              {isDone && <span className="scene-sets-progress-step" style={{ color: '#16a34a' }}>done</span>}
              {isFailed && <span className="scene-sets-progress-step" style={{ color: '#dc2626' }}>failed</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function useElapsedTime(startTime, isDone) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTime || isDone) return;
    const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime, isDone]);
  return elapsed;
}

function formatTime(secs) {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s < 10 ? '0' : ''}${s}s`;
}

// ─── SCENE SET CARD ───────────────────────────────────────────────────────────


const SceneSetCard = memo(function SceneSetCard({ set, onGenerateBase, onRegenerateBase, onUploadBase, onGenerateAngle, onGenerateAll, onDeleteAllAngles, onDeleteSet, onAddAngle, onUpdatePrompt, onPreviewPrompt, onCascadeRegenerate, onSetCoverAngle, onLinkEpisodes, onUnlinkEpisode, onDeleteSingleAngle, isGeneratingProp, generationProgress, specStage, allShows, allEpisodes, onLoadEpisodes, onToast, onRefresh }) {
  const fileInputRef = useRef(null);
  const menuUploadRef = useRef(null);
  const menuRef = useRef(null);
  const isGenerating = isGeneratingProp;
  const progress = isGeneratingProp ? generationProgress : null;
  // Cache-bust using set.updated_at — memoized to avoid recalculating on every render
  const cacheBust = useMemo(
    () => set.updated_at ? new Date(set.updated_at).getTime() : '',
    [set.updated_at]
  );
  const bustUrl = useCallback((url) => {
    if (!url || !cacheBust) return url;
    return `${url}${url.includes('?') ? '&' : '?'}v=${cacheBust}`;
  }, [cacheBust]);

  const sortedAngles = useMemo(
    () => [...(set.angles || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [set.angles]
  );
  const readyAngles = sortedAngles.filter(a => a.generation_status === 'complete').length;
  const totalAngles = sortedAngles.length;
  const pendingAngles = sortedAngles.filter(a => a.generation_status === 'pending');
  const failedAngles = sortedAngles.filter(a => a.generation_status === 'failed');
  const generableAngles = sortedAngles.filter(a => a.generation_status === 'pending' || a.generation_status === 'failed');
  const regenerableAngles = sortedAngles.filter(a => a.generation_status === 'complete' || a.generation_status === 'failed');
  const hasBase = !!(set.base_still_url || set.base_runway_seed);

  // Selected angle for detail panel — initializes to cover_angle_id if set
  const [selectedAngleId, setSelectedAngleId] = useState(set.cover_angle_id || null);
  const selectedAngle = selectedAngleId ? sortedAngles.find(a => a.id === selectedAngleId) : null;
  const coverAngle = set.cover_angle_id ? sortedAngles.find(a => a.id === set.cover_angle_id) : null;
  // Card hero always shows the base image — angle images only in detail panel
  const heroImageRaw = useMemo(
    () => set.base_still_url || null,
    [set.base_still_url]
  );
  const isCoverAngle = (angleId) => set.cover_angle_id === angleId;
  const heroImage = useMemo(() => heroImageRaw ? bustUrl(heroImageRaw) : null, [heroImageRaw, bustUrl]);
  const [showBaseLightbox, setShowBaseLightbox] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [editingAngleId, setEditingAngleId] = useState(null);
  const [editingAngleLabel, setEditingAngleLabel] = useState('');
  const [activeModalTab, setActiveModalTab] = useState('details');
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [showAddAngle, setShowAddAngle] = useState(false);
  const [addingAngle, setAddingAngle] = useState(false);
  const [newAngle, setNewAngle] = useState({ angle_label: '', angle_name: '', angle_description: '', camera_direction: '', beat_affinity: '' });
  const angleUploadRef = useRef(null);
  const [angleUploadFile, setAngleUploadFile] = useState(null);
  const [angleUploadPreview, setAngleUploadPreview] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [editDesc, setEditDesc] = useState(set.canonical_description || '');
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Local optimistic state for settings that save on change
  const [localTimeOfDay, setLocalTimeOfDay] = useState(set.time_of_day || '');
  const [localSeason, setLocalSeason] = useState(set.season || '');
  const [localRoomProps, setLocalRoomProps] = useState(set.visual_language?.room_properties || {});
  const [localDesc, setLocalDesc] = useState(set.canonical_description || '');

  // Sync from props when parent refreshes
  useEffect(() => { setLocalTimeOfDay(set.time_of_day || ''); }, [set.time_of_day]);
  useEffect(() => { setLocalSeason(set.season || ''); }, [set.season]);
  useEffect(() => { setLocalRoomProps(set.visual_language?.room_properties || {}); }, [set.visual_language?.room_properties]);
  useEffect(() => { setLocalDesc(set.canonical_description || ''); }, [set.canonical_description]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [genStartTime, setGenStartTime] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState([]);
  const [addingSuggestions, setAddingSuggestions] = useState(false);
  const [aiAssistLoading, setAiAssistLoading] = useState(false);
  const [showEpisodeManager, setShowEpisodeManager] = useState(false);
  const [selectedShowForLink, setSelectedShowForLink] = useState('');
  const [episodesToLink, setEpisodesToLink] = useState([]);
  const [toolsAction, setToolsAction] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [descRefining, setDescRefining] = useState(false);
  const [buildingSpec, setBuildingSpec] = useState(false);
  const [specProgress, setSpecProgress] = useState(null); // null | 'sending' | 'analyzing' | 'parsing' | 'done' | 'error'
  const hasSpec = !!(set.scene_spec?.objects?.length);
  const showToast = onToast || (() => {});
  const baseElapsed = useElapsedTime(genStartTime, !isGenerating);

  // Track generation start time
  useEffect(() => {
    if (isGenerating && !genStartTime) setGenStartTime(Date.now());
    if (!isGenerating && genStartTime) setGenStartTime(null);
  }, [isGenerating]);

  // menuRef used for positioning the portaled kebab dropdown

  const handleSavePrompt = async (andRegenerate = false, andCascade = false) => {
    setSavingPrompt(true);
    await onUpdatePrompt(set, editDesc);
    setSavingPrompt(false);
    if (andCascade) {
      setShowPromptEditor(false);
      onCascadeRegenerate(set, editDesc);
    } else if (andRegenerate) {
      setShowPromptEditor(false);
      onRegenerateBase(set);
    } else {
      setShowPromptEditor(false);
    }
  };

  const handlePreviewPrompt = async () => {
    setLoadingPreview(true);
    const data = await onPreviewPrompt(set);
    setPreviewData(data);
    setLoadingPreview(false);
    setShowPromptPreview(true);
  };

  const handleSubmitAngle = async () => {
    if (!newAngle.angle_label.trim() || !newAngle.angle_name.trim()) return;
    setAddingAngle(true);
    const beatArr = newAngle.beat_affinity.trim()
      ? newAngle.beat_affinity.split(',').map(b => parseInt(b.trim(), 10)).filter(n => !isNaN(n))
      : [];
    await onAddAngle(set, {
      angle_label: newAngle.angle_label.trim().toUpperCase(),
      angle_name: newAngle.angle_name.trim(),
      angle_description: newAngle.angle_description.trim() || null,
      camera_direction: newAngle.camera_direction.trim() || null,
      beat_affinity: beatArr,
      _imageFile: angleUploadFile || null,
    });
    setNewAngle({ angle_label: '', angle_name: '', angle_description: '', camera_direction: '', beat_affinity: '' });
    setAngleUploadFile(null);
    setAngleUploadPreview(null);
    setShowAddAngle(false);
    setAddingAngle(false);
  };

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === set.name) { setEditingName(false); return; }
    setSavingName(true);
    try {
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok && onToast) onToast(`Renamed to "${trimmed}"`);
    } catch {
      if (onToast) onToast('Failed to rename', 'error');
    }
    setSavingName(false);
    setEditingName(false);
  };

  const handleRenameAngle = async (angleId, newLabel) => {
    const trimmed = newLabel.trim().toUpperCase();
    if (!trimmed) { setEditingAngleId(null); return; }
    try {
      await fetch(`${API_BASE}/scene-sets/${set.id}/angles/${angleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ angle_label: trimmed }),
      });
      if (onToast) onToast(`Renamed to "${trimmed}"`);
    } catch {
      if (onToast) onToast('Rename failed', 'error');
    }
    setEditingAngleId(null);
  };

  const handleSuggestAngles = async () => {
    setLoadingSuggestions(true);
    setSuggestions(null);
    setSelectedSuggestions([]);
    try {
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}/suggest-angles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const errMsg = json.error || 'Failed to get suggestions';
        if (onToast) onToast(errMsg, 'error');
        setSuggestions([]);
        setLoadingSuggestions(false);
        return;
      }
      setSuggestions(json.data || []);
      setSelectedSuggestions((json.data || []).map((_, i) => i));
    } catch (err) {
      if (onToast) onToast('Failed to get AI suggestions', 'error');
      setSuggestions([]);
    }
    setLoadingSuggestions(false);
  };

  const handleAddSelectedSuggestions = async () => {
    if (!suggestions || selectedSuggestions.length === 0) return;
    setAddingSuggestions(true);
    for (const idx of selectedSuggestions) {
      const s = suggestions[idx];
      if (!s) continue;
      await onAddAngle(set, {
        angle_label: s.angle_label,
        angle_name: s.angle_name,
        camera_direction: s.camera_direction || null,
        beat_affinity: s.beat_affinity || [],
      });
    }
    setSuggestions(null);
    setSelectedSuggestions([]);
    setAddingSuggestions(false);
  };

  const toggleSuggestion = (idx) => {
    setSelectedSuggestions(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleAiAssist = async () => {
    setAiAssistLoading(true);
    try {
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}/ai-camera-direction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ angle_label: newAngle.angle_label.trim().toUpperCase() || 'GENERAL', angle_name: newAngle.angle_name.trim() }),
      });
      if (!res.ok) throw new Error('AI assist failed');
      const json = await res.json();
      if (json.data?.camera_direction) {
        setNewAngle(a => ({ ...a, camera_direction: json.data.camera_direction }));
      }
    } catch { /* silent */ }
    setAiAssistLoading(false);
  };

  return (
    <div className="scene-sets-card">
      {/* ── Hero Preview ─────────────────────────────────────── */}
      <div
        className={`scene-sets-card-preview${heroImage ? ' has-image' : ''}`}
        onDoubleClick={() => { if (heroImage) setShowBaseLightbox(true); }}
        title={heroImage ? 'Double-click to view full size' : undefined}
      >
        {heroImage ? (
          <>
            <img src={heroImage} alt={set.name} />
            {set.generation_status === 'complete' && !isGenerating && (
              <div className="scene-sets-base-ready-badge">Base Set</div>
            )}
          </>
        ) : (
          <div className="scene-sets-card-placeholder" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} style={{ cursor: 'pointer' }}>
            <Upload size={28} strokeWidth={1.2} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Upload Base Image</span>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>or drag & drop</span>
          </div>
        )}

        {isGenerating && (
          <div className="scene-sets-card-generating-overlay">
            <Loader size={24} className="spin" />
            <span>Generating{genStartTime ? ` ${formatTime(baseElapsed)}` : '...'}</span>
          </div>
        )}

        <div className="scene-sets-card-overlay-top-left">
          <TypeBadge type={set.scene_type} />
          {set.is_franchise_asset && (
            <span className="scene-sets-franchise-badge">FRANCHISE</span>
          )}
        </div>

        <div className="scene-sets-card-overlay-top-right">
          <StatusPill status={set.generation_status} />
          <div className="scene-sets-kebab-wrapper" ref={menuRef}>
            <button
              className="scene-sets-btn-kebab-hero"
              onClick={(e) => { e.stopPropagation(); setShowMenu(m => !m); }}
              title="More options"
            >
              <MoreVertical size={14} />
            </button>
            {showMenu && createPortal(
              <div className="scene-sets-kebab-backdrop" onClick={() => setShowMenu(false)}>
                <div
                  className="scene-sets-kebab-menu"
                  style={{ top: menuRef.current?.getBoundingClientRect().bottom + 4, left: menuRef.current?.getBoundingClientRect().right - 190 }}
                  onClick={e => e.stopPropagation()}
                >
                  <button onClick={() => { setShowMenu(false); fileInputRef.current?.click(); }}>
                    <Upload size={12} /> {hasBase ? 'Replace Base Image' : 'Upload Base Image'}
                  </button>
                  {hasBase && (
                    <button onClick={() => { setShowMenu(false); setShowDetails(true); setActiveModalTab('details'); setEditingDesc(true); setDescDraft(localDesc); }}>
                      <Pencil size={12} /> Edit Description
                    </button>
                  )}
                  {hasBase && (
                    <button onClick={async () => {
                      setShowMenu(false);
                      setSeeding(true);
                      showToast('Analyzing your image for camera angles...');
                      try {
                        const r = await fetch(`${API_BASE}/scene-sets/${set.id}/suggest-angles-from-image`, { method: 'POST' });
                        const d = await r.json();
                        if (d.success) {
                          showToast(`${d.angles_created || 0} angles suggested! Click "Generate All" to create images.`);
                        } else {
                          showToast(d.error || 'Failed to suggest angles', 'error');
                        }
                      } catch (e) { showToast(e.message, 'error'); }
                      setSeeding(false);
                    }} disabled={isGenerating || seeding}>
                      <Sparkles size={12} /> {seeding ? 'Analyzing...' : 'Suggest Angles'}
                    </button>
                  )}
                  {hasBase && sortedAngles.some(a => a.still_image_url) && (
                    <button onClick={async () => {
                      setShowMenu(false);
                      const targetAngle = selectedAngle?.still_image_url
                        ? selectedAngle
                        : sortedAngles.find(a => a.still_image_url);
                      if (!targetAngle) return;
                      try {
                        const res = await fetch(`${API_BASE}/scene-sets/${set.id}/promote-to-base`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ angle_id: targetAngle.id }),
                        });
                        const d = await res.json();
                        if (d.success) showToast(d.message);
                        else showToast(d.error, 'error');
                      } catch { showToast('Failed to set base', 'error'); }
                    }}>
                      <Camera size={12} /> Use {selectedAngle?.angle_label || sortedAngles.find(a => a.still_image_url)?.angle_label || 'Angle'} as Base
                    </button>
                  )}
                  <button onClick={() => { setShowMenu(false); setShowDetails(true); setActiveModalTab('details'); }}>
                    <Eye size={12} /> Details
                  </button>
                  <button onClick={() => { setShowMenu(false); onDeleteSet(set); }} disabled={isGenerating} className="scene-sets-kebab-danger">
                    <Trash2 size={12} /> Delete Set
                  </button>
                </div>
              </div>,
              document.body
            )}
          </div>
          {/* Hidden file input for kebab menu upload */}
          <input
            ref={menuUploadRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) onUploadBase(set, files);
              e.target.value = '';
            }}
          />
        </div>

        {selectedAngle?.video_clip_url && (
          <div className="scene-sets-card-video-ready">
            <Play size={12} /> Video ready
          </div>
        )}

        {/* Hero label showing which angle is displayed */}
        {selectedAngle && (
          <div className="scene-sets-card-hero-label">
            {isCoverAngle(selectedAngle.id) && <Heart size={10} fill="currentColor" />}
            {selectedAngle.angle_label}
          </div>
        )}
        {/* Base heart indicator when viewing the cover angle or base */}
        {((!selectedAngleId && set.base_still_url) || (selectedAngle && isCoverAngle(selectedAngle.id))) && (
          <div className="scene-sets-card-base-heart">
            <Heart size={14} fill="currentColor" />
          </div>
        )}
      </div>

      {/* ── Compact Card Body ────────────────────────────────── */}
      <div className="scene-sets-card-body">
        <div className="scene-sets-card-header">
          <h3 className="scene-sets-card-title" onClick={() => setShowDetails(true)} style={{ cursor: 'pointer' }}>{set.name}</h3>

          {/* Scene type badge */}
          {set.scene_type && (
            <div style={{ marginBottom: 4 }}>
              <span style={{
                fontSize: 9, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.3px',
                padding: '2px 7px', borderRadius: 4,
                background: set.scene_type === 'EVENT_LOCATION' ? '#fef3c7' : set.scene_type === 'HOME_BASE' ? '#dbeafe' : set.scene_type === 'CLOSET' ? '#fce7f3' : set.scene_type === 'TRANSITION' ? '#e0e7ff' : '#f3f4f6',
                color: set.scene_type === 'EVENT_LOCATION' ? '#92400e' : set.scene_type === 'HOME_BASE' ? '#1e40af' : set.scene_type === 'CLOSET' ? '#9d174d' : set.scene_type === 'TRANSITION' ? '#4338ca' : '#6b7280',
              }}>{set.scene_type.replace('_', ' ')}</span>
            </div>
          )}

          {/* Compact metadata */}
          <div className="scene-sets-card-meta-line">
            {set.show && <span className="scene-sets-meta-chip"><Tv size={9} /> {set.show.name}</span>}
            {set.episodes?.length > 0 && <span className="scene-sets-meta-chip"><Film size={9} /> {set.episodes.length === 1 ? `Ep ${set.episodes[0].episode_number || '?'}` : `${set.episodes.length} eps`}</span>}
            {set.time_of_day && <span className="scene-sets-meta-chip"><Clock size={9} /> {set.time_of_day.replace('_', ' ')}</span>}
            {set.season && <span className="scene-sets-meta-chip"><RefreshCw size={9} /> {set.season}</span>}
          </div>

          {/* Angle thumbnail strip — shows completed angles as clickable mini previews */}
          {readyAngles > 0 && (
            <div className="scene-sets-card-thumbstrip">
              {sortedAngles.filter(a => a.still_image_url && a.generation_status === 'complete').slice(0, 6).map(a => (
                <img
                  key={a.id}
                  src={bustUrl(a.still_image_url)}
                  alt={a.angle_label}
                  className="scene-sets-card-thumb"
                  onClick={() => { setSelectedAngleId(a.id); setShowBaseLightbox(true); }}
                  title={a.angle_name}
                />
              ))}
              {readyAngles > 6 && <span className="scene-sets-card-thumb-more">+{readyAngles - 6}</span>}
              <button
                className="scene-sets-card-thumb-gallery"
                onClick={() => { setSelectedAngleId(null); setShowBaseLightbox(true); }}
                title="View gallery"
              >
                <Grid3X3 size={10} />
              </button>
            </div>
          )}

          {/* Progress bar — only when there are pending angles */}
          {totalAngles > 0 && readyAngles < totalAngles && (
            <div className="scene-sets-progress-row">
              <div className="scene-sets-progress-bar">
                <div className="scene-sets-progress-fill" style={{ width: `${(readyAngles / totalAngles) * 100}%` }} />
              </div>
              <span className="scene-sets-progress-label">{readyAngles}/{totalAngles}</span>
            </div>
          )}

          {/* ── Pipeline Progress Panel — shows during upload+spec+angles flow ── */}
          {specStage && specStage !== 'done' && (
            <div style={{ marginTop: 8, padding: '10px 12px', background: '#FAF7F0', borderRadius: 8, border: '1px solid #e8e0d0' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: '#B8962E', marginBottom: 8, letterSpacing: '0.5px' }}>Setting up scene</div>
              {[
                { key: 'uploading', label: 'Uploading image', icon: Upload },
                { key: 'building_spec', label: 'Analyzing room — objects, zones, layout', icon: FileText },
                { key: 'creating_angles', label: 'Creating camera angles from spec', icon: Camera },
              ].map((step) => {
                const stages = ['uploading', 'building_spec', 'creating_angles'];
                const currentIdx = stages.indexOf(specStage);
                const stepIdx = stages.indexOf(step.key);
                const isDone = stepIdx < currentIdx;
                const isCurrent = stepIdx === currentIdx;
                const Icon = step.icon;
                return (
                  <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', opacity: isDone ? 0.5 : isCurrent ? 1 : 0.3 }}>
                    <div style={{ width: 18, display: 'flex', justifyContent: 'center' }}>
                      {isDone ? <CheckCircle2 size={12} style={{ color: '#16a34a' }} /> : isCurrent ? <Loader size={12} className="spin" style={{ color: '#B8962E' }} /> : <Icon size={12} style={{ color: '#ccc' }} />}
                    </div>
                    <span style={{ fontSize: 11, color: isCurrent ? '#2C2C2C' : '#888', fontWeight: isCurrent ? 600 : 400 }}>{step.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Status + Next Action Panel (when NOT in pipeline) ── */}
          {!specStage && hasBase && (
            <div style={{ marginTop: 8, padding: '10px 12px', background: '#FAF7F0', borderRadius: 8, border: '1px solid #e8e0d0' }}>
              {/* Step 1: No spec yet */}
              {!hasSpec && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#2C2C2C' }}>Step 1: Build Scene Spec</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#666', marginBottom: 8, lineHeight: 1.4 }}>
                    Analyze your image to catalog every object, define zones, and create camera contracts for consistent angle generation.
                  </div>
                  <button onClick={async () => {
                    setBuildingSpec(true);
                    setSpecProgress('sending');
                    try {
                      const progressTimer = setTimeout(() => setSpecProgress('analyzing'), 1500);
                      const parseTimer = setTimeout(() => setSpecProgress('parsing'), 12000);
                      const r = await fetch(`${API_BASE}/scene-sets/${set.id}/spec/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
                      clearTimeout(progressTimer);
                      clearTimeout(parseTimer);
                      const d = await r.json();
                      if (d.success) {
                        setSpecProgress('done');
                        showToast(`Scene spec built: ${d.data?.objects?.length || 0} objects, ${d.data?.zones?.length || 0} zones, ${d.data?.camera_contracts?.length || 0} camera contracts`);
                        if (onRefresh) await onRefresh();
                      } else {
                        setSpecProgress('error');
                        showToast(d.error || 'Failed', 'error');
                      }
                    } catch (e) { setSpecProgress('error'); showToast(e.message, 'error'); }
                    setBuildingSpec(false);
                    setTimeout(() => setSpecProgress(null), 2000);
                  }} disabled={buildingSpec} className="scene-sets-btn-generate" style={{ width: '100%' }}>
                    {buildingSpec ? <><Loader size={12} className="spin" /> {specProgress === 'sending' ? 'Sending image to Claude...' : specProgress === 'analyzing' ? 'Claude is cataloging every object...' : specProgress === 'parsing' ? 'Building zones + camera contracts...' : 'Analyzing room...'}</> : <><FileText size={12} /> Build Scene Spec</>}
                  </button>
                  {buildingSpec && (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: '#f8f6f1', borderRadius: 6, fontSize: 10, color: '#666', lineHeight: 1.5 }}>
                      Claude Vision is analyzing your image to identify every object, define spatial zones, set up continuity rules, and create camera contracts. This takes 15-30 seconds.
                    </div>
                  )}
                </>
              )}

              {/* Step 2: Spec exists, no angles */}
              {hasSpec && totalAngles === 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <CheckCircle2 size={12} style={{ color: '#16a34a' }} />
                    <span style={{ fontSize: 10, color: '#16a34a', fontFamily: "'DM Mono', monospace" }}>
                      Spec: {set.scene_spec.objects?.length || 0} objects · {set.scene_spec.zones?.length || 0} zones · {set.scene_spec.camera_contracts?.length || 0} contracts
                    </span>
                  </div>
                  {set.scene_type === 'EVENT_LOCATION' && (set.scene_spec.camera_contracts?.length || 0) > 3 && (
                    <div style={{ fontSize: 10, color: '#f59e0b', marginBottom: 8, padding: '6px 8px', background: '#fef3c7', borderRadius: 6, lineHeight: 1.4 }}>
                      This event venue has {set.scene_spec.camera_contracts.length} angles — events typically only need 1-2. Hit "Rebuild Spec" in the Spec tab to regenerate with fewer angles.
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#2C2C2C' }}>Step 2: Create Camera Angles</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#666', marginBottom: 8, lineHeight: 1.4 }}>
                    Create {set.scene_spec?.camera_contracts?.length || 0} camera angles from your spec — each with required objects and validation rules.
                  </div>
                  <button onClick={async () => {
                    setSeeding(true);
                    showToast('Creating camera angles from spec...');
                    try {
                      const r = await fetch(`${API_BASE}/scene-sets/${set.id}/spec/create-angles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
                      const d = await r.json();
                      if (d.success) {
                        showToast(`${d.data?.angles_created || 0} camera angles created — ready to generate images`);
                        if (onRefresh) await onRefresh();
                      } else showToast(d.error || 'Failed', 'error');
                    } catch (e) { showToast(e.message, 'error'); }
                    setSeeding(false);
                  }} disabled={seeding} className="scene-sets-btn-generate" style={{ width: '100%' }}>
                    {seeding ? <><Loader size={12} className="spin" /> Creating {set.scene_spec?.camera_contracts?.length || 0} angles...</> : <><Camera size={12} /> Create {set.scene_spec?.camera_contracts?.length || 0} Camera Angles</>}
                  </button>
                </>
              )}

              {/* Step 3: Spec + angles exist, ready to generate */}
              {hasSpec && totalAngles > 0 && generableAngles.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <CheckCircle2 size={12} style={{ color: '#16a34a' }} />
                    <span style={{ fontSize: 10, color: '#16a34a', fontFamily: "'DM Mono', monospace" }}>
                      Spec: {set.scene_spec.objects?.length || 0} objects · {set.scene_spec.camera_contracts?.length || 0} contracts
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#2C2C2C' }}>Step 3: Generate {generableAngles.length} Angle Images</span>
                  </div>
                  <button onClick={async () => {
                    if (failedAngles.length > 0) {
                      for (const a of failedAngles) {
                        try { await fetch(`${API_BASE}/scene-sets/${set.id}/angles/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generation_status: 'pending' }) }); } catch { /* continue */ }
                      }
                    }
                    onGenerateAll(set, false);
                  }} disabled={isGenerating} className="scene-sets-btn-generate" style={{ width: '100%' }}>
                    {isGenerating ? <><Loader size={12} className="spin" /> Generating...</> : <><Sparkles size={12} /> Generate All Angles ({generableAngles.length})</>}
                  </button>
                </>
              )}

              {/* All done: spec + angles all generated */}
              {hasSpec && totalAngles > 0 && generableAngles.length === 0 && readyAngles === totalAngles && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#16a34a' }}>
                    Complete — {readyAngles} angles generated with spec enforcement
                  </span>
                </div>
              )}

              {/* No spec but has angles (legacy) */}
              {!hasSpec && totalAngles > 0 && (
                <div style={{ fontSize: 10, color: '#888', fontFamily: "'DM Mono', monospace" }}>
                  {readyAngles}/{totalAngles} angles (no spec — build one for better consistency)
                </div>
              )}
            </div>
          )}

          {/* Generate All — for sets without spec but with pending angles */}
          {!specStage && hasBase && !hasSpec && generableAngles.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <button onClick={async () => {
                // Reset failed angles to pending first so they get included
                if (failedAngles.length > 0) {
                  for (const a of failedAngles) {
                    try {
                      await fetch(`${API_BASE}/scene-sets/${set.id}/angles/${a.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ generation_status: 'pending' }),
                      });
                    } catch { /* continue */ }
                  }
                }
                onGenerateAll(set, false);
              }} disabled={isGenerating} className="scene-sets-btn-generate" style={{ width: '100%' }}>
                {isGenerating ? <><Loader size={12} className="spin" /> Generating...</> : <><Sparkles size={12} /> Generate All Angles ({generableAngles.length})</>}
              </button>
            </div>
          )}

          {/* No base — show upload + generate as always-visible buttons */}
          {!hasBase && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={() => fileInputRef.current?.click()} disabled={isGenerating} className="scene-sets-btn-generate" style={{ flex: 1 }}>
                <Upload size={12} /> Upload Image
              </button>
              <button onClick={() => onGenerateBase(set)} disabled={isGenerating} className="scene-sets-btn-details">
                {isGenerating ? <Loader size={12} className="spin" /> : <Sparkles size={12} />} AI Generate
              </button>
            </div>
          )}

          {/* Has base — details on hover */}
          {hasBase && (
            <div className="scene-sets-card-actions">
              <button onClick={() => setShowDetails(true)} className="scene-sets-btn-details">
                <Eye size={12} /> Details
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="scene-sets-btn-details">
                <Upload size={12} /> Replace
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) onUploadBase(set, files);
              e.target.value = '';
            }}
          />
        </div>

        {isGenerating && !progress && (
          <div className="scene-sets-base-timer">
            <Loader size={12} className="spin" />
            <span>Generating... {formatTime(baseElapsed)}</span>
          </div>
        )}

        {progress && <GenerationProgress progress={progress} />}

        {/* ── Unified Popup Modal for Details / Prompt / Add Angle ── */}
        {(showDetails || showPromptEditor || showAddAngle) && createPortal(
          <div className="scene-sets-modal-backdrop" onClick={() => { setShowDetails(false); setShowPromptEditor(false); setShowAddAngle(false); setAngleUploadFile(null); setAngleUploadPreview(null); }}>
            <div className="scene-sets-modal" onClick={e => e.stopPropagation()}>
              {/* Modal header with set name + hero thumbnail */}
              <div className="scene-sets-modal-header">
                <div className="scene-sets-modal-header-info">
                  {heroImage && <img src={heroImage} alt="" className="scene-sets-modal-thumb" />}
                  <div>
                    {editingName ? (
                      <input
                        className="scene-sets-modal-title-input"
                        value={nameValue}
                        onChange={e => setNameValue(e.target.value)}
                        onBlur={handleSaveName}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                        disabled={savingName}
                        autoFocus
                      />
                    ) : (
                      <h3
                        className="scene-sets-modal-title scene-sets-modal-title-editable"
                        onClick={() => { setEditingName(true); setNameValue(set.name || ''); }}
                        title="Click to rename"
                      >{set.name}</h3>
                    )}
                    <span className="scene-sets-modal-subtitle">{set.scene_type?.replace(/_/g, ' ')} &middot; {readyAngles}/{totalAngles} angles</span>
                  </div>
                </div>
                <button className="scene-sets-modal-close" onClick={() => { setShowDetails(false); setShowPromptEditor(false); setShowAddAngle(false); }}>
                  <X size={16} />
                </button>
              </div>

              {/* Tab bar — just 2 tabs */}
              <div className="scene-sets-modal-tabs">
                <button className={`scene-sets-modal-tab ${activeModalTab === 'details' ? 'active' : ''}`} onClick={() => { setActiveModalTab('details'); setShowDetails(true); setShowAddAngle(false); }}>
                  <Eye size={12} /> Overview
                </button>
                <button className={`scene-sets-modal-tab ${activeModalTab === 'angles' ? 'active' : ''}`} onClick={() => { setActiveModalTab('angles'); setShowDetails(true); setShowAddAngle(false); }}>
                  <Camera size={12} /> Angles <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 2 }}>{readyAngles}/{totalAngles}</span>
                </button>
                {hasBase && (
                  <button className={`scene-sets-modal-tab ${activeModalTab === 'spec' ? 'active' : ''}`} onClick={() => { setActiveModalTab('spec'); setShowDetails(true); setShowAddAngle(false); }}>
                    <FileText size={12} /> Spec {hasSpec && <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 2 }}>✓</span>}
                  </button>
                )}
                {hasBase && (
                  <button className={`scene-sets-modal-tab ${showAddAngle ? 'active' : ''}`} onClick={() => { setActiveModalTab('add-angle'); setShowAddAngle(true); setShowDetails(false); }}>
                    <Plus size={12} /> Add Angle
                  </button>
                )}
              </div>

              {/* Tab content */}
              <div className="scene-sets-modal-body">
                {/* ═══ OVERVIEW TAB ═══ */}
                {activeModalTab === 'details' && !showAddAngle && (
                  <div className="scene-sets-modal-section">
                    {/* Description — view or safe edit mode */}
                    {localDesc && !editingDesc && (
                      <div className="scene-sets-overview-desc-wrap">
                        <p className="scene-sets-overview-desc">{localDesc}</p>
                        <button className="scene-sets-desc-edit-btn" onClick={() => { setEditingDesc(true); setDescDraft(localDesc); }}>
                          <Pencil size={10} /> Edit Description
                        </button>
                      </div>
                    )}
                    {!localDesc && !editingDesc && (
                      <button className="scene-sets-ai-desc-btn" style={{ marginBottom: 12 }} onClick={() => { setEditingDesc(true); setDescDraft(''); }}>
                        <Pencil size={10} /> Add Description
                      </button>
                    )}
                    {editingDesc && (
                      <div className="scene-sets-desc-editor">
                        <div className="scene-sets-desc-editor-hint">
                          Editing is safe — change wording freely. If you change visual details (colors, furniture, layout), you may need to regenerate angles.
                        </div>
                        <textarea
                          className="scene-sets-desc-textarea"
                          value={descDraft}
                          onChange={e => setDescDraft(e.target.value)}
                          rows={6}
                        />
                        <div className="scene-sets-desc-editor-actions">
                          <button className="scene-sets-ai-desc-btn" disabled={descRefining} onClick={async () => {
                            setDescRefining(true);
                            try {
                              const r = await fetch(`${API_BASE}/scene-sets/${set.id}/refine-description`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ draft: descDraft }),
                              });
                              const d = await r.json();
                              if (d.refined) setDescDraft(d.refined);
                            } catch { showToast('Refine failed', 'error'); }
                            setDescRefining(false);
                          }}>
                            {descRefining ? <Loader size={10} className="spin" /> : <Sparkles size={10} />} AI Refine (keep visuals)
                          </button>
                          <button className="scene-sets-btn-generate" onClick={async () => {
                            try {
                              await fetch(`${API_BASE}/scene-sets/${set.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ canonical_description: descDraft }),
                              });
                              setLocalDesc(descDraft);
                              showToast('Description saved');
                              setEditingDesc(false);
                            } catch { showToast('Save failed', 'error'); }
                          }}>
                            <Save size={10} /> Save
                          </button>
                          <button className="scene-sets-btn-details" onClick={() => setEditingDesc(false)}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* Compact metadata chips */}
                    <div className="scene-sets-overview-chips">
                      {set.mood_tags?.length > 0 && set.mood_tags.map(tag => (
                        <span key={tag} className="scene-sets-overview-chip mood">{tag}</span>
                      ))}
                      {set.visual_language?.locked && (
                        <span className="scene-sets-overview-chip style">
                          <Lock size={8} /> Style Locked
                          {set.visual_language.color_palette?.slice(0, 4).map((c, i) => (
                            <span key={i} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c, marginLeft: 2 }} />
                          ))}
                        </span>
                      )}
                    </div>

                    {/* Time of Day & Season */}
                    <div className="scene-sets-modal-field">
                      <label><Clock size={11} /> Environment</label>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Time of Day</span>
                          <select
                            value={localTimeOfDay}
                            onChange={async (e) => {
                              const val = e.target.value || null;
                              setLocalTimeOfDay(e.target.value);
                              try {
                                await fetch(`${API_BASE}/scene-sets/${set.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ time_of_day: val }),
                                });
                                showToast(`Time set to ${val || 'any'}`);
                              } catch { showToast('Failed to update', 'error'); }
                            }}
                            className="scene-sets-select-sm"
                          >
                            <option value="">Any / Not set</option>
                            <option value="morning">Morning</option>
                            <option value="afternoon">Afternoon</option>
                            <option value="golden_hour">Golden Hour</option>
                            <option value="evening">Evening</option>
                            <option value="night">Night</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Season</span>
                          <select
                            value={localSeason}
                            onChange={async (e) => {
                              const val = e.target.value || null;
                              setLocalSeason(e.target.value);
                              try {
                                await fetch(`${API_BASE}/scene-sets/${set.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ season: val }),
                                });
                                showToast(`Season set to ${val || 'any'}`);
                              } catch { showToast('Failed to update', 'error'); }
                            }}
                            className="scene-sets-select-sm"
                          >
                            <option value="">Any / Not set</option>
                            <option value="spring">Spring</option>
                            <option value="summer">Summer</option>
                            <option value="fall">Fall</option>
                            <option value="winter">Winter</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Room Properties */}
                    <div className="scene-sets-modal-field">
                      <label><Camera size={11} /> Room Properties</label>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {[
                          { key: 'room_size', label: 'Size', options: ['compact', 'medium', 'spacious', 'grand'] },
                          { key: 'ceiling_height', label: 'Ceiling', options: ['standard', 'tall', 'vaulted', 'double_height'] },
                          { key: 'room_shape', label: 'Shape', options: ['rectangular', 'square', 'l_shaped', 'open_plan'] },
                        ].map(({ key, label, options }) => (
                          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span className="scene-sets-field-label">{label}</span>
                            <select
                              value={localRoomProps[key] || ''}
                              onChange={async (e) => {
                                const val = e.target.value || null;
                                const rp = { ...localRoomProps, [key]: val };
                                setLocalRoomProps(rp);
                                try {
                                  await fetch(`${API_BASE}/scene-sets/${set.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ room_properties: rp }),
                                  });
                                  showToast(`${label} set to ${val || 'auto'}`);
                                } catch { showToast('Failed to update', 'error'); }
                              }}
                              className="scene-sets-select-sm"
                            >
                              <option value="">Auto-detect</option>
                              {options.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                      {set.visual_language?.room_properties && (
                        <div className="scene-sets-room-props-summary">
                          {set.visual_language.room_properties.room_size && <span>{set.visual_language.room_properties.room_size}</span>}
                          {set.visual_language.room_properties.window_count > 0 && <span>{set.visual_language.room_properties.window_count} window{set.visual_language.room_properties.window_count > 1 ? 's' : ''}</span>}
                          {set.visual_language.room_properties.furniture_density && <span>{set.visual_language.room_properties.furniture_density} furnishing</span>}
                        </div>
                      )}
                    </div>

                    {/* Linked episodes */}
                    {set.episodes && set.episodes.length > 0 && (
                      <div className="scene-sets-modal-field">
                        <label><Film size={11} /> Linked Episodes</label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {set.episodes.map(ep => (
                            <span key={ep.id} style={{ padding: '3px 8px', background: '#eef2ff', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#4338ca' }}>
                              {ep.season_number ? `S${ep.season_number}` : ''}E{ep.episode_number || '?'} {ep.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Prompt (collapsed) */}
                    {set.base_runway_prompt && (
                      <details className="scene-sets-modal-field" style={{ marginTop: 8 }}>
                        <summary style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', cursor: 'pointer', userSelect: 'none' }}>View AI Prompt</summary>
                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 10, lineHeight: 1.5, maxHeight: 200, overflow: 'auto', background: '#f8fafc', padding: 10, borderRadius: 6, marginTop: 6, color: '#475569' }}>{set.base_runway_prompt}</pre>
                      </details>
                    )}

                    {/* Mood Variants — inline in Overview */}
                    {hasBase && (
                      <div style={{ marginTop: 12 }}>
                        <div className="scene-sets-tools-label">Mood Variations</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {[
                            { key: 'morning', label: '🌅 Morning' },
                            { key: 'golden_hour', label: '🌇 Golden Hr' },
                            { key: 'night', label: '🌙 Night' },
                            { key: 'glam', label: '💄 Glam' },
                            { key: 'cozy', label: '🕯️ Cozy' },
                            { key: 'dramatic', label: '🎭 Dramatic' },
                          ].map(m => (
                            <button key={m.key} className="scene-sets-mood-btn" disabled={toolsAction === `mood_${m.key}`}
                              onClick={async () => {
                                setToolsAction(`mood_${m.key}`);
                                try {
                                  const r = await fetch(`${API_BASE}/scene-sets/${set.id}/mood-variants`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ moods: [m.key] }) });
                                  const d = await r.json();
                                  if (d.success) showToast(`${m.label} created`);
                                } catch (e) { showToast(e.message, 'error'); }
                                setToolsAction(null);
                              }}>
                              {toolsAction === `mood_${m.key}` ? <Loader size={10} className="spin" /> : m.label}
                            </button>
                          ))}
                        </div>
                        {set.visual_language?.mood_variants?.base && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 6, overflowX: 'auto' }}>
                            {Object.entries(set.visual_language.mood_variants.base).map(([mood, url]) => (
                              <div key={mood} style={{ flexShrink: 0, textAlign: 'center' }}>
                                <img src={bustUrl(url)} alt={mood} style={{ width: 64, height: 42, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }} onClick={() => window.open(url, '_blank')} />
                                <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 1, textTransform: 'capitalize' }}>{mood.replace('_', ' ')}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )}

                {/* ═══ ANGLES TAB ═══ */}
                {activeModalTab === 'angles' && !showAddAngle && (
                  <div className="scene-sets-modal-section">
                    {/* Action bar */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      {generableAngles.length > 0 && (
                        <button className="scene-sets-btn-generate" onClick={() => onGenerateAll(set, false)} disabled={isGenerating}>
                          <Sparkles size={11} /> Generate All ({generableAngles.length})
                        </button>
                      )}
                      {hasBase && (
                        <button className="scene-sets-btn-details" disabled={seeding} onClick={async () => {
                          setSeeding(true);
                          showToast('Suggesting more angles...');
                          try {
                            const r = await fetch(`${API_BASE}/scene-sets/${set.id}/suggest-angles-from-image`, { method: 'POST' });
                            const d = await r.json();
                            if (d.success) showToast(`${d.angles_created || 0} new angles added`);
                            else showToast(d.error || 'Failed', 'error');
                          } catch (e) { showToast(e.message, 'error'); }
                          setSeeding(false);
                        }}>
                          {seeding ? <Loader size={11} className="spin" /> : <Plus size={11} />} Suggest More
                        </button>
                      )}
                    </div>

                    {/* Clean angle list */}
                    <div className="scene-sets-angle-list">
                      {sortedAngles.map(a => {
                        const isComplete = a.generation_status === 'complete' && a.still_image_url;
                        const isFailed = a.generation_status === 'failed';
                        const isGen = a.generation_status === 'generating';
                        return (
                          <div key={a.id} className={`scene-sets-angle-row${isComplete ? ' complete' : ''}${isFailed ? ' failed' : ''}`}>
                            <div className="scene-sets-angle-row-thumb">
                              {isComplete ? (
                                <img src={bustUrl(a.still_image_url)} alt={a.angle_label} onClick={() => { setSelectedAngleId(a.id); setShowBaseLightbox(true); }} />
                              ) : isGen ? (
                                <div className="scene-sets-angle-row-placeholder"><Loader size={12} className="spin" /></div>
                              ) : (
                                <div className="scene-sets-angle-row-placeholder"><Sparkles size={12} /></div>
                              )}
                            </div>
                            <div className="scene-sets-angle-row-info">
                              <div className="scene-sets-angle-row-label">{a.angle_label}</div>
                              <div className="scene-sets-angle-row-name">{a.angle_name}</div>
                            </div>
                            <div className="scene-sets-angle-row-status">
                              {isComplete && (() => {
                                const sv = a.quality_review?.spec_validation;
                                if (sv) {
                                  const scoreColor = sv.score >= 80 ? '#16a34a' : sv.score >= 60 ? '#B8962E' : '#dc2626';
                                  return (
                                    <span title={sv.missing_required?.length ? `Missing: ${sv.missing_required.join(', ')}` : `Spec score: ${sv.score}`}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 9, color: scoreColor, fontFamily: "'DM Mono', monospace" }}>
                                      {sv.pass ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                                      {sv.score}
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                              {isComplete && (
                                <button
                                  className="scene-sets-angle-row-btn scene-sets-promote-btn"
                                  title="Use this image as the base — regenerate all other angles from it"
                                  onClick={async () => {
                                    if (!confirm(`Use "${a.angle_name}" as the new base image? All other angles will be reset and regenerated from this one.`)) return;
                                    try {
                                      const r = await fetch(`${API_BASE}/scene-sets/${set.id}/promote-to-base`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ angle_id: a.id }),
                                      });
                                      const d = await r.json();
                                      if (d.success) showToast(d.message);
                                      else showToast(d.error, 'error');
                                    } catch { showToast('Failed to promote', 'error'); }
                                  }}
                                >
                                  <Heart size={12} /> Use as Base
                                </button>
                              )}
                              {isComplete && <CheckCircle2 size={14} style={{ color: '#16a34a' }} />}
                              {isFailed && (
                                <button className="scene-sets-angle-row-btn" onClick={() => onGenerateAngle(set, a)} title="Retry">
                                  <AlertCircle size={14} style={{ color: '#dc2626' }} />
                                </button>
                              )}
                              {!isComplete && !isFailed && !isGen && (
                                <button className="scene-sets-angle-row-btn" onClick={() => onGenerateAngle(set, a)} title="Generate">
                                  <Sparkles size={12} />
                                </button>
                              )}
                              {isGen && <Loader size={14} className="spin" style={{ color: '#B8962E' }} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {sortedAngles.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                        <Camera size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
                        <div style={{ fontSize: 13 }}>No angles yet. Upload a base image first.</div>
                      </div>
                    )}
                  </div>
                )}

                {/* ═══ SPEC TAB ═══ */}
                {activeModalTab === 'spec' && !showAddAngle && (
                  <div className="scene-sets-modal-section">
                    {!hasSpec && (
                      <div style={{ textAlign: 'center', padding: 32 }}>
                        <FileText size={32} style={{ color: '#94a3b8', marginBottom: 12 }} />
                        <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
                          No scene spec yet. Build one from your base image to enforce object consistency across angles.
                        </div>
                        <button
                          className="scene-sets-btn-generate"
                          disabled={buildingSpec}
                          onClick={async () => {
                            setBuildingSpec(true);
                            setSpecProgress('sending');
                            try {
                              const progressTimer = setTimeout(() => setSpecProgress('analyzing'), 1500);
                              const parseTimer = setTimeout(() => setSpecProgress('parsing'), 12000);
                              const r = await fetch(`${API_BASE}/scene-sets/${set.id}/spec/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
                              clearTimeout(progressTimer);
                              clearTimeout(parseTimer);
                              const d = await r.json();
                              if (d.success) {
                                setSpecProgress('done');
                                showToast(`Spec built: ${d.data?.objects?.length || 0} objects, ${d.data?.zones?.length || 0} zones, ${d.data?.camera_contracts?.length || 0} camera contracts`);
                                if (onRefresh) await onRefresh();
                              } else {
                                setSpecProgress('error');
                                showToast(d.error || 'Failed', 'error');
                              }
                            } catch (e) { setSpecProgress('error'); showToast(e.message, 'error'); }
                            setBuildingSpec(false);
                            setTimeout(() => setSpecProgress(null), 2000);
                          }}
                        >
                          {buildingSpec ? <><Loader size={12} className="spin" /> {specProgress === 'sending' ? 'Sending image...' : specProgress === 'analyzing' ? 'Cataloging objects...' : specProgress === 'parsing' ? 'Building contracts...' : 'Building...'}</> : <><Sparkles size={12} /> Build Scene Spec from Image</>}
                        </button>
                        {buildingSpec && (
                          <div style={{ marginTop: 12, padding: 12, background: '#f8f6f1', borderRadius: 8, fontSize: 11, color: '#555', lineHeight: 1.6 }}>
                            <div style={{ fontWeight: 600, color: '#2C2C2C', marginBottom: 6 }}>What's happening:</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, opacity: specProgress === 'sending' ? 1 : 0.4 }}>
                              {specProgress === 'sending' ? <Loader size={10} className="spin" style={{ color: '#B8962E' }} /> : <CheckCircle2 size={10} style={{ color: '#16a34a' }} />}
                              Sending image to Claude Vision
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, opacity: specProgress === 'analyzing' ? 1 : specProgress === 'parsing' || specProgress === 'done' ? 0.4 : 0.2 }}>
                              {specProgress === 'analyzing' ? <Loader size={10} className="spin" style={{ color: '#B8962E' }} /> : specProgress === 'parsing' || specProgress === 'done' ? <CheckCircle2 size={10} style={{ color: '#16a34a' }} /> : <FileText size={10} style={{ color: '#ccc' }} />}
                              Identifying objects, materials, textures, colors
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: specProgress === 'parsing' ? 1 : specProgress === 'done' ? 0.4 : 0.2 }}>
                              {specProgress === 'parsing' ? <Loader size={10} className="spin" style={{ color: '#B8962E' }} /> : specProgress === 'done' ? <CheckCircle2 size={10} style={{ color: '#16a34a' }} /> : <Camera size={10} style={{ color: '#ccc' }} />}
                              Building zones, walls, camera contracts, room states
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {hasSpec && (() => {
                      const spec = set.scene_spec;
                      return (
                        <>
                          {/* Room summary */}
                          {spec.room && (
                            <div style={{ marginBottom: 16, padding: 12, background: '#FAF7F0', borderRadius: 8, border: '1px solid #eee' }}>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, textTransform: 'uppercase', color: '#B8962E', marginBottom: 4 }}>Room</div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#2C2C2C' }}>{spec.room.label || set.name}</div>
                              {spec.room.narrative_role && <div style={{ fontSize: 12, color: '#2C2C2C', marginTop: 4 }}>{spec.room.narrative_role}</div>}
                              {spec.room.atmosphere && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>{spec.room.atmosphere}</div>}
                              <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: '#666', fontFamily: "'DM Mono', monospace", flexWrap: 'wrap' }}>
                                {spec.room.approx_sq_ft && <span>{spec.room.approx_sq_ft} sq ft</span>}
                                {spec.room.ceiling_type && <span>{spec.room.ceiling_type} ceiling</span>}
                                {spec.room.ceiling_height_ft && <span>{spec.room.ceiling_height_ft}ft</span>}
                                {spec.room.shape && <span>{spec.room.shape}</span>}
                                {spec.room.floor && <span>Floor: {spec.room.floor}</span>}
                              </div>
                              {spec.room.color_palette?.length > 0 && (
                                <div style={{ display: 'flex', gap: 4, marginTop: 10, alignItems: 'center' }}>
                                  <span style={{ fontSize: 10, color: '#888', fontFamily: "'DM Mono', monospace", marginRight: 4 }}>Palette:</span>
                                  {spec.room.color_palette.map((c, i) => {
                                    const hex = c.startsWith('#') ? c.split(' ')[0] : c;
                                    const label = c.includes(' ') ? c.split(' ').slice(1).join(' ') : '';
                                    return (
                                      <div key={i} title={c} style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#fff', border: '1px solid #eee', borderRadius: 4, padding: '2px 6px' }}>
                                        <div style={{ width: 12, height: 12, borderRadius: 2, background: hex.startsWith('#') ? hex : '#888', border: '1px solid #ddd' }} />
                                        {label && <span style={{ fontSize: 9, color: '#666' }}>{label}</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Walls */}
                          {spec.walls && Object.keys(spec.walls).length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, textTransform: 'uppercase', color: '#B8962E', marginBottom: 8 }}>
                                Walls ({Object.keys(spec.walls).length})
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                {Object.entries(spec.walls).map(([dir, wall]) => (
                                  <div key={dir} style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: 6, padding: '6px 10px', fontSize: 11 }}>
                                    <div style={{ fontWeight: 600, color: '#2C2C2C', textTransform: 'capitalize' }}>{dir}: {wall.label}</div>
                                    <div style={{ fontSize: 10, color: '#666', marginTop: 2, lineHeight: 1.4 }}>{wall.description}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Zones */}
                          {spec.zones?.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, textTransform: 'uppercase', color: '#B8962E', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <MapPin size={10} /> Zones ({spec.zones.length})
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {spec.zones.map(z => (
                                  <div key={z.id} style={{ background: '#f0f0f0', borderRadius: 6, padding: '6px 10px', fontSize: 11 }}>
                                    <div style={{ fontWeight: 600, color: '#2C2C2C' }}>{z.label}</div>
                                    {z.purpose && <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{z.purpose}</div>}
                                    <div style={{ fontSize: 9, color: '#aaa', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{z.object_ids?.length || 0} objects</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Objects */}
                          {spec.objects?.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, textTransform: 'uppercase', color: '#B8962E', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Box size={10} /> Objects ({spec.objects.length})
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 6 }}>
                                {spec.objects.map(obj => (
                                  <div key={obj.id} style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: 6, padding: '8px 10px', fontSize: 11 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <span style={{
                                        width: 6, height: 6, borderRadius: '50%',
                                        background: obj.category === 'signature' ? '#B8962E' : obj.category === 'anchor' ? '#2563eb' : obj.category === 'character' ? '#9333ea' : obj.category === 'lighting' ? '#f59e0b' : '#94a3b8',
                                        flexShrink: 0,
                                      }} />
                                      <span style={{ fontWeight: 600, color: '#2C2C2C' }}>{obj.label}</span>
                                      <span style={{ fontSize: 9, color: '#aaa', fontFamily: "'DM Mono', monospace", marginLeft: 'auto' }}>{obj.category}</span>
                                    </div>
                                    <div style={{ fontSize: 10, color: '#666', marginTop: 3, lineHeight: 1.4 }}>{obj.description}</div>
                                    <div style={{ fontSize: 9, color: '#999', marginTop: 3, fontFamily: "'DM Mono', monospace" }}>
                                      {obj.zone && <span>zone: {obj.zone}</span>}
                                      {obj.wall && <span> · wall: {obj.wall}</span>}
                                    </div>
                                    {obj.continuity && Object.keys(obj.continuity).filter(k => obj.continuity[k]).length > 0 && (
                                      <div style={{ marginTop: 4, padding: '3px 6px', background: '#fef3c7', borderRadius: 4, fontSize: 9, fontFamily: "'DM Mono', monospace" }}>
                                        {obj.continuity.locked_text && <div style={{ color: '#92400e' }}>text: &quot;{obj.continuity.locked_text}&quot;</div>}
                                        {obj.continuity.locked_color && <div style={{ color: '#92400e', display: 'flex', alignItems: 'center', gap: 3 }}>color: <span style={{ width: 8, height: 8, borderRadius: 2, background: obj.continuity.locked_color, display: 'inline-block', border: '1px solid #ccc' }} /> {obj.continuity.locked_color}</div>}
                                        {obj.continuity.locked_material && <div style={{ color: '#92400e' }}>material: {obj.continuity.locked_material}</div>}
                                        {obj.continuity.locked_position && <div style={{ color: '#92400e' }}>position: {obj.continuity.locked_position}</div>}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Camera Contracts */}
                          {spec.camera_contracts?.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, textTransform: 'uppercase', color: '#B8962E', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Camera size={10} /> Camera Contracts ({spec.camera_contracts.length})
                              </div>
                              {spec.camera_contracts.map((c, i) => (
                                <div key={i} style={{ marginBottom: 8, padding: 10, background: '#fafafa', border: '1px solid #eee', borderRadius: 6 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Camera size={12} style={{ color: '#B8962E' }} />
                                    <span style={{ fontWeight: 600, fontSize: 12, color: '#2C2C2C' }}>{c.angle}</span>
                                  </div>
                                  {c.description && <div style={{ fontSize: 11, color: '#666', marginTop: 4, lineHeight: 1.4 }}>{c.description}</div>}
                                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {(c.required || []).map(id => {
                                      const obj = spec.objects?.find(o => o.id === id);
                                      return <span key={id} title={obj?.description || id} style={{ background: '#dcfce7', color: '#166534', fontSize: 9, padding: '2px 6px', borderRadius: 4, fontFamily: "'DM Mono', monospace", cursor: 'help' }}>✓ {obj?.label || id}</span>;
                                    })}
                                    {(c.expected || []).map(id => {
                                      const obj = spec.objects?.find(o => o.id === id);
                                      return <span key={id} title={obj?.description || id} style={{ background: '#fef3c7', color: '#92400e', fontSize: 9, padding: '2px 6px', borderRadius: 4, fontFamily: "'DM Mono', monospace", cursor: 'help' }}>~ {obj?.label || id}</span>;
                                    })}
                                    {(c.out_of_frame || []).map(id => {
                                      const obj = spec.objects?.find(o => o.id === id);
                                      return <span key={id} title={obj?.description || id} style={{ background: '#fecaca', color: '#991b1b', fontSize: 9, padding: '2px 6px', borderRadius: 4, fontFamily: "'DM Mono', monospace", cursor: 'help' }}>✗ {obj?.label || id}</span>;
                                    })}
                                  </div>
                                  {c.validation && <div style={{ fontSize: 10, color: '#888', marginTop: 6, fontStyle: 'italic', lineHeight: 1.4 }}>{c.validation}</div>}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Room States */}
                          {spec.states?.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, textTransform: 'uppercase', color: '#B8962E', marginBottom: 8 }}>
                                Room States ({spec.states.length})
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {spec.states.map(s => (
                                  <div key={s.id} style={{ background: '#f8f4ff', border: '1px solid #e9e5f5', borderRadius: 6, padding: '6px 10px', fontSize: 11, minWidth: 120 }}>
                                    <div style={{ fontWeight: 600, color: '#2C2C2C' }}>{s.label}</div>
                                    <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{s.time}</div>
                                    {s.ambient && <div style={{ fontSize: 10, color: '#666', marginTop: 4, fontStyle: 'italic', lineHeight: 1.3 }}>{typeof s.ambient === 'string' ? s.ambient.slice(0, 100) : ''}...</div>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button className="scene-sets-btn-details" disabled={buildingSpec} onClick={async () => {
                              setBuildingSpec(true);
                              setSpecProgress('sending');
                              try {
                                const progressTimer = setTimeout(() => setSpecProgress('analyzing'), 1500);
                                const parseTimer = setTimeout(() => setSpecProgress('parsing'), 12000);
                                const r = await fetch(`${API_BASE}/scene-sets/${set.id}/spec/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true }) });
                                clearTimeout(progressTimer);
                                clearTimeout(parseTimer);
                                const d = await r.json();
                                if (d.success) {
                                  setSpecProgress('done');
                                  showToast(`Spec rebuilt: ${d.data?.objects?.length || 0} objects, ${d.data?.camera_contracts?.length || 0} contracts`);
                                  if (onRefresh) await onRefresh();
                                } else {
                                  setSpecProgress('error');
                                  showToast(d.error || 'Failed', 'error');
                                }
                              } catch (e) { setSpecProgress('error'); showToast(e.message, 'error'); }
                              setBuildingSpec(false);
                              setTimeout(() => setSpecProgress(null), 2000);
                            }}>
                              {buildingSpec ? <Loader size={11} className="spin" /> : <RefreshCw size={11} />} Rebuild Spec
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* ═══ TOOLS (hidden — merged into Overview) ═══ */}
                {activeModalTab === 'tools_REMOVED' && (
                  <div className="scene-sets-modal-section">
                    {/* Style section */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Style Consistency</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="scene-sets-btn-generate" disabled={toolsAction === 'locking_style'} onClick={async () => {
                          setToolsAction('locking_style');
                          try { const r = await fetch(`${API_BASE}/scene-sets/${set.id}/lock-style`, { method: 'POST' }); const d = await r.json(); if (d.success) showToast(`Style locked: ${d.data.design_style || 'done'}`); } catch (e) { showToast(e.message, 'error'); } finally { setToolsAction(null); }
                        }}><Lock size={11} /> {toolsAction === 'locking_style' ? 'Analyzing...' : 'Lock Style DNA'}</button>
                      </div>
                      {set.visual_language?.locked && (
                        <div style={{ marginTop: 8, padding: 10, background: '#f8fafc', borderRadius: 8, fontSize: 11 }}>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            {set.visual_language.color_palette && <div><strong>Palette:</strong> {set.visual_language.color_palette.map((c, i) => <span key={i} style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: c, marginLeft: 3, border: '1px solid #e2e8f0', verticalAlign: -2 }} />)}</div>}
                            {set.visual_language.materials && <div><strong>Materials:</strong> {set.visual_language.materials.join(', ')}</div>}
                            {set.visual_language.lighting_type && <div><strong>Lighting:</strong> {set.visual_language.lighting_type}</div>}
                            {set.visual_language.design_style && <div><strong>Style:</strong> {set.visual_language.design_style}</div>}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Show Brain section */}
                    <div style={{ marginBottom: 16 }}>
                      <div className="scene-sets-tools-label">Show Brain</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="scene-sets-btn-generate" disabled={toolsAction === 'learning'} onClick={async () => {
                          setToolsAction('learning');
                          try {
                            const r = await fetch(`${API_BASE}/scene-sets/${set.id}/learn-location`, { method: 'POST' });
                            const d = await r.json();
                            if (d.success) showToast(d.message || 'Location learned');
                          } catch (e) { showToast(e.message, 'error'); }
                          setToolsAction(null);
                        }}>
                          <Sparkles size={11} /> {toolsAction === 'learning' ? 'Teaching...' : 'Teach Show Brain'}
                        </button>
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                        Registers this location in the show's world — the brain will know about it when writing scenes, suggesting locations, and building the world.
                        {set.world_location_id && <span style={{ color: '#16a34a', marginLeft: 6 }}> Linked to world map</span>}
                      </div>
                    </div>

                    {/* Mood Variants — same room, different lighting */}
                    {hasBase && (
                      <div style={{ marginBottom: 16 }}>
                        <div className="scene-sets-tools-label">Mood Variations</div>
                        <p style={{ fontSize: 10, color: '#94a3b8', marginBottom: 8 }}>Same room, same furniture — only the lighting and atmosphere changes. No regeneration needed.</p>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {[
                            { key: 'morning', label: '🌅 Morning', desc: 'Golden sunrise light' },
                            { key: 'golden_hour', label: '🌇 Golden Hour', desc: 'Warm amber' },
                            { key: 'night', label: '🌙 Night', desc: 'Neon + fairy glow' },
                            { key: 'glam', label: '💄 Glam', desc: 'Vanity lights bright' },
                            { key: 'filming', label: '🎥 Filming', desc: 'Ring light studio' },
                            { key: 'cozy', label: '🕯️ Cozy', desc: 'Warm lamps' },
                            { key: 'dramatic', label: '🎭 Dramatic', desc: 'High contrast' },
                          ].map(m => (
                            <button
                              key={m.key}
                              className="scene-sets-mood-btn"
                              disabled={toolsAction === `mood_${m.key}`}
                              onClick={async () => {
                                setToolsAction(`mood_${m.key}`);
                                try {
                                  const r = await fetch(`${API_BASE}/scene-sets/${set.id}/mood-variants`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ moods: [m.key] }),
                                  });
                                  const d = await r.json();
                                  if (d.success) showToast(`${m.label} variant created`);
                                  else showToast(d.error, 'error');
                                } catch (e) { showToast(e.message, 'error'); }
                                setToolsAction(null);
                              }}
                              title={m.desc}
                            >
                              {toolsAction === `mood_${m.key}` ? <Loader size={10} className="spin" /> : m.label}
                            </button>
                          ))}
                        </div>
                        {/* Show generated mood variants */}
                        {set.visual_language?.mood_variants?.base && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto' }}>
                            {Object.entries(set.visual_language.mood_variants.base).map(([mood, url]) => (
                              <div key={mood} style={{ flexShrink: 0, textAlign: 'center' }}>
                                <img
                                  src={bustUrl(url)}
                                  alt={mood}
                                  style={{ width: 80, height: 52, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
                                  onClick={() => { window.open(url, '_blank'); }}
                                />
                                <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 2, textTransform: 'capitalize' }}>{mood.replace('_', ' ')}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Analysis section */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Analysis</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="scene-sets-btn-generate" onClick={async () => {
                          try { const r = await fetch(`${API_BASE}/scene-sets/${set.id}/comparison`); setComparison(await r.json()); } catch {}
                        }}><Eye size={11} /> Side-by-Side Compare</button>

                        <button className="scene-sets-btn-generate" onClick={async () => {
                          try { const r = await fetch(`${API_BASE}/scene-sets/${set.id}/wardrobe-match`); setWardrobeMatch(await r.json()); } catch {}
                        }}><Heart size={11} /> Wardrobe Match</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Prompt tab — shows the generated AI prompt (read-only) */}

                {/* Add Angle tab */}
                {showAddAngle && (
                  <div className="scene-sets-modal-section">
                    <div className="scene-sets-add-angle-row">
                      <div className="scene-sets-create-field"><label>Label</label><input type="text" list="angle-label-suggestions" placeholder="e.g. WIDE or custom" value={newAngle.angle_label} onChange={e => setNewAngle(a => ({ ...a, angle_label: e.target.value }))} autoFocus /><datalist id="angle-label-suggestions"><option value="WIDE" /><option value="CLOSE" /><option value="ESTABLISHING" /><option value="WINDOW" /><option value="DOORWAY" /><option value="OVERHEAD" /><option value="ACTION" /><option value="VANITY" /><option value="CLOSET" /><option value="OTHER" /></datalist></div>
                      <div className="scene-sets-create-field"><label>Name</label><input type="text" placeholder="e.g. Wide Morning" value={newAngle.angle_name} onChange={e => setNewAngle(a => ({ ...a, angle_name: e.target.value }))} /></div>
                      <div className="scene-sets-create-field"><label>Beats <span className="scene-sets-optional">(comma-sep)</span></label><input type="text" placeholder="1,2,3" value={newAngle.beat_affinity} onChange={e => setNewAngle(a => ({ ...a, beat_affinity: e.target.value }))} /></div>
                    </div>
                    <div className="scene-sets-camera-direction-row">
                      <div className="scene-sets-create-field"><label>Camera Direction <span className="scene-sets-optional">(optional)</span></label><input type="text" placeholder="Camera placement and movement..." value={newAngle.camera_direction} onChange={e => setNewAngle(a => ({ ...a, camera_direction: e.target.value }))} /></div>
                      {set.canonical_description && (
                        <button className="scene-sets-ai-assist-btn" onClick={handleAiAssist} disabled={aiAssistLoading} title="AI-generate camera direction">
                          {aiAssistLoading ? <Loader size={10} className="spin" /> : <Sparkles size={10} />} AI
                        </button>
                      )}
                    </div>
                    <div className="scene-sets-angle-upload-row">
                      <input ref={angleUploadRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; setAngleUploadFile(file); const reader = new FileReader(); reader.onload = () => setAngleUploadPreview(reader.result); reader.readAsDataURL(file); e.target.value = ''; }} />
                      {angleUploadPreview ? (
                        <div className="scene-sets-angle-upload-preview">
                          <img src={angleUploadPreview} alt="Upload preview" />
                          <button type="button" onClick={() => { setAngleUploadFile(null); setAngleUploadPreview(null); }} className="scene-sets-angle-upload-remove"><X size={10} /></button>
                          <span className="scene-sets-angle-upload-name">{angleUploadFile?.name}</span>
                        </div>
                      ) : (
                        <button type="button" className="scene-sets-angle-upload-btn" onClick={() => angleUploadRef.current?.click()}>
                          <Upload size={12} /> Upload Image <span className="scene-sets-optional">(optional)</span>
                        </button>
                      )}
                    </div>
                    <div className="scene-sets-modal-actions">
                      <button className="scene-sets-btn-generate" onClick={handleSubmitAngle} disabled={addingAngle || !newAngle.angle_label.trim() || !newAngle.angle_name.trim()}>
                        {addingAngle ? <><Loader size={12} className="spin" /> Adding...</> : <><Plus size={12} /> Add Angle</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── AI Angle Suggestions Panel ──────────────────────── */}
        {suggestions && (
          <div className="scene-sets-suggestions-panel">
            <div className="scene-sets-suggestions-header">
              <h4>Suggested Angles</h4>
              <button className="scene-sets-btn-delete" onClick={() => { setSuggestions(null); setSelectedSuggestions([]); }} style={{ padding: '2px 8px', fontSize: '11px' }}>
                <X size={10} /> Dismiss
              </button>
            </div>
            {suggestions.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#999', margin: '4px 0' }}>No suggestions available.</p>
            ) : (
              <>
                <div className="scene-sets-suggestions-list">
                  {suggestions.map((s, idx) => (
                    <div key={idx} className={`scene-sets-suggestion-item${selectedSuggestions.includes(idx) ? ' selected' : ''}`} onClick={() => toggleSuggestion(idx)}>
                      <input type="checkbox" checked={selectedSuggestions.includes(idx)} onChange={() => toggleSuggestion(idx)} />
                      <div className="scene-sets-suggestion-info">
                        <div>
                          <span className="scene-sets-suggestion-label">{s.angle_label}</span>
                          <span className="scene-sets-suggestion-name">{s.angle_name}</span>
                        </div>
                        {s.description && <div className="scene-sets-suggestion-desc">{s.description}</div>}
                        {s.camera_direction && <div className="scene-sets-suggestion-camera">{s.camera_direction}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="scene-sets-suggestions-actions">
                  <button className="scene-sets-btn-generate" onClick={handleAddSelectedSuggestions} disabled={addingSuggestions || selectedSuggestions.length === 0}>
                    {addingSuggestions ? <><Loader size={12} className="spin" /> Adding...</> : <><Plus size={12} /> Add {selectedSuggestions.length} Selected</>}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Episode Manager Panel ──────────────────────── */}
        {showEpisodeManager && (
          <div className="scene-sets-episode-manager">
            <div className="scene-sets-episode-manager-header">
              <span>Link Episodes</span>
              <button className="scene-sets-btn-delete" onClick={() => setShowEpisodeManager(false)} style={{ padding: '2px 8px', fontSize: '11px' }}>
                <X size={10} /> Close
              </button>
            </div>
            {/* Current episodes */}
            {set.episodes && set.episodes.length > 0 && (
              <div className="scene-sets-episode-list">
                {set.episodes.map(ep => (
                  <span key={ep.id} className="scene-sets-episode-chip">
                    {ep.season_number ? `S${ep.season_number}` : ''}E{ep.episode_number || '?'} {ep.title}
                    <button onClick={() => onUnlinkEpisode(set, ep.id)} title="Remove"><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
            {/* Add episodes */}
            <div className="scene-sets-episode-add-row">
              <select
                value={selectedShowForLink}
                onChange={e => {
                  setSelectedShowForLink(e.target.value);
                  setEpisodesToLink([]);
                  if (e.target.value && onLoadEpisodes) onLoadEpisodes(e.target.value);
                }}
              >
                <option value="">Select Show...</option>
                {(allShows || []).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {selectedShowForLink && (
                <select
                  multiple
                  value={episodesToLink}
                  onChange={e => setEpisodesToLink(Array.from(e.target.selectedOptions, o => o.value))}
                  style={{ minHeight: '60px' }}
                >
                  {(allEpisodes || [])
                    .filter(ep => ep.show_id === selectedShowForLink)
                    .filter(ep => !set.episodes?.some(linked => linked.id === ep.id))
                    .map(ep => (
                      <option key={ep.id} value={ep.id}>
                        {ep.season_number ? `S${ep.season_number}` : ''}E{ep.episode_number || '?'} — {ep.title}
                      </option>
                    ))}
                </select>
              )}
              {episodesToLink.length > 0 && (
                <button
                  className="scene-sets-btn-generate"
                  onClick={() => {
                    onLinkEpisodes(set, episodesToLink);
                    setEpisodesToLink([]);
                  }}
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                >
                  <Plus size={10} /> Link {episodesToLink.length}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Lightboxes (portaled) ─────────────────────────── */}
      {showBaseLightbox && (() => {
        // Build gallery: base image first, then all angles with stills
        const galleryImages = [];
        if (set.base_still_url) {
          galleryImages.push({ src: bustUrl(set.base_still_url), label: 'BASE', thumbSrc: bustUrl(set.base_still_url) });
        }
        sortedAngles.forEach(a => {
          if (a.still_image_url) {
            galleryImages.push({
              src: bustUrl(a.still_image_url),
              label: a.angle_label || a.angle_name,
              thumbSrc: bustUrl(a.still_image_url),
              videoUrl: a.video_clip_url ? bustUrl(a.video_clip_url) : null,
              angleId: a.id,
            });
          }
        });
        if (galleryImages.length === 0) return null;
        // Find initial index: match selected angle or hero
        let startIdx = 0;
        if (selectedAngle?.still_image_url) {
          const found = galleryImages.findIndex(g => g.src === bustUrl(selectedAngle.still_image_url));
          if (found >= 0) startIdx = found;
        }
        return <ImageLightbox images={galleryImages} initialIndex={startIdx} onClose={() => setShowBaseLightbox(false)} onDeleteAngle={(angleId) => onDeleteSingleAngle(set, angleId)} setId={set.id} onPromoteToBase={() => showToast('Promoted to base! Refresh to see changes.')} />;
      })()}

      {showPromptPreview && previewData && createPortal(
        <div className="scene-sets-lightbox-overlay" onClick={() => setShowPromptPreview(false)}>
          <div className="scene-sets-prompt-preview-modal" onClick={e => e.stopPropagation()}>
            <button className="scene-sets-lightbox-close" onClick={() => setShowPromptPreview(false)}><X size={20} /></button>
            <h3 className="scene-sets-prompt-preview-title">Prompt Preview — {previewData.angleLabel}</h3>
            <div className="scene-sets-prompt-preview-section"><label>Still Image Prompt ({previewData.promptLength} chars)</label><pre className="scene-sets-prompt-preview">{previewData.prompt}</pre></div>
            <div className="scene-sets-prompt-preview-section"><label>Video Movement Prompt</label><pre className="scene-sets-prompt-preview">{previewData.videoPrompt}</pre></div>
          </div>
        </div>,
        document.body
      )}

      {/* Comparison Modal (card-level) */}
      {comparison && createPortal(
        <div className="scene-sets-modal-backdrop" onClick={() => setComparison(null)}>
          <div className="scene-sets-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 900 }}>
            <div className="scene-sets-modal-header">
              <h3 className="scene-sets-modal-title">Side-by-Side Comparison</h3>
              <button className="scene-sets-modal-close" onClick={() => setComparison(null)}><X size={16} /></button>
            </div>
            <div className="scene-sets-modal-body" style={{ maxHeight: '70vh', overflow: 'auto' }}>
              {comparison.comparisons?.map(c => (
                <div key={c.angle_id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>ORIGINAL</div>
                    {c.original ? <img src={c.original} alt="Original" style={{ width: '100%', borderRadius: 6 }} /> : <div style={{ padding: 20, textAlign: 'center', color: '#ccc' }}>No base image</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>{c.angle_name} {c.favorited ? '\u2605' : ''} {c.quality_score ? `(${c.quality_score}/100)` : ''}</div>
                    <img src={c.generated} alt={c.angle_name} style={{ width: '100%', borderRadius: 6 }} />
                  </div>
                </div>
              ))}
              {(!comparison.comparisons || comparison.comparisons.length === 0) && (
                <p style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>No generated angles to compare yet.</p>
              )}
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}, (prev, next) => {
  // Only re-render when meaningful rendering data changes, not on every poll
  if (prev.isGeneratingProp !== next.isGeneratingProp) return false;
  if (prev.set.updated_at !== next.set.updated_at) return false;
  if (prev.generationProgress !== next.generationProgress) return false;
  const ps = prev.set, ns = next.set;
  if (ps.id !== ns.id) return false;
  if (ps.name !== ns.name) return false;
  if (ps.generation_status !== ns.generation_status) return false;
  if (ps.base_still_url !== ns.base_still_url) return false;
  if (ps.scene_type !== ns.scene_type) return false;
  if (ps.canonical_description !== ns.canonical_description) return false;
  if (ps.cover_angle_id !== ns.cover_angle_id) return false;
  if (ps.show_id !== ns.show_id) return false;
  if (ps.time_of_day !== ns.time_of_day) return false;
  if (ps.season !== ns.season) return false;
  if ((ps.episodes || []).length !== (ns.episodes || []).length) return false;
  if (prev.allShows !== next.allShows) return false;
  if (prev.allEpisodes !== next.allEpisodes) return false;
  const pa = ps.angles || [], na = ns.angles || [];
  if (pa.length !== na.length) return false;
  for (let i = 0; i < pa.length; i++) {
    if (pa[i].id !== na[i].id) return false;
    if (pa[i].generation_status !== na[i].generation_status) return false;
    if (pa[i].still_image_url !== na[i].still_image_url) return false;
    if (pa[i].video_clip_url !== na[i].video_clip_url) return false;
  }
  return true;
});

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function SceneSetsTab() {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatingIds, setGeneratingIds] = useState(new Set());
  const [generationProgressMap, setGenerationProgressMap] = useState({});
  const [specStageMap, setSpecStageMap] = useState({}); // { [setId]: 'uploading' | 'building_spec' | 'creating_angles' | null }

  // Helpers to manage multi-set generation tracking
  const startGenerating = useCallback((id) => {
    setGeneratingIds(prev => { const next = new Set(prev); next.add(id); return next; });
  }, []);
  const stopGenerating = useCallback((id) => {
    setGeneratingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    setGenerationProgressMap(prev => { const next = { ...prev }; delete next[id]; return next; });
  }, []);
  const setProgress = useCallback((id, progressOrFn) => {
    setGenerationProgressMap(prev => ({
      ...prev,
      [id]: typeof progressOrFn === 'function' ? progressOrFn(prev[id]) : progressOrFn,
    }));
  }, []);

  const [toast, setToast] = useState(null);
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newSet, setNewSet] = useState({ name: '', scene_type: 'HOME_BASE', canonical_description: '', show_id: '', episode_ids: [], time_of_day: '', season: '', room_size: '', ceiling_height: '', room_shape: '' });
  const [descBuilderLoading, setDescBuilderLoading] = useState(false);
  const [showDescBuilder, setShowDescBuilder] = useState(false);
  const [builderAnswers, setBuilderAnswers] = useState({});
  const [builderStep, setBuilderStep] = useState(0);
  const [reviewModal, setReviewModal] = useState(null); // { setId, angle }
  const [allShows, setAllShows] = useState([]);
  const [allEpisodes, setAllEpisodes] = useState([]);
  const [wardrobeMatch, setWardrobeMatch] = useState(null);
  const [filmstrip, setFilmstrip] = useState(null);
  const [angleHistory, setAngleHistory] = useState(null);
  const [createShowId, setCreateShowId] = useState('');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const initialLoadDone = useRef(false);
  const fetchSets = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/scene-sets`);
      const json = await res.json();
      setSets(json.data || []);
      setError(null);
      initialLoadDone.current = true;
    } catch {
      // Only show error on initial load, not on poll failures
      if (!initialLoadDone.current) {
        setError('Failed to load locations');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSets(); }, [fetchSets]);

  // Fetch shows for selectors
  useEffect(() => {
    fetch(`${API_BASE}/shows`).then(r => r.json()).then(d => setAllShows(d.data || [])).catch(() => {});
  }, []);

  const loadEpisodesForShow = useCallback(async (showId) => {
    try {
      const res = await fetch(`${API_BASE}/episodes?show_id=${showId}&limit=100`);
      const json = await res.json();
      setAllEpisodes(prev => {
        const otherShows = prev.filter(ep => ep.show_id !== showId);
        return [...otherShows, ...(json.data || [])];
      });
    } catch { /* silent */ }
  }, []);

  // Auto-poll while any generation is in progress
  useEffect(() => {
    const hasGenerating = sets.some(s =>
      s.generation_status === 'generating' ||
      s.angles?.some(a => a.generation_status === 'generating')
    );
    if (!hasGenerating) return;
    const timer = setTimeout(fetchSets, 5000);
    return () => clearTimeout(timer);
  }, [sets, fetchSets]);

  // Poll a job until it completes or fails; returns the final job data
  const pollJob = useCallback(async (jobId) => {
    const maxPolls = 60; // 60 * 3s = 3 min max
    let consecutiveErrors = 0;
    for (let i = 0; i < maxPolls; i++) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const res = await fetch(`${API_BASE}/scene-sets/jobs/${jobId}`);
        if (res.status === 404) return { status: 'failed', error: 'Job not found — generation may not be configured' };
        if (res.status === 502 || res.status === 503) {
          consecutiveErrors++;
          if (consecutiveErrors >= 3) return { status: 'failed', error: 'Server unavailable' };
          continue;
        }
        if (!res.ok) { consecutiveErrors++; if (consecutiveErrors >= 5) return { status: 'failed', error: 'Too many errors' }; continue; }
        consecutiveErrors = 0;
        const json = await res.json();
        const job = json.data;
        if (job.status === 'completed' || job.status === 'failed') return job;
      } catch { consecutiveErrors++; if (consecutiveErrors >= 5) return { status: 'failed', error: 'Network error' }; }
    }
    return { status: 'failed', error: 'Polling timed out' };
  }, []);

  const pollSetStatus = useCallback(async (setId, field = 'generation_status', maxPolls = 30) => {
    for (let i = 0; i < maxPolls; i++) {
      await new Promise(r => setTimeout(r, 4000));
      try {
        const r = await fetch(`${API_BASE}/scene-sets/${setId}`);
        const d = await r.json();
        if (d.data?.[field] === 'complete') return 'completed';
        if (d.data?.[field] === 'failed') return 'failed';
      } catch { /* retry */ }
    }
    return 'timeout';
  }, []);

  const handleGenerateBase = async (set) => {
    startGenerating(set.id);
    try {
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}/generate-base`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Generation failed');
      }
      const json = await res.json();

      if (json.data?.jobId) {
        showToast('Base generation queued...');
        const job = await pollJob(json.data.jobId);
        if (job.status === 'completed') showToast(`Base generated for "${set.name}"`);
        else showToast(job.error || 'Base generation failed', 'error');
      } else {
        showToast('Generating base — this may take 30-60s...');
        const status = await pollSetStatus(set.id);
        if (status === 'completed') showToast(`Base generated for "${set.name}"`);
        else showToast('Base generation failed or timed out', 'error');
      }
      await fetchSets();
    } catch (err) {
      showToast(err.message || 'Generation failed', 'error');
    } finally {
      stopGenerating(set.id);
    }
  };

  const handleRegenerateBase = async (set) => {
    startGenerating(set.id);
    try {
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}/generate-base`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Regeneration failed');
      }
      const json = await res.json();

      if (json.data?.jobId) {
        showToast('Regeneration queued...');
        const job = await pollJob(json.data.jobId);
        if (job.status === 'completed') showToast('Base image regenerated!');
        else showToast(job.error || 'Regeneration failed', 'error');
      } else {
        showToast('Regenerating base — this may take 30-60s...');
        const status = await pollSetStatus(set.id);
        if (status === 'completed') showToast('Base image regenerated!');
        else showToast('Regeneration failed or timed out', 'error');
      }
      await fetchSets();
    } catch (err) {
      showToast(err.message || 'Regeneration failed', 'error');
    } finally {
      stopGenerating(set.id);
    }
  };

  const handleUpdatePrompt = async (set, newDescription) => {
    try {
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonical_description: newDescription }),
      });
      if (!res.ok) throw new Error('Failed to save');
      showToast('Prompt updated');
      fetchSets();
    } catch {
      showToast('Failed to update prompt', 'error');
    }
  };

  const handleUploadBase = async (set, files) => {
    startGenerating(set.id);
    const setStage = (stage) => setSpecStageMap(prev => ({ ...prev, [set.id]: stage }));
    try {
      // ── Stage 1: Upload ──
      setStage('uploading');
      const formData = new FormData();
      const fileList = Array.isArray(files) ? files : [files].filter(Boolean);
      if (fileList.length === 0) throw new Error('No image file selected');
      fileList.forEach((file) => formData.append('images', file));
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}/upload-base`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      await fetchSets();

      // ── Stage 2: Build Scene Spec ──
      setStage('building_spec');
      try {
        const specRes = await fetch(`${API_BASE}/scene-sets/${set.id}/spec/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: true }),
        });
        const specJson = await specRes.json();
        if (specJson.success && specJson.data?.camera_contracts?.length) {
          // ── Stage 3: Create Angles ──
          setStage('creating_angles');
          try {
            await fetch(`${API_BASE}/scene-sets/${set.id}/spec/create-angles`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            });
          } catch { /* non-blocking */ }
        }
      } catch { /* non-blocking */ }

      setStage('done');
      await fetchSets();
      showToast('Setup complete — review your spec, then generate angles!');
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      stopGenerating(set.id);
      // Clear stage after a brief delay so user sees "done"
      setTimeout(() => setStage(null), 2000);
    }
  };

  const handleGenerateAngle = async (set, angle) => {
    try {
      // Quick check if generation is configured
      try {
        const checkRes = await fetch(`${API_BASE}/scene-sets/generation-check`);
        const checkData = await checkRes.json();
        if (!checkData.ready) {
          showToast(checkData.message || 'No image generation API key configured', 'error');
          return;
        }
      } catch { /* proceed anyway */ }

      const res = await fetch(`${API_BASE}/scene-sets/${set.id}/angles/${angle.id}/generate`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Generation failed (${res.status})`);
      }
      const json = await res.json();

      // Refresh to show angle-level spinner in filmstrip
      await fetchSets();

      if (json.data?.jobId) {
        // Legacy job-based flow: poll for completion
        showToast(`Generating "${angle.angle_name}" — queued`);
        const job = await pollJob(json.data.jobId);
        if (job.status === 'completed') {
          showToast(`"${angle.angle_name}" generated!`);
        } else {
          showToast(job.error || 'Angle generation failed', 'error');
        }
      } else {
        // Direct generation flow: poll scene set for angle completion
        showToast(`Generating "${angle.angle_name}" — this may take 30-60s...`);
        const maxPolls = 30;
        for (let i = 0; i < maxPolls; i++) {
          await new Promise(r => setTimeout(r, 4000));
          try {
            const checkRes = await fetch(`${API_BASE}/scene-sets/${set.id}`);
            const checkJson = await checkRes.json();
            const updatedAngle = checkJson.data?.angles?.find(a => a.id === angle.id);
            if (updatedAngle?.generation_status === 'complete') {
              showToast(`"${angle.angle_name}" generated!`);
              break;
            }
            if (updatedAngle?.generation_status === 'failed') {
              showToast('Angle generation failed', 'error');
              break;
            }
          } catch { /* retry */ }
        }
      }
      await fetchSets();
    } catch {
      showToast('Angle generation failed', 'error');
    }
  };

  const handleGenerateAll = async (set, regenerate = false) => {
    const targets = regenerate
      ? set.angles?.filter(a => a.generation_status === 'complete' || a.generation_status === 'failed') || []
      : set.angles?.filter(a => a.generation_status === 'pending') || [];
    if (targets.length === 0) return;
    startGenerating(set.id);

    // Show progress immediately with all angles queued
    const progressAngles = targets.map(a => ({ id: a.id, label: a.angle_label || a.angle_name, status: 'queued' }));
    setProgress(set.id, { angles: progressAngles, currentIndex: 0, startTime: Date.now(), completedCount: 0, failedCount: 0 });

    try {
      // Use the backend batch endpoint — it generates sequentially to avoid rate limits
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}/generate-all-angles`, { method: 'POST' });
      const json = await res.json();

      // Poll for completion
      const maxPolls = 120; // 5s * 120 = 10 minutes max
      for (let poll = 0; poll < maxPolls; poll++) {
        await new Promise(r => setTimeout(r, 5000));
        try {
          const checkRes = await fetch(`${API_BASE}/scene-sets/${set.id}`);
          const checkJson = await checkRes.json();
          const freshAngles = checkJson.data?.angles || [];
          const generating = freshAngles.filter(a => a.generation_status === 'generating').length;
          const completed = freshAngles.filter(a => a.generation_status === 'complete').length;
          const failed = freshAngles.filter(a => a.generation_status === 'failed').length;
          const pending = freshAngles.filter(a => a.generation_status === 'pending').length;

          // Find the current generating angle index
          const currentGenerating = freshAngles.find(a => a.generation_status === 'generating');
          const currentIdx = currentGenerating
            ? progressAngles.findIndex(p => p.id === currentGenerating.id)
            : progressAngles.findIndex(p => p.status === 'queued');

          // Update each angle's status
          const updatedAngles = progressAngles.map(pa => {
            const fresh = freshAngles.find(fa => fa.id === pa.id);
            if (!fresh) return pa;
            if (fresh.generation_status === 'complete') return { ...pa, status: 'done' };
            if (fresh.generation_status === 'failed') return { ...pa, status: 'failed' };
            if (fresh.generation_status === 'generating') return { ...pa, status: 'generating' };
            return pa;
          });

          setProgress(set.id, {
            angles: updatedAngles,
            currentIndex: currentIdx >= 0 ? currentIdx : 0,
            startTime: Date.now() - (poll + 1) * 5000,
            completedCount: completed,
            failedCount: failed,
          });

          if (generating === 0 && pending === 0) {
            if (failed === 0) showToast(`All ${completed} angles generated!`);
            else showToast(`${completed} completed, ${failed} failed`, 'error');
            break;
          }
        } catch { /* retry */ }
      }
      fetchSets();
    } catch (err) {
      showToast(err?.message || 'Generation failed', 'error');
    } finally {
      setTimeout(() => stopGenerating(set.id), 3000);
      stopGenerating(set.id);
    }
  };

  const handleRetryFailed = async (set) => {
    const targets = set.angles?.filter(a => a.generation_status === 'failed') || [];
    if (targets.length === 0) return;
    startGenerating(set.id);

    const progressAngles = targets.map(a => ({ id: a.id, label: a.angle_label, status: 'queued' }));
    setProgress(set.id, { angles: progressAngles, currentIndex: 0, startTime: Date.now(), completedCount: 0, failedCount: 0 });

    try {
      // Fire all retry requests
      for (let i = 0; i < targets.length; i++) {
        try {
          const res = await fetch(`${API_BASE}/scene-sets/${set.id}/angles/${targets[i].id}/generate`, { method: 'POST' });
          if (!res.ok) throw new Error('Failed');
          progressAngles[i].status = 'generating';
        } catch {
          progressAngles[i].status = 'failed';
        }
        setProgress(set.id, (p) => ({ ...p, angles: [...progressAngles] }));
      }

      // Poll scene set for completions
      let completed = 0;
      let failed = progressAngles.filter(a => a.status === 'failed').length;
      const maxPolls = 60;
      for (let poll = 0; poll < maxPolls; poll++) {
        await new Promise(r => setTimeout(r, 4000));
        try {
          const checkRes = await fetch(`${API_BASE}/scene-sets/${set.id}`);
          const checkJson = await checkRes.json();
          const freshAngles = checkJson.data?.angles || [];
          let allDone = true;
          for (let i = 0; i < targets.length; i++) {
            if (progressAngles[i].status === 'failed') continue;
            const fresh = freshAngles.find(a => a.id === targets[i].id);
            if (fresh?.generation_status === 'complete') {
              if (progressAngles[i].status !== 'done') { progressAngles[i].status = 'done'; completed++; }
            } else if (fresh?.generation_status === 'failed') {
              if (progressAngles[i].status !== 'failed') { progressAngles[i].status = 'failed'; failed++; }
            } else { allDone = false; }
          }
          setProgress(set.id, (p) => ({ ...p, angles: [...progressAngles], completedCount: completed, failedCount: failed }));
          if (allDone) break;
        } catch { /* retry */ }
      }

      if (failed === 0) {
        showToast(`All ${targets.length} failed angles retried successfully!`);
      } else {
        showToast(`${completed} recovered, ${failed} still failing`, failed > 0 ? 'error' : 'success');
      }
      fetchSets();
    } catch (err) {
      showToast(err?.message || 'Retry failed', 'error');
    } finally {
      setTimeout(() => stopGenerating(set.id), 3000);
      stopGenerating(set.id);
    }
  };

  const handleCreate = async () => {
    if (!newSet.name.trim()) { showToast('Name is required', 'error'); return; }
    setCreating(true);
    try {
      const createPayload = {
        name: newSet.name.trim(),
        scene_type: newSet.scene_type,
        canonical_description: newSet.canonical_description.trim() || null,
      };
      if (newSet.show_id) createPayload.show_id = newSet.show_id;
      if (newSet.episode_ids?.length > 0) createPayload.episode_ids = newSet.episode_ids;
      if (newSet.time_of_day) createPayload.time_of_day = newSet.time_of_day;
      if (newSet.season) createPayload.season = newSet.season;
      const res = await fetch(`${API_BASE}/scene-sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload),
      });
      if (!res.ok) throw new Error('Failed to create');
      const json = await res.json();

      // Save room properties if set (stored in visual_language JSONB)
      const rp = {};
      if (newSet.room_size) rp.room_size = newSet.room_size;
      if (newSet.ceiling_height) rp.ceiling_height = newSet.ceiling_height;
      if (newSet.room_shape) rp.room_shape = newSet.room_shape;
      if (Object.keys(rp).length > 0 && json.data?.id) {
        try {
          await fetch(`${API_BASE}/scene-sets/${json.data.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_properties: rp }),
          });
        } catch { /* non-critical */ }
      }

      const setName = newSet.name.trim();
      setNewSet({ name: '', scene_type: 'HOME_BASE', canonical_description: '', show_id: '', episode_ids: [], time_of_day: '', season: '', room_size: '', ceiling_height: '', room_shape: '' });
      setCreateShowId('');
      setShowCreateForm(false);
      showToast(`Created "${setName}" — upload a base image to get started`);
      await fetchSets();
    } catch {
      showToast('Failed to create location', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSet = async (set) => {
    if (!window.confirm(`Delete location "${set.name}"? This will soft-delete the location and all its angles.`)) return;
    try {
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      showToast(`Deleted "${set.name}"`);
      fetchSets();
    } catch {
      showToast('Failed to delete location', 'error');
    }
  };

  const handleSetCoverAngle = async (set, angleId) => {
    try {
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}/cover-angle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ angle_id: angleId }),
      });
      if (!res.ok) throw new Error('Failed');
      showToast(angleId ? 'Cover image set' : 'Cover image cleared');
      fetchSets();
    } catch {
      showToast('Failed to set cover image', 'error');
    }
  };

  const handleLinkEpisodes = async (set, episodeIds) => {
    try {
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}/episodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episode_ids: episodeIds }),
      });
      if (!res.ok) throw new Error('Failed');
      showToast(`Linked ${episodeIds.length} episode(s)`);
      fetchSets();
    } catch {
      showToast('Failed to link episodes', 'error');
    }
  };

  const handleUnlinkEpisode = async (set, episodeId) => {
    try {
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}/episodes/${episodeId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      showToast('Episode unlinked');
      fetchSets();
    } catch {
      showToast('Failed to unlink episode', 'error');
    }
  };

  const handleDeleteSingleAngle = async (set, angleId) => {
    try {
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}/angles/${angleId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      showToast('Angle deleted');
      fetchSets();
    } catch {
      showToast('Failed to delete angle', 'error');
    }
  };

  const handleDeleteAllAngles = async (set) => {
    const count = set.angles?.length || 0;
    if (count === 0) return;
    if (!window.confirm(`Delete all ${count} angles for "${set.name}"? They will be soft-deleted and can be recovered.`)) return;
    try {
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}/angles`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      showToast(`Deleted ${count} angles — create new ones or regenerate`);
      fetchSets();
    } catch {
      showToast('Failed to delete angles', 'error');
    }
  };

  const handleReviewAngle = (set, angle) => {
    setReviewModal({ setId: set.id, angle });
  };

  const handleReviewSubmit = (result) => {
    setReviewModal(null);
    if (result === 'review') {
      showToast('Quality review saved');
    } else if (result === 'regenerate') {
      showToast('Regenerating with refined prompt \u2014 typically takes ~45 seconds');
      setTimeout(fetchSets, 5000);
    } else {
      showToast('Review failed', 'error');
    }
    fetchSets();
  };

  const handleAddAngle = async (set, angleData) => {
    try {
      const { _imageFile, ...apiData } = angleData;
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}/angles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Server error (${res.status})`);
      }
      const json = await res.json();
      const newAngle = json.data;

      if (_imageFile && newAngle?.id) {
        // Upload the user's image to this angle
        const formData = new FormData();
        formData.append('images', _imageFile);
        const uploadRes = await fetch(`${API_BASE}/scene-sets/${set.id}/angles/${newAngle.id}/upload`, {
          method: 'POST',
          body: formData,
        });
        if (uploadRes.ok) {
          showToast(`Added angle "${angleData.angle_label}" with uploaded image`);
        } else {
          showToast('Angle created but image upload failed', 'error');
        }
      } else {
        showToast(`Added angle "${angleData.angle_label}"`);
        // Auto-generate the angle image if the scene set has a base image
        if (newAngle?.id && set.base_image_url) {
          handleGenerateAngle(set, newAngle);
        }
      }

      await fetchSets();
    } catch {
      showToast('Failed to add angle', 'error');
    }
  };


  const handlePreviewPrompt = async (set) => {
    try {
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}/preview-prompt`);
      const json = await res.json();
      return json.data || null;
    } catch {
      showToast('Failed to load prompt preview', 'error');
      return null;
    }
  };

  const handleCascadeRegenerate = async (set, description) => {
    startGenerating(set.id);
    try {
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}/cascade-regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(description ? { canonical_description: description } : {}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Cascade regeneration failed');
      }
      const json = await res.json();
      showToast('Cascade regeneration queued...');
      const job = await pollJob(json.data.jobId);
      if (job.status === 'completed') {
        const { successfulAngles, totalAngles } = job.result || {};
        showToast(`Base + ${successfulAngles || 0}/${totalAngles || 0} angles regenerated!`);
      } else {
        showToast(job.error || 'Cascade regeneration failed', 'error');
      }
      fetchSets();
    } catch (err) {
      showToast(err.message || 'Cascade regeneration failed', 'error');
    } finally {
      stopGenerating(set.id);
    }
  };

  const handleReorderAngle = async (set, angle, direction) => {
    const sorted = [...(set.angles || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const idx = sorted.findIndex(a => a.id === angle.id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    // Swap sort_order values
    const newOrder = sorted.map((a, i) => ({ id: a.id, sort_order: i }));
    // Swap the two
    const tmp = newOrder[idx].sort_order;
    newOrder[idx].sort_order = newOrder[swapIdx].sort_order;
    newOrder[swapIdx].sort_order = tmp;

    try {
      await fetch(`${API_BASE}/scene-sets/${set.id}/angles/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: newOrder }),
      });
      fetchSets();
    } catch {
      showToast('Failed to reorder angles', 'error');
    }
  };

  const filtered = useMemo(() => {
    let result = filterType === 'ALL' ? sets : sets.filter(s => s.scene_type === filterType);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => s.name?.toLowerCase().includes(q) || s.show?.name?.toLowerCase().includes(q));
    }
    return result;
  }, [sets, filterType, searchQuery]);

  const totalCost = sets.reduce((sum, s) => {
    const setCost = parseFloat(s.generation_cost || 0);
    const anglesCost = (s.angles || []).reduce((a, ang) => a + parseFloat(ang.generation_cost || 0), 0);
    return sum + setCost + anglesCost;
  }, 0);

  const types = ['ALL', 'HOME_BASE', 'CLOSET', 'EVENT_LOCATION', 'TRANSITION'];
  const typeLabels = {
    ALL: 'All', HOME_BASE: 'Home Base', CLOSET: 'Closet',
    EVENT_LOCATION: 'Events', TRANSITION: 'Transitions',
  };

  return (
    <div className="scene-sets-container">
      {/* Toast */}
      {toast && (
        <div className={`scene-sets-toast ${toast.type === 'error' ? 'error' : 'success'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header row */}
      <div className="scene-sets-header">
        <div>
          <h2 className="scene-sets-title">Locations</h2>
          <p className="scene-sets-subtitle">
            {sets.length} location{sets.length !== 1 ? 's' : ''} — Canonical LalaVerse world
            {totalCost > 0 && (
              <span className="scene-sets-total-cost"> · {totalCost.toFixed(1)} credits used</span>
            )}
          </p>
        </div>

        <div className="scene-sets-header-actions">
          <button
            className="scene-sets-btn-create"
            onClick={() => setShowCreateForm(f => !f)}
          >
            {showCreateForm ? <><X size={14} /> Cancel</> : <><Plus size={14} /> New Set</>}
          </button>
          <div className="scene-sets-filters">
            <div className="scene-sets-search-wrap">
              <Search size={12} className="scene-sets-search-icon" />
              <input
                className="scene-sets-search-input"
                placeholder="Search locations..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            {types.map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`scene-sets-filter-pill${filterType === t ? ' active' : ''}`}
              >
                {typeLabels[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Create Form — minimal: just name + type */}
      {showCreateForm && (
        <div className="scene-sets-create-form">
          <div className="scene-sets-create-row">
            <div className="scene-sets-create-field" style={{ flex: 2 }}>
              <label>Location Name</label>
              <input
                type="text"
                placeholder="e.g. Lala's Bedroom, The Gala Venue"
                value={newSet.name}
                onChange={e => setNewSet(s => ({ ...s, name: e.target.value }))}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && newSet.name.trim()) handleCreate(); }}
              />
            </div>
            <div className="scene-sets-create-field">
              <label>Type</label>
              <select
                value={newSet.scene_type}
                onChange={e => setNewSet(s => ({ ...s, scene_type: e.target.value }))}
              >
                <option value="HOME_BASE">Home Base</option>
                <option value="CLOSET">Closet</option>
                <option value="EVENT_LOCATION">Event</option>
                <option value="TRANSITION">Transition</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="scene-sets-create-field" style={{ alignSelf: 'flex-end' }}>
              <button
                className="scene-sets-btn-generate"
                onClick={handleCreate}
                disabled={creating || !newSet.name.trim()}
              >
                {creating ? <Loader size={12} className="spin" /> : <Plus size={12} />} Create
              </button>
            </div>
          </div>
          <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>You'll add the description, base image, and settings after creating.</p>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="scene-sets-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="scene-sets-skeleton-card">
              <div className="scene-sets-skeleton-image" />
              <div className="scene-sets-skeleton-body">
                <div className="scene-sets-skeleton-line wide" />
                <div className="scene-sets-skeleton-line short" />
                <div className="scene-sets-skeleton-line medium" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="scene-sets-error">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className="scene-sets-empty">
          <Camera size={40} strokeWidth={1} />
          <p className="scene-sets-empty-title">No locations yet</p>
          <p className="scene-sets-empty-body">
            Locations are canonical LalaVerse worlds. Each location contains
            multiple camera angles that map to episode beats.
          </p>
        </div>
      )}

      {/* Grid */}
      {!loading && filtered.length > 0 && (
        <div className="scene-sets-grid">
          {filtered.map(set => (
            <SceneSetCard
              key={set.id}
              set={set}
              onGenerateBase={handleGenerateBase}
              onRegenerateBase={handleRegenerateBase}
              onUploadBase={handleUploadBase}
              onGenerateAngle={handleGenerateAngle}
              onGenerateAll={handleGenerateAll}
              onDeleteAllAngles={handleDeleteAllAngles}
              onDeleteSet={handleDeleteSet}
              onAddAngle={handleAddAngle}
              onUpdatePrompt={handleUpdatePrompt}
              onPreviewPrompt={handlePreviewPrompt}
              onCascadeRegenerate={handleCascadeRegenerate}
              onSetCoverAngle={handleSetCoverAngle}
              onLinkEpisodes={handleLinkEpisodes}
              onUnlinkEpisode={handleUnlinkEpisode}
              onDeleteSingleAngle={handleDeleteSingleAngle}
              isGeneratingProp={generatingIds.has(set.id)}
              generationProgress={generationProgressMap[set.id] || null}
              specStage={specStageMap[set.id] || null}
              allShows={allShows}
              allEpisodes={allEpisodes}
              onLoadEpisodes={loadEpisodesForShow}
              onToast={showToast}
              onRefresh={fetchSets}
            />
          ))}
        </div>
      )}

      {/* Artifact Review Modal */}
      {reviewModal && (
        <ArtifactReviewModal
          angle={reviewModal.angle}
          setId={reviewModal.setId}
          onClose={() => setReviewModal(null)}
          onSubmit={handleReviewSubmit}
        />
      )}


      {/* Wardrobe Match Modal */}
      {wardrobeMatch && createPortal(
        <div className="scene-sets-modal-backdrop" onClick={() => setWardrobeMatch(null)}>
          <div className="scene-sets-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="scene-sets-modal-header">
              <h3 className="scene-sets-modal-title">Wardrobe Match</h3>
              <button className="scene-sets-modal-close" onClick={() => setWardrobeMatch(null)}><X size={16} /></button>
            </div>
            <div className="scene-sets-modal-body">
              {wardrobeMatch.event ? (
                <>
                  <div style={{ padding: '8px 12px', background: '#fef3c7', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
                    Event: <strong>{wardrobeMatch.event.name}</strong> — Dress code: <strong>{wardrobeMatch.event.dress_code || 'None'}</strong>
                    {wardrobeMatch.event.keywords?.length > 0 && <div style={{ marginTop: 4 }}>Keywords: {wardrobeMatch.event.keywords.join(', ')}</div>}
                  </div>
                  {wardrobeMatch.matches?.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                      {wardrobeMatch.matches.map(m => (
                        <div key={m.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                          {(m.thumbnail_url || m.image_url) && <img src={m.thumbnail_url || m.image_url} alt={m.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />}
                          <div style={{ padding: '4px 6px', fontSize: 10, fontWeight: 600 }}>{m.name}</div>
                        </div>
                      ))}
                    </div>
                  ) : <p style={{ color: '#94a3b8', textAlign: 'center' }}>No wardrobe items match the dress code keywords.</p>}
                </>
              ) : <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>No event linked to this scene set.</p>}
            </div>
          </div>
        </div>, document.body
      )}

      {/* Angle History Modal */}
      {angleHistory && createPortal(
        <div className="scene-sets-modal-backdrop" onClick={() => setAngleHistory(null)}>
          <div className="scene-sets-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="scene-sets-modal-header">
              <h3 className="scene-sets-modal-title">Generation History — {angleHistory.angle?.angle_name}</h3>
              <button className="scene-sets-modal-close" onClick={() => setAngleHistory(null)}><X size={16} /></button>
            </div>
            <div className="scene-sets-modal-body" style={{ maxHeight: '60vh', overflow: 'auto' }}>
              {angleHistory.current && (
                <div style={{ marginBottom: 12, padding: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', marginBottom: 4 }}>CURRENT (Attempt {angleHistory.current.attempt}) {angleHistory.current.favorited ? '★' : ''}</div>
                  <img src={angleHistory.current.url} alt="Current" style={{ width: '100%', borderRadius: 6 }} />
                </div>
              )}
              {angleHistory.history?.length > 0 ? angleHistory.history.map((h, i) => (
                <div key={i} style={{ marginBottom: 12, padding: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, opacity: 0.7 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>
                    Attempt {h.attempt || '?'} — {h.reason || 'Replaced'} — {h.rejected_at ? new Date(h.rejected_at).toLocaleDateString() : h.replaced_at ? new Date(h.replaced_at).toLocaleDateString() : ''}
                  </div>
                  <img src={h.url} alt={`Attempt ${h.attempt}`} style={{ width: '100%', borderRadius: 6 }} />
                </div>
              )) : <p style={{ color: '#94a3b8', textAlign: 'center' }}>No previous generations.</p>}
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}
