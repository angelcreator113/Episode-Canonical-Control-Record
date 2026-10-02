import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import SceneBriefConfirm from '../components/SceneBriefConfirm';
import './ScenePlannerPage.css';

const BEAT_NAMES = [
  'Opening Ritual', 'Login Sequence', 'Welcome', 'Interruption Pulse 1',
  'Reveal', 'Strategic Reaction', 'Interruption Pulse 2', 'Transformation Loop',
  'Reminder/Deadline', 'Event Travel', 'Event Outcome',
  'Deliverable Creation', 'Recap Panel', 'Cliffhanger',
];

const SHOT_LABELS = {
  establishing: 'Establishing', medium: 'Medium', close: 'Close',
  tracking: 'Tracking', cutaway: 'Cutaway', transition: 'Transition',
};

// ─── MISSING ANGLE ────────────────────────────────────────────────────────────
// L4 (Evoni, 2026-10-02; Q19, §8(hh)): "A missing angle shows a specific
// action: 'Entrance angle missing — Upload image / Generate angle'."
// beat.location.missing comes from GET /episode-brief/:id/plan.

function MissingAngle({ beat, busy, onUpload, onGenerate }) {
  const missing = beat.location?.missing;
  if (!missing) return null;
  const n = beat.beat_number;
  return (
    <div className="scene-planner-missing" data-testid={`beat-missing-${n}`}>
      <span className="scene-planner-missing-text">{missing.text}</span>
      <span className="scene-planner-missing-actions">
        <label className={`scene-planner-missing-btn${busy ? ' is-busy' : ''}`}>
          Upload image
          <input type="file" accept="image/*" hidden disabled={busy} aria-label={`Upload image for beat ${n}`}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUpload(beat, f); }} />
        </label>
        <button type="button" className="scene-planner-missing-btn" disabled={busy}
          onClick={() => onGenerate(beat)} data-testid={`beat-generate-angle-${n}`}>Generate angle</button>
      </span>
    </div>
  );
}

// ─── BEAT CARD ────────────────────────────────────────────────────────────────

function BeatCard({ beat, index, onLock, onEdit, missingProps }) {
  return (
    <div className={`scene-planner-card ${beat.locked ? 'locked' : ''}`}>
      <div className="scene-planner-card-image">
        {beat.sceneSet?.base_still_url ? (
          <img src={beat.sceneSet.base_still_url} alt={beat.sceneSet.name} />
        ) : (
          <div className="scene-planner-card-placeholder">✦</div>
        )}
        <div className="scene-planner-card-number">{index + 1}</div>
        {beat.locked && <div className="scene-planner-card-lock">Locked</div>}
        {beat.ai_suggested && !beat.locked && <div className="scene-planner-card-ai">AI</div>}
      </div>

      <div className="scene-planner-card-body">
        <p className="scene-planner-card-beat-name">{beat.beat_name || BEAT_NAMES[index]}</p>
        <p className="scene-planner-card-scene-name">{beat.sceneSet?.name || 'No scene assigned'}</p>

        <div className="scene-planner-card-tags">
          {beat.angle_label && <span className="scene-planner-card-tag angle">{beat.angle_label}</span>}
          {beat.shot_type && <span className="scene-planner-card-tag shot">{SHOT_LABELS[beat.shot_type]}</span>}
        </div>

        {beat.emotional_intent && (
          <p className="scene-planner-card-intent">{beat.emotional_intent}</p>
        )}

        <MissingAngle beat={beat} {...missingProps} />

        <div className="scene-planner-card-actions">
          <button className="scene-planner-card-edit" onClick={() => onEdit(beat)} disabled={beat.locked}
            title={beat.locked ? 'Unlock this beat to edit it' : undefined}>Edit</button>
          <button
            className={`scene-planner-card-lock-btn ${beat.locked ? 'is-locked' : ''}`}
            onClick={() => onLock(beat)}
          >
            {beat.locked ? '🔒' : '🔓'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BEAT ROW ─────────────────────────────────────────────────────────────────

function BeatRow({ beat, index, onLock, onEdit, missingProps }) {
  return (
    <div className={`scene-planner-row ${beat.locked ? 'locked' : ''}`}>
      <div className="scene-planner-row-number">{index + 1}</div>

      <div className="scene-planner-row-beat">
        <p className="scene-planner-row-beat-name">{beat.beat_name || BEAT_NAMES[index]}</p>
        <p className="scene-planner-row-transition">
          {beat.transition_in && beat.transition_in !== 'none' ? `→ ${beat.transition_in}` : ''}
        </p>
      </div>

      <div className="scene-planner-row-scene">
        <p className="scene-planner-row-scene-name">{beat.sceneSet?.name || '— No scene —'}</p>
        <div className="scene-planner-card-tags">
          {beat.angle_label && <span className="scene-planner-card-tag angle">{beat.angle_label}</span>}
          {beat.shot_type && <span className="scene-planner-card-tag shot">{SHOT_LABELS[beat.shot_type]}</span>}
          {beat.ai_suggested && <span className="scene-planner-card-tag angle">AI</span>}
        </div>
      </div>

      <div className="scene-planner-row-intent">
        <p>{beat.emotional_intent || '—'}</p>
        <MissingAngle beat={beat} {...missingProps} />
      </div>

      <div className="scene-planner-row-actions">
        <button className="scene-planner-btn primary" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => onEdit(beat)}
          disabled={beat.locked} title={beat.locked ? 'Unlock this beat to edit it' : undefined}>Edit</button>
        <button
          className={`scene-planner-card-lock-btn ${beat.locked ? 'is-locked' : ''}`}
          onClick={() => onLock(beat)}
        >
          {beat.locked ? '🔒' : '🔓'}
        </button>
      </div>
    </div>
  );
}

// ─── BEAT EDITOR ──────────────────────────────────────────────────────────────
// B2 (Evoni, 2026-10-02): the beats' Edit buttons did nothing. They open
// this editor, which saves through PUT /episode-brief/:episodeId/plan/:beat
// (a locked beat is refused there, and its Edit is disabled here). The scene
// sets offered are the ones linked to this episode.

function BeatEditor({ beat, sceneSets, onSave, onCancel, saving }) {
  const [values, setValues] = useState({
    scene_set_id: beat.scene_set_id || '',
    angle_label: beat.angle_label || '',
    shot_type: beat.shot_type || '',
    emotional_intent: beat.emotional_intent || '',
  });
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const chosen = sceneSets.find((x) => x.id === values.scene_set_id);
  const angleLabels = [...new Set((chosen?.angles || []).map((a) => a.angle_label).filter(Boolean))];
  const options = sceneSets.some((x) => x.id === beat.scene_set_id) || !beat.sceneSet
    ? sceneSets : [{ id: beat.scene_set_id, name: beat.sceneSet.name, angles: [] }, ...sceneSets];

  return (
    <div className="scene-planner-editor" data-testid="beat-editor">
      <p className="scene-planner-editor-title">Edit beat {beat.beat_number}: {beat.beat_name}</p>
      <label className="scene-planner-editor-field">Scene set
        <select aria-label="Scene set" value={values.scene_set_id} onChange={set('scene_set_id')}>
          <option value="">No scene</option>
          {options.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </label>
      {sceneSets.length === 0 && (
        <p className="scene-planner-editor-note">No scene set is linked to this episode yet: link one in the episode's Scenes tab.</p>
      )}
      <label className="scene-planner-editor-field">Angle
        <input aria-label="Angle" list="scene-planner-angles" value={values.angle_label} onChange={set('angle_label')} placeholder="e.g. WIDE" />
        <datalist id="scene-planner-angles">{angleLabels.map((l) => <option key={l} value={l} />)}</datalist>
      </label>
      <label className="scene-planner-editor-field">Shot
        <select aria-label="Shot" value={values.shot_type} onChange={set('shot_type')}>
          <option value="">Not set</option>
          {Object.entries(SHOT_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </label>
      <label className="scene-planner-editor-field">Emotional intent
        <textarea aria-label="Emotional intent" rows={2} value={values.emotional_intent} onChange={set('emotional_intent')} />
      </label>
      <div className="scene-planner-editor-actions">
        <button className="scene-planner-btn primary" onClick={() => onSave({
          scene_set_id: values.scene_set_id || null,
          angle_label: values.angle_label.trim() || null,
          shot_type: values.shot_type || null,
          emotional_intent: values.emotional_intent.trim() || null,
        })} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button className="scene-planner-btn" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}

// ─── BRIEF PANEL ──────────────────────────────────────────────────────────────

function BriefPanel({ brief, onUpdate, onGenerate, generating }) {
  const [values, setValues] = useState({
    arc_number: brief?.arc_number || '',
    position_in_arc: brief?.position_in_arc || '',
    episode_archetype: brief?.episode_archetype || '',
    narrative_purpose: brief?.narrative_purpose || '',
    designed_intent: brief?.designed_intent || 'pass',
    forward_hook: brief?.forward_hook || '',
  });

  return (
    <div className="scene-planner-brief">
      <h3 className="scene-planner-brief-title">
        Episode Brief
        {brief?.status === 'locked' && <span className="scene-planner-brief-locked">LOCKED</span>}
      </h3>

      <div className="scene-planner-brief-grid">
        <div className="scene-planner-field">
          <label>Arc Number (1-3)</label>
          <input type="number" min="1" max="3" value={values.arc_number}
            onChange={e => setValues(v => ({ ...v, arc_number: e.target.value }))} />
        </div>
        <div className="scene-planner-field">
          <label>Position in Arc (1-8)</label>
          <input type="number" min="1" max="8" value={values.position_in_arc}
            onChange={e => setValues(v => ({ ...v, position_in_arc: e.target.value }))} />
        </div>
      </div>

      <div className="scene-planner-brief-grid">
        <div className="scene-planner-field">
          <label>Episode Archetype</label>
          <select value={values.episode_archetype}
            onChange={e => setValues(v => ({ ...v, episode_archetype: e.target.value }))}>
            <option value="">Select...</option>
            {['Trial','Temptation','Breakdown','Redemption','Showcase','Rising','Pressure','Cliffhanger']
              .map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="scene-planner-field">
          <label>Designed Intent</label>
          <select value={values.designed_intent}
            onChange={e => setValues(v => ({ ...v, designed_intent: e.target.value }))}>
            {['slay','pass','safe','fail'].map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      <div className="scene-planner-field" style={{ marginBottom: 12 }}>
        <label>Narrative Purpose</label>
        <textarea value={values.narrative_purpose}
          onChange={e => setValues(v => ({ ...v, narrative_purpose: e.target.value }))}
          rows={2} placeholder="What does this episode do for the season story?" />
      </div>

      <div className="scene-planner-field" style={{ marginBottom: 16 }}>
        <label>Forward Hook</label>
        <textarea value={values.forward_hook}
          onChange={e => setValues(v => ({ ...v, forward_hook: e.target.value }))}
          rows={2} placeholder="What question is left unresolved at episode end?" />
      </div>

      <div className="scene-planner-brief-actions">
        <button className="scene-planner-btn primary" onClick={() => onUpdate(values)}>
          Save Brief
        </button>
        <button className="scene-planner-btn primary" onClick={onGenerate} disabled={generating}>
          {generating ? '⏳ Generating...' : '✦ Generate Scene Plan'}
        </button>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function ScenePlannerPage() {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const [view, setView] = useState('storyboard');
  const [brief, setBrief] = useState(null);
  const [plan, setPlan] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState(null);
  const [editingBeat, setEditingBeat] = useState(null);
  const [episodeSets, setEpisodeSets] = useState([]);
  const [savingBeat, setSavingBeat] = useState(false);
  const [angleBusy, setAngleBusy] = useState(null); // beat number
  const [angleBrief, setAngleBrief] = useState(null); // { beat, setId, angleId, name }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAll = useCallback(async () => {
    try {
      const [briefRes, planRes] = await Promise.all([
        api.get(`/api/v1/episode-brief/${episodeId}`),
        api.get(`/api/v1/episode-brief/${episodeId}/plan`),
      ]);
      setBrief(briefRes.data.data);
      setPlan(planRes.data.data || []);
      setReadiness(planRes.data.readiness || null);
    } catch {
      showToast('Failed to load planner data', 'error');
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleUpdateBrief = async (values) => {
    try {
      const res = await api.put(`/api/v1/episode-brief/${episodeId}`, values);
      setBrief(res.data.data);
      showToast('Brief saved');
    } catch (err) {
      showToast(err.response?.data?.error || 'Save failed', 'error');
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/api/v1/episode-brief/${episodeId}/generate-plan`);
      showToast(`Scene plan generated — ${res.data.data.length} beats mapped`);
      await fetchAll();
    } catch (err) {
      showToast(err.response?.data?.error || 'Generation failed', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleLock = async (beat) => {
    try {
      await api.post(`/api/v1/episode-brief/${episodeId}/plan/${beat.beat_number}/lock`);
      await fetchAll();
    } catch {
      showToast('Lock failed', 'error');
    }
  };

  const handleEdit = async (beat) => {
    setEditingBeat(beat);
    try {
      const res = await api.get(`/api/v1/episodes/${episodeId}/scene-sets`);
      setEpisodeSets(res.data?.data || []);
    } catch (err) {
      console.error('[ScenePlanner] scene sets load failed:', err);
      setEpisodeSets([]);
    }
  };

  const handleSaveBeat = async (values) => {
    setSavingBeat(true);
    try {
      await api.put(`/api/v1/episode-brief/${episodeId}/plan/${editingBeat.beat_number}`, values);
      showToast(`Beat ${editingBeat.beat_number} saved`);
      setEditingBeat(null);
      await fetchAll();
    } catch (err) {
      showToast(err.response?.data?.error || 'Save failed', 'error');
    } finally {
      setSavingBeat(false);
    }
  };

  // The missing angle (Q19): the angle the beat asks for, created when it
  // does not exist yet; an unlocked beat is pointed at it.
  const ensureAngle = async (beat) => {
    const missing = beat.location.missing;
    const setId = beat.scene_set_id;
    let angleId = missing.angle_id;
    let label = missing.label;
    const name = missing.name || 'New angle';
    if (!angleId) {
      const res = await api.post(`/api/v1/scene-sets/${setId}/angles`, {
        angle_label: label || 'OTHER',
        angle_name: name || 'New angle',
        angle_kind: missing.kinds?.[0] || missing.kind || null,
        beat_affinity: [beat.beat_number],
      });
      angleId = res.data?.data?.id;
      label = res.data?.data?.angle_label || label;
      if (!angleId) throw new Error('The angle was not created');
    }
    if (!beat.locked && label && beat.angle_label !== label) {
      await api.put(`/api/v1/episode-brief/${episodeId}/plan/${beat.beat_number}`, { angle_label: label });
    }
    return { setId, angleId, name };
  };

  const handleUploadAngle = async (beat, file) => {
    setAngleBusy(beat.beat_number);
    try {
      const { setId, angleId } = await ensureAngle(beat);
      const form = new FormData();
      form.append('images', file);
      await api.post(`/api/v1/scene-sets/${setId}/angles/${angleId}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast(`Beat ${beat.beat_number}: image uploaded`);
    } catch (err) {
      console.error('[ScenePlanner] angle upload failed:', err);
      showToast(err.response?.data?.error || err.message || 'Upload failed', 'error');
    } finally {
      setAngleBusy(null);
      await fetchAll();
    }
  };

  const handleGenerateAngle = async (beat) => {
    setAngleBusy(beat.beat_number);
    try {
      const target = await ensureAngle(beat);
      setAngleBrief({ beat, ...target });
    } catch (err) {
      console.error('[ScenePlanner] angle create failed:', err);
      showToast(err.response?.data?.error || err.message || 'Could not create the angle', 'error');
      setAngleBusy(null);
    }
  };

  const confirmGenerateAngle = async (overrides) => {
    const { beat, setId, angleId } = angleBrief;
    setAngleBrief(null);
    try {
      await api.post(`/api/v1/scene-sets/${setId}/angles/${angleId}/generate`, { overrides });
      showToast(`Beat ${beat.beat_number}: generating the angle`);
    } catch (err) {
      console.error('[ScenePlanner] angle generate failed:', err);
      showToast(err.response?.data?.error || 'Generation failed', 'error');
    } finally {
      setAngleBusy(null);
      await fetchAll();
    }
  };

  const cancelGenerateAngle = async () => {
    setAngleBrief(null);
    setAngleBusy(null);
    await fetchAll();
  };

  const missingProps = { onUpload: handleUploadAngle, onGenerate: handleGenerateAngle };

  const handleLockAll = async () => {
    try {
      await api.post(`/api/v1/episode-brief/${episodeId}/plan/lock-all`);
      showToast('All beats locked — ready for script generation');
      await fetchAll();
    } catch {
      showToast('Lock all failed', 'error');
    }
  };

  const lockedCount = plan.filter(b => b.locked).length;
  const allLocked = plan.length > 0 && lockedCount === plan.length;

  return (
    <div className="scene-planner">
      {toast && <div className={`scene-planner-toast ${toast.type}`}>{toast.msg}</div>}

      <div className="scene-planner-header">
        <div>
          <h1 className="scene-planner-title">Scene Planner</h1>
          <p className="scene-planner-subtitle">
            Map scenes to beats → generates a grounded script
            {plan.length > 0 && ` · ${lockedCount}/${plan.length} beats locked`}
          </p>
          {/* L5, Q21 (Evoni, 2026-10-02, §8(hh)): flagged, never blocking. */}
          {readiness && readiness.total > 0 && (
            <p className={`scene-planner-readiness${readiness.ready < readiness.total ? ' is-short' : ''}`} data-testid="planner-readiness">
              {readiness.ready === readiness.total
                ? `Every beat has its image (${readiness.total}/${readiness.total}).`
                : `${readiness.ready}/${readiness.total} beats have their image; still needed: beat${readiness.not_ready.length === 1 ? '' : 's'} ${readiness.not_ready.map((b) => b.beat_number).join(', ')}. Planning and writing can go on.`}
            </p>
          )}
        </div>

        <div className="scene-planner-actions">
          <div className="scene-planner-view-toggle">
            {['storyboard', 'list'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`scene-planner-view-btn ${view === v ? 'active' : ''}`}>
                {v === 'storyboard' ? '⊞ Board' : '≡ List'}
              </button>
            ))}
          </div>

          {plan.length > 0 && !allLocked && (
            <button className="scene-planner-btn lock" onClick={handleLockAll}>
              🔒 Lock All
            </button>
          )}

          {allLocked && (
            <button className="scene-planner-btn success"
              onClick={() => navigate(`/episodes/${episodeId}/script-writer`)}>
              ✦ Generate Script →
            </button>
          )}
        </div>
      </div>

      {!loading && (
        <BriefPanel brief={brief} onUpdate={handleUpdateBrief}
          onGenerate={handleGenerate} generating={generating} />
      )}

      {loading && <p className="scene-planner-loading">Loading...</p>}

      {!loading && plan.length === 0 && (
        <div className="scene-planner-empty">
          <div className="scene-planner-empty-icon">✦</div>
          <p className="scene-planner-empty-title">No scene plan yet</p>
          <p className="scene-planner-empty-text">
            Fill in the Episode Brief above, then click Generate Scene Plan.
            AI will map all 14 beats to your available scene sets.
          </p>
        </div>
      )}

      {angleBrief && (
        <SceneBriefConfirm
          setId={angleBrief.setId}
          angleId={angleBrief.angleId}
          title={`Generate the ${angleBrief.name.toLowerCase()} angle for beat ${angleBrief.beat.beat_number}`}
          onConfirm={(overrides) => confirmGenerateAngle(overrides)}
          onCancel={cancelGenerateAngle}
        />
      )}

      {editingBeat && (
        <BeatEditor key={editingBeat.beat_number} beat={editingBeat} sceneSets={episodeSets}
          onSave={handleSaveBeat} onCancel={() => setEditingBeat(null)} saving={savingBeat} />
      )}

      {!loading && plan.length > 0 && (
        view === 'storyboard' ? (
          <div className="scene-planner-storyboard">
            {plan.map((beat, i) => (
              <BeatCard key={beat.id || i} beat={beat} index={i} onLock={handleLock} onEdit={handleEdit}
                missingProps={{ ...missingProps, busy: angleBusy === beat.beat_number }} />
            ))}
          </div>
        ) : (
          <div className="scene-planner-list">
            {plan.map((beat, i) => (
              <BeatRow key={beat.id || i} beat={beat} index={i} onLock={handleLock} onEdit={handleEdit}
                missingProps={{ ...missingProps, busy: angleBusy === beat.beat_number }} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
