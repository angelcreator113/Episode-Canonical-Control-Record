import { useState, useEffect, useCallback, useRef } from 'react';
import { Camera, Play, Lock, Sparkles, Loader, AlertCircle, Plus, X, Clock, CheckCircle2, Trash2, RotateCcw, ShieldCheck, ShieldAlert, RefreshCw, Upload, Pencil, Save, MoreVertical, Eye, ChevronUp, ChevronDown } from 'lucide-react';
import './SceneSetsTab.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

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

function ImageLightbox({ src, alt, onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="scene-sets-lightbox-overlay" onClick={onClose}>
      <div className="scene-sets-lightbox" onClick={e => e.stopPropagation()}>
        <button className="scene-sets-lightbox-close" onClick={onClose}>
          <X size={20} />
        </button>
        <img src={src} alt={alt} className="scene-sets-lightbox-img" />
      </div>
    </div>
  );
}

// ─── ANGLE LIGHTBOX MODAL ─────────────────────────────────────────────────────

function AngleLightbox({ angle, onClose, onPrev, onNext, onRegenerate }) {
  if (!angle) return null;

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onPrev, onNext]);

  const [showVideo, setShowVideo] = useState(false);

  return (
    <div className="scene-sets-lightbox-overlay" onClick={onClose}>
      <div className="scene-sets-lightbox" onClick={e => e.stopPropagation()}>
        <button className="scene-sets-lightbox-close" onClick={onClose}>
          <X size={20} />
        </button>

        {onPrev && (
          <button className="scene-sets-lightbox-nav prev" onClick={onPrev}>&#8249;</button>
        )}
        {onNext && (
          <button className="scene-sets-lightbox-nav next" onClick={onNext}>&#8250;</button>
        )}

        <div className="scene-sets-lightbox-media">
          {showVideo && angle.video_clip_url ? (
            <video
              src={angle.video_clip_url}
              controls
              autoPlay
              className="scene-sets-lightbox-video"
            />
          ) : angle.still_image_url ? (
            <img src={`${angle.still_image_url}${angle.still_image_url.includes('?') ? '&' : '?'}v=${new Date(angle.updated_at || 0).getTime()}`} alt={angle.angle_name} className="scene-sets-lightbox-img" />
          ) : null}
        </div>

        <div className="scene-sets-lightbox-info">
          <h3>{angle.angle_name}</h3>
          <span className="scene-sets-lightbox-label">{angle.angle_label}</span>
          {angle.angle_description && <p>{angle.angle_description}</p>}
          {angle.camera_direction && (
            <p className="scene-sets-lightbox-camera"><Camera size={12} /> {angle.camera_direction}</p>
          )}
          {angle.beat_affinity && angle.beat_affinity.length > 0 && (
            <span className="scene-sets-lightbox-beats">Beats: {angle.beat_affinity.join(', ')}</span>
          )}
          {onRegenerate && (
            <button className="scene-sets-lightbox-regen" onClick={() => { onRegenerate(angle); onClose(); }}>
              <RotateCcw size={13} /> Regenerate
            </button>
          )}
        </div>

        {angle.video_clip_url && (
          <div className="scene-sets-lightbox-toggle">
            <button
              className={`scene-sets-lightbox-toggle-btn${!showVideo ? ' active' : ''}`}
              onClick={() => setShowVideo(false)}
            >
              <Camera size={14} /> Still
            </button>
            <button
              className={`scene-sets-lightbox-toggle-btn${showVideo ? ' active' : ''}`}
              onClick={() => setShowVideo(true)}
            >
              <Play size={14} /> Video
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ANGLE STRIP ──────────────────────────────────────────────────────────────

function AngleStrip({ angles, onGenerate, onReview, onRegenerate, onReorder, generating }) {
  if (!angles || angles.length === 0) return null;
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const sortedAngles = [...angles].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const completedAngles = sortedAngles.filter(a => a.still_image_url);
  const openLightbox = (angle) => {
    const idx = completedAngles.findIndex(a => a.id === angle.id);
    if (idx !== -1) setLightboxIndex(idx);
  };

  return (
    <div className="scene-sets-angle-strip">
      {sortedAngles.map((angle, idx) => {
        const isPending = angle.generation_status === 'pending';
        const isComplete = angle.generation_status === 'complete';
        const isGenerating = angle.generation_status === 'generating';
        const isFailed = angle.generation_status === 'failed';
        const hasMedia = !!angle.still_image_url;

        return (
          <div
            key={angle.id}
            className={`scene-sets-angle-item${isPending && !generating ? ' clickable' : ''}${hasMedia ? ' has-media' : ''}`}
            onClick={() => {
              if (hasMedia) openLightbox(angle);
              else if (isPending && !generating) onGenerate(angle);
            }}
            title={hasMedia ? `View: ${angle.angle_name}` : isPending ? `Generate: ${angle.angle_name}` : angle.angle_name}
          >
            <div className={`scene-sets-angle-thumb ${
              isComplete ? 'complete' : isGenerating ? 'generating' : isFailed ? 'failed' : 'pending'
            }`}>
              {angle.still_image_url ? (
                <img src={`${angle.still_image_url}${angle.still_image_url.includes('?') ? '&' : '?'}v=${new Date(angle.updated_at || 0).getTime()}`} alt={angle.angle_name} />
              ) : isGenerating ? (
                <Loader size={20} className="spin" />
              ) : isFailed ? (
                <AlertCircle size={20} />
              ) : isPending && !generating ? (
                <Sparkles size={20} className="scene-sets-clickable-icon" />
              ) : (
                <Sparkles size={20} />
              )}

              {angle.video_clip_url && (
                <div className="scene-sets-video-indicator">
                  <Play size={10} />
                </div>
              )}

              {isComplete && (
                <QualityBadge
                  score={angle.quality_score}
                  flagCount={(angle.artifact_flags || []).length}
                />
              )}

              {(isComplete || isFailed) && !generating && (
                <button
                  className="scene-sets-angle-regen"
                  onClick={(e) => { e.stopPropagation(); onRegenerate(angle); }}
                  title={`Regenerate ${angle.angle_name}`}
                >
                  <RotateCcw size={10} />
                </button>
              )}
            </div>

            <span className="scene-sets-angle-label">{angle.angle_label}</span>

            <div className="scene-sets-angle-meta">
              {angle.beat_affinity && angle.beat_affinity.length > 0 && (
                <span className="scene-sets-beat-numbers">
                  B{angle.beat_affinity.join(',')}
                </span>
              )}

              {isComplete && (
                <button
                  className="scene-sets-angle-review-btn"
                  onClick={(e) => { e.stopPropagation(); onReview(angle); }}
                  title="Review quality & flag artifacts"
                >
                  <Eye size={10} />
                </button>
              )}
            </div>

            {onReorder && sortedAngles.length > 1 && !generating && (
              <div className="scene-sets-angle-reorder">
                <button
                  className="scene-sets-angle-reorder-btn"
                  disabled={idx === 0}
                  onClick={(e) => { e.stopPropagation(); onReorder(angle, 'up'); }}
                  title="Move up"
                >
                  <ChevronUp size={10} />
                </button>
                <button
                  className="scene-sets-angle-reorder-btn"
                  disabled={idx === sortedAngles.length - 1}
                  onClick={(e) => { e.stopPropagation(); onReorder(angle, 'down'); }}
                  title="Move down"
                >
                  <ChevronDown size={10} />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {lightboxIndex !== null && completedAngles[lightboxIndex] && (
        <AngleLightbox
          angle={completedAngles[lightboxIndex]}
          onClose={() => setLightboxIndex(null)}
          onPrev={lightboxIndex > 0 ? () => setLightboxIndex(i => i - 1) : null}
          onNext={lightboxIndex < completedAngles.length - 1 ? () => setLightboxIndex(i => i + 1) : null}
          onRegenerate={!generating ? onRegenerate : null}
        />
      )}
    </div>
  );
}

// ─── QUALITY BADGE ────────────────────────────────────────────────────────

function QualityBadge({ score, flagCount }) {
  if (score == null) return null;
  const color = score >= 85 ? '#1A7A40' : score >= 60 ? '#B8960C' : '#C62828';
  const bg = score >= 85 ? '#E8F5E9' : score >= 60 ? '#FFF8E1' : '#FFEBEE';
  const Icon = score >= 85 ? ShieldCheck : ShieldAlert;
  return (
    <span className="scene-sets-quality-badge" style={{ background: bg, color }} title={`Quality: ${score}/100, ${flagCount} issue${flagCount !== 1 ? 's' : ''}`}>
      <Icon size={10} />
      {score}
    </span>
  );
}

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

// ─── DEFAULT ANGLE PRESETS ────────────────────────────────────────────────────

const DEFAULT_ANGLE_PRESETS = [
  { angle_label: 'WIDE',      angle_name: 'Wide Establishing',  camera_direction: 'Wide establishing shot, full room visible, camera at medium height, balanced composition.' },
  { angle_label: 'VANITY',    angle_name: 'Vanity Mirror',      camera_direction: 'Camera at vanity mirror, close-to-medium shot, soft focus on reflection and surface details.' },
  { angle_label: 'WINDOW',    angle_name: 'Window Light',       camera_direction: 'Camera facing window, natural light streaming in, subject silhouette or three-quarter view.' },
  { angle_label: 'DOORWAY',   angle_name: 'Doorway Threshold',  camera_direction: 'Camera at doorway threshold, looking into the room, sense of arrival or departure.' },
  { angle_label: 'CLOSE',     angle_name: 'Close Detail',       camera_direction: 'Close shot on a specific surface, object, or detail. Intimate and personal.' },
];

function SceneSetCard({ set, onGenerateBase, onRegenerateBase, onUploadBase, onGenerateAngle, onGenerateAll, onDeleteAllAngles, onDeleteSet, onAddAngle, onSeedAngles, onUpdatePrompt, onPreviewPrompt, onCascadeRegenerate, onReorderAngle, onReviewAngle, generatingId, generationProgress }) {
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);
  const isGenerating = generatingId === set.id;
  const progress = generatingId === set.id ? generationProgress : null;
  const primaryStillRaw = set.angles?.find(a => a.still_image_url)?.still_image_url || set.base_still_url || null;
  const bustSuffix = set.updated_at ? `${primaryStillRaw?.includes('?') ? '&' : '?'}v=${new Date(set.updated_at).getTime()}` : '';
  const primaryStill = primaryStillRaw ? `${primaryStillRaw}${bustSuffix}` : null;
  const [showBaseLightbox, setShowBaseLightbox] = useState(false);
  const readyAngles = set.angles?.filter(a => a.generation_status === 'complete').length || 0;
  const totalAngles = set.angles?.length || 0;
  const pendingAngles = set.angles?.filter(a => a.generation_status === 'pending') || [];
  const regenerableAngles = set.angles?.filter(a => a.generation_status === 'complete' || a.generation_status === 'failed') || [];
  const hasBase = !!(set.base_still_url || set.base_runway_seed);
  // Auto-expand when base is ready but no angles are generated yet
  const [expanded, setExpanded] = useState(hasBase && readyAngles === 0);
  const [showAddAngle, setShowAddAngle] = useState(false);
  const [addingAngle, setAddingAngle] = useState(false);
  const [newAngle, setNewAngle] = useState({ angle_label: '', angle_name: '', angle_description: '', camera_direction: '', beat_affinity: '' });
  const [showMenu, setShowMenu] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [editDesc, setEditDesc] = useState(set.canonical_description || '');
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [genStartTime, setGenStartTime] = useState(null);
  const baseElapsed = useElapsedTime(genStartTime, !isGenerating);

  // Track generation start time
  useEffect(() => {
    if (isGenerating && !genStartTime) setGenStartTime(Date.now());
    if (!isGenerating && genStartTime) setGenStartTime(null);
  }, [isGenerating]);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

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
    });
    setNewAngle({ angle_label: '', angle_name: '', angle_description: '', camera_direction: '', beat_affinity: '' });
    setShowAddAngle(false);
    setAddingAngle(false);
  };

  return (
    <div className="scene-sets-card">
      {/* Preview image */}
      <div
        className={`scene-sets-card-preview${primaryStill ? ' has-image clickable' : ''}`}
        onClick={() => { if (primaryStill) setShowBaseLightbox(true); }}
        style={primaryStill ? { cursor: 'pointer' } : undefined}
      >
        {primaryStill ? (
          <img src={primaryStill} alt={set.name} />
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
        </div>

        {set.angles?.some(a => a.video_clip_url) && (
          <div className="scene-sets-card-video-ready">
            <Play size={12} /> Video ready
          </div>
        )}

      </div>

      {/* Card body */}
      <div className="scene-sets-card-body">
        <div className="scene-sets-card-header">
          <div className="scene-sets-card-header-row">
            <div>
              <h3 className="scene-sets-card-title">{set.name}</h3>
              <p className="scene-sets-card-subtitle">
                {totalAngles === 0 ? 'Base ready — click Angles to continue' : `${readyAngles}/${totalAngles} angles ready`}
              </p>
            </div>
            <div className="scene-sets-card-header-utils">
              <button
                onClick={() => setExpanded(e => !e)}
                className="scene-sets-btn-angles"
              >
                {expanded ? 'Hide' : 'Angles'}
              </button>
              <div className="scene-sets-kebab-wrapper" ref={menuRef}>
                <button
                  className="scene-sets-btn-kebab"
                  onClick={() => setShowMenu(m => !m)}
                  title="More options"
                >
                  <MoreVertical size={14} />
                </button>
                {showMenu && (
                  <div className="scene-sets-kebab-menu">
                    <button onClick={() => { setShowMenu(false); setEditDesc(set.canonical_description || ''); setShowPromptEditor(true); }}>
                      <Pencil size={12} /> Edit Prompt
                    </button>
                    <button onClick={() => { setShowMenu(false); handlePreviewPrompt(); }} disabled={loadingPreview}>
                      <Eye size={12} /> Preview Prompt
                    </button>
                    {hasBase && (
                      <button onClick={() => { setShowMenu(false); onRegenerateBase(set); }} disabled={isGenerating}>
                        <RotateCcw size={12} /> Regenerate Base
                      </button>
                    )}
                    <button onClick={() => { setShowMenu(false); onDeleteSet(set); }} disabled={isGenerating} className="scene-sets-kebab-danger">
                      <Trash2 size={12} /> Delete Set
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="scene-sets-card-actions">
            {!hasBase && (
              <>
                <button
                  onClick={() => onGenerateBase(set)}
                  disabled={isGenerating}
                  className={`scene-sets-btn-generate${isGenerating ? ' disabled' : ''}`}
                >
                  {isGenerating ? (
                    <><Loader size={12} className="spin" /> Generating...</>
                  ) : (
                    <><Sparkles size={12} /> Generate Base</>
                  )}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isGenerating}
                  className={`scene-sets-btn-upload${isGenerating ? ' disabled' : ''}`}
                  title="Upload your own base image"
                >
                  <Upload size={12} /> Upload Image
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadBase(set, file);
                    e.target.value = '';
                  }}
                />
              </>
            )}

            {hasBase && pendingAngles.length > 0 && (
              <button
                onClick={() => onGenerateAll(set, false)}
                disabled={isGenerating}
                className={`scene-sets-btn-generate${isGenerating ? ' disabled' : ''}`}
              >
                {isGenerating ? (
                  <><Loader size={12} className="spin" /> Generating...</>
                ) : (
                  <><Sparkles size={12} /> Generate All Angles</>
                )}
              </button>
            )}

            {hasBase && pendingAngles.length === 0 && regenerableAngles.length > 0 && (
              <button
                onClick={() => onGenerateAll(set, true)}
                disabled={isGenerating}
                className={`scene-sets-btn-regenerate${isGenerating ? ' disabled' : ''}`}
              >
                {isGenerating ? (
                  <><Loader size={12} className="spin" /> Regenerating...</>
                ) : (
                  <><RotateCcw size={12} /> Regenerate All</>
                )}
              </button>
            )}

            {totalAngles > 0 && (
              <button
                onClick={() => onDeleteAllAngles(set)}
                disabled={isGenerating}
                className="scene-sets-btn-delete"
                title="Delete all angles and regenerate clean"
              >
                <Trash2 size={12} /> Reset Angles
              </button>
            )}
          </div>
        </div>

        {set.base_runway_seed && set.base_runway_seed !== 'unknown' && (
          <p className="scene-sets-seed-info">
            <Lock size={11} /> Seed: {set.base_runway_seed.slice(0, 20)}...
          </p>
        )}

        {(set.generation_cost > 0 || set.angles?.some(a => a.generation_cost > 0)) && (
          <p className="scene-sets-cost-info">
            <Clock size={11} /> Cost: {(
              parseFloat(set.generation_cost || 0) +
              (set.angles || []).reduce((sum, a) => sum + parseFloat(a.generation_cost || 0), 0)
            ).toFixed(1)} credits
          </p>
        )}

        {isGenerating && !progress && (
          <div className="scene-sets-base-timer">
            <Loader size={12} className="spin" />
            <span>Generating... {formatTime(baseElapsed)}</span>
          </div>
        )}

        {set.script_context && (
          <p className="scene-sets-script-context">{set.script_context}</p>
        )}

        {progress && <GenerationProgress progress={progress} />}

        {expanded && (
          <AngleStrip
            angles={set.angles}
            onGenerate={(angle) => onGenerateAngle(set, angle)}
            onReview={(angle) => onReviewAngle(set, angle)}
            onRegenerate={(angle) => onGenerateAngle(set, angle)}
            onReorder={onReorderAngle ? (angle, dir) => onReorderAngle(set, angle, dir) : null}
            generating={isGenerating}
          />
        )}

        {showPromptEditor && (
          <div className="scene-sets-prompt-editor">
            <label className="scene-sets-prompt-editor-label">Scene Description (used to build AI prompt)</label>
            <textarea
              className="scene-sets-prompt-editor-textarea"
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Describe the space \u2014 layout, lighting, mood, signature details..."
            />
            {set.base_runway_prompt && (
              <details className="scene-sets-prompt-details">
                <summary>View last generated prompt</summary>
                <pre className="scene-sets-prompt-preview">{set.base_runway_prompt}</pre>
              </details>
            )}
            <div className="scene-sets-prompt-editor-actions">
              <button
                className="scene-sets-btn-generate"
                onClick={() => handleSavePrompt(false)}
                disabled={savingPrompt}
              >
                {savingPrompt ? <><Loader size={12} className="spin" /> Saving...</> : <><Save size={12} /> Save</>}
              </button>
              {hasBase && (
                <button
                  className="scene-sets-btn-generate"
                  onClick={() => handleSavePrompt(true)}
                  disabled={savingPrompt || isGenerating}
                >
                  <RotateCcw size={12} /> Save & Regenerate
                </button>
              )}
              {hasBase && totalAngles > 0 && (
                <button
                  className="scene-sets-btn-regenerate"
                  onClick={() => handleSavePrompt(false, true)}
                  disabled={savingPrompt || isGenerating}
                  title="Save, regenerate base image, then regenerate all angles"
                >
                  <Sparkles size={12} /> Save & Regen Everything
                </button>
              )}
              <button className="scene-sets-btn-delete" onClick={() => setShowPromptEditor(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {showBaseLightbox && primaryStill && (
          <ImageLightbox
            src={primaryStill}
            alt={set.name}
            onClose={() => setShowBaseLightbox(false)}
          />
        )}

        {showPromptPreview && previewData && (
          <div className="scene-sets-lightbox-overlay" onClick={() => setShowPromptPreview(false)}>
            <div className="scene-sets-prompt-preview-modal" onClick={e => e.stopPropagation()}>
              <button className="scene-sets-lightbox-close" onClick={() => setShowPromptPreview(false)}>
                <X size={20} />
              </button>
              <h3 className="scene-sets-prompt-preview-title">Prompt Preview — {previewData.angleLabel}</h3>
              <div className="scene-sets-prompt-preview-section">
                <label>Still Image Prompt ({previewData.promptLength} chars)</label>
                <pre className="scene-sets-prompt-preview">{previewData.prompt}</pre>
              </div>
              <div className="scene-sets-prompt-preview-section">
                <label>Video Movement Prompt</label>
                <pre className="scene-sets-prompt-preview">{previewData.videoPrompt}</pre>
              </div>
            </div>
          </div>
        )}

        {expanded && (
          <>
            <AngleStrip
              angles={set.angles}
              onGenerate={(angle) => onGenerateAngle(set, angle)}
              onRegenerate={(angle) => onGenerateAngle(set, angle)}
              onReorder={(angle, direction) => onReorderAngle(set, angle, direction)}
              generating={isGenerating}
            />

            {hasBase && totalAngles === 0 && !showAddAngle && (
              <div className="scene-sets-seed-angles">
                <button
                  className="scene-sets-btn-generate"
                  onClick={() => onSeedAngles(set)}
                  disabled={isGenerating}
                >
                  <Sparkles size={12} /> Seed Default Angles
                </button>
                <span className="scene-sets-seed-hint">Creates 5 standard camera angles (Wide, Vanity, Window, Doorway, Close)</span>
              </div>
            )}

            {hasBase && !showAddAngle && (
              <button
                className="scene-sets-btn-add-angle"
                onClick={() => setShowAddAngle(true)}
              >
                <Plus size={12} /> Add Angle
              </button>
            )}

            {showAddAngle && (
              <div className="scene-sets-add-angle-form">
                <div className="scene-sets-add-angle-row">
                  <div className="scene-sets-create-field">
                    <label>Label</label>
                    <input
                      type="text"
                      placeholder="e.g. WIDE"
                      value={newAngle.angle_label}
                      onChange={e => setNewAngle(a => ({ ...a, angle_label: e.target.value }))}
                      autoFocus
                    />
                  </div>
                  <div className="scene-sets-create-field">
                    <label>Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Wide Morning"
                      value={newAngle.angle_name}
                      onChange={e => setNewAngle(a => ({ ...a, angle_name: e.target.value }))}
                    />
                  </div>
                  <div className="scene-sets-create-field">
                    <label>Beats <span className="scene-sets-optional">(comma-sep)</span></label>
                    <input
                      type="text"
                      placeholder="1,2,3"
                      value={newAngle.beat_affinity}
                      onChange={e => setNewAngle(a => ({ ...a, beat_affinity: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="scene-sets-create-field">
                  <label>Description <span className="scene-sets-optional">(optional)</span></label>
                  <input
                    type="text"
                    placeholder="What this angle captures..."
                    value={newAngle.angle_description}
                    onChange={e => setNewAngle(a => ({ ...a, angle_description: e.target.value }))}
                  />
                </div>
                <div className="scene-sets-create-field">
                  <label>Camera Direction <span className="scene-sets-optional">(optional)</span></label>
                  <input
                    type="text"
                    placeholder="Camera placement and movement..."
                    value={newAngle.camera_direction}
                    onChange={e => setNewAngle(a => ({ ...a, camera_direction: e.target.value }))}
                  />
                </div>
                <div className="scene-sets-add-angle-actions">
                  <button
                    className="scene-sets-btn-generate"
                    onClick={handleSubmitAngle}
                    disabled={addingAngle || !newAngle.angle_label.trim() || !newAngle.angle_name.trim()}
                  >
                    {addingAngle ? <><Loader size={12} className="spin" /> Adding...</> : <><Plus size={12} /> Add Angle</>}
                  </button>
                  <button
                    className="scene-sets-btn-delete"
                    onClick={() => setShowAddAngle(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

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
  const [newSet, setNewSet] = useState({ name: '', scene_type: 'HOME_BASE', canonical_description: '' });
  const [reviewModal, setReviewModal] = useState(null); // { setId, angle }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSets = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/scene-sets`);
      const json = await res.json();
      setSets(json.data || []);
    } catch {
      setError('Failed to load scene sets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSets(); }, [fetchSets]);

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

  const handleUploadBase = async (set, file) => {
    setGeneratingId(set.id);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}/upload-base`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      showToast(`Base image uploaded for "${set.name}"`);
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

    let completed = 0;
    let failed = 0;
    try {
      for (let i = 0; i < targets.length; i++) {
        progressAngles[i].status = 'generating';
        setGenerationProgress(p => ({ ...p, angles: [...progressAngles], currentIndex: i }));

        try {
          const res = await fetch(`${API_BASE}/scene-sets/${set.id}/angles/${targets[i].id}/generate`, { method: 'POST' });
          if (!res.ok) throw new Error('Failed');
          progressAngles[i].status = 'done';
          completed++;
        } catch {
          progressAngles[i].status = 'failed';
          failed++;
        }
        setGenerationProgress(p => ({ ...p, angles: [...progressAngles], completedCount: completed, failedCount: failed }));
      }

      if (failed === 0) {
        showToast(`All ${targets.length} angles ${regenerate ? 'regenerating' : 'queued for generation'}`);
      } else {
        showToast(`${completed} queued, ${failed} failed`, failed > 0 ? 'error' : 'success');
      }
      fetchSets();
    } catch {
      showToast('Generation failed', 'error');
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
    setTimeout(() => setGenerationProgress(null), 3000);
    setGeneratingId(null);
  };

  const handleCreate = async () => {
    if (!newSet.name.trim()) { showToast('Name is required', 'error'); return; }
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/scene-sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSet.name.trim(),
          scene_type: newSet.scene_type,
          canonical_description: newSet.canonical_description.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to create');
      const json = await res.json();
      const setName = newSet.name.trim();
      setNewSet({ name: '', scene_type: 'HOME_BASE', canonical_description: '' });
      setShowCreateForm(false);
      await fetchSets();

      // If a generation job was auto-queued, poll it and update when done
      if (json.jobId) {
        showToast(`Created "${setName}" — generating base image...`);
        setGeneratingId(json.data.id);
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
      showToast('Failed to create scene set', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSet = async (set) => {
    if (!window.confirm(`Delete scene set "${set.name}"? This will soft-delete the set and all its angles.`)) return;
    try {
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      showToast(`Deleted "${set.name}"`);
      fetchSets();
    } catch {
      showToast('Failed to delete scene set', 'error');
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
      const res = await fetch(`${API_BASE}/scene-sets/${set.id}/angles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(angleData),
      });
      if (!res.ok) throw new Error('Failed');
      showToast(`Added angle "${angleData.angle_label}"`);
      fetchSets();
    } catch {
      showToast('Failed to add angle', 'error');
    }
  };

  const handleSeedAngles = async (set) => {
    try {
      for (const preset of DEFAULT_ANGLE_PRESETS) {
        const res = await fetch(`${API_BASE}/scene-sets/${set.id}/angles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...preset, beat_affinity: [] }),
        });
        if (!res.ok) throw new Error(`Failed to create ${preset.angle_label}`);
      }
      showToast(`Seeded ${DEFAULT_ANGLE_PRESETS.length} default angles`);
      fetchSets();
    } catch (err) {
      showToast(err.message || 'Failed to seed angles', 'error');
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
        body: JSON.stringify({ canonical_description: description }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Cascade regeneration failed');
      }
      const json = await res.json();
      const { successfulAngles, totalAngles } = json.data;
      showToast(`Base + ${successfulAngles}/${totalAngles} angles regenerated!`);
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
          <h2 className="scene-sets-title">Scene Sets</h2>
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
          <div className="scene-sets-create-actions">
            <button
              className="scene-sets-btn-generate"
              onClick={handleCreate}
              disabled={creating || !newSet.name.trim()}
            >
              {creating ? <><Loader size={12} className="spin" /> Creating...</> : <><Plus size={12} /> Create Scene Set</>}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="scene-sets-loading">
          <Loader size={20} className="spin" />
          <p>Loading scene sets...</p>
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
          <p className="scene-sets-empty-title">No scene sets yet</p>
          <p className="scene-sets-empty-body">
            Scene sets are canonical LalaVerse locations. Each set contains
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
              onRetryFailed={handleRetryFailed}
              onDeleteAllAngles={handleDeleteAllAngles}
              onReviewAngle={handleReviewAngle}
              onDeleteSet={handleDeleteSet}
              onAddAngle={handleAddAngle}
              onSeedAngles={handleSeedAngles}
              onUpdatePrompt={handleUpdatePrompt}
              onPreviewPrompt={handlePreviewPrompt}
              onCascadeRegenerate={handleCascadeRegenerate}
              onReorderAngle={handleReorderAngle}
              generatingId={generatingId}
              generationProgress={generationProgress}
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
