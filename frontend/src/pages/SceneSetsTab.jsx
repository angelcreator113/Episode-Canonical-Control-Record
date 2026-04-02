import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Play, Lock, Sparkles, Loader, AlertCircle, Plus, X, Clock, CheckCircle2, Trash2, RotateCcw, RefreshCw, Upload, Pencil, Save, MoreVertical, Eye, ChevronLeft, ChevronRight, Crown, Tv, Film } from 'lucide-react';
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

function ImageLightbox({ images: initialImages, initialIndex, onClose, onDeleteAngle }) {
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
          const isCurrent = i === currentIndex && !isDone && !isFailed;
          const isQueued = !isDone && !isFailed && !isCurrent;
          return (
            <div key={a.id} className={`scene-sets-progress-angle ${
              isDone ? 'done' : isFailed ? 'failed' : isCurrent ? 'current' : 'queued'
            }`}>
              {isDone ? <CheckCircle2 size={12} /> : isFailed ? <AlertCircle size={12} /> : isCurrent ? <Loader size={12} className="spin" /> : <span className="scene-sets-progress-dot" />}
              <span>{a.label}</span>
              {isCurrent && <span className="scene-sets-progress-step">generating still + video</span>}
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


const SceneSetCard = memo(function SceneSetCard({ set, onGenerateBase, onRegenerateBase, onUploadBase, onGenerateAngle, onGenerateAll, onDeleteAllAngles, onDeleteSet, onAddAngle, onUpdatePrompt, onPreviewPrompt, onCascadeRegenerate, onSetCoverAngle, onLinkEpisodes, onUnlinkEpisode, onDeleteSingleAngle, generatingId, generationProgress, allShows, allEpisodes, onLoadEpisodes, onToast }) {
  const fileInputRef = useRef(null);
  const menuUploadRef = useRef(null);
  const menuRef = useRef(null);
  const isGenerating = generatingId === set.id;
  const progress = generatingId === set.id ? generationProgress : null;
  // Cache-bust using set.updated_at — survives page refresh unlike local counters
  const cacheBust = set.updated_at ? new Date(set.updated_at).getTime() : '';
  const bustUrl = (url) => {
    if (!url || !cacheBust) return url;
    return `${url}${url.includes('?') ? '&' : '?'}v=${cacheBust}`;
  };
  const sortedAngles = [...(set.angles || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const readyAngles = sortedAngles.filter(a => a.generation_status === 'complete').length;
  const totalAngles = sortedAngles.length;
  const pendingAngles = sortedAngles.filter(a => a.generation_status === 'pending');
  const regenerableAngles = sortedAngles.filter(a => a.generation_status === 'complete' || a.generation_status === 'failed');
  const hasBase = !!(set.base_still_url || set.base_runway_seed);

  // Selected angle for hero display — initializes to cover_angle_id if set
  const [selectedAngleId, setSelectedAngleId] = useState(set.cover_angle_id || null);
  const selectedAngle = selectedAngleId ? sortedAngles.find(a => a.id === selectedAngleId) : null;
  const coverAngle = set.cover_angle_id ? sortedAngles.find(a => a.id === set.cover_angle_id) : null;
  const heroImageRaw = selectedAngle?.still_image_url || coverAngle?.still_image_url || sortedAngles.find(a => a.still_image_url)?.still_image_url || set.base_still_url || null;
  const isCoverAngle = (angleId) => set.cover_angle_id === angleId;
  const heroImage = heroImageRaw ? bustUrl(heroImageRaw) : null;
  const [showBaseLightbox, setShowBaseLightbox] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
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
        onClick={() => { if (heroImage) setShowBaseLightbox(true); }}
        style={heroImage ? { cursor: 'pointer' } : undefined}
      >
        {heroImage ? (
          <img src={heroImage} alt={set.name} />
        ) : (
          <div className="scene-sets-card-placeholder">
            <Camera size={32} strokeWidth={1.2} />
            <span>{hasBase ? 'Generate angles to see visuals' : 'Not yet generated'}</span>
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
                  <button onClick={() => { setShowMenu(false); setEditDesc(set.canonical_description || ''); setShowPromptEditor(true); }}>
                    <Pencil size={12} /> Edit Prompt
                  </button>
                  <button onClick={() => { setShowMenu(false); handlePreviewPrompt(); }} disabled={loadingPreview}>
                    <Eye size={12} /> Preview Prompt
                  </button>
                  {hasBase && (
                    <button onClick={() => { setShowMenu(false); onCascadeRegenerate(set); }} disabled={isGenerating}>
                      <RotateCcw size={12} /> Regenerate All
                    </button>
                  )}
                  {hasBase && totalAngles === 0 && (
                    <button onClick={async () => { setShowMenu(false); setSeeding(true); await onSeedAngles(set); setSeeding(false); }} disabled={isGenerating || seeding}>
                      <Sparkles size={12} /> Seed Default Angles
                    </button>
                  )}
                  <button onClick={() => { setShowMenu(false); menuUploadRef.current?.click(); }} disabled={isGenerating}>
                    <Upload size={12} /> Upload Images
                  </button>
                  <button onClick={() => { setShowMenu(false); setShowDetails(d => !d); }}>
                    <Eye size={12} /> {showDetails ? 'Hide Details' : 'Show Details'}
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
            {selectedAngle.angle_label}
          </div>
        )}
      </div>

      {/* ── Filmstrip (visible when angles exist OR has base image for ADD/AI) ───── */}
      {(sortedAngles.length > 0 || hasBase) && (
        <div className="scene-sets-filmstrip">
          {/* Base image thumb */}
          {set.base_still_url && (
            <button
              className={`scene-sets-filmstrip-thumb${!selectedAngleId ? ' active' : ''}`}
              onClick={() => setSelectedAngleId(null)}
              title="Base image"
            >
              <img src={bustUrl(set.base_still_url)} alt="Base" />
              <span className="scene-sets-filmstrip-label">BASE</span>
            </button>
          )}
          {/* Angle thumbs */}
          {sortedAngles.map(angle => {
            const isActive = selectedAngleId === angle.id;
            const isCover = isCoverAngle(angle.id);
            const hasStill = !!angle.still_image_url && angle.generation_status === 'complete';
            const isAngleGenerating = angle.generation_status === 'generating';
            const isFailed = angle.generation_status === 'failed';
            const isPending = angle.generation_status === 'pending';
            return (
              <button
                key={angle.id}
                className={`scene-sets-filmstrip-thumb${isActive ? ' active' : ''}${isFailed ? ' failed' : ''}${isPending ? ' pending' : ''}${isCover ? ' cover' : ''}`}
                onClick={() => {
                  if (hasStill) {
                    if (isActive) setShowBaseLightbox(true);
                    else setSelectedAngleId(angle.id);
                  } else if (isPending && !isGenerating) {
                    onGenerateAngle(set, angle);
                  }
                }}
                onDoubleClick={() => {
                  if (hasStill && onSetCoverAngle) {
                    onSetCoverAngle(set, isCover ? null : angle.id);
                  }
                }}
                title={hasStill ? `${angle.angle_name}${isCover ? ' (Cover)' : ''} — double-click to ${isCover ? 'unset' : 'set as'} cover` : isPending ? `Generate: ${angle.angle_name}` : angle.angle_name}
              >
                {hasStill ? (
                  <img src={bustUrl(angle.still_image_url)} alt={angle.angle_label} />
                ) : isAngleGenerating ? (
                  <Loader size={14} className="spin" />
                ) : isFailed ? (
                  <AlertCircle size={14} />
                ) : (
                  <Sparkles size={14} className={isPending && !isGenerating ? 'scene-sets-clickable-icon' : ''} />
                )}
                {isCover && <Crown size={10} className="scene-sets-cover-badge" />}
                <span className="scene-sets-filmstrip-label">{angle.angle_label}</span>
                {angle.video_clip_url && <span className="scene-sets-filmstrip-video"><Play size={8} /></span>}
              </button>
            );
          })}
          {/* Add Angle button at end of filmstrip */}
          {hasBase && (
            <button
              className="scene-sets-filmstrip-thumb scene-sets-filmstrip-add"
              onClick={() => setShowAddAngle(true)}
              title="Add new angle"
            >
              <Plus size={14} />
              <span className="scene-sets-filmstrip-label">ADD</span>
            </button>
          )}
          {hasBase && (
            <button
              className="scene-sets-filmstrip-thumb scene-sets-filmstrip-add"
              onClick={handleSuggestAngles}
              disabled={loadingSuggestions}
              title="AI suggest angles"
            >
              {loadingSuggestions ? <Loader size={14} className="spin" /> : <Sparkles size={14} />}
              <span className="scene-sets-filmstrip-label">AI</span>
            </button>
          )}
        </div>
      )}

      {/* ── Card Body ────────────────────────────────────────── */}
      <div className="scene-sets-card-body">
        <div className="scene-sets-card-header">
          <div className="scene-sets-card-header-row">
            <h3 className="scene-sets-card-title">{set.name}</h3>
            {totalAngles > 0 && (
              <span className="scene-sets-angle-badge">{readyAngles}/{totalAngles}</span>
            )}
          </div>
          {/* Show & Episode tags */}
          {(set.show || (set.episodes && set.episodes.length > 0)) && (
            <div className="scene-sets-card-tags">
              {set.show && (
                <span className="scene-sets-show-tag">
                  <Tv size={10} /> {set.show.name}
                </span>
              )}
              {set.episodes && set.episodes.length > 0 && (
                <span className="scene-sets-episode-tag" onClick={() => setShowEpisodeManager(v => !v)} title="Click to manage episodes">
                  <Film size={10} /> {set.episodes.length === 1 ? `Ep ${set.episodes[0].episode_number || set.episodes[0].title}` : `${set.episodes.length} episodes`}
                </span>
              )}
              {!set.episodes?.length && (
                <button className="scene-sets-link-episodes-btn" onClick={() => setShowEpisodeManager(true)} title="Link episodes">
                  <Film size={10} /> + Episodes
                </button>
              )}
            </div>
          )}
          {!set.show && !set.episodes?.length && (
            <div className="scene-sets-card-tags">
              <button className="scene-sets-link-episodes-btn" onClick={() => setShowEpisodeManager(true)} title="Link to show/episodes">
                <Film size={10} /> + Link Episodes
              </button>
            </div>
          )}

          <div className="scene-sets-card-actions">
            {!hasBase && (
              <>
                <button onClick={() => onGenerateBase(set)} disabled={isGenerating} className={`scene-sets-btn-generate${isGenerating ? ' disabled' : ''}`}>
                  {isGenerating ? <><Loader size={12} className="spin" /> Generating...</> : <><Sparkles size={12} /> Generate Base</>}
                </button>
                <button onClick={() => fileInputRef.current?.click()} disabled={isGenerating} className={`scene-sets-btn-upload${isGenerating ? ' disabled' : ''}`} title="Upload one or multiple room images">
                  <Upload size={12} /> Upload
                </button>
                <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length > 0) onUploadBase(set, files); e.target.value = ''; }} />
              </>
            )}

            {hasBase && pendingAngles.length > 0 && (
              <button onClick={() => onGenerateAll(set, false)} disabled={isGenerating} className={`scene-sets-btn-generate${isGenerating ? ' disabled' : ''}`}>
                {isGenerating ? <><Loader size={12} className="spin" /> Generating...</> : <><Sparkles size={12} /> Generate All</>}
              </button>
            )}


            {totalAngles > 0 && (
              <button onClick={() => onDeleteAllAngles(set)} disabled={isGenerating} className="scene-sets-btn-delete" title="Reset all angles">
                <Trash2 size={12} /> Reset
              </button>
            )}
          </div>
        </div>

        {isGenerating && !progress && (
          <div className="scene-sets-base-timer">
            <Loader size={12} className="spin" />
            <span>Generating... {formatTime(baseElapsed)}</span>
          </div>
        )}

        {progress && <GenerationProgress progress={progress} />}

        {/* Details panel (toggled from kebab menu) */}
        {showDetails && (
          <div className="scene-sets-details-panel">
            {set.base_runway_seed && set.base_runway_seed !== 'unknown' && (
              <p className="scene-sets-seed-info"><Lock size={11} /> Seed: {set.base_runway_seed.slice(0, 20)}...</p>
            )}
            {(set.generation_cost > 0 || sortedAngles.some(a => a.generation_cost > 0)) && (
              <p className="scene-sets-cost-info">
                <Clock size={11} /> Cost: {(parseFloat(set.generation_cost || 0) + sortedAngles.reduce((sum, a) => sum + parseFloat(a.generation_cost || 0), 0)).toFixed(1)} credits
              </p>
            )}
            {set.episodes && set.episodes.length > 0 && (
              <div className="scene-sets-details-episodes">
                <p className="scene-sets-details-label"><Film size={11} /> Linked Episodes</p>
                <ul className="scene-sets-details-episode-list">
                  {set.episodes.map(ep => (
                    <li key={ep.id}>
                      <span className="scene-sets-details-ep-number">{ep.season_number ? `S${ep.season_number}` : ''}E{ep.episode_number || '?'}</span>
                      <span className="scene-sets-details-ep-title">{ep.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {set.script_context && <p className="scene-sets-script-context">{set.script_context}</p>}
            {hasBase && (
              <button className="scene-sets-btn-add-angle" onClick={() => setShowAddAngle(true)}>
                <Plus size={12} /> Add Angle
              </button>
            )}
          </div>
        )}

        {showPromptEditor && (
          <div className="scene-sets-prompt-editor">
            <label className="scene-sets-prompt-editor-label">Scene Description (used to build AI prompt)</label>
            <textarea className="scene-sets-prompt-editor-textarea" value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4} autoFocus placeholder="Describe the space \u2014 layout, lighting, mood, signature details..." />
            {set.base_runway_prompt && (
              <details className="scene-sets-prompt-details">
                <summary>View last generated prompt</summary>
                <pre className="scene-sets-prompt-preview">{set.base_runway_prompt}</pre>
              </details>
            )}
            <div className="scene-sets-prompt-editor-actions">
              <button className="scene-sets-btn-generate" onClick={() => handleSavePrompt(false)} disabled={savingPrompt}>
                {savingPrompt ? <><Loader size={12} className="spin" /> Saving...</> : <><Save size={12} /> Save</>}
              </button>
              {hasBase && <button className="scene-sets-btn-generate" onClick={() => handleSavePrompt(true)} disabled={savingPrompt || isGenerating}><RotateCcw size={12} /> Save & Regen</button>}
              {hasBase && totalAngles > 0 && <button className="scene-sets-btn-regenerate" onClick={() => handleSavePrompt(false, true)} disabled={savingPrompt || isGenerating}><Sparkles size={12} /> Regen Everything</button>}
              <button className="scene-sets-btn-delete" onClick={() => setShowPromptEditor(false)}>Cancel</button>
            </div>
          </div>
        )}

        {showAddAngle && (
          <div className="scene-sets-add-angle-form">
            <div className="scene-sets-add-angle-row">
              <div className="scene-sets-create-field"><label>Label</label><input type="text" placeholder="e.g. WIDE" value={newAngle.angle_label} onChange={e => setNewAngle(a => ({ ...a, angle_label: e.target.value }))} autoFocus /></div>
              <div className="scene-sets-create-field"><label>Name</label><input type="text" placeholder="e.g. Wide Morning" value={newAngle.angle_name} onChange={e => setNewAngle(a => ({ ...a, angle_name: e.target.value }))} /></div>
              <div className="scene-sets-create-field"><label>Beats <span className="scene-sets-optional">(comma-sep)</span></label><input type="text" placeholder="1,2,3" value={newAngle.beat_affinity} onChange={e => setNewAngle(a => ({ ...a, beat_affinity: e.target.value }))} /></div>
            </div>
            <div className="scene-sets-camera-direction-row">
              <div className="scene-sets-create-field"><label>Camera Direction <span className="scene-sets-optional">(optional)</span></label><input type="text" placeholder="Camera placement and movement..." value={newAngle.camera_direction} onChange={e => setNewAngle(a => ({ ...a, camera_direction: e.target.value }))} /></div>
              {set.canonical_description && (
                <button
                  className="scene-sets-ai-assist-btn"
                  onClick={handleAiAssist}
                  disabled={aiAssistLoading}
                  title="AI-generate camera direction"
                >
                  {aiAssistLoading ? <Loader size={10} className="spin" /> : <Sparkles size={10} />} AI
                </button>
              )}
            </div>
            {/* Upload image for this angle */}
            <div className="scene-sets-angle-upload-row">
              <input
                ref={angleUploadRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setAngleUploadFile(file);
                  const reader = new FileReader();
                  reader.onload = () => setAngleUploadPreview(reader.result);
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }}
              />
              {angleUploadPreview ? (
                <div className="scene-sets-angle-upload-preview">
                  <img src={angleUploadPreview} alt="Upload preview" />
                  <button type="button" onClick={() => { setAngleUploadFile(null); setAngleUploadPreview(null); }} className="scene-sets-angle-upload-remove">
                    <X size={10} />
                  </button>
                  <span className="scene-sets-angle-upload-name">{angleUploadFile?.name}</span>
                </div>
              ) : (
                <button
                  type="button"
                  className="scene-sets-angle-upload-btn"
                  onClick={() => angleUploadRef.current?.click()}
                >
                  <Upload size={12} /> Upload Image <span className="scene-sets-optional">(optional — or AI generates)</span>
                </button>
              )}
            </div>
            <div className="scene-sets-add-angle-actions">
              <button className="scene-sets-btn-generate" onClick={handleSubmitAngle} disabled={addingAngle || !newAngle.angle_label.trim() || !newAngle.angle_name.trim()}>
                {addingAngle ? <><Loader size={12} className="spin" /> Adding...</> : <><Plus size={12} /> Add</>}
              </button>
              <button className="scene-sets-btn-delete" onClick={() => { setShowAddAngle(false); setAngleUploadFile(null); setAngleUploadPreview(null); }}>Cancel</button>
            </div>
          </div>
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
        return <ImageLightbox images={galleryImages} initialIndex={startIdx} onClose={() => setShowBaseLightbox(false)} onDeleteAngle={(angleId) => onDeleteSingleAngle(set, angleId)} />;
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
    </div>
  );
}, (prev, next) => {
  // Only re-render when meaningful rendering data changes, not on every poll
  if (prev.generatingId !== next.generatingId) return false;
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
  const [generatingId, setGeneratingId] = useState(null);
  const [generationProgress, setGenerationProgress] = useState(null);
  const [toast, setToast] = useState(null);
  const [filterType, setFilterType] = useState('ALL');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newSet, setNewSet] = useState({ name: '', scene_type: 'HOME_BASE', canonical_description: '', show_id: '', episode_ids: [] });
  const [reviewModal, setReviewModal] = useState(null); // { setId, angle }
  const [allShows, setAllShows] = useState([]);
  const [allEpisodes, setAllEpisodes] = useState([]);
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
    const maxPolls = 120; // 120 * 3s = 6 min max
    for (let i = 0; i < maxPolls; i++) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const res = await fetch(`${API_BASE}/scene-sets/jobs/${jobId}`);
        if (!res.ok) continue;
        const json = await res.json();
        const job = json.data;
        if (job.status === 'completed' || job.status === 'failed') return job;
      } catch { /* retry on network error */ }
    }
    return { status: 'failed', error: 'Polling timed out' };
  }, []);

  const handleGenerateBase = async (set) => {
    setGeneratingId(set.id);
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
      showToast('Base generation queued...');
      const job = await pollJob(json.data.jobId);
      if (job.status === 'completed') {
        showToast(`Base generated for "${set.name}"`);

      } else {
        showToast(job.error || 'Base generation failed', 'error');
      }
      await fetchSets();
    } catch (err) {
      showToast(err.message || 'Generation failed', 'error');
    } finally {
      setGeneratingId(null);
    }
  };

  const handleRegenerateBase = async (set) => {
    setGeneratingId(set.id);
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
      showToast('Base regeneration queued...');
      const job = await pollJob(json.data.jobId);
      if (job.status === 'completed') {
        showToast('Base image regenerated!');

      } else {
        showToast(job.error || 'Regeneration failed', 'error');
      }
      await fetchSets();
    } catch (err) {
      showToast(err.message || 'Regeneration failed', 'error');
    } finally {
      setGeneratingId(null);
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
    setGeneratingId(set.id);
    try {
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
      const json = await res.json().catch(() => ({}));
      const uploadedCount = json?.data?.uploadedCount || fileList.length;
      showToast(uploadedCount > 1
        ? `${uploadedCount} images uploaded for "${set.name}"`
        : `Base image uploaded for "${set.name}"`);
      fetchSets();
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setGeneratingId(null);
    }
  };

  const handleGenerateAngle = async (set, angle) => {
    setGeneratingId(set.id);
    try {
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}/angles/${angle.id}/generate`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Generation failed (${res.status})`);
      }
      const json = await res.json();
      showToast(`Generating "${angle.angle_name}" — queued`);
      const job = await pollJob(json.data.jobId);
      if (job.status === 'completed') {
        showToast(`"${angle.angle_name}" generated!`);

      } else {
        showToast(job.error || 'Angle generation failed', 'error');
      }
      await fetchSets();
    } catch {
      showToast('Angle generation failed', 'error');
    } finally {
      setGeneratingId(null);
    }
  };

  const handleGenerateAll = async (set, regenerate = false) => {
    const targets = regenerate
      ? set.angles?.filter(a => a.generation_status === 'complete' || a.generation_status === 'failed') || []
      : set.angles?.filter(a => a.generation_status === 'pending') || [];
    if (targets.length === 0) return;
    setGeneratingId(set.id);

    const progressAngles = targets.map(a => ({ id: a.id, label: a.angle_label, status: 'queued' }));
    setGenerationProgress({ angles: progressAngles, currentIndex: 0, startTime: Date.now(), completedCount: 0, failedCount: 0 });

    try {
      // Fire all generation requests and collect job IDs
      const jobMap = [];
      for (let i = 0; i < targets.length; i++) {
        progressAngles[i].status = 'generating';
        setGenerationProgress(p => ({ ...p, angles: [...progressAngles], currentIndex: i }));
        try {
          const res = await fetch(`${API_BASE}/scene-sets/${set.id}/angles/${targets[i].id}/generate`, { method: 'POST' });
          if (!res.ok) throw new Error('Failed');
          const json = await res.json();
          jobMap.push({ index: i, jobId: json.data.jobId });
        } catch {
          progressAngles[i].status = 'failed';
          setGenerationProgress(p => ({ ...p, angles: [...progressAngles] }));
        }
      }

      // Poll all jobs in parallel
      let completed = 0;
      let failed = progressAngles.filter(a => a.status === 'failed').length;

      const pollPromises = jobMap.map(async ({ index, jobId }) => {
        const job = await pollJob(jobId);
        if (job.status === 'completed') {
          progressAngles[index].status = 'done';
          completed++;
        } else {
          progressAngles[index].status = 'failed';
          failed++;
        }
        setGenerationProgress(p => ({ ...p, angles: [...progressAngles], completedCount: completed, failedCount: failed }));
      });

      await Promise.all(pollPromises);

      if (failed === 0) {
        showToast(`All ${targets.length} angles ${regenerate ? 'regenerated' : 'generated'}!`);
      } else {
        showToast(`${completed} completed, ${failed} failed`, failed > 0 ? 'error' : 'success');
      }
      fetchSets();
    } catch (err) {
      showToast(err?.message || 'Generation failed', 'error');
    } finally {
      setTimeout(() => setGenerationProgress(null), 3000);
      setGeneratingId(null);
    }
  };

  const handleRetryFailed = async (set) => {
    const targets = set.angles?.filter(a => a.generation_status === 'failed') || [];
    if (targets.length === 0) return;
    setGeneratingId(set.id);

    const progressAngles = targets.map(a => ({ id: a.id, label: a.angle_label, status: 'queued' }));
    setGenerationProgress({ angles: progressAngles, currentIndex: 0, startTime: Date.now(), completedCount: 0, failedCount: 0 });

    try {
      // Fire all retry requests to get job IDs
      const jobMap = [];
      for (let i = 0; i < targets.length; i++) {
        try {
          const res = await fetch(`${API_BASE}/scene-sets/${set.id}/angles/${targets[i].id}/generate`, { method: 'POST' });
          if (!res.ok) throw new Error('Failed');
          const json = await res.json();
          jobMap.push({ index: i, jobId: json.data.jobId });
          progressAngles[i].status = 'generating';
        } catch {
          progressAngles[i].status = 'failed';
        }
        setGenerationProgress(p => ({ ...p, angles: [...progressAngles] }));
      }

      // Poll all jobs in parallel
      let completed = 0;
      let failed = progressAngles.filter(a => a.status === 'failed').length;

      const pollPromises = jobMap.map(async ({ index, jobId }) => {
        const job = await pollJob(jobId);
        if (job.status === 'completed') {
          progressAngles[index].status = 'done';
          completed++;
        } else {
          progressAngles[index].status = 'failed';
          failed++;
        }
        setGenerationProgress(p => ({ ...p, angles: [...progressAngles], completedCount: completed, failedCount: failed }));
      });

      await Promise.all(pollPromises);

      if (failed === 0) {
        showToast(`All ${targets.length} failed angles retried successfully!`);
      } else {
        showToast(`${completed} recovered, ${failed} still failing`, failed > 0 ? 'error' : 'success');
      }
      fetchSets();
    } catch (err) {
      showToast(err?.message || 'Retry failed', 'error');
    } finally {
      setTimeout(() => setGenerationProgress(null), 3000);
      setGeneratingId(null);
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
      const res = await fetch(`${API_BASE}/scene-sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload),
      });
      if (!res.ok) throw new Error('Failed to create');
      const json = await res.json();
      const setName = newSet.name.trim();
      setNewSet({ name: '', scene_type: 'HOME_BASE', canonical_description: '', show_id: '', episode_ids: [] });
      setCreateShowId('');
      setShowCreateForm(false);
      await fetchSets();

      // If a generation job was auto-queued, poll it and update when done
      if (json.jobId) {
        showToast(`Created "${setName}" — generating base image...`);
        if (json.data?.id) setGeneratingId(json.data.id);
        const job = await pollJob(json.jobId);
        if (job.status === 'completed') {
          showToast(`Base image generated for "${setName}"`);
        } else {
          showToast(job.error || 'Base generation failed', 'error');
        }
        await fetchSets();
        setGeneratingId(null);
      } else {
        showToast(`Created "${setName}"`);
      }
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
      if (!res.ok) throw new Error('Failed');
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
    setGeneratingId(set.id);
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
      setGeneratingId(null);
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

  const filtered = filterType === 'ALL'
    ? sets
    : sets.filter(s => s.scene_type === filterType);

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

      {/* Create Form */}
      {showCreateForm && (
        <div className="scene-sets-create-form">
          <div className="scene-sets-create-row">
            <div className="scene-sets-create-field">
              <label>Location Name</label>
              <input
                type="text"
                placeholder="e.g. Lala's Kitchen — Golden Hour"
                value={newSet.name}
                onChange={e => setNewSet(s => ({ ...s, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="scene-sets-create-field">
              <label>Scene Type</label>
              <select
                value={newSet.scene_type}
                onChange={e => setNewSet(s => ({ ...s, scene_type: e.target.value }))}
              >
                <option value="HOME_BASE">Home Base</option>
                <option value="CLOSET">Closet</option>
                <option value="EVENT_LOCATION">Event Location</option>
                <option value="TRANSITION">Transition</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          <div className="scene-sets-create-field">
            <label>Description <span className="scene-sets-optional">(optional)</span></label>
            <textarea
              placeholder="Describe the space — layout, lighting, mood, signature details..."
              value={newSet.canonical_description}
              onChange={e => setNewSet(s => ({ ...s, canonical_description: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="scene-sets-create-row">
            <div className="scene-sets-create-field">
              <label>Show <span className="scene-sets-optional">(optional)</span></label>
              <select
                value={newSet.show_id}
                onChange={e => {
                  const showId = e.target.value;
                  setNewSet(s => ({ ...s, show_id: showId, episode_ids: [] }));
                  setCreateShowId(showId);
                  if (showId) loadEpisodesForShow(showId);
                }}
              >
                <option value="">No show</option>
                {allShows.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            {createShowId && (
              <div className="scene-sets-create-field">
                <label>Episodes <span className="scene-sets-optional">(optional, multi-select)</span></label>
                <select
                  multiple
                  value={newSet.episode_ids}
                  onChange={e => setNewSet(s => ({ ...s, episode_ids: Array.from(e.target.selectedOptions, o => o.value) }))}
                  style={{ minHeight: '60px' }}
                >
                  {allEpisodes
                    .filter(ep => ep.show_id === createShowId)
                    .map(ep => (
                      <option key={ep.id} value={ep.id}>
                        {ep.season_number ? `S${ep.season_number}` : ''}E{ep.episode_number || '?'} — {ep.title}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
          <div className="scene-sets-create-actions">
            <button
              className="scene-sets-btn-generate"
              onClick={handleCreate}
              disabled={creating || !newSet.name.trim()}
            >
              {creating ? <><Loader size={12} className="spin" /> Creating...</> : <><Plus size={12} /> Create Location</>}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="scene-sets-loading">
          <Loader size={20} className="spin" />
          <p>Loading locations...</p>
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
              generatingId={generatingId}
              generationProgress={generationProgress}
              allShows={allShows}
              allEpisodes={allEpisodes}
              onLoadEpisodes={loadEpisodesForShow}
              onToast={showToast}
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
    </div>
  );
}
