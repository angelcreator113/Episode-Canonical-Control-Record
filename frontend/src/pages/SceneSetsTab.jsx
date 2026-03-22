import { useState, useEffect, useCallback, useRef } from 'react';
import { Camera, Play, Lock, Sparkles, Loader, AlertCircle, Plus, X, Clock, CheckCircle2, Trash2, RotateCcw } from 'lucide-react';
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

// ─── ANGLE STRIP ──────────────────────────────────────────────────────────────

function AngleStrip({ angles, onGenerate, generating }) {
  if (!angles || angles.length === 0) return null;

  return (
    <div className="scene-sets-angle-strip">
      {angles.map(angle => {
        const isPending = angle.generation_status === 'pending';
        const isComplete = angle.generation_status === 'complete';
        const isGenerating = angle.generation_status === 'generating';
        const isFailed = angle.generation_status === 'failed';

        return (
          <div
            key={angle.id}
            className={`scene-sets-angle-item${isPending && !generating ? ' clickable' : ''}`}
            onClick={() => isPending && !generating && onGenerate(angle)}
            title={isPending ? `Generate: ${angle.angle_name}` : angle.angle_name}
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

function SceneSetCard({ set, onGenerateBase, onGenerateAngle, onGenerateAll, onDeleteAllAngles, onDeleteSet, onAddAngle, generatingId, generationProgress }) {
  const isGenerating = generatingId === set.id;
  const progress = generatingId === set.id ? generationProgress : null;
  const primaryStill = set.angles?.find(a => a.still_image_url)?.still_image_url || null;
  const readyAngles = set.angles?.filter(a => a.generation_status === 'complete').length || 0;
  const totalAngles = set.angles?.length || 0;
  const pendingAngles = set.angles?.filter(a => a.generation_status === 'pending') || [];
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
      <div className={`scene-sets-card-preview${primaryStill ? ' has-image' : ''}`}>
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
          <div>
            <h3 className="scene-sets-card-title">{set.name}</h3>
            <p className="scene-sets-card-subtitle">
              {readyAngles}/{totalAngles} angles ready
            </p>
          </div>

          <div className="scene-sets-card-actions">
            {!hasBase && (
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
            )}

            {hasBase && pendingAngles.length > 0 && (
              <button
                onClick={() => onGenerateAll(set)}
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

            <button
              onClick={() => onDeleteSet(set)}
              disabled={isGenerating}
              className="scene-sets-btn-delete-set"
              title="Delete this scene set"
            >
              <Trash2 size={12} /> Delete
            </button>

            <button
              onClick={() => setExpanded(e => !e)}
              className="scene-sets-btn-angles"
            >
              {expanded ? 'Hide' : 'Angles'}
            </button>
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

        {expanded && (
          <>
            <AngleStrip
              angles={set.angles}
              onGenerate={(angle) => onGenerateAngle(set, angle)}
              generating={isGenerating}
            />

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

  const handleGenerateAll = async (set) => {
    const pending = set.angles?.filter(a => a.generation_status === 'pending') || [];
    if (pending.length === 0) return;
    setGeneratingId(set.id);

    const progressAngles = pending.map(a => ({ id: a.id, label: a.angle_label, status: 'queued' }));
    setGenerationProgress({ angles: progressAngles, currentIndex: 0, startTime: Date.now(), completedCount: 0, failedCount: 0 });

    let completed = 0;
    let failed = 0;
    try {
      for (let i = 0; i < pending.length; i++) {
        progressAngles[i].status = 'generating';
        setGenerationProgress(p => ({ ...p, angles: [...progressAngles], currentIndex: i }));

        try {
          const res = await fetch(`${API_BASE}/scene-sets/${set.id}/angles/${pending[i].id}/generate`, { method: 'POST' });
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
        showToast(`All ${pending.length} angles queued for generation`);
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
              onGenerateAngle={handleGenerateAngle}
              onGenerateAll={handleGenerateAll}
              onDeleteAllAngles={handleDeleteAllAngles}
              onDeleteSet={handleDeleteSet}
              onAddAngle={handleAddAngle}
              generatingId={generatingId}
              generationProgress={generationProgress}
            />
          ))}
        </div>
      )}
    </div>
  );
}
