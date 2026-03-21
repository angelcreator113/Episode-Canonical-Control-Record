import { useState, useEffect, useCallback } from 'react';
import { Camera, Play, Lock, Sparkles, Loader, AlertCircle, Plus, X } from 'lucide-react';
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

// ─── SCENE SET CARD ───────────────────────────────────────────────────────────

function SceneSetCard({ set, onGenerateBase, onGenerateAngle, generatingId }) {
  const [expanded, setExpanded] = useState(false);
  const isGenerating = generatingId === set.id;
  const primaryStill = set.angles?.find(a => a.still_image_url)?.still_image_url || null;
  const readyAngles = set.angles?.filter(a => a.generation_status === 'complete').length || 0;
  const totalAngles = set.angles?.length || 0;

  return (
    <div className="scene-sets-card">
      {/* Preview image */}
      <div className={`scene-sets-card-preview${primaryStill ? ' has-image' : ''}`}>
        {primaryStill ? (
          <img src={primaryStill} alt={set.name} />
        ) : (
          <div className="scene-sets-card-placeholder">
            <Camera size={32} strokeWidth={1.2} />
            <span>Not yet generated</span>
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
            {set.generation_status === 'pending' && !set.base_runway_seed && (
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

        {expanded && (
          <AngleStrip
            angles={set.angles}
            onGenerate={(angle) => onGenerateAngle(set, angle)}
            generating={isGenerating}
          />
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
      showToast(`Generating base for "${set.name}" — this takes ~45 seconds`);
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
      showToast(`Generating "${angle.angle_name}" — this takes ~45 seconds`);
      setTimeout(fetchSets, 5000);
    } catch {
      showToast('Angle generation failed', 'error');
    } finally {
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
              generatingId={generatingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
