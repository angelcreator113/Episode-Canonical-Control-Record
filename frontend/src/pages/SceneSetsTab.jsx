import { useState, useEffect, useCallback, useRef } from 'react';
import { Camera, Play, Lock, Sparkles, Loader, AlertCircle, Plus, X, Clock, CheckCircle2, Trash2, RotateCcw, Upload, Pencil, Save } from 'lucide-react';
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

function ImageLightbox({ src, alt, set, onClose, onRegenerate, onUpdatePrompt, isGenerating }) {
  const [editing, setEditing] = useState(false);
  const [editDesc, setEditDesc] = useState(set?.canonical_description || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') { if (editing) setEditing(false); else onClose(); } };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, editing]);

  const handleSave = async (andRegenerate = false) => {
    setSaving(true);
    await onUpdatePrompt(set, editDesc);
    setSaving(false);
    setEditing(false);
    if (andRegenerate) {
      onClose();
      onRegenerate(set);
    }
  };

  return (
    <div className="scene-sets-lightbox-overlay" onClick={onClose}>
      <div className="scene-sets-lightbox scene-sets-lightbox-wide" onClick={e => e.stopPropagation()}>
        <button className="scene-sets-lightbox-close" onClick={onClose}>
          <X size={20} />
        </button>
        <div className="scene-sets-lightbox-media">
          <img src={src} alt={alt} className="scene-sets-lightbox-img" />
        </div>
        <div className="scene-sets-lightbox-info">
          <h3>{alt}</h3>
          <span className="scene-sets-lightbox-label">Base Image</span>

          {!editing && (
            <div className="scene-sets-lightbox-actions">
              <button
                className="scene-sets-lightbox-regen"
                onClick={() => { onClose(); onRegenerate(set); }}
                disabled={isGenerating}
              >
                <RotateCcw size={13} /> Regenerate Base
              </button>
              <button
                className="scene-sets-lightbox-edit-btn"
                onClick={() => { setEditDesc(set?.canonical_description || ''); setEditing(true); }}
              >
                <Pencil size={13} /> Edit Prompt
              </button>
            </div>
          )}

          {editing && (
            <div className="scene-sets-prompt-editor">
              <label className="scene-sets-prompt-editor-label">Scene Description (used to build AI prompt)</label>
              <textarea
                className="scene-sets-prompt-editor-textarea"
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                rows={5}
                autoFocus
                placeholder="Describe the space — layout, lighting, mood, signature details..."
              />
              {set?.base_runway_prompt && (
                <details className="scene-sets-prompt-details">
                  <summary>Last generated prompt (read-only)</summary>
                  <pre className="scene-sets-prompt-preview">{set.base_runway_prompt}</pre>
                </details>
              )}
              <div className="scene-sets-prompt-editor-actions">
                <button
                  className="scene-sets-btn-generate"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                >
                  {saving ? <><Loader size={12} className="spin" /> Saving...</> : <><Save size={12} /> Save</>}
                </button>
                <button
                  className="scene-sets-btn-generate"
                  onClick={() => handleSave(true)}
                  disabled={saving || isGenerating}
                >
                  <RotateCcw size={12} /> Save & Regenerate
                </button>
                <button className="scene-sets-btn-delete" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
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
            <img src={angle.still_image_url} alt={angle.angle_name} className="scene-sets-lightbox-img" />
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

function AngleStrip({ angles, onGenerate, onRegenerate, generating }) {
  if (!angles || angles.length === 0) return null;
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const completedAngles = angles.filter(a => a.still_image_url);
  const openLightbox = (angle) => {
    const idx = completedAngles.findIndex(a => a.id === angle.id);
    if (idx !== -1) setLightboxIndex(idx);
  };

  return (
    <div className="scene-sets-angle-strip">
      {angles.map(angle => {
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
                <img src={angle.still_image_url} alt={angle.angle_name} />
              ) : isGenerating ? (
                <Loader size={16} className="spin" />
              ) : isFailed ? (
                <AlertCircle size={16} />
              ) : isPending && !generating ? (
                <Sparkles size={16} className="scene-sets-clickable-icon" />
              ) : (
                <Sparkles size={16} />
              )}

              {angle.video_clip_url && (
                <div className="scene-sets-video-indicator">
                  <Play size={8} />
                </div>
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

            {angle.beat_affinity && angle.beat_affinity.length > 0 && (
              <span className="scene-sets-beat-numbers">
                B{angle.beat_affinity.join(',')}
              </span>
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

function SceneSetCard({ set, onGenerateBase, onRegenerateBase, onUploadBase, onGenerateAngle, onGenerateAll, onDeleteAllAngles, onDeleteSet, onAddAngle, onSeedAngles, onUpdatePrompt, generatingId, generationProgress }) {
  const fileInputRef = useRef(null);
  const isGenerating = generatingId === set.id;
  const progress = generatingId === set.id ? generationProgress : null;
  const primaryStill = set.angles?.find(a => a.still_image_url)?.still_image_url || set.base_still_url || null;
  const [showBaseLightbox, setShowBaseLightbox] = useState(false);
  const readyAngles = set.angles?.filter(a => a.generation_status === 'complete').length || 0;
  const totalAngles = set.angles?.length || 0;
  const pendingAngles = set.angles?.filter(a => a.generation_status === 'pending') || [];
  const regenerableAngles = set.angles?.filter(a => a.generation_status === 'complete' || a.generation_status === 'failed') || [];
  const hasBase = !!set.base_runway_seed;
  // Auto-expand when base is ready but angles aren't generated yet
  const [expanded, setExpanded] = useState(hasBase && readyAngles === 0 && totalAngles > 0);
  const [showAddAngle, setShowAddAngle] = useState(false);
  const [addingAngle, setAddingAngle] = useState(false);
  const [newAngle, setNewAngle] = useState({ angle_label: '', angle_name: '', angle_description: '', camera_direction: '', beat_affinity: '' });

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
                {readyAngles}/{totalAngles} angles ready
              </p>
            </div>
            <div className="scene-sets-card-header-utils">
              <button
                onClick={() => setExpanded(e => !e)}
                className="scene-sets-btn-angles"
              >
                {expanded ? 'Hide' : 'Angles'}
              </button>
              <button
                onClick={() => onDeleteSet(set)}
                disabled={isGenerating}
                className="scene-sets-btn-delete-set"
                title="Delete this scene set"
              >
                <Trash2 size={12} />
              </button>
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
                <RotateCcw size={12} /> Reset Angles
              </button>
            )}
          </div>
        </div>

        {set.base_runway_seed && (
          <p className="scene-sets-seed-info">
            <Lock size={11} /> Seed: {set.base_runway_seed.slice(0, 20)}...
          </p>
        )}

        {set.script_context && (
          <p className="scene-sets-script-context">{set.script_context}</p>
        )}

        {progress && <GenerationProgress progress={progress} />}

        {showBaseLightbox && primaryStill && (
          <ImageLightbox
            src={primaryStill}
            alt={set.name}
            set={set}
            onClose={() => setShowBaseLightbox(false)}
            onRegenerate={onRegenerateBase}
            onUpdatePrompt={onUpdatePrompt}
            isGenerating={isGenerating}
          />
        )}

        {expanded && (
          <>
            <AngleStrip
              angles={set.angles}
              onGenerate={(angle) => onGenerateAngle(set, angle)}
              onRegenerate={(angle) => onGenerateAngle(set, angle)}
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

  const handleGenerateBase = async (set) => {
    setGeneratingId(set.id);
    try {
      await fetch(`${API_BASE}/scene-sets/${set.id}/generate-base`, { method: 'POST' });
      showToast(`Generating base for "${set.name}" — typically takes ~45 seconds`);
      setTimeout(fetchSets, 5000);
    } catch {
      showToast('Generation failed', 'error');
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
      showToast(`Regenerating base for "${set.name}" — typically takes ~45 seconds`);
      setTimeout(fetchSets, 5000);
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
      await fetch(`${API_BASE}/scene-sets/${set.id}/angles/${angle.id}/generate`, { method: 'POST' });
      showToast(`Generating "${angle.angle_name}" — still image ~20s, then video ~25s`);
      setTimeout(fetchSets, 5000);
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
      showToast(`Created "${newSet.name.trim()}"`);
      setNewSet({ name: '', scene_type: 'HOME_BASE', canonical_description: '' });
      setShowCreateForm(false);
      fetchSets();
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

  const filtered = filterType === 'ALL'
    ? sets
    : sets.filter(s => s.scene_type === filterType);

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
              onDeleteAllAngles={handleDeleteAllAngles}
              onDeleteSet={handleDeleteSet}
              onAddAngle={handleAddAngle}
              onSeedAngles={handleSeedAngles}
              onUpdatePrompt={handleUpdatePrompt}
              generatingId={generatingId}
              generationProgress={generationProgress}
            />
          ))}
        </div>
      )}
    </div>
  );
}
